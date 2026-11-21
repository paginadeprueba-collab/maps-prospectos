import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const ctx = {
    console, document: undefined, setTimeout, clearTimeout,
    TextEncoder, TextDecoder, CompressionStream, DecompressionStream,
    btoa, atob, URL, URLSearchParams, Blob, Response, Uint8Array,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: rel });
  return ctx;
}

const codec = load("docs/ejemplo/codec.js");
const hogarCtx = load("docs/ejemplo/hogar.js");
const hogar = hogarCtx.EjemploGrupos.hogar;
const EjemploCodec = codec.EjemploCodec;

assert.equal(hogar.textoSello({}), "Reseñas verificadas de Google");
assert.equal(hogar.textoSello({ e: [["Ana", "Bien", 5]] }), "Reseñas verificadas de Google");
assert.equal(hogar.textoSello({ g: 0, e: [["Ana", "Bien", 5]] }), "Opiniones de clientes");
assert.equal(hogar.esGoogle({}), true);
assert.equal(hogar.esGoogle({ g: 0 }), false);

const p = hogar.payloadSitio({
  k: "plo",
  nombre: "Lucas Plomería",
  zona: "Palermo",
  whatsapp: "11 5867-2956",
  rating: "4.9",
  cantidad: "40",
  deGoogle: true,
  servicios: ["Destapes", ["Pérdidas", "Canillas y caños"]],
  reseñas: [
    { nombre: "Ana", texto: "Vino al toque.", estrellas: 5 },
    { nombre: "Luis", texto: "Muy prolijo.", estrellas: 4 },
  ],
});
assert.ok(p);
assert.equal(p.k, "plo");
assert.equal(p.n, "Lucas Plomería");
assert.equal(p.b, "Palermo");
assert.ok(p.w || p.p);
assert.equal(p.s, 4.9);
assert.equal(p.v, 40);
assert.equal(p.e.length, 2);
assert.equal(p.e[0][0], "Ana");
assert.ok(!("g" in p), "marcado como Google no manda g");
assert.equal(p.u[0], "Destapes");
assert.equal(p.u[1][0], "Pérdidas");
assert.equal(p.u[1][1], "Canillas y caños");

const pNo = hogar.payloadSitio({ k: "gas", nombre: "Gas del barrio", zona: "Flores", deGoogle: false, reseñas: [{ nombre: "Mora", texto: "Buena atención.", estrellas: 5 }] });
assert.equal(pNo.g, 0);
assert.equal(hogar.textoSello(pNo), "Opiniones de clientes");

const seis = hogar.payloadSitio({
  k: "ele",
  nombre: "Luz Ya",
  deGoogle: true,
  reseñas: Array.from({ length: 8 }, (_, i) => ({ nombre: "C" + i, texto: "Texto " + i, estrellas: 5 })),
});
assert.equal(seis.e.length, 6, "máximo 6 reseñas");

const svcs = hogar.serviciosDe(hogar.porId("plo"), { u: ["Destapes", ["Pérdidas", "detalle"]] });
assert.equal(svcs[0].h, "Destapes");
assert.equal(svcs[1].p, "detalle");
const def = hogar.serviciosDe(hogar.porId("plo"), {});
assert.ok(def.length >= 3);

const ida = await EjemploCodec.unpack("#" + await EjemploCodec.pack(p));
assert.equal(ida.n, p.n);
assert.equal(JSON.stringify(ida.e), JSON.stringify(p.e));
assert.ok(!("g" in ida));
const idaNo = await EjemploCodec.unpack("#" + await EjemploCodec.pack(pNo));
assert.equal(idaNo.g, 0);

const html = fs.readFileSync(path.join(ROOT, "docs/sitios.html"), "utf8");
assert.match(html, /id="deGoogle"/);
assert.match(html, /checked/);
assert.match(html, /Estas reseñas las copié del perfil de Google del negocio/);
assert.match(html, /Diseño /);
assert.match(html, /paginas/);
assert.match(html, /guardarCorto/);
assert.match(html, /__EJEMPLO_DATA__/);
assert.match(html, /fabricaSitios\.borrador/);
assert.doesNotMatch(html, /dentista/i);
assert.match(fs.readFileSync(path.join(ROOT, "docs/index.html"), "utf8"), /sitios\.html/);

console.log("ok sitios");
