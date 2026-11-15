/* Read the production functions without starting the application or writing data. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const section = source.slice(source.indexOf('// ---------- detector de cambios ----------'), source.indexOf('function pxKm2()'));
const clean = id => ({id, date:'2026-01-01', qc:true, coverage_pct:100});
const raster = values => ({w:values.length,h:1,v:Uint8Array.from(values)});

function context(load = () => Promise.resolve(raster([100]))) {
  const panel = {textContent:'',innerHTML:''};
  const elements = {changeKpis:panel,thr:{value:'3'}};
  const sandbox = {
    Uint8ClampedArray,changeRequestId:1,S:{dates:[clean('a'),clean('b')],hh_range:[-30,5]},
    state:{a:0,b:1,mode:'change'},loadHH:load,$:id=>elements[id],
    kpi:(value,label)=>`[${value}|${label}]`,pxKm2:()=>0.25,
    bounds:{},map:{removeLayer(){}},ovChange:null,overlays:0,
    document:{createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,test'})}
  };
  sandbox.L={imageOverlay:()=>({addTo(){sandbox.overlays++;return {};}})};
  vm.createContext(sandbox);vm.runInContext(section,sandbox);
  return {sandbox,panel};
}

test('rejects fills, including contributions rounded to zero percent',()=>{
  const {sandbox:s}=context();
  assert.match(s.changeQuantificationIssue({...clean('a'),time_filled_pct:25.5},clean('b')),/rellenos/);
  assert.match(s.changeQuantificationIssue({...clean('a'),filled_pct:30.4},clean('b')),/rellenos/);
  assert.match(s.changeQuantificationIssue({...clean('a'),time_filled_pct:0,time_fill_from:[{pct:0}]},clean('b')),/aportes/);
});
test('unknown or invalid provenance does not mean full observed coverage',()=>{
  const {sandbox:s}=context();
  assert.ok(s.changeQuantificationIssue({id:'a'},clean('b')));
  assert.ok(s.changeQuantificationIssue({...clean('a'),filled_pct:null},clean('b')));
  assert.ok(s.changeQuantificationIssue({...clean('a'),fill_from:'invalid'},clean('b')));
  assert.equal(s.changeQuantificationIssue(clean('a'),clean('b')),null);
});
test('counts and denominator use only the intersection of valid HH pixels',()=>{
  const {sandbox:s}=context();
  const r=s.comparableHHChange(raster([100,100,0,100]),raster([110,90,110,0]),[-30,5],1);
  assert.equal(r.valid,2);assert.equal(r.up,1);assert.equal(r.down,1);
  assert.equal(r.pixels[11],0);assert.equal(r.pixels[15],0);
});
test('incompatible grids are rejected before indexing',()=>{
  const {sandbox:s}=context();
  assert.throws(()=>s.comparableHHChange(raster([100]),raster([100,100]),[-30,5],3),/malla/);
});
test('no common data is unavailable, not zero square kilometres',async()=>{
  const {sandbox:s,panel}=context(()=>Promise.resolve(raster([0])));
  await s.renderChange();assert.match(panel.innerHTML,/Cuantificación no disponible/);assert.doesNotMatch(panel.innerHTML,/0\.00 km²/);
});
test('real zero change on valid observations remains a numeric result',async()=>{
  const {sandbox:s,panel}=context();await s.renderChange();
  assert.match(panel.innerHTML,/0\.00 km²/);assert.doesNotMatch(panel.innerHTML,/Cuantificación no disponible/);
});
test('filled pair keeps a visual overlay without numeric change claims',async()=>{
  const {sandbox:s,panel}=context();s.S.dates[0].time_filled_pct=4.8;
  await s.renderChange();assert.equal(s.overlays,1);assert.match(panel.innerHTML,/Cuantificación no disponible/);assert.doesNotMatch(panel.innerHTML,/km²| %/);
});
test('image loading failures clear quantification instead of retaining old numbers',async()=>{
  const {sandbox:s,panel}=context(()=>Promise.reject(new Error('unavailable')));
  panel.innerHTML='old result';await s.renderChange();assert.match(panel.innerHTML,/Cuantificación no disponible/);assert.doesNotMatch(panel.innerHTML,/old result/);
});
test('obsolete async computations cannot replace the latest selection',async()=>{
  const pending=[];const {sandbox:s,panel}=context(()=>new Promise(resolve=>pending.push(resolve)));
  const task=s.renderChange();s.changeRequestId++;panel.innerHTML='new selection';
  pending.forEach(resolve=>resolve(raster([100])));await task;
  assert.equal(s.overlays,0);assert.equal(panel.innerHTML,'new selection');
});
test('actual affected regional dates are blocked without changing their files',()=>{
  const {sandbox:s}=context();
  for(const [folder,date] of [['data','2026-10-21'],['data-jiquilisco','2026-07-05'],['data-cerron','2026-07-05']]){
    const series=JSON.parse(fs.readFileSync(path.join(__dirname,'../web',folder,'series.json'),'utf8'));
    const d=series.dates.find(d=>d.date===date);
    assert.ok(s.changeQuantificationIssue(d,clean('b')),`${folder}/${date}`);
  }
});
