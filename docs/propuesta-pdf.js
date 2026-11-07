/* Propuesta comercial en PDF con la plantilla FINAL aprobada (CRECIMIENTO COMERCIAL, 12 páginas).
 * Toma el diagnóstico existente (analizar + armarDoc de impulsa-comercial.js) SIN modificarlo y escribe
 * los datos del negocio sobre docs/propuesta/plantilla-base.pdf (la plantilla final con los textos variables
 * quitados; ver docs/propuesta/construir_plantilla.py). Colores, degradados, tipografías, composición,
 * enlaces y bloques fijos (Carlos Serrano, caso y testimonio Contreras, fuentes institucionales, cierre por
 * WhatsApp) quedan exactamente como en la plantilla. Texto seleccionable y enlaces clicables.
 * Reglas: no inventa reseñas, tratamientos, funciones ni resultados; no afirma que no hay web por no verla
 * vinculada; si ya existe web o agenda, adapta la oferta sin reemplazar lo que funciona; la inversión es siempre $400.000 (2 x $200.000). */
(function (root) {
  "use strict";
  const PRECIO_BASE = { total: "$400.000", etapas: "Dos etapas de $200.000" };
  const WA = "5491168713479";

  function terminos(rubId) {
    const salud = rubId === "salud";
    return {
      lugar: salud ? "consultorio" : rubId === "legal" ? "estudio" : "negocio",
      personas: salud ? "pacientes" : "clientes",
      persona: salud ? "paciente" : "cliente",
      oferta: salud ? "tratamientos" : "servicios",
      turno: salud || rubId === "belleza" ? "turno" : "consulta",
      unTurno: salud || rubId === "belleza" ? "un turno" : "una consulta",
      atenderse: salud ? "dónde atenderse" : "a quién contactar",
    };
  }
  const fmtRating = (n) => Number(n).toFixed(1).replace(".", ",");
  const fmtNum = (n) => Number(n).toLocaleString("es-AR");
  const dominio = (u) => String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  /* info: { nombre, rubId, rating, resenas, webUrl, tieneWeb, agendaOk } -> textos por slot */
  function textos(info) {
    const t = terminos(info.rubId);
    const L = t.lugar;
    const hayRep = info.rating != null && info.resenas != null;
    const rep = hayRep ? fmtRating(info.rating) + " estrellas y " + fmtNum(info.resenas) + " reseñas" : "";
    const completo = !info.tieneWeb && !info.agendaOk; // paquete base acordado
    const S = {};
    const nom = String(info.nombre || "Su " + L).trim();
    S.pie = nom.toLocaleUpperCase("es-AR");
    const pal = nom.split(/\s+/);
    const corte = pal.length <= 1 ? 1 : Math.ceil(pal.length / 2);
    S.p1_nombre_1 = pal.slice(0, corte).join(" ");
    S.p1_nombre_2 = pal.slice(corte).join(" ");
    S.p1_estrategia = "ESTRATEGIA PARA SU " + L.toUpperCase();
    S.p2_rating = hayRep ? fmtRating(info.rating) : "—";
    S.p2_rating_txt = hayRep ? "estrellas en Google Maps" : "calificación no disponible";
    S.p2_resenas = hayRep ? fmtNum(info.resenas) : "—";
    S.p2_resenas_txt = "reseñas\nde " + t.personas;
    S.p2_obs1 = hayRep
      ? `Su ${L} cuenta con una fortaleza comercial: ${rep} de ${t.personas} en Google Maps. Esa reputación ofrece una base de confianza para quienes están evaluando ${t.atenderse}.`
      : `Su ${L} ya figura en Google Maps, el lugar donde muchas personas buscan ${t.atenderse}. Esa presencia es una base para generar confianza.`;
    if (info.webUrl && info.agendaOk) S.p2_obs2 = `En la ficha analizada encontramos su web (${dominio(info.webUrl)}) y una agenda online. Son una buena base: la propuesta parte de lo que ya funciona.`;
    else if (info.webUrl) S.p2_obs2 = `En la ficha analizada encontramos su web (${dominio(info.webUrl)}), pero no pudimos verificar una agenda online. Esto no implica que no existan otros canales de atención.`;
    else if (info.tieneWeb) S.p2_obs2 = `Nos indicaron que su ${L} cuenta con una web, que revisaremos con usted. No pudimos verificar una agenda online; esto no implica que no existan otros canales.`;
    else S.p2_obs2 = "En la ficha analizada no encontramos una web vinculada ni pudimos verificar una agenda online. Esto no implica que no existan otros canales de atención.";
    S.p2_oportunidad = `La oportunidad es unir esa confianza con información clara y un acceso sencillo para solicitar ${t.unTurno}.`;
    S.p3_sub = `Su reputación en Google Maps puede ser el primer paso para atraer nuevos ${t.personas}.`;
    if (!hayRep) S.p3_sub = `Su presencia en Google Maps puede ser el primer paso para atraer nuevos ${t.personas}.`;
    S.p3_paso3 = "Solicitar " + t.turno;
    S.p3_texto = (hayRep ? `Sus ${rep} generan confianza. ` : "") +
      (info.tieneWeb ? "Su web puede acompañar" : "Una web propia permite acompañar") +
      ` esa primera impresión con información sobre ${t.oferta}, profesionales y el ${L}, y un acceso directo para solicitar ${t.unTurno}.`;
    S.p4_seccion = "03 — EXPERIENCIA DEL " + t.persona.toUpperCase();
    S.p4_titulo = t.turno === "turno" ? "Facilitar el turno," : "Facilitar la consulta,";
    S.p4_s1 = `Una persona encuentra su ${L} en Google Maps.`;
    S.p4_s2 = `En su web, conoce sus ${t.oferta} y el ${L}.`;
    S.p4_s4 = `Su equipo revisa la solicitud y confirma ${t.turno === "turno" ? "el turno" : "la consulta"}.`;
    S.p4_247 = `La confirmación queda en manos del ${L}.`;
    S.p5_texto = `La presencia web está extendida entre las empresas relevadas. Para su ${L}, una página propia permite reunir ${t.oferta}, profesionales y medios de contacto en un mismo lugar.`;
    S.p6_texto = "Los turnos online forman parte de los hábitos de atención relevados. Incorporar una agenda en su web facilita que las personas elijan un día y horario y envíen su solicitud.";
    S.p7_texto = `Las empresas consultadas destacan el aporte de las herramientas de Meta a sus ingresos. La publicidad puede incorporarse como una etapa adicional para dar visibilidad a los ${t.oferta} del ${L}.`;
    S.p8_s2 = (info.tieneWeb ? "Ajustamos la web acordada" : "Creamos la web") + (info.agendaOk ? ` e integramos la agenda actual según el funcionamiento del ${L}.` : ` y configuramos la agenda según el funcionamiento del ${L}.`);
    S.p11_titulo = "para su " + L + ".";
    S.p12_t2 = "Cuéntenos sobre su " + L;
    if (completo) {
      S.p11_intro = `Proponemos integrar una web profesional y una agenda digital para que las personas conozcan sus ${t.oferta} y soliciten atención desde un mismo lugar. La implementación incluye la puesta en marcha y el mantenimiento de la información durante 24 meses.`;
      S.p11_web = `Web profesional adaptada a celulares. ${cap(t.oferta)}, equipo, fotografías y valoraciones autorizadas; mapa y contacto. Dominio .com por 2 años, a definir según disponibilidad.`;
      S.p11_agenda = `Agenda de solicitudes 24/7. Elección de día y horario disponible, con confirmación del ${L}. Configuración, pruebas y puesta en marcha.`;
      S.p11_total = PRECIO_BASE.total;
      S.p11_etapas = PRECIO_BASE.etapas;
      S.p12_s4 = "$200.000 para iniciar el desarrollo y $200.000 al finalizar, una vez revisados los entregables y dados de alta los servicios acordados.";
    } else {
      S.p11_intro = info.agendaOk
        ? `Su ${L} ya cuenta con herramientas en funcionamiento. Proponemos revisarlas con usted y mejorar solo lo que haga falta para que las personas conozcan sus ${t.oferta} y soliciten atención con facilidad.`
        : `Proponemos aprovechar su web actual y sumar una agenda digital para que las personas soliciten atención desde un mismo lugar. Revisamos juntos qué conviene integrar o mejorar, sin reemplazar lo que ya funciona.`;
      S.p11_web = `Revisión de su web actual${info.webUrl ? " (" + dominio(info.webUrl) + ")" : ""}: ajustes acordados en ${t.oferta}, contacto y versión para celulares, sin reemplazar lo que ya funciona.`;
      S.p11_agenda = info.agendaOk
        ? `Agenda: se mantiene la que ya utiliza; revisamos cómo facilitar el acceso desde la web y Google Maps.`
        : `Agenda de solicitudes 24/7. Elección de día y horario disponible, con confirmación del ${L}. Configuración, pruebas y puesta en marcha.`;
      /* Decisión de Carlos: web + agenda digital = $400.000 por 2 años en todos los casos. */
      S.p11_total = PRECIO_BASE.total;
      S.p11_etapas = PRECIO_BASE.etapas;
      S.p12_s4 = "$200.000 para iniciar el desarrollo y $200.000 al finalizar, una vez revisados los entregables y dados de alta los servicios acordados.";
    }
    S.p11_acomp = "Acompañamiento semanal durante el primer mes. 24 meses de mantenimiento y actualización de datos.";
    S.waTexto = `Hola, recibí la propuesta de Crecimiento Comercial para mi ${L} y me interesa avanzar. Quisiera recibir el formulario y coordinar los próximos pasos`;
    S.completo = completo;
    return S;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function hex(rgb, c) { const n = parseInt(c.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
  function envolver(font, txt, size, ancho) {
    const out = [];
    String(txt).split("\n").forEach((par) => {
      let linea = "";
      par.split(/\s+/).filter(Boolean).forEach((w) => {
        const prueba = linea ? linea + " " + w : w;
        if (linea && font.widthOfTextAtSize(prueba, size) > ancho) { out.push(linea); linea = w; } else linea = prueba;
      });
      out.push(linea);
    });
    return out;
  }

  /* deps: { PDFLib, fontkit, base (bytes), slots (json), sans (bytes), italic (bytes) } */
  async function generar(info, deps) {
    const { PDFDocument, rgb, PDFName, PDFString } = deps.PDFLib;
    const pdf = await PDFDocument.load(deps.base);
    pdf.registerFontkit(deps.fontkit);
    const F = { sans: await pdf.embedFont(deps.sans, { subset: false }), italic: await pdf.embedFont(deps.italic, { subset: false }) };
    const S = textos(info);
    const pages = pdf.getPages();
    const avisos = [];
    deps.slots.slots.forEach((s) => {
      const txt = S[s.id];
      if (txt == null || txt === "") return;
      const font = F[s.font];
      let size = s.size, lead = s.leading, lineas = envolver(font, txt, size, s.width);
      const maxL = s.id === "p2_resenas_txt" ? 2 : Math.max(s.lines, s.lines === 1 ? 1 : s.lines);
      while ((lineas.length > maxL || lineas.some((l) => font.widthOfTextAtSize(l, size) > s.width)) && size > s.size * 0.6) {
        size *= 0.95; lead *= 0.95; lineas = envolver(font, txt, size, s.width);
      }
      if (lineas.length > maxL) avisos.push("Texto largo en " + s.id);
      lineas.forEach((l, i) => pages[s.page].drawText(l, { x: s.x, y: s.y - i * lead, size, font, color: hex(rgb, s.color) }));
    });
    // Mensaje preparado de WhatsApp (página 12) según el rubro; mismo número aprobado.
    const p12 = pages[11];
    const annots = p12.node.Annots();
    if (annots) for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i); const act = a && a.lookup(PDFName.of("A"));
      if (act && act.lookup(PDFName.of("URI"))) act.set(PDFName.of("URI"), PDFString.of("https://wa.me/" + WA + "?text=" + encodeURIComponent(S.waTexto)));
    }
    pdf.setTitle("Propuesta comercial · " + (info.nombre || ""));
    pdf.setAuthor("Crecimiento Comercial · Carlos Serrano");
    pdf.setProducer("Fábrica de Prospectos"); pdf.setCreator("Fábrica de Prospectos");
    return { bytes: await pdf.save(), completo: S.completo, avisos };
  }

  /* Datos mínimos que la plantilla necesita, leídos del diagnóstico ya generado (no lo modifica). */
  function infoDesde(an, doc) {
    return { nombre: (doc && doc.negocio) || an.nombre, rubId: an.rub.id, rating: an.rating, resenas: an.resenas,
      webUrl: an.webUrl, tieneWeb: !!an.tieneWeb, agendaOk: !!(an.ver && an.ver.agenda === "si") || an.hechos.comprobado.some((h) => /^Sistema de turnos online:/.test(h)) };
  }

  /* Navegador: carga pdf-lib + fontkit (CDN) y los archivos de docs/propuesta/, descarga el PDF. */
  const CDN = ["https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js", "https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js"];
  function cargarScript(src) { return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src)); document.head.appendChild(s); }); }
  async function descargar(info, nombreArchivo) {
    if (!root.PDFLib) await cargarScript(CDN[0]);
    if (!root.fontkit) await cargarScript(CDN[1]);
    /* Los binarios están en base64 (*.b64) porque el repo se actualiza con un conector que solo admite texto. */
    const get = async (u, json) => { const r = await fetch(u, { cache: "force-cache" }); if (!r.ok) throw new Error("No se pudo leer " + u); if (json) return r.json(); const b = atob((await r.text()).trim()); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; };
    const [base, slots, sans, italic] = await Promise.all([get("propuesta/plantilla-base.pdf.b64"), get("propuesta/plantilla-slots.json", true), get("propuesta/Inter-Regular.ttf.b64"), get("propuesta/Cormorant-LightItalic.ttf.b64")]);
    const res = await generar(info, { PDFLib: root.PDFLib, fontkit: root.fontkit, base, slots, sans, italic });
    const blob = new Blob([res.bytes], { type: "application/pdf" });
    const file = typeof File !== "undefined" ? new File([blob], nombreArchivo, { type: "application/pdf" }) : null;
    try { if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ files: [file], title: nombreArchivo }); return res; } } catch (x) { /* se cancela o no se puede: se descarga */ }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombreArchivo; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return res;
  }

  const api = { textos, generar, infoDesde, descargar, PRECIO_BASE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.impulsaPropuestaPDF = api;
})(typeof window !== "undefined" ? window : globalThis);
