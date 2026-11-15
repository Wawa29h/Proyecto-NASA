const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const alerts = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/data-cerron/alerts.json'), 'utf8'));
const storySrc = fs.readFileSync(path.join(__dirname, '../web/story.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const languageSrc = fs.readFileSync(path.join(__dirname, '../web/language.js'), 'utf8');

test('alerts.json messages use experimental vegetation notice and disclaim species/emergencies', () => {
  assert.ok(alerts.dates.length > 0);
  for (const row of alerts.dates) {
    const msg = row.message;
    assert.match(msg, /^Aviso experimental de vegetación sobre agua · Embalse Cerrón Grande ·/);
    assert.match(msg, /Dato experimental \(IA radar\): niveles relativos al año en cada zona, no umbrales oficiales de emergencia\. Especie no confirmada en campo\./);
    // Does not claim water hyacinth (lirio acuatico) as a factual species in the generated alert message
    assert.doesNotMatch(msg, /^Lirio acuático/);
    assert.doesNotMatch(msg, /La zona con más lirio es/);
    assert.match(msg, /La zona con mayor vegetación detectada es/);
  }
});

test('alerts.json preserves dates, zones, relative levels, and numerical values', () => {
  assert.equal(alerts.zones.length, 4);
  const zoneIds = ['lempa', 'norte', 'centro', 'sur'];
  assert.deepEqual(alerts.zones.map(z => z.id), zoneIds);
  for (const row of alerts.dates) {
    assert.ok(row.date);
    assert.ok(row.id);
    for (const zid of zoneIds) {
      const z = row.zones[zid];
      assert.ok(typeof z.km2 === 'number');
      assert.ok(typeof z.pct === 'number');
      assert.ok(['bajo', 'medio', 'alto'].includes(z.level));
    }
  }
});

test('story.js updateAlert distinguishes absence of evaluation from absence of vegetation', () => {
  const card = {hidden: true};
  const zonesDiv = {innerHTML: ''};
  const msgDiv = {textContent: ''};
  const elements = {alertCard: card, alertZones: zonesDiv, alertMsg: msgDiv};
  const sandbox = {
    ALERTS: alerts,
    S: {dates: [{id: 'uncovered_date', date: '2026-05-01'}]},
    state: {mode: 'single', idx: 0},
    $: id => elements[id],
    shortDate: d => d,
    levelColor: {bajo: '#3cdc5a', medio: '#ffd600', alto: '#ff3b30'},
    zoneLayers: {}
  };
  vm.createContext(sandbox);
  // Extract updateAlert function
  const start = storySrc.indexOf('function updateAlert() {');
  const end = storySrc.indexOf('$("alertCopy").onclick');
  vm.runInContext(storySrc.slice(start, end), sandbox);

  // When radar did not cover reservoir (date not evaluated)
  sandbox.updateAlert();
  assert.match(zonesDiv.innerHTML, /Sin evaluación disponible/);
  assert.match(zonesDiv.innerHTML, /La ausencia de evaluación no implica ausencia de vegetación/);
});

test('index.html contains updated header for experimental alerts', () => {
  assert.match(indexHtml, /<h3>Avisos experimentales de vegetación sobre agua por zonas<\/h3>/);
  assert.doesNotMatch(indexHtml, /<h3>Alerta de lirio por zonas<\/h3>/);
});

test('story.js and app.js clarify relative levels and do not assert species identification', () => {
  assert.match(storySrc, /vegetación sobre el agua \(posible macrofíta flotante; la especie requiere verificación en campo\)/);
  assert.match(storySrc, /Los niveles bajo, medio y alto son relativos al período observado en cada zona, no umbrales oficiales de emergencia\./);
  assert.match(appSrc, /un cambio grande en la vegetación detectada merece revisión en campo\. Los niveles son relativos al período observado\./);
});

test('language.js includes Spanish/English translations for experimental notices', () => {
  assert.ok(languageSrc.includes('["Avisos experimentales de vegetación sobre agua por zonas","Experimental floating vegetation notices by zone"]'));
  assert.ok(languageSrc.includes('["Sin evaluación disponible para","No assessment available for"]'));
  assert.ok(languageSrc.includes('["el radar no cubrió el mínimo del embalse para esta pasada. La ausencia de evaluación no implica ausencia de vegetación.","the radar did not cover the minimum reservoir area for this observation. Absence of assessment does not imply absence of vegetation."]'));
  assert.ok(languageSrc.includes('["un cambio grande en la vegetación detectada merece revisión en campo. Los niveles son relativos al período observado.","a large change in detected vegetation warrants field verification. Levels are relative to the observed period."]'));
  assert.ok(languageSrc.includes('["Dato experimental (IA radar): niveles relativos al año en cada zona, no umbrales oficiales de emergencia. Especie no confirmada en campo.","Experimental data (radar AI): levels relative to the year in each zone, not official emergency thresholds. Species not confirmed in field."]'));
});
