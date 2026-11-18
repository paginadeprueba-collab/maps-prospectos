/**
 * Worker de reseñas y de links cortos de la web de ejemplo.
 * GET  / y /health
 * GET  /resenas?id=
 * POST /w          guarda el JSON del prospecto y devuelve { ok, id }
 * GET  /w/:id      devuelve ese JSON
 * La lectura de Maps está en worker/src/resenas.js (la misma que usa la Fábrica).
 */

import { idValido, leerPreview } from "../../worker/src/resenas.js";

const PAGES = "https://paginadeprueba-collab.github.io";
const ID_OK = /^[a-z0-9]{6,12}$/;
const ALPH = "abcdefghijkmnpqrstuvwxyz23456789";
const MAX_BYTES = 24 * 1024;

function permitido(origin) {
  if (!origin) return true;
  if (origin === PAGES || origin.startsWith(PAGES + "/")) return true;
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (!origin || permitido(origin)) {
    headers["Access-Control-Allow-Origin"] = origin || PAGES;
  }
  return headers;
}

function withCors(origin, response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function nuevoId() {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < arr.length; i++) out += ALPH[arr[i] % ALPH.length];
  return out;
}

async function handleResenas(url) {
  const id = url.searchParams.get("id") || "";
  if (!idValido(id)) return json({ error: "id" }, 400);
  try {
    const text = await leerPreview(id);
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err && err.status ? err.status : 502;
    return json({ error: "maps", message: String(err && err.message ? err.message : err) }, status);
  }
}

async function handlePostW(request, env) {
  if (!env || !env.WEB_IDS) return json({ error: "kv" }, 500);
  const raw = await request.arrayBuffer();
  if (!raw.byteLength) return json({ error: "size" }, 400);
  if (raw.byteLength > MAX_BYTES) return json({ error: "size" }, 413);
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    return json({ error: "json" }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "json" }, 400);
  const k = typeof data.k === "string" ? data.k.trim() : "";
  if (!k || k.length > 20) return json({ error: "k" }, 400);

  for (let i = 0; i < 8; i++) {
    const id = nuevoId();
    const existe = await env.WEB_IDS.get(id);
    if (existe != null) continue;
    await env.WEB_IDS.put(id, JSON.stringify(data));
    return json({ ok: true, id });
  }
  return json({ error: "id" }, 500);
}

async function handleGetW(id, env) {
  if (!ID_OK.test(id)) return json({ error: "id" }, 400);
  if (!env || !env.WEB_IDS) return json({ error: "kv" }, 500);
  const text = await env.WEB_IDS.get(id);
  if (text == null) return json({ error: "not_found" }, 404);
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin && !permitido(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return withCors(origin, json({ ok: true, service: "resenas-maps" }));
      }
      if (request.method === "GET" && url.pathname === "/resenas") {
        if (origin && !permitido(origin)) return json({ error: "origin_not_allowed" }, 403);
        return withCors(origin, await handleResenas(url));
      }
      if (request.method === "POST" && url.pathname === "/w") {
        if (origin && !permitido(origin)) return withCors(origin, json({ error: "origin_not_allowed" }, 403));
        return withCors(origin, await handlePostW(request, env));
      }
      const m = url.pathname.match(/^\/w\/([a-z0-9]{6,12})$/i);
      if (request.method === "GET" && m) {
        return withCors(origin, await handleGetW(m[1].toLowerCase(), env));
      }
      return withCors(origin, json({ error: "not_found" }, 404));
    } catch (err) {
      return withCors(origin, json({ error: "internal", message: String(err && err.message ? err.message : err) }, 500));
    }
  },
};
