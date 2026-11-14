// Portada, recorrido guiado, modo sencillo/experto, semáforo, línea de estaciones y animaciones.
// Usa las variables globales de app.js (S, SITE, state, map, ML, SWOT, ECO, REF, VAL, RAINJ, render, setMode...).
(function () {
  const params = new URLSearchParams(location.search);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const day = 864e5;
  const dt = (s) => new Date((s.length > 10 ? s : s + "T12:00:00")).getTime();
  const shortDate = (s) => new Date(dt(s)).toLocaleDateString("es-SV", { day: "numeric", month: "long" });

  // ---------- modo experto ----------
  const sw = $("expertSw");
  const setExpert = (on) => { document.body.classList.toggle("expert", on); sw.checked = on; store.set("expert", on ? "1" : "0"); };
  setExpert(store.get("expert") === "1");
  sw.onchange = () => setExpert(sw.checked);

  // ---------- números que cuentan solos ----------
  function countUp(el, ms = 900) {
    const txt = el.textContent;
    const m = txt.match(/^([^\d\-]*)(-?\d+(?:[.,]\d+)?)(.*)$/s);
    if (!m || el.dataset.counted) return;
    el.dataset.counted = "1";
    const [, pre, num, post] = m;
    const dec = (num.split(/[.,]/)[1] || "").length;
    const end = parseFloat(num.replace(",", "."));
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + (end * e).toFixed(dec) + post;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = txt; }, ms + 150); // respaldo: si la pestaña está en segundo plano, rAF se pausa
  }
  const countAll = (root) => root.querySelectorAll(".kpi b, .hstat b").forEach((b) => countUp(b));

  // ---------- tarjetas que entran al hacer scroll ----------
  function reveal() {
    const cards = document.querySelectorAll(".panel .card");
    const narrow = matchMedia("(max-width:860px)").matches;
    const io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); countAll(e.target); io.unobserve(e.target); }
    }), { root: narrow ? null : document.querySelector(".panel"), threshold: 0.12 });
    cards.forEach((c, i) => { c.classList.add("reveal"); c.style.transitionDelay = Math.min(i, 4) * 60 + "ms"; io.observe(c); });
  }

  // ---------- cifras de cada sitio ----------
  function siteFacts() {
    const f = {};
    const lv = (SWOT?.observations || []).filter((o) => o.quality <= 1);
    if (lv.length) {
      const hi = lv.reduce((a, b) => (b.wse_m > a.wse_m ? b : a)), lo = lv.reduce((a, b) => (b.wse_m < a.wse_m ? b : a));
      f.level = { drop: hi.wse_m - lo.wse_m, hi, lo };
    }
    const mlD = (ML?.dates || []).filter((m) => m.lake_covered_pct >= 90);
    const mon = (m) => new Date(dt(m.date)).getMonth() + 1;
    const dry = mlD.filter((m) => [11, 12, 1, 2, 3, 4].includes(mon(m))), wet = mlD.filter((m) => [6, 7, 8, 9].includes(mon(m)));
    const avg = (a) => a.reduce((s, m) => s + m.ml_veg_km2, 0) / a.length;
    if (dry.length && wet.length) f.plants = { dry: avg(dry), wet: avg(wet), ratio: avg(wet) / avg(dry) };
    if (VAL?.dates?.length) f.valid = VAL.dates.reduce((s, d) => s + (d.agua_mapa_detectada_pct || 0), 0) / VAL.dates.length;
    f.mangrove = REF?.worldcover?.areas_km2?.Manglar;
    const mk = typeof MANG !== "undefined" && MANG ? Object.keys(MANG).find((k) => k.toLowerCase().includes(SITE.id === "jiquilisco" ? "jiquilisco" : "barra")) : null;
    if (mk) { f.loss = MANG[mk].loss_pct; f.hvRise = MANG[mk].hv_range_db; }
    return f;
  }

  // ---------- portada ----------
  const hero = $("hero");
  function heroStats() {
    const f = siteFacts();
    const rain = CLOUDS?.seasons?.lluvias;
    if (SITE.lake) {
      // un solo problema, dicho en simple
      document.querySelector(".hero h1").textContent = "El lirio crece cuando más llueve… justo cuando las nubes no dejan verlo.";
      document.querySelector(".hero .lead").innerHTML =
        `En la época de lluvias, ${rain ? `<b>casi la mitad (${rain.covered_pct} %)</b>` : "muchas"} de las fotos satelitales del embalse Cerrón Grande salen tapadas por nubes` +
        (rain ? `, con rachas de hasta <b>${rain.longest_gap_days} días</b> sin una sola foto despejada` : "") + ". " +
        `El nuevo radar <b>NISAR</b> (NASA e ISRO) ve a través de las nubes. Lo juntamos con inteligencia artificial para <b>vigilar el lirio acuático y avisar</b> a quienes viven del embalse.`;
    }
    const st = SITE.lake
      ? [[rain ? rain.covered_pct + " %" : "—", "de las fotos de época de lluvias salen con el embalse tapado por nubes (en verano: " + (CLOUDS?.seasons?.seca?.covered_pct ?? "—") + " %)"],
         [rain ? rain.longest_gap_days + " días" : "—", "seguidos sin una foto despejada en lluvias. El radar pasa igual, llueva o no"],
         [f.plants ? "×" + f.plants.ratio.toFixed(1) : "—", "más lirio en lluvias que en verano (radar + inteligencia artificial)"]]
      : SITE.id === "jiquilisco"
      ? [[f.mangrove ? f.mangrove.toFixed(0) + " km²" : "—", "de manglar: el más grande de El Salvador (mapa ESA)"],
         [f.loss != null ? f.loss.toFixed(2) + " %" : "—", "del manglar perdió señal en el año: está estable"],
         [String(S.dates.length), "pasadas del radar en un año, con nubes o sin ellas"]]
      : [[f.valid ? f.valid.toFixed(0) + " %" : "—", "del agua del estero que marca el mapa oficial la detecta NISAR"],
         [f.mangrove ? f.mangrove.toFixed(0) + " km²" : "—", "de manglar protegido en la zona (Ramsar)"],
         [String(S.dates.length), "pasadas del radar en un año, con nubes o sin ellas"]];
    $("heroStats").innerHTML = st.map(([v, l]) => `<div class="hstat"><b>${v}</b><span>${l}</span></div>`).join("");
    document.querySelectorAll(".site-card").forEach((c) => c.classList.toggle("current", c.dataset.site === SITE.id));
    countAll($("heroStats"));
  }
  const closeHero = () => { hero.classList.add("out"); setTimeout(() => { hero.hidden = true; hero.classList.remove("out"); map.invalidateSize(); }, 450); };
  $("heroSkip").onclick = closeHero;
  $("heroTour").onclick = () => { closeHero(); setTimeout(startTour, 350); };
  document.querySelectorAll(".site-card").forEach((c) => (c.onclick = () => {
    if (c.dataset.site === SITE.id) { closeHero(); setTimeout(startTour, 350); }
    else location.search = "?site=" + c.dataset.site + "&tour=1";
  }));

  // ---------- recorrido guiado ----------
  const idxOf = (date) => {
    let best = 0;
    S.dates.forEach((d, i) => { if (Math.abs(dt(d.date) - dt(date)) < Math.abs(dt(S.dates[best].date) - dt(date))) best = i; });
    return best;
  };
  const setLayer = (l) => { if ($("layerMlBtn").hidden && l === "ml") l = "rgb"; state.layer = l; document.querySelectorAll("#layerSeg button").forEach((b) => b.classList.toggle("on", b.dataset.layer === l)); };
  const setRef = (r) => { state.ref = r; document.querySelectorAll("#truthSeg button").forEach((b) => b.classList.toggle("on", b.dataset.ref === r)); };
  const fitAll = () => map.flyToBounds(bounds, { padding: [10, 10], duration: 1.4 });
  function focusCard(id) {
    const el = $(id);
    if (!el || el.hidden) return;
    el.classList.add("in");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
  }
  function go({ mode = "single", layer = "rgb", date, ref, fly, card }) {
    stopPlay();
    setLayer(layer);
    if (ref) setRef(ref);
    if (date) state.idx = idxOf(date);
    setMode(mode);
    if (fly) map.flyTo(fly[0], fly[1], { duration: 1.6 }); else fitAll();
    const narrow = matchMedia("(max-width:860px)").matches;
    if (card) setTimeout(() => focusCard(card), 500);
    else if (narrow) document.querySelector(".mapwrap").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function steps() {
    const f = siteFacts();
    if (SITE.lake) {
      const lvTxt = f.level
        ? `El satélite SWOT midió la altura del agua: <b>${f.level.hi.wse_m.toFixed(1)} m</b> el ${shortDate(f.level.hi.date)} y <b>${f.level.lo.wse_m.toFixed(1)} m</b> el ${shortDate(f.level.lo.date)}. Son <b>${f.level.drop.toFixed(0)} metros</b> de diferencia.`
        : "El satélite SWOT mide la altura del agua del embalse.";
      return [
        { t: "Este es el embalse Cerrón Grande", x: "Es el lago artificial más grande de El Salvador: guarda agua del río Lempa, genera electricidad y da de comer a muchas familias pescadoras. Así lo ve el radar NISAR: <b>lo oscuro es agua</b>, lo verde es vegetación.", go: { date: "2026-01-18" } },
        { t: "Ese día llovía", x: (CLOUDS?.wow ? `El <b>${shortDate(CLOUDS.wow.photo_date)}</b> la foto normal salió con el <b>${CLOUDS.wow.cloud_pct} %</b> del embalse tapado por nubes. ` : "En época de lluvias las fotos salen tapadas por nubes. ") + "NISAR manda su propia señal de microondas y ve <b>de día, de noche y con nubes</b>. Arrastra la barra blanca: a la izquierda el radar con el lirio en amarillo, a la derecha la foto nublada.", go: CLOUDS?.wow ? { mode: "truth", ref: "cloud", layer: "ml", date: CLOUDS.wow.nisar_date, card: "wowCard" } : { mode: "truth", ref: "s2", date: "2026-07-05" } },
        { t: `El embalse respira: baja ${f.level ? f.level.drop.toFixed(0) : "varios"} metros`, x: lvTxt + " En la época seca llueve poco y la represa usa el agua para generar electricidad; con las lluvias se vuelve a llenar.", go: { date: "2026-07-17", card: "lakeCard" } },
        { t: "Aparecen plantas sobre el agua", x: `En <b style="color:#ffd600">amarillo</b> está lo que la inteligencia artificial detecta como plantas flotantes (posible lirio acuático).` + (f.plants ? ` En lluvias cubren unos <b>${f.plants.wet.toFixed(0)} km²</b>, contra ${f.plants.dry.toFixed(0)} km² en verano.` : "") + " Se juntan donde entra el río Lempa, que trae nutrientes.", go: { layer: "ml", date: "2026-09-15", fly: [[14.07, -89.13], 12] } },
        { t: "Una alerta por zonas", x: "El embalse se divide en 4 zonas. Para cada pasada del radar se calcula cuánto lirio hay en cada una, si <b>subió o bajó</b>, y se arma un <b>mensaje corto listo para compartir</b> con pescadores, cooperativas o la alcaldía.", go: { layer: "ml", date: "2026-09-15", card: "alertCard" } },
        { t: "La computadora aprendió de las fotos", x: "Usamos las fotos de días despejados para enseñarle al radar cómo se ven las plantas. Probado en fechas que <b>nunca vio</b>, gana a la regla anterior en <b>7 de 7</b> casos" + (ML ? `, y cuando la foto y el radar están a 4 días o menos acierta con <b>${(ML.close_f1 ?? 0.68).toFixed(2)}</b> de 1` : "") + ".", go: { layer: "ml", date: "2026-08-10", card: "mlCard" } },
        { t: "¿Naturaleza o ser humano?", x: "<b>Natural:</b> la lluvia llena el embalse y el calor ayuda a crecer a las plantas. <b>Humano:</b> la represa decide cuánta agua se suelta, y las aguas negras y fertilizantes que bajan por los ríos alimentan el lirio. El satélite muestra el patrón; las causas hay que confirmarlas en el campo.", go: { date: "2026-09-03", card: "semaCard" } },
        { t: "Y funciona en otros lugares", x: "Con el mismo método revisamos el manglar de <b>Barra de Santiago</b>: coincidió en un ~90 % con el mapa oficial de la ESA. Se puede llevar a cualquier humedal del mundo.", go: {}, next: { label: "Ver Barra de Santiago →", site: "barra" } },
      ];
    }
    if (SITE.id === "jiquilisco") return [
      { t: "Bahía de Jiquilisco: el manglar más grande", x: `Una bahía de Usulután con <b>${f.mangrove ? f.mangrove.toFixed(0) : "~177"} km²</b> de manglar (siete veces Barra de Santiago). Lo oscuro es agua de la bahía; lo verde, el manglar. NISAR cubre unas tres cuartas partes del recuadro.`, go: { date: "2026-01-18" } },
      { t: "¿Dónde está el manglar?", x: "El mapa oficial de la ESA marca el manglar en verde menta. Arrastra la barra blanca para comparar con lo que ve el radar.", go: { mode: "truth", ref: "wc", date: "2026-01-18" } },
      { t: "En lluvias el manglar 'brilla' más", x: `La señal HV del manglar sube unos <b>${f.hvRise ? f.hvRise.toFixed(1) : "4"} dB</b> de verano a lluvias, igual que en Barra de Santiago. Son hojas y suelo mojados: un ritmo <b>natural</b>, no un cambio del bosque.`, go: { date: "2026-09-27", card: "mangCard" } },
      { t: "Sin pérdida de manglar este año", x: `Solo el <b>${f.loss != null ? f.loss.toFixed(2) : "0.02"} %</b> del manglar perdió señal de forma persistente: está estable. Es la línea base para detectar talas o camaroneras nuevas en los próximos años.`, go: { mode: "change", card: "mangCard" } },
      { t: "Mira el embalse", x: "Donde sí hay cambios grandes es en el embalse Cerrón Grande: el nivel baja metros y aparecen plantas flotantes.", go: {}, next: { label: "Ver Cerrón Grande →", site: "cerron" } },
    ];
    return [
      { t: "Barra de Santiago: manglar y estero", x: "Un humedal Ramsar en Ahuachapán, junto al mar. El canal oscuro es el <b>estero</b>; lo verde es el <b>manglar</b>; los cuadritos de arriba son <b>cultivos de caña</b>.", go: { date: "2025-12-25" } },
      { t: "¿El radar dice la verdad?", x: `Comparamos NISAR con el mapa oficial de cobertura de la ESA. NISAR encontró el <b>${f.valid ? f.valid.toFixed(0) : "~90"} %</b> del agua del estero que marca el mapa, en época seca y en lluvias.`, go: { mode: "truth", ref: "wc", date: "2026-01-18", card: "valCard" } },
      { t: "El manglar se moja en lluvias", x: "En <b style='color:#e05ad0'>rosado</b>, manglar con agua debajo: la señal rebota en el agua y en los troncos (doble rebote). En la época lluviosa esa área crece.", go: { layer: "cls", date: "2026-09-03", fly: [[13.705, -90.02], 13] } },
      { t: "Un manglar estable", x: "En un año la señal del manglar casi no cambió: es una <b>buena noticia</b>. Las amenazas reales (tala, camaroneras, caña) son lentas y se verán con varios años de NISAR.", go: { date: "2026-10-21", card: "mangCard" } },
      { t: "Comparado con Jiquilisco", x: "La Bahía de Jiquilisco, el manglar más grande del país, se comporta igual: misma subida natural en lluvias y pérdida casi cero. Dos manglares sanos este año.", go: { card: "mangCard" }, next: { label: "Ver Jiquilisco →", site: "jiquilisco" } },
    ];
  }

  let tour = null;
  function show(i) {
    const st = tour[i];
    tour.i = i;
    $("storyStep").textContent = `Paso ${i + 1} de ${tour.length}`;
    $("storyTitle").innerHTML = st.t;
    $("storyText").innerHTML = st.x;
    $("storyDots").innerHTML = tour.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    $("storyPrev").disabled = i === 0;
    $("storyNext").textContent = st.next ? st.next.label : i === tour.length - 1 ? "Terminar ✓" : "Siguiente →";
    const box = $("story");
    box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
    go(st.go || {});
  }
  function startTour() {
    tour = steps();
    $("story").hidden = false;
    show(0);
  }
  const endTour = () => { $("story").hidden = true; tour = null; };
  $("tourBtn").onclick = () => (tour ? endTour() : startTour());
  $("storyClose").onclick = endTour;
  $("storyPrev").onclick = () => tour && tour.i > 0 && show(tour.i - 1);
  $("storyNext").onclick = () => {
    if (!tour) return;
    const st = tour[tour.i];
    if (st.next) return (location.search = "?site=" + st.next.site + "&tour=1");
    if (tour.i < tour.length - 1) show(tour.i + 1); else endTour();
  };
  document.addEventListener("keydown", (e) => {
    if (!tour || $("story").hidden) return;
    if (e.key === "ArrowRight") $("storyNext").click();
    if (e.key === "ArrowLeft") $("storyPrev").click();
    if (e.key === "Escape") endTour();
  });

  // ---------- semáforo ----------
  const rank = (v, arr) => arr.filter((x) => x <= v).length / arr.length;
  const near = (list, date, maxDays, key = "date") => {
    let best = null;
    list.forEach((o) => { const g = Math.abs(dt(o[key]) - dt(date)) / day; if (g <= maxDays && (!best || g < best.g)) best = { o, g }; });
    return best && best.o;
  };
  function light(name, val, unit, arr, bad, msgs) {
    if (val == null || !arr.length) return `<div class="light"><span class="bulb n"></span><div><b>${name}</b><span>sin dato cercano a esta fecha</span></div></div>`;
    const r = rank(val, arr), tier = r < 0.34 ? 0 : r > 0.66 ? 2 : 1;
    const color = bad === "high" ? ["g", "y", "r"][tier] : bad === "low" ? ["r", "y", "g"][tier] : ["n", "g", "n"][tier];
    return `<div class="light"><span class="bulb ${color}"></span><div><b>${name} · <span class="val">${val}${unit}</span></b><span>${msgs[tier]}</span></div></div>`;
  }
  function updateSema() {
    if (!S) return;
    const d = S.dates[state.mode === "single" || state.mode === "truth" ? state.idx : state.b];
    if (!d) return;
    let html = "";
    if (SITE.lake) {
      const mlD = (ML?.dates || []).filter((m) => m.lake_covered_pct >= 90);
      const m = mlD.find((x) => x.id === d.id);
      html += light("Plantas sobre el agua", m ? m.ml_veg_km2.toFixed(1) : null, " km²", mlD.map((x) => x.ml_veg_km2), "high",
        ["pocas, como en verano", "en un nivel medio del año", "muchas: de lo más alto del año"]);
      html += light("Agua abierta", d.water_km2.toFixed(0), " km²", S.dates.map((x) => x.water_km2), "low",
        ["poca: más superficie tapada o más baja", "normal para el año", "mucha agua libre"]);
      const lv = (SWOT?.observations || []).filter((o) => o.quality <= 1);
      const l = near(lv, d.date, 25);
      html += light("Nivel del agua", l ? l.wse_m.toFixed(1) : null, " m", lv.map((o) => o.wse_m), "low",
        ["bajo: época seca o descarga de la represa", "nivel medio", "alto: embalse lleno"]);
      const eco = (ECO?.observations || []).filter((o) => o.day && o.water_c != null && o.water_px > 0.3 * o.water_total_px);
      const e = near(eco, d.date, 15, "local_time");
      html += light("Temperatura del agua", e ? e.water_c.toFixed(0) : null, " °C", eco.map((o) => o.water_c), "high",
        ["fresca para el año", "normal", "caliente: favorece a las plantas"]);
    } else {
      html += light(SITE.id === "jiquilisco" ? "Agua de la bahía" : "Agua del estero", d.water_km2.toFixed(1), " km²", S.dates.map((x) => x.water_km2), "low",
        ["menos agua libre que de costumbre", "normal para el año", "más agua libre"]);
      html += light("Manglar con agua debajo", d.floodveg_km2.toFixed(1), " km²", S.dates.map((x) => x.floodveg_km2), "none",
        ["poco: típico de la época seca", "intermedio", "mucho: típico de lluvias"]);
      const r12 = typeof rain12 === "function" ? rain12(d.date) : null;
      html += light("Lluvia (12 días antes)", r12 != null ? r12.toFixed(0) : null, " mm", S.dates.map((x) => rain12(x.date)).filter((x) => x != null), "none",
        ["poca lluvia", "lluvia moderada", "mucha lluvia"]);
    }
    $("sema").innerHTML = html;
    $("semaCard").hidden = false;
  }

  // ---------- línea de estaciones ----------
  function seasons() {
    const t0 = dt(S.dates[0].date), t1 = dt(S.dates[S.dates.length - 1].date), span = Math.max(1, t1 - t0);
    const pos = (t) => (100 * (t - t0)) / span;
    let html = "";
    const start = new Date(t0); start.setDate(1);
    for (let m = new Date(start); m.getTime() < t1; m.setMonth(m.getMonth() + 1)) {
      const a = Math.max(t0, m.getTime()), nx = new Date(m); nx.setMonth(nx.getMonth() + 1);
      const b = Math.min(t1, nx.getTime());
      const wet = m.getMonth() >= 4 && m.getMonth() <= 9;
      html += `<span class="band ${wet ? "wet" : "dry"}" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%"></span>`;
    }
    const rows = [["#ffffff", S.dates.map((d) => d.date)],
                  ["#ff8fab", (REF?.sentinel2 || []).map((s) => s.date)],
                  ["#4fc3f7", (SWOT?.observations || []).filter((o) => o.quality <= 1).map((o) => o.date)],
                  ["#ff7043", (ECO?.observations || []).filter((o) => o.day && o.water_c != null).map((o) => o.date)]];
    rows.forEach(([c, ds], k) => ds.forEach((s) => {
      const t = dt(s); if (t < t0 || t > t1) return;
      html += `<span class="mk" style="left:${pos(t)}%;top:${10 + k * 0}px;background:${c};opacity:.85"></span>`;
    }));
    html += `<span class="now" id="seasonNow"></span>`;
    html += `<div class="lg"><span><i style="background:rgba(201,150,90,.8)"></i>seca</span><span><i style="background:rgba(79,160,255,.8)"></i>lluviosa</span>` +
      `<span><i style="background:#fff"></i>NISAR</span><span><i style="background:#ff8fab"></i>foto</span>` +
      (SITE.lake ? `<span><i style="background:#4fc3f7"></i>SWOT</span><span><i style="background:#ff7043"></i>ECOSTRESS</span>` : "") + `</div>`;
    $("seasons").innerHTML = html;
    seasons.pos = pos;
  }
  function moveNow() {
    const el = $("seasonNow");
    if (!el || !seasons.pos) return;
    const d = S.dates[state.mode === "single" || state.mode === "truth" ? state.idx : state.b];
    if (d) el.style.left = seasons.pos(dt(d.date)) + "%";
  }

  // ---------- momento wow: foto nublada vs radar el mismo día ----------
  function buildWow() {
    const w = CLOUDS?.wow, rain = CLOUDS?.seasons?.lluvias;
    if (!w) return;
    $("wowTitle").textContent = `El ${shortDate(w.photo_date)} la foto no vio nada. El radar vio ${w.ml_km2.toFixed(0)} km² de lirio.`;
    $("wowLead").innerHTML = `Arrastra sobre la imagen: a la izquierda la <b>foto normal</b> de ese día (${w.cloud_pct} % del embalse tapado por nubes); a la derecha el <b>radar NISAR</b>, con las plantas que encontró la inteligencia artificial en amarillo.`;
    $("wowPhoto").src = P(w.photo);
    $("wowRadar").src = P(w.radar);
    const cmp = $("wowCmp"), rng = $("wowRange");
    const upd = () => { const v = +rng.value; $("wowPhoto").style.clipPath = `inset(0 ${100 - v}% 0 0)`; cmp.style.setProperty("--x", v + "%"); };
    rng.oninput = upd; upd();
    if (rain) $("wowKpis").innerHTML =
      kpi(rain.covered_pct + " %", "de las fotos de lluvias salen con el embalse tapado (en verano: " + (CLOUDS.seasons.seca?.covered_pct ?? "—") + " %)") +
      kpi(rain.longest_gap_days + " días", `seguidos sin una foto despejada (${shortDate(rain.longest_gap[0])} – ${shortDate(rain.longest_gap[1])}). El radar no se detiene`);
    $("wowMap").onclick = () => go({ mode: "truth", ref: "cloud", layer: "ml", date: w.nisar_date });
    $("wowCard").hidden = false;
  }

  // ---------- alerta de lirio por zonas ----------
  let zoneLayers = {};
  const levelColor = { alto: "#ff6b5b", medio: "#ffc542", bajo: "#2fd6a3" };
  function drawZones() {
    if (!ALERTS) return;
    ALERTS.zones.forEach((z) => {
      const [w, s, e, n] = z.box;
      const rect = L.rectangle([[s, w], [n, e]], { color: "#ffffff", weight: 1, dashArray: "3 5", fill: false, interactive: false }).addTo(map);
      const lab = L.marker(z.label, { interactive: false, icon: L.divIcon({ className: "", html: `<span class="zone-label">${z.short}</span>`, iconSize: null }) }).addTo(map);
      zoneLayers[z.id] = { rect, lab };
    });
  }
  function updateAlert() {
    if (!ALERTS || !S) return;
    const d = S.dates[state.mode === "single" || state.mode === "truth" ? state.idx : state.b];
    const r = d && ALERTS.dates.find((x) => x.id === d.id);
    const card = $("alertCard");
    card.hidden = false;
    if (!r) { $("alertZones").innerHTML = `<p class="hint">Sin alerta para ${d ? shortDate(d.date) : "esta fecha"}: el radar no cubrió todo el embalse.</p>`; $("alertMsg").textContent = ""; return; }
    $("alertZones").innerHTML = ALERTS.zones.map((z) => {
      const v = r.zones[z.id];
      const tr = v.delta_km2 == null ? `<span class="eq">—</span>` : v.delta_km2 > 0.3 ? `<span class="up">▲ +${v.delta_km2.toFixed(1)}</span>` : v.delta_km2 < -0.3 ? `<span class="down">▼ ${v.delta_km2.toFixed(1)}</span>` : `<span class="eq">= igual</span>`;
      return `<div class="az"><span class="bulb" style="color:${levelColor[v.level]};background:${levelColor[v.level]}"></span>` +
        `<div><b>${z.name}</b><small>${v.km2.toFixed(1)} km² con lirio · ${v.pct.toFixed(0)} % del agua · nivel ${v.level}</small></div><div class="tr">${tr}</div></div>`;
    }).join("");
    $("alertMsg").textContent = r.message;
    Object.entries(zoneLayers).forEach(([id, l]) => l.rect.setStyle({ color: levelColor[r.zones[id].level], weight: r.zones[id].level === "alto" ? 2.5 : 1 }));
  }
  $("alertCopy").onclick = async () => {
    const t = $("alertMsg").textContent;
    try { await navigator.clipboard.writeText(t); $("alertCopied").textContent = "¡Copiado!"; }
    catch { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($("alertMsg")); s.removeAllRanges(); s.addRange(rg); $("alertCopied").textContent = "Selecciona y copia (Ctrl+C)"; }
    setTimeout(() => ($("alertCopied").textContent = ""), 2500);
  };

  // ---------- ganchos de app.js ----------
  window.onRender = () => { updateSema(); moveNow(); updateAlert(); };
  window.onDataReady = () => {
    if (SITE.lake) { buildWow(); drawZones(); updateAlert(); }
    heroStats();
    seasons();
    updateSema();
    moveNow();
    reveal();
    if (!params.has("site") || params.get("intro") === "1") hero.hidden = false;
    else if (params.get("tour") === "1") setTimeout(startTour, 600);
  };
})();
