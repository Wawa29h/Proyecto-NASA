// Modelo 3D de NISAR (tamaño muy exagerado para que se vea) + haz del radar, compartido por la intro y la órbita.
// Partes reales: cuerpo con paneles solares, brazo de ~9 m y antena reflectora dorada de 12 m que apunta
// de lado (a la izquierda) hacia la franja que escanea.
(function () {
  const R = 6371;                 // km
  const SWATH = [430, 680];       // km a la izquierda de la vertical (aprox.)

  function build(T3, scene) {
    const gold = new T3.MeshStandardMaterial({ color: 0xd9a531, metalness: 0.85, roughness: 0.28, side: T3.DoubleSide, emissive: 0x3a2500 });
    const white = new T3.MeshStandardMaterial({ color: 0xe8eef0, metalness: 0.3, roughness: 0.5 });
    const panelM = new T3.MeshStandardMaterial({ color: 0x1b3d8f, metalness: 0.5, roughness: 0.35, emissive: 0x06163a });
    const grey = new T3.MeshStandardMaterial({ color: 0x9aa5ad, metalness: 0.7, roughness: 0.4 });
    const sat = new T3.Group();
    sat.add(new T3.Mesh(new T3.BoxGeometry(1.0, 1.0, 1.4), white));
    [-1, 1].forEach((s) => {                                    // dos alas de paneles solares
      const wing = new T3.Mesh(new T3.BoxGeometry(0.06, 0.9, 3.2), panelM);
      wing.position.set(0, 0, s * 2.4); sat.add(wing);
      const grid = new T3.Mesh(new T3.BoxGeometry(0.065, 0.9, 3.2), new T3.MeshBasicMaterial({ color: 0x7fa8ff, wireframe: true, transparent: true, opacity: 0.35 }));
      grid.position.copy(wing.position); sat.add(grid);
    });
    const boomPivot = new T3.Group();                           // brazo y antena: abajo y a la izquierda (z+)
    boomPivot.rotation.x = -0.75;
    const boom = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.06, 3.2, 8), grey); boom.position.y = -1.9; boomPivot.add(boom);
    const dish = new T3.Mesh(new T3.SphereGeometry(2.6, 40, 12, 0, Math.PI * 2, 0, 0.55), gold);
    dish.position.y = -3.6; dish.rotation.x = Math.PI; boomPivot.add(dish);
    const net = new T3.Mesh(new T3.SphereGeometry(2.61, 24, 6, 0, Math.PI * 2, 0, 0.55), new T3.MeshBasicMaterial({ color: 0xffe08a, wireframe: true, transparent: true, opacity: 0.25 }));
    net.position.copy(dish.position); net.rotation.copy(dish.rotation); boomPivot.add(net);
    sat.add(boomPivot);
    const light = new T3.PointLight(0xffffff, 1.2, 40); light.position.set(3, 3, 0); sat.add(light);
    scene.add(sat);
    const beam = new T3.Mesh(new T3.ConeGeometry(1, 1, 32, 1, true),
      new T3.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.18, side: T3.DoubleSide, depthWrite: false }));
    scene.add(beam);
    const glow = new T3.Mesh(new T3.CircleGeometry(1, 40),
      new T3.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.45, side: T3.DoubleSide, depthWrite: false }));
    scene.add(glow);
    return { T3, sat, beam, glow, boomPivot };
  }

  function groundLeft(fr, km) {                                 // punto en el suelo a 'km' a la izquierda de la vertical
    const brg = ((fr.heading - 90) * Math.PI) / 180, lat1 = (fr.lat * Math.PI) / 180, lon1 = (fr.lon * Math.PI) / 180, d = km / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
    const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return [(lat2 * 180) / Math.PI, ((((lon2 * 180) / Math.PI) + 540) % 360) - 180];
  }

  // fr y nx: {lat, lon, h (km), heading (°)} ahora y 2 s después
  function place(o, globe, fr, nx, scale = 1) {
    const T3 = o.T3, V = (p) => new T3.Vector3(p.x, p.y, p.z);
    const S = V(globe.getCoords(fr.lat, fr.lon, fr.h / R)), N2 = V(globe.getCoords(nx.lat, nx.lon, nx.h / R));
    const up = S.clone().normalize();
    const fwd = N2.clone().sub(S); fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
    const left = new T3.Vector3().crossVectors(up, fwd).normalize();
    o.sat.position.copy(S);
    o.sat.quaternion.setFromRotationMatrix(new T3.Matrix4().makeBasis(fwd, up, left));   // x adelante, y arriba, z izquierda
    o.sat.scale.setScalar(scale);
    o.boomPivot.rotation.set(-0.75, 0, 0);
    const [glat, glon] = groundLeft(fr, (SWATH[0] + SWATH[1]) / 2);
    const G = V(globe.getCoords(glat, glon, 0.002));
    const dir = S.clone().sub(G), len = dir.length();
    o.beam.position.copy(G.clone().add(dir.clone().multiplyScalar(0.5)));
    o.beam.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), dir.clone().normalize());
    const halfW = ((SWATH[1] - SWATH[0]) / 2 / R) * 100;           // radio del haz en el suelo (unidades del globo)
    o.beam.scale.set(halfW, len, halfW * 0.35);
    o.glow.position.copy(G); o.glow.lookAt(G.clone().add(G.clone().normalize()));
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 180);
    o.glow.scale.set(halfW * pulse, halfW * 0.4 * pulse, 1);
    o.glow.material.opacity = 0.25 + 0.25 * pulse;
  }

  // El Salvador resaltado: imágenes satelitales de alta resolución al acercarse (tiles de Esri World Imagery)
  // y el contorno del país brillando (geoBoundaries).
  async function highlightES(globe, opts = {}) {
    if (opts.tiles !== false && typeof globe.globeTileEngineUrl === "function")
      globe.globeTileEngineUrl((x, y, l) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`);
    try {
      const es = await fetch(opts.url || "data/el_salvador.geojson").then((r) => r.json());
      // globe.gl (d3-geo) quiere el borde exterior en sentido horario. El archivo viene al revés (antihorario, estándar
      // GeoJSON) y entonces el "país" era TODO el planeta menos El Salvador: una capa casi pegada al suelo que dejaba
      // manchas azules en todo el globo. Se invierten los anillos que vengan antihorarios.
      const area = (ring) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + (q[0] - p[0]) * (q[1] + p[1]); }, 0);
      const fix = (poly) => poly.map((ring, i) => ((area(ring) < 0) === (i === 0) ? ring.slice().reverse() : ring));
      es.features.forEach((f) => {
        const g = f.geometry; if (!g) return;
        if (g.type === "Polygon") g.coordinates = fix(g.coordinates);
        else if (g.type === "MultiPolygon") g.coordinates = g.coordinates.map(fix);
      });
      globe.polygonsData(es.features)
        .polygonCapColor(() => "rgba(20,155,165,0.15)")
        .polygonSideColor(() => "rgba(20,155,165,0.20)")
        .polygonStrokeColor(() => "#149BA5")
        .polygonAltitude(opts.altitude ?? 0.0005)   // ~3 km: casi pegado al suelo, sin "pared" al acercarse
        .polygonsTransitionDuration(0);
    } catch { /* sin contorno */ }
  }

  window.NISAR3D = { build, place, groundLeft, highlightES, R, SWATH };
})();
