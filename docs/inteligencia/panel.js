/* Panel de Inteligencia comercial IMPULSA — interfaz. Lee impulsa_resultados_v1 (mismos datos que la Fábrica). */
(function () {
  const I = window.impulsaIntel;
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let externo = null; // datos de un archivo (solo lectura)
  let propuestas = I.cargarPropuestas();

  function local() { try { return JSON.parse(localStorage.getItem(I.LS_RES) || "{}") || {}; } catch (x) { return {}; } }
  function datos() { return externo || local(); }

  const WEB = { con_web: "Con sitio web", sin_web: "Sin sitio web", sin_dato: "Sin dato" };
  function etiqueta(dim, v, fila) {
    if (v === "sin_dato" || v === "") return dim === "resultado" ? "Sin resultado cargado" : "Sin dato";
    if (dim === "tipo_empresa") return I.label(I.TIPOS_EMPRESA, v);
    if (dim === "resultado") return I.resultadoLabel(v);
    if (dim === "motivo") return I.label(I.MOTIVOS, v);
    if (dim === "sitio_web") return WEB[v] || v;
    if (dim === "propuesta") { const p = propuestas.find((x) => x.id === v); return p ? p.nombre : (fila && fila.nombre_guardado) || v; }
    return v;
  }
  const DIMLBL = Object.fromEntries(I.DIMENSIONES);
  const t = (x, n) => e(I.tasa(x, n));

  function render() {
    const A = I.analizar(datos());
    // nombres de propuestas guardados en los contactos (por si vienen de otro dispositivo)
    const nombres = {}; A.filas.forEach((f) => { if (f.propuesta !== "sin_dato" && f.propuesta_nombre) nombres[f.propuesta] = f.propuesta_nombre; });
    const lbl = (dim, v) => etiqueta(dim, v, { nombre_guardado: nombres[v] });
    const T = A.total;
    $("kpis").innerHTML = [["Prospectos guardados", A.prospectos, ""], ["Contactados", T.contactos, ""], ["Respuestas positivas", T.positivas, t(T.positivas, T.contactos)],
      ["Reuniones", T.reuniones, t(T.reuniones, T.contactos)], ["Ventas", T.ventas, t(T.ventas, T.contactos)], ["Rechazos", T.rechazos, t(T.rechazos, T.contactos)],
      ["No responde", T.sin_respuesta, t(T.sin_respuesta, T.contactos)]]
      .map(([a, b, c]) => "<div class=\"kpi\"><small>" + e(a) + "</small><b>" + e(b) + "</b><small>" + c + "</small></div>").join("");
    $("regla").textContent = "Solo se cuentan datos cargados. Grupos con menos de " + A.min_muestra + " contactos: datos insuficientes (fuera de rankings).";

    // Panel
    let p = "";
    if (!T.contactos) p = "<p class=\"aviso\">Todavía no hay contactos registrados. Cargalos desde la ficha de cada prospecto: IMPULSA → ficha → «Registrar contacto».</p>";
    else if (!A.mejores.length) p = "<p class=\"aviso\">Ningún segmento llega todavía a " + A.min_muestra + " contactos, así que no hay ranking ni recomendación. Seguí registrando resultados.</p>";
    else {
      const top = A.mejores[0];
      p += "<p class=\"aviso\">Con los datos cargados, el segmento con mayor tasa de respuestas positivas es <b>" + e(DIMLBL[top.dimension]) + ": " + e(lbl(top.dimension, top.valor)) + "</b> — " + t(top.positivas, top.contactos) +
        ". Es lo observado hasta hoy, no una probabilidad ni prueba de que sea rentable" + (top.ventas ? "" : " (todavía sin ventas en ese segmento)") + ".</p>";
      const tabla = (lista, campo) => "<div class=\"scroll\"><table><tr><th>Segmento</th><th class=\"n\">Contactos</th><th class=\"n\">" + (campo === "positivas" ? "Positivas" : "Rechazos") + "</th><th class=\"n\">Ventas</th></tr>" +
        lista.map((g) => "<tr><td><span class=\"tag\">" + e(DIMLBL[g.dimension]) + "</span> " + e(lbl(g.dimension, g.valor)) + "</td><td class=\"n\">" + g.contactos + "</td><td class=\"n\">" + t(g[campo], g.contactos) + "</td><td class=\"n\">" + t(g.ventas, g.contactos) + "</td></tr>").join("") + "</table></div>";
      p += "<h2 class=\"ok\">Mejores resultados</h2>" + tabla(A.mejores, "positivas");
      p += "<h2 class=\"bad\" style=\"margin-top:14px\">Más rechazos</h2>" + (A.masRechazo.length ? tabla(A.masRechazo, "rechazos") : "<p class=\"muted\">Sin rechazos en segmentos con muestra suficiente.</p>");
    }
    if (A.insuficientes.length) p += "<details><summary>Segmentos con datos insuficientes (" + A.insuficientes.length + ")</summary><ul class=\"lista small\">" +
      A.insuficientes.map((g) => "<li>" + e(DIMLBL[g.dimension]) + ": " + e(lbl(g.dimension, g.valor)) + " · " + g.contactos + " contacto" + (g.contactos === 1 ? "" : "s") + "</li>").join("") + "</ul></details>";
    $("panel").innerHTML = p;

    // Experimentos
    const exps = A.experimentos;
    const sinProp = (A.por.propuesta.find((g) => g.valor === "sin_dato") || {}).contactos || 0;
    $("experimentos").innerHTML = (exps.length ? "<div class=\"scroll\"><table><tr><th>Propuesta</th><th class=\"n\">Contactos</th><th class=\"n\">Positivas</th><th class=\"n\">Reuniones</th><th class=\"n\">Ventas</th><th class=\"n\">Rechazos</th></tr>" +
      exps.map((g) => "<tr" + (g.suficiente ? "" : " class=\"ins\"") + "><td>" + e(lbl("propuesta", g.valor)) + "</td><td class=\"n\">" + g.contactos + "</td><td class=\"n\">" + t(g.positivas, g.contactos) + "</td><td class=\"n\">" + t(g.reuniones, g.contactos) +
        "</td><td class=\"n\">" + t(g.ventas, g.contactos) + "</td><td class=\"n\">" + t(g.rechazos, g.contactos) + "</td></tr>").join("") + "</table></div>" +
      (exps.filter((g) => g.suficiente).length < 2 ? "<p class=\"hint\">Para comparar hacen falta al menos 2 propuestas con " + A.min_muestra + " contactos o más cada una.</p>" : "<p class=\"hint\">Diferencia observada entre propuestas; con muestras chicas puede ser casualidad. Probá cada propuesta en rubros parecidos para que la comparación sea justa.</p>")
      : "<p class=\"muted\">Todavía no hay contactos con una propuesta asignada.</p>") + (sinProp ? "<p class=\"hint\">" + sinProp + " contacto(s) sin propuesta asignada no entran en la comparación.</p>" : "");
    $("propLista").innerHTML = propuestas.length ? propuestas.map((x) => "<li><b>" + e(x.nombre) + "</b>" + (x.descripcion ? "<br><span class=\"muted small\">" + e(x.descripcion) + "</span>" : "") + "</li>").join("") : "<li class=\"muted\">No hay propuestas creadas.</li>";

    // Tabla por dimensión
    const d = $("dim").value || "rubro";
    const grupos = A.por[d] || [];
    $("tabla").innerHTML = (d === "sitio_web" ? "<p class=\"hint\">Tener o no tener web es un dato del negocio. No indica intención de compra.</p>" : "") +
      (grupos.length ? "<div class=\"scroll\"><table><tr><th>" + e(DIMLBL[d]) + "</th><th class=\"n\">Contactos</th><th class=\"n\">Positivas</th><th class=\"n\">Reuniones</th><th class=\"n\">Ventas</th><th class=\"n\">Rechazos</th></tr>" +
        grupos.map((g) => "<tr" + (g.suficiente ? "" : " class=\"ins\"") + "><td>" + e(lbl(d, g.valor)) + "</td><td class=\"n\">" + g.contactos + "</td><td class=\"n\">" + t(g.positivas, g.contactos) + "</td><td class=\"n\">" + t(g.reuniones, g.contactos) +
          "</td><td class=\"n\">" + t(g.ventas, g.contactos) + "</td><td class=\"n\">" + t(g.rechazos, g.contactos) + "</td></tr>").join("") + "</table></div>" : "<p class=\"muted\">Sin contactos.</p>");

    $("objeciones").innerHTML = A.objeciones.length ? "<ul class=\"lista small\">" + A.objeciones.slice(0, 15).map(([o, n]) => "<li>" + e(o) + " · " + n + " vez" + (n === 1 ? "" : "es") + "</li>").join("") + "</ul>" : "<p class=\"muted\">Sin objeciones cargadas.</p>";
    $("seguimientos").innerHTML = A.seguimientos.length ? "<ul class=\"lista small\">" + A.seguimientos.slice(0, 30).map((s) => "<li" + (s.vencido ? " class=\"bad\"" : "") + "><b>" + e(s.proximo_seguimiento) + "</b>" + (s.vencido ? " (vencido)" : "") + " · " + e(s.nombre) + (s.proxima_accion ? " — " + e(s.proxima_accion) : "") + "</li>").join("") + "</ul>" : "<p class=\"muted\">No hay seguimientos pendientes.</p>";
  }

  $("dim").innerHTML = I.DIMENSIONES.map(([id, l]) => "<option value=\"" + id + "\">" + e(l) + "</option>").join("");
  $("dim").addEventListener("change", render);
  $("propCrear").addEventListener("click", () => {
    try { I.crearPropuesta(propuestas, $("propNombre").value, $("propDesc").value); I.guardarPropuestas(propuestas); $("propNombre").value = ""; $("propDesc").value = ""; render(); }
    catch (x) { alert(x.message); }
  });
  $("archivo").addEventListener("change", (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try { const d = JSON.parse(fr.result); externo = d.resultados || d; $("fuenteTxt").textContent = "Viendo el archivo «" + f.name + "» (solo lectura)."; $("volverLocal").classList.remove("hidden"); render(); }
      catch (x) { alert("JSON inválido: " + x.message); }
    };
    fr.readAsText(f);
  });
  $("volverLocal").addEventListener("click", () => { externo = null; $("archivo").value = ""; $("fuenteTxt").textContent = "Datos de este dispositivo."; $("volverLocal").classList.add("hidden"); render(); });
  window.addEventListener("storage", () => { propuestas = I.cargarPropuestas(); render(); });
  render();
})();
