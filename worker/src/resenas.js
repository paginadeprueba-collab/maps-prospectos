/* Proxy de la ficha pública de Google Maps. Misma lectura que el scraper (preview/place), sin API ni claves.
   Solo acepta un id de ficha (ChIJ… o 0x…:0x…). No es un proxy abierto. */

const ID_OK = /^(ChIJ[A-Za-z0-9_-]{16,}|0x[0-9a-f]+:0x[0-9a-f]+)$/i;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function idValido(id) {
  return ID_OK.test(String(id || ""));
}

export async function leerPreview(id) {
  if (!idValido(id)) {
    const e = new Error("id");
    e.status = 400;
    throw e;
  }
  const pageUrl = "https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(id) + "&hl=es";
  const page = await fetch(pageUrl, {
    headers: { "User-Agent": UA, "Accept-Language": "es-AR,es" },
    redirect: "follow",
  });
  if (!page.ok) {
    const e = new Error("maps " + page.status);
    e.status = 502;
    throw e;
  }
  const html = await page.text();
  const m = html.match(/href="(\/maps\/preview\/place\?[^"]+)"/);
  if (!m) {
    const e = new Error("sin preview");
    e.status = 502;
    throw e;
  }
  const prev = "https://www.google.com" + m[1].replace(/&amp;/g, "&");
  const body = await fetch(prev, {
    headers: { "User-Agent": UA, "Accept-Language": "es-AR,es", Referer: "https://www.google.com/maps" },
    redirect: "follow",
  });
  if (!body.ok) {
    const e = new Error("preview " + body.status);
    e.status = 502;
    throw e;
  }
  return await body.text();
}
