/**
 * Worker solo de reseñas. GET / y GET /resenas.
 * La lectura de Maps está en worker/src/resenas.js (la misma que usa la Fábrica).
 */

import { idValido, leerPreview } from "../../worker/src/resenas.js";

const PAGES = "https://paginadeprueba-collab.github.io";

function permitido(origin) {
  if (!origin) return true;
  if (origin === PAGES || origin.startsWith(PAGES + "/")) return true;
  if (origin === "http://127.0.0.1:8765" || origin === "http://localhost:8765") return true;
  if (origin === "http://127.0.0.1:5500" || origin === "http://localhost:5500") return true;
  return false;
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export default {
  async fetch(request) {
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
      return withCors(origin, json({ error: "not_found" }, 404));
    } catch (err) {
      return withCors(origin, json({ error: "internal", message: String(err && err.message ? err.message : err) }, 500));
    }
  },
};
