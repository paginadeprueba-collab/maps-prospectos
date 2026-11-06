/* Investigador Comercial IMPULSA — UI (se carga después del script principal de Fábrica).
 * No modifica el buscador: solo lee docs/data/*.json y llama POST /investigar del Worker.
 * Resultados en localStorage del dispositivo (export/import JSON para pasar entre Android y PC). */
(function () {
  const LS_RES = "impulsa_resultados_v1";
  const LOTE = 10;
  const DIAS_CACHE = 7;
  const IMPULSA_WORKER_URL = "https://impulsa-investigador.lagosscarlos44.workers.dev";
  const API = (IMPULSA_WORKER_URL || (typeof WORKER_URL !== "undefined" ? WORKER_URL : "")).replace(/\/$/, "");
  const $ = (id) => document.getElementById(id);
  function e(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&" + "amp;",
      "<": "&" + "lt;",
      ">": "&" + "gt;",
      '"': "&" + "quot;",
      "'": "&#39;"
    }[c]));
  }

  let resultados = cargar();
  let prospectos = []; // de la búsqueda elegida
  const seleccion = new Set();
  const estado = {}; // key -> en_cola|investigando|listo|error|omitido
  let corriendo = false;

  function cargar() { try { return JSON.parse(localStorage.getItem(LS_RES) || "{}") || {}; } catch { return {}; } }
  function guardar() { localStorage.setItem(LS_RES, JSON.stringify(resultados)); }
  function keyDe(p) { return (p.link_maps || "").split("?")[0].replace(/\/$/, "") || p.nombre || ""; }
  function fresco(k) {
    const r = resultados[k];
    return r && r.investigado_en && Date.now() - Date.parse(r.investigado_en) < DIAS_CACHE * 864e5;
  }
  function fechaAR(iso) {
    try { return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) + " (hora Argentina)"; } catch { return iso; }
  }

  /* ---------- vistas ---------- */
  window.impulsaShow = function (hash) {
    ["viewList", "viewDetail"].forEach((v) => $(v) && $(v).classList.add("hidden"));
    $("viewImpulsa").classList.remove("hidden");
    const m = hash.match(/^#\/impulsa\/f\/(.+)$/);
    const sub = m ? "ficha" : hash === "#/impulsa/oportunidades" ? "oportunidades" : "investigacion";
    document.querySelectorAll(".imp-tab").forEach((t) => t.classList.toggle("active", t.dataset.sub === sub));
    ["impInvestigacion", "impOportunidades", "impFicha"].forEach((id) => $(id).classList.add("hidden"));
    if (sub === "investigacion") { $("impInvestigacion").classList.remove("hidden"); poblarBusquedas(); }
    if (sub === "oportunidades") { $("impOportunidades").classList.remove("hidden"); renderOportunidades(); }
    if (sub === "ficha") { $("impFicha").classList.remove("hidden"); renderFicha(decodeURIComponent(m[1])); }
    window.scrollTo(0, 0);
  };
  window.impulsaHide = function () { $("viewImpulsa") && $("viewImpulsa").classList.add("hidden"); };

  /* ---------- Investigación ---------- */
  async function poblarBusquedas() {
    const sel = $("impBusqueda");
    if (sel.options.length > 1) return;
    let idx = (typeof indexData !== "undefined" && indexData && indexData.searches) ? indexData : null;
    if (!idx) { try { idx = await (await fetch("./data/index.json?t=" + Date.now())).json(); } catch { idx = { searches: [] }; } }
    (idx.searches || []).forEach((s) => {
      const o = document.createElement("option");
      o.value = s.file; o.textContent = `${s.query} · ${s.n_limpio ?? "?"} prospectos`;
      sel.appendChild(o);
    });
  }
  async function cargarBusqueda() {
    const f = $("impBusqueda").value;
    seleccion.clear(); prospectos = [];
    if (!f) return renderProspectos();
    try { prospectos = ((await (await fetch("./data/" + f + "?t=" + Date.now())).json()).prospects) || []; }
    catch { prospectos = []; }
    renderProspectos();
  }
  function renderProspectos() {
    const box = $("impLista");
    box.innerHTML = "";
    $("impCount").textContent = prospectos.length ? `${prospectos.length} prospectos · ${seleccion.size} seleccionados (máx. ${LOTE} por lote)` : "Elegí una búsqueda de Fábrica.";
    prospectos.forEach((p) => {
      const k = keyDe(p);
      const r = resultados[k];
      const st = estado[k] || (r ? (fresco(k) ? "listo" : "vencido") : "pendiente");
      const row = document.createElement("label");
      row.className = "imp-row";
      row.innerHTML = `<input type="checkbox" ${seleccion.has(k) ? "checked" : ""} />
        <span class="imp-main"><strong>${e(p.nombre)}</strong><small>${e(p.rating || "–")}★ · ${e(p.reseñas || 0)} reseñas · ${e(p.categoria || "")}</small></span>
        <span class="imp-st st-${st}">${st}${r && r.puntuacion ? " · " + r.puntuacion.score : ""}</span>`;
      row.querySelector("input").addEventListener("change", (ev) => {
        if (ev.target.checked) seleccion.add(k); else seleccion.delete(k);
        renderProspectos();
      });
      if (r) row.querySelector(".imp-st").addEventListener("click", (ev) => { ev.preventDefault(); location.hash = "#/impulsa/f/" + encodeURIComponent(k); });
      box.appendChild(row);
    });
  }
  function seleccionarSiguientes() {
    seleccion.clear();
    const forzar = $("impForzar").checked;
    for (const p of prospectos) {
      const k = keyDe(p);
      if (!forzar && fresco(k)) continue;
      seleccion.add(k);
      if (seleccion.size >= LOTE) break;
    }
    renderProspectos();
  }
  async function investigar() {
    if (corriendo) return;
    if (!API) return msg("Falta WORKER_URL configurado.", true);
    const forzar = $("impForzar").checked;
    const elegidos = prospectos.filter((p) => seleccion.has(keyDe(p)));
    const aCorrer = [];
    for (const p of elegidos) {
      const k = keyDe(p);
      if (!forzar && fresco(k)) { estado[k] = "omitido"; continue; }
      estado[k] = "en_cola"; aCorrer.push(p);
    }
    renderProspectos();
    if (!aCorrer.length) return msg("Nada para investigar (analizados hace menos de 7 días; marcá «Forzar» para repetir).");
    corriendo = true; $("impBtnInvestigar").disabled = true;
    try {
      for (let i = 0; i < aCorrer.length; i += LOTE) {
        const lote = aCorrer.slice(i, i + LOTE);
        lote.forEach((p) => (estado[keyDe(p)] = "investigando"));
        renderProspectos();
        msg(`Investigando ${lote.length} negocio(s)…`);
        let data;
        try {
          const res = await fetch(API + "/investigar", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prospectos: lote.map((p) => ({ ...p, key: keyDe(p) })) }),
          });
          data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
        } catch (err) {
          lote.forEach((p) => (estado[keyDe(p)] = "error"));
          msg("Error del Worker: " + err.message + " (¿está desplegado /investigar?)", true);
          continue;
        }
        (data.resultados || []).forEach((r) => {
          const p = lote.find((x) => keyDe(x) === r.key) || {};
          resultados[r.key] = { ...r, origen: { busqueda: $("impBusqueda").value, prospecto: p } };
          estado[r.key] = r.error ? "error" : "listo";
        });
        guardar();
        renderProspectos();
      }
      msg("Listo. Mirá «Oportunidades».");
    } finally { corriendo = false; $("impBtnInvestigar").disabled = false; }
  }
  function msg(t, err) { const m = $("impMsg"); m.textContent = t; m.style.color = err ? "var(--danger)" : "var(--muted)"; }

  /* ---------- Oportunidades ---------- */
  function lista() { return Object.values(resultados).filter((r) => r && r.puntuacion); }
  function renderOportunidades() {
    const filtro = $("impBanda").value;
    const rows = lista().filter((r) => !filtro || r.puntuacion.banda.id === filtro)
      .sort((a, b) => b.puntuacion.score - a.puntuacion.score);
    const box = $("impOpps");
    box.innerHTML = rows.length ? "" : `<div class="empty"><strong>Sin resultados</strong>Investigá prospectos en la pestaña Investigación.</div>`;
    rows.forEach((r) => {
      const a = document.createElement("a");
      a.className = "search-item"; a.style.textDecoration = "none";
      a.href = "#/impulsa/f/" + encodeURIComponent(r.key);
      a.innerHTML = `<div class="q">${e(r.nombre?.valor)} <span class="imp-score b-${r.puntuacion.banda.id}">${r.puntuacion.score}</span></div>
        <div class="meta">${e(r.puntuacion.banda.label)} · confianza ${r.puntuacion.confianza}% · ${e((r.puntuacion.servicios || [])[0] || "")}</div>`;
      box.appendChild(a);
    });
  }

  /* ---------- Ficha ---------- */
  function filaDato(label, d, fmt) {
    if (!d) return "";
    const v = d.tipo === "no_disponible" ? "<em>no disponible</em>" : fmt ? fmt(d.valor) : e(typeof d.valor === "object" ? JSON.stringify(d.valor) : d.valor);
    const src = d.fuente && /^https?:/.test(d.fuente) ? `<a href="${e(d.fuente)}" target="_blank" rel="noopener">fuente</a>` : e(d.fuente || "");
    return `<tr><th>${e(label)}</th><td>${v}<div class="imp-ev"><span class="t-${d.tipo}">${e(d.tipo)}</span> · ${src} · ${e(fechaAR(d.fecha))}${d.nota ? "<br>" + e(d.nota) : ""}</div></td></tr>`;
  }
  const link = (u) => `<a href="${e(u)}" target="_blank" rel="noopener">${e(String(u).replace(/^https?:\/\//, "").slice(0, 60))}</a>`;
  function renderFicha(k) {
    const r = resultados[k];
    const box = $("impFicha");
    if (!r) { box.innerHTML = `<div class="empty"><strong>No hay investigación para este negocio</strong></div>`; return; }
    const pu = r.puntuacion || {};
    const cw = r.calidad_web && r.calidad_web.tipo !== "no_disponible" ? r.calidad_web.valor : null;
    box.innerHTML = `
      <a href="#/impulsa/oportunidades" class="back">← Oportunidades</a>
      <div class="panel">
        <h2 class="hero">${e(r.nombre?.valor)}</h2>
        <p class="lead">${e(r.categoria?.valor || "")} · ${e(r.direccion?.valor || "")}</p>
        <p><span class="imp-score b-${pu.banda?.id}">${pu.score ?? "–"}</span> ${e(pu.banda?.label || "")} · confianza ${pu.confianza ?? "–"}%</p>
        <p class="hint">Componentes: ${Object.entries(pu.componentes || {}).map(([k, v]) => e(k.replace("_", " ") + " " + v)).join(" · ")}</p>
        ${pu.motivos?.length ? `<p class="section-title">Por qué</p><ul>${pu.motivos.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}
        ${pu.problemas?.length ? `<p class="section-title">Problemas encontrados</p><ul>${pu.problemas.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}
        <p class="section-title">Servicios recomendados</p><ul>${(pu.servicios || []).map((x) => `<li>${e(x)}</li>`).join("")}</ul>
        <p class="hint">${e(pu.nota || "")}</p>
      </div>
      <div class="panel"><table class="imp-tbl">
        ${filaDato("Teléfono", r.telefono)}
        ${filaDato("WhatsApp", r.whatsapp, link)}
        ${filaDato("Google Maps", r.google_maps, link)}
        ${filaDato("Rating", r.rating)}
        ${filaDato("Reseñas", r.resenas)}
        ${filaDato("Página web", r.website, (v) => link(v))}
        ${cw ? `<tr><th>Calidad web</th><td>HTTP ${e(cw.status)} · ${cw.https ? "HTTPS" : "sin HTTPS"} · ${cw.viewport ? "viewport ok" : "sin viewport"} · ${e(cw.html_bytes)} bytes · ${e(cw.tiempo_ms)} ms<div class="imp-ev">${e(cw.nota)}</div></td></tr>` : filaDato("Calidad web", r.calidad_web)}
        ${filaDato("Agenda / turnos", r.agenda)}
        ${filaDato("Formulario", r.formulario)}
        ${filaDato("Emails", r.emails, (v) => e(v.join(", ")))}
        ${Object.entries(r.redes || {}).map(([red, d]) => filaDato(red, d, link)).join("")}
        ${filaDato("Instagram: seguidores", r.instagram_seguidores)}
        ${filaDato("Instagram: publicaciones", r.instagram_publicaciones)}
        ${filaDato("Facebook: seguidores", r.facebook_seguidores)}
        <tr><th>Publicidad Meta</th><td><em>no disponible</em> · <a href="${e(r.meta_ads?.fuente)}" target="_blank" rel="noopener">Abrir Meta Ads Library</a><div class="imp-ev">${e(r.meta_ads?.nota || "")}</div></td></tr>
      </table>
      <p class="hint">Investigado: ${e(fechaAR(r.investigado_en))}${r.errores?.length ? " · Errores: " + e(r.errores.join("; ")) : ""}</p>
      <div class="toolbar"><input id="impWeb" class="field" style="min-height:44px;flex:1" placeholder="¿Conocés su web? https://…" value="${e(r.origen?.prospecto?.website || "")}" />
      <button type="button" class="btn btn-primary btn-sm" id="impReinv">Re-investigar</button></div></div>`;
    $("impReinv").addEventListener("click", async () => {
      const p = { ...(r.origen?.prospecto || {}), key: k, website: $("impWeb").value.trim() };
      if (!p.nombre) p.nombre = r.nombre?.valor;
      $("impReinv").disabled = true;
      try {
        const res = await fetch(API + "/investigar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectos: [p] }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || res.status);
        resultados[k] = { ...d.resultados[0], origen: { ...(r.origen || {}), prospecto: p } };
        guardar(); renderFicha(k);
      } catch (err) { alert("Error: " + err.message); $("impReinv").disabled = false; }
    });
  }

  /* ---------- Export / Import ---------- */
  function descargar(nombre, contenido, tipo) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportJson() { descargar("impulsa-investigaciones.json", JSON.stringify({ version: 1, exportado: new Date().toISOString(), resultados }, null, 2), "application/json"); }
  function exportCsv() {
    const cols = ["nombre", "categoria", "telefono", "whatsapp", "google_maps", "website", "instagram", "facebook", "rating", "resenas", "agenda", "score", "banda", "confianza", "servicios", "problemas", "investigado_en"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const v = (d) => (d && d.tipo !== "no_disponible" ? d.valor : "no_disponible");
    const filas = lista().map((r) => [v(r.nombre), v(r.categoria), v(r.telefono), v(r.whatsapp), v(r.google_maps), v(r.website),
      v(r.redes?.instagram) , v(r.redes?.facebook), v(r.rating), v(r.resenas), v(r.agenda),
      r.puntuacion.score, r.puntuacion.banda.id, r.puntuacion.confianza, (r.puntuacion.servicios || []).join(" | "), (r.puntuacion.problemas || []).join(" | "), r.investigado_en].map(q).join(","));
    descargar("impulsa-oportunidades.csv", "\ufeff" + cols.join(",") + "\n" + filas.join("\n"), "text/csv");
  }
  function importJson(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        const nuevos = d.resultados || d;
        let n = 0;
        for (const [k, r] of Object.entries(nuevos)) {
          if (!r || !r.puntuacion) continue;
          const prev = resultados[k];
          if (!prev || Date.parse(r.investigado_en) > Date.parse(prev.investigado_en)) { resultados[k] = r; n++; }
        }
        guardar(); alert(`Importados ${n} resultados.`); renderOportunidades();
      } catch (err) { alert("JSON inválido: " + err.message); }
    };
    fr.readAsText(file);
  }

  /* ---------- wiring ---------- */
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  on("impBusqueda", "change", cargarBusqueda);
  on("impBtnSig", "click", seleccionarSiguientes);
  on("impBtnInvestigar", "click", investigar);
  on("impBanda", "change", renderOportunidades);
  on("impExpJson", "click", exportJson);
  on("impExpCsv", "click", exportCsv);
  on("impImp", "change", (ev) => ev.target.files[0] && importJson(ev.target.files[0]));
  on("btnTopImpulsa", "click", () => { location.hash = "#/impulsa"; });
  if ((location.hash || "").startsWith("#/impulsa")) window.impulsaShow(location.hash);
})();
