// Visor de cambios NISAR GCOV (varios sitios: Barra de Santiago, Cerrón Grande, ...)
const CENTER = [13.85, -89.5];
const $ = (id) => document.getElementById(id);
let SITE = null, BASE = "data";
// rutas guardadas como "data/x.png" o "ref/x.png" -> carpeta del sitio
const P = (p) => (p ? BASE + "/" + p.replace(/^data\//, "") : p);
const getJSON = async (p) => { try { const r = await fetch(p, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; } };
let SWOT = null, ECO = null, RAINJ = null, ML = null;
const mlFor = (d) => ML?.dates.find((m) => m.id === d.id);
const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-SV", { day: "numeric", month: "short", year: "numeric" });

const state = { mode: "single", layer: "rgb", idx: 0, a: 0, b: 0, opacity: 0.85, split: 0.5, playing: null, ref: "s2" };
let S = null;          // series.json
let REF = null;        // ref/reference.json (Sentinel-2 + WorldCover)
let VAL = null;        // ref/validation.json
let bounds = null;     // L.LatLngBounds de las capas
let rain = null;       // { date -> mm }
const hhCache = {};    // id -> Uint8Array (valores codificados) para sondas y cambios

// ---------- mapa ----------
const map = L.map("map", { zoomControl: true, attributionControl: true }).setView(CENTER, 13);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 18, attribution: "Imágenes: Esri, Maxar · Radar: NISAR L2 GCOV (NASA-ISRO / ASF DAAC)",
}).addTo(map);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 18, pane: "shadowPane", opacity: 0.8,
}).addTo(map);

map.createPane("paneA"); map.createPane("paneB"); map.createPane("paneChange");
["paneA", "paneB", "paneChange"].forEach((p) => (map.getPane(p).style.zIndex = 410));
map.getPane("paneB").style.zIndex = 411;

let ovA = null, ovB = null, ovChange = null, probeMarker = null;

function overlay(url, pane) {
  return L.imageOverlay(url, bounds, { pane, opacity: state.opacity, interactive: false }).addTo(map);
}
function clearOverlays() {
  [ovA, ovB, ovChange].forEach((o) => o && map.removeLayer(o));
  ovA = ovB = ovChange = null;
}
const urlFor = (d) => P(state.layer === "cls" ? d.cls : d.rgb);
// capa IA: falso color atenuado debajo + plantas detectadas por el modelo encima
function mlOverlay(d) {
  const m = mlFor(d);
  if (state.layer !== "ml" || !m) return null;
  return L.imageOverlay(P(m.img), bounds, { pane: "paneChange", opacity: 1, interactive: false }).addTo(map);
}

// ---------- recorte del comparador ----------
function applyClip() {
  const pA = map.getPane("paneA"), pB = map.getPane("paneB");
  if (!splitMode()) { pA.style.clip = pB.style.clip = ""; return; }
  const size = map.getSize();
  const nw = map.containerPointToLayerPoint([0, 0]);
  const se = map.containerPointToLayerPoint(size);
  const x = nw.x + size.x * state.split;
  pA.style.clip = `rect(${nw.y}px, ${x}px, ${se.y}px, ${nw.x}px)`;
  pB.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${x}px)`;
  $("divider").style.left = size.x * state.split + "px";
}
map.on("move zoom resize", applyClip);

(function wireDivider() {
  const div = $("divider");
  let drag = false;
  const move = (clientX) => {
    const r = map.getContainer().getBoundingClientRect();
    state.split = Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width));
    applyClip();
  };
  div.addEventListener("pointerdown", (e) => { drag = true; div.setPointerCapture(e.pointerId); map.dragging.disable(); });
  div.addEventListener("pointermove", (e) => drag && move(e.clientX));
  div.addEventListener("pointerup", () => { drag = false; map.dragging.enable(); });
})();

// ---------- render ----------
const splitMode = () => state.mode === "compare" || state.mode === "truth";
function nearestS2(date) {
  if (!REF || !REF.sentinel2.length) return null;
  const t = new Date(date).getTime();
  return REF.sentinel2.reduce((b, s) => (Math.abs(new Date(s.date) - t) < Math.abs(new Date(b.date) - t) ? s : b));
}
function render() {
  if (!S || !S.dates.length) return;
  clearOverlays();
  const single = state.mode === "single" || state.mode === "truth";
  $("ctlSingle").hidden = !single;
  $("ctlTruth").hidden = state.mode !== "truth";
  $("ctlPair").hidden = single;
  $("changeOpts").hidden = state.mode !== "change";
  $("ctlLayer").hidden = state.mode === "change";
  $("divider").hidden = !splitMode();
  $("tagA").hidden = $("tagB").hidden = !splitMode();

  if (single) {
    const d = S.dates[state.idx];
    ovA = overlay(urlFor(d), "paneA");
    if (state.layer === "ml") { ovA.setOpacity(Math.min(state.opacity, 0.5)); if (state.mode === "single") ovChange = mlOverlay(d); }
    $("dateLabel").textContent = fmtDate(d.date);
    $("dateSlider").value = state.idx;
    if (state.mode === "truth" && REF) {
      $("tagA").textContent = "NISAR · " + fmtDate(d.date);
      if (state.ref === "s2" || state.ref === "veg") {
        const s = nearestS2(d.date);
        ovB = L.imageOverlay(P(s.img), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        if (state.ref === "veg" && s.veg_img) ovChange = L.imageOverlay(P(s.veg_img), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        const gap = Math.round(Math.abs(new Date(s.date) - new Date(d.date)) / 864e5);
        $("tagB").textContent = (state.ref === "veg" ? "Plantas en Sentinel-2 · " : "Foto Sentinel-2 · ") + fmtDate(s.date);
        $("truthInfo").innerHTML = `Foto óptica más cercana: <b>${fmtDate(s.date)}</b> (${gap} días de diferencia). La foto solo sirve sin nubes; el radar ve siempre.` +
          (s.floatveg_km2 != null && SITE.lake ? `<br>Plantas sobre el agua en la foto (NDVI &gt; 0.3): <b>${s.floatveg_km2} km²</b> · NISAR ese día: <b>${d.floatveg_km2 ?? "—"} km²</b>` : "") +
          (s.cloud_water_pct > 30 ? `<br>⚠ ${s.cloud_water_pct}% del agua tapada por nubes en la foto.` : "");
      } else {
        ovB = L.imageOverlay(P(REF.worldcover.img), bounds, { pane: "paneB", opacity: 0.85, interactive: false }).addTo(map);
        $("tagB").textContent = "Mapa ESA WorldCover 2021";
        const A = REF.worldcover.areas_km2;
        $("truthInfo").innerHTML = `Mapa oficial de cobertura a 10 m (2021). ` +
          (A.Manglar ? `Manglar: <b>${A.Manglar} km²</b>` : `Agua: <b>${A.Agua ?? "—"} km²</b>`) + " en el recuadro.";
      }
      $("legendWc").hidden = state.ref !== "wc";
    }
  } else if (state.mode === "compare") {
    const A = S.dates[state.a], B = S.dates[state.b];
    ovA = overlay(urlFor(A), "paneA");
    ovB = overlay(urlFor(B), "paneB");
    $("tagA").textContent = "Antes · " + fmtDate(A.date);
    $("tagB").textContent = "Después · " + fmtDate(B.date);
  } else {
    renderChange();
  }
  applyClip();
  $("legendRgb").hidden = state.layer !== "rgb" && state.layer !== "ml";
  $("legendCls").hidden = state.layer !== "cls";
  $("legendMl").hidden = state.layer !== "ml";
  highlightChart();
}

// ---------- decodificar HH ----------
function loadHH(d) {
  if (hhCache[d.id]) return Promise.resolve(hhCache[d.id]);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const v = new Uint8Array(c.width * c.height);
      for (let i = 0; i < v.length; i++) v[i] = px[i * 4];
      hhCache[d.id] = { w: c.width, h: c.height, v };
      res(hhCache[d.id]);
    };
    img.onerror = rej;
    img.src = P(d.hh);
  });
}
const toDb = (e) => (e === 0 ? null : S.hh_range[0] + ((e - 1) / 254) * (S.hh_range[1] - S.hh_range[0]));

// ---------- detector de cambios ----------
async function renderChange() {
  const A = S.dates[state.a], B = S.dates[state.b];
  const [ha, hb] = await Promise.all([loadHH(A), loadHH(B)]);
  if (state.mode !== "change") return;
  const thr = +$("thr").value;
  const c = document.createElement("canvas");
  c.width = ha.w; c.height = ha.h;
  const ctx = c.getContext("2d");
  const out = ctx.createImageData(ha.w, ha.h);
  let down = 0, up = 0, valid = 0;
  for (let i = 0; i < ha.v.length; i++) {
    const a = toDb(ha.v[i]), b = toDb(hb.v[i]);
    if (a === null || b === null) continue;
    valid++;
    const dd = b - a, k = i * 4;
    if (dd <= -thr) { down++; out.data.set([47, 128, 255, Math.min(255, 120 + (-dd - thr) * 40)], k); }
    else if (dd >= thr) { up++; out.data.set([255, 138, 0, Math.min(255, 120 + (dd - thr) * 40)], k); }
  }
  ctx.putImageData(out, 0, 0);
  if (ovChange) map.removeLayer(ovChange);
  ovChange = L.imageOverlay(c.toDataURL(), bounds, { pane: "paneChange", interactive: false }).addTo(map);
  const px = pxKm2();
  $("changeKpis").innerHTML =
    kpi((down * px).toFixed(2) + " km²", "bajó ≥ " + thr + " dB") +
    kpi((up * px).toFixed(2) + " km²", "subió ≥ " + thr + " dB") +
    kpi(((100 * (down + up)) / Math.max(1, valid)).toFixed(1) + " %", "del área cambió") +
    kpi(Math.round((new Date(B.date) - new Date(A.date)) / 864e5) + " días", "entre pasadas");
}
function pxKm2() {
  const lat = (S.bbox[1] + S.bbox[3]) / 2;
  return S.step * 111.32 * S.step * 111.32 * Math.cos((lat * Math.PI) / 180);
}
const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;

// ---------- lluvia (Open-Meteo, sin llave) ----------
async function loadRain() {
  RAINJ = await getJSON(BASE + "/rain.json");
  if (RAINJ) { rain = RAINJ.daily_mm; return; }
  const first = new Date(S.dates[0].date); first.setDate(first.getDate() - 12);
  const last = S.dates[S.dates.length - 1].date;
  const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${SITE.center[0]}&longitude=${SITE.center[1]}&start_date=${first.toISOString().slice(0, 10)}&end_date=${last}&daily=precipitation_sum&timezone=America%2FEl_Salvador`;
  try {
    const j = await (await fetch(u)).json();
    rain = {};
    j.daily.time.forEach((t, i) => (rain[t] = j.daily.precipitation_sum[i] ?? 0));
  } catch { rain = null; }
}
function rain12(date) {
  if (!rain) return null;
  let s = 0, n = 0;
  const d = new Date(date + "T12:00:00");
  for (let k = 0; k < 12; k++) {
    const t = new Date(d - k * 864e5).toISOString().slice(0, 10);
    if (t in rain) { s += rain[t]; n++; }
  }
  return n ? +s.toFixed(1) : null;
}

// ---------- gráficas ----------
let chart = null, probeChart = null;
const gridColor = "rgba(150,180,175,.15)", tick = { color: "#93aaa6", font: { size: 10 } };
function buildChart() {
  const labels = S.dates.map((d) => fmtDate(d.date));
  chart = new Chart($("chart"), {
    data: {
      labels,
      datasets: [
        { type: "bar", label: "Lluvia 12 d (mm)" + (RAINJ ? " · " + RAINJ.source.replace(" (PRECTOTCORR)", "") : " · Open-Meteo"), data: S.dates.map((d) => rain12(d.date)), backgroundColor: "rgba(120,160,255,.35)", yAxisID: "r", order: 3 },
        { type: "line", label: SITE.labels.water, data: S.dates.map((d) => d.water_km2), borderColor: "#1e88e5", backgroundColor: "#1e88e5", tension: 0.3, yAxisID: "a", pointRadius: 3 },
        { type: "line", label: SITE.labels.veg, data: S.dates.map((d) => (SITE.lake ? d.floatveg_km2 : d.floodveg_km2)), borderColor: SITE.lake ? "#3cdc5a" : "#d81bc4", backgroundColor: SITE.lake ? "#3cdc5a" : "#d81bc4", tension: 0.3, yAxisID: "a", pointRadius: 3 },
      ],
    },
    options: {
      animation: false, responsive: true, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#c8d8d5", boxWidth: 10, font: { size: 11 } } } },
      scales: {
        x: { ticks: { ...tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: gridColor } },
        a: { position: "left", ticks: tick, grid: { color: gridColor }, title: { display: true, text: "km²", color: "#93aaa6" } },
        r: { position: "right", ticks: tick, grid: { display: false }, title: { display: true, text: "mm", color: "#93aaa6" } },
      },
      onClick: (_, els) => { if (els.length) { state.idx = els[0].index; setMode("single"); } },
    },
  });
}
function buildValChart() {
  const colors = { Manglar: "#00cf75", Bosque: "#2e7d32", Cultivo: "#f096ff", Pasto: "#ffe14c", Agua: "#3d8bfd" };
  new Chart($("valChart"), {
    type: "line",
    data: {
      labels: VAL.dates.map((d) => fmtDate(d.date)),
      datasets: VAL.classes.map((c) => ({ label: c, data: VAL.dates.map((d) => d.hv[c]), borderColor: colors[c], backgroundColor: colors[c], tension: 0.3, pointRadius: 2 })),
    },
    options: {
      animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#c8d8d5", boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { ticks: { ...tick, maxTicksLimit: 5, maxRotation: 0 }, grid: { color: gridColor } },
        y: { ticks: tick, grid: { color: gridColor }, title: { display: true, text: "HV (dB)", color: "#93aaa6" } } },
    },
  });
  const avg = (k) => VAL.dates.reduce((s, d) => s + (d[k] ?? 0), 0) / VAL.dates.length;
  $("valKpis").innerHTML =
    kpi(avg("estero_en_mapa_pct").toFixed(0) + " %", "del agua que ve NISAR cae en agua/manglar del mapa ESA") +
    kpi(avg("agua_mapa_detectada_pct").toFixed(0) + " %", "del agua del estero del mapa la detecta NISAR");
  $("valCard").hidden = false;
}
// ---------- series con eje de tiempo real (fechas distintas por misión) ----------
const T = (date) => new Date(date.length > 10 ? date : date + "T12:00:00").getTime();
function tsChart(canvas, datasets, axes) {
  const scales = {
    x: { type: "linear", ticks: { ...tick, maxTicksLimit: 5, maxRotation: 0, callback: (v) => new Date(v).toLocaleDateString("es-SV", { month: "short", year: "2-digit" }) }, grid: { color: gridColor } },
  };
  axes.forEach((a, i) => (scales[a.id] = { position: i ? "right" : "left", ticks: tick, grid: { color: i ? "transparent" : gridColor }, title: { display: true, text: a.title, color: "#93aaa6" } }));
  return new Chart(canvas, {
    type: "line",
    data: { datasets: datasets.map((d) => ({ tension: 0.3, pointRadius: 3, showLine: d.line !== false, borderColor: d.color, backgroundColor: d.color, ...d })) },
    options: {
      animation: false, parsing: false,
      plugins: { legend: { labels: { color: "#c8d8d5", boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { title: (it) => it.length ? new Date(it[0].parsed.x).toLocaleDateString("es-SV", { day: "numeric", month: "short", year: "numeric" }) : "" } } },
      scales,
    },
  });
}
function buildLakeCard() {
  const s2 = (REF?.sentinel2 || []).filter((s) => s.floatveg_km2 != null && s.cloud_water_pct < 40);
  const mlPts = (ML?.dates || []).filter((m) => m.lake_covered_pct >= 90).map((m) => ({ x: T(m.date), y: m.ml_veg_km2 }));
  tsChart($("lakeVegChart"), [
    ...(mlPts.length ? [{ label: "NISAR + IA", data: mlPts, color: "#ffd600", yAxisID: "v", borderWidth: 3 }] : []),
    { label: "NISAR regla fija", data: S.dates.map((d) => ({ x: T(d.date), y: d.floatveg_km2 })), color: "#3cdc5a", yAxisID: "v", borderDash: [4, 4], pointRadius: 2 },
    { label: "Sentinel-2 (foto)", data: s2.map((s) => ({ x: T(s.date), y: s.floatveg_km2 })), color: "#ff8fab", line: false, pointRadius: 5, pointStyle: "rectRot", yAxisID: "v" },
  ], [{ id: "v", title: "km² con plantas" }]);

  const lv = (SWOT?.observations || []).filter((o) => o.quality <= 1);
  const ecoDay = (ECO?.observations || []).filter((o) => o.day && o.water_c != null && o.water_px > 0.3 * o.water_total_px);
  const ds = [];
  const axes = [];
  if (lv.length) { ds.push({ label: "Nivel del agua SWOT (m)", data: lv.map((o) => ({ x: T(o.time), y: o.wse_m })), color: "#4fc3f7", yAxisID: "w" }); axes.push({ id: "w", title: "m" }); }
  if (ecoDay.length) { ds.push({ label: "Temp. agua ECOSTRESS día (°C)", data: ecoDay.map((o) => ({ x: T(o.local_time), y: o.water_c })), color: "#ff7043", line: false, pointRadius: 3, yAxisID: "t" }); axes.push({ id: "t", title: "°C" }); }
  if (ds.length) tsChart($("lakeLvlChart"), ds, axes);
  else { $("lakeLvlChart").hidden = true; $("lakeHint").textContent = "SWOT y ECOSTRESS: datos aún no descargados."; }

  const f = S.dates.map((d) => d.floatveg_km2 ?? 0);
  const iMax = f.indexOf(Math.max(...f));
  $("lakeKpis").innerHTML =
    kpi(Math.max(...f).toFixed(1) + " km²", "máx. plantas (NISAR) · " + fmtDate(S.dates[iMax].date)) +
    (s2.length ? kpi(Math.max(...s2.map((s) => s.floatveg_km2)).toFixed(1) + " km²", "máx. plantas (Sentinel-2)") : "") +
    (lv.length ? kpi((Math.max(...lv.map((o) => o.wse_m)) - Math.min(...lv.map((o) => o.wse_m))).toFixed(1) + " m", "variación del nivel (SWOT)") : "") +
    (ecoDay.length ? kpi(`${Math.min(...ecoDay.map((o) => o.water_c)).toFixed(0)}–${Math.max(...ecoDay.map((o) => o.water_c)).toFixed(0)} °C`, "agua de día (ECOSTRESS)") : "");
  $("lakeCard").hidden = false;
}
function buildMlCard() {
  const v = ML.validation;
  const gain = Math.round((100 * (v.mean_f1 - v.mean_f1_rule)) / Math.max(v.mean_f1_rule, 1e-6));
  const wins = v.folds.filter((f) => f.f1 > f.f1_rule).length;
  $("mlKpis").innerHTML =
    kpi(v.mean_f1.toFixed(2), "acierto F1 del modelo (0 a 1)") +
    kpi(v.mean_f1_rule.toFixed(2), "acierto F1 de la regla fija") +
    kpi((gain >= 0 ? "+" : "") + gain + " %", "mejora del modelo") +
    kpi(`${wins} de ${v.folds.length}`, "fechas de prueba donde gana");
  new Chart($("mlChart"), {
    type: "bar",
    data: {
      labels: v.folds.map((f) => fmtDate(f.s2)),
      datasets: [
        { label: "Modelo", data: v.folds.map((f) => f.f1), backgroundColor: "#ffd600" },
        { label: "Regla fija", data: v.folds.map((f) => f.f1_rule), backgroundColor: "rgba(60,220,90,.6)" },
      ],
    },
    options: {
      animation: false, plugins: { legend: { labels: { color: "#c8d8d5", boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { ticks: { ...tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 4 }, grid: { display: false } },
        y: { min: 0, max: 1, ticks: tick, grid: { color: gridColor }, title: { display: true, text: "F1", color: "#93aaa6" } } },
    },
  });
  const top = ML.importance.slice(0, 3).map((i) => i.feature).join(", ");
  $("mlHint").innerHTML = `Validación honesta: en cada barra el modelo se probó en una fecha que <b>nunca vio</b> al entrenar (${ML.trained_on.length} parejas foto-radar con ≤ 8 días de diferencia). ` +
    `Lo que más usa: ${top}. Es una prueba de concepto con un año de datos; las plantas se mueven con el viento entre la foto y el radar, y eso limita el acierto.`;
  $("layerMlBtn").hidden = false;
  $("mlCard").hidden = false;
}
function buildWqCard() {
  const s2 = (REF?.sentinel2 || []).filter((s) => s.ndci != null && s.cloud_water_pct < 40);
  if (!s2.length) return;
  tsChart($("wqChart"), [
    { label: "NDCI (clorofila)", data: s2.map((s) => ({ x: T(s.date), y: s.ndci })), color: "#66bb6a", yAxisID: "i" },
    { label: "NDTI (turbidez)", data: s2.map((s) => ({ x: T(s.date), y: s.ndti })), color: "#c8a165", yAxisID: "i" },
  ], [{ id: "i", title: "índice" }]);
  $("wqCard").hidden = false;
}
function highlightChart() {
  if (!chart) return;
  const sel = state.mode === "single" ? [state.idx] : [state.a, state.b];
  chart.data.datasets.slice(1).forEach((ds) => (ds.pointRadius = S.dates.map((_, i) => (sel.includes(i) ? 7 : 3))));
  chart.update();
}
function setKpis() {
  const w = S.dates.map((d) => d.water_km2), f = S.dates.map((d) => d.floodveg_km2);
  const iMax = f.indexOf(Math.max(...f)), iMin = f.indexOf(Math.min(...f));
  $("kpis").innerHTML =
    kpi(S.dates.length, "pasadas NISAR") +
    kpi(`${Math.min(...w).toFixed(1)}–${Math.max(...w).toFixed(1)}`, "km² de agua abierta") +
    kpi(f[iMax].toFixed(1) + " km²", "máx. veg. inundada · " + fmtDate(S.dates[iMax].date)) +
    kpi(f[iMin].toFixed(1) + " km²", "mín. veg. inundada · " + fmtDate(S.dates[iMin].date));
}

// ---------- sonda de un punto ----------
function interpret(db) {
  if (db === null) return "sin dato";
  if (db < -17) return "muy oscuro: agua abierta y lisa";
  if (db < -10) return "oscuro: suelo liso, playa o agua con viento";
  if (db < -3) return "medio: vegetación o cultivo";
  return "muy brillante: doble rebote (manglar inundado o edificio)";
}
map.on("click", async (e) => {
  if (!S || !S.dates.length) return;
  const col = Math.floor((e.latlng.lng - S.bbox[0]) / S.step);
  const row = Math.floor((S.bbox[3] - e.latlng.lat) / S.step);
  const hs = await Promise.all(S.dates.map(loadHH));
  if (col < 0 || row < 0 || col >= hs[0].w || row >= hs[0].h) {
    $("probe").textContent = "Ese punto está fuera de la zona de estudio.";
    return;
  }
  const vals = hs.map((h) => {
    // promedio 3x3 en lineal para reducir moteado
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const r = row + dy, c = col + dx;
      if (r < 0 || c < 0 || r >= h.h || c >= h.w) continue;
      const db = toDb(h.v[r * h.w + c]);
      if (db !== null) { s += Math.pow(10, db / 10); n++; }
    }
    return n ? +(10 * Math.log10(s / n)).toFixed(1) : null;
  });
  const cur = state.mode === "single" ? state.idx : state.b;
  if (probeMarker) map.removeLayer(probeMarker);
  probeMarker = L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#2fd6a3", fillOpacity: 1 }).addTo(map);
  const ok = vals.filter((v) => v !== null);
  $("probe").innerHTML = `<b>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</b><br>
    ${fmtDate(S.dates[cur].date)}: <b>${vals[cur] ?? "—"} dB</b> · ${interpret(vals[cur])}<br>
    Rango en el año: ${ok.length ? Math.min(...ok) + " a " + Math.max(...ok) + " dB" : "—"}`;
  $("probeChart").hidden = false;
  const data = { labels: S.dates.map((d) => fmtDate(d.date)), datasets: [{ label: "HH (dB)", data: vals, borderColor: "#2fd6a3", tension: 0.3, pointRadius: 2 }] };
  if (probeChart) { probeChart.data = data; probeChart.update(); }
  else probeChart = new Chart($("probeChart"), {
    type: "line", data,
    options: { animation: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { ...tick, maxTicksLimit: 5, maxRotation: 0 }, grid: { color: gridColor } }, y: { ticks: tick, grid: { color: gridColor } } } },
  });
});

// ---------- controles ----------
function setMode(m) {
  state.mode = m;
  document.querySelectorAll(".modes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  stopPlay();
  render();
}
document.querySelectorAll(".modes button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
document.querySelectorAll("#truthSeg button").forEach((b) => (b.onclick = () => {
  state.ref = b.dataset.ref;
  document.querySelectorAll("#truthSeg button").forEach((x) => x.classList.toggle("on", x === b));
  render();
}));
document.querySelectorAll("#layerSeg button").forEach((b) => (b.onclick = () => {
  state.layer = b.dataset.layer;
  document.querySelectorAll("#layerSeg button").forEach((x) => x.classList.toggle("on", x === b));
  render();
}));
$("dateSlider").oninput = (e) => { state.idx = +e.target.value; render(); };
$("opacity").oninput = (e) => { state.opacity = +e.target.value; [ovA, ovB].forEach((o) => o && o.setOpacity(state.opacity)); };
$("selA").onchange = (e) => { state.a = +e.target.value; render(); };
$("selB").onchange = (e) => { state.b = +e.target.value; render(); };
$("thr").oninput = (e) => { $("thrVal").textContent = e.target.value + " dB"; renderChange(); };
$("presetSeason").onclick = () => {
  // fecha más seca (menos veg. inundada) vs más húmeda; en embalse: menos vs más plantas
  const f = S.dates.map((d) => (SITE.lake ? d.floatveg_km2 ?? 0 : d.floodveg_km2));
  state.a = f.indexOf(Math.min(...f)); state.b = f.indexOf(Math.max(...f));
  if (state.a > state.b) [state.a, state.b] = [state.b, state.a];
  $("selA").value = state.a; $("selB").value = state.b;
  render();
};
function stopPlay() { if (state.playing) { clearInterval(state.playing); state.playing = null; $("play").textContent = "▶ Animar"; } }
$("play").onclick = () => {
  if (state.playing) return stopPlay();
  S.dates.forEach((d) => { new Image().src = urlFor(d); }); // precarga
  $("play").textContent = "❚❚ Pausa";
  state.playing = setInterval(() => { state.idx = (state.idx + 1) % S.dates.length; render(); }, 900);
};

// ---------- arranque ----------
(async function init() {
  const sites = (await getJSON("sites.json")) || [{ id: "barra", name: "Barra de Santiago", title: "MANGLO | Modo Científico", subtitle: "", base: "data", center: [13.715, -90.04], lake: false, labels: { water: "Agua km²", veg: "Veg. inundada km²" } }];
  const want = new URLSearchParams(location.search).get("site");
  SITE = sites.find((s) => s.id === want) || sites[0];
  BASE = SITE.base;
  $("siteSel").innerHTML = sites.map((s) => `<option value="${s.id}" ${s.id === SITE.id ? "selected" : ""}>${s.name}</option>`).join("");
  $("siteSel").onchange = (e) => { location.search = "?site=" + e.target.value; };
  $("siteTitle").textContent = SITE.title;
  $("siteSub").textContent = SITE.subtitle;
  document.title = SITE.title + " · NISAR";
  $("refVegBtn").hidden = !SITE.lake;
  map.setView(SITE.center, 12);

  S = await getJSON(BASE + "/series.json");
  // control de calidad: fuera fechas sin contraste agua/vegetación o con menos del 90 % del recuadro cubierto
  if (S && S.dates) S.dates = S.dates.filter((d) => d.qc !== false && (d.coverage_pct == null || d.coverage_pct >= 90));
  if (!S || !S.dates || !S.dates.length) { $("empty").hidden = false; return; }
  const [W, Sth, E, N] = S.bbox;
  bounds = L.latLngBounds([Sth, W], [N, E]);
  map.invalidateSize();
  map.fitBounds(bounds, { padding: [10, 10] });
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [10, 10], animate: false }); }, 400);
  L.rectangle(bounds, { color: "#2fd6a3", weight: 1, fill: false, dashArray: "4 4", interactive: false }).addTo(map);

  const n = S.dates.length;
  $("dateSlider").max = n - 1;
  $("ticks").innerHTML = `<span>${fmtDate(S.dates[0].date)}</span><span>${fmtDate(S.dates[n - 1].date)}</span>`;
  const opts = S.dates.map((d, i) => `<option value="${i}">${fmtDate(d.date)}</option>`).join("");
  $("selA").innerHTML = $("selB").innerHTML = opts;
  state.idx = n - 1; state.a = 0; state.b = n - 1;
  $("selA").value = 0; $("selB").value = n - 1;

  REF = await getJSON(BASE + "/ref/reference.json");
  VAL = await getJSON(BASE + "/ref/validation.json");
  SWOT = await getJSON(BASE + "/swot.json");
  ECO = await getJSON(BASE + "/ecostress.json");
  ML = await getJSON(BASE + "/ml.json");
  if (ML) buildMlCard();
  if (!REF) document.querySelector('[data-mode="truth"]').hidden = true;
  else $("legendWc").innerHTML = Object.values(REF.worldcover.legend).map((c) => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join("");
  if (VAL && !SITE.lake) buildValChart();
  if (SITE.lake) buildLakeCard();
  buildWqCard();

  setKpis();
  render();
  await loadRain();
  buildChart();
  highlightChart();
})();
