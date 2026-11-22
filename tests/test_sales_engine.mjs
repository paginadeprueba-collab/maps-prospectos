// Pruebas del IMPULSA Sales Engine (docs/sales-engine). Correr: node tests/test_sales_engine.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sales-engine');
const SE = createRequire(import.meta.url)(path.join(raiz, 'engine.js'));
let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('ok -', nombre); };

const leer = n => JSON.parse(fs.readFileSync(path.join(raiz, 'data', n + '.json'), 'utf8'));
const D = SE.datosEmbebidos();

t('respaldo embebido igual a data/*.json', () => {
  assert.deepEqual(D, { services: leer('services'), industries: leer('industries'), rules: leer('rules'), objections: leer('objections') });
});

t('10 rubros con problemas, preguntas, indicadores y soluciones', () => {
  assert.equal(D.industries.industrias.length, 10);
  for (const i of D.industries.industrias) for (const k of ['problemas', 'preguntas', 'indicadores', 'soluciones']) assert.ok(i[k].length >= 3, i.id + ' ' + k);
});

t('precios iniciales', () => {
  const c = SE.configPorDefecto(D).precios;
  assert.equal(c.web.precio, 350000); assert.equal(c.meta_ads.precioPrimerMes, 80000);
  assert.equal(c.meta_ads.precioMensual, 50000); assert.equal(c.empleado_virtual.precioMensual, 90000);
});

const MSG = `[22/11 10:31] Juan Pérez: Hola, quiero solicitar un diagnóstico comercial para mi empresa.

NOMBRE: Juan Pérez
WHATSAPP: 11 2345-6789
TIPO DE NEGOCIO: Plomería y gas
¿TENÉS PÁGINA WEB?: No
¿TENÉS PERFIL EN GOOGLE MAPS?: No sé
¿PAGÁS PUBLICIDAD EN INTERNET?: No
¿USÁS ATENCIÓN AUTOMÁTICA O ASISTENTES VIRTUALES?: Me interesa
¿CÓMO TE LLEGAN HOY LOS CLIENTES?: Recomendación, Local físico
¿QUÉ TE GUSTARÍA MEJORAR PRIMERO?: Conseguir más clientes`;

let perfil;
t('importa el mensaje de WhatsApp del formulario', () => {
  const r = SE.parsearMensaje(MSG, D);
  perfil = r.perfil;
  assert.equal(perfil.contacto, 'Juan Pérez'); assert.equal(perfil.whatsapp, '11 2345-6789');
  assert.equal(perfil.rubro, 'Plomería y gas'); assert.equal(perfil.industria, 'hogar');
  assert.equal(perfil.web, 'no'); assert.equal(perfil.maps, 'no_sabe'); assert.equal(perfil.publicidad, 'no');
  assert.equal(perfil.automatica, 'interes'); assert.deepEqual(perfil.canales, ['recomendacion', 'local']);
  assert.equal(perfil.objetivo, 'clientes');
  assert.deepEqual(SE.faltantes(perfil, D).base.map(f => f.campo), ['zona']);
});

t('normaliza respuestas y números', () => {
  assert.equal(SE.normalizar('web', 'Tengo pero no me trae clientes'), 'sin_resultados');
  assert.equal(SE.normalizar('publicidad', 'Sí, en Meta (Facebook/Instagram)'), 'meta');
  assert.equal(SE.numero('$1.500.000'), 1500000); assert.equal(SE.numero('150 mil'), 150000);
  assert.equal(SE.numero('1,5M'), 1500000); assert.equal(SE.numero('30%'), 30);
  assert.equal(SE.detectarIndustria('Restaurante y bar', D), 'gastronomia');
  assert.equal(SE.detectarIndustria('Consultorio odontológico', D), 'salud');
});

let d1;
t('modo automático: diagnóstico completo con los 13 entregables', () => {
  d1 = SE.diagnosticar(perfil, D);
  const ids = d1.hallazgos.map(h => h.id);
  for (const id of ['sin_web', 'maps_no_sabe', 'solo_recomendacion', 'interes_automatizar', 'sin_datos_consultas']) assert.ok(ids.includes(id), id);
  for (const h of d1.hallazgos) for (const k of ['problema', 'evidencia', 'impacto', 'prioridad', 'solucion', 'acciones', 'indicadores', 'fuente']) assert.ok(h[k] && String(h[k]).length, h.id + ' ' + k);
  assert.ok(!/\{\w+\}/.test(d1.hallazgos.map(h => h.evidencia).join(' ')), 'placeholders sin reemplazar');
  assert.equal(d1.hallazgos.find(h => h.id === 'maps_no_sabe').fuente, 'hipotesis');
  assert.equal(d1.hallazgos.find(h => h.id === 'sin_web').fuente, 'declarado');
  assert.equal(d1.hallazgos.find(h => h.id === 'sin_datos_consultas').fuente, 'faltante');
  assert.equal(d1.prioridades.length, 3); assert.ok(d1.prioridades.every(h => h.fuente !== 'faltante'));
  assert.deepEqual(d1.servicios.map(s => s.id), ['web', 'empleado_virtual', 'meta_ads']);
  const p = d1.presupuesto;
  assert.equal(p.totalPrimerMes, 350000 + 80000 + 90000); assert.equal(p.mensualSiguientes, 50000 + 90000);
  assert.ok(p.notaInversion && /no está incluida/.test(p.notaInversion));
  const tx = d1.textos;
  for (const k of ['resumen', 'diagnostico', 'whatsapp', 'seguimiento', 'proximoPaso']) assert.ok(tx[k].length > 30, k);
  assert.ok(tx.oportunidades.length && tx.argumentos.length && tx.objeciones.length && tx.guion.length >= 5 && d1.plan.length >= 3);
  assert.ok(tx.whatsapp.startsWith('Hola Juan, ¿cómo estás?')); assert.ok(/Carlos, de IMPULSA/.test(tx.whatsapp));
  assert.ok(/Plomería y gas|plomería y gas/.test(tx.resumen));
  assert.ok(!/\{\w+\}/.test(JSON.stringify(tx)), 'placeholders en textos');
});

t('modo guiado: adapta preguntas y no repite las respondidas', () => {
  const q1 = SE.preguntasGuiadas(perfil, D);
  const campos = q1.map(q => q.campo);
  assert.ok(campos.includes('zona') && campos.includes('consultasMes'));
  assert.ok(!campos.includes('web') && !campos.includes('canales'), 'repite respondidas');
  assert.ok(!campos.includes('inversionAds'), 'no paga publicidad: no pregunta inversión');
  assert.ok(q1.some(q => /trabajos/.test(q.pregunta)), 'usa términos del rubro');
  assert.ok(q1.some(q => q.rubro), 'incluye preguntas del rubro');
  const p2 = SE.combinar(perfil, { zona: 'Quilmes', consultasMes: 50, ventasMes: 5, ticket: 60000, margen: 40, seguimiento: 'no', capacidad: 'sobra' });
  const campos2 = SE.preguntasGuiadas(p2, D).map(q => q.campo);
  for (const c of ['zona', 'consultasMes', 'ventasMes', 'ticket', 'margen', 'seguimiento', 'capacidad']) assert.ok(!campos2.includes(c), c);
  const d2 = SE.diagnosticar(p2, D);
  const ids = d2.hallazgos.map(h => h.id);
  assert.ok(ids.includes('baja_conversion') && ids.includes('sin_seguimiento'));
  assert.ok(!ids.includes('sin_datos_consultas'));
  assert.match(d2.hallazgos.find(h => h.id === 'baja_conversion').evidencia, /5 ventas sobre 50 consultas por mes \(10%\)/);
  assert.ok(d2.mostrarGrafico && d2.embudo.tasa === 10);
});

t('no recomienda servicios innecesarios', () => {
  const p = SE.combinar(SE.perfilVacio(), { contacto: 'Ana', rubro: 'Estudio contable', web: 'si', maps: 'si', publicidad: 'no', automatica: 'si', canales: ['google', 'redes'], objetivo: 'imagen', zona: 'CABA' });
  const d = SE.diagnosticar(p, D);
  assert.deepEqual(d.servicios, []); assert.equal(d.presupuesto.totalPrimerMes, 0);
  const sat = SE.diagnosticar(SE.combinar(perfil, { capacidad: 'saturado' }), D);
  assert.ok(!sat.servicios.some(s => s.id === 'meta_ads'), 'saturado: no ofrece ads');
});

t('publicidad: costo por venta con datos declarados y dato verificado', () => {
  const p = SE.combinar(perfil, { publicidad: 'meta', inversionAds: 200000, ventasMes: 4, consultasMes: 10, ticket: 50000, margen: 30, verificado: { web: true } });
  const d = SE.diagnosticar(p, D);
  const h = d.hallazgos.find(x => x.id === 'costo_venta_alto');
  assert.ok(h); assert.match(h.evidencia, /\$200\.000 ÷ 4 ventas = \$50\.000 por venta/);
  assert.equal(d.hallazgos.find(x => x.id === 'sin_web').fuente, 'verificado');
  assert.ok(d.hallazgos.find(x => x.id === 'paga_sin_web'));
});

t('precios configurables', () => {
  const c = SE.configPorDefecto(D); c.precios.web.precio = 400000; c.vendedor = 'Lucía';
  const d = SE.diagnosticar(perfil, D, c);
  assert.equal(d.presupuesto.pagoUnico, 400000); assert.ok(/Lucía/.test(d.textos.whatsapp));
});

t('guardado y recuperación (JSON ida y vuelta)', () => {
  const store = { prospectos: [{ id: 'x1', perfil: d1.perfil }], historial: [{ id: 'h1', perfil: d1.perfil }] };
  const back = JSON.parse(JSON.stringify(store));
  const d = SE.diagnosticar(back.prospectos[0].perfil, D);
  assert.deepEqual(d.hallazgos.map(h => h.id), d1.hallazgos.map(h => h.id));
  assert.equal(d.textos.whatsapp, d1.textos.whatsapp);
});

t('index.html: script válido e ids existentes', () => {
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(js);                                    // error de sintaxis -> excepción
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  for (const m of js.matchAll(/\$\('#([\w-]+)/g)) assert.ok(ids.has(m[1]), 'falta #' + m[1]);
  for (const v of ['nuevo', 'diagnosticos', 'prospectos', 'estrategias', 'biblioteca', 'config']) assert.ok(ids.has('v-' + v), v);
  assert.ok(html.includes('IMPULSA') && html.includes('Crecimiento Comercial'));
  assert.ok(!/https?:\/\/(?!wa\.me)[^"' ]+\.(js|css)/.test(html), 'sin dependencias externas');
});

console.log(`\n${ok} pruebas OK`);
