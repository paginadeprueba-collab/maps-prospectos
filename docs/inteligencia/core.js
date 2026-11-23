/* IMPULSA — Inteligencia comercial (núcleo sin interfaz).
 * Lo usan el CRM de la Fábrica (impulsa-comercial.js) y el Panel de Inteligencia (docs/inteligencia/).
 * Sin IA, sin red, sin tokens: solo cuenta lo que está cargado en impulsa_resultados_v1 → r.comercial.
 * Reglas: solo cantidades reales; grupos con menos de MIN_MUESTRA contactos = "datos insuficientes"
 * y quedan fuera de rankings; "sin web" es un dato del negocio, no intención de compra. */
(function (root) {
  const LS_RES = "impulsa_resultados_v1";
  const LS_PROP = "impulsa_propuestas_v1";
  const MIN_MUESTRA = 10;

  const RESULTADOS = [
    ["no_necesita", "No necesita el servicio"], ["no_reconoce_problema", "No reconoce el problema"],
    ["ya_tiene_solucion", "Ya tiene una solución"], ["sin_presupuesto", "No tiene presupuesto"],
    ["no_confia", "No confía en la propuesta"], ["no_responde", "No responde"],
    ["interesado", "Está interesado"], ["solicita_presupuesto", "Solicita presupuesto"], ["contrato", "Contrató"],
  ];
  const POSITIVOS = ["interesado", "solicita_presupuesto", "contrato"];
  const RECHAZOS = ["no_necesita", "no_reconoce_problema", "ya_tiene_solucion", "sin_presupuesto", "no_confia"];
  const MOTIVOS = RECHAZOS.map((id) => [id, (RESULTADOS.find((x) => x[0] === id) || [id, id])[1]]).concat([["otro", "Otro motivo"]]);
  const TIPOS_EMPRESA = [
    ["profesional", "Profesional independiente"], ["comercio", "Comercio con local"], ["servicio_domicilio", "Servicio a domicilio / oficio"],
    ["pyme", "PyME con equipo"], ["cadena", "Cadena / franquicia / varias sedes"], ["otro", "Otro"],
  ];
  // Estados viejos del CRM (siguen valiendo) que implican cada cosa, sin inventar resultado.
  const EST_CONTACTADO = ["primer_contacto", "diagnostico_enviado", "interesado", "reunion_pendiente", "propuesta_enviada", "negociacion", "ganado", "perdido", "seguimiento_futuro"];
  const EST_POSITIVO = ["interesado", "reunion_pendiente", "negociacion", "ganado"];
  const EST_REUNION = ["reunion_pendiente", "negociacion"];

  const label = (lista, id) => (lista.find((x) => x[0] === id) || [id, id || ""])[1];
  const resultadoLabel = (id) => label(RESULTADOS, id);
  const val = (d) => (d && typeof d === "object" ? (d.tipo !== "no_disponible" && d.valor != null && d.valor !== "" ? d.valor : null) : d || null);

  /* ---------- registro de interacciones (backward compatible) ---------- */
  function asegurar(r) {
    if (!r.comercial) r.comercial = { estado: "pendiente", historial: [], verificacion: {}, versiones: [], proxima_accion: "", proxima_fecha: "", doc: null, actualizado: new Date().toISOString() };
    const c = r.comercial;
    c.historial = c.historial || []; c.verificacion = c.verificacion || {}; c.versiones = c.versiones || []; c.estado = c.estado || "pendiente";
    c.objeciones = Array.isArray(c.objeciones) ? c.objeciones : [];
    return c;
  }
  /* Registra un contacto. datos: {fecha, canal, mensaje, observaciones, resultado, motivo_rechazo, objeciones[],
   * servicio_ofrecido, propuesta_id, propuesta_nombre, tipo_empresa, proximo_seguimiento, proxima_accion, reunion, estado} */
  function registrarContacto(r, datos) {
    const c = asegurar(r);
    const d = Object.assign({}, datos || {});
    const fecha = d.fecha || new Date().toISOString();
    if (d.resultado && !RESULTADOS.some((x) => x[0] === d.resultado)) throw new Error("Resultado inválido: " + d.resultado);
    const objs = (Array.isArray(d.objeciones) ? d.objeciones : String(d.objeciones || "").split(/\n|;/)).map((s) => String(s).trim()).filter(Boolean);
    const ev = { fecha, tipo: "contacto", canal: d.canal || "", mensaje: d.mensaje || "", observaciones: d.observaciones || "",
      detalle: "Contacto por " + (d.canal || "—") + (d.resultado ? " · " + resultadoLabel(d.resultado) : ""),
      resultado: d.resultado || "", motivo_rechazo: d.motivo_rechazo || "", objeciones: objs, servicio_ofrecido: d.servicio_ofrecido || "",
      propuesta_id: d.propuesta_id || "", propuesta_nombre: d.propuesta_nombre || "", tipo_empresa: d.tipo_empresa || "",
      reunion: !!d.reunion, proxima_accion: d.proxima_accion || "", proxima_fecha: d.proximo_seguimiento || "" };
    // Si el CRM seguía en "pendiente" o "diagnóstico generado", un contacto lo pasa a "primer contacto" (como hace el WhatsApp).
    if (!d.estado && (c.estado === "pendiente" || c.estado === "diagnostico_generado")) d.estado = "primer_contacto";
    if (d.estado && d.estado !== c.estado) { ev.estado_anterior = c.estado; ev.estado_nuevo = d.estado; c.estado = d.estado; }
    c.historial.unshift(ev);
    if (!c.fecha_contacto || Date.parse(fecha) < Date.parse(c.fecha_contacto)) c.fecha_contacto = fecha; // primer contacto
    c.ultimo_contacto = !c.ultimo_contacto || Date.parse(fecha) >= Date.parse(c.ultimo_contacto) ? fecha : c.ultimo_contacto;
    if (d.resultado) c.resultado = d.resultado;
    if (d.resultado && RECHAZOS.indexOf(d.resultado) >= 0) c.motivo_rechazo = d.motivo_rechazo || d.resultado;
    else if (d.motivo_rechazo) c.motivo_rechazo = d.motivo_rechazo;
    objs.forEach((o) => { if (c.objeciones.indexOf(o) < 0) c.objeciones.push(o); });
    if (d.servicio_ofrecido) c.servicio_ofrecido = d.servicio_ofrecido;
    if (d.propuesta_id) { c.propuesta_id = d.propuesta_id; c.propuesta_nombre = d.propuesta_nombre || c.propuesta_nombre || ""; }
    if (d.tipo_empresa) c.tipo_empresa = d.tipo_empresa;
    if (d.reunion) c.reunion = true;
    if (d.proximo_seguimiento) c.proximo_seguimiento = d.proximo_seguimiento;
    if (d.proxima_accion || d.proximo_seguimiento) { c.proxima_accion = d.proxima_accion || c.proxima_accion || "Seguimiento"; c.proxima_fecha = d.proximo_seguimiento || c.proxima_fecha || ""; }
    c.actualizado = new Date().toISOString();
    return ev;
  }

  /* ---------- país del negocio (modo Provincias y Latinoamérica) ---------- */
  // Mismos países que docs/zonas-latam.json. Se lee del dato guardado o del final de la dirección de Maps.
  const PAISES = ["Argentina", "Uruguay", "Chile", "Paraguay", "Bolivia", "Perú", "Ecuador", "Colombia", "Venezuela", "México", "Costa Rica",
    "Panamá", "Guatemala", "Honduras", "El Salvador", "Nicaragua", "República Dominicana", "Puerto Rico", "Brasil"];
  const ALIAS_PAIS = { peru: "Perú", mexico: "México", panama: "Panamá", "republica dominicana": "República Dominicana", "rep dominicana": "República Dominicana",
    "dominican republic": "República Dominicana", brazil: "Brasil" };
  const nk = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  function paisDeTexto(t) {
    const partes = String(t || "").split(",").map((x) => x.replace(/\d+/g, " ").trim()).filter(Boolean);
    if (!partes.length) return "";
    const k = nk(partes[partes.length - 1]);
    return PAISES.find((p) => nk(p) === k) || ALIAS_PAIS[k] || "";
  }
  function paisDe(r) {
    const c = (r && r.comercial) || {};
    const pros = (r && r.origen && r.origen.prospecto) || {};
    const directo = c.pais || val(r && r.pais) || pros.pais || "";
    if (directo) return paisDeTexto("x, " + directo) || String(directo);
    return paisDeTexto(val(r && r.direccion) || pros.direccion || "") || "sin_dato";
  }

  /* ---------- normalización: un prospecto → una fila de análisis ---------- */
  function sitioWeb(r) {
    const ver = (r.comercial && r.comercial.verificacion) || {};
    if (ver.tiene_web === "si" || (r.website && r.website.tipo === "comprobado" && r.website.valor)) return "con_web";
    if (ver.tiene_web === "no" || (r.website && (r.website.tipo === "no_disponible" || !r.website.valor))) return "sin_web";
    return "sin_dato";
  }
  function normalizar(key, r) {
    const c = (r && r.comercial) || {};
    const h = Array.isArray(c.historial) ? c.historial : [];
    const contactos = h.filter((x) => x && (x.tipo === "contacto" || x.tipo === "mensaje"));
    const estado = c.estado || "pendiente";
    const contactado = !!c.fecha_contacto || contactos.length > 0 || EST_CONTACTADO.indexOf(estado) >= 0;
    const res = c.resultado || "";
    const reunionHist = h.some((x) => x && (x.reunion || x.canal === "Reunión" || EST_REUNION.indexOf(x.estado_nuevo) >= 0 || /→\s*Reunión pendiente/.test(x.detalle || "")));
    const venta = res === "contrato" || estado === "ganado";
    const prop = c.propuesta_id || (contactos.find((x) => x.propuesta_id) || {}).propuesta_id || "";
    return {
      key, nombre: val(r && r.nombre) || key, contactado, estado, resultado: res,
      rubro: String(val(r && r.categoria) || "Sin rubro").trim().toLowerCase() || "sin rubro",
      pais: paisDe(r || {}),
      tipo_empresa: c.tipo_empresa || "sin_dato", servicio: c.servicio_ofrecido || "sin_dato",
      propuesta: prop || "sin_dato", propuesta_nombre: c.propuesta_nombre || (contactos.find((x) => x.propuesta_nombre) || {}).propuesta_nombre || "",
      motivo: c.motivo_rechazo || (RECHAZOS.indexOf(res) >= 0 ? res : ""), objeciones: Array.isArray(c.objeciones) ? c.objeciones : [],
      sitio_web: sitioWeb(r || {}),
      positivo: POSITIVOS.indexOf(res) >= 0 || (!res && EST_POSITIVO.indexOf(estado) >= 0),
      reunion: !!c.reunion || EST_REUNION.indexOf(estado) >= 0 || reunionHist,
      venta,
      rechazo: RECHAZOS.indexOf(res) >= 0 || (!res && estado === "perdido"),
      sin_respuesta: res === "no_responde",
      interacciones: contactos.length,
      fecha_contacto: c.fecha_contacto || (contactos.length ? contactos[contactos.length - 1].fecha : ""),
      proximo_seguimiento: c.proximo_seguimiento || c.proxima_fecha || "", proxima_accion: c.proxima_accion || "",
    };
  }
  function filas(resultados) {
    return Object.entries(resultados || {}).filter(([, r]) => r && typeof r === "object").map(([k, r]) => normalizar(k, r));
  }

  /* ---------- estadísticas ---------- */
  function pct(x, n) { return n ? Math.round((x / n) * 1000) / 10 : null; }
  function metricas(lista) {
    const n = lista.length;
    const cnt = (f) => lista.filter(f).length;
    const m = { contactos: n, positivas: cnt((x) => x.positivo), reuniones: cnt((x) => x.reunion), ventas: cnt((x) => x.venta),
      rechazos: cnt((x) => x.rechazo), sin_respuesta: cnt((x) => x.sin_respuesta), suficiente: n >= MIN_MUESTRA };
    m.pct = { positivas: pct(m.positivas, n), reuniones: pct(m.reuniones, n), ventas: pct(m.ventas, n), rechazos: pct(m.rechazos, n), sin_respuesta: pct(m.sin_respuesta, n) };
    return m;
  }
  function agrupar(lista, campo) {
    const g = {};
    lista.forEach((x) => { const v = x[campo] || "sin_dato"; (g[v] = g[v] || []).push(x); });
    return Object.entries(g).map(([valor, items]) => Object.assign({ valor }, metricas(items))).sort((a, b) => b.contactos - a.contactos || String(a.valor).localeCompare(b.valor));
  }
  const DIMENSIONES = [["rubro", "Rubro"], ["pais", "País"], ["tipo_empresa", "Tipo de empresa"], ["servicio", "Servicio ofrecido"], ["propuesta", "Propuesta / argumento"],
    ["motivo", "Motivo de rechazo"], ["resultado", "Resultado del contacto"], ["sitio_web", "Sitio web (dato del negocio, no intención de compra)"]];
  const DIM_RANKING = ["rubro", "pais", "tipo_empresa", "servicio", "propuesta"];

  function analizar(resultados) {
    const todas = filas(resultados);
    const cont = todas.filter((x) => x.contactado);
    const por = {};
    DIMENSIONES.forEach(([d]) => {
      const base = d === "motivo" ? cont.filter((x) => x.rechazo || x.motivo) : cont;
      por[d] = agrupar(base, d);
    });
    const exp = por.propuesta.filter((g) => g.valor !== "sin_dato");
    // Rankings: solo grupos con muestra suficiente y que no sean "sin dato".
    const cand = [];
    DIM_RANKING.forEach((d) => por[d].forEach((g) => { if (g.suficiente && g.valor !== "sin_dato") cand.push(Object.assign({ dimension: d }, g)); }));
    const mejores = cand.slice().sort((a, b) => b.pct.positivas - a.pct.positivas || b.contactos - a.contactos).slice(0, 5);
    const masRechazo = cand.slice().filter((g) => g.rechazos > 0).sort((a, b) => b.pct.rechazos - a.pct.rechazos || b.contactos - a.contactos).slice(0, 5);
    const insuficientes = [];
    DIM_RANKING.forEach((d) => por[d].forEach((g) => { if (!g.suficiente && g.valor !== "sin_dato") insuficientes.push({ dimension: d, valor: g.valor, contactos: g.contactos }); }));
    const hoy = new Date().toISOString().slice(0, 10);
    const seguimientos = cont.filter((x) => x.proximo_seguimiento && !x.venta && !x.rechazo).sort((a, b) => a.proximo_seguimiento.localeCompare(b.proximo_seguimiento))
      .map((x) => Object.assign({ vencido: x.proximo_seguimiento < hoy }, x));
    const objeciones = {};
    cont.forEach((x) => x.objeciones.forEach((o) => { const k = o.toLowerCase(); objeciones[k] = (objeciones[k] || 0) + 1; }));
    return { min_muestra: MIN_MUESTRA, prospectos: todas.length, total: metricas(cont), por, experimentos: exp, mejores, masRechazo, insuficientes, seguimientos,
      objeciones: Object.entries(objeciones).sort((a, b) => b[1] - a[1]), filas: cont };
  }
  /* Texto de una tasa: siempre con el tamaño de la muestra; nunca % si n < MIN_MUESTRA. */
  function tasa(x, n) {
    if (!n) return "sin contactos";
    if (n < MIN_MUESTRA) return x + " de " + n + " · datos insuficientes";
    return pct(x, n).toLocaleString("es-AR") + "% (" + x + " de " + n + ")";
  }

  /* ---------- propuestas / argumentos (experimentos) ---------- */
  function slug(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  function cargarPropuestas(ls) { try { const v = JSON.parse((ls || root.localStorage).getItem(LS_PROP) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function guardarPropuestas(lista, ls) { (ls || root.localStorage).setItem(LS_PROP, JSON.stringify(lista)); }
  function crearPropuesta(lista, nombre, descripcion) {
    const n = String(nombre || "").trim();
    if (!n) throw new Error("Poné un nombre a la propuesta");
    let id = slug(n) || "prop", i = 2;
    while (lista.some((p) => p.id === id)) id = slug(n) + "-" + i++;
    const p = { id, nombre: n, descripcion: String(descripcion || "").trim(), creada: new Date().toISOString(), activa: true };
    lista.push(p);
    return p;
  }

  const pub = { LS_RES, LS_PROP, MIN_MUESTRA, RESULTADOS, POSITIVOS, RECHAZOS, MOTIVOS, TIPOS_EMPRESA, DIMENSIONES, resultadoLabel, label,
    asegurar, registrarContacto, normalizar, paisDe, paisDeTexto, filas, metricas, agrupar, analizar, tasa, pct, cargarPropuestas, guardarPropuestas, crearPropuesta, slug };
  if (typeof module !== "undefined" && module.exports) module.exports = pub;
  root.impulsaIntel = pub;
})(typeof window !== "undefined" ? window : globalThis);
