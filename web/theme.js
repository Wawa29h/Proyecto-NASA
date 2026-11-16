/* Preferencia visual compartida; no lee ni transforma productos científicos. */
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'manglo-theme';
  const normalize = value => value === 'dark' ? 'dark' : 'light';
  let theme = 'light';
  try { theme = normalize(localStorage.getItem(key)); } catch {}
  function apply(value) {
    theme = normalize(value);
    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'dark' ? 'only dark' : 'only light';
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
    paint();
  }
  function paint() {
    const button = document.getElementById('mangloTheme');
    if (!button) return;
    const english = root.lang.toLowerCase().startsWith('en');
    const label = english ? 'Dark mode' : 'Modo oscuro';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.querySelector('[data-theme-icon]').textContent = theme === 'dark' ? '☾' : '☀';
  }
  apply(theme); // Antes del primer render, sin consultar el tema del sistema.
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { apply(event.newValue); refreshCharts(); }
  });
  function chartStyle(chart) {
    const dark = theme === 'dark';
    const text = dark ? '#c5d9ec' : '#43595d';
    const grid = dark ? '#35516e' : '#dce4e5';
    const legend = chart.options.plugins?.legend?.labels;
    if (legend) legend.color = text;
    for (const axis of Object.values(chart.options.scales || {})) {
      if (axis.ticks) axis.ticks.color = text;
      if (axis.title) axis.title.color = text;
      if (axis.grid && axis.grid.display !== false) axis.grid.color = grid;
    }
    // No cambiar datasets, categorías, leyendas científicas ni escalas numéricas.
  }
  function refreshCharts() {
    if (typeof Chart === 'undefined') return;
    document.querySelectorAll('canvas').forEach(canvas => Chart.getChart(canvas)?.update('none'));
  }
  document.addEventListener('DOMContentLoaded', () => {
    const mount = ['.hdr-actions', '.nav-inner', '.orbit-view .brand', '.title .row'].map(selector => document.querySelector(selector)).find(Boolean);
    if (mount) {
      const button = document.createElement('button');
      button.id = 'mangloTheme'; button.type = 'button'; button.className = 'theme-toggle';
      button.setAttribute('translate', 'no');
      button.innerHTML = '<span data-theme-icon aria-hidden="true"></span>';
      button.addEventListener('click', () => {
        let next = theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, next); } catch { next = 'light'; }
        apply(next); refreshCharts();
      });
      mount.appendChild(button); paint();
    }
    if (typeof Chart !== 'undefined') {
      Chart.register({id:'mangloTheme', beforeUpdate:chartStyle});
      refreshCharts();
    }
    new MutationObserver(paint).observe(root, {attributes:true,attributeFilter:['lang']});
    window.addEventListener('manglo:language', paint);
  });
})();
