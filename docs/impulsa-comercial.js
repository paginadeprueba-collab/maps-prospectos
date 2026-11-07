/* IMPULSA — Investigación comercial: diagnóstico, propuesta, WhatsApp, alternativas, edición y CRM.
 * Se carga DESPUÉS de impulsa.js. No toca el buscador. Usa window.impulsaDatos (expuesto por impulsa.js)
 * y guarda todo dentro del mismo objeto del prospecto en localStorage (impulsa_resultados_v1 → r.comercial).
 * Motor determinístico: solo usa datos de la investigación ({valor,tipo,fuente,fecha}) y la verificación
 * manual cargada por IMPULSA. Nunca inventa reseñas, seguidores, anuncios ni precios. */
(function () {
  "use strict";
  const LS_TAR = "impulsa_tarifas_v1";
  const LS_CON = "impulsa_contacto_v1";
  const ESTADOS = [
    ["pendiente", "Pendiente de analizar"], ["diagnostico_generado", "Diagnóstico generado"],
    ["primer_contacto", "Primer contacto realizado"], ["diagnostico_enviado", "Diagnóstico enviado"],
    ["interesado", "Interesado"], ["reunion_pendiente", "Reunión pendiente"], ["propuesta_enviada", "Propuesta enviada"],
    ["negociacion", "Negociación"], ["ganado", "Cliente ganado"], ["perdido", "Cliente perdido"], ["seguimiento_futuro", "Seguimiento futuro"],
  ];
  const estadoLabel = (id) => (ESTADOS.find((x) => x[0] === id) || ESTADOS[0])[1];

  function e(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&" + "amp;", "<": "&" + "lt;", ">": "&" + "gt;", '"': "&" + "quot;", "'": "&#39;",
    }[c]));
  }
  const val = (d) => (d && d.tipo !== "no_disponible" && d.valor !== null && d.valor !== undefined && d.valor !== "" ? d.valor : null);
  const fmtNum = (n) => Number(n).toLocaleString("es-AR");
  const fmtRating = (n) => Number(n).toFixed(1).replace(".", ",");
  /* Nombre comercial legible: los títulos de Maps suelen traer palabras clave ("X Inmobiliarias en Barracas…"). */
  function nombreCorto(n) {
    let s = String(n || "").split(/\s[|–—-]\s|[|(,]/)[0].replace(/[^\p{L}\p{N}&.'´ ]/gu, " ").replace(/\s+/g, " ").trim();
    if (s.length > 34) {
      const caps = s.match(/^((?:[A-ZÁÉÍÓÚÑ0-9&.]{2,}\s?){2,})/);
      s = caps ? caps[1].trim() : s.split(" ").slice(0, 4).join(" ");
    }
    return s || String(n || "");
  }
  const hoyAR = () => { try { return new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" }); } catch (x) { return new Date().toISOString().slice(0, 10); } };
  const ahoraAR = (iso) => { try { return new Date(iso || Date.now()).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) + " (hora Argentina)"; } catch (x) { return String(iso); } };
  const lsGet = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? def : v; } catch (x) { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) { /* sin espacio */ } };

  /* ===================== Catálogo de servicios IMPULSA ===================== */
  const SERVICIOS = {
    A: { nombre: "Presencia digital y desarrollo web", plazo: "3 a 4 semanas",
      incluye: ["Sitio web profesional adaptado a celulares", "Textos orientados a generar consultas", "Botones de llamada y WhatsApp visibles", "Vinculación con la ficha de Google Maps", "Configuración técnica básica (HTTPS, velocidad, buscadores)"],
      entregables: ["Sitio publicado en su dominio", "Accesos y propiedad a nombre del negocio", "Guía breve de uso"] },
    A2: { nombre: "Optimización del sitio web actual", plazo: "1 a 2 semanas",
      incluye: ["Corrección de los puntos técnicos detectados", "Mejora de llamadas a la acción y vías de contacto", "Revisión de la versión para celulares"],
      entregables: ["Informe de cambios realizados", "Sitio actual optimizado (sin reemplazarlo)"] },
    B: { nombre: "Agenda digital y automatización de turnos", plazo: "1 a 2 semanas",
      incluye: ["Agenda online con disponibilidad real", "Confirmaciones y recordatorios automáticos", "Enlace de reserva para Google Maps, web, redes y WhatsApp"],
      entregables: ["Agenda configurada y probada", "Capacitación al equipo"] },
    C: { nombre: "Publicidad y captación de clientes", plazo: "2 semanas de puesta en marcha + gestión mensual",
      incluye: ["Definición de público y zona", "Creatividades y mensajes", "Configuración de campañas y medición de consultas", "Informe mensual"],
      entregables: ["Campañas activas", "Tablero de resultados"] },
    C2: { nombre: "Optimización de la publicidad actual", plazo: "2 a 3 semanas",
      incluye: ["Revisión de anuncios, públicos y mensajes vigentes", "Ajustes de segmentación y creatividades", "Medición de consultas por anuncio"],
      entregables: ["Informe de auditoría", "Plan de ajustes aplicado"] },
    D: { nombre: "Optimización de redes sociales", plazo: "2 semanas + acompañamiento mensual",
      incluye: ["Ordenamiento del perfil (bio, destacados, enlaces)", "Plan de publicaciones", "Lineamientos visuales"],
      entregables: ["Perfil optimizado", "Calendario de contenidos"] },
    E: { nombre: "WhatsApp comercial y automatización", plazo: "1 a 2 semanas",
      incluye: ["WhatsApp Business con catálogo y horarios", "Mensaje de bienvenida y respuestas rápidas", "Botón de WhatsApp con mensaje predefinido"],
      entregables: ["Cuenta configurada", "Guion de respuestas para el equipo"] },
    F: { nombre: "CRM y seguimiento de oportunidades", plazo: "2 a 3 semanas",
      incluye: ["Registro centralizado de consultas", "Etapas de seguimiento y recordatorios", "Formulario de consulta conectado"],
      entregables: ["CRM configurado", "Proceso de seguimiento documentado"] },
    G: { nombre: "Estrategia de crecimiento comercial", plazo: "2 semanas",
      incluye: ["Plan de acción priorizado", "Sistema para pedir y responder reseñas", "Indicadores simples de seguimiento"],
      entregables: ["Plan comercial escrito", "Tablero de indicadores"] },
  };

  /* ===================== Rubro ===================== */
  function rubroDe(r) {
    const t = ((val(r.categoria) || "") + " " + (val(r.nombre) || "")).toLowerCase();
    const urg = /24\s*h|urgenc/.test(t);
    if (/odont|dent|cl[ií]nic|m[eé]dic|psic[oó]l|kinesi|nutri|dermat|ortodon|endodon|salud|cirug|est[eé]tica/.test(t))
      return { id: "salud", cliente: "pacientes", consulta: "turno", consultas: "turnos", usaAgenda: true, cicloLargo: /cirug|implant|est[eé]tica/.test(t), urg };
    if (/peluq|barber|spa\b|u[ñn]as|manicur|cosmet|belleza/.test(t))
      return { id: "belleza", cliente: "clientes", consulta: "turno", consultas: "turnos", usaAgenda: true, cicloLargo: false, urg };
    if (/inmobil|propiedad|broker|corredor|martiller|bienes ra/.test(t))
      return { id: "inmobiliaria", cliente: "clientes", consulta: "consulta o pedido de tasación", consultas: "consultas y tasaciones", usaAgenda: false, cicloLargo: true, urg };
    if (/abogad|jur[ií]dic|legal|escriban|contador|contable/.test(t))
      return { id: "legal", cliente: "clientes", consulta: "consulta", consultas: "consultas", usaAgenda: false, cicloLargo: true, urg };
    if (/electric|plomer|gasist|instalador de gas|cerraj|refrigera|aire acond|t[eé]cnico|construct|pintor|instalaci/.test(t))
      return { id: "oficios", cliente: "clientes", consulta: "pedido de presupuesto o visita", consultas: "pedidos de presupuesto", usaAgenda: false, cicloLargo: false, urg };
    if (/arquitect|reforma|dise[ñn]o/.test(t))
      return { id: "proyectos", cliente: "clientes", consulta: "pedido de presupuesto", consultas: "pedidos de presupuesto", usaAgenda: false, cicloLargo: true, urg };
    return { id: "general", cliente: "clientes", consulta: "consulta", consultas: "consultas", usaAgenda: false, cicloLargo: false, urg };
  }

  /* ===================== Motor de análisis (consultor) ===================== */
  function analizar(r) {
    const ver = (r.comercial && r.comercial.verificacion) || {};
    const rub = rubroDe(r);
    const nombreCompleto = val(r.nombre) || "el negocio";
    const nombre = nombreCorto(nombreCompleto);
    const rating = val(r.rating), resenas = val(r.resenas);
    const tel = val(r.telefono);
    const webUrl = r.website && r.website.tipo === "comprobado" ? r.website.valor : null;
    const webFalla = r.website && r.website.tipo === "hipotesis";
    const tieneWeb = !!webUrl || ver.tiene_web === "si";
    const sinWebConf = !webUrl && ver.tiene_web === "no";
    const cw = webUrl ? val(r.calidad_web) : null;
    const agendaSis = r.agenda && r.agenda.tipo === "comprobado" && r.agenda.valor ? r.agenda.valor : null;
    const agendaOk = !!agendaSis || ver.agenda === "si";
    const agendaNoDetectada = webUrl && r.agenda && r.agenda.valor === false;
    const waWeb = r.redes && val(r.redes.whatsapp_web);
    const form = webUrl ? val(r.formulario) : null;
    const redesSitio = Object.keys(r.redes || {}).filter((k) => k !== "whatsapp_web");
    const igSeg = ver.ig_seguidores !== undefined && ver.ig_seguidores !== "" ? Number(ver.ig_seguidores) : null;
    const igDias = ver.ig_ultima_pub_dias !== undefined && ver.ig_ultima_pub_dias !== "" ? Number(ver.ig_ultima_pub_dias) : null;
    const fecha = (d) => (d && d.fecha ? new Date(d.fecha).toLocaleDateString("es-AR") : "");

    const hechos = { comprobado: [], no_disponible: [], hipotesis: [] };
    const H = (t, s) => hechos[t].push(s);
    rating != null ? H("comprobado", `Calificación en Google Maps: ${fmtRating(rating)} (${fecha(r.rating)})`) : H("no_disponible", "Calificación de Google Maps");
    resenas != null ? H("comprobado", `Cantidad de reseñas en Google Maps: ${fmtNum(resenas)}`) : H("no_disponible", "Cantidad de reseñas");
    tel ? H("comprobado", "Teléfono publicado en Google Maps") : H("no_disponible", "Teléfono en Google Maps");
    if (webUrl) H("comprobado", "Sitio web activo: " + webUrl);
    else if (webFalla) H("hipotesis", "Sitio informado que no respondió al relevarlo: " + r.website.valor);
    else if (ver.tiene_web === "si") H("comprobado", "Sitio web propio (verificación manual)");
    else if (sinWebConf) H("comprobado", "Sin sitio web propio (verificación manual)");
    else H("no_disponible", "Sitio web (la ficha de Google Maps no informa uno)");
    if (cw) H("comprobado", `Técnica del sitio: ${cw.https ? "HTTPS" : "sin HTTPS"}, ${cw.viewport ? "preparado para celulares" : "sin etiqueta para celulares"}, respuesta ${cw.tiempo_ms} ms`);
    if (agendaSis) H("comprobado", "Sistema de turnos online: " + agendaSis);
    else if (r.agenda && r.agenda.tipo === "hipotesis") H("hipotesis", "Posible reserva online (detectada por palabras clave)");
    else if (agendaNoDetectada) H("hipotesis", "No se detectó sistema de turnos en la página principal");
    else if (ver.agenda) H("comprobado", "Turnos online: " + (ver.agenda === "si" ? "sí" : "no") + " (verificación manual)");
    else if (rub.usaAgenda) H("no_disponible", "Sistema de turnos online");
    if (waWeb) H("comprobado", "Acceso a WhatsApp desde el sitio");
    if (form) H("comprobado", `Formularios en la página principal: ${form.cantidad}${form.contacto ? " (con campos de contacto)" : " (sin campos de contacto detectables)"}`);
    redesSitio.forEach((red) => H("hipotesis", `Perfil de ${red} enlazado en el sitio (perfil no verificado)`));
    if (ver.ads === "si") H("comprobado", "Anuncios activos en Meta Ads Library" + (ver.ads_detalle ? ": " + ver.ads_detalle : "") + " (verificación manual)");
    else if (ver.ads === "no") H("comprobado", "Sin anuncios activos en Meta Ads Library (verificación manual)");
    else H("no_disponible", "Anuncios en Meta Ads Library");
    if (igSeg != null) H("comprobado", `Instagram: ${fmtNum(igSeg)} seguidores (verificación manual)`);
    else H("no_disponible", "Seguidores y publicaciones de Instagram/Facebook");
    if (igDias != null) H("comprobado", `Última publicación en Instagram: hace ${igDias} días (verificación manual)`);
    if (ver.resenas_positivas) H("comprobado", "Temas positivos en reseñas: " + ver.resenas_positivas);
    if (ver.resenas_negativas) H("comprobado", "Temas negativos recurrentes en reseñas: " + ver.resenas_negativas);
    if (!ver.resenas_positivas && !ver.resenas_negativas) H("no_disponible", "Contenido de las reseñas (temas positivos y negativos)");

    /* --- Fortalezas --- */
    const fortalezas = [];
    if (rating != null && resenas != null && rating >= 4.5 && resenas >= 20) fortalezas.push(`Reputación sólida: ${fmtRating(rating)} estrellas en Google Maps sobre ${fmtNum(resenas)} reseñas.`);
    else if (rating != null && rating >= 4.0 && resenas != null && resenas >= 5) fortalezas.push(`Buena valoración en Google Maps (${fmtRating(rating)} estrellas, ${fmtNum(resenas)} reseñas).`);
    if (resenas != null && resenas >= 100) fortalezas.push(`Un volumen de ${fmtNum(resenas)} opiniones indica una base de ${rub.cliente} amplia y sostenida en el tiempo.`);
    if (ver.resenas_positivas) fortalezas.push(`Lo que más valoran sus ${rub.cliente} según las reseñas: ${ver.resenas_positivas}.`);
    if (rub.urg) fortalezas.push("Comunica atención de urgencias desde su nombre comercial, un diferencial claro para quien necesita una solución rápida.");
    if (/matriculad|cucicba|crs/i.test(nombre + " " + (val(r.snippet) || ""))) fortalezas.push("Comunica matriculación profesional, un factor de confianza importante en su rubro.");
    if (cw && cw.https && cw.viewport && cw.tiempo_ms != null && cw.tiempo_ms < 2500) fortalezas.push("Tiene un sitio web activo, seguro (HTTPS) y preparado para celulares.");
    else if (webUrl) fortalezas.push("Cuenta con sitio web propio, una base sobre la que se puede construir.");
    if (waWeb) fortalezas.push("Ofrece contacto directo por WhatsApp desde su sitio.");
    if (agendaOk) fortalezas.push(`Ya permite reservar ${rub.consultas} online${agendaSis ? " (" + agendaSis + ")" : ""}.`);
    if (form && form.contacto) fortalezas.push("El sitio incluye un formulario de consulta.");
    if (ver.ads === "si") fortalezas.push("Ya invierte en publicidad digital, lo que muestra decisión de crecer.");
    if (igSeg != null && igSeg >= 1000 && (igDias == null || igDias <= 30)) fortalezas.push(`Comunidad activa en Instagram (${fmtNum(igSeg)} seguidores).`);
    if (tel) fortalezas.push("Datos de contacto publicados y accesibles en Google Maps.");

    /* --- Oportunidades (cada una con evidencia y tipo) --- */
    const ops = [];
    const OP = (o) => ops.push(o);
    if (sinWebConf) OP({ id: "web", servicio: "A", prioridad: rub.cicloLargo ? 1 : 2, tipo: "comprobado",
      titulo: "No tiene un sitio web propio",
      observamos: `${nombre} depende de Google Maps y del contacto directo para presentarse.`,
      evidencia: "Verificado manualmente por IMPULSA.",
      dificultad: `Quien compara opciones antes de un ${rub.consulta} no encuentra un lugar donde conocer servicios, trayectoria y formas de contacto.`,
      mejora: "Un sitio simple, rápido y orientado a la consulta puede reforzar la confianza que ya generan las reseñas." });
    else if (!tieneWeb && !webFalla) OP({ id: "web", servicio: "A", prioridad: rub.cicloLargo ? 1 : 2, tipo: "potencial",
      titulo: "No encontramos un sitio web vinculado",
      observamos: "La ficha de Google Maps no muestra un sitio web propio.",
      evidencia: `Ficha relevada el ${fecha(r.website) || "día del análisis"}: campo de sitio web vacío. A confirmar con el negocio.`,
      dificultad: `Quien compara opciones antes de un ${rub.consulta} tiene menos información para decidir y para confiar.`,
      mejora: "Si se confirma que no hay sitio, una web enfocada en generar consultas complementaría la buena reputación existente." });
    if (webFalla) OP({ id: "web_falla", servicio: "A2", prioridad: 1, tipo: "potencial",
      titulo: "El sitio informado no respondió",
      observamos: "Al intentar abrir el sitio vinculado, no cargó.",
      evidencia: (r.website.nota || "Error al abrir el sitio") + ". Puede ser una falla temporal: verificar.",
      dificultad: "Un enlace que no abre puede hacer que la persona interesada abandone la consulta.",
      mejora: "Revisar dominio y hosting para asegurar que el sitio esté siempre disponible." });
    if (cw) {
      const fallas = [];
      if (!cw.https) fallas.push("no usa conexión segura (HTTPS)");
      if (!cw.viewport) fallas.push("no declara adaptación a celulares");
      if (cw.tiempo_ms != null && cw.tiempo_ms >= 2500) fallas.push(`respondió lento en nuestra medición (${fmtNum(cw.tiempo_ms)} ms)`);
      if (!cw.tiene_meta_description) fallas.push("no tiene descripción para buscadores");
      const graves = fallas.filter((f) => !/buscadores/.test(f));
      if (graves.length || ver.web_calidad === "pobre") OP({ id: "web_tecnica", servicio: ver.web_calidad === "pobre" ? "A" : "A2", prioridad: 2, tipo: "comprobado",
        titulo: "Aspectos técnicos del sitio a mejorar",
        observamos: "El sitio " + (fallas.join(", ") || "fue evaluado como de calidad baja en la revisión manual") + ".",
        evidencia: `Medición automática del ${fecha(r.calidad_web)} (una sola carga; no mide la experiencia completa).`,
        dificultad: "Estos puntos pueden afectar la confianza y la comodidad de quien visita el sitio desde el celular.",
        mejora: ver.web_calidad === "pobre" ? "Rediseñar el sitio con foco en consultas." : "Corregir estos puntos sobre el sitio actual, sin necesidad de reemplazarlo." });
    }
    if (rub.usaAgenda && !agendaOk) {
      if (ver.agenda === "no") OP({ id: "agenda", servicio: "B", prioridad: 1, tipo: "comprobado",
        titulo: "Los turnos se gestionan de forma manual",
        observamos: `No hay un sistema para que los ${rub.cliente} reserven por su cuenta.`,
        evidencia: "Verificado manualmente por IMPULSA.",
        dificultad: `Cada ${rub.consulta} requiere una conversación; fuera del horario de atención, la reserva queda pendiente.`,
        mejora: "Una agenda online con recordatorios permite reservar a cualquier hora y ordena la disponibilidad." });
      else OP({ id: "agenda", servicio: "B", prioridad: 1, tipo: "potencial",
        titulo: agendaNoDetectada ? "No detectamos reserva online de turnos" : "No pudimos verificar reserva online de turnos",
        observamos: agendaNoDetectada ? "La página principal del sitio no muestra un sistema de reservas." : "No hay un enlace de reservas visible en la información pública relevada.",
        evidencia: agendaNoDetectada ? "Revisión automática del código de la página principal; puede existir en otra sección." : (tel ? "La ficha de Google Maps solo ofrece teléfono." : "No encontramos un enlace de reservas en la información relevada."),
        dificultad: `Si los ${rub.consultas} dependen del teléfono o de mensajes, se concentran en el horario de atención.`,
        mejora: "Ofrecer un enlace de reserva en Google Maps, WhatsApp y redes facilita sacar turno en el momento en que la persona lo decide." });
    }
    if (webUrl && !waWeb) OP({ id: "wa_web", servicio: "E", prioridad: 2, tipo: "comprobado",
      titulo: "El sitio no ofrece un acceso directo a WhatsApp",
      observamos: "No encontramos un botón o enlace de WhatsApp en la página principal.",
      evidencia: `Revisión del sitio del ${fecha(r.website)}.`,
      dificultad: "Para muchas personas, escribir por WhatsApp es la forma más cómoda de hacer una primera consulta.",
      mejora: "Agregar un botón de WhatsApp con mensaje predefinido y respuestas rápidas." });
    if (!webUrl && rub.id === "oficios" && tel) OP({ id: "wa_resp", servicio: "E", prioridad: rub.urg ? 1 : 2, tipo: "potencial",
      titulo: rub.urg ? "Respuesta rápida en urgencias" : "Ordenar los pedidos de presupuesto",
      observamos: `El contacto público es el teléfono${val(r.whatsapp) ? " (con posible WhatsApp asociado, no verificado)" : ""}.`,
      evidencia: "Ficha de Google Maps relevada.",
      dificultad: `Cuando llegan ${rub.consultas} mientras se está trabajando, responder a tiempo y pedir los datos necesarios (zona, problema, fotos) se vuelve difícil.`,
      mejora: "WhatsApp Business con mensaje de bienvenida, horarios y preguntas clave permite responder al instante y presupuestar mejor." });
    if (form && !form.contacto && (rub.cicloLargo || rub.id === "general")) OP({ id: "form", servicio: rub.cicloLargo ? "F" : "A2", prioridad: 2, tipo: "potencial",
      titulo: "Las consultas del sitio no quedan registradas de forma ordenada",
      observamos: `Detectamos ${form.cantidad} formulario(s) en la página principal, pero ninguno con campos de contacto reconocibles.`,
      evidencia: "Análisis automático del código de la página principal; puede haber formularios en otras secciones.",
      dificultad: `Sin un registro de ${rub.consultas}, es difícil saber cuántas llegan, de dónde vienen y cuáles quedaron sin respuesta.`,
      mejora: "Un formulario conectado a un CRM simple permite registrar cada consulta y hacerle seguimiento." });
    if (rub.cicloLargo && !(form && !form.contacto)) OP({ id: "seguimiento", servicio: "F", prioridad: 3, tipo: "potencial",
      titulo: "Seguimiento de oportunidades",
      observamos: `En su rubro, la decisión del cliente suele llevar varias conversaciones (${rub.consultas}).`,
      evidencia: "No tenemos información sobre cómo registran hoy las consultas: a conversar.",
      dificultad: "Sin un registro ordenado, algunas oportunidades pueden quedar sin seguimiento.",
      mejora: "Un CRM liviano con recordatorios ayuda a retomar cada consulta en el momento justo." });
    const reputBuena = rating != null && rating >= 4.3 && resenas != null && resenas >= 20;
    if (ver.ads === "no" && reputBuena) OP({ id: "ads", servicio: "C", prioridad: 3, tipo: "potencial",
      titulo: "Buena reputación que hoy no se amplifica con publicidad",
      observamos: "No encontramos anuncios activos en Meta.",
      evidencia: "Consulta manual a Meta Ads Library.",
      dificultad: `Hoy la llegada de nuevos ${rub.cliente} depende de recomendaciones y búsquedas espontáneas.`,
      mejora: "Campañas acotadas por zona, con medición de consultas, pueden sumar un canal de captación sobre una reputación ya construida." });
    if (ver.ads === "si") OP({ id: "ads_opt", servicio: "C2", prioridad: 3, tipo: "potencial",
      titulo: "Revisar el rendimiento de la publicidad actual",
      observamos: "El negocio ya publica anuncios en Meta" + (ver.ads_detalle ? " (" + ver.ads_detalle + ")" : "") + ".",
      evidencia: "Consulta manual a Meta Ads Library. No conocemos inversión ni resultados.",
      dificultad: "Sin medir qué anuncios generan consultas, es difícil decidir dónde conviene invertir.",
      mejora: "Antes de sumar campañas, revisar mensajes, públicos y medición de las existentes." });
    if (ver.ig_existe === "no" || (igDias != null && igDias > 60)) OP({ id: "redes", servicio: "D", prioridad: 3, tipo: "comprobado",
      titulo: ver.ig_existe === "no" ? "Sin perfil activo en Instagram" : "Instagram sin publicaciones recientes",
      observamos: ver.ig_existe === "no" ? "No encontramos un perfil de Instagram del negocio." : `La última publicación es de hace ${igDias} días.`,
      evidencia: "Revisión manual de redes.",
      dificultad: "Muchas personas revisan las redes antes de contactar; un perfil inactivo transmite menos de lo que el negocio realmente es.",
      mejora: "Un perfil ordenado y un plan simple de publicaciones que muestre trabajos, equipo y opiniones." });
    if (rating != null && rating < 4.2 && resenas != null && resenas >= 10) OP({ id: "reputacion", servicio: "G", prioridad: 1, tipo: "comprobado",
      titulo: "Calificación mejorable en Google Maps",
      observamos: `La calificación visible es ${fmtRating(rating)} sobre ${fmtNum(resenas)} reseñas.`,
      evidencia: "Ficha de Google Maps.",
      dificultad: "Es lo primero que ve quien busca el servicio y pesa en la decisión de contactar.",
      mejora: "Responder reseñas y pedir opinión a clientes satisfechos de forma sistemática, antes de invertir en atraer más tráfico." });
    if (ver.resenas_negativas) OP({ id: "resenas_neg", servicio: rub.usaAgenda ? "B" : "E", prioridad: 2, tipo: "comprobado",
      titulo: "Un tema que se repite en las opiniones",
      observamos: "Varias reseñas mencionan: " + ver.resenas_negativas + ".",
      evidencia: "Lectura manual de reseñas (tema recurrente, no una opinión aislada).",
      dificultad: "Si no se aborda, puede seguir apareciendo en nuevas opiniones.",
      mejora: "Ordenar la atención y las respuestas para que la experiencia sea consistente." });
    if (resenas != null && resenas < 10) OP({ id: "pocas_resenas", servicio: "G", prioridad: 3, tipo: "comprobado",
      titulo: "Pocas opiniones publicadas",
      observamos: `La ficha tiene ${fmtNum(resenas)} reseña(s).`,
      evidencia: "Ficha de Google Maps.",
      dificultad: "Con pocas opiniones, a quien no los conoce le cuesta más confiar.",
      mejora: "Un proceso simple para pedir reseñas después de cada trabajo." });
    if (!tel) OP({ id: "sin_tel", servicio: "G", prioridad: 2, tipo: "potencial", titulo: "No obtuvimos un teléfono en la ficha de Google",
      observamos: "En el relevamiento de Google Maps no figuró un teléfono de contacto.", evidencia: "Ficha de Google Maps relevada; a confirmar (puede ser una omisión del relevamiento).",
      dificultad: "Quien quiere llamar desde el buscador no tiene cómo hacerlo.", mejora: "Completar y optimizar la ficha de Google." });

    /* --- Servicios justificados (sin duplicados, priorizados) --- */
    const servMap = {};
    ops.forEach((o) => {
      const s = servMap[o.servicio] || (servMap[o.servicio] = { id: o.servicio, nombre: SERVICIOS[o.servicio].nombre, prioridad: 9, justificacion: [], comprobado: false });
      s.prioridad = Math.min(s.prioridad, o.prioridad);
      s.justificacion.push(o.titulo);
      if (o.tipo === "comprobado") s.comprobado = true;
    });
    if (servMap.A && servMap.A2) { servMap.A.justificacion = servMap.A.justificacion.concat(servMap.A2.justificacion); delete servMap.A2; }
    const servicios = Object.values(servMap).sort((a, b) => a.prioridad - b.prioridad || (b.comprobado - a.comprobado));
    const nucleo = servicios.filter((s) => s.id !== "G" || s.prioridad === 1);
    if (servicios.length >= 3 && !servMap.G) servicios.push({ id: "G", nombre: SERVICIOS.G.nombre, prioridad: 5, justificacion: ["Coordinar varias mejoras en un plan único con indicadores"], comprobado: false, soloIntegral: true });

    /* --- Alternativas (solo cuando corresponden) --- */
    const alternativas = [];
    if (nucleo.length) {
      alternativas.push({ id: "esencial", nombre: "Solución esencial", servicios: [nucleo[0].id], descripcion: "Resolver el punto prioritario: " + nucleo[0].justificacion[0].toLowerCase() + "." });
      const rec = nucleo.slice(0, Math.min(3, nucleo.length)).map((s) => s.id);
      if (rec.length > 1) alternativas.push({ id: "recomendada", nombre: "Solución recomendada", servicios: rec, descripcion: "Las mejoras de mayor impacto, en el orden en que conviene implementarlas." });
      const integ = servicios.map((s) => s.id);
      if (integ.length > rec.length) alternativas.push({ id: "integral", nombre: "Solución integral", servicios: integ, descripcion: "Todas las mejoras justificadas por el diagnóstico, coordinadas en un plan de crecimiento." });
    }
    const recomendada = alternativas.find((a) => a.id === "recomendada") || alternativas[0] || null;

    /* --- Control de calidad de datos --- */
    const faltantes = [];
    if (!tel) faltantes.push({ critico: false, txt: "Confirmar si la ficha de Google Maps muestra teléfono." });
    if (rating == null || resenas == null) faltantes.push({ critico: true, txt: "Calificación y cantidad de reseñas en Google Maps." });
    if (!webUrl && !ver.tiene_web) faltantes.push({ critico: true, txt: "Confirmar si el negocio tiene sitio web propio (la ficha no informa uno)." });
    if (webFalla) faltantes.push({ critico: true, txt: "Volver a abrir el sitio informado para confirmar si funciona." });
    if (!ver.ads) faltantes.push({ critico: true, txt: "Revisar Meta Ads Library para saber si hoy publica anuncios." });
    if (igSeg == null && !ver.ig_existe) faltantes.push({ critico: true, txt: "Revisar Instagram/Facebook: existencia del perfil, seguidores y última publicación." });
    if (!ver.resenas_positivas && !ver.resenas_negativas) faltantes.push({ critico: false, txt: "Leer reseñas recientes para identificar temas positivos y negativos recurrentes." });
    if (rub.usaAgenda && !agendaOk && !ver.agenda) faltantes.push({ critico: false, txt: `Confirmar cómo toman hoy los ${rub.consultas} (teléfono, WhatsApp, sistema).` });
    const criticos = faltantes.filter((f) => f.critico).length;
    const nivel = criticos === 0 && faltantes.length <= 1 ? "concluyente" : "preliminar";

    ops.sort((a, b) => a.prioridad - b.prioridad || (a.tipo === "comprobado" ? -1 : 1) + (b.tipo === "comprobado" ? 1 : -1));
    return { rub, nombre, nombreCompleto, rating, resenas, webUrl, tieneWeb, cw, hechos, fortalezas, oportunidades: ops, servicios, alternativas, recomendada, faltantes, nivel, ver };
  }

  /* ===================== Documento (editable) ===================== */
  function tarifas() { return lsGet(LS_TAR, {}); }
  function contactoImpulsa() { return lsGet(LS_CON, { nombre: "IMPULSA", responsable: "", telefono: "", email: "", web: "" }); }
  const minus = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");

  function armarDoc(r, an) {
    const rub = an.rub, T = tarifas();
    const cat = val(r.categoria) || "";
    const dir = val(r.direccion) || "";
    const fortz = an.fortalezas.slice(0, 6);
    const recIds = an.recomendada ? an.recomendada.servicios : [];
    const ops = an.oportunidades;
    const pres = [];
    if (an.rating != null && an.resenas != null) pres.push(`En Google Maps tiene ${fmtRating(an.rating)} estrellas sobre ${fmtNum(an.resenas)} reseñas`);
    if (an.webUrl) pres.push("cuenta con sitio web propio");
    else if (an.ver.tiene_web === "no") pres.push("no tiene un sitio web propio");
    else pres.push("su ficha no muestra un sitio web vinculado");
    if (an.ver.ads === "si") pres.push("hoy invierte en publicidad en Meta");
    const presTxt = pres.length > 1 ? pres.slice(0, -1).join(", ") + " y " + pres[pres.length - 1] : pres.join("");
    const situacion = `${an.nombre} es ${cat ? "un negocio del rubro " + cat.toLowerCase() : "un negocio"}${dir ? ", ubicado en " + dir : ""}. ` +
      presTxt.charAt(0).toUpperCase() + presTxt.slice(1) + "." +
      (fortz.length ? " " + fortz[0] : "") +
      (an.nivel === "preliminar" ? " Este análisis se basa en información pública y tiene puntos a confirmar con ustedes antes de recomendar una inversión." : "");
    const servDoc = an.servicios.map((s) => {
      const base = SERVICIOS[s.id];
      const t = T[s.id] || {};
      return { id: s.id, nombre: base.nombre, activo: recIds.indexOf(s.id) >= 0, justificacion: s.justificacion.join("; "),
        incluye: base.incluye.slice(), entregables: base.entregables.slice(), plazo: t.plazo || base.plazo,
        precio: t.precio != null && t.precio !== "" ? String(t.precio) : "", soloIntegral: !!s.soloIntegral };
    });
    const orden = servDoc.filter((s) => s.activo).map((s) => minus(s.nombre));
    const recomendacion = an.recomendada
      ? `Para ${an.nombre} recomendamos ${orden.length > 1 ? "avanzar en este orden" : "concentrarnos en un solo frente"}: ${orden.join("; luego, ")}. ` +
        `Empezamos por ${orden[0]} porque responde al punto más relevante del diagnóstico: ${minus(an.servicios[0].justificacion[0] || "")}. ` +
        "No proponemos servicios que el negocio ya resuelve bien" + (an.webUrl && !an.servicios.some((s) => s.id === "A") ? " (por ejemplo, no planteamos una web nueva: el sitio actual se aprovecha)" : "") + "."
      : `Con la información disponible, ${an.nombre} no muestra brechas que justifiquen una inversión inmediata. Sugerimos conversar para confirmar los puntos pendientes.`;
    const comercial = [];
    const has = (re) => ops.some((o) => re.test(o.id));
    if (has(/^web/)) comercial.push(`Presencia digital: que quien encuentra a ${an.nombre} en Google tenga un lugar claro donde conocer sus servicios y contactar.`);
    if (has(/^ads/)) comercial.push(`Captación: sumar un canal medible de nuevos ${rub.cliente} sobre la reputación existente.`);
    if (has(/^wa_|^form/)) comercial.push(`Generación de consultas y conversión: facilitar el primer contacto y responder más rápido cada ${rub.consulta}.`);
    if (has(/^agenda/)) comercial.push(`Reservas: permitir que los ${rub.cliente} saquen turno a cualquier hora, con recordatorios que ayudan a reducir ausencias.`);
    if (has(/^seguimiento|^form/)) comercial.push(`Seguimiento y organización comercial: registrar cada ${rub.consulta} para retomarla en el momento oportuno.`);
    if (has(/^redes/)) comercial.push("Presencia en redes: mostrar trabajos, equipo y opiniones donde muchas personas investigan antes de contactar.");
    if (has(/reputacion|pocas_resenas|resenas_neg/)) comercial.push("Reputación: convertir la experiencia de los clientes satisfechos en más opiniones visibles.");
    if (!comercial.length) comercial.push("Mantener lo que hoy funciona y revisar periódicamente los canales de contacto.");
    const escA = `Continuar con el sistema actual conserva sus fortalezas (${fortz.length ? minus(fortz[0].replace(/\.$/, "")) : "su forma actual de trabajo"}) y no requiere inversión. ` +
      `También mantiene las limitaciones detectadas: ${ops.slice(0, 3).map((o) => minus(o.titulo)).join("; ") || "ninguna relevante"}. ` +
      "No tenemos datos para estimar cuántas consultas implica esto; sí sabemos que en esos puntos el contacto depende de que la persona insista.";
    const escB = `Implementar las mejoras recomendadas requiere una inversión${servDoc.some((s) => s.activo && s.precio) ? " (detallada en la propuesta)" : " a definir"} y algo de tiempo del equipo durante la puesta en marcha. ` +
      `A cambio, facilita la captación, la conversión de ${rub.consultas} y la organización comercial, con mediciones para decidir con datos los pasos siguientes. ` +
      "No prometemos resultados específicos: medimos y ajustamos. Nuestra recomendación es este escenario, empezando por la etapa prioritaria.";
    return {
      version: 1, generado: new Date().toISOString(), nivel: an.nivel, fecha: hoyAR(),
      negocio: an.nombre, negocioCompleto: an.nombreCompleto, rubro: cat, direccion: dir,
      situacion, fortalezas: fortz,
      oportunidades: ops.map((o) => ({ id: o.id, activo: true, tipo: o.tipo, titulo: o.titulo, observamos: o.observamos, evidencia: o.evidencia, dificultad: o.dificultad, mejora: o.mejora })),
      comercial, recomendacion,
      plan: [
        "Diagnóstico y planificación: confirmar con ustedes los puntos pendientes y definir prioridades.",
        "Implementación de las herramientas necesarias: " + (orden.join(", ") || "a definir") + ".",
        "Integración de canales comerciales: conectar Google Maps, " + (an.webUrl || servDoc.some((s) => s.activo && s.id === "A") ? "sitio web, " : "") + "WhatsApp y redes para que cada consulta llegue al mismo lugar.",
        "Puesta en funcionamiento: pruebas, ajustes y capacitación del equipo.",
        "Medición y optimización: seguimiento de consultas y ajustes periódicos.",
      ],
      escenarioA: escA, escenarioB: escB,
      verificar: an.faltantes.map((f) => f.txt),
      cierre: "Nos encantaría conversar 20 minutos para repasar este diagnóstico con ustedes, confirmar los puntos pendientes y ver si tiene sentido avanzar. Sin ningún compromiso.",
      servicios: servDoc,
      alternativas: an.alternativas.map((a) => Object.assign({}, a, { recomendada: !!(an.recomendada && a.id === an.recomendada.id) })),
      justificacionRecomendada: an.recomendada ? `Recomendamos la ${minus(an.recomendada.nombre)} porque concentra las mejoras con evidencia más directa en el diagnóstico${an.alternativas.length > 2 ? "; la integral suma herramientas útiles, pero no imprescindibles para el primer paso" : ""}.` : "",
      condiciones: T._condiciones || "Condiciones de pago y validez de la propuesta: a definir.",
      proximoPaso: "Coordinar una reunión breve para confirmar alcance y fechas. Con su aprobación, comenzamos por la etapa de diagnóstico y planificación.",
      observaciones: "",
      contacto: contactoImpulsa(),
      revisado: false,
    };
  }

  const PROMESAS = /(garantiz|asegur[a-z]* (más|mas) (ventas|clientes)|vas a perder|perderá|perder clientes|duplic|triplic|100 ?%)/i;
  function controlCalidad(doc) {
    const avisos = [];
    if (doc.nivel === "preliminar") avisos.push("Diagnóstico PRELIMINAR: el documento lo indicará y listará qué falta verificar.");
    const txt = JSON.stringify([doc.situacion, doc.fortalezas, doc.oportunidades.filter((o) => o.activo), doc.comercial, doc.recomendacion, doc.escenarioA, doc.escenarioB, doc.cierre]);
    const sinNo = txt.replace(/No (prometemos|vamos a prometer)[^.]*\./g, "");
    if (PROMESAS.test(sinNo)) avisos.push("Hay frases que prometen resultados o generan urgencia (garantizar, duplicar, perder…). Revisalas.");
    if (/ {2,}| [,.;:]/.test(txt)) avisos.push("Hay espacios dobles o antes de signos de puntuación.");
    if (/\.\./.test(txt.replace(/\.\.\./g, ""))) avisos.push("Hay puntos duplicados.");
    if (!doc.oportunidades.some((o) => o.activo)) avisos.push("No hay oportunidades activas.");
    const act = doc.servicios.filter((s) => s.activo);
    if (!act.length) avisos.push("La propuesta no tiene servicios seleccionados.");
    if (act.some((s) => !s.precio)) avisos.push("Hay servicios sin precio: se mostrará «A definir».");
    if (!doc.contacto || !(doc.contacto.telefono || doc.contacto.email)) avisos.push("Faltan datos de contacto de IMPULSA (teléfono o email).");
    return avisos;
  }

  /* ===================== HTML para el cliente ===================== */
  const DOC_CSS = ".imx{font:15px/1.55 'Inter',system-ui,-apple-system,Roboto,sans-serif;color:#111827;background:#fff;max-width:820px;margin:0 auto;border-radius:18px}" +
    ".imx .pg{padding:36px 32px;break-after:page;page-break-after:always}.imx .pg:last-child{break-after:auto;page-break-after:auto}" +
    ".imx .cov{min-height:80vh;display:flex;flex-direction:column;justify-content:space-between;gap:24px;background:linear-gradient(160deg,#0f172a 0%,#134e4a 100%);color:#fff;border-radius:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    ".imx .brand{font-weight:800;letter-spacing:.18em;font-size:20px;color:#5eead4}.imx .cov h1{font-size:30px;line-height:1.2;margin:30px 0 18px;text-transform:uppercase}" +
    ".imx .cov .neg{font-size:24px;font-weight:700}.imx .cov .sub{opacity:.88;margin-top:4px}.imx .tag{display:inline-block;background:#f59e0b;color:#111;border-radius:999px;padding:3px 12px;font-weight:700;font-size:12px;margin-top:12px}" +
    ".imx h2{font-size:20px;color:#0f766e;border-bottom:2px solid #ccfbf1;padding-bottom:6px;margin:26px 0 12px}.imx h3{font-size:16px;margin:16px 0 6px}" +
    ".imx .op{border:1px solid #e5e7eb;border-left:4px solid #0d9488;border-radius:12px;padding:12px 14px;margin:10px 0;break-inside:avoid}" +
    ".imx .op.pot{border-left-color:#f59e0b}.imx .k{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-top:6px}" +
    ".imx ul,.imx ol{padding-left:22px}.imx li{margin:4px 0}.imx .muted{color:#6b7280;font-size:13px}" +
    ".imx table{width:100%;border-collapse:collapse;margin:10px 0}.imx th,.imx td{border:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top;font-size:14px}.imx th{background:#f0fdfa}" +
    ".imx .esc{display:grid;grid-template-columns:1fr 1fr;gap:12px}.imx .esc>div{border:1px solid #e5e7eb;border-radius:12px;padding:12px}.imx .esc .b{border-color:#0d9488;background:#f0fdfa}" +
    ".imx .alt{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:8px 0}.imx .alt.rec{border:2px solid #0d9488}" +
    ".imx .foot{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:13px;color:#374151}" +
    "@media (max-width:640px){.imx .pg{padding:22px 16px}.imx .esc{grid-template-columns:1fr}.imx .cov h1{font-size:23px}}" +
    "@media print{.imx .cov{min-height:auto;height:250mm}.imx{max-width:none}}";

  const lis = (arr) => "<ul>" + arr.filter(Boolean).map((x) => "<li>" + e(x) + "</li>").join("") + "</ul>";
  function contactoHtml(c) {
    c = c || {};
    const p = [c.responsable, c.telefono, c.email, c.web].filter(Boolean).map(e).join(" · ");
    return "<div class=\"foot\"><strong>" + e(c.nombre || "IMPULSA") + "</strong>" + (p ? " · " + p : "") + "</div>";
  }
  function portada(doc, titulo) {
    return "<section class=\"pg cov\"><div><div class=\"brand\">IMPULSA</div><div style=\"color:#99f6e4;font-size:13px\">Crecimiento comercial para negocios locales</div></div>" +
      "<div><h1>" + e(titulo) + "</h1><div class=\"neg\">" + e(doc.negocio) + "</div><div class=\"sub\">" + e(doc.rubro) + (doc.direccion ? " · " + e(doc.direccion) : "") + "</div>" +
      "<div class=\"sub\">Fecha del análisis: " + e(doc.fecha) + "</div>" + (doc.nivel === "preliminar" ? "<span class=\"tag\">Diagnóstico preliminar</span>" : "") + "</div>" +
      "<div class=\"sub\">Preparado por " + e((doc.contacto && doc.contacto.nombre) || "IMPULSA") + " a partir de información pública del negocio, para identificar oportunidades concretas y ordenadas de crecimiento.</div></section>";
  }
  const escenarios = (doc) => "<h3>Dos caminos posibles</h3><div class=\"esc\"><div><strong>Escenario A — Seguir como hoy</strong><p>" + e(doc.escenarioA) + "</p></div><div class=\"b\"><strong>Escenario B — Implementar las mejoras</strong><p>" + e(doc.escenarioB) + "</p></div></div>";
  function htmlDiagnostico(doc) {
    const ops = doc.oportunidades.filter((o) => o.activo);
    const servAct = doc.servicios.filter((s) => s.activo);
    return "<div class=\"imx\">" + portada(doc, "Diagnóstico de oportunidades de crecimiento comercial") +
      "<section class=\"pg\"><h2>1. Situación actual</h2><p>" + e(doc.situacion) + "</p>" +
      "<h2>2. Fortalezas detectadas</h2>" + (doc.fortalezas.length ? lis(doc.fortalezas) : "<p class=\"muted\">Sin datos suficientes para destacar fortalezas.</p>") +
      "<h2>3. Oportunidades de mejora</h2>" + ops.map((o) => "<div class=\"op" + (o.tipo === "comprobado" ? "" : " pot") + "\"><h3>" + e(o.titulo) + "</h3>" +
        "<div class=\"k\">Qué observamos</div><div>" + e(o.observamos) + "</div><div class=\"k\">Evidencia</div><div>" + e(o.evidencia) + (o.tipo === "comprobado" || /confirm/i.test(o.evidencia) ? "" : " <em>(a confirmar)</em>") + "</div>" +
        "<div class=\"k\">Qué dificultad puede generar</div><div>" + e(o.dificultad) + "</div><div class=\"k\">Oportunidad de mejora</div><div>" + e(o.mejora) + "</div></div>").join("") +
      "<h2>4. Oportunidades comerciales</h2>" + lis(doc.comercial) +
      "<h2>5. Nuestra recomendación</h2><p>" + e(doc.recomendacion) + "</p>" + (servAct.length ? "<ol>" + servAct.map((s) => "<li><strong>" + e(s.nombre) + "</strong>: " + e(s.justificacion) + ".</li>").join("") + "</ol>" : "") +
      escenarios(doc) +
      "<h2>6. Plan de acción</h2><ol>" + doc.plan.map((p) => "<li>" + e(p) + "</li>").join("") + "</ol>" +
      (doc.nivel === "preliminar" && doc.verificar.length ? "<h3>Puntos a confirmar antes de recomendar una inversión</h3>" + lis(doc.verificar) : "") +
      (doc.observaciones ? "<h3>Observaciones</h3><p>" + e(doc.observaciones) + "</p>" : "") +
      "<h2>Conversemos</h2><p>" + e(doc.cierre) + "</p>" + contactoHtml(doc.contacto) + "</section></div>";
  }
  const esNum = (p) => /^[\d.,\s$]+$/.test(String(p || "")) && /\d/.test(String(p));
  const aNum = (p) => Number(String(p).replace(/[^\d,]/g, "").replace(",", "."));
  function precioTxt(p) { return !p ? "A definir" : esNum(p) ? "$ " + fmtNum(aNum(p)) : String(p); }
  function total(servs) {
    if (!servs.length) return null;
    let t = 0;
    for (const s of servs) { if (!esNum(s.precio)) return null; t += aNum(s.precio); }
    return t;
  }
  function htmlPropuesta(doc) {
    const act = doc.servicios.filter((s) => s.activo);
    const ops = doc.oportunidades.filter((o) => o.activo);
    const tot = total(act);
    const nomS = (id) => (doc.servicios.find((s) => s.id === id) || { nombre: id }).nombre;
    const altHtml = doc.alternativas.length > 1 ? "<h2>Alternativas de contratación</h2>" + doc.alternativas.map((a) => {
      const t = total(doc.servicios.filter((s) => a.servicios.indexOf(s.id) >= 0));
      return "<div class=\"alt" + (a.recomendada ? " rec" : "") + "\"><strong>" + e(a.nombre) + (a.recomendada ? " · recomendada" : "") + "</strong><div>" + e(a.descripcion) + "</div><div class=\"muted\">" +
        e(a.servicios.map(nomS).join(" + ")) + " · Inversión: " + e(t != null ? "$ " + fmtNum(t) : "a definir") + "</div></div>";
    }).join("") + (doc.justificacionRecomendada ? "<p>" + e(doc.justificacionRecomendada) + "</p>" : "") : "";
    return "<div class=\"imx\">" + portada(doc, "Propuesta comercial personalizada") +
      "<section class=\"pg\"><h2>Lo que vamos a resolver</h2>" + lis(ops.map((o) => o.titulo + ": " + minus(o.mejora))) +
      "<h2>Servicios seleccionados</h2>" + act.map((s) => "<div class=\"op\"><h3>" + e(s.nombre) + "</h3><div class=\"muted\">Por qué: " + e(s.justificacion) + ".</div>" +
        "<div class=\"k\">Qué incluye</div>" + lis(s.incluye) + "<div class=\"k\">Entregables</div>" + lis(s.entregables) +
        "<div class=\"k\">Plazo estimado</div><div>" + e(s.plazo) + "</div><div class=\"k\">Inversión</div><div><strong>" + e(precioTxt(s.precio)) + "</strong></div></div>").join("") +
      "<h2>Alcance y etapas</h2><ol>" + doc.plan.map((p) => "<li>" + e(p) + "</li>").join("") + "</ol>" +
      "<h2>Presupuesto</h2><table><tr><th>Servicio</th><th>Plazo</th><th>Inversión</th></tr>" + act.map((s) => "<tr><td>" + e(s.nombre) + "</td><td>" + e(s.plazo) + "</td><td>" + e(precioTxt(s.precio)) + "</td></tr>").join("") +
      "<tr><th colspan=\"2\">Total</th><th>" + e(tot != null ? "$ " + fmtNum(tot) : "A definir") + "</th></tr></table>" + altHtml + escenarios(doc) +
      "<h2>Condiciones de contratación</h2><p>" + e(doc.condiciones) + "</p>" + (doc.observaciones ? "<p>" + e(doc.observaciones) + "</p>" : "") +
      "<h2>Próximo paso</h2><p>" + e(doc.proximoPaso) + "</p>" + contactoHtml(doc.contacto) + "</section></div>";
  }

  /* ===================== WhatsApp ===================== */
  function mensajesWA(r, an, doc) {
    const rub = an.rub, n = an.nombre;
    const presentacion = doc.contacto && doc.contacto.responsable ? "Soy " + doc.contacto.responsable + ", de IMPULSA." : "Les escribo desde IMPULSA.";
    const activas = doc.oportunidades.filter((o) => o.activo);
    let obs;
    if (an.rating != null && an.resenas != null && an.rating >= 4.5 && an.resenas >= 20) obs = `vi que tienen ${fmtRating(an.rating)} estrellas con ${fmtNum(an.resenas)} reseñas en Google, una reputación que cuesta mucho construir`;
    else if (an.webUrl) obs = "estuve mirando su sitio web y su ficha de Google";
    else if (an.resenas != null) obs = `vi su ficha de Google con ${fmtNum(an.resenas)} reseñas`;
    else obs = "estuve mirando cómo se presentan en Google";
    const op = activas[0];
    const opTxt = op ? minus(op.titulo) : "algunos puntos de contacto con sus " + rub.cliente;
    const act = doc.servicios.filter((s) => s.activo).map((s) => minus(s.nombre));
    const tot = total(doc.servicios.filter((s) => s.activo));
    const okWeb = an.cw && an.cw.https && an.cw.viewport;
    return {
      secuencia: [
        { id: "m1", titulo: "1 · Primer contacto", texto: `Hola, ¿cómo están? ${presentacion} ${obs.charAt(0).toUpperCase() + obs.slice(1)}. Preparamos un breve diagnóstico de ${n} con algunas oportunidades para que más ${rub.cliente} los contacten con facilidad (por ejemplo: ${opTxt}). ¿Les parece bien si se lo comparto por acá? Se lee en 2 minutos.` },
        { id: "m2", titulo: "2 · Envío del diagnóstico", texto: `¡Gracias! Les comparto el diagnóstico de ${n}. Resume lo que ya hacen muy bien, ${activas.length} oportunidad${activas.length === 1 ? "" : "es"} concreta${activas.length === 1 ? "" : "s"} con su evidencia y un orden sugerido para trabajarlas.${doc.nivel === "preliminar" ? " Hay algunos puntos que nos gustaría confirmar con ustedes, porque solo vimos información pública." : ""} Cualquier duda, me escriben.` },
        { id: "m3", titulo: "3 · Presentación de la propuesta", texto: `Les paso la propuesta para ${n}. Proponemos empezar por ${act[0] || "el punto prioritario"}${act.length > 1 ? " y después " + act.slice(1).join(" y ") : ""}, porque es lo que responde a lo que vimos en el diagnóstico. Está armada por etapas y se puede ajustar. ¿Les queda bien una llamada de 20 minutos para repasarla?` },
        { id: "m4", titulo: "4 · Seguimiento", texto: `Hola, ¿cómo va? Les escribo por el diagnóstico de ${n} que les compartí. Sé que el día a día no da respiro; si les sirve, les resumo en un audio los dos puntos que me parecen más útiles. Si no es el momento, no hay problema.` },
        { id: "m5", titulo: "5 · Cierre", texto: `Para avanzar, el primer paso sería una reunión corta para confirmar el alcance y las fechas de ${act[0] || "la primera etapa"}. Tengo disponibilidad esta semana: ¿les queda mejor por la mañana o por la tarde?` },
      ],
      objeciones: [
        { id: "o1", titulo: "«Ya tenemos página web»", texto: an.webUrl ? `¡Sí, la vimos! No buscamos reemplazarla. ${okWeb ? "Está bien resuelta técnicamente; la propuesta apunta a otros puntos del recorrido del cliente." : "Encontramos algunos ajustes puntuales que la pueden potenciar sin rehacerla."}` : "¡Perfecto, gracias por aclararlo! En su ficha de Google no aparecía vinculada. Si me pasan el enlace, actualizo el diagnóstico con esa información y la tomamos como base." },
        { id: "o2", titulo: "«Ya tenemos clientes»", texto: `Se nota${an.resenas ? ": " + fmtNum(an.resenas) + " reseñas no son casualidad" : ""}. La idea no es cambiar lo que funciona, sino hacer más fácil que lleguen y se ordenen los ${rub.consultas}, para que el crecimiento no dependa solo del boca a boca.` },
        { id: "o3", titulo: "«Ya trabajamos con publicidad»", texto: "Buenísimo, es una gran señal. No proponemos campañas nuevas por defecto: primero revisaríamos qué consultas generan las actuales y qué pasa cuando llegan, para que la inversión rinda más." },
        { id: "o4", titulo: "«No tenemos presupuesto»", texto: `Entiendo perfectamente. Por eso la propuesta tiene una opción esencial que resuelve solo lo prioritario (${act[0] || "el primer punto"}). También pueden quedarse con el diagnóstico como hoja de ruta y lo retomamos cuando sea un buen momento.` },
        { id: "o5", titulo: "«No nos interesa»", texto: `Gracias por responder, lo respeto. Les dejo el diagnóstico por si en algún momento les sirve. ¡Éxitos con ${n}!` },
        { id: "o6", titulo: "«Lo vamos a pensar»", texto: "Claro, es lo lógico. Si les sirve para decidir, aclaro cualquier punto en una llamada corta. ¿Les parece si les escribo la semana que viene?" },
        { id: "o7", titulo: "«Tenemos alguien que se encarga»", texto: "¡Qué bueno contar con alguien! El diagnóstico también le puede servir a esa persona. Si quieren, trabajamos en conjunto solo en los puntos que hoy no cubre." },
        { id: "o8", titulo: "«Envíame información»", texto: `Con gusto. Les mando el diagnóstico de ${n}: es específico de su negocio, no un folleto genérico. Después, si les parece, lo repasamos en 15 minutos.` },
        { id: "o9", titulo: "«¿Cuánto cuesta?»", texto: tot != null ? `La opción que recomendamos para ${n} tiene una inversión de $ ${fmtNum(tot)}, y hay una alternativa esencial más acotada. Lo ideal es repasar el alcance juntos para que inviertan solo en lo que les sirve.` : `Depende del alcance: armamos el presupuesto según lo que realmente necesita ${n}, sin paquetes cerrados. Con una charla corta les paso un número concreto.` },
        { id: "o10", titulo: "«¿Qué resultados podemos esperar?»", texto: `No vamos a prometer cifras que no podemos asegurar. Lo que sí hacemos es medir desde el primer día cuántos ${rub.consultas} llegan y por qué canal, para que vean el impacto real y decidamos juntos los ajustes.` },
      ],
    };
  }

  /* ===================== Persistencia en el prospecto ===================== */
  function api() { return typeof window !== "undefined" ? window.impulsaDatos || null : null; }
  function getR(k) { const a = api(); return a ? a.get(k) : null; }
  function com(r) {
    if (!r.comercial) r.comercial = { estado: "pendiente", historial: [], verificacion: {}, versiones: [], proxima_accion: "", proxima_fecha: "", doc: null, actualizado: new Date().toISOString() };
    const c = r.comercial;
    c.historial = c.historial || []; c.verificacion = c.verificacion || {}; c.versiones = c.versiones || []; c.estado = c.estado || "pendiente";
    return c;
  }
  function save(k, r) { com(r).actualizado = new Date().toISOString(); const a = api(); if (a) a.set(k, r); }
  function hist(r, ev) { com(r).historial.unshift(Object.assign({ fecha: new Date().toISOString() }, ev)); }

  /* ===================== UI ===================== */
  const UI_CSS = ".imc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:10px 0}.imc-grid .btn{min-height:46px;white-space:normal;line-height:1.2}" +
    ".imc-badge{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--accent);color:#042f2e;font-weight:700;font-size:12px}" +
    ".imc-box{margin-top:10px}.imc-box textarea,.imc-box input,.imc-box select{width:100%;box-sizing:border-box;margin:4px 0 10px;min-height:42px;font:inherit;padding:8px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text)}" +
    ".imc-box textarea{min-height:84px}.imc-box label{font-size:13px;color:var(--muted);display:block}.imc-box input[type=checkbox]{width:auto;min-height:0;margin:0 6px 0 0}" +
    ".imc-msg{border:1px solid var(--border);border-radius:12px;padding:10px;margin:8px 0}" +
    ".imc-h{list-style:none;padding:0}.imc-h li{border-left:3px solid var(--accent);padding:6px 10px;margin:8px 0;background:var(--bg);border-radius:6px}" +
    ".imc-t-comprobado{color:var(--ok)}.imc-t-potencial,.imc-t-hipotesis{color:var(--warn)}.imc-t-no_disponible{color:var(--muted)}" +
    "#impDocVista{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483646;display:flex;flex-direction:column;background:#cbd5e1}" +
    "#impDocVista .imc-bar{flex:none;display:flex;gap:8px;flex-wrap:wrap;padding:10px;padding-top:max(10px,env(safe-area-inset-top));background:#0f172a}" +
    "#impDocVista .imc-bar button{min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid #334155;background:#1e293b;color:#fff;font:600 14px system-ui,sans-serif}" +
    "#impDocVista .imc-bar button.p{background:#2dd4bf;color:#042f2e}#impDocVista .imc-bar button.on{outline:2px solid #2dd4bf}" +
    "#impDocVista .imc-scroll{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px}" +
    "#impDocVista .imc-ed{background:var(--surface);color:var(--text);max-width:820px;margin:0 auto;padding:14px;border-radius:14px}" +
    ".imc-pdf-listo{background:#0f172a;color:#fff;padding:12px 14px;border-radius:14px;margin:0 auto 10px;max-width:820px}" +
    ".imc-pdf-listo a,.imc-pdf-listo button{display:inline-block;margin:8px 8px 0 0;background:#2dd4bf;color:#042f2e;font-weight:700;padding:10px 14px;border-radius:999px;text-decoration:none;border:0;font:inherit;min-height:44px}" +
    "@media print{body.imc-print>*:not(#impDocVista){display:none!important}body.imc-print #impDocVista{position:static;display:block;background:#fff}body.imc-print .imc-bar{display:none!important}body.imc-print .imc-scroll{overflow:visible;padding:0}}" + DOC_CSS;
  function injectCss() { if (document.getElementById("imcCss")) return; const s = document.createElement("style"); s.id = "imcCss"; s.textContent = UI_CSS; document.head.appendChild(s); }

  let actual = null;
  const BOTONES = [["analisis", "Ver análisis completo"], ["diag", "Generar diagnóstico PDF"], ["prop", "Generar propuesta comercial"], ["wa", "Generar mensajes de WhatsApp"],
    ["hist", "Ver historial"], ["contacto", "Registrar contacto"], ["estado", "Actualizar estado comercial"], ["verif", "Verificación manual"], ["tarifas", "Tarifas y datos IMPULSA"]];
  function render(k, host) {
    injectCss();
    const r = getR(k);
    if (!r || !host) return;
    actual = k;
    const c = com(r);
    host.innerHTML = "<div class=\"panel\" id=\"imcPanel\"><p class=\"section-title\">INVESTIGACIÓN COMERCIAL</p>" +
      "<p>Estado: <span class=\"imc-badge\">" + e(estadoLabel(c.estado)) + "</span>" + (c.proxima_accion ? " · Próxima acción: " + e(c.proxima_accion) + (c.proxima_fecha ? " (" + e(c.proxima_fecha) + ")" : "") : "") +
      (c.doc ? " · Documento v" + e(c.doc.version) + (c.doc.revisado ? " revisado" : " sin revisar") : "") + "</p>" +
      "<div class=\"imc-grid\">" + BOTONES.map(([id, l], i) => "<button type=\"button\" class=\"btn " + (i === 1 || i === 2 ? "btn-primary " : "") + "btn-sm\" data-imc=\"" + id + "\">" + e(l) + "</button>").join("") +
      "</div><div id=\"imcBody\" class=\"imc-box\"></div></div>";
    host.querySelectorAll("[data-imc]").forEach((b) => b.addEventListener("click", () => accion(b.dataset.imc)));
  }
  function body() { return document.getElementById("imcBody"); }
  function rerender() { const h = document.getElementById("impComercial"); if (h && actual) render(actual, h); }
  function accion(id) {
    const k = actual, r = getR(k);
    if (!r) return;
    try {
      if (id === "analisis") return verAnalisis(r);
      if (id === "diag") return abrirEditor(k, "diag");
      if (id === "prop") return abrirEditor(k, "prop");
      if (id === "wa") return verWA(k);
      if (id === "hist") return verHist(k);
      if (id === "contacto") return formContacto(k);
      if (id === "estado") return formEstado(k);
      if (id === "verif") return formVerif(k);
      if (id === "tarifas") return formTarifas();
    } catch (err) { alert("Error: " + (err && err.message ? err.message : err)); }
  }

  function verAnalisis(r) {
    const an = analizar(r);
    const q = (t, arr) => "<p class=\"section-title\">" + e(t) + "</p>" + (arr.length ? "<ul>" + arr.map((x) => "<li>" + x + "</li>").join("") + "</ul>" : "<p class=\"hint\">Sin datos.</p>");
    body().innerHTML = "<p><strong>Nivel: " + (an.nivel === "concluyente" ? "diagnóstico concluyente" : "diagnóstico PRELIMINAR (faltan datos clave)") + "</strong> · rubro detectado: " + e(an.rub.id) + "</p>" +
      q("Datos comprobados", an.hechos.comprobado.map((x) => "<span class=\"imc-t-comprobado\">✔</span> " + e(x))) +
      q("Hipótesis (no confirmadas)", an.hechos.hipotesis.map((x) => "<span class=\"imc-t-hipotesis\">?</span> " + e(x))) +
      q("No disponible", an.hechos.no_disponible.map((x) => "<span class=\"imc-t-no_disponible\">–</span> " + e(x))) +
      q("1-2. Qué hace bien / fortalezas", an.fortalezas.map(e)) +
      q("3-5. Deficiencias y oportunidades (con consecuencias)", an.oportunidades.map((o) => "<strong>" + e(o.titulo) + "</strong> <span class=\"imc-t-" + o.tipo + "\">[" + (o.tipo === "comprobado" ? "comprobado" : "oportunidad potencial") + "]</span><br>" + e(o.observamos) + " <em>" + e(o.evidencia) + "</em><br>Consecuencia posible: " + e(o.dificultad))) +
      q("6-8. Prioridad e impacto (servicios IMPULSA justificados)", an.servicios.map((s, i) => (i + 1) + ". <strong>" + e(s.nombre) + "</strong>" + (s.soloIntegral ? " (solo en opción integral)" : "") + " — " + e(s.justificacion.join("; ")))) +
      q("9. Recomendación y argumentos", [an.recomendada ? e(an.recomendada.nombre + ": " + an.recomendada.servicios.map((x) => SERVICIOS[x].nombre).join(" → ")) : "Sin servicios justificados con los datos actuales."]) +
      q("Antes de recomendar una inversión, verificar", an.faltantes.map((f) => e(f.txt) + (f.critico ? " <strong>(clave)</strong>" : ""))) +
      "<p class=\"hint\">Cargá lo que revises en «Verificación manual» (Ads Library, Instagram, reseñas) para pasar de preliminar a concluyente. Después generá una nueva versión del documento.</p>";
  }

  function docDe(k, r, forzar) {
    const c = com(r);
    if (!c.doc || forzar) {
      const prev = c.doc;
      const d = armarDoc(r, analizar(r));
      if (prev) {
        d.version = (prev.version || 1) + 1; d.contacto = prev.contacto || d.contacto; d.observaciones = prev.observaciones || ""; d.condiciones = prev.condiciones || d.condiciones;
        d.servicios.forEach((s) => { const p = (prev.servicios || []).find((x) => x.id === s.id); if (p) { s.precio = p.precio || s.precio; s.plazo = p.plazo || s.plazo; } });
      }
      c.doc = d;
      if (c.estado === "pendiente") c.estado = "diagnostico_generado";
      hist(r, { tipo: "diagnostico_generado", detalle: "Versión " + d.version + " (" + d.nivel + ") · servicios: " + (d.servicios.filter((s) => s.activo).map((s) => s.nombre).join(", ") || "ninguno") });
      save(k, r);
    }
    return c.doc;
  }

  /* --- Editor + vista previa: overlay a pantalla completa (apto Android) --- */
  function cerrarVista() {
    const v = document.getElementById("impDocVista");
    if (v && v._pdfUrls) v._pdfUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (x) { /* nada */ } });
    if (v) v.remove();
    document.body.style.overflow = "";
    document.body.classList.remove("imc-print");
  }
  function abrirEditor(k, modo) {
    docDe(k, getR(k), false);
    cerrarVista();
    const ov = document.createElement("div");
    ov.id = "impDocVista";
    ov.innerHTML = "<div class=\"imc-bar\"><button type=\"button\" data-b=\"cerrar\">Cerrar</button><button type=\"button\" data-b=\"editar\">Editar</button>" +
      "<button type=\"button\" data-b=\"diag\">Vista diagnóstico</button><button type=\"button\" data-b=\"prop\">Vista propuesta</button>" +
      "<button type=\"button\" class=\"p\" data-b=\"print\">Imprimir / PDF</button><button type=\"button\" data-b=\"share\">Compartir</button><button type=\"button\" data-b=\"regen\">Nueva versión</button></div>" +
      "<div class=\"imc-scroll\"></div>";
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    const scroll = ov.querySelector(".imc-scroll");
    let vista = "editar", tipoDoc = modo;
    const pintar = () => {
      const d = com(getR(k)).doc;
      ov.querySelectorAll("[data-b]").forEach((b) => b.classList.toggle("on", b.dataset.b === (vista === "editar" ? "editar" : tipoDoc)));
      if (vista === "editar") { scroll.innerHTML = editorHtml(d, tipoDoc); bindEditor(k, scroll, tipoDoc); }
      else scroll.innerHTML = tipoDoc === "diag" ? htmlDiagnostico(d) : previewPropuestaPdf(k, d);
      scroll.scrollTop = 0;
    };
    ov.querySelector(".imc-bar").addEventListener("click", async (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      const a = b.dataset.b;
      if (vista === "editar") leerEditor(k, scroll);
      if (a === "cerrar") { cerrarVista(); rerender(); return; }
      if (a === "editar") { vista = "editar"; return pintar(); }
      if (a === "diag" || a === "prop") { tipoDoc = a; vista = "preview"; return pintar(); }
      if (a === "regen") {
        if (!confirm("¿Generar una nueva versión con la investigación y la verificación actuales? Se conservan precios, plazos, contacto y observaciones; los textos editados se reemplazan.")) return;
        docDe(k, getR(k), true); vista = "editar"; return pintar();
      }
      const d = com(getR(k)).doc;
      if (a === "print") {
        const avisos = controlCalidad(d);
        if (!d.revisado) { alert("Antes del PDF definitivo, marcá «Revisé el contenido» al final de Editar." + (avisos.length ? "\n\nControl de calidad:\n- " + avisos.join("\n- ") : "")); vista = "editar"; return pintar(); }
        if (avisos.length && !confirm("Control de calidad:\n- " + avisos.join("\n- ") + "\n\n¿Generar el PDF igual?")) return;
        if (tipoDoc === "prop") {
          /* Propuesta: siempre el PDF de 12 páginas. Si falla, no se imprime el HTML viejo. */
          vista = "preview"; pintar();
          await exportarPropuesta(k, com(getR(k)).doc, b, { registrar: true });
          return;
        }
        if (vista === "editar") { vista = "preview"; pintar(); }
        registrarDoc(k, tipoDoc);
        document.body.classList.add("imc-print");
        setTimeout(() => { try { window.print(); } catch (x) { alert("No pude abrir la impresión."); } setTimeout(() => document.body.classList.remove("imc-print"), 1000); }, 200);
        return;
      }
      if (a === "share" && tipoDoc === "prop") {
        await exportarPropuesta(k, com(getR(k)).doc, b, { registrar: true });
        return;
      }
      if (a === "share") {
        const html = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + e(d.negocio) + "</title><style>" + DOC_CSS + "</style></head><body style=\"margin:0;background:#fff\">" + htmlDiagnostico(d) + "</body></html>";
        const nombre = (tipoDoc === "diag" ? "diagnostico-" : "propuesta-") + d.negocio.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".html";
        try {
          const f = new File([html], nombre, { type: "text/html" });
          if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: d.negocio }); return; }
        } catch (x) { return; }
        alert("Este dispositivo no permite compartir archivos. Usá «Imprimir / PDF» y elegí «Guardar como PDF».");
      }
    });
    pintar();
  }
  function previewPropuestaPdf(k, d) {
    const P = window.impulsaPropuestaPDF;
    if (!P) return "<div class=\"imc-ed\"><h3>No se puede armar la propuesta</h3><p>No se cargó el generador del PDF. Recargá la página. No se imprime el borrador HTML.</p></div>";
    let S;
    try { S = P.textos(P.infoDesde(analizar(getR(k)), d)); }
    catch (err) { return "<div class=\"imc-ed\"><p>No pude leer el diagnóstico para la propuesta: " + e(err && err.message ? err.message : err) + "</p></div>"; }
    const fila = (tit, val) => "<h3>" + e(tit) + "</h3><p>" + e(val) + "</p>";
    return "<div class=\"imc-ed\"><h3 style=\"margin-top:0\">Propuesta Crecimiento Comercial · 12 páginas</h3>" +
      "<p class=\"hint\">Textos que se escriben en la plantilla final a partir del diagnóstico de este negocio. Carlos Serrano, el caso Contreras y las fuentes quedan como en la plantilla. No es el borrador HTML.</p>" +
      fila("Nombre", (S.p1_nombre_1 + " " + S.p1_nombre_2).trim()) +
      fila("Qué observamos", S.p2_obs1 + " " + S.p2_obs2) +
      fila("Oportunidad del diagnóstico", S.p2_oportunidad) +
      fila("Interpretación", S.p3_texto) +
      fila("Oferta", S.p11_intro) +
      fila("Web", S.p11_web) +
      fila("Agenda", S.p11_agenda) +
      fila("Inversión", S.p11_total + " · " + S.p11_etapas) +
      "<p class=\"hint\">Oferta: " + e(S.oferta) + (S.completo ? " · paquete base" : " · adaptada a lo que ya tiene") + ".</p></div>";
  }
  async function exportarPropuesta(k, d, boton, opts) {
    const registrar = !opts || opts.registrar !== false;
    const P = window.impulsaPropuestaPDF;
    if (!P || !P.descargar || !P.infoDesde) {
      alert("No se cargó el generador del PDF de 12 páginas (propuesta-pdf.js). Recargá la página. No se abre la impresión del borrador HTML.");
      return;
    }
    let info;
    try { info = P.infoDesde(analizar(getR(k)), d); }
    catch (err) {
      alert("No pude usar el diagnóstico para la propuesta. No se abre la impresión HTML.\n\n" + (err && err.message ? err.message : err));
      return;
    }
    const archivo = "propuesta-" + String(d.negocio || "negocio").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".pdf";
    const prev = boton ? boton.textContent : "";
    if (boton) { boton.disabled = true; boton.textContent = "Generando PDF…"; }
    try {
      const res = await P.descargar(info, archivo);
      if (registrar) registrarDoc(k, "prop");
      mostrarPdfListo(res);
      if (!res.completo) alert("El diagnóstico muestra web o agenda: la propuesta se adaptó para no reemplazar lo que ya funciona. La inversión sigue en $400.000. Revisala antes de enviarla.");
      if (res.avisos && res.avisos.length) alert("Revisá el PDF antes de enviarlo. Hay texto que no entró en el espacio de la plantilla:\n- " + res.avisos.join("\n- "));
    } catch (x) {
      alert("No pude generar el PDF de 12 páginas. No se abre la impresión del borrador HTML.\n\n" + (x && x.message ? x.message : x));
    } finally {
      if (boton) { boton.disabled = false; boton.textContent = prev || "Imprimir / PDF"; }
    }
  }
  function mostrarPdfListo(res) {
    const ov = document.getElementById("impDocVista");
    const scroll = ov && ov.querySelector(".imc-scroll");
    if (!ov || !scroll || !res || !res.url) return;
    ov._pdfUrls = ov._pdfUrls || [];
    ov._pdfUrls.push(res.url);
    const viejo = scroll.querySelector(".imc-pdf-listo");
    if (viejo) viejo.remove();
    const box = document.createElement("div");
    box.className = "imc-pdf-listo";
    box.appendChild(document.createTextNode("PDF de 12 páginas listo. "));
    const a = document.createElement("a");
    a.href = res.url; a.download = res.nombre || "propuesta.pdf"; a.textContent = "Abrir / guardar PDF";
    box.appendChild(a);
    if (res.file && navigator.share) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "Compartir";
      b.addEventListener("click", async () => {
        try { await navigator.share({ files: [res.file], title: res.nombre || "Propuesta" }); }
        catch (err) { if (err && err.name === "AbortError") return; alert("No se pudo compartir. Usá «Abrir / guardar PDF»."); }
      });
      box.appendChild(b);
    }
    scroll.insertBefore(box, scroll.firstChild);
    scroll.scrollTop = 0;
  }
  function registrarDoc(k, tipoDoc) {
    const r = getR(k), c = com(r), d = c.doc;
    const act = d.servicios.filter((s) => s.activo), t = total(act);
    c.versiones.unshift({ fecha: new Date().toISOString(), tipo: tipoDoc === "diag" ? "diagnostico" : "propuesta", version: d.version, nivel: d.nivel,
      servicios: act.map((s) => ({ id: s.id, nombre: s.nombre, precio: s.precio, plazo: s.plazo })), total: t, snapshot: JSON.parse(JSON.stringify(d)) });
    c.versiones = c.versiones.slice(0, 20);
    hist(r, { tipo: tipoDoc === "diag" ? "diagnostico_pdf" : "propuesta_pdf", detalle: (tipoDoc === "diag" ? "Diagnóstico" : "Propuesta y presupuesto") + " v" + d.version + " exportado" + (tipoDoc === "prop" ? " · total " + (t != null ? "$ " + fmtNum(t) : "a definir") : "") });
    save(k, r);
  }
  const ta = (name, v, rows) => "<textarea data-f=\"" + name + "\" rows=\"" + (rows || 4) + "\">" + e(v) + "</textarea>";
  const inp = (name, v, ph) => "<input data-f=\"" + name + "\" value=\"" + e(v) + "\" placeholder=\"" + e(ph || "") + "\">";
  function editorHtml(d, modo) {
    const avisos = controlCalidad(d);
    const c = d.contacto || {};
    return "<div class=\"imc-ed imc-box\"><h3 style=\"margin-top:0\">Revisión antes de enviar · " + e(d.negocio) + " · v" + e(d.version) + "</h3>" +
      "<p class=\"hint\">Nada se envía automáticamente. Editá, revisá la vista previa y recién después usá Imprimir / PDF. Nivel: <strong>" + e(d.nivel) + "</strong>.</p>" +
      (modo === "prop" ? "<p class=\"hint\">«Imprimir / PDF» arma la plantilla final de 12 páginas de Crecimiento Comercial con este diagnóstico (datos, interpretación, oportunidades y oferta). No copia otro caso y, si falla, no abre la impresión del borrador HTML.</p>" : "") +
      (avisos.length ? "<div class=\"imc-msg\" style=\"border-color:var(--warn)\"><strong>Control de calidad</strong><br>" + avisos.map(e).join("<br>") + "</div>" : "") +
      "<label>1. Situación actual</label>" + ta("situacion", d.situacion, 5) +
      "<label>2. Fortalezas (una por línea)</label>" + ta("fortalezas", d.fortalezas.join("\n"), 5) +
      "<p class=\"section-title\">3. Oportunidades de mejora</p>" + d.oportunidades.map((o, i) =>
        "<div class=\"imc-msg\"><label><input type=\"checkbox\" data-op=\"" + i + "\"" + (o.activo ? " checked" : "") + ">Incluir · <span class=\"imc-t-" + e(o.tipo) + "\">" + (o.tipo === "comprobado" ? "comprobado" : "potencial") + "</span></label>" +
        inp("op" + i + "_titulo", o.titulo) + "<label>Qué observamos</label>" + ta("op" + i + "_observamos", o.observamos, 2) + "<label>Evidencia</label>" + ta("op" + i + "_evidencia", o.evidencia, 2) +
        "<label>Dificultad que puede generar</label>" + ta("op" + i + "_dificultad", o.dificultad, 2) + "<label>Oportunidad de mejora</label>" + ta("op" + i + "_mejora", o.mejora, 2) + "</div>").join("") +
      "<label>4. Oportunidades comerciales (una por línea)</label>" + ta("comercial", d.comercial.join("\n"), 4) +
      "<label>5. Recomendación</label>" + ta("recomendacion", d.recomendacion, 4) +
      "<label>Escenario A (seguir igual)</label>" + ta("escenarioA", d.escenarioA, 4) + "<label>Escenario B (implementar)</label>" + ta("escenarioB", d.escenarioB, 4) +
      "<label>6. Plan de acción (una etapa por línea)</label>" + ta("plan", d.plan.join("\n"), 5) +
      "<label>Puntos a verificar (se muestran si es preliminar)</label>" + ta("verificar", d.verificar.join("\n"), 3) +
      "<p class=\"section-title\">Servicios, precios y plazos</p>" + d.servicios.map((s, i) =>
        "<div class=\"imc-msg\"><label><input type=\"checkbox\" data-sv=\"" + i + "\"" + (s.activo ? " checked" : "") + "><strong>" + e(s.nombre) + "</strong>" + (s.soloIntegral ? " (sugerido solo para la integral)" : "") + "</label>" +
        "<div class=\"hint\">Justificación: " + e(s.justificacion) + "</div><label>Precio en ARS (vacío = a definir)</label>" + inp("sv" + i + "_precio", s.precio, "a definir") +
        "<label>Plazo</label>" + inp("sv" + i + "_plazo", s.plazo) + "<label>Qué incluye (uno por línea)</label>" + ta("sv" + i + "_incluye", s.incluye.join("\n"), 3) + "<label>Entregables (uno por línea)</label>" + ta("sv" + i + "_entregables", s.entregables.join("\n"), 2) + "</div>").join("") +
      (d.alternativas.length > 1 ? "<label>Justificación de la alternativa recomendada</label>" + ta("justificacionRecomendada", d.justificacionRecomendada, 3) : "") +
      "<label>Condiciones de contratación</label>" + ta("condiciones", d.condiciones, 3) + "<label>Próximo paso</label>" + ta("proximoPaso", d.proximoPaso, 2) +
      "<label>Observaciones (se muestran en el documento)</label>" + ta("observaciones", d.observaciones, 2) + "<label>Cierre</label>" + ta("cierre", d.cierre, 3) +
      "<p class=\"section-title\">Datos de contacto de IMPULSA</p>" + inp("c_nombre", c.nombre, "IMPULSA") + inp("c_responsable", c.responsable, "Responsable") + inp("c_telefono", c.telefono, "Teléfono") + inp("c_email", c.email, "Email") + inp("c_web", c.web, "Web") +
      "<label style=\"font-size:15px;color:var(--text)\"><input type=\"checkbox\" data-f=\"revisado\"" + (d.revisado ? " checked" : "") + ">Revisé el contenido, la ortografía y los precios</label>" +
      "<div class=\"toolbar\"><button type=\"button\" class=\"btn btn-primary btn-sm\" data-save=\"1\">Guardar cambios</button></div></div>";
  }
  function bindEditor(k, scroll, modo) {
    const b = scroll.querySelector("[data-save]");
    if (b) b.addEventListener("click", () => { leerEditor(k, scroll); scroll.innerHTML = editorHtml(com(getR(k)).doc, modo); bindEditor(k, scroll, modo); alert("Cambios guardados."); });
  }
  function leerEditor(k, scroll) {
    if (!scroll.querySelector("[data-f]")) return;
    const r = getR(k), d = com(r).doc;
    const f = (n) => { const el = scroll.querySelector("[data-f=\"" + n + "\"]"); return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
    const lines = (n) => String(f(n) || "").split("\n").map((x) => x.trim()).filter(Boolean);
    ["situacion", "recomendacion", "escenarioA", "escenarioB", "condiciones", "proximoPaso", "observaciones", "cierre", "justificacionRecomendada"].forEach((n) => { const v = f(n); if (v !== undefined) d[n] = String(v).trim(); });
    d.fortalezas = lines("fortalezas"); d.comercial = lines("comercial"); d.plan = lines("plan"); d.verificar = lines("verificar");
    d.oportunidades.forEach((o, i) => {
      const cb = scroll.querySelector("[data-op=\"" + i + "\"]"); if (cb) o.activo = cb.checked;
      ["titulo", "observamos", "evidencia", "dificultad", "mejora"].forEach((p) => { const v = f("op" + i + "_" + p); if (v !== undefined) o[p] = v.trim(); });
    });
    d.servicios.forEach((s, i) => {
      const cb = scroll.querySelector("[data-sv=\"" + i + "\"]"); if (cb) s.activo = cb.checked;
      s.precio = String(f("sv" + i + "_precio") || "").trim(); s.plazo = String(f("sv" + i + "_plazo") || s.plazo).trim();
      const inc = lines("sv" + i + "_incluye"), ent = lines("sv" + i + "_entregables"); if (inc.length) s.incluye = inc; if (ent.length) s.entregables = ent;
    });
    d.contacto = { nombre: f("c_nombre") || "IMPULSA", responsable: f("c_responsable") || "", telefono: f("c_telefono") || "", email: f("c_email") || "", web: f("c_web") || "" };
    lsSet(LS_CON, d.contacto);
    d.revisado = !!f("revisado");
    d.editado = new Date().toISOString();
    save(k, r);
  }

  /* --- WhatsApp --- */
  function verWA(k) {
    const r = getR(k), d = docDe(k, r, false), an = analizar(r), m = mensajesWA(r, an, d);
    const wa = val(r.whatsapp) || (r.redes && val(r.redes.whatsapp_web)) || null;
    const bloque = (x) => "<div class=\"imc-msg\"><strong>" + e(x.titulo) + "</strong><textarea data-wa=\"" + x.id + "\" rows=\"5\">" + e(x.texto) + "</textarea>" +
      "<div class=\"toolbar\"><button type=\"button\" class=\"btn btn-sm\" data-copy=\"" + x.id + "\">Copiar</button>" +
      (wa ? "<button type=\"button\" class=\"btn btn-wa btn-sm\" data-open=\"" + x.id + "\">Abrir en WhatsApp</button>" : "") +
      "<button type=\"button\" class=\"btn btn-ghost btn-sm\" data-used=\"" + x.id + "\">Marcar como enviado</button></div></div>";
    body().innerHTML = "<p class=\"hint\">Revisá y editá antes de enviar. Nada se envía solo. Basado en el documento v" + e(d.version) + (wa ? "" : " · sin WhatsApp detectado: copiá y pegá") + ".</p>" +
      "<p class=\"section-title\">Secuencia</p>" + m.secuencia.map(bloque).join("") + "<p class=\"section-title\">Respuestas a objeciones</p>" + m.objeciones.map(bloque).join("");
    const todos = m.secuencia.concat(m.objeciones);
    const campo = (id) => body().querySelector("[data-wa=\"" + id + "\"]");
    const tit = (id) => (todos.find((x) => x.id === id) || {}).titulo || id;
    body().querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
      const el = campo(b.dataset.copy);
      try { await navigator.clipboard.writeText(el.value); } catch (x) { el.select(); try { document.execCommand("copy"); } catch (y) { /* nada */ } }
      b.textContent = "¡Copiado!";
    }));
    body().querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => {
      let base;
      if (/^https?:/.test(wa)) base = String(wa).split("?")[0];
      else { let num = String(wa).replace(/\D/g, ""); if (num.indexOf("54") !== 0) num = "54" + num; base = "https://wa.me/" + num; }
      window.open(base + "?text=" + encodeURIComponent(campo(b.dataset.open).value), "_blank", "noopener");
    }));
    body().querySelectorAll("[data-used]").forEach((b) => b.addEventListener("click", () => {
      const rr = getR(k), id = b.dataset.used, c = com(rr);
      hist(rr, { tipo: "mensaje", canal: "WhatsApp", detalle: tit(id), mensaje: campo(id).value });
      const sig = { m1: "primer_contacto", m2: "diagnostico_enviado", m3: "propuesta_enviada" }[id];
      const ord = ESTADOS.map((x) => x[0]);
      if (sig && ord.indexOf(c.estado) < ord.indexOf(sig) && ["ganado", "perdido"].indexOf(c.estado) < 0) c.estado = sig;
      save(k, rr); b.textContent = "Registrado ✔";
    }));
  }

  /* --- CRM --- */
  function verHist(k) {
    const c = com(getR(k));
    const tipos = { diagnostico_generado: "Diagnóstico generado", diagnostico_pdf: "Diagnóstico exportado", propuesta_pdf: "Propuesta y presupuesto exportados", mensaje: "Mensaje", contacto: "Contacto", estado: "Cambio de estado", verificacion: "Verificación manual" };
    body().innerHTML = "<p class=\"section-title\">Historial comercial</p>" + (c.historial.length ? "<ul class=\"imc-h\">" + c.historial.map((h) =>
      "<li><strong>" + e(tipos[h.tipo] || h.tipo) + "</strong> · " + e(ahoraAR(h.fecha)) + (h.canal ? " · " + e(h.canal) : "") + "<br>" + e(h.detalle || "") +
      (h.mensaje ? "<details><summary>Mensaje</summary>" + e(h.mensaje) + "</details>" : "") + (h.observaciones ? "<br><em>" + e(h.observaciones) + "</em>" : "") +
      (h.proxima_accion ? "<br>Próxima acción: " + e(h.proxima_accion) + (h.proxima_fecha ? " (" + e(h.proxima_fecha) + ")" : "") : "") + "</li>").join("") + "</ul>" : "<p class=\"hint\">Todavía no hay movimientos.</p>") +
      "<p class=\"section-title\">Diagnósticos, propuestas y presupuestos guardados</p>" + (c.versiones.length ? "<ul>" + c.versiones.map((v, i) => "<li>" + e(v.tipo) + " v" + e(v.version) + " · " + e(ahoraAR(v.fecha)) + " · " +
        e(v.servicios.map((s) => s.nombre + (s.precio ? " $" + s.precio : "")).join(", ")) + (v.total != null ? " · total $ " + e(fmtNum(v.total)) : "") +
        " <button type=\"button\" class=\"btn btn-ghost btn-sm\" data-ver=\"" + i + "\">Ver</button></li>").join("") + "</ul>" : "<p class=\"hint\">Aún no se exportaron documentos.</p>");
    body().querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => {
      const v = c.versiones[+b.dataset.ver];
      cerrarVista();
      const ov = document.createElement("div"); ov.id = "impDocVista";
      const cuerpo = v.tipo === "diagnostico" ? htmlDiagnostico(v.snapshot) : previewPropuestaPdf(k, v.snapshot);
      ov.innerHTML = "<div class=\"imc-bar\"><button type=\"button\" data-x=\"1\">Cerrar</button><button type=\"button\" class=\"p\" data-p=\"1\">Imprimir / PDF</button></div><div class=\"imc-scroll\">" + cuerpo + "</div>";
      document.body.appendChild(ov); document.body.style.overflow = "hidden";
      ov.querySelector("[data-x]").addEventListener("click", cerrarVista);
      ov.querySelector("[data-p]").addEventListener("click", async (ev) => {
        if (v.tipo === "propuesta") { await exportarPropuesta(k, v.snapshot, ev.currentTarget, { registrar: false }); return; }
        document.body.classList.add("imc-print");
        setTimeout(() => { try { window.print(); } catch (x) { alert("No pude abrir la impresión."); } setTimeout(() => document.body.classList.remove("imc-print"), 1000); }, 200);
      });
    }));
  }
  const opcionesEstado = (sel) => ESTADOS.map((x) => "<option value=\"" + x[0] + "\"" + (x[0] === sel ? " selected" : "") + ">" + e(x[1]) + "</option>").join("");
  function formContacto(k) {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    body().innerHTML = "<p class=\"section-title\">Registrar contacto</p><label>Fecha y hora</label><input type=\"datetime-local\" id=\"imcF\" value=\"" + local + "\">" +
      "<label>Canal</label><select id=\"imcCanal\"><option>WhatsApp</option><option>Llamada</option><option>Email</option><option>Reunión</option><option>Visita</option><option>Otro</option></select>" +
      "<label>Mensaje utilizado / resumen</label><textarea id=\"imcMsg\"></textarea><label>Observaciones</label><textarea id=\"imcObs\"></textarea>" +
      "<label>Próxima acción</label><input id=\"imcProx\" placeholder=\"Ej.: enviar propuesta\"><label>Fecha de la próxima acción</label><input type=\"date\" id=\"imcProxF\">" +
      "<label>Nuevo estado (opcional)</label><select id=\"imcEst\"><option value=\"\">Sin cambios</option>" + opcionesEstado("") + "</select>" +
      "<button type=\"button\" class=\"btn btn-primary btn-sm\" id=\"imcGuardar\">Guardar contacto</button>";
    document.getElementById("imcGuardar").addEventListener("click", () => {
      const g = (id) => document.getElementById(id).value.trim();
      const rr = getR(k), c = com(rr);
      const fecha = g("imcF") ? new Date(g("imcF")).toISOString() : new Date().toISOString();
      c.historial.unshift({ fecha, tipo: "contacto", canal: g("imcCanal"), mensaje: g("imcMsg"), observaciones: g("imcObs"), proxima_accion: g("imcProx"), proxima_fecha: g("imcProxF"), detalle: "Contacto por " + g("imcCanal") });
      if (g("imcProx")) { c.proxima_accion = g("imcProx"); c.proxima_fecha = g("imcProxF"); }
      if (g("imcEst")) c.estado = g("imcEst");
      save(k, rr); rerender(); verHist(k);
    });
  }
  function formEstado(k) {
    const c = com(getR(k));
    body().innerHTML = "<p class=\"section-title\">Actualizar estado comercial</p><select id=\"imcEst2\">" + opcionesEstado(c.estado) + "</select>" +
      "<label>Próxima acción</label><input id=\"imcProx2\" value=\"" + e(c.proxima_accion || "") + "\"><label>Fecha</label><input type=\"date\" id=\"imcProxF2\" value=\"" + e(c.proxima_fecha || "") + "\">" +
      "<label>Observación</label><textarea id=\"imcObs2\"></textarea><button type=\"button\" class=\"btn btn-primary btn-sm\" id=\"imcEstOk\">Guardar</button>";
    document.getElementById("imcEstOk").addEventListener("click", () => {
      const g = (id) => document.getElementById(id).value.trim();
      const rr = getR(k), cc = com(rr), nuevo = g("imcEst2");
      hist(rr, { tipo: "estado", detalle: estadoLabel(cc.estado) + " → " + estadoLabel(nuevo), observaciones: g("imcObs2"), proxima_accion: g("imcProx2"), proxima_fecha: g("imcProxF2") });
      cc.estado = nuevo; cc.proxima_accion = g("imcProx2"); cc.proxima_fecha = g("imcProxF2");
      save(k, rr); rerender();
    });
  }
  function formVerif(k) {
    const r = getR(k), v = com(r).verificacion;
    const sel = (id, opts) => "<select data-v=\"" + id + "\"><option value=\"\">Sin verificar</option>" + opts.map(([a, b]) => "<option value=\"" + a + "\"" + (v[id] === a ? " selected" : "") + ">" + e(b) + "</option>").join("") + "</select>";
    const txt = (id, ph) => "<input data-v=\"" + id + "\" value=\"" + e(v[id] ?? "") + "\" placeholder=\"" + e(ph || "") + "\">";
    const ads = r.meta_ads && r.meta_ads.fuente;
    body().innerHTML = "<p class=\"section-title\">Verificación manual (lo que revisaste vos)</p><p class=\"hint\">Cargá solo lo que viste. Vacío = no disponible. Esto alimenta el diagnóstico y define si es preliminar o concluyente.</p>" +
      "<label>¿Tiene sitio web propio?</label>" + sel("tiene_web", [["si", "Sí"], ["no", "No"]]) +
      "<label>Calidad del sitio (si tiene)</label>" + sel("web_calidad", [["buena", "Buena"], ["regular", "Regular"], ["pobre", "Pobre"]]) +
      "<label>¿Reserva / turnos online funcionando?</label>" + sel("agenda", [["si", "Sí"], ["no", "No"]]) +
      "<label>Meta Ads Library" + (ads ? " (<a href=\"" + e(ads) + "\" target=\"_blank\" rel=\"noopener\">abrir</a>)" : "") + "</label>" + sel("ads", [["si", "Tiene anuncios activos"], ["no", "Sin anuncios activos"]]) +
      "<label>Detalle de anuncios (tipo, creatividades, mensaje)</label>" + txt("ads_detalle") +
      "<label>¿Tiene Instagram?</label>" + sel("ig_existe", [["si", "Sí"], ["no", "No"]]) +
      "<label>Seguidores de Instagram</label>" + txt("ig_seguidores", "solo el número que viste") +
      "<label>Días desde la última publicación</label>" + txt("ig_ultima_pub_dias") +
      "<label>Temas positivos en reseñas (lo que destacan)</label>" + txt("resenas_positivas", "ej.: trato cálido, puntualidad") +
      "<label>Temas negativos RECURRENTES (solo si se repiten en varias reseñas)</label>" + txt("resenas_negativas") +
      "<label>Notas internas (no salen en ningún documento)</label><textarea data-v=\"notas\">" + e(v.notas || "") + "</textarea>" +
      "<button type=\"button\" class=\"btn btn-primary btn-sm\" id=\"imcVerOk\">Guardar verificación</button>";
    document.getElementById("imcVerOk").addEventListener("click", () => {
      const rr = getR(k), c = com(rr);
      body().querySelectorAll("[data-v]").forEach((el) => { c.verificacion[el.dataset.v] = el.value.trim(); });
      c.verificacion.fecha = new Date().toISOString();
      hist(rr, { tipo: "verificacion", detalle: "Datos verificados manualmente. Usá «Nueva versión» en el documento para incorporarlos." });
      save(k, rr); verAnalisis(getR(k));
    });
  }
  function formTarifas() {
    const T = tarifas();
    body().innerHTML = "<p class=\"section-title\">Tarifas IMPULSA (se guardan en este dispositivo)</p><p class=\"hint\">Vacío = «A definir». No se aplica ninguna tarifa que no cargues vos.</p>" +
      Object.keys(SERVICIOS).map((id) => "<label>" + e(SERVICIOS[id].nombre) + "</label><div style=\"display:flex;gap:6px\"><input data-tp=\"" + id + "\" placeholder=\"Precio ARS\" inputmode=\"numeric\" value=\"" + e((T[id] || {}).precio || "") + "\"><input data-tz=\"" + id + "\" placeholder=\"" + e(SERVICIOS[id].plazo) + "\" value=\"" + e((T[id] || {}).plazo || "") + "\"></div>").join("") +
      "<label>Condiciones de contratación por defecto</label><textarea id=\"imcCond\">" + e(T._condiciones || "") + "</textarea><button type=\"button\" class=\"btn btn-primary btn-sm\" id=\"imcTarOk\">Guardar tarifas</button>";
    document.getElementById("imcTarOk").addEventListener("click", () => {
      const N = {};
      body().querySelectorAll("[data-tp]").forEach((el) => { const id = el.dataset.tp, z = body().querySelector("[data-tz=\"" + id + "\"]").value.trim(); if (el.value.trim() || z) N[id] = { precio: el.value.trim(), plazo: z }; });
      const cond = document.getElementById("imcCond").value.trim(); if (cond) N._condiciones = cond;
      lsSet(LS_TAR, N); alert("Tarifas guardadas. Se aplican a documentos nuevos o al generar una nueva versión.");
    });
  }

  const pub = { analizar, armarDoc, mensajesWA, htmlDiagnostico, htmlPropuesta, controlCalidad, rubroDe, SERVICIOS, ESTADOS, estadoLabel, render, DOC_CSS, total };
  if (typeof window !== "undefined") window.impulsaComercial = pub;
  if (typeof module !== "undefined" && module.exports) module.exports = pub;
})();
