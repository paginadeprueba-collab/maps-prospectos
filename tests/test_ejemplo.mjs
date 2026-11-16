import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = {
  console,
  TextEncoder,
  TextDecoder,
  CompressionStream,
  DecompressionStream,
  btoa,
  atob,
  URL,
  Blob,
  Response,
  Uint8Array,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../docs/ejemplo/codec.js", import.meta.url), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(new URL("../docs/ejemplo/hogar.js", import.meta.url), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(new URL("../docs/ejemplo/resenas.js", import.meta.url), "utf8"), sandbox);

const { EjemploCodec, EjemploGrupos, EjemploResenas } = sandbox;
const hogar = EjemploGrupos.hogar;
const BARRIOS = ["Palermo", "Belgrano", "Parque Chacabuco", "Flores", "San Telmo", "Villa Urquiza", "Caballito", "Colegiales"];

function ctx(rubro, barrios) {
  return { rubro, barrios: barrios || [], barriosConocidos: BARRIOS };
}

const plomero = JSON.parse(fs.readFileSync(new URL("../docs/data/20261031-202941_plomeros-4-barrios-caba.json", import.meta.url), "utf8"));
const gasista = JSON.parse(fs.readFileSync(new URL("../docs/data/20261114-210555_gasistas-19-barrios-caba.json", import.meta.url), "utf8"));
const electricista = JSON.parse(fs.readFileSync(new URL("../docs/data/20261104-123812_electricistas-8-barrios-caba.json", import.meta.url), "utf8"));

const conde = plomero.prospects.find((p) => p.nombre === "Plomeria Conde");
const gonzalo = gasista.prospects.find((p) => p.nombre === "Gasista Matriculado Gonzalo Otranto");
const soler = electricista.prospects.find((p) => p.nombre === "Electricista Soler");
const sinTel = JSON.parse(fs.readFileSync(new URL("../docs/data/20261104-211413_electricistas-12-barrios-caba.json", import.meta.url), "utf8"))
  .prospects.find((p) => p.nombre === "San Telmo Service");
const sinDatos = gasista.prospects.find((p) => p.nombre === "Plomero Gasista Matriculado");
const jsonDir = plomero.prospects.find((p) => p.nombre === "M&M Plomero-Gasista");

assert.equal(hogar.resolver({ categoria: "Abogado", nombre: "Estudio" }, ctx("abogados")), null);
assert.equal(hogar.resolver({ categoria: "Peluquería", nombre: "Corte" }, ctx("peluquerías")), null);
assert.equal(hogar.resolver({ categoria: "Mecánico", nombre: "Taller" }, ctx("mecánicos")), null);
assert.equal(hogar.resolver(conde, ctx("plomeros")).id, "plo");
assert.equal(hogar.resolver(gonzalo, ctx("gasistas")).id, "gas");
assert.equal(hogar.resolver(soler, ctx("electricistas")).id, "ele");
assert.equal(hogar.resolver(sinTel, ctx("electricistas")).id, "cer", "la categoría cerrajero manda si el nombre no dice electricista");
assert.equal(
  hogar.resolver(
    { nombre: "Destapaciones con maquina ,plomero y gasista", categoria: "Fontanero" },
    ctx("gasistas")
  ).id,
  "gas"
);
assert.equal(hogar.resolver({ nombre: "Club", categoria: "Club de trabajadores" }, ctx("gasistas")).id, "gas");
assert.equal(hogar.resolver({ nombre: "Verde", categoria: "Jardinería" }, ctx("")).id, "jar");
assert.equal(hogar.resolver({ nombre: "Sillón", categoria: "Tapicería" }, ctx("tapiceros")).id, "tap");

const pConde = hogar.payload(conde, ctx("plomeros", ["Palermo", "Belgrano", "Colegiales", "Villa Urquiza"]));
assert.equal(pConde.k, "plo");
assert.equal(pConde.n, "Plomeria Conde");
assert.equal(pConde.p, "1140346420");
assert.equal(pConde.w, 1);
assert.equal(pConde.s, 5);
assert.equal(pConde.v, 4);
assert.ok(pConde.a.includes("CABA"));
assert.ok(!pConde.a.includes("Argentina"));
assert.equal(pConde.e, undefined, "no inventa reseñas");
assert.equal(pConde.h, undefined);
assert.ok(typeof pConde.y === "number" && typeof pConde.x === "number");

const pGonzalo = hogar.payload(gonzalo, ctx("gasistas", gasista.barrios));
assert.equal(pGonzalo.k, "gas");
assert.ok(pGonzalo.h.includes("lun"));
assert.equal(pGonzalo.e, undefined);
assert.equal(pGonzalo.b, undefined, "no asigna un barrio de una búsqueda de 19");

const pSoler = hogar.payload(soler, ctx("electricistas"));
assert.equal(pSoler.k, "ele");
assert.equal(pSoler.v, 310);
assert.equal(pSoler.e, undefined);

const pSin = hogar.payload(sinDatos, ctx("gasistas", ["Flores"]));
assert.equal(pSin.k, "gas");
assert.equal(pSin.p, undefined);
assert.equal(pSin.w, undefined);
assert.equal(pSin.b, undefined);
assert.ok(String(pSin.a).includes("Lamadrid"));

const pJson = hogar.payload(jsonDir, ctx("plomeros", ["Palermo"]));
assert.equal(pJson.a, undefined, "no muestra el JSON crudo de la dirección");
assert.equal(pJson.b, undefined, "sin dirección no se inventa el barrio");

const conBarrio = hogar.payload(
  { nombre: "Techista del parque", categoria: "Techista", direccion: "Santander 500, Parque Chacabuco, CABA", telefono: "", rating: "4.8", reseñas: "12" },
  ctx("techistas", ["Palermo", "Flores"])
);
assert.equal(conBarrio.k, "tec");
assert.equal(conBarrio.b, "Parque Chacabuco");
assert.equal(conBarrio.s, 4.8);

const conResenas = hogar.payload(
  {
    ...soler,
    reseñas_texto: [
      { nombre: "Ana", texto: "Vino al toque y dejó todo prolijo." },
      { autor: "Luis", comentario: "Cambió la térmica y explicó el tablero." },
      { texto: "Sin nombre, pero el texto sí está." },
      { nombre: "Nadie" },
    ],
  },
  ctx("electricistas")
);
assert.equal(conResenas.e.length, 3);
assert.equal(JSON.stringify(conResenas.e[0]), JSON.stringify(["Ana", "Vino al toque y dejó todo prolijo."]));
assert.equal(conResenas.e[2][0], "");

const ida = await EjemploCodec.unpack("#" + await EjemploCodec.pack(pConde));
assert.equal(ida.n, pConde.n);
assert.equal(ida.k, "plo");
assert.equal(ida.w, 1);

const largo = {
  ...pSoler,
  e: [
    ["Ana", "Texto de prueba largo para forzar la compresión del hash. ".repeat(8)],
    ["Luis", "Otro comentario de prueba, también largo, para el carrusel. ".repeat(8)],
    ["", "Reseña sin nombre, solo para ver que no se inventa una persona. ".repeat(4)],
  ],
};
const hashLargo = await EjemploCodec.pack(largo);
const vuelta = await EjemploCodec.unpack(hashLargo);
assert.equal(vuelta.e.length, 3);
assert.ok(hashLargo.startsWith("2."), "un hash largo se comprime: " + hashLargo.length);
const hashCorto = await EjemploCodec.pack(pConde);
assert.ok(hashCorto.startsWith("1."), "el caso común queda sin gzip");
assert.ok(hashCorto.length < 500, "link corto, largo " + hashCorto.length);

const u = new URL("https://paginadeprueba-collab.github.io/maps-prospectos/ejemplo/hogar.html");
u.hash = hashCorto;
const desdeUrl = await EjemploCodec.unpack(u.hash);
assert.equal(desdeUrl.n, "Plomeria Conde");

const links = {
  plomero: hashCorto,
  gasista: await EjemploCodec.pack(pGonzalo),
  electricista: await EjemploCodec.pack(pSoler),
  electricistaConResenas: await EjemploCodec.pack(conResenas),
  sinTelefono: await EjemploCodec.pack(pSin),
  cerrajero: await EjemploCodec.pack(hogar.payload(sinTel, ctx("electricistas"))),
};
fs.writeFileSync("/tmp/ejemplo-links.json", JSON.stringify(links, null, 2));

const solerLink = electricista.prospects.find((p) => p.nombre === "Electricista Soler").link_maps;
assert.equal(EjemploResenas.fichaId(solerLink), "ChIJsTLJ91S1vJURA6wDG8_IYSc");
assert.equal(EjemploResenas.fichaId("https://maps.example/?q=nada"), "");

function reviewEl(name, text, stars) {
  const el = [];
  el[1] = [];
  el[1][4] = [];
  el[1][4][5] = [name];
  el[2] = [];
  el[2][0] = [stars];
  el[2][15] = [[text]];
  return [el];
}
const data = [];
data[6] = [];
data[6][175] = [];
data[6][175][9] = [[[[
  reviewEl("Ana", "Vinieron al toque y dejaron todo prolijo.", 5),
  reviewEl("Luis", "Más o menos, tardaron.", 3),
  reviewEl("Mora", "x".repeat(220), 4),
  reviewEl("", "Sin nombre no entra.", 5),
]]]];
// The structure above is too nested. Build it explicitly.
const lista = [
  reviewEl("Ana", "Vinieron al toque y dejaron todo prolijo.", 5),
  reviewEl("Luis", "Más o menos, tardaron.", 3),
  reviewEl("Mora", "Trabajo largo. " + "palabra ".repeat(40), 4),
  reviewEl("", "Sin nombre no entra.", 5),
];
const arbol = [];
arbol[6] = [];
arbol[6][175] = [];
arbol[6][175][9] = [];
arbol[6][175][9][0] = [];
arbol[6][175][9][0][0] = lista;
const parsed = EjemploResenas.parse(")]}'\n" + JSON.stringify(arbol));
assert.equal(parsed.length, 3);
assert.equal(parsed[0][0], "Ana");
assert.equal(parsed[0][2], 5);
assert.equal(parsed[1][0], "Mora");
assert.ok(parsed[1][1].length <= 161);
assert.equal(parsed[2][0], "Luis");
assert.equal(parsed.some((r) => r[1].includes("Sin nombre")), false);
assert.equal(EjemploResenas.parse("no es json").length, 0);

console.log("links", Object.fromEntries(Object.entries(links).map(([k, v]) => [k, v.length])));
console.log("ok");
