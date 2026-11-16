// Intro: el planeta en 3D con NISAR dando vueltas rápido, botón "Comenzar", zoom rápido a El Salvador
// y fundido hacia el mapa. Se muestra al entrar desde cero (sin ?site=) o con ?intro=1.
(function () {
  const params = new URLSearchParams(location.search);
  const el = document.getElementById("intro");
  if (!el || (params.has("site") && params.get("intro") !== "1") || params.get("intro") === "0") return;
  window.INTRO_ACTIVE = true;           // story.js no muestra la portada vieja
  el.hidden = false;
  const hideHero = () => { const h = document.getElementById("hero"); if (h) h.hidden = true; };
  hideHero();
  const heroWatch = setInterval(hideHero, 300);   // por si la app termina de cargar después

  const SPEED = 420;                     // la intro corre ~420 veces más rápido que la realidad
  const ES = { lat: 13.72, lng: -89.2 };
  const libs = [
    "https://cdn.jsdelivr.net/npm/globe.gl@2.40.0/dist/globe.gl.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js",   // después de globe.gl (ver orbita.html)
    "https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js",
    "nisar3d.js",
  ];
  const load = (src) => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  let globe = null, raf = 0, done = false;

  function finish() {                     // fundido y mapa
    if (done) return; done = true;
    el.classList.add("out");
    try { map.setView([13.75, -89.0], 8, { animate: false }); } catch {}
    setTimeout(() => {
      cancelAnimationFrame(raf);
      try { globe && globe._destructor && globe._destructor(); } catch {}
      el.remove();
      clearInterval(heroWatch); hideHero();
      window.INTRO_ACTIVE = false;
      try {
        map.invalidateSize();
        if (typeof bounds !== "undefined" && bounds) map.flyToBounds(bounds, { padding: [10, 10], duration: 1.4 });
      } catch {}
    }, 750);
  }
  document.getElementById("introSkip").onclick = finish;

  (async () => {
    try { for (const s of libs) await load(s); } catch { return finish(); }   // sin internet: directo al mapa
    const tle = await fetch("data/nisar_tle.json").then((r) => r.json()).catch(() => null);
    if (!tle || !window.Globe || !window.THREE || !window.satellite) return finish();
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    const R = 6371;
    const geo = (date) => {
      const pv = satellite.propagate(satrec, date); if (!pv.position) return null;
      const g = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
      return { lat: satellite.degreesLat(g.latitude), lon: satellite.degreesLong(g.longitude), h: g.height };
    };
    const head = (a, b) => {               // rumbo aproximado entre dos puntos
      const p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180, dl = ((b.lon - a.lon) * Math.PI) / 180;
      return ((Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * 180) / Math.PI + 360) % 360;
    };
    globe = Globe({ animateIn: true })(document.getElementById("introGlobe"))
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl("https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg")
      .showAtmosphere(true).atmosphereColor("#7fd8ff").atmosphereAltitude(0.2)
      .pathsData([]).pathPoints("pts").pathPointLat((p) => p[0]).pathPointLng((p) => p[1]).pathPointAlt((p) => p[2])
      .pathColor(() => ["rgba(20,155,165,0)", "rgba(20,155,165,.9)"]).pathStroke(1.4).pathTransitionDuration(0)
      .width(innerWidth).height(innerHeight);
    globe.controls().enableZoom = false;
    globe.controls().autoRotate = true; globe.controls().autoRotateSpeed = 0.5;
    globe.pointOfView({ lat: 8, lng: -70, altitude: 2.7 }, 0);
    addEventListener("resize", () => globe && globe.width(innerWidth).height(innerHeight));
    const nis = NISAR3D.build(THREE, globe.scene());
    globe.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));   // más liviano en pantallas muy nítidas
    NISAR3D.highlightES(globe, { tiles: false });   // contorno brillante de El Salvador; las fotos de alta resolución solo al acercarse
    let simT = Date.now(), last = performance.now(), frameN = 0, zooming = false;
    document.getElementById("introLoad").classList.add("off");
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      simT += (now - last) * (zooming ? 30 : SPEED); last = now;
      const d = new Date(simT), a = geo(d), b = geo(new Date(simT + 2000));
      if (!a || !b) return;
      NISAR3D.place(nis, globe, { ...a, heading: head(a, b) }, { ...b, heading: head(a, b) }, zooming ? 1 : 2.2);
      if (frameN++ % 6 === 0) {            // estela: los últimos ~25 minutos de órbita
        const pts = [];
        for (let m = -25; m <= 0; m += 0.5) { const g = geo(new Date(simT + m * 60e3)); if (g) pts.push([g.lat, g.lon, g.h / R]); }
        const segs = [[]];                  // cortar donde cruza el antimeridiano
        pts.forEach((p) => { const s = segs[segs.length - 1]; if (s.length && Math.abs(p[1] - s[s.length - 1][1]) > 180) segs.push([]); segs[segs.length - 1].push(p); });
        globe.pathsData(segs.filter((s) => s.length > 1).map((s) => ({ pts: s })));
      }
    };
    raf = requestAnimationFrame(tick);

    document.getElementById("introGo").onclick = () => {
      zooming = true;
      el.classList.add("going");
      globe.controls().autoRotate = false;
      globe.pointOfView({ ...ES, altitude: 1.1 }, 1300);                         // gira hacia El Salvador
      // zoom rápido con la misma imagen de la Tierra ya cargada: cambiar a mosaicos satelitales aquí dejaba el planeta
      // negro (~80 mosaicos pedidos de golpe) y trababa la página mientras llegaban
      setTimeout(() => globe.pointOfView({ lat: 13.6, lng: -89.6, altitude: 0.3 }, 1000), 1350);
      setTimeout(finish, 2300);                                                   // fundido al mapa
    };
  })();
})();
