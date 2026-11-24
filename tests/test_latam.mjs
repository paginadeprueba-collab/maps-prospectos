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
  assert.ok(n > 800, "ciudades: " + n);
});
t("Catamarca incluye las cabeceras departamentales, no solo 7 ciudades", () => {
  const ar = pais("Argentina");
  const cat = ar.regiones.find((r) => r.nombre === "Catamarca");
  const have = new Set(cat.ciudades);
  ["San Fernando del Valle de Catamarca", "San Isidro", "San José", "Chumbicha", "Recreo", "Antofagasta de la Sierra"].forEach((c) => {
    assert.ok(have.has(c), c);
  });
  assert.ok(cat.ciudades.length >= 16, "ciudades Catamarca: " + cat.ciudades.length);
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
  assert.match(html, /function recortarSiPasaElTope\(/);
  assert.match(html, /El máximo por tanda es/);
  assert.match(html, /function maxLugaresPorTanda\(/);
  assert.match(html, /function guardarColaTanda\(/);
  assert.match(html, /id="btnLatSiguienteTanda"/);
  assert.match(html, /id="btnCabaSiguienteTanda"/);
  assert.match(html, /Siguiente tanda/);
});

t("Argentina: provincias completas, conurbano y cabeceras oficiales", () => {
  const ar = Z.paises.find((p) => p.id === "AR");
  assert.equal(ar.regiones.length, 23);
  const hay = Object.fromEntries(ar.regiones.map((r) => [r.nombre, r.ciudades]));
  assert.ok(hay["Buenos Aires"].length >= 135, "Buenos Aires: " + hay["Buenos Aires"].length);
  assert.ok(hay["Córdoba"].length >= 26);
  assert.ok(hay["Santiago del Estero"].length >= 27);
  assert.ok(hay["Tierra del Fuego"].length >= 3);
  ["Adrogué", "San Justo", "Ramos Mejía", "Monte Grande", "Carhué"].forEach((c) => {
    assert.ok(hay["Buenos Aires"].includes(c), c);
  });
  ["Cosquín", "San Agustín", "Laboulaye"].forEach((c) => assert.ok(hay["Córdoba"].includes(c), c));
  ["Campo Grande", "Puerto Esperanza", "Alba Posse"].forEach((c) => assert.ok(hay["Misiones"].includes(c), c));
  assert.ok(hay["Mendoza"].includes("Villa Nueva"));
  const n = ar.regiones.reduce((s, r) => s + r.ciudades.length, 0);
  assert.ok(n >= 1000, "ciudades AR: " + n);
});

// Barrios / zonas por ciudad (como CABA).
const norm = (x) => L.norm(x);
t("barrios: sin duplicados por ciudad, ciudad existente y nombres limpios", () => {
  let total = 0, ciudades = 0;
  Z.paises.forEach((p) => p.regiones.forEach((r) => {
    Object.entries(r.barrios || {}).forEach(([c, bs]) => {
      assert.ok(r.ciudades.includes(c), p.id + " " + r.nombre + ": " + c + " no está en ciudades");
      assert.ok(Array.isArray(bs) && bs.length >= 5, p.id + " " + c);
      const vistos = new Set();
      bs.forEach((b) => {
        assert.ok(b && b.trim() === b && !/[;|,\n]/.test(b), p.id + " " + c + ": «" + b + "»");
        assert.ok(!vistos.has(norm(b)), p.id + " " + c + ": repetido " + b);
        assert.notEqual(norm(b), norm(c), p.id + " " + c + ": el barrio no puede llamarse como la ciudad");
        vistos.add(norm(b));
      });
      total += bs.length; ciudades++;
    });
  }));
  assert.ok(total >= 1200, "barrios: " + total);
  assert.ok(ciudades >= 50, "ciudades con barrios: " + ciudades);
});
t("barrios: coberturas pedidas (Montevideo, Lima, Bogotá, CDMX, Santiago…)", () => {
  const B = (pid, ciudad) => {
    const p = Z.paises.find((x) => x.id === pid);
    const r = p.regiones.find((x) => (x.barrios || {})[ciudad]);
    assert.ok(r, pid + " " + ciudad);
    return L.barriosDe(r, ciudad);
  };
  assert.ok(B("UY", "Montevideo").length >= 62);
  ["Pocitos", "Carrasco", "Ciudad Vieja", "Malvín", "Cordón", "Prado"].forEach((b) => assert.ok(B("UY", "Montevideo").includes(b), b));
  assert.equal(B("PE", "Lima").length, 43);
  assert.ok(B("PE", "Callao").includes("Ventanilla"));
  ["Usaquén", "Chapinero", "Suba", "Kennedy", "Sumapaz"].forEach((b) => assert.ok(B("CO", "Bogotá").includes(b), b));
  assert.ok(B("CO", "Bogotá").length >= 20);
  assert.ok(B("CO", "Medellín").includes("El Poblado"));
  const cdmx = B("MX", "Ciudad de México");
  ["Coyoacán", "Iztapalapa", "Xochimilco", "Milpa Alta", "Roma Norte", "Polanco"].forEach((b) => assert.ok(cdmx.includes(b), b));
  assert.ok(B("CL", "Santiago").includes("Ñuñoa") && B("CL", "Santiago").length >= 34);
  assert.ok(B("AR", "Córdoba").includes("Nueva Córdoba"));
  assert.ok(B("AR", "Rosario").includes("Fisherton"));
  assert.ok(B("PA", "Ciudad de Panamá").includes("Bella Vista"));
  assert.ok(B("GT", "Ciudad de Guatemala").includes("Zona 10"));
  assert.ok(B("PY", "Asunción").includes("Villa Morra"));
  assert.ok(B("CU", "La Habana").includes("Vedado"));
  assert.ok(!Z.paises.some((p) => p.id === "BR"));
});
t("barrios: arma 'rubro en Barrio, Ciudad, País' sin duplicar", () => {
  const uy = pais("Uruguay");
  assert.deepEqual(L.buildQueries("plomeros", [
    { ciudad: "Montevideo", region: "Montevideo", barrio: "Pocitos" },
    { ciudad: "Montevideo", region: "Montevideo", barrio: "pocitos" },
    { ciudad: "Montevideo", region: "Montevideo" },
  ], uy), ["plomeros en Pocitos, Montevideo, Uruguay", "plomeros en Montevideo, Uruguay"]);
  assert.deepEqual(L.buildQueries("dentistas", [{ ciudad: "Córdoba", region: "Córdoba", barrio: "Nueva Córdoba" }], pais("AR")), ["dentistas en Nueva Córdoba, Córdoba, Argentina"]);
  assert.deepEqual(L.buildQueries("plomeros", [{ ciudad: "San Juan", region: "Área metropolitana", barrio: "Condado" }], pais("PR")), ["plomeros en Condado, San Juan, Puerto Rico"]);
  assert.notEqual(L.clave({ ciudad: "Montevideo", region: "Montevideo" }), L.clave({ ciudad: "Montevideo", region: "Montevideo", barrio: "Pocitos" }));
  assert.equal(L.lugar("Montevideo", "Montevideo", uy, "Pocitos"), "Pocitos, Montevideo, Uruguay");
});
t("barrios: todos arman consultas válidas para el workflow (< 300, país al final)", () => {
  let n = 0;
  Z.paises.forEach((p) => p.regiones.forEach((r) => Object.entries(r.barrios || {}).forEach(([c, bs]) => {
    const qs = L.buildQueries("instalaciones de gas", bs.map((b) => ({ ciudad: c, region: r.nombre, barrio: b })), p);
    assert.equal(qs.length, bs.length, p.id + " " + c);
    qs.forEach((q) => { assert.ok(q.endsWith(", " + p.nombre), q); assert.ok(q.length < 300 && !/[;|]/.test(q), q); });
    n += qs.length;
  })));
  assert.ok(n >= 1200);
  assert.ok(L.MAX_CIUDADES <= 200 && L.MAX_CIUDADES >= 80, "Montevideo entero entra en una búsqueda");
  assert.equal(L.AVISO_BUSQUEDAS, 200);
});
t("index.html: panel de barrios con Todos/Limpiar, marca 'ya' y aviso de búsquedas", () => {
  assert.match(html, /id="latBarriosPanel"/);
  assert.match(html, /id="btnLatBarriosTodos">Todos los barrios</);
  assert.match(html, /id="btnLatBarriosLimpiar">Limpiar</);
  assert.match(html, /id="latAviso"/);
  assert.match(html, /pintarYaLatam\(rubro\)/);
  assert.match(html, /FabricaLatam\.lugar\(x\.ciudad, x\.region, pais, x\.barrio\)/);
});

console.log("\n" + ok + " pruebas OK");
