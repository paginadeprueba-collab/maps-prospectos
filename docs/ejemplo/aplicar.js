/* Aplica los datos del prospecto (codec + grupo hogar) sobre las plantillas 3 a 6.
   Sin IA: solo rellena nombre, rubro, zona, teléfono, reseñas y la calculadora. */
(function (root) {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function doc() { return typeof document !== "undefined" ? document : null; }
  function q(sel, rootEl) { var r = rootEl || doc(); return r ? r.querySelector(sel) : null; }
  function qq(sel, rootEl) { var r = rootEl || doc(); return r ? Array.prototype.slice.call(r.querySelectorAll(sel)) : []; }
  function show(el, on) { if (el) el.hidden = !on; }

  function waMe(num) {
    var d = String(num || "").replace(/\D/g, "");
    if (!d) return "";
    if (/^\s*\+/.test(String(num))) return "https://wa.me/" + d; // ya trae código de país
    if (d.indexOf("54") === 0) return "https://wa.me/" + d;
    if (d.length === 10) return "https://wa.me/549" + d;
    return "https://wa.me/" + d;
  }
  function waNum(data) {
    if (!data) return "";
    if (data.w === 1) return data.p || "";
    if (typeof data.w === "string" && data.w) return data.w;
    return data.p || "";
  }
  function zonaDe(data) {
    if (data && data.b) return data.b;
    if (data && data.a && /\bCABA\b/i.test(data.a)) return "CABA";
    return "";
  }
  function iniciales(n) {
    var p = String(n || "").trim().split(/\s+/).filter(Boolean);
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
  function money(n) {
    return "$" + Number(n).toLocaleString("es-AR");
  }
  function setAll(sel, text) {
    qq(sel).forEach(function (el) { el.textContent = text == null ? "" : String(text); });
  }
  function tituloDe(data, rubro) {
    var z = zonaDe(data);
    var nom = rubro && rubro.nombre ? rubro.nombre : "Servicio";
    if (z) return nom + " en " + z;
    return nom;
  }
  function leadDe(data, rubro) {
    var z = zonaDe(data) || (data && data.a) || "";
    var lead = (rubro && rubro.lead) || "Trabajos a domicilio en {zona}.";
    return lead.replace(/\{zona\}/g, z || "tu zona");
  }

  function pintarTextos(data, rubro) {
    var nombre = data.n || rubro.nombre || "Web de ejemplo";
    var zona = zonaDe(data);
    var rubroNom = rubro.nombre || "";
    document.title = nombre + " | " + rubroNom;
    setAll("[data-nombre]", nombre);
    setAll("[data-rubro]", rubroNom);
    setAll("[data-zona]", zona || (data.a ? data.a : "tu zona"));
    setAll("[data-titulo]", tituloDe(data, rubro));
    setAll("[data-lead]", leadDe(data, rubro));
    setAll("[data-iniciales]", iniciales(nombre));
    setAll("[data-profesion]", rubroNom + (zona ? " · " + zona : ""));
    var year = String(new Date().getFullYear());
    setAll("#year", year);

    var dir = data.a || "";
    setAll("[data-dir]", dir);
    qq("[data-hide-if=dir]").forEach(function (el) { show(el, !!dir); });
    var hora = data.h || "";
    setAll("[data-hora]", hora);
    qq("[data-hide-if=hora]").forEach(function (el) { show(el, !!hora); });

    var tel = data.p || "";
    setAll("[data-tel]", tel ? (tel.length === 10 ? tel.slice(0, 2) + " " + tel.slice(2, 6) + "-" + tel.slice(6) : tel) : "");
    qq("[data-hide-if=tel]").forEach(function (el) { show(el, !!tel); });

    var rating = ratingTxt(data.s);
    var cant = data.v ? String(data.v) : "";
    setAll("[data-rating]", rating);
    setAll("[data-reviews-count]", cant);
    setAll("[data-stars]", data.s ? stars(data.s) : "");
    qq("[data-hide-if=rating]").forEach(function (el) { show(el, !!rating); });
  }

  function pintarConfianza(rubro) {
    var items = (rubro.confianza || []).slice(0, 3);
    qq(".app-trust-pills, .trustline").forEach(function (pills) {
      pills.innerHTML = items.map(function (t) { return "<span>✓ " + esc(t) + "</span>"; }).join("");
      show(pills, items.length > 0);
    });
  }

  function pintarServicios(rubro, data) {
    var grupo = root.EjemploGrupos && EjemploGrupos.hogar;
    var servicios = (grupo && grupo.serviciosDe) ? grupo.serviciosDe(rubro, data) : ((rubro && rubro.servicios) || []);
    var track = q(".services-track");
    if (track) {
      var fotos = qq("img.service-photo", track).map(function (img) { return { src: img.getAttribute("src"), alt: img.getAttribute("alt") || "" }; });
      var icons = qq(".icon", track).map(function (ic) { return ic.innerHTML; });
      var plantilla = q("article.service, .service", track);
      var tag = plantilla && plantilla.tagName ? plantilla.tagName.toLowerCase() : "article";
      var cls = plantilla && plantilla.className ? plantilla.className : "service";
      track.innerHTML = servicios.map(function (s, i) {
        var foto = fotos.length ? fotos[i % fotos.length] : null;
        var icon = icons.length ? icons[i % icons.length] : "";
        var img = foto
          ? '<img class="service-photo" src="' + esc(foto.src) + '" alt="' + esc(s.h || s.tag || "") + '" loading="lazy" decoding="async">'
          : "";
        var ic = icon ? '<div class="icon">' + icon + "</div>" : "";
        return "<" + tag + ' class="' + esc(cls) + '">' + img + ic + "<h3>" + esc(s.h || s.tag || "") + "</h3><p>" + esc(s.p || "") + "</p></" + tag + ">";
      }).join("");
    }
    var specs = q("#detalle-servicios");
    if (specs && q(".specialty-row", specs)) {
      var title = q(".profile-section-title", specs);
      var rows = servicios.map(function (s) {
        return '<div class="specialty-row"><span class="specialty-icon">•</span><span class="specialty-copy"><b>' +
          esc(s.h || s.tag || "") + "</b><small>" + esc(s.p || "") + "</small></span></div>";
      }).join("");
      specs.innerHTML = (title ? title.outerHTML : "") + rows;
    }
    qq(".service-card").forEach(function (card, i) {
      if (i >= servicios.length) { card.hidden = true; return; }
      var s = servicios[i];
      card.hidden = false;
      card.dataset.service = String(i);
      var h = q("h3", card); if (h) h.textContent = s.h || s.tag || "";
      var p = q("p", card); if (p) p.textContent = s.p || "";
    });
    // chips de búsqueda (plantilla 5): un chip por servicio
    var chipBox = q(".app-chips") || (q(".app-chip") && q(".app-chip").parentElement);
    if (chipBox && q(".app-chip", chipBox)) {
      chipBox.innerHTML = servicios.map(function (s, i) {
        return '<button type="button" class="app-chip" data-service="' + i + '">' + esc(s.h || s.tag || "") + "</button>";
      }).join("");
    }
    var statServ = q("[data-stat-servicios]");
    if (statServ) statServ.textContent = String(servicios.length);
  }

  function pintarResenas(data) {
    if (root.EjemploGrupos && EjemploGrupos.hogar && EjemploGrupos.hogar.pintarSello) EjemploGrupos.hogar.pintarSello(data);
    var lista = Array.isArray(data.e) ? data.e : [];
    var bloques = qq("[data-reviews]");
    if (bloques.length) {
      bloques.forEach(function (box) {
        if (!lista.length) { box.innerHTML = ""; show(box, false); return; }
        var itemCls = box.getAttribute("data-review-item") || "review-quote";
        box.innerHTML = lista.slice(0, 6).map(function (r) {
          var nom = r && r[0] ? r[0] : "";
          var txt = r && r[1] ? r[1] : "";
          var st = r && r[2] ? stars(r[2]) : stars(data.s || 5);
          var fallback = (root.EjemploGrupos && EjemploGrupos.hogar && EjemploGrupos.hogar.esGoogle && !EjemploGrupos.hogar.esGoogle(data)) ? "Cliente" : "Reseña publicada en Google";
          return '<article class="' + esc(itemCls) + '"><div class="stars-small">' + st + "</div><p>“" + esc(txt) +
            "”</p><small>" + esc(nom || fallback) + "</small></article>";
        }).join("");
        show(box, true);
      });
    }
    var listado = q("[data-reviews-list]");
    if (listado) {
      if (!lista.length) { listado.innerHTML = ""; show(listado, false); }
      else {
        listado.innerHTML = lista.slice(0, 6).map(function (r) {
          var nom = r && r[0] ? r[0] : "Cliente";
          var txt = r && r[1] ? r[1] : "";
          var st = r && r[2] ? stars(r[2]) : stars(data.s || 5);
          return '<div class="review-item"><span class="review-icon">✓</span><span class="review-copy"><b>' +
            esc(nom) + "</b><small>" + esc(txt) + '</small></span><span class="review-stars-small">' + st + "</span></div>";
        }).join("");
        show(listado, true);
      }
    }
    qq("[data-hide-if=reviews]").forEach(function (el) { show(el, lista.length > 0 || !!data.s); });
    qq("[data-hide-if=reviews-text]").forEach(function (el) { show(el, lista.length > 0); });
  }

  function pintarMapa(data) {
    var href = "";
    if (data.y && data.x) href = "https://www.google.com/maps?q=" + encodeURIComponent(data.y + "," + data.x);
    else if (data.a) href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(data.a);
    qq("a[data-maps], a[href*='maps.app.goo.gl'], a[href*='google.com/maps']").forEach(function (a) {
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; }
      else show(a, false);
    });
    var iframe = q("iframe.map-frame, iframe[data-map], #mapBox iframe");
    if (iframe) {
      if (href) {
        var qmap = (data.y && data.x) ? (data.y + "," + data.x) : data.a;
        iframe.src = "https://maps.google.com/maps?q=" + encodeURIComponent(qmap) + "&hl=es&z=16&output=embed";
        iframe.title = "Mapa de " + (data.n || "la zona");
        show(iframe, true);
      } else show(iframe, false);
    }
    qq("[data-hide-if=mapa]").forEach(function (el) { show(el, !!href); });
  }

  function pintarWhatsapp(data) {
    var base = waMe(waNum(data));
    var nombre = data.n || "";
    var msg = "Hola, vi la web de " + nombre + " y quiero consultar.";
    qq('a[href*="wa.me"], a[data-wa], #calc-whatsapp, #calc-wa, #send-whatsapp').forEach(function (a) {
      if (!base) { show(a, false); return; }
      a.href = base + "?text=" + encodeURIComponent(msg);
      a.target = "_blank";
      a.rel = "noopener";
      show(a, true);
    });
    qq('a[href^="tel:"]').forEach(function (a) {
      if (data.p) a.href = "tel:" + (/^\s*\+/.test(String(data.p)) ? "+" : "") + String(data.p).replace(/\D/g, "");
      else show(a, false);
    });
    qq("[data-hide-if=wa]").forEach(function (el) { show(el, !!base); });
  }

  function montarCalc(rubro, data) {
    var cats = (rubro && rubro.calc) || [];
    var service = q("#calc-service");
    var type = q("#calc-type");
    if (!service || !type || !cats.length) return;
    service.innerHTML = cats.map(function (c, i) {
      return '<option value="' + i + '">' + esc(c.n) + "</option>";
    }).join("");
    function jobs() {
      var c = cats[Number(service.value) || 0] || cats[0];
      return (c && c.j) || [];
    }
    function llenarTipos() {
      type.innerHTML = jobs().map(function (j, i) {
        return '<option value="' + i + '">' + esc(j[0]) + "</option>";
      }).join("");
    }
    function actual() {
      var j = jobs()[Number(type.value) || 0];
      return j || ["Trabajo", 0];
    }
    function moneyTxt(n) { return money(n); }
    function pintarPrecio() {
      var j = actual();
      var txt = j[1] ? "desde " + moneyTxt(j[1]) : "A evaluar";
      if (q("#calc-price")) q("#calc-price").textContent = txt;
      if (q("#estimate")) q("#estimate").textContent = txt;
      var nota = "Los precios son de ejemplo, orientativos, y no son una tarifa del negocio.";
      if (q("#calc-note")) q("#calc-note").textContent = nota;
      if (q("#calc-output")) {
        q("#calc-output").textContent = j[1]
          ? ("Estimación ilustrativa: " + moneyTxt(j[1]) + " (desde). " + nota)
          : nota;
        q("#calc-output").style.display = "block";
      }
    }
    function hrefWa() {
      var base = waMe(waNum(data));
      if (!base) return "";
      var j = actual();
      var cat = (cats[Number(service.value) || 0] || {}).n || "";
      var det = q("#calc-detail") ? String(q("#calc-detail").value || "").trim() : "";
      var zona = q("#calc-zone") ? String(q("#calc-zone").value || "").trim() : "";
      var quien = q("#calc-name") ? String(q("#calc-name").value || "").trim() : "";
      var partes = [
        "Hola, vi la web de " + (data.n || "") + " y quiero consultar:",
        "• " + cat,
        "• " + j[0],
      ];
      if (zona) partes.push("• Zona: " + zona);
      if (quien) partes.push("• Nombre: " + quien);
      if (det) partes.push("• " + det);
      if (j[1]) partes.push("• Número de ejemplo en la web: desde " + moneyTxt(j[1]));
      partes.push("(Es un precio de ejemplo, no un presupuesto cerrado.)");
      return base + "?text=" + encodeURIComponent(partes.join("\n"));
    }
    function syncWa() {
      var href = hrefWa();
      ["#calc-whatsapp", "#calc-wa", "#send-whatsapp"].forEach(function (sel) {
        var a = q(sel);
        if (!a) return;
        if (!href) { show(a, false); return; }
        show(a, true);
        if (a.tagName === "A") { a.href = href; a.target = "_blank"; a.rel = "noopener"; }
      });
    }
    llenarTipos();
    pintarPrecio();
    syncWa();
    service.addEventListener("change", function () { llenarTipos(); pintarPrecio(); syncWa(); });
    type.addEventListener("change", function () { pintarPrecio(); syncWa(); });
    var det = q("#calc-detail"); if (det) det.addEventListener("input", syncWa);
    var zone = q("#calc-zone"); if (zone) { if (!zone.value && zonaDe(data)) zone.value = zonaDe(data); zone.addEventListener("input", syncWa); }
    var btn = q("#calc-button");
    if (btn) btn.addEventListener("click", function () { pintarPrecio(); syncWa(); var out = q("#calc-output"); if (out) out.style.display = "block"; });
    var send = q("#send-whatsapp");
    if (send) send.addEventListener("click", function (ev) {
      var href = hrefWa();
      if (!href) { ev.preventDefault(); return; }
      if (send.tagName === "BUTTON") {
        ev.preventDefault();
        window.location.href = href;
      } else send.href = href;
    });
  }

  function initCarrusel() {
    var track = q(".services-track");
    if (!track) return;
    var cards = qq(".service, article.service", track);
    var dotsWrap = q("#service-dots");
    var prev = q("#service-prev");
    var next = q("#service-next");
    if (!cards.length) return;
    cards.forEach(function (c, i) { c.classList.toggle("is-active", i === 0); });
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      cards.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", "Ver servicio " + (i + 1));
        dot.addEventListener("click", function () { go(i); });
        dotsWrap.appendChild(dot);
      });
    }
    var current = 0, timer = null;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function go(index) {
      if (!cards.length) return;
      current = (index + cards.length) % cards.length;
      cards.forEach(function (card, i) { card.classList.toggle("is-active", i === current); });
      qq(".carousel-dot", dotsWrap).forEach(function (dot, i) {
        dot.setAttribute("aria-current", i === current ? "true" : "false");
      });
    }
    function restart() {
      if (timer) clearInterval(timer);
      if (!reduced && cards.length > 1) timer = setInterval(function () { go(current + 1); }, 3500);
    }
    if (prev) prev.addEventListener("click", function () { go(current - 1); restart(); });
    if (next) next.addEventListener("click", function () { go(current + 1); restart(); });
    go(0);
    restart();
    var chips = qq(".app-chip[data-service]");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var idx = Number(chip.getAttribute("data-service"));
        if (isFinite(idx)) go(idx);
        chips.forEach(function (c) { c.classList.toggle("active", c === chip); });
      });
    });
    var search = q("#service-search");
    if (search) {
      search.addEventListener("input", function () {
        var qry = search.value.trim().toLocaleLowerCase("es");
        if (!qry) return;
        var idx = cards.findIndex(function (c) { return (c.innerText || "").toLocaleLowerCase("es").indexOf(qry) >= 0; });
        if (idx >= 0) go(idx);
      });
    }
  }

  function imgsRotas() {
    qq("img").forEach(function (img) {
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
    });
  }

  async function arrancar() {
    var data = root.__EJEMPLO_DATA__ || null;
    if (!data) {
      try { data = await EjemploCodec.cargar(location); } catch (e) { data = null; }
    }
    var grupo = root.EjemploGrupos && EjemploGrupos.hogar;
    var rubro = data && grupo && grupo.porId(data.k);
    var vacio = q("#vacio");
    var sitio = q("#sitio");
    if (!data || !rubro) {
      show(sitio, false);
      show(vacio, true);
      document.title = "Web de ejemplo";
      return;
    }
    show(vacio, false);
    show(sitio, true);
    pintarTextos(data, rubro);
    pintarConfianza(rubro);
    pintarServicios(rubro, data);
    pintarResenas(data);
    pintarMapa(data);
    pintarWhatsapp(data);
    montarCalc(rubro, data);
    initCarrusel();
    imgsRotas();
  }

  root.EjemploAplicar = {
    arrancar: arrancar,
    zonaDe: zonaDe,
    waMe: waMe,
    waNum: waNum,
    iniciales: iniciales,
    stars: stars,
    ratingTxt: ratingTxt,
    tituloDe: tituloDe,
    leadDe: leadDe,
  };
  if (doc()) {
    if (doc().body) arrancar();
    else doc().addEventListener("DOMContentLoaded", arrancar);
  }
})(typeof window !== "undefined" ? window : globalThis);
