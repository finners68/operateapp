/* ============================================================
   SHOWS — list, add, edit
   ============================================================ */
let showFilter = 'upcoming';
let showSearch = '';
let showsMode = 'shows'; // 'shows' | 'tours' — the two views under the merged Shows / Tours section
Object.defineProperty(window, 'showsMode', {
  get(){ return showsMode; },
  set(v){ showsMode = v; },
  configurable: true
});
function getShowsListState(){
  return { mode: showsMode, filter: showFilter, search: showSearch };
}
function setShowSearchQuiet(v){
  showSearch = String(v == null ? '' : v);
}
function reactShowsListLive(){
  return typeof OperateReact !== 'undefined'
    && OperateReact
    && typeof OperateReact.isShowsListMounted === 'function'
    && OperateReact.isShowsListMounted();
}
function setShowsMode(m){
  if(showsMode===m) return;
  showsMode=m;
  haptic();
  if(typeof saveNavState==='function') saveNavState();
  if(reactShowsListLive()){
    if(typeof OperateReact.refreshShowsList === 'function') OperateReact.refreshShowsList();
    if(typeof setFab === 'function') setFab();
    return;
  }
  if(typeof swapShowsModePanel==='function' && swapShowsModePanel()) return;
  renderView();
}
function goToursList(){ showsMode='tours'; go('shows'); }
function showsModeMeta(){
  const all = sel.events();
  const upcomingN = all.filter(e => !showPassed(e) && e.status !== 'cancelled').length;
  const tourN = runs().length;
  const isTours = showsMode==='tours';
  return {
    title: isTours ? 'Tours' : 'Shows',
    sub: (isTours?(tourN+' tour'+(tourN!==1?'s':'')):(upcomingN+' upcoming'))+' · tap to open',
    headBtn: `<button class="header-btn" onclick="sheetEvent()">${ICON.plus(22)}</button>`
  };
}
function showsModeSearchAndChips(){
  const all = sel.events();
  const upcomingN = all.filter(e => !showPassed(e) && e.status !== 'cancelled').length;
  const chips = [
    {k:'upcoming', l:`Upcoming · ${upcomingN}`},
    {k:'all', l:'All · '+all.length},
    {k:'past', l:'Past'},
    {k:'confirmed', l:'Confirmed'},
    {k:'hold', l:'Hold'},
    {k:'cancelled', l:'Cancelled'},
  ];
  return `
    <div class="searchbar"><span class="ic">${ICON.search(18)}</span><input placeholder="Search venue or city" value="${esc(showSearch)}" oninput="showSearch=this.value;debouncedShowSearch()"></div>
    <div class="chips shows-filter-chips">${chips.map(c=>`<button class="chip ${showFilter===c.k?'on':''}" onclick="setShowFilter('${c.k}')">${esc(c.l)}</button>`).join('')}</div>`;
}
function showsModeSegHtml(){
  const isTours = showsMode==='tours';
  return `<div class="seg shows-mode-seg-compact" id="shows-mode-seg">
    <button type="button" data-v="shows" class="${isTours?'':'on'}" aria-label="Shows" onclick="setShowsMode('shows')">${ICON.music(15)}</button>
    <button type="button" data-v="tours" class="${isTours?'on':''}" aria-label="Tours" onclick="setShowsMode('tours')">${ICON.trips(15)}</button>
  </div>`;
}
function showsHeaderActionsHtml(){
  return `<div class="shows-header-actions">${showsModeSegHtml()}${showsModeMeta().headBtn}</div>`;
}
function showsStickyToolsHtml(){
  return showsMode==='tours' ? '' : showsModeSearchAndChips();
}
function showsListBody(){
  const all = sel.events();
  const q = showSearch.toLowerCase().trim();
  let list = all.slice();
  if(showFilter === 'upcoming') list = all.filter(e => !showPassed(e) && e.status !== 'cancelled');
  else if(showFilter === 'past') list = all.filter(showPassed);
  else if(showFilter === 'confirmed' || showFilter === 'hold' || showFilter === 'cancelled') list = all.filter(e => e.status === showFilter);
  if(showFilter === 'past') list.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if(q) list = list.filter(e => `${e.eventName||''} ${e.venue||''} ${e.city||''} ${e.country||''} ${e.date||''}`.toLowerCase().includes(q));
  if(!list.length){
    return `<div class="empty"><div class="ic">${ICON.music(28)}</div><b>${q?'No matches':'No shows here'}</b><span>${q?'Try another search term.':showFilter==='past'?'Past shows appear 24h after they finish.':'Tap + to add a venue, date and set time — then open the show for flights and hotels.'}</span>${q?'':`<button class="btn" style="margin-top:14px;max-width:240px" onclick="sheetEvent()">${ICON.plus(18)} Add show</button>`}</div>`;
  }
  const groups = groupShowsByMonth(list);
  return groups.map(g=>`<div class="shows-month">${esc(g.label)} · ${g.items.length}</div><div class="card flush" style="margin-bottom:12px">${g.items.map(showListRow).join('')}</div>`).join('');
}
function showsModePanelInner(){
  return `
    ${pageIntro('shows', 'Shows & tours in one place', 'Every show, and the tours they auto-group into. Switch views with the toggle top-right. Tap a row to open details.')}
    <div class="section" style="margin-top:8px">${showsMode==='tours'?toursListBody():showsListBody()}</div>`;
}
function refreshShowsModeChrome(){
  const meta = showsModeMeta();
  const title = document.getElementById('shows-mode-title');
  const sub = document.getElementById('shows-mode-sub');
  const actions = document.getElementById('shows-mode-actions');
  const tools = document.getElementById('shows-mode-sticky-tools');
  if(title) title.textContent = meta.title;
  if(sub) sub.textContent = meta.sub;
  if(actions) actions.innerHTML = showsHeaderActionsHtml();
  if(tools) tools.innerHTML = showsStickyToolsHtml();
  if(typeof syncSeg==='function') syncSeg('shows-mode-seg', showsMode);
}
function swapShowsModePanel(){
  const panel = document.getElementById('shows-mode-panel');
  if(!panel || store.tab !== 'shows' || overlay) return false;
  panel.innerHTML = showsModePanelInner();
  refreshShowsModeChrome();
  setFab();
  return true;
}
function viewShows(){
  const meta = showsModeMeta();
  const isTours = showsMode==='tours';
  return `
  <div class="tab-page" id="shows-mode-page">
    <div class="tab-page-sticky">
      <div class="lg-header">
        <div><div class="lg-title" id="shows-mode-title">${esc(meta.title)}</div><div class="lg-sub" id="shows-mode-sub">${esc(meta.sub)}</div></div>
        <div id="shows-mode-actions">${showsHeaderActionsHtml()}</div>
      </div>
      <div id="shows-mode-sticky-tools" class="shows-sticky-tools">${isTours?'':showsModeSearchAndChips()}</div>
    </div>
    <div class="screen-pad tab-page-body" id="shows-mode-panel">${showsModePanelInner()}<div class="spacer"></div></div>
  </div>`;
}
function setShowFilter(k){
  showFilter=k;
  haptic();
  if(reactShowsListLive()){
    if(typeof OperateReact.refreshShowsList === 'function') OperateReact.refreshShowsList();
    return;
  }
  renderView();
}
let showSearchT;
function debouncedShowSearch(){
  clearTimeout(showSearchT);
  showSearchT=setTimeout(()=>{
    if(reactShowsListLive()){
      if(typeof OperateReact.refreshShowsList === 'function') OperateReact.refreshShowsList();
      return;
    }
    const el=$('#view .searchbar input');
    const pos=el?el.selectionStart:0;
    renderView();
    const n=$('#view .searchbar input');
    if(n){n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){}}
  },160);
}
function groupShowsByMonth(list){
  const out = [];
  let cur = null;
  list.forEach(e=>{
    const d = parseDT(e.date);
    const key = d ? MONTHS[d.getMonth()]+' '+d.getFullYear() : 'No date';
    if(key !== cur){ cur = key; out.push({label:key, items:[]}); }
    out[out.length-1].items.push(e);
  });
  return out;
}
function showListRow(e){
  const col = CATS[e.color]||CATS.purple;
  const statusTag = e.status && e.status !== 'confirmed' ? `<span class="tag ${e.status}" style="margin-left:6px;vertical-align:middle;font-size:10px;padding:2px 7px">${e.status}</span>` : '';
  const meta = [e.city, e.country].filter(Boolean).map(x=>esc(x)).join(', ');
  const timeBit = e.setTime ? esc(e.setTime)+(e.endTime?' – '+esc(e.endTime):'') : '—';
  const detail = [meta, timeBit].filter(Boolean).join(' · ');
  const d = parseDT(e.date);
  const dateIc = d
    ? `<div class="ic show-date-ic" style="background:${col}22;color:${col}" aria-label="${esc(fmtDate(e.date))}"><span class="show-date-day">${d.getDate()}</span><span class="show-date-mon">${MON[d.getMonth()]}</span></div>`
    : `<div class="ic show-date-ic" style="background:${col}22;color:${col}">—</div>`;
  return `<div class="row show-row" onclick="openView('event','${e.id}')">
    ${dateIc}
    <div class="body">${showListTitleHtml(e, statusTag)}<span>${detail}</span></div>
    <button type="button" class="header-btn show-row-edit" onclick="event.stopPropagation();eventMenu('${e.id}')" title="Edit show">${ICON.edit(16)}</button>
    <div class="trail"><span style="font-size:12px;font-weight:600">${esc(relDay(e.date))}</span>${ICON.chevR(15)}</div>
  </div>`;
}

/* ============================================================
   HOME
   ============================================================ */
function viewHome(){
  const run = activeRun();
  const e = sel.nextEvent();
  const greeting = (()=>{ const h=new Date().getHours(); return h<12?'Good morning':h<18?'Good afternoon':'Good evening'; })();
  let hero = '';
  if(e){
    const flight = (e.flights||[]).find(f => typeof flightHasDetails!=='function' || flightHasDetails(f));
    const flightMs = flight && flight.dep ? parseDT(...String(flight.dep).split(' '))?.getTime() : null;
    const setMs = setStartMs(e.date, e.setTime);
    const cF = flightMs? countdown(flightMs):null;
    const cS = setMs? countdown(setMs):null;
    const flightPass = (e.flights||[]).map(f=>{
      const passes = typeof flightAllPasses==='function' ? flightAllPasses(f) : (f.passes||[]);
      return passes.length ? {f, p:passes[0]} : null;
    }).filter(Boolean)[0];
    const hasContacts = !!(e.promoter&&(e.promoter.phone||e.promoter.whatsapp)) || showDrivers(e).some(d=>!d.noGround&&(d.phone||d.whatsapp)) || (e.contacts||[]).some(c=>c.phone||c.whatsapp);
    const hasTransport = showDrivers(e).length>0;
    const liaisonReach = e.promoter&&(e.promoter.phone||e.promoter.whatsapp);
    const hasRem = (store.reminders||[]).some(r=>r.showId===e.id && !r.fired && (r.kind||'manual')!=='usb');
    hero = `
      <div class="hero tap nextshow" onclick="openView('event','${e.id}')">
        <div class="hero-label">${ICON.music(14)} Next show · ${esc(relDay(e.date))}</div>
        <div class="hero-venue">${esc(e.venue)}</div>
        <div class="hero-city">${ICON.pin(14)} ${esc(e.city)}${e.country?', '+esc(e.country):''}</div>
        <div class="count-row">
          <div class="count"><div class="count-k">${ICON.music(12)} Set time</div><div class="count-v" style="font-size:19px">${e.setTime?esc(e.setTime):'TBA'}${e.endTime?`<small> – ${esc(e.endTime)}</small>`:''}</div></div>
          <div class="count"><div class="count-k">${ICON.clock(12)} Starts in</div><div class="count-v"${setMs?` data-countdown-ms="${setMs}"`:''}><span class="cd-txt">${cS&&!cS.done?cS.txt:'—'}</span><small class="cd-unit">${cS&&!cS.done?cS.unit:''}</small></div></div>
          ${flight?`<div class="count"><div class="count-k">${ICON.plane(12)} Flight</div><div class="count-v"${flightMs?` data-countdown-ms="${flightMs}" data-countdown-off="Off"`:''}><span class="cd-txt">${cF.done?'Off':cF.txt}</span><small class="cd-unit">${cF.done?'':cF.unit}</small></div></div>`:''}
        </div>
        <div class="hero-links">
          <button type="button" class="hero-link" style="background:rgba(255,159,10,0.2);border-color:rgba(255,159,10,0.42);color:var(--text)" onclick="event.stopPropagation();sheetReminder('${e.id}')">${ICON.reminder(14)} ${hasRem?'Reminder on':'Set reminder'}</button>
          ${flightPass?`<button type="button" class="hero-link" onclick="event.stopPropagation();openPassByRef('${e.id}','${flightPass.p.id}','${flightPass.f.id}')">${ICON.ticket(14)} Boarding pass</button>`:''}
          ${hasContacts?`<button type="button" class="hero-link" onclick="event.stopPropagation();openTourContacts('${e.id}')">${ICON.users(14)} Key contacts</button>`:''}
          ${hasTransport?`<button type="button" class="hero-link" onclick="event.stopPropagation();showTransport('${e.id}')">${ICON.car(14)} Transport</button>`:''}
          ${liaisonReach?`<button type="button" class="hero-link" onclick="event.stopPropagation();contactPromoter('${e.id}')">${ICON.chat(14)} Liaison</button>`:''}
          ${e.hotel?`<button type="button" class="hero-link" onclick="event.stopPropagation();openMaps('${jsAttr(hotelMapQuery(e))}')">${ICON.bed(14)} ${esc(e.hotel.name||'Hotel')}</button>`:''}
          <button type="button" class="hero-link" onclick="event.stopPropagation();openMaps('${jsAttr(venueMapQuery(e))}')">${ICON.pin(14)} Venue</button>
          <button type="button" class="hero-link" onclick="event.stopPropagation();shareDaySheet('${e.id}')">${ICON.share(14)} Day sheet</button>
        </div>
      </div>`;
  } else {
    hero = `<div class="empty"><div class="ic">${ICON.calendar(28)}</div><b>No upcoming shows</b><span>Your next show appears here with countdowns and travel info.</span><button class="btn" style="margin-top:16px;max-width:260px" onclick="sheetEvent()">${ICON.plus(18)} Add your first show</button></div>`;
  }

  // Today's checklist = next event's checklist
  const todayChecklist = e && e.checklist && e.checklist.length ? e.checklist : [];
  const ideasWaiting = sel.ideas().filter(i=>!i.done).slice(0,2);
  const recentNotes = sel.notes().slice(0,2);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const trips = runs().filter(r=>parseDT(r.end)>=today0).slice(0,2);

  const nameBit = store.settings.artistName&&store.settings.artistName!=='You'?', '+esc(store.settings.artistName):'';
  const photo = store.settings._homeHeaderUrl || store.settings.homeHeader;
  const header = photo ? `
  <div class="home-hero" style="background-image:url('${photo}')">
    <div class="home-hero-actions">
      <button class="header-btn glass" onclick="openSearch()">${ICON.search(20)}</button>
      <button class="header-btn glass" onclick="openView('settings')">${ICON.settings(20)}</button>
    </div>
    <div class="home-hero-text"><div class="hero-hello">${greeting}${nameBit}</div><div class="hero-home">Home</div></div>
  </div>` : `
  <div class="tab-page-sticky">
    <div class="lg-header">
      <div><div class="lg-title">Home</div><div class="lg-sub">${greeting}${nameBit} · your tour dashboard</div></div>
      <div style="display:flex;gap:9px">
        <button class="header-btn" onclick="openSearch()">${ICON.search(20)}</button>
        <button class="header-btn" onclick="openView('settings')">${ICON.settings(20)}</button>
      </div>
    </div>
  </div>`;
  const st = computeStats();
  const statsBlock = st.shows ? `
    <div class="home-panel tap" onclick="openView('stats')">
      <div class="home-panel-head home-panel-head-flex">
        <span>Schedule snapshot</span>
        <span class="home-panel-link">All stats</span>
      </div>
      <div class="home-stat-grid">
        ${homeStat(ICON.music(14),'var(--accent-2)', st.upcoming, 'Shows')}
        ${homeStat(ICON.plane(14),'var(--blue)', st.flightHrs+'h', 'In the air')}
        ${homeStat(ICON.trips(14),'var(--green)', st.daysAway, 'Days away')}
        ${homeStat(ICON.globe(14),'var(--pink)', st.cities, 'Cities')}
      </div>
    </div>` : '';

  const feedPanels = [
    statsBlock,
    todayChecklist.length ? homePanel('Today\'s checklist', `<button type="button" class="home-panel-link" onclick="openView('event','${e.id}')">Open show</button>`,
      `<div class="card flush home-inset">${todayChecklist.slice(0,4).map(i=>checkRow(i, `toggleEventCheck('${e.id}','${i.id}')`)).join('')}</div>`) : '',
    ideasWaiting.length ? homePanel('Ideas', `<button type="button" class="home-panel-link" onclick="go('ideas')">All</button>`,
      `<div class="card flush home-inset">${ideasWaiting.map(homeIdeaRow).join('')}</div>`) : '',
    trips.length ? homePanel('Upcoming tours', `<button type="button" class="home-panel-link" onclick="goToursList()">All</button>`,
      `<div class="card flush home-inset">${trips.map(runRow).join('')}</div>`) : '',
    recentNotes.length ? homePanel('Recent notes', `<button type="button" class="home-panel-link" onclick="goNotes()">All</button>`,
      `<div class="card flush home-inset">${recentNotes.map(noteRow).join('')}</div>`) : '',
  ].filter(Boolean).join('');

  return `
  <div class="tab-page">
  ${header}
  <div class="screen-pad home-screen tab-page-body stagger"${photo?' style="margin-top:12px"':''}>
    <section class="home-focus">${hero}</section>
    ${run?`<div class="tourmode-wrap">${activeTripBanner(run)}</div>`:''}

    <div class="home-layout">
      <div class="home-panel">
        <div class="home-panel-head">Shortcuts</div>
        <div class="home-panel-body">
          <div class="home-sc-group">
            <div class="home-sc-label">Tour</div>
            <div class="home-sc-row home-sc-grid">
              ${homeShortcut(`go('shows')`, ICON.music(18), 'var(--accent-2)', 'Shows')}
              ${homeShortcut(`go('trips')`, ICON.trips(18), 'var(--pink)', 'Tours')}
              ${homeShortcut(`openView('itinerary')`, ICON.file(18), 'var(--blue)', 'Itinerary')}
              ${homeShortcut(`sheetCalendarUpload()`, ICON.calendar(18), 'var(--green)', 'Upload calendar')}
            </div>
          </div>
          <div class="home-sc-group">
            <div class="home-sc-label">Desk</div>
            <div class="home-sc-row home-sc-grid">
              ${homeShortcut(`sheetIdea()`, ICON.idea(18), 'var(--orange)', 'New idea')}
              ${homeShortcut(`sheetNote()`, ICON.note(18), 'var(--blue)', 'New note')}
              ${homeShortcut(`openView('finance')`, ICON.coins(18), 'var(--green)', 'Finance')}
              ${homeShortcut(`openView('invoices')`, ICON.receipt(18), 'var(--blue)', 'Invoice')}
              ${homeShortcut(`openView('contacts')`, ICON.users(18), 'var(--accent-2)', 'Contacts')}
            </div>
          </div>
        </div>
      </div>
      ${feedPanels ? `<div class="home-feed">${feedPanels}</div>` : ''}
    </div>

    <div class="spacer"></div>
  </div>
  </div>`;
}
function homePanel(title, linkHTML, bodyHTML){
  return `<div class="home-panel">
    <div class="home-panel-head home-panel-head-flex"><span>${esc(title)}</span>${linkHTML||''}</div>
    ${bodyHTML}
  </div>`;
}
function homeShortcut(onclick, iconHTML, color, label){
  return `<button type="button" class="home-sc" onclick="${onclick}"><span class="ic" style="background:${color}22;color:${color}">${iconHTML}</span><span>${esc(label)}</span></button>`;
}
function homeIdeaRow(i){
  const t = IDEA_TYPES[i.type]||IDEA_TYPES.other;
  return `<div class="home-mini-row" onclick="openView('idea','${i.id}')">
    <span class="home-mini-dot" style="background:${t.color}"></span>
    <span class="home-mini-t">${esc(i.title)}</span>
    <span class="home-mini-meta">${esc(t.label)}</span>
    ${ICON.chevR(14)}
  </div>`;
}
function homeStat(icon, color, value, label){
  return `<div class="home-stat">
    <div class="home-stat-k" style="color:${color}">${icon} ${esc(label)}</div>
    <div class="home-stat-v">${value}</div>
  </div>`;
}

function activeTripBanner(run){
  const p=runProgress(run);
  return `<div class="tourmode-card tap" onclick="go('trips')">
    <div class="tourmode-top">
      <span class="tourmode-badge">${ICON.planeTop(15)} Tour Mode</span>
      <span class="tourmode-live"><span class="pulse"></span> LIVE</span>
    </div>
    <div class="tourmode-title">${esc(run.title)}</div>
    <div class="tourmode-meta">${run.shows.length} show${run.shows.length>1?'s':''} · ${p.done}/${p.total} done</div>
    <div class="tourmode-bar"><i style="width:${p.pct}%"></i></div>
    <div class="tourmode-cta">Open Tour Mode ${ICON.chevR(15)}</div>
  </div>`;
}
/* Shared small components */
function checkRow(i, onclick){
  return `<div class="check ${i.done?'done':''}" data-id="${esc(i.id)}" onclick="${onclick}">
    <div class="box">${ICON.check(15)}</div>
    <div class="lbl">${esc(i.label)}</div>
  </div>`;
}
function ideaCard(i){
  const t = IDEA_TYPES[i.type]||IDEA_TYPES.other;
  const link = ideaLinkLabel(i);
  const selected = typeof selectedIdeaId !== 'undefined' && selectedIdeaId === i.id;
  return `<div class="idea ${i.done?'is-done':''}${selected?' sel':''}" data-idea="${i.id}" style="background:linear-gradient(160deg, ${t.color}22, var(--card));border-color:${t.color}33" onclick="toggleIdeaSelect(event,'${i.id}')">
    <button type="button" class="idea-sel-btn" onclick="toggleIdeaDoneFromCard(event,'${i.id}')" aria-label="${i.done?'Mark as to use':'Mark as done'}">${ICON.check(15)}</button>
    <div class="type" style="color:${t.color}">${ICON[t.icon](13)} ${t.label}</div>
    <div class="ttl">${esc(i.title)}</div>
    <div class="foot"><span class="prio" style="background:${PRIO[i.prio]}"></span>${i.prio}${link?'':''}</div>
    ${link?`<div class="link-tag">${ICON.chevR(11)} ${esc(link)}</div>`:''}
  </div>`;
}
function ideaLinkLabel(i){
  if(i.eventId){ const e=sel.event(i.eventId); if(e) return e.venue; }
  if(i.tripId){ const t=sel.trip(i.tripId); if(t) return t.name; }
  return '';
}
function tripRow(t){
  const evs = sel.tripEvents(t.id); const p = sel.tripProgress(t);
  const active = store.activeTripId===t.id;
  return `<div class="row" onclick="openView('trip','${t.id}')">
    <div class="ic" style="background:${CATS[t.color]||CATS.purple}22;color:${CATS[t.color]||CATS.purple}">${ICON.bag(19)}</div>
    <div class="body"><b>${esc(t.name)} ${active?'<span class="tag confirmed" style="margin-left:4px">Active</span>':''}</b>
      <span>${evs.length} show${evs.length!==1?'s':''} · ${t.startDate?fmtDate(t.startDate):'No dates'}${t.archived?' · Archived':''}</span></div>
    <div class="trail">${p.pct}%${ICON.chevR(16)}</div>
  </div>`;
}
function noteRow(n){
  const preview = (n.body||'').split('\n').filter(Boolean)[0]||'No additional text';
  return `<div class="note-row" onclick="openView('note','${n.id}')">
    <b>${esc(n.title||'Untitled')}</b>
    <span class="meta"><span class="dt">${timeAgo(n.updated)}</span> · ${esc(preview.slice(0,50))}</span>
  </div>`;
}
/* ============================================================
   EVENT DETAIL — grouped panels
   ============================================================ */
function countAdvanceFields(a){
  if(!a) return 0;
  let n = 0;
  if(a.stage) n++;
  if((a.schedule||[]).some(s=>s.time||s.label||s.title)) n++;
  ['access','soundcheck','curfew','dressingRoom','guestlist','catering','parking','wifi','navAddr','remarks'].forEach(k=>{ if(a[k]) n++; });
  return n;
}
function travelGroupSummary(e){
  const flightLegs = showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')==='plane').length;
  const manualFlights = (e.flights&&e.flights.length)||0;
  const flightN = flightLegs + manualFlights;
  const hotel = !!(e.hotel || showLegs(e.id).some(x=>x.kind==='stay'));
  const drvList = showDrivers(e);
  const driver = !!(drvList.some(d=>!d.noGround) || showLegs(e.id).some(x=>x.kind==='travel' && isDriverItem(x)));
  const noGround = drvList.some(d=>d.noGround);
  const transferN = showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')!=='plane' && !isDriverItem(x)).length;
  const parts = [];
  if(flightN) parts.push(flightN+' flight'+(flightN>1?'s':''));
  if(hotel) parts.push('hotel');
  if(driver) parts.push('driver');
  if(noGround) parts.push('Uber/taxi');
  if(transferN) parts.push(transferN+' transfer'+(transferN>1?'s':''));
  return parts.length ? parts.join(' · ') : 'Add flights, hotel or transport';
}
function venueGroupSummary(e){
  const n = countAdvanceFields(e.advance);
  const venue = cleanVenue(e.venue) || 'Venue';
  const contacts = (e.contacts||[]).length;
  const bits = [venue];
  if(n) bits.push(n+' day-of detail'+(n>1?'s':''));
  if(contacts) bits.push(contacts+' contact'+(contacts>1?'s':''));
  return bits.join(' · ');
}
function prepGroupSummary(e){
  const cp = sel.eventChecklistProgress(e);
  const ideas = store.ideas.filter(x=>x.eventId===e.id).length;
  const contentN = ideas + (e.content?1:0);
  const attachN = (e.attachments||[]).length;
  const tlN = (typeof showDayTimeline==='function' ? showDayTimeline(e) : (e.timeline||[])).length;
  const parts = [];
  if(tlN) parts.push(tlN+' timeline step'+(tlN!==1?'s':''));
  if(cp.total) parts.push('checklist '+cp.done+'/'+cp.total);
  if(contentN) parts.push(contentN+' content item'+(contentN>1?'s':''));
  if(attachN) parts.push(attachN+' attachment'+(attachN>1?'s':''));
  if(e.notes&&e.notes.trim()) parts.push('notes');
  return parts.length ? parts.join(' · ') : 'Checklist, timeline, notes — add what you need';
}
function dealGroupSummary(e){
  if(e.finance&&e.finance.notDisclosed) return 'Not disclosed';
  const c = money.eventCalc(e);
  if(!c.gross) return 'Add the fee or mark as not disclosed';
  return fmtMoney(c.gross,c.cur)+(c.paid?' · paid':' · unpaid');
}
function flightsSubsection(e){
  const legs = showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')==='plane').sort(legSort);
  const manual = (e.flights||[]).filter(f => typeof flightHasDetails!=='function' || flightHasDetails(f));
  let body = '';
  if(!legs.length && !manual.length){
    body = `<div class="card tap" onclick="sheetFlight('${e.id}')" style="text-align:center;color:var(--text-3);padding:20px">${ICON.plane(22)}<div style="margin-top:6px;font-weight:600">Add flight</div><div style="margin-top:4px;font-size:12px;font-weight:500">Number, times, passengers and boarding passes</div></div>`;
  } else {
    if(legs.length) body += showSourceLabel('From journey')+`<div class="card flush">${legs.map(journeyRow).join('')}</div>`;
    if(manual.length) body += showSourceLabel('Added to show')+`<div class="card flush">${manual.map(f=>flightLine(e.id,f)).join('')}</div>`;
  }
  const has = !!(legs.length || manual.length);
  return showSubsection('ss-'+e.id+'-flights', 'Flights', `<button type="button" class="add" onclick="sheetFlight('${e.id}')">Add</button>`, body, has);
}
/* A UK show — UK postcodes are granular (a postcode ≈ a building) so they land
   exactly; postcodes elsewhere cover a wide area and Maps resolves them to the
   most prominent business there, not the hotel. Detected by country, or by a
   UK-style postcode (letters first, e.g. "M1 1AE"). */
function isUKShow(e){
  const c = (e && (e.hotel && e.hotel.country || e.country) || '').trim().toLowerCase();
  if(/\b(uk|gb|england|scotland|wales|northern ireland|great britain|united kingdom|britain)\b/.test(c)) return true;
  const p = (e && e.hotel && e.hotel.postcode || '').trim();
  return /^[A-Za-z]{1,2}\d/.test(p);
}
/* The hotel name as entered on the show — from the Hotel section, or (if that
   name is blank) from a stay leg's place. This is the single source of truth
   for hotel Maps searches. */
function hotelBestName(e){
  const h = e && e.hotel;
  const name = (h && h.name || '').trim();
  if(name) return name;
  if(e && typeof showLegs === 'function'){
    const stay = showLegs(e.id).find(x => x.kind==='stay' && (x.place||'').trim());
    if(stay) return (stay.place||'').trim();
  }
  return '';
}
/* Best Maps query for a show's hotel. For UK shows the postcode resolves to the
   exact spot, so use it. Everywhere else we search by the hotel NAME entered on
   the show — a foreign postcode alone is too coarse and Maps snaps to the
   biggest nearby business (e.g. Grand Palladium) instead of the real hotel, so
   a lone postcode is never emitted for non-UK shows. */
function hotelMapQuery(e){
  const h = e && e.hotel;
  const name = hotelBestName(e);
  if(!h && !name) return '';
  const post = (h && h.postcode || '').trim();
  if(post && isUKShow(e)) return post;
  const addr = typeof formatHotelAddress === 'function' ? formatHotelAddress(h) : '';
  const parts = name
    ? [name, (h && h.city) || (e && e.city), (h && h.country) || (e && e.country)]
    : (addr
      ? [addr]
      : [(h && h.city) || (e && e.city), (h && h.country) || (e && e.country)]);
  const seen = new Set();
  return parts
    .map(x=>(x||'').trim())
    .filter(x=>{ if(!x) return false; const k=x.toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; })
    .join(', ');
}
function hotelSubsection(e){
  const legs = showLegs(e.id).filter(x=>x.kind==='stay').sort(legSort);
  let body = '';
  if(legs.length) body += showSourceLabel('From journey')+`<div class="card flush">${legs.map(journeyRow).join('')}</div>`;
  if(e.hotel){
    if(legs.length) body += showSourceLabel('Added to show');
    const addr = typeof formatHotelAddress === 'function'
      ? formatHotelAddress(e.hotel)
      : [e.hotel.address, e.hotel.postcode].filter(Boolean).join(', ');
    const conf = typeof hotelBookingRef === 'function' ? hotelBookingRef(e.hotel) : (e.hotel.conf || e.hotel.bookingRef || '');
    body += `<div class="card flush">
      <div class="info-line info-line-stacked"><div class="ic">${ICON.bed(17)}</div>${detailTx(esc(e.hotel.name||'Hotel'), esc(addr || 'Tap to add address'))}
        <button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openMaps('${jsAttr(hotelMapQuery(e))}')">${ICON.map(16)}</button></div>
      <div class="info-line"><div class="ic">${ICON.clock(17)}</div>${fieldTx('Check in / out', `${e.hotel.checkin?fmtDate(e.hotel.checkin):'—'} → ${e.hotel.checkout?fmtDate(e.hotel.checkout):'—'}`)}</div>
      ${conf?`<div class="info-line" onclick="copyText('${jsAttr(conf)}')"><div class="ic">${ICON.ticket(17)}</div>${fieldTx('Confirmation', esc(conf))}<button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.copy(16)}</button></div>`:''}
      ${e.hotel.phone?`<div class="info-line" onclick="callNumber('${jsAttr(e.hotel.phone)}')"><div class="ic">${ICON.phone(17)}</div>${fieldTx('Phone', esc(e.hotel.phone))}<button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.phone(16)}</button></div>`:''}
      ${e.hotel.email?`<div class="info-line" onclick="copyText('${jsAttr(e.hotel.email)}')"><div class="ic">${ICON.chat(17)}</div>${fieldTx('Email', esc(e.hotel.email))}<button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.copy(16)}</button></div>`:''}
      ${e.hotel.notes?`<div class="info-line"><div class="ic">${ICON.note(17)}</div>${fieldTx('Room notes', esc(e.hotel.notes))}</div>`:''}
    </div>`;
  }
  if(!body) body = `<div class="card tap" onclick="sheetHotel('${e.id}')" style="text-align:center;color:var(--text-3);padding:20px">${ICON.bed(22)}<div style="margin-top:6px;font-weight:600">Add hotel details</div><div style="margin-top:4px;font-size:12px;font-weight:500">Name, dates, confirmation and maps</div></div>`;
  const has = !!(legs.length || e.hotel);
  return showSubsection('ss-'+e.id+'-hotel', 'Hotel', `<button type="button" class="add" onclick="sheetHotel('${e.id}')">${e.hotel?'Edit':'Add'}</button>`, body, has);
}
/* Chronological rank for a driver by its journey: arrival → set → departure.
   Blank / custom journeys sort after the known ones, keeping their add order. */
function driverJourneyRank(j){
  if(!j) return 99;
  const i = DRIVER_JOURNEYS.findIndex(x=>x.toLowerCase()===String(j).toLowerCase().trim());
  return i<0 ? 99 : i;
}
function orderedDrivers(e){
  return showDrivers(e).map((d,idx)=>({d,idx}))
    .sort((a,b)=> driverJourneyRank(a.d.journey)-driverJourneyRank(b.d.journey)
      || String(a.d.time||'').localeCompare(String(b.d.time||''))
      || a.idx-b.idx);
}
/* Resolve a journey's DESTINATION (the part after the arrow, e.g. the "Hotel"
   in "Venue → Hotel") to a genuine Maps location pulled from the show info —
   postcode-first for hotels, real IATA code for airports. */
function driverDestMapQuery(e, d){
  const j = (d && d.journey) || '';
  const parts = j.split(/→|->|>|–|-/);
  const dest = (parts.length>1 ? parts[parts.length-1] : (parts[0]||'')).trim().toLowerCase();
  if(/venue/.test(dest)) return venueMapQuery(e);
  if(/hotel/.test(dest)) return hotelMapQuery(e);
  if(/airport/.test(dest)){
    const code = (typeof transferAirportCode==='function') ? transferAirportCode(e, false, e.date) : null;
    return code ? code+' airport' : ((e.city?e.city+' ':'')+'airport');
  }
  if(dest) return dest + (e.city && !dest.includes(e.city.toLowerCase()) ? ' '+e.city : '');
  return '';
}
function driverCard(eid, d, idx){
  const ev = sel.event(eid);
  const dest = ev ? driverDestMapQuery(ev, d) : '';
  const head = `<div class="driver-head">
      <span class="driver-journey">${ICON.car(13)} ${d.journey?esc(d.journey):(d.noGround?'Transport':'Driver')}${d.time?' · '+esc(d.time):''}</span>
      <button type="button" class="add" onclick="sheetDriver('${eid}',${idx})">Edit</button>
    </div>`;
  const destBtn = dest ? `<button class="btn secondary" style="padding:11px" onclick="openMaps('${jsAttr(dest)}')">${ICON.map(16)} Destination</button>` : '';
  if(d.noGround){
    return `<div class="card flush" style="margin-bottom:10px">
      ${head}
      <div class="info-line"><div class="ic">${ICON.car(17)}</div>${fieldTx('No grounds', 'Please book an Uber / taxi')}</div>
      <div style="display:flex;gap:9px;padding:12px 16px">
        <button class="btn secondary" style="padding:11px" onclick="openExternal('https://m.uber.com/','uber://')">${ICON.car(16)} Open Uber</button>
        ${destBtn || `<button class="btn secondary" style="padding:11px" onclick="openMaps('${jsAttr(('taxi near '+((ev&&(ev.city||ev.venue))||'').trim()).trim())}')">${ICON.map(16)} Taxis nearby</button>`}
      </div>
    </div>`;
  }
  return `<div class="card flush" style="margin-bottom:10px">
    ${head}
    <div class="info-line info-line-stacked"><div class="ic">${ICON.user(17)}</div>${detailTx(esc(d.name||'Driver'), esc(d.pickup||''))}</div>
    ${d.notes?`<div class="info-line"><div class="ic">${ICON.note(17)}</div>${fieldTx('Notes', esc(d.notes))}</div>`:''}
    <div style="display:flex;gap:9px;padding:12px 16px;flex-wrap:wrap">
      <button class="btn secondary" style="padding:11px" onclick="callNumber('${jsAttr(d.phone||'')}')">${ICON.phone(16)} Call</button>
      <button class="btn secondary" style="padding:11px" onclick="whatsapp('${jsAttr(d.whatsapp||d.phone||'')}')">${ICON.chat(16)} WhatsApp</button>
      ${destBtn}
      <button class="btn secondary" style="padding:11px;flex:0 0 auto" onclick="copyText('${jsAttr(d.phone||'')}')">${ICON.copy(16)}</button>
    </div>
  </div>`;
}
function driverSubsection(e){
  const legs = showLegs(e.id).filter(x=>x.kind==='travel' && isDriverItem(x)).sort(legSort);
  const drivers = showDrivers(e);
  let body = '';
  if(legs.length) body += showSourceLabel('From journey')+`<div class="card flush">${legs.map(journeyRow).join('')}</div>`;
  if(drivers.length){
    if(legs.length) body += showSourceLabel('Added to show');
    body += orderedDrivers(e).map(o=>driverCard(e.id,o.d,o.idx)).join('');
  }
  if(!body) body = `<div class="card tap" onclick="sheetDriver('${e.id}')" style="text-align:center;color:var(--text-3);padding:20px">${ICON.car(22)}<div style="margin-top:6px;font-weight:600">Add transport</div><div style="margin-top:4px;font-size:12px;font-weight:500">Driver details, pickup, or Uber / taxi</div></div>`;
  const has = !!(legs.length || drivers.length);
  return showSubsection('ss-'+e.id+'-driver', 'Transport', `<button type="button" class="add" onclick="sheetDriver('${e.id}')">Add</button>`, body, has);
}
function transfersSubsection(e){
  const legs = showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')!=='plane' && !isDriverItem(x)).sort(legSort);
  if(!legs.length) return '';
  const body = showSourceLabel('From journey')+`<div class="card flush">${legs.map(journeyRow).join('')}</div>`;
  return showSubsection('ss-'+e.id+'-transfers', 'Transfers', `<button type="button" class="add" onclick="addLogisticFor('${e.id}')">Add</button>`, body, true);
}
function travelGroupBody(e){
  return flightsSubsection(e)+hotelSubsection(e)+driverSubsection(e)+transfersSubsection(e);
}
function venueSubsection(e){
  const addr = formatVenueAddress(e);
  const addrDisplay = addr || (e.city ? [e.city, e.country].filter(Boolean).join(', ') : '') || 'Tap to add';
  const mapQ = venueMapQuery(e);
  const body = `<div class="card flush">
    <div class="info-line">
      <div class="ic">${ICON.pin(17)}</div>
      ${fieldTx('Address', `<span class="addr-trunc">${esc(addrDisplay)}</span>`)}
      ${mapQ?`<button type="button" class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openMaps('${jsAttr(mapQ)}')" title="Open in Maps">${ICON.map(17)}</button>`:''}
      <button type="button" class="header-btn" style="width:34px;height:34px;align-self:center" onclick="sheetVenueAddr('${e.id}')" title="Edit venue">${ICON.edit(15)}</button>
    </div>
    ${e.promoter?`<div class="info-line">
      <div class="ic">${ICON.user(17)}</div>
      ${fieldTx('Artist Liaison', esc(e.promoter.name||'Liaison'))}
      ${(e.promoter.phone||e.promoter.whatsapp)?`<button type="button" class="btn secondary" style="width:auto;flex:0 0 auto;padding:9px 15px;font-size:13.5px;align-self:center;box-shadow:none" onclick="contactPromoter('${e.id}')">${ICON.chat(15)} Contact</button>`:''}
      <button type="button" class="header-btn" style="width:34px;height:34px;align-self:center" onclick="sheetPromoter('${e.id}')" title="Edit liaison">${ICON.edit(15)}</button>
    </div>`:`<div class="info-line" onclick="sheetPromoter('${e.id}')"><div class="ic">${ICON.plus(17)}</div><div class="tx"><div class="v" style="color:var(--accent-2)">Add artist liaison</div></div></div>`}
  </div>`;
  return showSubsection('ss-'+e.id+'-venue', 'Venue & liaison', '', body, true);
}
function advanceSubsection(e){
  const a = e.advance||{};
  const sched = (a.schedule||[]).filter(s=>(s.time||s.label||s.title));
  const schedHTML = sched.length?`<div class="ro-list">${sched.map(s=>`<div class="ro-row"><div class="ro-lab">${esc(s.label||s.title||'')}</div><div class="ro-time">${esc(s.time||'')}</div></div>`).join('')}</div>`:'';
  const navExtra = a.navAddr?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openMaps('${jsAttr(a.navAddr)}')">${ICON.map(16)}</button>`:'';
  const hasAny = countAdvanceFields(a) > 0;
  const editBtn = `<button type="button" class="add" onclick="sheetAdvance('${e.id}')">${hasAny?'Edit':'Add'}</button>`;
  if(!hasAny){
    return showSubsection('ss-'+e.id+'-advancing', 'Show-day details', editBtn, `<div class="card tap" onclick="sheetAdvance('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.checkList(20)} Add show-day details<div style="margin-top:4px;font-size:12px;font-weight:500">Access, soundcheck, running order, wifi…</div></div>`);
  }
  const scheduleRows = [advRow(ICON.pin(17),'Stage / area',a.stage), schedHTML?`<div class="info-line" style="align-items:flex-start"><div class="ic">${ICON.clock(17)}</div><div class="tx" style="width:100%"><div class="k">Running order</div>${schedHTML}</div></div>`:''].filter(Boolean).join('');
  const accessRows = [advRow(ICON.planeUp(17),'Access / arrival',a.access), advRow(ICON.music(17),'Sound check',a.soundcheck), advRow(ICON.clock(17),'Curfew',a.curfew), advRow(ICON.pin(17),'Navigation address',a.navAddr,navExtra)].filter(Boolean).join('');
  const backstageRows = [advRow(ICON.face(17),'Dressing room',a.dressingRoom), advRow(ICON.users(17),'Guest list',a.guestlist), advRow(ICON.bag(17),'Catering / rider',a.catering), advRow(ICON.car(17),'Parking',a.parking), advRow(ICON.globe(17),'WiFi',a.wifi)].filter(Boolean).join('');
  const otherRows = advRow(ICON.note(17),'Remarks',a.remarks);
  const mini = (title, rows)=> rows ? `<div class="show-adv-mini"><div class="show-adv-mini-head">${esc(title)}</div><div class="card flush">${rows}</div></div>` : '';
  const body = mini('Schedule', scheduleRows)+mini('Access', accessRows)+mini('Backstage', backstageRows)+mini('Other', otherRows);
  return showSubsection('ss-'+e.id+'-advancing', 'Show-day details', editBtn, body, true);
}
function contactsSubsection(e){
  const cs = e.contacts||[];
  const addBtn = `<button type="button" class="add" onclick="sheetEventContact('${e.id}')">Add</button>`;
  if(!cs.length){
    return showSubsection('ss-'+e.id+'-contacts', 'Key contacts', addBtn, `<div class="card tap" onclick="sheetEventContact('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.users(20)} Add a key contact</div>`);
  }
  const body = `<div class="card flush">${cs.map(ct=>`<div class="info-line info-line-stacked">
    <div class="ic">${ICON.user(17)}</div>
    <div class="tx" style="flex:1;min-width:0" onclick="sheetEventContact('${e.id}','${ct.id}')">${detailParts(esc(ct.name||'Contact'), ct.role?esc(showContactRoleLabel(ct.role)):'', ct.phone?esc(ct.phone):'')}</div>
    ${ct.phone?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="callNumber('${jsAttr(ct.phone)}')">${ICON.phone(15)}</button>`:''}
    ${(ct.whatsapp||ct.phone)?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="whatsapp('${jsAttr(ct.whatsapp||ct.phone)}')">${ICON.chat(15)}</button>`:''}
  </div>`).join('')}</div>`;
  return showSubsection('ss-'+e.id+'-contacts', 'Key contacts', addBtn, body, true);
}
function venueGroupBody(e){
  return venueSubsection(e)+advanceSubsection(e)+contactsSubsection(e);
}
function contentSubsection(e){
  const linked = store.ideas.filter(x=>x.eventId===e.id);
  const addBtn = `<button type="button" class="add" onclick="attachIdeaPickForEvent('${e.id}')">Add idea</button>`;
  let body = '';
  if(e.content) body += `<div class="card show-brief" style="background:linear-gradient(150deg,var(--accent-soft),var(--card));margin:10px"><div class="show-brief-k">${ICON.camera(14)} Brief</div><div class="show-brief-v">${esc(e.content)}</div></div>`;
  if(linked.length) body += `<div class="card flush">${linked.map(i=>{const t=IDEA_TYPES[i.type]||IDEA_TYPES.other;return `<div class="row" onclick="openView('idea','${i.id}')"><div class="ic" style="background:${t.color}22;color:${t.color}">${ICON[t.icon](16)}</div><div class="body"><b>${esc(i.title)}</b><span>${t.label}${i.done?' · done':''}</span></div>${ICON.chevR(15)}</div>`;}).join('')}</div>`;
  if(!body) body = `<div class="card tap" onclick="sheetEvent('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600;margin:10px">${ICON.camera(20)} Set what to film / capture</div>`;
  const has = !!(e.content || linked.length);
  return showSubsection('ss-'+e.id+'-content', 'Content to capture', addBtn, body, has);
}
function checklistSubsection(e){
  const cp = sel.eventChecklistProgress(e);
  const addBtn = `<button type="button" class="add" onclick="sheetShowChecklist('${e.id}')">Add</button>`;
  const title = cp.total ? `Checklist · ${cp.done}/${cp.total}` : 'Checklist';
  const body = e.checklist&&e.checklist.length
    ? `<div class="card flush">${e.checklist.map(i=>`<div class="check ${i.done?'done':''}" data-id="${esc(i.id)}"><div class="box" onclick="toggleEventCheck('${e.id}','${i.id}')">${ICON.check(15)}</div><div class="lbl" onclick="toggleEventCheck('${e.id}','${i.id}')">${esc(i.label)}</div><button class="del" onclick="delEventCheck('${e.id}','${i.id}')">${ICON.x(16)}</button></div>`).join('')}</div>`
    : `<div class="card tap" onclick="sheetShowChecklist('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.checkList(20)} Add a checklist item</div>`;
  return showSubsection('ss-'+e.id+'-checklist', title, addBtn, body, !!cp.total);
}
function timelineStepRow(e, s, opts={}){
  const eid = e.id;
  const editable = !s.auto && opts.edit;
  const openAuto = s.auto ? timelineAutoOpen(eid, s) : '';
  const openAutoSafe = openAuto; /* already built as JS call string */
  const labelClick = s.auto && openAuto
    ? `onclick="${openAutoSafe}"`
    : (editable ? `onclick="sheetShowTimelineStep('${eid}','${s.id}')"` : `onclick="toggleShowTimelineStep('${eid}','${s.id}')"`);
  return `<div class="check ${s.done?'done':''}" data-id="${esc(s.id)}">
    <div class="box" onclick="toggleShowTimelineStep('${eid}','${s.id}')">${ICON.check(15)}</div>
    <div class="lbl" ${labelClick} style="flex:1;min-width:0">
      <b>${esc(s.time||'—')}</b> ${esc(s.title||'Step')}
      ${s.sub?`<span style="display:block;font-size:12px;color:var(--text-3);font-weight:600;margin-top:2px">${esc(s.sub)}</span>`:''}
      ${s.auto?`<span style="display:block;font-size:11px;color:var(--text-3);margin-top:2px">From show info</span>`:''}
    </div>
    ${editable?`<button class="del" onclick="delShowTimelineStep('${eid}','${s.id}')">${ICON.x(16)}</button>`:''}
  </div>`;
}
function timelineAutoOpen(eid, s){
  if(s.kind==='flight' && s.refId) return `sheetFlight('${eid}','${s.refId}')`;
  if(s.kind==='hotel') return `sheetHotel('${eid}')`;
  if(s.kind==='transport'){
    const e=sel.event(eid); const list=showDrivers(e);
    const idx=list.findIndex(d=>String(d.id)===String(s.refId));
    return idx>=0 ? `sheetDriver('${eid}',${idx})` : `sheetDriver('${eid}')`;
  }
  if(s.kind==='set' || s.kind==='arrival') return `sheetEvent('${eid}')`;
  if(s.kind==='advance') return `sheetAdvance('${eid}')`;
  return '';
}
function timelineSubsection(e){
  const tl = typeof showDayTimeline==='function' ? showDayTimeline(e) : (e.timeline||[]);
  const addBtn = `<button type="button" class="add" onclick="sheetShowTimeline('${e.id}')">${tl.length?'Edit':'Add'}</button>`;
  if(!tl.length){
    return showSubsection('ss-'+e.id+'-timeline', 'Day timeline', addBtn,
      `<div class="card tap" onclick="sheetShowTimeline('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.clock(20)} Add show details — timeline fills in automatically</div>`);
  }
  const body = `<div class="card flush">${tl.map(s=>timelineStepRow(e,s)).join('')}</div>
    <div class="hint" style="text-align:left;padding:8px 4px 0">Flights, hotel, transport and set time appear here automatically. Tap Edit to add custom steps.</div>`;
  return showSubsection('ss-'+e.id+'-timeline', 'Day timeline', addBtn, body, true);
}
function attachmentsSubsection(e){
  const has = !!(e.attachments||[]).length;
  const body = `<div class="thumb-row">
    ${(e.attachments||[]).map(a=>attachThumb(e.id,a)).join('')}
    <label class="thumb thumb-add">${ICON.plus(22)}<span>Add</span><input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadAttachment('${e.id}',this)"></label>
  </div>`;
  return showSubsection('ss-'+e.id+'-attachments', 'Attachments', '', body, has);
}
function notesSubsection(e){
  const has = !!(e.notes && String(e.notes).trim());
  const body = `<div class="card" style="margin:10px"><textarea class="textarea" placeholder="Anything to remember about this show…" onblur="saveEventNotes('${e.id}',this.value)">${esc(e.notes||'')}</textarea></div>`;
  return showSubsection('ss-'+e.id+'-notes', 'Internal notes', '', body, has);
}
function prepGroupBody(e){
  return timelineSubsection(e)+contentSubsection(e)+checklistSubsection(e)+attachmentsSubsection(e)+notesSubsection(e);
}
function moneyGroupBody(e){
  if(e.finance && e.finance.notDisclosed){
    return `<div class="card tap deal-card" onclick="sheetFinance('${e.id}')" style="padding:15px 16px;display:flex;align-items:center;gap:12px">
      <div class="deal-card-ic">${ICON.coins(17)}</div>
      <div class="deal-card-body"><span class="deal-card-k">Deal</span><span class="deal-card-v">Not disclosed</span></div>
      ${ICON.chevR(15)}
    </div>`;
  }
  const c = money.eventCalc(e);
  const base = store.settings.baseCurrency;
  const showBase = c.cur!==base;
  if(!c.gross){
    return `<div class="card tap" onclick="sheetFinance('${e.id}')" style="text-align:center;color:var(--text-3);padding:16px">${ICON.money(22)}<div style="margin-top:6px;font-weight:600">Add the deal / fee</div></div>`;
  }
  return `<div class="card" style="padding:14px 16px">
    <div class="deal-head">
      <div>
        <div class="deal-k">${esc((e.finance.dealType)||'Fee')}${e.finance.estimated?' · est.':''}</div>
        <div class="deal-amount">${fmtMoney(c.gross,c.cur)}</div>
        ${showBase?`<div class="deal-meta">≈ ${fmtBase(c.grossBase)}</div>`:''}
      </div>
      <div class="deal-head-actions">
        <span class="tag ${c.paid?'confirmed':'hold'}">${c.paid?'Paid':'Unpaid'}</span>
        <button class="header-btn" style="width:38px;height:38px;${c.paid?'background:var(--green-soft);color:var(--green)':''}" onclick="togglePaid('${e.id}')">${ICON.check2(19)}</button>
      </div>
    </div>
    <div class="divi" style="margin:13px 0"></div>
    <div class="deal-rows">
      <div class="deal-row"><span class="deal-row-k">Fee</span><span class="deal-row-v">${fmtMoney(c.gross,c.cur)}</span></div>
      ${c.commissionAmt?`<div class="deal-row"><span class="deal-row-k">Agent commission (${e.finance.commission}%)</span><span class="deal-row-v neg">− ${fmtMoney(c.commissionAmt,c.cur)}</span></div>`:''}
      ${c.expenses?`<div class="deal-row"><span class="deal-row-k">Expenses</span><span class="deal-row-v neg">− ${fmtMoney(c.expenses,c.cur)}</span></div>`:''}
      ${c.perDiem?`<div class="deal-row"><span class="deal-row-k">Per diem</span><span class="deal-row-v pos">+ ${fmtMoney(c.perDiem,c.cur)}</span></div>`:''}
      <div class="divi" style="margin:4px 0"></div>
      <div class="deal-row deal-row-total"><span class="deal-row-k">Net take-home</span><span class="deal-row-v">${fmtMoney(c.net,c.cur)}</span></div>
      ${showBase?`<div class="deal-row"><span class="deal-row-k"></span><span class="deal-meta">≈ ${fmtBase(c.netBase)}</span></div>`:''}
    </div>
    ${(e.finance.expenses||[]).length?`<div class="deal-expenses">${e.finance.expenses.map(x=>`<div class="deal-row"><span class="deal-row-k">${esc(x.label||'Expense')}</span><span class="deal-row-v">${fmtMoney(x.amount,c.cur)} <button class="del" style="opacity:.6;padding:0 4px" onclick="delExpense('${e.id}','${x.id}')">${ICON.x(13)}</button></span></div>`).join('')}</div>`:''}
    <div class="btn-row" style="margin-top:12px">
      <button class="btn secondary" style="padding:11px" onclick="sheetFinance('${e.id}')">${ICON.edit(15)} Edit deal</button>
      <button class="btn secondary" style="padding:11px" onclick="createInvoiceFromEvent('${e.id}')">${ICON.receipt(15)} Invoice</button>
    </div>
  </div>`;
}

function viewEvent(id){
  const e = sel.event(id);
  if(!e) return backStub();
  if(typeof migrateShowFlightInfo==='function') migrateShowFlightInfo(e);
  const c = CATS[e.color]||CATS.purple;
  const trip = e.tripId? sel.trip(e.tripId):null;
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} ${trip?esc(trip.name):overlayBackLabel()}</button>
    <div style="display:flex;gap:8px">
      <button class="header-btn" style="width:36px;height:36px" onclick="shareDaySheet('${e.id}')">${ICON.share(17)}</button>
      <button class="header-btn" style="width:36px;height:36px" onclick="eventMenu('${e.id}')">${ICON.edit(18)}</button>
    </div>
  </div></div>
  <div class="screen-pad stagger show-detail">
    ${typeof itineraryFullUploadBanner === 'function' ? itineraryFullUploadBanner(e.id) : ''}
    <div class="dhero show-hero" style="background:linear-gradient(155deg,${c}33,var(--card) 65%)">
      <div class="cat-bar" style="background:${c}"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span class="tag ${e.status}">${e.status}</span>
        ${trip?`<span class="tag" style="background:${c}22;color:${c}" onclick="openView('trip','${trip.id}')">${esc(trip.name)}</span>`:''}
      </div>
      <div class="show-hero-eyebrow">${ICON.music(12)} Show · ${esc(relDay(e.date))}</div>
      <h1 class="show-hero-title">${esc(e.eventName||e.venue||'Untitled show')}</h1>
      ${e.eventName&&e.venue?`<div class="show-hero-venue-line">${ICON.pin(14)} ${esc(e.venue)}</div>`:''}
      <div class="show-hero-location">${ICON.pin(14)} ${esc(e.city||'City TBA')}${e.country?', '+esc(e.country):''}</div>
      <div class="show-stats">
        <div class="show-stat"><span class="show-stat-k">Date</span><span class="show-stat-v">${esc(fmtDate(e.date))}</span></div>
        <div class="show-stat"><span class="show-stat-k">Set time</span><span class="show-stat-v">${e.setTime?esc(e.setTime)+(e.endTime?' – '+esc(e.endTime):''):'TBA'}</span></div>
        ${e.arrival?`<div class="show-stat"><span class="show-stat-k">Arrival</span><span class="show-stat-v">${esc(e.arrival)}</span></div>`:''}
      </div>
    </div>

    <div class="show-detail-quick">
      <div class="block-title">Quick access</div>
      ${showQuickLinks(e)}
    </div>

    <div class="show-groups">
      ${showGroup('sg-'+e.id+'-travel', 'Travel', ICON.plane(20), travelGroupSummary(e), travelGroupBody(e))}
      ${showGroup('sg-'+e.id+'-venue', 'Venue & show day', ICON.pin(20), venueGroupSummary(e), venueGroupBody(e))}
      ${showGroup('sg-'+e.id+'-deal', 'Fee & deal', ICON.coins(20), dealGroupSummary(e), moneyGroupBody(e))}
      ${showGroup('sg-'+e.id+'-prep', 'Day prep', ICON.checkList(20), prepGroupSummary(e), prepGroupBody(e))}
    </div>

    <div class="show-detail-foot">
    ${(()=>{ const run=runOf(e.id); const otherShows=run?run.shows.length-1:0;
      const active = store.activeShowId && runOf(store.activeShowId) && runOf(store.activeShowId).key===(run&&run.key);
      return `<div class="section" style="margin-top:20px">
        ${active
          ? `<button class="btn" onclick="go('home')">${ICON.play(18)} Trip Mode is live — open it</button>`
          : `<button class="btn" onclick="startTripFromShow('${e.id}')">${ICON.play(18)} Start Trip Mode${otherShows>0?` (this run · ${run.shows.length} shows)`:''}</button>`}
        ${otherShows>0?`<div class="hint" style="text-align:left;padding:8px 2px 0">Auto-grouped with ${otherShows} nearby show${otherShows>1?'s':''} into one tour — no naming needed.</div>`:''}
      </div>`; })()}
    <div class="section"><button class="btn danger" onclick="confirmDeleteEvent('${e.id}')">${ICON.trash(17)} Delete show</button></div>
    </div>
    <div class="spacer"></div><div class="spacer"></div>
  </div>`;
}
function flightLine(eid,f){
  if(typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
  const parsed = typeof flightParseDep==='function' ? flightParseDep(f.dep,'') : {time:(f.dep||'').split(' ').pop()};
  const depTime = parsed.time || (f.dep ? (String(f.dep).split(' ')[1] || (String(f.dep).includes(':')&&!String(f.dep).includes('-')?f.dep:'')) : '');
  const arrTime = f.arr ? (String(f.arr).split(' ')[1] || (String(f.arr).includes(':')&&!String(f.arr).includes('-')?f.arr:'')) : '';
  const route = `${f.from||'?'} → ${f.to||'?'}`;
  const pax = (typeof flightPassengers==='function' ? flightPassengers(f) : (f.passengers||[]));
  const meta = [
    depTime ? 'Dep '+esc(depTime) : '',
    arrTime ? 'Arr '+esc(arrTime) : '',
    f.terminal ? 'Term '+esc(f.terminal) : '',
    f.gate ? 'Gate '+esc(f.gate) : '',
    f.fstatus ? esc(f.fstatus) : '',
    pax.length ? (pax.length+' passenger'+(pax.length===1?'':'s')) : ''
  ].filter(Boolean).join(' · ');
  /* Boarding passes render under each passenger — never as one pooled group. */
  const paxBlock = pax.length ? pax.map(p=>flightPaxLine(eid,f,p)).join('') : '';
  const notes = String(f.notes || '').trim();
  const notesBlock = notes
    ? `<div class="flight-notes" style="padding:0 16px 10px 52px;color:var(--text-2);font-size:13px;line-height:1.45">
        <div style="font-weight:650;color:var(--text-1);margin-bottom:2px">Journey notes</div>
        ${esc(notes)}
      </div>`
    : '';
  return `<div class="info-line info-line-stacked">
    <div class="ic">${ICON.plane(17)}</div>
    ${detailTx(esc(f.code||'Flight'), esc(route), meta)}
    <button type="button" class="add" style="align-self:center" onclick="sheetFlight('${eid}','${f.id}')">Edit</button>
    <button type="button" class="header-btn" style="width:34px;height:34px;align-self:center;color:var(--red)" title="Remove flight" onclick="confirmRemoveFlight('${eid}','${f.id}')">${ICON.trash(15)}</button>
  </div>${notesBlock}${paxBlock}`;
}
function flightPaxLine(eid,f,pax){
  const title = esc(pax.name||'Passenger');
  const seat = pax.seat ? ('Seat '+esc(pax.seat)) : 'No seat yet';
  const passes = pax.passes||[];
  return `<div class="flight-pax" style="padding:0 0 4px">
    <div class="info-line" style="padding-left:52px">
      <div class="ic">${ICON.users(15)}</div>
      ${detailTx(title, seat)}
      <label class="header-btn" style="width:34px;height:34px;align-self:center" title="Boarding pass">${ICON.ticket(16)}<input type="file" accept="${PASS_FILE_ACCEPT}" style="display:none" onchange="uploadPass('${eid}','${f.id}',this,'${pax.id}')"></label>
      <button type="button" class="header-btn" style="width:34px;height:34px;align-self:center;color:var(--red)" title="Remove person" onclick="confirmRemoveFlightPassenger('${eid}','${f.id}','${pax.id}')">${ICON.trash(15)}</button>
    </div>
    ${passes.length?`<div style="padding:0 16px 10px 52px"><div class="thumb-row">${passes.map(p=>passThumb(eid, p, passEditable()?`delFlightPass('${eid}','${f.id}','${p.id}','${pax.id}')`:null, f.id)).join('')}</div></div>`
      :`<div style="padding:0 16px 10px 52px;color:var(--text-3);font-size:12px">No boarding pass yet</div>`}
  </div>`;
}
function attachThumb(eid,a){
  const inner = a.kind==='image'?`<img src="${a.data}">`:`<div class="pdf">${ICON.file(26)}<span>${esc(a.name||'File')}</span></div>`;
  return `<div class="thumb" onclick="${a.kind==='image'?`openViewer('${a.data}')`:`toast('PDF saved','file')`}">${inner}<div class="del-badge" onclick="event.stopPropagation();delAttachment('${eid}','${a.id}')">${ICON.x(13)}</div></div>`;
}
function backStub(){ setTimeout(back,0); return '<div class="empty"><b>Gone</b></div>'; }
/* ============================================================
   EVENT — create / edit
   ============================================================ */
function sheetEvent(eid){
  const e = eid? sel.event(eid):null;
  const today = new Date();
  const defDate = e?e.date:`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const initCat = e?e.color:'purple';
  const initC = CATS[initCat]||CATS.purple;
  const swatches = Object.entries(CATS).map(([k,v])=>`<div class="sw${k===initCat?' on':''}" style="background:${v}" data-cat="${k}" onclick="pickCat(this)"></div>`).join('');
  const editExtras = eid ? `
    <div class="row-2">
      <div class="field picker-field" onclick="openInputPicker('ev-end')">
        <label>End time</label>
        <input id="ev-end" type="time" class="input" value="${e.endTime||''}" onclick="event.stopPropagation();openInputPicker('ev-end')">
      </div>
      <div class="field"><label>Artist</label><input id="ev-artist" class="input" placeholder="${esc(store.settings.artistName||'Artist')}" value="${esc(e.artist||'')}"></div>
    </div>
    <div class="field"><label>Internal notes</label><textarea id="ev-notes" class="textarea" placeholder="Team-only notes">${esc(e.notes||'')}</textarea></div>
  ` : '';
  openSheetReact(eid?'Edit show':'New show', 'show.event', { eid });
  /* Set tone after the sheet starts opening — avoid style thrash mid-slide. */
  if(sheetEl){
    sheetEl.style.setProperty('--sheet-tone', initC);
    sheetEl.classList.add('sheet-toned');
  }
}
function applyEventSheetColor(cat){
  const c = CATS[cat]||CATS.purple;
  const preview = document.getElementById('ev-preview');
  if(preview){
    preview.style.background = `linear-gradient(155deg,${c}33,var(--card) 65%)`;
    preview.style.borderColor = c + '44';
    const bar = preview.querySelector('.cat-bar');
    if(bar) bar.style.background = c;
    const toneLabel = preview.querySelector('.sheet-event-tone');
    if(toneLabel) toneLabel.style.color = c;
  }
  if(sheetEl){
    sheetEl.style.setProperty('--sheet-tone', c);
    sheetEl.classList.add('sheet-toned');
  }
}
function updateEventPreviewVenue(){
  const eventName = val('ev-event-name') || val('itn-rev-event-name') || '';
  const venue = val('ev-venue') || val('itn-rev-venue') || '';
  const el = document.getElementById('ev-preview-venue');
  if(el) el.textContent = eventName || venue || 'Event name';
}
function pickCat(el){
  el.parentElement.querySelectorAll('.sw').forEach(s=>s.classList.remove('on'));
  el.classList.add('on');
  haptic();
  if(el.dataset.cat) applyEventSheetColor(el.dataset.cat);
}
function segPick(el){ el.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on')); el.classList.add('on'); haptic(); }
function getSeg(id){ const el=document.querySelector('#'+id+' button.on'); return el?el.dataset.v:''; }
function getCat(id){ const el=document.querySelector('#'+id+' .sw.on'); return el?el.dataset.cat:'purple'; }

function saveEvent(eid){
  const eventName = val('ev-event-name');
  const venue = val('ev-venue');
  if(!eventName && !venue){ toast('Add an event name or venue name','x'); return; }
  const data = {
    eventName,
    venue,
    venueAddr: val('ev-addr'),
    venueAddr2: val('ev-addr2'),
    venueRegion: val('ev-region'),
    venuePostcode: val('ev-postcode'),
    city:val('ev-city'), country:val('ev-country'), date:val('ev-date')||rawVal('ev-date'),
    setTime:rawVal('ev-set'), arrival:rawVal('ev-arr'), status:getSeg('ev-status')||'confirmed',
    content:val('ev-content'), color:getCat('ev-cat'),
  };
  if(eid){
    Object.assign(data, {
      endTime: rawVal('ev-end'),
      notes: val('ev-notes'),
      artist: val('ev-artist') || store.settings.artistName,
    });
  }
  const btn = document.getElementById('ev-save');
  if(btn) btn.disabled = true;
  let showId = eid;
  if(eid){ Object.assign(sel.event(eid), data); }
  else {
    const ev = Object.assign({id:uid('evt'), artist:store.settings.artistName, tripId:null,
      hotel:null, flights:[], driver:null, promoter:null, notes:'',
      checklist:[], timeline:[], attachments:[],
      finance:{fee:0, currency:store.settings.baseCurrency, dealType:'Guarantee', expenses:[], perDiem:0, commission:0, paid:false}}, data);
    store.events.push(ev);
    showId = ev.id;
  }
  persist('shows', showId);
  if(typeof pushShowNow === 'function') pushShowNow(showId);
  closeSheet(true);
  softRender();
  toast(eid?'Show updated':'Show added','check');
  if(btn) btn.disabled = false;
}
function offerAssign(eid){ /* shows auto-group into tours — nothing to assign */ }

/* ============================================================
   Sub-entity sheets: hotel / flight / driver / promoter / timeline / emergency
   ============================================================ */
function sheetHotel(eid){
  const e=sel.event(eid); const h=e.hotel||{};
  const conf = typeof hotelBookingRef === 'function' ? hotelBookingRef(h) : (h.conf || h.bookingRef || '');
  openSheetReact('Hotel', 'show.hotel', { eid });
}
function saveHotel(eid){
  const e=sel.event(eid);
  withButton($('#ho-save'), ()=>{
    const prev = e.hotel || {};
    const conf = val('ho-conf');
    e.hotel = {
      ...prev,
      name: val('ho-name'),
      address: val('ho-addr'),
      address2: val('ho-addr2'),
      city: val('ho-city'),
      region: val('ho-region'),
      postcode: val('ho-post'),
      country: val('ho-country'),
      phone: val('ho-phone'),
      email: val('ho-email'),
      checkin: rawVal('ho-in'),
      checkout: rawVal('ho-out'),
      conf,
      bookingRef: conf,
      notes: val('ho-notes')
    };
    persist('shows', eid);
    if(typeof pushShowNow === 'function') pushShowNow(eid);
    closeSheet();
    renderView();
  }, 'Hotel saved');
}
function sheetFlight(eid, fid){
  const e=sel.event(eid); if(!e) return;
  migrateShowFlightInfo(e);
  const flights = (e.flights||[]).filter(f => typeof flightHasDetails!=='function' || flightHasDetails(f));
  /* From the editor with no flight id: show existing flights first. */
  if(!fid){
    if(flights.length){
      openSheetReact('Flights', 'show.flightsList', { eid, flights }, { full: true });
      return;
    }
  }
  const forceNew = fid === '__new__';
  const f = (!forceNew && fid) ? ((e.flights||[]).find(x=>x.id===fid) || null) : null;
  if(f && typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
  const editing = !!f;
  const today = new Date();
  const fallbackDate = (e && e.date) || `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const parsed = typeof flightParseDep==='function' ? flightParseDep(f&&f.dep, fallbackDate) : {date:fallbackDate, time:''};
  const paxList = editing
    ? (flightPassengers(f).length ? flightPassengers(f) : [{id:uid('pax'), name:'', seat:'', passes:[]}])
    : [{id:uid('pax'), name:'', seat:'', passes:[]}];
  openSheetReact(editing?'Edit flight':'Add flight', 'show.flight', { eid, fid: editing ? f.id : '' });
}
function openFlightFromList(eid, fid){
  sheetReturnStack.push({kind:'showFlights', id:eid});
  sheetFlight(eid, fid);
}
function flightSheetPaxRow(pax, idx, eid, fid){
  const pid = pax.id || uid('pax');
  const passThumbs = (pax.passes&&pax.passes.length&&fid)
    ? `<div class="thumb-row" style="margin-top:8px">${pax.passes.map(p=>passThumb(eid, p, passEditable()?`delFlightPass('${eid}','${fid}','${p.id}','${pid}')`:null, fid)).join('')}</div>`
    : '';
  const upload = fid
    ? `<label class="btn secondary" style="margin-top:8px;display:inline-flex">${ICON.ticket(15)} Boarding pass<input type="file" accept="${PASS_FILE_ACCEPT}" style="display:none" onchange="uploadPass('${eid}','${fid}',this,'${pid}')"></label>`
    : `<div class="hint" style="padding:6px 2px 0">Save the flight first to attach boarding passes.</div>`;
  return `<div class="fl-pax-row" data-pax-id="${esc(pid)}" style="border:1px solid var(--stroke);border-radius:12px;padding:12px;margin-bottom:8px">
    <div class="row-2">
      <div class="field" style="margin:0"><label>Name</label><input class="input fl-pax-name" value="${esc(pax.name||'')}" placeholder="Passenger name"></div>
      <div class="field" style="margin:0"><label>Seat</label><input class="input fl-pax-seat" value="${esc(pax.seat||'')}" placeholder="4A"></div>
    </div>
    ${upload}
    ${passThumbs}
    <button type="button" class="btn secondary" style="margin-top:8px" onclick="removeFlightPaxFromSheet(this,'${eid}','${fid||''}','${pid}')">${ICON.trash(14)} Remove person</button>
  </div>`;
}
function addFlightPaxRow(eid, fid){
  const list = document.getElementById('fl-pax-list');
  if(!list) return;
  const pax = { id: uid('pax'), name: '', seat: '', passes: [] };
  list.insertAdjacentHTML('beforeend', flightSheetPaxRow(pax, list.children.length, eid, fid||''));
  haptic();
}
/* Read name/seat typed in the open flight sheet for a passenger row that may
   not have been saved yet. */
function flightSheetPaxDraft(passengerId){
  if(!passengerId) return { name: '', seat: '' };
  const row = [...document.querySelectorAll('#fl-pax-list .fl-pax-row')]
    .find(r => r.getAttribute('data-pax-id') === passengerId);
  if(!row) return { name: '', seat: '' };
  return {
    name: (row.querySelector('.fl-pax-name')?.value || '').trim(),
    seat: (row.querySelector('.fl-pax-seat')?.value || '').trim()
  };
}
/* After a pass upload, update thumbs in the open sheet without rebuilding it
   (so other unsaved fields stay intact). */
function refreshFlightSheetPaxPasses(eid, fid, passengerId){
  if(!eid || !fid || !passengerId) return;
  const e = sel.event(eid);
  const f = e && (e.flights || []).find(x => x.id === fid);
  const pax = f && (f.passengers || []).find(p => p.id === passengerId);
  if(!pax) return;
  const row = [...document.querySelectorAll('#fl-pax-list .fl-pax-row')]
    .find(r => r.getAttribute('data-pax-id') === passengerId);
  if(!row) return;
  const html = (pax.passes && pax.passes.length)
    ? `<div class="thumb-row fl-pax-passes" style="margin-top:8px">${pax.passes.map(p=>passThumb(eid, p, passEditable()?`delFlightPass('${eid}','${fid}','${p.id}','${passengerId}')`:null, fid)).join('')}</div>`
    : '';
  const existing = row.querySelector('.thumb-row');
  if(existing){
    if(html) existing.outerHTML = html;
    else existing.remove();
    return;
  }
  if(!html) return;
  const upload = row.querySelector('label.btn');
  if(upload) upload.insertAdjacentHTML('afterend', html);
  else row.insertAdjacentHTML('beforeend', html);
}
function collectFlightPaxFromSheet(eid, fid, existing){
  const prevById = Object.create(null);
  (existing || []).forEach(p => { if(p && p.id) prevById[p.id] = p; });
  const rows = [...document.querySelectorAll('#fl-pax-list .fl-pax-row')];
  const out = [];
  rows.forEach(row => {
    const id = row.getAttribute('data-pax-id') || uid('pax');
    const name = (row.querySelector('.fl-pax-name')?.value || '').trim();
    const seat = (row.querySelector('.fl-pax-seat')?.value || '').trim();
    const prev = prevById[id];
    const passes = (prev && prev.passes) ? prev.passes.slice() : [];
    if(!name && !seat && !passes.length) return;
    out.push({ id, name, seat, passes });
  });
  return out;
}
function saveFlight(eid, fid){
  const e=sel.event(eid); const code=val('fl-code');
  if(!code){ toast('Add a flight number','x'); return; }
  const d = rawVal('fl-dep-date');
  const t = rawVal('fl-dep-time');
  const dep = (d && t) ? `${d} ${t}` : (d || t || '');
  const existing = fid ? (e.flights||[]).find(x=>x.id===fid) : null;
  if(existing && typeof ensureFlightPassengers==='function') ensureFlightPassengers(existing);
  const passengers = collectFlightPaxFromSheet(eid, fid, existing && existing.passengers);
  withButton($('#fl-save'), ()=>{
    const payload = {
      id: existing ? existing.id : uid('fl'),
      code,
      from: val('fl-from').toUpperCase(),
      to: val('fl-to').toUpperCase(),
      dep,
      arr: existing ? (existing.arr||'') : '',
      terminal: val('fl-term'),
      gate: val('fl-gate'),
      fstatus: val('fl-status'),
      delay: val('fl-delay'),
      notes: val('fl-notes'),
      fiUpdated: Date.now(),
      seat: '',
      passengers: passengers.length ? passengers : [],
      passes: [],
      done: existing ? !!existing.done : false
    };
    if(existing){
      Object.assign(existing, payload);
    } else {
      (e.flights = e.flights || []).push(payload);
    }
    /* Clear legacy show-level flight info once it lives on the flight. */
    e.flightNo=''; e.terminal=''; e.gate=''; e.fstatus=''; e.delay='';
    persist('shows', eid);
    if(typeof pushShowNow === 'function') pushShowNow(eid);
    closeSheet();
    softRender();
  }, existing ? 'Flight saved' : 'Flight added');
}
function delFlight(eid,fid){
  const e=sel.event(eid); if(!e) return;
  e.flights=(e.flights||[]).filter(f=>f.id!==fid);
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  softRender();
  toast('Flight removed','trash');
}
function confirmRemoveFlight(eid, fid){
  const e=sel.event(eid);
  const f=e && (e.flights||[]).find(x=>x.id===fid);
  const label=(f && f.code) || 'this flight';
  confirmSheet(
    'Remove flight?',
    `Remove ${label} from this show, including passengers and boarding passes.`,
    'Remove flight',
    ()=>{ delFlight(eid, fid); },
    true
  );
}
function delFlightPassenger(eid, fid, paxId){
  const e=sel.event(eid); if(!e || !fid || !paxId) return;
  const f=(e.flights||[]).find(x=>x.id===fid); if(!f) return;
  if(typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
  f.passengers=(f.passengers||[]).filter(p=>p.id!==paxId);
  f.seat='';
  f.passes=[];
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  softRender();
  toast('Person removed','trash');
}
function confirmRemoveFlightPassenger(eid, fid, paxId){
  const e=sel.event(eid);
  const f=e && (e.flights||[]).find(x=>x.id===fid);
  const p=f && (f.passengers||[]).find(x=>x.id===paxId);
  const name=(p && p.name) || 'this person';
  confirmSheet(
    'Remove person?',
    `${name} will be removed from this flight, including their boarding pass.`,
    'Remove person',
    ()=>{ delFlightPassenger(eid, fid, paxId); },
    true
  );
}
/* Remove a passenger row in the open flight sheet. If the flight is already
   saved, drop them from the show immediately so it sticks even before Save. */
function removeFlightPaxFromSheet(btn, eid, fid, paxId){
  const row=btn && btn.closest('.fl-pax-row');
  if(row) row.remove();
  if(fid && paxId){
    const e=sel.event(eid);
    const f=e && (e.flights||[]).find(x=>x.id===fid);
    if(f){
      if(typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
      f.passengers=(f.passengers||[]).filter(p=>p.id!==paxId);
      f.seat='';
      f.passes=[];
      persist('shows', eid);
      if(typeof pushShowNow==='function') pushShowNow(eid);
      toast('Person removed','trash');
      return;
    }
  }
  haptic();
}
/* Tapping the Driver quick-link opens a chooser — Call or WhatsApp — instead of dialling immediately. */
function contactDriver(eid){
  const e=sel.event(eid); const d=(e&&e.driver)||{};
  const phone=d.phone||''; const wa=d.whatsapp||d.phone||'';
  if(!phone && !wa){ sheetDriver(eid); return; }
  openSheetReact('Contact driver', 'show.contactDriver', { eid, driver: d });
}
/* Transport chooser for a show — lists every driver contact and no-grounds
   entry with WhatsApp/Call/Uber, so a show's transport surfaces in Trip Mode. */
function showTransport(eid){
  const e=sel.event(eid); if(!e) return;
  const list=showDrivers(e);
  if(!list.length){ sheetDriver(eid); return; }
  const rows = orderedDrivers(e).map(({d})=>{
    const title = (d.journey?esc(d.journey):(d.noGround?'Transport':(esc(d.name)||'Driver'))) + (d.time?' · '+esc(d.time):'');
    if(d.noGround){
      return `<div class="info-line"><div class="ic">${ICON.car(17)}</div>${fieldTx(title,'No grounds — Uber / taxi')}
        <button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openExternal('https://m.uber.com/','uber://')">${ICON.car(16)}</button></div>`;
    }
    const wa=d.whatsapp||d.phone||'';
    return `<div class="info-line"><div class="ic">${ICON.user(17)}</div>${fieldTx(title, esc(d.name||'Driver')+(d.phone?' · '+esc(d.phone):''))}
      ${wa?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="whatsapp('${jsAttr(wa)}')">${ICON.chat(16)}</button>`:''}
      ${d.phone?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="callNumber('${jsAttr(d.phone)}')">${ICON.phone(16)}</button>`:''}</div>`;
  }).join('');
  openSheetReact('Transport', 'show.transportList', { eid });
}
/* Contact the promoter — WhatsApp first (avoids a laptop trying to FaceTime),
   with Call as a fallback. Same pattern applies on every show. */
function contactPromoter(eid){
  const e=sel.event(eid); const p=(e&&e.promoter)||{};
  const phone=p.phone||''; const wa=p.whatsapp||p.phone||'';
  if(!phone && !wa){ sheetPromoter(eid); return; }
  openSheetReact('Contact artist liaison', 'show.liaison', { eid, liaison: p });
}
/* Set a reminder notification for a show's set. */
function sheetReminder(eid){
  const e=sel.event(eid); if(!e) return;
  const base=setStartMs(e.date, e.setTime); const now=Date.now();
  const existing=(typeof reminderFor==='function')?reminderFor(eid):null;
  const opt=(mins,label)=>{ if(base==null) return ''; const at=base-mins*60000; if(at<=now) return ''; return `<button type="button" class="btn secondary" style="margin-bottom:8px" onclick="setShowReminder('${eid}',${at},'${label}')">${ICON.reminder(15)} ${label}</button>`; };
  const morning=parseDT(e.date,'09:00'); const morningAt=morning?morning.getTime():null;
  const warn = (typeof notifSupported!=='function'||!notifSupported()) ? `Notifications aren't supported here — reminders show only while Operate is open.`
    : (Notification.permission==='denied' ? `Notifications are blocked. Enable them for Operate in your phone/browser settings to be pinged when the app is closed.`
    : (!triggersSupported() ? `On this device reminders fire while Operate is open or backgrounded; delivery when fully closed isn't guaranteed (common on iPhone).` : ''));
  openSheetReact('Set a reminder', 'show.reminder', { eid, existing, morningAt, warning: warn });
}
function setShowReminder(eid, atMs, label){
  const noteEl=document.getElementById('rem-note'); const note=noteEl?noteEl.value.trim():'';
  scheduleReminder(eid, atMs, note||label).then(ok=>{ closeSheet(); softRender(); toast(ok?'Reminder set':'Saved — enable notifications to be pinged', ok?'reminder':'x'); });
}
function setShowReminderCustom(eid){
  const el=document.getElementById('rem-when'); const v=el?el.value:'';
  if(!v){ toast('Pick a date & time','x'); return; }
  const at=new Date(v).getTime();
  if(!at || at<=Date.now()){ toast('Pick a future time','x'); return; }
  setShowReminder(eid, at, 'Reminder');
}
function clearShowReminder(eid){ cancelReminder(eid); closeSheet(); softRender(); toast('Reminder removed','trash'); }
/* ---- Flight status widget: gate / terminal / status / delay.
   Lives on each flight (and travel logistics legs). ---- */
function flightInfoWidget(e){
  if(!e) return '';
  if(e.kind==='travel' && (e.icon||'plane')!=='plane') return '';
  const has = e.flightNo||e.code||e.gate||e.terminal||e.fstatus||e.delay;
  const showId = e.showId || e.id;
  const flightId = e.embedded ? e.id : '';
  const openEdit = e.embedded && showId
    ? `sheetFlight('${showId}','${flightId}')`
    : `sheetFlightInfo('${e.id}')`;
  if(!has){ return `<div class="fi-add" onclick="event.stopPropagation();${openEdit}">${ICON.planeUp(15)} Add flight info · gate, terminal, status</div>`; }
  const st = e.fstatus||'Scheduled';
  const cell=(k,v)=>`<div class="fi-cell"><span>${k}</span><b>${v?esc(v):'—'}</b></div>`;
  const upd = e.fiUpdated?`<span class="fi-upd">${timeAgo(e.fiUpdated)}</span>`:'';
  const code = e.flightNo||e.code||'';
  const track = (!e.embedded && e.flightNo)?`<button class="fi-track" onclick="event.stopPropagation();flightTrack('${e.id}')">${ICON.reminder(13)} Track live</button>`:'';
  return `<div class="fi" onclick="event.stopPropagation();${openEdit}">
    <div class="fi-head"><span class="fi-live"><i></i>${code?esc(code)+' · ':''}${esc(st)}</span>
      ${e.delay?`<span class="fi-delay">${esc(e.delay)}</span>`:upd}</div>
    <div class="fi-grid">${cell('Terminal',e.terminal)}${cell('Gate',e.gate)}</div>
    ${track?`<div style="margin-top:9px">${track}</div>`:''}
  </div>`;
}
/* Pull live gate/terminal/status/delay from the Supabase flight-status function. */
async function flightTrack(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  if(!e.flightNo){ toast('Add a flight number first','x'); sheetFlightInfo(id); return; }
  if(!isSupabaseConfigured() || !authUser){ toast('Sign in to track flights','x'); return; }
  const token = await getAccessToken();
  if(!token){ toast('Sign in to track flights','x'); return; }
  toast('Checking live status…','plane');
  try{
    const res=await fetch(OPERATE_CONFIG.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/flight-status', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':OPERATE_CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+token },
      body: JSON.stringify({ flight:e.flightNo, date:e.date })
    });
    const d=await res.json().catch(()=>null);
    if(!d || d.found===false){ toast(d&&d.error==='no_key'?'Flight key not set on server':'Flight not found for that date','x'); return; }
    if(d.status) e.fstatus=d.status;
    if(d.terminal) e.terminal=d.terminal;
    if(d.gate) e.gate=d.gate;
    e.delay=d.delay||'';
    e.fiUpdated=Date.now(); e.fiLive=true;
    persist('shows', id); softRender(); toast('Live status updated ✈︎','check');
  }catch(err){ toast('Could not reach flight service','x'); }
}
function sheetFlightInfo(id){
  /* Prefer editing the show's flight(s) — gate/terminal now live on each flight. */
  const show = sel.event(id);
  if(show && (show.kind||'show')==='show'){
    migrateShowFlightInfo(show);
    sheetFlight(id);
    return;
  }
  const e=store.events.find(x=>x.id===id); if(!e) return;
  const has = e.flightNo||e.gate||e.terminal||e.fstatus||e.delay;
  openSheetReact('Flight info', 'show.flightInfo', { id });
}
function saveFlightInfo(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  e.flightNo=val('fi-no'); e.terminal=val('fi-term'); e.gate=val('fi-gate'); e.fstatus=val('fi-status'); e.delay=val('fi-delay'); e.fiUpdated=Date.now();
  persist('shows', id); closeSheet(); softRender(); toast('Flight info saved','check');
}
function clearFlightInfo(id){
  const e=store.events.find(x=>x.id===id); if(e){ e.flightNo=''; e.terminal=''; e.gate=''; e.fstatus=''; e.delay=''; e.fiUpdated=null; }
  persist('shows', id); closeSheet(); softRender(); toast('Flight info cleared','trash');
}
function sheetDriver(eid, idx){
  const e=sel.event(eid); const list=showDrivers(e);
  const editing = idx!=null && list[idx];
  const d = editing ? list[idx] : {};
  const none = !!d.noGround;
  const chips = DRIVER_JOURNEYS.map(j=>`<button type="button" class="chip" onclick="document.getElementById('dr-journey').value='${j}';haptic()">${j}</button>`).join('');
  openSheetReact(editing?'Edit transport':'Add transport', 'show.transport', { eid, idx });
}
function drModeToggle(){
  const none = getSeg('dr-mode')==='none';
  const c=document.getElementById('dr-contact'); if(c) c.style.display = none?'none':'';
  const h=document.getElementById('dr-none-hint'); if(h) h.style.display = none?'':'none';
}
function saveDriver(eid, idx){
  const e=sel.event(eid);
  const none = getSeg('dr-mode')==='none';
  const name = val('dr-name');
  if(!none && !name){ toast('Add a name','x'); return; }
  const list=showDrivers(e);
  withButton($('#dr-save'), ()=>{
    const base = { id:(idx!=null&&list[idx]&&list[idx].id)||uid('drv'), journey:val('dr-journey'), time:val('dr-time') };
    const drv = none
      ? Object.assign(base, { noGround:true })
      : Object.assign(base, { name, phone:val('dr-phone'), whatsapp:val('dr-wa'), pickup:val('dr-pick'), notes:val('dr-notes') });
    if(idx!=null && list[idx]) list[idx]=drv; else list.push(drv);
    e.driver = list.find(x=>!x.noGround) || null;
    persist('shows', eid); closeSheet(); softRender();
  }, idx!=null?'Saved':'Added');
}
function sheetVenueAddr(eid){
  const e=sel.event(eid); if(!e) return;
  openSheetReact('Venue', 'show.venue', { eid });
}
function saveVenueAddr(eid){
  const e=sel.event(eid); if(!e) return;
  withButton($('#va-save'), ()=>{
    e.venue=val('va-venue')||e.venue;
    e.venueAddr=val('va-addr');
    e.venueAddr2=val('va-addr2');
    e.venueRegion=val('va-region');
    e.venuePostcode=val('va-postcode');
    e.city=val('va-city');
    e.country=val('va-country');
    persist('shows', eid); closeSheet(); softRender();
  }, 'Saved');
}
function sheetPromoter(eid){
  const e=sel.event(eid); const p=e.promoter||{};
  openSheetReact('Artist Liaison', 'show.artistLiaison', { eid });
}
function savePromoter(eid){
  const e=sel.event(eid); const name=val('pr-name');
  if(!name){ toast('Add a name','x'); return; }
  withButton($('#pr-save'), ()=>{
    const phone = val('pr-phone');
    const whatsapp = val('pr-wa') || phone;
    e.promoter = { name, phone, whatsapp };
    persist('shows', eid); closeSheet(); softRender();
  }, 'Promoter saved');
}
/* ---- Advancing: rich, ABOSS-depth show-day info. Every field hidden unless filled. ---- */
function advRow(icon,k,v,extra){ if(!v) return ''; return `<div class="info-line"><div class="ic">${icon}</div>${fieldTx(k, `<span style="white-space:pre-wrap">${esc(v)}</span>`)}${extra||''}</div>`; }
function roTimeFieldHtml(time, id){
  const tid = id || ('ro-t-' + Math.random().toString(36).slice(2, 8));
  return `<div class="field picker-field" style="flex:0 0 34%" onclick="openInputPicker('${tid}')">
      <input id="${tid}" class="input ro-t" type="time" value="${esc(time||'')}" onclick="event.stopPropagation();openInputPicker('${tid}')">
    </div>`;
}
function sheetAdvance(eid){
  const e=sel.event(eid); const a=e.advance||{};
  const sched=(a.schedule&&a.schedule.length?a.schedule:[{time:'',label:''}]);
  const roInputs = sched.map((s,i)=>`<div class="row-2 ro-edit" data-i="${i}" data-id="${esc(s.id||'')}">
      ${roTimeFieldHtml(s.time, 'ro-t-'+i)}
      <div class="field"><input class="input ro-l" value="${esc(s.label||s.title||'')}" placeholder="Soundcheck / Set / Curfew"></div>
    </div>`).join('');
  openSheetReact('Show-day details', 'show.dayDetails', { eid });
}
function addRoRow(){
  const wrap=$('#ad-ro'); if(!wrap) return;
  const div=document.createElement('div');
  div.className='row-2 ro-edit';
  div.innerHTML=`${roTimeFieldHtml('')}
    <div class="field"><input class="input ro-l" placeholder="Soundcheck / Set / Curfew"></div>`;
  wrap.appendChild(div);
  if(typeof enhanceDateTimeFields === 'function') enhanceDateTimeFields(div);
}
function saveAdvance(eid){
  const e=sel.event(eid);
  if(!e){ toast('Show not found','x'); return; }
  const schedule=[...document.querySelectorAll('#ad-ro .ro-edit')].map(r=>{
    let id = r.getAttribute('data-id') || '';
    if(!id || (typeof isUuid === 'function' && !isUuid(id))){
      id = (typeof newUuid === 'function') ? newUuid() : uid('ro');
    }
    const timeEl = r.querySelector('.ro-t');
    const time = ((timeEl && timeEl.value) || '').toString().trim().slice(0, 5);
    const label = ((r.querySelector('.ro-l')||{}).value || '').toString().trim();
    return { id, time, label };
  }).filter(s=>s.time||s.label);
  withButton($('#ad-save'), ()=>{
    e.advance={stage:val('ad-stage'),schedule,access:val('ad-access'),soundcheck:val('ad-sc'),curfew:val('ad-curfew'),dressingRoom:val('ad-dr'),guestlist:val('ad-gl'),catering:val('ad-cat'),parking:val('ad-park'),wifi:val('ad-wifi'),navAddr:val('ad-nav'),remarks:val('ad-rem')};
    /* Keep v2 mirror in sync so a mid-push reload cannot drop the new order. */
    if(store?.v2 && Array.isArray(store.v2.show_advances) && isUuid && isUuid(e.id)){
      const row = {
        show_id: e.id,
        organisation_id: store.organisationId || currentOrgId || null,
        stage_name: e.advance.stage || null,
        access_notes: e.advance.access || null,
        soundcheck_notes: e.advance.soundcheck || null,
        curfew_notes: e.advance.curfew || null,
        dressing_room_notes: e.advance.dressingRoom || null,
        guestlist_notes: e.advance.guestlist || null,
        catering_notes: e.advance.catering || null,
        parking_notes: e.advance.parking || null,
        wifi_notes: e.advance.wifi || null,
        navigation_address: e.advance.navAddr || null,
        general_remarks: e.advance.remarks || null,
        running_order: schedule
      };
      const list = store.v2.show_advances;
      const i = list.findIndex(r => r && r.show_id === e.id);
      if(i >= 0) list[i] = Object.assign({}, list[i], row);
      else list.push(row);
    }
    persist('shows', eid); closeSheet(); softRender();
  }, 'Details saved');
}
/* Key-contact roles — values match show_contacts.contact_role where possible. */
const SHOW_CONTACT_ROLES = [
  { value: 'artist_liaison', label: 'Artist Liaison' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'production', label: 'Production' },
  { value: 'venue_manager', label: 'Venue Manager' },
  { value: 'driver', label: 'Driver' },
  { value: 'emergency', label: 'Emergency' }
];
function showContactRoleLabel(role){
  if(!role) return '';
  const r = String(role).trim();
  const hit = SHOW_CONTACT_ROLES.find(x =>
    x.value === r ||
    x.label.toLowerCase() === r.toLowerCase() ||
    x.value.replace(/_/g, ' ') === r.toLowerCase()
  );
  return hit ? hit.label : r;
}
function matchShowContactRole(role){
  if(!role || !String(role).trim()) return { mode: 'empty' };
  const r = String(role).trim();
  if(r === 'other') return { mode: 'other', custom: '' };
  const hit = SHOW_CONTACT_ROLES.find(x =>
    x.value === r ||
    x.label.toLowerCase() === r.toLowerCase() ||
    x.value.replace(/_/g, ' ') === r.toLowerCase()
  );
  if(hit) return { mode: 'preset', value: hit.value };
  return { mode: 'other', custom: r };
}
function toggleEventContactRoleOther(){
  const pick = document.getElementById('ct-role');
  const wrap = document.getElementById('ct-role-other-wrap');
  if(!pick || !wrap) return;
  wrap.style.display = pick.value === '__other__' ? '' : 'none';
}
function sheetEventContact(eid,cid){
  const e=sel.event(eid); const c=(e.contacts||[]).find(x=>x.id===cid)||{};
  const matched = matchShowContactRole(c.role);
  const selected = matched.mode === 'preset' ? matched.value
    : matched.mode === 'other' ? '__other__'
    : '';
  const otherVal = matched.mode === 'other' ? (matched.custom || '') : '';
  const otherHidden = selected === '__other__' ? '' : 'display:none';
  const roleOpts = [
    `<option value="" ${selected===''?'selected':''}>Select role…</option>`,
    ...SHOW_CONTACT_ROLES.map(r =>
      `<option value="${esc(r.value)}" ${selected===r.value?'selected':''}>${esc(r.label)}</option>`
    ),
    `<option value="__other__" ${selected==='__other__'?'selected':''}>Other</option>`
  ].join('');
  openSheetReact(cid?'Edit contact':'Add contact', 'show.contact', { eid, cid });
}
function resolveEventContactRole(){
  const pick = rawVal('ct-role');
  if(pick === '__other__') return val('ct-role-other');
  return pick || '';
}
function saveEventContact(eid,cid){
  const e=sel.event(eid); const name=val('ct-name');
  if(!name){ toast('Add a name','x'); return; }
  if(rawVal('ct-role') === '__other__' && !val('ct-role-other')){
    toast('Enter a custom role','x'); return;
  }
  if(!e.contacts) e.contacts=[];
  const data={role:resolveEventContactRole(),name,phone:val('ct-phone'),whatsapp:val('ct-wa')};
  withButton($('#ct-save'), ()=>{
    if(cid){ const c=e.contacts.find(x=>x.id===cid); if(c) Object.assign(c,data); }
    else e.contacts.push({id:uid('ct'),...data});
    persist('shows', eid);
    if(typeof pushShowNow === 'function') pushShowNow(eid);
    closeSheet(); softRender();
  }, 'Contact saved');
}
function delEventContact(eid,cid){
  const e=sel.event(eid);
  e.contacts=(e.contacts||[]).filter(x=>x.id!==cid);
  persist('shows', eid);
  if(typeof pushShowNow === 'function') pushShowNow(eid);
  closeSheet(); softRender(); toast('Contact removed','trash');
}
function sheetShowChecklist(eid){
  const e = sel.event(eid);
  if(!e) return;
  if(!e.checklist) e.checklist = [];
  const rows = e.checklist.length
    ? `<div class="card flush">${e.checklist.map(i=>`<div class="check ${i.done?'done':''}" data-id="${esc(i.id)}"><div class="box" onclick="toggleEventCheck('${eid}','${i.id}')">${ICON.check(15)}</div><div class="lbl" onclick="toggleEventCheck('${eid}','${i.id}')">${esc(i.label)}</div><button class="del" onclick="delEventCheck('${eid}','${i.id}')">${ICON.x(16)}</button></div>`).join('')}</div>`
    : `<div class="hint" style="padding:8px 4px 12px">No items yet — add what you need to prep.</div>`;
  openSheetReact('Checklist', 'show.checklist', { eid });
}
function sheetShowTimeline(eid){
  const e = sel.event(eid);
  if(!e) return;
  const tl = typeof showDayTimeline==='function' ? showDayTimeline(e) : (e.timeline||[]);
  const autoN = tl.filter(s=>s.auto).length;
  const customN = tl.filter(s=>!s.auto).length;
  const rows = tl.length
    ? `<div class="card flush">${tl.map(s=>timelineStepRow(e,s,{edit:true})).join('')}</div>`
    : `<div class="hint" style="padding:8px 4px 12px">Add a flight, hotel, transport or set time on this show — those steps appear here automatically.</div>`;
  openSheetReact('Day timeline', 'show.timeline', { eid });
}
function sheetShowTimelineStep(eid, sid){
  const e = sel.event(eid);
  const existing = sid && e ? (e.timeline||[]).find(x=>x.id===sid) : null;
  sheetReturnStack.push({ kind:'showTimeline', id:eid });
  openSheetReact(existing?'Edit custom step':'Add custom step', 'show.timelineStep', { eid, sid });
}
function saveShowTimelineStep(eid, sid){
  const e = sel.event(eid);
  const time = rawVal('est-time');
  const title = val('est-title');
  if(!title){ toast('What happens?','x'); return; }
  withButton($('#est-save'), ()=>{
    e.timeline = e.timeline || [];
    if(sid){
      const s = e.timeline.find(x=>x.id===sid);
      if(s){ s.time=time||''; s.title=title; s.sub=val('est-sub'); }
    } else {
      e.timeline.push({ id: uid('tl'), time: time||'', title, sub: val('est-sub'), done: false });
    }
    e.timeline.sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    persist('shows', eid);
    if(typeof pushShowNow==='function') pushShowNow(eid);
    closeSheet(true, { noReturn:true });
    const ret = sheetReturnStack.pop();
    if(ret) reopenSheetReturn(ret);
    else sheetShowTimeline(eid);
  }, sid?'Step saved':'Step added');
}
function toggleShowTimelineStep(eid,sid){
  const e = sel.event(eid);
  if(!e || !sid) return;
  if(String(sid).startsWith('auto:')){
    if(typeof toggleShowAutoTimelineStep==='function') toggleShowAutoTimelineStep(e, sid);
  } else {
    const s = (e.timeline||[]).find(x=>x.id===sid);
    if(!s) return;
    s.done = !s.done;
  }
  haptic(); persist('shows', eid);
  let done = false;
  if(typeof showDayTimeline === 'function'){
    const step = showDayTimeline(e).find(x => x.id === sid);
    done = !!(step && step.done);
  } else {
    const s = (e.timeline||[]).find(x=>x.id===sid);
    done = !!(s && s.done);
  }
  if(sheetEl){
    if(typeof sheetShowTimeline==='function') sheetShowTimeline(eid);
  } else if(!patchCheckRowsById(sid, done)){
    softRender();
  } else {
    const prep = document.getElementById('fold-sg-'+eid+'-prep');
    const sub = prep && prep.querySelector('.show-group-titles span');
    if(sub && typeof prepGroupSummary==='function') sub.textContent = prepGroupSummary(e);
  }
}
function delShowTimelineStep(eid,sid){
  const e = sel.event(eid);
  if(!e || !e.timeline) return;
  if(String(sid).startsWith('auto:')){ toast('That step comes from show info — edit the flight, hotel or set time instead','x'); return; }
  e.timeline = e.timeline.filter(x=>x.id!==sid);
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  removeCheckRowsById(sid);
  if(sheetEl) sheetShowTimeline(eid);
  else softRender();
  toast('Step removed','trash');
}
function sheetTimelineStep(tid){
  openSheetReact('Add timeline step', 'show.timelineAdd', { tid });
}
function saveTimelineStep(tid){
  const t=sel.trip(tid); const time=rawVal('ts-time'); const title=val('ts-title');
  if(!title){ toast('What happens?','x'); return; }
  withButton($('#ts-save'), ()=>{
    t.timeline.push({id:uid('tl'),time:time||'',title,sub:val('ts-sub'),done:false});
    t.timeline.sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    persist('tours', tid); closeSheet(); softRender();
  }, 'Step added');
}
function sheetEmergency(tid){
  openSheetReact('Emergency contact', 'show.emergency', { tid });
}
function saveEmergency(tid){
  const t=sel.trip(tid); const name=val('em-name');
  if(!name){ toast('Add a name','x'); return; }
  withButton($('#em-save'), ()=>{ (t.emergency=t.emergency||[]).push({name,phone:val('em-phone')}); persist('tours', tid); closeSheet(); softRender(); }, 'Contact added');
}
/* ============================================================
   MONEY — event block, editor, overview
   ============================================================ */
function moneyBlock(e){
  return showGroup('sg-'+e.id+'-deal', 'Fee & deal', ICON.coins(20), dealGroupSummary(e), moneyGroupBody(e));
}
function sheetFinance(eid){
  const e=sel.event(eid); const f=e.finance||{};
  const curs = Object.keys(store.settings.fx);
  openSheetReact('Deal', 'show.deal', { eid });
}
function saveFinance(eid){
  const e=sel.event(eid); const f=e.finance||{expenses:[]};
  withButton($('#fi-save'), ()=>{
    e.finance = Object.assign({}, f, {
      fee:+val('fi-fee')||0, currency:rawVal('fi-cur'), dealType:getSeg('fi-deal')||'Guarantee',
      commission:+val('fi-comm')||0, perDiem:+val('fi-pd')||0, paid:getSeg('fi-paid')==='1',
      notDisclosed:getSeg('fi-nd')==='1', estimated:false,
      expenses:f.expenses||[],
    });
    persist('shows', eid); closeSheet(); softRender();
  }, 'Deal saved');
}
function togglePaid(eid){
  const e=sel.event(eid); if(!e||!e.finance) return;
  e.finance.paid=!e.finance.paid;
  haptic();
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  if(!patchShowDealPaid(eid, e.finance.paid)) softRender();
  toast(e.finance.paid?'Marked paid':'Marked unpaid', e.finance.paid?'check':'money');
}
function addExpense(eid){
  openSheetReact('Add expense', 'show.expense', { eid });
}
function saveExpense(eid){
  const label=val('ex-label'); const amount=+val('ex-amt')||0;
  if(!label && !amount){ toast('Add a label or amount','x'); return; }
  const e=sel.event(eid); (e.finance.expenses=e.finance.expenses||[]).push({id:uid('ex'),label,amount});
  persist('shows', eid); closeSheet(); softRender(); toast('Expense added','receipt');
}
function delExpense(eid,xid){ const e=sel.event(eid); e.finance.expenses=e.finance.expenses.filter(x=>x.id!==xid); persist('shows', eid); softRender(); }

/* ============================================================
   DAY SHEET — shareable advancing doc (ABOSS core, beaten on UX)
   ============================================================ */
function buildDaySheet(e){
  const c = money.eventCalc(e);
  const L=[];
  L.push(`🎧 DAY SHEET — ${showTitle(e,'Show')}`);
  L.push(`${e.city||''}${e.country?', '+e.country:''} · ${fmtDateLong(e.date)}`);
  L.push('');
  L.push('⏱ SCHEDULE');
  const tl = typeof showDayTimeline==='function' ? showDayTimeline(e) : (e.timeline||[]);
  if(tl.length){
    tl.forEach(s=>L.push(`  ${s.time||'—'} ${s.title}${s.sub?' — '+s.sub:''}`));
  } else {
    if(e.arrival) L.push(`  Arrival: ${e.arrival}`);
    if(e.setTime) L.push(`  Set time: ${e.setTime}`);
  }
  L.push('');
  L.push('📍 VENUE');
  L.push(`  ${e.venue||''}`);
  [e.venueAddr, e.venueAddr2, [e.city, e.venueRegion].filter(Boolean).join(', '), e.venuePostcode, e.country]
    .filter(Boolean).forEach(line => L.push(`  ${line}`));
  if(e.hotel){
    L.push(''); L.push('🏨 HOTEL'); L.push(`  ${e.hotel.name||''}`);
    const hAddr = typeof formatHotelAddress === 'function'
      ? formatHotelAddress(e.hotel)
      : [e.hotel.address, e.hotel.address2, e.hotel.city, e.hotel.region, e.hotel.postcode, e.hotel.country].filter(Boolean).join(', ');
    if(hAddr) L.push(`  ${hAddr}`);
    if(e.hotel.phone) L.push(`  Tel: ${e.hotel.phone}`);
    if(e.hotel.email) L.push(`  Email: ${e.hotel.email}`);
    const hConf = typeof hotelBookingRef === 'function' ? hotelBookingRef(e.hotel) : (e.hotel.conf || e.hotel.bookingRef || '');
    if(hConf) L.push(`  Conf: ${hConf}`);
    if(e.hotel.notes) L.push(`  Notes: ${e.hotel.notes}`);
    if(e.hotel.checkin) L.push(`  ${fmtDate(e.hotel.checkin)} → ${e.hotel.checkout?fmtDate(e.hotel.checkout):''}`);
  }
  const contacts=[];
  orderedDrivers(e).forEach(({d})=>{
    const tag = `${d.journey?' ('+d.journey+')':''}${d.time?' '+d.time:''}`;
    if(d.noGround) contacts.push(`  Transport${tag} — No grounds, use Uber/taxi`);
    else if(d.name||d.phone) contacts.push(`  Driver${tag} — ${d.name||''} ${d.phone||''}`);
  });
  if(e.promoter) contacts.push(`  Artist Liaison — ${e.promoter.name||''} ${e.promoter.phone||e.promoter.whatsapp||''}`);
  if(contacts.length){ L.push(''); L.push('📞 CONTACTS'); contacts.forEach(x=>L.push(x)); }
  if(e.content){ L.push(''); L.push('🎬 CONTENT'); L.push(`  ${e.content}`); }
  if(c.gross){ L.push(''); L.push('💷 DEAL'); L.push(`  ${e.finance.dealType}: ${fmtMoney(c.gross,c.cur)} (${c.paid?'paid':'unpaid'})`); L.push(`  Net take-home: ${fmtMoney(c.net,c.cur)}`); }
  if(e.notes){ L.push(''); L.push('📝 NOTES'); L.push(`  ${e.notes}`); }
  L.push('');
  L.push('— via Operate');
  return L.join('\n');
}
function shareDaySheet(eid){
  const e=sel.event(eid); if(!e) return;
  previewDaySheet(buildDaySheet(e), e);
}
function previewDaySheet(text, e){
  window.__daysheet = text;
  window.__daysheetEid = e ? e.id : null;
  window.__daysheetTitle = e ? ('Day Sheet — '+showTitle(e,'Show')) : 'Day sheet';
  openSheetReact('Day sheet', 'show.daySheet', { text, eid: e ? e.id : null });
}
/* Print / Save-as-PDF a clean day sheet via a hidden iframe (works on mobile
   Safari/Chrome — the OS print dialog offers "Save to Files as PDF"). */
function printDaySheet(eid){
  const e=sel.event(eid); if(!e) return;
  const artist=(store.settings&&store.settings.artistName&&store.settings.artistName!=='You')?store.settings.artistName:'';
  const body=esc(buildDaySheet(e));
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc('Day Sheet — '+showTitle(e,'Show'))}</title>
    <style>
      @page{margin:18mm}
      *{box-sizing:border-box}
      body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:0;padding:24px}
      .hd{border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px}
      .hd h1{font-size:22px;margin:0}
      .hd .sub{color:#555;font-size:13px;margin-top:3px}
      pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;color:#222;margin:0}
      .ft{margin-top:20px;color:#888;font-size:11px}
    </style></head><body>
    <div class="hd"><h1>${esc(showTitle(e,'Show'))}</h1><div class="sub">${esc([artist,e.venue&&e.eventName?e.venue:null,e.city,e.country,fmtDateLong(e.date)].filter(Boolean).join(' · '))}</div></div>
    <pre>${body}</pre>
    <div class="ft">Generated by Operate</div>
    </body></html>`;
  const ifr=document.createElement('iframe');
  ifr.setAttribute('aria-hidden','true');
  ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(ifr);
  const doc=ifr.contentWindow.document; doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(err){} setTimeout(()=>ifr.remove(), 1500); }, 350);
}
function daySheetShare(){
  const text=window.__daysheet||''; const title=window.__daysheetTitle||'Day sheet';
  if(navigator.share){ navigator.share({title, text}).then(()=>{ closeSheet(); toast('Shared','share'); }).catch(()=>{}); }
  else { copyText(text); toast('Copied','copy'); }
}

