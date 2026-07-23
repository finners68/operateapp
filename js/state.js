/* ============================================================
   Operate — Application
   Architecture:
     • store  = single source of truth (in-memory state)
     • db      = persistence layer (localStorage now; swap for
                 Supabase/Postgres in Phase 2 with same API)
     • render  = pure view functions read from store
     • actions = mutate store -> persist -> re-render everywhere
   No screen holds its own copy of data.
   ============================================================ */
/* ---------- Icons (Lucide-style, stroked) ---------- */
const I = (p, s=24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  home:      p=>I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',p),
  calendar:  p=>I('<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>',p),
  trips:     p=>I('<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M8 8v12M16 8v12"/>',p),
  bag:       p=>I('<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M8 8v12M16 8v12"/>',p),
  idea:      p=>I('<path d="M9 18h6M10 21h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/>',p),
  note:      p=>I('<path d="M4 3h16v18l-4-3H4Z"/><path d="M8 8h8M8 12h6"/>',p),
  plane:     p=>I('<path d="M21 15.5 3.5 21l4-6.5L3 9l2-1 4 3 5.5-6.5 2 .5-3 7 5 1Z"/>',p),
  planeTop:  (s=24)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
  planeUp:   p=>I('<path d="M12 2 4 14h5v8h6v-8h5Z"/>',p),
  bed:       p=>I('<path d="M3 8v11M3 13h18v6M21 19v-6a4 4 0 0 0-4-4H8"/><circle cx="7" cy="11" r="2"/>',p),
  pin:       p=>I('<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',p),
  map:       p=>I('<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',p),
  clock:     p=>I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',p),
  phone:     p=>I('<path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l1 4v3h-3A15 15 0 0 1 4 6Z"/>',p),
  chat:      p=>I('<path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z"/>',p),
  car:       p=>I('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14v6H5Z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>',p),
  user:      p=>I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',p),
  users:     p=>I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c0-2.8-1.6-4.6-4-5.2"/>',p),
  check:     p=>I('<path d="M20 6 9 17l-5-5"/>',p),
  checkList: p=>I('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.2 1.2L6.5 5M3 12l1.2 1.2L6.5 11M3 18l1.2 1.2L6.5 17"/>',p),
  plus:      p=>I('<path d="M12 5v14M5 12h14"/>',p),
  chevR:     p=>I('<path d="m9 6 6 6-6 6"/>',p),
  chevL:     p=>I('<path d="m15 6-6 6 6 6"/>',p),
  bell:      p=>I('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.5 21a1.9 1.9 0 0 0 3 0"/>',p),
  copy:      p=>I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',p),
  camera:    p=>I('<path d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',p),
  image:     p=>I('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 18 5-5 4 4 2-2 5 5"/>',p),
  file:      p=>I('<path d="M14 3v5h5M6 3h8l5 5v13H6Z"/>',p),
  ticket:    p=>I('<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M12 6v12"/>',p),
  play:      p=>I('<path d="M6 4v16l14-8Z"/>',p),
  flag:      p=>I('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',p),
  music:     p=>I('<circle cx="6" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/><path d="M8.5 18V6l11-2v12"/>',p),
  mic:       p=>I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',p),
  video:     p=>I('<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10.5 22 7v10l-7-3.5Z"/>',p),
  sun:       p=>I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',p),
  search:    p=>I('<circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>',p),
  x:         p=>I('<path d="M6 6l12 12M18 6 6 18"/>',p),
  trash:     p=>I('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>',p),
  edit:      p=>I('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M14 5l4 4"/>',p),
  archive:   p=>I('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',p),
  folder:    p=>I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',p),
  settings:  p=>I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',p),
  grip:      p=>I('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',p),
  wake:      p=>I('<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 1M9 2 6 4M15 2l3 2"/>',p),
  sound:     p=>I('<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>',p),
  land:      p=>I('<path d="M2 20h20M3 15l17 3M6 9l1 5 6 1-3-8-2-.5L9 11 6.5 8.5Z"/>',p),
  star:      p=>I('<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9Z"/>',p),
  sparkle:   p=>I('<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',p),
  reminder:  p=>I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',p),
  wallet:    p=>I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',p),
  globe:     p=>I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',p),
  arrowUp:   p=>I('<path d="M12 19V5M6 11l6-6 6 6"/>',p),
  share:     p=>I('<path d="M12 3v13M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',p),
  money:     p=>I('<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',p),
  coins:     p=>I('<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M15 12.5c2.5-.2 6-1.2 6-3.5M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',p),
  trend:     p=>I('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',p),
  receipt:   p=>I('<path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3Z"/><path d="M8 8h8M8 12h6"/>',p),
  wallet2:   p=>I('<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z"/><circle cx="17" cy="13" r="1.3"/>',p),
  check2:    p=>I('<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',p),
  chevDown:  p=>I('<path d="m6 9 6 6 6-6"/>',p),
  chevUp:    p=>I('<path d="m6 15 6-6 6 6"/>',p),
  face:      p=>I('<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M9 10v1M15 10v1M9.5 15a3 3 0 0 0 5 0"/>',p),
  lock:      p=>I('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',p),
  unlock:    p=>I('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',p),
  shield:    p=>I('<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z"/><path d="m9 12 2 2 4-4"/>',p),
  ferry:     p=>I('<path d="M3 14l1.5 5.5a2 2 0 0 0 1.9 1.5h11.2a2 2 0 0 0 1.9-1.5L22 14M4 14l8-3 8 3M12 4v7M8 8h8"/>',p),
  ban:       p=>I('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',p),
  walk:      p=>I('<circle cx="13" cy="4" r="1.6"/><path d="M11 21l1.5-6L10 12l1-5 3 3 3 1M8 21l2.5-6"/>',p),
};

/* Content types for Ideas */
const IDEA_TYPES = {
  reel:    {label:'Reel',      color:'#ff375f', icon:'video'},
  caption: {label:'Caption',   color:'#0a84ff', icon:'edit'},
  hook:    {label:'Hook',      color:'#ff9f0a', icon:'sparkle'},
  youtube: {label:'YouTube',   color:'#ff453a', icon:'play'},
  podcast: {label:'Podcast',   color:'#bf5af2', icon:'mic'},
  interview:{label:'Interview',color:'#32d74b', icon:'chat'},
  location:{label:'Location',  color:'#40cbe0', icon:'pin'},
  other:   {label:'Idea',      color:'#8b7dff', icon:'idea'},
};
const CATS = {
  purple:'#6d5efc', pink:'#ff375f', blue:'#0a84ff', green:'#32d74b',
  orange:'#ff9f0a', teal:'#40cbe0', red:'#ff453a', yellow:'#ffd60a'
};
const PRIO = {high:'#ff453a', med:'#ff9f0a', low:'#32d74b'};
/* Quick-pick journey headers for driver contacts. The header is free text —
   these are just shortcuts, and it can be left blank as journeys vary. */
const DRIVER_JOURNEYS = ['Airport → Hotel','Hotel → Venue','Venue → Hotel','Hotel → Airport'];
/* A show can have several driver contacts (one per journey). Returns the
   drivers array, lazily migrating a legacy single `e.driver` into the list. */
function showDrivers(e){
  if(!e) return [];
  if(!Array.isArray(e.drivers)) e.drivers = e.driver ? [Object.assign({id:uid('drv'), journey:''}, e.driver)] : [];
  return e.drivers;
}

/* ---------- Persistence layer (swap-able) ---------- */
const DB_KEY = 'artisthq.v2';
const DB_BACKUP_KEY = DB_KEY + '.prelogistics';
const db = {
  read(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)); }catch(e){ return null; } },
  write(state){
    // Move image/PDF bytes to IndexedDB, and never write base64 data: URLs into
    // localStorage — a single photo can exceed the quota and abort the whole save.
    try{ if(typeof stashBlobs==='function') stashBlobs(state); }catch(e){}
    // Strip base64 ONLY from attachments we've copied to IndexedDB (this._idb).
    // `this` in a replacer is the object that owns the key, so siblings are visible.
    const replacer = function(k,v){ return (k==='data' && this && this._idb && typeof v==='string' && v.startsWith('data:')) ? undefined : v; };
    try{ localStorage.setItem(DB_KEY, JSON.stringify(state, replacer)); }
    catch(e){ try{ localStorage.setItem(DB_KEY, JSON.stringify(state, replacer)); }catch(e2){ toast('Storage full','x'); } }
  },
};

/* ---------- Central store ---------- */
let store = null;
const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,10) + (store ? store._seq++ : 0);

function persist(){ db.write(store); queueSync(); }
function commit(){ persist(); render(); }

/* ---------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Escape a value that is interpolated as a JS *string literal* inside a
   double-quoted inline handler, e.g. onclick="fn('${jsAttr(x)}')".
   HTML entity-encoding (esc) is NOT enough there: the parser decodes it back
   before the JS runs, so a raw ' still breaks out. This escapes for the JS
   string context and keeps the attribute intact. */
const jsAttr = s => (s==null?'':String(s))
  .replace(/&/g,'&amp;')
  .replace(/"/g,'&quot;')
  .replace(/\\/g,'\\\\')
  .replace(/'/g,"\\'")
  .replace(/</g,'\\x3C')
  .replace(/\r?\n/g,'\\n');
function detailParts(title, primary, meta){
  const p = primary ? `<div class="detail-primary">${primary}</div>` : '';
  const m = meta ? `<div class="detail-meta">${meta}</div>` : '';
  return `<div class="detail-title">${title}</div>${p}${m}`;
}
function detailTx(title, primary, meta){
  return `<div class="tx">${detailParts(title, primary, meta)}</div>`;
}
function fieldTx(label, value){
  return `<div class="tx"><div class="k">${label}</div><div class="v">${value}</div></div>`;
}
function showGroup(title, iconHTML, summary, bodyHTML){
  return `<section class="show-group">
    <div class="show-group-head">
      <div class="show-group-ic">${iconHTML}</div>
      <div class="show-group-titles"><b>${esc(title)}</b>${summary?`<span>${esc(summary)}</span>`:''}</div>
    </div>
    <div class="show-group-body">${bodyHTML}</div>
  </section>`;
}
function showSubsection(title, addBtnHTML, bodyHTML){
  return `<div class="show-subsection">
    <div class="show-subsection-head"><span>${esc(title)}</span>${addBtnHTML||''}</div>
    <div class="show-subsection-body">${bodyHTML}</div>
  </div>`;
}
function showSourceLabel(text){
  return `<div class="show-source-label">${esc(text)}</div>`;
}

/* ---------- Logistics items (journey legs on a show) ---------- */
function logisticTypeLabel(l){
  if(!l) return '';
  if(l.kind==='stay') return 'Hotel';
  const ic = l.icon || 'plane';
  if(ic==='plane') return 'Flight';
  if(ic==='car') return 'Driver';
  if(ic==='ferry') return 'Ferry';
  if(ic==='walk') return 'Walk';
  return 'Transfer';
}
function inferIconFromLogisticTitle(title){
  const t = (title||'').toLowerCase();
  if(/ferry|boat/.test(t)) return 'ferry';
  if(/driver|uber|taxi|transfer/.test(t)) return 'car';
  if(/walk/.test(t)) return 'walk';
  return 'plane';
}
function parseLogisticRouteFromLegacy(title){
  if(!title) return null;
  let rest = String(title).replace(/^\[[^\]]*\]\s*-?\s*/,'').trim();
  rest = rest.replace(/^(flight|transfer|ferry|driver|hotel|stay|walk)\s*(?:\d+\s*)?[-–:]\s*/i,'').trim();
  const m = rest.match(/^(.+?)\s*(?:→|->|>|–|-)\s*(.+)$/i);
  if(!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}
function isNormalizedLogisticTitle(title){
  return ['Flight','Hotel','Driver','Ferry','Walk','Transfer'].includes(title);
}
function extractFlightNoFromTitle(title){
  const t = String(title||'');
  const m = t.match(/\b([A-Z]{2,3}\s*\d{2,4}[A-Z]?)\b/i);
  if(!m) return '';
  const code = m[1].replace(/\s/g,'').toUpperCase();
  return /^[A-Z0-9]{2,}\d/.test(code) ? code : '';
}
function extractLegacyLogisticFields(e){
  let source = e.legacyTitle;
  if(!source && e.title && !isNormalizedLogisticTitle(e.title)) source = e.title;
  if(!source) return;
  if(!e.legacyTitle) e.legacyTitle = source;
  const raw = String(source).trim();
  if(!e.icon) e.icon = inferIconFromLogisticTitle(raw);
  const ic = e.icon || 'plane';
  if(!e.from && !e.to){
    const leg = parseLogisticRouteFromLegacy(raw);
    if(leg){
      e.from = leg.from.toUpperCase();
      e.to = leg.to.toUpperCase();
    } else if(ic==='car'){
      let name = raw.replace(/^\[[^\]]*\]\s*-?\s*/,'').replace(/^driver\s*[-–:]?\s*/i,'').trim();
      if(name && !/^transfer$/i.test(name) && !/>|→/.test(name)) e.driverName = name;
    }
  }
  if(!e.flightNo && ic==='plane') e.flightNo = extractFlightNoFromTitle(raw);
}
function extractLegacyStayFields(e){
  let source = e.legacyTitle;
  if(!source && e.title && !isNormalizedLogisticTitle(e.title)) source = e.title;
  if(!source) return;
  if(!e.legacyTitle) e.legacyTitle = source;
  if(!e.place && /^hotel/i.test(source)){
    e.place = String(source).replace(/^\[[^\]]*\]\s*-?\s*/,'').replace(/^hotel\s*[-–:]?\s*/i,'').trim();
  }
}
function unpackLogisticInfoFields(e){
  const raw = e.info;
  if(!raw || typeof raw !== 'string' || raw[0] !== '{') return;
  try{
    const o = JSON.parse(raw);
    if(o.v !== 2) return;
    if(e.kind==='travel'){
      if(o.from) e.from = o.from;
      if(o.to) e.to = o.to;
      if(o.flightNo) e.flightNo = o.flightNo;
      if(o.phone) e.phone = o.phone;
      if(o.whatsapp) e.whatsapp = o.whatsapp;
      if(o.driverName) e.driverName = o.driverName;
      if(o.legacyTitle) e.legacyTitle = o.legacyTitle;
      if(o.gate != null) e.gate = o.gate;
      if(o.terminal != null) e.terminal = o.terminal;
      if(o.fstatus != null) e.fstatus = o.fstatus;
      if(o.delay != null) e.delay = o.delay;
      e.info = o.note || '';
    } else if(e.kind==='stay'){
      if(o.place) e.place = o.place;
      if(o.checkIn != null) e.info = o.checkIn;
      if(o.addr) e.addr = o.addr;
      if(o.bookingRef) e.bookingRef = o.bookingRef;
    }
  }catch(err){}
}
function packLogisticInfo(e){
  if(e.kind==='travel'){
    const has = e.from || e.to || e.flightNo || e.phone || e.whatsapp || e.driverName || e.gate || e.terminal || e.fstatus || e.delay || e.info;
    if(has){
      return JSON.stringify({
        v:2, from:e.from||'', to:e.to||'', flightNo:e.flightNo||'', note:e.info||'',
        phone:e.phone||'', whatsapp:e.whatsapp||'', driverName:e.driverName||'',
        legacyTitle:e.legacyTitle||'',
        gate:e.gate||'', terminal:e.terminal||'', fstatus:e.fstatus||'', delay:e.delay||''
      });
    }
  }
  if(e.kind==='stay' && (e.place || e.addr || e.bookingRef)){
    return JSON.stringify({ v:2, place:e.place||'', checkIn:e.info||'', addr:e.addr||'', bookingRef:e.bookingRef||'' });
  }
  return e.info || null;
}
function normalizeLogisticItem(e){
  if(!e || (e.kind!=='travel' && e.kind!=='stay')) return;
  unpackLogisticInfoFields(e);
  if(e.kind==='travel'){
    extractLegacyLogisticFields(e);
    e.title = logisticTypeLabel(e);
  }
  if(e.kind==='stay'){
    extractLegacyStayFields(e);
    e.title = 'Hotel';
  }
}
function logisticRoute(l){
  if(l.from || l.to) return `${(l.from||'?').toUpperCase()} → ${(l.to||'?').toUpperCase()}`;
  const leg = parseLogisticRouteFromLegacy(l.title);
  if(leg) return `${leg.from} → ${leg.to}`;
  return '';
}
function logisticTimes(l){
  if(l.kind==='stay') return l.info || '';
  if(l.start && l.end) return `${l.start} – ${l.end}`;
  if(l.start) return `Dep ${l.start}`;
  if(l.end) return `Arr ${l.end}`;
  return '';
}
function logisticMetaLine(l){
  const bits = [];
  if(l.kind==='travel' && l.flightNo) bits.push(l.flightNo);
  const t = logisticTimes(l);
  if(t) bits.push(t);
  return bits.join(' · ');
}
function logisticDisplayLines(l){
  normalizeLogisticItem(l);
  if(l.kind==='stay'){
    return { title: logisticTypeLabel(l), primary: l.place || '', meta: [l.info, l.addr].filter(Boolean).join(' · ') };
  }
  const isDrv = (l.icon||'plane')==='car' || !!l.driverName;
  if(isDrv){
    const route = logisticRoute(l);
    return {
      title: 'Driver',
      primary: l.driverName || route,
      meta: [l.driverName && route ? route : '', logisticMetaLine(l)].filter(Boolean).join(' · ')
    };
  }
  return { title: logisticTypeLabel(l), primary: logisticRoute(l), meta: logisticMetaLine(l) };
}
function logisticRowHtml(l){
  const d = logisticDisplayLines(l);
  return detailParts(esc(d.title), d.primary ? esc(d.primary) : '', d.meta ? esc(d.meta) : '');
}
function haptic(){ if(navigator.vibrate) try{navigator.vibrate(8);}catch(e){} }
let toastT;
function toast(msg, icon='check'){
  const t = $('#toast');
  t.innerHTML = `<span class="tic">${ICON[icon]?ICON[icon](18):''}</span>${esc(msg)}`;
  t.classList.add('on'); haptic();
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('on'), 2100);
}
function pad(n){ return String(n).padStart(2,'0'); }
function parseDT(dateStr, timeStr){
  if(!dateStr) return null;
  const [y,m,d] = dateStr.split('-').map(Number);
  let hh=0, mm=0;
  if(timeStr){ [hh,mm] = timeStr.split(':').map(Number); }
  return new Date(y, m-1, d, hh||0, mm||0);
}
/* True set-start time in ms. A set in the small hours (before 06:00) is
   played the morning *after* the show's listed day — a show dated Thursday
   with a 01:00 set actually starts Friday 01:00 — so roll it to the next
   day. Returns null when no set time is entered. */
function setStartMs(dateStr, timeStr){
  if(!timeStr) return null;
  const d = parseDT(dateStr, timeStr);
  if(!d) return null;
  const hh = Number(timeStr.split(':')[0]);
  if(hh < 6) d.setDate(d.getDate() + 1);
  return d.getTime();
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function fmtDate(dstr){
  const d = parseDT(dstr); if(!d) return '';
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}
function fmtDateLong(dstr){
  const d = parseDT(dstr); if(!d) return '';
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function relDay(dstr){
  const d = parseDT(dstr); if(!d) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(d); dd.setHours(0,0,0,0);
  const diff = Math.round((dd - today) / 86400000);
  if(diff === 0) return 'Today';
  if(diff === 1) return 'Tomorrow';
  if(diff === -1) return 'Yesterday';
  if(diff > 1){
    if(diff <= 6) return 'In ' + diff + ' days';
    if(diff <= 28){
      const w = Math.min(4, Math.max(1, Math.round(diff / 7)));
      return 'In ' + w + ' week' + (w === 1 ? '' : 's');
    }
    const mo = Math.round(diff / 30) || 1;
    return 'In ' + mo + ' month' + (mo === 1 ? '' : 's');
  }
  const abs = Math.abs(diff);
  if(abs <= 6) return abs + ' day' + (abs === 1 ? '' : 's') + ' ago';
  if(abs <= 28){
    const w = Math.min(4, Math.max(1, Math.round(abs / 7)));
    return w + ' week' + (w === 1 ? '' : 's') + ' ago';
  }
  if(abs <= 365){
    const mo = Math.round(abs / 30) || 1;
    return mo + ' month' + (mo === 1 ? '' : 's') + ' ago';
  }
  return fmtDate(dstr);
}
function nowMs(){ return Date.now(); }
function countdown(targetMs){
  const diff = targetMs - nowMs();
  if(diff <= 0) return {done:true, txt:'—', unit:''};
  const mins = Math.floor(diff/60000);
  const days = Math.floor(mins/1440);
  const hrs = Math.floor((mins%1440)/60);
  const m = mins%60;
  if(days>0) return {done:false, txt:days+'d '+hrs+'h '+m+'m', unit:''};
  if(hrs>0) return {done:false, txt:hrs+'h '+m+'m', unit:''};
  return {done:false, txt:m+'m', unit:''};
}
function timeAgo(ms){
  const diff = nowMs()-ms;
  const m = Math.floor(diff/60000);
  if(m<1) return 'Just now'; if(m<60) return m+'m ago';
  const h=Math.floor(m/60); if(h<24) return h+'h ago';
  const d=Math.floor(h/24); if(d<7) return d+'d ago';
  return new Date(ms).getDate()+' '+MON[new Date(ms).getMonth()];
}

/* ---------- Selectors (derived data — never duplicated) ---------- */
const sel = {
  isShow: e => (e.kind||'show')==='show',
  events: () => store.events.filter(e=>(e.kind||'show')==='show').sort((a,b)=> (a.date+(a.setTime||'')).localeCompare(b.date+(b.setTime||''))),
  allItems: () => store.events.slice(),
  upcoming: () => {
    const today = new Date(); today.setHours(0,0,0,0);
    return sel.events().filter(e=>{ const d=parseDT(e.date); return d && d>=today && e.status!=='cancelled'; });
  },
  nextEvent: () => sel.upcoming()[0] || null,
  event: id => store.events.find(e=>e.id===id),
  trip: id => store.trips.find(t=>t.id===id),
  trips: () => store.trips.slice().sort((a,b)=> (b.startDate||'').localeCompare(a.startDate||'')),
  activeTrip: () => store.trips.find(t=>t.id===store.activeTripId) || null,
  tripEvents: tid => sel.events().filter(e=>e.tripId===tid),
  ideas: () => store.ideas.slice().sort((a,b)=> b.created-a.created),
  notes: () => store.notes.slice().sort((a,b)=> b.updated-a.updated),
  eventChecklistProgress: e => {
    const items = e.checklist||[]; if(!items.length) return {done:0,total:0,pct:0};
    const done = items.filter(i=>i.done).length;
    return {done, total:items.length, pct:Math.round(done/items.length*100)};
  },
  tripProgress: t => {
    const items = t.checklist||[]; const tl = t.timeline||[];
    const all = items.length + tl.length;
    if(!all) return {pct:0,done:0,total:0};
    const done = items.filter(i=>i.done).length + tl.filter(i=>i.done).length;
    return {pct:Math.round(done/all*100), done, total:all};
  },
};

/* ---------- Money / finance engine (multi-currency) ---------- */
const CURSYM = {GBP:'£',EUR:'€',USD:'$',CHF:'CHF ',AUD:'A$',CAD:'C$',AED:'AED ',SGD:'S$',SEK:'kr ',NOK:'kr ',DKK:'kr ',PLN:'zł ',CZK:'Kč ',ZAR:'R '};
function fxRate(cur){ return (store.settings.fx&&store.settings.fx[cur])||1; }
function toBase(amount, cur){ const base=store.settings.baseCurrency; return (amount||0) * fxRate(cur) / (fxRate(base)||1); }
function fmtMoney(amount, cur){
  const sym = CURSYM[cur]||(cur+' ');
  const n = Math.round(amount||0);
  return sym + n.toLocaleString('en-GB');
}
function fmtBase(amount){ return fmtMoney(amount, store.settings.baseCurrency); }
const money = {
  eventCalc: e => {
    const f = e.finance||{fee:0,currency:store.settings.baseCurrency,expenses:[],perDiem:0,commission:0};
    const cur = f.currency||store.settings.baseCurrency;
    const gross = +f.fee||0;
    const commissionAmt = gross*((+f.commission||0)/100);
    const expenses = (f.expenses||[]).reduce((s,x)=>s+(+x.amount||0),0);
    const perDiem = +f.perDiem||0;
    const net = gross - commissionAmt - expenses + perDiem;
    return {cur, gross, commissionAmt, expenses, perDiem, net,
      grossBase: toBase(gross,cur), netBase: toBase(net,cur), commissionBase: toBase(commissionAmt,cur), expensesBase: toBase(expenses,cur), paid:!!f.paid};
  },
  summary: (events) => {
    events = events || sel.events();
    let grossBase=0, netBase=0, commissionBase=0, expensesBase=0, collectedBase=0, outstandingBase=0;
    const byCur = {}; const upcomingBase = {val:0}; const today=new Date(); today.setHours(0,0,0,0);
    events.forEach(e=>{
      if(e.status==='cancelled') return;
      const c = money.eventCalc(e);
      grossBase+=c.grossBase; netBase+=c.netBase; commissionBase+=c.commissionBase; expensesBase+=c.expensesBase;
      if(c.paid) collectedBase+=c.netBase; else outstandingBase+=c.netBase;
      const d=parseDT(e.date); if(d && d>=today) upcomingBase.val+=c.netBase;
      byCur[c.cur]=(byCur[c.cur]||0)+c.gross;
    });
    return {grossBase, netBase, commissionBase, expensesBase, collectedBase, outstandingBase, upcomingBase:upcomingBase.val, byCur};
  },
};

/* ---------- Tours ("runs") — auto-grouped consecutive shows, no naming ----------
   A run = a maximal group of shows within RUN_GAP days of each other.
   A standalone show is a run of one. Logistics attach to shows, timeline is derived. */
function dayIdx(ds){ const d=parseDT(ds); return d?Math.floor(d.getTime()/86400000):0; }
function homeAirport(){ return (store.settings.homeAirport||'AMS').toUpperCase(); }
/* Strip b2b / bracketed extras from a venue name so the address + map search use the main name only. */
function cleanVenue(v){ v=(v||'').trim(); const c=v.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g,' ').replace(/\s+b2b\b.*$/i,'').replace(/\s{2,}/g,' ').trim(); return c||v; }
/* The artist's money currency follows their home airport: UK airports -> GBP, everywhere else -> EUR. */
const UK_AIRPORTS=['LHR','LGW','STN','LTN','LCY','MAN','BHX','EDI','GLA','BRS','NCL','LPL','LBA','BFS','SEN','EMA','ABZ','CWL','SOU','EXT','GLA','INV','DSA'];
function homeCurrency(){ return UK_AIRPORTS.includes(homeAirport())?'GBP':'EUR'; }
function isHomeFlight(e){
  if(e.kind!=='travel') return false;
  const h = homeAirport();
  if(e.to && String(e.to).toUpperCase() === h) return true;
  return new RegExp('>\\s*'+h+'(\\b|\\))','i').test(e.title||'') || new RegExp('→\\s*'+h+'(\\b|$)','i').test(e.info||'');
}
function dtKey(dateStr,timeStr){ return (dateStr||'')+' '+(timeStr||'00:00'); }
/* Two consecutive shows belong to the same tour only if the days between them are
   all active (travel days, not free days) AND he doesn't return to his home airport
   between them. A free day either side, or a flight home, ends the tour. */
function sameTour(prev, cur, activeDays, homeFlights){
  const a=dayIdx(prev.date), b=dayIdx(cur.date);
  for(let d=a+1; d<b; d++){ if(!activeDays.has(d)) return false; }   // an empty day between = break
  const pKey=dtKey(prev.date, prev.setTime||'23:59'), cKey=dtKey(cur.date, cur.setTime||'23:58');
  for(const f of homeFlights){ const fKey=dtKey(f.date, f.start||'12:00'); if(fKey>pKey && fKey<cKey) return false; }
  return true;
}
function runs(){
  const shows = sel.events(); // shows only, sorted by date
  const activeDays = new Set(); store.events.forEach(e=>activeDays.add(dayIdx(e.date)));
  const homeFlights = store.events.filter(isHomeFlight);
  const out=[]; let cur=null;
  shows.forEach(sh=>{
    if(cur && sameTour(cur.shows[cur.shows.length-1], sh, activeDays, homeFlights)){ cur.shows.push(sh); }
    else { cur={shows:[sh]}; out.push(cur); }
  });
  return out.map(r=>{
    r.key = r.shows[0].id;
    r.start = r.shows[0].date; r.end = r.shows[r.shows.length-1].date;
    r.cities = [...new Set(r.shows.map(s=>s.city).filter(Boolean))];
    r.color = r.shows[0].color || 'green';
    r.title = r.cities.length ? (r.cities.length>3 ? r.cities.slice(0,3).join(' · ')+' +'+(r.cities.length-3) : r.cities.join(' · ')) : (r.shows[0].venue||'Show');
    return r;
  });
}
function runOf(showId){ return runs().find(r=>r.shows.some(s=>s.id===showId)) || null; }
function activeRun(){ return store.activeShowId ? runOf(store.activeShowId) : null; }
/* All logistics + set anchors for a run, chronological — the day-of timeline */
function runTimeline(run){
  const ids = new Set(run.shows.map(s=>s.id));
  const items = store.events.filter(e=> (e.kind==='travel'||e.kind==='stay') && ids.has(e.showId));
  const rows = items.map(e=>{
    normalizeLogisticItem(e);
    const d = logisticDisplayLines(e);
    const sub = e.kind==='travel' ? logisticMetaLine(e) : (e.info||'');
    return {id:e.id, kind:e.kind, date:e.date, time:e.start||(e.info&&(e.info.match(/(\d{1,2}:\d{2})/)||[])[1])||'', title:d.title, sub: e.kind==='travel' ? [d.primary, sub].filter(Boolean).join(' · ') : sub, icon:e.icon||(e.kind==='stay'?'bed':'plane'), done:!!e.done, ref:e};
  });
  // Info entered inside a show's own sections is embedded on the show, not a
  // separate leg — surface it too, unless a leg of that kind already exists.
  const hasPlane = new Set(items.filter(x=>x.kind==='travel' && (x.icon||'plane')==='plane').map(x=>x.showId));
  const hasStay  = new Set(items.filter(x=>x.kind==='stay').map(x=>x.showId));
  const hasCar   = new Set(items.filter(x=>x.kind==='travel' && (x.icon||'plane')==='car').map(x=>x.showId));
  run.shows.forEach(s=>{
    if(!hasPlane.has(s.id) && Array.isArray(s.flights)){
      s.flights.forEach(f=>{
        const parts=String(f.dep||'').trim().split(' ');
        rows.push({id:'shflt_'+f.id, kind:'travel', icon:'plane', date:parts[0]||s.date, time:parts[1]||'',
          title:(f.from&&f.to)?f.from+' → '+f.to:(f.code||'Flight'),
          sub:[f.code, f.seat?'Seat '+f.seat:''].filter(Boolean).join(' · '),
          done:!!f.done, embedded:true, ref:Object.assign({kind:'travel', icon:'plane', showId:s.id, to:f.to, from:f.from, embedded:true}, f)});
      });
    }
    if(!hasStay.has(s.id) && s.hotel && (s.hotel.name||s.hotel.address)){
      rows.push({id:'shhotel_'+s.id, kind:'stay', icon:'bed', date:s.hotel.checkin||s.date, time:'',
        title:s.hotel.name||'Hotel', sub:[s.hotel.address, s.hotel.postcode].filter(Boolean).join(', '),
        done:!!s.hotel.done, embedded:true, ref:{kind:'stay', icon:'bed', showId:s.id, place:s.hotel.name, addr:s.hotel.address, embedded:true}});
    }
    if(!hasCar.has(s.id)){
      showDrivers(s).forEach(d=>{ if(!d.time) return;
        rows.push({id:'shdrv_'+d.id, kind:'travel', icon:'car', date:s.date, time:d.time,
          title:d.journey||(d.noGround?'Transport':(d.name||'Driver')),
          sub:d.noGround?'No grounds — Uber/taxi':[d.name, d.phone].filter(Boolean).join(' · '),
          done:!!d.done, embedded:true, ref:Object.assign({kind:'travel', icon:'car', showId:s.id, embedded:true}, d)});
      });
    }
  });
  run.shows.forEach(s=>{ rows.push({id:'set_'+s.id, kind:'set', date:s.date, time:s.setTime||'', title:s.venue, sub:s.setTime?('Set '+s.setTime+(s.endTime?' - '+s.endTime:'')):'Set TBA', icon:'music', done:!!s.setDone, showId:s.id}); });
  rows.sort((a,b)=>{ if(a.date!==b.date) return a.date.localeCompare(b.date); return itemTimeKey({start:a.time})-itemTimeKey({start:b.time}); });
  return rows;
}
function runProgress(run){
  const tl = runTimeline(run); const pk = store.packing||[];
  const all = tl.length + pk.length; if(!all) return {pct:0,done:0,total:0};
  const done = tl.filter(r=>r.done).length + pk.filter(p=>p.done).length;
  return {pct:Math.round(done/all*100), done, total:all};
}

/* ---------- Account types (roles) ---------- */
const ACCOUNT_TYPES = {
  dj:      {label:'DJ / Artist',  icon:'music',  desc:'You perform. Your shows, travel & content.'},
  manager: {label:'Manager',      icon:'user',   desc:'You manage an artist’s career & schedule.'},
  tm:      {label:'Tour Manager', icon:'map',    desc:'You run logistics on the road.'},
  agent:   {label:'Agent',        icon:'trend',  desc:'You book shows & handle deals.'},
};
function acct(){ return ACCOUNT_TYPES[store.settings.accountType]||ACCOUNT_TYPES.dj; }

/* ---------- Collapsible state ---------- */
let folds = {}; // id -> open(bool)
function isOpen(id, def){ return folds[id]===undefined ? !!def : folds[id]; }
function toggleFold(id){ folds[id] = !folds[id]; haptic();
  const el=document.getElementById('fold-'+id); if(el){ el.classList.toggle('open'); } }
function foldSection(id, iconHTML, title, sub, bodyHTML, defOpen, cls){
  const open = isOpen(id, defOpen);
  return `<div class="fold ${open?'open':''} ${cls||''}" id="fold-${id}">
    <div class="fold-head" onclick="toggleFold('${id}')">
      <div class="ic" style="background:var(--card-2)">${iconHTML}</div>
      <div class="ft"><b>${esc(title)}</b>${sub?`<span>${esc(sub)}</span>`:''}</div>
      <span class="fold-chev">${ICON.chevDown?ICON.chevDown(20):ICON.chevR(20)}</span>
    </div>
    <div class="fold-body"><div class="fold-inner">${bodyHTML}</div></div>
  </div>`;
}

/* ---------- Security / passcode lock ---------- */
let session = { appUnlocked:false, financeUnlocked:false };
function pinHash(pin){ let h=5381; for(const c of String(pin)) h=((h<<5)+h+c.charCodeAt(0))>>>0; return 'h'+h; }
function secOn(){ const s=store.settings.security; return s&&s.enabled&&s.pin; }
function appLockActive(){ return secOn() && store.settings.security.scope==='app' && !session.appUnlocked; }
function financeLockActive(){ const s=store.settings.security; if(!secOn()) return false;
  if(s.scope==='app') return !session.appUnlocked;      // app lock already covers finance
  if(s.scope==='finance') return !session.financeUnlocked;
  return false;
}
let pinBuf='', pinPurpose=null, pinResolve=null;
function renderLock(purpose){
  pinPurpose=purpose; pinBuf='';
  const isSetup = purpose==='setup';
  const s=store.settings.security;
  const title = isSetup? 'Create a passcode' : (purpose==='app'?'Operate locked':'Finance locked');
  const sub = isSetup? 'Enter a 4-digit passcode' : 'Enter your passcode to continue';
  const bio = !isSetup && s.biometric;
  const el=$('#lock');
  el.innerHTML = `
    <div class="lock-logo"><svg width="42" height="42" viewBox="0 0 1024 1024" fill="none" stroke="#fff" stroke-linecap="round"><circle cx="512" cy="512" r="232" stroke-width="72"/><path d="M 446 512 L 578 512" stroke-width="46"/></svg></div>
    <div class="lock-title">${title}</div>
    <div class="lock-sub">${sub}</div>
    <div class="pin-dots" id="pin-dots">${[0,1,2,3].map(i=>`<i></i>`).join('')}</div>
    <div class="pad">
      ${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" onclick="pinKey('${n}')">${n}</button>`).join('')}
      <div class="key blank"></div>
      <button class="key" onclick="pinKey('0')">0</button>
      <button class="key act" onclick="pinDel()">⌫</button>
    </div>
    ${bio?`<button class="lock-bio" onclick="biometricUnlock()">${ICON.face(18)} Unlock with Face ID</button>`:''}
    ${(!isSetup && appLockActive())?'':''}
  `;
  el.classList.add('on');
  if(bio) setTimeout(()=>biometricUnlock(true), 350);
}
function pinKey(n){
  if(pinBuf.length>=4) return;
  pinBuf+=n; haptic(); paintDots();
  if(pinBuf.length===4) setTimeout(pinSubmit, 120);
}
function pinDel(){ pinBuf=pinBuf.slice(0,-1); paintDots(); }
function paintDots(){ const d=$('#pin-dots'); if(!d) return; [...d.children].forEach((c,i)=>c.classList.toggle('f', i<pinBuf.length)); }
function pinSubmit(){
  const s=store.settings.security;
  if(pinPurpose==='setup'){
    if(pinSetupFirst===null){ pinSetupFirst=pinBuf; pinBuf=''; paintDots();
      $('#lock .lock-title').textContent='Confirm passcode'; $('#lock .lock-sub').textContent='Re-enter to confirm'; return; }
    if(pinBuf===pinSetupFirst){ s.pin=pinHash(pinBuf); s.enabled=true; persist(); pinSetupFirst=null; closeLock(); toast('Passcode set','check'); if(pinResolve){pinResolve(true);pinResolve=null;} }
    else { pinSetupFirst=null; pinBuf=''; shakeDots(); $('#lock .lock-title').textContent='Create a passcode'; $('#lock .lock-sub').textContent="Didn't match — try again"; }
    return;
  }
  if(pinHash(pinBuf)===s.pin){
    if(pinPurpose==='app'){ session.appUnlocked=true; session.financeUnlocked=true; }
    if(pinPurpose==='finance'){ session.financeUnlocked=true; }
    closeLock(); if(pinResolve){pinResolve(true);pinResolve=null;} else render();
  } else { pinBuf=''; shakeDots(); }
}
let pinSetupFirst=null;
function shakeDots(){ const d=$('#pin-dots'); if(d){ d.classList.add('err'); setTimeout(()=>{d.classList.remove('err'); paintDots();},400); } }
function closeLock(){ $('#lock').classList.remove('on'); $('#lock').innerHTML=''; }
function lockFinanceNow(){ session.financeUnlocked=false; if(store.settings.security.scope==='app') session.appUnlocked=false; overlay=null; store.tab='home'; render(); toast('Finance locked','lock'); }
function requireUnlock(purpose, cb){
  if(purpose==='finance' && !financeLockActive()){ cb(); return; }
  pinResolve=(ok)=>{ if(ok) cb(); };
  renderLock(purpose);
}
async function biometricUnlock(silent){
  const s=store.settings.security;
  try{
    if(!window.PublicKeyCredential || !navigator.credentials){ if(!silent) toast('Use your passcode','x'); return; }
    // Best-effort platform authenticator assertion; falls back to passcode on any failure.
    const cred = await navigator.credentials.get({ publicKey:{
      challenge: Uint8Array.from('artisthq-'+Date.now(), c=>c.charCodeAt(0)),
      timeout: 20000, userVerification:'required', allowCredentials:[]
    }}).catch(()=>null);
    if(cred){ if(pinPurpose==='app'){session.appUnlocked=true;session.financeUnlocked=true;} else session.financeUnlocked=true; closeLock(); if(pinResolve){pinResolve(true);pinResolve=null;}else render(); }
    else if(!silent) toast('Use your passcode','x');
  }catch(e){ if(!silent) toast('Use your passcode','x'); }
}

/* ---------- Seed data (demo tour so the app feels alive) ---------- */
function seed(){
  const s = { _seq:1, activeTripId:null, activeShowId:null, tab:'home',
    settings:{ artistName:'You', packingTemplate:['Passport','USBs','Headphones','Power Bank','Chargers','Camera','SD Cards','Laptop','IEMs'],
      baseCurrency:'EUR',
      fx:{GBP:1, EUR:0.85, USD:0.79, CHF:0.88, AUD:0.52, CAD:0.58, AED:0.215, SGD:0.59, SEK:0.075, NOK:0.075, DKK:0.114, PLN:0.20, CZK:0.034, ZAR:0.043},
      billing:{name:'', address:'', taxId:'', iban:'', email:''},
      invoicePrefix:'AHQ', invoiceSeq:1, invoiceTerms:14,
      accountType:'dj', homeAirport:'AMS',
      security:{ enabled:false, pin:'', scope:'finance', biometric:false } },
    artists:[{id:'art_1',name:'You'}],
    events:[], trips:[], ideas:[], notes:[], drivers:[], hotels:[], contacts:[], invoices:[],
    itineraries:[], packing:[]
  };
  store = s;
  // ---- builders ----
  const parseCity = title => { const p=title.split(' - '); return p.length>1 ? p[p.length-1].trim() : ''; };
  /* Estimated placeholder fee — region-aware currency, tiered by type. Edit per show. */
  const UKC=['birmingham','manchester','newcastle','london','leeds','sheffield','brighton','nottingham','edinburgh','bristol','liverpool','isle of wight','isle of weight','belfast'];
  const USC=['new york','la','dallas','chicago','miami','denver','san diego','orlando'];
  const AMER=['medellin','lima','peru','montevideo'];
  function estFee(title,city){
    const c=(city||'').toLowerCase(); const t=(title||'').toLowerCase();
    let cur='EUR';
    if(UKC.some(x=>c.includes(x))) cur='GBP';
    else if(USC.some(x=>c.includes(x))) cur='USD';
    else if(AMER.some(x=>c.includes(x))) cur='USD';
    const fest=/festival|creamfields|hard summer|arc|crssd|fly|caposile|rise|boiler room|ants|wonderland|eastern electrics|audio obscura|smaakmarkt|hide & seek/;
    const big=/hï|hi ibiza|fuse|space|fabric|printworks|watergate|ushua|elsewhere|mission ballroom|elixir|cntrl/;
    let base = fest.test(t)?12000 : big.test(t)?8000 : 4500;
    if(cur==='GBP') base=Math.round(base*0.82/500)*500;
    if(cur==='USD') base=Math.round(base*1.05/500)*500;
    return {fee:base, currency:cur};
  }
  function show(date,title,start,end,color){
    const city=parseCity(title);
    const venue = city ? title.slice(0, title.length-city.length-3).trim() : title;
    const ef=estFee(title,city);
    s.events.push({ id:uid('evt'), kind:'show', artist:'You', tripId:null,
      status: color==='orange'?'hold':'confirmed', color:(color==='orange'?'orange':'green'),
      venue, city, country:'', date, setTime:start||'', endTime:end||'', arrival:'',
      venueAddr:'', hotel:null, flights:[], driver:null, promoter:null, notes:'', content:'',
      checklist:[], timeline:[], attachments:[],
      finance:{fee:ef.fee, currency:ef.currency, dealType:'Guarantee', expenses:[], perDiem:0, commission:10, paid:false, estimated:true} });
  }
  function trav(date,title,start,end,icon){ s.events.push({id:uid('evt'),kind:'travel',date,title,start:start||'',end:end||'',icon:icon||'plane'}); }
  const fly=(d,t,s1,e1)=>trav(d,t,s1,e1,'plane');
  const car=(d,t,s1,e1)=>trav(d,t,s1,e1,'car');
  const boat=(d,t,s1,e1)=>trav(d,t,s1,e1,'ferry');
  function stay(date,title,info){ s.events.push({id:uid('evt'),kind:'stay',date,title,info:info||'',icon:'bed'}); }
  function mark(date,title){ s.events.push({id:uid('evt'),kind:'marker',date,title,allDay:true}); }

  /* ===== Real tour schedule (imported from ABOSS) ===== */
  // July 2026
  fly('2026-07-17','FLIGHT - AMS > SOU','17:25','17:35');
  car('2026-07-17','[UBER] - Southampton Airport > Terminal','18:00','18:30');
  boat('2026-07-17','FERRY - Southampton to East Cowes','20:00','21:00');
  stay('2026-07-17','HOTEL - Prince of Wales','Check-in: 21:00');
  car('2026-07-17','DRIVER - Ferry Terminal > Hotel','21:00','21:10');
  car('2026-07-17','DRIVER - Hotel > Venue','22:45','23:00');
  show('2026-07-17','WYTWOODS - Isle of Wight','23:30','01:00','green');
  car('2026-07-17','DRIVER - Venue > Hotel','01:00','01:30');
  car('2026-07-18','WALK - Hotel > Ferry Terminal','05:30','05:45');
  boat('2026-07-18','FERRY - East Cowes to Southampton','06:30','07:30');
  fly('2026-07-18','FLIGHT - SOU > AMS','09:15','11:25');
  show('2026-07-18','Open Air Smaakmarkt - Nijmegen','21:30','23:00','green');
  fly('2026-07-21','FLIGHT - AMS > ZTH','06:05','10:15');
  car('2026-07-21','DRIVER - Airport > Hotel','10:15','10:30');
  stay('2026-07-21','HOTEL - Tzante','Check-in: 15:00');
  car('2026-07-21','DRIVER - Hotel > Venue','00:30','00:35');
  show('2026-07-21','Wonderland Zakynthos (b2b Laidlaw)','01:00','03:30','green');
  car('2026-07-21','DRIVER - Venue > Hotel','03:30','03:35');
  car('2026-07-22','DRIVER - Hotel > Airport','06:45','07:00');
  fly('2026-07-22','FLIGHT 1 - ZTH > MXP','08:35','10:00');
  stay('2026-07-22','HOTEL - Tzante','Check-out: 10:30');
  fly('2026-07-22','FLIGHT 2 - MXP > IBZ','13:40','15:40');
  stay('2026-07-22','[WES + JAKE] - HOTEL - Core Hotel','Check-in: 14:00');
  stay('2026-07-23','[WES + JAKE] - HOTEL - Core Hotel','Full day');
  mark('2026-07-23','JAKE WORKING');
  show('2026-07-23','Solid Grooves - Ibiza','','','green');
  fly('2026-07-23','[JAKE FLIGHT] - MAN > IBZ','15:05','18:50');
  mark('2026-07-24','JAKE WORKING');
  stay('2026-07-24','HOTEL - Weston Mannor','TBA');
  fly('2026-07-24','[WES + JAKE] - FLIGHT - IBZ > BHX','11:35','13:15');
  stay('2026-07-24','[WES + JAKE] - HOTEL - Core Hotel','Check-out: 12:00');
  show('2026-07-24','AB - Hide & Seek - Birmingham','18:00','21:00','green');
  mark('2026-07-25','JAKE WORKING');
  fly('2026-07-25','[WES + JAKE] FLIGHT - MAN > MUC','10:35','13:35');
  show('2026-07-25','Praterinsel - Munich','18:00','20:00','green');
  stay('2026-07-26','HOTEL - Weston Mannor','TBA');
  fly('2026-07-26','[WES + JAKE] - FLIGHT - MUC > MAN','08:45','09:50');
  show('2026-07-26','Hide & Seek - Birmingham','15:30','17:00','green');
  mark('2026-07-26','JAKE WORKING');
  fly('2026-07-27','FLIGHT - BHX > AMS','13:25','15:35');
  mark('2026-07-28','DEADLINE CO:BRAND, TRACKS AANLEVEREN');
  fly('2026-07-30','[JAKE FLIGHT] - MAN > AMS','05:55','08:20');
  fly('2026-07-30','[WES + JAKE] FLIGHT - AMS > JFK','10:10','12:32');
  show('2026-07-31','Elsewhere - New York','01:00','03:00','green');
  show('2026-07-31','USA TOUR','','','green');
  // August 2026
  fly('2026-08-01','[WES + JAKE] FLIGHT - JFK > LAX','11:00','13:49');
  stay('2026-08-01','HOTEL - Los Angeles Airport Marriott','Check-in: 14:00');
  show('2026-08-01','Hard Summer - LA','16:00','17:00','green');
  stay('2026-08-02','HOTEL - Los Angeles Airport Marriott','Check-out: 11:00');
  fly('2026-08-02','[WES + JAKE] FLIGHT - LAX > AMS','13:50','09:05');
  fly('2026-08-03','[JAKE FLIGHT 2] - AMS > MAN','12:50','13:15');
  mark('2026-08-04','Teaser video shoot Utrecht');
  mark('2026-08-06','Teaser video shoot Amsterdam');
  fly('2026-08-09','FLIGHT - AMS > LCY (London City)','10:15','10:45');
  stay('2026-08-09','HOTEL - Hampton by Hilton London','Check-in: 14:00');
  show('2026-08-09','Eastern Electrics - London','17:00','19:30','green');
  fly('2026-08-10','FLIGHT - LCY > AMS','10:00','12:10');
  fly('2026-08-13','FLIGHT - AMS > TFS','14:55','18:55');
  show('2026-08-13','Monkey Club - Tenerife','01:30','03:30','green');
  fly('2026-08-14','WES FLIGHT - TFS > BFS','12:25','16:50');
  fly('2026-08-14','JAKE FLIGHT - MAN > BHD','15:30','16:25');
  stay('2026-08-14','HOTEL - Fitzwilliam Hotel Belfast','19:00 - 20:00');
  show('2026-08-14','Custom House Square - Belfast','19:00','20:00','green');
  show('2026-08-14','Limelight - Belfast','00:30','02:30','green');
  fly('2026-08-15','[WES] FLIGHT - BHD > AMS','09:50','12:25');
  fly('2026-08-15','[JAKE FLIGHT] - BFS > MAN','11:05','12:10');
  stay('2026-08-16','HOTEL - Ocean Drive, Talamanca','TBA');
  fly('2026-08-16','FLIGHT - AMS > IBZ','13:35','16:10');
  show('2026-08-16','AB - FUSE - 528 Ibiza','17:30','20:00','green');
  fly('2026-08-17','FLIGHT - IBZ > AMS','16:55','19:30');
  fly('2026-08-19','FLIGHT - AMS > MAD','11:00','13:40');
  fly('2026-08-19','FLIGHT - MAD > MDE','16:40','20:05');
  show('2026-08-20',"Hi I'm Sci - Medellin",'01:00','03:30','green');
  fly('2026-08-21','FLIGHT - MDE > BOG','10:40','11:35');
  fly('2026-08-21','FLIGHT - BOG > LIM','13:30','16:30');
  show('2026-08-22','Damian Club - Lima, Peru','','','green');
  fly('2026-08-23','FLIGHT - LIM > MVD','23:50','06:25');
  show('2026-08-24','KEY - Montevideo','01:00','03:00','green');
  mark('2026-08-25','Teaser video 1');
  fly('2026-08-25','FLIGHT - MAD > AMS','07:05','09:40');
  fly('2026-08-25','FLIGHT - MVD > MAD','12:20','05:10');
  show('2026-08-28','Societe - Scheveningen','23:30','01:00','green');
  show('2026-08-29','Onder de Radar - Enschede','18:30','20:30','green');
  fly('2026-08-30','FLIGHT - AMS > MAN','10:20','10:40');
  show('2026-08-30','Creamfields - Manchester','19:30','21:00','green');
  show('2026-08-30','Mint - Leeds','01:00','03:00','green');
  mark('2026-08-31','HOME');
  fly('2026-08-31','FLIGHT - MAN > AMS','11:00','13:20');
  // September 2026
  mark('2026-09-01','ARTWORK RELEASE 1 DEADLINE');
  fly('2026-09-01','FLIGHT - AMS > IBZ','12:20','14:55');
  stay('2026-09-01','HOTEL - Ocean Drive, Talamanca','Check-in: 14:00');
  show('2026-09-01','PIV - Ibiza','23:00','00:30','green');
  mark('2026-09-02','teaser video 2');
  stay('2026-09-02','HOTEL - Ocean Drive, Talamanca','Check-out: 11:00');
  fly('2026-09-02','FLIGHT - IBZ > AMS','16:05','18:45');
  show('2026-09-03','USA TOUR','','','green');
  fly('2026-09-03','[WES + MARIEKE FLIGHT] - AMS > DFW','10:55','14:10');
  show('2026-09-04','CNTRL Room - Dallas','','','green');
  mark('2026-09-05','OFF CHICAGO');
  fly('2026-09-05','[WES + MARIEKE FLIGHT] - DFW > ORD','13:10','15:55');
  show('2026-09-06','ARC Festival - Chicago','15:00','16:00','green');
  fly('2026-09-06','[WES + MARIEKE] - ORD > MIA','18:59','23:11');
  show('2026-09-06','Space - Miami','','','green');
  fly('2026-09-08','[WES + MARIEKE] - MIA > AMS','16:55','07:40');
  mark('2026-09-11','1st release?');
  show('2026-09-12','FLY Festival - Edinburgh','16:00','17:30','green');
  show('2026-09-13','BRET ALL DAY LONG - Amsterdam','','','green');
  fly('2026-09-18','FLIGHT - AMS > MLA','07:00','10:00');
  show('2026-09-18','Fuse - Malta (BOAT)','12:00','15:00','green');
  show('2026-09-18','AB - FUSE Malta','22:00','00:00','green');
  show('2026-09-19','Mas Tiempo - Hi Ibiza','','','green');
  stay('2026-09-19','HOTEL - Ocean Drive Talamanca','Check-in: 14:00');
  stay('2026-09-20','HOTEL - Ocean Drive Talamanca','Check-out: 12:00');
  show('2026-09-25','Mission Ballroom - Denver','','','green');
  show('2026-09-26','CRSSD - San Diego','','','green');
  show('2026-09-27','Elixir - Orlando','','','green');
  // October 2026
  show('2026-10-02','After Caposile - Ibiza','03:00','04:00','green');
  mark('2026-10-05','sleuteloverdracht');
  show('2026-10-09','Fabric - London','','','green');
  show('2026-10-10','USS - Manchester','01:00','03:00','green');
  show('2026-10-16','Circolo - Rome','02:00','04:00','green');
  show('2026-10-17','il Muretto - Venice','01:30','03:00','green');
  show('2026-10-21','Modern Funktion ADE - Amsterdam','00:30','02:00','green');
  show('2026-10-23','Georgia Records - Nottingham','','','orange');
  show('2026-10-24','Audio Obscura - Amsterdam','','','orange');
  show('2026-10-25','Raw Cutz - Amsterdam','','','orange');
  show('2026-10-26','Slapfunk - ADE (AB)','','','green');
  show('2026-10-31','Slapfunk - Leeds','19:00','21:00','green');
  // November 2026
  show('2026-11-06','Caposile Festival - Verona','23:30','01:00','green');
  show('2026-11-07','Club Colette - Birmingham','','','orange');
  show('2026-11-07','subcultuur - nijmegen','','','orange');
  show('2026-11-13','On & On - Utrecht','01:00','03:00','green');
  show('2026-11-14','Tank - Sheffield','01:00','03:00','green');
  show('2026-11-15','Boiler Room Amsterdam','','','orange');
  show('2026-11-20','La Java - Paris','','','orange');
  show('2026-11-21','ANTS - Birmingham','','','orange');
  show('2026-11-21','Quarters - Brighton','03:30','05:00','green');
  show('2026-11-27','WHP - Manchester','','','orange');
  show('2026-11-27','NX - Newcastle','','','orange');
  show('2026-11-27','Herfstdrift - Nijmegen','','','green');
  show('2026-11-28','La Java - Paris','','','orange');
  show('2026-11-28','Hot Creations - Newcastle','','','orange');
  show('2026-11-29','AB - Slapfunk Manchester Nowhere','','','orange');
  // December 2026
  show('2026-12-05','(NIGHT) Modern Funktion - Liverpool','','','green');
  show('2026-12-05','(DAY) Modern Funktion Bristol','','','green');
  show('2026-12-09','RISE Festival - Alpes','21:00','22:30','green');

  s.ideas = [];
  s.notes = [];
  s.contacts = [];
  s.invoices = [];
  s.packing = s.settings.packingTemplate.map(x=>({id:uid('pk'),label:x,done:false}));
  assignLogistics();
  persist();
}
/* Attach each flight/hotel/driver to the show it belongs to (nearest show, preferring the upcoming one). */
function assignLogistics(){
  const shows = store.events.filter(e=>(e.kind||'show')==='show');
  if(!shows.length) return;
  const dayNum = ds => { const d=parseDT(ds); return d?Math.floor(d.getTime()/86400000):0; };
  store.events.forEach(e=>{
    if((e.kind||'show')==='show' || e.kind==='marker') return;
    const ed = dayNum(e.date);
    let best=null, bestDiff=1e9;
    shows.forEach(sh=>{ const diff=Math.abs(dayNum(sh.date)-ed);
      if(diff<bestDiff || (diff===bestDiff && sh.date>=e.date)){ bestDiff=diff; best=sh; } });
    e.showId = best?best.id:null;
  });
}
function snapshotPreLogisticsBackup(){
  try{
    if(localStorage.getItem(DB_BACKUP_KEY)) return;
    const raw = localStorage.getItem(DB_KEY);
    if(!raw || !/(FLIGHT|DRIVER|HOTEL|FERRY)\s*[-–]/i.test(raw)) return;
    localStorage.setItem(DB_BACKUP_KEY, raw);
  }catch(e){}
}
function logisticsMatchKey(e){
  const icon = e.kind==='stay' ? 'bed' : (e.icon || 'plane');
  return `${e.date}|${e.start||''}|${e.end||''}|${icon}|${e.kind}`;
}
function logisticsNeedsRecovery(e){
  if(e.kind==='stay') return isNormalizedLogisticTitle(e.title) && !e.place;
  if(e.kind==='travel'){
    if(!isNormalizedLogisticTitle(e.title)) return false;
    return !(e.from||e.to||e.flightNo||e.driverName);
  }
  return false;
}
function recoverLogisticsMetadata(){
  let n = 0;
  try{
    const bak = localStorage.getItem(DB_BACKUP_KEY);
    if(bak){
      const old = JSON.parse(bak);
      const byId = {};
      (old.events||[]).forEach(o=>{ if(o.id) byId[o.id]=o; });
      store.events.forEach(e=>{
        if(e.kind!=='travel' && e.kind!=='stay') return;
        const o = byId[e.id];
        if(!o) return;
        if(o.title && !isNormalizedLogisticTitle(o.title)){
          e.legacyTitle = o.title; n++;
        }
        if(o.passes?.length && (!e.passes||!e.passes.length)){
          e.passes = JSON.parse(JSON.stringify(o.passes)); n++;
        }
      });
    }
  }catch(err){}
  if(typeof buildTourLogisticsCatalog === 'function'){
    const byKey = {};
    buildTourLogisticsCatalog().forEach(row=>{
      const k = `${row.date}|${row.start||''}|${row.end||''}|${row.icon}|${row.kind}`;
      (byKey[k]=byKey[k]||[]).push(row);
    });
    store.events.forEach(e=>{
      if(!logisticsNeedsRecovery(e)) return;
      const hits = byKey[logisticsMatchKey(e)];
      if(!hits || hits.length!==1) return;
      if(!e.legacyTitle) e.legacyTitle = hits[0].title;
      if(e.kind==='stay' && hits[0].info && !e.info) e.info = hits[0].info;
      n++;
    });
  }
  return n;
}
function restoreMissingLogistics(){
  const n = recoverLogisticsMetadata();
  store.events.forEach(e=>{ if(e.kind==='travel'||e.kind==='stay') normalizeLogisticItem(e); });
  if(store.events.some(e=>(e.kind==='travel'||e.kind==='stay') && e.showId===undefined)) assignLogistics();
  persist();
  renderView();
  toast(n ? `Restored details on ${n} journey item${n>1?'s':''}` : 'No extra journey details found to restore','check');
}
/* Forward-compat: backfill fields added in later versions */
function migrate(){
  const s=store.settings;
  if(!s.fx) s.fx={GBP:1,EUR:0.85,USD:0.79};
  if(!s.baseCurrency) s.baseCurrency='GBP';
  if(!s.homeAirport) s.homeAirport='AMS';
  if(s.baseCurrencyAuto!==false) s.baseCurrency=homeCurrency();   // drive currency from home airport unless user overrode it
  if(!s.billing) s.billing={name:'',address:'',taxId:'',iban:'',email:''};
  if(!s.invoicePrefix) s.invoicePrefix='AHQ';
  if(s.invoiceSeq==null) s.invoiceSeq=1;
  if(s.invoiceTerms==null) s.invoiceTerms=14;
  if(!store.contacts) store.contacts=[];
  if(!store.reminders) store.reminders=[];
  if(!store.invoices) store.invoices=[];
  if(!store.itineraries) store.itineraries=[];
  if(!s.accountType) s.accountType='dj';
  if(!s.homeAirport) s.homeAirport='AMS';
  if(!s.security) s.security={enabled:false,pin:'',scope:'finance',biometric:false};
  if(!store.packing) store.packing = (s.packingTemplate||[]).map(x=>({id:uid('pk'),label:x,done:false}));
  store.events.forEach(e=>{ if((e.kind||'show')==='show' && !e.finance) e.finance={fee:0,currency:s.baseCurrency,dealType:'Guarantee',expenses:[],perDiem:0,commission:0,paid:false}; });
  store.events.forEach(e=>{ if((e.kind||'show')==='show'){ showDrivers(e); e.driver = e.drivers.find(d=>!d.noGround) || null; } });
  snapshotPreLogisticsBackup();
  recoverLogisticsMetadata();
  store.events.forEach(e=>{ if(e.kind==='travel'||e.kind==='stay') normalizeLogisticItem(e); });
  if(store.events.some(e=>(e.kind==='travel'||e.kind==='stay') && e.showId===undefined)) assignLogistics();
  persist();
}
