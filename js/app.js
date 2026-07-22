/* ---------- Boot ---------- */
function boot(){
  const saved = db.read();
  if(saved && saved.events){ store = saved; if(store.tab==null) store.tab='home'; migrate(); }
  else { seed(); }
  render();
  if(appLockActive()) requireUnlock('app', ()=>render());
  initGestures();
  initKeyboard();
  initSidebar();
  // Refresh the home countdown only while it's actually on screen — never when
  // on another tab, in an overlay/sheet, or when the app is backgrounded.
  const canTick = () => store.tab==='home' && !overlay && !sheetEl && !document.hidden;
  setInterval(()=>{ if(canTick()) tickCountdowns(); }, 30000);
  document.addEventListener('visibilitychange', ()=>{ if(canTick()) tickCountdowns(); });
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
  if(!calCursor) return;
  calMove(dir); haptic();
  const grid = document.querySelector('.cal-grid') || document.querySelector('.cal-month');
  if(grid){ grid.style.animation='none'; void grid.offsetWidth; grid.style.animation = (dir>0?'calSlideR':'calSlideL')+' .26s cubic-bezier(.2,.8,.2,1)'; }
}
function initKeyboard(){
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;
    const tag = document.activeElement?.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if(document.getElementById('viewer')?.classList.contains('on')){ closeViewer(); return; }
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
  {id:'shows', label:'Shows', icon:'music', hint:'Add, edit and browse all your shows'},
  {id:'trips', label:'Tours', icon:'trips', hint:'Shows grouped into tour runs automatically'},
  {id:'ideas', label:'Ideas', icon:'idea', hint:'Content ideas to use on shows'},
  {id:'notes', label:'Notes', icon:'note', hint:'Set notes, riders, reminders'},
];
let overlay = null; // {type, id} for detail views on top of a tab
let navStack = []; // history of overlays for proper Back behaviour
function go(tab){ navStack=[]; overlay=null; store.tab=tab; if(tab==='ideas') ideasStale=false; haptic(); persist(); render({ resetScroll: true }); }
function openView(type, id){
  if(type==='finance' && financeLockActive()){ requireUnlock('finance', ()=>openView('finance', id)); return; }
  if(overlay) navStack.push(overlay);   // remember where we came from
  overlay={type, id}; haptic(); renderView({ resetScroll: true });
}
function back(){
  overlay = navStack.length ? navStack.pop() : null;   // step back one screen, not all the way out
  renderView({ resetScroll: true });
}

function renderNav(){
  $('#nav').innerHTML = `
    <div class="nav-brand">
      <span class="nav-brand-mark">O</span>
      <span class="nav-brand-name">Operate</span>
      <button type="button" class="nav-collapse header-btn" onclick="toggleSidebar(true)" title="Hide sidebar">${ICON.chevL(16)}</button>
    </div>
  ` + TABS.map(t=>`
    <button class="nav-item ${store.tab===t.id&&!overlay?'active':''}" onclick="go('${t.id}')" title="${esc(t.hint)}">
      <span class="ic">${ICON[t.icon](25)}</span><span>${t.label}</span>
    </button>`).join('');
}

/* ---------- Master render ---------- */
function render(opts={}){ renderNav(); renderView(opts); }
function renderView(opts={}){
  const screen = $('#screen');
  const scrollY = opts.resetScroll ? 0 : (screen?.scrollTop || 0);
  const v = $('#view');
  if(overlay){
    if(overlay.type==='event') v.innerHTML = viewEvent(overlay.id);
    else if(overlay.type==='trip') v.innerHTML = viewTrip(overlay.id);
    else if(overlay.type==='note') v.innerHTML = viewNote(overlay.id);
    else if(overlay.type==='idea') v.innerHTML = viewIdea(overlay.id);
    else if(overlay.type==='finance') v.innerHTML = viewFinance();
    else if(overlay.type==='search') v.innerHTML = viewSearch();
    else if(overlay.type==='contacts') v.innerHTML = viewContacts();
    else if(overlay.type==='itinerary') v.innerHTML = viewItinerary();
    else if(overlay.type==='pastshows') v.innerHTML = viewPastShows();
    else if(overlay.type==='invoices') v.innerHTML = viewInvoices();
    else if(overlay.type==='invoice') v.innerHTML = viewInvoice(overlay.id);
    else if(overlay.type==='settings') v.innerHTML = viewSettings();
    else if(overlay.type==='stats') v.innerHTML = viewStats();
    renderNav(); setFab();
    if(screen) screen.scrollTop = scrollY;
    return;
  }
  const tab = store.tab;
  if(tab==='home') v.innerHTML = viewHome();
  else if(tab==='shows') v.innerHTML = viewShows();
  else if(tab==='calendar') v.innerHTML = viewCalendar();
  else if(tab==='trips') v.innerHTML = viewTrips();
  else if(tab==='ideas') v.innerHTML = viewIdeas();
  else if(tab==='notes') v.innerHTML = viewNotes();
  renderNav(); setFab();
  if(screen) screen.scrollTop = scrollY;
}
/* Persistent floating + button — anchored to the app frame so it never scrolls away.
   Its action follows the current tab; hidden where there's nothing to add. */
function setFab(){
  const fab = document.getElementById('fab');
  if(!fab) return;
  if(!fab.dataset.init){ fab.innerHTML = ICON.plus(26); fab.dataset.init='1'; }
  let action = null;
  if(!overlay){
    if(store.tab==='shows' || store.tab==='calendar') action = 'sheetEvent()';
    else if(store.tab==='ideas') action = 'sheetIdea()';
    else if(store.tab==='notes') action = 'sheetNote()';
  }
  if(action){ fab.style.display='flex'; fab.setAttribute('onclick', action); }
  else { fab.style.display='none'; fab.removeAttribute('onclick'); }
}
/* ============================================================
   Sheet / modal system
   ============================================================ */
let sheetEl = null;
function openSheet(title, bodyHTML, opts={}){
  closeSheet(true);
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
  $('#app').appendChild(s);
  sheetEl = s;
  scrim.classList.add('on');
  scrim.onclick = ()=>closeSheet();
  requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('on')));
}
function closeSheet(instant){
  const scrim = $('#scrim');
  if(!sheetEl){ scrim.classList.remove('on'); return; }
  const s = sheetEl; sheetEl=null; scrim.classList.remove('on');
  if(instant){ s.remove(); return; }
  s.classList.remove('on');
  setTimeout(()=>s.remove(), 340);
}
function val(id){ const e=document.getElementById(id); return e?e.value.trim():''; }
function rawVal(id){ const e=document.getElementById(id); return e?e.value:''; }

/* Fullscreen image viewer */
function openViewer(src){ $('#viewer-img').src=src; $('#viewer').classList.add('on'); }
function closeViewer(){ $('#viewer').classList.remove('on'); $('#viewer-img').src=''; }

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
  openSheet(title, `
    <p style="font-size:15px;color:var(--text-2);line-height:1.5;margin:2px 2px 18px">${esc(msg)}</p>
    <button class="btn ${danger?'danger':''}" id="confirm-yes">${esc(confirmLabel)}</button>
    <div class="spacer"></div>
    <button class="btn secondary" onclick="closeSheet()">Cancel</button>
  `);
  setTimeout(()=>{ const b=document.getElementById('confirm-yes'); if(b) b.onclick=()=>{ closeSheet(); onConfirm(); }; },50);
}
function promptSheet(title, placeholder, onSave, initial=''){
  openSheet(title, `
    <div class="field"><input id="prompt-in" class="input" placeholder="${esc(placeholder)}" value="${esc(initial)}"></div>
    <button class="btn" onclick="const v=val('prompt-in'); if(v){closeSheet(); (${onSave})(v);} else toast('Type something','x')">Add</button>
  `);
  setTimeout(()=>{ const i=document.getElementById('prompt-in'); if(i) i.focus(); },320);
}

/* ============================================================
   Checklists (event + trip) and timeline steps
   ============================================================ */
function toggleEventCheck(eid,cid){ const e=sel.event(eid); const i=e.checklist.find(x=>x.id===cid); if(i){i.done=!i.done; haptic(); persist(); renderView();} }
function delEventCheck(eid,cid){ const e=sel.event(eid); e.checklist=e.checklist.filter(x=>x.id!==cid); persist(); renderView(); }
function addEventCheckPrompt(eid){ promptSheet('Checklist item','e.g. Track ID list', function(v){ const e=sel.event(eid); e.checklist.push({id:uid('ck'),label:v,done:false}); persist(); renderView(); toast('Added','check'); }); }
function toggleTripCheck(tid,cid){ const t=sel.trip(tid); const i=t.checklist.find(x=>x.id===cid); if(i){i.done=!i.done; haptic(); persist(); renderView();} }
function delTripCheck(tid,cid){ const t=sel.trip(tid); t.checklist=t.checklist.filter(x=>x.id!==cid); persist(); renderView(); }
function addTripCheckPrompt(tid){ promptSheet('Packing / checklist item','e.g. Battery packs', function(v){ const t=sel.trip(tid); t.checklist.push({id:uid('ck'),label:v,done:false}); persist(); renderView(); toast('Added','check'); }); }
function completeStep(tid,sid){ const t=sel.trip(tid); const s=t.timeline.find(x=>x.id===sid); if(s){ s.done=!s.done; haptic(); persist(); renderView(); if(s.done) toast('Step done ✓','check'); } }
function saveEventNotes(eid,v){ const e=sel.event(eid); if(e){e.notes=v; persist();} }

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
function readFile(input, cb){
  const f = input.files&&input.files[0]; if(!f) return;
  if(f.size > 12*1024*1024){ toast('File too large (12MB max)','x'); input.value=''; return; }
  const kind = f.type.startsWith('image/')?'image':'pdf';
  const r = new FileReader();
  r.onload = ()=>{ if(kind==='image'){ compressImage(r.result, d=>cb({id:uid('att'),kind,name:f.name,data:d})); } else cb({id:uid('att'), kind, name:f.name, data:r.result}); };
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
    const kind=f.type.startsWith('image/')?'image':'pdf';
    const r=new FileReader();
    r.onload=()=>{ if(kind==='image'){ compressImage(r.result, d=>{ out.push({id:uid('att'),kind,name:f.name,data:d}); finish(); }); } else { out.push({id:uid('att'),kind,name:f.name,data:r.result}); finish(); } };
    r.onerror=()=>finish();
    r.readAsDataURL(f);
  });
}

/* ============================================================
   Itinerary inbox — drop ABOSS itineraries / flight screenshots.
   Phase 1: stores the reference + date/time/show tag (never overwrites structured data).
   Phase 2: reads the image and fills only the MISSING show fields automatically.
   ============================================================ */
function viewItinerary(){
  const list = (store.itineraries||[]).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.created||0)-(a.created||0));
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Home</button>
    <div style="font-size:15px;font-weight:700">Itinerary inbox</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">
    <label class="btn" style="margin-top:14px">${ICON.plus(18)} Submit itinerary<input type="file" accept="image/*,application/pdf" multiple style="display:none" onchange="submitItinerary(this)"></label>
    <div class="hint" style="text-align:left;padding:11px 2px 2px">Drop in ABOSS itineraries, Google flight screenshots or advance sheets. Tag each with its date and show so you know where it belongs. In Phase 2 these auto-fill any missing show details — without ever overwriting what you've already entered.</div>
    ${list.length? list.map(itinCard).join('') : `<div class="empty" style="margin-top:22px"><div class="ic">${ICON.file(26)}</div><b>Nothing submitted yet</b><span>Upload your first itinerary screenshot.</span></div>`}
    <div class="spacer"></div><div class="spacer"></div>
  </div>`;
}
function itinCard(it){
  const show = it.showId? sel.event(it.showId):null;
  const when = (it.date?fmtDate(it.date):'')+(it.time?' · '+it.time:'');
  const thumbs = (it.imgs||[]).map(im=>im.kind==='image'
    ? `<div class="thumb" onclick="event.stopPropagation();openViewer('${im.data}')"><img src="${im.data}"></div>`
    : `<div class="thumb"><div class="pdf">${ICON.file(26)}<span>${esc(im.name||'PDF')}</span></div></div>`).join('');
  return `<div class="card" style="margin-top:12px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px" onclick="sheetItinerary('${it.id}')">
      <div style="min-width:0"><b style="font-size:15.5px">${esc(it.source||'Itinerary')}</b>
        <div style="font-size:13px;color:var(--text-2);margin-top:2px">${when||'No date set'}${show?' · '+esc(show.venue):''}</div>
        ${it.note?`<div style="font-size:13px;color:var(--text-3);margin-top:5px;white-space:pre-wrap">${esc(it.note)}</div>`:''}</div>
      ${ICON.chevR(15)}
    </div>
    ${thumbs?`<div class="thumb-row" style="margin-top:11px">${thumbs}</div>`:''}
  </div>`;
}
function submitItinerary(input){
  toast('Reading…','image');
  readFiles(input, imgs=>{
    if(!imgs.length){ toast('Nothing added','x'); return; }
    const n=new Date(); const date=`${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
    const entry={id:uid('itin'), source:'', date, time:'', note:'', showId:'', imgs, created:Date.now()};
    store.itineraries.unshift(entry); persist(); renderView();
    imgs.forEach(im => hostImg(im, 'itinerary', 'itinerary'));
    sheetItinerary(entry.id);
  });
}
function sheetItinerary(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  const shows = store.events.filter(e=>e.kind==='show').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const thumbs=(it.imgs||[]).map(im=>`<div class="thumb" ${im.kind==='image'?`onclick="openViewer('${im.data}')"`:''}>${im.kind==='image'?`<img src="${im.data}">`:`<div class="pdf">${ICON.file(26)}<span>${esc(im.name||'PDF')}</span></div>`}<div class="del-badge" onclick="event.stopPropagation();delItinShot('${id}','${im.id}')">${ICON.x(13)}</div></div>`).join('');
  openSheet('Itinerary details', `
    <div class="field"><label>What is this?</label><input id="itn-src" class="input" value="${esc(it.source||'')}" placeholder="ABOSS itinerary / Google flight status"></div>
    <div class="row-2">
      <div class="field"><label>Date</label><input id="itn-date" type="date" class="input" value="${it.date||''}"></div>
      <div class="field"><label>Time (optional)</label><input id="itn-time" type="time" class="input" value="${it.time||''}"></div>
    </div>
    <div class="field"><label>For which show? (optional)</label>
      <select id="itn-show" class="input">${['<option value="">— Not linked —</option>'].concat(shows.map(s=>`<option value="${s.id}" ${it.showId===s.id?'selected':''}>${esc(s.venue)} · ${esc(fmtDate(s.date))}</option>`)).join('')}</select></div>
    <div class="field"><label>Notes</label><textarea id="itn-note" class="textarea" placeholder="Anything to flag — gate, hotel, key times…">${esc(it.note||'')}</textarea></div>
    <div class="field"><label>Screenshots</label><div class="thumb-row">${thumbs}<label class="thumb thumb-add">${ICON.plus(22)}<span>Add</span><input type="file" accept="image/*,application/pdf" multiple style="display:none" onchange="addItineraryShots('${id}',this)"></label></div></div>
    <button class="btn secondary" id="itn-scan" onclick="scanItinerary('${id}')">${ICON.checkList(16)} Scan &amp; auto-fill show</button>
    <div class="hint" style="text-align:left;padding:6px 2px 2px">Reads this screenshot and fills only the <b>missing</b> details on the linked show. It never overwrites anything you've already entered.</div>
    <button class="btn" style="margin-top:10px" onclick="saveItinerary('${id}')">Save</button>
    <button class="btn danger" style="margin-top:10px" onclick="delItinerary('${id}')">${ICON.trash(15)} Delete submission</button>
    <div class="spacer"></div>
  `);
}
function saveItinerary(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  it.source=val('itn-src'); it.date=rawVal('itn-date'); it.time=rawVal('itn-time'); it.showId=rawVal('itn-show'); it.note=val('itn-note');
  persist(); closeSheet(); renderView(); toast('Itinerary saved','check');
}
function addItineraryShots(id,input){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  readFiles(input, imgs=>{ if(imgs.length){ it.imgs=(it.imgs||[]).concat(imgs); persist(); imgs.forEach(im=>hostImg(im,'itinerary','itinerary')); sheetItinerary(id); } });
}
/* ---- Phase 2: read an itinerary screenshot and fill ONLY the missing show fields ---- */
function applyScanToShow(e, f){
  if(!e || !f) return [];
  const filled=[];
  if(!e.setTime   && f.setTime)      { e.setTime=f.setTime;         filled.push('set time'); }
  if(!e.endTime   && f.endTime)      { e.endTime=f.endTime;         filled.push('end time'); }
  if(!e.venueAddr && f.venueAddress) { e.venueAddr=f.venueAddress;  filled.push('venue address'); }
  if(!e.city      && f.city)         { e.city=f.city;               filled.push('city'); }
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
    e.drivers.push({ id:uid('drv'), journey:'', name:f.driverName||'', phone:f.driverPhone||'', whatsapp:'', pickup:'', notes:'' });
    e.driver = e.drivers[0];
    filled.push('driver');
  }
  return filled;
}
function scanBtnReset(){ const b=$('#itn-scan'); if(b){ b.disabled=false; b.innerHTML=ICON.checkList(16)+' Scan &amp; auto-fill show'; } }
async function scanItinerary(id){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(!it) return;
  const pick = rawVal('itn-show');
  const showId = pick || it.showId;
  if(!showId){ toast('Pick a show first','x'); return; }
  if(pick && pick!==it.showId){ it.showId=pick; }
  const e=sel.event(showId); if(!e){ toast('Show not found','x'); return; }
  const img=(it.imgs||[]).find(im=>im.kind==='image');
  if(!img){ toast('Add a screenshot first','x'); return; }
  if(!isSupabaseConfigured() || !authUser){ toast('Sign in to scan itineraries','x'); return; }
  const token = await getAccessToken();
  if(!token){ toast('Sign in to scan itineraries','x'); return; }
  const btn=$('#itn-scan'); if(btn){ btn.disabled=true; btn.textContent='Scanning…'; }
  toast('Scanning itinerary…','image');
  try{
    const res=await fetch(OPERATE_CONFIG.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/scan-itinerary', {
      method:'POST',
      headers:{ 'apikey':OPERATE_CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
      body: JSON.stringify({ image: img.data })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok || (data && data.error)){ toast('Scan failed'+(data&&data.error?': '+data.error:''),'x'); scanBtnReset(); return; }
    const f=(data&&data.fields)||{};
    if(!Object.keys(f).length){ toast('Nothing readable found','x'); scanBtnReset(); return; }
    const filled=applyScanToShow(e, f);
    persist();
    if(filled.length){ closeSheet(); renderView(); toast('Filled: '+filled.join(', '),'check'); }
    else { toast('Show already has this info','check'); scanBtnReset(); }
  }catch(err){ toast('Scan error','x'); scanBtnReset(); }
}
function delItinShot(id,imid){
  const it=(store.itineraries||[]).find(x=>x.id===id); if(it){ it.imgs=(it.imgs||[]).filter(im=>im.id!==imid); } persist(); sheetItinerary(id);
}
function delItinerary(id){
  confirmSheet('Delete submission?','','Delete',()=>{ store.itineraries=(store.itineraries||[]).filter(x=>x.id!==id); persist(); closeSheet(); renderView(); toast('Deleted','trash'); }, true);
}
function uploadAttachment(eid,input){ toast('Uploading…','image'); readFile(input, att=>{ const e=sel.event(eid); (e.attachments=e.attachments||[]).push(att); persist(); renderView(); toast('Attached','check'); hostImg(att, eid, 'attachment'); }); }
function delAttachment(eid,aid){ const e=sel.event(eid); e.attachments=e.attachments.filter(a=>a.id!==aid); persist(); renderView(); toast('Removed','trash'); }
function uploadPass(eid,fid,input){ toast('Uploading pass…','ticket'); readFile(input, att=>{ attachPassToShowFlight(eid, fid, att).then(ok=>{ if(ok) toast('Boarding pass added','check'); else toast('Could not attach pass','x'); }); }); }
function delFlightPass(eid,fid,pid){ const e=sel.event(eid); const f=e&&e.flights&&e.flights.find(x=>x.id===fid); if(f&&f.passes){ f.passes=f.passes.filter(p=>p.id!==pid); } persist(); renderView(); toast('Boarding pass removed','trash'); }
function delItemPass(itemId, passId){
  const it=store.events.find(x=>x.id===itemId);
  if(!it || !it.passes) return;
  if(passId) it.passes=it.passes.filter(p=>p.id!==passId);
  else it.passes=[];
  persist(); renderView(); toast('Boarding pass removed','trash');
}
function removeHotel(eid){ const e=sel.event(eid); if(e){ e.hotel=null; } persist(); closeSheet(); renderView(); toast('Hotel removed','trash'); }
function removeDriver(eid, idx){ const e=sel.event(eid); if(e){ const list=showDrivers(e); if(idx!=null) list.splice(idx,1); e.driver=list[0]||null; } persist(); closeSheet(); renderView(); toast('Driver removed','trash'); }
function removePromoter(eid){ const e=sel.event(eid); if(e){ e.promoter=null; } persist(); closeSheet(); renderView(); toast('Contact removed','trash'); }
/* ============================================================
   Menus + delete
   ============================================================ */
function eventMenu(eid){
  openSheet('Edit show', `
    <p class="sheet-lede">Update any part of this show — basics, travel, venue, deal or prep.</p>
    <div class="edit-section-grid">
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetEvent('${eid}')">${ICON.edit(16)}<span><b>Show basics</b><small>Venue, date, times, status</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetHotel('${eid}')">${ICON.bed(16)}<span><b>Hotel</b><small>Stay & confirmation</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetFlight('${eid}')">${ICON.plane(16)}<span><b>Flights</b><small>Routes & boarding passes</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetFlightInfo('${eid}')">${ICON.planeUp(16)}<span><b>Flight info</b><small>Number, gate, terminal</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetDriver('${eid}')">${ICON.car(16)}<span><b>Driver</b><small>Ground transport</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetVenueAddr('${eid}')">${ICON.pin(16)}<span><b>Venue & address</b><small>Location & maps</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetPromoter('${eid}')">${ICON.users(16)}<span><b>Promoter</b><small>Local contact</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetAdvance('${eid}')">${ICON.file(16)}<span><b>Advance</b><small>Stage, catering, access</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetFinance('${eid}')">${ICON.coins(16)}<span><b>Deal</b><small>Fee, expenses, paid</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetShowTimeline('${eid}')">${ICON.clock(16)}<span><b>Day timeline</b><small>Schedule steps</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetShowChecklist('${eid}')">${ICON.checkList(16)}<span><b>Checklist</b><small>Prep tasks</small></span></button>
      <button type="button" class="edit-section-btn" onclick="closeSheet(); sheetEventContact('${eid}')">${ICON.users(16)}<span><b>Key contact</b><small>Extra people</small></span></button>
    </div>
    <div class="spacer"></div>
    <button class="btn secondary" onclick="closeSheet(); startTripFromShow('${eid}')">${ICON.play(16)} Start Trip Mode</button>
    <div class="spacer"></div>
    <button class="btn danger" onclick="closeSheet(); confirmDeleteEvent('${eid}')">${ICON.trash(16)} Delete show</button>
    <div class="spacer"></div>
  `, { full: true });
}
function tripMenu(tid){
  openSheet('Trip options', `
    <button class="btn secondary" onclick="closeSheet(); sheetTrip('${tid}')">${ICON.edit(16)} Edit trip</button>
    <div class="spacer"></div>
    ${sel.trip(tid).archived?`<button class="btn secondary" onclick="closeSheet(); unarchiveTrip('${tid}')">${ICON.archive(16)} Unarchive</button>`
      :`<button class="btn secondary" onclick="closeSheet(); confirmCompleteTrip('${tid}')">${ICON.flag(16)} Complete & archive</button>`}
    <div class="spacer"></div>
    <button class="btn danger" onclick="closeSheet(); confirmDeleteTrip('${tid}')">${ICON.trash(16)} Delete trip</button>
    <div class="spacer"></div>
  `);
}
function confirmDeleteEvent(eid){ confirmSheet('Delete show?','This removes the show and its details permanently.','Delete',()=>{ store.events=store.events.filter(e=>e.id!==eid); persist(); back(); toast('Show deleted','trash'); }, true); }
function confirmDeleteTrip(tid){ confirmSheet('Delete trip?','Shows in this trip are kept, but the trip itself is removed.','Delete trip',()=>{ store.events.forEach(e=>{ if(e.tripId===tid) e.tripId=null; }); if(store.activeTripId===tid) store.activeTripId=null; store.trips=store.trips.filter(t=>t.id!==tid); persist(); back(); toast('Trip deleted','trash'); }, true); }
function confirmDeleteIdea(iid){ confirmSheet('Delete idea?','This can\'t be undone.','Delete',()=>{ store.ideas=store.ideas.filter(x=>x.id!==iid); persist(); back(); toast('Idea deleted','trash'); }, true); }

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
      <div class="set-row tap" onclick="editHomeAirport()"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.planeUp(17)}</div><div class="body"><b>Home airport</b><span>Returning here ends a tour</span></div><div class="trail">${esc(s.homeAirport||'AMS')} ${ICON.chevR(15)}</div></div>
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
    grossBase:s.grossBase, netBase:s.netBase, busiest, busiestN:bmax };
}
function statTile(label, value, sub, color){
  return `<div class="card" style="padding:15px 16px"><div style="font-size:12px;color:${color||'var(--text-3)'};font-weight:700;text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="font-size:26px;font-weight:850;letter-spacing:-0.02em;margin-top:4px">${value}</div>${sub?`<div style="font-size:12px;color:var(--text-3);font-weight:600;margin-top:1px">${sub}</div>`:''}</div>`;
}
function viewStats(){
  const st=computeStats();
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${statTile('Flight time', st.flightHrs+'h', 'approx · ~'+st.flightDays+' days in the air', 'var(--blue)')}
        ${statTile('Days away', st.daysAway, 'across '+st.tours+' tours', 'var(--green)')}
        ${statTile('Flights', st.flights, st.hotels+' hotel stays', 'var(--accent-2)')}
        ${statTile('Cities', st.cities, 'unique', 'var(--pink)')}
        ${statTile('Booked (gross)', fmtBase(st.grossBase), 'net ≈ '+fmtBase(st.netBase), 'var(--green)')}
        ${statTile('Busiest month', st.busiestN, esc(st.busiest), 'var(--orange)')}
      </div>
    </div>
    <div class="hint">Flight time is estimated from scheduled times and ignores time zones, so treat it as a ballpark. Earnings use your editable fees & rates.</div>
    <div class="spacer"></div>
  </div>`;
}
function setAccountType(k){ store.settings.accountType=k; haptic(); persist(); renderView(); toast(ACCOUNT_TYPES[k].label,'check'); }
function editHomeAirport(){
  openSheet('Home airport', `
    <div class="field"><label>Airport code (IATA)</label><input id="ha-code" class="input" style="text-transform:uppercase" maxlength="4" value="${esc(store.settings.homeAirport||'AMS')}" placeholder="AMS"></div>
    <div class="hint" style="text-align:left;padding:2px 2px 12px">A tour ends whenever a flight brings you back here. Change this and tours regroup automatically.</div>
    <button class="btn" onclick="store.settings.homeAirport=(val('ha-code')||'AMS').toUpperCase();if(store.settings.baseCurrencyAuto!==false)store.settings.baseCurrency=homeCurrency();persist();closeSheet();renderView();toast('Home airport set','check')">Save</button><div class="spacer"></div>
  `);
  setTimeout(()=>{const i=document.getElementById('ha-code');if(i)i.focus();},300);
}
function editProfileName(){
  openSheet('Your name', `<div class="field"><label>Name / act</label><input id="pf-name" class="input" value="${esc(store.settings.artistName==='You'?'':store.settings.artistName)}" placeholder="Your DJ / act name"></div><button class="btn" onclick="store.settings.artistName=val('pf-name')||'You';persist();closeSheet();renderView();toast('Saved','check')">Save</button><div class="spacer"></div>`);
  setTimeout(()=>{const i=document.getElementById('pf-name');if(i)i.focus();},300);
}
function uploadHomeHeader(input){ toast('Uploading photo…','image'); readFile(input, att=>{ if(att.kind!=='image'){ toast('Pick an image','x'); return; } store.settings.homeHeader=att.data; persist(); renderView(); toast('Header photo set','check');
  if(syncActive() && att.data.startsWith('data:')) uploadFileDataUrl(att.data,'header','header','home_header').then(({path,url})=>{ store.settings._homeHeaderPath=path; store.settings.homeHeader=url; persist(); renderView(); }).catch(()=>{}); }); }
function removeHomeHeader(){ confirmSheet('Remove header photo?','','Remove',()=>{ store.settings.homeHeader=null; persist(); closeSheet(); renderView(); toast('Removed','trash'); }, true); }
function toggleSecurity(){
  const sec=store.settings.security;
  if(secOn()){ confirmSheet('Turn off passcode?','The app and finance will be accessible without a passcode.','Turn off',()=>{ sec.enabled=false; sec.pin=''; sec.biometric=false; session.appUnlocked=true; session.financeUnlocked=true; persist(); renderView(); toast('Passcode off','unlock'); }); }
  else { pinSetupFirst=null; pinResolve=()=>{ session.appUnlocked=true; session.financeUnlocked=true; renderView(); }; renderLock('setup'); }
}
function setLockScope(sc){ store.settings.security.scope=sc; persist(); if(sc==='finance') session.financeUnlocked=false; renderView(); toast(sc==='app'?'Locking whole app':'Locking finance only','lock'); }
function toggleBiometric(){ const sec=store.settings.security; sec.biometric=!sec.biometric; persist(); renderView(); toast(sec.biometric?'Face ID on':'Face ID off', sec.biometric?'face':'x'); }
function changePasscode(){ pinSetupFirst=null; pinResolve=()=>{ toast('Passcode changed','check'); renderView(); }; renderLock('setup'); }
function sheetCurrency(){
  const s=store.settings;
  openSheet('Currency & rates', `
    <div class="field"><label>Base currency</label>
      <select id="set-base" class="input">${Object.keys(s.fx).map(c=>`<option value="${c}" ${s.baseCurrency===c?'selected':''}>${c} (${CURSYM[c]||c})</option>`).join('')}</select>
      <div class="hint" style="text-align:left;padding:6px 2px">All earnings roll up into this currency.</div></div>
    <div class="field"><label>Exchange rates (value of 1 unit in ${s.baseCurrency})</label>
      <div id="set-rates">${Object.entries(s.fx).filter(([c])=>c!==s.baseCurrency).map(([c,v])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:52px;font-weight:700;color:var(--text-2)">${c}</span><input class="input" data-cur="${c}" type="number" step="0.0001" inputmode="decimal" value="${v}" style="flex:1;padding:9px 12px"></div>`).join('')}</div>
    </div>
    <button class="btn" id="set-save" onclick="saveCurrency()">Save rates</button><div class="spacer"></div>
  `);
}
function saveCurrency(){
  const base=rawVal('set-base')||store.settings.baseCurrency;
  withButton($('#set-save'), ()=>{
    document.querySelectorAll('#set-rates input[data-cur]').forEach(inp=>{ const r=parseFloat(inp.value); if(r>0) store.settings.fx[inp.dataset.cur]=r; });
    store.settings.baseCurrency=base; store.settings.baseCurrencyAuto=false; persist(); closeSheet(); renderView();
  }, 'Rates saved');
}
function sheetPacking(){
  const s=store.settings;
  openSheet('Default packing list', `<div class="field"><label>One item per line</label><textarea id="set-pack" class="textarea" style="min-height:200px">${esc((s.packingTemplate||[]).join('\n'))}</textarea><div class="hint" style="text-align:left;padding:6px 2px">Added to every new trip.</div></div><button class="btn" onclick="store.settings.packingTemplate=rawVal('set-pack').split('\\n').map(x=>x.trim()).filter(Boolean);persist();closeSheet();renderView();toast('Saved','check')">Save list</button><div class="spacer"></div>`);
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
      migrate(); persist(); overlay=null; closeSheet(); render();
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
function openSearch(){ searchQ=''; openView('search'); setTimeout(()=>{ const el=$('#search-input'); if(el) el.focus(); },120); }
let searchT;
function debouncedSearch(){ clearTimeout(searchT); searchT=setTimeout(()=>{ const el=$('#search-input'); const pos=el?el.selectionStart:0; renderView(); const n=$('#search-input'); if(n){n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){}} },140); }

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
  store.invoices.push(inv); persist();
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
  openSheet('Invoice which show?', `<div class="card flush">${evs.map(e=>{ const has=store.invoices.some(iv=>iv.eventId===e.id); return `<div class="row" onclick="closeSheet(); ${has?`openView('invoice','${store.invoices.find(iv=>iv.eventId===e.id).id}')`:`createInvoiceFromEvent('${e.id}')`}"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.money(17)}</div><div class="body"><b>${esc(e.venue)}</b><span>${esc(e.city)} · ${fmtMoney(e.finance.fee,e.finance.currency)}${has?' · invoiced':''}</span></div>${ICON.chevR(15)}</div>`; }).join('')}</div><div class="spacer"></div>`);
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
function setInvStatus(id,st){ const inv=store.invoices.find(x=>x.id===id); inv.status=st; if(st==='paid'){ const e=sel.event(inv.eventId); if(e&&e.finance) e.finance.paid=true; } haptic(); persist(); renderView(); toast('Marked '+st, st==='paid'?'check':'receipt'); }
function addInvLine(id){ openSheet('Add line', `<div class="row-2"><div class="field" style="flex:2"><label>Description</label><input id="il-label" class="input" placeholder="Travel, extra set…"></div><div class="field"><label>Amount</label><input id="il-amt" type="number" inputmode="decimal" class="input"></div></div><button class="btn" onclick="saveInvLine('${id}')">Add</button><div class="spacer"></div>`); }
function saveInvLine(id){ const inv=store.invoices.find(x=>x.id===id); const label=val('il-label')||'Item'; inv.lines.push({label, amount:+val('il-amt')||0}); persist(); closeSheet(); renderView(); }
function delInvLine(id,idx){ const inv=store.invoices.find(x=>x.id===id); if(inv.lines.length<=1){ toast('Keep at least one line','x'); return;} inv.lines.splice(idx,1); persist(); renderView(); }
function invoiceMenu(id){ const inv=store.invoices.find(x=>x.id===id);
  openSheet('Invoice', `
    <div class="field"><label>Bill to (client)</label><input id="iv-client" class="input" value="${esc(inv.client)}"></div>
    <div class="field"><label>Client address</label><textarea id="iv-caddr" class="textarea" style="min-height:60px">${esc(inv.clientAddr||'')}</textarea></div>
    <div class="row-2"><div class="field"><label>Issue date</label><input id="iv-date" type="date" class="input" value="${inv.date}"></div><div class="field"><label>Terms (days)</label><input id="iv-terms" type="number" class="input" value="${inv.terms||14}"></div></div>
    <button class="btn" onclick="saveInvoiceMeta('${id}')">Save</button><div class="spacer"></div>
  `);
}
function saveInvoiceMeta(id){ const inv=store.invoices.find(x=>x.id===id); inv.client=val('iv-client')||inv.client; inv.clientAddr=val('iv-caddr'); inv.date=rawVal('iv-date')||inv.date; inv.terms=+val('iv-terms')||14; persist(); closeSheet(); renderView(); toast('Invoice updated','receipt'); }
function confirmDeleteInvoice(id){ confirmSheet('Delete invoice?','The number won\'t be reused.','Delete',()=>{ store.invoices=store.invoices.filter(x=>x.id!==id); persist(); back(); toast('Invoice deleted','trash'); }, true); }
function openBilling(invId){
  const b=store.settings.billing;
  openSheet('Your billing details', `
    <div class="field"><label>Name / business</label><input id="bl-name" class="input" value="${esc(b.name||'')}" placeholder="Your legal / act name"></div>
    <div class="field"><label>Address</label><textarea id="bl-addr" class="textarea" style="min-height:70px" placeholder="Billing address">${esc(b.address||'')}</textarea></div>
    <div class="row-2"><div class="field"><label>VAT / Tax ID</label><input id="bl-tax" class="input" value="${esc(b.taxId||'')}"></div><div class="field"><label>Email</label><input id="bl-email" type="email" class="input" value="${esc(b.email||'')}"></div></div>
    <div class="field"><label>Payment details (IBAN / account)</label><input id="bl-iban" class="input" value="${esc(b.iban||'')}" placeholder="IBAN or bank details"></div>
    <div class="row-2"><div class="field"><label>Invoice prefix</label><input id="bl-prefix" class="input" value="${esc(store.settings.invoicePrefix)}"></div><div class="field"><label>Default terms (days)</label><input id="bl-terms" type="number" class="input" value="${store.settings.invoiceTerms||14}"></div></div>
    <button class="btn" onclick="saveBilling('${invId||''}')">Save details</button><div class="spacer"></div>
  `);
}
function saveBilling(invId){
  store.settings.billing={name:val('bl-name'),address:val('bl-addr'),taxId:val('bl-tax'),email:val('bl-email'),iban:val('bl-iban')};
  store.settings.invoicePrefix=val('bl-prefix')||'AHQ'; store.settings.invoiceTerms=+val('bl-terms')||14;
  persist(); closeSheet();
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
  if(inv.status==='draft'){ inv.status='sent'; persist(); }
  if(navigator.share){ navigator.share({title:`Invoice ${inv.number}`, text}).then(()=>{renderView();toast('Shared','share');}).catch(()=>{ window.__daysheet=text; previewDaySheet(text); }); }
  else { previewDaySheet(text); renderView(); }
}

/* ============================================================
   CONTACTS HUB — reusable, tagged (ABOSS weak point)
   ============================================================ */
const ROLES = {Promoter:'#ff375f', Driver:'#32d74b', Agent:'#6d5efc', Manager:'#0a84ff', Venue:'#ff9f0a', Label:'#40cbe0', Other:'#8b7dff'};
let contactFilter='all';
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
      ${c.phone?`<button class="header-btn" style="width:34px;height:34px" onclick="event.stopPropagation();callNumber('${c.phone}')">${ICON.phone(15)}</button>`:''}
      ${c.whatsapp||c.phone?`<button class="header-btn" style="width:34px;height:34px" onclick="event.stopPropagation();whatsapp('${c.whatsapp||c.phone}')">${ICON.chat(15)}</button>`:''}
    </div>
  </div>`;
}
function contactCard(id){
  const c=store.contacts.find(x=>x.id===id); const col=ROLES[c.role]||ROLES.Other;
  openSheet(c.name, `
    <div style="display:flex;align-items:center;gap:13px;margin-bottom:16px">
      <div style="width:54px;height:54px;border-radius:16px;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px">${esc((c.name||'?').trim()[0]||'?').toUpperCase()}</div>
      <div><div style="font-size:19px;font-weight:750">${esc(c.name)}</div><div style="color:var(--text-2);font-weight:600"><span class="tag" style="background:${col}22;color:${col}">${esc(c.role)}</span>${c.company?' '+esc(c.company):''}</div></div>
    </div>
    <div class="act-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <button class="act" onclick="callNumber('${c.phone||''}')"><div class="ic" style="background:var(--green-soft);color:var(--green)">${ICON.phone(19)}</div><span>Call</span></button>
      <button class="act" onclick="whatsapp('${c.whatsapp||c.phone||''}')"><div class="ic" style="background:var(--green-soft);color:var(--green)">${ICON.chat(19)}</div><span>WhatsApp</span></button>
      <button class="act" onclick="${c.email?`window.location.href='mailto:${c.email}'`:`toast('No email','x')`}"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.note(19)}</div><span>Email</span></button>
      <button class="act" onclick="copyText('${esc(c.phone||'')}')"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.copy(19)}</div><span>Copy</span></button>
    </div>
    ${c.phone?`<div class="info-line" style="border:1px solid var(--stroke);border-radius:12px;margin-bottom:8px" onclick="copyText('${esc(c.phone)}')"><div class="ic">${ICON.phone(16)}</div><div class="tx"><div class="k">Phone</div><div class="v">${esc(c.phone)}</div></div></div>`:''}
    ${c.email?`<div class="info-line" style="border:1px solid var(--stroke);border-radius:12px;margin-bottom:8px" onclick="copyText('${esc(c.email)}')"><div class="ic">${ICON.note(16)}</div><div class="tx"><div class="k">Email</div><div class="v">${esc(c.email)}</div></div></div>`:''}
    ${c.notes?`<div class="info-line" style="border:1px solid var(--stroke);border-radius:12px;margin-bottom:8px"><div class="ic">${ICON.edit(16)}</div><div class="tx"><div class="k">Notes</div><div class="v" style="font-size:14px">${esc(c.notes)}</div></div></div>`:''}
    <div class="spacer"></div>
    <div class="btn-row"><button class="btn secondary" onclick="sheetContact('${c.id}')">${ICON.edit(15)} Edit</button><button class="btn danger" style="flex:0 0 auto" onclick="delContact('${c.id}')">${ICON.trash(15)}</button></div>
    <div class="spacer"></div>
  `);
}
function sheetContact(id){
  const c = id? store.contacts.find(x=>x.id===id):null;
  openSheet(id?'Edit contact':'New contact', `
    <div class="field"><label>Name</label><input id="co-name" class="input" value="${esc(c?c.name:'')}" placeholder="Full name"></div>
    <div class="row-2">
      <div class="field"><label>Role</label><select id="co-role" class="input">${Object.keys(ROLES).map(r=>`<option ${(c?c.role:'Promoter')===r?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Company</label><input id="co-company" class="input" value="${esc(c?c.company:'')}" placeholder="Club / agency"></div>
    </div>
    <div class="field"><label>Phone</label><input id="co-phone" type="tel" class="input" value="${esc(c?c.phone:'')}"></div>
    <div class="field"><label>WhatsApp (if different)</label><input id="co-wa" type="tel" class="input" value="${esc(c?c.whatsapp:'')}"></div>
    <div class="field"><label>Email</label><input id="co-email" type="email" class="input" value="${esc(c?c.email:'')}"></div>
    <div class="field"><label>Notes</label><textarea id="co-notes" class="textarea" style="min-height:60px">${esc(c?c.notes:'')}</textarea></div>
    <button class="btn" id="co-save" onclick="saveContact('${id||''}')">${id?'Save':'Add contact'}</button><div class="spacer"></div>
  `);
}
function saveContact(id){
  const name=val('co-name'); if(!name){ toast('Add a name','x'); return; }
  const data={name, role:rawVal('co-role'), company:val('co-company'), phone:val('co-phone'), whatsapp:val('co-wa'), email:val('co-email'), notes:val('co-notes')};
  withButton($('#co-save'), ()=>{
    if(id){ Object.assign(store.contacts.find(x=>x.id===id), data); }
    else { store.contacts.push(Object.assign({id:uid('con'), created:nowMs()}, data)); }
    persist(); closeSheet(); if(overlay&&overlay.type==='contacts') renderView(); else openView('contacts');
  }, id?'Contact saved':'Contact added');
}
function delContact(id){ confirmSheet('Delete contact?','','Delete',()=>{ store.contacts=store.contacts.filter(x=>x.id!==id); persist(); closeSheet(); if(overlay&&overlay.type==='contacts') renderView(); }, true); }
/* ---------- Launch ---------- */
boot();
