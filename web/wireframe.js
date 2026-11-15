/* Presentación por bloques y portal de detalle. No modifica los productos científicos. */
(() => {
  "use strict";
  const el = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const make = (tag, className, html) => { const node = document.createElement(tag); node.className = className; if (html) node.innerHTML = html; return node; };
  const move = (id, parent) => { const node = el(id); if (node) parent.appendChild(node); };
  const CHARTS = [
    ["chart", "Agua, vegetación y lluvia", "water", "series.json"],
    ["lakeVegChart", "Vegetación del embalse", "water", "ml.json · ref/reference.json · series.json"],
    ["lakeLvlChart", "Nivel y temperatura del agua", "water", "swot.json · ecostress.json"],
    ["histChart", "Historia del manglar", "mangrove", "ref/gmw.json"],
    ["mangChart", "Comparación entre manglares", "mangrove", "mangrove_comparison.json"],
    ["wfRadarChart", "HH / HV medios del área válida", "radar", "series.json"],
    ["valChart", "HV por cobertura", "radar", "ref/validation.json"],
    ["probeChart", "HH del punto seleccionado", "radar", "Imágenes HH de series.json"],
    ["mlChart", "Validación del modelo de plantas", "other", "ml.json"],
    ["wqChart", "Índices ópticos del agua", "other", "ref/reference.json"],
    ["caneChart", "Cosecha de caña por mes", "other", "ref/cane.json"],
    ["burnWeekChart", "Quemas por semana", "other", "ref/burns.json"]
  ];
  const header = document.querySelector(".top");
  const region = make("label", "region-picker", '<span>Región:</span>');
  region.appendChild(el("siteSel")); header.insertBefore(region, document.querySelector(".hdr-actions"));
  const modes = make("div", "wf-mode", '<span>Modo:</span><div class="wf-segment"><button type="button" data-expert="false">Vista general</button><button type="button" data-expert="true">Modo científico</button></div>');
  header.insertBefore(modes, document.querySelector(".hdr-actions"));
  el("expertSw").closest("label").classList.add("wf-original-switch");
  el("tourBtn").textContent = "▶ Tutorial";
  const back = make("button", "btn", "← Inicio"); back.type = "button"; back.addEventListener("click", () => { stopPlay(); location.href = "landing.html"; });
  header.querySelector(".hdr-actions").appendChild(back);
  const intro = make("section", "wf-intro", '<h2>Explora los cambios del agua y del manglar</h2><p>Mapa interactivo con datos del sitio seleccionado, comparaciones en el tiempo y evidencia del monitoreo.</p>');
  header.after(intro);

  const blocks = make("section", "wf-blocks"); blocks.setAttribute("aria-label", "Resultados y documentación del sitio");
  function block(id, title, description) {
    const detail = make("details", "wf-block"); detail.id = id;
    detail.innerHTML = `<summary><strong>${title}</strong><span>${description}</span></summary><div class="wf-block-content"></div>`;
    blocks.appendChild(detail); return detail.lastElementChild;
  }
  const results = block("wfResults", "▥ Resultados", "Principales hallazgos del sitio y series temporales.");
  const notices = block("wfNotices", "♧ Detecciones y avisos", "Disponibilidad, detecciones y advertencias de calidad.");
  const hypotheses = block("wfHypotheses", "? ¿Por qué pudo ocurrir?", "Explicaciones posibles y evidencia para las fechas seleccionadas.");
  const science = block("wfScience", "⚗ Información científica", "Métodos, fuentes, validación y acceso a datos o descargas.");
  document.querySelector("main.layout").after(blocks);
  results.appendChild(make("div", "wf-results-head", '<p id="wfResultsSummary">Cargando observaciones del sitio…</p><button type="button" class="btn" id="wfOpenDetail">Ver más detalle →</button>'));
  el("wfOpenDetail").disabled = true;
  el("wfOpenDetail").textContent = "Cargando resultados…";
  move("analysisGrid", results);
  const resultIds = ["rhythmCard", "lakeCard", "caneCard", "histCard", "carbonCard", "pondsCard", "mangCard", "mlCard", "aiCard", "wqCard", "valCard", "probeCard"];
  resultIds.forEach((id) => move(id, el("analysisGrid")));
  // Agrupar cada gráfica con su explicación sin duplicar canvas ni instancias.
  ["lakeCard", "caneCard"].forEach((id) => {
    const card = el(id);
    const charts = [...card.querySelectorAll(":scope > canvas")];
    if (charts.length < 2) return;
    const grid = make("div", "wf-inline-charts");
    charts[0].before(grid);
    charts.forEach((canvas) => {
      const hint = canvas.nextElementSibling?.matches("p.hint") ? canvas.nextElementSibling : null;
      const section = make("section", "wf-inline-chart");
      const frame = make("div", "wf-inline-chart-frame");
      section.appendChild(frame); frame.appendChild(canvas);
      if (hint) section.appendChild(hint);
      grid.appendChild(section);
    });
  });
  const regional = make("div", "card tech"); regional.id = "wfRadarCard";
  regional.innerHTML = '<h3>HH / HV medios del área válida</h3><canvas id="wfRadarChart" height="190" aria-label="Medias regionales HH y HV en decibelios"></canvas><p class="hint">Promedios de los píxeles válidos de cada observación. No son mediciones exclusivas del manglar ni del punto seleccionado.</p>';
  el("analysisGrid").appendChild(regional);
  // Índice compacto: conservar cada tarjeta, sus controles y sus gráficas bajo demanda.
  const resultItems = [...el("analysisGrid").children].map((card) => {
    const item = make("details", "wf-result-item");
    if (card.classList.contains("tech")) item.classList.add("tech");
    const summary = make("summary", "");
    summary.textContent = card.querySelector("h3")?.textContent || "Resultado";
    card.before(item); item.append(summary, card);
    return { item, card, summary };
  });
  notices.appendChild(make("p", "wf-empty", '<span id="wfNoticeSummary">Cargando disponibilidad de avisos…</span>'));
  move("alertCard", notices); move("wowCard", notices);
  notices.appendChild(make("div", "wf-empty", '<strong>Calidad de la observación</strong><p id="wfNoticeQuality">Selecciona una fecha para consultar su cobertura.</p>'));
  hypotheses.appendChild(make("p", "wf-empty", 'Selecciona <strong>Antes / después</strong> o <strong>Cambios</strong> para consultar la interpretación existente del par. Si no hay evidencia suficiente, la plataforma lo indicará.'));
  move("interpCard", hypotheses);
  const about = document.querySelector("details.about"); if (about) science.appendChild(about);
  const scienceSection = el("scienceSection"); scienceSection.classList.remove("tech"); science.appendChild(scienceSection);
  const banner = document.querySelector(".science-banner"); if (banner) science.appendChild(banner);
  const extraLinks = make("div", "wf-export-buttons");
  [el("btn3d"), (el("btnOrbit") || header.querySelector('a[href^="orbita.html"]'))].forEach((node) => { if (node) extraLinks.appendChild(node); });
  science.prepend(extraLinks);
  el("exportCsv").textContent = "↓ Serie NISAR del sitio (CSV)";
  scienceSection.appendChild(make("p", "hint", "Para elegir una gráfica aquí, abre también Resultados. Puedes descargar cada gráfica directamente desde Ver más detalle."));

  const panel = document.querySelector(".panel");
  const datePanel = make("section", "card", '<h3>▣ Fecha actual</h3>'); datePanel.id = "wfCurrentDate";
  move("dateLabel", datePanel); panel.prepend(datePanel);
  const qualityPanel = make("section", "card", '<h3>⚠ Cobertura y calidad</h3>');
  move("fillNote", qualityPanel); qualityPanel.appendChild(make("p", "hint", '<span id="wfQualityFallback">Cargando calidad…</span>'));
  const temporal = make("section", "card", '<h3>▣ Exploración temporal</h3>');
  temporal.appendChild(header.querySelector(".modes"));
  ["ctlSingle", "ctlPair", "ctlTruth"].forEach((id) => move(id, temporal));
  panel.appendChild(temporal);
  // Orden del wireframe: fecha, capa, indicadores, calidad, tiempo.
  ["ctlLayer", "semaCard"].forEach((id) => move(id, panel));
  panel.appendChild(qualityPanel); panel.appendChild(temporal);
  const picker = make("label", "wf-layer-label", '◇ Capa activa<select id="wfLayerSelect" aria-label="Capa activa"></select>');
  el("ctlLayer").prepend(picker);
  const legend = make("aside", "wf-map-legend", '<strong>Leyenda · capa activa</strong><div id="wfMapLegend"></div>'); legend.setAttribute("aria-label", "Leyenda de la capa activa");
  document.querySelector(".mapwrap").appendChild(legend);
  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  const dialog = make("dialog", "wf-dialog"); dialog.id = "wfDetail"; dialog.setAttribute("aria-labelledby", "wfDetailTitle");
  dialog.innerHTML = `
    <header class="wf-dialog-header"><div><h2 id="wfDetailTitle">▥ Resultados · Ver más detalle</h2><p id="wfDetailContext"></p></div><button type="button" class="wf-close" aria-label="Cerrar detalle">×</button></header>
    <nav class="wf-dialog-tabs" aria-label="Grupo de resultados"><button type="button" data-group="water">Agua / área inundada</button><button type="button" data-group="mangrove">Manglar</button><button type="button" data-group="radar">HH / HV</button><button type="button" data-group="other">Otros resultados</button></nav>
    <label class="wf-detail-picker">Gráfica<select id="wfDetailSelect" aria-label="Gráfica del detalle"></select></label>
    <div class="wf-detail-grid"><section><h3 id="wfChartTitle"></h3><div class="wf-chart-host" id="wfChartHost"></div><p class="wf-detail-meta" id="wfDetailMeta"></p></section><section><div class="wf-interpretation"><h3>▱ Interpretación</h3><p id="wfDetailInterpretation"></p></div><h3>▦ Datos de la gráfica</h3><div class="wf-data-table" id="wfDetailTable" tabindex="0" aria-label="Tabla de datos del resultado"></div></section></div>
    <footer class="wf-dialog-footer"><div><h3>↓ Exportar</h3><div class="wf-export-buttons"><button type="button" class="btn" id="wfCsv">CSV</button><button type="button" class="btn" id="wfPng">PNG</button><button type="button" class="btn" disabled title="La gráfica actual se dibuja en canvas; SVG vectorial no disponible">SVG no disponible</button></div></div><div><strong>Incluir en CSV:</strong><label><input type="checkbox" checked disabled> Datos de la gráfica y tabla</label><label><input type="checkbox" id="wfIncludeQuality" checked> Metadatos ampliados de calidad</label><small>Región, variable, unidad y fuente se conservan siempre.</small></div></footer><p class="wf-export-status" id="wfExportStatus" role="status" aria-live="polite"></p>`;
  document.body.appendChild(dialog);
  let active = null, portal = null, trigger = null;

  function instance(id) { return typeof Chart !== "undefined" ? Chart.getChart(el(id)) : null; }
  function available() { return CHARTS.filter(([id]) => { const node = el(id); return node && !node.hidden && !node.closest("[hidden]") && instance(id); }); }
  function lightChart(chart) {
    if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = "#43595d";
    for (const axis of Object.values(chart.options.scales || {})) {
      if (axis.ticks) axis.ticks.color = "#52686c";
      if (axis.title) axis.title.color = "#52686c";
      if (axis.grid && axis.grid.display !== false) axis.grid.color = "#dce4e5";
    }
    if (chart.options.plugins?.legend) {
      const original = chart.options.plugins.legend.onClick || Chart.defaults.plugins.legend.onClick;
      chart.options.plugins.legend.onClick = function (event, item, legend) {
        original.call(this, event, item, legend);
        if (dialog.open && chart === instance(active)) updateDetail();
      };
    }
    chart.update("none");
  }
  function qualityText(observation) {
    if (!observation) return "Calidad no disponible.";
    const notes = [`${fmtDate(observation.date)}: cobertura ${observation.coverage_pct == null ? "no registrada" : observation.coverage_pct + " %"}`];
    if (observation.time_filled_pct) notes.push(`${observation.time_filled_pct} % aproximado con otra fecha (${(observation.time_fill_from || []).map((item) => fmtDate(item.date)).join(", ")})`);
    if (observation.filled_pct) notes.push(`${observation.filled_pct} % rellenado desde otra órbita`);
    if (observation.edge_trim_km) notes.push(`borde recortado: ${observation.edge_trim_km} km`);
    return notes.join(" · ");
  }
  function restoreCanvas() {
    if (!portal) return;
    portal.marker.replaceWith(portal.canvas);
    portal.chart.options.maintainAspectRatio = portal.aspect;
    const chart = portal.chart; portal = null;
    requestAnimationFrame(() => chart.resize());
  }
  function sourceFor(id, dataset) {
    if (id === "chart") return dataset.yAxisID === "r" ? (RAINJ?.source || "Open-Meteo") : "NISAR L2 GCOV";
    if (id === "lakeLvlChart") return /SWOT/.test(dataset.label) ? SWOT?.source : ECO?.source;
    if (id === "lakeVegChart") return /Sentinel/.test(dataset.label) ? "Sentinel-2 L2A" : /IA/.test(dataset.label) ? `NISAR + ${ML?.model || "IA"}` : "NISAR L2 GCOV (regla fija)";
    return ({ histChart: GMW?.source, mangChart: "NISAR L2 GCOV · máscara ESA WorldCover 2021", wfRadarChart: "NISAR L2 GCOV", valChart: "NISAR L2 GCOV · ESA WorldCover 2021", probeChart: "NISAR L2 GCOV · HH, promedio local 3×3", mlChart: ML?.validation?.method, wqChart: "Sentinel-2 L2A", caneChart: "Sentinel-2 L2A", burnWeekChart: BURNS?.source })[id] || "Consultar producto del sitio";
  }
  function sourceObservation(id, dataset, index) {
    if (id === "lakeLvlChart") return /SWOT/.test(dataset.label)
      ? (SWOT?.observations || []).filter((o) => o.quality <= 1)[index]
      : (ECO?.observations || []).filter((o) => o.day && o.water_c != null && o.water_px > 0.3 * o.water_total_px)[index];
    if (id === "lakeVegChart" && /Sentinel/.test(dataset.label)) return (REF?.sentinel2 || []).filter((s) => s.floatveg_km2 != null && s.cloud_water_pct < 40)[index];
    if (id === "lakeVegChart" && /IA/.test(dataset.label)) return (ML?.dates || []).filter((m) => m.lake_covered_pct >= 90)[index];
    if (id === "wqChart") return (REF?.sentinel2 || []).filter((s) => s.ndci != null && s.cloud_water_pct < 40)[index];
    return null;
  }
  function dateFor(id, chart, dataset, point, index) {
    const source = sourceObservation(id, dataset, index);
    if (source) return source.time || source.local_time || source.date;
    if (id === "histChart") return String(new Date(point.x).getFullYear());
    if (point && typeof point === "object" && point.x != null) return new Date(point.x).toISOString().slice(0,10);
    if (id === "chart" || id === "probeChart" || id === "wfRadarChart") return S.dates[index]?.date || "";
    if (id === "valChart") return VAL?.dates[index]?.date || "";
    if (id === "mlChart") return ML?.validation?.folds[index]?.s2 || "";
    if (id === "burnWeekChart") return Object.keys(BURNS?.by_week_ha || {})[index] || String(chart.data.labels?.[index] ?? "");
    return String(chart.data.labels?.[index] ?? "");
  }
  function rowsFor(id) {
    const chart = instance(id); if (!chart) return [];
    return chart.data.datasets.flatMap((dataset, datasetIndex) => {
      if (!chart.isDatasetVisible(datasetIndex)) return [];
      const axis = chart.options.scales?.[dataset.yAxisID || "y"];
      let unit = axis?.title?.text || (id === "mlChart" ? "F1 (0–1)" : "");
      if (id === "caneChart") unit = "km²";
      if (id === "burnWeekChart") unit = "ha";
      if (id === "probeChart" || id === "wfRadarChart") unit = "dB";
      return dataset.data.map((point, i) => {
        const date = dateFor(id, chart, dataset, point, i);
        const value = point && typeof point === "object" ? point.y : point;
        // La comparación incluye otra región: no atribuirle el QC del sitio activo.
        const sameRegion = id !== "mangChart" || String(dataset.label).normalize("NFD").replace(/[\u0300-\u036f]/g, "") === SITE.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const external = sourceObservation(id, dataset, i);
        const isRadar = !external && !(id === "chart" && dataset.yAxisID === "r") && ["chart","wfRadarChart","probeChart","valChart","mangChart","lakeVegChart"].includes(id);
        const observation = sameRegion && isRadar ? S.dates.find((d) => d.date === date) : null;
        return { region: id === "mangChart" ? dataset.label : SITE.name, date, variable: dataset.label, value: Number.isFinite(value) ? value : null, unit: String(unit), source: sourceFor(id, dataset), observation: observation?.id || external?.id || external?.granule || "", coverage: observation?.coverage_pct ?? external?.lake_covered_pct ?? null, quality: observation?.qc ?? external?.quality ?? null, filled: observation?.filled_pct ?? null, timeFilled: observation?.time_filled_pct ?? null, cloudWaterPct: external?.cloud_water_pct ?? null, waterPixels: external?.water_px ?? null, totalWaterPixels: external?.water_total_px ?? null, partial: external?.partial ?? null, wseUncertaintyM: external?.wse_u ?? null };
      });
    });
  }
  function updateDetail() {
    if (!active || !S?.dates.length) return;
    const current = S.dates[state.mode === "single" || state.mode === "truth" ? state.idx : state.b];
    const isPair = state.mode === "compare" || state.mode === "change";
    el("wfDetailContext").textContent = `${SITE.name} · ${isPair ? `${fmtDate(S.dates[state.a].date)} → ${fmtDate(S.dates[state.b].date)}` : fmtDate(current.date)} · Serie completa disponible`;
    const record = CHARTS.find(([id]) => id === active);
    el("wfChartTitle").textContent = record[1];
    const rows = rowsFor(active);
    el("wfDetailTable").innerHTML = '<table><caption class="hint">Mismas series visibles y valores fuente que la gráfica</caption><thead><tr><th scope="col">Fecha / período</th><th scope="col">Variable</th><th scope="col">Valor</th><th scope="col">Unidad</th></tr></thead><tbody>' + rows.map((row) => `<tr><td>${escape(row.date)}</td><td>${escape(row.variable)}</td><td>${escape(row.value == null ? "Sin dato" : row.value)}</td><td>${escape(row.unit)}</td></tr>`).join("") + '</tbody></table>';
    const sources = [...new Set(rows.map((row) => row.source).filter(Boolean))];
    el("wfDetailMeta").textContent = `Fuente: ${sources.join(" · ")}\nArchivo: ${active === "mangChart" ? "web/" : BASE + "/"}${record[3]}\nSelección del mapa: ${qualityText(current)}\nLa tabla y el CSV incluyen las series visibles; los huecos no son ceros. Las misiones conservan sus fechas propias.`;
    const card = (portal?.marker.parentElement || el(active)?.closest(".card"));
    const hint = card?.querySelector(".hint")?.textContent;
    const explanation = active === "chart" ? `Las líneas muestran las áreas calculadas por NISAR; las barras, la lluvia acumulada en 12 días (${RAINJ?.source || "Open-Meteo"}). Son observaciones disponibles, no una serie mensual continua.` : hint;
    el("wfDetailInterpretation").textContent = isPair && !el("interpCard").hidden ? el("interpContent").textContent : (explanation || "La gráfica muestra la evolución de las observaciones disponibles. Una variación no confirma por sí sola una causa; consulta las fuentes y la calidad.");
  }
  function selectChart(id) {
    restoreCanvas(); active = id;
    const chart = instance(id), canvas = el(id);
    if (!chart || !canvas) { active = null; el("wfChartHost").textContent = "No hay una gráfica disponible para esta selección."; return; }
    const marker = document.createComment(`detalle:${id}`); canvas.before(marker);
    portal = { marker, canvas, chart, aspect: chart.options.maintainAspectRatio };
    el("wfChartHost").replaceChildren(canvas); chart.options.maintainAspectRatio = false;
    el("wfExportStatus").textContent = "";
    updateDetail();
    requestAnimationFrame(() => { const host = el("wfChartHost"); chart.resize(host.clientWidth, host.clientHeight); chart.update("none"); });
  }
  function selectGroup(group, wanted) {
    const charts = available().filter((entry) => entry[2] === group);
    dialog.querySelectorAll("[data-group]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.group === group)));
    el("wfDetailSelect").replaceChildren(...charts.map(([id,label]) => new Option(label,id)));
    if (charts.length) { const id = charts.some(([id]) => id === wanted) ? wanted : charts[0][0]; el("wfDetailSelect").value = id; selectChart(id); }
    else { restoreCanvas(); active = null; el("wfChartHost").textContent = "No disponible para esta región o selección."; el("wfDetailTable").replaceChildren(); }
  }
  function openDetail(wanted = "chart", button = document.activeElement) {
    if (!S?.dates.length || !available().length) return;
    stopPlay(); if (typeof stopZafra === "function") stopZafra(false);
    trigger = button;
    const charts = available(); const record = charts.find(([id]) => id === wanted) || charts[0];
    dialog.querySelectorAll("[data-group]").forEach((node) => { node.disabled = !charts.some((entry) => entry[2] === node.dataset.group); });
    dialog.showModal(); selectGroup(record[2], record[0]);
    dialog.querySelector(".wf-close").focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }
  dialog.querySelector(".wf-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { restoreCanvas(); active = null; trigger?.focus(); });
  dialog.querySelectorAll("[data-group]").forEach((button) => button.addEventListener("click", () => selectGroup(button.dataset.group)));
  el("wfDetailSelect").addEventListener("change", (event) => selectChart(event.target.value));
  el("wfOpenDetail").addEventListener("click", (event) => openDetail("chart", event.currentTarget));
  el("wfDetailTable").addEventListener("focus", updateDetail);
  const field = (value) => { const s = String(value ?? ""); return /[;\r\n"]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  function save(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  el("wfCsv").addEventListener("click", () => {
    const rows = rowsFor(active); if (!rows.length) return;
    const keys = ["region","date","variable","value","unit","source"];
    if (el("wfIncludeQuality").checked) keys.push("observation","coverage","quality","filled","timeFilled","cloudWaterPct","waterPixels","totalWaterPixels","partial","wseUncertaintyM");
    save(new Blob(["\uFEFF" + [keys.join(";"), ...rows.map((row) => keys.map((key) => field(row[key])).join(";"))].join("\r\n")], { type:"text/csv;charset=utf-8" }), `MANGLO_${SITE.id}_${active}.csv`);
    el("wfExportStatus").textContent = `CSV descargado: ${rows.length} valores de las series visibles de esta gráfica.`;
  });
  el("wfPng").addEventListener("click", () => {
    const chart = instance(active); if (!chart) return;
    const filename = `MANGLO_${SITE.id}_${active}.png`;
    const image = document.createElement("canvas"); image.width = chart.canvas.width; image.height = chart.canvas.height;
    const context = image.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, image.width, image.height); context.drawImage(chart.canvas, 0, 0);
    image.toBlob((blob) => {
      if (!blob) { el("wfExportStatus").textContent = "No se pudo generar la imagen PNG."; return; }
      save(blob, filename);
      el("wfExportStatus").textContent = "Gráfica activa descargada en PNG.";
    }, "image/png");
  });

  function sync() {
    resultItems.forEach(({ item, card, summary }) => {
      item.hidden = card.hidden;
      summary.textContent = card.querySelector("h3")?.textContent || "Resultado";
    });
    modes.querySelectorAll("[data-expert]").forEach((button) => button.setAttribute("aria-pressed", String(el("expertSw").checked === (button.dataset.expert === "true"))));
    const select = el("wfLayerSelect");
    const buttons = [...document.querySelectorAll("#layerSeg button")].filter((button) => !button.hidden);
    if ([...select.options].map((option) => option.value).join("|") !== buttons.map((button) => button.dataset.layer).join("|")) select.replaceChildren(...buttons.map((button) => new Option(button.textContent,button.dataset.layer)));
    select.value = state.layer;
    const ids = state.layer === "cls" ? ["legendCls"] : state.layer === "ml" ? ["legendMl"] : state.layer === "photo" ? ["legendPhoto"] : [el("expertSw").checked ? "legendRgb" : "legendRgbSimple"];
    const legends = ids.map((id) => el(id)).filter(Boolean);
    el("wfMapLegend").innerHTML = legends.map((node) => node.innerHTML).join("");
    if (!S?.dates.length || !SITE) return;
    document.querySelectorAll("[data-detail-for]").forEach((button) => { const canvas = el(button.dataset.detailFor); button.hidden = !canvas || canvas.hidden || !instance(button.dataset.detailFor); });
    const current = S.dates[state.mode === "single" || state.mode === "truth" ? state.idx : state.b];
    if (current) el("dateLabel").textContent = fmtDate(current.date);
    const quality = state.mode === "compare" || state.mode === "change" ? `${qualityText(S.dates[state.a])}\n${qualityText(S.dates[state.b])}` : qualityText(current);
    el("wfQualityFallback").textContent = quality;
    el("wfNoticeQuality").textContent = quality + " Los metadatos ausentes no se interpretan como cobertura completa.";
    const alert = ALERTS?.dates?.find((row) => row.id === current?.id);
    el("wfNoticeSummary").textContent = !ALERTS ? "No hay un producto de alertas zonales publicado para esta región. Las detecciones históricas disponibles se conservan en Resultados." : !alert ? "No hay datos suficientes para mostrar una evaluación zonal en esta fecha." : `${Object.values(alert.zones).filter((zone) => zone.level === "alto").length} zonas en nivel alto relativo al período evaluado. Resultado experimental; no es una alerta de emergencia.`;
    el("wfResultsSummary").textContent = `${SITE.name} · ${S.dates.length} observaciones admitidas · ${fmtDate(S.dates[0].date)} a ${fmtDate(S.dates.at(-1).date)}. Abre un resultado para conocer su evidencia.`;
    if (dialog.open) updateDetail();
  }
  modes.querySelectorAll("[data-expert]").forEach((button) => button.addEventListener("click", () => { el("expertSw").checked = button.dataset.expert === "true"; el("expertSw").dispatchEvent(new Event("change", { bubbles:true })); sync(); }));
  el("expertSw").addEventListener("change", sync);
  window.addEventListener("manglo:language", () => { sync(); window.MangloLanguage?.refresh(); });
  el("wfLayerSelect").addEventListener("change", (event) => document.querySelector(`#layerSeg [data-layer="${event.target.value}"]`)?.click());
  blocks.addEventListener("toggle", (event) => { requestAnimationFrame(() => { if (event.target.open) { CHARTS.forEach(([id]) => instance(id)?.resize()); map.invalidateSize(); } document.dispatchEvent(new Event("manglo:charts")); }); }, true);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goref]");
    if (button && button.closest(".wf-block")) { if (dialog.open) dialog.close(); document.querySelector(".mapwrap").scrollIntoView({ behavior:"smooth",block:"start" }); }
  });
  const oldRender = window.onRender; window.onRender = () => { oldRender?.(); sync(); };
  const oldReady = window.onDataReady; window.onDataReady = () => {
    oldReady?.();
    if (!instance("wfRadarChart")) new Chart(el("wfRadarChart"), { type:"line", data:{ labels:S.dates.map((d) => fmtDate(d.date)), datasets:[{ label:"HH medio (dB)",data:S.dates.map((d) => d.hh_mean_db ?? null),borderColor:"#536e91",backgroundColor:"#536e91",pointRadius:3 },{ label:"HV medio (dB)",data:S.dates.map((d) => d.hv_mean_db ?? null),borderColor:"#9a7652",backgroundColor:"#9a7652",pointRadius:3 }] },options:{ animation:false,responsive:true,scales:{y:{title:{display:true,text:"dB"}}} } });
    CHARTS.forEach(([id]) => {
      const chart = instance(id); if (chart) { chart.options.maintainAspectRatio = false; lightChart(chart); }
      const canvas = el(id); if (!canvas || canvas.nextElementSibling?.dataset.detailFor === id) return;
      if (!canvas.parentElement.classList.contains("wf-inline-chart-frame")) {
        const frame = make("div", "wf-inline-chart-frame"); canvas.before(frame); frame.appendChild(canvas);
      }
      const button = make("button", "btn wf-detail-button", "Ver más detalle →"); button.type = "button"; button.dataset.detailFor = id;
      button.addEventListener("click", () => openDetail(id,button)); canvas.parentElement.after(button);
    });
    el("wfOpenDetail").disabled = false;
    el("wfOpenDetail").textContent = "Ver más detalle →";
    document.dispatchEvent(new Event("manglo:charts"));
    sync(); requestAnimationFrame(() => map.invalidateSize());
  };
  sync();
})();
