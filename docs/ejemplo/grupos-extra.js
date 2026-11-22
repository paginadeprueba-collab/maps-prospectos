/* Grupos extra para la Fábrica de Sitios: Psicología y Constructora (sin IA, solo plantilla).
   No toca el grupo "hogar": reutiliza su armado de payload y solo cambia el rubro (k).
   Lo usan sitios.html y las plantillas psicologia*.html / constructora*.html (vía llenar.js). */
(function (root) {
  function crearGrupo(def) {
    var porId = {};
    def.rubros.forEach(function (r) { porId[r.id] = r; });
    function hogar() { return root.EjemploGrupos && root.EjemploGrupos.hogar; }
    return {
      id: def.id,
      titulo: def.titulo,
      paginas: def.paginas,
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
    paginas: ["ejemplo/psicologia.html", "ejemplo/psicologia-2.html"],
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
    paginas: ["ejemplo/constructora.html", "ejemplo/constructora-2.html", "ejemplo/constructora-3.html"],
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

  root.EjemploGrupos = root.EjemploGrupos || {};
  root.EjemploGrupos.psicologia = psicologia;
  root.EjemploGrupos.constructora = constructora;
})(typeof window !== "undefined" ? window : globalThis);
