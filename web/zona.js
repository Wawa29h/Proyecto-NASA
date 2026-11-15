// "Analiza tu zona": el usuario marca un polígono sobre el mapa y se cuenta qué hay adentro.
// Todo se calcula en el navegador con las imágenes que ya usa la app (MangroveNet, WorldCover, radar del día).
(function () {
  const Z = { drawing: false, pts: [], line: null, poly: null, marks: [] };
  const pxCache = {};
  const btn = $("zoneBtn"), bar = $("zoneBar"), card = $("zoneCard");

  // ---------- leer una imagen como píxeles ----------
  function loadPx(url) {
    if (pxCache[url]) return pxCache[url];
    pxCache[url] = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        res({ w: c.width, h: c.height, d: ctx.getImageData(0, 0, c.width, c.height).data });
      };
      img.onerror = () => { delete pxCache[url]; rej(new Error("no se pudo leer " + url)); };
      img.src = url;
    });
    return pxCache[url];
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function nearest(r, g, b, pal) {
    let best = 0, bd = 1e9;
    pal.forEach((p, i) => { const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const CLS_PAL = [[30, 136, 229], [216, 27, 196], [60, 220, 90], [20, 50, 90]]; // agua, veg. inundada, plantas flotando, mar

  // ---------- máscara del polígono en la grilla del radar ----------
  function inside(x, y, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function maskFor(pts, w, h) {
    const [W, , , N] = S.bbox, st = S.step;
    const P = pts.map((p) => [(p.lng - W) / st, (N - p.lat) / st]);   // a columnas/filas
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
    const idx = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x + 0.5, y + 0.5, P)) idx.push(y * w + x);
    return idx;
  }
  // área total del dibujo (también lo que queda fuera del recuadro estudiado)
  function polyKm2(pts) {
    const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length, k = 111.32;
    const xy = pts.map((p) => [p.lng * k * Math.cos((lat0 * Math.PI) / 180), p.lat * k]);
    let a = 0;
    for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) a += (xy[j][0] + xy[i][0]) * (xy[j][1] - xy[i][1]);
    return Math.abs(a / 2);
  }

  // ---------- dibujo ----------
  function clearDrawing() {
    [Z.line, Z.poly, ...Z.marks].forEach((l) => l && map.removeLayer(l));
    Z.line = Z.poly = null; Z.marks = []; Z.pts = [];
  }
  function startDraw() {
    clearDrawing();
    Z.drawing = window.zoneDrawing = true;
    map.doubleClickZoom.disable();
    map.getContainer().classList.add("zone-drawing");
    bar.hidden = false; btn.hidden = true;
    updateBar();
    const r = map.getContainer().getBoundingClientRect();   // en celular, volver al mapa si estaba más abajo
    if (r.top < -40 || r.bottom > innerHeight + 40) map.getContainer().scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function stopDraw() {
    Z.drawing = window.zoneDrawing = false;
    map.doubleClickZoom.enable();
    map.getContainer().classList.remove("zone-drawing");
    bar.hidden = true; btn.hidden = false;
  }
  function updateBar() {
    const n = Z.pts.length;
    $("zoneMsg").textContent = n === 0 ? "Toca el mapa para marcar la primera esquina de tu zona"
      : n < 3 ? `Llevas ${n} esquina${n > 1 ? "s" : ""}. Marca al menos 3`
      : `Llevas ${n} esquinas. Toca "Listo" o la primera esquina para cerrar`;
    $("zoneDone").disabled = n < 3;
    $("zoneUndo").disabled = n === 0;
  }
  function redraw() {
    if (Z.line) map.removeLayer(Z.line);
    Z.marks.forEach((m) => map.removeLayer(m));
    Z.line = L.polyline(Z.pts, { color: "#ffd84d", weight: 3, dashArray: "6 5", interactive: false }).addTo(map);
    Z.marks = Z.pts.map((p, i) => {
      const m = L.circleMarker(p, { radius: i === 0 ? 8 : 5, color: "#091C25", weight: 2, fillColor: "#ffd84d", fillOpacity: 1, bubblingMouseEvents: false }).addTo(map);
      if (i === 0) m.on("click", () => Z.pts.length >= 3 && finish());
      return m;
    });
    updateBar();
  }
  map.on("click", (e) => {
    if (!Z.drawing) return;
    Z.pts.push(e.latlng);
    redraw();
  });
  map.on("dblclick", () => { if (Z.drawing && Z.pts.length >= 3) finish(); });

  function finish() {
    if (Z.pts.length < 3) return;
    stopDraw();
    if (Z.line) map.removeLayer(Z.line);
    Z.marks.forEach((m) => map.removeLayer(m));
    Z.line = null; Z.marks = [];
    Z.poly = L.polygon(Z.pts, { color: "#ffd84d", weight: 3, fillColor: "#ffd84d", fillOpacity: 0.12, interactive: false }).addTo(map);
    analyze();
    if (window.matchMedia("(max-width: 900px)").matches) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- análisis ----------
  const km = (n) => (n < 0.1 ? n.toFixed(3) : n < 10 ? n.toFixed(2) : n.toFixed(1)).replace(".", ",") + " km²";
  const pc = (a, b) => (b ? Math.round((100 * a) / b) : 0) + " %";

  async function clsStats(d, idx) {
    const c = await loadPx(P(d.cls)), h = await loadHH(d);
    const n = [0, 0, 0, 0]; let valid = 0;
    for (const i of idx) {
      if (h.v[i] === 0) continue;
      valid++;
      const k = i * 4;
      if (c.d[k + 3] > 0) n[nearest(c.d[k], c.d[k + 1], c.d[k + 2], CLS_PAL)]++;
    }
    return { n, valid };
  }

  let busy = 0;
  async function analyze() {
    if (!Z.poly || !S) return;
    const my = ++busy;
    card.hidden = false;
    $("zoneOut").innerHTML = '<p class="hint">Calculando…</p>';
    const px = pxKm2();
    const h0 = await loadHH(S.dates[0]);
    const idx = maskFor(Z.pts, h0.w, h0.h);
    const total = polyKm2(Z.pts), inKm = idx.length * px;
    if (!idx.length) { $("zoneOut").innerHTML = '<p class="explain-warn">Tu zona queda fuera del recuadro que analiza NISAR (la línea punteada turquesa). Dibújala adentro.</p>'; return; }
    let html = `<div class="zone-area"><b>${km(inKm)}</b><span>tamaño de tu zona${total > inKm * 1.05 ? ` (de ${km(total)} dibujados; el resto queda fuera del recuadro estudiado)` : ""}</span></div>`;

    // 1) qué hay: MangroveNet + WorldCover
    if (MNET) {
      const [m, wc] = await Promise.all([loadPx(P("ref/mangrovenet.png")), loadPx(P("ref/worldcover_codes.png"))]);
      const pal = MNET.colors.map(hex), cnt = MNET.classes.map(() => 0);
      let wcMang = 0, both = 0, nm = 0;
      const mi = MNET.classes.indexOf("manglar");
      for (const i of idx) {
        const k = i * 4;
        const isWc = wc.d[k] === 95;
        if (isWc) wcMang++;
        if (m.d[k + 3] === 0) continue;
        nm++;
        const c = nearest(m.d[k], m.d[k + 1], m.d[k + 2], pal);
        cnt[c]++;
        if (c === mi && isWc) both++;
      }
      const order = cnt.map((v, i) => i).filter((i) => cnt[i] > 0).sort((a, b) => cnt[b] - cnt[a]);
      const bar = order.map((i) => `<i style="width:${(100 * cnt[i]) / Math.max(1, nm)}%;background:${MNET.colors[i]}" title="${MNET.classes[i]}"></i>`).join("");
      const rows = order.map((i) => `<li><span style="color:${MNET.colors[i]}">■</span> ${MNET.classes[i]} <b>${km(cnt[i] * px)}</b> <small>${pc(cnt[i], nm)}</small></li>`).join("");
      const mg = cnt[mi] * px, wcKm = wcMang * px;
      const agree = cnt[mi] + wcMang - both ? Math.round((100 * both) / (cnt[mi] + wcMang - both)) : null;
      const test = MNET.role === "prueba" || MNET.role === "validación";
      html += `<h4>Qué hay adentro <small>(según la IA MangroveNet, solo con radar)</small></h4>
        <div class="zone-bar">${bar}</div><ul class="zone-list">${rows}</ul>
        <p class="zone-mang">` + (mg < 0.01 && wcKm < 0.01 ? "🌿 No hay manglar en tu zona: la IA y el mapa de la ESA están de acuerdo."
          : `🌿 <b>Manglar: ${km(mg)}</b>. El mapa de la ESA (WorldCover 2021) dice ${km(wcKm)}.` + (agree !== null ? ` Coinciden en el ${agree} % de ese manglar.` : "")) + `</p>` +
        `<p class="hint">${test ? `Esta IA nunca vio este lugar al aprender; aquí acertó el manglar ${Math.round(100 * MNET.metrics_vs_worldcover.per_class.manglar.f1)} % de las veces.`
          : "Esta IA aprendió con este mismo lugar, así que aquí el resultado es más optimista que en un sitio nuevo."} En zonas muy pequeñas (menos de 0,1 km²) puede fallar más.</p>`;
    }

    // 2) el radar en la fecha (o par de fechas) que está mirando
    const pair = state.mode === "compare" || state.mode === "change";
    const A = pair ? S.dates[state.a] : S.dates[state.idx], B = pair ? S.dates[state.b] : null;
    const sa = await clsStats(A, idx), sb = B ? await clsStats(B, idx) : null;
    if (my !== busy) return;
    const covA = sa.valid / idx.length, covB = sb ? sb.valid / idx.length : 1;
    const water = (s) => s.n[0] * px, flood = (s) => s.n[1] * px, sea = (s) => s.n[3] * px, flo = (s) => s.n[2] * px;
    if (!B) {
      html += `<h4>Lo que vio el radar el ${fmtDate(A.date)} <small>(${seasonOf(A.date).toLowerCase()})</small></h4><ul class="zone-list">
        <li><span style="color:#1e88e5">■</span> ${SITE.lake ? "Agua del embalse" : "Agua del estero"} <b>${km(water(sa))}</b></li>
        <li><span style="color:#d81bc4">■</span> Manglar o plantas con agua debajo <b>${km(flood(sa))}</b></li>` +
        (sa.n[2] ? `<li><span style="color:#3cdc5a">■</span> Plantas flotando (posible lirio) <b>${km(flo(sa))}</b></li>` : "") +
        (sa.n[3] ? `<li><span style="color:#14325a">■</span> Mar <b>${km(sea(sa))}</b></li>` : "") + `</ul>
        <p class="hint">Para ver cómo cambió tu zona, ve a <b>Antes / después</b> o <b>Cambios</b>; este cuadro se actualiza solo.</p>`;
    } else {
      const [ha, hb] = await Promise.all([loadHH(A), loadHH(B)]);
      const thr = +$("thr").value;
      let down = 0, up = 0, vv = 0;
      for (const i of idx) {
        const a = toDb(ha.v[i]), b = toDb(hb.v[i]);
        if (a === null || b === null) continue;
        vv++;
        if (b - a <= -thr) down++; else if (b - a >= thr) up++;
      }
      if (my !== busy) return;
      const dW = water(sb) - water(sa), dF = flood(sb) - flood(sa);
      const arrow = (v) => (Math.abs(v) < 0.005 ? "igual" : v > 0 ? "↑ " + km(v) : "↓ " + km(-v));
      html += `<h4>Cómo cambió entre ${fmtDate(A.date)} y ${fmtDate(B.date)}</h4>
        <table class="zone-cmp"><tr><th></th><th>${fmtDate(A.date)}</th><th>${fmtDate(B.date)}</th><th>cambio</th></tr>
        <tr><td>💧 Agua</td><td>${km(water(sa))}</td><td>${km(water(sb))}</td><td>${arrow(dW)}</td></tr>
        <tr><td>🌿 Manglar con agua debajo</td><td>${km(flood(sa))}</td><td>${km(flood(sb))}</td><td>${arrow(dF)}</td></tr></table>
        <p>El brillo del radar <b style="color:#5aa2ff">bajó</b> en ${km(down * px)} y <b style="color:#ff9a2e">subió</b> en ${km(up * px)} (${pc(down + up, vv)} de tu zona, umbral ${thr} dB).</p>
        <p class="hint">Bajar suele ser más agua o suelo pelado (cosecha, corte); subir, más plantas o manglar inundado. ${seasonOf(A.date) !== seasonOf(B.date) ? "Ojo: comparas época seca con época de lluvias, así que parte del cambio es solo la temporada." : ""}</p>`;
    }
    if (covA < 0.9 || covB < 0.9) html += `<p class="explain-warn">⚠ El radar no cubrió toda tu zona ese día (${Math.round(100 * Math.min(covA, covB))} %). Los números de agua y cambio cuentan solo la parte que sí se escaneó.</p>`;
    $("zoneOut").innerHTML = html;
  }

  btn.onclick = startDraw;
  $("zoneCancel").onclick = () => { stopDraw(); clearDrawing(); };
  $("zoneUndo").onclick = () => { Z.pts.pop(); redraw(); };
  $("zoneDone").onclick = finish;
  $("zoneRedo").onclick = startDraw;
  $("zoneClear").onclick = () => { clearDrawing(); card.hidden = true; };
  // se vuelve a calcular cuando cambian la fecha, el modo o el umbral
  let t = null;
  window.onZoneRender = () => { if (Z.poly) { clearTimeout(t); t = setTimeout(analyze, 150); } };
  $("thr").addEventListener("input", window.onZoneRender);
})();
