import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const start = html.indexOf("const LS_WA_EJEMPLO");
const end = html.indexOf("function cerrarEjemploSheet", start);
assert.ok(start > 0 && end > start, "no encuentro LS_WA_EJEMPLO / waTextoEjemplo en index.html");
const snippet = html.slice(start, end);
const sandbox = { encodeURIComponent, console };
vm.createContext(sandbox);
vm.runInContext(
  snippet +
    "\nthis.waGrupoDe = waGrupoDe;\nthis.waTextoEjemplo = waTextoEjemplo;\nthis.waEjemplo = waEjemplo;\nthis.WA_MENSAJES_DEFAULT = WA_MENSAJES_DEFAULT;",
  sandbox
);

const link = "https://paginadeprueba-collab.github.io/maps-prospectos/ejemplo/hogar-2.html?w=hh6tsm";

function esperado(funcion) {
  return [
    "Hola, ¿cómo estás? Mi nombre es Carlos.",
    "Vi tu negocio en Google Maps y te quería consultar si te interesa tener una página web para tus servicios.",
    "Cuenta con " + funcion + ".",
    "",
    "Te hice una muestra gratis de cómo quedaría tu página web:",
    link,
    "",
    "¿Qué te pareció la muestra?",
  ].join("\n");
}

const fnHogar =
  "una calculadora de presupuestos donde el cliente puede tener el presupuesto desde la web y te llega el pedido directo a WhatsApp";
const fnSalud =
  "una agenda digital";
const fnForm =
  "formularios";

const plomero = { nombre: "Juan Pérez Plomería", categoria: "Plomero", whatsapp: "https://wa.me/5491140346420" };
const dentista = { nombre: "Dra. López Odontología", categoria: "Odontóloga", whatsapp: "https://wa.me/5491133334444" };
const psicologa = { nombre: "Lic. Ana Pérez", categoria: "Psicóloga" };
const inmobiliaria = { nombre: "Inmobiliaria Sur", categoria: "Inmobiliaria" };
const abogado = { nombre: "Estudio Gómez", categoria: "Abogado" };
const constructora = { nombre: "Construcciones del Sur", categoria: "Empresa constructora" };
const peluqueria = { nombre: "Salón Luna", categoria: "Peluquería" };

assert.equal(sandbox.waGrupoDe(plomero), "hogar");
assert.equal(sandbox.waGrupoDe(dentista), "salud");
assert.equal(sandbox.waGrupoDe(psicologa), "salud");
assert.equal(sandbox.waGrupoDe(inmobiliaria), "legal");
assert.equal(sandbox.waGrupoDe(abogado), "legal");
assert.equal(sandbox.waGrupoDe(constructora), "hogar");
assert.equal(sandbox.waGrupoDe(peluqueria), "otros");
assert.equal(sandbox.waGrupoDe({}, "kinesiología en Caballito"), "salud");

const txtPlo = sandbox.waTextoEjemplo(link, plomero);
const txtDen = sandbox.waTextoEjemplo(link, dentista);
const txtInm = sandbox.waTextoEjemplo(link, inmobiliaria);
const txtAbo = sandbox.waTextoEjemplo(link, abogado);
const txtOtro = sandbox.waTextoEjemplo(link, peluqueria);

assert.equal(txtPlo, esperado(fnHogar));
assert.equal(txtDen, esperado(fnSalud));
assert.equal(txtInm, esperado(fnForm));
assert.equal(txtAbo, esperado(fnForm));
assert.equal(txtOtro, esperado(fnHogar));

assert.ok(txtPlo.includes("calculadora de presupuestos"));
assert.ok(txtDen.includes("agenda digital"));
assert.ok(!txtDen.includes("calculadora"));
assert.ok(txtPlo.includes(link));
assert.ok(txtDen.includes("Carlos"));
assert.ok(!txtPlo.includes("{LINK}"));
assert.ok(!txtPlo.includes("{FUNCION}"));

const href = sandbox.waEjemplo(plomero, link);
assert.equal(href, "https://wa.me/5491140346420?text=" + encodeURIComponent(txtPlo));

const sinTel = sandbox.waEjemplo({}, link);
assert.equal(sinTel, "https://wa.me/?text=" + encodeURIComponent(sandbox.waTextoEjemplo(link, {})));

const custom = "Hola {NOMBRE}, mirá la muestra: {LINK}";
const conNombre = sandbox.waTextoEjemplo(link, plomero, { hogar: custom });
assert.equal(conNombre, "Hola Juan Pérez Plomería, mirá la muestra: " + link);

assert.match(html, /Editar mensaje de WhatsApp/);
assert.match(html, /Restaurar texto original/);
assert.match(html, /id="waMsgSheet"/);
assert.match(html, /fp_wa_textos_ejemplo/);
assert.doesNotMatch(html, /Te encontré en Google Maps y estuve buscando información/);

console.log("PLOMERO:\n" + txtPlo + "\n");
console.log("DENTISTA:\n" + txtDen + "\n");
console.log("ok");
