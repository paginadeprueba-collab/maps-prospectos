/* Lee reseñas reales de la ficha pública de Google Maps (el mismo preview que usa el scraper, sin API ni claves).
   En el navegador Google no deja leer la respuesta (CORS): se pide al Worker /resenas.
   Si falla o se corta, devuelve lista vacía. Nunca inventa texto ni nombres. */
(function (root) {
  var TOPE = 160;

  function fichaId(link) {
    var s = String(link || "");
    var ch = s.match(/19s(ChIJ[A-Za-z0-9_-]+)/) || s.match(/(ChIJ[A-Za-z0-9_-]{16,})/);
    if (ch) return ch[1];
    var hex = s.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    return hex ? hex[1] : "";
  }

  function recortar(t) {
    var s = String(t || "").replace(/\s+/g, " ").trim();
    if (s.length <= TOPE) return s;
    var cut = s.slice(0, TOPE);
    var sp = cut.lastIndexOf(" ");
    return (sp > 80 ? cut.slice(0, sp) : cut).replace(/[.,;: ]+$/, "") + "…";
  }

  function en(node, idx) {
    for (var i = 0; i < idx.length; i++) {
      var k = idx[i];
      if (!node || typeof node !== "object" || typeof node.length !== "number" || k < 0 || k >= node.length) return null;
      node = node[k];
    }
    return node;
  }

  function parse(raw) {
    var text = String(raw || "").replace(/^\)]\}'\s*/, "");
    var data;
    try { data = JSON.parse(text); } catch (e) { return []; }
    var lista = en(data, [6, 175, 9, 0, 0]);
    if (!lista || typeof lista.length !== "number") return [];
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var item = lista[i];
      var el = item && item[0] && typeof item[0].length === "number" ? item[0] : item;
      var nombre = en(el, [1, 4, 5, 0]) || en(el, [1, 4, 4]) || en(el, [0, 1]);
      var texto = en(el, [2, 15, 0, 0]) || en(el, [2, 15, 0]);
      var estrellas = Number(en(el, [2, 0, 0]));
      if (!isFinite(estrellas)) estrellas = Number(en(el, [2, 0]));
      if (typeof nombre !== "string" || typeof texto !== "string") continue;
      nombre = nombre.replace(/\s+/g, " ").trim();
      texto = texto.replace(/\s+/g, " ").trim();
      if (!nombre || !texto) continue;
      if (!isFinite(estrellas) || estrellas < 1 || estrellas > 5) estrellas = 0;
      out.push([nombre.slice(0, 40), recortar(texto), Math.round(estrellas)]);
    }
    var altas = out.filter(function (r) { return r[2] >= 4; });
    var bajas = out.filter(function (r) { return r[2] < 4; });
    var elegidas = altas.concat(bajas).slice(0, 4);
    return elegidas;
  }

  function previewDe(html) {
    var m = String(html || "").match(/href="(\/maps\/preview\/place\?[^"]+)"/);
    if (!m) return "";
    return "https://www.google.com" + m[1].replace(/&amp;/g, "&");
  }

  async function leerDentro(link, opts, signal) {
    var o = opts || {};
    var id = fichaId(link);
    if (!id) return { ok: false, motivo: "sin_ficha", reseñas: [] };
    var raw = "";
    var directo = false;
    try {
      try {
        var page = await fetch("https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(id) + "&hl=es", {
          signal: signal,
          headers: { "Accept-Language": "es" }
        });
        if (!page.ok) throw new Error("maps " + page.status);
        var html = await page.text();
        var prev = previewDe(html);
        if (!prev) throw new Error("sin preview");
        var body = await fetch(prev, { signal: signal, headers: { "Accept-Language": "es" } });
        if (!body.ok) throw new Error("preview " + body.status);
        raw = await body.text();
        directo = true;
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        var worker = String(o.worker || "").replace(/\/$/, "");
        if (!worker) throw e;
        var res = await fetch(worker + "/resenas?id=" + encodeURIComponent(id), { signal: signal });
        if (!res.ok) throw new Error("worker " + res.status);
        raw = await res.text();
      }
      return { ok: true, directo: directo, reseñas: parse(raw) };
    } catch (e) {
      var motivo = e && e.name === "AbortError" ? "tiempo" : "fallo";
      return { ok: false, motivo: motivo, reseñas: [] };
    }
  }

  function leer(link, opts) {
    var o = opts || {};
    var ms = o.timeout || 10000;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var corte = new Promise(function (resolve) {
      setTimeout(function () {
        if (ctrl) ctrl.abort();
        resolve({ ok: false, motivo: "tiempo", reseñas: [] });
      }, ms);
    });
    return Promise.race([leerDentro(link, o, ctrl ? ctrl.signal : undefined), corte]);
  }

  root.EjemploResenas = { fichaId: fichaId, parse: parse, previewDe: previewDe, leer: leer, recortar: recortar };
})(typeof window !== "undefined" ? window : globalThis);
