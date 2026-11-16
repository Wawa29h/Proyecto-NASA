// Textos en inglés de la vista 3D (respira.html). Se usan con page-lang.js.
(function () {
  const M = { ene: "Jan", feb: "Feb", mar: "Mar", abr: "Apr", may: "May", jun: "Jun", jul: "Jul", ago: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dic: "Dec" };
  const mon = (m) => M[m] || m;
  window.PAGE_LANG = {
    mount: ".hud.title .row",
    pairs: [
      ["Cargando…", "Loading…"],
      ["Sin pasadas publicadas en este periodo", "No passes published in this period"], ["radar NISAR", "NISAR radar"],
      ["El manglar respira", "The mangrove breathes"], ["El embalse sube y baja", "The reservoir rises and falls"],
      ["Bahía de Jiquilisco", "Jiquilisco Bay"], ["Embalse Cerrón Grande", "Cerrón Grande Reservoir"],
      ["← Volver al mapa", "← Back to the map"], ["Cambiar de sitio", "Change site"],
      ["Cada punto del terreno sube según la fuerza con que el radar NISAR rebota en él.", "Each point of the terrain rises according to how strongly the NISAR radar bounces off it."],
      ["Cada punto del terreno sube según la fuerza con que el radar NISAR rebota en él. El bosque denso y húmedo rebota fuerte; el agua y el suelo pelado, casi nada.", "Each point of the terrain rises according to how strongly the NISAR radar bounces off it. Dense, wet forest bounces back strongly; water and bare soil, almost nothing."],
      ["El manglar más grande del país visto por radar. Sube con la lluvia igual que en Barra. Alrededor, los estanques de camarón y sal se ven como piscinas hundidas.", "The country's largest mangrove seen by radar. It rises with the rain just like in Barra. Around it, shrimp and salt ponds look like sunken pools."],
      ["Representación visual 3D: el nivel de agua interpola observaciones validadas de SWOT (calidad filtrada <= 1). El relieve simula la intensidad de retrodispersión radar, no elevación topográfica del terreno.", "3D visual representation: the water level interpolates validated SWOT observations (quality filtered <= 1). The relief shows radar backscatter intensity, not the terrain's topographic elevation."],
      ["Qué mirar:", "What to look for:"],
      ["en diciembre y enero las parcelas de caña se hunden al cortarse y se encienden al quemarse. De julio en adelante todo el manglar se infla con la lluvia. El manglar nunca se hunde: está estable.", "in December and January the sugarcane fields sink when they are cut and light up when they burn. From July on, the whole mangrove swells with the rain. The mangrove never sinks: it is stable."],
      ["el bloque verde del manglar respira pero no se hunde. Cada aro naranja marca un estanque de camarón o sal (42 en total, 148 ha): huecos planos pegados al bosque; el aro es más grande cuanto más grande el estanque. En rojo, el manglar que había en 1996 y ya no está; en celeste, el que creció.", "the green block of mangrove breathes but does not sink. Each orange ring marks a shrimp or salt pond (42 in total, 148 ha): flat hollows right next to the forest; the bigger the pond, the bigger the ring. In red, mangroves that existed in 1996 and are gone; in light blue, the ones that grew."],
      ["variación del nivel del agua registrada por SWOT y zonas de plantas flotantes sobre el agua detectadas por radar. Las elevaciones visuales reflejan rugosidad y doble rebote del radar, no altimetría física.", "water level changes recorded by SWOT and floating plants on the water detected by radar. The visual heights reflect radar roughness and double bounce, not physical altimetry."],
      ["Color del terreno", "Terrain color"], ["Radar", "Radar"], ["Foto", "Photo"], ["Mapa ESA", "ESA map"],
      ["Vista", "View"], ["Relieve", "Relief"], ["Girar solo", "Auto-rotate"], ["🔇 Sonido", "🔇 Sound"], ["🔊 Sonido", "🔊 Sound"], ["Capa", "Layer"],
      ["🔥 Quemas", "🔥 Burns"], ["🦐 Estanques", "🦐 Ponds"], ["🌿 Lirio", "🌿 Water hyacinth"],
      ["Agua (estero, mar)", "Water (estuary, sea)"], ["Suelo pelado · caña cortada", "Bare soil · cut sugarcane"], ["Cultivo verde", "Green crops"], ["Manglar denso", "Dense mangrove"],
      ["Quema de caña (Sentinel-2)", "Sugarcane burn (Sentinel-2)"], ["Agua (bahía, canales)", "Water (bay, channels)"], ["Suelo pelado", "Bare soil"],
      ["Estanque de camarón o sal (aro naranja)", "Shrimp or salt pond (orange ring)"], ["Manglar perdido 1996→2020", "Mangrove lost 1996→2020"], ["Manglar nuevo 1996→2020", "New mangrove 1996→2020"],
      ["Agua del embalse", "Reservoir water"], ["Orilla que quedó seca", "Shore left dry"], ["Lirio flotante (radar)", "Floating water hyacinth (radar)"], ["Vegetación inundada", "Flooded vegetation"], ["Lomas y cultivos", "Hills and crops"],
      ["Gris: el radar no pasó ahí ese día; se muestra el promedio del año en ese punto (aproximado).", "Gray: the radar did not pass there that day; the year's average at that point is shown (approximate)."],
      ["pasada NISAR", "NISAR pass"], ["eco del radar (HV)", "radar echo (HV)"], ["eco del manglar (HV)", "mangrove echo (HV)"], ["eco del radar en la zona (HV)", "radar echo in the area (HV)"],
      ["entre dos pasadas (cada 12 días)", "between two passes (every 12 days)"], ["sin pasadas publicadas (feb–jun)", "no published passes (Feb–Jun)"],
      ["Época seca · zafra de caña", "Dry season · sugarcane harvest"], ["Época seca", "Dry season"], ["Lluvias", "Rainy season"],
    ],
    patterns: [
      [/^Cargando (.+)…$/, (m, s) => `Loading ${s === "Bahía de Jiquilisco" ? "Jiquilisco Bay" : s === "Embalse Cerrón Grande" ? "Cerrón Grande Reservoir" : s}…`],
      [/^(\d+)\/(\d+) pasadas$/, "$1/$2 passes"],
      [/^(\d+) fps · (\d+) mil vértices · (\d+)\/(\d+) pasadas en memoria$/, "$1 fps · $2 thousand vertices · $3/$4 passes in memory"],
      [/^pasada NISAR del (\d+) (\w+) (\d{4})$/, (m, d, mo, y) => `NISAR pass of ${d} ${mon(mo)} ${y}`],
      [/^(\d+) (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)( \d{4})?$/, (m, d, mo, y) => `${d} ${mon(mo)}${y || ""}`],
      [/^caña quemada · (\d+) ha a < 1 km del manglar$/, "sugarcane burned · $1 ha within 1 km of the mangroves"],
      [/^(\d+) estanques · (\d+) ha$/, "$1 ponds · $2 ha"],
      [/^(\d+) ha a < 1 km del manglar · perdido (\d+) ha, nuevo (\d+) ha \(1996→2020\)$/, "$1 ha within 1 km of the mangroves · lost $2 ha, new $3 ha (1996→2020)"],
      [/^nivel (-?[\d.]+) m$/, "level $1 m"],
      [/^(-?[\d.]+) m bajo el máximo \(SWOT\) · lirio ([\d.]+) km² · agua (\d+) km²$/, "$1 m below the maximum (SWOT) · water hyacinth $2 km² · water $3 km²"],
      [/^MANGLO · (.+) · (.+)$/, (m, t, s) => `MANGLO · ${t === "El manglar respira" ? "The mangrove breathes" : t === "El embalse sube y baja" ? "The reservoir rises and falls" : t} · ${s === "Bahía de Jiquilisco" ? "Jiquilisco Bay" : s === "Embalse Cerrón Grande" ? "Cerrón Grande Reservoir" : s}`],
    ],
  };
})();
