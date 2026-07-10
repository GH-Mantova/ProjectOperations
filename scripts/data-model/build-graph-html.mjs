#!/usr/bin/env node
// build-graph-html.mjs - reads docs/data-model/relationship-map.json and emits an
// interactive flow-graph viewer at docs/data-model/relationship-graph.html (vis-network via cdnjs).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const JSON_PATH = join(REPO_ROOT, 'docs', 'data-model', 'relationship-map.json');
const OUT_PATH = join(REPO_ROOT, 'docs', 'data-model', 'relationship-graph.html');
const DOMAIN_COLORS = {
  Assets:'#8E7CC3', Compliance:'#E06666', Contracts:'#6FA8DC', Dashboards:'#C27BA0', Directory:'#93C47D',
  Documents:'#76A5AF', Estimating:'#005B61', Forms:'#E7B416', Integrations:'#B45F06', Jobs:'#3D85C6',
  Platform:'#9AA0A6', Projects:'#674EA7', Safety:'#CC0000', Scheduler:'#3B7A80', Sites:'#6AA84F',
  Tendering:'#D9A404', Unclassified:'#C7C7C7', Workers:'#A64D79',
};
const HILITE = '#FEAA6D';
const g = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const degree = {};
for (const name of Object.keys(g.models)) degree[name] = 0;
for (const e of g.edges) { if (degree[e.from] != null) degree[e.from] += 1; if (degree[e.to] != null && e.to !== e.from) degree[e.to] += 1; }
const nodes = Object.keys(g.models).sort().map((name) => {
  const m = g.models[name];
  return { id:name, label:name, group:m.domain, value:1+(degree[name]||0),
    title:name+'\nDomain: '+m.domain+'\nTable: '+(m.dbTable||'(unmapped)')+'\nConnections: '+(degree[name]||0) };
});
const edgeMap = {};
for (const e of g.edges) { const key=e.from+'>'+e.to; if(!edgeMap[key])edgeMap[key]={from:e.from,to:e.to,vias:[]}; edgeMap[key].vias.push(e.via); }
const edges = Object.values(edgeMap).map((e)=>({ from:e.from, to:e.to, title:e.from+' -> '+e.to+' ('+e.vias.join(', ')+')', arrows:'to' }));
const models = {};
for (const name of Object.keys(g.models)) {
  const m = g.models[name];
  models[name] = { domain:m.domain, table:m.dbTable||'(unmapped)',
    belongsTo:m.relations.filter((r)=>r.owning).map((r)=>({field:r.field,target:r.target})),
    hasMany:m.relations.filter((r)=>r.cardinality==='many').map((r)=>({field:r.field,target:r.target})),
    referencedBy:[...new Set((m.referencedBy||[]).map((x)=>x.from))].sort() };
}
const DATA = { nodes, edges, models, colors:DOMAIN_COLORS, hilite:HILITE };
const META = { modelCount:g.modelCount, edgeCount:g.edgeCount, domainCount:Object.keys(g.domains).length };
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ProjectOperations - Data Model Flow</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.9/dist/vis-network.min.js"></script>
<style>
:root{ --teal:#005B61; --orange:#FEAA6D; --line:#e2e2e2; }
*{box-sizing:border-box;} html,body{margin:0;height:100%;font-family:'Outfit','Segoe UI',Arial,sans-serif;color:#242424;}
#app{display:grid;grid-template-rows:auto 1fr;height:100vh;}
header{background:var(--teal);color:#fff;padding:10px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
header h1{font-size:18px;margin:0;font-weight:800;} header .stats{font-size:12px;opacity:.9;} header .spacer{flex:1;}
header input[type=search]{font-size:13px;padding:7px 10px;border-radius:8px;border:none;width:240px;}
.btn{font-size:12px;font-weight:600;cursor:pointer;background:var(--orange);color:#3a2400;border:none;border-radius:8px;padding:7px 12px;}
.btn.ghost{background:rgba(255,255,255,.15);color:#fff;}
#main{position:relative;overflow:hidden;} #net{position:absolute;inset:0;background:radial-gradient(circle at 30% 20%, #fff, #eef1f1);}
#legend{position:absolute;top:10px;left:10px;background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:12px;padding:10px 12px;max-width:220px;box-shadow:0 6px 20px rgba(0,0,0,.08);font-size:12px;}
#legend h3{margin:0 0 8px;font-size:13px;} .chip{display:flex;align-items:center;gap:7px;padding:3px 4px;border-radius:6px;cursor:pointer;user-select:none;}
.chip:hover{background:#f6f6f6;} .chip.off{opacity:.35;text-decoration:line-through;} .dot{width:12px;height:12px;border-radius:50%;flex:none;}
.chip .n{margin-left:auto;color:#888;} #panel{position:absolute;top:10px;right:10px;width:300px;max-height:calc(100% - 20px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.12);display:none;}
#panel.show{display:block;} #panel h2{font-size:16px;margin:0 0 2px;color:var(--teal);word-break:break-word;} #panel .meta{font-size:12px;color:#777;margin-bottom:10px;}
#panel h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#999;margin:12px 0 4px;} #panel ul{margin:0;padding-left:16px;font-size:13px;}
#panel .rel-target{color:var(--teal);cursor:pointer;font-weight:600;} #panel .rel-target:hover{text-decoration:underline;} #panel .field{color:#555;}
#panel .close{float:right;cursor:pointer;border:none;background:none;font-size:18px;color:#999;}
.hint{position:absolute;bottom:10px;left:10px;font-size:11px;color:#888;background:rgba(255,255,255,.85);padding:5px 9px;border-radius:8px;}
</style></head>
<body><div id="app">
<header><h1>Data Model Flow</h1><span class="stats">MODELS_COUNT models &middot; EDGES_COUNT links &middot; DOMAINS_COUNT domains</span>
<span class="spacer"></span><input id="search" type="search" placeholder="Find a model..." autocomplete="off" />
<button class="btn" id="fit">Fit</button><button class="btn ghost" id="reset">Reset focus</button></header>
<div id="main"><div id="net"></div><div id="legend"><h3>Domains</h3><div id="chips"></div></div><div id="panel"></div>
<div class="hint">Click a model to focus its relationships. Click empty space to clear.</div></div></div>
<script>var DATA = __DATA__; var META = __META__;</script>
<script>
(function(){
  var colors=DATA.colors, HILITE=DATA.hilite; var domains=Object.keys(colors).sort();
  var groups={}; domains.forEach(function(d){ groups[d]={color:{background:colors[d],border:colors[d],highlight:{background:HILITE,border:'#d97a2b'}},font:{color:'#20303a',size:13}}; });
  var baseNodes=DATA.nodes.map(function(n){return {id:n.id,label:n.label,group:n.group,value:n.value,title:n.title};});
  var baseEdges=DATA.edges.map(function(e,i){return {id:'e'+i,from:e.from,to:e.to,title:e.title,arrows:'to',color:{color:'rgba(120,130,140,.35)',highlight:HILITE},width:1};});
  var nodes=new vis.DataSet(baseNodes), edges=new vis.DataSet(baseEdges);
  var adj={}; DATA.nodes.forEach(function(n){adj[n.id]={};}); DATA.edges.forEach(function(e){ if(adj[e.from])adj[e.from][e.to]=true; if(adj[e.to])adj[e.to][e.from]=true; });
  var network=new vis.Network(document.getElementById('net'),{nodes:nodes,edges:edges},{
    nodes:{shape:'dot',scaling:{min:6,max:34,label:{min:11,max:20}},borderWidth:1.5},
    edges:{smooth:{type:'continuous'},selectionWidth:2}, groups:groups,
    physics:{barnesHut:{gravitationalConstant:-9000,springLength:130,springConstant:0.03,damping:0.5},stabilization:{iterations:220}},
    interaction:{hover:true,tooltipDelay:120} });
  var hiddenDomains={}, focused=null;
  function applyDomainVisibility(){ var u=[]; DATA.nodes.forEach(function(n){u.push({id:n.id,hidden:!!hiddenDomains[n.group]});}); nodes.update(u); }
  function dimForFocus(id){ var keep={}; keep[id]=true; Object.keys(adj[id]||{}).forEach(function(k){keep[k]=true;});
    var nu=[]; DATA.nodes.forEach(function(n){ if(hiddenDomains[n.group])return; if(keep[n.id]){nu.push({id:n.id,color:(n.id===id?{background:HILITE,border:'#d97a2b'}:undefined),opacity:1});} else {nu.push({id:n.id,color:{background:'#dfe3e6',border:'#dfe3e6'},opacity:0.25});} }); nodes.update(nu);
    var eu=[]; edges.forEach(function(e){var on=(e.from===id||e.to===id);eu.push({id:e.id,color:{color:on?HILITE:'rgba(120,130,140,.08)'},width:on?2.5:1});}); edges.update(eu); }
  function clearFocus(){ focused=null; var nu=[]; DATA.nodes.forEach(function(n){nu.push({id:n.id,color:null,opacity:1});}); nodes.update(nu);
    var eu=[]; edges.forEach(function(e){eu.push({id:e.id,color:{color:'rgba(120,130,140,.35)',highlight:HILITE},width:1});}); edges.update(eu); document.getElementById('panel').classList.remove('show'); }
  function relList(arr,wf){ if(!arr.length)return '<li style="color:#aaa">none</li>'; return arr.map(function(r){ if(wf)return '<li><span class="field">'+r.field+'</span> &rarr; <span class="rel-target" data-go="'+r.target+'">'+r.target+'</span></li>'; return '<li><span class="rel-target" data-go="'+r+'">'+r+'</span></li>'; }).join(''); }
  function showPanel(id){ var m=DATA.models[id]; var p=document.getElementById('panel');
    p.innerHTML='<button class="close" title="close">&times;</button><h2>'+id+'</h2><div class="meta">'+m.domain+' &middot; <code>'+m.table+'</code></div>'+
      '<h4>Belongs to (FK out)</h4><ul>'+relList(m.belongsTo,true)+'</ul><h4>Has many</h4><ul>'+relList(m.hasMany,true)+'</ul><h4>Referenced by</h4><ul>'+relList(m.referencedBy,false)+'</ul>';
    p.classList.add('show'); p.querySelector('.close').onclick=clearFocus;
    Array.prototype.forEach.call(p.querySelectorAll('.rel-target'),function(el){el.onclick=function(){goToNode(el.getAttribute('data-go'));};}); }
  function goToNode(id){ if(!DATA.models[id])return; if(hiddenDomains[DATA.models[id].domain]){hiddenDomains[DATA.models[id].domain]=false;applyDomainVisibility();renderChips();}
    focused=id; network.selectNodes([id]); network.focus(id,{scale:1.1,animation:{duration:500,easingFunction:'easeInOutQuad'}}); dimForFocus(id); showPanel(id); }
  network.on('click',function(params){ if(params.nodes&&params.nodes.length)goToNode(params.nodes[0]); else clearFocus(); });
  function domainCounts(){ var c={}; DATA.nodes.forEach(function(n){c[n.group]=(c[n.group]||0)+1;}); return c; }
  function renderChips(){ var counts=domainCounts(); var wrap=document.getElementById('chips');
    wrap.innerHTML=domains.map(function(d){return '<div class="chip '+(hiddenDomains[d]?'off':'')+'" data-d="'+d+'"><span class="dot" style="background:'+colors[d]+'"></span>'+d+'<span class="n">'+(counts[d]||0)+'</span></div>';}).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('.chip'),function(el){el.onclick=function(){var d=el.getAttribute('data-d');hiddenDomains[d]=!hiddenDomains[d];applyDomainVisibility();if(focused)dimForFocus(focused);renderChips();};}); }
  renderChips();
  var search=document.getElementById('search');
  search.addEventListener('keydown',function(ev){ if(ev.key!=='Enter')return; var q=search.value.trim().toLowerCase(); if(!q)return; var hit=DATA.nodes.filter(function(n){return n.id.toLowerCase().indexOf(q)>=0;}); if(hit.length)goToNode(hit[0].id); });
  document.getElementById('fit').onclick=function(){network.fit({animation:true});};
  document.getElementById('reset').onclick=clearFocus;
  network.once('stabilizationIterationsDone',function(){network.setOptions({physics:{enabled:false}});});
})();
</script></body></html>`
  .replace('__DATA__', JSON.stringify(DATA))
  .replace('__META__', JSON.stringify(META))
  .replace('MODELS_COUNT', String(META.modelCount))
  .replace('EDGES_COUNT', String(META.edgeCount))
  .replace('DOMAINS_COUNT', String(META.domainCount));
writeFileSync(OUT_PATH, html);
console.log('Wrote ' + OUT_PATH + ' | nodes: ' + nodes.length + ' | edges: ' + edges.length);
