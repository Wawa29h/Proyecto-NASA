// MANGLO · ¿Dónde está NISAR? Globo con la órbita real del satélite (TLE público + SGP4 vía satellite.js).
(async () => {
  const $ = (id) => document.getElementById(id);
  const R = 6371;                                   // km
  const SWATH = [430, 680];                         // km a la IZQUIERDA de la vertical (incidencia ~33°–47°, aprox.)
  const SITES = [
    { id: "barra", name: "Barra de Santiago", lat: 13.715, lon: -90.04 },
    { id: "jiquilisco", name: "Bahía de Jiquilisco", lat: 13.25, lon: -88.50 },
    { id: "cerron", name: "Embalse Cerrón Grande", lat: 14.03, lon: -89.08 },
  ];
  const TZ = -6;                                    // El Salvador, sin horario de verano
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const pad = (n) => String(n).padStart(2, "0");
  const localParts = (d) => { const t = new Date(d.getTime() + TZ * 3600e3); return { dia: DIAS[t.getUTCDay()], d: t.getUTCDate(), m: MESES[t.getUTCMonth()], hh: t.getUTCHours(), mm: t.getUTCMinutes() }; };
  const fmtLocal = (d) => { const p = localParts(d); const h12 = ((p.hh + 11) % 12) + 1; return `${p.dia} ${p.d} ${p.m}, ${h12}:${pad(p.mm)} ${p.hh < 12 ? "a.m." : "p.m."}`; };
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
  // época del TLE (año de 2 cifras + día del año con decimales)
  const ep = tle.line1.slice(18, 32); const epY = 2000 + +ep.slice(0, 2), epD = +ep.slice(2);
  const epoch = new Date(Date.UTC(epY, 0, 1) + (epD - 1) * 86400e3);
  $("tleNote").textContent = `Órbita: elementos ${live ? "en vivo" : "guardados"} del ${fmtLocal(epoch)} (CelesTrak, NORAD 65053).`;

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
    const heading = (Math.atan2(/* este */ v3.dot(f, v3.norm({ x: -a.p.y, y: a.p.x, z: 0 })), /* norte */ v3.dot(f, v3.norm(v3.sub({ x: 0, y: 0, z: 1 }, v3.scale(u, u.z))))) * 180) / Math.PI;
    return { ...a, u, f, l, heading: (heading + 360) % 360, ascending: b.lat > a.lat };
  }
  const siteEcf = (s) => satellite.geodeticToEcf({ longitude: (s.lon * Math.PI) / 180, latitude: (s.lat * Math.PI) / 180, height: 0 });
  // distancia del sitio a la vertical del satélite: a lo largo (adelante) y de lado (izquierda +)
  function offsets(fr, sEcf) {
    const sub = v3.scale(fr.u, R), d = v3.sub(sEcf, sub);
    return { along: v3.dot(d, fr.f), cross: v3.dot(d, fr.l) };
  }
  function nextPasses(site, from, days = 13) {
    const sE = siteEcf(site), out = [];
    let t = from.getTime(), prevAlong = null;
    const end = t + days * 86400e3;
    while (t < end) {
      const fr = frame(new Date(t));
      if (fr) {
        const o = offsets(fr, sE);
        if (prevAlong !== null && prevAlong > 0 && o.along <= 0 && Math.abs(o.cross) < 1200) {   // acaba de pasar la perpendicular
          // afinar al segundo
          let best = { t, o }; for (let k = -20; k <= 0; k++) { const tt = t + k * 1000, f2 = frame(new Date(tt)); if (!f2) continue; const o2 = offsets(f2, sE); if (Math.abs(o2.along) < Math.abs(best.o.along)) best = { t: tt, o: o2, fr: f2 }; }
          const fr2 = best.fr || fr, c = best.o.cross;
          const inSwath = c >= SWATH[0] && c <= SWATH[1];
          out.push({ t: new Date(best.t), cross: c, inSwath, ascending: fr2.ascending, heading: fr2.heading, side: c > 0 ? "izquierda" : "derecha" });
        }
        prevAlong = o.along;
      }
      t += 20000;
    }
    return out;
  }

  // ---------- globo ----------
  const globe = Globe()(document.getElementById("globe"))
    .backgroundColor("#0b1416")
    .globeImageUrl("https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png")
    .showAtmosphere(true).atmosphereColor("#7fd8ff").atmosphereAltitude(0.18)
    .pointsData([]).pointLat("lat").pointLng("lon").pointsTransitionDuration(0)
    // sitios: marcadores HTML pequeños, siempre del mismo tamaño en pantalla (y con tildes)
    .htmlElementsData(SITES).htmlLat("lat").htmlLng("lon").htmlAltitude(0.003)
    .htmlElement((d) => { const e = document.createElement("div"); e.className = "site-pin"; e.innerHTML = `<i></i><span>${d.name}</span>`; return e; })
    .pathsData([]).pathPoints("pts").pathPointLat((p) => p[0]).pathPointLng((p) => p[1]).pathPointAlt((p) => p[2]).pathColor((d) => d.color).pathStroke((d) => d.stroke).pathDashLength(1).pathDashGap(0).pathTransitionDuration(0)
    ;
  globe.controls().autoRotate = false; globe.controls().enableDamping = true;

  // ---------- modelo 3D de NISAR + haz del radar (nisar3d.js, compartido con la intro) ----------
  const T3 = window.THREE;
  const nis = T3 && window.NISAR3D ? NISAR3D.build(T3, globe.scene()) : null;
  if (window.NISAR3D) NISAR3D.highlightES(globe);   // El Salvador en alta resolución y con contorno brillante
  const sat3d = nis ? nis.sat : null;
  function place3d(date, fr) {
    if (!nis) return;
    NISAR3D.place(nis, globe, fr, frame(new Date(date.getTime() + 2000)));
  }
  globe.pointOfView({ lat: 12, lng: -85, altitude: 2.2 }, 0);
  addEventListener("resize", () => globe.width(innerWidth).height(innerHeight));

  // ---------- tiempo ----------
  let speed = 1, simT = Date.now(), lastReal = performance.now(), follow = false;
  $("speedSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; speed = +b.dataset.s; [...e.currentTarget.children].forEach((x) => x.classList.toggle("on", x === b)); };
  $("nowBtn").onclick = () => { simT = Date.now(); speed = 1; [...$("speedSeg").children].forEach((x) => x.classList.toggle("on", x.dataset.s === "1")); };
  $("followBtn").onclick = (e) => { follow = !follow; e.target.classList.toggle("on", follow); if (follow) globe.controls().autoRotate = false; };
  let nextAll = [];
  $("nextBtn").onclick = () => { const n = nextAll.find((p) => p.t.getTime() > simT); if (n) { simT = n.t.getTime() - 4 * 60e3; speed = 60; [...$("speedSeg").children].forEach((x) => x.classList.toggle("on", x.dataset.s === "60")); follow = false; globe.pointOfView({ lat: 13.6, lng: -89.3, altitude: 1.2 }, 1200); } };

  $("closeBtn").onclick = () => {
    const fr = frame(new Date(simT)); if (!fr) return;
    follow = true; $("followBtn").classList.add("on");
    globe.pointOfView({ lat: fr.lat, lng: fr.lon, altitude: 0.45 }, 1500);
  };

  // ---------- quemas de la zafra junto al manglar: columnas de fuego que laten ----------
  let burns = null, fireOn = false;
  async function loadBurns() {
    if (burns) return burns;
    try { burns = await fetch("data/ref/burns.json").then((r) => r.json()); } catch { burns = { events: [] }; }
    return burns;
  }
  function pointVisibility() {   // quemas visibles solo en modo quemas; marcadores de sitios solo fuera de él
    globe.scene().traverse((o) => { if (o.__globeObjType === "point" && o.__data) o.visible = o.__data.kind === "fire" ? fireOn : !fireOn; });
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
    // columnas: más altas = quema más grande; más rojas = más cerca del manglar.
    // En modo quemas se esconden los marcadores grandes de los sitios para que no tapen el fuego.
    // La librería no borra ni redimensiona bien los marcadores ya creados, así que los sitios y las quemas
    // se quedan siempre en los datos y se esconden/muestran directamente en la escena (ver pointVisibility).
    if (!globe.pointsData().some((d) => d.kind === "fire"))
      globe.pointsData([...b.events.map((e) => ({ kind: "fire", lat: e.lat, lon: e.lon, alt: 0.0015 + Math.sqrt(e.ha) * 0.0022, color: fireColor(e.km_to_mangrove) }))])
        .pointColor((d) => (d.kind === "fire" ? d.color : "#ff5a1f"))
        .pointAltitude((d) => (d.kind === "fire" ? d.alt : 0.004))
        .pointRadius((d) => (d.kind === "fire" ? 0.011 : 0.35));
    pointVisibility();
    if (fireOn) {
      follow = false; $("followBtn").classList.remove("on");
      globe.pointOfView({ lat: 13.58, lng: -90.03, altitude: 0.06 }, 2200);
      const near = b.events.filter((e) => e.km_to_mangrove < 1).length;
      $("fireNote").innerHTML = `<b>${b.events.length}</b> quemas de caña en la zafra 2025–2026 junto al manglar de Barra de Santiago (detectadas con fotos Sentinel-2). <b style="color:#ff6b5b">${near}</b> a menos de 1 km del manglar. Más alta = más grande; más roja = más cerca del manglar.`;
    } else $("fireNote").textContent = "";
  };

  // ---------- pasadas ----------
  function renderPasses() {
    const now = new Date(simT);
    nextAll = [];
    const html = SITES.map((s) => {
      const ps = nextPasses(s, now).filter((p) => p.inSwath);
      const p = ps[0];
      if (!p) return `<div class="pass"><b>${s.name}</b><span class="warn">sin pasada dentro de la franja en 13 días (revisa los elementos orbitales)</span></div>`;
      nextAll.push(...ps);
      const dir = p.ascending ? "subiendo hacia el norte" : "bajando hacia el sur";
      const mira = p.ascending ? "mirando hacia el oeste" : "mirando hacia el este";
      const rest = ps.slice(1, 3).map((q) => fmtLocal(q.t).replace(/^\w+ /, "")).join(" · ");
      return `<div class="pass"><b>${s.name}</b><span class="when">en ${fmtDur(p.t - now)} · ${fmtLocal(p.t)}</span><div class="how">${dir}, ${mira}, a ${Math.round(p.cross)} km de su vertical</div>${rest ? `<div class="how">después: ${rest}</div>` : ""}</div>`;
    }).join("");
    nextAll.sort((a, b) => a.t - b.t);
    $("passes").innerHTML = html;
  }

  // ---------- estela y franja ----------
  function buildPaths(date) {
    const past = [], fut = [], swath = Array.from({ length: 6 }, () => []);
    for (let m = -50; m <= 50; m += 0.5) {
      const fr = frame(new Date(date.getTime() + m * 60e3));
      if (!fr) continue;
      const pt = [fr.lat, fr.lon, 0.012];
      (m < 0 ? past : fut).push(pt);
      if (m >= 0) {
        // puntos a la izquierda, a distintas distancias, por geodésica aproximada
        const brg = ((fr.heading - 90) * Math.PI) / 180, lat1 = (fr.lat * Math.PI) / 180, lon1 = (fr.lon * Math.PI) / 180;
        swath.forEach((arr, i) => {
          const dist = (SWATH[0] + (i / 5) * (SWATH[1] - SWATH[0])) / R;
          const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brg));
          const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));
          arr.push([(lat2 * 180) / Math.PI, ((((lon2 * 180) / Math.PI + 540) % 360) - 180), 0.006]);
        });
      }
    }
    // cortar los caminos donde cruzan el antimeridiano para que no crucen el globo
    const split = (pts) => { const out = []; let cur = []; for (const p of pts) { if (cur.length && Math.abs(p[1] - cur[cur.length - 1][1]) > 180) { out.push(cur); cur = []; } cur.push(p); } if (cur.length) out.push(cur); return out; };
    const paths = [];
    split(past).forEach((pts) => paths.push({ pts, color: "#5f7a80", stroke: 0.6 }));
    split(fut).forEach((pts) => paths.push({ pts, color: "#149BA5", stroke: 1.1 }));
    swath.forEach((arr) => split(arr).forEach((pts) => paths.push({ pts, color: "rgba(255,138,0,0.35)", stroke: 1.6 })));
    globe.pathsData(paths);
  }

  // ---------- bucle ----------
  let lastPaths = -1e12, lastPassCalc = -1e12;
  function tick(now) {
    requestAnimationFrame(tick);
    simT += (now - lastReal) * speed; lastReal = now;
    const date = new Date(simT);
    const fr = frame(date);
    if (fr) {
      if (sat3d) { place3d(date, fr); if (burns) pointVisibility(); }
      else globe.pointsData([...SITES, { kind: "sat", lat: fr.lat, lon: fr.lon, alt: fr.h / R }]);   // sin 3D: columna blanca
      const ns = fr.lat >= 0 ? "N" : "S", ew = fr.lon >= 0 ? "E" : "O";
      $("nowPos").textContent = `${Math.abs(fr.lat).toFixed(1)}° ${ns}, ${Math.abs(fr.lon).toFixed(1)}° ${ew}`;
      $("nowSub").textContent = `${Math.round(fr.h)} km de altura · 7.5 km/s · ${fr.ascending ? "subiendo hacia el norte" : "bajando hacia el sur"} · mira a su izquierda (${fr.ascending ? "oeste" : "este"})`;
      if (follow) globe.pointOfView({ lat: fr.lat, lng: fr.lon }, 0);
    }
    const p = localParts(date);
    $("nowClock").textContent = `${speed === 1 ? "Hora real" : "Simulado ×" + speed}: ${fmtLocal(date)} (El Salvador) · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
    if (Math.abs(simT - lastPaths) > 60e3 * (speed >= 600 ? 2 : 1)) { buildPaths(date); lastPaths = simT; }
    if (Math.abs(simT - lastPassCalc) > 10 * 60e3) { renderPasses(); lastPassCalc = simT; }
  }
  $("load").classList.add("off");
  requestAnimationFrame(tick);
  window.ORBITA = { frame, nextPasses, SITES, satrec, place3d, globe, setTime: (iso) => { simT = new Date(iso).getTime(); } };
})();
