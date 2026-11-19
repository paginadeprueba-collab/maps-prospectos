import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sandbox = {
  console, TextEncoder, TextDecoder, CompressionStream, DecompressionStream,
  btoa, atob, URL, URLSearchParams, Blob, Response, Uint8Array,
  AbortController, setTimeout, clearTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "docs/ejemplo/codec.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "docs/ejemplo/hogar.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "docs/ejemplo/aplicar.js"), "utf8"), sandbox);

const { EjemploCodec, EjemploGrupos, EjemploAplicar } = sandbox;
const hogar = EjemploGrupos.hogar;
assert.equal(hogar.paginas.length, 6);
assert.equal(hogar.paginas[2], "ejemplo/hogar-3.html");
assert.equal(hogar.paginas[5], "ejemplo/hogar-6.html");

assert.equal(EjemploAplicar.iniciales("Plomeria Conde"), "PC");
assert.equal(EjemploAplicar.iniciales("Gasista"), "GA");
assert.equal(EjemploAplicar.waMe("1140346420"), "https://wa.me/5491140346420");
assert.equal(EjemploAplicar.stars(5), "★★★★★");
assert.equal(EjemploAplicar.ratingTxt(4.8), "4,8");

const plomero = JSON.parse(fs.readFileSync(path.join(root, "docs/data/20261031-202941_plomeros-4-barrios-caba.json"), "utf8"));
const gasista = JSON.parse(fs.readFileSync(path.join(root, "docs/data/20261114-210555_gasistas-19-barrios-caba.json"), "utf8"));
const electricista = JSON.parse(fs.readFileSync(path.join(root, "docs/data/20261104-123812_electricistas-8-barrios-caba.json"), "utf8"));
const ctx = (rubro, barrios) => ({ rubro, barrios: barrios || [], barriosConocidos: ["Palermo", "Belgrano", "Flores", "San Telmo"] });

const conde = plomero.prospects.find((p) => p.nombre === "Plomeria Conde");
const sinDatos = gasista.prospects.find((p) => p.nombre === "Plomero Gasista Matriculado");
const soler = electricista.prospects.find((p) => p.nombre === "Electricista Soler");

const pConde = hogar.payload(conde, ctx("plomeros", ["Palermo"]));
const pSin = hogar.payload(sinDatos, ctx("gasistas"));
const pSoler = hogar.payload(soler, ctx("electricistas"));

assert.equal(pConde.k, "plo");
assert.ok(pConde.e && pConde.e.length >= 1, "conde trae reseñas reales");
assert.equal(EjemploAplicar.tituloDe(pConde, hogar.porId("plo")).includes("Plomero"), true);
assert.equal(EjemploAplicar.waNum(pConde), pConde.p);
assert.equal(EjemploAplicar.waNum(pSin), "");
assert.equal(pSoler.k, "ele");
assert.equal(EjemploAplicar.tituloDe(pSoler, hogar.porId("ele")).startsWith("Electricista") || EjemploAplicar.tituloDe(pSoler, hogar.porId("ele")).includes("Luz"), true);
assert.ok(EjemploAplicar.leadDe(pSoler, hogar.porId("ele")).length > 10);

for (const n of [3, 4, 5, 6]) {
  const html = fs.readFileSync(path.join(root, `docs/ejemplo/hogar-${n}.html`), "utf8");
  assert.match(html, /codec\.js\?v=20261118b/);
  assert.match(html, /aplicar\.js\?v=20261118b/);
  assert.match(html, /id="vacio"/);
  assert.match(html, /id="sitio"/);
  assert.match(html, /data-nombre/);
  assert.match(html, /id="calc-service"/);
  assert.equal(html.includes("541158672956"), false, "hogar-" + n + " no debe dejar el WhatsApp de la plantilla");
  assert.equal(/<meta name="description" content="[^"]*<span/.test(html), false, "meta sin tags");
  const hash = await EjemploCodec.pack(n === 6 ? pSoler : n === 4 ? pSin : pConde);
  assert.ok(hash.length > 5);
}

const index = fs.readFileSync(path.join(root, "docs/index.html"), "utf8");
assert.match(index, /function paginasDe/);
assert.match(index, /id="ejemploDisenos"/);
assert.doesNotMatch(index, /id="ejemploUrl2"/); // se arman en el momento

console.log("ok plantillas 3-6");
