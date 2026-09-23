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
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.isShowsListMounted === 'function'){
    return !!OperateReact.isShowsListMounted();
  }
  const view = document.getElementById('view');
  const appLive = typeof OperateReact !== 'undefined' && OperateReact && (
    (typeof OperateReact.isAppMounted === 'function' && OperateReact.isAppMounted())
    || (typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted())
  );
  return !!(appLive || (view && view.dataset && view.dataset.reactOutlet))
    && !!(document.getElementById('shows-mode-page') || (typeof store !== 'undefined' && store.tab === 'shows' && !overlay));
}
function setShowsMode(m){
  if(showsMode===m) return;
  showsMode=m;
  haptic();
  if(typeof saveNavState==='function') saveNavState();
  if(reactShowsListLive()){
    if(typeof OperateReact.refreshShowsList === 'function') OperateReact.refreshShowsList();
    else if(typeof notifyStore === 'function') notifyStore();
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
  const view = document.getElementById('view');
  if(view && view.dataset && view.dataset.reactOutlet) return false;
  if(typeof OperateReact !== 'undefined' && OperateReact && (
    (typeof OperateReact.isAppMounted === 'function' && OperateReact.isAppMounted())
    || (typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted())
  )) return false;
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
    else if(typeof notifyStore === 'function') notifyStore();
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
      else if(typeof notifyStore === 'function') notifyStore();
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
    <div class="body"><b>${showListTitleHtml(e, statusTag)}</b><span>${detail}</span></div>
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
          ${e.hotel?`<button type="button" class="hero-link" onclick="event.stopPropagation();openMaps('${jsAttr(hotelMapQuery(e))}')">${ICON.bed(14)} ${esc(e.hotel.name||'Accommodation')}</button>`:''}
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
  const stay = !!(e.hotel || showLegs(e.id).some(x=>x.kind==='stay'));
  const drvList = showDrivers(e);
  const driver = !!(drvList.some(d=>!d.noGround) || showLegs(e.id).some(x=>x.kind==='travel' && isDriverItem(x)));
  const noGround = drvList.some(d=>d.noGround);
  const typeCounts = {};
  showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')!=='plane' && !isDriverItem(x)).forEach(l=>{
    const k = travelTypeKey(l);
    typeCounts[k] = (typeCounts[k]||0)+1;
  });
  const parts = [];
  if(flightN) parts.push(flightN+' flight'+(flightN>1?'s':''));
  if(typeCounts.train) parts.push(typeCounts.train+' train'+(typeCounts.train>1?'s':''));
  if(typeCounts.coach) parts.push(typeCounts.coach+' coach'+(typeCounts.coach>1?'es':''));
  if(typeCounts.ferry) parts.push(typeCounts.ferry+' ferr'+(typeCounts.ferry>1?'ies':'y'));
  if(driver) parts.push('ground');
  if(noGround) parts.push('arrange at time');
  if(typeCounts.walk) parts.push(typeCounts.walk+' walk'+(typeCounts.walk>1?'s':''));
  if(typeCounts.cycle) parts.push(typeCounts.cycle+' cycle'+(typeCounts.cycle>1?'s':''));
  if(stay) parts.push('accommodation');
  else if(e.noAccommodation) parts.push('no accommodation');
  return parts.length ? parts.join(' · ') : 'Add travel or accommodation';
}
function venueGroupSummary(e){
  const n = countAdvanceFields(e.advance);
  const venue = cleanVenue(e.venue) || 'Venue';
  const contacts = (e.contacts||[]).length + (e.promoter ? 1 : 0);
  const bits = [venue];
  if(n) bits.push(n+' day-of detail'+(n>1?'s':''));
  if(contacts) bits.push(contacts+' contact'+(contacts>1?'s':''));
  return bits.join(' · ');
}
function prepGroupSummary(e){
  const cp = sel.eventChecklistProgress(e);
  const remaining = cp.total ? Math.max(0, cp.total - cp.done) : 0;
  if(remaining) return remaining+' task'+(remaining>1?'s':'')+' remaining';
  const ideas = store.ideas.filter(x=>x.eventId===e.id).length;
  const contentN = ideas + (e.content?1:0);
  const attachN = (e.attachments||[]).length;
  const parts = [];
  if(cp.total) parts.push('checklist '+cp.done+'/'+cp.total);
  if(contentN) parts.push(contentN+' content item'+(contentN>1?'s':''));
  if(attachN) parts.push(attachN+' attachment'+(attachN>1?'s':''));
  if(typeof noteItemsHas==='function' ? noteItemsHas(e.notes) : (e.notes&&e.notes.trim())) parts.push('notes');
  return parts.length ? parts.join(' · ') : 'Checklist, content, notes';
}
function dealGroupSummary(e){
  if(e.finance&&e.finance.notDisclosed) return 'Not disclosed';
  const c = money.eventCalc(e);
  if(!c.gross) return 'Add the fee or mark as not disclosed';
  return fmtMoney(c.gross,c.cur)+(c.paid?' · paid':' · unpaid');
}
function flightsSubsection(e){
  const legs = showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')==='plane');
  const manual = (e.flights||[]).filter(f => typeof flightHasDetails!=='function' || flightHasDetails(f));
  const cards = (typeof sortJourneysChrono === 'function' ? sortJourneysChrono : (list)=>list.slice())([
    ...legs.map(l => ({ id:'leg-'+l.id, _kind:'leg', date:l.date, start:l.start, time:l.time, dep:l.dep, trueDate:l.trueDate, data:l })),
    ...manual.map(f => ({ id:'flt-'+f.id, _kind:'flight', date:e.date, dep:f.dep, data:f }))
  ], e.date);
  if(!cards.length) return '';
  const body = cards.map(card => `<div class="card flush flight-card-wrap">${
    card._kind==='leg' ? travelLegCard(card.data) : flightLine(e.id, card.data)
  }</div>`).join('');
  return showSubsection('ss-'+e.id+'-flights', 'Flights', `<button type="button" class="add" onclick="sheetFlight('${e.id}','__new__')">Add</button>`, body, true);
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
  if(legs.length) body += `<div class="card flush">${legs.map(journeyRow).join('')}</div>`;
  if(e.hotel){
    const addr = typeof formatHotelAddress === 'function'
      ? formatHotelAddress(e.hotel)
      : [e.hotel.address, e.hotel.postcode].filter(Boolean).join(', ');
    const conf = typeof hotelBookingRef === 'function' ? hotelBookingRef(e.hotel) : (e.hotel.conf || e.hotel.bookingRef || '');
    body += `<div class="card flush">
      <div class="info-line info-line-stacked"><div class="ic">${ICON.bed(17)}</div>${detailTx(esc(e.hotel.name||'Accommodation'), esc(addr || 'Tap to add address'))}
        <button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openMaps('${jsAttr(hotelMapQuery(e))}')">${ICON.map(16)}</button></div>
      <div class="info-line"><div class="ic">${ICON.clock(17)}</div>${fieldTx('Check in / out', `${e.hotel.checkin?fmtDate(e.hotel.checkin):'—'} → ${e.hotel.checkout?fmtDate(e.hotel.checkout):'—'}`)}</div>
      ${conf?`<div class="info-line" onclick="copyText('${jsAttr(conf)}')"><div class="ic">${ICON.ticket(17)}</div>${fieldTx('Confirmation', esc(conf))}<button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.copy(16)}</button></div>`:''}
      ${e.hotel.phone?`<div class="info-line" onclick="callNumber('${jsAttr(e.hotel.phone)}')"><div class="ic">${ICON.phone(17)}</div>${fieldTx('Phone', esc(e.hotel.phone))}<button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.phone(16)}</button></div>`:''}
      ${e.hotel.email?`<div class="info-line" onclick="copyText('${jsAttr(e.hotel.email)}')"><div class="ic">${ICON.chat(17)}</div>${fieldTx('Email', esc(e.hotel.email))}<button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.copy(16)}</button></div>`:''}
      ${noteItemsHas(e.hotel.notes)?`<div class="info-line" style="align-items:flex-start"><div class="ic">${ICON.note(17)}</div>${noteItemsReadHtml('Room notes', e.hotel.notes)}</div>`:''}
    </div>`;
  }
  if(!body){
    body = `<div class="show-compact-row" onclick="sheetHotel('${e.id}')"><span>There is currently no accommodation</span><button type="button" class="add" onclick="event.stopPropagation();sheetHotel('${e.id}')">Add</button></div>`;
  }
  const has = !!(legs.length || e.hotel);
  const headAct = has ? `<button type="button" class="add" onclick="sheetHotel('${e.id}')">${e.hotel?'Edit':'Add'}</button>` : '';
  return showSubsection('ss-'+e.id+'-hotel', 'Accommodation', headAct, body, !has);
}
/* Chronological rank for a driver by its journey: arrival → set → departure.
   Only used when no date/time is available. */
function driverJourneyRank(j){
  if(!j) return 99;
  const i = DRIVER_JOURNEYS.findIndex(x=>x.toLowerCase()===String(j).toLowerCase().trim());
  return i<0 ? 99 : i;
}
function orderedDrivers(e){
  return showDrivers(e).map((d,idx)=>({d,idx}))
    .sort((a,b)=>{
      const ka = typeof journeyWhenMs === 'function' ? journeyWhenMs(a.d, e && e.date) : Number.POSITIVE_INFINITY;
      const kb = typeof journeyWhenMs === 'function' ? journeyWhenMs(b.d, e && e.date) : Number.POSITIVE_INFINITY;
      if(ka !== kb) return ka - kb;
      const bothUntimed = !Number.isFinite(ka) && !Number.isFinite(kb);
      if(bothUntimed){
        const ra = driverJourneyRank(driverJourneyLabel(a.d));
        const rb = driverJourneyRank(driverJourneyLabel(b.d));
        if(ra !== rb) return ra - rb;
      }
      return a.idx - b.idx;
    });
}
function groundPreferredKey(d){
  const stored = String((d&&d.preferredMethod)||(d&&d.preferred_method)||'').toLowerCase();
  if(stored==='uber'||stored==='taxi'||stored==='either') return stored;
  if((d&&d.arrangement)==='arrange_at_time' || (d&&d.noGround)){
    const gt=String((d&&d.groundType)||'').toLowerCase();
    if(gt==='uber'||gt==='taxi') return gt;
    return 'either';
  }
  const gt=String((d&&d.groundType)||'').toLowerCase();
  if(gt==='uber'||gt==='taxi') return gt;
  return 'either';
}
function groundArrangeSummary(d){
  const k=groundPreferredKey(d);
  if(k==='uber') return 'Arrange at time — Uber';
  if(k==='taxi') return 'Arrange at time — Taxi';
  return 'Arrange at time — Uber or taxi';
}
window.groundPreferredKey = groundPreferredKey;
window.groundArrangeSummary = groundArrangeSummary;
/* Resolve a journey's DESTINATION (arrival location) to a Maps query. */
function driverDestMapQuery(e, d){
  ensureDriverLocations(d);
  if(typeof resolveJourneyEndpoint === 'function'){
    const q = resolveJourneyEndpoint(d, 'to', e, (e && e.city) || '', 'destination', (d && d.date) || (e && e.date));
    if(q) return q;
  }
  const destRaw = (d && (d.toName || d.to)) || '';
  const j = destRaw || ((d && d.journey) || '');
  const parts = j.split(/→|->|>|–|-/);
  const dest = (destRaw || (parts.length>1 ? parts[parts.length-1] : (parts[0]||''))).trim().toLowerCase();
  if(/venue/.test(dest)) return venueMapQuery(e);
  if(/hotel/.test(dest)) return hotelMapQuery(e);
  if(/airport/.test(dest)){
    const code = (typeof transferAirportCode==='function') ? transferAirportCode(e, false, e.date) : null;
    return code ? code+' airport' : ((e.city?e.city+' ':'')+'airport');
  }
  if(dest) return dest + (e.city && !dest.includes(e.city.toLowerCase()) ? ' '+e.city : '');
  return '';
}
function travelRouteFromPlaces(from, to, mode, fromName, toName){
  if(!(from || to || fromName || toName)) return '';
  const m = mode || 'car';
  if(typeof travelRouteStackedHtml === 'function'){
    if(m==='plane' || m==='flight' || m==='planetop'){
      const fromCode = (typeof flightIataFromPlace==='function' ? flightIataFromPlace(from || fromName) : '') || from || '';
      const toCode = (typeof flightIataFromPlace==='function' ? flightIataFromPlace(to || toName) : '') || to || '';
      const lookedFrom = (typeof airportName==='function' ? airportName(fromCode) : '') || fromName || '';
      const lookedTo = (typeof airportName==='function' ? airportName(toCode) : '') || toName || '';
      return travelRouteStackedHtml(fromCode, lookedFrom, toCode, lookedTo, 'plane');
    }
    return travelRouteStackedHtml(from || '', fromName || '', to || '', toName || '', m);
  }
  if(typeof groundRouteHtml === 'function') return groundRouteHtml(from || '?', to || '?', m);
  return esc((from || '?')+' → '+(to || '?'));
}
function sameDisplayText(a, b){
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
function groundTypeDisplayLabel(gt){
  const k = String(gt || '').toLowerCase().replace(/[\s-]+/g, '_');
  const map = {
    taxi: 'Taxi',
    uber: 'Uber',
    private_car: 'Private car',
    chauffeur: 'Chauffeur',
    shuttle: 'Shuttle',
    minibus: 'Minibus',
    bus: 'Bus',
    other: 'Other'
  };
  return map[k] || '';
}
function groundPreferredDisplay(d){
  const k = String((d && d.preferredMethod) || '').toLowerCase();
  if(k === 'uber') return 'Uber';
  if(k === 'taxi') return 'Taxi';
  if(k === 'either') return 'Either';
  return '';
}
function groundArrangementDisplay(d){
  const a = String((d && d.arrangement) || '').toLowerCase();
  if(a === 'pre_arranged') return 'Pre-arranged';
  if(a === 'arrange_at_time') return 'Arrange at time';
  return '';
}
function groundDurationFromTimes(dep, arr){
  const parse = t => {
    const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if(h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const a = parse(dep);
  const b = parse(arr);
  if(a == null || b == null) return '';
  let mins = b - a;
  if(mins <= 0) mins += 24 * 60;
  if(mins <= 0) return '';
  if(mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? (h + 'h ' + m + 'm') : (h + 'h');
}
function groundFactHtml(label, value, extras){
  if(!String(value || '').trim()) return '';
  const extraList = (Array.isArray(extras) ? extras : [extras])
    .map(x => String(x || '').trim())
    .filter(Boolean);
  const extraHtml = extraList.map(x => `<div class="flight-pax-ref">${esc(x)}</div>`).join('');
  return `<div class="flight-pax-row is-compact">
    <div class="flight-pax-name">${esc(value)}${extraHtml}</div>
    <div class="flight-pax-pass-k">${label ? esc(label) : ''}</div>
  </div>`;
}
function driverCard(eid, d, idx){
  const show = (typeof sel !== 'undefined' && sel.event) ? sel.event(eid) : null;
  if(typeof applyGeneralDriverPlaces === 'function') applyGeneralDriverPlaces(d, show);
  else ensureDriverLocations(d);
  const dateLabel = (d.date && typeof fmtDate==='function') ? fmtDate(d.date) : '';
  const title = (typeof groundTransferTitle === 'function' ? groundTransferTitle(d) : '') || 'Drive';
  const fromName = (typeof groundRouteRealName === 'function' ? groundRouteRealName(d.from, d.fromName, show) : d.fromName) || '';
  const toName = (typeof groundRouteRealName === 'function' ? groundRouteRealName(d.to, d.toName, show) : d.toName) || '';
  const routeHtml = travelRouteFromPlaces(d.from, d.to, 'car', fromName, toName);
  const kvRow = (k, v) => v
    ? `<div class="flight-side-kv"><div class="flight-side-k">${esc(k)}</div><div class="flight-side-v">${esc(v)}</div></div>`
    : '';
  const pickup = String(d.pickup || '').trim();
  const notes = typeof parseNoteItems==='function'
    ? parseNoteItems(d.notes)
    : (String(d.notes || '').trim() ? [{id:'legacy',text:String(d.notes)}] : []);
  const noteItems = notes.filter(n => {
    const t = String((n && n.text) || '').trim();
    return t && !sameDisplayText(t, pickup);
  });
  const arrangeAtTime = d.arrangement === 'arrange_at_time' || (!d.arrangement && !!d.noGround);
  const preferred = groundPreferredDisplay(d);
  const typeLabel = groundTypeDisplayLabel(d.groundType);
  const driverName = String(d.name || '').trim();
  const operator = String(d.operator || '').trim();
  const vehicle = String(d.vehicle || '').trim();
  const phone = String(d.phone || '').trim();
  const whatsapp = String(d.whatsapp || '').trim();
  const contactExtras = [phone];
  if(whatsapp && !sameDisplayText(whatsapp, phone)) contactExtras.push(whatsapp);

  let factsHtml = '';
  if(arrangeAtTime){
    factsHtml += groundFactHtml('', preferred);
    if(typeLabel && !sameDisplayText(typeLabel, preferred)){
      factsHtml += groundFactHtml('Type', typeLabel);
    }
  } else {
    if(driverName) factsHtml += groundFactHtml('', driverName, contactExtras);
    else if(phone || whatsapp) factsHtml += groundFactHtml('', phone || whatsapp, (phone && whatsapp && !sameDisplayText(whatsapp, phone)) ? whatsapp : '');
    if(operator && !sameDisplayText(operator, driverName)) factsHtml += groundFactHtml('Operator', operator);
    if(vehicle) factsHtml += groundFactHtml('Vehicle', vehicle);
    if(typeLabel
      && !sameDisplayText(typeLabel, vehicle)
      && !sameDisplayText(typeLabel, operator)
      && !sameDisplayText(typeLabel, driverName)){
      factsHtml += groundFactHtml('Type', typeLabel);
    }
  }
  const factsHeading = arrangeAtTime ? 'Preferred' : (driverName ? 'Driver' : (factsHtml ? 'Details' : ''));
  const factsBlock = factsHtml
    ? `<div class="flight-pax-wrap ground-facts">
        <div class="flight-pax-head">${esc(factsHeading)}</div>
        <div class="flight-pax-preview">${factsHtml}</div>
      </div>`
    : '';

  const arrTime = String(d.end || d.arr || '').trim();
  const duration = String(d.duration || '').trim() || groundDurationFromTimes(d.time, arrTime);
  const metaHtml = [
    kvRow('Dep', d.time || ''),
    kvRow('Arr', arrTime),
    kvRow('Arrangement', groundArrangementDisplay(d)),
    kvRow('Duration', duration)
  ].filter(Boolean).join('');

  const pickupBlock = pickup
    ? `<div class="ground-notes-block"><div class="flight-side-notes-k">Pickup</div><div class="flight-side-notes-v">${esc(pickup)}</div></div>`
    : '';
  const notesBlock = noteItems.length
    ? `<div class="ground-notes-block"><div class="flight-side-notes-k">Notes</div>${noteItems.map(n=>`<div class="flight-side-notes-v">${esc(n.text)}</div>`).join('')}</div>`
    : '';
  const bottomHtml = (pickupBlock || notesBlock)
    ? `<div class="flight-card-notes">${pickupBlock}${notesBlock}</div>`
    : '';

  return `<div class="flight-block">
    <div class="flight-card-tools">
      <button type="button" class="flight-card-tool" title="Edit" onclick="event.stopPropagation();sheetDriver('${eid}',${idx})">${ICON.edit(15)}</button>
      <button type="button" class="flight-card-tool is-danger" title="Remove" onclick="event.stopPropagation();confirmRemoveDriver('${eid}',${idx})">${ICON.trash(15)}</button>
    </div>
    <div class="flight-card-body is-ground">
      <div class="flight-journey-main">
        <div class="flight-card-title">
          <span class="flight-journey-ic">${ICON.car(17)}</span>
          <div class="flight-journey-heading">
            <b class="flight-journey-code">${esc(title)}</b>
            ${dateLabel?`<span class="flight-journey-date">${esc(dateLabel)}</span>`:''}
          </div>
        </div>
        ${routeHtml?`<div class="flight-card-route">${routeHtml}</div>`:''}
      </div>
      ${factsBlock}
      ${metaHtml ? `<div class="flight-journey-side">${metaHtml}</div>` : ''}
      ${bottomHtml}
    </div>
  </div>`;
}
function driverSubsection(e){
  const legs = showLegs(e.id).filter(x=>x.kind==='travel' && isDriverItem(x));
  const ordered = orderedDrivers(e);
  const cards = (typeof sortJourneysChrono === 'function' ? sortJourneysChrono : (list)=>list.slice())([
    ...legs.map(l => ({ id:'leg-'+l.id, _kind:'leg', date:l.date, start:l.start, time:l.time, dep:l.dep, trueDate:l.trueDate, data:l })),
    ...ordered.map(o => ({ id:'drv-'+(o.d.id||o.idx), _kind:'driver', date:o.d.date, time:o.d.time, start:o.d.start, dep:o.d.dep, data:o }))
  ], e.date);
  if(!cards.length) return '';
  const body = cards.map(card => `<div class="card flush flight-card-wrap">${
    card._kind==='leg' ? travelLegCard(card.data) : driverCard(e.id, card.data.d, card.data.idx)
  }</div>`).join('');
  return showSubsection('ss-'+e.id+'-driver', 'Ground transport', `<button type="button" class="add" onclick="sheetDriver('${e.id}')">Add</button>`, body, true);
}
const TRAVEL_TYPE_SECTIONS = [
  { key:'train', icon:'train', title:'Trains', mode:'train' },
  { key:'coach', icon:'bus', title:'Coaches', mode:'coach' },
  { key:'ferry', icon:'ferry', title:'Ferries', mode:'ferry' },
  { key:'walk', icon:'walk', title:'Walks', mode:'walk' },
  { key:'cycle', icon:'cycle', title:'Cycles', mode:'cycle' }
];
function travelTypeKey(l){
  if(!l || l.kind!=='travel' || (typeof isDriverItem==='function' && isDriverItem(l))) return '';
  const ic = l.icon || 'plane';
  if(ic==='plane' || ic==='car') return '';
  if(ic==='bus') return 'coach';
  if(ic==='bike') return 'cycle';
  if(ic==='train' || ic==='ferry' || ic==='walk' || ic==='cycle') return ic;
  const t = String(l.title||'').toLowerCase();
  if(/ferry|boat/.test(t)) return 'ferry';
  if(/train|rail/.test(t)) return 'train';
  if(/coach|bus/.test(t)) return 'coach';
  if(/walk/.test(t)) return 'walk';
  if(/cycle|bike/.test(t)) return 'cycle';
  return 'coach';
}
function travelLegsOfType(e, key){
  const list = showLegs(e.id).filter(x=>travelTypeKey(x)===key);
  return typeof sortJourneysChrono === 'function' ? sortJourneysChrono(list, e.date) : list.sort(legSort);
}
function travelLegCard(l){
  const icon = l.icon || 'train';
  const type = (typeof logisticTypeLabel==='function' ? logisticTypeLabel(l) : '') || 'Travel';
  const hop = Number(l.routeTotal)>1 ? ((Number(l.routeIndex)||0)+1)+' of '+l.routeTotal : '';
  const code = l.trainNo || l.ferryNo || l.coachNo || l.flightNo || '';
  const show = (typeof sel !== 'undefined' && sel.event) ? sel.event(l.showId) : null;
  const heading = (icon === 'car' && !code)
    ? ((typeof groundTransferTitle === 'function' ? groundTransferTitle(l) : '') || 'Drive')
    : (code || type);
  const dateLabel = (l.date && typeof fmtDate==='function') ? fmtDate(l.date) : (l.date || '');
  const dateLine = [dateLabel, hop].filter(Boolean).join(' · ');
  const ic = (ICON[icon] && typeof ICON[icon]==='function') ? ICON[icon] : ICON.train;
  const fromName = icon === 'car' && typeof groundRouteRealName === 'function'
    ? groundRouteRealName(l.from, l.fromName, show)
    : (l.fromName || '');
  const toName = icon === 'car' && typeof groundRouteRealName === 'function'
    ? groundRouteRealName(l.to, l.toName, show)
    : (l.toName || '');
  const routeHtml = travelRouteFromPlaces(l.from, l.to, icon, fromName, toName);
  const kvRow = (k, v) => v
    ? `<div class="flight-side-kv"><div class="flight-side-k">${esc(k)}</div><div class="flight-side-v">${esc(v)}</div></div>`
    : '';
  const notesRaw = l.info || l.notes || '';
  const notes = typeof parseNoteItems==='function'
    ? parseNoteItems(notesRaw)
    : (String(notesRaw).trim() ? [{id:'legacy',text:String(notesRaw)}] : []);
  const duration = String(l.duration || '').trim() || groundDurationFromTimes(l.start, l.end);
  const metaHtml = [
    kvRow('Dep', l.start || ''),
    kvRow('Arr', l.end || ''),
    kvRow('Operator', l.operator || ''),
    kvRow('Platform', l.platform || ''),
    kvRow('Duration', duration),
    kvRow('Booking', l.bookingRef || ''),
    kvRow('Status', l.fstatus || '')
  ].filter(Boolean).join('');
  return `<div class="flight-block">
    <div class="flight-card-tools">
      <button type="button" class="flight-card-tool" title="Edit" onclick="event.stopPropagation();openItem('${l.id}')">${ICON.edit(15)}</button>
      <button type="button" class="flight-card-tool is-danger" title="Remove" onclick="event.stopPropagation();confirmRemoveTravelLeg('${l.id}')">${ICON.trash(15)}</button>
    </div>
    <div class="flight-card-body">
      <div class="flight-journey-main">
        <div class="flight-card-title">
          <span class="flight-journey-ic">${ic(17)}</span>
          <div class="flight-journey-heading">
            <b class="flight-journey-code">${esc(heading)}</b>
            ${dateLine?`<span class="flight-journey-date">${esc(dateLine)}</span>`:''}
          </div>
        </div>
        ${routeHtml?`<div class="flight-card-route">${routeHtml}</div>`:''}
      </div>
      ${metaHtml ? `<div class="flight-journey-side">${metaHtml}</div>` : ''}
      ${notes.length ? `<div class="flight-card-notes"><div class="flight-side-notes-k">Notes</div>${notes.map(n=>`<div class="flight-side-notes-v">${esc(n.text)}</div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}
function travelTypeSubsection(e, spec){
  const legs = travelLegsOfType(e, spec.key);
  if(!legs.length) return '';
  return showSubsection(
    'ss-'+e.id+'-'+spec.key,
    spec.title,
    `<button type="button" class="add" onclick="sheetTravelLeg('${e.id}','${spec.mode}')">Add</button>`,
    legs.map(l=>`<div class="card flush flight-card-wrap">${travelLegCard(l)}</div>`).join(''),
    true
  );
}
function travelTypeSubsections(e){
  return TRAVEL_TYPE_SECTIONS.map(spec=>travelTypeSubsection(e, spec)).join('');
}
window.travelTypeKey = travelTypeKey;
window.travelLegCard = travelLegCard;
window.driverCard = driverCard;
window.TRAVEL_TYPE_SECTIONS = TRAVEL_TYPE_SECTIONS;
function addTravelPickerHtml(eid){
  const modes = [
    ['flight','plane','Flight','Number, times, passengers and boarding passes'],
    ['train','train','Train','Stations, times and service number'],
    ['coach','bus','Coach','Service and times'],
    ['ferry','ferry','Ferry','Ports and times'],
    ['ground','car','Drive','Pre-arranged or arrange at time'],
    ['walk','walk','Walk','On foot between places'],
    ['cycle','cycle','Cycle','Bike between places']
  ];
  return `<div class="block-title" style="margin:2px 2px 8px">Add travel</div><div class="edit-section-grid" style="margin-bottom:12px">${modes.map(([key,icon,title,sub])=>`<button type="button" class="edit-section-btn" onclick="addTravelMode('${eid}','${key}')"><span class="ic">${(ICON[icon]||ICON.plane)(16)}</span><span><b>${title}</b><small>${sub}</small></span></button>`).join('')}</div>`;
}
function travelGroupBody(e){
  const flights = flightsSubsection(e);
  const trains = travelTypeSubsection(e, TRAVEL_TYPE_SECTIONS[0]);
  const coaches = travelTypeSubsection(e, TRAVEL_TYPE_SECTIONS[1]);
  const ferries = travelTypeSubsection(e, TRAVEL_TYPE_SECTIONS[2]);
  const drivers = driverSubsection(e);
  const walks = travelTypeSubsection(e, TRAVEL_TYPE_SECTIONS[3]);
  const cycles = travelTypeSubsection(e, TRAVEL_TYPE_SECTIONS[4]);
  const types = trains+coaches+ferries+walks+cycles;
  const hasTravel = !!(flights || drivers || types);
  const travel = hasTravel
    ? (flights+trains+coaches+ferries+drivers+walks+cycles+`<button type="button" class="quiet-add" onclick="sheetAddTravel('${e.id}')">Add travel</button>`)
    : addTravelPickerHtml(e.id);
  return travel+hotelSubsection(e);
}
function venueSubsection(e){
  const addr = formatVenueAddress(e);
  const addrDisplay = addr || (e.city ? [e.city, e.country].filter(Boolean).join(', ') : '') || 'Tap to add';
  const mapQ = venueMapQuery(e);
  const body = `<div class="show-venue-stack">
    <div class="info-line show-venue-row is-block">
      <div class="ic">${ICON.pin(16)}</div>
      ${fieldTx('Address', `<span>${esc(addrDisplay)}</span>`)}
      ${mapQ?`<button type="button" class="show-venue-action" onclick="openMaps('${jsAttr(mapQ)}')" title="Open in Maps">${ICON.map(16)}</button>`:''}
      <button type="button" class="header-btn show-venue-edit" onclick="sheetVenueAddr('${e.id}')" title="Edit venue">${ICON.edit(15)}</button>
    </div>
    ${e.promoter?`<div class="info-line show-venue-row is-compact">
      <div class="ic">${ICON.user(16)}</div>
      ${fieldTx('Artist Liaison', esc(e.promoter.name||'Liaison'))}
      ${(e.promoter.phone||e.promoter.whatsapp)?`<button type="button" class="show-venue-action" onclick="contactPromoter('${e.id}')">${ICON.chat(15)} Contact</button>`:''}
      <button type="button" class="header-btn show-venue-edit" onclick="sheetPromoter('${e.id}')" title="Edit liaison">${ICON.edit(15)}</button>
    </div>`:`<div class="info-line show-venue-row" onclick="sheetPromoter('${e.id}')"><div class="ic">${ICON.plus(16)}</div><div class="tx"><div class="v" style="color:var(--accent-2)">Add artist liaison</div></div></div>`}
  </div>`;
  return showSubsection('ss-'+e.id+'-venue', 'Venue & liaison', '', body, true);
}
function advanceSubsection(e){
  const a = e.advance||{};
  const sched = (a.schedule||[]).filter(s=>(s.time||s.label||s.title));
  const schedHTML = sched.length?`<div class="ro-list">${sched.map(s=>`<div class="ro-row"><div class="ro-lab">${esc(s.label||s.title||'')}</div><div class="ro-time">${esc(s.time||'')}</div></div>`).join('')}</div>`:'';
  const navExtra = a.navAddr?`<button class="show-venue-action" onclick="openMaps('${jsAttr(a.navAddr)}')">${ICON.map(16)}</button>`:'';
  const hasAny = countAdvanceFields(a) > 0;
  const editBtn = `<button type="button" class="add" onclick="sheetAdvance('${e.id}')">${hasAny?'Edit':'Add'}</button>`;
  if(!hasAny){
    return showSubsection('ss-'+e.id+'-advancing', 'Show-day details', editBtn, `<div class="show-venue-empty"><div class="card tap" onclick="sheetAdvance('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.checkList(20)} Add show-day details<div style="margin-top:4px;font-size:12px;font-weight:500">Access, soundcheck, running order, wifi…</div></div></div>`);
  }
  const scheduleRows = [advRow(ICON.pin(16),'Stage / area',a.stage), schedHTML?`<div class="info-line show-venue-row is-block" style="align-items:flex-start"><div class="ic">${ICON.clock(16)}</div><div class="tx" style="width:100%"><div class="k">Running order</div>${schedHTML}</div></div>`:''].filter(Boolean).join('');
  const accessRows = [advRow(ICON.planeUp(16),'Access / arrival',a.access), advRow(ICON.music(16),'Sound check',a.soundcheck), advRow(ICON.clock(16),'Curfew',a.curfew), advRow(ICON.pin(16),'Navigation address',a.navAddr,navExtra)].filter(Boolean).join('');
  const backstageRows = [advRow(ICON.face(16),'Dressing room',a.dressingRoom), advRow(ICON.users(16),'Guest list',a.guestlist), advRow(ICON.bag(16),'Catering / rider',a.catering), advRow(ICON.car(16),'Parking',a.parking), advRow(ICON.globe(16),'WiFi',a.wifi)].filter(Boolean).join('');
  const otherRows = advRow(ICON.note(16),'Remarks',a.remarks);
  const mini = (title, rows)=> rows ? `<div class="show-adv-mini"><div class="show-adv-mini-head">${esc(title)}</div><div class="show-venue-stack">${rows}</div></div>` : '';
  const body = mini('Schedule', scheduleRows)+mini('Access', accessRows)+mini('Backstage', backstageRows)+mini('Other', otherRows);
  return showSubsection('ss-'+e.id+'-advancing', 'Show-day details', editBtn, body, true);
}
function contactsSubsection(e){
  const cs = e.contacts||[];
  const p = e.promoter;
  const has = !!(p || cs.length);
  const headBtn = has
    ? `<button type="button" class="add" onclick="sheetKeyContacts('${e.id}')">Edit</button>`
    : `<button type="button" class="add" onclick="sheetEventContact('${e.id}')">Add</button>`;
  if(!has){
    return showSubsection('ss-'+e.id+'-contacts', 'Key contacts', headBtn, `<div class="show-venue-empty"><div class="card tap" onclick="sheetEventContact('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.users(20)} Add a key contact</div></div>`);
  }
  const liaisonRow = p ? `<div class="info-line info-line-stacked show-venue-row is-block">
    <div class="ic">${ICON.user(16)}</div>
    <div class="tx" style="flex:1;min-width:0" onclick="sheetPromoter('${e.id}')">${detailParts('Artist Liaison', esc(p.name||'Liaison'), p.phone?esc(p.phone):'')}</div>
    ${p.phone?`<button class="show-venue-action" onclick="callNumber('${jsAttr(p.phone)}')">${ICON.phone(15)}</button>`:''}
    ${(p.whatsapp||p.phone)?`<button class="show-venue-action" onclick="whatsapp('${jsAttr(p.whatsapp||p.phone)}')">${ICON.chat(15)}</button>`:''}
  </div>` : '';
  const otherRows = cs.map(ct=>`<div class="info-line info-line-stacked show-venue-row is-block">
    <div class="ic">${ICON.user(16)}</div>
    <div class="tx" style="flex:1;min-width:0" onclick="sheetEventContact('${e.id}','${ct.id}')">${detailParts(ct.role?esc(showContactRoleLabel(ct.role)):'Contact', esc(ct.name||'Contact'), ct.phone?esc(ct.phone):'')}</div>
    ${ct.phone?`<button class="show-venue-action" onclick="callNumber('${jsAttr(ct.phone)}')">${ICON.phone(15)}</button>`:''}
    ${(ct.whatsapp||ct.phone)?`<button class="show-venue-action" onclick="whatsapp('${jsAttr(ct.whatsapp||ct.phone)}')">${ICON.chat(15)}</button>`:''}
  </div>`).join('');
  return showSubsection('ss-'+e.id+'-contacts', 'Key contacts', headBtn, `<div class="show-venue-stack">${liaisonRow}${otherRows}</div>`, true);
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
  return `<div class="check is-circle ${s.done?'done':''}" data-id="${esc(s.id)}">
    <div class="box" onclick="toggleShowTimelineStep('${eid}','${s.id}')">${ICON.check(15)}</div>
    <div class="lbl" ${labelClick} style="flex:1;min-width:0">
      <b>${esc(s.time||'—')}</b> ${esc(s.title||'Step')}
      ${s.sub?`<span style="display:block;font-size:12px;color:var(--text-3);font-weight:600;margin-top:2px">${esc(s.sub)}</span>`:''}
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
function timelineIconName(kind, icon){
  const ic=String(icon||'').toLowerCase();
  if(kind==='flight' || ic==='planetop' || ic==='plane') return 'planeTop';
  if(kind==='hotel' || ic==='bed') return 'bed';
  if(ic==='train' || ic==='rail') return 'train';
  if(ic==='ferry' || ic==='boat') return 'ferry';
  if(ic==='walk') return 'walk';
  if(kind==='transport' || ic==='car') return 'car';
  if(kind==='arrival' || ic==='pin') return 'pin';
  if(kind==='set' || ic==='music') return 'music';
  if(kind==='advance' || ic==='clock') return 'clock';
  return icon || 'clock';
}
function timelinePreviewTier(s){
  if(s.kind==='set') return 'performance';
  if(s.kind==='arrival' || s.kind==='advance') return 'milestone';
  const t=String(s.title||'').toLowerCase();
  if(s.kind==='custom' && /sound\s*check|meet\s*(&|and)?\s*greet|deadline|curfew|load[\s-]?in|doors|press|interview|performance|\bshow\b/.test(t)) return 'milestone';
  return 'logistics';
}
function timelinePreviewTime(s){
  if(s.time) return s.time;
  const sub=String(s.sub||'').trim();
  if(s.kind==='advance' && /^\d{1,2}:\d{2}\b/.test(sub)) return sub.slice(0,5);
  return '';
}
function timelinePreviewSecondary(s){
  const sub=String(s.sub||'').trim();
  if(s.kind==='set') return { text:s.endTime?('until '+s.endTime):'', hasNote:false };
  if(!sub) return { text:'', hasNote:false };
  if(s.kind==='transport'){
    if(sub==='No grounds' || /^Arrange at time/.test(sub)) return { text: sub==='No grounds' ? 'Uber / taxi' : sub, hasNote:false };
    const parts=sub.split(' · ');
    const operator=(parts[0]||'').trim();
    const rest=parts.slice(1).join(' · ').trim();
    const opOk=operator.length>0 && operator.length<=42;
    return { text:opOk?operator:'', hasNote:!!rest || (!!operator && !opOk) };
  }
  if(s.kind==='flight') return sub.length<=48 ? { text:sub, hasNote:false } : { text:'', hasNote:true };
  if(s.kind==='advance'){
    const t=timelinePreviewTime(s);
    if(t && (sub===t || sub.startsWith(t))) return { text:'', hasNote:false };
  }
  if(sub.length>48 || sub.includes('\n')) return { text:'', hasNote:true };
  return { text:sub, hasNote:false };
}
function compactShowTimelineIds(tl){
  const n=tl.length;
  if(n<=8) return { ids:tl.map(s=>s.id), hidden:0 };
  const keep=new Set();
  const setIdx=tl.findIndex(s=>s.kind==='set');
  tl.forEach((s,i)=>{
    if(timelinePreviewTier(s)!=='logistics' || s.kind==='flight' || s.kind==='hotel') keep.add(i);
  });
  const focus=setIdx>=0?setIdx:tl.findIndex(s=>timelinePreviewTier(s)==='milestone');
  if(focus>=0){
    for(let i=Math.max(0,focus-2);i<=Math.min(n-1,focus+2);i++) keep.add(i);
  }
  if(keep.size>9){
    const extras=[...keep].filter(i=>{
      const s=tl[i];
      return timelinePreviewTier(s)==='logistics' && s.kind!=='flight' && s.kind!=='hotel';
    }).sort((a,b)=>{
      const origin=focus>=0?focus:0;
      return Math.abs(b-origin)-Math.abs(a-origin);
    });
    for(const i of extras){
      if(keep.size<=9) break;
      keep.delete(i);
    }
  }
  const ids=[...keep].sort((a,b)=>a-b).map(i=>tl[i].id);
  return { ids, hidden:n-ids.length };
}
function showTimelineOverviewCopy(tl){
  if(!tl.length) return 'Builds from flights, hotel, transport and set time';
  return tl.length+' timeline item'+(tl.length===1?'':'s')+' · Travel, stay and show details update automatically';
}
function dayOverviewStepRow(e, s){
  const eid = e.id;
  const openAuto = s.auto ? timelineAutoOpen(eid, s) : '';
  const labelClick = s.auto && openAuto
    ? `onclick="${openAuto}"`
    : (!s.auto ? `onclick="sheetShowTimelineStep('${eid}','${s.id}')"` : '');
  const icName = timelineIconName(s.kind, s.icon);
  const icFn = ICON[icName] || ICON.clock;
  const hasRoute = (s.kind==='flight' || s.kind==='transport') && (s.from||s.to);
  const tier = timelinePreviewTier(s);
  const bits = timelinePreviewSecondary(s);
  const time = timelinePreviewTime(s);
  let titleHtml = `<b>${esc(s.title||'Step')}</b>`;
  if(s.kind==='flight' && (s.from||s.to) && typeof flightRouteHtml==='function'){
    titleHtml = `<div class="tl-route">${flightRouteHtml(s.from, s.to)}</div>`;
  } else if(s.kind==='transport' && (s.from||s.to) && typeof groundRouteHtml==='function'){
    titleHtml = `<div class="tl-route">${groundRouteHtml(s.from, s.to, s.icon || 'car')}</div>`;
  }
  const note = bits.hasNote ? `<span class="tl-note">${ICON.note(11)} Note</span>` : '';
  const sub = bits.text ? `<span class="tl-sub">${esc(bits.text)}</span>` : '';
  const typeIc = hasRoute ? '' : `<div class="tl-type-ic">${icFn(tier==='performance'?16:13)}</div>`;
  return `<div class="tl-item is-${tier} ${s.done?'done':''}" data-id="${esc(s.id)}">
    <div class="tl-time">${esc(time)}</div>
    <div class="tl-rail"><button type="button" class="tl-node" aria-label="${s.done?'Mark not done':'Mark done'}" onclick="event.stopPropagation();toggleShowTimelineStep('${eid}','${s.id}')"></button></div>
    <div class="tl-content is-${tier}${hasRoute?' has-route':''}" ${labelClick}>
      ${typeIc}
      <div class="tl-body">${titleHtml}${sub}${note}</div>
    </div>
  </div>`;
}
function dayOverviewBlock(e){
  const tl = typeof showDayTimeline==='function' ? showDayTimeline(e) : (e.timeline||[]);
  const editBtn = `<button type="button" class="show-day-overview-edit" onclick="sheetShowTimeline('${e.id}')">${tl.length?'Edit':'Add'}</button>`;
  const fullBtn = tl.length ? `<button type="button" class="show-day-overview-link" onclick="sheetShowTimeline('${e.id}')">View full timeline</button>` : '';
  const grouped = typeof groupShowTimelineByDay==='function' ? groupShowTimelineByDay(e, tl) : { multi:false, groups:[{ steps:tl }] };
  const compact = compactShowTimelineIds(tl);
  const keep = new Set(compact.ids);
  const body = tl.length
    ? `<div class="timeline show-day-timeline tl-preview">${(grouped.groups||[]).map(g=>{
        const steps=(g.steps||[]).filter(s=>keep.has(s.id));
        if(!steps.length) return '';
        const head = grouped.multi && g.label ? `<div class="tl-day-row${g.today?' today':''}"><div class="tl-time"></div><div class="tl-rail"></div><div class="tl-day-head">${esc(g.label)}</div></div>` : '';
        return head+steps.map(s=>dayOverviewStepRow(e,s)).join('');
      }).join('')}${compact.hidden?`<div class="tl-more-row"><div class="tl-time"></div><div class="tl-rail"></div><button type="button" class="tl-more" onclick="sheetShowTimeline('${e.id}')">+${compact.hidden} more itinerary item${compact.hidden===1?'':'s'}</button></div>`:''}</div>`
    : `<div class="card tap" onclick="sheetShowTimeline('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.clock(20)} Add show details — this overview fills in automatically</div>`;
  return `<section class="show-day-overview">
    <div class="show-day-overview-head">
      <div><div class="block-title">Show timeline</div><div class="show-day-overview-sub">${esc(showTimelineOverviewCopy(tl))}</div></div>
      <div class="show-day-overview-actions">${fullBtn}${editBtn}</div>
    </div>
    ${body}
  </section>`;
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
  const has = typeof noteItemsHas==='function' ? noteItemsHas(e.notes) : !!(e.notes && String(e.notes).trim());
  const items = (typeof parseNoteItems==='function' ? parseNoteItems(e.notes) : []);
  const rows = (items.length?items:[{id:'draft',text:''}]).map(n=>`
    <div class="note-item" data-note-id="${esc(n.id)}">
      <textarea class="textarea note-item-text" placeholder="Anything to remember about this show…" onblur="saveEventNotes('${e.id}', collectNoteItems('show-notes-${e.id}'))">${esc(n.text||'')}</textarea>
      <button type="button" class="note-item-del" onclick="removeNoteItemRow(this);saveEventNotes('${e.id}', collectNoteItems('show-notes-${e.id}'))" aria-label="Remove note">${ICON.x(16)}</button>
    </div>`).join('');
  const body = `<div class="note-items" data-note-list="show-notes-${e.id}">${rows}
    <button type="button" class="btn secondary note-items-add" onclick="addNoteItemRow(this,'Anything to remember about this show…')">${ICON.plus(15)} Add note</button>
  </div>`;
  return showSubsection('ss-'+e.id+'-notes', 'Internal notes', `<button type="button" class="add" onclick="addNoteItemRow(document.querySelector('[data-note-list=\\'show-notes-${e.id}\\'] .note-items-add'),'Anything to remember about this show…')">Add</button>`, body, has);
}
function prepGroupBody(e){
  return contentSubsection(e)+checklistSubsection(e)+attachmentsSubsection(e)+notesSubsection(e);
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
  const titleColor = e.textColor && CATS[e.textColor] ? CATS[e.textColor] : '';
  const trip = e.tripId? sel.trip(e.tripId):null;
  return `
  <div class="detail-top">
    <div class="detail-bar">
      <button class="back-btn" onclick="back()">${ICON.chevL(20)} ${trip?esc(trip.name):overlayBackLabel()}</button>
      <div style="display:flex;gap:8px">
        <button class="header-btn" style="width:36px;height:36px" onclick="shareDaySheet('${e.id}')">${ICON.share(17)}</button>
        <button class="header-btn" style="width:36px;height:36px" onclick="eventMenu('${e.id}')">${ICON.edit(18)}</button>
      </div>
    </div>
    ${typeof itineraryFullUploadBanner === 'function' ? itineraryFullUploadBanner(e.id) : ''}
  </div>
  <div class="screen-pad stagger show-detail${titleColor?' show-title-toned':''}" style="--show-color:${c}${titleColor?`;--show-title:${titleColor}`:''}">
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

    ${dayOverviewBlock(e)}

    <div class="show-groups">
      ${showGroup('sg-'+e.id+'-travel', 'Travel & stay', ICON.plane(20), travelGroupSummary(e), travelGroupBody(e))}
      ${showGroup('sg-'+e.id+'-venue', 'Venue & show day', ICON.pin(20), venueGroupSummary(e), venueGroupBody(e), true, 'show-venue-panel')}
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
  const show = (typeof sel!=='undefined' && sel.event) ? sel.event(eid) : null;
  const fallbackDate = (show && show.date) || '';
  const parsed = typeof flightParseDep==='function' ? flightParseDep(f.dep, fallbackDate) : {time:(f.dep||'').split(' ').pop()};
  const dateLabel = typeof flightDepDateLabel==='function' ? flightDepDateLabel(f, fallbackDate) : '';
  const depTime = parsed.time || (f.dep ? (String(f.dep).split(' ')[1] || (String(f.dep).includes(':')&&!String(f.dep).includes('-')?f.dep:'')) : '');
  const arrTime = f.arr ? (String(f.arr).split(' ')[1] || (String(f.arr).includes(':')&&!String(f.arr).includes('-')?f.arr:'')) : '';
  const routeHtml = travelRouteFromPlaces(
    f.fromCode || f.from,
    f.toCode || f.to,
    'plane',
    f.fromName,
    f.toName
  ) || (typeof flightRouteHtml === 'function'
    ? flightRouteHtml(f.fromCode || f.from || '?', f.toCode || f.to || '?')
    : esc(`${f.from||'?'} → ${f.to||'?'}`));
  const pax = (typeof flightPassengers==='function' ? flightPassengers(f) : (f.passengers||[]));
  const kvRow = (k, v) => v
    ? `<div class="flight-side-kv"><div class="flight-side-k">${esc(k)}</div><div class="flight-side-v">${esc(v)}</div></div>`
    : '';
  const notes = typeof parseNoteItems==='function' ? parseNoteItems(f.notes) : (String(f.notes || '').trim() ? [{id:'legacy',text:String(f.notes)}] : []);
  const metaHtml = [
    kvRow('Dep', depTime),
    kvRow('Arr', arrTime),
    kvRow('Operator', f.operator || ''),
    kvRow('Duration', f.duration || ''),
    kvRow('Booking', f.bookingRef || ''),
    kvRow('Status', f.fstatus || ''),
  ].filter(Boolean).join('');
  const paxCount = pax.length;
  const compactRows = paxCount
    ? pax.map(p=>flightPaxLine(eid,f,p)).join('')
    : `<div class="flight-pax-empty">Tap to add passengers</div>`;
  return `<div class="flight-block">
    <div class="flight-card-tools">
      <button type="button" class="flight-card-tool" title="Edit flight" onclick="event.stopPropagation();sheetFlight('${eid}','${f.id}')">${ICON.edit(15)}</button>
      <button type="button" class="flight-card-tool is-danger" title="Remove flight" onclick="event.stopPropagation();confirmRemoveFlight('${eid}','${f.id}')">${ICON.trash(15)}</button>
    </div>
    <div class="flight-card-body">
      <div class="flight-journey-main">
        <div class="flight-card-title">
          <span class="flight-journey-ic">${ICON.plane(17)}</span>
          <div class="flight-journey-heading">
            <b class="flight-journey-code">${esc(f.code||'Flight')}</b>
            ${dateLabel?`<span class="flight-journey-date">${esc(dateLabel)}</span>`:''}
          </div>
        </div>
        <div class="flight-card-route">${routeHtml}</div>
      </div>
      <button type="button" class="flight-pax-wrap" onclick="sheetFlightPassengers('${eid}','${f.id}')">
        <div class="flight-pax-head">Passengers</div>
        <div class="flight-pax-preview">${compactRows}</div>
      </button>
      ${metaHtml ? `<div class="flight-journey-side">${metaHtml}</div>` : ''}
      ${notes.length ? `<div class="flight-card-notes"><div class="flight-side-notes-k">Notes</div>${notes.map(n=>`<div class="flight-side-notes-v">${esc(n.text)}</div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}
function flightPaxLine(eid,f,pax){
  const title = esc(pax.name||'Passenger');
  const seat = pax.seat ? esc(pax.seat) : '—';
  const ref = (typeof passengerBookingRef==='function' ? passengerBookingRef(pax) : (pax.booking_reference||pax.bookingRef||''));
  const passes = pax.passes||[];
  const passLabel = passes.length ? (passes.length===1 ? 'Pass' : passes.length+' passes') : '—';
  return `<div class="flight-pax-row is-compact">
    <div class="flight-pax-name">${title}${ref?`<div class="flight-pax-ref">${esc(ref)}</div>`:''}</div>
    <div class="flight-pax-seat">${seat}</div>
    <div class="flight-pax-pass-k">${passLabel}</div>
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
    <div class="field"><label>Internal notes</label><textarea id="ev-notes" class="textarea" placeholder="Team-only notes">${esc(typeof noteItemsPlain==='function'?noteItemsPlain(e.notes):(e.notes||''))}</textarea></div>
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
  const groupId = el.parentElement && el.parentElement.id;
  if(groupId === 'ev-cat' && el.dataset.cat) applyEventSheetColor(el.dataset.cat);
  if(groupId === 'ev-text-cat') applyEventSheetTextColor(el.dataset.cat || '');
}
function segPick(el){ el.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on')); el.classList.add('on'); haptic(); }
function getSeg(id){ const el=document.querySelector('#'+id+' button.on'); return el?el.dataset.v:''; }
function getCat(id){ const el=document.querySelector('#'+id+' .sw.on'); return el?el.dataset.cat:'purple'; }
function getTextCat(id){
  const el = document.querySelector('#'+id+' .sw.on');
  if(!el) return null;
  const cat = el.dataset.cat;
  return cat ? cat : null;
}
function applyEventSheetTextColor(cat){
  const title = document.getElementById('ev-preview-venue');
  if(!title) return;
  if(cat && CATS[cat]) title.style.color = CATS[cat];
  else title.style.color = '';
}

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
    textColor: getTextCat('ev-text-cat'),
  };
  if(eid){
    Object.assign(data, {
      endTime: rawVal('ev-end'),
      notes: typeof collectNoteItems==='function' ? collectNoteItems('ev-notes') : val('ev-notes'),
      artist: val('ev-artist') || store.settings.artistName,
    });
  }
  if(typeof resolveSetEndDate === 'function' || typeof resolveSetStartDate === 'function'){
    data.endsNextDay = typeof timesCrossMidnight === 'function' && timesCrossMidnight(data.setTime, data.endTime);
    const payload = { date: data.date, setTime: data.setTime, endTime: data.endTime, endsNextDay: data.endsNextDay };
    if(typeof resolveSetStartDate === 'function') data.setStartDate = resolveSetStartDate(payload);
    if(typeof resolveSetEndDate === 'function') data.setEndDate = resolveSetEndDate(payload);
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
  openSheetReact('Accommodation', 'show.hotel', { eid });
}
function saveHotel(eid){
  const e=sel.event(eid);
  withButton($('#ho-save'), ()=>{
    const prev = e.hotel || {};
    const conf = val('ho-conf');
    e.noAccommodation = false;
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
      notes: typeof collectNoteItems==='function' ? collectNoteItems('ho-notes') : val('ho-notes')
    };
    persist('shows', eid);
    if(typeof pushShowNow === 'function') pushShowNow(eid);
    closeSheet();
    renderView();
  }, 'Accommodation saved');
}
function sheetAddTravel(eid){
  const e=sel.event(eid); if(!e) return;
  openSheetReact('Add travel', 'show.addTravel', { eid });
}
window.sheetAddTravel = sheetAddTravel;
function addTravelMode(eid, mode){
  if(mode === 'flight'){ sheetFlight(eid, '__new__'); return; }
  if(mode === 'ground'){ sheetDriver(eid); return; }
  sheetTravelLeg(eid, mode);
}
window.addTravelMode = addTravelMode;
function travelLegIcon(mode){
  if(mode === 'coach') return 'bus';
  return mode || 'train';
}
function sheetTravelLeg(eid, mode){
  const e=sel.event(eid); if(!e) return;
  const icon = travelLegIcon(mode);
  const titles = { train:'Add train', bus:'Add coach', ferry:'Add ferry', walk:'Add walk', cycle:'Add cycle' };
  openSheetReact(titles[icon] || 'Add travel', 'show.travelLeg', { eid, mode: icon });
}
window.sheetTravelLeg = sheetTravelLeg;
function saveTravelLeg(eid, mode){
  const e=sel.event(eid); if(!e) return;
  const icon = travelLegIcon(mode);
  const date = rawVal('tl-date') || e.date;
  const operator = val('tl-operator');
  const bookingRef = val('tl-ref');
  const notes = val('tl-notes');
  const rows = [...document.querySelectorAll('#tl-legs .tl-leg')];
  const legs = (rows.length ? rows : [document]).map(row => {
    const fromEl = row.querySelector ? row.querySelector('.tl-from') : document.getElementById('tl-from');
    const toEl = row.querySelector ? row.querySelector('.tl-to') : document.getElementById('tl-to');
    const from = ((fromEl && fromEl.value) || '').trim();
    const to = ((toEl && toEl.value) || '').trim();
    const startEl = row.querySelector ? row.querySelector('.tl-start') : document.getElementById('tl-start');
    const endEl = row.querySelector ? row.querySelector('.tl-end') : document.getElementById('tl-end');
    const codeEl = row.querySelector ? row.querySelector('.tl-code') : document.getElementById('tl-code');
    const platEl = row.querySelector ? row.querySelector('.tl-platform') : document.getElementById('tl-platform');
    return {
      from: /^[A-Za-z]{3}$/.test(from) ? from.toUpperCase() : from,
      to: /^[A-Za-z]{3}$/.test(to) ? to.toUpperCase() : to,
      start: ((startEl && startEl.value) || '').trim().slice(0, 5),
      end: ((endEl && endEl.value) || '').trim().slice(0, 5),
      code: ((codeEl && codeEl.value) || '').trim(),
      platform: ((platEl && platEl.value) || '').trim()
    };
  }).filter(leg => leg.from || leg.to || leg.start);
  if(!legs.length){ toast('Add a route or a time','x'); return; }
  const created = [];
  legs.forEach((leg, i) => {
    const it = {
      id: uid('evt'),
      kind: 'travel',
      date,
      showId: eid,
      icon,
      from: leg.from,
      to: leg.to,
      start: leg.start,
      end: leg.end,
      operator,
      bookingRef,
      platform: leg.platform,
      info: notes
    };
    if(icon === 'train') it.trainNo = leg.code;
    else if(icon === 'ferry') it.ferryNo = leg.code;
    else if(icon === 'bus') it.coachNo = leg.code;
    else if(leg.code) it.flightNo = leg.code;
    if(legs.length > 1){
      it.routeIndex = i;
      it.routeTotal = legs.length;
    }
    it.title = logisticTypeLabel(it);
    if(typeof normalizeLogisticItem === 'function') normalizeLogisticItem(it);
    store.events.push(it);
    created.push(it);
  });
  created.forEach(it => {
    persist('journeys', it.id);
    if(typeof pushLogisticsNow === 'function') pushLogisticsNow(it.kind, it.id);
  });
  closeSheet();
  renderView();
  const label = created.length > 1 ? (created.length + ' trains added') : ((created[0].title || 'Travel') + ' added');
  toast(label, 'check');
}
window.saveTravelLeg = saveTravelLeg;
function markNoAccommodation(eid){
  const e=sel.event(eid); if(!e) return;
  const apply=()=>{
    e.noAccommodation = true;
    e.hotel = null;
    persist('shows', eid);
    if(typeof pushShowNow==='function') pushShowNow(eid);
    closeSheet();
    softRender();
    toast('No accommodation for this show','check');
  };
  if(e.hotel && (e.hotel.name || e.hotel.address)){
    confirmSheet('No accommodation', 'This will remove the saved stay from this show.', 'No accommodation', apply);
    return;
  }
  apply();
}
window.markNoAccommodation = markNoAccommodation;
function sheetFlight(eid, fid){
  const e=sel.event(eid); if(!e) return;
  migrateShowFlightInfo(e);
  const flights = sortFlightsChrono(
    (e.flights||[]).filter(f => typeof flightHasDetails!=='function' || flightHasDetails(f)),
    e.date
  );
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
function sheetFlightPassengers(eid, fid){
  const e = sel.event(eid);
  const f = e && fid && (e.flights||[]).find(x=>x.id===fid);
  if(!f){ toast('Save the flight first','x'); return; }
  if(typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
  openSheetReact('Passengers', 'show.flightPassengers', { eid, fid: f.id, flight: f, passengers: flightPassengers(f) }, {
    full: true,
    action: `saveFlightPassengers('${eid}','${f.id}')`,
    actionLabel: 'Save'
  });
}
window.sheetFlightPassengers = sheetFlightPassengers;
function saveFlightPassengers(eid, fid){
  const e = sel.event(eid);
  const f = e && fid && (e.flights||[]).find(x=>x.id===fid);
  if(!f){ toast('Flight not found','x'); return; }
  if(typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
  const passengers = collectFlightPaxFromSheet(eid, fid, f.passengers);
  withButton($('#fl-pax-save') || $('#sheet-action'), ()=>{
    f.passengers = passengers;
    f.passes = [];
    persist('shows', eid);
    if(typeof pushShowNow === 'function') pushShowNow(eid);
    closeSheet();
    softRender();
  }, 'Passengers saved');
}
window.saveFlightPassengers = saveFlightPassengers;
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
    <div class="field" style="margin-top:8px"><label>Booking reference</label><input class="input fl-pax-ref" value="${esc(pax.booking_reference||pax.bookingRef||'')}" placeholder="ABC123"></div>
    ${upload}
    ${passThumbs}
    <button type="button" class="btn secondary" style="margin-top:8px" onclick="removeFlightPaxFromSheet(this,'${eid}','${fid||''}','${pid}')">${ICON.trash(14)} Remove person</button>
  </div>`;
}
function addFlightPaxRow(eid, fid){
  const list = document.getElementById('fl-pax-list');
  if(!list) return;
  const pax = { id: uid('pax'), name: '', seat: '', booking_reference: '', passes: [] };
  list.insertAdjacentHTML('beforeend', flightSheetPaxRow(pax, list.children.length, eid, fid||''));
  haptic();
}
/* Read name/seat typed in the open flight sheet for a passenger row that may
   not have been saved yet. */
function flightSheetPaxDraft(passengerId){
  if(!passengerId) return { name: '', seat: '', booking_reference: '' };
  const row = [...document.querySelectorAll('#fl-pax-list .fl-pax-row')]
    .find(r => r.getAttribute('data-pax-id') === passengerId);
  if(!row) return { name: '', seat: '', booking_reference: '' };
  return {
    name: (row.querySelector('.fl-pax-name')?.value || '').trim(),
    seat: (row.querySelector('.fl-pax-seat')?.value || '').trim(),
    booking_reference: (row.querySelector('.fl-pax-ref')?.value || '').trim()
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
    const prev = prevById[id];
    const name = (row.querySelector('.fl-pax-name')?.value || '').trim();
    const seat = (row.querySelector('.fl-pax-seat')?.value || '').trim();
    const booking_reference = (row.querySelector('.fl-pax-ref')?.value || '').trim() || (prev && (prev.booking_reference || prev.bookingRef)) || '';
    const passes = (prev && prev.passes) ? prev.passes.slice() : [];
    if(!name && !seat && !booking_reference && !passes.length) return;
    out.push({ id, name, seat, booking_reference, passes });
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
  const rawFrom = (val('fl-from') || '').trim();
  const rawTo = (val('fl-to') || '').trim();
  const place = /^[A-Za-z]{3}$/.test(rawFrom) ? rawFrom.toUpperCase() : rawFrom;
  const dest = /^[A-Za-z]{3}$/.test(rawTo) ? rawTo.toUpperCase() : rawTo;
  withButton($('#fl-save'), ()=>{
    const payload = {
      id: existing ? existing.id : uid('fl'),
      code,
      from: place,
      to: dest,
      fromName: place,
      toName: dest,
      fromCode: /^[A-Za-z]{3}$/.test(place) ? place.toUpperCase() : (existing && existing.fromCode) || '',
      toCode: /^[A-Za-z]{3}$/.test(dest) ? dest.toUpperCase() : (existing && existing.toCode) || '',
      operator: val('fl-operator'),
      dep,
      arr: existing ? (existing.arr||'') : '',
      terminal: val('fl-term'),
      gate: val('fl-gate'),
      fstatus: val('fl-status'),
      delay: val('fl-delay'),
      notes: typeof collectNoteItems==='function' ? collectNoteItems('fl-notes') : val('fl-notes'),
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
    if(typeof setFoldOpen === 'function'){
      setFoldOpen('sg-'+eid+'-travel', true);
      setFoldOpen('ss-'+eid+'-flights', true);
    }
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
function confirmRemoveTravelLeg(id){
  const e=(store.events||[]).find(x=>x.id===id);
  const label=(e && ((typeof logisticTypeLabel==='function' && logisticTypeLabel(e)) || e.title)) || 'this journey';
  confirmSheet(
    'Remove journey?',
    `Remove ${label} from this show.`,
    'Remove',
    ()=>{ if(typeof delItem==='function') delItem(id); },
    true
  );
}
window.confirmRemoveTravelLeg = confirmRemoveTravelLeg;
function confirmRemoveDriver(eid, idx){
  confirmSheet(
    'Remove ground?',
    'Remove this ground arrangement from the show.',
    'Remove',
    ()=>{ if(typeof removeDriver==='function') removeDriver(eid, idx); },
    true
  );
}
window.confirmRemoveDriver = confirmRemoveDriver;
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
    ensureDriverLocations(d);
    const title = esc(driverJourneyLabel(d) || (d.noGround?'Ground':(d.name||'Ground'))) + (d.time?' · '+esc(d.time):'');
    if(d.noGround){
      return `<div class="info-line"><div class="ic">${ICON.car(17)}</div>${fieldTx(title,esc(groundArrangeSummary(d)))}
        <button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openExternal('https://m.uber.com/','uber://')">${ICON.car(16)}</button></div>`;
    }
    const wa=d.whatsapp||d.phone||'';
    return `<div class="info-line"><div class="ic">${ICON.user(17)}</div>${fieldTx(title, esc(d.name||d.vehicle||'Pre-arranged')+(d.phone?' · '+esc(d.phone):''))}
      ${d.phone?`<button class="header-btn" style="width:34px;height:34px;align-self:center" title="Call" onclick="callNumber('${jsAttr(d.phone)}')">${ICON.phone(16)}</button>`:''}
      ${wa?`<button class="header-btn" style="width:34px;height:34px;align-self:center" title="WhatsApp" onclick="whatsapp('${jsAttr(wa)}')">${ICON.chat(16)}</button>`:''}
      ${d.phone?`<button class="header-btn" style="width:34px;height:34px;align-self:center" title="Copy" onclick="copyText('${jsAttr(d.phone)}')">${ICON.copy(16)}</button>`:''}</div>`;
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
  openSheetReact(editing?'Edit ground':'Add ground', 'show.transport', { eid, idx });
}
function inferPrearrangedGroundType(vehicle){
  if(typeof v2InferGroundTransportType !== 'function') return '';
  const inferred = v2InferGroundTransportType(vehicle);
  if(!inferred || inferred==='uber' || inferred==='taxi' || inferred==='other') return '';
  return inferred;
}
function groundPlaceFromForm(kind, side, e){
  const key = side === 'to' ? 'to' : 'from';
  const customName = (typeof val === 'function' ? val('dr-'+key+'-name') : '') || '';
  const customAddr = (typeof val === 'function' ? val('dr-'+key+'-addr') : '') || '';
  const k = String(kind || '').toLowerCase();
  if(k === 'hotel'){
    const h = e && e.hotel;
    const addr = (typeof formatHotelAddress === 'function' && h) ? formatHotelAddress(h) : ((h && h.address) || '');
    return { kind:'hotel', compact:'Hotel', name:(h && h.name) || 'Hotel', address: addr || '' };
  }
  if(k === 'venue'){
    const addr = (typeof formatVenueAddress === 'function')
      ? formatVenueAddress(e)
      : [e && e.venueAddr, e && e.venueAddr2, e && e.city, e && e.venuePostcode].filter(Boolean).join(', ');
    return { kind:'venue', compact:'Venue', name:(e && e.venue) || 'Venue', address: addr || '' };
  }
  if(k === 'airport'){
    const code = (typeof transferAirportCode === 'function')
      ? transferAirportCode(e, key === 'from', e && e.date)
      : null;
    return { kind:'airport', compact: code || 'Airport', name: code || 'Airport', address:'' };
  }
  return { kind:'custom', compact: customName, name: customName, address: customAddr };
}
function saveDriver(eid, idx){
  const e=sel.event(eid);
  const arrangeAtTime = getSeg('dr-mode')==='time';
  const list=showDrivers(e);
  const prev = (idx!=null && list[idx]) ? list[idx] : {};
  withButton($('#dr-save'), ()=>{
    const fromPlace = groundPlaceFromForm(val('dr-from'), 'from', e);
    const toPlace = groundPlaceFromForm(val('dr-to'), 'to', e);
    const from = fromPlace.compact || fromPlace.name;
    const to = toPlace.compact || toPlace.name;
    const journey = driverJourneyLabel({ from, to });
    const time = val('dr-time');
    const notes = typeof collectNoteItems==='function' ? collectNoteItems('dr-notes') : val('dr-notes');
    const base = {
      id: prev.id || uid('drv'),
      from, to, journey,
      fromKind: fromPlace.kind,
      toKind: toPlace.kind,
      fromName: fromPlace.name,
      toName: toPlace.name,
      fromAddress: fromPlace.address,
      toAddress: toPlace.address,
      time,
      date: (typeof showItemTrueDate === 'function' ? showItemTrueDate(e, time) : e.date) || e.date,
      notes,
      pickup: prev.pickup || '',
      whatsapp: prev.whatsapp || ''
    };
    const pref = getSeg('dr-pref');
    const groundTypeSel = val('dr-ground-type');
    const drv = arrangeAtTime
      ? Object.assign(base, {
          noGround: true,
          arrangement: 'arrange_at_time',
          preferredMethod: (pref==='uber' || pref==='taxi' || pref==='either') ? pref : 'either',
          groundType: (pref==='uber' || pref==='taxi') ? pref : '',
          name: '',
          operator: '',
          phone: '',
          vehicle: '',
          whatsapp: ''
        })
      : Object.assign(base, {
          noGround: false,
          arrangement: 'pre_arranged',
          preferredMethod: '',
          name: val('dr-name'),
          operator: val('dr-company'),
          phone: val('dr-phone'),
          whatsapp: prev.whatsapp || '',
          vehicle: val('dr-vehicle'),
          groundType: groundTypeSel || inferPrearrangedGroundType(val('dr-vehicle'))
        });
    ensureDriverLocations(drv);
    if(idx!=null && list[idx]) list[idx]=drv; else list.push(drv);
    e.driver = list.find(x=>!x.noGround) || null;
    persist('shows', eid); closeSheet(); softRender();
  }, idx!=null?'Saved':'Added');
}
function applyDriverJourneyPreset(preset){
  const p = parseDriverJourney(preset);
  const fromEl = document.getElementById('dr-from');
  const toEl = document.getElementById('dr-to');
  if(fromEl) fromEl.value = p.from || '';
  if(toEl) toEl.value = p.to || '';
  if(typeof haptic === 'function') haptic();
}
window.applyDriverJourneyPreset = applyDriverJourneyPreset;
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
function advRow(icon,k,v,extra){
  if(!v) return '';
  const compact = k==='Stage / area'||k==='Sound check'||k==='Curfew'||k==='Parking'||k==='WiFi';
  return `<div class="info-line show-venue-row ${compact?'is-compact':'is-block'}"><div class="ic">${icon}</div>${fieldTx(k, `<span style="white-space:pre-wrap">${esc(v)}</span>`)}${extra||''}</div>`;
}
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
function showKeyContactEntries(e){
  const rows=[];
  if(e && e.promoter){
    const p=e.promoter;
    rows.push({
      kind:'liaison', id:'liaison',
      role:'Artist Liaison',
      name:p.name||'Liaison',
      phone:p.phone||''
    });
  }
  (e && e.contacts || []).forEach(ct=>{
    rows.push({
      kind:'contact', id:ct.id,
      role:(typeof showContactRoleLabel==='function' ? showContactRoleLabel(ct.role) : ct.role) || 'Contact',
      name:ct.name||'Contact',
      phone:ct.phone||''
    });
  });
  return rows;
}
function sheetKeyContacts(eid){
  const e=sel.event(eid); if(!e) return;
  openSheetReact('Key contacts', 'show.contactsList', { eid, contacts: showKeyContactEntries(e) }, { full: true });
}
function openKeyContactFromList(eid, kind, id){
  sheetReturnStack.push({ kind:'showContacts', id:eid });
  if(kind==='liaison') sheetPromoter(eid);
  else if(kind==='new') sheetEventContact(eid, '__new__');
  else sheetEventContact(eid, id);
}
function removeKeyContactFromList(eid, kind, id){
  const e=sel.event(eid); if(!e) return;
  if(kind==='liaison') e.promoter=null;
  else e.contacts=(e.contacts||[]).filter(x=>x.id!==id);
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  toast('Contact removed','trash');
  sheetKeyContacts(eid);
}
function sheetEventContact(eid,cid){
  const e=sel.event(eid); if(!e) return;
  const forceNew = cid === '__new__';
  if(!cid && !forceNew){
    if(e.promoter || (e.contacts||[]).length){
      sheetKeyContacts(eid);
      return;
    }
  }
  const c=(!forceNew && cid) ? ((e.contacts||[]).find(x=>x.id===cid)||{}) : {};
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
  openSheetReact((!forceNew && cid)?'Edit contact':'Add contact', 'show.contact', { eid, cid: (!forceNew && cid) ? cid : '' });
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
    const stepDate = (typeof showItemTrueDate === 'function' ? showItemTrueDate(e, time) : e.date) || e.date;
    if(sid){
      const s = e.timeline.find(x=>x.id===sid);
      if(s){ s.time=time||''; s.date=stepDate; s.title=title; s.sub=val('est-sub'); }
    } else {
      e.timeline.push({ id: uid('tl'), time: time||'', date: stepDate, title, sub: val('est-sub'), done: false });
    }
    e.timeline.sort((a,b)=>{
      if(typeof showTimelineSortKey === 'function') return showTimelineSortKey(e,a)-showTimelineSortKey(e,b);
      return (a.time||'').localeCompare(b.time||'');
    });
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
    const ov = document.querySelector('.show-day-overview-sub');
    if(ov && typeof showDayTimeline==='function'){
      const tl = showDayTimeline(e);
      ov.textContent = typeof showTimelineOverviewCopy==='function'
        ? showTimelineOverviewCopy(tl)
        : (tl.length
          ? (tl.length+' timeline item'+(tl.length===1?'':'s')+' · Travel, stay and show details update automatically')
          : 'Builds from flights, hotel, transport and set time');
    }
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
    if(typeof noteItemsHas==='function' ? noteItemsHas(e.hotel.notes) : e.hotel.notes){
      const hotelNotes = typeof parseNoteItems==='function' ? parseNoteItems(e.hotel.notes) : [{text:e.hotel.notes}];
      hotelNotes.forEach(n => L.push(`  Notes: ${n.text}`));
    }
    if(e.hotel.checkin) L.push(`  ${fmtDate(e.hotel.checkin)} → ${e.hotel.checkout?fmtDate(e.hotel.checkout):''}`);
  }
  const contacts=[];
  orderedDrivers(e).forEach(({d})=>{
    ensureDriverLocations(d);
    const jLabel = driverJourneyLabel(d);
    const tag = `${jLabel?' ('+jLabel+')':''}${d.time?' '+d.time:''}`;
    if(d.noGround) contacts.push(`  Transport${tag} — ${groundArrangeSummary(d)}`);
    else if(d.name||d.phone||d.vehicle) contacts.push(`  Driver${tag} — ${[d.name, d.phone, d.vehicle].filter(Boolean).join(' ')}`);
  });
  if(e.promoter) contacts.push(`  Artist Liaison — ${e.promoter.name||''} ${e.promoter.phone||e.promoter.whatsapp||''}`);
  if(contacts.length){ L.push(''); L.push('📞 CONTACTS'); contacts.forEach(x=>L.push(x)); }
  if(e.content){ L.push(''); L.push('🎬 CONTENT'); L.push(`  ${e.content}`); }
  if(c.gross){ L.push(''); L.push('💷 DEAL'); L.push(`  ${e.finance.dealType}: ${fmtMoney(c.gross,c.cur)} (${c.paid?'paid':'unpaid'})`); L.push(`  Net take-home: ${fmtMoney(c.net,c.cur)}`); }
  if(typeof noteItemsHas==='function' ? noteItemsHas(e.notes) : e.notes){
    L.push(''); L.push('📝 NOTES');
    const noteLines = typeof parseNoteItems==='function' ? parseNoteItems(e.notes) : [{text:e.notes}];
    noteLines.forEach(n => String(n.text||'').split('\n').forEach(line => L.push(`  ${line}`)));
  }
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

