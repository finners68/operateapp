/* ---------- Client error log (lightweight observability) ----------
   Captures uncaught errors/rejections into a capped local ring buffer so
   field failures are diagnosable; view with `operateErrors()` in the console.
   Swap the sink for Sentry/a Supabase table when ready. */
const ERRLOG_KEY = 'operate_errlog';
function logClientError(kind, message, where){
  try{
    const log = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]');
    log.push({ t: new Date().toISOString(), kind, message: String(message||'').slice(0,500), where: String(where||'').slice(0,200), tab: (typeof store!=='undefined'&&store)?store.tab:null });
    while(log.length > 50) log.shift();
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(log));
  }catch(e){}
}
function operateErrors(){ try{ return JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); }catch(e){ return []; } }
if(typeof window !== 'undefined'){
  window.addEventListener('error', (e)=> logClientError('error', e.message, (e.filename||'')+':'+(e.lineno||'')));
  window.addEventListener('unhandledrejection', (e)=> logClientError('promise', (e.reason && e.reason.message) || e.reason));
}
/* ---------- Boot ---------- */
function boot(){
  if(typeof clearLegacyLocalStore === 'function') clearLegacyLocalStore();
  const saved = db.read();
  if(saved && saved.v2 && Array.isArray(saved.events)){ store = saved; if(store.tab==null) store.tab='home'; migrate(); }
  else { seed(); }
  restoreNavState();
  if(store.tab==='notes'){ store.tab='ideas'; if(typeof contentMode!=='undefined') contentMode='notes'; }
  render();
  if(typeof rehydrateBlobs==='function'){ rehydrateBlobs(store).then(()=>renderView()).catch(()=>{}); }
  if(appLockActive()) requireUnlock('app', ()=>render());
  initGestures();
  initKeyboard();
  initSidebar();
  // Refresh the home countdown only while it's actually on screen — never when
  // on another tab, in an overlay/sheet, or when the app is backgrounded.
  const canTick = () => store.tab==='home' && !overlay && !sheetEl && !document.hidden;
  setInterval(()=>{ if(canTick()) tickCountdowns(); }, 30000);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) saveNavState(); else { if(canTick()) tickCountdowns(); if(typeof checkDueReminders==='function') checkDueReminders(); } });
  window.addEventListener('pagehide', saveNavState);
  if(typeof checkDueReminders==='function'){ checkDueReminders(); setInterval(checkDueReminders, 60000); }
}

const INTRO_KEY = 'operate_intro:';
function introDismissed(id){ try{ return localStorage.getItem(INTRO_KEY + id) === '1'; }catch(e){ return false; } }
function dismissIntro(id){ try{ localStorage.setItem(INTRO_KEY + id, '1'); }catch(e){} haptic(); renderView(); }
function pageIntro(id, title, body){
  if(introDismissed(id)) return '';
  return `<div class="page-intro">
    <b>${esc(title)}</b>
    <span>${body}</span>
    <button type="button" class="page-intro-dismiss" onclick="dismissIntro('${id}')">Got it</button>
  </div>`;
}
function tabBlurb(text){ return `<div class="tab-blurb">${text}</div>`; }
function sectionDesc(text){ return `<div class="section-desc">${text}</div>`; }

function tickCountdowns(){
  document.querySelectorAll('[data-countdown-ms]').forEach(el=>{
    const ms = +el.dataset.countdownMs;
    if(!ms) return;
    const c = countdown(ms);
    const txt = el.querySelector('.cd-txt') || el;
    const unit = el.querySelector('.cd-unit');
    if(c.done){
      txt.textContent = el.dataset.countdownOff || '—';
      if(unit) unit.textContent = '';
    } else {
      txt.textContent = c.txt;
      if(unit) unit.textContent = c.unit;
    }
  });
}
/* ============================================================
   Gestures — swipe to change calendar months, edge-swipe to go back.
   Acts on release; never hijacks vertical scroll or inner horizontal scrollers.
   ============================================================ */
function withinHorizontalScroller(el){
  const screen = document.getElementById('screen');
  while(el && el !== screen){
    if(el.scrollWidth - el.clientWidth > 8){
      const ov = getComputedStyle(el).overflowX;
      if(ov==='auto' || ov==='scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}
function initGestures(){
  const screen = document.getElementById('screen');
  if(!screen) return;
  let sx=0, sy=0, st=0, tracking=false, startedEdge=false, decided=false, horiz=false, startTarget=null;
  screen.addEventListener('touchstart', (e)=>{
    if(e.touches.length!==1){ tracking=false; return; }
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st=Date.now();
    startTarget=e.target; startedEdge = sx <= 30;
    tracking=true; decided=false; horiz=false;
  }, {passive:true});
  screen.addEventListener('touchmove', (e)=>{
    if(!tracking) return;
    const t=e.touches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
    if(!decided){
      if(Math.abs(dx)<12 && Math.abs(dy)<12) return;
      horiz = Math.abs(dx) > Math.abs(dy)*1.4;
      if(horiz && withinHorizontalScroller(startTarget)) horiz=false;
      decided=true;
    }
  }, {passive:true});
  screen.addEventListener('touchend', (e)=>{
    if(!tracking){ return; }
    tracking=false;
    if(!decided || !horiz) return;
    const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; const dt=Date.now()-st;
    if(Math.abs(dx) < 45 || Math.abs(dy) > 70) return;
    if(dt > 700) return; // too slow to be a flick
    // 1) Edge-swipe right → go back out of a detail view
    if(overlay && startedEdge && dx > 55){ back(); haptic(); return; }
    // 2) Calendar month swipe (only on the calendar tab, no overlay)
    if(!overlay && store.tab==='calendar'){
      calMoveAnimated(dx < 0 ? 1 : -1);
      return;
    }
  }, {passive:true});
}
function calMoveAnimated(dir){
  if(!calCursor){
    const n=new Date();
    calCursor={y:n.getFullYear(),m:n.getMonth()};
  }
  /* React calendar applies the slide after it re-renders for the new month. */
  if(typeof window.__calMarkSlide === 'function') window.__calMarkSlide(dir);
  calMove(dir); haptic();
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.isCalendarMounted === 'function' && OperateReact.isCalendarMounted()){
    return;
  }
  const grid = document.querySelector('.cal-grid') || document.querySelector('.cal-month');
  if(grid){ grid.style.animation='none'; void grid.offsetWidth; grid.style.animation = (dir>0?'calSlideR':'calSlideL')+' .26s cubic-bezier(.2,.8,.2,1)'; }
}
function initKeyboard(){
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;
    const tag = document.activeElement?.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if(document.getElementById('viewer')?.classList.contains('on')){ closeViewer(); return; }
    if(dtPickerEl){ closeDateTimePicker(); return; }
    if(sheetEl) closeSheet();
    else if(overlay) back();
  });
}

const SIDEBAR_KEY = 'operate_sidebar_hidden';
function isSidebarHidden(){
  try{ return localStorage.getItem(SIDEBAR_KEY) === '1'; }catch(e){ return false; }
}
function applySidebar(){
  const app = document.getElementById('app');
  if(app) app.classList.toggle('sidebar-hidden', isSidebarHidden());
  const rev = document.getElementById('sidebar-reveal');
  if(rev) rev.classList.toggle('on', isSidebarHidden());
}
function toggleSidebar(force){
  const next = typeof force === 'boolean' ? force : !isSidebarHidden();
  try{ localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); }catch(e){}
  applySidebar();
  haptic();
  if(overlay && overlay.type === 'settings') renderView();
}
function initSidebar(){
  const btn = document.getElementById('sidebar-reveal');
  if(btn && !btn.dataset.init){ btn.innerHTML = ICON.chevR(18); btn.dataset.init = '1'; }
  applySidebar();
}
/* ---------- Navigation ---------- */
const TABS = [
  {id:'home', label:'Home', icon:'home', hint:'Dashboard — your next show and shortcuts'},
  {id:'calendar', label:'Calendar', icon:'calendar', hint:'Month view — day-by-day schedule'},
  {id:'shows', label:'Shows', icon:'music', hint:'Shows & tours — browse and manage everything'},
  {id:'trips', label:'Tour Mode', icon:'planeTop', hint:'Tour Mode — your live tour dashboard'},
  {id:'ideas', label:'Ideas', icon:'idea', hint:'Ideas & notes — content and free-form text'},
];
window.TABS = TABS;
/* saveNavState / activeNavTab / setFab / syncScreenChrome exposed after declarations */
let overlay = null; // {type, id} for detail views on top of a tab
Object.defineProperty(window, 'overlay', {
  get(){ return overlay; },
  set(v){ overlay = v; },
  configurable: true
});
let navStack = []; // history of overlays for proper Back behaviour
const NAV_KEY = 'operate_nav';
/* Remember exactly where the user is (tab + open detail + history + scroll) so
   closing and reopening the app lands on the same screen, not back at a tab root. */
function saveNavState(){
  try{
    const screen=document.getElementById('screen');
    const hash = (typeof location !== 'undefined' && location.hash) ? location.hash.replace(/^#/, '') : '';
    localStorage.setItem(NAV_KEY, JSON.stringify({
      tab:store.tab,
      overlay,
      navStack,
      hash,
      scrollY:screen?screen.scrollTop:0,
      showsMode:(typeof showsMode!=='undefined'?showsMode:'shows'),
      contentMode:(typeof contentMode!=='undefined'?contentMode:'ideas')
    }));
  }catch(e){}
}
function loadNavState(){ try{ return JSON.parse(localStorage.getItem(NAV_KEY)||'null'); }catch(e){ return null; } }
/* Cloud reloads replace `store`. Re-apply the tab/modes the user navigated to
   (saved by go/openView/back) so a mid-fetch section change is not overwritten. */
function applySavedNavToStore(){
  const ns = loadNavState(); if(!ns || !store) return;
  if(ns.tab) store.tab = ns.tab;
  if(store.tab === 'notes'){ store.tab = 'ideas'; if(typeof contentMode !== 'undefined') contentMode = 'notes'; }
  if(ns.showsMode && typeof showsMode !== 'undefined') showsMode = ns.showsMode;
  if(ns.contentMode && typeof contentMode !== 'undefined') contentMode = ns.contentMode;
}
function restoreNavState(){
  const ns=loadNavState(); if(!ns) return;
  if(ns.tab) store.tab=ns.tab;
  if(store.tab==='notes'){ store.tab='ideas'; if(typeof contentMode!=='undefined') contentMode='notes'; }
  if(ns.showsMode && typeof showsMode!=='undefined') showsMode=ns.showsMode;
  if(ns.contentMode && typeof contentMode!=='undefined') contentMode=ns.contentMode;
  overlay = ns.overlay || null;
  navStack = Array.isArray(ns.navStack) ? ns.navStack : [];
  // Never auto-open a lock-protected screen on reopen
  if(overlay && overlay.type==='finance' && typeof financeLockActive==='function' && financeLockActive()){ overlay=null; }
  navStack = navStack.filter(o=>!(o&&o.type==='finance' && typeof financeLockActive==='function' && financeLockActive()));
  if(ns.scrollY){ requestAnimationFrame(()=>{ const s=document.getElementById('screen'); if(s) s.scrollTop=ns.scrollY; }); }
}
function go(tab){
  navStack=[];
  overlay=null;
  store.tab=tab;
  if(tab==='ideas') ideasStale=false;
  if(typeof OperateReact !== 'undefined' && OperateReact.nav && typeof OperateReact.nav.goTab === 'function'
      && OperateReact.isAppMounted && OperateReact.isAppMounted()){
    OperateReact.nav.goTab(tab);
    renderNav(); setFab(); syncScreenChrome();
    return;
  }
  haptic(); persist('user_preferences'); saveNavState(); render({ resetScroll: true, quiet: true });
}
function openView(type, id){
  if(type==='finance' && financeLockActive()){ requireUnlock('finance', ()=>openView('finance', id)); return; }
  if(typeof OperateReact !== 'undefined' && OperateReact.nav && typeof OperateReact.nav.navigateTo === 'function'
      && OperateReact.isAppMounted && OperateReact.isAppMounted()){
    OperateReact.nav.navigateTo(type, id);
    renderNav(); setFab(); syncScreenChrome();
    return;
  }
  if(overlay) navStack.push(overlay);   // remember where we came from
  overlay={type, id};
  if(type==='event' && id && typeof resetShowFolds==='function') resetShowFolds(id);
  haptic(); saveNavState(); renderView({ resetScroll: true, quiet: true });
}
function back(){
  if(typeof OperateReact !== 'undefined' && OperateReact.nav && typeof OperateReact.nav.goBack === 'function'
      && OperateReact.isAppMounted && OperateReact.isAppMounted()){
    OperateReact.nav.goBack();
    renderNav(); setFab(); syncScreenChrome();
    return;
  }
  overlay = navStack.length ? navStack.pop() : null;   // step back one screen, not all the way out
  saveNavState(); renderView({ resetScroll: true, quiet: true });
}

/* Which nav tab to highlight. Drilling into a detail keeps the section you
   were in highlighted; a detail that IS another section (a tour) highlights
   that section instead. */
function activeNavTab(){
  if(overlay){
    if(overlay.type==='trip') return 'trips';
    if(overlay.type==='event') return 'shows';
    if(overlay.type==='idea') return 'ideas';
    if(overlay.type==='note') return 'ideas';
    if(overlay.type==='noteFolder') return 'ideas';
  }
  return store.tab;
}
window.activeNavTab = activeNavTab;
window.saveNavState = saveNavState;
function renderNav(){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountApp === 'function' && !OperateReact.isAppMounted?.()){
    OperateReact.mountApp();
  } else if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountShell === 'function' && !OperateReact.isShellMounted?.()){
    OperateReact.mountShell();
  }
  /* React owns #nav once the bundle is present — never write HTML tabs alongside it. */
  if(typeof OperateReact !== 'undefined' && OperateReact && (typeof OperateReact.mountApp === 'function' || typeof OperateReact.mountShell === 'function')){
    if(typeof OperateReact.refreshShell === 'function') OperateReact.refreshShell();
    else if(typeof notifyStore === 'function') notifyStore();
    return;
  }
  const active = activeNavTab();
  $('#nav').innerHTML = `
    <div class="nav-brand">
      <span class="nav-brand-mark">O</span>
      <span class="nav-brand-name">Operate</span>
      <button type="button" class="nav-collapse header-btn" onclick="toggleSidebar(true)" title="Hide sidebar">${ICON.chevL(16)}</button>
    </div>
  ` + TABS.map(t=>`
    <button class="nav-item ${active===t.id?'active':''}" onclick="go('${t.id}')" title="${esc(t.hint)}">
      <span class="ic">${ICON[t.icon](25)}</span><span>${t.label}</span>
    </button>`).join('');
}

/* ---------- Master render ---------- */
function render(opts={}){ renderNav(); renderView(opts); }
function syncScreenChrome(){
  const screen = $('#screen');
  if(!screen) return;
  /* Any tab/detail sticky header that owns the top safe area: collapse the outer spacer. */
  const ownsTop = !!document.querySelector('#view .tab-page-sticky, #view .detail-top');
  screen.classList.toggle('flush-sticky-header', ownsTop);
}
/* Compare generated HTML to the live DOM without false mismatches from
   browser &amp; encoding, entrance-only classes, or ticking countdown text. */
function normalizeViewHtml(s){
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s*stagger\b/g, '')
    .replace(/\s*fade-in\b/g, '')
    .replace(/ class=""/g, '')
    .replace(/ class=''/g, '')
    .replace(/(class="cd-txt"[^>]*>)[^<]*/g, '$1')
    .replace(/(class="cd-unit"[^>]*>)[^<]*/g, '$1')
    .replace(/(class="dt"[^>]*>)[^<]*/g, '$1')
    .replace(/(class="fi-upd"[^>]*>)[^<]*/g, '$1')
    .replace(/(id="sync-row-sub"[^>]*>)[^<]*/g, '$1')
    .replace(/(id="sync-status"[^>]*>)[^<]*/g, '$1');
}
function viewHtmlLooksSame(live, next){
  if(live === next) return true;
  return normalizeViewHtml(live) === normalizeViewHtml(next);
}
function renderView(opts={}){
  const screen = $('#screen');
  const scrollY = opts.resetScroll ? 0 : (opts.scrollY != null ? opts.scrollY : (screen?.scrollTop || 0));
  const R = (typeof OperateReact !== 'undefined') ? OperateReact : null;

  /* Phase 2: React HashRouter owns #view. */
  if(R && typeof R.isAppMounted === 'function' && R.isAppMounted()){
    if(typeof R.refreshShell === 'function') R.refreshShell();
    else if(typeof notifyStore === 'function') notifyStore();
    renderNav(); setFab(); syncScreenChrome();
    if(screen){
      screen.scrollTop = scrollY;
      if(opts.quiet) requestAnimationFrame(()=>{ if(screen) screen.scrollTop = scrollY; });
    }
    return true;
  }

  /* React bundle present but mountApp not yet called (boot runs before index.html mounts). */
  if(R){
    renderNav(); setFab(); syncScreenChrome();
    if(screen) screen.scrollTop = scrollY;
    return true;
  }

  const v = $('#view');
  if(v){
    v.classList.add('quiet-paint');
    v.innerHTML = '<div class="empty" style="margin-top:40px"><b>App UI failed to load</b><span>Try a hard refresh.</span></div>';
  }
  renderNav(); setFab(); syncScreenChrome();
  if(screen) screen.scrollTop = scrollY;
  return false;
}
/* Soft refresh: rewrite the screen without fade/stagger flash. Prefer
   patchCheckRowsById for one-tap toggles when possible. */
function softRender(opts){
  return renderView(Object.assign({ quiet: true }, opts || {}));
}
function cssAttrEscape(v){
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function patchCheckRowsById(id, done){
  if(id == null || id === '') return 0;
  const rows = document.querySelectorAll('.check[data-id="'+cssAttrEscape(id)+'"]');
  rows.forEach(row => row.classList.toggle('done', !!done));
  return rows.length;
}
function removeCheckRowsById(id){
  if(id == null || id === '') return 0;
  const rows = [...document.querySelectorAll('.check[data-id="'+cssAttrEscape(id)+'"]')];
  rows.forEach(row => row.remove());
  return rows.length;
}
function patchShowChecklistHead(eid){
  const e = (typeof sel !== 'undefined' && sel.event) ? sel.event(eid) : null;
  if(!e) return;
  const cp = (typeof sel.eventChecklistProgress === 'function')
    ? sel.eventChecklistProgress(e)
    : { done:0, total:(e.checklist||[]).length };
  const fold = document.getElementById('fold-ss-'+eid+'-checklist');
  const span = fold && fold.querySelector('.show-subsection-head > span');
  if(span) span.textContent = cp.total ? ('Checklist · '+cp.done+'/'+cp.total) : 'Checklist';
  const prep = document.getElementById('fold-sg-'+eid+'-prep');
  const sub = prep && prep.querySelector('.show-group-titles span');
  if(sub && typeof prepGroupSummary === 'function') sub.textContent = prepGroupSummary(e);
}
function patchShowDealPaid(eid, paid){
  const e = (typeof sel !== 'undefined' && sel.event) ? sel.event(eid) : null;
  if(!e) return false;
  let hit = 0;
  document.querySelectorAll('.tag.confirmed, .tag.hold').forEach(tag => {
    const head = tag.closest('.deal-head');
    if(!head) return;
    tag.classList.toggle('confirmed', !!paid);
    tag.classList.toggle('hold', !paid);
    tag.textContent = paid ? 'Paid' : 'Unpaid';
    hit++;
  });
  const deal = document.getElementById('fold-sg-'+eid+'-deal');
  const sub = deal && deal.querySelector('.show-group-titles span');
  if(sub && typeof dealGroupSummary === 'function'){
    sub.textContent = dealGroupSummary(e);
    hit++;
  }
  return hit > 0;
}

function syncSeg(segId, activeKey){
  const seg = document.getElementById(segId);
  if(!seg) return;
  seg.querySelectorAll('button[data-v]').forEach(btn => btn.classList.toggle('on', btn.dataset.v === activeKey));
}
/* Persistent floating + button — anchored to the app frame so it never scrolls away.
   Its action follows the current tab; hidden where there's nothing to add. */
function setFab(){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountApp === 'function' && !OperateReact.isAppMounted?.()){
    OperateReact.mountApp();
  } else if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountShell === 'function' && !OperateReact.isShellMounted?.()){
    OperateReact.mountShell();
  }
  if(typeof OperateReact !== 'undefined' && OperateReact && ((OperateReact.isAppMounted && OperateReact.isAppMounted()) || (OperateReact.isShellMounted && OperateReact.isShellMounted()))){
    if(typeof OperateReact.refreshShell === 'function') OperateReact.refreshShell();
    return;
  }
  const fab = document.getElementById('fab');
  if(!fab) return;
  if(!fab.dataset.init){ fab.innerHTML = ICON.plus(26); fab.dataset.init='1'; }
  let action = null;
  if(!overlay){
    if(store.tab==='shows' || store.tab==='calendar') action = 'sheetEvent()';
    else if(store.tab==='ideas') action = (typeof contentMode!=='undefined' && contentMode==='notes') ? 'sheetNoteAddChoice()' : 'sheetIdea()';
  } else if(overlay.type==='noteFolder' && overlay.id){
    action = `sheetNoteAddChoice('${overlay.id}')`;
  }
  if(action){ fab.style.display='flex'; fab.setAttribute('onclick', action); }
  else { fab.style.display='none'; fab.removeAttribute('onclick'); }
}
window.setFab = setFab;
window.syncScreenChrome = syncScreenChrome;
/* ============================================================
   Sheet / modal system
   ============================================================ */
let sheetEl = null;
/* Stack of panels to reopen when the user dismisses a nested edit sheet
   (e.g. Flights → back to Edit show, instead of closing everything). */
let sheetReturnStack = [];
function openSheet(title, bodyHTML, opts={}){
  closeSheet(true, { noReturn: true });
  if(opts.clearReturn) sheetReturnStack = [];

  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountShell === 'function'){
    OperateReact.mountShell();
  }
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeOpenSheet === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeOpenSheet(title, bodyHTML, opts);
    return;
  }

  const app = $('#app');
  const scrim = $('#scrim');
  const s = document.createElement('div');
  s.className = 'sheet'+(opts.full?' full':'');
  const head = opts.full
    ? `<div class="sheet-head sheet-full-head bordered">
         <button class="link-btn plain" onclick="closeSheet()">Cancel</button>
         <div class="sheet-title">${esc(title)}</div>
         <button class="link-btn" id="sheet-action" ${opts.action?'':'style="visibility:hidden"'} onclick="${opts.action||''}">${opts.actionLabel||'Save'}</button>
       </div>`
    : `<div class="grabber"></div>
       <div class="sheet-head">
         <div class="sheet-title">${esc(title)}</div>
         <button class="header-btn" onclick="closeSheet()" style="width:32px;height:32px">${ICON.x(18)}</button>
       </div>`;
  s.innerHTML = head + `<div class="sheet-body">${bodyHTML}</div>`;
  app.appendChild(s);
  sheetEl = s;
  enhanceDateTimeFields(s);
  app.classList.add('sheet-open');
  scrim.classList.add('on');
  scrim.onclick = ()=>closeSheet();
  requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('on')));
}
/* React sheet body — same open/close chrome, component from registry by bodyKind. */
function openSheetReact(title, bodyKind, bodyProps, opts={}){
  closeSheet(true, { noReturn: true });
  if(opts.clearReturn) sheetReturnStack = [];

  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountShell === 'function'){
    OperateReact.mountShell();
  }
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeOpenSheetReact === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeOpenSheetReact(title, bodyKind, bodyProps || {}, opts);
    return;
  }
  /* Fallback: no React — leave sheet closed rather than invent HTML. */
  console.warn('openSheetReact: React shell not ready', bodyKind);
}
function sheetCallback(key, fn){
  if(typeof window === 'undefined') return key;
  window.__sheetCallbacks = window.__sheetCallbacks || {};
  window.__sheetCallbacks[key] = fn;
  return key;
}
function closeSheet(instant, opts={}){
  const app = $('#app');
  const scrim = $('#scrim');
  closeDateTimePicker(true);
  const ret = (!opts.noReturn && !instant) ? sheetReturnStack.pop() : null;

  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeCloseSheet === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    const finish = ()=>{
      if(scrim) scrim.classList.remove('on');
      if(app) app.classList.remove('sheet-open');
      sheetEl = null;
      if(ret) setTimeout(()=>reopenSheetReturn(ret), 0);
    };
    OperateReact.chromeCloseSheet(!!instant, finish);
    return;
  }

  if(!sheetEl){
    scrim.classList.remove('on');
    if(app) app.classList.remove('sheet-open');
    if(ret) setTimeout(()=>reopenSheetReturn(ret), 0);
    return;
  }
  const s = sheetEl; sheetEl=null; scrim.classList.remove('on');
  const finish = ()=>{
    s.remove();
    if(!sheetEl && app) app.classList.remove('sheet-open');
    if(ret) reopenSheetReturn(ret);
  };
  if(instant){
    finish();
    return;
  }
  s.classList.remove('on');
  setTimeout(finish, 280);
}
function reopenSheetReturn(ret){
  if(!ret || !ret.kind) return;
  if(ret.kind==='eventMenu' && ret.id) eventMenu(ret.id);
  else if(ret.kind==='showChecklist' && ret.id) sheetShowChecklist(ret.id);
  else if(ret.kind==='showTimeline' && ret.id) sheetShowTimeline(ret.id);
  else if(ret.kind==='showFlights' && ret.id) sheetFlight(ret.id);
}
/* Open a show-edit section and remember to return to the Edit show panel. */
function openFromEventMenu(eid, opener){
  sheetReturnStack.push({ kind:'eventMenu', id:eid });
  if(typeof opener === 'function') opener();
}
function val(id){ const e=document.getElementById(id); return e?e.value.trim():''; }
function rawVal(id){ const e=document.getElementById(id); return e?e.value:''; }

/* Tap a date/time field to open Operate's styled picker (not the system one). */
function openInputPicker(id){
  const el = document.getElementById(id);
  if(!el) return;
  const kind = (el.dataset.picker || el.type || '').toLowerCase();
  if(kind === 'date') openDatePicker(id);
  else if(kind === 'time') openTimePicker(id);
  else {
    try{
      if(typeof el.showPicker === 'function') el.showPicker();
      else { el.focus(); el.click(); }
    }catch(e){ el.focus(); }
  }
}

/* ---------- Custom date / time pickers (match app chrome) ---------- */
let dtPickerEl = null;
let dtPickerState = null;

function pickerLabelFor(input){
  const field = input && input.closest('.field');
  const lab = field && field.querySelector('label');
  return (lab && lab.textContent.trim()) || (input && input.type === 'date' ? 'Date' : 'Time');
}
function closeDateTimePicker(instant){
  if(!dtPickerEl) return;
  const el = dtPickerEl;
  dtPickerEl = null;
  dtPickerState = null;
  el.classList.remove('on');
  if(instant){ el.remove(); return; }
  setTimeout(()=>el.remove(), 260);
}
function mountDateTimePicker(html){
  closeDateTimePicker(true);
  const wrap = document.createElement('div');
  wrap.className = 'dt-picker';
  wrap.innerHTML = `<div class="dt-picker-scrim" onclick="closeDateTimePicker()"></div><div class="dt-picker-panel">${html}</div>`;
  $('#app').appendChild(wrap);
  dtPickerEl = wrap;
  requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add('on')));
  return wrap;
}
function enhanceDateTimeFields(root){
  if(!root) return;
  root.querySelectorAll('input[type="date"], input[type="time"]').forEach(inp => {
    if(inp.dataset.dtReady) return;
    inp.dataset.dtReady = '1';
    if(!inp.id) inp.id = 'dtf_' + Math.random().toString(36).slice(2, 9);
    inp.setAttribute('readonly', 'readonly');
    inp.classList.add('dt-field');
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try{ inp.blur(); }catch(_){}
      openInputPicker(inp.id);
    };
    inp.addEventListener('click', open);
    inp.addEventListener('mousedown', open);
    inp.addEventListener('focus', (e) => {
      e.preventDefault();
      try{ inp.blur(); }catch(_){}
      openInputPicker(inp.id);
    });
  });
}
function openDatePicker(inputId){
  const input = document.getElementById(inputId);
  if(!input) return;
  haptic();
  const raw = (input.value || '').trim();
  const base = parseDT(raw) || new Date();
  dtPickerState = {
    mode: 'date',
    inputId,
    y: base.getFullYear(),
    m: base.getMonth(),
    selected: raw || `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(base.getDate())}`
  };
  renderDatePickerBody();
}
function renderDatePickerBody(){
  if(!dtPickerState || dtPickerState.mode !== 'date') return;
  const {y, m, selected, inputId} = dtPickerState;
  const input = document.getElementById(inputId);
  const title = pickerLabelFor(input);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  let cells = '';
  for(let i=0;i<startDow;i++){
    const d = prevDays - startDow + i + 1;
    cells += `<button type="button" class="dt-day other" disabled>${d}</button>`;
  }
  for(let d=1;d<=daysInMonth;d++){
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    cells += `<button type="button" class="dt-day${ds===todayStr?' today':''}${ds===selected?' sel':''}" onclick="dtPickDay('${ds}')">${d}</button>`;
  }
  const total = startDow + daysInMonth;
  for(let i=total;i%7!==0;i++){
    cells += `<button type="button" class="dt-day other" disabled>${i-total+1}</button>`;
  }
  const selLabel = selected ? fmtDateLong(selected) : 'Choose a date';
  const html = `
    <div class="dt-picker-head">
      <button type="button" class="header-btn" style="width:32px;height:32px" onclick="closeDateTimePicker()">${ICON.x(18)}</button>
      <div class="dt-picker-title">${esc(title)}</div>
      <button type="button" class="link-btn" onclick="dtConfirmDate()">Done</button>
    </div>
    <div class="dt-picker-hero">
      <div class="dt-picker-hero-label">Selected</div>
      <div class="dt-picker-hero-value" id="dt-date-hero">${esc(selLabel)}</div>
    </div>
    <div class="dt-cal-card">
      <div class="dt-cal-head">
        <button type="button" class="dt-cal-nav" onclick="dtMoveMonth(-1)" aria-label="Previous month">${ICON.chevL(18)}</button>
        <div class="dt-cal-month">${MONTHS[m]} ${y}</div>
        <button type="button" class="dt-cal-nav" onclick="dtMoveMonth(1)" aria-label="Next month">${ICON.chevR(18)}</button>
      </div>
      <div class="dt-cal-dows">${DOW.map(d=>`<div>${d[0]}</div>`).join('')}</div>
      <div class="dt-cal-grid">${cells}</div>
    </div>
    <div class="dt-quick">
      <button type="button" class="chip ${selected===todayStr?'on':''}" onclick="dtPickDay('${todayStr}')">Today</button>
      <button type="button" class="chip" onclick="dtJumpToday()">This month</button>
    </div>
    <button type="button" class="btn" style="margin-top:14px" onclick="dtConfirmDate()">Use date</button>
  `;
  if(dtPickerEl){
    const panel = dtPickerEl.querySelector('.dt-picker-panel');
    if(panel) panel.innerHTML = html;
  } else {
    mountDateTimePicker(html);
  }
}
function dtMoveMonth(delta){
  if(!dtPickerState || dtPickerState.mode !== 'date') return;
  haptic();
  let {y, m} = dtPickerState;
  m += delta;
  if(m < 0){ m = 11; y -= 1; }
  if(m > 11){ m = 0; y += 1; }
  dtPickerState.y = y;
  dtPickerState.m = m;
  renderDatePickerBody();
}
function dtJumpToday(){
  if(!dtPickerState || dtPickerState.mode !== 'date') return;
  const now = new Date();
  dtPickerState.y = now.getFullYear();
  dtPickerState.m = now.getMonth();
  haptic();
  renderDatePickerBody();
}
function dtPickDay(ds){
  if(!dtPickerState || dtPickerState.mode !== 'date') return;
  dtPickerState.selected = ds;
  const d = parseDT(ds);
  if(d){ dtPickerState.y = d.getFullYear(); dtPickerState.m = d.getMonth(); }
  haptic();
  renderDatePickerBody();
}
function dtConfirmDate(){
  if(!dtPickerState || dtPickerState.mode !== 'date') return;
  const input = document.getElementById(dtPickerState.inputId);
  if(input && dtPickerState.selected){
    input.value = dtPickerState.selected;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }
  haptic();
  closeDateTimePicker();
}
function openTimePicker(inputId){
  const input = document.getElementById(inputId);
  if(!input) return;
  haptic();
  const raw = (input.value || '').trim();
  let hh = 23, mm = 0;
  if(/^\d{1,2}:\d{2}/.test(raw)){
    const parts = raw.split(':');
    hh = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    mm = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
  }
  mm = Math.round(mm / 5) * 5;
  if(mm === 60){ mm = 0; hh = (hh + 1) % 24; }
  dtPickerState = { mode: 'time', inputId, hh, mm, allowClear: !(raw && inputId === 'ev-set') };
  renderTimePickerBody();
  requestAnimationFrame(()=>dtScrollWheels(false));
}
function renderTimePickerBody(){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  const {hh, mm, inputId, allowClear} = dtPickerState;
  const input = document.getElementById(inputId);
  const title = pickerLabelFor(input);
  const hours = Array.from({length:24}, (_,i)=>i);
  const mins = Array.from({length:12}, (_,i)=>i*5);
  const html = `
    <div class="dt-picker-head dt-picker-head-compact">
      <button type="button" class="dt-icon-btn" onclick="closeDateTimePicker()" aria-label="Close">${ICON.x(16)}</button>
      <div class="dt-picker-title">${esc(title)}</div>
      <button type="button" class="link-btn dt-done" onclick="dtConfirmTime()">Done</button>
    </div>
    <div class="dt-time-readout mono" id="dt-time-hero">${pad(hh)}:${pad(mm)}</div>
    <div class="dt-wheels dt-wheels-compact" aria-label="Time wheels">
      <div class="dt-wheel-fade"></div>
      <div class="dt-wheel-center"></div>
      <div class="dt-wheel" id="dt-wheel-h" onscroll="dtWheelScroll('h')">
        <div class="dt-wheel-pad"></div>
        ${hours.map(h=>`<button type="button" class="dt-wheel-item${h===hh?' on':''}" data-v="${h}" onclick="dtSetHour(${h})">${pad(h)}</button>`).join('')}
        <div class="dt-wheel-pad"></div>
      </div>
      <div class="dt-wheel-colon">:</div>
      <div class="dt-wheel" id="dt-wheel-m" onscroll="dtWheelScroll('m')">
        <div class="dt-wheel-pad"></div>
        ${mins.map(m=>`<button type="button" class="dt-wheel-item${m===mm?' on':''}" data-v="${m}" onclick="dtSetMinute(${m})">${pad(m)}</button>`).join('')}
        <div class="dt-wheel-pad"></div>
      </div>
    </div>
    <div class="dt-quick dt-quick-compact">
      ${[['21:00',21,0],['22:00',22,0],['23:00',23,0],['00:00',0,0]].map(([l,h,m])=>
        `<button type="button" class="dt-chip ${hh===h&&mm===m?'on':''}" onclick="dtSetTime(${h},${m})">${l}</button>`
      ).join('')}
      ${allowClear?`<button type="button" class="dt-chip muted" onclick="dtClearTime()">Clear</button>`:''}
    </div>
  `;
  if(dtPickerEl){
    const panel = dtPickerEl.querySelector('.dt-picker-panel');
    if(panel){
      panel.classList.add('dt-picker-panel-time');
      panel.innerHTML = html;
    }
  } else {
    const wrap = mountDateTimePicker(html);
    const panel = wrap && wrap.querySelector('.dt-picker-panel');
    if(panel) panel.classList.add('dt-picker-panel-time');
  }
}
function dtScrollWheels(smooth){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  const hWheel = document.getElementById('dt-wheel-h');
  const mWheel = document.getElementById('dt-wheel-m');
  const itemH = 36;
  if(hWheel) hWheel.scrollTo({ top: dtPickerState.hh * itemH, behavior: smooth ? 'smooth' : 'auto' });
  if(mWheel) mWheel.scrollTo({ top: (dtPickerState.mm / 5) * itemH, behavior: smooth ? 'smooth' : 'auto' });
}
let dtWheelT = null;
function dtWheelScroll(which){
  clearTimeout(dtWheelT);
  dtWheelT = setTimeout(()=>{
    if(!dtPickerState || dtPickerState.mode !== 'time') return;
    const wheel = document.getElementById(which === 'h' ? 'dt-wheel-h' : 'dt-wheel-m');
    if(!wheel) return;
    const itemH = 36;
    const idx = Math.round(wheel.scrollTop / itemH);
    if(which === 'h'){
      dtPickerState.hh = Math.min(23, Math.max(0, idx));
    } else {
      dtPickerState.mm = Math.min(55, Math.max(0, idx * 5));
    }
    const hero = document.getElementById('dt-time-hero');
    if(hero) hero.textContent = `${pad(dtPickerState.hh)}:${pad(dtPickerState.mm)}`;
    wheel.querySelectorAll('.dt-wheel-item').forEach(btn => {
      const v = +btn.dataset.v;
      btn.classList.toggle('on', which === 'h' ? v === dtPickerState.hh : v === dtPickerState.mm);
    });
  }, 80);
}
function dtSetHour(h){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  dtPickerState.hh = h;
  haptic();
  const hero = document.getElementById('dt-time-hero');
  if(hero) hero.textContent = `${pad(dtPickerState.hh)}:${pad(dtPickerState.mm)}`;
  document.querySelectorAll('#dt-wheel-h .dt-wheel-item').forEach(btn => btn.classList.toggle('on', +btn.dataset.v === h));
  dtScrollWheels(true);
}
function dtSetMinute(m){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  dtPickerState.mm = m;
  haptic();
  const hero = document.getElementById('dt-time-hero');
  if(hero) hero.textContent = `${pad(dtPickerState.hh)}:${pad(dtPickerState.mm)}`;
  document.querySelectorAll('#dt-wheel-m .dt-wheel-item').forEach(btn => btn.classList.toggle('on', +btn.dataset.v === m));
  dtScrollWheels(true);
}
function dtSetTime(h, m){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  dtPickerState.hh = h;
  dtPickerState.mm = m;
  haptic();
  renderTimePickerBody();
  requestAnimationFrame(()=>dtScrollWheels(true));
}
function dtClearTime(){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  const input = document.getElementById(dtPickerState.inputId);
  if(input){
    input.value = '';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }
  haptic();
  closeDateTimePicker();
}
function dtConfirmTime(){
  if(!dtPickerState || dtPickerState.mode !== 'time') return;
  const input = document.getElementById(dtPickerState.inputId);
  if(input){
    input.value = `${pad(dtPickerState.hh)}:${pad(dtPickerState.mm)}`;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }
  haptic();
  closeDateTimePicker();
}

/* Fullscreen image viewer */
function openViewer(src){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountShell === 'function'){
    OperateReact.mountShell();
  }
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeOpenViewer === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeOpenViewer(src);
    return;
  }
  const img = $('#viewer-img');
  if(img) img.src = src;
  $('#viewer')?.classList.add('on');
}
function closeViewer(){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeCloseViewer === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeCloseViewer();
    return;
  }
  $('#viewer')?.classList.remove('on');
  const img = $('#viewer-img');
  if(img) img.src = '';
}

/* Simulated async op with loading/success feedback (button lifecycle) */
function withButton(btn, work, successMsg){
  if(!btn) { work(); return; }
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="spin"></span>`;
  setTimeout(()=>{
    try{ work(); if(successMsg) toast(successMsg,'check'); }
    catch(e){ btn.disabled=false; btn.innerHTML=orig; toast('Something went wrong','x'); return; }
  }, 260);
}

/* ---------- External action helpers ---------- */
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent);
/* Open an external link. In an installed iOS PWA, window.open('_blank') spawns a blank
   in-app browser you have to close manually — so on iOS we hand the link to the OS
   (native app via URL scheme), which keeps the app intact behind it. */
function openExternal(webUrl, iosUrl){
  if(IS_IOS){ window.location.href = iosUrl || webUrl; }
  else { window.open(webUrl, '_blank', 'noopener'); }
}
function callNumber(num){ if(!num){toast('No number saved','x');return;} window.location.href='tel:'+num.replace(/\s/g,''); }
function whatsapp(num){ if(!num){toast('No WhatsApp saved','x');return;} const n=num.replace(/[^\d]/g,''); openExternal('https://wa.me/'+n, 'https://wa.me/'+n); }
function copyText(txt){ if(!txt)return; navigator.clipboard?.writeText(txt).then(()=>toast('Copied','copy'),()=>toast('Copy failed','x')); }
function openMaps(q){ if(!q){toast('No location','x');return;}
  const enc=encodeURIComponent(q);
  // iOS: open the native Maps app via the maps:// scheme (keeps Operate open behind it). Else Google Maps in a new tab.
  openExternal('https://www.google.com/maps/search/?api=1&query='+enc, 'maps://?q='+enc);
  toast('Opening Maps','map');
}
/* ============================================================
   Generic confirm + single-input prompt (styled, no native dialogs)
   ============================================================ */
function confirmSheet(title, msg, confirmLabel, onConfirm, danger){
  const key = 'confirm_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  sheetCallback(key, onConfirm);
  openSheetReact(title, 'common.confirm', {
    msg: msg || '',
    confirmLabel: confirmLabel || 'Confirm',
    danger: !!danger,
    onConfirmKey: key,
  });
}
function promptSheet(title, placeholder, onSave, initial=''){
  const key = 'prompt_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  sheetCallback(key, onSave);
  openSheetReact(title, 'common.prompt', {
    placeholder: placeholder || '',
    initial: initial || '',
    saveKey: key,
  });
}

/* ============================================================
   Checklists (event + trip) and timeline steps
   ============================================================ */
function toggleEventCheck(eid,cid){
  const e=sel.event(eid); if(!e) return;
  const i=(e.checklist=e.checklist||[]).find(x=>x.id===cid);
  if(!i) return;
  i.done=!i.done;
  haptic();
  persist('shows', eid);
  if(!patchCheckRowsById(cid, i.done)) softRender();
  else patchShowChecklistHead(eid);
}
function delEventCheck(eid,cid){
  const e=sel.event(eid); if(!e) return;
  e.checklist=(e.checklist||[]).filter(x=>x.id!==cid);
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  removeCheckRowsById(cid);
  patchShowChecklistHead(eid);
  if(!(e.checklist||[]).length) softRender();
  else if(typeof sheetEl!=='undefined' && sheetEl && typeof sheetShowChecklist==='function'){
    /* Keep open checklist sheet in sync without remounting the whole show. */
    try{ sheetShowChecklist(eid); }catch(_){}
  }
}
function addEventCheckPrompt(eid){
  const e=sel.event(eid); if(!e) return;
  sheetReturnStack.push({ kind:'showChecklist', id:eid });
  promptSheet('Checklist item','e.g. Track ID list', function(v){
    const show=sel.event(eid); if(!show) return;
    (show.checklist = show.checklist || []).push({id:uid('ck'),label:v,done:false});
    persist('shows', eid);
    if(typeof pushShowNow==='function') pushShowNow(eid);
    softRender();
    toast('Added','check');
  });
}
function addEventCheckFromSheet(eid){
  const e=sel.event(eid); if(!e) return;
  const v=val('ck-new');
  if(!v){ toast('Type something','x'); return; }
  (e.checklist = e.checklist || []).push({id:uid('ck'),label:v,done:false});
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  sheetShowChecklist(eid);
  softRender();
  toast('Added','check');
}
function toggleTripCheck(tid,cid){
  const t=sel.trip(tid); if(!t) return;
  const i=(t.checklist||[]).find(x=>x.id===cid);
  if(!i) return;
  i.done=!i.done;
  haptic();
  persist('tours', tid);
  if(!patchCheckRowsById(cid, i.done)) softRender();
}
function delTripCheck(tid,cid){
  const t=sel.trip(tid); if(!t) return;
  t.checklist=(t.checklist||[]).filter(x=>x.id!==cid);
  persist('tours', tid);
  removeCheckRowsById(cid);
  if(!(t.checklist||[]).length) softRender();
}
function addTripCheckPrompt(tid){
  promptSheet('Packing / checklist item','e.g. Battery packs', function(v){
    const t=sel.trip(tid); t.checklist.push({id:uid('ck'),label:v,done:false});
    persist('tours', tid);
    softRender();
    toast('Added','check');
  });
}
function completeStep(tid,sid){
  const t=sel.trip(tid); if(!t) return;
  const s=(t.timeline||[]).find(x=>x.id===sid);
  if(!s) return;
  s.done=!s.done;
  haptic();
  persist('tours', tid);
  const item = document.querySelector('.tl-item[data-id="'+cssAttrEscape(sid)+'"]');
  if(item){
    item.classList.toggle('done', !!s.done);
    item.classList.toggle('now', false);
    const hint = item.querySelector('.swipe-hint');
    if(hint){
      if(s.done) hint.remove();
      else if(!item.querySelector('.swipe-hint')){
        const card = item.querySelector('.tl-card');
        if(card) card.insertAdjacentHTML('beforeend', `<div class="swipe-hint">${ICON.check(12)} Tap to complete</div>`);
      }
    } else if(!s.done){
      const card = item.querySelector('.tl-card');
      if(card) card.insertAdjacentHTML('beforeend', `<div class="swipe-hint">${ICON.check(12)} Tap to complete</div>`);
    }
  } else if(!patchCheckRowsById(sid, s.done)) softRender();
  if(s.done) toast('Step done ✓','check');
}
function saveEventNotes(eid,v){ const e=sel.event(eid); if(e){e.notes=v; persist('shows', eid);} }

/* ============================================================
   File uploads (stored as data URLs — Phase 2: cloud storage)
   ============================================================ */
/* Shrink an image data URL (resize + JPEG) so it's small enough to store & sync.
   Screenshots go from multi-MB PNGs down to ~100-250KB. Falls back to original on any error. */
function compressImage(dataUrl, cb){
  try{
    const img=new Image();
    img.onload=()=>{
      try{
        const max=1500; let w=img.width, h=img.height;
        if(w>max||h>max){ const s=Math.min(max/w, max/h); w=Math.round(w*s); h=Math.round(h*s); }
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        const out=c.toDataURL('image/jpeg',0.72);
        cb(out && out.length < dataUrl.length ? out : dataUrl);
      }catch(e){ cb(dataUrl); }
    };
    img.onerror=()=>cb(dataUrl);
    img.src=dataUrl;
  }catch(e){ cb(dataUrl); }
}
function fileKindFromFile(f){
  const name = ((f && f.name) || '').toLowerCase();
  const type = ((f && f.type) || '').toLowerCase();
  if(type.startsWith('image/')) return 'image';
  if(type === 'application/vnd.apple.pkpass' || name.endsWith('.pkpass')) return 'pkpass';
  return 'pdf';
}
function readFile(input, cb){
  const f = input.files&&input.files[0]; if(!f) return;
  if(f.size > 12*1024*1024){ toast('File too large (12MB max)','x'); input.value=''; return; }
  const kind = fileKindFromFile(f);
  const r = new FileReader();
  r.onload = ()=>{
    const base = { id:uid('att'), kind, name:f.name, mime: f.type || (typeof mimeFromPassKind==='function'?mimeFromPassKind(kind):'') };
    if(kind==='image'){ compressImage(r.result, d=>cb(Object.assign(base,{data:d}))); }
    else cb(Object.assign(base,{data:r.result}));
  };
  r.onerror = ()=>toast('Upload failed','x');
  r.readAsDataURL(f);
  input.value='';
}
/* Read multiple files → array of attachments (images compressed), then callback once. */
function readFiles(input, cb){
  const all = Array.from(input.files||[]); input.value='';
  const files = all.filter(f=>f.size<=12*1024*1024);
  if(all.length>files.length) toast('Some files skipped (12MB max)','x');
  if(!files.length){ cb([]); return; }
  const out=[]; let done=0;
  const finish=()=>{ if(++done===files.length) cb(out); };
  files.forEach(f=>{
    const kind=fileKindFromFile(f);
    const r=new FileReader();
    r.onload=()=>{
      const base={id:uid('att'),kind,name:f.name,mime:f.type||(typeof mimeFromPassKind==='function'?mimeFromPassKind(kind):'')};
      if(kind==='image'){ compressImage(r.result, d=>{ out.push(Object.assign(base,{data:d})); finish(); }); }
      else { out.push(Object.assign(base,{data:r.result})); finish(); }
    };
    r.onerror=()=>finish();
    r.readAsDataURL(f);
  });
}

/* ============================================================
   Itinerary inbox
   Flow: choose new vs existing → upload file.
   New show: POST the file straight to the Make webhook, wait, then review basics.
   ============================================================ */
let itineraryUploadMode = null; // 'new' | 'existing'
const MAKE_ITINERARY_WEBHOOK_URL = 'https://hook.eu2.make.com/xgg1tbfi9leurmlcsgndqc5ssaxhjjxu';
const MAKE_ITINERARY_FULL_WEBHOOK_URL = 'https://hook.eu2.make.com/p2f3yp4wj7795gifd38v5rpepf3syxjt';
const MAKE_ITINERARY_DECISION_WEBHOOK_URL = 'https://hook.eu2.make.com/s9nhy6yvevqj0h8wg51wv57m1acwd3fg';
const MAKE_CALENDAR_WEBHOOK_URL = 'https://hook.eu2.make.com/llxseuaiwkm7q6ug0hjpg7e8iqws3eh7';
/* showId -> { status:'uploading'|'done'|'error', message:string } while full OCR runs */
let itineraryFullUploadByShow = {};
Object.defineProperty(window, 'itineraryFullUploadByShow', {
  get(){ return itineraryFullUploadByShow; },
  set(v){ itineraryFullUploadByShow = v; },
  configurable: true
});
/* Itinerary id currently open on the show-basics review sheet (awaiting confirm/cancel). */
let itineraryReviewActiveId = null;
/* Prevents ghost taps (e.g. after file picker) from auto-cancelling the review. */
let itineraryReviewCancelArmed = false;
let itineraryReviewArmTimer = null;

function viewItinerary(){
  const list = (store.itineraries||[]).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.created||0)-(a.created||0));
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Home</button>
    <div style="font-size:15px;font-weight:700">Itinerary inbox</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">
    <button type="button" class="btn" style="margin-top:14px" onclick="sheetItineraryStart()">${ICON.plus(18)} Submit itinerary</button>
    <div class="hint" style="text-align:left;padding:11px 2px 2px">Choose <b>new show</b> or <b>existing show</b>, then upload. New-show uploads are sent straight to your Make webhook.</div>
    ${list.length? list.map(itinCard).join('') : `<div class="empty" style="margin-top:22px"><div class="ic">${ICON.file(26)}</div><b>Nothing submitted yet</b><span>Upload your first itinerary screenshot.</span></div>`}
    <div class="spacer"></div><div class="spacer"></div>
  </div>`;
}
function itinCard(it){
  const show = it.showId? sel.event(it.showId):null;
  const pending = !!(it.scanFields && !it.showId);
  const when = (it.date?fmtDate(it.date):'')+(it.time?' · '+it.time:'');
  const thumbs = (it.imgs||[]).map(im=>im.kind==='image'
    ? `<div class="thumb" onclick="event.stopPropagation();openViewer('${im.data}')"><img src="${im.data}"></div>`
    : `<div class="thumb"><div class="pdf">${ICON.file(26)}<span>${esc(im.name||'PDF')}</span></div></div>`).join('');
  return `<div class="card" style="margin-top:12px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px" onclick="openItineraryEntry('${it.id}')">
      <div style="min-width:0"><b style="font-size:15.5px">${esc(it.source||'Itinerary')}</b>
        <div style="font-size:13px;color:var(--text-2);margin-top:2px">${pending?'Review show basics':(when||'No date set')}${show?' · '+esc(show.venue):''}</div>
        ${pending?`<div style="font-size:12.5px;color:var(--accent-2);margin-top:4px;font-weight:650">Waiting for you to confirm &amp; create the show</div>`:''}
        ${it.note?`<div style="font-size:13px;color:var(--text-3);margin-top:5px;white-space:pre-wrap">${esc(it.note)}</div>`:''}</div>
      ${ICON.chevR(15)}
    </div>
    ${thumbs?`<div class="thumb-row" style="margin-top:11px">${thumbs}</div>`:''}
  </div>`;
}
function openItineraryEntry(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  if(it.scanFields && !it.showId){ sheetItineraryReview(id); return; }
  sheetItinerary(id);
}
function sheetItineraryStart(){
  itineraryUploadMode = null;
  openSheetReact('Submit itinerary', 'itinerary.start', {});
}
function beginItineraryNewShow(){
  itineraryUploadMode = 'new';
  openSheetReact('New show from itinerary', 'itinerary.newShow', {});
}
function beginItineraryExistingShow(){
  itineraryUploadMode = 'existing';
  const shows = sel.events().slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!shows.length){
    openSheetReact('Add to a show', 'itinerary.existingShow', { items: [] });
    return;
  }
  const upcoming = typeof showPassed==='function' ? shows.filter(s=>!showPassed(s)) : shows;
  const list = upcoming.length ? upcoming : shows;
  openSheetReact('Existing show', 'itinerary.existingShow', { items: list });
}
function normalizeScanDate(v){
  const s=String(v||'').trim();
  if(!s) return '';
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){
    const d=+m[1], mo=+m[2], y=m[3].length===2?2000+(+m[3]):(+m[3]);
    if(d>=1&&d<=31&&mo>=1&&mo<=12) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const dt=new Date(s);
  if(!isNaN(dt.getTime())) return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  return '';
}
function normalizeScanTime(v){
  const s=String(v||'').trim();
  if(!s) return '';
  const m=s.match(/(\d{1,2}):(\d{2})/);
  if(!m) return '';
  return pad(+m[1])+':'+m[2];
}
function blankShowFromBasics(basics){
  return {
    id: uid('evt'),
    artist: basics.artist || store.settings.artistName,
    tripId: null,
    eventName: basics.eventName||'',
    venue: basics.venue||'',
    venueAddr: basics.venueAddr||'',
    venueAddr2: basics.venueAddr2||'',
    venueRegion: basics.venueRegion||'',
    venuePostcode: basics.venuePostcode||'',
    city: basics.city||'',
    country: basics.country||'',
    date: basics.date||'',
    setTime: basics.setTime||'',
    endTime: basics.endTime||'',
    arrival: basics.arrival||'',
    status: basics.status||'confirmed',
    content: basics.content||'',
    color: basics.color||'purple',
    hotel: null,
    flights: [],
    driver: null,
    drivers: [],
    promoter: null,
    notes: basics.notes||'',
    checklist: [],
    timeline: [],
    attachments: [],
    advance: {},
    finance: {
      fee:0, currency:store.settings.baseCurrency, dealType:'Guarantee',
      expenses:[], perDiem:0, commission:0, paid:false
    }
  };
}
function submitItinerary(input, mode){
  const uploadMode = mode || itineraryUploadMode || 'new';
  toast('Reading…','image');
  readFiles(input, async imgs=>{
    if(!imgs.length){ toast('Nothing added','x'); return; }

    let showId = '';
    let date = '';
    let source = '';

    if(uploadMode === 'new'){
      const n=new Date();
      date=`${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
      source = 'New show → Make';
    } else {
      showId = rawVal('itn-pick-show') || '';
      if(!showId){ toast('Pick a show first','x'); return; }
      const show = sel.event(showId);
      date = (show && show.date) || '';
      source = 'Existing show itinerary';
      if(!date){
        const n=new Date();
        date=`${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
      }
    }

    const entry={
      id:uid('itin'),
      source,
      date,
      time:'',
      note:'',
      showId: showId||'',
      imgs,
      scanFields:null,
      mode: uploadMode,
      created:Date.now()
    };
    store.itineraries = store.itineraries || [];
    store.itineraries.unshift(entry);
    persist('user_preferences');
    imgs.forEach(im => hostImg(im, 'itinerary', 'itinerary'));
    itineraryUploadMode = null;
    renderView();

    if(uploadMode === 'new'){
      await sendItineraryToMake(entry.id);
    } else {
      closeSheet();
      sheetItinerary(entry.id);
      toast('File saved on existing show','check');
    }
  });
}
function dataUrlToBlob(dataUrl){
  const m=String(dataUrl||'').match(/^data:([^;]+);base64,(.+)$/);
  if(!m) return null;
  try{
    const mime=m[1]||'application/octet-stream';
    const bin=atob(m[2]);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return new Blob([bytes],{type:mime});
  }catch(_){ return null; }
}
function normalizeMakeFields(payload){
  if(!payload || typeof payload!=='object') return {};
  const src=(payload.fields && typeof payload.fields==='object') ? payload.fields : payload;
  const out={};
  Object.keys(src).forEach(k=>{
    const v=src[k];
    if(v==null) return;
    if(typeof v==='string' || typeof v==='number' || typeof v==='boolean') out[k]=String(v);
  });
  /* Canonical keys the review sheet / save path expect. */
  const pick = (...keys) => {
    for(const k of keys){
      const v = out[k];
      if(v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  const eventName = pick('eventName', 'event_name', 'EventName', 'event name');
  if(eventName) out.eventName = eventName;
  const venue = pick('venue', 'venueName', 'venue_name', 'Venue');
  if(venue) out.venue = venue;
  return out;
}
function resolveOperateOrgId(){
  if(typeof currentOrgId !== 'undefined' && currentOrgId) return String(currentOrgId);
  if(store && store.organisationId) return String(store.organisationId);
  if(typeof getStoredOrgId === 'function'){
    const stored = getStoredOrgId();
    if(stored) return String(stored);
  }
  if(typeof getFixedOrgId === 'function'){
    const fixed = getFixedOrgId();
    if(fixed) return String(fixed);
  }
  const cfg = (typeof OPERATE_CONFIG !== 'undefined' && OPERATE_CONFIG) || window.OPERATE_CONFIG;
  if(cfg && cfg.OPERATE_ORG_ID && !String(cfg.OPERATE_ORG_ID).includes('YOUR-ORG')){
    return String(cfg.OPERATE_ORG_ID);
  }
  return '';
}

/* ============================================================
   Calendar screenshot upload → Make webhook
   ============================================================ */
function sheetCalendarUpload(){
  openSheetReact('Upload calendar', 'calendar.upload', {});
}
function submitCalendarUpload(input){
  toast('Reading…','image');
  readFiles(input, async imgs=>{
    const images = (imgs || []).filter(im => im && im.kind === 'image' && im.data);
    if(!images.length){
      toast('Add at least one screenshot','x');
      return;
    }
    closeSheet(true);
    toast(images.length === 1 ? 'Sending screenshot…' : `Sending ${images.length} screenshots…`,'image');
    const result = await postCalendarScreenshotsToMake(images);
    if(result.error){
      toast(itineraryScanErrorToast(result.error),'x');
      return;
    }
    toast(images.length === 1 ? 'Calendar sent' : `Sent ${images.length} screenshots`,'check');
  });
}
async function postCalendarScreenshotsToMake(images){
  const list = (images || []).filter(im => im && im.data);
  if(!list.length) return { error:'no_file' };
  const files = [];
  list.forEach((file, i) => {
    const m = String(file.data || '').match(/^data:([^;]+);base64,(.+)$/);
    if(!m) return;
    files.push({
      index: i + 1,
      filename: file.name || `calendar-${i + 1}.jpg`,
      contentType: file.mime || m[1] || 'image/jpeg',
      data: m[2]
    });
  });
  if(!files.length) return { error:'bad_file' };
  const payload = {
    organisation_id: resolveOperateOrgId(),
    artist: (store.settings && store.settings.artistName) || '',
    file_count: files.length,
    uploaded_at: new Date().toISOString(),
    files
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try{
    const res = await fetch(MAKE_CALENDAR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text().catch(() => '');
    if(!res.ok) return { error:'make_failed', status:res.status, raw:text };
    return { ok:true, raw:text };
  }catch(err){
    if(err && err.name === 'AbortError') return { error:'make_timeout' };
    return { error:'scan_failed', detail:String(err && err.message || err || '') };
  }finally{
    clearTimeout(timer);
  }
}

/* POST the uploaded file straight to Make. Basics + full use different webhooks. */
async function postItineraryFileToMake(it, opts={}){
  const file=(it.imgs||[]).find(im=>im.kind==='image') || (it.imgs||[])[0];
  if(!file || !file.data) return { error:'no_file' };
  const blob=dataUrlToBlob(file.data);
  if(!blob) return { error:'bad_file' };
  const orgId = resolveOperateOrgId();
  const stage = opts.stage || (it.showId ? 'full' : 'basics');
  const webhookUrl = stage === 'full' ? MAKE_ITINERARY_FULL_WEBHOOK_URL : MAKE_ITINERARY_WEBHOOK_URL;
  const form=new FormData();
  const name=file.name || (file.kind==='image' ? 'itinerary.jpg' : 'itinerary.pdf');
  form.append('file', blob, name);
  form.append('filename', name);
  form.append('contentType', file.mime || blob.type || 'application/octet-stream');
  form.append('stage', stage);
  form.append('itinerary_id', it.id || '');
  form.append('organisation_id', orgId);
  if(it.showId) form.append('show_id', it.showId);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(), stage === 'full' ? 120000 : 90000);
  try{
    const res=await fetch(webhookUrl, {
      method:'POST',
      body:form,
      signal:controller.signal
    });
    const text=await res.text().catch(()=>'');
    if(!res.ok) return { error:'make_failed', status:res.status };
    let payload={};
    if(text.trim()){
      try{ payload=JSON.parse(text); }catch(_){ return { ok:true, fields:{}, payload:{}, raw:text }; }
    }
    return { ok:true, fields: normalizeMakeFields(payload), payload };
  }catch(err){
    if(err && err.name==='AbortError') return { error:'make_timeout' };
    return { error:'scan_failed', detail: String(err&&err.message||err||'') };
  }finally{
    clearTimeout(timer);
  }
}
function itineraryScanErrorToast(code){
  if(code==='make_timeout') return 'Make timed out — check your scenario / Webhook response';
  if(code==='make_failed') return 'Make rejected the upload — check the scenario is on';
  if(code==='no_file' || code==='bad_file') return 'No usable file to send — try another upload';
  return 'Couldn’t reach Make (often a browser CORS block) — check the console';
}
async function sendItineraryToMake(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  if(!(it.imgs||[]).length){
    toast('Nothing to send — upload a file first','file');
    return;
  }
  openSheetReact('Sending to Make', 'itinerary.sending', {});
  toast('Sending to Make…','image');
  try{
    const result = await postItineraryFileToMake(it, { stage:'basics' });
    if(result.error){
      toast(itineraryScanErrorToast(result.error),'x');
      sheetItineraryReview(id);
      return;
    }
    it.scanFields = result.fields || {};
    const scannedDate = normalizeScanDate(it.scanFields.date);
    if(scannedDate) it.date = scannedDate;
    persist('user_preferences');
    sheetItineraryReview(id);
    const keys = Object.keys(it.scanFields||{});
    toast(keys.length ? 'Check the show basics, then save' : 'Sent to Make — fill basics and save','check');
  }catch(err){
    toast('Couldn’t reach Make — see browser console','x');
    sheetItineraryReview(id);
  }
}
async function scanItineraryForReview(id){
  await sendItineraryToMake(id);
}
async function fetchItineraryScanFields(it){
  const result = await postItineraryFileToMake(it);
  if(result.error) return { error: result.error };
  return { fields: result.fields || {} };
}
function sheetItineraryReview(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  itineraryReviewActiveId = id;
  itineraryReviewCancelArmed = false;
  if(itineraryReviewArmTimer){ clearTimeout(itineraryReviewArmTimer); itineraryReviewArmTimer = null; }
  const f=it.scanFields||{};
  const n=new Date();
  const today=`${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
  const venue=f.venue||f.venueName||'';
  const city=f.city||'';
  const country=f.country||'';
  const date=normalizeScanDate(f.date)||it.date||today;
  const setTime=normalizeScanTime(f.setTime)||'23:00';
  const endTime=normalizeScanTime(f.endTime);
  const arrival=normalizeScanTime(f.arrival);
  const venueAddr=f.venueAddress||f.venueAddr||'';
  const venueAddr2=f.venueAddress2||f.venueAddr2||'';
  const venueRegion=f.venueRegion||f.region||'';
  const venuePostcode=f.venuePostcode||f.postcode||'';
  const content=f.content||'';
  const notes=f.notes||f.remarks||'';
  const artist=f.artist||store.settings.artistName||'';
  const status=f.status||'confirmed';
  const initCat=f.color&&CATS[f.color]?f.color:'purple';
  const initC=CATS[initCat]||CATS.purple;
  const swatches=Object.entries(CATS).map(([k,v])=>`<div class="sw${k===initCat?' on':''}" style="background:${v}" data-cat="${k}" onclick="pickCat(this)"></div>`).join('');
  const extras=[];
  if(f.hotelName||f.hotelAddress) extras.push('hotel');
  if(f.driverName||f.driverPhone) extras.push('transport');
  if(f.soundcheck||f.curfew||f.doors||f.stage||f.guestlist||f.catering) extras.push('advancing');

  openSheetReact('Show basics', 'itinerary.review', { id, fields: f });
  if(sheetEl){
    sheetEl.style.setProperty('--sheet-tone', initC);
    sheetEl.classList.add('sheet-toned');
    const closeBtn = sheetEl.querySelector('.sheet-head .header-btn');
    if(closeBtn) closeBtn.setAttribute('onclick', `abandonItineraryReview('${id}')`);
  }
  /* No tap-outside-to-close — exit must be intentional (Create / Discard / X). */
  const scrim = $('#scrim');
  if(scrim) scrim.onclick = null;
  itineraryReviewArmTimer = setTimeout(()=>{
    itineraryReviewArmTimer = null;
    if(itineraryReviewActiveId !== id) return;
    itineraryReviewCancelArmed = true;
  }, 1200);
}
function notifyItineraryDecision(it, status, extra={}){
  if(!it || !status) return;
  if(it.decisionNotified === 'confirmed') return;
  if(it.decisionNotified === status) return;
  const orgId = resolveOperateOrgId();
  const form = new FormData();
  form.append('status', status);
  form.append('itinerary_id', it.id || '');
  form.append('organisation_id', orgId || '');
  const showId = extra.show_id || it.showId || '';
  if(showId) form.append('show_id', showId);
  if(extra.reason) form.append('reason', String(extra.reason));
  it.decisionNotified = status;
  persist('user_preferences');
  fetch(MAKE_ITINERARY_DECISION_WEBHOOK_URL, { method:'POST', body:form }).catch(()=>{});
}
function clearItineraryReviewGuards(){
  itineraryReviewActiveId = null;
  itineraryReviewCancelArmed = false;
  if(itineraryReviewArmTimer){ clearTimeout(itineraryReviewArmTimer); itineraryReviewArmTimer = null; }
}
function abandonItineraryReview(id){
  /* Only the X button uses this — and only after the sheet has been open briefly. */
  if(!itineraryReviewCancelArmed || itineraryReviewActiveId !== id) return;
  const it=(store.itineraries||[]).find(x=>x.id===id);
  if(it && !it.showId) notifyItineraryDecision(it, 'cancelled', { reason:'closed' });
  clearItineraryReviewGuards();
  closeSheet(true, { noReturn:true });
  renderView();
  toast('Upload cancelled','x');
}
function discardItineraryReview(id){
  /* Explicit discard always notifies Make. */
  openSheetReact('Discard upload?', 'itinerary.discard', { id });
  const scrim = $('#scrim');
  if(scrim) scrim.onclick = null;
  setTimeout(()=>{
    const b=document.getElementById('itn-discard-yes');
    if(b) b.onclick=()=>{
      const it=(store.itineraries||[]).find(x=>x.id===id);
      if(it) notifyItineraryDecision(it, 'cancelled', { reason:'discarded' });
      clearItineraryReviewGuards();
      store.itineraries=(store.itineraries||[]).filter(x=>x.id!==id);
      persist('user_preferences');
      closeSheet(true, { noReturn:true });
      renderView();
      toast('Upload discarded','trash');
    };
  }, 50);
}
async function saveItineraryReview(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  const eventName=val('itn-rev-event-name');
  const venue=val('itn-rev-venue');
  const date=rawVal('itn-rev-date');
  if(!eventName && !venue){ toast('Add an event name or venue name','x'); return; }
  if(!date){ toast('Add a show date','x'); return; }
  const basics={
    eventName,
    venue,
    venueAddr: val('itn-rev-addr'),
    venueAddr2: val('itn-rev-addr2'),
    venueRegion: val('itn-rev-region'),
    venuePostcode: val('itn-rev-postcode'),
    city: val('itn-rev-city'),
    country: val('itn-rev-country'),
    date,
    arrival: rawVal('itn-rev-arr'),
    setTime: rawVal('itn-rev-set'),
    endTime: rawVal('itn-rev-end'),
    artist: val('itn-rev-artist') || store.settings.artistName,
    status: (typeof getSeg==='function' ? getSeg('itn-rev-status') : '') || 'confirmed',
    content: val('itn-rev-content'),
    notes: val('itn-rev-notes'),
    color: (typeof getCat==='function' ? getCat('itn-rev-cat') : '') || 'purple'
  };
  const f=it.scanFields||{};
  const btn=$('#itn-rev-save'); if(btn) btn.disabled=true;

  /* Frontend mints the only show UUID — Make and Supabase must reuse this. */
  const ev=blankShowFromBasics(basics);
  store.events.push(ev);
  const filled=applyScanToShow(ev, f);
  const showId=ev.id;
  it.source='New show from itinerary';
  it.showId=showId;
  it.date=date;
  clearItineraryReviewGuards();
  persist('shows', showId);
  persist('user_preferences');
  closeSheet(true, { noReturn:true });
  renderView();
  openView('event', showId);
  const extra = filled.length ? (' · filled '+filled.join(', ')) : '';
  toast('Show created'+extra, 'check');

  itineraryFullUploadByShow[showId] = {
    status:'uploading',
    message:'Saving show to the cloud…'
  };
  refreshIfViewingShow(showId);

  let synced = false;
  try{
    if(typeof ensureShowSyncedToCloud === 'function'){
      synced = await ensureShowSyncedToCloud(showId);
    } else if(typeof pushShowNow === 'function'){
      synced = !!(await pushShowNow(showId));
    }
  }catch(err){
    console.error('saveItineraryReview sync', err);
    synced = false;
  }

  if(!synced){
    itineraryFullUploadByShow[showId] = {
      status:'error',
      message:'Couldn’t save this show to the cloud yet. Retry when you’re online — Make will use the same show ID.'
    };
    refreshIfViewingShow(showId);
    toast('Show saved on this device — cloud sync needed before Make', 'x');
    return;
  }

  /* Only tell Make after the row exists with this exact id. */
  notifyItineraryDecision(it, 'confirmed', { show_id: showId });
  startItineraryFullUpload(id, showId);
}
function itineraryFullUploadBanner(showId){
  const st = itineraryFullUploadByShow[showId];
  if(!st) return '';
  if(st.status === 'uploading'){
    const msg = st.message
      || 'Uploading itinerary details… Make is filling hotel, travel and the rest into this show.';
    return `<div class="hint" style="text-align:left;margin:0 0 14px;padding:12px 14px;border-radius:12px;background:rgba(99,102,241,.12);color:var(--text-1);font-weight:650">
      ${esc(msg)}
    </div>`;
  }
  if(st.status === 'done'){
    return `<div class="hint" style="text-align:left;margin:0 0 14px;padding:12px 14px;border-radius:12px;background:rgba(34,197,94,.12);color:var(--text-1);font-weight:650">
      ${esc(st.message || 'Itinerary details uploaded successfully.')}
    </div>`;
  }
  if(st.status === 'error'){
    return `<div class="hint" style="text-align:left;margin:0 0 14px;padding:12px 14px;border-radius:12px;background:rgba(239,68,68,.12);color:var(--text-1);font-weight:650">
      ${esc(st.message || 'Couldn’t finish itinerary upload.')}
      <button type="button" class="link-btn" style="display:inline;margin-left:8px" onclick="retryItineraryFullUpload('${showId}')">Retry</button>
    </div>`;
  }
  return '';
}
function refreshIfViewingShow(showId){
  if(overlay && overlay.type === 'event' && overlay.id === showId && typeof renderView === 'function') renderView();
}
async function startItineraryFullUpload(itineraryId, showId){
  const it=(store.itineraries||[]).find(x=>x.id===itineraryId);
  if(!it || !showId) return;
  it.showId = showId;
  itineraryFullUploadByShow[showId] = {
    status:'uploading',
    message:'Uploading itinerary details… Make is filling hotel, travel and the rest into this show.'
  };
  refreshIfViewingShow(showId);
  try{
    const result = await postItineraryFileToMake(it, { stage:'full' });
    if(result.error){
      itineraryFullUploadByShow[showId] = {
        status:'error',
        message: itineraryScanErrorToast(result.error)
      };
      refreshIfViewingShow(showId);
      toast(itineraryScanErrorToast(result.error), 'x');
      return;
    }
    const payload = result.payload || {};
    const ok = payload.ok === true || payload.ok === 'true' || payload.success === true || !('ok' in payload && payload.ok === false);
    const message = payload.message || payload.status || (ok
      ? 'Itinerary details uploaded successfully.'
      : 'Make finished but reported a problem.');
    if(!ok){
      itineraryFullUploadByShow[showId] = { status:'error', message:String(message) };
      refreshIfViewingShow(showId);
      toast(String(message), 'x');
      return;
    }
    itineraryFullUploadByShow[showId] = { status:'done', message:String(message) };
    it.fullUploadDone = true;
    persist('user_preferences');
    if(typeof currentOrgId !== 'undefined' && currentOrgId && typeof loadFromSupabase === 'function'){
      try{ await loadFromSupabase(currentOrgId); }catch(_){}
    }
    refreshIfViewingShow(showId);
    toast(String(message), 'check');
    setTimeout(()=>{
      if(itineraryFullUploadByShow[showId]?.status === 'done'){
        delete itineraryFullUploadByShow[showId];
        refreshIfViewingShow(showId);
      }
    }, 8000);
  }catch(err){
    itineraryFullUploadByShow[showId] = {
      status:'error',
      message: 'Couldn’t reach Make — see browser console'
    };
    refreshIfViewingShow(showId);
    toast('Couldn’t reach Make for full upload', 'x');
  }
}
async function retryItineraryFullUpload(showId){
  const it=(store.itineraries||[]).find(x=>x.showId===showId);
  if(!it){ toast('Original itinerary not found','x'); return; }
  itineraryFullUploadByShow[showId] = {
    status:'uploading',
    message:'Saving show to the cloud…'
  };
  refreshIfViewingShow(showId);
  let synced = false;
  try{
    if(typeof ensureShowSyncedToCloud === 'function'){
      synced = await ensureShowSyncedToCloud(showId);
    } else if(typeof pushShowNow === 'function'){
      synced = !!(await pushShowNow(showId));
    }
  }catch(err){
    console.error('retryItineraryFullUpload sync', err);
  }
  if(!synced){
    itineraryFullUploadByShow[showId] = {
      status:'error',
      message:'Couldn’t save this show to the cloud yet. Retry when you’re online.'
    };
    refreshIfViewingShow(showId);
    toast('Cloud sync needed before Make', 'x');
    return;
  }
  if(it.decisionNotified !== 'confirmed'){
    notifyItineraryDecision(it, 'confirmed', { show_id: showId });
  }
  startItineraryFullUpload(it.id, showId);
}
function sheetItinerary(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  const shows = store.events.filter(e=>(e.kind||'show')==='show').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const thumbs=(it.imgs||[]).map(im=>`<div class="thumb" ${im.kind==='image'?`onclick="openViewer('${im.data}')"`:''}>${im.kind==='image'?`<img src="${im.data}">`:`<div class="pdf">${ICON.file(26)}<span>${esc(im.name||'PDF')}</span></div>`}<div class="del-badge" onclick="event.stopPropagation();delItinShot('${id}','${im.id}')">${ICON.x(13)}</div></div>`).join('');
  const linked = it.showId ? sel.event(it.showId) : null;
  openSheetReact('Itinerary details', 'itinerary.details', { id, item: it });
}
function saveItinerary(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  it.source=val('itn-src'); it.date=rawVal('itn-date'); it.time=rawVal('itn-time'); it.showId=rawVal('itn-show'); it.note=val('itn-note');
  persist('user_preferences'); closeSheet(); renderView(); toast('Itinerary saved','check');
}
function addItineraryShots(id,input){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  readFiles(input, imgs=>{ if(imgs.length){ it.imgs=(it.imgs||[]).concat(imgs); persist('user_preferences'); imgs.forEach(im=>hostImg(im,'itinerary','itinerary')); openItineraryEntry(id); } });
}
/* Fill ONLY missing show fields from a scan result. */
function applyScanToShow(e, f){
  if(!e || !f) return [];
  const filled=[];
  if(!e.eventName && (f.eventName||f.event_name||f.EventName)) {
    e.eventName = f.eventName||f.event_name||f.EventName;
    filled.push('event name');
  }
  if(!e.venue    && (f.venue||f.venueName)) { e.venue=f.venue||f.venueName; filled.push('venue'); }
  const scannedDate=normalizeScanDate(f.date);
  if(!e.date     && scannedDate)     { e.date=scannedDate;            filled.push('date'); }
  if(!e.setTime  && f.setTime)       { e.setTime=normalizeScanTime(f.setTime)||f.setTime; filled.push('set time'); }
  if(!e.endTime  && f.endTime)       { e.endTime=normalizeScanTime(f.endTime)||f.endTime; filled.push('end time'); }
  if(!e.arrival  && f.arrival)       { e.arrival=normalizeScanTime(f.arrival)||f.arrival; filled.push('arrival'); }
  if(!e.venueAddr && f.venueAddress) { e.venueAddr=f.venueAddress;    filled.push('venue address'); }
  if(!e.city     && f.city)          { e.city=f.city;                 filled.push('city'); }
  if(!e.country  && f.country)       { e.country=f.country;           filled.push('country'); }
  const a = e.advance || (e.advance = {});
  const advIf=(key,val,label)=>{ if(!a[key] && val){ a[key]=val; filled.push(label); } };
  advIf('soundcheck',   f.soundcheck,   'sound check');
  advIf('curfew',       f.curfew,       'curfew');
  advIf('access',       f.doors,        'doors');
  advIf('stage',        f.stage,        'stage');
  advIf('guestlist',    f.guestlist,    'guest list');
  advIf('catering',     f.catering,     'catering');
  advIf('dressingRoom', f.dressingRoom, 'dressing room');
  advIf('parking',      f.parking,      'parking');
  advIf('wifi',         f.wifi,         'wifi');
  advIf('remarks',      f.remarks,      'remarks');
  if(!e.hotel && (f.hotelName || f.hotelAddress)){
    e.hotel={ name:f.hotelName||'', address:f.hotelAddress||'', checkin:f.hotelCheckin||'', checkout:'', conf:'', notes:'' };
    filled.push('hotel');
  }
  if(!showDrivers(e).length && (f.driverName || f.driverPhone)){
    showDrivers(e);
    e.drivers.push({ id:uid('drv'), journey:'', name:f.driverName||'', phone:f.driverPhone||'', whatsapp:'', pickup:'', notes:'' });
    e.driver = e.drivers[0];
    filled.push('transport');
  }
  return filled;
}
function scanBtnReset(){ const b=$('#itn-scan'); if(b){ b.disabled=false; b.innerHTML=ICON.checkList(16)+' Scan &amp; fill missing details'; } }
async function scanItinerary(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  const pick = rawVal('itn-show');
  const showId = pick || it.showId;
  if(!showId){ toast('Pick a show first','x'); return; }
  if(pick && pick!==it.showId){ it.showId=pick; }
  const e=sel.event(showId); if(!e){ toast('Show not found','x'); return; }
  const btn=$('#itn-scan'); if(btn){ btn.disabled=true; btn.textContent='Scanning…'; }
  toast('Scanning itinerary…','image');
  try{
    const result = await fetchItineraryScanFields(it);
    if(result.error==='sign_in'){ toast('Sign in to scan itineraries','x'); scanBtnReset(); return; }
    if(result.error==='no_image'){ toast('Add a screenshot first','x'); scanBtnReset(); return; }
    if(result.error){ toast('Scan failed'+(result.error?': '+result.error:''),'x'); scanBtnReset(); return; }
    const f=result.fields||{};
    it.scanFields=f;
    persist('user_preferences');
    if(!Object.keys(f).length){ toast('Nothing readable found','x'); scanBtnReset(); return; }
    const filled=applyScanToShow(e, f);
    persist('shows', e.id);
    if(typeof pushShowNow === 'function') pushShowNow(e.id);
    if(filled.length){ closeSheet(); renderView(); toast('Filled: '+filled.join(', '),'check'); }
    else { toast('Show already has this info','check'); scanBtnReset(); }
  }catch(err){ toast('Scan error','x'); scanBtnReset(); }
}
function delItinShot(id,imid){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(it){ it.imgs=(it.imgs||[]).filter(im=>im.id!==imid); } persist('user_preferences'); openItineraryEntry(id);
}
function delItinerary(id){
  confirmSheet('Delete submission?','','Delete',()=>{
    const it=(store.itineraries||[]).find(x=>x.id===id);
    if(it && !it.showId) notifyItineraryDecision(it, 'cancelled', { reason:'deleted' });
    if(itineraryReviewActiveId === id) itineraryReviewActiveId = null;
    store.itineraries=(store.itineraries||[]).filter(x=>x.id!==id);
    persist('user_preferences');
    closeSheet(true, { noReturn:true });
    renderView();
    toast('Deleted','trash');
  }, true);
}
function uploadAttachment(eid,input){ toast('Uploading…','image'); readFile(input, att=>{ const e=sel.event(eid); (e.attachments=e.attachments||[]).push(att); persist('shows', eid); softRender(); toast('Attached','check'); hostImg(att, eid, 'attachment'); }); }
function delAttachment(eid,aid){ const e=sel.event(eid); e.attachments=e.attachments.filter(a=>a.id!==aid); persist('shows', eid); softRender(); toast('Removed','trash'); }
function uploadPass(eid,fid,input,passengerId){ toast('Uploading pass…','ticket'); readFile(input, att=>{ attachPassToShowFlight(eid, fid, att, passengerId).then(ok=>{ if(ok) toast('Boarding pass added','check'); else toast('Could not attach pass','x'); }); }); }
function delFlightPass(eid,fid,pid,passengerId){
  const e=sel.event(eid);
  const f=e&&e.flights&&e.flights.find(x=>x.id===fid);
  if(!f) return;
  if(typeof ensureFlightPassengers==='function') ensureFlightPassengers(f);
  if(passengerId){
    const pax=(f.passengers||[]).find(p=>p.id===passengerId);
    if(pax&&pax.passes) pax.passes=pax.passes.filter(p=>p.id!==pid);
  } else {
    (f.passengers||[]).forEach(pax=>{ if(pax.passes) pax.passes=pax.passes.filter(p=>p.id!==pid); });
    if(f.passes) f.passes=f.passes.filter(p=>p.id!==pid);
  }
  f.passes = [];
  persist('shows', eid);
  if(typeof pushShowNow==='function') pushShowNow(eid);
  renderView();
  toast('Boarding pass removed','trash');
}
function delItemPass(itemId, passId){
  const it=store.events.find(x=>x.id===itemId);
  if(!it || !it.passes) return;
  if(passId) it.passes=it.passes.filter(p=>p.id!==passId);
  else it.passes=[];
  persist('shows', itemId || eid); softRender(); toast('Boarding pass removed','trash');
}
function removeHotel(eid){ const e=sel.event(eid); if(e){ e.hotel=null; } persist('shows', eid); if(typeof pushShowNow==='function') pushShowNow(eid); closeSheet(); softRender(); toast('Hotel removed','trash'); }
function removeDriver(eid, idx){ const e=sel.event(eid); if(e){ const list=showDrivers(e); if(idx!=null) list.splice(idx,1); e.driver=list.find(d=>!d.noGround)||null; } persist('shows', eid); closeSheet(); softRender(); toast('Removed','trash'); }
function removePromoter(eid){ const e=sel.event(eid); if(e){ e.promoter=null; } persist('shows', eid); closeSheet(); softRender(); toast('Contact removed','trash'); }
/* ============================================================
   Menus + delete
   ============================================================ */
function eventMenu(eid){
  openSheetReact('Edit show', 'menu.event', { eid }, { full: true, clearReturn: true });
}
function tripMenu(tid){
  openSheetReact('Trip options', 'menu.trip', { tid });
}
function confirmDeleteEvent(eid){ confirmSheet('Delete show?','This removes the show and its details permanently.','Delete',()=>{ store.events=store.events.filter(e=>e.id!==eid); persist('shows', eid); back(); toast('Show deleted','trash'); }, true); }
function confirmDeleteTrip(tid){ confirmSheet('Delete trip?','Shows in this trip are kept, but the trip itself is removed.','Delete trip',()=>{ store.events.forEach(e=>{ if(e.tripId===tid) e.tripId=null; }); if(store.activeTripId===tid) store.activeTripId=null; store.trips=store.trips.filter(t=>t.id!==tid); persist('tours', tid); back(); toast('Trip deleted','trash'); }, true); }
function confirmDeleteIdea(iid){ confirmSheet('Delete idea?','This can\'t be undone.','Delete',()=>{ store.ideas=store.ideas.filter(x=>x.id!==iid); if(typeof deleteIdeaNow === 'function') deleteIdeaNow(iid); else persist('ideas', iid); back(); toast('Idea deleted','trash'); }, true); }

/* ============================================================
   Settings
   ============================================================ */
function openSettings(){ openView('settings'); }
/* ---------- SETTINGS (full section) ---------- */
function viewSettings(){
  const s=store.settings; const sec=s.security;
  const scopeLabel = !secOn()?'Off' : sec.scope==='app'?'Whole app':'Finance only';
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} ${overlayBackLabel()}</button>
    <div style="font-size:16px;font-weight:700">Settings</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">
    ${pageIntro('settings', 'Set up Operate', 'Add your name, home airport (ends a tour when you fly back), and optional cloud sync under Account. These settings shape how Home and Tours work.')}
    <div class="set-title">Account type</div>
    <div class="acct-grid">
      ${Object.entries(ACCOUNT_TYPES).map(([k,v])=>`
        <button class="acct ${s.accountType===k?'on':''}" onclick="setAccountType('${k}')">
          <div class="ic">${ICON[v.icon](20)}</div><b>${v.label}</b><span>${v.desc}</span>
        </button>`).join('')}
    </div>

    <div class="set-title">Profile</div>
    <div class="set-group">
      <div class="set-row tap" onclick="editProfileName()"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.user(17)}</div><div class="body"><b>${esc(s.artistName==='You'?'Your name':s.artistName)}</b><span>${acct().label}</span></div><div class="trail">Edit ${ICON.chevR(15)}</div></div>
      <label class="set-row tap"><div class="ic" style="background:var(--pink);color:#fff">${ICON.camera(17)}</div><div class="body"><b>Home header photo</b><span>${s.homeHeader?'Custom photo set':'Add a background image (approx. 1600×900)'}</span></div><div class="trail">${s.homeHeader?'Change':'Add'} ${ICON.chevR(15)}</div><input type="file" accept="image/*" style="display:none" onchange="uploadHomeHeader(this)"></label>
      ${s.homeHeader?`<div class="set-row tap" onclick="removeHomeHeader()"><div class="ic" style="background:var(--red-soft);color:var(--red)">${ICON.trash(17)}</div><div class="body"><b style="color:var(--red)">Remove header photo</b><span>Back to the plain header</span></div><div class="trail">${ICON.chevR(15)}</div></div>`:''}
    </div>

    <div class="set-title">Security</div>
    <div class="set-group">
      <div class="set-row"><div class="ic" style="background:${secOn()?'var(--green-soft)':'var(--card-2)'};color:${secOn()?'var(--green)':'var(--text-2)'}">${ICON.lock(17)}</div>
        <div class="body"><b>Passcode lock</b><span>${secOn()?'On · '+scopeLabel:'Protect the app with a passcode'}</span></div>
        <button class="toggle ${secOn()?'on':''}" onclick="toggleSecurity()"><i></i></button>
      </div>
      ${secOn()?`
      <div class="set-row"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.shield(17)}</div>
        <div class="body"><b>What to lock</b></div>
        <div class="trail"></div>
      </div>
      <div class="set-row" style="padding-top:0">
        <div class="seg" style="width:100%">
          <button class="${sec.scope==='finance'?'on':''}" onclick="setLockScope('finance')">Finance only</button>
          <button class="${sec.scope==='app'?'on':''}" onclick="setLockScope('app')">Whole app</button>
        </div>
      </div>
      <div class="set-row"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.face(17)}</div>
        <div class="body"><b>Face ID / biometrics</b><span>Use device unlock, fall back to passcode</span></div>
        <button class="toggle ${sec.biometric?'on':''}" onclick="toggleBiometric()"><i></i></button>
      </div>
      <div class="set-row tap" onclick="changePasscode()"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.unlock(17)}</div><div class="body"><b>Change passcode</b></div><div class="trail">${ICON.chevR(15)}</div></div>
      `:''}
    </div>

    <div class="set-title">Display</div>
    <div class="set-group">
      <div class="set-row">
        <div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.chevL(17)}</div>
        <div class="body"><b>Hide sidebar</b><span>Switch to bottom tabs on desktop</span></div>
        <button class="toggle ${isSidebarHidden()?'on':''}" onclick="toggleSidebar()"><i></i></button>
      </div>
    </div>

    <div class="set-title">Money</div>
    <div class="set-group">
      <div class="set-row tap" onclick="openView('finance')"><div class="ic" style="background:var(--green-soft);color:var(--green)">${ICON.coins(17)}</div><div class="body"><b>Finance dashboard</b><span>${secOn()&&sec.scope!=='off'?'Protected':'Open'}</span></div><div class="trail">${ICON.chevR(15)}</div></div>
      <div class="set-row tap" onclick="sheetCurrency()"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.globe(17)}</div><div class="body"><b>Base currency & rates</b><span>${s.baseCurrency} · ${Object.keys(s.fx).length} currencies</span></div><div class="trail">${ICON.chevR(15)}</div></div>
      <div class="set-row tap" onclick="openBilling()"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.wallet2(17)}</div><div class="body"><b>Billing & invoicing</b><span>${s.billing.name?esc(s.billing.name):'Set up for invoices'}</span></div><div class="trail">${ICON.chevR(15)}</div></div>
    </div>

    <div class="set-title">Touring</div>
    <div class="set-group">
      <div class="set-row tap" onclick="editHomeAirport()"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.planeUp(17)}</div><div class="body"><b>Home airport</b><span>Leaving starts a tour · returning ends it</span></div><div class="trail">${esc(s.homeAirport||'AMS')} ${ICON.chevR(15)}</div></div>
      <div class="set-row tap" onclick="openView('stats')"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.trend(17)}</div><div class="body"><b>Tour stats</b><span>Flight time, days away & more</span></div><div class="trail">${ICON.chevR(15)}</div></div>
      <div class="set-row tap" onclick="sheetPacking()"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.bag(17)}</div><div class="body"><b>Default packing list</b><span>${(s.packingTemplate||[]).length} items</span></div><div class="trail">${ICON.chevR(15)}</div></div>
    </div>

    <div class="set-title">Account</div>
    <div class="set-group">
      <div class="set-row tap" onclick="sheetAccount()"><div class="ic" style="background:${syncActive()?'var(--green-soft)':'var(--card-2)'};color:${syncActive()?'var(--green)':'var(--text-2)'}">${ICON.globe(17)}</div>
        <div class="body"><b>${isDevHardwireMode() ? 'Dev mode' : (authUser ? esc(authUser.email) : (isSyncEnabled() ? 'Sign in to sync' : (isAuthRequired() ? 'Sign in & sync' : 'Local only')))}</b><span id="sync-row-sub">${syncStatusLabel()}</span></div>
        <div class="trail">Manage ${ICON.chevR(15)}</div></div>
    </div>

    <div class="set-title">Data</div>
    <div class="set-group">
      <div class="set-row tap" onclick="exportData()"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.file(17)}</div><div class="body"><b>Export my data</b><span>Download a backup of everything you've entered</span></div><div class="trail">${ICON.chevR(15)}</div></div>
      <label class="set-row tap"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.archive(17)}</div><div class="body"><b>Restore from backup</b><span>Import a backup file to bring your data here</span></div><div class="trail">${ICON.chevR(15)}</div><input type="file" accept="application/json,.json" style="display:none" onchange="importData(this)"></label>
      <div class="set-row tap" onclick="restoreMissingLogistics()"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.map(17)}</div><div class="body"><b>Restore journey details</b><span>Re-fill routes, hotels &amp; flight labels from backup or tour catalog</span></div><div class="trail">${ICON.chevR(15)}</div></div>
      <div class="set-row tap" onclick="confirmReset()"><div class="ic" style="background:var(--red-soft);color:var(--red)">${ICON.trash(17)}</div><div class="body"><b style="color:var(--red)">Reset all data</b><span>Reload the imported schedule</span></div><div class="trail">${ICON.chevR(15)}</div></div>
    </div>
    <div class="hint">Operate · local-first with optional cloud sync via Supabase.</div>
    <div class="spacer"></div>
  </div>`;
}
function overlayBackLabel(){ return store.tab==='home'?'Home':(store.tab.charAt(0).toUpperCase()+store.tab.slice(1)); }

/* ---------- STATS (hidden in settings) ---------- */
function computeStats(){
  const shows = sel.events();
  const travel = store.events.filter(e=>e.kind==='travel');
  const flights = travel.filter(e=>(e.icon||'plane')==='plane');
  // flight time: sum (end-start), handle overnight (+24h). Rough — ignores timezones.
  let flightMins=0;
  flights.forEach(f=>{ if(f.start&&f.end){ const [h1,m1]=f.start.split(':').map(Number),[h2,m2]=f.end.split(':').map(Number); let d=(h2*60+m2)-(h1*60+m1); if(d<0)d+=1440; if(d>0&&d<20*60) flightMins+=d; } });
  const rr = runs();
  let daysAway=0; rr.forEach(r=>{ daysAway += (dayIdx(r.end)-dayIdx(r.start)+1); });
  const cities = [...new Set(shows.map(s=>s.city).filter(Boolean))];
  // fees
  const s = money.summary(shows);
  // busiest month
  const bym={}; shows.forEach(sh=>{ const d=parseDT(sh.date); if(d){ const k=MONTHS[d.getMonth()]+' '+d.getFullYear(); bym[k]=(bym[k]||0)+1; } });
  let busiest='—',bmax=0; Object.entries(bym).forEach(([k,v])=>{ if(v>bmax){bmax=v;busiest=k;} });
  const today=new Date(); today.setHours(0,0,0,0);
  const upcoming = shows.filter(e=>parseDT(e.date)>=today).length;
  return { shows:shows.length, upcoming, past:shows.length-upcoming, flights:flights.length,
    flightHrs:Math.round(flightMins/60), flightDays:(flightMins/1440).toFixed(1),
    tours:rr.length, daysAway, cities:cities.length, hotels:store.events.filter(e=>e.kind==='stay').length,
    grossBase:s.grossBase, netBase:s.netBase, busiest, busiestN:bmax,
    year: computeYearStats() };
}
/* Headline "this year" figures for the stats hero grid: distance flown,
   countries played, hours on stage, ground transfers. Scoped to the current
   calendar year, falling back to all-time if this year has no shows yet. */
function computeYearStats(){
  const allShows = sel.events();
  const yr = new Date().getFullYear();
  const inYr = d => (d||'').slice(0,4) === String(yr);
  const scoped = allShows.some(s=>inYr(s.date));
  const keep = d => scoped ? inYr(d) : true;
  const shows = allShows.filter(s=>keep(s.date));

  // Countries played — collected as ISO codes so a country reached by flight and
  // named on a show only counts once. Falls back to inferring the country from
  // the show's airport codes when the country field was left blank.
  const isoSet=new Set();          // countries we can flag
  const otherNames=new Set();      // named countries with no ISO/flag mapping

  // Kilometres flown — great-circle sum of every flight leg with known airports.
  let km=0, unknown=0, flights=0, longest={km:0,from:'',to:''};
  const airportSet=new Set();
  const addLeg=(from,to)=>{
    flights++;
    if(airportLL(from)) airportSet.add((from||'').toUpperCase());
    if(airportLL(to)) airportSet.add((to||'').toUpperCase());
    const a=airportLL(from), b=airportLL(to);
    if(a&&b){ const d=haversineKm(a,b); km+=d; if(d>longest.km) longest={km:d,from:(from||'').toUpperCase(),to:(to||'').toUpperCase()}; }
    else if(from||to) unknown++;
  };
  store.events.forEach(e=>{
    if(e.kind==='travel' && (e.icon||'plane')==='plane' && (e.from||e.to) && keep(e.date)) addLeg(e.from,e.to);
    if((e.kind||'show')==='show' && Array.isArray(e.flights) && keep(e.date)) e.flights.forEach(f=>{ if(f.from||f.to) addLeg(f.from,f.to); });
  });

  // Countries PLAYED = where the shows are, not every airport touched. Use the
  // country field; if blank, infer from where the show's flight lands (its
  // arrival airport), checking embedded flights and linked travel legs.
  shows.forEach(s=>{
    if(s.country){ const cc=countryISO(s.country); if(cc) isoSet.add(cc); else otherNames.add(s.country.trim().toLowerCase()); return; }
    let cc=null;
    (s.flights||[]).forEach(f=>{ cc = cc || airportCC(f.to) || airportCC(f.from); });
    if(!cc) store.events.forEach(e=>{ if(e.kind==='travel' && (e.icon||'plane')==='plane' && e.showId===s.id) cc = cc || airportCC(e.to) || airportCC(e.from); });
    if(cc) isoSet.add(cc);
  });
  const flags=[...isoSet].map(flagEmoji).filter(Boolean);

  // Hours played — sum of set durations (handles after-midnight ends).
  let stageMins=0;
  shows.forEach(s=>{ if(s.setTime&&s.endTime){ const [h1,m1]=s.setTime.split(':').map(Number),[h2,m2]=s.endTime.split(':').map(Number);
    if([h1,m1,h2,m2].every(n=>!isNaN(n))){ let d=(h2*60+m2)-(h1*60+m1); if(d<0) d+=1440; if(d>0&&d<12*60) stageMins+=d; } } });

  // Top city & busiest month (for the year-in-review card).
  const cityCount={}, monthCount={};
  shows.forEach(s=>{ if(s.city) cityCount[s.city]=(cityCount[s.city]||0)+1; const d=parseDT(s.date); if(d){ const k=MONTHS[d.getMonth()]; monthCount[k]=(monthCount[k]||0)+1; } });
  let topCity='', tc=0; Object.entries(cityCount).forEach(([k,v])=>{ if(v>tc){ tc=v; topCity=k; } });
  let busiestMonth='', bm=0; Object.entries(monthCount).forEach(([k,v])=>{ if(v>bm){ bm=v; busiestMonth=k; } });

  // Extra counters for the year-in-review.
  const citySet=new Set(); shows.forEach(s=>{ if(s.city) citySet.add(s.city.trim().toLowerCase()); });
  let nights=0; const dateSet=new Set();
  shows.forEach(s=>{ if(s.date) dateSet.add(s.date); });
  store.events.forEach(e=>{ if((e.kind==='travel'||e.kind==='stay') && keep(e.date)){ if(e.date) dateSet.add(e.date); if(e.kind==='stay') nights++; } });
  let tours=0; try{ (runs()||[]).forEach(r=>{ if(!scoped || String(r.start||'').slice(0,4)===String(yr) || String(r.end||'').slice(0,4)===String(yr)) tours++; }); }catch(e){}

  return {
    scopeLabel: scoped ? 'This year' : 'All time',
    year: yr,
    shows: shows.length,
    km: Math.round(km), unknownLegs: unknown,
    flights, airports: airportSet.size,
    cities: citySet.size,
    nights, daysOnRoad: dateSet.size, tours,
    longest,
    countries: isoSet.size + otherNames.size, flags,
    stageMins, stageHrs: Math.round(stageMins/60),
    topCity, topCityN: tc, busiestMonth, busiestMonthN: bm
  };
}
function statTile(label, value, sub, color){
  return `<div class="card" style="padding:15px 16px"><div style="font-size:12px;color:${color||'var(--text-3)'};font-weight:700;text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="font-size:26px;font-weight:850;letter-spacing:-0.02em;margin-top:4px">${value}</div>${sub?`<div style="font-size:12px;color:var(--text-3);font-weight:600;margin-top:1px">${sub}</div>`:''}</div>`;
}
function viewStats(){
  const st=computeStats();
  const y=st.year||{};
  const EARTH=40075;
  const kmVal = y.km>0 ? y.km.toLocaleString()+' km' : '—';
  const kmSub = y.km>=EARTH ? `≈ ${(y.km/EARTH).toFixed(1)}× around the world`
    : y.km>0 ? `≈ ${Math.max(1,Math.round(y.km/EARTH*100))}% around the world`
    : 'add flights to see';
  const stageVal = y.stageHrs>0 ? y.stageHrs+'h' : '—';
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Settings</button>
    <div style="font-size:16px;font-weight:700">Tour stats</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">
    <div class="hero" style="background:linear-gradient(155deg,#241a45,#191531 55%,#141418)">
      <div class="hero-label" style="color:var(--accent-2)">${ICON.trend(14)} This schedule</div>
      <div class="hero-venue" style="font-size:34px">${st.shows} shows</div>
      <div class="hero-city">${st.upcoming} upcoming · ${st.cities} cities · ${st.tours} tours</div>
    </div>
    <div class="section">
      <div class="section-head" style="margin-bottom:10px">
        <div class="section-title">Snapshot</div>
        <button type="button" class="section-link" onclick="openView('wrapped')">Year in review ${ICON.chevR(13)}</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1 / -1">${statTile('Kilometres flown', kmVal, kmSub, 'var(--blue)')}</div>
        ${statTile('Hours played', stageVal, 'behind the decks', 'var(--accent-2)')}
        ${statTile('Flight time', st.flightHrs+'h', 'approx · ~'+st.flightDays+' days in the air', 'var(--blue)')}
        ${statTile('Days away', st.daysAway, 'across '+st.tours+' tours', 'var(--green)')}
        ${statTile('Flights', st.flights, st.hotels+' hotel stays', 'var(--accent-2)')}
        ${statTile('Cities', st.cities, 'unique', 'var(--pink)')}
        ${statTile('Busiest month', st.busiestN, esc(st.busiest), 'var(--orange)')}
      </div>
    </div>
    <div class="spacer"></div>
  </div>`;
}
function setAccountType(k){ store.settings.accountType=k; haptic(); persist('settings'); renderView(); toast(ACCOUNT_TYPES[k].label,'check'); }
function editHomeAirport(){
  openSheetReact('Home airport', 'settings.homeAirport', { value: store.settings.homeAirport });
  setTimeout(()=>{const i=document.getElementById('ha-code');if(i)i.focus();},300);
}
function editProfileName(){
  openSheetReact('Your name', 'settings.profileName', { value: store.settings.artistName === 'You' ? '' : store.settings.artistName });
  setTimeout(()=>{const i=document.getElementById('pf-name');if(i)i.focus();},300);
}
function uploadHomeHeader(input){ toast('Uploading photo…','image'); readFile(input, att=>{ if(att.kind!=='image'){ toast('Pick an image','x'); return; } store.settings.homeHeader=att.data; persist('settings'); persist('user_preferences'); renderView(); toast('Header photo set','check');
  if(syncActive() && att.data.startsWith('data:')) uploadFileDataUrl(att.data,'header','header','home_header').then(({path,url})=>{ store.settings._homeHeaderPath=path; store.settings.homeHeader=url; persist('settings'); persist('user_preferences'); renderView(); }).catch(()=>{}); }); }
function removeHomeHeader(){ confirmSheet('Remove header photo?','','Remove',()=>{ store.settings.homeHeader=null; persist('settings'); persist('user_preferences'); closeSheet(); renderView(); toast('Removed','trash'); }, true); }
function toggleSecurity(){
  const sec=store.settings.security;
  if(secOn()){ confirmSheet('Turn off passcode?','The app and finance will be accessible without a passcode.','Turn off',()=>{ sec.enabled=false; sec.pin=''; sec.biometric=false; session.appUnlocked=true; session.financeUnlocked=true; persist('settings'); renderView(); toast('Passcode off','unlock'); }); }
  else { pinSetupFirst=null; pinResolve=()=>{ session.appUnlocked=true; session.financeUnlocked=true; renderView(); }; renderLock('setup'); }
}
function setLockScope(sc){ store.settings.security.scope=sc; persist('settings'); if(sc==='finance') session.financeUnlocked=false; renderView(); toast(sc==='app'?'Locking whole app':'Locking finance only','lock'); }
function toggleBiometric(){ const sec=store.settings.security; sec.biometric=!sec.biometric; persist('settings'); renderView(); toast(sec.biometric?'Face ID on':'Face ID off', sec.biometric?'face':'x'); }
function changePasscode(){ pinSetupFirst=null; pinResolve=()=>{ toast('Passcode changed','check'); renderView(); }; renderLock('setup'); }
function sheetCurrency(){
  const s=store.settings;
  openSheetReact('Currency & rates', 'settings.currency', { settings: s });
}
function saveCurrency(){
  const base=rawVal('set-base')||store.settings.baseCurrency;
  withButton($('#set-save'), ()=>{
    document.querySelectorAll('#set-rates input[data-cur]').forEach(inp=>{ const r=parseFloat(inp.value); if(r>0) store.settings.fx[inp.dataset.cur]=r; });
    store.settings.baseCurrency=base; store.settings.baseCurrencyAuto=false; persist('settings'); closeSheet(); renderView();
  }, 'Rates saved');
}
function sheetPacking(){
  const s=store.settings;
  openSheetReact('Default packing list', 'settings.packing', { items: s.packingTemplate || [] });
}
function exportData(){
  const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download='operate-backup.json'; a.click(); URL.revokeObjectURL(url);
  toast('Backup saved','file');
}
function importData(input){
  const f=input.files&&input.files[0]; input.value='';
  if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    let data; try{ data=JSON.parse(r.result); }catch(e){ toast('Not a valid backup','x'); return; }
    if(!data || !Array.isArray(data.events)){ toast('Not an Operate backup','x'); return; }
    confirmSheet('Restore this backup?', 'This replaces the data currently on this device with the backup ('+data.events.length+' events).', 'Restore', ()=>{
      store = data; if(store.tab==null) store.tab='home';
      migrate(); persistAll(); overlay=null; closeSheet(); render();
      if(syncActive()) queueSync();
      toast('Backup restored','check');
    });
  };
  r.onerror=()=>toast('Could not read file','x');
  r.readAsText(f);
}
function confirmReset(){ confirmSheet('Reset everything?','All shows, trips, ideas and notes on this device will be deleted and demo data restored.','Reset all data',()=>{ localStorage.removeItem(DB_KEY); seed(); store.tab='home'; overlay=null; closeSheet(); render(); toast('Reset to demo data','check'); }, true); }

/* ---------- Finance overview (overlay) ---------- */
function viewFinance(){
  const all = sel.events();
  const s = money.summary(all);
  const base = store.settings.baseCurrency;
  const trips = sel.trips();
  const upcoming = sel.upcoming();
  const paidPct = s.netBase? Math.round(s.collectedBase/s.netBase*100):0;
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} ${overlayBackLabel()}</button>
    <div style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:6px">${secOn()&&store.settings.security.scope!=='off'?ICON.lock(13):''} Money</div>
    <button class="header-btn" style="width:36px;height:36px" onclick="${secOn()?`lockFinanceNow()`:`openView('settings')`}">${secOn()?ICON.lock(17):ICON.settings(18)}</button>
  </div></div>
  <div class="screen-pad stagger">
    <div class="subtabs">
      <button class="on">${ICON.trend(15)} Overview</button>
      <button onclick="openView('invoices')">${ICON.receipt(15)} Invoices${store.invoices.length?' ('+store.invoices.length+')':''}</button>
    </div>
    <div class="hero" style="background:linear-gradient(155deg,#0e2f1c,#12241b 55%,#141418)">
      <div class="hero-label" style="color:var(--green)">${ICON.coins(14)} Net booked · ${base}</div>
      <div class="hero-venue" style="font-size:38px">${fmtBase(s.netBase)}</div>
      <div class="hero-city">${fmtBase(s.grossBase)} gross · after commission & costs</div>
      <div class="count-row">
        <div class="count"><div class="count-k">${ICON.check2(12)} Collected</div><div class="count-v" style="font-size:18px">${fmtBase(s.collectedBase)}</div></div>
        <div class="count"><div class="count-k">${ICON.clock(12)} Outstanding</div><div class="count-v" style="font-size:18px">${fmtBase(s.outstandingBase)}</div></div>
        <div class="count"><div class="count-k">${ICON.trend(12)} Upcoming</div><div class="count-v" style="font-size:18px">${fmtBase(s.upcomingBase)}</div></div>
      </div>
      <div class="progress" style="margin-top:14px;background:rgba(0,0,0,0.3)"><i style="width:${paidPct}%;background:var(--green)"></i></div>
      <div style="font-size:12px;color:var(--text-2);margin-top:6px;font-weight:600">${paidPct}% of net collected</div>
    </div>

    <div class="section">
      <div class="btn-row">
        <button class="btn secondary" onclick="openView('invoices')">${ICON.receipt(16)} Invoices${store.invoices.length?' ('+store.invoices.length+')':''}</button>
        <button class="btn secondary" onclick="openView('contacts')">${ICON.users(16)} Contacts</button>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">Breakdown</div></div>
      <div class="card flush">
        <div class="info-line"><div class="ic" style="color:var(--text-2)">${ICON.coins(17)}</div><div class="tx"><div class="k">Gross fees</div><div class="v">${fmtBase(s.grossBase)}</div></div></div>
        <div class="info-line"><div class="ic" style="color:var(--red)">${ICON.user(17)}</div><div class="tx"><div class="k">Agent commission</div><div class="v" style="color:var(--red)">− ${fmtBase(s.commissionBase)}</div></div></div>
        <div class="info-line"><div class="ic" style="color:var(--red)">${ICON.receipt(17)}</div><div class="tx"><div class="k">Expenses</div><div class="v" style="color:var(--red)">− ${fmtBase(s.expensesBase)}</div></div></div>
        <div class="info-line"><div class="ic" style="color:var(--green)">${ICON.wallet2(17)}</div><div class="tx"><div class="k">Net take-home</div><div class="v" style="color:var(--green);font-weight:800">${fmtBase(s.netBase)}</div></div></div>
      </div>
    </div>

    ${Object.keys(s.byCur).length>1?`
    <div class="section">
      <div class="section-head"><div class="section-title">By currency</div></div>
      <div class="card flush">${Object.entries(s.byCur).map(([cur,amt])=>`<div class="info-line"><div class="ic">${ICON.globe(16)}</div><div class="tx"><div class="k">${cur} ${cur!==base?'· ≈ '+fmtBase(toBase(amt,cur)):''}</div><div class="v">${fmtMoney(amt,cur)}</div></div></div>`).join('')}</div>
    </div>`:''}

    <div class="section">
      <div class="section-head"><div class="section-title">Per show</div></div>
      <div class="card flush">${upcoming.map(e=>{ const c=money.eventCalc(e); return `<div class="row" onclick="openView('event','${e.id}')"><div class="ic" style="background:${(c.paid?'var(--green-soft)':'var(--orange-soft)')};color:${c.paid?'var(--green)':'var(--orange)'}">${ICON.money(17)}</div><div class="body"><b>${esc(e.venue)}</b><span>${esc(e.city)} · ${esc(relDay(e.date))} · ${c.paid?'Paid':'Unpaid'}</span></div><div class="trail">${fmtMoney(c.net,c.cur)}${ICON.chevR(15)}</div></div>`; }).join('')||'<div class="hint">No upcoming shows</div>'}</div>
    </div>
    <div class="hint">Net = fee − agent commission − expenses + per diem. Converted at your editable ${base} rates. ABOSS locks this behind Artist PRO — and can't convert currencies at all.</div>
    <div class="spacer"></div>
  </div>`;
}

/* ============================================================
   GLOBAL SEARCH (overlay)
   ============================================================ */
let searchQ='';
Object.defineProperty(window, 'searchQ', {
  get(){ return searchQ; },
  set(v){ searchQ = v; },
  configurable: true
});
function viewSearch(){
  const q=searchQ.trim().toLowerCase();
  let ev=[],tr=[],id=[],nt=[];
  if(q){
    ev=sel.events().filter(e=>(e.venue+' '+e.city+' '+e.country+' '+(e.promoter?e.promoter.name:'')).toLowerCase().includes(q));
    tr=runs().filter(r=>r.title.toLowerCase().includes(q) || r.cities.join(' ').toLowerCase().includes(q));
    id=sel.ideas().filter(i=>i.title.toLowerCase().includes(q));
    nt=sel.notes().filter(n=>(n.title+' '+n.body+' '+(n.folder||'')).toLowerCase().includes(q));
  }
  const total=ev.length+tr.length+id.length+nt.length;
  return `
  <div class="detail-top"><div class="detail-bar" style="padding-right:14px">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)}</button>
    <div class="searchbar" style="flex:1;margin:0"><span class="ic">${ICON.search(18)}</span><input id="search-input" placeholder="Search shows, trips, ideas, notes" value="${esc(searchQ)}" oninput="searchQ=this.value;debouncedSearch()"></div>
  </div></div>
  <div class="screen-pad">
    ${!q?`<div class="empty"><div class="ic">${ICON.search(26)}</div><b>Search everything</b><span>Find any show, trip, idea or note instantly.</span></div>`
      : total===0?`<div class="empty"><div class="ic">${ICON.search(26)}</div><b>No matches for "${esc(searchQ)}"</b></div>`
      : `
      ${ev.length?`<div class="section" style="margin-top:6px"><div class="section-head"><div class="section-title" style="font-size:16px">Shows</div><span class="section-link">${ev.length}</span></div><div class="card flush">${ev.map(eventRow).join('')}</div></div>`:''}
      ${tr.length?`<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px">Tours</div><span class="section-link">${tr.length}</span></div><div class="card flush">${tr.map(runRow).join('')}</div></div>`:''}
      ${id.length?`<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px">Ideas</div><span class="section-link">${id.length}</span></div><div class="idea-grid">${id.map(ideaCard).join('')}</div></div>`:''}
      ${nt.length?`<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px">Notes</div><span class="section-link">${nt.length}</span></div><div class="card flush">${nt.map(noteRowFull).join('')}</div></div>`:''}
      `}
    <div class="spacer"></div>
  </div>`;
}
function openSearch(){ searchQ=''; openView('search'); }
let searchT;
function debouncedSearch(){
  clearTimeout(searchT);
  searchT=setTimeout(()=>{
    if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.isSearchMounted === 'function' && OperateReact.isSearchMounted()){
      if(typeof OperateReact.refreshSearch === 'function') OperateReact.refreshSearch();
      return;
    }
    const el=$('#search-input'); const pos=el?el.selectionStart:0; renderView(); const n=$('#search-input'); if(n){n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){}}
  },140);
}

/* ============================================================
   INVOICING — compliant sequential numbering, multi-currency
   (ABOSS has no unique invoice numbering & no currency conversion)
   ============================================================ */
function nextInvoiceNumber(){
  const s=store.settings; const yr=parseDT(todayISO()).getFullYear();
  const num = `${s.invoicePrefix}-${yr}-${pad(s.invoiceSeq)}`;
  return num;
}
function todayISO(){ const t=new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`; }
function createInvoiceFromEvent(eid){
  const e=sel.event(eid);
  if(store.invoices.some(iv=>iv.eventId===eid)){ const ex=store.invoices.find(iv=>iv.eventId===eid); toast('Invoice already exists','receipt'); openView('invoice', ex.id); return; }
  const f=e.finance||{}; const cur=f.currency||store.settings.baseCurrency;
  const client = e.promoter?e.promoter.name:(e.venue||'Client');
  const lines=[{label:`${f.dealType||'Performance fee'} — ${e.venue}, ${e.city} (${fmtDate(e.date)})`, amount:+f.fee||0}];
  if(+f.perDiem>0) lines.push({label:'Per diem', amount:+f.perDiem});
  const inv={
    id:uid('inv'), number:nextInvoiceNumber(), eventId:eid, date:todayISO(),
    client, clientAddr:'', currency:cur, lines, status:'draft',
    terms:store.settings.invoiceTerms||14,
  };
  store.settings.invoiceSeq++;
  store.invoices.push(inv); persist('invoices', inv.id);
  if(!store.settings.billing.name){ closeSheet(); toast('Add your billing details','receipt'); openBilling(inv.id); }
  else openView('invoice', inv.id);
}
function invTotal(inv){ return (inv.lines||[]).reduce((s,l)=>s+(+l.amount||0),0); }
function viewInvoices(){
  const list = store.invoices.slice().sort((a,b)=> (b.number||'').localeCompare(a.number||''));
  const outstanding = list.filter(i=>i.status!=='paid').reduce((s,i)=>s+toBase(invTotal(i),i.currency),0);
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="openView('finance')">${ICON.chevL(20)} Money</button>
    <div style="font-size:16px;font-weight:700">Invoices</div>
    <button class="header-btn" style="width:36px;height:36px" onclick="pickEventForInvoice()">${ICON.plus(20)}</button>
  </div></div>
  <div class="screen-pad stagger">
    <div class="subtabs">
      <button onclick="openView('finance')">${ICON.trend(15)} Overview</button>
      <button class="on">${ICON.receipt(15)} Invoices${list.length?' ('+list.length+')':''}</button>
    </div>
    <div class="card" style="background:linear-gradient(150deg,rgba(10,132,255,0.12),var(--card))">
      <div style="font-size:12px;color:var(--blue);font-weight:700;text-transform:uppercase;letter-spacing:.05em">${ICON.receipt(13)} Outstanding invoiced</div>
      <div style="font-size:28px;font-weight:850;margin-top:3px">${fmtBase(outstanding)}</div>
      <div style="font-size:12.5px;color:var(--text-3);font-weight:600">${list.length} invoice${list.length!==1?'s':''} · next # ${esc(nextInvoiceNumber())}</div>
    </div>
    <div class="section">
      ${list.length?`<div class="card flush">${list.map(invRow).join('')}</div>`
        :`<div class="empty"><div class="ic">${ICON.receipt(26)}</div><b>No invoices yet</b><span>Generate one from any show's deal in a tap — properly numbered, ready to send.</span></div>`}
    </div>
    <div class="section"><button class="btn" onclick="pickEventForInvoice()">${ICON.plus(17)} New invoice from a show</button></div>
    <div class="hint">Sequential, uniquely-numbered and multi-currency — the compliance ABOSS's own users complain it lacks.</div>
    <div class="spacer"></div>
  </div>`;
}
function invRow(inv){
  const stCls = inv.status==='paid'?'confirmed':inv.status==='sent'?'hold':'past';
  return `<div class="row" onclick="openView('invoice','${inv.id}')">
    <div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.receipt(17)}</div>
    <div class="body"><b>${esc(inv.number)}</b><span>${esc(inv.client)} · ${fmtDate(inv.date)}</span></div>
    <div class="trail"><span class="tag ${stCls}">${inv.status}</span> ${fmtMoney(invTotal(inv),inv.currency)} ${ICON.chevR(15)}</div>
  </div>`;
}
function pickEventForInvoice(){
  const evs=sel.events().filter(e=>(e.finance&&e.finance.fee>0));
  if(!evs.length){ toast('Add a deal to a show first','x'); return; }
  openSheetReact('Invoice which show?', 'invoice.pickShow', {});
}
function addInvLine(id){ openSheetReact('Add line', 'invoice.addLine', { id }); }
function invoiceMenu(id){
  openSheetReact('Invoice', 'invoice.meta', { id });
}
function openBilling(invId){
  openSheetReact('Your billing details', 'invoice.billing', { invId: invId || '' });
}
function contactCard(id){
  const c=store.contacts.find(x=>x.id===id); if(!c) return;
  openSheetReact(c.name, 'contact.view', { id });
}
function sheetContact(id){
  openSheetReact(id?'Edit contact':'New contact', 'contact.edit', { id: id || '' });
}
function viewInvoice(id){
  const inv=store.invoices.find(x=>x.id===id); if(!inv) return backStub();
  const b=store.settings.billing; const total=invTotal(inv);
  const due=(()=>{ const d=parseDT(inv.date); if(!d) return ''; d.setDate(d.getDate()+(inv.terms||14)); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })();
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Invoices</button>
    <div style="display:flex;gap:8px">
      <button class="header-btn" style="width:36px;height:36px" onclick="shareInvoice('${inv.id}')">${ICON.share(17)}</button>
      <button class="header-btn" style="width:36px;height:36px" onclick="invoiceMenu('${inv.id}')">${ICON.edit(17)}</button>
    </div>
  </div></div>
  <div class="screen-pad stagger">
    <div class="card" style="padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:22px;font-weight:850;letter-spacing:-0.02em">INVOICE</div><div style="color:var(--text-3);font-weight:700;margin-top:2px">${esc(inv.number)}</div></div>
        <span class="tag ${inv.status==='paid'?'confirmed':inv.status==='sent'?'hold':'past'}" style="font-size:12px">${inv.status}</span>
      </div>
      <div class="divi"></div>
      <div style="display:flex;justify-content:space-between;gap:16px;font-size:13px">
        <div style="flex:1"><div style="color:var(--text-3);font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.04em;margin-bottom:4px">From</div>
          <div style="font-weight:650;white-space:pre-line;line-height:1.5">${esc(b.name||store.settings.artistName||'Your name')}${b.address?'\n'+esc(b.address):''}${b.taxId?'\nVAT/Tax: '+esc(b.taxId):''}</div></div>
        <div style="flex:1"><div style="color:var(--text-3);font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.04em;margin-bottom:4px">Bill to</div>
          <div style="font-weight:650;white-space:pre-line;line-height:1.5">${esc(inv.client)}${inv.clientAddr?'\n'+esc(inv.clientAddr):''}</div></div>
      </div>
      <div style="display:flex;gap:20px;margin-top:14px;font-size:12.5px;color:var(--text-2)"><span>Issued <b style="color:var(--text)">${fmtDate(inv.date)}</b></span><span>Due <b style="color:var(--text)">${fmtDate(due)}</b></span></div>
      <div class="divi"></div>
      ${(inv.lines||[]).map((l,idx)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--stroke);font-size:14px"><span style="flex:1;color:var(--text-2)">${esc(l.label)}</span><span style="font-weight:650;white-space:nowrap">${fmtMoney(l.amount,inv.currency)} <button class="del" style="opacity:.5;padding:0 2px" onclick="delInvLine('${inv.id}',${idx})">${ICON.x(12)}</button></span></div>`).join('')}
      <button class="link-btn" style="padding:8px 0" onclick="addInvLine('${inv.id}')">${ICON.plus(13)} Add line</button>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:12px;border-top:2px solid var(--stroke-strong)">
        <span style="font-size:16px;font-weight:800">Total due</span><span style="font-size:22px;font-weight:850">${fmtMoney(total,inv.currency)}</span>
      </div>
      ${inv.currency!==store.settings.baseCurrency?`<div style="text-align:right;font-size:12px;color:var(--text-3);margin-top:2px">≈ ${fmtBase(toBase(total,inv.currency))}</div>`:''}
      ${b.iban?`<div style="margin-top:14px;font-size:12.5px;color:var(--text-2)"><span style="color:var(--text-3)">Payment:</span> ${esc(b.iban)}</div>`:''}
    </div>
    <div class="section">
      <div class="seg" style="margin-bottom:12px">
        ${['draft','sent','paid'].map(st=>`<button class="${inv.status===st?'on':''}" onclick="setInvStatus('${inv.id}','${st}')">${st[0].toUpperCase()+st.slice(1)}</button>`).join('')}
      </div>
      <button class="btn" onclick="shareInvoice('${inv.id}')">${ICON.share(17)} Send / share invoice</button>
    </div>
    <div class="section"><button class="btn secondary" onclick="openBilling('${inv.id}')">${ICON.wallet2(16)} Edit my billing details</button></div>
    <div class="section"><button class="btn danger" onclick="confirmDeleteInvoice('${inv.id}')">${ICON.trash(16)} Delete invoice</button></div>
    <div class="spacer"></div>
  </div>`;
}
function setInvStatus(id,st){ const inv=store.invoices.find(x=>x.id===id); inv.status=st; if(st==='paid'){ const e=sel.event(inv.eventId); if(e&&e.finance) e.finance.paid=true; } haptic(); persist('invoices', id); renderView(); toast('Marked '+st, st==='paid'?'check':'receipt'); }
function saveInvLine(id){ const inv=store.invoices.find(x=>x.id===id); const label=val('il-label')||'Item'; inv.lines.push({label, amount:+val('il-amt')||0}); persist('invoices', id); closeSheet(); renderView(); }
function delInvLine(id,idx){ const inv=store.invoices.find(x=>x.id===id); if(inv.lines.length<=1){ toast('Keep at least one line','x'); return;} inv.lines.splice(idx,1); persist('invoices', id); renderView(); }
function saveInvoiceMeta(id){ const inv=store.invoices.find(x=>x.id===id); inv.client=val('iv-client')||inv.client; inv.clientAddr=val('iv-caddr'); inv.date=rawVal('iv-date')||inv.date; inv.terms=+val('iv-terms')||14; persist('invoices', id); closeSheet(); renderView(); toast('Invoice updated','receipt'); }
function confirmDeleteInvoice(id){ confirmSheet('Delete invoice?','The number won\'t be reused.','Delete',()=>{ store.invoices=store.invoices.filter(x=>x.id!==id); persist('invoices', id); back(); toast('Invoice deleted','trash'); }, true); }
function saveBilling(invId){
  store.settings.billing={name:val('bl-name'),address:val('bl-addr'),taxId:val('bl-tax'),email:val('bl-email'),iban:val('bl-iban')};
  store.settings.invoicePrefix=val('bl-prefix')||'AHQ'; store.settings.invoiceTerms=+val('bl-terms')||14;
  persist('settings'); closeSheet();
  if(invId) openView('invoice', invId); else renderView();
  toast('Billing saved','check');
}
function buildInvoiceText(inv){
  const b=store.settings.billing; const total=invTotal(inv);
  const due=(()=>{ const d=parseDT(inv.date); d.setDate(d.getDate()+(inv.terms||14)); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })();
  const L=[];
  L.push(`INVOICE ${inv.number}`); L.push('');
  L.push(`From: ${b.name||store.settings.artistName}`);
  if(b.address) L.push(b.address);
  if(b.taxId) L.push(`VAT/Tax: ${b.taxId}`);
  L.push(''); L.push(`Bill to: ${inv.client}`); if(inv.clientAddr) L.push(inv.clientAddr);
  L.push(''); L.push(`Issued: ${fmtDate(inv.date)}   Due: ${fmtDate(due)}`); L.push('');
  inv.lines.forEach(l=>L.push(`- ${l.label}: ${fmtMoney(l.amount,inv.currency)}`));
  L.push(''); L.push(`TOTAL DUE: ${fmtMoney(total,inv.currency)}`);
  if(b.iban) L.push(`\nPayment: ${b.iban}`);
  L.push('\n— via Operate');
  return L.join('\n');
}
function shareInvoice(id){
  const inv=store.invoices.find(x=>x.id===id); const text=buildInvoiceText(inv);
  if(inv.status==='draft'){ inv.status='sent'; persist('invoices', inv.id); }
  if(navigator.share){ navigator.share({title:`Invoice ${inv.number}`, text}).then(()=>{renderView();toast('Shared','share');}).catch(()=>{ window.__daysheet=text; previewDaySheet(text); }); }
  else { previewDaySheet(text); renderView(); }
}

/* ============================================================
   CONTACTS HUB — reusable, tagged (ABOSS weak point)
   ============================================================ */
const ROLES = {Promoter:'#ff375f', Driver:'#32d74b', Agent:'#6d5efc', Manager:'#0a84ff', Venue:'#ff9f0a', Label:'#40cbe0', Other:'#8b7dff'};
window.ROLES = ROLES;
let contactFilter='all';
Object.defineProperty(window, 'contactFilter', {
  get(){ return contactFilter; },
  set(v){ contactFilter = v; },
  configurable: true
});
function setContactFilter(k){
  contactFilter = k || 'all';
  haptic();
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.isContactsMounted === 'function' && OperateReact.isContactsMounted()){
    if(typeof OperateReact.refreshContacts === 'function') OperateReact.refreshContacts();
    else if(typeof notifyStore === 'function') notifyStore();
    return;
  }
  renderView();
}
function viewContacts(){
  const all = store.contacts.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const roles = [...new Set(all.map(c=>c.role))];
  let list = contactFilter==='all'? all : all.filter(c=>c.role===contactFilter);
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Home</button>
    <div style="font-size:16px;font-weight:700">Contacts</div>
    <button class="header-btn" style="width:36px;height:36px" onclick="sheetContact()">${ICON.plus(20)}</button>
  </div></div>
  <div class="screen-pad">
    <div class="chips">
      <button class="chip ${contactFilter==='all'?'on':''}" onclick="contactFilter='all';renderView()">All ${all.length}</button>
      ${roles.map(r=>`<button class="chip ${contactFilter===r?'on':''}" onclick="contactFilter='${r}';renderView()">${r}</button>`).join('')}
    </div>
    <div class="section" style="margin-top:14px">
      ${list.length?`<div class="card flush stagger">${list.map(contactRow).join('')}</div>`
        :`<div class="empty"><div class="ic">${ICON.users(26)}</div><b>No contacts</b><span>Save promoters, drivers and agents once — reuse them on every show.</span></div>`}
    </div>
    <div class="section"><button class="btn" onclick="sheetContact()">${ICON.plus(17)} Add contact</button></div>
    <div class="spacer"></div>
  </div>`;
}
function contactRow(c){
  const col=ROLES[c.role]||ROLES.Other;
  return `<div class="row" onclick="contactCard('${c.id}')">
    <div class="ic" style="background:${col}22;color:${col};font-weight:800;font-size:15px">${esc((c.name||'?').trim()[0]||'?').toUpperCase()}</div>
    <div class="body"><b>${esc(c.name)}</b><span>${esc(c.role)}${c.company?' · '+esc(c.company):''}</span></div>
    <div class="trail">
      ${c.phone?`<button class="header-btn" style="width:34px;height:34px" onclick="event.stopPropagation();callNumber('${jsAttr(c.phone)}')">${ICON.phone(15)}</button>`:''}
      ${c.whatsapp||c.phone?`<button class="header-btn" style="width:34px;height:34px" onclick="event.stopPropagation();whatsapp('${jsAttr(c.whatsapp||c.phone)}')">${ICON.chat(15)}</button>`:''}
    </div>
  </div>`;
}
function saveContact(id){
  const name=val('co-name'); if(!name){ toast('Add a name','x'); return; }
  const data={name, role:rawVal('co-role'), company:val('co-company'), phone:val('co-phone'), whatsapp:val('co-wa'), email:val('co-email'), notes:val('co-notes')};
  withButton($('#co-save'), ()=>{
    let cid = id;
    if(id){ Object.assign(store.contacts.find(x=>x.id===id), data); }
    else { cid = uid('con'); store.contacts.push(Object.assign({id:cid, created:nowMs()}, data)); }
    persist('contacts', cid);
    if(typeof pushContactNow === 'function') pushContactNow(cid);
    closeSheet(); if(overlay&&overlay.type==='contacts') renderView(); else openView('contacts');
  }, id?'Contact saved':'Contact added');
}
function delContact(id){ confirmSheet('Delete contact?','','Delete',()=>{ store.contacts=store.contacts.filter(x=>x.id!==id); persist('contacts', id); closeSheet(); if(overlay&&overlay.type==='contacts') renderView(); }, true); }
/* ---------- Launch ---------- */
boot();
