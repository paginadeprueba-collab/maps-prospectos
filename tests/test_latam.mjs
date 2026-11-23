// Modo «Provincias y Latinoamérica» en el navegador: consultas, zonas y teléfonos de otros países.
// Correr: node tests/test_latam.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
const req = createRequire(import.meta.url);
const L = req(path.join(docs, "latam.js"));
const Z = JSON.parse(fs.readFileSync(path.join(docs, "zonas-latam.json"), "utf8"));
const I = req(path.join(docs, "inteligencia", "core.js"));
let ok = 0;
const t = (n, fn) => { fn(); ok++; console.log("ok -", n); };
const pais = (n) => L.paisPorNombre(Z.paises, n);

t("arma 'rubro en Ciudad, Provincia, País'", () => {
  assert.deepEqual(L.buildQueries("plomeros", [{ ciudad: "Rosario", region: "Santa Fe" }], pais("Argentina")), ["plomeros en Rosario, Santa Fe, Argentina"]);
  assert.deepEqual(L.buildQueries("dentistas", [{ ciudad: "Guadalajara", region: "Jalisco" }, { ciudad: "Zapopan", region: "Jalisco" }], pais("México")),
    ["dentistas en Guadalajara, Jalisco, México", "dentistas en Zapopan, Jalisco, México"]);
});
t("no repite la provincia si se llama igual que la ciudad, ni duplica", () => {
  assert.deepEqual(L.buildQueries("abogados", [{ ciudad: "Córdoba", region: "Córdoba" }, { ciudad: "córdoba", region: "Córdoba" }], pais("AR")), ["abogados en Córdoba, Argentina"]);
  assert.deepEqual(L.buildQueries("abogados", [{ ciudad: "Montevideo", region: "Montevideo" }], pais("Uruguay")), ["abogados en Montevideo, Uruguay"]);
});
t("Puerto Rico no usa la región en la consulta", () => {
  assert.deepEqual(L.buildQueries("plomeros", [{ ciudad: "San Juan", region: "Área metropolitana" }], pais("PR")), ["plomeros en San Juan, Puerto Rico"]);
});
t("compatible con el workflow: sin ';' ni '|||' y largo < 300", () => {
  const qs = L.buildQueries("plomeros; x", [{ ciudad: "Ciudad|||rara;", region: "Región" }], pais("Chile"));
  assert.equal(qs.length, 1);
  assert.ok(!/[;|]/.test(qs[0]), qs[0]);
  assert.ok(qs[0].length < 300);
  assert.equal(L.buildQueries("", [{ ciudad: "Rosario", region: "Santa Fe" }], pais("AR")).length, 0);
  assert.ok(L.MAX_CIUDADES <= 200);
});
t("todas las ciudades del archivo arman consultas válidas", () => {
  let n = 0;
  Z.paises.forEach((p) => p.regiones.forEach((r) => {
    const qs = L.buildQueries("abogados", r.ciudades.map((c) => ({ ciudad: c, region: r.nombre })), p);
    assert.equal(qs.length, r.ciudades.length, p.id + " " + r.nombre);
    qs.forEach((q) => { assert.ok(q.endsWith(", " + p.nombre) || q.endsWith(" " + p.nombre), q); assert.ok(q.length < 300); });
    n += qs.length;
  }));
  assert.ok(n > 450, "ciudades: " + n);
});
t("zonas: Argentina con 23 provincias (CABA aparte) y países con código", () => {
  const ar = pais("Argentina");
  assert.equal(ar.regiones.length, 23);
  assert.ok(!ar.regiones.some((r) => /aut[oó]noma|^caba$/i.test(r.nombre)));
  assert.ok(Z.paises.length >= 19);
  Z.paises.forEach((p) => assert.match(p.codigo_tel, /^\d{1,3}$/, p.id));
});
t("esInternacional: +598 sí, +54 y números locales no", () => {
  assert.equal(L.esInternacional("+59899123456"), true);
  assert.equal(L.esInternacional("+54 11 4444 5555"), false);
  assert.equal(L.esInternacional("1144445555"), false);
});

t("waDesdeTelefono: búsquedas viejas sin link también tienen WhatsApp", () => {
  assert.equal(L.waDesdeTelefono("1144445555"), "https://wa.me/5491144445555");
  assert.equal(L.waDesdeTelefono("91170965656"), "https://wa.me/5491170965656");
  assert.equal(L.waDesdeTelefono("2966690168"), "https://wa.me/5492966690168");
  assert.equal(L.waDesdeTelefono("351154123456"), "https://wa.me/5493514123456");
  assert.equal(L.waDesdeTelefono("1544445555", "Maza 1, Cdad. Autónoma de Buenos Aires, Argentina"), "https://wa.me/5491144445555");
  assert.equal(L.waDesdeTelefono("1544445555", "x, Córdoba, Argentina"), "");
  assert.equal(L.waDesdeTelefono("+59899123456"), "https://wa.me/59899123456");
  assert.equal(L.waDesdeTelefono("+5351234567"), "https://wa.me/5351234567");
  assert.equal(L.waDesdeTelefono(""), "");
});
t("Brasil fuera, Cuba adentro", () => {
  assert.equal(pais("Brasil"), null);
  assert.equal(pais("Cuba").codigo_tel, "53");
});

// Webs de ejemplo: el número de otro país no recibe 549.
const sb = { console };
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
for (const f of ["ejemplo/hogar.js", "ejemplo/llenar.js", "ejemplo/aplicar.js"]) vm.runInContext(fs.readFileSync(path.join(docs, f), "utf8"), sb, { filename: f });
const hogar = sb.EjemploGrupos.hogar;
const ctx = { rubro: "plomeros", barrios: [], barriosConocidos: [] };

t("ejemplo: plomero de Uruguay → WhatsApp +598, sin 549", () => {
  const o = hogar.payload({ nombre: "Fontanería Sur", categoria: "Plomero", telefono: "+59899123456", whatsapp: "https://wa.me/59899123456", pais: "Uruguay", direccion: "Av. Italia 1, Montevideo, Uruguay" }, ctx);
  assert.ok(o, "payload");
  assert.equal(o.p, "+59899123456");
  assert.equal(sb.EjemploLlenar.waDigits(o), "59899123456");
  assert.equal(sb.EjemploAplicar.waMe(o.p), "https://wa.me/59899123456");
});
t("ejemplo: número fijo de Panamá (10 dígitos con código) no se confunde con uno argentino", () => {
  const o = hogar.payload({ nombre: "Plomería Istmo", categoria: "Plomero", telefono: "+5072123456", whatsapp: "https://wa.me/5072123456", pais: "Panamá" }, ctx);
  assert.equal(sb.EjemploLlenar.waDigits(o), "5072123456");
});
t("ejemplo: Argentina sigue igual (549 + 10 dígitos)", () => {
  const o = hogar.payload({ nombre: "Plomería Boedo", categoria: "Plomero", telefono: "1140346420", whatsapp: "https://wa.me/5491140346420", pais: "Argentina" }, ctx);
  assert.equal(o.p, "1140346420");
  assert.equal(o.w, 1);
  assert.equal(sb.EjemploLlenar.waDigits(o), "5491140346420");
  assert.equal(sb.EjemploAplicar.waMe("1140346420"), "https://wa.me/5491140346420");
  const viejo = hogar.payload({ nombre: "Plomería Boedo", categoria: "Plomero", telefono: "1140346420", whatsapp: "https://wa.me/5491140346420" }, ctx);
  assert.deepEqual(viejo.p, o.p);
});

// Inteligencia: dimensión País con la misma regla de muestra mínima.
t("inteligencia agrupa por país y respeta 'datos insuficientes'", () => {
  const res = {};
  const mk = (i, extra) => Object.assign({ nombre: { valor: "N" + i }, categoria: { valor: "plomeros" } }, extra);
  for (let i = 0; i < 10; i++) { const r = mk(i, { origen: { prospecto: { pais: "Uruguay" } } }); I.registrarContacto(r, { canal: "WhatsApp", resultado: i < 3 ? "interesado" : "no_responde" }); res["u" + i] = r; }
  for (let i = 0; i < 4; i++) { const r = mk(i, { direccion: { valor: "Calle 1, 5000 Córdoba, Argentina" } }); I.registrarContacto(r, { canal: "WhatsApp", resultado: "interesado" }); res["a" + i] = r; }
  const A = I.analizar(res);
  assert.ok(I.DIMENSIONES.some(([d]) => d === "pais"));
  const uy = A.por.pais.find((g) => g.valor === "Uruguay"), ar = A.por.pais.find((g) => g.valor === "Argentina");
  assert.equal(uy.contactos, 10); assert.equal(uy.positivas, 3); assert.equal(uy.suficiente, true);
  assert.equal(ar.contactos, 4); assert.equal(ar.suficiente, false);
  assert.ok(A.insuficientes.some((g) => g.dimension === "pais" && g.valor === "Argentina"));
  assert.ok(!A.mejores.some((g) => g.dimension === "pais" && g.valor === "Argentina"));
  assert.equal(I.tasa(ar.positivas, ar.contactos), "4 de 4 · datos insuficientes");
});

// index.html: tercer modo cableado sin romper CABA.
const html = fs.readFileSync(path.join(docs, "index.html"), "utf8");
t("index.html: modo Provincias y Latinoamérica y CABA intacto", () => {
  assert.match(html, /data-mode="latam" id="modeLatam">Provincias y Latinoamérica</);
  assert.match(html, /data-mode="caba" id="modeCaba">CABA por barrios</);
  assert.match(html, /<script src="latam\.js\?v=[^"]+"><\/script>\s*<script>/);
  assert.match(html, /fetch\("\.\/zonas-latam\.json/);
  assert.match(html, /return \[\.\.\.selectedBarrios\]\.map\(\(b\) => r \+ " en " \+ b \+ ", CABA"\);/);
  assert.match(html, /FabricaLatam\.buildQueries\(rubro, sel, pais\)/);
});

console.log("\n" + ok + " pruebas OK");
