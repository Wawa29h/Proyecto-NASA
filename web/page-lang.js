// Traductor ligero para páginas sueltas de MANGLO (inicio, vista 3D). Comparte el idioma con la app y el globo:
// se guarda en localStorage "manglo-language"; si la persona nunca eligió, se usa el idioma de su navegador
// (español si está en español, inglés en cualquier otro caso). Cada página define window.PAGE_LANG antes de cargar esto:
//   { pairs: [[es, en], ...], patterns: [[regex, en], ...], mount: "selector donde van los botones", title: [es, en] }
(function () {
  const cfg = window.PAGE_LANG || {};
  const pick = () => {
    try { const s = localStorage.getItem("manglo-language"); if (s === "es" || s === "en") return s; } catch {}
    const l = ((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase();
    return l.startsWith("es") ? "es" : "en";
  };
  let lang = pick();
  const pairs = cfg.pairs || [];
  const toEn = new Map(pairs), toEs = new Map(pairs.map(([es, en]) => [en, es]));
  const patterns = cfg.patterns || [];
  function tr(s) {
    const src = toEs.get(s) || s;
    if (lang !== "en") return src;
    if (toEn.has(src)) return toEn.get(src);
    let out = src;
    for (const [re, en] of patterns) out = out.replace(re, en);
    return out;
  }
  // el texto original de cada nodo se recuerda para poder volver al español sin perder nada
  const orig = new WeakMap(), origAttr = new WeakMap();
  let titleSrc = document.title, titleOut = null;
  function visit(root) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest("script,style,[data-no-translate],.pl-sw")) continue;
      const v = n.nodeValue;
      if (!v.trim()) continue;
      let rec = orig.get(n);
      if (!rec || v !== rec.out) rec = { src: toEs.get(v.trim()) || v.trim(), pre: v.match(/^\s*/)[0], post: v.match(/\s*$/)[0] };
      rec.out = rec.pre + tr(rec.src) + rec.post;
      orig.set(n, rec);
      if (n.nodeValue !== rec.out) n.nodeValue = rec.out;
    }
    (root.querySelectorAll ? root : document).querySelectorAll("[aria-label],[alt],[title]").forEach((e) => {
      if (e.closest(".pl-sw")) return;
      let recs = origAttr.get(e); if (!recs) { recs = {}; origAttr.set(e, recs); }
      for (const a of ["aria-label", "alt", "title"]) {
        if (!e.hasAttribute(a)) continue;
        const v = e.getAttribute(a); let r = recs[a];
        if (!r || v !== r.out) r = { src: toEs.get(v) || v };
        r.out = tr(r.src); recs[a] = r;
        if (r.out !== v) e.setAttribute(a, r.out);
      }
    });
    document.documentElement.lang = lang;
    if (cfg.title) document.title = lang === "en" ? cfg.title[1] : cfg.title[0];
    else { if (document.title !== titleOut) titleSrc = toEs.get(document.title) || document.title; titleOut = tr(titleSrc); if (document.title !== titleOut) document.title = titleOut; }
  }
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; visit(document.body); }); };
  // botones ES / EN
  const mount = cfg.mount && document.querySelector(cfg.mount);
  if (mount) {
    const st = document.createElement("style");
    st.textContent = ".pl-sw{display:inline-flex;flex:none;border:1px solid currentColor;border-radius:8px;overflow:hidden;opacity:.9}" +
      ".pl-sw button{background:none;border:0;color:inherit;font:600 12px/1 Inter,system-ui,sans-serif;padding:6px 9px;cursor:pointer}" +
      ".pl-sw button[aria-pressed=true]{background:rgba(255,255,255,.25)}";
    document.head.appendChild(st);
    const sw = document.createElement("div");
    sw.className = "pl-sw"; sw.setAttribute("role", "group"); sw.setAttribute("translate", "no");
    sw.innerHTML = '<button type="button" data-l="es" lang="es">ES</button><button type="button" data-l="en" lang="en">EN</button>';
    const paint = () => { sw.setAttribute("aria-label", lang === "en" ? "Page language" : "Idioma de la página"); sw.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === lang))); };
    sw.onclick = (e) => {
      const b = e.target.closest("[data-l]"); if (!b || b.dataset.l === lang) return;
      lang = b.dataset.l;
      try { localStorage.setItem("manglo-language", lang); } catch {}
      paint(); visit(document.body); window.dispatchEvent(new Event("manglo:language"));
    };
    paint(); mount.appendChild(sw);
  }
  window.PageLang = { get: () => lang, tr };
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, characterData: true });
  visit(document.body);
})();
