/* Rellena las plantillas nuevas de la Fábrica de Sitios (hogar-7..9, psicologia*, constructora*)
   con los mismos datos que usan los diseños 1 a 6: nombre, rubro, zona, WhatsApp, servicios y reseñas.
   Sin IA. Lee window.__EJEMPLO_DATA__ (HTML descargado) o EjemploCodec.cargar (?w= o #hash).

   Marcas que entiende en el HTML:
   - data-nombre, data-nombre-mayus, data-rubro, data-zona, data-iniciales, data-tel, data-dir, data-hora,
     data-lead, data-rating, data-reviews-count, data-stars
   - data-hide-if="dir|hora|tel|rating|reviews|reviews-text|wa"
   - data-servicios: contenedor; su primer hijo es el molde (data-s-h, data-s-p, data-s-n="num|num-tag|n2")
   - data-servicios-select: <select> que se llena con los servicios
   - data-reviews: contenedor; su primer hijo es el molde (data-r-t, data-r-n, data-r-s)
   - .sello-resenas-google: sello verde (o "Opiniones de clientes" si no son de Google)
   - a[data-wa] / a[href*="wa.me"]: links al WhatsApp del negocio; además setea window.WHATSAPP_NUMBER
   - a[data-maps], iframe[data-map]: mapa de la zona
   - Textos tipo [Nombre y apellido], [Localidad], etc.: se reemplazan; los desconocidos se borran.
   Al final llama window.alLlenar(data, ctx, rubro) si la plantilla lo define. */
(function (root) {
  "use strict";

  function waDigits(data) {
    if (!data) return "";
    var raw = data.w === 1 ? data.p : (typeof data.w === "string" && data.w ? data.w : data.p);
    var d = String(raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (/^\s*\+/.test(String(raw))) return d; // ya trae código de país (+598…, +52…)
    if (d.indexOf("54") === 0) return d;
    if (d.length === 10) return "549" + d;
    return d;
  }
  function zonaDe(data) {
    if (data && data.b) return String(data.b);
    if (data && data.a && /\bCABA\b/i.test(data.a)) return "CABA";
    return "";
  }
  function iniciales(n) {
    var p = String(n || "").replace(/^(lic|dra?|arq|ing)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "•";
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
  }
  function stars(s) {
    var n = Math.round(Number(s) || 0);
    if (n < 0) n = 0;
    if (n > 5) n = 5;
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  }
  function ratingTxt(s) {
    var n = Number(s);
    if (!isFinite(n) || n <= 0) return "";
    return String(Math.round(n * 10) / 10).replace(".", ",");
  }
  function telTxt(data) {
    var t = String((data && data.p) || "");
    return t.length === 10 && /^\d+$/.test(t) ? t.slice(0, 2) + " " + t.slice(2, 6) + "-" + t.slice(6) : t;
  }
  function conTitulo(nombre) {
    // "Ana Pérez" -> "Lic. Ana Pérez"; si ya trae título, se deja.
    return /^(lic|dra?|psic)\.?\s/i.test(nombre) ? nombre : "Lic. " + nombre;
  }

  function grupoDe(k) {
    var gs = root.EjemploGrupos || {};
    var orden = ["hogar", "psicologia", "constructora", "juridico"];
    for (var key in gs) if (orden.indexOf(key) < 0) orden.push(key);
    for (var i = 0; i < orden.length; i++) {
      var g = gs[orden[i]];
      var r = g && g.porId && g.porId(k);
      if (r) return { grupo: g, rubro: r };
    }
    return null;
  }

  function contexto(data, rubro) {
    var nombre = String(data.n || rubro.nombre || "").trim();
    var zona = zonaDe(data);
    var dir = String(data.a || "").trim();
    return {
      nombre: nombre,
      zona: zona,
      zonaTxt: zona || dir || "tu zona",
      dir: dir,
      hora: String(data.h || "").trim(),
      tel: telTxt(data),
      wa: waDigits(data),
      rubro: rubro.nombre || ""
    };
  }

  /* Reemplaza los marcadores entre corchetes de las plantillas originales. Es pura (sirve en tests). */
  function reemplazarTexto(str, ctx) {
    var s = String(str == null ? "" : str);
    if (s.indexOf("[") < 0) return s;
    var n = ctx.nombre || "";
    s = s.replace(/(Lic\.\s*)\[(NOMBRE Y APELLIDO|Nombre y apellido)\]/gi, function (m, lic, cual) {
      var v = conTitulo(n);
      return cual === cual.toUpperCase() ? v.toUpperCase() : v;
    });
    s = s.replace(/\[NOMBRE Y APELLIDO\]/g, n.toUpperCase());
    s = s.replace(/\[(Nombre y apellido|Nombre del negocio|Nombre)\]/g, n);
    s = s.replace(/\[(Localidad|Barrio \/ localidad, provincia|Zona)\]/g, ctx.zonaTxt);
    s = s.replace(/\[(Dirección, localidad|Dirección completa|Dirección)\]/g, ctx.dir || ctx.zonaTxt);
    s = s.replace(/\[(Días y horarios[^\]]*)\]/g, ctx.hora || "A coordinar por WhatsApp");
    s = s.replace(/\[(WhatsApp \/ teléfono|Teléfono|WhatsApp)\]/g, ctx.tel || "Por WhatsApp");
    // Cualquier otro marcador ([N.º], [Universidad], etc.) se borra junto con su separador.
    s = s.replace(/\s*(·|,)?\s*((con )?[Mm]atr[íi]cula( profesional)?\s*)?\[[^\[\]]{1,60}\]/g, "");
    return s;
  }

  function q(sel, el) { return (el || document).querySelector(sel); }
  function qq(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function show(el, on) { if (el) el.hidden = !on; }
  function setAll(sel, txt) { qq(sel).forEach(function (el) { el.textContent = txt == null ? "" : String(txt); }); }

  function pintarPlaceholders(ctx) {
    var body = document.body;
    var walker = document.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */, null);
    var nodos = [];
    while (walker.nextNode()) nodos.push(walker.currentNode);
    nodos.forEach(function (t) {
      var p = t.parentNode;
      if (!p || /^(SCRIPT|STYLE)$/.test(p.nodeName)) return;
      if (t.nodeValue.indexOf("[") < 0) return;
      t.nodeValue = reemplazarTexto(t.nodeValue, ctx);
      if (!t.nodeValue.trim() && p.children.length === 0 && !p.textContent.trim()) p.hidden = true;
    });
    qq("[alt],[title],[placeholder],[aria-label]").forEach(function (el) {
      ["alt", "title", "placeholder", "aria-label"].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && v.indexOf("[") >= 0) el.setAttribute(a, reemplazarTexto(v, ctx));
      });
    });
  }

  function pintarTextos(data, rubro, ctx) {
    document.title = ctx.nombre + (ctx.rubro ? " | " + ctx.rubro : "");
    setAll("[data-nombre]", ctx.nombre);
    setAll("[data-nombre-mayus]", ctx.nombre.toUpperCase());
    setAll("[data-rubro]", ctx.rubro);
    setAll("[data-zona]", ctx.zonaTxt);
    setAll("[data-iniciales]", iniciales(ctx.nombre));
    setAll("[data-lead]", String(rubro.lead || "").replace(/\{zona\}/g, ctx.zonaTxt));
    setAll("[data-dir]", ctx.dir || ctx.zonaTxt);
    setAll("[data-hora]", ctx.hora);
    setAll("[data-tel]", ctx.tel);
    setAll("[data-rating]", ratingTxt(data.s));
    setAll("[data-reviews-count]", data.v ? String(data.v) : "");
    setAll("[data-stars]", data.s ? stars(data.s) : "");
    qq("[data-hide-if=dir]").forEach(function (el) { show(el, !!ctx.dir); });
    qq("[data-hide-if=hora]").forEach(function (el) { show(el, !!ctx.hora); });
    qq("[data-hide-if=tel]").forEach(function (el) { show(el, !!ctx.tel); });
    qq("[data-hide-if=rating]").forEach(function (el) { show(el, !!ratingTxt(data.s)); });
    qq("[data-hide-if=rating-count]").forEach(function (el) { show(el, !!data.v); });
  }

  function pintarServicios(grupo, rubro, data) {
    var lista = (grupo.serviciosDe ? grupo.serviciosDe(rubro, data) : rubro.servicios) || [];
    qq("[data-servicios]").forEach(function (box) {
      var molde = box.firstElementChild;
      if (!molde || !lista.length) return;
      molde = molde.cloneNode(true);
      box.innerHTML = "";
      lista.slice(0, 9).forEach(function (s, i) {
        var c = molde.cloneNode(true);
        var nn = (i < 9 ? "0" : "") + (i + 1);
        var h = q("[data-s-h]", c) || q("h3", c);
        var p = q("[data-s-p]", c) || q("p", c);
        var num = q("[data-s-n]", c);
        if (h) h.textContent = s.h || s.tag || "";
        if (p) { p.textContent = s.p || ""; p.hidden = !s.p; }
        if (num) {
          var modo = num.getAttribute("data-s-n");
          num.textContent = modo === "num-tag" ? nn + " / " + String(s.h || "").toUpperCase() : nn;
        }
        box.appendChild(c);
      });
    });
    qq("select[data-servicios-select]").forEach(function (sel) {
      if (!lista.length) return;
      sel.innerHTML = lista.map(function (s) {
        var t = String(s.h || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
        return '<option value="' + t + '">' + t + "</option>";
      }).join("") + '<option value="Otro">Otro</option>';
    });
  }

  function pintarResenas(grupo, data) {
    if (grupo.pintarSello) grupo.pintarSello(data);
    var google = grupo.esGoogle ? grupo.esGoogle(data) : true;
    var lista = Array.isArray(data.e) ? data.e.slice(0, 6) : [];
    qq("[data-reviews]").forEach(function (box) {
      var molde = box.firstElementChild;
      if (!molde) return;
      molde = molde.cloneNode(true);
      box.innerHTML = "";
      lista.forEach(function (r, i) {
        var c = molde.cloneNode(true);
        if (i > 0) c.classList.remove("active");
        var t = q("[data-r-t]", c), n = q("[data-r-n]", c), st = q("[data-r-s]", c);
        if (t) t.textContent = r[1] || "";
        if (n) n.textContent = r[0] || (google ? "Reseña publicada en Google" : "Cliente");
        if (st) st.textContent = stars(r[2] || data.s || 5);
        box.appendChild(c);
      });
      show(box, lista.length > 0);
    });
    qq("[data-hide-if=reviews]").forEach(function (el) { show(el, lista.length > 0 || !!data.s); });
    qq("[data-hide-if=reviews-text]").forEach(function (el) { show(el, lista.length > 0); });
  }

  function pintarWhatsapp(ctx) {
    root.WHATSAPP_NUMBER = ctx.wa;
    var href = ctx.wa ? "https://wa.me/" + ctx.wa + "?text=" + encodeURIComponent("Hola, vi la web de " + ctx.nombre + " y quiero consultar.") : "";
    qq('a[data-wa], a[href*="wa.me"]').forEach(function (a) {
      if (!href) { show(a, false); return; }
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
    });
    qq('a[href^="tel:"]').forEach(function (a) {
      if (ctx.tel) a.href = "tel:" + (/^\s*\+/.test(ctx.tel) ? "+" : "") + ctx.tel.replace(/\D/g, "");
      else show(a, false);
    });
    qq("[data-hide-if=wa]").forEach(function (el) { show(el, !!ctx.wa); });
  }

  function pintarMapa(data, ctx) {
    var lugar = (data.y && data.x) ? data.y + "," + data.x : (ctx.dir || (ctx.zona ? ctx.zona + ", Argentina" : ""));
    qq("a[data-maps]").forEach(function (a) {
      if (!lugar) { show(a, false); return; }
      a.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(lugar);
      a.target = "_blank";
      a.rel = "noopener";
    });
    qq("iframe[data-map]").forEach(function (f) {
      if (!lugar) { show(f, false); return; }
      f.src = "https://maps.google.com/maps?q=" + encodeURIComponent(lugar) + "&hl=es&z=14&output=embed";
    });
    qq("[data-hide-if=mapa]").forEach(function (el) { show(el, !!lugar); });
  }

  function vacio() {
    document.title = "Web de ejemplo";
    document.body.innerHTML = '<div style="max-width:520px;margin:18vh auto;padding:24px;font-family:system-ui,sans-serif;text-align:center;color:#334">' +
      "<h1 style=\"font-size:22px\">Web de ejemplo</h1><p>Este link no trae datos del negocio. Generalo desde la Fábrica de Sitios.</p></div>";
  }

  function aplicar(data) {
    var gr = data && grupoDe(data.k);
    if (!gr) { vacio(); return null; }
    var ctx = contexto(data, gr.rubro);
    pintarTextos(data, gr.rubro, ctx);
    pintarPlaceholders(ctx);
    pintarServicios(gr.grupo, gr.rubro, data);
    pintarResenas(gr.grupo, data);
    pintarWhatsapp(ctx);
    pintarMapa(data, ctx);
    var y = q("#year"); if (y) y.textContent = String(new Date().getFullYear());
    qq("img").forEach(function (img) { img.addEventListener("error", function () { img.style.visibility = "hidden"; }); });
    if (typeof root.alLlenar === "function") {
      try { root.alLlenar(data, ctx, gr.rubro); } catch (e) { /* la plantilla sigue igual */ }
    }
    return ctx;
  }

  async function arrancar() {
    var data = root.__EJEMPLO_DATA__ || null;
    if (!data && root.EjemploCodec) {
      try { data = await root.EjemploCodec.cargar(location); } catch (e) { data = null; }
    }
    try { aplicar(data); } finally { document.documentElement.classList.remove("ej-cargando"); }
  }

  root.EjemploLlenar = {
    reemplazarTexto: reemplazarTexto,
    contexto: contexto,
    grupoDe: grupoDe,
    waDigits: waDigits,
    iniciales: iniciales,
    aplicar: aplicar,
    arrancar: arrancar
  };
  if (typeof document !== "undefined" && document.documentElement) {
    if (document.body) arrancar();
    else document.addEventListener("DOMContentLoaded", arrancar);
  }
})(typeof window !== "undefined" ? window : globalThis);
