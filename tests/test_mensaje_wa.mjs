import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const start = html.indexOf("function waTextoEjemplo(");
const end = html.indexOf("function cerrarEjemploSheet", start);
assert.ok(start > 0 && end > start, "no encuentro waTextoEjemplo / waEjemplo en index.html");
const snippet = html.slice(start, end);
const sandbox = { encodeURIComponent };
vm.createContext(sandbox);
vm.runInContext(snippet + "\nthis.waTextoEjemplo = waTextoEjemplo;\nthis.waEjemplo = waEjemplo;", sandbox);

const link = "https://paginadeprueba-collab.github.io/maps-prospectos/ejemplo/hogar-2.html?w=hh6tsm";
const esperado = [
  "Hola, ¿cómo estás?",
  "Te encontré en Google Maps y estuve buscando información sobre tu negocio, pero no encontré un sitio donde pueda ver tus trabajos, servicios, reseñas o calcular fácilmente cuánto les puede costar un trabajo.",
  "",
  "Me gustaría ayudarte a mejorar tu servicio. Por eso preparé una muestra de sitio web para tu negocio con una calculadora de presupuestos que envía las solicitudes directo a tu WhatsApp:",
  link,
  "",
  "¿Qué te parece la web?",
  "Si te interesa, podemos ponerla online con 2 años de mantenimiento.",
].join("\n");

assert.equal(sandbox.waTextoEjemplo(link), esperado);
assert.ok(!esperado.includes("  tu "), "no debe quedar doble espacio en 'directo a tu'");
assert.equal(esperado.includes("cuánto"), true);
assert.equal(esperado.includes("¿Cómo estás?") || esperado.includes("¿cómo estás?"), true);

const href = sandbox.waEjemplo({ whatsapp: "https://wa.me/5491140346420" }, link);
assert.equal(href, "https://wa.me/5491140346420?text=" + encodeURIComponent(esperado));

const sinTel = sandbox.waEjemplo({}, link);
assert.equal(sinTel, "https://wa.me/?text=" + encodeURIComponent(esperado));

// El botón general de la tarjeta sigue usando otra plantilla, no esta.
assert.match(html, /const DEFAULT_WA =/);
assert.doesNotMatch(html, /te armo una web de ejemplo para que veas cómo podría verse tu negocio/);

console.log("TEXTO_FINAL:");
console.log(esperado);
console.log("ok");
