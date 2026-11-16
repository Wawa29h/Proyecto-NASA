// Idioma del globo: usa el mismo que se eligió en la app (language.js guarda "manglo-language").
// Aquí van los textos fijos de orbita.html; los que cambian solos (hora, pasadas, pin) los traduce orbita.js.
(function () {
  let lang = "en";
  lang = (() => { try { const s = localStorage.getItem("manglo-language"); if (s === "es" || s === "en") return s; } catch {} return "en"; /* siempre empieza en inglés; Español queda guardado si se elige */ })();
  const $ = (q) => document.querySelector(q);

  // botones Español / English en la barra (cambian el idioma de todo MANGLO)
  const brand = $(".brand");
  if (brand) {
    const sw = document.createElement("div");
    sw.className = "lang-sw"; sw.setAttribute("role", "group"); sw.setAttribute("translate", "no");
    sw.innerHTML = '<button type="button" data-l="es" lang="es">ES</button><button type="button" data-l="en" lang="en">EN</button>';
    sw.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.l === lang));
      b.onclick = () => { if (b.dataset.l === lang) return; try { localStorage.setItem("manglo-language", b.dataset.l); } catch {} location.reload(); };
    });
    brand.appendChild(sw);
  }
  if (lang !== "en") return;
  document.documentElement.lang = "en";
  document.title = "MANGLO · Where is NISAR?";

  const html = {
    "#load b": "Looking for NISAR…",
    "#loadTxt": "loading the Earth and the orbit",
    ".brand b": '<small translate="no">MANGLO</small><span translate="no">NISAR</span> live',
    ".brand a": "← back to the map",
    "#pinTip": "📍 Tap any point on the planet and I'll tell you the exact day and time NISAR will see it.",
    "#passDrawer h3": 'Next pass over each site <button data-close="passDrawer" aria-label="Close">✕</button>',
    "#passes": '<div class="sub">calculating…</div>',
    "#realDrawer h3": 'How do I know the pass is real? <button data-close="realDrawer" aria-label="Close">✕</button>',
    "#realDrawer .real-lead": "The time of each pass is not made up: it comes from <b>NISAR's official orbit</b> and we check it against the <b>images the satellite has already taken</b>.",
    "#realDrawer .real-step:nth-of-type(1) div": "<b>The orbit is public.</b> The U.S. Space Force tracks every satellite and publishes its orbit (called a TLE) on CelesTrak. NISAR is satellite number <b>65053</b>. With those numbers and the same calculation satellite trackers use (SGP4) we know where it is second by second.",
    "#realDrawer .real-step:nth-of-type(2) div": "<b>Every image carries its time.</b> The NISAR images MANGLO uses come from NASA with the exact time they were taken, written in their name. We ask the globe: what time did NISAR pass over the site that day?",
    "#realDrawer .real-step:nth-of-type(3) div": "<b>We compare.</b> This table is calculated live in your browser:",
    "#realTable": '<div class="sub">calculating…</div>',
    "#realDrawer details:nth-of-type(1)": "<summary>Why does the error grow going back in time?</summary><p>The orbit we use is this week's. NISAR fires its engines from time to time to correct its path, so the further into the past, the more the calculation drifts. That is why predictions for the <b>coming days</b> (the pin's) are the most accurate.</p>",
    "#realDrawer details:nth-of-type(2)": "<summary>What does this NOT guarantee?</summary><p>It guarantees <b>when it passes</b> and <b>which side it looks at</b>. It does not guarantee that NASA turned the radar on over that point that day: that depends on its acquisition plan. Over Central America it records on almost every pass.</p>",
    "#realDrawer details:nth-of-type(3)": '<summary>Check it yourself</summary><p>Go to <a href="https://search.asf.alaska.edu" target="_blank" rel="noopener">search.asf.alaska.edu</a>, search NISAR over El Salvador and look at the image times. When the next pass shown by the globe arrives, a new image with that time should appear.</p>',
    "#infoDrawer h3": 'What you see <button data-close="infoDrawer" aria-label="Close">✕</button>',
    "#infoDrawer .legend": '<div><i class="dotsw" style="background:#d9a531;box-shadow:0 0 8px #d9a531"></i>NISAR in 3D, at 747 km (size greatly exaggerated: it is ~12 m)</div>' +
      '<div><i class="sw" style="background:#ff8a00;height:8px;opacity:.5"></i>Radar beam: what it is looking at now</div>' +
      '<div><i class="sw" style="background:#149BA5"></i>Where it will pass (next 50 min)</div>' +
      '<div><i class="sw" style="background:#5f7a80"></i>Where it passed (last 50 min)</div>' +
      '<div><i class="sw" style="background:#ff8a00;height:8px;opacity:.6"></i>240 km swath seen by the radar (to its left)</div>' +
      '<div><i class="dotsw" style="background:#ff5a1f"></i>Barra de Santiago · Jiquilisco · Cerrón Grande</div>' +
      '<div><i class="dotsw" style="background:#ff3b1f;box-shadow:0 0 10px #ff3b1f"></i>Sugarcane burns next to the mangroves (2025–2026 harvest)</div>',
    "#infoDrawer details:nth-of-type(1)": "<summary>Why does it look sideways and not down?</summary><p>A radar needs an angle to tell near from far. NISAR points to its left, at a swath about 240 km wide starting some 430 km from its ground track. That is why it does not pass <i>over</i> El Salvador: it passes to one side and looks at it sideways.</p>",
    "#infoDrawer details:nth-of-type(2)": "<summary>Why every 12 days?</summary><p>It makes 173 orbits in exactly 12 days and then repeats the same path to within meters. So every new image can be compared point by point with the previous one: that is what reveals change.</p>",
    "#infoDrawer details:nth-of-type(3)": "<summary>Why does it pass before dawn?</summary><p>Its orbit runs almost pole to pole and is synchronized with the Sun: it crosses the equator at 6 a.m. heading north and at 6 p.m. heading south. Over El Salvador the morning pass is around 5:30. Since the radar brings its own light, time of day and clouds do not matter.</p>",
    "#infoDrawer details:nth-of-type(4)": '<summary>What do "heading north" and "heading south" mean?</summary><p>On one orbit it crosses the country going north and on another going south. Because it looks to its left, going north it sees to the west and going south it sees to the east.</p>',
    "#infoDrawer details:nth-of-type(5)": "<summary>How accurate is this?</summary><p>The position comes from CelesTrak's public orbital elements (TLE) with the SGP4 model, the same one satellite trackers use. It is accurate to seconds for a few days. The swath and the radar beam are drawn approximately.</p>",
  };
  for (const [q, h] of Object.entries(html)) { const e = $(q); if (e) e.innerHTML = h; }
  if ($("#infoDrawer details")) $("#infoDrawer details").open = true;

  const btns = {
    nextBtn: ["Next pass", "Fast-forwards the clock to the next pass over El Salvador"],
    passBtn: ["When does it pass?", "Date and time of the next passes over each site"],
    cycleBtn: ["See the cycle", "Time runs fast and the globe spins: watch NISAR cover the planet in its 12-day cycle"],
    closeBtn: ["Follow NISAR", "The camera moves close and follows the satellite; drag the globe to let go"],
    fireBtn: ["Burns", "Sugarcane harvest burns next to the mangroves"],
    realBtn: ["Is it real?", "We compare the prediction with the images NISAR actually took"],
    infoBtn: ["What am I seeing?", "What each thing means"],
    nowBtn: ["Now", "Today's real time"],
  };
  for (const [id, [lbl, title]] of Object.entries(btns)) {
    const b = document.getElementById(id); if (!b) continue;
    b.querySelector(".lbl").textContent = lbl; b.title = title;
  }
  const bar = $(".bar"); if (bar) bar.setAttribute("aria-label", "Controls and information");
  const live = $(".brand .live"); if (live) live.title = "live";
})();
