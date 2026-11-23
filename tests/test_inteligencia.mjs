// Pruebas de Inteligencia comercial (docs/inteligencia/core.js). Correr: node tests/test_inteligencia.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const req = createRequire(import.meta.url);
const I = req(path.join(raiz, 'inteligencia', 'core.js'));
let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('ok -', nombre); };

const prosp = (rubro, extra) => Object.assign({ nombre: { valor: rubro + ' X', tipo: 'comprobado' }, categoria: { valor: rubro, tipo: 'comprobado' }, puntuacion: { score: 50 } }, extra || {});
function base(n, rubro, resultado, propuesta_id, extra) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const r = prosp(rubro, extra);
    I.registrarContacto(r, { canal: 'WhatsApp', resultado: typeof resultado === 'function' ? resultado(i) : resultado, propuesta_id, propuesta_nombre: propuesta_id ? 'Prop ' + propuesta_id : '' });
    out[rubro + i] = r;
  }
  return out;
}

t('clasificación fija de 9 resultados', () => {
  assert.deepEqual(I.RESULTADOS.map((x) => x[0]), ['no_necesita', 'no_reconoce_problema', 'ya_tiene_solucion', 'sin_presupuesto', 'no_confia', 'no_responde', 'interesado', 'solicita_presupuesto', 'contrato']);
  assert.equal(I.resultadoLabel('contrato'), 'Contrató');
  assert.throws(() => I.registrarContacto(prosp('x'), { resultado: 'cualquiera' }));
});

t('registrar contacto guarda campos y historial con fecha ISO', () => {
  const r = prosp('plomería');
  I.registrarContacto(r, { fecha: '2026-11-20T15:00:00.000Z', canal: 'Llamada', resultado: 'sin_presupuesto', objeciones: 'caro\nya tengo IG', servicio_ofrecido: 'Web', propuesta_id: 'a', tipo_empresa: 'pyme', proximo_seguimiento: '2026-12-01' });
  const c = r.comercial;
  assert.equal(c.fecha_contacto, '2026-11-20T15:00:00.000Z');
  assert.equal(c.resultado, 'sin_presupuesto'); assert.equal(c.motivo_rechazo, 'sin_presupuesto');
  assert.deepEqual(c.objeciones, ['caro', 'ya tengo IG']);
  assert.equal(c.proximo_seguimiento, '2026-12-01'); assert.equal(c.proxima_fecha, '2026-12-01');
  assert.equal(c.historial.length, 1); assert.match(c.historial[0].fecha, /^\d{4}-\d\d-\d\dT/);
  I.registrarContacto(r, { fecha: '2026-11-22T15:00:00.000Z', resultado: 'interesado' });
  assert.equal(c.historial.length, 2); assert.equal(c.fecha_contacto, '2026-11-20T15:00:00.000Z'); assert.equal(c.resultado, 'interesado');
});

t('compatibilidad con r.comercial viejo (sin campos nuevos)', () => {
  const viejos = {
    a: prosp('peluquería', { comercial: { estado: 'ganado', historial: [{ fecha: '2026-11-01T10:00:00Z', tipo: 'contacto', canal: 'WhatsApp' }] } }),
    b: prosp('peluquería', { comercial: { estado: 'perdido', historial: [] } }),
    c: prosp('peluquería', { comercial: { estado: 'diagnostico_generado', historial: [] } }),
    d: prosp('peluquería'),
    e: prosp('peluquería', { comercial: { estado: 'x', historial: [{ fecha: '2026-11-01T10:00:00Z', tipo: 'estado', detalle: 'Interesado → Reunión pendiente' }] } }),
  };
  const A = I.analizar(viejos);
  assert.equal(A.prospectos, 5);
  assert.equal(A.total.contactos, 2); // a (contacto + ganado) y b (perdido); c, d y e no se contactaron
  assert.equal(A.total.ventas, 1); assert.equal(A.total.rechazos, 1); assert.equal(A.total.positivas, 1);
  const n = I.normalizar('e', viejos.e); assert.equal(n.reunion, true);
  // Las funciones del CRM existente siguen cargando
  const C = req(path.join(raiz, 'impulsa-comercial.js'));
  assert.equal(C.ESTADOS.length, 11);
});

t('menos de 10 contactos = datos insuficientes y fuera de rankings', () => {
  const d = Object.assign(base(9, 'dentista', 'interesado'), base(10, 'abogado', (i) => (i < 3 ? 'interesado' : 'no_necesita')));
  const A = I.analizar(d);
  const den = A.por.rubro.find((g) => g.valor === 'dentista');
  assert.equal(den.contactos, 9); assert.equal(den.suficiente, false);
  assert.ok(!A.mejores.some((g) => g.valor === 'dentista'));
  assert.ok(A.insuficientes.some((g) => g.valor === 'dentista'));
  assert.equal(A.mejores[0].valor, 'abogado');
  assert.equal(I.tasa(9, 9), '9 de 9 · datos insuficientes');
  assert.equal(I.tasa(3, 10), '30% (3 de 10)');
  assert.equal(I.tasa(0, 0), 'sin contactos');
});

t('cuentas y porcentajes exactos', () => {
  const d = base(20, 'gimnasio', (i) => ['contrato', 'solicita_presupuesto', 'interesado', 'no_responde', 'no_confia'][i % 5]);
  const m = I.analizar(d).total;
  assert.equal(m.contactos, 20); assert.equal(m.positivas, 12); assert.equal(m.ventas, 4); assert.equal(m.rechazos, 4); assert.equal(m.sin_respuesta, 4);
  assert.equal(m.pct.positivas, 60); assert.equal(m.pct.ventas, 20);
});

t('experimentos: comparación por propuesta', () => {
  const d = Object.assign({}, base(10, 'bar', (i) => (i < 4 ? 'interesado' : 'no_responde'), 'a'), base(10, 'cafe', (i) => (i < 1 ? 'contrato' : 'no_necesita'), 'b'));
  const A = I.analizar(d);
  const a = A.experimentos.find((g) => g.valor === 'a'), b = A.experimentos.find((g) => g.valor === 'b');
  assert.equal(a.positivas, 4); assert.equal(b.ventas, 1); assert.equal(b.rechazos, 9);
  const lista = []; const p1 = I.crearPropuesta(lista, 'A: web de ejemplo gratis'); const p2 = I.crearPropuesta(lista, 'A: web de ejemplo gratis');
  assert.equal(p1.id, 'a-web-de-ejemplo-gratis'); assert.notEqual(p1.id, p2.id);
  assert.throws(() => I.crearPropuesta(lista, '  '));
});

t('sin web es atributo, no intención de compra', () => {
  const r = prosp('cerrajería', { website: { tipo: 'no_disponible', valor: null } });
  I.registrarContacto(r, { resultado: 'no_necesita' });
  const n = I.normalizar('k', r);
  assert.equal(n.sitio_web, 'sin_web'); assert.equal(n.positivo, false); assert.equal(n.rechazo, true);
  const sinContacto = I.analizar({ z: prosp('cerrajería', { website: { tipo: 'no_disponible' } }) });
  assert.equal(sinContacto.total.contactos, 0); assert.equal(sinContacto.total.positivas, 0);
});

t('página y menú', () => {
  const html = fs.readFileSync(path.join(raiz, 'inteligencia', 'index.html'), 'utf8');
  assert.ok(html.includes('core.js') && html.includes('panel.js'));
  assert.ok(!/api\.openai|anthropic|generativelanguage/i.test(html + fs.readFileSync(path.join(raiz, 'inteligencia', 'panel.js'), 'utf8')));
  const idx = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  assert.ok(idx.includes('href="inteligencia/">Inteligencia</a>'));
  assert.ok(idx.indexOf('inteligencia/core.js') < idx.indexOf('impulsa-comercial.js'));
});

console.log(`\n${ok} pruebas OK`);
