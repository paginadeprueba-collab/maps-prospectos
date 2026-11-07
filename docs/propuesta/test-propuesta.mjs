/* Prueba la propuesta de 12 páginas a partir del diagnóstico existente.
 * node docs/propuesta/test-propuesta.mjs
 * Requiere pdf-lib y @pdf-lib/fontkit (por ejemplo en /tmp/pdfdeps/node_modules). */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join("/tmp/pdfdeps/package.json"));
const PDFLib = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const comercial = require(path.join(root, "docs/impulsa-comercial.js"));
const prop = require(path.join(root, "docs/propuesta-pdf.js"));

const b64 = (n) => Buffer.from(fs.readFileSync(path.join(here, n), "utf8").trim(), "base64");
const slots = JSON.parse(fs.readFileSync(path.join(here, "plantilla-slots.json"), "utf8"));
const deps = {
  PDFLib, fontkit,
  base: b64("plantilla-base.pdf.b64"),
  slots,
  sans: b64("Inter-Regular.ttf.b64"),
  italic: b64("Cormorant-LightItalic.ttf.b64"),
};

function dato(valor, tipo = "comprobado") {
  return { valor, tipo, fuente: "test", fecha: "2026-11-01T15:00:00.000Z" };
}
function ficha(over) {
  const base = {
    key: "k",
    nombre: dato("Negocio"),
    categoria: dato("Comercio"),
    direccion: dato("Calle 1"),
    telefono: dato("1100000000"),
    rating: dato(4.8),
    resenas: dato(40),
    website: { valor: null, tipo: "no_disponible", fuente: "maps", fecha: "2026-11-01T15:00:00.000Z" },
    agenda: { valor: null, tipo: "no_disponible", fuente: "maps", fecha: "2026-11-01T15:00:00.000Z" },
    redes: {},
    investigado_en: "2026-11-07T15:00:00.000Z",
  };
  const r = Object.assign(base, over || {});
  if (over && over.comercial) r.comercial = over.comercial;
  return r;
}
function docDe(r) {
  const an = comercial.analizar(r);
  return { an, doc: comercial.armarDoc(r, an) };
}
function armar(r) {
  const { an, doc } = docDe(r);
  return prop.textos(prop.infoDesde(an, doc));
}

const fallos = [];
function ok(cond, msg) { if (!cond) fallos.push(msg); else console.log("ok", msg); }

const armonident = ficha({
  nombre: dato("ARMONIDENT Odontología (Atención con turno)"),
  categoria: dato("Dentista"),
  rating: dato(5),
  resenas: dato(113),
});
const S1 = armar(armonident);
ok(S1.p1_nombre_1 === "ARMONIDENT" && S1.p1_nombre_2 === "Odontología", "nombre de ARMONIDENT partido");
ok(S1.pie.includes("ARMONIDENT") && !/Núñez|Nunez/i.test(JSON.stringify(S1)), "no copia el nombre Núñez");
ok(S1.p2_rating === "5,0" && S1.p2_resenas === "113", "usa 5,0 y 113 reseñas, no 74");
ok(!/74/.test(S1.p2_obs1 + S1.p3_texto), "el texto no arrastra las 74 reseñas de Núñez");
ok(/no encontramos una web vinculada/i.test(S1.p2_obs2) && !/no tiene web/i.test(S1.p2_obs2), "no afirma ausencia de web solo por no verla");
ok(/pudimos verificar una agenda/i.test(S1.p2_obs2) && !/no hay agenda|no tiene agenda/i.test(S1.p2_obs2), "agenda no verificada, no negada");
ok(/diagnóstico/i.test(S1.p2_oportunidad) && !/unir esa confianza/i.test(S1.p2_oportunidad), "la oportunidad sale del diagnóstico, no del párrafo de Núñez");
ok(S1.oferta === "base" && S1.p11_total === "$400.000" && S1.p11_etapas === "Dos etapas de $200.000", "paquete base $400.000");
ok(/Dominio \.com por 2 años/.test(S1.p11_web) && /Agenda de solicitudes 24\/7/.test(S1.p11_agenda), "alcance base de web y agenda");
ok(/\$200\.000 para iniciar/.test(S1.p12_s4) && /\$200\.000 al finalizar/.test(S1.p12_s4), "pagos 200.000 y 200.000");
ok(!/IMPULSA|recordatorio/i.test(JSON.stringify(S1)), "el PDF no dice IMPULSA ni recordatorios");
ok(/113 reseñas/.test(S1.p3_texto), "la interpretación cita las reseñas reales");

const conWeb = ficha({
  nombre: dato("Clínica Sur"),
  categoria: dato("Odontólogo"),
  rating: dato(4.6),
  resenas: dato(80),
  website: dato("https://www.clinica-sur.example/inicio"),
  agenda: { valor: false, tipo: "comprobado", fuente: "web", fecha: "2026-11-01T15:00:00.000Z" },
});
const S2 = armar(conWeb);
ok(S2.oferta === "con_web", "oferta adaptada porque hay web");
ok(/clinica-sur\.example/.test(S2.p2_obs2) && /no pudimos verificar una agenda/i.test(S2.p2_obs2), "cita la web y no niega la agenda");
ok(!/no tiene web/i.test(S2.p2_obs2 + S2.p5_texto), "no dice que no tiene web");
ok(/Ajustamos la web/.test(S2.p8_s2) && !/Creamos la web/.test(S2.p8_s2), "no ofrece crear la web que ya existe");
ok(!/Dominio \.com por 2 años/.test(S2.p11_web), "no ofrece un dominio nuevo si ya hay web");
ok(/Agenda de solicitudes 24\/7/.test(S2.p11_agenda), "sí ofrece agenda porque no está verificada");
ok(S2.p11_total === "$400.000" && !/\$150|\$250|\$300/.test(S2.p11_total + S2.p11_etapas + S2.p12_s4), "no inventa un precio parcial");
ok(/4,6/.test(S2.p2_obs1) && /80/.test(S2.p2_resenas), "datos propios de Clínica Sur");

const conAmbos = ficha({
  nombre: dato("Luna Odontología"),
  categoria: dato("Clínica dental"),
  rating: dato(4.9),
  resenas: dato(58),
  website: dato("https://luna.example"),
  agenda: dato("Doctoralia"),
});
const S3 = armar(conAmbos);
ok(S3.oferta === "con_web_y_agenda", "oferta con web y agenda");
ok(/ya tiene agenda/i.test(S3.p6_texto) && /se mantiene/i.test(S3.p11_agenda), "no ofrece otra agenda");
ok(/no lo reemplaza|sin reemplazar/i.test(S3.p5_texto + S3.p11_intro), "no reemplaza la web");
ok(!/Creamos la web/.test(S3.p8_s2), "el paso de implementación integra lo existente");
ok(S3.p11_total === "$400.000", "mismo precio de base, sin parcial");

const insuficiente = ficha({
  nombre: dato("Estudio Pérez"),
  categoria: dato("Abogado"),
  telefono: { valor: null, tipo: "no_disponible", fuente: "maps", fecha: "2026-11-01T15:00:00.000Z" },
  rating: { valor: null, tipo: "no_disponible", fuente: "maps", fecha: "2026-11-01T15:00:00.000Z" },
  resenas: { valor: null, tipo: "no_disponible", fuente: "maps", fecha: "2026-11-01T15:00:00.000Z" },
});
const S4 = armar(insuficiente);
ok(S4.p2_rating === "—" && S4.p2_resenas === "—", "sin calificación no se inventan números");
ok(!/5,0|74 reseñas|Núñez/.test(JSON.stringify(S4)), "sin datos no se copia el caso Núñez");
ok(!/no tiene web|no tiene agenda|no tienen web/i.test(JSON.stringify(S4)), "datos insuficientes no afirman ausencia");
ok(/no encontramos una web vinculada/i.test(S4.p2_obs2), "dice que no la vio, no que no exista");
ok(/estudio/i.test(S4.p1_estrategia) && /clientes/.test(S4.p2_resenas_txt), "rubro legal: estudio y clientes");
ok(!/consultorio|pacientes|tratamientos/.test([S4.p2_obs1, S4.p2_obs2, S4.p3_texto, S4.p5_texto, S4.p6_texto, S4.p11_intro, S4.p11_web, S4.p11_agenda].join(" ")), "el texto variable del estudio no habla de consultorio");
ok(S4.oferta === "base" && S4.p11_total === "$400.000", "la base sigue en $400.000");

const verificada = ficha({
  nombre: dato("Peluquería Norte"),
  categoria: dato("Peluquería"),
  rating: dato(4.4),
  resenas: dato(22),
  comercial: { verificacion: { tiene_web: "no", agenda: "no", ads: "no" }, historial: [], versiones: [] },
});
const S5 = armar(verificada);
ok(S5.webAusente === undefined, "textos no expone flags internos de más");
ok(/Se verificó que no hay un sitio web propio ni agenda online/.test(S5.p2_obs2), "solo niega web y agenda si están verificadas");
ok(/sin prometer resultados/.test(S5.p7_texto), "publicidad sin promesa cuando se revisó Ads");
ok(/turno/.test(S5.p4_titulo), "belleza sigue hablando de turno");

const casos = [
  ["armonident", armonident],
  ["con-web", conWeb],
  ["con-ambos", conAmbos],
  ["insuficiente", insuficiente],
  ["verificada", verificada],
];
const docM = await PDFLib.PDFDocument.create();
docM.registerFontkit(fontkit);
const fontSans = await docM.embedFont(deps.sans, { subset: false });
const fontItalic = await docM.embedFont(deps.italic, { subset: false });
function cabe(S) {
  const problemas = [];
  for (const s of slots.slots) {
    const txt = S[s.id];
    if (!txt) continue;
    const font = s.font === "italic" ? fontItalic : fontSans;
    const lineas = String(txt).split("\n").flatMap((par) => {
      const out = []; let linea = "";
      par.split(/\s+/).filter(Boolean).forEach((w) => {
        const prueba = linea ? linea + " " + w : w;
        if (linea && font.widthOfTextAtSize(prueba, s.size) > s.width) { out.push(linea); linea = w; } else linea = prueba;
      });
      if (linea) out.push(linea);
      return out;
    });
    const ancha = lineas.some((l) => font.widthOfTextAtSize(l, s.size) > s.width + 0.5);
    if (lineas.length > s.lines || ancha) problemas.push(s.id + " " + lineas.length + "/" + s.lines);
  }
  return problemas;
}
for (const [nombre, r] of [["armonident", armonident], ["con-web", conWeb], ["con-ambos", conAmbos], ["insuficiente", insuficiente], ["verificada", verificada]]) {
  const { an, doc } = docDe(r);
  const probs = cabe(prop.textos(prop.infoDesde(an, doc)));
  ok(probs.length === 0, nombre + " conserva el tamaño de la plantilla" + (probs.length ? " → " + probs.join(", ") : ""));
}

const outDir = "/tmp/propuesta-pdfs";
fs.mkdirSync(outDir, { recursive: true });
for (const [nombre, r] of casos) {
  const { an, doc } = docDe(r);
  const info = prop.infoDesde(an, doc);
  const res = await prop.generar(info, deps);
  ok(res.avisos.length === 0, nombre + " entra en los slots sin recorte" + (res.avisos.length ? " → " + res.avisos.join(", ") : ""));
  const archivo = path.join(outDir, nombre + ".pdf");
  fs.writeFileSync(archivo, Buffer.from(res.bytes));
  const informe = execFileSync("python3", ["-c", `
import pymupdf, json, sys
doc = pymupdf.open(sys.argv[1])
text = "\\n".join(p.get_text("text") for p in doc)
links = []
for i,p in enumerate(doc):
    for l in p.get_links():
        if l.get("uri"): links.append(l["uri"])
print(json.dumps({"pages": doc.page_count, "text": text, "links": links}))
`, archivo], { encoding: "utf8", maxBuffer: 8e6 });
  const pdf = JSON.parse(informe);
  ok(pdf.pages === 12, nombre + " tiene 12 páginas");
  ok(/CRECIMIENTO COMERCIAL/.test(pdf.text) && !/IMPULSA/.test(pdf.text), nombre + " marca Crecimiento Comercial, sin IMPULSA");
  ok(/Carlos Serrano/.test(pdf.text) && /Ortodoncia Contreras/.test(pdf.text), nombre + " conserva a Carlos Serrano y a Contreras");
  ok(/Aumentaron mucho las consultas/.test(pdf.text), nombre + " conserva el testimonio de Contreras");
  ok(pdf.links.some((u) => u.includes("ortodonciacontreras.com")), nombre + " conserva el enlace de Contreras");
  ok(pdf.links.some((u) => u.startsWith("https://wa.me/5491168713479")), nombre + " conserva el WhatsApp aprobado");
  ok(/73%/.test(pdf.text) && /84%/.test(pdf.text), nombre + " conserva las fuentes institucionales");
  ok(/\$400\.000/.test(pdf.text) && /\$200\.000/.test(pdf.text), nombre + " muestra la inversión acordada");
  if (nombre !== "insuficiente") ok(!/Núñez|NUNEZ/.test(pdf.text), nombre + " no deja el nombre Núñez en el PDF");
  if (nombre === "armonident") {
    ok(/ARMONIDENT/.test(pdf.text) && /113/.test(pdf.text) && !/\b74\b/.test(pdf.text), "ARMONIDENT lleva sus 113 reseñas");
  }
  if (nombre === "con-web") ok(/clinica-sur\.example/.test(pdf.text) && !/Creamos la web/.test(pdf.text), "Clínica Sur no recibe una web nueva");
  if (nombre === "insuficiente") ok(!/\b74\b/.test(pdf.text) && /ESTUDIO/.test(pdf.text), "el estudio no hereda el caso Núñez");
}

if (fallos.length) {
  console.error("\nFALLOS\n- " + fallos.join("\n- "));
  process.exit(1);
}
console.log("\nTodo pasó.");
