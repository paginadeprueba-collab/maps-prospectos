/* Grupos extra para la Fábrica de Sitios: Psicología y Constructora (sin IA, solo plantilla).
   No toca el grupo "hogar": reutiliza su armado de payload y solo cambia el rubro (k).
   Lo usan sitios.html y las plantillas psicologia*.html / constructora*.html (vía llenar.js). */
(function (root) {
  function normTxt(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function coincide(texto, alias) {
    if (!texto) return false;
    var t = " " + texto + " ";
    for (var i = 0; i < (alias || []).length; i++) {
      var a = normTxt(alias[i]);
      if (a && t.indexOf(" " + a + " ") >= 0) return true;
    }
    return false;
  }
  function crearGrupo(def) {
    var porId = {};
    def.rubros.forEach(function (r) { porId[r.id] = r; });
    function hogar() { return root.EjemploGrupos && root.EjemploGrupos.hogar; }
    return {
      id: def.id,
      titulo: def.titulo,
      paginas: def.paginas,
      alias: def.alias || [],
      /* Buscador: si el rubro del prospecto (categoría de Maps o rubro buscado) coincide con este grupo,
         arma el mismo payload que hogar (nombre, zona, WhatsApp con código de país, reseñas) con k propio. */
      payload: function (prospect, ctx) {
        var h = hogar();
        if (!h || typeof h.payload !== "function") return null;
        var p = prospect || {}, c = ctx || {};
        var cat = normTxt(p.categoria), bus = normTxt(c.rubro), nom = normTxt(p.nombre);
        var ok = coincide(cat, def.alias) || (!h.resolver(p, {}) && coincide(bus, def.alias)) || (!cat && coincide(nom, def.alias));
        if (!ok) return null;
        var copia = {};
        for (var key in p) if (Object.prototype.hasOwnProperty.call(p, key)) copia[key] = p[key];
        copia.categoria = "plomero";
        var o = h.payload(copia, { barriosConocidos: c.barriosConocidos || [] });
        if (!o) return null;
        o.k = def.rubros[0].id;
        return o;
      },
      rubros: def.rubros,
      porId: function (id) { return porId[id] || null; },
      /* Mismo payload que hogar (nombre, zona, WhatsApp, reseñas, servicios, sello g),
         con k del rubro propio. */
      payloadSitio: function (campos) {
        var h = hogar();
        if (!h) return null;
        campos = campos || {};
        var r = porId[campos.k] || def.rubros[0];
        var copia = {};
        for (var key in campos) if (Object.prototype.hasOwnProperty.call(campos, key)) copia[key] = campos[key];
        copia.k = "plo";
        var o = h.payloadSitio(copia);
        if (!o) return null;
        o.k = r.id;
        return o;
      },
      serviciosDe: function (rubro, data) { var h = hogar(); return h ? h.serviciosDe(rubro, data) : (rubro.servicios || []); },
      esGoogle: function (data) { var h = hogar(); return h ? h.esGoogle(data) : true; },
      textoSello: function (data) { var h = hogar(); return h ? h.textoSello(data) : "Reseñas verificadas de Google"; },
      pintarSello: function (data) { var h = hogar(); if (h) h.pintarSello(data); }
    };
  }

  var psicologia = crearGrupo({
    id: "psicologia",
    titulo: "Psicología",
    paginas: ["ejemplo/psicologia.html", "ejemplo/psicologia-2.html", "ejemplo/psicologia-3.html"],
    alias: ["psicologo", "psicologos", "psicologa", "psicologas", "psicologia", "psicoterapeuta", "psicoterapia", "terapeuta", "psicoanalista", "consultorio psicologico", "centro de salud mental"],
    rubros: [{
      id: "psi",
      nombre: "Psicología",
      lead: "Atención psicológica presencial en {zona} y online.",
      confianza: ["Escucha profesional", "Presencial y online", "Confidencialidad"],
      servicios: [
        { h: "Ansiedad y estrés", p: "Preocupaciones, exigencia y situaciones que generan malestar." },
        { h: "Autoestima y vínculos", p: "Límites, relaciones y confianza personal." },
        { h: "Momentos de cambio", p: "Duelos, decisiones y etapas de transformación." },
        { h: "Bienestar emocional", p: "Dar lugar a emociones difíciles y entenderlas." },
        { h: "Autoconocimiento", p: "Reconocer patrones, necesidades y recursos propios." },
        { h: "Psicoterapia individual", p: "Un proceso personalizado según tu motivo de consulta." }
      ]
    }]
  });

  var constructora = crearGrupo({
    id: "constructora",
    titulo: "Constructora",
    paginas: ["ejemplo/constructora.html", "ejemplo/constructora-2.html", "ejemplo/constructora-3.html", "ejemplo/interiores.html"],
    alias: ["constructora", "constructoras", "empresa constructora", "empresa de construccion", "construccion", "contratista", "contratista general", "arquitecto", "arquitectos", "estudio de arquitectura", "arquitectura", "reformas", "remodelaciones", "remodelacion", "refacciones", "empresa de reformas", "interiorismo", "interiorista", "disenador de interiores", "diseno de interiores", "decoracion de interiores", "decoradora", "decorador"],
    rubros: [{
      id: "con",
      nombre: "Constructora",
      lead: "Construcción, ampliaciones y reformas en {zona}.",
      confianza: ["Evaluación del proyecto", "Coordinación de personal", "Presupuesto según alcance"],
      servicios: [
        { h: "Obra nueva", p: "Viviendas y espacios nuevos, con seguimiento por etapas." },
        { h: "Ampliaciones", p: "Nuevos ambientes y adaptación de lo existente." },
        { h: "Reformas integrales", p: "Renovación y redistribución de espacios." },
        { h: "Albañilería", p: "Paredes, revoques, contrapisos y obra civil." },
        { h: "Pisos y revestimientos", p: "Colocación y terminaciones." },
        { h: "Techos e impermeabilización", p: "Reparación, membranas y trabajos complementarios." }
      ]
    }]
  });

  var juridico = crearGrupo({
    id: "juridico",
    titulo: "Estudio jurídico",
    paginas: ["ejemplo/juridico.html", "ejemplo/juridico-2.html", "ejemplo/juridico-3.html"],
    alias: ["abogado", "abogados", "abogada", "abogadas", "estudio juridico", "estudio de abogados", "bufete", "bufete de abogados", "despacho de abogados", "asesoria legal", "asesoria juridica", "servicios legales", "abogado laboralista", "abogado penalista", "abogado de familia", "escribano", "escribania", "notario", "notaria"],
    rubros: [{
      id: "jur",
      nombre: "Estudio jurídico",
      lead: "Asesoramiento jurídico en {zona}.",
      confianza: ["Consulta inicial", "Atención personalizada", "Confidencialidad"],
      servicios: [
        { h: "Consultas y orientación legal", p: "Análisis inicial de tu situación y próximos pasos." },
        { h: "Representación jurídica", p: "Asistencia en gestiones, negociaciones y procedimientos." },
        { h: "Redacción y revisión", p: "Contratos, acuerdos, escritos y documentación legal." }
      ]
    }]
  });

  var odontologia = crearGrupo({
    id: "odontologia",
    titulo: "Odontología",
    paginas: ["ejemplo/odontologia.html", "ejemplo/odontologia-2.html", "ejemplo/odontologia-3.html", "ejemplo/odontologia-4.html", "ejemplo/odontologia-5.html", "ejemplo/odontologia-6.html"],
    alias: ["odontologo", "odontologos", "odontologa", "odontologas", "odontologia", "dentista", "dentistas", "clinica dental", "clinicas dentales", "consultorio odontologico", "consultorio dental", "clinica odontologica", "centro odontologico", "ortodoncia", "ortodoncista", "implantes dentales", "estetica dental"],
    rubros: [{
      id: "odo",
      nombre: "Odontología",
      lead: "Atención odontológica integral en {zona}.",
      confianza: ["Atención personalizada", "Prevención", "Turnos por WhatsApp"],
      servicios: [
        { h: "Odontología general", p: "Controles, limpiezas y tratamientos de caries." },
        { h: "Estética dental", p: "Blanqueamiento y mejoras en la sonrisa." },
        { h: "Ortodoncia", p: "Evaluación de la alineación dental y la mordida." },
        { h: "Implantes", p: "Alternativas para reemplazar piezas ausentes." }
      ]
    }]
  });

  root.EjemploGrupos = root.EjemploGrupos || {};
  root.EjemploGrupos.psicologia = psicologia;
  root.EjemploGrupos.constructora = constructora;
  root.EjemploGrupos.juridico = juridico;
  root.EjemploGrupos.odontologia = odontologia;
})(typeof window !== "undefined" ? window : globalThis);
