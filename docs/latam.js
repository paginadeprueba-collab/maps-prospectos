/* Fábrica de Prospectos — modo «Provincias y Latinoamérica».
 * Funciones puras (sin red ni DOM) para armar las consultas y reconocer teléfonos de otros países.
 * Los datos de países, provincias/estados y ciudades viven en zonas-latam.json. */
(function (root) {
  "use strict";
  var MAX_CIUDADES = 40; // misma escala que CABA (48 barrios); el Worker acepta hasta 200 consultas

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
  /* "Ciudad, Provincia, País". Sin repetir si la ciudad se llama como la provincia. */
  function lugar(ciudad, region, pais) {
    var c = limpio(ciudad), r = limpio(region), p = pais && pais.nombre ? pais.nombre : limpio(pais);
    var partes = [c];
    var conRegion = !(pais && pais.region_en_query === false);
    if (conRegion && r && norm(r) !== norm(c)) partes.push(r);
    if (p && norm(p) !== norm(c)) partes.push(p);
    return partes.filter(Boolean).join(", ");
  }
  /* sel: [{ciudad, region}] → ["rubro en Ciudad, Provincia, País", …] sin duplicados. */
  function buildQueries(rubro, sel, pais) {
    var r = limpio(rubro);
    if (!r) return [];
    var vistos = {}, out = [];
    (sel || []).forEach(function (x) {
      if (!x || !limpio(x.ciudad)) return;
      var q = r + " en " + lugar(x.ciudad, x.region, pais);
      var k = norm(q);
      if (vistos[k]) return;
      vistos[k] = 1;
      out.push(q);
    });
    return out;
  }
  function clave(x) { return norm(x.ciudad) + "|" + norm(x.region); }
  /* Teléfono escrito en formato internacional de otro país (+598…, +52…): no se le agrega 549. */
  function esInternacional(tel) {
    var t = String(tel || "").trim();
    return /^\+/.test(t) && !/^\+\s*54/.test(t);
  }

  var api = { MAX_CIUDADES: MAX_CIUDADES, norm: norm, paisPorNombre: paisPorNombre, lugar: lugar, buildQueries: buildQueries, clave: clave, esInternacional: esInternacional };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FabricaLatam = api;
})(typeof window !== "undefined" ? window : globalThis);
