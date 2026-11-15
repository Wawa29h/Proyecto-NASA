/* MANGLO · Herramientas complementarias de Modo Científico
   Este módulo NO modifica app.js ni realiza nuevos cálculos científicos.
   Exporta las observaciones que el proyecto ya contiene y las gráficas visibles.
*/
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const csvButton = $("exportCsv");
  const pngButton = $("exportPng");
  const chartSelect = $("exportChartSelect");
  const status = $("exportStatus");
  if (!csvButton || !pngButton || !chartSelect || !status) return;

  const CHARTS = [
    ["chart", "Indicadores del área de estudio"],
    ["lakeVegChart", "Vegetación del embalse"],
    ["lakeLvlChart", "Nivel y temperatura del agua"],
    ["mlChart", "Validación de inteligencia artificial"],
    ["wqChart", "Indicadores ópticos del agua"],
    ["valChart", "Firma de radar por cobertura"],
    ["caneChart", "Cosecha de caña por mes"],
    ["burnWeekChart", "Quemas de caña por semana"],
    ["histChart", "Manglar 1996–2020"],
    ["mangChart", "Dos manglares, mismo radar"],
    ["probeChart", "Análisis por punto"]
  ];

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = error ? "true" : "false";
  }

  function safeName(value) {
    return String(value || "sitio")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvField(value) {
    if (value === undefined || value === null) return "";
    const str = Array.isArray(value) ? value.join(" | ") : String(value);
    return /[;\r\n"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  // Mantener el mismo criterio de filtrado que usa app.js al cargar series.json
  // (cobertura mínima por sitio: Jiquilisco queda siempre al borde de la pasada).
  function usable(row, minCov = 90) {
    return row.qc !== false && (row.coverage_pct == null || row.coverage_pct >= minCov);
  }

  async function readJSON(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${response.status})`);
    return response.json();
  }

  async function downloadCsv() {
    csvButton.disabled = true;
    message("Preparando las observaciones del sitio seleccionado…");
    try {
      const sites = await readJSON("sites.json");
      const id = $("siteSel")?.value || "barra";
      const site = sites.find((entry) => entry.id === id);
      if (!site || !/^data(?:-[a-z]+)?$/.test(site.base)) {
        throw new Error("No se encontró la configuración del sitio seleccionado.");
      }
      const series = await readJSON(`${site.base}/series.json`);
      const rows = Array.isArray(series.dates) ? series.dates.filter((r) => usable(r, site.min_coverage ?? 90)) : [];
      if (!rows.length) throw new Error("No hay observaciones validadas para exportar.");

      const columns = [
        ["sitio", () => site.name],
        ["fecha", (r) => r.date],
        ["id_pasada", (r) => r.id],
        ["direccion", (r) => r.direction],
        ["orbita_track", (r) => r.track],
        ["frame", (r) => r.frame],
        ["cobertura_porcentaje", (r) => r.coverage_pct],
        ["area_valida_km2", (r) => r.valid_km2],
        ["agua_abierta_km2", (r) => r.water_km2],
        ["vegetacion_inundada_km2", (r) => r.floodveg_km2],
        ["plantas_sobre_agua_km2", (r) => r.floatveg_km2],
        ["mar_km2", (r) => r.ocean_km2],
        ["hh_promedio_db", (r) => r.hh_mean_db],
        ["hv_promedio_db", (r) => r.hv_mean_db],
        ["control_calidad", (r) => r.qc],
        ["porcentaje_rellenado", (r) => r.filled_pct ?? ""],
        ["motivo_rechazo_qc", (r) => r.qc_reason ?? ""],
        ["escena_nisar", (r) => r.scene]
      ];
      // BOM UTF-8 y punto y coma para lectura sencilla en Excel en español.
      const lines = [
        columns.map(([label]) => label).join(";"),
        ...rows.map((row) => columns.map(([, get]) => csvField(get(row))).join(";"))
      ];
      const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
      saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `MANGLO_${safeName(site.name)}_NISAR.csv`);
      message(`CSV descargado: ${rows.length} observaciones con control de calidad.`);
    } catch (e) {
      message(e.message || "No fue posible descargar los datos.", true);
    } finally {
      csvButton.disabled = false;
    }
  }

  function availableCharts() {
    if (typeof Chart === "undefined" || typeof Chart.getChart !== "function") return [];
    return CHARTS.filter(([id]) => {
      const canvas = $(id);
      return canvas && !canvas.closest("[hidden]") && Chart.getChart(canvas);
    });
  }

  function refreshCharts() {
    const oldValue = chartSelect.value;
    const charts = availableCharts();
    chartSelect.replaceChildren();
    charts.forEach(([id, label]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      chartSelect.appendChild(opt);
    });
    if (charts.some(([id]) => id === oldValue)) chartSelect.value = oldValue;
    else if (charts.length) chartSelect.value = charts[0][0];
    // Mantener los controles utilizables incluso mientras app.js termina de cargar.
    // Cada clic vuelve a verificar si hay gráficas disponibles.
    if (!charts.length) {
      const opt = document.createElement("option");
      opt.textContent = "Las gráficas aún no están disponibles";
      opt.value = "";
      chartSelect.appendChild(opt);
    }
  }

  function downloadPng() {
    refreshCharts();
    const id = chartSelect.value;
    const canvas = $(id);
    const chart = (typeof Chart !== "undefined" && canvas) ? Chart.getChart(canvas) : null;
    if (!chart) {
      message("Selecciona una gráfica que esté visible y cargada.", true);
      return;
    }
    try {
      const link = document.createElement("a");
      link.download = `MANGLO_${safeName($("siteSel")?.selectedOptions[0]?.textContent)}_${safeName(id)}.png`;
      link.href = chart.toBase64Image("image/png", 1);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message("Gráfica descargada en formato PNG.");
    } catch (e) {
      message("No se pudo exportar la gráfica. Vuelve a intentarlo.", true);
    }
  }

  csvButton.addEventListener("click", downloadCsv);
  pngButton.addEventListener("click", downloadPng);
  chartSelect.addEventListener("focus", refreshCharts);
  chartSelect.addEventListener("pointerdown", refreshCharts);
  pngButton.addEventListener("pointerenter", refreshCharts);

  refreshCharts();
  // Las gráficas se construyen de forma asíncrona en app.js.
  window.addEventListener("load", refreshCharts, { once: true });
  // El motor carga las series de datos después de la carga del HTML.
  // Comprobar periódicamente evita que el selector quede vacío por esa espera.
  let attempts = 0;
  const check = setInterval(() => {
    refreshCharts();
    if (availableCharts().length || ++attempts >= 60) clearInterval(check);
  }, 500);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshCharts(); });
})();
