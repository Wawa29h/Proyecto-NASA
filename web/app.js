// Visor de cambios NISAR GCOV (varios sitios: Barra de Santiago, Cerrón Grande, ...)
const CENTER = [13.85, -89.5];
const $ = (id) => document.getElementById(id);
let SITE = null, BASE = "data";
// rutas guardadas como "data/x.png" o "ref/x.png" -> carpeta del sitio
const P = (p) => (p ? BASE + "/" + p.replace(/^data\//, "") : p);
const getJSON = async (p) => { try { const r = await fetch(p, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; } };
let SWOT = null, ECO = null, RAINJ = null, ML = null, MANG = null, CLOUDS = null, ALERTS = null, INTERP = null;
let MNET = null, RFOTO = null;   // IAs entrenadas: MangroveNet (mapa) y radar→foto
let GMW = null, CARBON = null, PONDS = null, CANE = null, FIRES = null, fireLayer = null, BURNS = null;
const fmtInt = (n) => Math.round(n).toLocaleString("es-SV");
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

let ovA = null, ovB = null, ovChange = null, ovSrc = null, probeMarker = null, gapNote = null;

function overlay(url, pane) {
  return L.imageOverlay(url, bounds, { pane, opacity: state.opacity, interactive: false }).addTo(map);
}
function clearOverlays() {
  [ovA, ovB, ovChange, ovSrc, gapNote].forEach((o) => o && map.removeLayer(o));
  ovA = ovB = ovChange = ovSrc = gapNote = null;
}
const photoFor = (d) => RFOTO?.dates?.find((x) => x.date === d.date);
const urlFor = (d) => P(state.layer === "cls" ? d.cls : state.layer === "photo" && photoFor(d) ? photoFor(d).img : d.rgb);
// capa IA: falso color atenuado debajo + plantas detectadas por el modelo encima
function mlOverlay(d, pane = "paneChange") {
  const m = mlFor(d);
  if (state.layer !== "ml" || !m) return null;
  return L.imageOverlay(P(m.img), bounds, { pane, opacity: 1, interactive: false }).addTo(map);
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
const fullRef = () => state.mode === "truth" && state.ref === "gmw";   // vista de una sola capa (sin barra)
const splitMode = () => state.mode === "compare" || (state.mode === "truth" && !fullRef());
function nearestS2(date) {
  if (!REF || !REF.sentinel2.length) return null;
  const t = new Date(date).getTime();
  return REF.sentinel2.reduce((b, s) => (Math.abs(new Date(s.date) - t) < Math.abs(new Date(b.date) - t) ? s : b));
}
function render() {
  if (!S || !S.dates.length) return;
  // fundido: en "Una fecha" la imagen anterior se queda debajo mientras aparece la nueva
  const prevA = state.mode === "single" && ovA ? ovA : null;
  if (prevA) ovA = null;
  clearOverlays();
  const single = state.mode === "single" || state.mode === "truth";
  $("ctlSingle").hidden = !single;
  $("ctlTruth").hidden = state.mode !== "truth";
  $("ctlPair").hidden = single;
  $("changeOpts").hidden = state.mode !== "change";
  $("ctlLayer").hidden = state.mode === "change";
  $("divider").hidden = !splitMode();
  $("tagA").hidden = $("tagB").hidden = !splitMode();
  if (fullRef()) $("tagB").hidden = false;   // una sola etiqueta, a todo lo ancho
  $("tagB").classList.toggle("full", fullRef());
  const th = $("truthHint");
  if (th) th.textContent = fullRef() ? "Una sola capa sobre el mapa satelital: el manglar de 1996 a 2020 y, encima, la presión de hoy. Aquí no hay barra para comparar." : "Izquierda: radar NISAR. Derecha: referencia independiente. Arrastra la barra blanca.";

  if (single) {
    const d = S.dates[state.idx];
    if (!fullRef()) ovA = overlay(urlFor(d), "paneA");   // en "Manglar 1996 → 2020" el radar crudo confunde: se deja el mapa satelital de fondo
    if (state.layer === "ml") { ovA.setOpacity(Math.min(state.opacity, 0.5)); if (state.mode === "single") ovChange = mlOverlay(d); else if (state.mode === "truth" && state.ref === "cloud") ovChange = mlOverlay(d, "paneA"); }
    if (prevA) {
      const target = ovA.options.opacity, cur = ovA;
      cur.setOpacity(0);
      requestAnimationFrame(() => requestAnimationFrame(() => cur.setOpacity(target)));
      setTimeout(() => map.hasLayer(prevA) && map.removeLayer(prevA), 650);
    }
    $("dateLabel").textContent = fmtDate(d.date);
    $("dateSlider").value = state.idx;
    $("dateSlider").setAttribute("aria-valuenow", state.idx);
    $("dateSlider").setAttribute("aria-valuetext", fmtDate(d.date) + (d.qc === false ? " (QC rechazado)" : ""));
    // de dónde viene cada pedazo: rayas grises = sin escaneo; celestes = otra órbita; moradas = aproximado de otra fecha
    if (d.coverage_pct != null && d.coverage_pct + (d.time_filled_pct || 0) < 90 && !fullRef()) {
      const b = bounds, lat = (b.getNorth() + b.getSouth()) / 2, lon = b.getEast() - (b.getEast() - b.getWest()) * 0.2;
      const later = S.dates.find((x) => x.qc && (x.coverage_pct ?? 100) >= 99);
      gapNote = L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: "gapnote", iconSize: [230, 0], iconAnchor: [115, 0],
        html: `<b>Aquí el radar no pasó este día.</b> Esta parte queda fuera del barrido de la órbita ${d.track}.${later ? ` Otra órbita la cubre desde ${fmtDate(later.date)}.` : ""}` }) }).addTo(map);
    }
    if (d.src && !fullRef()) ovSrc = L.imageOverlay(P(d.src), bounds, { pane: "paneChange", opacity: 1, interactive: false }).addTo(map);
    const fills = d.fill_from || [];
    const note = $("fillNote");
    if (d.coverage_pct != null && (d.coverage_pct < 99.5 || fills.length || d.time_filled_pct || d.edge_trim_km)) {
      note.hidden = false;
      note.innerHTML = `Cobertura <b>${Math.round(d.coverage_pct)} %</b>` +
        (fills.length ? ` · <span class="c-fill">▨ ${fills.map((f) => `${f.pct} % de la órbita ${f.track} ${f.direction === "DESCENDING" ? "descendente" : "ascendente"} (${f.gap_days} días)`).join(", ")}</span>` : "") +
        (d.time_filled_pct ? ` · <span class="c-time">▨ ${d.time_filled_pct} % aproximado con la pasada del ${(d.time_fill_from || []).map((f) => fmtDate(f.date)).join(", ")}</span>` : "") +
        (d.coverage_pct + (d.time_filled_pct || 0) < 99.5 ? ` · <span class="c-gap">▨ sin escaneo${fills.length || d.time_filled_pct ? "" : ": no había otra órbita cerca"}</span>` : "") +
        (d.edge_trim_km ? ` · borde con ruido recortado (${d.edge_trim_km} km)` : "");
    } else note.hidden = true;
    if (state.mode === "truth" && REF) {
      $("tagA").textContent = (state.layer === "photo" && photoFor(d) ? "Radar NISAR convertido en foto por IA (aproximado) · " : "Radar NISAR (NASA-ISRO) · ") + fmtDate(d.date);
      const gmwInfo = () => {
        const pres = BURNS ? `<br>🔥 <b>Círculos naranja:</b> quemas de caña de 2025–2026 vistas por <b>Sentinel-2 (ESA)</b>; borde rojo = a menos de 1 km del manglar.` :
                     PONDS ? `<br><span style="color:#ff9a1e">■</span> <b>Estanques</b> de camarón y sal encontrados por <b>NISAR</b> (${PONDS.count}, ${fmtInt(PONDS.area_ha)} ha).` : "";
        return `<b>Manglar según el radar japonés (JAXA, banda L, 1996 → 2020):</b> <span style="color:#00cf75">■</span> <b>se mantiene</b> · <span style="color:#ff6b6b">■</span> <b>se perdió</b> (${fmtInt(GMW.loss_km2 * 100)} ha) · <span style="color:#5aa0ff">■</span> <b>nuevo</b> (${fmtInt(GMW.gain_km2 * 100)} ha).${pres}<br>` +
          `<b>Conclusión:</b> en 24 años el manglar casi no cambió; la presión de hoy está alrededor, no adentro.`;
      };
      const extra = { gmw: GMW && [GMW.change_img, `Manglar 1996 → 2020 (JAXA) ${BURNS ? "+ quemas 2025–26 (Sentinel-2)" : PONDS ? "+ estanques (NISAR)" : ""}`, gmwInfo()],
                      height: CARBON && [CARBON.height_img, "Altura de los árboles · NASA (Simard 2019)", `Más verde claro = árboles más altos. Altura media <b>${CARBON.mean_height_m} m</b>, máxima ${CARBON.max_height_m} m.`],
                      ai: MNET && ["ref/mangrovenet.png", "Mapa hecho por IA solo con radar NISAR · MangroveNet", aiInfo()],
                      ponds: PONDS && [PONDS.img, "Estanques · radar NISAR", `<span style="color:#ff9a1e">■</span> agua quieta y rectangular: <b>${PONDS.count}</b> estanques, <b>${fmtInt(PONDS.area_ha)} ha</b>.`],
                      cane: CANE && [CANE.harvest_img, "Caña: mes de cosecha · fotos Sentinel-2 (ESA)", Object.entries(CANE.colors).map(([m, c]) => `<span style="color:${c}">■</span> ${m}`).join(" · ") + ` · <span style="color:#aaa">■</span> sin cosecha vista.` + (FIRES ? ` Puntos naranja: quemas (NASA FIRMS).` : "")],
                      canenisar: CANE?.nisar && [CANE.nisar.img, `Caña cortada · radar NISAR (${fmtDate(CANE.nisar.from)} → ${fmtDate(CANE.nisar.to)})`, `<span style="color:#ff6348">■</span> la señal del radar cayó ≥ 3 dB: la caña perdió hojas y tallos. <b>${CANE.nisar.cut_km2} km²</b>; el <b>${Math.round(CANE.nisar.agree_with_s2_pct)} %</b> coincide con lo que ven las fotos.`] };
      if (BURNS) {
        extra.burns = [BURNS.img_date, "Quemas de caña · fotos Sentinel-2 (ESA)", `Color = fecha de la quema: <span style="color:#ffdc3c">■</span> noviembre → <span style="color:#d7140a">■</span> mayo. Los círculos son parcelas quemadas el mismo día; tócalos para ver la fecha y la distancia al manglar.`];
        extra.burntype = [BURNS.img_type, "¿Quemada o cortada en verde? · Sentinel-2 (ESA)", `<span style="color:#e63946">■</span> quemada (${fmtInt(BURNS.burned_ha)} ha) · <span style="color:#2ecc71">■</span> cortada sin quemar (${fmtInt(BURNS.green_ha)} ha). El <b>${BURNS.burned_share_pct} %</b> de la cosecha vista fue con quema.`];
      }
      if (zafra && state.ref !== "burns") stopZafra(false);          // cambió de capa: se detiene la reproducción
      if (fireLayer && !zafra) { map.removeLayer(fireLayer); fireLayer = null; }
      if ((state.ref === "burns" || state.ref === "gmw") && BURNS?.events?.length) {
        if (!zafra) fireLayer = L.layerGroup(BURNS.events.map((e) => flameMarker(e, false))).addTo(map);   // llamas animadas
      } else if (state.ref === "cane" && FIRES?.points?.length)
        fireLayer = L.layerGroup(FIRES.points.map((p) => L.circleMarker([p.lat, p.lon], { radius: 4, color: "#fff", weight: 1, fillColor: "#ff7a00", fillOpacity: 0.9, pane: "paneB" })
          .bindTooltip(`Quema ${fmtDate(p.date)} · ${p.km_to_mangrove} km del manglar`))).addTo(map);
      if (extra[state.ref]) {
        const [img, tag, info] = extra[state.ref];
        ovB = L.imageOverlay(P(img), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        if (state.ref === "gmw" && !BURNS && PONDS) ovChange = L.imageOverlay(P(PONDS.img), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        $("tagB").textContent = tag;
        $("truthInfo").innerHTML = info;
      } else if (state.ref === "cloud" && CLOUDS?.wow) {
        const w = CLOUDS.wow;
        ovB = L.imageOverlay(P(w.photo), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        $("tagB").textContent = `Foto del ${fmtDate(w.photo_date)} · ${w.cloud_pct} % nubes`;
        $("truthInfo").innerHTML = `Ese día la foto normal salió tapada: <b>${w.cloud_pct} %</b> del embalse con nubes. El radar del ${fmtDate(w.nisar_date)} lo ve completo y la IA encontró <b>${w.ml_km2.toFixed(1)} km²</b> de plantas (amarillo).`;
      } else if (state.ref === "s2" || state.ref === "veg") {
        const s = nearestS2(d.date);
        ovB = L.imageOverlay(P(s.img), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        if (state.ref === "veg" && s.veg_img) ovChange = L.imageOverlay(P(s.veg_img), bounds, { pane: "paneB", opacity: 1, interactive: false }).addTo(map);
        const gap = Math.round(Math.abs(new Date(s.date) - new Date(d.date)) / 864e5);
        $("tagB").textContent = (state.ref === "veg" ? "Plantas · foto Sentinel-2 (ESA) · " : "Foto Sentinel-2 (ESA) · ") + fmtDate(s.date);
        $("truthInfo").innerHTML = `Foto óptica más cercana: <b>${fmtDate(s.date)}</b> (${gap} días de diferencia). La foto solo sirve sin nubes; el radar ve siempre.` +
          (s.floatveg_km2 != null && SITE.lake ? `<br>Plantas sobre el agua en la foto (NDVI &gt; 0.3): <b>${s.floatveg_km2} km²</b> · NISAR ese día: <b>${d.floatveg_km2 ?? "—"} km²</b>` : "") +
          (s.cloud_water_pct > 30 ? `<br>⚠ ${s.cloud_water_pct}% del agua tapada por nubes en la foto.` : "");
      } else {
        ovB = L.imageOverlay(P(REF.worldcover.img), bounds, { pane: "paneB", opacity: 0.85, interactive: false }).addTo(map);
        $("tagB").textContent = "Mapa de cobertura · ESA WorldCover 2021";
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
    $("tagA").textContent = seasonOf(A.date) + " · " + fmtDate(A.date);
    $("tagB").textContent = seasonOf(B.date) + " · " + fmtDate(B.date);
  } else {
    renderChange();
  }

  const isPair = state.mode === "compare" || state.mode === "change";
  const interpCard = $("interpCard");
  const warnEl = $("comparabilityWarning");
  if (isPair && S && S.dates) {
    const A = S.dates[state.a], B = S.dates[state.b];
    if (A && B) {
      updateComparabilityWarning(A, B);
      updateInterpretation(A, B);
    }
  } else {
    if (interpCard) interpCard.hidden = true;
    if (warnEl) warnEl.hidden = true;
  }
  applyClip();
  $("legendRgb").hidden = state.layer !== "rgb" && state.layer !== "ml";
  $("legendCls").hidden = state.layer !== "cls";
  $("legendMl").hidden = state.layer !== "ml";
  $("legendPhoto").hidden = state.layer !== "photo";
  $("mapLegend").hidden = !(state.mode === "single" || state.mode === "compare") || state.layer !== "rgb";
  $("pairExplain").hidden = $("goChange").hidden = state.mode !== "compare";
  if (state.mode === "compare") $("pairExplain").innerHTML = explainPair(S.dates[state.a], S.dates[state.b]);
  highlightChart();
  if (prevA && !ovA) map.removeLayer(prevA);
  window.onRender && window.onRender();
  window.onZoneRender && window.onZoneRender();
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

function updateComparabilityWarning(A, B) {
  const el = $("comparabilityWarning");
  if (!el) return;
  const covA = A.coverage_pct ?? 100;
  const covB = B.coverage_pct ?? 100;
  const fillsA = A.fill_from || [];
  const fillsB = B.fill_from || [];
  const diffCov = Math.abs(covA - covB);
  const issues = [];

  if (diffCov >= 8) {
    issues.push(`Diferencia de cobertura del barrido radar: <b>${Math.round(covA)}%</b> (${fmtDate(A.date)}) vs <b>${Math.round(covB)}%</b> (${fmtDate(B.date)}).`);
  }
  if (fillsA.length || fillsB.length) {
    issues.push(`Una o ambas observaciones incorporan rellenos orbitales con desfase temporal (no simultáneos).`);
  }

  if (issues.length) {
    el.hidden = false;
    el.innerHTML = `⚠ <b>Soporte espacial no homogéneo:</b> ${issues.join(" ")} Los cambios calculados en km² brutos no representan un cambio físico absoluto de toda la cuenca sin una máscara común.`;
  } else {
    el.hidden = true;
  }
}

function updateInterpretation(A, B) {
  const card = $("interpCard");
  const box = $("interpContent");
  if (!card || !box) return;

  const siteInterp = INTERP?.sites ? INTERP.sites[SITE.id] : null;
  const pairInterp = siteInterp?.comparisons?.find((c) => c.before_id === A.id && c.after_id === B.id);
  const isSimulated = INTERP?.data_status === "simulated";

  card.hidden = false;

  if (pairInterp) {
    const badge = isSimulated ? `<span class="badge-simulated">Datos simulados (prueba)</span><br>` : "";
    if (pairInterp.status === "not_comparable") {
      box.innerHTML = badge +
        `<b>Resultado no comparable directamente:</b><br>` +
        `Las observaciones del <b>${fmtDate(A.date)}</b> y <b>${fmtDate(B.date)}</b> no comparten el mismo soporte espacial o temporal.<br>` +
        (pairInterp.limitations?.length ? `<p class="hint" style="margin-top:4px">${pairInterp.limitations.map((l) => "• " + l).join("<br>")}</p>` : "");
      return;
    }

    if (pairInterp.status === "supported" && pairInterp.hypotheses?.length) {
      const hyposHtml = pairInterp.hypotheses.map((h) =>
        `<div class="interp-hypo">` +
        `<b>${h.summary}</b><br>` +
        (h.evidence ? `<span>Evidencia: ${h.evidence}</span><br>` : "") +
        (h.confidence ? `<small style="color:var(--muted)">Confianza: ${h.confidence}</small>` : "") +
        `</div>`
      ).join("");

      box.innerHTML = badge +
        (pairInterp.observed_change ? `<span>Cambio observado: <b>${pairInterp.observed_change.delta_km2} ${pairInterp.observed_change.unit}</b> en ${pairInterp.observed_change.variable}</span><br>` : "") +
        hyposHtml +
        (pairInterp.limitations?.length ? `<p class="hint" style="margin-top:4px">${pairInterp.limitations.map((l) => "• " + l).join("<br>")}</p>` : "");
      return;
    }
  }

  // Si no hay hipótesis precalculadas:
  const covA = A.coverage_pct ?? 100, covB = B.coverage_pct ?? 100;
  if (Math.abs(covA - covB) > 10) {
    box.innerHTML = `<b>No comparable:</b> La cobertura del barrido difiere significativamente entre ${fmtDate(A.date)} (${Math.round(covA)}%) y ${fmtDate(B.date)} (${Math.round(covB)}%). Se requiere una máscara común aprobada por el equipo científico.`;
  } else {
    box.innerHTML = `<b>Información científica pendiente:</b> No hay evidencia suficiente para proponer una explicación causal automática entre el <b>${fmtDate(A.date)}</b> y el <b>${fmtDate(B.date)}</b>.<br>` +
      `<p class="hint" style="margin-top:4px">Las variaciones de retrodispersión radar pueden obedecer a múltiples variables (humedad del dosel, nivel de marea, rugosidad superficial o fenología vegetal). Pendiente de reglas validadas.</p>`;
  }
}

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

  const tbl = $("chartAccessibleTable");
  if (tbl) {
    const rainName = RAINJ ? "Lluvia (mm)" : "Lluvia (Open-Meteo mm)";
    const vegName = SITE.labels.veg;
    const waterName = SITE.labels.water;
    const rowsHtml = S.dates.map((d) => {
      const rVal = rain12(d.date);
      const vVal = SITE.lake ? d.floatveg_km2 : d.floodveg_km2;
      return `<tr><td>${fmtDate(d.date)}</td><td>${rVal ?? "—"}</td><td>${d.water_km2 != null ? d.water_km2.toFixed(2) : "—"}</td><td>${vVal != null ? vVal.toFixed(2) : "—"}</td></tr>`;
    }).join("");
    tbl.innerHTML = `<table class="sr-table" aria-label="Tabla accesible de observaciones temporales"><thead><tr><th scope="col">Fecha</th><th scope="col">${rainName}</th><th scope="col">${waterName}</th><th scope="col">${vegName}</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  }
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
// ---------- "Antes / después" explicado en lenguaje simple ----------
const isRainy = (iso) => { const m = +iso.slice(5, 7); return m >= 5 && m <= 10; };   // El Salvador: lluvias de mayo a octubre
const seasonOf = (iso) => (isRainy(iso) ? "Época de lluvias" : "Época seca");
function explainPair(A, B) {
  if (!A || !B) return "";
  const sameSeason = isRainy(A.date) === isRainy(B.date);
  const km = (x) => (x == null ? "—" : (+x).toFixed(1).replace(".0", ""));
  const trend = (a, b, up, down) => (b - a > 0.15 * Math.max(a, 0.5) ? up : a - b > 0.15 * Math.max(a, 0.5) ? down : "casi igual");
  let out = `<p class="explain-h">${sameSeason ? `Las dos fechas son de la <b>${seasonOf(A.date).toLowerCase().replace("época de ", "época de ")}</b>` : `<b>${seasonOf(A.date)}</b> contra <b>${seasonOf(B.date).toLowerCase()}</b>`}</p>`;
  if (SITE.lake) {
    out += `<p>💧 <b>Agua del embalse:</b> ${km(A.water_km2)} → ${km(B.water_km2)} km² (${trend(A.water_km2, B.water_km2, "subió: llovió o la represa guardó agua", "bajó: la represa usó agua para generar luz")}).</p>`;
    out += `<p>🌿 <b>Plantas sobre el agua</b> (verde encima del agua, posible lirio): ${km(A.floatveg_km2)} → ${km(B.floatveg_km2)} km².</p>`;
    out += `<p class="explain-note">${sameSeason ? "En la misma época el embalse debería verse parecido: un cambio grande de lirio sí es para avisar." : "Entre seca y lluvias es normal que el embalse cambie mucho de tamaño."}</p>`;
    return out;
  }
  out += sameSeason
    ? `<p>🟪 El paisaje debería verse parecido. Si una mancha <b>dentro del manglar</b> pasa de verde a morado, eso sí sería para revisar (posible tala).</p>`
    : `<p>🟪→🟩 Las parcelas que pasan de <b>morado a verde</b> (o al revés) son sobre todo <b>caña</b>: se corta en la zafra (noviembre a mayo) y vuelve a crecer con la lluvia. <b>Es normal.</b></p>`;
  const mg = MANG && MANG[{ barra: "Barra de Santiago", jiquilisco: "Bahia de Jiquilisco" }[SITE.id]];
  const hv = (d) => mg?.dates.find((r) => r.date === d.date)?.hv_mangrove;
  if (mg && hv(A) != null && hv(B) != null) {
    const dd = hv(B) - hv(A);
    out += `<p>🌳 <b>El manglar</b> (junto al estero) ${Math.abs(dd) < 1 ? "<b>casi no cambió</b>." : dd > 0 ? `se ve más brillante: con la lluvia las hojas y el suelo mojados rebotan más el radar. <b>Es natural</b>, no es que creciera.` : `se ve un poco más apagado: hojas y suelo más secos. <b>Es natural.</b>`} En todo el año perdió solo <b>${Math.round(mg.loss_km2 * 100)} ha</b>: está estable.</p>`;
  }
  const part = [A, B].filter((d) => (d.coverage_pct ?? 100) + (d.time_filled_pct || 0) < 90);
  out += `<p>💧 <b>Agua del estero:</b> ${km(A.water_km2)} → ${km(B.water_km2)} km².` +
    (part.length ? ` <span class="explain-warn">⚠ El ${part.map((d) => fmtDate(d.date)).join(" y el ")} el radar solo vio el ${Math.round(part[0].coverage_pct)} % del recuadro: ese número sale más bajo de lo real.</span>` : "") + `</p>`;
  if (A.ocean_km2) out += `<p class="explain-note">El mar cambia de color por el <b>viento y las olas</b>, no porque el agua sea distinta.</p>`;
  return out;
}

// ---------- IAs entrenadas con NISAR (MangroveNet y radar→foto) ----------
const pctTxt = (x) => Math.round(x * 100) + " %";
function aiInfo() {
  const m = MNET.metrics_vs_worldcover, mg = m.per_class.manglar;
  const leg = MNET.classes.map((c, i) => `<span style="color:${MNET.colors[i]}">■</span> ${c}`).join(" · ");
  const test = MNET.role === "prueba" || MNET.role === "validación";
  return `${leg}<br>` + (test
    ? `<b>Esta IA nunca vio este lugar:</b> aprendió en ${MNET.train_sites.map((s) => s === "jiquilisco" ? "Jiquilisco" : "Cerrón Grande").join(" y ")} y aquí la probamos. `
    : `<b>Aquí la IA aprendió</b> (no es una prueba independiente: la prueba es Barra de Santiago). `) +
    (mg ? `Reconoce el manglar con <b>${pctTxt(mg.f1)}</b> de acierto y mide <b>${MNET.mangrove_km2_pred} km²</b> (el mapa de la ESA dice ${MNET.mangrove_km2_worldcover} km²).` :
          `Aquí no hay manglar y la IA no inventó ninguno (${MNET.mangrove_km2_pred} km²).`) +
    `<br>Cambia a "Mapa ESA WorldCover" para compararlos.`;
}
function buildAiCard() {
  const m = MNET.metrics_vs_worldcover, mg = m.per_class.manglar;
  const test = MNET.role === "prueba" || MNET.role === "validación";
  $("aiKpis").innerHTML =
    (mg ? kpi(pctTxt(mg.f1), `acierto reconociendo el manglar${test ? " en un lugar que la IA nunca vio" : " (aquí aprendió; la prueba real es Barra)"}`) +
          kpi(`${MNET.mangrove_km2_pred} km²`, `de manglar según la IA (ESA: ${MNET.mangrove_km2_worldcover} km²)`) : "") +
    kpi(pctTxt(m.accuracy), "del mapa clasificado igual que la ESA") +
    (RFOTO ? kpi(`${RFOTO.val_error_0_255}/255`, `error del radar→foto en la zona no usada para entrenar (pintar el color medio: ${RFOTO.baseline_mean_color_error})`) : "");
  $("aiHint").innerHTML = `<b>1. MangroveNet</b> dibuja el mapa de agua, manglar, árboles y caña usando solo radar: así se puede vigilar cada 12 días aunque esté nublado.` +
    (RFOTO ? ` <b>2. Radar → foto</b> convierte cada pasada en una imagen parecida a una foto satelital (aproximada, no real).` : "") +
    ` Las dos coinciden: el manglar está estable y lo que más cambia está en los bordes (caña, suelos).`;
  $("aiTable").innerHTML = `<table class="ai-table"><tr><th>Clase</th><th>F1</th><th>Precisión</th><th>Exhaustividad</th></tr>` +
    Object.entries(m.per_class).map(([c, v]) => `<tr><td>${c}</td><td>${v.f1}</td><td>${v.precision}</td><td>${v.recall}</td></tr>`).join("") +
    `</table><p class="hint">U-Net con 10 canales temporales de NISAR (HH, HV). Etiquetas: ESA WorldCover 2021. Entrenada en ${MNET.train_sites.join(" + ")} (sin su franja este, que sirvió para elegir el modelo); ${MNET.val_site} solo se usó como prueba final. Mejor modelo tras ${MNET.minutes_trained} min en GPU.` +
    (RFOTO ? ` Radar→foto: U-Net + PatchGAN (pix2pix), PSNR ${RFOTO.val_psnr_db} dB en el 20 % este no usado para entrenar (también sirvió para elegir el modelo: algo optimista).` : "") + `</p>`;
  $("aiPhotoGo").hidden = !RFOTO;
  $("aiPhotoGo").onclick = () => { setMode("single"); $("layerPhotoBtn").click(); $("map").scrollIntoView({ behavior: "smooth", block: "center" }); };
  $("aiCard").hidden = false;
}

function buildMlCard() {
  const v = ML.validation;
  const gain = Math.round((100 * (v.mean_f1 - v.mean_f1_rule)) / Math.max(v.mean_f1_rule, 1e-6));
  const wins = v.folds.filter((f) => f.f1 > f.f1_rule).length;
  // la foto y el radar no son del mismo día: las plantas flotantes se mueven. Con ≤ 4 días la comparación es justa.
  const close = v.folds.filter((f) => f.gap_days <= 4), far = v.folds.filter((f) => f.gap_days > 4);
  const avgF = (a, k = "f1") => a.reduce((s, f) => s + f[k], 0) / Math.max(1, a.length);
  $("mlKpis").innerHTML =
    kpi(avgF(close).toFixed(2), `acierto cuando foto y radar están a ≤ 4 días (${close.length} pruebas)`) +
    kpi(avgF(far).toFixed(2), `acierto con 5–7 días: las plantas ya se movieron (${far.length} pruebas)`) +
    kpi((gain >= 0 ? "+" : "") + gain + " %", `mejora sobre la regla fija (${v.mean_f1.toFixed(2)} vs ${v.mean_f1_rule.toFixed(2)})`) +
    kpi(`${wins} de ${v.folds.length}`, "fechas de prueba donde gana");
  ML.close_f1 = avgF(close);
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
    `El acierto baja cuando pasan más días entre la foto y el radar: eso indica que las plantas son <b>flotantes y se mueven</b> con el viento y la corriente. ` +
    `Lo que más usa el modelo: ${top}. Prueba de concepto con un año de datos.`;
  $("layerMlBtn").hidden = false;
  $("mlCard").hidden = false;
}
function buildMangCard() {
  const names = Object.keys(MANG);
  const colors = ["#00cf75", "#4fc3f7", "#ffd166"];
  tsChart($("mangChart"), names.map((n, i) => ({
    label: n, data: MANG[n].dates.map((r) => ({ x: T(r.date), y: r.hv_mangrove })), color: colors[i % 3], yAxisID: "h",
  })), [{ id: "h", title: "HV del manglar (dB)" }]);
  $("mangTable").innerHTML = `<table class="mtable" aria-label="Tabla comparativa de manglares"><thead><tr><th scope="col">Indicador</th>${names.map((n) => `<th scope="col">${n.replace("Bahia", "Bahía")}</th>`).join("")}</tr></thead><tbody>` +
    `<tr><th scope="row">Manglar (mapa ESA)</th>${names.map((n) => `<td>${MANG[n].mangrove_km2} km²</td>`).join("")}</tr>` +
    `<tr><th scope="row"><b>Pérdida en el año *</b></th>${names.map((n) => `<td><b>${(MANG[n].loss_km2 * 100).toFixed(0)} ha (${MANG[n].loss_pct}%)</b></td>`).join("")}</tr>` +
    `<tr><th scope="row">Rango de HV observado en el año</th>${names.map((n) => `<td>${MANG[n].hv_range_db} dB</td>`).join("")}</tr>` +
    `<tr><th scope="row">Manglar con agua debajo</th>${names.map((n) => `<td>${MANG[n].flooded_range_pct[0]}–${MANG[n].flooded_range_pct[1]} %</td>`).join("")}</tr></tbody></table>` +
    `<p class="hint" style="margin-top:6px;font-size:11px;color:var(--muted)">* Nota científica: La cifra reportada como 'pérdida' responde al umbral de caída radar (&lt; -3 dB en media de 3 fechas); es un indicador de variación de retrodispersión, no una comprobación de tala física sin verificación en campo.</p>`;
  $("mangCard").hidden = false;
}
function buildCaneCard() {
  const near = CANE.by_distance_km2["0-1 km"] ?? 0;
  $("caneKpis").innerHTML =
    kpi(`${CANE.crop_km2} km²`, "de cultivos (sobre todo caña) alrededor del manglar") +
    kpi(`${Math.round((100 * near) / CANE.crop_km2)} %`, `de esos cultivos está a menos de 1 km del manglar (${near} km²)`) +
    kpi(`${CANE.harvested_pct} %`, "de los cultivos se cosechó en la zafra 2025–2026") +
    (CANE.nisar ? kpi(`${Math.round(CANE.nisar.agree_with_s2_pct)} %`, "de lo que el radar vio cortado coincide con las fotos") : "");
  const months = Object.keys(CANE.harvest_by_month_km2);
  new Chart($("caneChart"), {
    type: "bar",
    data: { labels: months, datasets: [
      { label: "km² cosechados", data: months.map((m) => CANE.harvest_by_month_km2[m]), backgroundColor: months.map((m) => CANE.colors[m]) },
      { label: "a menos de 1 km del manglar", data: months.map((m) => CANE.harvest_near_mangrove_km2[m]), backgroundColor: "rgba(255,255,255,.35)" },
    ] },
    options: { animation: false, plugins: { legend: { labels: { color: "#c8d8d5", boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { ticks: tick, grid: { display: false } }, y: { ticks: tick, grid: { color: gridColor }, title: { display: true, text: "km²", color: "#93aaa6" } } } },
  });
  if (BURNS) buildBurns();
  $("fireBox").innerHTML = FIRES
    ? `🔥 <b>${FIRES.count}</b> puntos de quema detectados por NASA FIRMS (${fmtDate(FIRES.from)} – ${fmtDate(FIRES.to)}); <b>${FIRES.near_mangrove["<1 km"]}</b> a menos de 1 km del manglar y ${FIRES.near_mangrove["<3 km"]} a menos de 3 km.`
    : `🔥 Quemas (NASA FIRMS): el script está listo; falta la llave gratuita de FIRMS para bajar los puntos de fuego.`;
  const eco = (ECO?.observations || []).filter((o) => o.day && o.mangrove_c != null && o.crop_c != null);
  if (eco.length) {
    const diff = eco.reduce((s, o) => s + (o.crop_c - o.mangrove_c), 0) / eco.length;
    $("caneTemp").innerHTML = `🌡️ De día, el cañal está en promedio <b>${diff.toFixed(1)} °C más caliente</b> que el manglar (${eco.length} pasadas de NASA ECOSTRESS). El manglar refresca la zona.`;
  } else $("caneTemp").innerHTML = "🌡️ Temperatura manglar vs cañal (NASA ECOSTRESS): en proceso.";
  $("caneCard").hidden = false;
}
// ---------- quemas dramáticas: llamas animadas y "ver la zafra quemarse" ----------
let zafra = null;
function flameMarker(e, flash) {
  const near = e.km_to_mangrove < 0.5;                 // anillo solo si está a menos de 500 m del manglar
  const s = Math.round(Math.min(28, 11 + Math.sqrt(e.ha) * 2.6));   // más discreto en el mapa 2D
  const html = `<div class="flame ${near ? "near" : ""} ${flash ? "flash" : ""}" style="width:${s}px;height:${s}px">` +
    `<span class="glow" style="width:${s * 1.35}px;height:${s * 1.35}px"></span>` +
    (near ? `<span class="ring" style="width:${s * 1.2}px;height:${s * 1.2}px"></span>` : "") +
    `<span class="fire" style="font-size:${Math.round(s * 0.75)}px">🔥</span></div>`;
  return L.marker([e.lat, e.lon], { icon: L.divIcon({ className: "", html, iconSize: [s, s], iconAnchor: [s / 2, s * 0.75] }), zIndexOffset: near ? 500 : 0 })
    .bindTooltip(`🔥 Quemada entre el ${fmtDate(e.from)} y el ${fmtDate(e.to)} · ${e.ha} ha · ${e.km_to_mangrove < 0.05 ? "pegada al" : e.km_to_mangrove + " km del"} manglar`);
}
function stopZafra(keep) {
  if (!zafra) return;
  clearInterval(zafra.timer);
  zafra = null;
  $("zafraPlay").textContent = "▶ Ver la zafra quemarse";
  if (!keep) $("zafraClock").hidden = true;
}
function playZafra() {
  if (zafra) return stopZafra(true);
  if (!BURNS?.events?.length) return;
  setMode("truth");
  state.ref = "burns";
  document.querySelectorAll("#truthSeg button").forEach((b) => b.classList.toggle("on", b.dataset.ref === "burns"));
  render();
  if (fireLayer) map.removeLayer(fireLayer);
  fireLayer = L.layerGroup().addTo(map);
  map.flyToBounds(bounds, { padding: [10, 10], duration: 1 });
  const evs = BURNS.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const t0 = new Date(BURNS.from + "T12:00:00"), t1 = new Date(BURNS.to + "T12:00:00");
  let day = 0, i = 0, ha = 0, nearHa = 0;
  const total = Math.round((t1 - t0) / 864e5);
  zafra = { timer: null };
  $("zafraPlay").textContent = "❚❚ Pausa";
  $("zafraClock").hidden = false;
  zafra.timer = setInterval(() => {
    const now = new Date(t0.getTime() + day * 864e5), iso = now.toISOString().slice(0, 10);
    while (i < evs.length && evs[i].date <= iso) {
      fireLayer.addLayer(flameMarker(evs[i], true));
      ha += evs[i].ha;
      if (evs[i].km_to_mangrove < 1) nearHa += evs[i].ha;
      i++;
    }
    $("zafraClock").innerHTML = `🔥 ${now.toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" })}` +
      `<small>${Math.round(ha)} ha quemadas · ${Math.round(nearHa)} ha a menos de 1 km del manglar</small>`;
    day++;
    if (day > total) stopZafra(true);
  }, 110);
}
function buildBurns() {
  $("zafraPlay").onclick = playZafra;
  const B = BURNS;
  $("burnKpis").innerHTML =
    kpi(`${fmtInt(B.burned_ha)} ha`, "de caña quemada en la zafra 2025–2026") +
    kpi(`${B.burned_share_pct} %`, `de la cosecha fue con quema (el resto, ${fmtInt(B.green_ha)} ha, en verde)`) +
    kpi(`${fmtInt(B.burned_within_1km_ha)} ha`, `quemadas a menos de 1 km del manglar (${fmtInt(B.burned_within_500m_ha)} ha a menos de 500 m)`) +
    kpi(String(B.events_count), `quemas por parcela detectadas (${B.events_within_1km} a menos de 1 km del manglar)`);
  const wk = Object.keys(B.by_week_ha);
  new Chart($("burnWeekChart"), {
    type: "bar",
    data: { labels: wk.map((w) => new Date(w + "T12:00:00").toLocaleDateString("es-SV", { day: "numeric", month: "short" })),
      datasets: [{ label: "ha quemadas por semana", data: wk.map((w) => B.by_week_ha[w]), backgroundColor: "#ff7a00" }] },
    options: { animation: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { ...tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { display: false } }, y: { ticks: tick, grid: { color: gridColor }, title: { display: true, text: "ha", color: "#93aaa6" } } } },
  });
  if (B.median_window_days != null) $("burnWeekHint").innerHTML += ` La mitad de las quemas quedan fechadas con una ventana de <b>${B.median_window_days} días</b> o menos.`;
  const short = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-SV", { day: "numeric", month: "short" });
  $("burnList").innerHTML = `<p class="hint" style="margin:0 0 4px">Quemas más cercanas al manglar (toca una para ir al lugar):</p>` +
    B.events.slice().sort((a, b) => a.km_to_mangrove - b.km_to_mangrove || b.ha - a.ha).slice(0, 25).map((e, i) =>
    `<div class="burnrow" data-i="${i}" data-lat="${e.lat}" data-lon="${e.lon}"><span>🔥</span><span>entre el <b>${short(e.from)}</b> y el <b>${short(e.to)}</b> · ${e.ha} ha</span>` +
    `<span class="${e.km_to_mangrove < 1 ? "near" : ""}">${e.km_to_mangrove < 0.05 ? "pegada al manglar" : e.km_to_mangrove + " km"}</span></div>`).join("");
  document.querySelectorAll(".burnrow").forEach((r) => (r.onclick = () => {
    setMode("truth"); state.ref = "burns";
    document.querySelectorAll("#truthSeg button").forEach((b) => b.classList.toggle("on", b.dataset.ref === "burns"));
    render(); map.flyTo([+r.dataset.lat, +r.dataset.lon], 15, { duration: 1.2 });
  }));
  $("burnBox").hidden = false;
}
function buildMangroveExtras() {
  if (GMW) {
    const yrs = Object.keys(GMW.years);
    const nisarYear = MANG && Object.values(MANG).find((v, i) => Object.keys(MANG)[i].toLowerCase().includes(SITE.id === "jiquilisco" ? "jiquilisco" : "barra"));
    tsChart($("histChart"), [
      { label: "Manglar (radar JAXA, km²)", data: yrs.map((y) => ({ x: T(`${y}-07-01`), y: GMW.years[y] })), color: "#00cf75", yAxisID: "a" },
    ], [{ id: "a", title: "km²" }]);
    const c = Chart.getChart("histChart");
    c.options.scales.a.min = Math.floor(Math.min(...yrs.map((y) => GMW.years[y])) * 0.9);
    c.options.scales.x.ticks.callback = (v) => new Date(v).getFullYear();
    c.update();
    const first = GMW.years[yrs[0]], last = GMW.years[yrs[yrs.length - 1]];
    $("histKpis").innerHTML =
      kpi(`${((100 * (last - first)) / first).toFixed(1)} %`, `cambio del área ${GMW.from}–${GMW.to}: el manglar se ha sostenido`) +
      kpi(`${fmtInt(GMW.loss_km2 * 100)} ha`, `perdidas en algunos lugares (y ${fmtInt(GMW.gain_km2 * 100)} ha ganadas en otros)`) +
      (nisarYear ? kpi(`${nisarYear.loss_pct} %`, "pérdida vista por NISAR en 2025–2026: sigue estable") : "");
    $("histCard").hidden = false;
  }
  if (CARBON) {
    $("carbonBig").innerHTML = `${fmtInt(CARBON.co2_t)} t de CO₂<small>guardadas en los árboles de ${fmtInt(CARBON.area_ha)} ha de manglar</small>`;
    $("carbonKpis").innerHTML =
      kpi(fmtInt(CARBON.cars_year_equiv), "carros circulando un año emiten lo mismo") +
      kpi(`${CARBON.co2_per_ha_t} t`, "de CO₂ por hectárea, solo en los árboles") +
      kpi(`${CARBON.mean_height_m} m`, `altura media de los árboles (máx. ${CARBON.max_height_m} m)`) +
      kpi("×3–5", "más carbono guarda el suelo del manglar (no incluido aquí)");
    $("carbonHint").textContent = "Fuente: mapa de biomasa y altura de manglares de NASA (Simard et al. 2019, ORNL DAAC). Cálculo: biomasa de árboles + raíces × 0,47 de carbono × 3,67. El suelo no se cuenta, así que el valor real es mayor.";
    $("carbonCard").hidden = false;
  }
  if (PONDS && PONDS.count > 0) {
    $("pondsKpis").innerHTML =
      kpi(PONDS.count, "estanques rectangulares detectados") +
      kpi(`${fmtInt(PONDS.area_ha)} ha`, "de estanques en total") +
      kpi(`${fmtInt(PONDS.near_mangrove_ha)} ha`, "a menos de 1 km del manglar") +
      (PONDS.gmw_loss_near_ponds_ha != null ? kpi(`${fmtInt(PONDS.gmw_loss_near_ponds_ha)} ha`, "del manglar perdido desde 1996 está a menos de 300 m de un estanque") : "");
    $("pondsCard").hidden = false;
  }
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
  const w = S.dates.map((d) => d.water_km2);
  const f = S.dates.map((d) => (SITE.lake ? d.floatveg_km2 : d.floodveg_km2));
  const wOk = w.filter((x) => x != null);
  const fOk = f.filter((x) => x != null);
  const vegLabel = SITE.lake ? "plantas en agua" : "veg. inundada";
  if (!wOk.length || !fOk.length) {
    $("kpis").innerHTML = kpi(S.dates.length, "pasadas NISAR") + kpi("—", "observaciones válidas");
    return;
  }
  const iMax = f.indexOf(Math.max(...fOk)), iMin = f.indexOf(Math.min(...fOk));
  $("kpis").innerHTML =
    kpi(S.dates.length, "pasadas NISAR") +
    kpi(`${Math.min(...wOk).toFixed(1)}–${Math.max(...wOk).toFixed(1)}`, "km² de agua abierta") +
    kpi(f[iMax].toFixed(1) + " km²", `máx. ${vegLabel} · ` + fmtDate(S.dates[iMax].date)) +
    kpi(f[iMin].toFixed(1) + " km²", `mín. ${vegLabel} · ` + fmtDate(S.dates[iMin].date));
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
  if (!S || !S.dates.length || window.zoneDrawing) return;   // mientras se dibuja "tu zona" no se hace la sonda
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
  probeMarker = L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#149BA5", fillOpacity: 1 }).addTo(map);
  const ok = vals.filter((v) => v !== null);
  $("probe").innerHTML = `<b>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</b><br>
    ${fmtDate(S.dates[cur].date)}: <b>${vals[cur] ?? "—"} dB</b> · ${interpret(vals[cur])}<br>
    Rango en el año: ${ok.length ? Math.min(...ok) + " a " + Math.max(...ok) + " dB" : "—"}`;
  $("probeChart").hidden = false;
  const data = { labels: S.dates.map((d) => fmtDate(d.date)), datasets: [{ label: "HH (dB)", data: vals, borderColor: "#149BA5", tension: 0.3, pointRadius: 2 }] };
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
  document.querySelectorAll(".modes button").forEach((b) => {
    const active = b.dataset.mode === m;
    b.classList.toggle("on", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  stopPlay();
  if (typeof stopZafra === "function") stopZafra(false);
  if (m !== "truth" && fireLayer) { map.removeLayer(fireLayer); fireLayer = null; }   // las llamas solo en "Radar vs foto"
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
$("goChange").onclick = () => setMode("change");
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
  $("btn3d").href = "respira.html?site=" + SITE.id;   // el 3D del sitio que está abierto
  $("siteTitle").textContent = SITE.title;
  $("siteSub").textContent = SITE.subtitle;
  document.title = SITE.title + " · NISAR";
  $("refVegBtn").hidden = !SITE.lake;
  map.setView(SITE.center, 12);

  S = await getJSON(BASE + "/series.json");
  // control de calidad: fuera fechas sin contraste agua/vegetación o con menos del 90 % del recuadro cubierto
  const minCov = SITE.min_coverage ?? 90; // algunos sitios quedan siempre al borde de la pasada (mismo recorte en todas las fechas)
  if (S && S.dates) S.dates = S.dates.filter((d) => d.qc !== false && (d.coverage_pct == null || d.coverage_pct + (d.time_filled_pct || 0) >= minCov));
  if (!S || !S.dates || !S.dates.length) { $("empty").hidden = false; return; }
  const [W, Sth, E, N] = S.bbox;
  bounds = L.latLngBounds([Sth, W], [N, E]);
  map.invalidateSize();
  map.fitBounds(bounds, { padding: [10, 10] });
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [10, 10], animate: false }); }, 400);
  L.rectangle(bounds, { color: "#149BA5", weight: 1, fill: false, dashArray: "4 4", interactive: false }).addTo(map);

  const n = S.dates.length;
  $("dateSlider").max = n - 1;
  $("ticks").innerHTML = `<span>${fmtDate(S.dates[0].date)}</span><span>${fmtDate(S.dates[n - 1].date)}</span>`;
  const opts = S.dates.map((d, i) => `<option value="${i}">${fmtDate(d.date)}</option>`).join("");
  $("selA").innerHTML = $("selB").innerHTML = opts;
  state.idx = n - 1; state.a = 0; state.b = n - 1;
  $("selA").value = 0; $("selB").value = n - 1;
  $("dateSlider").setAttribute("aria-label", "Línea temporal de observaciones radar NISAR");
  $("siteSel").setAttribute("aria-label", "Seleccionar región de estudio");
  $("selA").setAttribute("aria-label", "Fecha inicial para comparación");
  $("selB").setAttribute("aria-label", "Fecha posterior para comparación");
  $("thr").setAttribute("aria-label", "Umbral de cambio en decibelios");
  $("opacity").setAttribute("aria-label", "Opacidad de la capa radar");

  INTERP = (await getJSON(BASE + "/interpretations.json")) || (await getJSON("fixtures/interpretations_simulated.json"));
  REF = await getJSON(BASE + "/ref/reference.json");
  VAL = await getJSON(BASE + "/ref/validation.json");
  SWOT = await getJSON(BASE + "/swot.json");
  ECO = await getJSON(BASE + "/ecostress.json");
  ML = await getJSON(BASE + "/ml.json");
  if (ML) buildMlCard();
  MNET = await getJSON(BASE + "/ref/mangrovenet.json");
  RFOTO = await getJSON(BASE + "/ref/radarfoto.json");
  if (RFOTO && !RFOTO.site_has_photos) RFOTO = null;   // Jiquilisco: la mitad este (otra órbita) sale mal; no se muestra hasta corregirla
  document.querySelectorAll("#truthSeg .ai-only").forEach((b) => (b.hidden = !MNET));
  $("layerPhotoBtn").hidden = !RFOTO;
  if (MNET) buildAiCard();
  if (SITE.lake) {
    CLOUDS = await getJSON(BASE + "/clouds.json");
    ALERTS = await getJSON(BASE + "/alerts.json");
    if (CLOUDS?.wow) $("refCloudBtn").hidden = false;
  }
  if (REF && !(REF.sentinel2 || []).length) {
    // sitio sin fotos Sentinel-2 descargadas: solo se compara con el mapa ESA
    document.querySelectorAll('#truthSeg [data-ref="s2"], #truthSeg [data-ref="veg"]').forEach((b) => (b.hidden = true));
    state.ref = "wc";
    document.querySelectorAll("#truthSeg button").forEach((b) => b.classList.toggle("on", b.dataset.ref === "wc"));
  }
  if (!REF) document.querySelector('[data-mode="truth"]').hidden = true;
  else $("legendWc").innerHTML = Object.values(REF.worldcover.legend).map((c) => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join("");
  if (VAL && !SITE.lake) buildValChart();
  if (SITE.lake) buildLakeCard();
  if (SITE.mangrove) {
    MANG = await getJSON("mangrove_comparison.json"); if (MANG) buildMangCard();
    GMW = await getJSON(BASE + "/ref/gmw.json");
    CARBON = await getJSON(BASE + "/ref/carbon.json");
    PONDS = await getJSON(BASE + "/ref/ponds.json");
    CANE = await getJSON(BASE + "/ref/cane.json");
    FIRES = await getJSON(BASE + "/ref/fires.json");
    BURNS = await getJSON(BASE + "/ref/burns.json");
    document.querySelectorAll("#truthSeg .burn-only").forEach((b) => (b.hidden = !BURNS));
    document.querySelectorAll("#truthSeg .cane-only").forEach((b) => (b.hidden = !(b.dataset.ref === "cane" ? CANE : CANE?.nisar)));
    if (CANE) buildCaneCard();
    document.querySelectorAll("#truthSeg .mg-only").forEach((b) => (b.hidden = !({ gmw: GMW, height: CARBON, ponds: PONDS }[b.dataset.ref])));
    buildMangroveExtras();
  }
  buildWqCard();

  setKpis();
  render();
  await loadRain();
  buildChart();
  highlightChart();
  window.onDataReady && window.onDataReady();
})();
