const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../web/theme.js'),'utf8');
function boot(saved=null,blocked=false){
 const events={},root={dataset:{},style:{},lang:'es'},attrs={},icon={},clicks={},store={value:saved};let button=null,observer;
 const meta={setAttribute:(k,v)=>attrs['meta:'+k]=v};
 const document={documentElement:root,getElementById:()=>button,querySelector:s=>s.startsWith('meta')?meta:{appendChild(){}},querySelectorAll:()=>[],addEventListener:(k,cb)=>events[k]=cb,createElement:()=>button={setAttribute:(k,v)=>attrs[k]=v,querySelector:()=>icon,addEventListener:(k,cb)=>clicks[k]=cb}};
 const ctx={document,localStorage:{getItem(){if(blocked)throw Error('blocked');return store.value},setItem(k,v){if(blocked)throw Error('blocked');store.value=v}},window:{addEventListener:(k,cb)=>events[k]=cb},MutationObserver:class{constructor(cb){observer=cb}observe(){}},Chart:{register(p){ctx.plugin=p},getChart(){return null}}};
 vm.runInNewContext(source,ctx);return {root,attrs,store,ctx,events,ready(){events.DOMContentLoaded()},click(){clicks.click()},language(){observer()}};
}
test('theme defaults to light without consulting the system',()=>{const s=boot();assert.equal(s.root.dataset.theme,'light');assert.equal(s.root.style.colorScheme,'only light');assert.doesNotMatch(source,/matchMedia|prefers-color-scheme/)});
test('saved theme is applied before DOM ready and survives page recreation',()=>{const s=boot('dark');assert.equal(s.root.dataset.theme,'dark');s.ready();s.click();assert.equal(s.store.value,'light');assert.equal(boot(s.store.value).root.dataset.theme,'light')});
test('toggle updates theme, native scheme and accessible state immediately',()=>{const s=boot();s.ready();s.click();assert.equal(s.root.dataset.theme,'dark');assert.equal(s.attrs['aria-pressed'],'true');assert.equal(s.root.style.colorScheme,'only dark')});
test('blocked storage keeps light theme and does not throw',()=>{const s=boot('dark',true);s.ready();s.click();assert.equal(s.root.dataset.theme,'light')});
test('storage events synchronize tabs, including removal',()=>{const s=boot();s.ready();s.events.storage({key:'manglo-theme',newValue:'dark'});assert.equal(s.root.dataset.theme,'dark');s.events.storage({key:null,newValue:null});assert.equal(s.root.dataset.theme,'light')});
test('language updates accessible label without changing theme',()=>{const s=boot('dark');s.ready();s.root.lang='en';s.language();assert.equal(s.attrs['aria-label'],'Dark mode');assert.equal(s.root.dataset.theme,'dark')});
test('chart theme changes labels and grids while preserving datasets and values',()=>{const s=boot('dark');s.ready();const chart={data:{datasets:[{data:[2,9],borderColor:'#ff0000'}]},options:{plugins:{legend:{labels:{}}},scales:{y:{ticks:{},title:{},grid:{}}}}};const before=JSON.stringify(chart.data);s.ctx.plugin.beforeUpdate(chart);assert.equal(chart.options.scales.y.ticks.color,'#c5d9ec');assert.equal(JSON.stringify(chart.data),before)});
test('all four entry points load theme before rendering and CSS after existing styles',()=>{for(const page of ['index','landing','orbita','respira']){const html=fs.readFileSync(path.join(__dirname,`../web/${page}.html`),'utf8');assert.ok(html.indexOf('theme.js')<html.indexOf('<body'));assert.ok(html.lastIndexOf('theme.css')<html.indexOf('</head>'));assert.ok(html.includes('name="color-scheme" content="light"'))}});

