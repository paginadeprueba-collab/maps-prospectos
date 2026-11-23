// Plantillas nuevas de la Fábrica de Sitios: plomería 7-9, psicología (2) y constructora (3).
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const ctx = {
  console, setTimeout, clearTimeout, TextEncoder, TextDecoder, CompressionStream, DecompressionStream,
  btoa, atob, URL, URLSearchParams, Blob, Response, Uint8Array,
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["codec.js", "hogar.js", "grupos-extra.js", "llenar.js"]) {
  vm.runInContext(leer("docs/ejemplo/" + f), ctx, { filename: f });
}
const { EjemploGrupos, EjemploLlenar } = ctx;

const NUEVAS = {
  hogar: ["hogar-7.html", "hogar-8.html", "hogar-9.html"],
  psicologia: ["psicologia.html", "psicologia-2.html", "psicologia-3.html"],
  constructora: ["constructora.html", "constructora-2.html", "constructora-3.html", "interiores.html"],
  juridico: ["juridico.html", "juridico-2.html", "juridico-3.html"],
  odontologia: ["odontologia.html", "odontologia-2.html"],
};

// Grupos y payload
assert.deepEqual([...EjemploGrupos.psicologia.paginas], NUEVAS.psicologia.map((p) => "ejemplo/" + p));
assert.deepEqual([...EjemploGrupos.constructora.paginas], NUEVAS.constructora.map((p) => "ejemplo/" + p));
assert.equal(EjemploGrupos.hogar.paginas.length, 6, "hogar.js sigue con sus 6 diseños (flujo de prospectos intacto)");
const campos = {
  k: "psi", nombre: "Ana Pérez", zona: "Caballito", whatsapp: "11 5867-2956", rating: "4,8", cantidad: "31",
  deGoogle: true, servicios: ["Terapia de pareja"], reseñas: [{ nombre: "Laura", texto: "Muy cálida.", estrellas: 5 }],
};
const pPsi = EjemploGrupos.psicologia.payloadSitio(campos);
assert.equal(pPsi.k, "psi");
assert.equal(pPsi.n, "Ana Pérez");
assert.equal(pPsi.b, "Caballito");
assert.ok(pPsi.w || pPsi.p);
assert.equal(pPsi.e[0][0], "Laura");
assert.ok(!("g" in pPsi));
assert.equal(pPsi.u[0], "Terapia de pareja");
const pCon = EjemploGrupos.constructora.payloadSitio({ ...campos, k: "con", nombre: "Constructora Sur", deGoogle: false });
assert.equal(pCon.k, "con");
assert.equal(pCon.g, 0);
assert.equal(EjemploGrupos.constructora.textoSello(pCon), "Opiniones de clientes");
assert.equal(EjemploGrupos.psicologia.textoSello(pPsi), "Reseñas verificadas de Google");
assert.equal(EjemploLlenar.grupoDe("psi").grupo.id, "psicologia");
assert.equal(EjemploLlenar.grupoDe("con").grupo.id, "constructora");
assert.equal(EjemploLlenar.grupoDe("gas").grupo.id, "hogar");
assert.equal(EjemploLlenar.waDigits(pPsi), "5491158672956");

// Reemplazo de marcadores
const c = EjemploLlenar.contexto(pPsi, EjemploLlenar.grupoDe("psi").rubro);
assert.equal(EjemploLlenar.reemplazarTexto("LIC. [NOMBRE Y APELLIDO]", c), "LIC. ANA PÉREZ");
assert.equal(EjemploLlenar.reemplazarTexto("Lic. [Nombre y apellido]", { ...c, nombre: "Lic. Ana Pérez" }), "Lic. Ana Pérez");
assert.equal(EjemploLlenar.reemplazarTexto("Psicología · Matrícula [N.º]", c), "Psicología");
assert.equal(EjemploLlenar.reemplazarTexto("Presencial en [Localidad] · Online", c), "Presencial en Caballito · Online");
assert.equal(
  EjemploLlenar.reemplazarTexto("Soy la Lic. [Nombre y apellido], psicóloga [orientación / especialidad], con matrícula profesional [N.º]. Ofrezco", c),
  "Soy la Lic. Ana Pérez, psicóloga. Ofrezco");

const sinScripts = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
for (const [grupo, files] of Object.entries(NUEVAS)) {
  for (const f of files) {
    const html = leer("docs/ejemplo/" + f);
    assert.match(html, /<\/html>\s*$/i, f + " termina bien");
    // los scripts inline compilan
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/gi)) new vm.Script(m[1], { filename: f });
    for (const s of ["codec.js", "hogar.js", "grupos-extra.js", "llenar.js"]) assert.ok(html.includes('src="' + s), f + " carga " + s);
    // sello verde
    assert.match(html, /class="[^"]*sello-resenas-google[^"]*"[^>]*>(<span[^>]*>G<\/span>)?\s*Reseñas verificadas de Google/, f + " sello");
    assert.match(html, /\.sello-resenas-google[^{]*\{[^}]*#e8f8ee[^}]*#0b7a3b/, f + " sello verde");
    assert.match(html, /data-reviews/, f + " reseñas");
    // WhatsApp del cliente, sin número de relleno
    assert.doesNotMatch(html, /XXXX/, f + " sin número de relleno");
    assert.ok(/WHATSAPP_NUMBER/.test(html) || /data-wa/.test(html), f + " WhatsApp");
    assert.doesNotMatch(html, /demostración|configurar número/i, f + " sin textos de demo");
    // marcadores después de llenar
    const cuerpo = EjemploLlenar.reemplazarTexto(sinScripts(html).split(/<body[^>]*>/i)[1], c);
    assert.doesNotMatch(cuerpo, /\[Nombre|\[NOMBRE/i, f + " sin [Nombre");
    assert.doesNotMatch(cuerpo, /\[[^\]<>"=]{1,60}\]/, f + " sin marcadores");
  }
}

// sitios.html: selector de rubro de plantilla que filtra los diseños
function fakeEl() {
  return {
    innerHTML: "", value: "", placeholder: "", textContent: "", children: [], hidden: false, disabled: false,
    classList: { add() {}, remove() {} }, _l: {},
    addEventListener(t, fn) { this._l[t] = fn; }, focus() {}, select() {}, remove() {},
    querySelector() { return null; }, appendChild(x) { this.children.push(x); return x; },
  };
}
function cargarSitios(borrador) {
  const els = {};
  const store = borrador ? { "fabricaSitios.borrador.v1": JSON.stringify(borrador) } : {};
  const doc = {
    getElementById: (id) => (els[id] ||= fakeEl()),
    querySelector: (s) => (s === "main" ? (els.__main ||= fakeEl()) : null),
    querySelectorAll: () => [],
    createElement: () => fakeEl(),
  };
  const w = {
    document: doc, location: { href: "https://x.test/maps-prospectos/sitios.html", protocol: "https:" },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    setTimeout, clearTimeout, console, URL, alert() {}, confirm: () => false, navigator: {},
  };
  w.window = w; w.globalThis = w;
  vm.createContext(w);
  for (const f of ["codec.js", "hogar.js", "grupos-extra.js"]) vm.runInContext(leer("docs/ejemplo/" + f), w);
  const html = leer("docs/sitios.html");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  vm.runInContext(inline, w, { filename: "sitios.html" });
  return { els, store };
}
const cuenta = (s) => (s.match(/Diseño \d+/g) || []).length;
const sh = leer("docs/sitios.html");
assert.match(sh, /id="plantilla"/);
assert.match(sh, /Rubro de plantilla/);
assert.match(sh, /grupos-extra\.js/);
{
  const { els, store } = cargarSitios(null);
  assert.equal(els.plantilla.value, "hogar");
  assert.equal(cuenta(els.disenos.innerHTML), 9, "plomería: 6 + 3 nuevos");
  assert.match(els.rubro.innerHTML, /value="plo"/);
  els.plantilla.value = "psicologia";
  els.plantilla._l.change();
  assert.equal(cuenta(els.disenos.innerHTML), 3);
  assert.match(els.rubro.innerHTML, /value="psi"/);
  assert.doesNotMatch(els.rubro.innerHTML, /value="plo"/);
  assert.match(els.nombre.placeholder, /Lic\./);
  els.plantilla.value = "constructora";
  els.plantilla._l.change();
  assert.equal(cuenta(els.disenos.innerHTML), 4);
  assert.match(els.rubro.innerHTML, /value="con"/);
  assert.match(els.nombre.placeholder, /Constructora/);
  els.plantilla.value = "juridico";
  els.plantilla._l.change();
  assert.equal(cuenta(els.disenos.innerHTML), 3);
  assert.match(els.rubro.innerHTML, /value="jur"/);
  els.plantilla.value = "odontologia";
  els.plantilla._l.change();
  assert.equal(cuenta(els.disenos.innerHTML), 2);
  assert.match(els.rubro.innerHTML, /value="odo"/);
  void store;
}
{
  // Borrador viejo (sin "plantilla"): abre en plomería con los 6 de siempre + 3.
  const { els } = cargarSitios({ diseno: 4, nombre: "Gas Ya", k: "gas", zona: "Flores" });
  assert.equal(els.plantilla.value, "hogar");
  assert.equal(cuenta(els.disenos.innerHTML), 9);
  assert.equal(els.rubro.value, "gas");
  assert.equal(els.nombre.value, "Gas Ya");
}
{
  const { els } = cargarSitios({ plantilla: "constructora", diseno: 2, nombre: "Obras Sur", k: "con" });
  assert.equal(els.plantilla.value, "constructora");
  assert.equal(cuenta(els.disenos.innerHTML), 4);
}

console.log("ok plantillas nuevas");
