// MANGLO · ¿Dónde está NISAR? Globo con la órbita real del satélite (TLE público + SGP4 vía satellite.js).
(async () => {
  const $ = (id) => document.getElementById(id);
  // idioma: el mismo que se eligió en la app (botones Español / English, guardado como "manglo-language")
  const EN = (() => { try { return localStorage.getItem("manglo-language") === "en"; } catch { return false; } })();
  const tr = (es, en) => (EN ? en : es);
  const R = 6371;                                   // km
  const SWATH = [430, 680];                         // km a la IZQUIERDA de la vertical (incidencia ~33°–47°, aprox.)
  const SITES = [
    { id: "barra", name: "Barra de Santiago", short: "Barra de Santiago", lat: 13.715, lon: -90.04 },
    { id: "jiquilisco", name: tr("Bahía de Jiquilisco", "Jiquilisco Bay"), short: "Jiquilisco", lat: 13.25, lon: -88.50 },
    { id: "cerron", name: tr("Embalse Cerrón Grande", "Cerrón Grande Reservoir"), short: "Cerrón Grande", lat: 14.03, lon: -89.08 },
  ];
  const TZ = -6;                                    // El Salvador, sin horario de verano
  const MESES = EN ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DIAS = EN ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const pad = (n) => String(n).padStart(2, "0");
  const localParts = (d) => { const t = new Date(d.getTime() + TZ * 3600e3); return { dia: DIAS[t.getUTCDay()], d: t.getUTCDate(), m: MESES[t.getUTCMonth()], hh: t.getUTCHours(), mm: t.getUTCMinutes() }; };
  const fmtLocal = (d) => { const p = localParts(d); const h12 = ((p.hh + 11) % 12) + 1; return EN ? `${p.dia} ${p.m} ${p.d}, ${h12}:${pad(p.mm)} ${p.hh < 12 ? "a.m." : "p.m."}` : `${p.dia} ${p.d} ${p.m}, ${h12}:${pad(p.mm)} ${p.hh < 12 ? "a.m." : "p.m."}`; };
  // escribir en la página solo si el texto cambió: así el traductor del navegador (Chrome "Traducir") no se
  // deshace cada medio segundo y la página queda traducida
  const setText = (id, t) => { const e = $(id); if (e && e.dataset.v !== t) { e.dataset.v = t; e.textContent = t; } };
  const setHTML = (id, h) => { const e = $(id); if (e && e.dataset.v !== h) { e.dataset.v = h; e.innerHTML = h; } };
  const fmtLocalS = (d) => { const p = localParts(d), s = new Date(d.getTime() + TZ * 3600e3).getUTCSeconds(); const h12 = ((p.hh + 11) % 12) + 1; return `${h12}:${pad(p.mm)}:${pad(s)} ${p.hh < 12 ? "a.m." : "p.m."}`; };
  const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min ${s % 60} s`; };

  // ---------- TLE: CelesTrak en vivo, si no la copia local ----------
  let tle = null, live = false;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const r = await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=65053&FORMAT=TLE", { signal: ctl.signal });
    const t = (await r.text()).trim().split("\n").map((x) => x.trim());
    if (t.length >= 3 && t[1].startsWith("1 ")) { tle = { name: t[0], line1: t[1], line2: t[2] }; live = true; }
  } catch (e) { /* sin internet: copia local */ }
  if (!tle) tle = await fetch("data/nisar_tle.json").then((r) => r.json());
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  const ep = tle.line1.slice(18, 32); const epY = 2000 + +ep.slice(0, 2), epD = +ep.slice(2);
  const epoch = new Date(Date.UTC(epY, 0, 1) + (epD - 1) * 86400e3);
  // error típico: ~0.016 s × (días desde la órbita)², medido contra las imágenes reales; nunca menos de 3 s
  const errS = (t) => Math.max(3, Math.round(0.016 * ((t - epoch) / 86400e3) ** 2));
  $("tleNote").textContent = tr(`Órbita: elementos ${live ? "en vivo" : "guardados"} del ${fmtLocal(epoch)} (CelesTrak, NORAD 65053).`, `Orbit: ${live ? "live" : "saved"} elements from ${fmtLocal(epoch)} (CelesTrak, NORAD 65053).`);

  // ---------- propagación ----------
  function ecf(date) {
    const pv = satellite.propagate(satrec, date);
    if (!pv.position) return null;
    const gmst = satellite.gstime(date);
    const p = satellite.eciToEcf(pv.position, gmst);
    const g = satellite.eciToGeodetic(pv.position, gmst);
    return { p, lat: satellite.degreesLat(g.latitude), lon: satellite.degreesLong(g.longitude), h: g.height };
  }
  const v3 = { sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
    norm: (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; }, scale: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }) };
  // geometría respecto al suelo: hacia dónde va (f), vertical (u), izquierda (l = u × f)
  function frame(date) {
    const a = ecf(date), b = ecf(new Date(date.getTime() + 1000));
    if (!a || !b) return null;
    const u = v3.norm(a.p), f0 = v3.sub(b.p, a.p), f = v3.norm(v3.sub(f0, v3.scale(u, v3.dot(f0, u))));
    const l = v3.norm(v3.cross(u, f));
    const heading = (Math.atan2(v3.dot(f, v3.norm({ x: -a.p.y, y: a.p.x, z: 0 })), v3.dot(f, v3.norm(v3.sub({ x: 0, y: 0, z: 1 }, v3.scale(u, u.z))))) * 180) / Math.PI;
    return { ...a, u, f, l, heading: (heading + 360) % 360, ascending: b.lat > a.lat };
  }
  const siteEcf = (s) => satellite.geodeticToEcf({ longitude: (s.lon * Math.PI) / 180, latitude: (s.lat * Math.PI) / 180, height: 0 });
  // distancia del sitio a la vertical del satélite: a lo largo (adelante) y de lado (izquierda +)
  function offsets(fr, sEcf) {
    const sub = v3.scale(fr.u, R), d = v3.sub(sEcf, sub);
    return { along: v3.dot(d, fr.f), cross: v3.dot(d, fr.l) };
  }
  // Pasadas de varios lugares a la vez: la órbita se calcula UNA sola vez por paso (60 s) y se afina al segundo
  // solo cuando un lugar acaba de quedar perpendicular al satélite. Así 13 días cuestan ~0.1 s, no segundos.
  function scanPasses(targets, from, days = 13) {
    const tg = targets.map((s) => ({ s, e: siteEcf(s), prev: null, out: [] }));
    const STEP = 60000, end = from.getTime() + days * 86400e3;
    for (let t = from.getTime(); t < end; t += STEP) {
      const fr = frame(new Date(t)); if (!fr) continue;
      for (const g of tg) {
        const o = offsets(fr, g.e);
        if (g.prev !== null && g.prev > 0 && o.along <= 0 && Math.abs(o.cross) < 1500) {
          let lo = t - STEP, hi = t;                          // afinar: bisección hasta ~1 ms
          for (let k = 0; k < 16; k++) { const mid = (lo + hi) / 2, f2 = frame(new Date(mid)); if (f2 && offsets(f2, g.e).along > 0) lo = mid; else hi = mid; }
          const tb = (lo + hi) / 2, fb = frame(new Date(tb)), best = { t: tb, o: offsets(fb, g.e), fr: fb };
          const c = best.o.cross;
          g.out.push({ t: new Date(best.t), cross: c, inSwath: c >= SWATH[0] && c <= SWATH[1], ascending: best.fr.ascending, heading: best.fr.heading });
        }
        g.prev = o.along;
      }
    }
    const res = {}; tg.forEach((g) => (res[g.s.id] = g.out)); return res;
  }
  const nextPasses = (site, from, days = 13) => scanPasses([site], from, days)[site.id];

  // ---------- globo ----------
  const pinEls = {}, lastPasses = {};
  let userPin = null;
  const globe = Globe()(document.getElementById("globe"))
    .backgroundColor("#0b1416")
    .globeImageUrl("https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg")
    .showAtmosphere(true).atmosphereColor("#7fd8ff").atmosphereAltitude(0.18)
    .pointsData([]).pointLat("lat").pointLng("lon").pointsTransitionDuration(0)
    // marcadores HTML: sitios y el pin del usuario; cada uno muestra cuándo lo verá NISAR
    .htmlElementsData(SITES).htmlLat("lat").htmlLng("lon").htmlAltitude(0.003)
    .htmlElement((d) => {
      const e = document.createElement("div"); e.className = "site-pin" + (d.user ? " user" : "");
      e.innerHTML = `<i></i><span>${d.user ? tr("📍 tu punto", "📍 your point") : d.short || d.name}</span>` + (d.user ? `<button class="x" title="${tr("Quitar", "Remove")}">✕</button>` : "");
      if (d.user) e.querySelector(".x").onclick = (ev) => { ev.stopPropagation(); setUserPin(null); };
      pinEls[d.id] = e; writePin(d.id); return e;
    })
    .pathsData([]).pathPoints("pts").pathPointLat((p) => p[0]).pathPointLng((p) => p[1]).pathPointAlt((p) => p[2]).pathColor((d) => d.color).pathStroke((d) => d.stroke).pathDashLength(1).pathDashGap(0).pathTransitionDuration(0)
    ;
  globe.controls().autoRotate = false; globe.controls().enableDamping = true;

  // ---------- modelo 3D de NISAR + haz del radar (nisar3d.js, compartido con la intro) ----------
  const T3 = window.THREE;
  const nis = T3 && window.NISAR3D ? NISAR3D.build(T3, globe.scene()) : null;
  if (window.NISAR3D) NISAR3D.highlightES(globe, { tiles: false });
  const sat3d = nis ? nis.sat : null;
  function place3d(date, fr) { if (nis) NISAR3D.place(nis, globe, fr, frame(new Date(date.getTime() + 2000))); }
  globe.pointOfView({ lat: 12, lng: -85, altitude: 2.2 }, 0);
  const box = $("globe"), fit = () => globe.width(box.clientWidth).height(box.clientHeight);
  fit(); addEventListener("resize", fit);
  globe.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  // fotos satelitales de alta resolución SOLO al acercarse: de lejos el mosaico dejaba manchas y pesaba mucho
  const TILE = (x, y, l) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;
  let tilesOn = false;
  function checkTiles() {
    const alt = globe.pointOfView().altitude;
    box.classList.toggle("far", alt > 0.9);        // de lejos los nombres de los 3 sitios se enciman: solo puntos
    const want = alt < 0.3;
    if (want === tilesOn) return;
    tilesOn = want;
    globe.globeTileEngineUrl(want ? TILE : null);
    if (!want && globe.globeTileEngineClearCache) globe.globeTileEngineClearCache();
  }

  // ---------- tiempo ----------
  // speed: 1 = tiempo real; 0 = pausa; 60 = avance rápido automático (solo al saltar a una pasada)
  const Q = new URLSearchParams(location.search);
  const tQ = Q.get("t") ? new Date(Q.get("t")) : null, siteQ = SITES.find((s) => s.id === Q.get("site"));
  let speed = 1, simT = Date.now(), lastReal = performance.now(), follow = false, autoRunEnd = null, cycle = false, trail = [], lastTrail = 0, cycleStart = 0;
  const CYCLE_SPEED = 600;   // 10 minutos de órbita por segundo: una vuelta completa (~98 min) en ~10 s
  let passCache = null;   // { from, byId }
  const toast = (html) => { const n = $("pinNote"); if (!html) { n.classList.remove("show"); n.textContent = ""; } else { n.innerHTML = html; n.classList.add("show"); } };
  if (tQ && !isNaN(tQ)) {
    // La app manda el instante de la imagen. Como los elementos orbitales son de HOY, para una fecha pasada la posición
    // puede ir corrida unos minutos: se ancla al momento en que el satélite pasó perpendicular al sitio ese día.
    const site = siteQ || SITES[0];
    const ps = (scanPasses([site], new Date(tQ.getTime() - 40 * 60e3), 80 / 1440)[site.id] || []).filter((p) => p.inSwath);
    const p = ps.sort((a, b) => Math.abs(a.t - tQ) - Math.abs(b.t - tQ))[0];
    simT = p ? p.t.getTime() : tQ.getTime(); speed = 0;
    const when = `${fmtLocal(new Date(simT)).replace(/,.*/, "")} · ${fmtLocalS(new Date(simT))}`;
    toast(tr(`🛰 Así estaba NISAR cuando tomó la imagen de <b>${site.name}</b> que ves en la app: <b>${when}</b> (hora de El Salvador)${p ? `, ${p.ascending ? "subiendo hacia el norte y mirando al oeste" : "bajando hacia el sur y mirando al este"}, a ${Math.round(p.cross)} km del sitio` : ""}. Está en pausa: pulsa <b>⟲ Al presente</b> para verlo en vivo.`,
      `🛰 This is where NISAR was when it took the <b>${site.name}</b> image you see in the app: <b>${when}</b> (El Salvador time)${p ? `, ${p.ascending ? "heading north and looking west" : "heading south and looking east"}, ${Math.round(p.cross)} km from the site` : ""}. Paused: press <b>⟲ Now</b> to see it live.`));
    setTimeout(() => globe.pointOfView({ lat: 13.6, lng: -89.5, altitude: 1.1 }, 1500), 300);
  }
  const ctl = globe.controls();
  function setFollow(on) { follow = on; $("closeBtn").classList.toggle("on", on); }
  function setCycle(on) {
    cycle = on; $("cycleBtn").classList.toggle("on", on);
    ctl.autoRotate = on; ctl.autoRotateSpeed = 0.5;
    trail = []; lastTrail = 0; cycleStart = simT;
    if (on) {
      speed = CYCLE_SPEED; autoRunEnd = null; setFollow(false);
      globe.pointOfView({ altitude: 2.6 }, 1200);
      toast(tr(`🔄 <b>El ciclo de NISAR, acelerado ×${CYCLE_SPEED}.</b> Cada vuelta dura 98 minutos y la Tierra gira debajo, por eso cada pasada cae más al oeste que la anterior. La línea turquesa va dejando el rastro: en <b>12 días (173 vueltas)</b> cubre todo el planeta y vuelve a empezar exactamente por el mismo camino. Arrastra el globo cuando quieras; vuelve a tocar <b>Ver el ciclo</b> para pararlo.`,
        `🔄 <b>NISAR's cycle, sped up ×${CYCLE_SPEED}.</b> Each orbit takes 98 minutes while the Earth turns underneath, so every pass falls further west than the previous one. The turquoise line leaves a trail: in <b>12 days (173 orbits)</b> it covers the whole planet and starts again on exactly the same path. Drag the globe whenever you like; press <b>See the cycle</b> again to stop.`));
    } else if (speed === CYCLE_SPEED) { speed = 1; toast(null); }
  }
  $("nowBtn").onclick = () => { setCycle(false); simT = Date.now(); speed = 1; autoRunEnd = null; toast(null); passCache = null; };
  $("cycleBtn").onclick = () => setCycle(!cycle);
  // más libre: si la persona arrastra el globo, la cámara deja de perseguir al satélite
  ctl.addEventListener("start", () => { if (follow) setFollow(false); });
  $("nextBtn").onclick = () => {
    const n = allPasses().find((p) => p.t.getTime() > simT + 60e3); if (!n) return;
    setCycle(false); simT = n.t.getTime() - 3 * 60e3; speed = 60; autoRunEnd = n.t.getTime() + 2 * 60e3; setFollow(false);
    globe.pointOfView({ lat: 13.6, lng: -89.3, altitude: 1.2 }, 1200);
    toast(tr(`⏭ Adelantando el tiempo a la próxima pasada sobre <b>${n.siteName}</b>: <b>${fmtLocal(n.t)}</b>. El reloj corre ×60 y se detiene justo después.`, `⏭ Fast-forwarding to the next pass over <b>${n.siteName}</b>: <b>${fmtLocal(n.t)}</b>. The clock runs ×60 and stops right after.`));
  };
  // la cámara se pone a un costado del satélite (no encima), así se ve el modelo 3D y su haz de lado
  // punto en el suelo a 'km' del satélite, detrás de él y un poco a su derecha: desde ahí se ve el modelo y el haz delante
  function camSpot(fr, km = 260) {
    const brg = ((fr.heading + 160) * Math.PI) / 180, lat1 = (fr.lat * Math.PI) / 180, lon1 = (fr.lon * Math.PI) / 180, d = km / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
    const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return [(lat2 * 180) / Math.PI, ((((lon2 * 180) / Math.PI) + 540) % 360) - 180];
  }
  $("closeBtn").onclick = () => {
    if (follow) { setFollow(false); globe.pointOfView({ altitude: 1.6 }, 1200); return; }
    const fr = frame(new Date(simT)); if (!fr) return;
    setCycle(false); setFollow(true);
    const [la, lo] = camSpot(fr);
    globe.pointOfView({ lat: la, lng: lo, altitude: 0.3 }, 1500);
  };

  // ---------- pin del usuario: clic en cualquier lugar del globo → cuándo lo verá NISAR ----------
  function setUserPin(pt) {
    userPin = pt ? { id: "user", name: tr("Este lugar", "This place"), user: true, ...pt } : null;
    delete pinEls.user; passCache = null;
    globe.htmlElementsData(userPin ? [...SITES, userPin] : SITES);
    renderPasses();
    if (!userPin) { toast(null); $("pinTip").hidden = false; return; }
    const ps = (passCache.byId.user || []).filter((p) => p.inSwath && p.t.getTime() > simT), p = ps[0], now = new Date(simT);
    const where = `${Math.abs(pt.lat).toFixed(3)}° ${pt.lat >= 0 ? "N" : "S"}, ${Math.abs(pt.lon).toFixed(3)}° ${pt.lon >= 0 ? "E" : tr("O", "W")}`;
    const edge = p && Math.min(p.cross - SWATH[0], SWATH[1] - p.cross) < 40;
    $("pinTip").hidden = true;
    toast(p
      ? `<div class="sub">📍 ${tr("Tu punto", "Your point")} · ${where}</div><div class="pin-big">${fmtLocal(p.t).replace(/,.*/, "")} · ${fmtLocalS(p.t)}</div>` +
        `<div class="sub">${tr(`hora de El Salvador · margen ± ${errS(p.t)} s · en ${fmtDur(p.t - now)}`, `El Salvador time · margin ± ${errS(p.t)} s · in ${fmtDur(p.t - now)}`)}</div>` +
        `<div class="pin-row">${tr(`${p.ascending ? "Sube hacia el norte y mira al oeste" : "Baja hacia el sur y mira al este"}; tu punto queda a ${Math.round(p.cross)} km de su vertical.`, `${p.ascending ? "Heading north, looking west" : "Heading south, looking east"}; your point is ${Math.round(p.cross)} km from its ground track.`)}</div>` +
        (edge ? `<div class="pin-row warn">${tr("⚠ Queda cerca del borde de la franja del radar: puede salir en la imagen o quedar justo afuera.", "⚠ Close to the edge of the radar swath: it may appear in the image or fall just outside.")}</div>` : "") +
        (ps[1] ? `<div class="pin-row">${tr("Después", "Then")}: ${ps.slice(1, 3).map((q) => `${fmtLocal(q.t).replace(/,.*/, "")} ${fmtLocalS(q.t)}`).join(" · ")}</div>` : "") +
        `<div class="pin-row">${tr("Toca otro punto para moverlo.", "Tap another point to move it.")}</div>`
      : tr(`📍 ${where}: en los próximos 13 días NISAR no ve este punto dentro de su franja. Prueba otro lugar.`, `📍 ${where}: NISAR does not see this point inside its swath in the next 13 days. Try another place.`));
  }
  // clic propio (sin arrastrar): con las fotos de alta resolución activas, el clic de globe.gl no llega al planeta
  let down = null;
  box.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  box.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || e.target.closest(".site-pin")) return;
    const r = box.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let c = globe.toGlobeCoords(x, y);
    if (!c && T3) {   // con las fotos de alta resolución la esfera base se oculta: se intersecta el rayo con la Tierra a mano
      const rc = new T3.Raycaster(); rc.setFromCamera(new T3.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1), globe.camera());
      const hit = rc.ray.intersectSphere(new T3.Sphere(new T3.Vector3(0, 0, 0), globe.getGlobeRadius()), new T3.Vector3());
      if (hit) { const g = globe.toGeoCoords(hit); c = { lat: g.lat, lng: g.lng }; }
    }
    if (c) setUserPin({ lat: c.lat, lon: c.lng });
  });

  // ---------- quemas de la zafra junto al manglar: columnas de fuego que laten ----------
  let burns = null, fireOn = false, fireData = [];
  async function loadBurns() {
    if (burns) return burns;
    try { burns = await fetch("data/ref/burns.json").then((r) => r.json()); } catch { burns = { events: [] }; }
    return burns;
  }
  const fireColor = (km) => (km < 0.5 ? "#ff2a1a" : km < 1 ? "#ff5a1f" : "#ff9a2a");
  $("fireBtn").onclick = async () => {
    fireOn = !fireOn; $("fireBtn").classList.toggle("on", fireOn);
    const b = await loadBurns();
    const ev = fireOn ? b.events : [];
    globe.ringsData(ev).ringLat("lat").ringLng("lon")
      .ringColor((e) => (t) => `rgba(255,${Math.round(60 + 120 * t)},20,${(1 - t) * 0.95})`)
      .ringMaxRadius((e) => 0.025 + Math.sqrt(e.ha) * 0.012).ringPropagationSpeed(0.05).ringRepeatPeriod((e) => 450 + (e.ha % 7) * 110)
      .ringAltitude(0.0004);
    // columnas de fuego: se ponen o se quitan de los datos (antes se recorría toda la escena en cada cuadro y se trababa)
    fireData = fireOn ? b.events.map((e) => ({ kind: "fire", lat: e.lat, lon: e.lon, alt: 0.0015 + Math.sqrt(e.ha) * 0.0022, color: fireColor(e.km_to_mangrove) })) : [];
    if (sat3d) globe.pointsData(fireData);
    globe.pointColor((d) => (d.kind === "fire" ? d.color : "#ff5a1f"))
      .pointAltitude((d) => (d.kind === "fire" ? d.alt : d.kind === "sat" ? d.alt : 0.004))
      .pointRadius((d) => (d.kind === "fire" ? 0.011 : 0.35));
    if (fireOn) {
      setFollow(false); setCycle(false);
      globe.pointOfView({ lat: 13.58, lng: -90.03, altitude: 0.06 }, 2200);
      const near = b.events.filter((e) => e.km_to_mangrove < 1).length;
      $("fireNote").innerHTML = tr(`<b>${b.events.length}</b> quemas de caña en la zafra 2025–2026 junto al manglar de Barra de Santiago (detectadas con fotos Sentinel-2). <b style="color:#ff6b5b">${near}</b> a menos de 1 km del manglar. Más alta = más grande; más roja = más cerca del manglar.`,
        `<b>${b.events.length}</b> sugarcane burns in the 2025–2026 harvest next to the Barra de Santiago mangroves (detected with Sentinel-2 images). <b style="color:#ff6b5b">${near}</b> within 1 km of the mangroves. Taller = bigger; redder = closer to the mangroves.`);
    } else $("fireNote").textContent = "";
  };

  // ---------- pasadas (en caché: se recalculan solo si el reloj se sale de la ventana) ----------
  function ensurePasses() {
    const now = simT;
    if (passCache && now >= passCache.from && now < passCache.from + 11 * 86400e3) return passCache;
    const targets = userPin ? [...SITES, userPin] : SITES;
    passCache = { from: now - 60e3, byId: scanPasses(targets, new Date(now - 60e3), 13) };
    return passCache;
  }
  function allPasses() {
    const c = ensurePasses(), out = [];
    for (const s of SITES) (c.byId[s.id] || []).forEach((p) => p.inSwath && out.push({ ...p, siteName: s.name }));
    return out.sort((a, b) => a.t - b.t);
  }
  function writePin(id) {
    const e = pinEls[id], ps = lastPasses[id]; if (!e || !ps || !e.querySelector(".np")) return;
    const p = ps[0];
    e.querySelector(".np").textContent = p ? `NISAR pasa: ${fmtLocal(p.t)} (en ${fmtDur(p.t - simT)})` : "sin pasada en 13 días";
  }
  function renderPasses() {
    const c = ensurePasses(), now = new Date(simT);
    const targets = userPin ? [...SITES, userPin] : SITES;
    const html = targets.map((s) => {
      const ps = (c.byId[s.id] || []).filter((p) => p.inSwath && p.t.getTime() > simT);
      lastPasses[s.id] = ps; writePin(s.id);
      const p = ps[0];
      if (!p) return `<div class="pass"><b>${s.name}</b><span class="warn">${tr("sin pasada dentro de la franja en los próximos días", "no pass inside the swath in the coming days")}</span></div>`;
      const dir = p.ascending ? tr("subiendo hacia el norte", "heading north") : tr("bajando hacia el sur", "heading south");
      const mira = p.ascending ? tr("mirando hacia el oeste", "looking west") : tr("mirando hacia el este", "looking east");
      const hora = localParts(p.t).hh < 12 ? tr("de madrugada", "before dawn") : tr("al atardecer", "at dusk");
      const rest = ps.slice(1, 3).map((q) => fmtLocal(q.t)).join(" · ");
      return `<div class="pass"><b>${s.name}</b><span class="when">${tr("en", "in")} ${fmtDur(p.t - now)} · ${fmtLocal(p.t)}</span><div class="how">${hora} · ${dir}, ${mira}, ${tr(`a ${Math.round(p.cross)} km de su vertical`, `${Math.round(p.cross)} km from its ground track`)}</div>${rest ? `<div class="how">${tr("después", "then")}: ${rest}</div>` : ""}</div>`;
    }).join("");
    setHTML("passes", html);
  }

  // ---------- estela y franja (ligera: 1 punto por minuto, 4 líneas de franja) ----------
  function buildPaths(date) {
    const past = [], fut = [], swath = Array.from({ length: 4 }, () => []);
    for (let m = -50; m <= 50; m += 1) {
      const fr = frame(new Date(date.getTime() + m * 60e3));
      if (!fr) continue;
      const pt = [fr.lat, fr.lon, 0.012];
      (m < 0 ? past : fut).push(pt);
      if (m >= 0) {
        const brg = ((fr.heading - 90) * Math.PI) / 180, lat1 = (fr.lat * Math.PI) / 180, lon1 = (fr.lon * Math.PI) / 180;
        swath.forEach((arr, i) => {
          const dist = (SWATH[0] + (i / 3) * (SWATH[1] - SWATH[0])) / R;
          const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brg));
          const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));
          arr.push([(lat2 * 180) / Math.PI, ((((lon2 * 180) / Math.PI + 540) % 360) - 180), 0.006]);
        });
      }
    }
    const split = (pts) => { const out = []; let cur = []; for (const p of pts) { if (cur.length && Math.abs(p[1] - cur[cur.length - 1][1]) > 180) { out.push(cur); cur = []; } cur.push(p); } if (cur.length) out.push(cur); return out; };
    const paths = [];
    split(past).forEach((pts) => paths.push({ pts, color: "#5f7a80", stroke: 0.6 }));
    split(fut).forEach((pts) => paths.push({ pts, color: "#149BA5", stroke: 1.1 }));
    swath.forEach((arr) => split(arr).forEach((pts) => paths.push({ pts, color: "rgba(255,138,0,0.35)", stroke: 1.8 })));
    if (cycle && trail.length > 1) split(trail).forEach((pts) => paths.push({ pts, color: "rgba(80,235,220,0.8)", stroke: 0.6 }));
    globe.pathsData(paths);
  }

  // ---------- bucle ----------
  let lastPathsSim = -1e12, lastPathsReal = 0, lastTextReal = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    simT += (now - lastReal) * speed; lastReal = now;
    if (autoRunEnd && simT >= autoRunEnd) { speed = 1; autoRunEnd = null; toast(tr(`✅ Esa fue la pasada. El reloj sigue desde aquí en tiempo real; pulsa <b>⟲ Al presente</b> para la hora de hoy.`, `✅ That was the pass. The clock keeps running in real time from here; press <b>⟲ Now</b> for today's time.`)); }
    const date = new Date(simT);
    const fr = frame(date);
    if (fr) {
      if (sat3d) place3d(date, fr);
      else if (now - lastTextReal > 200) globe.pointsData([...fireData, { kind: "sat", lat: fr.lat, lon: fr.lon, alt: fr.h / R }]);
      if (follow) { const [la, lo] = camSpot(fr); globe.pointOfView({ lat: la, lng: lo }, 0); }
      if (cycle && simT - lastTrail > 120e3) { trail.push([fr.lat, fr.lon, 0.008]); lastTrail = simT; if (trail.length > 2400) trail.shift(); }
    }
    // textos: 4 veces por segundo basta, y así no se recalcula nada por cuadro
    if (now - lastTextReal > 400) {
      lastTextReal = now; checkTiles();
      if (fr) {
        const ns = fr.lat >= 0 ? "N" : "S", ew = fr.lon >= 0 ? "E" : tr("O", "W");
        setText("nowPos", `${Math.abs(fr.lat).toFixed(1)}° ${ns}, ${Math.abs(fr.lon).toFixed(1)}° ${ew}`);
        setText("nowSub", tr(`${Math.round(fr.h)} km de altura · 7.5 km/s · ${fr.ascending ? "subiendo hacia el norte" : "bajando hacia el sur"} · mira a su izquierda (${fr.ascending ? "oeste" : "este"})`, `${Math.round(fr.h)} km high · 7.5 km/s · ${fr.ascending ? "heading north" : "heading south"} · looks to its left (${fr.ascending ? "west" : "east"})`));
      }
      const lap = (Math.floor((simT - cycleStart) / (98.4 * 60e3)) % 173) + 1;
      const lbl = cycle ? tr(`Ciclo ×${CYCLE_SPEED} · vuelta ${lap} de 173`, `Cycle ×${CYCLE_SPEED} · orbit ${lap} of 173`) : speed === 1 ? tr("Hora real", "Real time") : speed === 0 ? tr("En pausa", "Paused") : tr("Adelantando ×", "Fast-forward ×") + speed;
      setText("nowClock", `${lbl}: ${fmtLocal(date)} (El Salvador) · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`);
      renderPasses();
    }
    // estela: como mucho 3 veces por segundo, y solo si el reloj se movió al menos un minuto
    if (now - lastPathsReal > (cycle ? 500 : 330) && Math.abs(simT - lastPathsSim) > 60e3) { buildPaths(date); lastPathsSim = simT; lastPathsReal = now; }
  }
  // ---------- comprobación: predicción vs. imágenes reales que NISAR ya tomó ----------
  async function checkReal() {
    const bases = { barra: "data", jiquilisco: "data-jiquilisco", cerron: "data-cerron" }, rows = [];
    for (const site of SITES) {
      const S = await fetch(bases[site.id] + "/series.json").then((r) => r.json()).catch(() => null);
      for (const d of S?.dates || []) {
        const scn = Array.isArray(d.scene) ? d.scene[0] : d.scene, m = scn && scn.match(/_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})_/);
        if (!m) continue;
        const t = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
        const ps = scanPasses([site], new Date(t - 3 * 3600e3), 6 / 24)[site.id].filter((p) => p.inSwath);
        const p = ps.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
        rows.push({ site: site.name, t, diff: p ? (p.t - t) / 1000 : null });
      }
    }
    rows.sort((a, b) => b.t - a.t);
    // una fila por fecha (los 3 sitios suelen salir en la misma pasada): se muestra el mayor error de ese día
    const byDay = {};
    rows.forEach((r) => { const k = r.t.toISOString().slice(0, 10); const o = byDay[k] || (byDay[k] = { t: r.t, sites: [], diff: 0, miss: false }); o.sites.push({ "Barra de Santiago": "Barra", "Bahía de Jiquilisco": "Jiquilisco", "Embalse Cerrón Grande": "Cerrón" }[r.site] || r.site); if (r.diff === null) o.miss = true; else o.diff = Math.max(o.diff, Math.abs(r.diff)); });
    const days = Object.values(byDay).sort((a, b) => b.t - a.t);
    const txt = (o) => o.miss && !o.diff ? "—" : o.diff < 60 ? `${Math.round(o.diff)} s` : `${EN ? (o.diff / 60).toFixed(1) : (o.diff / 60).toFixed(1).replace(".", ",")} min`;
    const cls = (o) => o.miss && !o.diff ? "far" : o.diff < 60 ? "ok" : o.diff < 240 ? "mid" : "far";
    $("realTable").innerHTML = `<table class="real-tbl"><tr><th>${tr("Imagen real", "Real image")}</th><th>${tr("Hora (El Salvador)", "Time (El Salvador)")}</th><th>${tr("Diferencia", "Difference")}</th></tr>` +
      days.slice(0, 10).map((o) => `<tr><td>${fmtLocal(o.t).replace(/,.*/, "")} ${o.t.getUTCFullYear()}<br><span class="sub">${[...new Set(o.sites)].join(", ")}</span></td><td>${fmtLocal(o.t).split(", ")[1]}</td><td class="d ${cls(o)}">${txt(o)}</td></tr>`).join("") + `</table>`;
    const recent = days.filter((o) => !o.miss && o.diff < 60);
    const worst = Math.max(1, Math.round(Math.max(...recent.map((o) => o.diff))));
    if (recent.length) $("realVerdict").innerHTML = tr(`✅ En las <b>${recent.length}</b> pasadas más recientes, la predicción y la imagen real se separan menos de <b>${worst} segundos</b>. Hacia atrás el error crece a minutos, pero la hora del día sigue siendo la misma.`,
      `✅ In the <b>${recent.length}</b> most recent passes, prediction and real image differ by less than <b>${worst} seconds</b>. Further back the error grows to minutes, but the time of day stays the same.`);
  }
  checkReal();

  $("load").classList.add("off");
  requestAnimationFrame(tick);
  window.ORBITA = { frame, nextPasses, scanPasses, offsets, siteEcf, SITES, satrec, place3d, globe, setUserPin, setTime: (iso) => { simT = new Date(iso).getTime(); passCache = null; } };
})();
