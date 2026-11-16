// MANGLO · "El manglar respira": relieve 3D animado con la señal HV del radar NISAR, para los tres sitios.
// Todo el trabajo pesado lo hace la GPU (vertex shader); el CPU solo cambia fechas.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const T0 = new Date("2025-11-01T00:00:00Z");            // día 0 (así se codificó el PNG de quemas)
const BURN_SPAN = 211;                                    // días entre 2025-11-01 y 2026-05-31
const DAY = 86400000;
const dayOf = (iso) => Math.round((new Date(iso + "T00:00:00Z") - T0) / DAY);
const isoOf = (d) => new Date(T0.getTime() + d * DAY).toISOString().slice(0, 10);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (iso) => { const [y, m, d] = iso.split("-"); return `${+d} ${MESES[+m - 1]} ${y}`; };
const $ = (id) => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;
// textos que cambian solos: se escriben ya traducidos (page-lang.js) y solo si cambiaron
const T = (x) => (window.PageLang ? window.PageLang.tr(x) : x);
const setT = (id, x) => { const e = $(id), v = T(x); if (e && e.textContent !== v) e.textContent = v; };

// ---------- sitios: cada uno con su capa propia ----------
const SITES = {
  barra: {
    name: "Barra de Santiago", title: "El manglar respira", lat: 13.72, base: "data/", layer: 1,
    photo: "ref/s2_2026-01-18.jpg", layerImg: "ref/burns_date.png", extra: "ref/burns.json", layerBtn: "🔥 Quemas",
    sub: "Cada punto del terreno sube según la fuerza con que el radar NISAR rebota en él. El bosque denso y húmedo rebota fuerte; el agua y el suelo pelado, casi nada.",
    hint: "<b>Qué mirar:</b> en diciembre y enero las parcelas de caña se hunden al cortarse y se encienden al quemarse. De julio en adelante todo el manglar se infla con la lluvia. El manglar nunca se hunde: está estable.",
    legend: [["#0b3d6b", "Agua (estero, mar)"], ["#c9a86a", "Suelo pelado · caña cortada"], ["#7bbf5a", "Cultivo verde"], ["#0f6b3a", "Manglar denso"], ["#ff5a1f", "Quema de caña (Sentinel-2)"]],
    dryLabel: "Época seca · zafra de caña",
  },
  jiquilisco: {
    name: "Bahía de Jiquilisco", title: "El manglar respira", lat: 13.25, base: "data-jiquilisco/", layer: 2,
    photo: null, layerImg: "ref/ponds.png", layerImg2: "ref/gmw_change.png", extra: "ref/ponds.json", extra2: "ref/gmw.json", layerBtn: "🦐 Estanques",
    sub: "El manglar más grande del país visto por radar. Sube con la lluvia igual que en Barra. Alrededor, los estanques de camarón y sal se ven como piscinas hundidas.",
    hint: "<b>Qué mirar:</b> el bloque verde del manglar respira pero no se hunde. Cada aro naranja marca un estanque de camarón o sal (42 en total, 148 ha): huecos planos pegados al bosque; el aro es más grande cuanto más grande el estanque. En rojo, el manglar que había en 1996 y ya no está; en celeste, el que creció.",
    legend: [["#0b3d6b", "Agua (bahía, canales)"], ["#c9a86a", "Suelo pelado"], ["#7bbf5a", "Cultivo verde"], ["#0f6b3a", "Manglar denso"], ["#f29a2e", "Estanque de camarón o sal (aro naranja)"], ["#e04545", "Manglar perdido 1996→2020"], ["#5aa0ff", "Manglar nuevo 1996→2020"]],
    dryLabel: "Época seca",
  },
  cerron: {
    name: "Embalse Cerrón Grande", title: "El embalse sube y baja", lat: 14.03, base: "data-cerron/", layer: 3,
    photo: "ref/s2_2026-01-08.jpg", extra: "swot.json", layerBtn: "🌿 Lirio",
    sub: "Representación visual 3D: el nivel de agua interpola observaciones validadas de SWOT (calidad filtrada <= 1). El relieve simula la intensidad de retrodispersión radar, no elevación topográfica del terreno.",
    hint: "<b>Qué mirar:</b> variación del nivel del agua registrada por SWOT y zonas de plantas flotantes sobre el agua detectadas por radar. Las elevaciones visuales reflejan rugosidad y doble rebote del radar, no altimetría física.",
    legend: [["#0b3d6b", "Agua del embalse"], ["#8c7355", "Orilla que quedó seca"], ["#5ae05a", "Lirio flotante (radar)"], ["#c64fb5", "Vegetación inundada"], ["#7bbf5a", "Lomas y cultivos"]],
    dryLabel: "Época seca",
  },
};
const siteId = new URLSearchParams(location.search).get("site") || "barra";
const SITE = SITES[siteId] || SITES.barra;
const BASE = SITE.base;
$("siteSel").value = SITE.name === SITES[siteId]?.name ? siteId : "barra";
$("siteSel").onchange = (e) => { location.search = "?site=" + e.target.value; };
// "Volver al mapa": regresa a la página anterior (el mapa, con su sitio y fecha); si se entró directo, abre el mapa de este sitio
$("backMap").href = "index.html?site=" + siteId;
$("backMap").onclick = (e) => { try { const r = new URL(document.referrer); if (r.origin === location.origin && /\/index\.html$|\/web\/?$/.test(r.pathname) && history.length > 1) { e.preventDefault(); history.back(); } } catch {} };
$("titleTxt").textContent = SITE.title; $("subTxt").textContent = SITE.sub; $("hintTxt").innerHTML = SITE.hint;
$("layerBtn").textContent = SITE.layerBtn;
$("legend").innerHTML = SITE.legend.map(([c, t]) => `<div><i class="sw" style="background:${c}"></i>${t}</div>`).join("");
$("loadTitle").textContent = `Cargando ${SITE.name}…`;
if (!SITE.photo) $("photoBtn").style.display = "none";
document.title = `MANGLO · ${SITE.title} · ${SITE.name}`;

// ---------- datos ----------
const fetchJ = (p) => fetch(BASE + p).then((r) => r.json());
const [series, extra, extra2] = await Promise.all([fetchJ("series.json"), SITE.extra ? fetchJ(SITE.extra) : null, SITE.extra2 ? fetchJ(SITE.extra2) : null]);
const dates = series.dates.filter((d) => d.qc && (d.coverage_pct == null || d.coverage_pct >= 50)); // solo pasadas buenas y completas
const D = dates.map((d) => dayOf(d.date));
const events = SITE.layer === 1 ? extra.events.map((e) => ({ ...e, day: dayOf(e.date) })).sort((a, b) => a.day - b.day) : [];
const swot = SITE.layer === 3 && extra?.observations ? extra.observations.filter((o) => o.quality <= 1).map((o) => ({ day: dayOf(o.date), m: o.wse_m })).sort((a, b) => a.day - b.day) : [];
const LEVEL_MIN = 232.7, LEVEL_MAX = 241.95;              // metros SWOT (mínimo en mayo, máximo en noviembre)
function levelAt(day) {
  if (!swot.length) return 0;
  if (day <= swot[0].day) return swot[0].m;
  for (let i = 1; i < swot.length; i++) if (day <= swot[i].day) return lerp(swot[i - 1].m, swot[i].m, (day - swot[i - 1].day) / (swot[i].day - swot[i - 1].day));
  return swot[swot.length - 1].m;
}
const [x0, y0, x1, y1] = series.bbox, step = series.step;
const W = Math.round((x1 - x0) / step), H = Math.round((y1 - y0) / step);   // píxeles de la malla (~20 m)
const PLANE_W = 11, PLANE_H = PLANE_W * (H / W) / Math.cos((SITE.lat * Math.PI) / 180);
const hvVals = dates.map((d) => d.hv_mean_db), HV_LO = Math.min(...hvVals) - 0.3, HV_HI = Math.max(...hvVals) + 0.3;

// ---------- escena ----------
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x0b1416);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1416, PLANE_W * 1.5, PLANE_W * 3.2);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
const CAM_DIR = SITE.layer === 3 ? new THREE.Vector3(0.25, 0.95, 0.6).normalize() : new THREE.Vector3(0.08, 0.62, 1.05).normalize();
function fitCamera() {
  // distancia mínima para que el recuadro entero quepa, tanto a lo ancho como a lo alto de la ventana
  const vt = Math.tan((camera.fov * Math.PI) / 360), ht = vt * camera.aspect;
  const depth = PLANE_H * (SITE.layer === 3 ? 1.3 : 0.95);   // la vista picada de Cerrón proyecta más fondo
  const d = Math.max(PLANE_W / (2 * ht), depth / (2 * vt)) * 1.08 + 1.0;
  camera.position.copy(CAM_DIR).multiplyScalar(d).add(new THREE.Vector3(0, 0.15, 0));
}
fitCamera();
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 3; controls.maxDistance = 40;
controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
controls.target.set(0, 0.15, 0);

const loader = new THREE.TextureLoader();
function tex(url, { mips = true, nearest = false } = {}) {
  return new Promise((ok, bad) => loader.load(url, (t) => {
    t.generateMipmaps = mips;
    t.minFilter = nearest ? THREE.NearestFilter : mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    ok(t);
  }, undefined, bad));
}

// Clases por fecha (cls.png): agua (30,136,229) · veg. inundada (216,27,196) · lirio (60,220,90) · mar (20,50,90, alfa baja)
const GLSL_COMMON = /* glsl */`
uniform sampler2D tA, tB, tClsA, tClsB, tCoverV, tLayer, tFill;
uniform float uMix, uZ, uLod, uLevel, uBase, uFillOn; uniform int uLayer, uWaterMode;
float hv(sampler2D t, vec2 uv){ vec4 c = textureLod(t, uv, uLod); return c.a < 0.03 ? -40.0 : -32.0 + (c.g / c.a) * 24.0; }
// sin pasada ese día (borde de la órbita): promedio del año en ese punto, marcado como aproximado
bool noData(vec2 uv){ return hv(tA, uv) < -39.0 && hv(tB, uv) < -39.0; }
float hvMix(vec2 uv){ float a = hv(tA, uv), b = hv(tB, uv); if (a < -39.0 && b < -39.0) return uFillOn > 0.5 ? hv(tFill, uv) : -40.0; if (a < -39.0) return b; if (b < -39.0) return a; return mix(a, b, uMix); }
float height(float h){ float n = clamp((h + 30.0) / 18.0, 0.0, 1.0); return pow(n, 1.6) * smoothstep(-27.0, -22.5, h); }
vec3 clsOf(vec4 c){
  if (c.a < 0.15) return vec3(0.0);
  float water = (c.b > 0.7 && c.r < 0.3) ? 1.0 : 0.0;
  float ocean = (c.a < 0.5) ? 1.0 : 0.0;
  float lily  = (c.g > 0.7 && c.r < 0.4) ? 1.0 : 0.0;
  float flood = (c.r > 0.7 && c.b > 0.6) ? 1.0 : 0.0;
  return vec3(max(water, ocean), lily, flood);
}
vec3 clsMix(vec2 uv){ return mix(clsOf(texture(tClsA, uv)), clsOf(texture(tClsB, uv)), uMix); }
float coverWater(vec2 uv){ return (abs(texture(tCoverV, uv).r * 255.0 - 80.0) < 0.5) ? 1.0 : 0.0; }
bool isPond(vec2 uv){ vec4 p = texture(tLayer, uv); return p.a > 0.5 && p.r > 0.9 && p.g < 0.75; }
// altura del terreno en unidades de escena
float hAt(vec2 uv){
  float h = hvMix(uv);
  if (uLayer == 3) {                                   // embalse: agua plana al nivel SWOT, lirio flotando, orilla seca como lodo
    vec3 c = clsMix(uv);
    float lake = coverWater(uv);                       // huella del embalse (mapa ESA)
    float land = uBase + height(h) * uZ * 0.45;
    float dry = 1.0 - max(c.x, max(c.y, c.z));
    float inLake = uLevel + c.y * 0.15 + c.z * 0.06 + dry * 0.03;
    return mix(land, inLake, lake);
  }
  float water = (uWaterMode == 1) ? clsMix(uv).x : coverWater(uv);
  float z = height(h) * uZ * (1.0 - water);
  if (uLayer == 2 && isPond(uv)) z = -0.05;            // estanque: hundido
  return z;
}`;

const VERT = GLSL_COMMON + /* glsl */`
uniform vec2 uEps, uPlane;
out vec2 vUv; out vec3 vN; out float vHv; out float vW; out vec3 vCls; out float vLake; out float vFill;
void main(){
  vUv = uv;
  vFill = (uFillOn > 0.5 && noData(uv)) ? 1.0 : 0.0;
  float h = hvMix(uv); vHv = h; vW = h < -39.0 ? 0.0 : 1.0;
  vCls = (uLayer == 3 || uWaterMode == 1) ? clsMix(uv) : vec3(0.0);
  vLake = (uLayer == 3) ? coverWater(uv) : 0.0;
  float z = hAt(uv);
  float zx = hAt(uv + vec2(uEps.x, 0.0)) - hAt(uv - vec2(uEps.x, 0.0));
  float zy = hAt(uv + vec2(0.0, uEps.y)) - hAt(uv - vec2(0.0, uEps.y));
  vec3 n = normalize(vec3(-zx / (2.0 * uEps.x * uPlane.x), -zy / (2.0 * uEps.y * uPlane.y), 1.0));
  vN = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, z, 1.0);
}`;

const FRAG = /* glsl */`
uniform sampler2D tCover, tPhoto, tLayerF, tLayer2; uniform int uMode, uLayerF; uniform float uDay, uLayerOn; uniform vec3 uSun;
in vec2 vUv; in vec3 vN; in float vHv; in float vW; in vec3 vCls; in float vLake; in float vFill;
out vec4 fragColor;
vec3 ramp(float h){
  vec3 water = vec3(0.043, 0.239, 0.42), soil = vec3(0.788, 0.659, 0.416), crop = vec3(0.482, 0.749, 0.353), mang = vec3(0.059, 0.42, 0.227);
  vec3 c = mix(water, soil, smoothstep(-25.0, -20.5, h));
  c = mix(c, crop, smoothstep(-20.5, -16.5, h));
  c = mix(c, mang, smoothstep(-16.5, -12.0, h));
  return c;
}
vec3 coverColor(float code){
  if (code > 94.0) return vec3(0.0, 0.81, 0.46);      // manglar
  if (code > 89.0) return vec3(0.0, 0.59, 0.63);      // humedal
  if (code > 79.0) return vec3(0.0, 0.39, 0.78);      // agua
  if (code > 59.0) return vec3(0.71, 0.71, 0.71);     // suelo
  if (code > 49.0) return vec3(0.98, 0.0, 0.0);       // construido
  if (code > 39.0) return vec3(0.94, 0.59, 1.0);      // cultivo
  if (code > 29.0) return vec3(1.0, 1.0, 0.3);        // pasto
  if (code > 19.0) return vec3(1.0, 0.73, 0.13);      // matorral
  return vec3(0.0, 0.39, 0.0);                        // bosque
}
void main(){
  if (vW < 0.5) discard;
  vec3 base;
  float code = texture(tCover, vUv).r * 255.0;
  if (uMode == 1) base = texture(tPhoto, vUv).rgb;
  else if (uMode == 2) base = coverColor(code) * 0.85;
  else base = ramp(vHv);
  vec3 deep = vec3(0.09, 0.36, 0.6);
  if (uLayerF == 3) {                                  // embalse: colores por clase del día
    if (uMode != 1) {
      if (vLake > 0.5) base = mix(vec3(0.72, 0.58, 0.4), deep, vCls.x);           // lodo seco → agua
      base = mix(base, deep, vCls.x * 0.9);
    }
    if (uLayerOn > 0.5) {
      base = mix(base, vec3(0.45, 0.95, 0.35), vCls.y);                            // lirio
      base = mix(base, vec3(0.78, 0.31, 0.71), vCls.z * 0.8);                      // vegetación inundada
    }
  } else if (uMode != 1 && abs(code - 80.0) < 0.5) base = deep;
  if (uLayerF == 1 && uLayerOn > 0.5) {                // quemas: fecha guardada en el color (G = 220 - 200*k, k = día/211)
    vec4 b = texture(tLayerF, vUv);
    if (b.a > 0.3) {
      float k = clamp((220.0 - b.g * 255.0) / 200.0, 0.0, 1.0);
      float burnDay = k * ${BURN_SPAN.toFixed(1)};
      float on = smoothstep(burnDay - 2.0, burnDay + 2.0, uDay);
      float fresh = exp(-max(uDay - burnDay, 0.0) / 45.0);
      vec3 hot = vec3(1.0, 0.35, 0.12), ash = vec3(0.36, 0.23, 0.17);
      base = mix(base, mix(ash, hot, fresh), on * 0.9);
      base += hot * on * fresh * 0.6;
    }
  }
  if (uLayerF == 2 && uLayerOn > 0.5) {                // estanques y cambio del manglar 1996→2020
    vec4 g = texture(tLayer2, vUv);
    if (g.a > 0.6 && g.r > 0.9 && g.g < 0.4) base = mix(base, vec3(0.88, 0.27, 0.27), 0.75);   // perdido
    if (g.a > 0.6 && g.b > 0.9 && g.r < 0.4) base = mix(base, vec3(0.35, 0.63, 1.0), 0.6);    // nuevo
    vec4 p = texture(tLayerF, vUv);
    if (p.a > 0.5 && p.r > 0.9 && p.g < 0.75) base = vec3(0.95, 0.6, 0.18);                  // estanque
    if (p.a > 0.9 && p.g > 0.9) base = vec3(1.0, 0.94, 0.78);                                // borde del estanque
  }
  float diff = max(dot(normalize(vN), normalize(uSun)), 0.0);
  float hemi = 0.55 + 0.45 * normalize(vN).z;
  vec3 col = (uMode == 1) ? base * (0.65 + 0.6 * diff) : base * (0.3 * hemi + 0.95 * diff);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), 0.6 * vFill) * (1.0 - 0.15 * vFill);   // aproximado: más gris
  fragColor = vec4(col, 1.0);
}`;

const uniforms = {
  tA: { value: null }, tB: { value: null }, tClsA: { value: null }, tClsB: { value: null },
  uMix: { value: 0 }, uZ: { value: 0.55 }, uLod: { value: SITE.layer === 3 ? 3.2 : 2.6 }, uLevel: { value: 0.3 }, uBase: { value: 0.42 },
  uLayer: { value: SITE.layer }, uLayerF: { value: SITE.layer }, uWaterMode: { value: SITE.layer === 3 ? 1 : 0 },
  tCover: { value: null }, tCoverV: { value: null }, tPhoto: { value: null }, tLayer: { value: null }, tLayerF: { value: null }, tLayer2: { value: null },
  uMode: { value: 0 }, uDay: { value: 0 }, uLayerOn: { value: 1 }, uSun: { value: new THREE.Vector3(-0.5, 0.6, 0.8).normalize() },
  tFill: { value: null }, uFillOn: { value: 0 },
  uEps: { value: new THREE.Vector2(1.5 / W, 1.5 / H) }, uPlane: { value: new THREE.Vector2(PLANE_W, PLANE_H) },
};
const SX = 440, SY = Math.max(60, Math.round((SX * PLANE_H) / PLANE_W));
const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, SX, SY);
const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 });
const mesh = new THREE.Mesh(geo, mat);
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);
// base oscura debajo (para que el borde recortado no "flote")
const slab = new THREE.Mesh(new THREE.BoxGeometry(PLANE_W + 0.4, 0.25, PLANE_H + 0.4), new THREE.MeshBasicMaterial({ color: 0x0e1b1f }));
slab.position.y = -0.2; scene.add(slab);

// ---------- marcadores de estanques (Jiquilisco): son pequeños frente a la bahía, así se ven ----------
const markers = [];
if (SITE.layer === 2 && extra?.ponds) {
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xffa83c, transparent: true, opacity: 0.95 });
  const pin = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), pinMat, extra.ponds.length);
  const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.1, 6, 28), pinMat, extra.ponds.length);
  const o = new THREE.Object3D();
  extra.ponds.forEach((pd, i) => {
    const ux = (pd.lon - x0) / (x1 - x0), uy = (pd.lat - y0) / (y1 - y0);
    const px = (ux - 0.5) * PLANE_W, pz = (0.5 - uy) * PLANE_H;
    const r = Math.max(0.07, Math.sqrt(pd.ha) * 0.035), hgt = 0.45 + r;
    o.position.set(px, hgt / 2, pz); o.rotation.set(0, 0, 0); o.scale.set(1, hgt, 1); o.updateMatrix(); pin.setMatrixAt(i, o.matrix);
    o.position.set(px, hgt, pz); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.set(r, r, r); o.updateMatrix(); ring.setMatrixAt(i, o.matrix);
  });
  scene.add(pin, ring); markers.push(pin, ring);
}

// ---------- carga: primero lo mínimo, el resto en segundo plano ----------
const radar = new Array(dates.length).fill(null), cls = new Array(dates.length).fill(null);
const loadTxt = $("loadTxt");
const rel = (p) => BASE + p.replace(/^data[^/]*\//, "");
const needCls = SITE.layer === 3;
const loadDate = async (i) => { const [r, c] = await Promise.all([tex(rel(dates[i].rgb)), needCls ? tex(rel(dates[i].cls), { mips: false }) : null]); radar[i] = r; cls[i] = c; };
const [, , cover, photo, layerT, layer2T] = await Promise.all([
  loadDate(0), loadDate(1),
  tex(BASE + "ref/worldcover_codes.png", { mips: false, nearest: true }),
  SITE.photo ? tex(BASE + SITE.photo) : null,
  SITE.layerImg ? tex(BASE + SITE.layerImg, { mips: false }) : null,
  SITE.layerImg2 ? tex(BASE + SITE.layerImg2, { mips: false }) : null,
]);
uniforms.tCover.value = cover; uniforms.tCoverV.value = cover; uniforms.tPhoto.value = photo || cover;
uniforms.tLayer.value = layerT || cover; uniforms.tLayerF.value = layerT || cover; uniforms.tLayer2.value = layer2T || cover;
$("load").classList.add("off");
let loaded = 2;
uniforms.tFill.value = cover;   // provisional hasta que esté el promedio
(async () => {
  const img = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = u; });
  const ims = (await Promise.all(dates.map((d) => img(rel(d.rgb))))).filter(Boolean);
  if (!ims.length) return;
  const w = ims[0].naturalWidth, h = ims[0].naturalHeight, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const sum = new Float32Array(w * h), n = new Uint16Array(w * h);
  for (const im of ims) {
    ctx.clearRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < n.length; i++) if (px[i * 4 + 3] > 8) { sum[i] += (px[i * 4 + 1] * 255) / px[i * 4 + 3]; n[i]++; }
  }
  const out = ctx.createImageData(w, h);
  let any = 0;
  for (let i = 0; i < n.length; i++) if (n[i]) { out.data[i * 4 + 1] = Math.round(sum[i] / n[i]); out.data[i * 4 + 3] = 255; any++; }
  if (!any) return;
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.premultiplyAlpha = false;
  uniforms.tFill.value = t; uniforms.uFillOn.value = 1;
  const partial = dates.some((d) => (d.coverage_real_pct ?? d.coverage_pct ?? 100) + (d.time_filled_pct || 0) < 98);
  if (partial) {
    const note = document.createElement("div");
    note.className = "fill-note";
    note.innerHTML = '<i class="sw" style="background:#8a8f8c"></i>Gris: el radar no pasó ahí ese día; se muestra el promedio del año en ese punto (aproximado).';
    $("legend").appendChild(note);
  }
})();
(async () => {
  for (let i = 2; i < dates.length; i++) { await loadDate(i); loaded++; loadTxt.textContent = T(`${loaded}/${dates.length} pasadas`); }
})();

// ---------- línea de tiempo ----------
// Avanza en días reales; cada salto entre pasadas dura entre 1.6 y 3 s (los huecos grandes no se alargan).
const seg = [];
for (let i = 0; i < D.length - 1; i++) {
  const gap = D[i + 1] - D[i];
  const dur = Math.min(3.0, Math.max(1.6, gap / 7.5));
  seg.push({ i, from: D[i], to: D[i + 1], gap, speed: gap / dur });
}
const DAY0 = D[0], DAY1 = D[D.length - 1];
let day = DAY0, playing = false, lastT = performance.now(), eventIdx = 0;
const totalDays = DAY1 - DAY0;

// marcas de la barra
const ticks = $("ticks");
let lastLabelX = -100;
D.forEach((d, i) => {
  const x = ((d - DAY0) / totalDays) * 100;
  const t = document.createElement("i"); t.style.left = x + "%"; ticks.appendChild(t);
  const afterGap = i > 0 && D[i] - D[i - 1] > 30;
  const last = i === D.length - 1;
  if ((i === 0 || last || afterGap) && (x - lastLabelX >= 9 || last)) {
    if (last && x - lastLabelX < 9) ticks.querySelector("span:last-of-type")?.remove();   // gana la última fecha
    const s = document.createElement("span"); s.style.left = x + "%"; s.style.top = "6px"; s.dataset.es = fmt(dates[i].date).slice(0, -5); s.textContent = T(s.dataset.es); ticks.appendChild(s);
    lastLabelX = x;
  }
});
seg.filter((s) => s.gap > 30).forEach((s) => {
  const g = document.createElement("div"); g.className = "gap";
  g.style.left = ((s.from - DAY0) / totalDays) * 100 + "%"; g.style.width = (s.gap / totalDays) * 100 + "%";
  g.title = "Sin pasadas publicadas en este periodo"; ticks.appendChild(g);
});

function segAt(d) {
  for (const s of seg) if (d <= s.to) return s;
  return seg[seg.length - 1];
}
const ease = (t) => { t = Math.min(1, Math.max(0, (t - 0.3) / 0.65)); return t * t * (3 - 2 * t); }; // se queda quieto un poco y luego cambia

// al cambiar de idioma (botones ES / EN): marcas de la línea de tiempo y textos del momento, aunque esté en pausa
window.addEventListener("manglo:language", () => {
  document.querySelectorAll("#ticks span[data-es]").forEach((x) => { x.textContent = T(x.dataset.es); });
  $("soundBtn").textContent = T(soundOn ? "🔊 Sonido" : "🔇 Sonido");
  apply();
});
function apply() {
  const s = segAt(day);
  const f = (day - s.from) / s.gap;
  const ia = radar[s.i] ? s.i : loaded - 1, ib = radar[s.i + 1] ? s.i + 1 : ia;
  uniforms.tA.value = radar[ia]; uniforms.tB.value = radar[ib];
  uniforms.tClsA.value = cls[ia] || cover; uniforms.tClsB.value = cls[ib] || cover;
  uniforms.uMix.value = ib === ia ? 0 : ease(f);
  uniforms.uDay.value = day;
  // texto
  const iso = isoOf(Math.round(day));
  setT("dateTxt", fmt(iso));
  const near = f < 0.5 ? dates[s.i] : dates[s.i + 1];
  const dd = Math.abs(day - (f < 0.5 ? s.from : s.to));
  setT("passTxt", dd < 1 ? `pasada NISAR del ${fmt(near.date)}` : s.gap > 30 ? "sin pasadas publicadas (feb–jun)" : `entre dos pasadas (cada 12 días)`);
  const m = +iso.slice(5, 7);
  const dry = m >= 11 || m <= 4;
  const se = $("season"); { const v = T(dry ? SITE.dryLabel : "Lluvias"); if (se.textContent !== v) se.textContent = v; } se.className = "chip" + (dry ? " dry" : "");
  const hv = lerp(dates[s.i].hv_mean_db, dates[s.i + 1].hv_mean_db, ease(f));
  setT("hvTxt", hv.toFixed(1) + " dB");
  setT("hvSub", SITE.layer === 3 ? "eco del radar en la zona (HV)" : "eco del manglar (HV)");
  $("breath").style.width = (((hv - HV_LO) / (HV_HI - HV_LO)) * 100).toFixed(0) + "%";
  if (SITE.layer === 1) {
    let ha = 0, near1 = 0;
    for (const e of events) { if (e.day > day) break; ha += e.ha; if (e.km_to_mangrove <= 1) near1 += e.ha; }
    setT("stat2Val", Math.round(ha) + " ha");
    setT("stat2Sub", `caña quemada · ${Math.round(near1)} ha a < 1 km del manglar`);
  } else if (SITE.layer === 2) {
    setT("stat2Val", `${extra.count} estanques · ${Math.round(extra.area_ha)} ha`);
    setT("stat2Sub", `${Math.round(extra.near_mangrove_ha)} ha a < 1 km del manglar · perdido ${Math.round(extra2.loss_km2 * 100)} ha, nuevo ${Math.round(extra2.gain_km2 * 100)} ha (1996→2020)`);
  } else {
    const lvl = levelAt(day);
    uniforms.uLevel.value = 0.06 + ((lvl - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)) * 0.33;
    const lily = lerp(dates[s.i].floatveg_km2 || 0, dates[s.i + 1].floatveg_km2 || 0, ease(f));
    const wat = lerp(dates[s.i].water_km2 || 0, dates[s.i + 1].water_km2 || 0, ease(f));
    setT("stat2Val", `nivel ${lvl.toFixed(1)} m`);
    setT("stat2Sub", `${(lvl - LEVEL_MAX).toFixed(1)} m bajo el máximo (SWOT) · lirio ${lily.toFixed(1)} km² · agua ${Math.round(wat)} km²`);
  }
  $("time").value = Math.round(((day - DAY0) / totalDays) * 1000);
}

// ---------- sonido (opcional): el sitio "respira" grave; en Barra cada quema es un golpe seco ----------
let actx = null, osc = null, oscGain = null, soundOn = false;
function soundInit() {
  actx = new (window.AudioContext || window.webkitAudioContext)();
  osc = actx.createOscillator(); osc.type = "sine";
  const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400;
  oscGain = actx.createGain(); oscGain.gain.value = 0;
  osc.connect(lp).connect(oscGain).connect(actx.destination); osc.start();
}
function soundBreath(hv) {
  if (!soundOn) return;
  const f = 70 + ((hv - HV_LO) / (HV_HI - HV_LO)) * 110;              // grave en seca, más agudo en lluvias
  osc.frequency.setTargetAtTime(Math.max(50, f), actx.currentTime, 0.4);
  oscGain.gain.setTargetAtTime(playing ? 0.08 : 0, actx.currentTime, 0.3);
}
function soundHit(ha) {
  if (!soundOn || !playing) return;
  const n = actx.createBufferSource(), len = Math.floor(actx.sampleRate * 0.12);
  const buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  n.buffer = buf;
  const bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 220 + Math.random() * 120; bp.Q.value = 1.2;
  const g = actx.createGain(); g.gain.value = Math.min(0.5, 0.08 + ha / 60);
  n.connect(bp).connect(g).connect(actx.destination); n.start();
}

// ---------- controles ----------
const playBtn = $("play");
function setPlaying(p) {
  playing = p; playBtn.textContent = p ? "❚❚" : "▶"; lastT = performance.now();
  if (p && day >= DAY1 - 0.01) { day = DAY0; eventIdx = 0; }
  if (soundOn) soundBreath(HV_LO);
}
playBtn.onclick = () => setPlaying(!playing);
$("time").oninput = (e) => { setPlaying(false); day = DAY0 + (e.target.value / 1000) * totalDays; eventIdx = events.findIndex((ev) => ev.day > day); if (eventIdx < 0) eventIdx = events.length; apply(); };
$("zRange").oninput = (e) => { uniforms.uZ.value = 0.55 * +e.target.value; setT("zVal", "×" + (+e.target.value).toFixed(1)); };
$("modeSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; uniforms.uMode.value = +b.dataset.m; [...e.currentTarget.children].forEach((x) => x.classList.toggle("on", x === b)); $("legend").style.display = b.dataset.m === "0" ? "" : "none"; };
$("orbitBtn").onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.target.classList.toggle("on", controls.autoRotate); };
$("layerBtn").onclick = (e) => { uniforms.uLayerOn.value = uniforms.uLayerOn.value ? 0 : 1; e.target.classList.toggle("on", !!uniforms.uLayerOn.value); markers.forEach((m) => { m.visible = !!uniforms.uLayerOn.value; }); };
$("soundBtn").onclick = (e) => { if (!actx) soundInit(); if (actx.state === "suspended") actx.resume(); soundOn = !soundOn; e.target.textContent = T(soundOn ? "🔊 Sonido" : "🔇 Sonido"); e.target.classList.toggle("on", soundOn); if (!soundOn && oscGain) oscGain.gain.setTargetAtTime(0, actx.currentTime, 0.1); };
canvas.addEventListener("pointerdown", () => { controls.autoRotate = false; $("orbitBtn").classList.remove("on"); }, { once: true });
addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); setPlaying(!playing); } });
let userMoved = false;
canvas.addEventListener("pointerdown", () => { userMoved = true; }, { once: true });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (!userMoved) fitCamera(); });

// ---------- bucle ----------
let frames = 0, fpsT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (playing) {
    const s = segAt(day);
    if (s.i + 1 < loaded) {
      day += dt * s.speed;
      while (eventIdx < events.length && events[eventIdx].day <= day) { soundHit(events[eventIdx].ha); eventIdx++; }
      if (day >= DAY1) { day = DAY1; setPlaying(false); }
    } // si la pasada siguiente aún no se descargó, se espera en esta
    if (soundOn) soundBreath(lerp(dates[s.i].hv_mean_db, dates[Math.min(s.i + 1, dates.length - 1)].hv_mean_db, (day - s.from) / s.gap));
  }
  apply();
  controls.update();
  renderer.render(scene, camera);
  frames++;
  if (now - fpsT > 1000) { setT("perf", `${frames} fps · ${(geo.attributes.position.count / 1000).toFixed(0)} mil vértices · ${loaded}/${dates.length} pasadas en memoria`); frames = 0; fpsT = now; }
}
window.MANGLO = { renderer, scene, camera, uniforms, controls, site: siteId, setDay: (d) => { day = d; apply(); } }; // para depurar desde la consola
apply();
requestAnimationFrame(loop);
setTimeout(() => setPlaying(true), 800);
