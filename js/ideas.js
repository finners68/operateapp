/* ============================================================
   IDEAS
   ============================================================ */
let ideaFilter = 'all';
function viewIdeas(){
  const all = sel.ideas();
  let list = all;
  if(ideaFilter==='active') list = all.filter(i=>!i.done);
  else if(ideaFilter==='done') list = all.filter(i=>i.done);
  else if(ideaFilter!=='all') list = all.filter(i=>i.type===ideaFilter);
  const typesPresent = [...new Set(all.map(i=>i.type))];
  const chips = [{k:'all',l:'All '+all.length},{k:'active',l:'To use'},{k:'done',l:'Done'}, ...typesPresent.map(t=>({k:t,l:IDEA_TYPES[t].label}))];
  const toUse = all.filter(i=>!i.done).length;

  // Body: when showing "to use"/all unfiltered, group by priority; else flat grid
  let body;
  const grouped = (ideaFilter==='all'||ideaFilter==='active');
  if(!list.length){
    body = `<div class="empty"><div class="ic">${ICON.idea(28)}</div><b>No ideas here</b><span>Capture a reel concept, hook or caption above.</span></div>`;
  } else if(grouped){
    const active = list.filter(i=>!i.done);
    const done = ideaFilter==='all'? list.filter(i=>i.done):[];
    const byP = p => active.filter(i=>i.prio===p);
    const groups = [['high','High priority'],['med','Medium'],['low','Low']];
    body = groups.map(([p,label])=>{ const g=byP(p); if(!g.length) return '';
      return `<div class="prio-head"><span class="pd" style="background:${PRIO[p]}"></span>${label} · ${g.length}</div><div class="idea-grid stagger">${g.map(ideaCard).join('')}</div>`;
    }).join('') + (done.length?`<div class="prio-head"><span class="pd" style="background:var(--text-3)"></span>Done · ${done.length}</div><div class="idea-grid">${done.map(ideaCard).join('')}</div>`:'');
  } else {
    body = `<div class="idea-grid stagger">${list.map(ideaCard).join('')}</div>`;
  }

  return `
  <div class="lg-header">
    <div><div class="lg-title">Ideas</div><div class="lg-sub">Your creative brain · ${toUse} to use</div></div>
    <button class="header-btn" onclick="sheetIdea()">${ICON.plus(22)}</button>
  </div>
  <div class="screen-pad">
    <div class="idea-capture">
      <input id="idea-quick" placeholder="Capture an idea…" onkeydown="if(event.key==='Enter')quickIdea()">
      <button onclick="quickIdea()">${ICON.plus(20)}</button>
    </div>
    <div class="chips" style="margin-top:10px">${chips.map(c=>`<button class="chip ${ideaFilter===c.k?'on':''}" onclick="setIdeaFilter('${c.k}')">${esc(c.l)}</button>`).join('')}</div>
    <div class="section" style="margin-top:8px">${body}</div>
    <div class="spacer"></div>
  </div>`;
}
function setIdeaFilter(k){ ideaFilter=k; haptic(); renderView(); }
function quickIdea(){
  const el=document.getElementById('idea-quick'); const v=el?el.value.trim():'';
  if(!v){ if(el)el.focus(); return; }
  store.ideas.push({id:uid('idea'), type:'other', title:v, prio:'med', done:false, created:nowMs(), note:'', eventId:null, tripId:null});
  persist(); renderView(); toast('Idea captured','idea');
  setTimeout(()=>{ const n=document.getElementById('idea-quick'); if(n) n.focus(); },50);
}
/* ============================================================
   IDEA DETAIL
   ============================================================ */
function viewIdea(id){
  const i = store.ideas.find(x=>x.id===id);
  if(!i) return backStub();
  const t = IDEA_TYPES[i.type]||IDEA_TYPES.other;
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Ideas</button>
    <button class="header-btn" style="width:36px;height:36px" onclick="confirmDeleteIdea('${i.id}')">${ICON.trash(17)}</button>
  </div></div>
  <div class="screen-pad stagger">
    <div class="dhero" style="background:linear-gradient(155deg,${t.color}33,var(--card) 65%)">
      <div class="cat-bar" style="background:${t.color}"></div>
      <div style="margin-bottom:8px"><span class="tag" style="background:${t.color}22;color:${t.color}">${ICON[t.icon](0)}${t.label}</span></div>
      <h1 style="font-size:22px">${esc(i.title)}</h1>
      <div class="meta-row">
        <span class="meta-chip"><span class="prio" style="background:${PRIO[i.prio]}"></span>${i.prio} priority</span>
        <span class="meta-chip">${ICON.clock(13)} ${timeAgo(i.created)}</span>
      </div>
    </div>
    <div class="section" style="margin-top:16px">
      <div class="card"><textarea class="textarea" placeholder="Add details, script, references…" onblur="saveIdeaNote('${i.id}',this.value)">${esc(i.note||'')}</textarea></div>
    </div>

    <div class="block"><div class="block-title">Use it on</div>
      ${(i.eventId||i.tripId)?`
      <div class="card flush">
        ${i.eventId&&sel.event(i.eventId)?`<div class="row" onclick="openView('event','${i.eventId}')"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.music(17)}</div><div class="body"><b>${esc(sel.event(i.eventId).venue)}</b><span>${esc(sel.event(i.eventId).city)} · ${esc(relDay(sel.event(i.eventId).date))}</span></div><button class="del" style="opacity:.6" onclick="event.stopPropagation();detachIdea('${i.id}')">${ICON.x(16)}</button></div>`:''}
      </div>`:`
      <button class="btn secondary" onclick="attachIdeaTo('${i.id}','event')">${ICON.music(15)} Link to a show</button>`}
    </div>

    <div class="section">
      <button class="btn ${i.done?'secondary':''}" onclick="toggleIdeaDone('${i.id}')">${i.done?ICON.arrowUp(17)+' Mark as still to use':ICON.check(18)+' Mark as done'}</button>
    </div>
    <div class="section"><button class="btn secondary" onclick="editIdea('${i.id}')">${ICON.edit(16)} Edit idea</button></div>
    <div class="section"><button class="btn danger" onclick="confirmDeleteIdea('${i.id}')">${ICON.trash(17)} Delete idea</button></div>
    <div class="spacer"></div>
  </div>`;
}
function attachIdeaTo(iid, kind){
  if(kind==='event'){
    const evs=sel.events();
    if(!evs.length){ toast('No shows yet','x'); return; }
    openSheet('Use on which show?', `<div class="card flush">${evs.map(e=>`<div class="row" onclick="doAttachIdea('${iid}','event','${e.id}')"><div class="ic" style="background:${CATS[e.color]||CATS.purple}22;color:${CATS[e.color]||CATS.purple}">${ICON.music(17)}</div><div class="body"><b>${esc(e.venue)}</b><span>${esc(e.city)} · ${esc(relDay(e.date))}</span></div>${ICON.chevR(15)}</div>`).join('')}</div><div class="spacer"></div>`);
  } else {
    const trips=sel.trips().filter(t=>!t.archived);
    if(!trips.length){ toast('No trips yet','x'); return; }
    openSheet('Use on which trip?', `<div class="card flush">${trips.map(t=>`<div class="row" onclick="doAttachIdea('${iid}','trip','${t.id}')"><div class="ic" style="background:${CATS[t.color]||CATS.purple}22;color:${CATS[t.color]||CATS.purple}">${ICON.bag(17)}</div><div class="body"><b>${esc(t.name)}</b><span>${sel.tripEvents(t.id).length} shows</span></div>${ICON.chevR(15)}</div>`).join('')}</div><div class="spacer"></div>`);
  }
}
function doAttachIdea(iid, kind, id){
  const i=store.ideas.find(x=>x.id===iid);
  if(kind==='event'){ i.eventId=id; i.tripId=null; } else { i.tripId=id; i.eventId=null; }
  persist(); closeSheet(); renderView(); toast('Linked','check');
}
function detachIdea(iid){ const i=store.ideas.find(x=>x.id===iid); i.eventId=null; i.tripId=null; persist(); renderView(); toast('Unlinked','check'); }
function attachIdeaPickForEvent(eid){
  const avail=sel.ideas().filter(i=>i.eventId!==eid);
  openSheet('Add a content idea', `
    ${avail.length?`<div class="card flush" style="margin-bottom:12px">${avail.map(i=>{const t=IDEA_TYPES[i.type]||IDEA_TYPES.other;return `<div class="row" onclick="doAttachIdea('${i.id}','event','${eid}')"><div class="ic" style="background:${t.color}22;color:${t.color}">${ICON[t.icon](16)}</div><div class="body"><b>${esc(i.title)}</b><span>${t.label}${i.eventId||i.tripId?' · linked elsewhere':''}</span></div>${ICON.plus(15)}</div>`;}).join('')}</div>`:'<div class="hint" style="padding:6px 2px 12px">No other ideas yet.</div>'}
    <button class="btn secondary" onclick="closeSheet(); sheetIdea()">${ICON.plus(15)} New idea</button><div class="spacer"></div>
  `);
}
/* ============================================================
   IDEA — create / edit
   ============================================================ */
function sheetIdea(iid){
  const i = iid? store.ideas.find(x=>x.id===iid):null;
  openSheet(iid?'Edit idea':'New idea', `
    <div class="field"><label>Idea</label><textarea id="id-title" class="textarea" style="min-height:70px" placeholder="What's the concept?">${esc(i?i.title:'')}</textarea></div>
    <div class="field"><label>Type</label>
      <div class="swatches" id="id-type" style="gap:8px;flex-wrap:wrap">
        ${Object.entries(IDEA_TYPES).map(([k,v])=>`<button class="chip ${(i?i.type:'reel')===k?'on':''}" data-v="${k}" onclick="chipPick(this)" style="${(i?i.type:'reel')===k?`background:${v.color};color:#fff;border-color:${v.color}`:''}">${v.label}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Priority</label>
      <div class="seg" id="id-prio">
        ${[['high','High'],['med','Medium'],['low','Low']].map(([k,l])=>`<button data-v="${k}" class="${(i?i.prio:'med')===k?'on':''}" onclick="segPick(this)">${l}</button>`).join('')}
      </div>
    </div>
    <button class="btn" id="id-save" onclick="saveIdea('${iid||''}')">${iid?'Save':'Add idea'}</button>
    <div class="spacer"></div>
  `);
}
function chipPick(el){ el.parentElement.querySelectorAll('.chip').forEach(c=>{c.classList.remove('on');c.style.cssText='';}); el.classList.add('on'); const col=IDEA_TYPES[el.dataset.v].color; el.style.cssText=`background:${col};color:#fff;border-color:${col}`; haptic(); }
function getChip(id){ const el=document.querySelector('#'+id+' .chip.on'); return el?el.dataset.v:'reel'; }
function saveIdea(iid){
  const title = val('id-title');
  if(!title){ toast('Describe the idea','x'); return; }
  const data = {title, type:getChip('id-type'), prio:getSeg('id-prio')||'med'};
  withButton($('#id-save'), ()=>{
    if(iid){ Object.assign(store.ideas.find(x=>x.id===iid), data); }
    else { store.ideas.push(Object.assign({id:uid('idea'), done:false, created:nowMs(), note:''}, data)); }
    persist(); closeSheet(); renderView();
  }, iid?'Idea updated':'Idea saved');
}
function editIdea(iid){ back(); setTimeout(()=>sheetIdea(iid),60); }
function toggleIdeaDone(iid){ const i=store.ideas.find(x=>x.id===iid); i.done=!i.done; persist(); renderView(); toast(i.done?'Marked done':'Back in the list', i.done?'check':'arrowUp'); }
function saveIdeaNote(iid,v){ const i=store.ideas.find(x=>x.id===iid); if(i){i.note=v; persist();} }

