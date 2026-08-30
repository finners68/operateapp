/* ============================================================
   IDEAS
   ============================================================ */
let ideaFilter = 'all';
let selectedIdeaId = null;
var ideasStale = false; // true once the tab has rendered — suppresses the entrance animation on re-render so nothing jumps
let contentMode = 'ideas'; // 'ideas' | 'notes' — the two views under the merged Ideas / Notes section
Object.defineProperty(window, 'contentMode', {
  get(){ return contentMode; },
  set(v){ contentMode = v; },
  configurable: true
});
Object.defineProperty(window, 'selectedIdeaId', {
  get(){ return selectedIdeaId; },
  set(v){ selectedIdeaId = v; },
  configurable: true
});
function getContentTabState(){
  return {
    mode: contentMode,
    ideaFilter,
    noteSearch: (typeof noteSearch !== 'undefined' ? noteSearch : ''),
    selectedIdeaId
  };
}
function reactContentLive(){
  return typeof OperateReact !== 'undefined'
    && OperateReact
    && typeof OperateReact.isContentTabMounted === 'function'
    && OperateReact.isContentTabMounted();
}
function refreshContentTabView(){
  if(reactContentLive()){
    if(typeof OperateReact.refreshContentTab === 'function') OperateReact.refreshContentTab();
    if(typeof setFab === 'function') setFab();
    return true;
  }
  return false;
}
function setContentMode(m){
  if(contentMode===m) return;
  contentMode=m;
  ideasStale=false;
  haptic();
  if(typeof saveNavState==='function') saveNavState();
  deselectIdea();
  if(refreshContentTabView()) return;
  if(typeof swapContentModePanel==='function' && swapContentModePanel()) return;
  renderView();
}
function goNotes(){ contentMode='notes'; go('ideas'); }
function contentModeMeta(){
  const isNotes = contentMode==='notes';
  const inFolder = !!(overlay && overlay.type === 'noteFolder' && overlay.id);
  const addAction = isNotes
    ? (inFolder ? `sheetNoteAddChoice('${overlay.id}')` : 'sheetNoteAddChoice()')
    : 'sheetIdea()';
  return {
    sub: isNotes ? notesSub() : ideasSub(),
    headBtn: `<button class="header-btn" onclick="${addAction}">${ICON.plus(22)}</button>`
  };
}
function contentModePanelInner(){
  const isNotes = contentMode==='notes';
  if(isNotes){
    return `${notesControls()}<div id="notes-list-body" style="margin-top:8px">${notesListBody()}</div>`;
  }
  return `${ideasControls()}<div class="section" style="margin-top:8px">${ideasListBody()}</div>`;
}
function refreshContentModeChrome(){
  const meta = contentModeMeta();
  const sub = document.getElementById('content-mode-sub');
  const actions = document.getElementById('content-mode-actions');
  if(sub) sub.textContent = meta.sub;
  if(actions) actions.innerHTML = meta.headBtn;
  if(typeof syncSeg==='function') syncSeg('content-mode-seg', contentMode);
}
function swapContentModePanel(){
  const panel = document.getElementById('content-mode-panel');
  if(!panel || store.tab !== 'ideas' || overlay) return false;
  deselectIdea();
  panel.innerHTML = contentModePanelInner();
  refreshContentModeChrome();
  setFab();
  return true;
}
/* Merged Ideas / Notes tab — 50/50 toggle switches the view. */
function viewContentTab(){
  deselectIdea();
  const meta = contentModeMeta();
  const isNotes = contentMode==='notes';
  return `
  <div class="tab-page" id="content-mode-page">
    <div class="tab-page-sticky">
      <div class="lg-header">
        <div><div class="lg-title">Ideas / Notes</div><div class="lg-sub" id="content-mode-sub">${esc(meta.sub)}</div></div>
        <div id="content-mode-actions">${meta.headBtn}</div>
      </div>
      <div class="hub-bar"><div class="seg hub-seg" id="content-mode-seg">
        <button type="button" data-v="ideas" class="${isNotes?'':'on'}" onclick="setContentMode('ideas')">${ICON.idea(15)} Ideas</button>
        <button type="button" data-v="notes" class="${isNotes?'on':''}" onclick="setContentMode('notes')">${ICON.note(15)} Notes</button>
      </div></div>
    </div>
    <div class="screen-pad tab-page-body" id="content-mode-panel">${contentModePanelInner()}<div class="spacer"></div></div>
  </div>`;
}
function ideasSub(){ const toUse=sel.ideas().filter(i=>!i.done).length; return 'Content to shoot · '+toUse+' waiting'; }
function ideaChips(){
  const all=sel.ideas();
  const typesPresent=[...new Set(all.map(i=>i.type))];
  const chips=[{k:'all',l:'All '+all.length},{k:'active',l:'To use'},{k:'done',l:'Done'}, ...typesPresent.map(t=>({k:t,l:IDEA_TYPES[t].label}))];
  return chips.map(c=>`<button class="chip ${ideaFilter===c.k?'on':''}" onclick="setIdeaFilter('${c.k}')">${esc(c.l)}</button>`).join('');
}
function ideasControls(){
  return `
    ${pageIntro('ideas', 'Capture content ideas', 'Reels, hooks and captions live here. Tap ＋ to add one, then open it to link it to a show.')}
    <div class="chips" style="margin-top:2px">${ideaChips()}</div>`;
}
function ideasListBody(){
  deselectIdea();
  const SA = ideasStale ? '' : ' stagger';
  ideasStale = true;
  const all = sel.ideas();
  let list = all;
  if(ideaFilter==='active') list = all.filter(i=>!i.done);
  else if(ideaFilter==='done') list = all.filter(i=>i.done);
  else if(ideaFilter!=='all') list = all.filter(i=>i.type===ideaFilter);
  const grouped = (ideaFilter==='all'||ideaFilter==='active');
  const typeKey = i => IDEA_TYPES[i.type] ? i.type : 'other';
  const PRIO_RANK = {high:0, med:1, low:2};
  if(!list.length){
    return `<div class="empty"><div class="ic">${ICON.idea(28)}</div><b>No ideas yet</b><span>Type above to capture a reel hook, caption or content plan — link it to a show later.</span><button class="btn secondary" style="margin-top:14px;max-width:240px" onclick="sheetIdea()">${ICON.plus(18)} New idea</button></div>`;
  } else if(grouped){
    const active = list.filter(i=>!i.done);
    const done = ideaFilter==='all'? list.filter(i=>i.done):[];
    const byType = t => active.filter(i=>typeKey(i)===t).sort((a,b)=>(PRIO_RANK[a.prio]??1)-(PRIO_RANK[b.prio]??1));
    return Object.entries(IDEA_TYPES).map(([t,def])=>{ const g=byType(t); if(!g.length) return '';
      return `<div class="prio-head"><span class="pd" style="background:${def.color}"></span>${def.label} · ${g.length}</div><div class="idea-grid${SA}">${g.map(ideaCard).join('')}</div>`;
    }).join('') + (done.length?`<div class="prio-head"><span class="pd" style="background:var(--text-3)"></span>Done · ${done.length}</div><div class="idea-grid">${done.map(ideaCard).join('')}</div>`:'');
  } else {
    return `<div class="idea-grid${SA}">${list.map(ideaCard).join('')}</div>`;
  }
}
function setIdeaFilter(k){ ideaFilter=k; haptic(); if(refreshContentTabView()) return; renderView(); }
/* Tap a card to select it in place — no navigation. A floating bar with
   Edit / Done / Delete appears; tap the same card (or ✕) to deselect. */
function toggleIdeaSelect(ev, id){
  if(ev && ev.target && ev.target.closest && ev.target.closest('.idea-sel-btn')) return;
  if(ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  if(selectedIdeaId===id){ deselectIdea(); return; }
  selectedIdeaId = id;
  if(reactContentLive()){
    if(typeof notifyStore === 'function') notifyStore();
    showIdeaActionBar(id);
    haptic();
    return;
  }
  document.querySelectorAll('.idea.sel').forEach(c=>c.classList.remove('sel'));
  const card = document.querySelector(`.idea[data-idea="${id}"]`);
  if(card) card.classList.add('sel');
  showIdeaActionBar(id);
  haptic();
}
function deselectIdea(){
  const had = selectedIdeaId;
  selectedIdeaId = null;
  document.querySelectorAll('.idea.sel').forEach(c=>c.classList.remove('sel'));
  const bar = document.getElementById('idea-actionbar');
  if(bar) bar.remove();
  if(had && reactContentLive() && typeof notifyStore === 'function') notifyStore();
}
function showIdeaActionBar(id){
  const i = store.ideas.find(x=>x.id===id);
  if(!i) return;
  let bar = document.getElementById('idea-actionbar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'idea-actionbar';
    (document.getElementById('app')||document.body).appendChild(bar);
  }
  bar.innerHTML = `
    <button onclick="deselectIdea();sheetIdea('${id}')">${ICON.edit(18)}<span>Edit</span></button>
    <button onclick="toggleIdeaDone('${id}')">${ICON.check(19)}<span>${i.done?'To use':'Done'}</span></button>
    <button class="danger" onclick="confirmDeleteIdeaInline('${id}')">${ICON.trash(18)}<span>Delete</span></button>
    <button class="close" onclick="deselectIdea()">${ICON.x(17)}</button>`;
  requestAnimationFrame(()=>bar.classList.add('on'));
}
function confirmDeleteIdeaInline(iid){
  confirmSheet('Delete idea?','This can\'t be undone.','Delete',()=>{
    store.ideas = store.ideas.filter(x=>x.id!==iid);
    if(typeof deleteIdeaNow === 'function') deleteIdeaNow(iid);
    else persist('ideas', iid);
    deselectIdea(); renderView(); toast('Idea deleted','trash');
  }, true);
}
function quickIdea(){
  const el=document.getElementById('idea-quick'); const v=el?el.value.trim():'';
  if(!v){ if(el)el.focus(); return; }
  const idea = {id:uid('idea'), type:'other', title:v, prio:'med', done:false, created:nowMs(), note:'', eventId:null, tripId:null};
  store.ideas.push(idea);
  persist('ideas', idea.id);
  if(typeof pushIdeaNow === 'function') pushIdeaNow(idea);
  renderView(); toast('Idea captured','idea');
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

/* Show picker for linking ideas — search + dropdown grouped by month. */
let ideaShowPickSearch = '';
let ideaShowPickCtx = null;
let ideaShowPickT;

function ideaShowSelectOptionsHtml(q, selectedId){
  let list = sel.events().slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const query = (q || '').toLowerCase().trim();
  if(query){
    list = list.filter(e =>
      `${e.venue||''} ${e.city||''} ${e.country||''} ${e.date||''} ${fmtDate(e.date)} ${fmtDayDate(e.date)}`.toLowerCase().includes(query)
    );
  }
  if(!list.length){
    return `<option value="">${query ? 'No matching shows' : 'No shows yet'}</option>`;
  }
  const groups = groupShowsByMonth(list);
  let html = `<option value="">Not linked</option>`;
  groups.forEach(g => {
    html += `<optgroup label="${esc(g.label)}">`;
    g.items.forEach(e => {
      const show = esc(e.venue || 'Untitled show');
      const location = esc([e.city, e.country].filter(Boolean).join(', ') || '—');
      const when = esc(fmtDayDate(e.date) || '—');
      const label = `${show} · ${location} · ${when}`;
      html += `<option value="${e.id}"${selectedId===e.id?' selected':''}>${label}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

function openIdeaShowPicker(iid){
  ideaShowPickSearch = '';
  ideaShowPickCtx = { iid };
  const i = store.ideas.find(x=>x.id===iid);
  openSheetReact('Link to a show', 'idea.showPicker', { iid, selectedId: i?.eventId || null });
  setTimeout(()=>{ const el=document.getElementById('idea-show-pick-search'); if(el) el.focus(); }, 320);
}

function debouncedIdeaShowPick(){
  clearTimeout(ideaShowPickT);
  ideaShowPickT = setTimeout(refreshIdeaShowPicker, 160);
}

function refreshIdeaShowPicker(){
  const ctx = ideaShowPickCtx;
  const selEl = document.getElementById('idea-show-pick-select');
  if(!selEl || !ctx) return;
  const searchEl = document.getElementById('idea-show-pick-search');
  const pos = searchEl ? searchEl.selectionStart : 0;
  const selected = selEl.value || null;
  selEl.innerHTML = ideaShowSelectOptionsHtml(ideaShowPickSearch, selected);
  if(searchEl){ searchEl.focus(); try{ searchEl.setSelectionRange(pos,pos); }catch(e){} }
}

function confirmIdeaShowPick(){
  const ctx = ideaShowPickCtx;
  const eventId = document.getElementById('idea-show-pick-select')?.value || null;
  if(!ctx || !eventId){ toast('Choose a show','x'); return; }
  pickIdeaShow(ctx.iid, eventId);
}

function pickIdeaShow(iid, eventId){
  doAttachIdea(iid, 'event', eventId);
}

function debouncedIdeaEventSelect(){
  clearTimeout(ideaShowPickT);
  ideaShowPickT = setTimeout(refreshIdeaEventSelect, 160);
}

function refreshIdeaEventSelect(){
  const selEl = document.getElementById('id-event');
  if(!selEl) return;
  const searchEl = document.getElementById('id-event-search');
  const pos = searchEl ? searchEl.selectionStart : 0;
  const selected = selEl.value || null;
  const q = searchEl?.value || '';
  selEl.innerHTML = ideaShowSelectOptionsHtml(q, selected);
  if(searchEl){ searchEl.focus(); try{ searchEl.setSelectionRange(pos,pos); }catch(e){} }
}

function attachIdeaTo(iid, kind){
  if(kind==='event'){
    const evs=sel.events();
    if(!evs.length){ toast('No shows yet','x'); return; }
    openIdeaShowPicker(iid);
  } else {
    const trips=sel.trips().filter(t=>!t.archived);
    if(!trips.length){ toast('No trips yet','x'); return; }
    openSheetReact('Use on which trip?', 'idea.tripPicker', { iid, trips });
  }
}
function doAttachIdea(iid, kind, id){
  const i=store.ideas.find(x=>x.id===iid);
  if(kind==='event'){ i.eventId=id; i.tripId=null; } else { i.tripId=id; i.eventId=null; }
  persist('ideas', iid); closeSheet(); renderView(); toast('Linked','check');
}
function detachIdea(iid){ const i=store.ideas.find(x=>x.id===iid); i.eventId=null; i.tripId=null; persist('ideas', iid); renderView(); toast('Unlinked','check'); }
function attachIdeaPickForEvent(eid){
  const avail=sel.ideas().filter(i=>i.eventId!==eid);
  openSheetReact('Add a content idea', 'idea.attach', { eid, ideas: avail });
}
/* ============================================================
   IDEA — create / edit
   ============================================================ */
function sheetIdea(iid){
  const i = iid? store.ideas.find(x=>x.id===iid):null;
  openSheetReact(iid?'Edit idea':'New idea', 'idea.edit', { iid, idea: i });
}
function chipPick(el){ el.parentElement.querySelectorAll('.chip').forEach(c=>{c.classList.remove('on');c.style.cssText='';}); el.classList.add('on'); const col=IDEA_TYPES[el.dataset.v].color; el.style.cssText=`background:${col};color:#fff;border-color:${col}`; haptic(); }
function getChip(id){ const el=document.querySelector('#'+id+' .chip.on'); return el?el.dataset.v:'reel'; }
function saveIdea(iid){
  const title = val('id-title');
  if(!title){ toast('Describe the idea','x'); return; }
  const evSel = document.getElementById('id-event');
  const eventId = evSel ? (evSel.value || null) : null;
  const data = {title, type:getChip('id-type'), prio:getSeg('id-prio')||'med', note:rawVal('id-note')};
  withButton($('#id-save'), ()=>{
    let ideaId = iid;
    if(iid){
      const idea = store.ideas.find(x=>x.id===iid);
      Object.assign(idea, data);
      // Linking to a show clears any trip link; "Not linked" only clears a show link
      if(eventId){ idea.eventId=eventId; idea.tripId=null; } else { idea.eventId=null; }
    } else {
      ideaId = uid('idea');
      store.ideas.push(Object.assign({id:ideaId, done:false, created:nowMs(), eventId, tripId:null}, data));
    }
    persist('ideas', ideaId);
    if(typeof pushIdeaNow === 'function'){
      const idea = store.ideas.find(x=>x.id===ideaId);
      if(idea) pushIdeaNow(idea);
    }
    closeSheet(); renderView();
  }, iid?'Idea updated':'Idea saved');
}
function editIdea(iid){ back(); setTimeout(()=>sheetIdea(iid),60); }
function toggleIdeaDoneFromCard(ev, iid){
  if(ev){
    ev.stopPropagation();
    ev.preventDefault();
  }
  toggleIdeaDone(iid);
}
function toggleIdeaDone(iid){
  const i=store.ideas.find(x=>x.id===iid);
  if(!i) return;
  i.done=!i.done;
  persist('ideas', iid);
  if(typeof pushIdeaNow === 'function') pushIdeaNow(i);

  const hideAfterToggle = (ideaFilter === 'active' && i.done) || (ideaFilter === 'done' && !i.done);
  if(hideAfterToggle){
    const keepSel = selectedIdeaId;
    softRender();
    if(keepSel === iid){
      const card = document.querySelector(`.idea[data-idea="${iid}"]`);
      if(card){
        card.classList.add('sel');
        showIdeaActionBar(iid);
      } else deselectIdea();
    }
  } else {
    const card = document.querySelector(`.idea[data-idea="${iid}"]`);
    if(card) card.classList.toggle('is-done', !!i.done);
    if(selectedIdeaId === iid) showIdeaActionBar(iid);
  }

  toast(i.done?'Marked done':'Back in the list', i.done?'check':'arrowUp');
}
function saveIdeaNote(iid,v){
  const i=store.ideas.find(x=>x.id===iid);
  if(i){
    i.note=v;
    persist('ideas', iid);
    if(typeof pushIdeaNow === 'function') pushIdeaNow(i);
  }
}

