/* Propuesta comercial en PDF con la plantilla FINAL aprobada (CRECIMIENTO COMERCIAL, 12 páginas).
 * Usa el diagnóstico ya existente (analizar + documento de impulsa-comercial.js) y escribe solo los
 * textos variables sobre docs/propuesta/plantilla-base.pdf. No copia el caso Núñez: nombre, calificación,
 * reseñas, web, agenda e interpretación salen de ESE diagnóstico. Si el dato no está, no se afirma que
 * falte. Si ya hay web o agenda, la oferta no las reemplaza y no inventa un precio parcial: la base
 * sigue en $400.000 (dos etapas de $200.000) cuando corresponde esa implementación.
 * Bloques fijos de la plantilla (Carlos Serrano, caso y testimonio Contreras, fuentes, publicidad
 * opcional) no se redibujan. Texto seleccionable y enlaces clicables. */
(function (root) {
  "use strict";
  const PRECIO_BASE = { total: "$400.000", etapas: "Dos etapas de $200.000" };
  const WA = "5491168713479";
  const P11_ACOMP = "Acompañamiento semanal durante el primer mes. 24 meses de mantenimiento y actualización de datos.";
  const P12_PAGO = "$200.000 para iniciar el desarrollo y $200.000 al finalizar, una vez revisados los entregables y dados de alta los servicios acordados.";

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
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
  function minus(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : ""; }
  function unaLinea(s) { return String(s || "").replace(/\s+/g, " ").trim().replace(/\.$/, ""); }

  function partirNombre(nom, etiqueta) {
    const pal = String(nom || "").trim().split(/\s+/).filter(Boolean);
    if (!pal.length) return { a: "Propuesta", b: "comercial" };
    if (pal.length === 1) {
      const eti = unaLinea(etiqueta);
      return { a: eti || "Propuesta comercial", b: pal[0] };
    }
    const corte = Math.ceil(pal.length / 2);
    return { a: pal.slice(0, corte).join(" "), b: pal.slice(corte).join(" ") };
  }

  function obs1(info, t) {
    const hay = info.rating != null && info.resenas != null;
    if (!hay) return `Su ${t.lugar} ya figura en Google Maps, donde muchas personas buscan ${t.atenderse}. El diagnóstico no trae una calificación pública para citar.`;
    const rep = fmtRating(info.rating) + " estrellas y " + fmtNum(info.resenas) + " reseñas";
    if (Number(info.rating) >= 4.5 && Number(info.resenas) >= 20) {
      return `Su ${t.lugar} cuenta con una fortaleza comercial: ${rep} de ${t.personas} en Google Maps. Esa reputación ofrece una base de confianza para quienes están evaluando ${t.atenderse}.`;
    }
    if (Number(info.rating) < 4.2 && Number(info.resenas) >= 10) {
      return `En Google Maps su ${t.lugar} muestra ${rep} de ${t.personas}. Es la calificación pública que ve quien evalúa ${t.atenderse}, y el diagnóstico la marca como mejorable.`;
    }
    return `En Google Maps su ${t.lugar} muestra ${rep} de ${t.personas}. Esa es la calificación pública que ve quien está evaluando ${t.atenderse}.`;
  }

  function obs2(info, t) {
    const web = info.webUrl ? `su web (${dominio(info.webUrl)})` : "una web que nos indicaron";
    if (info.webAusente && info.agendaAusente) return `Se verificó que no hay un sitio web propio ni agenda online. La confirmación de cada solicitud queda en el ${t.lugar}.`;
    if (info.webAusente && info.agendaOk) return "Se verificó que no hay un sitio web propio. Sí hay agenda online: la propuesta la conserva y no da por sentado otros faltantes.";
    if (info.webAusente) return "Se verificó que no hay un sitio web propio. No pudimos verificar una agenda online; eso no afirma que no existan otros canales.";
    if (info.tieneWeb && info.agendaOk) return `En la ficha analizada encontramos ${web} y una agenda online. Son una buena base: la propuesta parte de lo que ya funciona.`;
    if (info.tieneWeb && info.agendaAusente) return `En la ficha analizada encontramos ${web}. Se verificó que no hay agenda online. No proponemos reemplazar la web.`;
    if (info.tieneWeb) return `En la ficha analizada encontramos ${web}, pero no pudimos verificar una agenda online. Esto no implica que no existan otros canales de atención.`;
    if (info.agendaOk) return `En la ficha analizada no encontramos una web vinculada. Sí hay una agenda online, que se toma como base. No afirmamos que no exista una web por no verla.`;
    if (info.agendaAusente) return "En la ficha analizada no encontramos una web vinculada. Se verificó que no hay agenda online. Esto no descarta otros canales de contacto.";
    return "En la ficha analizada no encontramos una web vinculada ni pudimos verificar una agenda online. Esto no implica que no existan otros canales de atención.";
  }

  function oportunidad(info, t) {
    const top = (info.oportunidades || [])[0];
    if (!top || !unaLinea(top.titulo)) return `Con los datos verificados no hay una brecha concreta. Conviene confirmarla con el ${t.lugar} antes de ofrecer algo de más.`;
    const titulo = unaLinea(top.titulo);
    return "La oportunidad que muestra el diagnóstico: " + minus(titulo) + ".";
  }

  function p3texto(info, t) {
    const hay = info.rating != null && info.resenas != null;
    const rep = hay ? `Sus ${fmtRating(info.rating)} estrellas y ${fmtNum(info.resenas)} reseñas generan confianza. ` : "No hay una calificación pública para citar. ";
    const medio = info.tieneWeb ? "Su web actual puede acompañar esa primera impresión" : "Una web propia permite acompañar esa primera impresión";
    const detalle = t.oferta === "tratamientos" ? `${t.oferta}, profesionales y el ${t.lugar}` : `${t.oferta} y el ${t.lugar}`;
    return `${rep}${medio} con información sobre ${detalle}, y un acceso directo para solicitar ${t.unTurno}.`;
  }

  function p5(info, t) {
    const base = "La presencia web está extendida entre las empresas relevadas. ";
    const det = t.oferta === "tratamientos" ? "tratamientos, profesionales" : t.oferta;
    if (info.tieneWeb) {
      const dom = info.webUrl ? " (" + dominio(info.webUrl) + ")" : "";
      return base + `Su ${t.lugar} ya tiene sitio${dom}: la propuesta lo toma como base y no lo reemplaza.`;
    }
    if (info.webAusente) return base + `Se verificó que su ${t.lugar} no tiene sitio propio. Una página permitiría reunir ${det} y medios de contacto.`;
    return base + `Para su ${t.lugar}, una página propia permite reunir ${det} y medios de contacto en un mismo lugar.`;
  }

  function p6(info, t) {
    if (info.agendaOk) return `Los turnos online forman parte de los hábitos de atención relevados. Su ${t.lugar} ya tiene agenda: se mantiene y se facilita el acceso desde la web y Google Maps.`;
    if (info.agendaAusente && info.usaAgenda) return `Los turnos online forman parte de los hábitos de atención relevados. Se verificó que no hay agenda online. Se puede sumar una de solicitudes, con confirmación del ${t.lugar}.`;
    if (!info.usaAgenda) return `Ese relevamiento es una referencia de hábitos digitales. Para su ${t.lugar} la propuesta facilita una solicitud de contacto, sin tratarla como turno médico ni prometer resultados.`;
    if (info.agendaAusente) return `Los turnos online forman parte de los hábitos de atención relevados. Se verificó que no hay agenda online. La confirmación de cada solicitud queda en el ${t.lugar}.`;
    return `Los turnos online forman parte de los hábitos de atención relevados. No pudimos verificar una agenda en su ${t.lugar}. Si no la tienen, incorporarla permite elegir día y horario y enviar la solicitud.`;
  }

  function p7(info, t) {
    if (info.ads === "si") return `Las empresas consultadas destacan el aporte de las herramientas de Meta a sus ingresos. En su ${t.lugar} ya hay anuncios verificados: la publicidad sigue aparte, con presupuesto a acordar.`;
    if (info.ads === "no") return "Las empresas consultadas destacan el aporte de las herramientas de Meta a sus ingresos. No vimos anuncios activos. Puede sumarse después, aparte del presupuesto, sin prometer resultados.";
    return `Las empresas consultadas destacan el aporte de las herramientas de Meta a sus ingresos. La publicidad puede incorporarse como una etapa adicional para dar visibilidad a los ${t.oferta} del ${t.lugar}.`;
  }

  function p8(info, t) {
    const web = info.tieneWeb ? "Ajustamos la web acordada" : "Creamos la web";
    const ag = info.agendaOk ? ` e integramos la agenda que ya usa el ${t.lugar}.` : ` y configuramos la agenda según el funcionamiento del ${t.lugar}.`;
    return web + ag;
  }

  function introOferta(info, t) {
    const mant = "La implementación incluye la puesta en marcha y el mantenimiento de la información durante 24 meses.";
    if (info.tieneWeb && info.agendaOk) return `Su ${t.lugar} ya cuenta con web y agenda. Proponemos revisarlas con usted y mejorar solo lo necesario para que las personas conozcan sus ${t.oferta} y envíen su solicitud, sin reemplazar lo que funciona. ${mant}`;
    if (info.tieneWeb) return `Proponemos aprovechar su web actual y sumar una agenda digital para que las personas soliciten atención desde un mismo lugar. Revisamos juntos qué conviene integrar, sin reemplazar lo que ya funciona. ${mant}`;
    if (info.agendaOk) return `Su ${t.lugar} ya cuenta con agenda. Proponemos una web profesional conectada con ese sistema para que conozcan sus ${t.oferta} y soliciten atención, sin cambiar lo que ya usan. ${mant}`;
    return `Proponemos integrar una web profesional y una agenda digital para que las personas conozcan sus ${t.oferta} y soliciten atención desde un mismo lugar. ${mant}`;
  }

  function lineaWeb(info, t) {
    if (info.tieneWeb) {
      const dom = info.webUrl ? " (" + dominio(info.webUrl) + ")" : "";
      return `Revisión de su web actual${dom}: ajustes acordados en ${t.oferta}, contacto y versión para celulares, sin reemplazar lo que ya funciona.`;
    }
    const det = t.oferta === "tratamientos"
      ? "Tratamientos, equipo, fotografías y valoraciones autorizadas; mapa y contacto."
      : cap(t.oferta) + ", equipo, fotografías y datos de contacto; mapa y contacto.";
    return `Web profesional adaptada a celulares. ${det} Dominio .com por 2 años, a definir según disponibilidad.`;
  }

  function lineaAgenda(info, t) {
    if (info.agendaOk) return `Agenda: se mantiene la que ya utiliza. Revisamos cómo facilitar el acceso desde la web y Google Maps. La confirmación sigue en el ${t.lugar}.`;
    return `Agenda de solicitudes 24/7. Elección de día y horario disponible, con confirmación del ${t.lugar}. Configuración, pruebas y puesta en marcha.`;
  }

  /* info: salida de infoDesde. Arma los textos de los slots variables. */
  function textos(info) {
    const t = terminos(info.rubId);
    const hayRep = info.rating != null && info.resenas != null;
    const completo = !info.tieneWeb && !info.agendaOk;
    const S = {};
    const nom = String(info.nombre || "Su " + t.lugar).trim();
    const partes = partirNombre(nom, info.rubroEtiqueta);
    S.pie = nom.toLocaleUpperCase("es-AR");
    S.p1_nombre_1 = partes.a;
    S.p1_nombre_2 = partes.b;
    S.p1_estrategia = "ESTRATEGIA PARA SU " + t.lugar.toUpperCase();
    S.p2_rating = hayRep ? fmtRating(info.rating) : "—";
    S.p2_rating_txt = hayRep ? "estrellas en Google Maps" : "calificación no disponible";
    S.p2_resenas = hayRep ? fmtNum(info.resenas) : "—";
    S.p2_resenas_txt = "reseñas\nde " + t.personas;
    S.p2_obs1 = obs1(info, t);
    S.p2_obs2 = obs2(info, t);
    S.p2_oportunidad = oportunidad(info, t);
    S.p3_sub = hayRep
      ? `Su reputación en Google Maps puede ser el primer paso para atraer nuevos ${t.personas}.`
      : `Su presencia en Google Maps puede ser el primer paso para atraer nuevos ${t.personas}.`;
    S.p3_paso3 = t.turno === "turno" ? "Solicitar turno" : "Solicitar consulta";
    S.p3_texto = p3texto(info, t);
    S.p4_seccion = "03 — EXPERIENCIA DEL " + t.persona.toUpperCase();
    S.p4_titulo = t.turno === "turno" ? "Facilitar el turno," : "Facilitar la consulta,";
    S.p4_s1 = `Una persona encuentra su ${t.lugar} en Google Maps.`;
    S.p4_s2 = (info.tieneWeb ? "En su web actual, conoce sus " : "En su web, conoce sus ") + `${t.oferta} y el ${t.lugar}.`;
    S.p4_s4 = `Su equipo revisa la solicitud y confirma ${t.turno === "turno" ? "el turno" : "la consulta"}.`;
    S.p4_247 = `La confirmación queda en manos del ${t.lugar}.`;
    S.p5_texto = p5(info, t);
    S.p6_texto = p6(info, t);
    S.p7_texto = p7(info, t);
    S.p8_s2 = p8(info, t);
    S.p11_titulo = "para su " + t.lugar + ".";
    S.p11_intro = introOferta(info, t);
    S.p11_web = lineaWeb(info, t);
    S.p11_agenda = lineaAgenda(info, t);
    S.p11_acomp = P11_ACOMP;
    S.p11_total = PRECIO_BASE.total;
    S.p11_etapas = PRECIO_BASE.etapas;
    S.p12_t2 = "Cuéntenos sobre su " + t.lugar;
    S.p12_s4 = P12_PAGO;
    S.waTexto = `Hola, recibí la propuesta de Crecimiento Comercial para mi ${t.lugar} y me interesa avanzar. Quisiera recibir el formulario y coordinar los próximos pasos`;
    S.completo = completo;
    S.oferta = info.tieneWeb && info.agendaOk ? "con_web_y_agenda" : info.tieneWeb ? "con_web" : info.agendaOk ? "con_agenda" : "base";
    return S;
  }

  function hex(rgb, c) { const n = parseInt(c.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
  function envolver(font, txt, size, ancho) {
    const out = [];
    String(txt).split("\n").forEach((par) => {
      let linea = "";
      par.split(/\s+/).filter(Boolean).forEach((w) => {
        const prueba = linea ? linea + " " + w : w;
        if (linea && font.widthOfTextAtSize(prueba, size) > ancho) { out.push(linea); linea = w; } else linea = prueba;
      });
      if (linea) out.push(linea);
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
      const maxL = s.lines;
      while ((lineas.length > maxL || lineas.some((l) => font.widthOfTextAtSize(l, size) > s.width + 0.5)) && size > s.size * 0.72) {
        size *= 0.96; lead *= 0.96; lineas = envolver(font, txt, size, s.width);
      }
      if (lineas.length > maxL) {
        avisos.push("Texto largo en " + s.id);
        lineas = lineas.slice(0, maxL);
      }
      lineas.forEach((l, i) => pages[s.page].drawText(l, { x: s.x, y: s.y - i * lead, size, font, color: hex(rgb, s.color) }));
    });
    const p12 = pages[11];
    const annots = p12.node.Annots();
    if (annots) for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i); const act = a && a.lookup(PDFName.of("A"));
      if (act && act.lookup(PDFName.of("URI"))) act.set(PDFName.of("URI"), PDFString.of("https://wa.me/" + WA + "?text=" + encodeURIComponent(S.waTexto)));
    }
    pdf.setTitle("Propuesta comercial · " + (info.nombre || ""));
    pdf.setAuthor("Crecimiento Comercial · Carlos Serrano");
    pdf.setProducer("Fábrica de Prospectos"); pdf.setCreator("Fábrica de Prospectos");
    return { bytes: await pdf.save(), completo: S.completo, oferta: S.oferta, avisos, textos: S };
  }

  /* Datos que la plantilla necesita, leídos del diagnóstico ya generado. No lo modifica. */
  function infoDesde(an, doc) {
    const ver = (an && an.ver) || {};
    const hechos = (an && an.hechos && an.hechos.comprobado) || [];
    const opsSrc = doc && Array.isArray(doc.oportunidades) ? doc.oportunidades : ((an && an.oportunidades) || []);
    const ops = opsSrc.filter((o) => o && o.activo !== false).map((o) => ({
      id: o.id || "", titulo: o.titulo || "", tipo: o.tipo || "", observamos: o.observamos || "",
    }));
    return {
      nombre: (doc && doc.negocio) || (an && an.nombre) || "",
      rubroEtiqueta: (doc && doc.rubro) || "",
      rubId: an && an.rub ? an.rub.id : "general",
      usaAgenda: !!(an && an.rub && an.rub.usaAgenda),
      rating: an ? an.rating : null,
      resenas: an ? an.resenas : null,
      webUrl: (an && an.webUrl) || null,
      tieneWeb: !!(an && an.tieneWeb),
      webAusente: ver.tiene_web === "no",
      agendaOk: ver.agenda === "si" || hechos.some((h) => /^Sistema de turnos online:/.test(h)),
      agendaAusente: ver.agenda === "no",
      ads: ver.ads === "si" || ver.ads === "no" ? ver.ads : null,
      nivel: (doc && doc.nivel) || (an && an.nivel) || "preliminar",
      fortalezas: (doc && doc.fortalezas) || (an && an.fortalezas) || [],
      oportunidades: ops,
    };
  }

  const CDN = ["https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js", "https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js"];
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }
  function desdeB64(texto) {
    const limpio = String(texto || "").replace(/\s+/g, "");
    let b;
    try { b = atob(limpio); } catch (e) { throw new Error("No se pudo decodificar un archivo de la plantilla (base64)."); }
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  }
  async function descargar(info, nombreArchivo) {
    if (!root.PDFLib) await cargarScript(CDN[0]);
    if (!root.fontkit) await cargarScript(CDN[1]);
    if (!root.PDFLib || !root.fontkit) throw new Error("pdf-lib o fontkit no quedaron disponibles después de cargarlos.");
    const get = async (u, json) => {
      const r = await fetch(u, { cache: "default" });
      if (!r.ok) throw new Error("No se pudo leer " + u + " (HTTP " + r.status + ")");
      if (json) return r.json();
      return desdeB64(await r.text());
    };
    const [base, slots, sans, italic] = await Promise.all([
      get("propuesta/plantilla-base.pdf.b64"),
      get("propuesta/plantilla-slots.json", true),
      get("propuesta/Inter-Regular.ttf.b64"),
      get("propuesta/Cormorant-LightItalic.ttf.b64"),
    ]);
    const res = await generar(info, { PDFLib: root.PDFLib, fontkit: root.fontkit, base, slots, sans, italic });
    const blob = new Blob([res.bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    let file = null;
    try { file = new File([blob], nombreArchivo, { type: "application/pdf" }); } catch (x) { file = null; }
    const a = document.createElement("a");
    a.href = url; a.download = nombreArchivo;
    document.body.appendChild(a); a.click(); a.remove();
    res.url = url; res.file = file; res.nombre = nombreArchivo; res.blob = blob;
    return res;
  }

  const api = { textos, generar, infoDesde, descargar, PRECIO_BASE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.impulsaPropuestaPDF = api;
})(typeof window !== "undefined" ? window : globalThis);
