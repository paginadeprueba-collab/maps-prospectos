/**
 * Cloudflare Worker — Fábrica de Prospectos
 *
 * POST /buscar              { query?, queries? } → dispara workflow_dispatch
 * GET  /estado              ?run_id= | latest → estado del run
 * GET  /estado-prospecto    ?key= → { key, status }
 * POST /estado-prospecto    { key, status } → guarda en KV ESTADOS
 * POST /investigar         { prospectos: [...] } → Investigador Comercial IMPULSA (máx 10)
 * OPTIONS /*                CORS preflight
 */

import { investigarProspecto } from "./investigar.js";
import { puntuar } from "./scoring.js";

const ALLOWED_STATUSES = new Set(["pendiente", "contactado", "no_interesa"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return corsPreflight(env, origin);
    }

    try {
      if (request.method === "POST" && url.pathname === "/buscar") {
        return withCors(env, origin, await handleBuscar(request, env));
      }
      if (request.method === "POST" && url.pathname === "/investigar") {
        if (origin && !isAllowedOrigin(env, origin)) return json({ error: "origin_not_allowed" }, 403);
        return withCors(env, origin, await handleInvestigar(request, env));
      }
      if (request.method === "GET" && url.pathname === "/estado") {
        return withCors(env, origin, await handleEstado(url, env));
      }
      if (url.pathname === "/estado-prospecto") {
        if (request.method === "GET") {
          return withCors(env, origin, await handleGetProspecto(url, env));
        }
        if (request.method === "POST") {
          return withCors(env, origin, await handlePostProspecto(request, env));
        }
      }
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return withCors(
          env,
          origin,
          json({ ok: true, service: "maps-prospectos", ts: new Date().toISOString() })
        );
      }
      return withCors(env, origin, json({ error: "not_found" }, 404));
    } catch (err) {
      console.error(err);
      return withCors(
        env,
        origin,
        json({ error: "internal", message: String(err && err.message ? err.message : err) }, 500)
      );
    }
  },
};

function pagesOrigin(env) {
  return (env.PAGES_ORIGIN || "https://paginadeprueba-collab.github.io").replace(/\/$/, "");
}

function isAllowedOrigin(env, origin) {
  if (!origin) return true; // same-origin / curl / server-to-server
  const allowed = pagesOrigin(env);
  if (origin === allowed) return true;
  // Subpath pages live under that origin
  if (origin.startsWith(allowed)) return true;
  // Local testing
  if (origin === "http://127.0.0.1:8765" || origin === "http://localhost:8765") return true;
  if (origin === "http://127.0.0.1:5500" || origin === "http://localhost:5500") return true;
  return false;
}

function corsHeaders(env, origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(env, origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (!origin) {
    // no Origin header — omit ACAO or set Pages origin for convenience
    headers["Access-Control-Allow-Origin"] = pagesOrigin(env);
  }
  // If origin present but not allowed, we still respond but without ACAO
  return headers;
}

function corsPreflight(env, origin) {
  if (origin && !isAllowedOrigin(env, origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
}

function withCors(env, origin, response) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(env, origin);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON inválido");
  }
}

function requireToken(env) {
  if (!env.GH_TOKEN) {
    const e = new Error("Falta secret GH_TOKEN en el Worker");
    e.status = 503;
    throw e;
  }
  return env.GH_TOKEN;
}

function ghHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "maps-prospectos-worker",
  };
}

function repoBase(env) {
  const owner = env.GITHUB_OWNER || "paginadeprueba-collab";
  const repo = env.GITHUB_REPO || "maps-prospectos";
  return { owner, repo, api: `https://api.github.com/repos/${owner}/${repo}` };
}

/** POST /buscar { query?, queries?: string[], expandir?, min_rating?, min_resenas?, profundidad? } */
async function handleBuscar(request, env) {
  const token = requireToken(env);
  const body = await readJson(request);

  let queries = [];
  if (Array.isArray(body.queries)) {
    queries = body.queries
      .map((q) => String(q || "").trim())
      .filter(Boolean)
      .slice(0, 200); // safety cap
  }

  const query = String(body.query || body.busqueda || "").trim();
  if (!queries.length && !query) return json({ error: "query_required" }, 400);
  if (query.length > 500) return json({ error: "query_too_long" }, 400);
  for (const q of queries) {
    if (q.length > 300) return json({ error: "query_too_long" }, 400);
  }

  const label =
    query ||
    (queries.length === 1
      ? queries[0]
      : `${queries[0]} (+${queries.length - 1})`);

  // If explicit queries list → skip expandir in the workflow
  const hasExplicit = queries.length > 0;
  const expandir = hasExplicit ? false : body.expandir !== false;

  const { api } = repoBase(env);
  const workflow = env.WORKFLOW_FILE || "buscar.yml";
  const ref = env.GITHUB_REF || "main";

  const inputs = {
    busqueda: label.slice(0, 200),
    expandir: String(expandir),
    min_rating: String(body.min_rating || "4.0"),
    min_resenas: String(body.min_resenas || "10"),
    profundidad: String(body.profundidad || "1"),
    queries: hasExplicit ? JSON.stringify(queries) : "",
  };

  const payload = { ref, inputs };

  const res = await fetch(`${api}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status !== 204 && res.status !== 200) {
    const detail = await res.text();
    return json(
      { error: "github_dispatch_failed", status: res.status, detail: detail.slice(0, 500) },
      502
    );
  }

  // GitHub no devuelve run_id en el dispatch; buscamos el run recién encolado
  await sleep(1500);
  let run = await fetchLatestRun(env, token);
  // Si el "latest" ya terminó (race con run anterior), reintentar
  if (run && run.status === "completed") {
    await sleep(1500);
    run = await fetchLatestRun(env, token);
  }

  return json({
    ok: true,
    query: label,
    n_queries: hasExplicit ? queries.length : null,
    message: "Búsqueda lanzada",
    run_id: run?.id || null,
    run_url: run?.html_url || null,
    status: run?.status || "queued",
    pages_url: "https://paginadeprueba-collab.github.io/maps-prospectos/",
  });
}

async function fetchLatestRun(env, token) {
  const { api } = repoBase(env);
  const workflow = env.WORKFLOW_FILE || "buscar.yml";
  const res = await fetch(
    `${api}/actions/workflows/${workflow}/runs?per_page=5&event=workflow_dispatch`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const runs = data.workflow_runs || [];
  return runs[0] || null;
}

async function fetchRunById(env, token, runId) {
  const { api } = repoBase(env);
  const res = await fetch(`${api}/actions/runs/${runId}`, { headers: ghHeaders(token) });
  if (!res.ok) return null;
  return res.json();
}

/** GET /estado?run_id=123  |  GET /estado (latest) */
async function handleEstado(url, env) {
  const token = requireToken(env);
  const runId = url.searchParams.get("run_id");
  let run;
  if (runId) {
    run = await fetchRunById(env, token, runId);
  } else {
    run = await fetchLatestRun(env, token);
  }
  if (!run) return json({ status: "unknown", message: "No hay runs" });

  const status = run.status; // queued | in_progress | completed
  const conclusion = run.conclusion; // success | failure | cancelled | null

  let progress = 5;
  let jobs_total = 0;
  let jobs_done = 0;
  let jobs_failed = 0;

  if (status === "queued") {
    progress = 12;
  } else if (status === "completed") {
    progress = 100;
  } else if (status === "in_progress") {
    progress = 35;
    try {
      const jr = await fetch(run.jobs_url + "?per_page=100", { headers: ghHeaders(token) });
      if (jr.ok) {
        const jd = await jr.json();
        const jobs = jd.jobs || [];
        jobs_total = jobs.length;
        jobs_done = jobs.filter((j) => j.status === "completed").length;
        jobs_failed = jobs.filter(
          (j) => j.status === "completed" && j.conclusion && j.conclusion !== "success"
        ).length;
        if (jobs_total > 0) {
          // 15% base + hasta 80% por jobs; deja 5% para publish
          progress = Math.min(95, Math.round(15 + (jobs_done / jobs_total) * 80));
        }
      }
    } catch (e) {
      console.warn("jobs progress", e);
    }
  }

  return json({
    run_id: run.id,
    status,
    conclusion,
    progress,
    jobs_total,
    jobs_done,
    jobs_failed,
    html_url: run.html_url,
    display_title: run.display_title || run.name,
    created_at: run.created_at,
    updated_at: run.updated_at,
    run_started_at: run.run_started_at,
    jobs_url: run.jobs_url,
    pages_url: "https://paginadeprueba-collab.github.io/maps-prospectos/",
    in_progress: status === "queued" || status === "in_progress",
  });
}

function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .slice(0, 512);
}

/** GET /estado-prospecto?key= */
async function handleGetProspecto(url, env) {
  const key = normalizeKey(url.searchParams.get("key"));
  if (!key) return json({ error: "key_required" }, 400);
  if (!env.ESTADOS) return json({ error: "kv_missing" }, 503);
  const val = await env.ESTADOS.get(key);
  if (!val) return json({ key, status: "pendiente", exists: false });
  try {
    const parsed = JSON.parse(val);
    return json({ key, status: parsed.status || "pendiente", updated_at: parsed.updated_at, exists: true });
  } catch {
    return json({ key, status: val, exists: true });
  }
}

/** POST /estado-prospecto { key, status } */
async function handlePostProspecto(request, env) {
  const body = await readJson(request);
  const key = normalizeKey(body.key);
  const status = String(body.status || "").trim();
  if (!key) return json({ error: "key_required" }, 400);
  if (!ALLOWED_STATUSES.has(status)) {
    return json({ error: "status_invalid", allowed: [...ALLOWED_STATUSES] }, 400);
  }
  if (!env.ESTADOS) return json({ error: "kv_missing" }, 503);
  const payload = {
    status,
    updated_at: new Date().toISOString(),
  };
  await env.ESTADOS.put(key, JSON.stringify(payload));
  return json({ ok: true, key, ...payload });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ========== IMPULSA: Investigador Comercial ========== */
const INVESTIGAR_MAX = 10;

/** POST /investigar { prospectos: [{ key, nombre, website?, telefono, whatsapp, link_maps, rating, reseñas, categoria, direccion }] } */
async function handleInvestigar(request, env) {
  // Token opcional: si se configura el secret IMPULSA_TOKEN, se exige el header X-Impulsa-Token.
  if (env.IMPULSA_TOKEN && request.headers.get("X-Impulsa-Token") !== env.IMPULSA_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }
  const body = await readJson(request);
  const lista = Array.isArray(body.prospectos) ? body.prospectos : [];
  if (!lista.length) return json({ error: "prospectos_required" }, 400);
  if (lista.length > INVESTIGAR_MAX) {
    return json({ error: "lote_demasiado_grande", max: INVESTIGAR_MAX }, 400);
  }
  const resultados = [];
  // Secuencial para no saturar sitios ni el límite de subrequests del plan gratuito.
  for (const p of lista) {
    if (!p || typeof p !== "object") continue;
    try {
      const inv = await investigarProspecto(p);
      resultados.push({ ...inv, puntuacion: puntuar(inv), investigado_en: new Date().toISOString() });
    } catch (e) {
      resultados.push({
        key: String(p.key || p.nombre || ""),
        error: String((e && e.message) || e).slice(0, 200),
        investigado_en: new Date().toISOString(),
      });
    }
  }
  return json({ ok: true, version: "impulsa-1", n: resultados.length, resultados });
}
