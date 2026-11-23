// Un prospecto de otro país recorre lo mismo que uno de CABA: investigar, diagnóstico, propuesta,
// mensajes de WhatsApp, CRM/Inteligencia. Sin red. Correr: node tests/test_latam_flujo.mjs
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(import.meta.url);
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { investigarProspecto } = await import(pathToFileURL(path.join(root, "worker/src/investigar.js")));
const { puntuar } = await import(pathToFileURL(path.join(root, "worker/src/scoring.js")));
const C = req(path.join(root, "docs/impulsa-comercial.js"));
const P = req(path.join(root, "docs/propuesta-pdf.js"));
const I = req(path.join(root, "docs/inteligencia/core.js"));
const L = req(path.join(root, "docs/latam.js"));
let ok = 0;
const t = async (n, fn) => { await fn(); ok++; console.log("ok -", n); };

// Fila tal como la deja filtrar.py para un negocio de Montevideo.
const fila = { nombre: "Fontanería Pocitos", reseñas: "48", rating: "4.8", telefono: "+59899123456", whatsapp: "https://wa.me/59899123456",
  link_maps: "https://www.google.com/maps/place/x", direccion: "Av. Brasil 2500, 11300 Montevideo, Departamento de Montevideo, Uruguay",
  categoria: "Fontanero", horarios: "lun a vie 9–18", pais: "Uruguay" };
const AR_SOLO = /\bCABA\b|Buenos Aires|Argentin|wa\.me\/549(?!1168713479)|\+54\b/;

let r, an, doc;
await t("investigar (Worker, sin web) conserva teléfono y WhatsApp +598", async () => {
  const inv = await investigarProspecto({ ...fila, key: "k-uy" });
  r = { ...inv, puntuacion: puntuar(inv), investigado_en: "2026-11-23T18:00:00.000Z", origen: { busqueda: "x", prospecto: fila } };
  assert.equal(r.whatsapp.valor, "https://wa.me/59899123456");
  assert.equal(r.telefono.valor, "+59899123456");
  assert.ok(r.puntuacion.score >= 0);
  // El Worker publicado arma Meta Ads con country=AR: la Fábrica lo corrige con el país del prospecto.
  assert.match(r.meta_ads.fuente, /country=AR/);
  assert.match(L.adsLibraryPais(r.meta_ads.fuente, fila.pais), /country=UY/);
  assert.equal(L.adsLibraryPais(r.meta_ads.fuente, "Argentina"), r.meta_ads.fuente);
});
await t("diagnóstico y propuesta sin textos solo-Argentina", () => {
  an = C.analizar(r);
  doc = C.armarDoc(r, an);
  const diag = C.htmlDiagnostico(doc, an), prop = C.htmlPropuesta(doc, an);
  assert.ok(diag.includes("Fontanería Pocitos") && prop.includes("Fontanería Pocitos"));
  assert.doesNotMatch(diag, AR_SOLO);
  assert.doesNotMatch(prop, AR_SOLO);
});
await t("mensajes de WhatsApp: sin CABA/+54 y el link va al número uruguayo", () => {
  const m = C.mensajesWA(r, an, doc);
  m.secuencia.concat(m.objeciones).forEach((x) => assert.doesNotMatch(x.texto, AR_SOLO, x.id));
  const wa = r.whatsapp.valor;
  assert.ok(/^https?:/.test(wa) && String(wa).split("?")[0] === "https://wa.me/59899123456");
});
await t("PDF de propuesta (textos): arma todo para el negocio uruguayo", () => {
  const S = P.textos(P.infoDesde(an, doc));
  const todo = JSON.stringify(S);
  assert.ok(todo.includes("Fontanería Pocitos") || todo.includes("FONTANERÍA POCITOS"));
  assert.doesNotMatch(todo.replace(/5491168713479/g, ""), /\bCABA\b|Buenos Aires|\+54\b/);
});
await t("CRM e Inteligencia cuentan el contacto bajo Uruguay", () => {
  I.registrarContacto(r, { canal: "WhatsApp", resultado: "interesado" });
  const A = I.analizar({ "k-uy": r });
  assert.equal(A.por.pais[0].valor, "Uruguay");
  assert.equal(A.por.pais[0].contactos, 1);
  assert.equal(A.por.pais[0].suficiente, false);
});
console.log("\n" + ok + " pruebas OK");
