/**
 * Puntuación comercial IMPULSA (0-100) + confianza (0-100).
 * Diseño propio de IMPULSA. NO deriva de calculate_lead_score (leadhunter) ni del
 * scoring de maps-lead-gen: NUNCA se suman puntos por no tener web.
 *
 * Componentes (máx):
 *   reputacion        30  rating y volumen de reseñas (Maps)
 *   actividad         15  señales de negocio activo y contactable (teléfono, reseñas)
 *   presencia_digital 20  redes/emails/sitio detectados (solo lo comprobado/estimado)
 *   calidad_web       15  si hay web: https, viewport, status, velocidad. Sin web → no se puntúa
 *                         y su peso se redistribuye proporcionalmente (no premia ni castiga).
 *   oportunidades     20  servicios concretos que IMPULSA puede ofrecer (agenda, web, formularios...).
 *                         Se usan como oportunidad, no como castigo.
 *
 * Bandas: 85-100 excelente · 70-84 alta · 50-69 media · <50 baja.
 */

const val = (d) => (d && d.tipo !== "no_disponible" ? d.valor : null);

export function banda(score) {
  if (score >= 85) return { id: "excelente", label: "Oportunidad excelente (85-100)" };
  if (score >= 70) return { id: "alta", label: "Oportunidad alta (70-84)" };
  if (score >= 50) return { id: "media", label: "Oportunidad media (50-69)" };
  return { id: "baja", label: "Oportunidad baja (<50)" };
}

export function puntuar(inv) {
  const motivos = [];
  const problemas = [];
  const servicios = [];
  let conocidos = 0;
  let totalCampos = 0;
  const cuenta = (d) => { totalCampos++; if (d && d.tipo !== "no_disponible") conocidos++; };

  // Reputación (30)
  const rating = val(inv.rating);
  const resenas = val(inv.resenas);
  cuenta(inv.rating); cuenta(inv.resenas);
  let rep = 0;
  if (rating != null) rep += Math.max(0, Math.min(15, ((rating - 3) / 2) * 15));
  if (resenas != null) rep += Math.min(15, (Math.log10(resenas + 1) / Math.log10(301)) * 15);
  if (rating != null && rating >= 4.5) motivos.push(`Excelente reputación (${rating}★)`);
  if (resenas != null && resenas >= 50) motivos.push(`${resenas} reseñas: demanda real`);

  // Actividad (15)
  cuenta(inv.telefono);
  let act = 0;
  if (val(inv.telefono)) act += 6;
  if (val(inv.whatsapp)) act += 3;
  if (resenas != null) act += Math.min(6, resenas / 20);
  if (!val(inv.telefono)) problemas.push("Sin teléfono visible en Maps");

  // Presencia digital (20)
  const redes = Object.keys(inv.redes || {});
  const tieneWeb = inv.website && inv.website.tipo === "comprobado";
  cuenta(inv.website);
  let pres = Math.min(12, redes.length * 4);
  if (val(inv.emails)) pres += 4;
  if (tieneWeb) pres += 4;
  if (redes.length) motivos.push("Redes detectadas: " + redes.join(", "));

  // Calidad web (15) — solo si existe
  let calidad = null;
  const cw = val(inv.calidad_web);
  if (tieneWeb && cw) {
    calidad = 0;
    if (cw.status >= 200 && cw.status < 400) calidad += 4;
    if (cw.https) calidad += 3; else problemas.push("El sitio no usa HTTPS");
    if (cw.viewport) calidad += 3; else problemas.push("El sitio no declara viewport móvil (posible mala vista en celular)");
    if (cw.tiempo_ms != null && cw.tiempo_ms < 2500) calidad += 3; else problemas.push(`Respuesta lenta del sitio (${cw.tiempo_ms} ms en un fetch)`);
    if (cw.tiene_meta_description) calidad += 2; else problemas.push("Sin meta description (SEO básico)");
  }

  // Oportunidades (20) — se suman como oportunidad
  let opp = 0;
  const agenda = inv.agenda;
  if (!tieneWeb) {
    // Se recomienda el servicio, pero NO suma puntos: no tener web nunca aumenta el puntaje.
    servicios.push("Sitio web profesional con asistente de turnos 24 h");
  }
  if (!(agenda && agenda.valor && agenda.tipo === "comprobado")) {
    servicios.push("Agenda online / turnos automáticos");
    // Solo suma si hay web verificada sin agenda; sin web el dato es no_disponible y no suma.
    if (tieneWeb) opp += 6;
  }
  if (tieneWeb && cw && (!cw.viewport || !cw.https || cw.tiempo_ms >= 2500)) {
    servicios.push("Rediseño o mejora técnica del sitio (móvil, HTTPS, velocidad)");
    opp += 4;
  }
  if (!redes.length) {
    servicios.push("Gestión de redes / presencia digital");
    opp += 3;
  }
  const form = val(inv.formulario);
  if (tieneWeb && form && !form.contacto) {
    servicios.push("Formulario de contacto / captación de leads");
    opp += 2;
  }
  servicios.push("Revisar anuncios en Meta Ads Library (link en la ficha)");
  opp = Math.min(20, opp);
  // Oportunidad sólo vale si el negocio tiene tracción: sin reputación, se atenúa.
  const traccion = rating != null && resenas != null ? Math.min(1, (rating >= 4 ? 0.5 : 0.2) + Math.min(0.5, resenas / 100)) : 0.3;
  opp = opp * traccion;

  // Redistribución si no hay web: los 15 de calidad se reparten sobre los otros 85
  const base = rep + act + pres + opp;
  const score = calidad == null ? (base / 85) * 100 : base + calidad;

  // Confianza: proporción de datos conocidos + penalización fija por IG/FB/Ads no disponibles
  totalCampos += 3; // IG seguidores, FB, Ads (siempre no_disponible en esta versión)
  const confianza = Math.round((conocidos / totalCampos) * 100);

  const s = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: s,
    banda: banda(s),
    confianza,
    componentes: {
      reputacion: round1(rep), actividad: round1(act), presencia_digital: round1(pres),
      calidad_web: calidad == null ? "no_disponible" : round1(calidad), oportunidades: round1(opp),
    },
    motivos, problemas, servicios,
    nota: "Puntaje orientativo. Seguidores, publicaciones y anuncios de Meta no se incluyen (no_disponible).",
  };
}
const round1 = (n) => Math.round(n * 10) / 10;
