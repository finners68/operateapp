/* Operate — Supabase sync (V2-native entity state + composed view projections) */
const ORG_KEY = 'operate_org_id';
const MIGRATION_PREFIX = 'operate_supabase_migrated:';
const BUCKET = STORAGE_BUCKET;
/* Boarding pass uploads: photos, PDFs, and real Apple Wallet .pkpass files. */
const PASS_FILE_ACCEPT = 'image/*,application/pdf,.pkpass,application/vnd.apple.pkpass';
window.PASS_FILE_ACCEPT = PASS_FILE_ACCEPT;

let currentOrgId = null;
let dbRemoteLoading = false;
let dbSyncInProgress = false;
let lastPushAt = 0;
const PUSH_ECHO_MS = 3000;
const signedUrlCache = new Map(); // path -> { url, exp }

function getStoredOrgId(){ try{ return localStorage.getItem(ORG_KEY); }catch(e){ return null; } }
function setStoredOrgId(id){ try{ localStorage.setItem(ORG_KEY, id); }catch(e){} currentOrgId = id; }
function migrationKey(orgId){ return MIGRATION_PREFIX + orgId; }
function isMigrated(orgId){ return !!localStorage.getItem(migrationKey(orgId)); }
function markMigrated(orgId){ try{ localStorage.setItem(migrationKey(orgId), '1'); }catch(e){} }

/* A content signature of the store, not just row counts — so a remote change
   that edits a field (a leg's date/time, a driver, a hotel, a done-toggle)
   without adding/removing rows still registers as "changed" and re-renders.
   Counting rows alone missed those edits, so pulled changes never appeared. */
function storeSnapshot(){
  if(!store) return '';
  let h = 5381;
  const add = s => { s = String(s==null?'':s); for(let i=0;i<s.length;i++) h = ((h*33) ^ s.charCodeAt(i)) >>> 0; };
  const v2 = store.v2 || {};
  add((v2.shows||[]).length); add((v2.journeys||[]).length); add((v2.tours||[]).length);
  (store.events||[]).forEach(e=>{
    add(e.id); add(e.date); add(e.start); add(e.end); add(e.setTime); add(e.endTime);
    add(e.title); add(e.venue); add(e.venueAddr); add(e.venueAddr2); add(e.venueRegion); add(e.venuePostcode); add(e.city); add(e.info); add(e.from); add(e.to);
    add(e.setDone?1:0); add(e.done?1:0); add(e.notes);
    if(e.promoter){ add(e.promoter.name); add(e.promoter.phone); add(e.promoter.whatsapp); }
    (e.contacts||[]).forEach(c=>{ add(c.id); add(c.name); add(c.role); add(c.phone); add(c.whatsapp); });
    (e.drivers||[]).forEach(d=>{ add(d.journey); add(d.time); add(d.phone); add(d.name); add(d.noGround?1:0); });
    (e.flights||[]).forEach(f=>{ add(f.id); add(f.from); add(f.to); add(f.dep); add(f.code); });
    if(e.hotel){ add(e.hotel.name); add(e.hotel.postcode); add(e.hotel.address); }
  });
  (store.ideas||[]).forEach(x=>{ add(x.id); add(x.title); add(x.done?1:0); });
  (store.notes||[]).forEach(x=>{ add(x.id); add(x.updated); add(x.body); });
  (store.trips||[]).forEach(t=>{ add(t.id); add(t.name); add(t.start); add(t.end); });
  /* Omit store._seq — it bumps on every push and was forcing quiet remounts
     even when visible data did not change. */
  return (store.events?.length||0) + '|' + (store.ideas?.length||0) + '|' + (store.notes?.length||0) + '|' + h;
}

function dedupeEventsById(events){
  const seen = new Set();
  return events.filter(e => {
    if(seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

function mimeToKind(m){
  m = (m || '').toLowerCase();
  if(m.startsWith('image/')) return 'image';
  if(m === 'application/vnd.apple.pkpass' || m.includes('pkpass')) return 'pkpass';
  return 'pdf';
}
function mimeFromPassKind(kind){
  if(kind === 'pdf') return 'application/pdf';
  if(kind === 'image') return 'image/jpeg';
  if(kind === 'pkpass') return 'application/vnd.apple.pkpass';
  return kind || 'application/octet-stream';
}
function isPkPass(p){
  if(!p) return false;
  if(p.kind === 'pkpass') return true;
  const mime = (p.mime || '').toLowerCase();
  if(mime === 'application/vnd.apple.pkpass' || mime.includes('pkpass')) return true;
  return ((p.name || '').toLowerCase()).endsWith('.pkpass');
}
function findPassByRef(itemId, passId, flightId){
  if(flightId){
    const e = sel.event(itemId);
    const f = e && e.flights && e.flights.find(x => x.id === flightId);
    if(!f) return null;
    if(typeof ensureFlightPassengers === 'function') ensureFlightPassengers(f);
    const direct = (f.passes || []).find(x => x.id === passId);
    if(direct) return direct;
    for(const pax of (f.passengers || [])){
      const hit = (pax.passes || []).find(x => x.id === passId);
      if(hit) return hit;
    }
    return null;
  }
  const it = store.events.find(x => x.id === itemId);
  return it && (it.passes || []).find(x => x.id === passId);
}
function passStoragePath(p){
  if(!p) return null;
  if(p._storagePath) return p._storagePath;
  const d = p.data;
  if(typeof d === 'string' && d && !d.startsWith('data:') && !d.startsWith('http')) return d;
  return null;
}
function serializePassForSync(p){
  const path = passStoragePath(p);
  return { id: p.id, name: p.name || null, kind: p.kind || 'image', _storagePath: path };
}
function passFromFileRow(f){
  return {
    id: f.legacy_id, name: f.name, kind: mimeToKind(f.mime_type),
    _storagePath: f.storage_path, data: f.storage_path
  };
}
function mergePassesById(...lists){
  const m = new Map();
  lists.flat().forEach(p => { if(p && p.id) m.set(p.id, p); });
  return [...m.values()];
}
function passHasDisplayData(p){
  if(!p) return false;
  if(p._storagePath) return true;
  if(p._idb) return true;
  const d = p.data;
  return typeof d === 'string' && d.length > 0 && (d.startsWith('data:') || d.startsWith('http'));
}

/* ============================================================
   Local blob store (IndexedDB). Image/PDF bytes must NOT live in the single
   localStorage JSON blob — one photo can blow iOS Safari's ~5MB quota, which
   made setItem throw and silently drop the whole save (lost boarding passes).
   The main store keeps only metadata; the bytes live here (large quota).
   ============================================================ */
const IDB_DB='operate-blobs', IDB_STORE='blobs'; let _idbP;
function _idb(){
  if(_idbP) return _idbP;
  _idbP = new Promise((res,rej)=>{ try{
    const r=indexedDB.open(IDB_DB,1);
    r.onupgradeneeded=()=>{ try{ r.result.createObjectStore(IDB_STORE); }catch(e){} };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  }catch(e){ rej(e); } });
  return _idbP;
}
function idbSet(key,val){ return _idb().then(db=>new Promise((res,rej)=>{ const t=db.transaction(IDB_STORE,'readwrite'); t.objectStore(IDB_STORE).put(val,key); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); })).catch(()=>{}); }
function idbGet(key){ return _idb().then(db=>new Promise((res)=>{ const t=db.transaction(IDB_STORE,'readonly'); const rq=t.objectStore(IDB_STORE).get(key); rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>res(null); })).catch(()=>null); }
/* Visit every image/PDF attachment across the store. */
function eachBlobAtt(state, fn){
  (state && state.events || []).forEach(e=>{
    (e.attachments||[]).forEach(fn);
    (e.passes||[]).forEach(fn);
    (e.flights||[]).forEach(f=>{
      (f.passes||[]).forEach(fn);
      (f.passengers||[]).forEach(pax=>(pax.passes||[]).forEach(fn));
    });
  });
  (state && state.itineraries || []).forEach(it=>(it.imgs||[]).forEach(fn));
}
/* Copy any base64 bytes into IndexedDB and mark the attachment so we know to
   rehydrate it. The `_idb` flag (which authorises db.write's replacer to strip
   the base64 from the localStorage copy) is only set AFTER IndexedDB confirms
   the write committed. Until then the base64 stays in localStorage, so a pass
   captured moments before the app is closed can never fall into a gap where it
   is stripped from localStorage but not yet durable in IndexedDB. */
function stashBlobs(state){
  const jobs = [];
  eachBlobAtt(state, att=>{
    if(att && att.id && typeof att.data==='string' && att.data.startsWith('data:') && !att._idbSaved){
      att._idbSaved = 'pending';   // dedupe: don't re-stash on a concurrent write
      jobs.push(
        idbSet(att.id, att.data)
          .then(()=>{ att._idb = true; att._idbSaved = true; })
          .catch(()=>{ att._idbSaved = false; })   // keep base64 in localStorage as the durable copy
      );
    }
  });
  if(jobs.length){
    // Once the bytes are safely in IndexedDB, re-persist so the now-redundant
    // base64 is dropped from the (quota-limited) localStorage copy.
    Promise.all(jobs).then(()=>{ try{ db.write(state); }catch(e){} });
  }
}
/* Pull bytes back out of IndexedDB into the in-memory store after a reload. */
function rehydrateBlobs(state){
  const jobs=[]; eachBlobAtt(state, att=>{ if(att && att._idb && (!att.data || !att.data.startsWith('data:'))){ jobs.push(idbGet(att.id).then(d=>{ if(d) att.data=d; })); } });
  return Promise.all(jobs);
}
function mergePassesKeepLocal(remoteList, localList){
  const merged = mergePassesById(remoteList, localList);
  const localById = new Map((localList || []).filter(p => p && p.id).map(p => [p.id, p]));
  return merged.map(p => {
    const local = localById.get(p.id);
    if(!local) return p;
    if(passHasDisplayData(p)) return p;
    if(!passHasDisplayData(local)) return p;
    return { ...p, data: local.data, _storagePath: p._storagePath || local._storagePath };
  });
}
function applyLocalPassMerge(prevEvents, nextEvents){
  if(!prevEvents?.length || !nextEvents?.length) return nextEvents;
  const prevById = new Map(prevEvents.map(e => [e.id, e]));
  nextEvents.forEach(e => {
    const prev = prevById.get(e.id);
    if(!prev) return;
    if(e.kind === 'travel' || e.kind === 'stay'){
      e.passes = mergePassesKeepLocal(e.passes || [], prev.passes || []);
    }
    if((e.kind || 'show') === 'show' && e.flights && prev.flights){
      const prevFl = new Map(prev.flights.map(f => [f.id, f]));
      e.flights.forEach(f => {
        const pf = prevFl.get(f.id);
        if(!pf) return;
        if(typeof ensureFlightPassengers === 'function'){
          ensureFlightPassengers(pf);
          ensureFlightPassengers(f);
        }
        const prevPax = new Map((pf.passengers || []).map(p => [p.id, p]));
        (f.passengers || []).forEach(pax => {
          const pp = prevPax.get(pax.id);
          if(pp) pax.passes = mergePassesKeepLocal(pax.passes || [], pp.passes || []);
        });
        (pf.passengers || []).forEach(pp => {
          if(!(f.passengers || []).some(p => p.id === pp.id) && (pp.passes || []).length){
            (f.passengers = f.passengers || []).push(Object.assign({}, pp, {
              passes: mergePassesKeepLocal([], pp.passes || [])
            }));
          }
        });
        /* After passenger merge, do not keep a pooled top-level copy. */
        f.passes = [];
      });
    }
  });
  return nextEvents;
}
async function attachPassToLogisticsItem(itemId, att){
  const it = store.events.find(x => x.id === itemId);
  if(!it || !att) return false;
  (it.passes = it.passes || []).push(att);
  if(syncActive()) await ensurePassUploaded(att, it.showId || it.id, it.id);
  const scopeId = it.showId || it.id;
  if(it.kind === 'travel' || it.kind === 'stay' || it.kind === 'marker'){
    if(typeof pushLogisticsNow === 'function') pushLogisticsNow(it.kind, it.id);
    else persist(it.kind === 'stay' ? 'hotel_bookings' : (it.kind === 'marker' ? 'schedule_items' : 'journeys'), it.id);
  } else {
    persist('shows', scopeId);
  }
  renderView();
  return true;
}
async function attachPassToShowFlight(showId, flightId, att, passengerId){
  const e = sel.event(showId);
  const f = e && e.flights && e.flights.find(x => x.id === flightId);
  if(!f || !att) return false;
  if(typeof ensureFlightPassengers === 'function') ensureFlightPassengers(f);
  const draft = (typeof flightSheetPaxDraft === 'function' && passengerId)
    ? (flightSheetPaxDraft(passengerId) || { name: '', seat: '' })
    : { name: '', seat: '' };
  let pax = (f.passengers || []).find(p => p.id === passengerId);
  if(!pax && passengerId){
    /* Edit-sheet "Add person" creates a row before Save. Create that passenger
       now so the pass attaches under them — not under passenger #1. */
    pax = { id: passengerId, name: draft.name || '', seat: draft.seat || '', passes: [] };
    (f.passengers = f.passengers || []).push(pax);
  } else if(!pax){
    if(!(f.passengers || []).length){
      f.passengers = [{ id: uid('pax'), name: '', seat: f.seat || '', passes: [] }];
      f.seat = '';
    }
    pax = f.passengers[0];
  } else {
    if(draft.name) pax.name = draft.name;
    if(draft.seat) pax.seat = draft.seat;
  }
  (pax.passes = pax.passes || []).push(att);
  att._passengerId = pax.id;
  /* Keep flight-level passes empty when passengers own the passes. */
  f.passes = [];
  if(syncActive()) await ensurePassUploaded(att, showId, flightId);
  persist('shows', showId);
  if(typeof pushShowNow === 'function') pushShowNow(showId);
  renderView();
  if(typeof refreshFlightSheetPaxPasses === 'function'){
    refreshFlightSheetPaxPasses(showId, flightId, pax.id);
  }
  return true;
}
function openPassByRef(itemId, passId, flightId){
  const p = findPassByRef(itemId, passId, flightId);
  if(!p){ toast('Pass not found','x'); return; }
  sheetBoardingPass(itemId, passId, flightId || '');
}
async function sheetBoardingPass(itemId, passId, flightId){
  const p = findPassByRef(itemId, passId, flightId);
  if(!p){ toast('Pass not found','x'); return; }
  if(passHasDisplayData(p)) await resolveAttachment(p);
  const pk = isPkPass(p);
  const isImg = p.kind === 'image' && !pk;
  const name = esc(p.name || (pk ? 'Apple Wallet pass' : 'Boarding pass'));
  const args = `'${itemId}','${passId}','${flightId || ''}'`;
  const preview = isImg && p.data
    ? `<div class="thumb" style="width:100%;height:180px;margin-bottom:12px" onclick="viewPassImage(${args})"><img src="${esc(p.data)}" alt=""></div>`
    : `<div class="hint" style="text-align:left;padding:0 2px 12px">${ICON.ticket(18)} ${name}</div>`;
  openSheetReact('Boarding pass', 'boardingPass.details', { itemId, passId, flightId, pass: p });
}
async function viewPassImage(itemId, passId, flightId){
  const p = findPassByRef(itemId, passId, flightId);
  if(!p){ toast('Pass not found','x'); return; }
  await resolveAttachment(p);
  if(p.data) openViewer(p.data);
  else toast('Pass not found','x');
}
async function passFileBlob(p){
  await resolveAttachment(p);
  if(!p || !p.data) return null;
  const mime = p.mime || mimeFromPassKind(p.kind) || 'application/octet-stream';
  if(p.data.startsWith('data:')){
    const res = await fetch(p.data);
    let blob = await res.blob();
    if(isPkPass(p) && blob.type !== 'application/vnd.apple.pkpass'){
      blob = new Blob([blob], { type: 'application/vnd.apple.pkpass' });
    } else if(!blob.type || blob.type === 'application/octet-stream'){
      blob = new Blob([blob], { type: mime });
    }
    return blob;
  }
  if(p.data.startsWith('http')){
    try{
      const res = await fetch(p.data);
      let blob = await res.blob();
      if(isPkPass(p) && blob.type !== 'application/vnd.apple.pkpass'){
        blob = new Blob([blob], { type: 'application/vnd.apple.pkpass' });
      }
      return blob;
    }catch(e){ return null; }
  }
  return null;
}
async function downloadPassFile(itemId, passId, flightId){
  const p = findPassByRef(itemId, passId, flightId);
  if(!p){ toast('Pass not found','x'); return; }
  const blob = await passFileBlob(p);
  if(!blob){
    await resolveAttachment(p);
    if(p.data && p.data.startsWith('http')){ window.open(p.data, '_blank', 'noopener'); return; }
    toast('Could not open pass','x'); return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = p.name || (isPkPass(p) ? 'boarding-pass.pkpass' : 'boarding-pass');
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
  toast('Opening pass','file');
}
async function sharePassFile(itemId, passId, flightId){
  const p = findPassByRef(itemId, passId, flightId);
  if(!p){ toast('Pass not found','x'); return; }
  const blob = await passFileBlob(p);
  if(!blob || !navigator.share){ downloadPassFile(itemId, passId, flightId); return; }
  const file = new File([blob], p.name || (isPkPass(p) ? 'boarding-pass.pkpass' : 'boarding-pass'), { type: blob.type || mimeFromPassKind(p.kind) });
  try{
    if(navigator.canShare && !navigator.canShare({ files:[file] })){ downloadPassFile(itemId, passId, flightId); return; }
    await navigator.share({ files:[file], title: p.name || 'Boarding pass' });
  }catch(e){ if(e && e.name !== 'AbortError') downloadPassFile(itemId, passId, flightId); }
}
async function addPassToAppleWallet(itemId, passId, flightId){
  const p = findPassByRef(itemId, passId, flightId);
  if(!p || !isPkPass(p)){
    toast('Only .pkpass files can go in Apple Wallet','x');
    return;
  }
  await resolveAttachment(p);
  /* iOS opens real .pkpass URLs into Add to Wallet. Prefer the hosted file URL
     (correct content-type from upload); fall back to a typed blob URL. */
  if(p.data && p.data.startsWith('http')){
    window.location.href = p.data;
    return;
  }
  const blob = await passFileBlob(p);
  if(!blob){ toast('Could not open pass','x'); return; }
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.apple.pkpass' }));
  window.location.href = url;
  setTimeout(()=>URL.revokeObjectURL(url), 10000);
}
async function ensurePassUploaded(att, showLegacyId, parentLegacyId){
  if(!att) return null;
  const existing = passStoragePath(att);
  if(existing){ att._storagePath = existing; return existing; }
  if(!att.data || !att.data.startsWith('data:')) return null;
  if(!isSupabaseConfigured() || !currentOrgId) return null;
  try{
    const up = await uploadFileDataUrl(att.data, showLegacyId || parentLegacyId, 'pass', att.id, parentLegacyId, {
      kind: att.kind,
      mime: att.mime || mimeFromPassKind(att.kind)
    });
    att._storagePath = up.path;
    att.data = up.url;
    if(up.mime) att.mime = up.mime;
    return up.path;
  }catch(e){ return null; }
}
async function uploadPassForLogisticsItem(itemId, att){
  const it = store.events.find(x => x.id === itemId);
  if(!it || !att) return;
  const path = await ensurePassUploaded(att, it.showId || it.id, it.id);
  if(path){
    if(typeof pushLogisticsNow === 'function') pushLogisticsNow(it.kind || 'travel', it.id);
    else persist(it.kind === 'stay' ? 'hotel_bookings' : 'journeys', it.id);
    renderView();
  }
}

function hostImg(att, showLegacyId, fileRole, parentLegacyId){
  if(!isSupabaseConfigured() || !currentOrgId) return;
  if(!att || typeof att.data !== 'string' || !att.data.startsWith('data:')) return;
  const logItem = parentLegacyId && store.events.find(x => x.id === parentLegacyId && (x.kind === 'travel' || x.kind === 'stay'));
  if(fileRole === 'pass' && logItem){
    uploadPassForLogisticsItem(parentLegacyId, att).catch(()=>{});
    return;
  }
  uploadFileDataUrl(att.data, showLegacyId, fileRole || 'attachment', att.id, parentLegacyId)
    .then(({ path, url }) => {
      att.data = url; att._storagePath = path;
      if(fileRole === 'itinerary' || showLegacyId === 'itineraries' || showLegacyId === 'itinerary'){
        persist('user_preferences');
      } else {
        persist('shows', showLegacyId || parentLegacyId);
      }
    })
    .catch(() => {});
}

async function signedUrlForPath(path){
  if(!path || path.startsWith('data:') || path.startsWith('http')) return path;
  const hit = signedUrlCache.get(path);
  if(hit && hit.exp > Date.now() + 60000) return hit.url;
  const sb = getSupabase();
  if(!sb) return path;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if(error) return path;
  signedUrlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3500000 });
  return data.signedUrl;
}

async function resolveAttachment(att){
  if(!att) return att;
  if(att._storagePath) att.data = await signedUrlForPath(att._storagePath);
  else if(att._idb && (!att.data || !att.data.startsWith('data:'))){ const d = await idbGet(att.id); if(d) att.data = d; }
  else if(att.data && !att.data.startsWith('data:') && !att.data.startsWith('http'))
    att.data = await signedUrlForPath(att.data);
  return att;
}

async function uploadFileDataUrl(dataUrl, showLegacyId, fileRole, legacyId, parentLegacyId, opts){
  const sb = getSupabase();
  if(!sb || !currentOrgId) throw new Error('no_client');
  let blob = await (await fetch(dataUrl)).blob();
  const forcedMime = opts && opts.mime;
  const kindHint = opts && opts.kind;
  if(forcedMime && blob.type !== forcedMime){
    blob = new Blob([blob], { type: forcedMime });
  } else if(kindHint === 'pkpass' || (blob.type||'').includes('pkpass')){
    blob = new Blob([blob], { type: 'application/vnd.apple.pkpass' });
  }
  const type = (blob.type || '').toLowerCase();
  const ext = type.includes('pkpass') ? 'pkpass'
    : (type.includes('pdf') ? 'pdf'
    : ((type.split('/')[1]) || 'jpg'));
  let path;
  if(fileRole === 'pass'){
    /* New uploads go under {org}/boarding-passes/{parent}/...
       Existing files keep their old stored paths and still resolve. */
    path = v2StoragePathBoardingPass(currentOrgId, parentLegacyId || showLegacyId, legacyId, ext);
  } else if(showLegacyId === 'itineraries'){
    path = v2StoragePathOrg(currentOrgId, legacyId, ext);
  } else {
    path = v2StoragePathShow(currentOrgId, showLegacyId || 'general', legacyId, ext);
  }
  const contentType = blob.type || mimeFromPassKind(kindHint) || 'application/octet-stream';
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    upsert: true, contentType
  });
  if(error) throw error;
  const url = await signedUrlForPath(path);
  return { path, url, mime: contentType };
}

async function ensureOrgForUser(){
  /* No-login mode: pick stored hardcoded org, or default to the first (JAKE). */
  if(isDevHardwireMode()){
    const orgs = getHardcodedOrgs();
    const stored = getStoredOrgId();
    const match = orgs.find(o => o.id === stored) || orgs[0];
    setStoredOrgId(match.id);
    if(store) store.organisationName = match.name;
    return match.id;
  }

  const sb = getSupabase();
  const user = await getAuthUser();
  if(!sb || !user) throw new Error('no_auth');
  if(!isAllowedUser(user)) throw new Error('wrong_user');

  /* Membership decides the org when signed in. */
  const stored = getStoredOrgId();
  if(stored){
    const { data: ok } = await sb.from(V2_TABLES.members).select('organisation_id')
      .eq('organisation_id', stored).eq('user_id', user.id).maybeSingle();
    if(ok){ currentOrgId = stored; return stored; }
  }

  const { data: memberships } = await sb.from(V2_TABLES.members)
    .select('organisation_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1);
  if(memberships && memberships.length){
    setStoredOrgId(memberships[0].organisation_id);
    return memberships[0].organisation_id;
  }

  if(getAllowedUserId() || getFixedOrgId()) throw new Error('not_linked_to_dev_org');

  let newOrgId = null;
  const { data: rpcOrg, error: rpcErr } = await sb.rpc(V2_RPC.createOrg, { p_organisation_name: 'My Tour' });
  if(!rpcErr && rpcOrg){
    newOrgId = rpcOrg;
  } else {
    const { data: org, error: orgErr } = await sb.from(V2_TABLES.organisations)
      .insert({ organisation_name: 'My Tour', created_by_user_id: user.id })
      .select('id').single();
    if(orgErr) throw orgErr;
    await sb.from(V2_TABLES.members).insert({
      organisation_id: org.id, user_id: user.id, member_role: 'owner'
    });
    await sb.from(V2_TABLES.settings).insert({ organisation_id: org.id });
    newOrgId = org.id;
  }

  setStoredOrgId(newOrgId);
  return newOrgId;
}

async function fetchOrganisationName(orgId){
  if(!orgId) return '';
  const hardcoded = typeof getHardcodedOrgName === 'function' ? getHardcodedOrgName(orgId) : '';
  if(hardcoded){
    if(store && store.organisationId === orgId) store.organisationName = hardcoded;
    return hardcoded;
  }
  const sb = getSupabase();
  if(!sb) return '';
  const { data } = await sb.from(V2_TABLES.organisations)
    .select('organisation_name').eq('id', orgId).maybeSingle();
  const name = (data && data.organisation_name) || '';
  if(name){
    if(typeof window !== 'undefined'){
      window.__operateOrgNameCache = window.__operateOrgNameCache || {};
      window.__operateOrgNameCache[orgId] = name;
    }
    if(store && store.organisationId === orgId) store.organisationName = name;
  }
  return name;
}

/* Instant notepad write-through. Does not wait for the full tour sync queue. */
const _notePushSeq = Object.create(null);
const _notePushInflight = Object.create(null);

function noteFolderRowFromView(folder){
  if(!folder || !folder.id) return null;
  return {
    id: folder.id,
    organisation_id: currentOrgId,
    legacy_id: null,
    folder_name: (folder.name || '').trim() || 'Folder',
    sort_order: folder.sortOrder || 0
  };
}

function noteRowFromView(note){
  if(!note || !note.id) return null;
  const folderId = note.folderId
    || (typeof sel !== 'undefined' && sel.noteFolderByName ? sel.noteFolderByName(note.folder)?.id : null)
    || null;
  const folder = folderId
    ? ((typeof sel !== 'undefined' && sel.noteFolder ? sel.noteFolder(folderId)?.name : null) || note.folder || null)
    : null;
  return {
    id: note.id,
    organisation_id: currentOrgId,
    legacy_id: null,
    note_title: note.title || '',
    note_body: note.body || '',
    folder_id: folderId,
    folder_name: folder,
    updated_at: note.updated ? new Date(note.updated).toISOString() : new Date().toISOString()
  };
}

async function pushNoteFolderNow(folder){
  if(!folder || !folder.id) return false;
  const id = folder.id;
  if(typeof syncActive === 'function' && !syncActive()){
    if(typeof markDirty === 'function') markDirty('note_folders', id);
    return false;
  }
  const sb = getSupabase();
  if(!sb || !currentOrgId){
    if(typeof markDirty === 'function') markDirty('note_folders', id);
    return false;
  }
  const latest = (store.noteFolders || []).find(f => f.id === id) || folder;
  const row = noteFolderRowFromView(latest);
  if(!row) return false;
  if(typeof syncSetStatus === 'function') syncSetStatus('syncing');
  const { data, error } = await sb.from(V2_TABLES.noteFolders)
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .maybeSingle();
  if(error){
    console.error('pushNoteFolderNow', error);
    if(typeof markDirty === 'function') markDirty('note_folders', id);
    if(typeof syncSetStatus === 'function') syncSetStatus('error');
    if(typeof toast === 'function') toast('Folder not saved to cloud', 'x');
    if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry(800);
    return false;
  }
  if(data && typeof v2RepoPatchLocal === 'function') v2RepoPatchLocal('note_folders', data);
  if(typeof subtractDirty === 'function' && store?._dirty){
    const snap = Object.create(null);
    snap.note_folders = new Set([id]);
    subtractDirty(store._dirty, snap);
  }
  if(typeof syncSetStatus === 'function') syncSetStatus('synced');
  if(typeof syncMarkLastSync === 'function') syncMarkLastSync();
  lastPushAt = Date.now();
  return true;
}

async function pushNoteNow(note){
  if(!note || !note.id) return false;
  const id = note.id;
  if(typeof syncActive === 'function' && !syncActive()){
    if(typeof markDirty === 'function') markDirty('notes', id);
    return false;
  }
  const sb = getSupabase();
  if(!sb || !currentOrgId){
    if(typeof markDirty === 'function') markDirty('notes', id);
    return false;
  }
  _notePushSeq[id] = (_notePushSeq[id] || 0) + 1;
  const mySeq = _notePushSeq[id];
  /* Latest-wins: wait for any in-flight write, then only the newest seq continues. */
  if(_notePushInflight[id]){
    try{ await _notePushInflight[id]; }catch(e){}
  }
  if(mySeq !== _notePushSeq[id]) return false;

  const run = (async () => {
    const latest = (store.notes || []).find(n => n.id === id) || note;
    if(!latest.folderId && latest.folder && typeof sel !== 'undefined' && sel.noteFolderByName){
      const f = sel.noteFolderByName(latest.folder);
      if(f){
        latest.folderId = f.id;
        latest.folder = f.name || latest.folder;
      }
    }
    /* Ensure folder row exists in cloud before note FK upsert. */
    if(latest.folderId){
      const folder = (store.noteFolders || []).find(f => f.id === latest.folderId);
      if(folder) await pushNoteFolderNow(folder);
    }
    const row = noteRowFromView(latest);
    if(!row) return false;
    if(typeof syncSetStatus === 'function') syncSetStatus('syncing');
    const { data, error } = await sb.from(V2_TABLES.notes)
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .maybeSingle();
    if(error){
      console.error('pushNoteNow', error);
      if(typeof markDirty === 'function') markDirty('notes', id);
      if(typeof syncSetStatus === 'function') syncSetStatus('error');
      if(typeof toast === 'function') toast('Note not saved to cloud', 'x');
      if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry(800);
      return false;
    }
    if(data && typeof v2RepoPatchLocal === 'function') v2RepoPatchLocal('notes', data);
    if(typeof subtractDirty === 'function' && store?._dirty){
      const snap = Object.create(null);
      snap.notes = new Set([id]);
      subtractDirty(store._dirty, snap);
    }
    if(typeof syncSetStatus === 'function') syncSetStatus('synced');
    if(typeof syncMarkLastSync === 'function') syncMarkLastSync();
    lastPushAt = Date.now();
    return true;
  })();
  _notePushInflight[id] = run;
  try{
    return await run;
  }finally{
    if(_notePushInflight[id] === run) delete _notePushInflight[id];
  }
}

async function deleteNoteNow(id){
  if(!id) return false;
  if(typeof syncActive === 'function' && !syncActive()){
    if(typeof markDirty === 'function') markDirty('notes', id);
    return false;
  }
  const sb = getSupabase();
  if(!sb || !currentOrgId){
    if(typeof markDirty === 'function') markDirty('notes', id);
    return false;
  }
  if(typeof syncSetStatus === 'function') syncSetStatus('syncing');
  const { error } = await sb.from(V2_TABLES.notes)
    .delete()
    .eq('organisation_id', currentOrgId)
    .eq('id', id);
  if(error){
    console.error('deleteNoteNow', error);
    if(typeof markDirty === 'function') markDirty('notes', id);
    if(typeof syncSetStatus === 'function') syncSetStatus('error');
    if(typeof toast === 'function') toast('Note delete not saved to cloud', 'x');
    return false;
  }
  if(typeof v2RepoRemoveLocal === 'function') v2RepoRemoveLocal('notes', id);
  if(typeof subtractDirty === 'function' && store?._dirty){
    const snap = Object.create(null);
    snap.notes = new Set([id]);
    subtractDirty(store._dirty, snap);
  }
  if(typeof syncSetStatus === 'function') syncSetStatus('synced');
  if(typeof syncMarkLastSync === 'function') syncMarkLastSync();
  lastPushAt = Date.now();
  return true;
}

function persistNoteLocal(note){
  if(!store || !note) return;
  if(!store.notes) store.notes = [];
  const i = store.notes.findIndex(x => x.id === note.id);
  if(i >= 0) store.notes[i] = note;
  else store.notes.push(note);
  if(typeof v2RepoPatchLocal === 'function' && currentOrgId){
    v2RepoPatchLocal('notes', {
      id: note.id,
      organisation_id: currentOrgId,
      note_title: note.title || '',
      note_body: note.body || '',
      folder_id: note.folderId || null,
      folder_name: note.folder || null,
      updated_at: note.updated ? new Date(note.updated).toISOString() : null
    });
  }
  db.write(store);
}

function persistNoteFolderLocal(folder){
  if(!store || !folder) return;
  if(!store.noteFolders) store.noteFolders = [];
  const i = store.noteFolders.findIndex(x => x.id === folder.id);
  if(i >= 0) store.noteFolders[i] = folder;
  else store.noteFolders.push(folder);
  if(typeof v2RepoPatchLocal === 'function' && currentOrgId){
    v2RepoPatchLocal('note_folders', {
      id: folder.id,
      organisation_id: currentOrgId,
      folder_name: folder.name || '',
      sort_order: folder.sortOrder || 0
    });
  }
  if(typeof markDirty === 'function') markDirty('note_folders', folder.id);
  db.write(store);
}

/* Flush only currently dirty scopes immediately (day-to-day / offline catch-up). */
async function flushDirtyNow(){
  if(typeof syncActive === 'function' && !syncActive()) return false;
  if(!currentOrgId) return false;
  /* Never push on top of a cloud reload — that raced and re-uploaded empty
     key-contact lists after load replaced store.events mid-edit. */
  if(dbRemoteLoading || dbSyncInProgress){
    if(typeof syncDirty !== 'undefined') syncDirty = true;
    if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry(300);
    return false;
  }
  if(typeof syncTimer !== 'undefined') clearTimeout(syncTimer);
  if(typeof syncDirty !== 'undefined') syncDirty = true;
  await pushToSupabase(currentOrgId);
  return true;
}

async function pushIdeaNow(idea){
  if(!idea || !idea.id) return false;
  if(typeof markDirty === 'function') markDirty('ideas', idea.id);
  db.write(store);
  return flushDirtyNow();
}
async function deleteIdeaNow(id){
  if(!id) return false;
  if(typeof markDirty === 'function') markDirty('ideas', id);
  db.write(store);
  if(typeof syncActive === 'function' && syncActive() && currentOrgId){
    const sb = getSupabase();
    if(sb){
      const { error } = await sb.from(V2_TABLES.ideas).delete().eq('organisation_id', currentOrgId).eq('id', id);
      if(error){
        console.error('deleteIdeaNow', error);
        if(typeof toast === 'function') toast('Idea delete not saved to cloud', 'x');
        return false;
      }
      if(typeof v2RepoRemoveLocal === 'function') v2RepoRemoveLocal('ideas', id);
      if(typeof subtractDirty === 'function' && store?._dirty){
        const snap = Object.create(null);
        snap.ideas = new Set([id]);
        subtractDirty(store._dirty, snap);
      }
      if(typeof syncSetStatus === 'function') syncSetStatus('synced');
      if(typeof syncMarkLastSync === 'function') syncMarkLastSync();
      return true;
    }
  }
  return flushDirtyNow();
}
async function pushShowNow(showId){
  if(!showId) return false;
  if(typeof markDirty === 'function') markDirty('shows', showId);
  db.write(store);
  return flushDirtyNow();
}
/* Wait until the client-minted show UUID is actually in the local V2 cache
   (meaning upsert to Supabase finished). Used before Make so webhook + DB match. */
async function ensureShowSyncedToCloud(showId, opts){
  const timeoutMs = (opts && opts.timeoutMs) || 25000;
  if(!showId) return false;
  if(typeof markDirty === 'function') markDirty('shows', showId);
  db.write(store);
  const have = () => !!(store?.v2?.shows || []).some(sh => sh && sh.id === showId);
  if(have()) return true;
  if(typeof syncActive === 'function' && !syncActive()) return false;
  if(!currentOrgId) return false;
  const start = Date.now();
  while(Date.now() - start < timeoutMs){
    if(have()) return true;
    if(!dbRemoteLoading && !dbSyncInProgress){
      if(typeof syncDirty !== 'undefined') syncDirty = true;
      try{ await pushToSupabase(currentOrgId); }
      catch(e){ console.error('ensureShowSyncedToCloud', e); }
    } else {
      await new Promise(r => setTimeout(r, 250));
    }
    if(have()) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return have();
}
async function pushTourNow(tourId){
  if(!tourId) return false;
  if(typeof markDirty === 'function') markDirty('tours', tourId);
  db.write(store);
  return flushDirtyNow();
}
async function pushContactNow(contactId){
  if(!contactId) return false;
  if(typeof markDirty === 'function') markDirty('contacts', contactId);
  db.write(store);
  return flushDirtyNow();
}
async function pushInvoiceNow(invoiceId){
  if(!invoiceId) return false;
  if(typeof markDirty === 'function') markDirty('invoices', invoiceId);
  db.write(store);
  return flushDirtyNow();
}
async function pushLogisticsNow(kind, id){
  if(!id) return false;
  const table = kind === 'stay' ? 'hotel_bookings'
    : kind === 'marker' ? 'schedule_items'
    : 'journeys';
  if(typeof markDirty === 'function') markDirty(table, id);
  db.write(store);
  return flushDirtyNow();
}

async function pushToSupabase(orgId){
  if(!orgId || !store) return;
  const sb = getSupabase();
  if(!sb) return;
  /* If a push is already running, mark dirty so the in-flight push loops
     once more — never start a second overlapping push. */
  if(dbSyncInProgress || dbRemoteLoading){
    if(typeof syncDirty !== 'undefined') syncDirty = true;
    if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry(300);
    return;
  }
  if(typeof syncTimer !== 'undefined') clearTimeout(syncTimer);
  dbSyncInProgress = true;
  syncSetStatus('syncing');
  try{
    let loops = 0;
    do {
      if(typeof syncDirty !== 'undefined') syncDirty = false;
      let dirtySnap = (typeof cloneDirty === 'function') ? cloneDirty(store._dirty) : null;
      /* Full sync is explicit only. Clear the flag immediately so a scoped
         push cannot loop into a second whole-tour rewrite (that was
         duplicating venues/shows whenever anything was added). */
      if(store._forceFullSync){
        dirtySnap = { '*': '*' };
        store._forceFullSync = false;
      } else if(typeof isEmptyDirty === 'function' && isEmptyDirty(dirtySnap)){
        break;
      }
      await pushToSupabaseV2(orgId, dirtySnap);
      if(typeof subtractDirty === 'function' && dirtySnap) subtractDirty(store._dirty, dirtySnap);
      else if(typeof clearDirty === 'function') clearDirty();
      db.write(store);
      loops += 1;
      /* Cap tight loops; leftover dirty is handled in finally via retry. */
    } while(
      loops < 5 && (
        (typeof syncDirty !== 'undefined' && syncDirty) ||
        (typeof isEmptyDirty === 'function' && !isEmptyDirty(store._dirty))
      )
    );
    syncSetStatus('synced');
    syncMarkLastSync();
    lastPushAt = Date.now();
    if(typeof syncRetryDelay !== 'undefined') syncRetryDelay = 0;
  }catch(e){
    console.error('pushToSupabase', e);
    syncSetStatus('error');
    if(typeof syncDirty !== 'undefined') syncDirty = true;
    if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry();
    const msg = (e && e.message) ? String(e.message) : 'Sync failed';
    if(typeof toast === 'function') toast(msg.length > 80 ? 'Cloud sync failed — see console' : msg, 'x');
  }finally{
    dbSyncInProgress = false;
    /* Edits that landed after the last loop check (while this flag was still
       true) only set syncDirty — queueSync bails and never arms a timer.
       Always kick a follow-up push if anything is still dirty. */
    if(typeof syncDirty !== 'undefined' && syncDirty && typeof scheduleSyncRetry === 'function'){
      scheduleSyncRetry(300);
    }
  }
}

async function loadFromSupabase(orgId){
  const sb = getSupabase();
  if(!sb || !orgId) return;
  dbRemoteLoading = true;
  try{
    await loadFromSupabaseV2(orgId, sb);
  }finally{
    dbRemoteLoading = false;
    /* Edits saved during the reload are kept in _dirty — push them now that
       we are no longer blocked by dbRemoteLoading. */
    const hasDirty = (typeof isEmptyDirty === 'function')
      ? !isEmptyDirty(store && store._dirty)
      : false;
    if(hasDirty && typeof syncActive === 'function' && syncActive()){
      if(typeof syncDirty !== 'undefined') syncDirty = true;
      if(typeof flushDirtyNow === 'function') flushDirtyNow();
      else if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry(200);
    }
  }
}

async function bootstrapRemoteData(){
  const orgId = await ensureOrgForUser();
  currentOrgId = orgId;
  if(typeof clearLegacyLocalStore === 'function') clearLegacyLocalStore();
  const local = db.read();
  const sb = getSupabase();
  /* Default false: if the count check fails, load cloud instead of uploading a
     fresh local copy (which was creating duplicate shows/venues). */
  let cloudEmpty = false;
  if(sb){
    const { count, error } = await sb.from(V2_TABLES.shows)
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', orgId);
    if(!error) cloudEmpty = !count;
    else console.warn('bootstrap show count failed — preferring cloud load', error);
  }
  /* Prefer cloud. Only seed-push when cloud is empty AND local cache already
     belongs to this org — never upload another org's local tour by mistake. */
  const localIsV2 = !!(local && local.v2);
  const localMatchesOrg = !!(local && local.organisationId && local.organisationId === orgId);
  const pushLocal = localIsV2 && local?.events?.length && cloudEmpty && localMatchesOrg &&
    (!isMigrated(orgId) || isDevHardwireMode());
  if(pushLocal){
    store = local;
    if(!store.v2) store.v2 = emptyV2Collections();
    if(store.tab == null) store.tab = 'home';
    store.organisationId = orgId;
    migrate();
    if(typeof persistAll === 'function') persistAll();
    else { markDirtyAll(); store._forceFullSync = true; }
    await pushToSupabase(orgId);
    markMigrated(orgId);
    if(isDevHardwireMode()) toast('Uploaded local tour to cloud', 'check');
  } else {
    await loadFromSupabase(orgId);
    markMigrated(orgId);
  }
  try{
    if(typeof fetchOrganisationName === 'function'){
      const name = await fetchOrganisationName(orgId);
      if(store && name) store.organisationName = name;
    }
  }catch(e){}
}
