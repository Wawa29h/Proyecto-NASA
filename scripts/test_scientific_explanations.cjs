const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const A={id:'a',date:'2025-12-25'},B={id:'b',date:'2026-09-15'};
function context(site='barra',interpretations=null,issue=null){
 const box={innerHTML:''},card={hidden:true};
 const s={SITE:{id:site},INTERP:interpretations,$:id=>id==='interpCard'?card:box,changeQuantificationIssue:()=>issue};
 vm.createContext(s);vm.runInContext(app.slice(app.indexOf('function regionalInterpretation('),app.indexOf('// ---------- lluvia')),s);
 return {s,box};
}
test('production never fetches the simulated interpretations fixture',()=>{
 assert.doesNotMatch(app,/getJSON\([^\n]*fixtures\/interpretations_simulated/);
 assert.ok(fs.existsSync(path.join(__dirname,'../web/fixtures/interpretations_simulated.json')));
});
test('absent and simulated releases show no scientific numbers in any region',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/fixtures/interpretations_simulated.json'),'utf8'));
 for(const site of ['barra','jiquilisco','cerron']) for(const data of [null,fixture]){
  const {s,box}=context(site,data);s.updateInterpretation(A,B);
  assert.match(box.innerHTML,/Información científica no disponible/);assert.doesNotMatch(box.innerHTML,/9\.4|3\.2|delta_km2|simulada/);
 }
});
test('unreviewed, unmatched, unsupported or evidence-free interpretations are rejected',()=>{
 const pair={before_id:'a',after_id:'b',status:'supported',hypotheses:[{summary:'Possible mechanism',evidence:'Reference'}]};
 const release={data_status:'validated',sites:{barra:{comparisons:[pair]}}};
 assert.ok(context('barra',release).s.regionalInterpretation(A,B));
 assert.equal(context('jiquilisco',release).s.regionalInterpretation(A,B),null);
 assert.equal(context('barra',{...release,data_status:'processed'}).s.regionalInterpretation(A,B),null);
 assert.equal(context('barra',release,'unverified support').s.regionalInterpretation(A,B),null);
 for(const change of [{after_id:'other'},{status:'not_comparable'},{hypotheses:[]},{hypotheses:[{summary:'Cause'}]}]){
  const bad={...release,sites:{barra:{comparisons:[{...pair,...change}]}}};assert.equal(context('barra',bad).s.regionalInterpretation(A,B),null);
 }
});
test('validated explanatory text never inserts an unchecked numeric delta',()=>{
 const pair={before_id:'a',after_id:'b',status:'supported',observed_change:{delta_km2:999},hypotheses:[{summary:'Possible mechanism',evidence:'Reference'}]};
 const {s,box}=context('barra',{data_status:'validated',sites:{barra:{comparisons:[pair]}}});s.updateInterpretation(A,B);
 assert.match(box.innerHTML,/Possible mechanism/);assert.doesNotMatch(box.innerHTML,/999/);
});
test('absence messages have explicit English translations',()=>{
 const language=fs.readFileSync(path.join(__dirname,'../web/language.js'),'utf8');
 assert.ok(language.includes('["Información científica no disponible","Scientific information unavailable"]'));
});
