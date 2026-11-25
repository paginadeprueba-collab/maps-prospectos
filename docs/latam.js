/* Fábrica de Prospectos — modo «Provincias y Latinoamérica».
 * Funciones puras (sin red ni DOM) para armar las consultas y reconocer teléfonos de otros países.
 * Los datos de países, provincias/estados y ciudades viven en zonas-latam.json. */
(function (root) {
  "use strict";
  var MAX_CIUDADES = 120; // ciudades + barrios elegidos por búsqueda (el Worker acepta hasta 200 consultas)
  var AVISO_BUSQUEDAS = 200; // más de esto (lugares × variantes del rubro) tarda mucho: se avisa

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  function limpio(s) {
    return String(s || "").replace(/[;|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  }
  function paisPorNombre(paises, nombre) {
    var n = norm(nombre);
    return (paises || []).find(function (p) {
      return norm(p.nombre) === n || norm(p.id) === n || (p.alias || []).some(function (a) { return norm(a) === n; });
    }) || null;
  }
  /* "Ciudad, Provincia, País" (sin repetir si la ciudad se llama como la provincia).
   * Con barrio: "Barrio, Ciudad, País" (la ciudad ya ubica; la provincia se omite). */
  function lugar(ciudad, region, pais, barrio) {
    var c = limpio(ciudad), r = limpio(region), p = pais && pais.nombre ? pais.nombre : limpio(pais), b = limpio(barrio);
    if (b) return [b, c, p].filter(function (x, i, a) { return x && (i === 0 || norm(x) !== norm(a[i - 1])); }).join(", ");
    var partes = [c];
    var conRegion = !(pais && pais.region_en_query === false);
    if (conRegion && r && norm(r) !== norm(c)) partes.push(r);
    if (p && norm(p) !== norm(c)) partes.push(p);
    return partes.filter(Boolean).join(", ");
  }
  /* sel: [{ciudad, region, barrio?}] → ["rubro en Ciudad, Provincia, País" | "rubro en Barrio, Ciudad, País", …] sin duplicados. */
  function buildQueries(rubro, sel, pais) {
    var r = limpio(rubro);
    if (!r) return [];
    var vistos = {}, out = [];
    (sel || []).forEach(function (x) {
      if (!x || !limpio(x.ciudad)) return;
      var q = r + " en " + lugar(x.ciudad, x.region, pais, x.barrio);
      var k = norm(q);
      if (vistos[k]) return;
      vistos[k] = 1;
      out.push(q);
    });
    return out;
  }
  function clave(x) { return norm(x.ciudad) + "|" + norm(x.region) + (x.barrio ? "|" + norm(x.barrio) : ""); }
  /* Barrios/zonas cargados para una ciudad (región.barrios = {ciudad: [...]}). */
  function barriosDe(region, ciudad) {
    var m = region && region.barrios;
    if (!m) return [];
    if (m[ciudad]) return m[ciudad].slice();
    var k = Object.keys(m).find(function (x) { return norm(x) === norm(ciudad); });
    return k ? m[k].slice() : [];
  }
  /* Teléfono escrito en formato internacional de otro país (+598…, +52…): no se le agrega 549. */
  function esInternacional(tel) {
    var t = String(tel || "").trim();
    return /^\+/.test(t) && !/^\+\s*54/.test(t);
  }

  /* Link de WhatsApp desde el teléfono guardado (para búsquedas viejas sin link).
   * +<código>… (otro país) queda igual. Argentina: 10 dígitos de área 11/2xx/3xx → 549…;
   * también 9+10 dígitos y celulares de provincia con 15 (área de 3 o 4 + 15 + número). */
  function waDesdeTelefono(tel, direccion) {
    var t = String(tel || "").trim();
    var d = t.replace(/\D/g, "");
    if (!d) return "";
    if (esInternacional(t)) return d.length >= 8 && d.length <= 15 ? "https://wa.me/" + d : "";
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (d.indexOf("54") === 0 && d.length > 10) d = d.slice(2);
    if (d.charAt(0) === "0") d = d.slice(1);
    if (d.length === 11 && d.charAt(0) === "9" && "123".indexOf(d.charAt(1)) >= 0) d = d.slice(1);
    if (d.length === 12 && d.indexOf("11") === 0 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
    else if (d.length === 12 && "23".indexOf(d.charAt(0)) >= 0) {
      if (d.slice(3, 5) === "15") d = d.slice(0, 3) + d.slice(5);
      else if (d.slice(4, 6) === "15") d = d.slice(0, 4) + d.slice(6);
    }
    if (d.length === 10 && d.indexOf("15") === 0 && /aut[oó]noma de buenos aires|\bcaba\b/i.test(String(direccion || ""))) d = "11" + d.slice(2);
    if (d.length === 10 && (d.indexOf("11") === 0 || "23".indexOf(d.charAt(0)) >= 0)) return "https://wa.me/549" + d;
    return "";
  }

  /* Mismo número que WhatsApp, para marcar con un toque: tel:+549… / tel:+598… */
  function telDesdeTelefono(tel, direccion) {
    var wa = waDesdeTelefono(tel, direccion);
    var m = String(wa || "").match(/wa\.me\/(\d+)/);
    return m ? "tel:+" + m[1] : "";
  }

  /* Código ISO del país (para links como Meta Ads Library, que el Worker arma con country=AR). */
  var ISO = { argentina: "AR", uruguay: "UY", chile: "CL", paraguay: "PY", bolivia: "BO", peru: "PE", ecuador: "EC", colombia: "CO",
    venezuela: "VE", mexico: "MX", "costa rica": "CR", panama: "PA", guatemala: "GT", honduras: "HN", "el salvador": "SV",
    nicaragua: "NI", "republica dominicana": "DO", "puerto rico": "PR", cuba: "CU" };
  function isoDe(pais) { return ISO[norm(pais)] || ""; }
  function adsLibraryPais(url, pais) {
    var iso = isoDe(pais);
    if (!url || !iso || iso === "AR") return url || "";
    return String(url).replace(/([?&]country=)AR\b/, "$1" + iso);
  }

  var api = { waDesdeTelefono: waDesdeTelefono, telDesdeTelefono: telDesdeTelefono, isoDe: isoDe, adsLibraryPais: adsLibraryPais, MAX_CIUDADES: MAX_CIUDADES, AVISO_BUSQUEDAS: AVISO_BUSQUEDAS, barriosDe: barriosDe, norm: norm, paisPorNombre: paisPorNombre, lugar: lugar, buildQueries: buildQueries, clave: clave, esInternacional: esInternacional };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FabricaLatam = api;
})(typeof window !== "undefined" ? window : globalThis);
