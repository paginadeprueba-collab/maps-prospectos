/**
 * Investigador Comercial IMPULSA — módulo del Worker.
 *
 * Recibe prospectos ya encontrados por Fábrica de Prospectos (NO busca en Maps)
 * y, para cada uno, analiza solo fuentes de acceso permitido:
 *   - Datos de Google Maps que ya trae Fábrica (rating, reseñas, teléfono, WhatsApp).
 *   - El sitio web propio, si existe (fetch HTTP público con protecciones SSRF).
 *
 * NO scrapea Instagram, Facebook ni Meta Ads Library. Seguidores, publicaciones y
 * anuncios se devuelven como `no_disponible` (nunca 0) con el link público para revisar a mano.
 *
 * Procedencia (ver docs/IMPULSA.md):
 *   - extractSocials / extractEmails / extractSnippet / parte de calidad web:
 *     adaptado de mrsudo404/leadhunter (MIT) — extract_socials_from_html,
 *     extract_emails_from_html, extract_snippet_from_html, check_website_quality.
 *   - detectForms / detectBooking: heurísticas adaptadas de
 *     anthonyonazure/maps-lead-gen (checkWebsite), con corrección del falso positivo "book" ⊂ "facebook".
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000; // 1,5 MB
const UA = "Mozilla/5.0 (compatible; IMPULSA-Investigador/1.0; +https://github.com/paginadeprueba-collab/maps-prospectos)";

export const TIPOS = ["comprobado", "estimado", "no_disponible", "hipotesis"];

/** Construye un dato con trazabilidad. */
export function dato(valor, fuente, tipo, nota) {
  const d = { valor: valor ?? null, fuente: fuente || null, fecha: new Date().toISOString(), tipo };
  if (nota) d.nota = nota;
  return d;
}
const ND = (fuente, nota) => dato(null, fuente || null, "no_disponible", nota);

/* ===================== SSRF guard ===================== */

function ipv4Private(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null; // no es IPv4 literal
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([m[1], m[2], m[3], m[4]].some((x) => Number(x) > 255)) return true;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||            // link-local / metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * Valida una URL antes de hacer fetch. Devuelve {ok, url?, motivo?}.
 * Limitación: Workers no expone resolución DNS, así que se bloquean literales
 * (IPs privadas, localhost, *.local, *.internal, metadata). Un dominio público que
 * resuelva a IP privada no es alcanzable desde la red de Cloudflare de todas formas.
 */
export function validarUrlPublica(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { ok: false, motivo: "url_invalida" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, motivo: "protocolo_no_permitido" };
  if (u.username || u.password) return { ok: false, motivo: "credenciales_en_url" };
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) return { ok: false, motivo: "puerto_no_permitido" };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || !host.includes(".") && !host.includes(":")) return { ok: false, motivo: "host_invalido" };
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home.arpa") ||
    host === "metadata.google.internal" || host === "metadata"
  ) return { ok: false, motivo: "host_privado" };
  if (host.includes(":")) {
    // IPv6 literal: bloquear loopback, link-local, ULA, mapeadas a v4
    if (host === "::1" || host === "::" || /^(fe8|fe9|fea|feb|fc|fd)/.test(host) || host.startsWith("::ffff:"))
      return { ok: false, motivo: "ip_privada" };
  }
  const priv = ipv4Private(host);
  if (priv === true) return { ok: false, motivo: "ip_privada" };
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return { ok: false, motivo: "ip_ofuscada" };
  return { ok: true, url: u };
}

/** Normaliza lo que viene como "website" (a veces sin esquema). */
export function normalizarWebsite(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  return s;
}

/** Fetch seguro: timeout, redirects manuales re-validados, límite de tamaño. */
export async function fetchSeguro(rawUrl) {
  const t0 = Date.now();
  let actual = rawUrl;
  const cadena = [];
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const v = validarUrlPublica(actual);
    if (!v.ok) return { ok: false, error: v.motivo, url: actual, cadena, ms: Date.now() - t0 };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(v.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e && e.name === "AbortError" ? "timeout" : "fetch_error: " + String(e && e.message || e).slice(0, 120);
      return { ok: false, error: msg, url: actual, cadena, ms: Date.now() - t0 };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      cadena.push({ url: actual, status: res.status });
      actual = new URL(res.headers.get("location"), v.url).toString();
      continue;
    }
    // Leer cuerpo con límite
    let html = "";
    let truncado = false;
    const ctype = res.headers.get("content-type") || "";
    try {
      if (res.body && /html|xml|text/i.test(ctype || "text/html")) {
        const reader = res.body.getReader();
        const dec = new TextDecoder("utf-8", { fatal: false });
        let bytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) {
            truncado = true;
            html += dec.decode(value.slice(0, Math.max(0, value.byteLength - (bytes - MAX_BYTES))));
            try { await reader.cancel(); } catch {}
            break;
          }
          html += dec.decode(value, { stream: true });
        }
      }
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, error: "lectura: " + String(e && e.message || e).slice(0, 120), url: actual, status: res.status, cadena, ms: Date.now() - t0 };
    }
    clearTimeout(timer);
    return {
      ok: true, url: actual, status: res.status, contentType: ctype, html,
      bytes: html.length, truncado, cadena, ms: Date.now() - t0,
    };
  }
  return { ok: false, error: "demasiados_redirects", url: actual, cadena, ms: Date.now() - t0 };
}

/* ============ Extractores (adaptados de leadhunter, MIT) ============ */

const SOCIAL_PATTERNS = {
  facebook: /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/[A-Za-z0-9_.\-\/?=%]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-]+\/?/gi,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_.\-%]+\/?/gi,
  x: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,30}\/?/gi,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-]+\/?/gi,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_.\-]+\/?/gi,
};
const SOCIAL_JUNK = /\/(sharer|share|intent|plugins|dialog|tr\?|login|privacy|policies|help|hashtag|explore|p\/|reel\/|watch)/i;

/** Adaptado de leadhunter extract_socials_from_html: primer perfil plausible por red. */
export function extractSocials(html) {
  const out = {};
  const text = String(html || "").replace(/&amp;/g, "&");
  for (const [red, re] of Object.entries(SOCIAL_PATTERNS)) {
    const matches = text.match(re) || [];
    const limpio = matches
      .map((m) => m.replace(/["'<>\s].*$/, "").replace(/[),.;]+$/, ""))
      .filter((m) => !SOCIAL_JUNK.test(m));
    if (limpio.length) out[red] = limpio[0];
  }
  return out;
}

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const EMAIL_JUNK = /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|@2x|u003e|noreply|no-reply/i;

/** Adaptado de leadhunter extract_emails_from_html (mailto + texto, filtrando basura). */
export function extractEmails(html) {
  const text = String(html || "");
  const set = new Set();
  for (const m of text.matchAll(/mailto:([^"'?>\s]+)/gi)) set.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of text.replace(/<[^>]+>/g, " ").match(EMAIL_RE) || []) set.add(m.toLowerCase());
  return [...set].filter((e) => !EMAIL_JUNK.test(e)).slice(0, 5);
}

/** Adaptado de leadhunter extract_snippet_from_html: meta description → og:description → title. */
export function extractSnippet(html) {
  const h = String(html || "");
  const pick = (re) => { const m = h.match(re); return m ? decodeEntities(m[1]).trim() : ""; };
  const s =
    pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']{3,})["']/i) ||
    pick(/<meta[^>]+content=["']([^"']{3,})["'][^>]*name=["']description["']/i) ||
    pick(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']{3,})["']/i) ||
    pick(/<title[^>]*>([^<]{2,})<\/title>/i);
  return s.replace(/\s+/g, " ").slice(0, 300);
}
function extractTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim().slice(0, 160) : "";
}
function decodeEntities(s) {
  return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

export function extractWhatsapp(html) {
  const m = String(html || "").match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send)[^"'<>\s]*/i);
  return m ? m[0].replace(/&amp;/g, "&") : null;
}

/* ===== Heurísticas de formularios y reservas (adaptadas de maps-lead-gen checkWebsite) ===== */

export function detectForms(html) {
  const h = String(html || "");
  const forms = (h.match(/<form\b/gi) || []).length;
  const contacto = /<form[\s\S]{0,4000}?(type=["']email["']|name=["'](email|mail|correo|telefono|phone|mensaje|message)["']|<textarea)/i.test(h);
  return { cantidad: forms, contacto };
}

const BOOKING_VENDORS = [
  "calendly.com", "acuityscheduling.com", "booksy.com", "fresha.com", "setmore.com", "simplybook",
  "doctoralia", "turnito", "agendapro", "reservo", "youcanbook.me", "square.site/book", "squareup.com/appointments",
  "tuturno", "turnos.app", "medicloud", "docplanner", "zocdoc", "opentable", "resy.com", "tock", "google.com/calendar/appointments",
  "calendar.app.google",
];
// Palabras con límites de palabra; "book" NO se usa suelto (falso positivo en "facebook", "notebook").
const BOOKING_WORDS = /\b(reserv(a|á|ar|e)\b|reservas|sac(a|á) (tu )?turno|ped(i|í) (tu )?turno|turnos? online|agend(a|á) (tu|una) (cita|consulta|visita|turno)|book (now|online|an? appointment)|schedule (an? )?appointment)/i;

export function detectBooking(html) {
  const h = String(html || "").toLowerCase();
  const vendor = BOOKING_VENDORS.find((v) => h.includes(v)) || null;
  const texto = !vendor && BOOKING_WORDS.test(h.replace(/<[^>]+>/g, " "));
  return {
    sistema: vendor,
    // vendor embebido = comprobado en el HTML; palabra suelta = hipótesis
    tipo: vendor ? "comprobado" : texto ? "hipotesis" : "no_disponible",
    detectado: Boolean(vendor || texto),
  };
}

/** Partes de check_website_quality (leadhunter) adaptadas: sin afirmar LCP ni usabilidad móvil. */
export function calidadWeb(r) {
  const h = r.html || "";
  return {
    status: r.status,
    https: r.url.startsWith("https://"),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(h),
    html_bytes: r.bytes,
    truncado: r.truncado,
    tiempo_ms: r.ms,
    titulo: extractTitle(h),
    tiene_title: /<title[^>]*>[^<]{2,}<\/title>/i.test(h),
    tiene_meta_description: /<meta[^>]+name=["']description["']/i.test(h),
    redirects: r.cadena.length,
    url_final: r.url,
    nota: "Medición de un solo fetch desde Cloudflare. No mide LCP ni usabilidad móvil real.",
  };
}

/* ===================== Investigación de un prospecto ===================== */

function num(x) {
  const n = parseFloat(String(x ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function rating(x) {
  const n = parseFloat(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function linkAdsLibrary(nombre) {
  const q = encodeURIComponent(String(nombre || "").slice(0, 80));
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=AR&q=${q}&search_type=keyword_unordered`;
}

export async function investigarProspecto(p) {
  const fuenteMaps = p.link_maps || "Fábrica de Prospectos (Google Maps)";
  const r = {
    key: String(p.key || p.link_maps || p.nombre || "").slice(0, 512),
    nombre: dato(p.nombre || null, fuenteMaps, p.nombre ? "comprobado" : "no_disponible"),
    categoria: p.categoria ? dato(p.categoria, fuenteMaps, "comprobado") : ND(fuenteMaps),
    direccion: p.direccion ? dato(p.direccion, fuenteMaps, "comprobado") : ND(fuenteMaps),
    telefono: p.telefono ? dato(p.telefono, fuenteMaps, "comprobado") : ND(fuenteMaps),
    whatsapp: p.whatsapp
      ? dato(p.whatsapp, fuenteMaps, "estimado", "Link generado desde el teléfono; no se verificó que exista la cuenta de WhatsApp.")
      : ND(fuenteMaps),
    google_maps: p.link_maps ? dato(p.link_maps, "Fábrica de Prospectos", "comprobado") : ND(),
    rating: rating(p.rating) != null ? dato(rating(p.rating), fuenteMaps, "comprobado") : ND(fuenteMaps),
    resenas: num(p.reseñas ?? p.resenas) != null ? dato(num(p.reseñas ?? p.resenas), fuenteMaps, "comprobado") : ND(fuenteMaps),
    website: null,
    calidad_web: ND(null, "Sin sitio web para analizar."),
    redes: {},
    emails: ND(null),
    snippet: ND(null),
    formulario: ND(null),
    agenda: ND(null, "Sin sitio web: no se pudo verificar sistema de turnos."),
    instagram_seguidores: ND("Instagram", "No se scrapea Instagram (condiciones de uso). Revisar manualmente."),
    instagram_publicaciones: ND("Instagram", "No se scrapea Instagram (condiciones de uso). Revisar manualmente."),
    facebook_seguidores: ND("Facebook", "No se scrapea Facebook (condiciones de uso). Revisar manualmente."),
    meta_ads: dato(null, linkAdsLibrary(p.nombre), "no_disponible",
      "No se consulta Meta Ads Library automáticamente. Abrir el link público para revisar."),
    errores: [],
  };

  const web = normalizarWebsite(p.website || p.web || p.sitio || "");
  if (!web) {
    r.website = ND("Fábrica de Prospectos", "El prospecto no tiene sitio web informado.");
    return r;
  }
  const f = await fetchSeguro(web);
  if (!f.ok) {
    r.website = dato(web, web, "hipotesis", `No se pudo abrir el sitio: ${f.error}`);
    r.errores.push(`website: ${f.error}`);
    r.calidad_web = ND(web, `Fetch falló: ${f.error}`);
    return r;
  }
  const fuente = f.url;
  r.website = dato(f.url, fuente, f.status < 400 ? "comprobado" : "hipotesis", f.status >= 400 ? `HTTP ${f.status}` : undefined);
  r.calidad_web = dato(calidadWeb(f), fuente, "comprobado");
  const soc = extractSocials(f.html);
  for (const [red, url] of Object.entries(soc)) {
    r.redes[red] = dato(url, fuente, "estimado", "Link encontrado en el sitio del negocio; no se verificó el perfil.");
  }
  const wa = extractWhatsapp(f.html);
  if (wa) r.redes.whatsapp_web = dato(wa, fuente, "comprobado");
  const em = extractEmails(f.html);
  r.emails = em.length ? dato(em, fuente, "comprobado") : ND(fuente, "No se encontraron emails en la página principal.");
  const sn = extractSnippet(f.html);
  r.snippet = sn ? dato(sn, fuente, "comprobado") : ND(fuente);
  const fm = detectForms(f.html);
  r.formulario = dato(fm, fuente, "comprobado");
  const bk = detectBooking(f.html);
  r.agenda = bk.detectado
    ? dato(bk.sistema || "posible reserva por texto", fuente, bk.tipo,
        bk.tipo === "hipotesis" ? "Detectado por palabras clave; puede ser falso positivo." : "Proveedor de turnos embebido/enlazado en el HTML.")
    : dato(false, fuente, "estimado", "No se detectó sistema de turnos en la página principal (solo se revisa el HTML inicial).");
  if (soc.instagram) {
    r.instagram_seguidores = ND(soc.instagram, "Perfil hallado en el sitio; seguidores no se obtienen automáticamente.");
    r.instagram_publicaciones = ND(soc.instagram, "Perfil hallado en el sitio; publicaciones no se obtienen automáticamente.");
  }
  if (soc.facebook) r.facebook_seguidores = ND(soc.facebook, "Página hallada en el sitio; seguidores no se obtienen automáticamente.");
  return r;
}
