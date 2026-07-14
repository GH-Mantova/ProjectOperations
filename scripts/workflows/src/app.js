const NS='http://www.w3.org/2000/svg';
const TYPES=[['startEnd','Start / End'],['process','Process'],['decision','Decision'],['io','Data entry'],['doc','Report'],['output','Output']];
const COLORS={ startEnd:{f:'#005B61',s:'#00363a',t:'#ffffff'}, output:{f:'#12545a',s:'#00363a',t:'#ffffff'}, process:{f:'#ffffff',s:'#005B61',t:'#12333a'}, decision:{f:'#FCE9D6',s:'#E08A3C',t:'#7a3d00'}, io:{f:'#E7F1F1',s:'#3B7A80',t:'#12333a'}, doc:{f:'#0E7A82',s:'#00363a',t:'#ffffff'} };
const svg=document.getElementById('svg'), VP=document.getElementById('viewport'), EDG=document.getElementById('edges'), NOD=document.getElementById('nodes'), TEMP=document.getElementById('tempEdge'), OV=document.getElementById('overlayInput');
let WF=WORKFLOWS, curKey=null, model=null, view={x:80,y:80,k:1}, sel=null, seqId=1, curView='module', rolesMode=false;
function el(tag,attrs){ const e=document.createElementNS(NS,tag); if(attrs)for(const k in attrs)e.setAttribute(k,attrs[k]); return e; }
function applyView(){ VP.setAttribute('transform','translate('+view.x+','+view.y+') scale('+view.k+')'); }
function toWorld(cx,cy){ const r=svg.getBoundingClientRect(); return { x:(cx-r.left-view.x)/view.k, y:(cy-r.top-view.y)/view.k }; }
function eKey(k){return 'wf-edit:'+k;} function clone(o){return JSON.parse(JSON.stringify(o));}
function savedModel(k){const s=localStorage.getItem(eKey(k)); if(s){try{return JSON.parse(s);}catch(e){}} return null;}
function embedded(k){return WF.find(w=>w.key===k)||null;}
function customList(){try{return JSON.parse(localStorage.getItem('wf-custom-list')||'[]');}catch(e){return [];}}
function setCustomList(a){localStorage.setItem('wf-custom-list',JSON.stringify(a));}
function initNode(n){n.gate=n.gate||false;n.approverRole=n.approverRole||'';n.notifyRoles=n.notifyRoles||[];n.escalateType=n.escalateType||'';n.escalateTo=n.escalateTo||'';n.comment=n.comment||'';return n;}
function roleOverrides(){try{return JSON.parse(localStorage.getItem('wf-roles')||'{}');}catch(e){return {};}}
function roleList(){ const ov=roleOverrides(); return ROLES.map(r=>({role:r.role, person:(ov[r.role]!=null?ov[r.role]:r.person)})); }
function personForRole(role){ const f=roleList().find(r=>r.role===role); return f?f.person:''; }
function setRolePerson(role,person){ const ov=roleOverrides(); ov[role]=person; localStorage.setItem('wf-roles',JSON.stringify(ov)); }
function workflowTitle(k){ const it=listWorkflows().find(x=>x.key===k); return it?it.title:''; }
function orderOf(k,def){const v=localStorage.getItem('wf-order:'+k);return v!=null?Number(v):def;}
function loadModel(k){
  let m=savedModel(k);
  if(!m){ const e=embedded(k); if(!e)return null; m=clone(e); m.generalNotes=''; }
  m.nodes=m.nodes||[]; m.edges=m.edges||[]; m.nodes.forEach(initNode);
  m.edges.forEach(e=>{ if(!e.id)e.id='e'+(seqId++); });
  if(m.nodes.some(n=>typeof n.x!=='number')) layout(m);
  return m;
}
function persist(){ localStorage.setItem(eKey(curKey), JSON.stringify(model)); }
function listWorkflows(){
  const out=[];
  WF.forEach((w,i)=>{const sm=savedModel(w.key);out.push({key:w.key,custom:false,view:(sm&&sm.view)||w.view||'module',title:(sm&&sm.title)||w.title,module:(sm&&sm.module)||w.module,role:(sm&&sm.role)||w.role,status:(sm&&sm.status)||w.status,order:orderOf(w.key,i+1)});});
  customList().forEach((c,i)=>{const sm=savedModel(c.key);out.push({key:c.key,custom:true,view:(sm&&sm.view)||c.view||'module',title:(sm&&sm.title)||c.title,module:(sm&&sm.module)||'Custom',role:(sm&&sm.role)||'',status:(sm&&sm.status)||'DRAFT',order:orderOf(c.key,100+i+1)});});
  out.sort((a,b)=>(a.order-b.order)||a.title.localeCompare(b.title)); return out;
}
function wrap(label){ const out=[]; String(label||'').split('\n').forEach(seg=>{ const words=seg.split(/\s+/); let line=''; words.forEach(w=>{ if((line+' '+w).trim().length>22){ if(line)out.push(line); line=w; } else line=(line?line+' ':'')+w; }); out.push(line); }); return out.slice(0,6); }
function sizeOf(n){ const lines=wrap(n.label); const w=(n.type==='decision')?190:(n.type==='io'?185:172); const h=Math.max(54, lines.length*18+24); return {w:w,h:h,lines:lines}; }
function center(n){ const s=sizeOf(n); return {x:n.x+s.w/2, y:n.y+s.h/2, w:s.w, h:s.h}; }
function clip(n,tx,ty){ const c=center(n); const dx=tx-c.x, dy=ty-c.y; if(!dx&&!dy)return {x:c.x,y:c.y}; const sx=dx?(c.w/2)/Math.abs(dx):1e9, sy=dy?(c.h/2)/Math.abs(dy):1e9; const s=Math.min(sx,sy); return {x:c.x+dx*s, y:c.y+dy*s}; }
function edgeD(e){ const a=model.nodes.find(n=>n.id===e.from), b=model.nodes.find(n=>n.id===e.to); if(!a||!b)return null;
  if(a===b){ const c=center(a); const x=c.x+c.w/2, y=c.y; return {d:'M'+x+' '+(y+6)+' C'+(x+64)+' '+(y-22)+' '+(x+64)+' '+(y+44)+' '+x+' '+(y+20), mx:x+54, my:y+12}; }
  const cb=center(b), ca=center(a); const p1=clip(a,cb.x,cb.y), p2=clip(b,ca.x,ca.y); return {d:'M'+p1.x+' '+p1.y+' L'+p2.x+' '+p2.y, mx:(p1.x+p2.x)/2, my:(p1.y+p2.y)/2}; }
function layout(m){
  const adj={}; m.nodes.forEach(n=>adj[n.id]=[]); m.edges.forEach(e=>{ if(adj[e.from]&&adj[e.to]) adj[e.from].push(e.to); });
  const st={}, back={};
  function dfs(u){ st[u]=1; adj[u].forEach(v=>{ if(st[v]===1) back[u+'>'+v]=1; else if(!st[v]) dfs(v); }); st[u]=2; }
  m.nodes.forEach(n=>{ if(!st[n.id]) dfs(n.id); });
  const layer={}; m.nodes.forEach(n=>layer[n.id]=0);
  const fe=m.edges.filter(e=>!back[e.from+'>'+e.to]);
  for(let it=0; it<m.nodes.length+2; it++){ let ch=false; fe.forEach(e=>{ if((layer[e.to]||0)<(layer[e.from]||0)+1){ layer[e.to]=(layer[e.from]||0)+1; ch=true; } }); if(!ch)break; }
  const byL={}; m.nodes.forEach(n=>{ const L=layer[n.id]||0; (byL[L]=byL[L]||[]).push(n); });
  Object.keys(byL).forEach(L=>{ byL[L].forEach((n,i)=>{ n.y=40+Number(L)*132; n.x=40+i*230; }); });
}
function nextId(){ let i=1; while(model.nodes.some(n=>n.id==='n'+i))i++; return 'n'+i; }
function defLabel(t){ return ({startEnd:'Start',output:'Output',process:'Step',decision:'Decision?',io:'Data',doc:'Report'})[t]||'Step'; }
function shapeEl(n,w,h,col){
  if(n.type==='decision') return el('polygon',{points:(w/2)+',0 '+w+','+(h/2)+' '+(w/2)+','+h+' 0,'+(h/2)});
  if(n.type==='io') return el('polygon',{points:'20,0 '+w+',0 '+(w-20)+','+h+' 0,'+h});
  if(n.type==='startEnd'||n.type==='output') return el('rect',{x:0,y:0,width:w,height:h,rx:h/2,ry:h/2});
  return el('rect',{x:0,y:0,width:w,height:h,rx:8,ry:8});
}
function drawNode(n){
  const s=sizeOf(n), w=s.w, h=s.h, col=COLORS[n.type]||COLORS.process;
  const g=el('g',{class:'node-g','data-id':n.id,transform:'translate('+n.x+','+n.y+')'});
  const sh=shapeEl(n,w,h,col); sh.setAttribute('class','node-shape');
  sh.setAttribute('fill',col.f); sh.setAttribute('stroke',n.gate?'#E08A3C':col.s); sh.setAttribute('stroke-width',n.gate?4:2);
  g.appendChild(sh);
  const t=el('text',{class:'nlabel',x:w/2,y:0,'text-anchor':'middle','font-size':13,'font-weight':600,fill:col.t});
  const startY=h/2-(s.lines.length-1)*9+4;
  s.lines.forEach((ln,i)=>{ const ts=el('tspan',{x:w/2,y:startY+i*18}); ts.textContent=ln; t.appendChild(ts); });
  g.appendChild(t);
  [[w/2,0],[w,h/2],[w/2,h],[0,h/2]].forEach(p=>{ const c=el('circle',{class:'handle',cx:p[0],cy:p[1],r:5}); c.dataset.handle='1'; g.appendChild(c); });
  if(n.escalateType&&n.escalateTo){ let lbl=(n.escalateType==='role'?n.escalateTo:(workflowTitle(n.escalateTo)||'process')); if(lbl.length>16)lbl=lbl.slice(0,15)+'…'; const bw=lbl.length*6+24; g.appendChild(el('rect',{x:w-bw+8,y:-13,width:bw,height:18,rx:9,fill:'#efe6fb',stroke:'#7a5cc0'})); const bt=el('text',{x:w-bw+16,y:0,'font-size':11,fill:'#5b3ea0','font-weight':600}); bt.textContent='↗ '+lbl; g.appendChild(bt); }
  if(sel&&sel.type==='node'&&sel.id===n.id) g.appendChild(el('rect',{class:'selbox',x:-4,y:-4,width:w+8,height:h+8,rx:10}));
  NOD.appendChild(g);
}
function drawEdge(e){
  const info=edgeD(e); if(!info)return; const isSel=sel&&sel.type==='edge'&&sel.id===e.id;
  const hit=el('path',{class:'edge-hit',d:info.d}); hit.dataset.edge=e.id; EDG.appendChild(hit);
  EDG.appendChild(el('path',{class:'edge'+(isSel?' sel':''),d:info.d,'marker-end':isSel?'url(#arrowSel)':'url(#arrow)'}));
  if(e.label){ const tw=e.label.length*7+10; EDG.appendChild(el('rect',{class:'elabelbg',x:info.mx-tw/2,y:info.my-10,width:tw,height:18,rx:9}));
    const tx=el('text',{class:'elabel',x:info.mx,y:info.my+3,'text-anchor':'middle'}); tx.textContent=e.label; EDG.appendChild(tx); }
}
function renderCanvas(){ EDG.textContent=''; NOD.textContent=''; model.edges.forEach(drawEdge); model.nodes.forEach(drawNode); }
function renderAll(){ renderCanvas(); renderProps(); }
function renderPalette(){
  const p=document.getElementById('palette'); p.innerHTML='<div class="ptitle">Shapes</div>';
  TYPES.forEach(t=>{ const col=COLORS[t[0]]; const it=document.createElement('div'); it.className='pitem'; it.draggable=true; it.dataset.type=t[0];
    let inner;
    if(t[0]==='decision') inner='<polygon points="23,3 43,15 23,27 3,15" fill="'+col.f+'" stroke="'+col.s+'" stroke-width="2"/>';
    else if(t[0]==='io') inner='<polygon points="8,4 44,4 38,26 2,26" fill="'+col.f+'" stroke="'+col.s+'" stroke-width="2"/>';
    else if(t[0]==='startEnd'||t[0]==='output') inner='<rect x="3" y="6" width="40" height="18" rx="9" fill="'+col.f+'" stroke="'+col.s+'" stroke-width="2"/>';
    else inner='<rect x="3" y="5" width="40" height="20" rx="4" fill="'+col.f+'" stroke="'+col.s+'" stroke-width="2"/>';
    it.innerHTML='<svg viewBox="0 0 46 30">'+inner+'</svg><span>'+t[1]+'</span>';
    it.addEventListener('dragstart',ev=>ev.dataTransfer.setData('type',t[0]));
    it.addEventListener('click',()=>{ const r=svg.getBoundingClientRect(); const wpt=toWorld(r.left+r.width/2, r.top+r.height/2); addNode(t[0],wpt.x-85,wpt.y-27); });
    p.appendChild(it); });
}
function addNode(type,x,y){ const n=initNode({id:nextId(),type:type,label:defLabel(type),x:Math.round(x),y:Math.round(y)}); model.nodes.push(n); sel={type:'node',id:n.id}; persist(); renderAll(); }
let mode=null, dragNode=null, offx=0, offy=0, connectFrom=null, panSX=0, panSY=0, panVX=0, panVY=0;
svg.addEventListener('pointerdown',ev=>{
  if(ev.target.dataset && ev.target.dataset.handle){ const g=ev.target.closest('.node-g'); connectFrom=g.getAttribute('data-id'); mode='connect'; svg.setPointerCapture(ev.pointerId); return; }
  const ng=ev.target.closest('.node-g');
  if(ng){ const id=ng.getAttribute('data-id'); sel={type:'node',id:id}; dragNode=model.nodes.find(n=>n.id===id); const w=toWorld(ev.clientX,ev.clientY); offx=w.x-dragNode.x; offy=w.y-dragNode.y; mode='drag'; svg.setPointerCapture(ev.pointerId); renderAll(); return; }
  if(ev.target.dataset && ev.target.dataset.edge){ sel={type:'edge',id:ev.target.dataset.edge}; renderAll(); return; }
  sel=null; mode='pan'; panSX=ev.clientX; panSY=ev.clientY; panVX=view.x; panVY=view.y; svg.classList.add('panning'); svg.setPointerCapture(ev.pointerId); renderProps();
});
svg.addEventListener('pointermove',ev=>{
  if(mode==='drag'&&dragNode){ const w=toWorld(ev.clientX,ev.clientY); dragNode.x=Math.round(w.x-offx); dragNode.y=Math.round(w.y-offy); const g=NOD.querySelector('.node-g[data-id="'+dragNode.id+'"]'); if(g)g.setAttribute('transform','translate('+dragNode.x+','+dragNode.y+')'); EDG.textContent=''; model.edges.forEach(drawEdge); }
  else if(mode==='connect'&&connectFrom){ const from=model.nodes.find(n=>n.id===connectFrom); const w=toWorld(ev.clientX,ev.clientY); const p1=clip(from,w.x,w.y); TEMP.style.display=''; TEMP.setAttribute('d','M'+p1.x+' '+p1.y+' L'+w.x+' '+w.y); }
  else if(mode==='pan'){ view.x=panVX+(ev.clientX-panSX); view.y=panVY+(ev.clientY-panSY); applyView(); }
});
svg.addEventListener('pointerup',ev=>{
  if(mode==='drag'){ persist(); }
  else if(mode==='connect'&&connectFrom){ TEMP.style.display='none'; const t=document.elementFromPoint(ev.clientX,ev.clientY); const g=t&&t.closest?t.closest('.node-g'):null; if(g){ const to=g.getAttribute('data-id'); if(to!==connectFrom){ model.edges.push({id:'e'+(seqId++),from:connectFrom,to:to,label:''}); persist(); } } sel=null; renderAll(); }
  svg.classList.remove('panning'); mode=null; dragNode=null; connectFrom=null;
});
svg.addEventListener('wheel',ev=>{ ev.preventDefault(); const before=toWorld(ev.clientX,ev.clientY); const f=ev.deltaY<0?1.12:0.89; view.k=Math.min(3,Math.max(0.25,view.k*f)); const r=svg.getBoundingClientRect(); view.x=(ev.clientX-r.left)-before.x*view.k; view.y=(ev.clientY-r.top)-before.y*view.k; applyView(); },{passive:false});
svg.addEventListener('dragover',ev=>ev.preventDefault());
svg.addEventListener('drop',ev=>{ ev.preventDefault(); const type=ev.dataTransfer.getData('type'); if(!type)return; const w=toWorld(ev.clientX,ev.clientY); addNode(type,w.x-85,w.y-27); });
svg.addEventListener('dblclick',ev=>{ const g=ev.target.closest('.node-g'); if(!g)return; const n=model.nodes.find(x=>x.id===g.getAttribute('data-id')); if(!n)return; const s=sizeOf(n);
  OV.style.display='block'; OV.style.left=(view.x+n.x*view.k)+'px'; OV.style.top=(view.y+n.y*view.k)+'px'; OV.style.width=(s.w*view.k)+'px'; OV.style.height=(s.h*view.k)+'px';
  OV.value=n.label; OV.focus(); OV.select();
  const done=()=>{ n.label=OV.value; OV.style.display='none'; OV.onblur=null; persist(); renderAll(); };
  OV.onblur=done; OV.onkeydown=(k)=>{ if(k.key==='Enter'&&!k.shiftKey){ k.preventDefault(); done(); } if(k.key==='Escape'){ OV.style.display='none'; OV.onblur=null; } };
});
document.addEventListener('keydown',ev=>{ if(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName))return; if((ev.key==='Delete'||ev.key==='Backspace')&&sel){ ev.preventDefault(); if(sel.type==='node'){ model.nodes=model.nodes.filter(n=>n.id!==sel.id); model.edges=model.edges.filter(e=>e.from!==sel.id&&e.to!==sel.id); } else { model.edges=model.edges.filter(e=>e.id!==sel.id); } sel=null; persist(); renderAll(); } });
function fitView(){ if(!model.nodes.length){ view={x:80,y:60,k:1}; applyView(); return; } let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9; model.nodes.forEach(n=>{ const s=sizeOf(n); minx=Math.min(minx,n.x); miny=Math.min(miny,n.y); maxx=Math.max(maxx,n.x+s.w); maxy=Math.max(maxy,n.y+s.h); }); const r=svg.getBoundingClientRect(); const pad=40; const cw=(maxx-minx)||1, ch=(maxy-miny)||1; const kW=(r.width-pad*2)/cw, kH=(r.height-pad*2)/ch; let k=Math.min(kW,kH,1.1); if(k<0.6)k=Math.min(kW,1.0); k=Math.max(0.4,Math.min(1.1,k)); view.k=k; view.x=(r.width-cw*k)/2-minx*k; view.y=pad-miny*k; applyView(); }
const reviewerEl=document.getElementById('reviewer'); reviewerEl.value=localStorage.getItem('wf-reviewer')||''; reviewerEl.oninput=()=>localStorage.setItem('wf-reviewer',reviewerEl.value);
function chipRow(selected,onTog){ const w=document.createElement('div'); w.className='chips'; STAFF.forEach(s=>{ const c=document.createElement('span'); c.className='chip'+(selected.includes(s.name)?' on':''); c.textContent=s.name.split(' ')[0]+' ('+s.roleShort+')'; c.title=s.name+' - '+s.role; c.onclick=()=>onTog(s.name); w.appendChild(c); }); return w; }
function tog(a,v){ return a.includes(v)?a.filter(x=>x!==v):a.concat([v]); }
function fld(label,node){ const d=document.createElement('div'); const l=document.createElement('div'); l.className='mini'; l.textContent=label; d.appendChild(l); d.appendChild(node); return d; }
function renderRolesPanel(P){
  const h=document.createElement('h3'); h.textContent='Roles & people'; P.appendChild(h);
  const info=document.createElement('div'); info.className='muted'; info.style.margin='4px 0 10px';
  info.textContent='Set who currently holds each role. Module approval gates auto-fill the person from here - change it once and every gate that uses that role updates.'; P.appendChild(info);
  roleList().forEach(r=>{ const row=document.createElement('div'); row.className='pcard'; row.style.padding='8px';
    const l=document.createElement('div'); l.className='mini'; l.textContent=r.role; row.appendChild(l);
    const inp=document.createElement('input'); inp.type='text'; inp.className='full'; inp.placeholder='(vacant)'; inp.value=r.person||''; inp.oninput=()=>{ setRolePerson(r.role, inp.value); }; row.appendChild(inp);
    P.appendChild(row); });
  const back=document.createElement('button'); back.className='btn sm primary'; back.style.marginTop='8px'; back.textContent='Done'; back.onclick=()=>{ rolesMode=false; renderProps(); renderCanvas(); }; P.appendChild(back);
}
function renderProps(){
  const P=document.getElementById('props'); P.innerHTML='';
  if(rolesMode){ renderRolesPanel(P); return; }
  const h=document.createElement('h3'); h.contentEditable='true'; h.spellcheck=false; h.textContent=model.title; h.oninput=()=>{ model.title=h.textContent.trim(); persist(); buildPicker(); }; P.appendChild(h);
  const hm=document.createElement('div'); hm.className='hdr-meta';
  const mi=document.createElement('input'); mi.type='text'; mi.placeholder='Module'; mi.value=model.module||''; mi.oninput=()=>{ model.module=mi.value; persist(); buildPicker(); };
  const ri=document.createElement('input'); ri.type='text'; ri.placeholder='Role'; ri.value=model.role||''; ri.oninput=()=>{ model.role=ri.value; persist(); buildPicker(); };
  hm.appendChild(mi); hm.appendChild(ri); P.appendChild(hm);
  const card=document.createElement('div'); card.className='pcard';
  if(sel&&sel.type==='node'){ const n=model.nodes.find(x=>x.id===sel.id);
    if(n){ card.innerHTML='<div class="mini">Selected step</div>';
      const ts=document.createElement('select'); TYPES.forEach(t=>{ const o=document.createElement('option'); o.value=t[0]; o.textContent=t[1]; if(n.type===t[0])o.selected=true; ts.appendChild(o); }); ts.onchange=()=>{ n.type=ts.value; persist(); renderAll(); };
      card.appendChild(fld('Type',ts));
      const lab=document.createElement('input'); lab.type='text'; lab.className='full'; lab.value=n.label; lab.oninput=()=>{ n.label=lab.value; persist(); renderCanvas(); }; card.appendChild(fld('Label',lab));
      const gr=document.createElement('div'); gr.className='gaterow'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!n.gate; cb.onchange=()=>{ n.gate=cb.checked; persist(); renderAll(); }; gr.appendChild(cb); gr.appendChild(document.createTextNode(' Approval gate')); card.appendChild(gr);
      if(n.gate){
        const rs=document.createElement('select'); const b0=document.createElement('option'); b0.value=''; b0.textContent='(choose role)'; rs.appendChild(b0);
        roleList().forEach(r=>{ const o=document.createElement('option'); o.value=r.role; o.textContent=r.role; if(n.approverRole===r.role)o.selected=true; rs.appendChild(o); });
        rs.onchange=()=>{ n.approverRole=rs.value; persist(); renderProps(); renderCanvas(); };
        card.appendChild(fld('Responsible role (approves)',rs));
        const who=personForRole(n.approverRole); const wl=document.createElement('div'); wl.className='muted'; wl.style.margin='2px 0 6px';
        wl.textContent=n.approverRole?('-> '+(who||'(no person set - set it in Job Roles)')):'Pick a role; the person auto-fills from Job Roles.'; card.appendChild(wl);
        const nc=document.createElement('div'); nc.className='chips'; roleList().forEach(r=>{ const c=document.createElement('span'); c.className='chip'+((n.notifyRoles||[]).includes(r.role)?' on':''); c.textContent=r.role.split(' ')[0]; c.title=r.role; c.onclick=()=>{ n.notifyRoles=tog(n.notifyRoles||[],r.role); persist(); renderProps(); }; nc.appendChild(c); });
        card.appendChild(fld('Notify roles when completed',nc));
      }
      const es=document.createElement('select'); [['','No escalation'],['role','Escalate to a role'],['process','Escalate to a process']].forEach(v=>{ const o=document.createElement('option'); o.value=v[0]; o.textContent=v[1]; if(n.escalateType===v[0])o.selected=true; es.appendChild(o); }); es.onchange=()=>{ n.escalateType=es.value; n.escalateTo=''; persist(); renderProps(); renderCanvas(); }; card.appendChild(fld('Escalate',es));
      if(n.escalateType==='role'){ const rsel=document.createElement('select'); const b=document.createElement('option'); b.value=''; b.textContent='(choose role)'; rsel.appendChild(b); roleList().forEach(r=>{ const o=document.createElement('option'); o.value=r.role; o.textContent=r.role; if(n.escalateTo===r.role)o.selected=true; rsel.appendChild(o); }); rsel.onchange=()=>{ n.escalateTo=rsel.value; persist(); renderProps(); renderCanvas(); }; card.appendChild(fld('Escalate to role',rsel)); if(n.escalateTo){ const p=personForRole(n.escalateTo); const d=document.createElement('div'); d.className='muted'; d.style.margin='2px 0 4px'; d.textContent='-> '+(p||'(no person set)'); card.appendChild(d); } }
      else if(n.escalateType==='process'){ const psel=document.createElement('select'); const b=document.createElement('option'); b.value=''; b.textContent='(choose process / role flow)'; psel.appendChild(b); listWorkflows().forEach(it=>{ if(it.key===curKey)return; const o=document.createElement('option'); o.value=it.key; o.textContent=(it.view==='role'?'[Role] ':'[Module] ')+it.title; if(n.escalateTo===it.key)o.selected=true; psel.appendChild(o); }); psel.onchange=()=>{ n.escalateTo=psel.value; persist(); renderProps(); renderCanvas(); }; card.appendChild(fld('Escalate to process',psel)); }
      const cm=document.createElement('textarea'); cm.rows=2; cm.placeholder='Comment (optional)'; cm.value=n.comment||''; cm.oninput=()=>{ n.comment=cm.value; persist(); }; card.appendChild(fld('Comment',cm));
      const del=document.createElement('button'); del.className='btn sm'; del.style.marginTop='8px'; del.textContent='Delete step'; del.onclick=()=>{ model.nodes=model.nodes.filter(x=>x.id!==n.id); model.edges=model.edges.filter(e=>e.from!==n.id&&e.to!==n.id); sel=null; persist(); renderAll(); }; card.appendChild(del);
    }
  } else if(sel&&sel.type==='edge'){ const e=model.edges.find(x=>x.id===sel.id);
    if(e){ card.innerHTML='<div class="mini">Selected arrow</div>';
      const lab=document.createElement('input'); lab.type='text'; lab.className='full'; lab.placeholder='e.g. Yes / No'; lab.value=e.label||''; lab.oninput=()=>{ e.label=lab.value; persist(); renderCanvas(); }; card.appendChild(fld('Label',lab));
      const del=document.createElement('button'); del.className='btn sm'; del.style.marginTop='8px'; del.textContent='Delete arrow'; del.onclick=()=>{ model.edges=model.edges.filter(x=>x.id!==e.id); sel=null; persist(); renderAll(); }; card.appendChild(del);
    }
  } else { card.innerHTML='<div class="muted">Click a shape or arrow to edit it.<br><br>Drag shapes from the left onto the canvas. Hover a shape and drag one of its dots onto another shape to connect them. Double-click a shape to rename it.</div>'; }
  P.appendChild(card);
  const gn=document.createElement('div'); const gl=document.createElement('div'); gl.className='mini'; gl.textContent='General notes'; gn.appendChild(gl);
  const gta=document.createElement('textarea'); gta.rows=2; gta.value=model.generalNotes||''; gta.oninput=()=>{ model.generalNotes=gta.value; persist(); }; gn.appendChild(gta); P.appendChild(gn);
  const dv=document.createElement('div'); dv.className='divider'; P.appendChild(dv);
  const ex=document.createElement('div'); ex.className='exportrow';
  ex.appendChild(btn('Export JSON','primary',exportJSON)); ex.appendChild(btn('Summary (MD)','',exportMD));
  ex.appendChild(btn('Export PNG','',exportPNG)); ex.appendChild(btn('Export SVG','',exportSVGf)); ex.appendChild(btn('Print','',()=>window.print()));
  const imp=document.createElement('label'); imp.className='btn sm'; imp.style.cursor='pointer'; imp.textContent='Import'; const fi=document.createElement('input'); fi.type='file'; fi.accept='.json'; fi.style.display='none'; fi.onchange=importJSON; imp.appendChild(fi); ex.appendChild(imp);
  ex.appendChild(btn('Reset','',resetWorkflow));
  P.appendChild(ex);
}
function btn(t,c,f){ const b=document.createElement('button'); b.className='btn sm '+c; b.textContent=t; b.onclick=f; return b; }
function nl(id){ const n=model.nodes.find(x=>x.id===id); return n?n.label.replace(/\n/g,' '):id; }
function payload(){ return { workflow:model.title, key:model.key, module:model.module, role:model.role, status:model.status||'', view:model.view||curView, order:orderOf(curKey,''), reviewer:reviewerEl.value||'(unnamed)', editedAt:new Date().toISOString(), generalNotes:model.generalNotes||'',
  steps:model.nodes.map(n=>({ id:n.id, label:n.label, type:n.type, x:n.x, y:n.y, gate:!!n.gate, approverRole:n.approverRole||'', approverPerson:personForRole(n.approverRole||''), notifyRoles:n.notifyRoles||[], notifyPeople:(n.notifyRoles||[]).map(personForRole).filter(Boolean), escalateType:n.escalateType||'', escalateTo:n.escalateTo||'', escalateToLabel:(n.escalateType==='role'?n.escalateTo:(workflowTitle(n.escalateTo)||'')), escalateToPerson:(n.escalateType==='role'?personForRole(n.escalateTo):''), comment:n.comment||'', goesTo:model.edges.filter(e=>e.from===n.id).map(e=>({ to:nl(e.to), toId:e.to, when:e.label||'' })) })) }; }
function dl(name,text,type){ const b=new Blob([text],{type:type}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
function slug(s){ return String(s).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,''); }
function fn(){ return slug(model.title)+'-'+slug(reviewerEl.value||'is'); }
function exportJSON(){ dl(fn()+'.json', JSON.stringify(payload(),null,2),'application/json'); }
function exportMD(){ const p=payload(); const L=['# Workflow: '+p.workflow,'Reviewer: '+p.reviewer+'  |  '+p.editedAt.slice(0,10)]; if(p.module||p.role)L.push('Module: '+p.module+'  |  Role: '+p.role); if(p.generalNotes)L.push('\nGeneral notes: '+p.generalNotes); L.push('\n## Steps'); p.steps.forEach(s=>{ L.push('\n- ['+s.type+'] '+s.label.replace(/\n/g,' ')); s.goesTo.forEach(g=>L.push('    -> '+(g.when?'('+g.when+') ':'')+g.to)); if(s.gate){ L.push('    APPROVAL GATE'); if(s.approverRole)L.push('      approver role: '+s.approverRole+(s.approverPerson?' ('+s.approverPerson+')':'')); if(s.notifyRoles&&s.notifyRoles.length)L.push('      notify roles: '+s.notifyRoles.join(', ')); } if(s.escalateType)L.push('    ESCALATES ('+s.escalateType+') -> '+(s.escalateToLabel||s.escalateTo)+(s.escalateToPerson?' ('+s.escalateToPerson+')':'')); if(s.comment)L.push('    note: '+s.comment); }); dl(fn()+'.md', L.join('\n'),'text/markdown'); }
function standaloneSVG(){ let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9; model.nodes.forEach(n=>{ const s=sizeOf(n); minx=Math.min(minx,n.x); miny=Math.min(miny,n.y); maxx=Math.max(maxx,n.x+s.w); maxy=Math.max(maxy,n.y+s.h); }); if(minx>maxx){minx=0;miny=0;maxx=200;maxy=200;} const pad=24; minx-=pad;miny-=pad;maxx+=pad;maxy+=pad; const w=maxx-minx,h=maxy-miny;
  const style='<style>.edge{fill:none;stroke:#5f7378;stroke-width:2}.edge-hit{display:none}.handle{display:none}.selbox{display:none}.elabel{font-size:12px;fill:#7a3d00;font-weight:600}.elabelbg{fill:#fff;stroke:#e4e7e7}.nlabel{font-family:Segoe UI,Arial,sans-serif}text{font-family:Segoe UI,Arial,sans-serif}</style>';
  const defs='<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#5f7378"/></marker></defs>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+minx+' '+miny+' '+w+' '+h+'" width="'+w+'" height="'+h+'">'+style+defs+'<rect x="'+minx+'" y="'+miny+'" width="'+w+'" height="'+h+'" fill="#ffffff"/>'+EDG.innerHTML.replace(/marker-end="url\(#arrowSel\)"/g,'marker-end="url(#arrow)"')+NOD.innerHTML+'</svg>'; }
function exportSVGf(){ dl(fn()+'.svg', standaloneSVG(),'image/svg+xml'); }
function exportPNG(){ const s=standaloneSVG(); const img=new Image(); const url='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(s))); img.onload=()=>{ const c=document.createElement('canvas'); const sc=2; c.width=img.width*sc; c.height=img.height*sc; const ctx=c.getContext('2d'); ctx.scale(sc,sc); ctx.drawImage(img,0,0); c.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fn()+'.png'; a.click(); },'image/png'); }; img.src=url; }
function importJSON(ev){ const f=ev.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ const p=JSON.parse(r.result); if(p.steps){ model.nodes=p.steps.map(s=>initNode({id:s.id,label:s.label,type:s.type,x:s.x,y:s.y,gate:!!s.gate,approverRole:s.approverRole||'',notifyRoles:s.notifyRoles||[],escalateType:s.escalateType||'',escalateTo:s.escalateTo||'',comment:s.comment||''})); model.edges=[]; p.steps.forEach(s=>(s.goesTo||[]).forEach(g=>model.edges.push({id:'e'+(seqId++),from:s.id,to:g.toId,label:g.when||''}))); if(p.workflow)model.title=p.workflow; if(p.module!=null)model.module=p.module; if(p.role!=null)model.role=p.role; model.generalNotes=p.generalNotes||''; if(model.nodes.some(n=>typeof n.x!=='number'))layout(model); persist(); buildPicker(); renderAll(); fitView(); alert('Imported.'); } }catch(e){ alert('Could not read that file.'); } }; r.readAsText(f); }
function buildPicker(){ const pk=document.getElementById('picker'); pk.innerHTML=''; listWorkflows().filter(it=>it.view===curView).forEach(it=>{ const o=document.createElement('option'); o.value=it.key; o.textContent=it.order+'. '+it.title; pk.appendChild(o); }); if(curKey)pk.value=curKey; }
function loadWorkflow(){ model=loadModel(curKey); if(!model){ init(); return; } document.getElementById('draftBadge').innerHTML=(model.status&&/draft/i.test(model.status))?'<span class="draft">DRAFT</span>':''; document.getElementById('order').value=orderOf(curKey,''); document.getElementById('delwf').style.display=customList().some(c=>c.key===curKey)?'':'none'; sel=null; buildPicker(); renderAll(); fitView(); }
function newWorkflow(){ const key='custom-'+Date.now(); const orders=listWorkflows().filter(x=>x.view===curView).map(x=>x.order); const nx=(orders.length?Math.max.apply(null,orders):0)+1; const m={ key:key,title:'New workflow',module:(curView==='role'?'Role workflow':'Custom'),role:'',status:'DRAFT',view:curView,generalNotes:'',nodes:[initNode({id:'n1',type:'startEnd',label:'Start',x:60,y:60})],edges:[] }; localStorage.setItem(eKey(key),JSON.stringify(m)); const cl=customList(); cl.push({key:key,title:m.title,view:curView}); setCustomList(cl); localStorage.setItem('wf-order:'+key,String(nx)); curKey=key; loadWorkflow(); }
function deleteWorkflow(){ if(!customList().some(c=>c.key===curKey)){ alert('Built-in workflows cannot be deleted. Use Reset to undo edits.'); return; } if(!confirm('Delete this workflow permanently?'))return; localStorage.removeItem(eKey(curKey)); localStorage.removeItem('wf-order:'+curKey); setCustomList(customList().filter(c=>c.key!==curKey)); curKey=null; init(); }
function resetWorkflow(){ if(customList().some(c=>c.key===curKey)){ alert('This is a workflow you created - use Delete to remove it.'); return; } if(confirm('Discard your edits and restore the original?')){ localStorage.removeItem(eKey(curKey)); loadWorkflow(); } }
document.getElementById('viewSel').onchange=function(){ curView=this.value; rolesMode=false; const items=listWorkflows().filter(it=>it.view===curView); curKey=items.length?items[0].key:null; if(curKey){ loadWorkflow(); } else { newWorkflow(); } };
document.getElementById('rolesBtn').onclick=function(){ rolesMode=!rolesMode; renderProps(); };
document.getElementById('picker').onchange=function(){ curKey=this.value; rolesMode=false; loadWorkflow(); };
document.getElementById('order').onchange=function(){ if(curKey){ localStorage.setItem('wf-order:'+curKey,String(Number(this.value)||1)); buildPicker(); } };
document.getElementById('newwf').onclick=newWorkflow;
document.getElementById('delwf').onclick=deleteWorkflow;
document.getElementById('arrange').onclick=()=>{ layout(model); persist(); renderAll(); fitView(); };
document.getElementById('zin').onclick=()=>{ view.k=Math.min(3,view.k*1.15); applyView(); };
document.getElementById('zout').onclick=()=>{ view.k=Math.max(0.25,view.k*0.87); applyView(); };
document.getElementById('zfit').onclick=fitView;
function init(){ renderPalette(); const items=listWorkflows().filter(it=>it.view===curView); curKey=items.length?items[0].key:null; if(curKey)loadWorkflow(); else newWorkflow(); }
document.getElementById('viewSel').value=curView;
init();
