/* Operate — Supabase row sync (maps store ↔ Postgres, keeps artisthq.v2 shape) */
const ORG_KEY = 'operate_org_id';
const MIGRATION_PREFIX = 'operate_supabase_migrated:';
const BUCKET = STORAGE_BUCKET;

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
  (store.events||[]).forEach(e=>{
    add(e.id); add(e.date); add(e.start); add(e.end); add(e.setTime); add(e.endTime);
    add(e.title); add(e.venue); add(e.venueAddr); add(e.city); add(e.info); add(e.from); add(e.to);
    add(e.setDone?1:0); add(e.done?1:0);
    (e.drivers||[]).forEach(d=>{ add(d.journey); add(d.time); add(d.phone); add(d.name); add(d.noGround?1:0); });
    (e.flights||[]).forEach(f=>{ add(f.from); add(f.to); add(f.dep); add(f.code); });
    if(e.hotel){ add(e.hotel.name); add(e.hotel.postcode); add(e.hotel.address); }
  });
  (store.ideas||[]).forEach(x=>{ add(x.id); add(x.title); add(x.done?1:0); });
  (store.notes||[]).forEach(x=>{ add(x.id); add(x.updated); });
  (store.trips||[]).forEach(t=>{ add(t.id); add(t.name); add(t.start); add(t.end); });
  return (store._seq||0) + '|' + (store.events?.length||0) + '|' + (store.ideas?.length||0) + '|' + (store.notes?.length||0) + '|' + h;
}

function dedupeEventsById(events){
  const seen = new Set();
  return events.filter(e => {
    if(seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

function mimeToKind(m){ return (m||'').startsWith('image/') ? 'image' : 'pdf'; }
function mimeFromPassKind(kind){
  if(kind === 'pdf') return 'application/pdf';
  if(kind === 'image') return 'image/jpeg';
  return kind || 'application/octet-stream';
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
    (e.flights||[]).forEach(f=>(f.passes||[]).forEach(fn));
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
        if(pf) f.passes = mergePassesKeepLocal(f.passes || [], pf.passes || []);
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
  persist();
  renderView();
  queueSync();
  return true;
}
async function attachPassToShowFlight(showId, flightId, att){
  const e = sel.event(showId);
  const f = e && e.flights && e.flights.find(x => x.id === flightId);
  if(!f || !att) return false;
  (f.passes = f.passes || []).push(att);
  if(syncActive()) await ensurePassUploaded(att, showId, flightId);
  persist();
  renderView();
  queueSync();
  return true;
}
function openPassByRef(itemId, passId, flightId){
  let p;
  if(flightId){
    const e = sel.event(itemId);
    const f = e && e.flights && e.flights.find(x => x.id === flightId);
    p = f && (f.passes || []).find(x => x.id === passId);
  } else {
    const it = store.events.find(x => x.id === itemId);
    p = it && (it.passes || []).find(x => x.id === passId);
  }
  if(!p){ toast('Pass not found','x'); return; }
  if(p.kind === 'image'){
    if(!passHasDisplayData(p)){ toast('Pass not found','x'); return; }
    if((p._storagePath || p._idb) && (!p.data || (!p.data.startsWith('data:') && !p.data.startsWith('http')))){
      resolveAttachment(p).then(() => p.data ? openViewer(p.data) : toast('Pass not found','x'));
      return;
    }
    openViewer(p.data);
  } else toast('PDF pass saved on device','file');
}
async function ensurePassUploaded(att, showLegacyId, parentLegacyId){
  if(!att) return null;
  const existing = passStoragePath(att);
  if(existing){ att._storagePath = existing; return existing; }
  if(!att.data || !att.data.startsWith('data:')) return null;
  if(!isSupabaseConfigured() || !currentOrgId) return null;
  try{
    const up = await uploadFileDataUrl(att.data, showLegacyId || parentLegacyId, 'pass', att.id, parentLegacyId);
    att._storagePath = up.path;
    att.data = up.url;
    return up.path;
  }catch(e){ return null; }
}
async function uploadPassForLogisticsItem(itemId, att){
  const it = store.events.find(x => x.id === itemId);
  if(!it || !att) return;
  const path = await ensurePassUploaded(att, it.showId || it.id, it.id);
  if(path){ persist(); renderView(); }
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
    .then(({ path, url }) => { att.data = url; att._storagePath = path; persist(); })
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

async function uploadFileDataUrl(dataUrl, showLegacyId, fileRole, legacyId, parentLegacyId){
  const sb = getSupabase();
  if(!sb || !currentOrgId) throw new Error('no_client');
  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type && blob.type.includes('pdf')) ? 'pdf'
    : ((blob.type && blob.type.split('/')[1]) || 'jpg');
  const folder = showLegacyId || 'general';
  const path = `${currentOrgId}/${folder}/${legacyId}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    upsert: true, contentType: blob.type || 'application/octet-stream'
  });
  if(error) throw error;
  const url = await signedUrlForPath(path);
  return { path, url, mime: blob.type || 'application/octet-stream' };
}

async function ensureOrgForUser(){
  if(isDevHardwireMode()){
    const fixed = getFixedOrgId();
    setStoredOrgId(fixed);
    return fixed;
  }

  const sb = getSupabase();
  const user = await getAuthUser();
  if(!sb || !user) throw new Error('no_auth');
  if(getAllowedUserId() && !isAllowedUser(user)) throw new Error('wrong_user');

  const fixed = getFixedOrgId();
  if(fixed){
    const { data: ok } = await sb.from('org_members').select('org_id').eq('org_id', fixed).eq('user_id', user.id).maybeSingle();
    if(!ok) throw new Error('not_linked_to_dev_org');
    setStoredOrgId(fixed);
    return fixed;
  }

  const stored = getStoredOrgId();
  if(stored){
    const { data: ok } = await sb.from('org_members').select('org_id').eq('org_id', stored).eq('user_id', user.id).maybeSingle();
    if(ok) { currentOrgId = stored; return stored; }
  }

  const { data: memberships } = await sb.from('org_members').select('org_id').eq('user_id', user.id).limit(1);
  if(memberships && memberships.length){
    setStoredOrgId(memberships[0].org_id);
    return memberships[0].org_id;
  }

  if(getAllowedUserId() || getFixedOrgId()) throw new Error('not_linked_to_dev_org');

  // Prefer the SECURITY DEFINER RPC (migration 003) which creates the org and
  // owner membership atomically; fall back to the direct inserts if the RPC
  // isn't deployed yet.
  let newOrgId = null;
  const { data: rpcOrg, error: rpcErr } = await sb.rpc('create_org', { p_name: 'My Tour' });
  if(!rpcErr && rpcOrg){
    newOrgId = rpcOrg;
  } else {
    const { data: org, error: orgErr } = await sb.from('orgs').insert({ name: 'My Tour' }).select('id').single();
    if(orgErr) throw orgErr;
    await sb.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner' });
    newOrgId = org.id;
  }
  const org = { id: newOrgId };
  const local = db.read();
  const settings = (local && local.settings) ? local.settings : {};
  await sb.from('org_settings').upsert({
    org_id: org.id,
    settings,
    packing: local?.packing || [],
    contacts: local?.contacts || [],
    invoices: local?.invoices || [],
    itineraries: local?.itineraries || [],
    artists: local?.artists || [],
    active_trip_id: local?.activeTripId || null,
    active_show_id: local?.activeShowId || null,
    tab: local?.tab || 'home',
    seq: local?._seq || 1
  }, { onConflict: 'org_id' });
  setStoredOrgId(org.id);
  return org.id;
}

function showToRow(e, orgId){
  return {
    org_id: orgId,
    legacy_id: e.id,
    show_date: e.date,
    artist: e.artist || null,
    trip_legacy_id: e.tripId || null,
    status: e.status || null,
    color: e.color || null,
    venue: e.venue || null,
    city: e.city || null,
    country: e.country || null,
    set_time: e.setTime || null,
    end_time: e.endTime || null,
    arrival: e.arrival || null,
    venue_addr: e.venueAddr || null,
    notes: e.notes || null,
    content: e.content || null,
    set_done: !!e.setDone,
    flight_no: e.flightNo || null,
    terminal: e.terminal || null,
    gate: e.gate || null,
    fstatus: e.fstatus || null,
    delay: e.delay || null,
    fi_updated: e.fiUpdated ? new Date(e.fiUpdated).toISOString() : null,
    fi_live: !!e.fiLive,
    hotel: e.hotel || null,
    driver: (e.drivers && e.drivers.length) ? e.drivers : (e.driver || null),
    promoter: e.promoter || null,
    finance: e.finance || null,
    advance: e.advance || null,
    show_contacts: e.contacts || []
  };
}

function logisticsToRow(e, orgId, showUuidMap){
  return {
    org_id: orgId,
    legacy_id: e.id,
    show_id: e.showId && showUuidMap[e.showId] ? showUuidMap[e.showId] : null,
    show_legacy_id: e.showId || null,
    kind: e.kind,
    item_date: e.date,
    title: e.title || logisticTypeLabel(e),
    start_time: e.start || null,
    end_time: e.end || null,
    icon: e.icon || null,
    info: packLogisticInfo(e),
    all_day: !!e.allDay,
    done: !!e.done,
    passes: (e.passes || []).map(serializePassForSync)
  };
}

async function pushToSupabase(orgId){
  if(!orgId || !store) return;
  const sb = getSupabase();
  if(!sb) return;
  dbSyncInProgress = true;
  syncSetStatus('syncing');
  if(typeof syncDirty !== 'undefined') syncDirty = false;  // capturing current state
  try{
    const org = orgId;
    const shows = store.events.filter(e => (e.kind || 'show') === 'show');
    const logistics = store.events.filter(e => ['travel','stay','marker'].includes(e.kind));

    const settingsCopy = JSON.parse(JSON.stringify(store.settings || {}));
    if(settingsCopy._homeHeaderPath) settingsCopy.homeHeader = settingsCopy._homeHeaderPath;
    delete settingsCopy._homeHeaderUrl;
    delete settingsCopy._homeHeaderPath;

    // Settings blob
    await sb.from('org_settings').upsert({
      org_id: org,
      settings: settingsCopy,
      packing: store.packing || [],
      contacts: store.contacts || [],
      invoices: store.invoices || [],
      itineraries: store.itineraries || [],
      artists: store.artists || [],
      active_trip_id: store.activeTripId || null,
      active_show_id: store.activeShowId || null,
      tab: store.tab || 'home',
      seq: store._seq || 1
    }, { onConflict: 'org_id' });

    // Trips
    const tripRows = (store.trips || []).map((t, i) => ({
      org_id: org, legacy_id: t.id, name: t.name, color: t.color,
      start_date: t.start || null, end_date: t.end || null,
      archived: !!t.archived, checklist: t.checklist || [], timeline: t.timeline || [],
      emergency: t.emergency || [], sort_order: i
    }));
    if(tripRows.length) await sb.from('trips').upsert(tripRows, { onConflict: 'org_id,legacy_id' });

    // Shows
    const showRows = shows.map(s => showToRow(s, org));
    if(showRows.length) await sb.from('shows').upsert(showRows, { onConflict: 'org_id,legacy_id' });

    const { data: showDb } = await sb.from('shows').select('id,legacy_id').eq('org_id', org);
    const showUuidMap = {};
    (showDb || []).forEach(r => { showUuidMap[r.legacy_id] = r.id; });

    const fileRows = [];

    // Logistics — upload passes to Storage + show_files; keep path refs in jsonb
    const logRows = [];
    for(const l of logistics){
      const sid = l.showId && showUuidMap[l.showId] ? showUuidMap[l.showId] : null;
      for(const pp of (l.passes || [])){
        const path = await ensurePassUploaded(pp, l.showId || l.id, l.id);
        if(path){
          fileRows.push({
            org_id: org, show_id: sid, legacy_id: pp.id, file_role: 'pass',
            name: pp.name || null, mime_type: mimeFromPassKind(pp.kind),
            storage_path: path, parent_legacy_id: l.id, sort_order: fileRows.length
          });
        }
      }
      logRows.push(logisticsToRow(l, org, showUuidMap));
    }
    if(logRows.length) await sb.from('logistics_items').upsert(logRows, { onConflict: 'org_id,legacy_id' });

    // Child rows per show
    const flightRows = [], passRows = [], chkRows = [], tlRows = [];
    for(const s of shows){
      const sid = showUuidMap[s.id];
      if(!sid) continue;
      (s.flights || []).forEach((f, i) => {
        flightRows.push({
          org_id: org, show_id: sid, legacy_id: f.id,
          code: f.code || null, from_code: f.from || null, to_code: f.to || null,
          dep: f.dep || null, arr: f.arr || null, seat: f.seat || null, sort_order: i
        });
      });
      (s.checklist || []).forEach((c, i) => {
        chkRows.push({ org_id: org, show_id: sid, legacy_id: c.id, label: c.label, done: !!c.done, sort_order: i });
      });
      (s.timeline || []).forEach((t, i) => {
        tlRows.push({
          org_id: org, show_id: sid, legacy_id: t.id,
          time: t.time || null, title: t.title || null, sub: t.sub || null,
          done: !!t.done, sort_order: i
        });
      });
      for(const att of (s.attachments || [])){
        let path = att._storagePath || null;
        if(!path && att.data && att.data.startsWith('data:')){
          try{
            const up = await uploadFileDataUrl(att.data, s.id, 'attachment', att.id);
            path = up.path; att._storagePath = path; att.data = up.url;
          }catch(e){ /* keep base64 locally */ }
        }
        fileRows.push({
          org_id: org, show_id: sid, legacy_id: att.id, file_role: 'attachment',
          name: att.name || null, mime_type: att.kind || att.mime || null,
          storage_path: path, sort_order: fileRows.length
        });
      }
    }

    if(flightRows.length) await sb.from('show_flights').upsert(flightRows, { onConflict: 'org_id,legacy_id' });
    if(chkRows.length) await sb.from('show_checklist_items').upsert(chkRows, { onConflict: 'org_id,legacy_id' });
    if(tlRows.length) await sb.from('show_timeline_steps').upsert(tlRows, { onConflict: 'org_id,legacy_id' });
    if(fileRows.length) await sb.from('show_files').upsert(fileRows, { onConflict: 'org_id,legacy_id' });

    // Flight passes (after flights upserted)
    const { data: flightDb } = await sb.from('show_flights').select('id,legacy_id').eq('org_id', org);
    const flightUuidMap = {};
    (flightDb || []).forEach(r => { flightUuidMap[r.legacy_id] = r.id; });

    for(const s of shows){
      for(const f of (s.flights || [])){
        const fid = flightUuidMap[f.id];
        if(!fid) continue;
        for(const pp of (f.passes || [])){
          const path = await ensurePassUploaded(pp, s.id, f.id);
          if(!path) continue;
          passRows.push({
            org_id: org, flight_id: fid, legacy_id: pp.id,
            name: pp.name || null, mime_type: mimeFromPassKind(pp.kind),
            storage_path: path, sort_order: passRows.length
          });
        }
      }
    }
    if(passRows.length) await sb.from('show_flight_passes').upsert(passRows, { onConflict: 'org_id,legacy_id' });

    // Ideas & notes
    const ideaRows = (store.ideas || []).map((x, i) => ({
      org_id: org, legacy_id: x.id, type: x.type, title: x.title, note: x.note,
      prio: x.prio, done: !!x.done, event_legacy_id: x.eventId || null,
      trip_legacy_id: x.tripId || null, sort_order: i
    }));
    if(ideaRows.length) await sb.from('ideas').upsert(ideaRows, { onConflict: 'org_id,legacy_id' });

    const noteRows = (store.notes || []).map((x, i) => ({
      org_id: org, legacy_id: x.id, title: x.title, body: x.body, folder: x.folder,
      note_updated: x.updated ? new Date(x.updated).toISOString() : null, sort_order: i
    }));
    if(noteRows.length) await sb.from('notes').upsert(noteRows, { onConflict: 'org_id,legacy_id' });

    // Orphan cleanup — delete DB rows not in local store
    const localShowIds = new Set(shows.map(s => s.id));
    const localLogIds = new Set(logistics.map(l => l.id));
    const localTripIds = new Set((store.trips || []).map(t => t.id));
    const localIdeaIds = new Set((store.ideas || []).map(x => x.id));
    const localNoteIds = new Set((store.notes || []).map(x => x.id));
    const localFileIds = new Set();
    shows.forEach(s => {
      (s.attachments || []).forEach(a => { if(a.id) localFileIds.add(a.id); });
      (s.flights || []).forEach(f => (f.passes || []).forEach(p => { if(p.id) localFileIds.add(p.id); }));
    });
    logistics.forEach(l => (l.passes || []).forEach(p => { if(p.id) localFileIds.add(p.id); }));
    const localFlightPassIds = new Set();
    shows.forEach(s => (s.flights || []).forEach(f => (f.passes || []).forEach(p => { if(p.id) localFlightPassIds.add(p.id); })));

    // Only delete a remote row if THIS device knew about it and it is now gone
    // locally (an intentional delete). Rows created on another device that we
    // haven't merged yet are absent from `_known`, so we never delete them —
    // this is what prevents cross-device / offline data loss.
    const known = new Set(store._known || []);
    async function deleteOrphans(table, localSet){
      const { data: rows } = await sb.from(table).select('legacy_id').eq('org_id', org);
      const orphans = (rows || [])
        .filter(r => !localSet.has(r.legacy_id) && known.has(r.legacy_id))
        .map(r => r.legacy_id);
      if(orphans.length) await sb.from(table).delete().eq('org_id', org).in('legacy_id', orphans);
    }
    await deleteOrphans('shows', localShowIds);
    await deleteOrphans('logistics_items', localLogIds);
    await deleteOrphans('trips', localTripIds);
    await deleteOrphans('ideas', localIdeaIds);
    await deleteOrphans('notes', localNoteIds);
    await deleteOrphans('show_files', localFileIds);
    await deleteOrphans('show_flight_passes', localFlightPassIds);

    // Everything we just upserted is now "known" to this device.
    store._known = [
      ...localShowIds, ...localLogIds, ...localTripIds, ...localIdeaIds,
      ...localNoteIds, ...localFileIds, ...localFlightPassIds
    ];

    db.write(store);
    syncSetStatus('synced');
    syncMarkLastSync();
    lastPushAt = Date.now();
    // A change arrived while we were pushing → push again shortly.
    if(typeof syncDirty !== 'undefined' && syncDirty && typeof scheduleSyncRetry === 'function') scheduleSyncRetry(400);
    else if(typeof syncRetryDelay !== 'undefined') syncRetryDelay = 0;   // reset backoff on success
  }catch(e){
    console.error('pushToSupabase', e);
    syncSetStatus('error');
    // Keep the change pending and retry with backoff (offline/flaky signal).
    if(typeof syncDirty !== 'undefined') syncDirty = true;
    if(typeof scheduleSyncRetry === 'function') scheduleSyncRetry();
  }finally{
    dbSyncInProgress = false;
  }
}

async function loadFromSupabase(orgId){
  const sb = getSupabase();
  if(!sb || !orgId) return;
  const prevEvents = store?.events ? store.events.slice() : [];
  dbRemoteLoading = true;
  try{
    const [
      { data: settingsRow },
      { data: trips },
      { data: shows },
      { data: logistics },
      { data: flights },
      { data: passes },
      { data: files },
      { data: checklist },
      { data: timeline },
      { data: ideas },
      { data: notes }
    ] = await Promise.all([
      sb.from('org_settings').select('*').eq('org_id', orgId).maybeSingle(),
      sb.from('trips').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('shows').select('*').eq('org_id', orgId).order('show_date'),
      sb.from('logistics_items').select('*').eq('org_id', orgId).order('item_date'),
      sb.from('show_flights').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('show_flight_passes').select('*').eq('org_id', orgId),
      sb.from('show_files').select('*').eq('org_id', orgId),
      sb.from('show_checklist_items').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('show_timeline_steps').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('ideas').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('notes').select('*').eq('org_id', orgId).order('sort_order')
    ]);

    const showUuidToLegacy = {};
    (shows || []).forEach(s => { showUuidToLegacy[s.id] = s.legacy_id; });

    const flightsByShow = {};
    (flights || []).forEach(f => {
      const leg = showUuidToLegacy[f.show_id];
      if(!leg) return;
      (flightsByShow[leg] = flightsByShow[leg] || []).push(f);
    });

    const passesByFlight = {};
    (passes || []).forEach(p => {
      (passesByFlight[p.flight_id] = passesByFlight[p.flight_id] || []).push(p);
    });

    const filesByShow = {};
    const passesByLogistic = {};
    (files || []).forEach(f => {
      if(f.file_role === 'pass' && f.parent_legacy_id){
        const leg = f.parent_legacy_id;
        (passesByLogistic[leg] = passesByLogistic[leg] || []).push(passFromFileRow(f));
        return;
      }
      const leg = showUuidToLegacy[f.show_id];
      if(!leg) return;
      (filesByShow[leg] = filesByShow[leg] || []).push(f);
    });

    const chkByShow = {}, tlByShow = {};
    (checklist || []).forEach(c => {
      const leg = showUuidToLegacy[c.show_id];
      if(leg) (chkByShow[leg] = chkByShow[leg] || []).push(c);
    });
    (timeline || []).forEach(t => {
      const leg = showUuidToLegacy[t.show_id];
      if(leg) (tlByShow[leg] = tlByShow[leg] || []).push(t);
    });

    let events = [];

    for(const s of (shows || [])){
      const leg = s.legacy_id;
      const fl = (flightsByShow[leg] || []).map(f => ({
        id: f.legacy_id,
        code: f.code, from: f.from_code, to: f.to_code,
        dep: f.dep, arr: f.arr, seat: f.seat,
        passes: (passesByFlight[f.id] || []).map(p => ({
          id: p.legacy_id, name: p.name, kind: mimeToKind(p.mime_type),
          _storagePath: p.storage_path, data: p.storage_path
        }))
      }));
      for(const f of fl) for(const p of f.passes) await resolveAttachment(p);

      const attachments = (filesByShow[leg] || []).filter(x => x.file_role === 'attachment').map(f => ({
        id: f.legacy_id, name: f.name, kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path, data: f.storage_path
      }));
      for(const a of attachments) await resolveAttachment(a);

      events.push({
        id: leg, kind: 'show', date: s.show_date, artist: s.artist,
        tripId: s.trip_legacy_id, status: s.status, color: s.color,
        venue: s.venue, city: s.city, country: s.country,
        setTime: s.set_time, endTime: s.end_time, arrival: s.arrival,
        venueAddr: s.venue_addr, notes: s.notes, content: s.content,
        setDone: s.set_done, flightNo: s.flight_no, terminal: s.terminal,
        gate: s.gate, fstatus: s.fstatus, delay: s.delay,
        fiUpdated: s.fi_updated ? new Date(s.fi_updated).getTime() : null,
        fiLive: s.fi_live, hotel: s.hotel,
        drivers: Array.isArray(s.driver) ? s.driver : (s.driver ? [s.driver] : []),
        driver: Array.isArray(s.driver) ? (s.driver.find(d=>!d.noGround) || null) : (s.driver || null),
        promoter: s.promoter, finance: s.finance, advance: s.advance,
        contacts: s.show_contacts || [], flights: fl, attachments,
        checklist: (chkByShow[leg] || []).map(c => ({ id: c.legacy_id, label: c.label, done: c.done })),
        timeline: (tlByShow[leg] || []).map(t => ({
          id: t.legacy_id, time: t.time, title: t.title, sub: t.sub, done: t.done
        }))
      });
    }

    for(const l of (logistics || [])){
      const fromJson = (l.passes || []).map(p => ({
        id: p.id || p.legacy_id || uid('pp'), name: p.name, kind: p.kind || 'image',
        _storagePath: p._storagePath || passStoragePath(p),
        data: p._storagePath || passStoragePath(p) || (typeof p.data === 'string' ? p.data : null)
      }));
      const fromFiles = passesByLogistic[l.legacy_id] || [];
      const passes = mergePassesById(fromJson, fromFiles);
      for(const p of passes) await resolveAttachment(p);
      const it = {
        id: l.legacy_id, kind: l.kind, date: l.item_date, showId: l.show_legacy_id,
        title: l.title, start: l.start_time, end: l.end_time, icon: l.icon,
        info: l.info, allDay: l.all_day, done: l.done, passes
      };
      if(l.title && !isNormalizedLogisticTitle(l.title)) it.legacyTitle = l.title;
      normalizeLogisticItem(it);
      events.push(it);
    }

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    events = dedupeEventsById(events);
    applyLocalPassMerge(prevEvents, events);

    const st = settingsRow || {};
    const uiTab = store?.tab;
    store = {
      _seq: st.seq || 1,
      activeTripId: st.active_trip_id,
      activeShowId: st.active_show_id,
      tab: uiTab || 'home',
      settings: st.settings || {},
      artists: st.artists || [],
      events,
      trips: (trips || []).map(t => ({
        id: t.legacy_id, name: t.name, color: t.color,
        start: t.start_date, end: t.end_date, archived: t.archived,
        checklist: t.checklist || [], timeline: t.timeline || [], emergency: t.emergency || []
      })),
      ideas: (ideas || []).map(x => ({
        id: x.legacy_id, type: x.type, title: x.title, note: x.note,
        prio: x.prio, done: x.done, eventId: x.event_legacy_id, tripId: x.trip_legacy_id
      })),
      notes: (notes || []).map(x => ({
        id: x.legacy_id, title: x.title, body: x.body, folder: x.folder,
        updated: x.note_updated ? new Date(x.note_updated).getTime() : null
      })),
      contacts: st.contacts || [],
      invoices: st.invoices || [],
      itineraries: st.itineraries || [],
      packing: st.packing || []
    };

    // Record every id we just loaded as "known" — orphan-cleanup only deletes
    // rows that were known here and then removed locally, never rows created
    // on another device that we simply haven't merged.
    const knownIds = [];
    store.events.forEach(e => { knownIds.push(e.id);
      (e.attachments || []).forEach(a => a.id && knownIds.push(a.id));
      (e.flights || []).forEach(f => (f.passes || []).forEach(p => p.id && knownIds.push(p.id)));
      (e.passes || []).forEach(p => p.id && knownIds.push(p.id));
    });
    (store.trips || []).forEach(t => knownIds.push(t.id));
    (store.ideas || []).forEach(x => knownIds.push(x.id));
    (store.notes || []).forEach(x => knownIds.push(x.id));
    store._known = knownIds;

    // Resolve header / itinerary images in settings & itineraries
    if(store.settings.homeHeader && !store.settings.homeHeader.startsWith('data:') && !store.settings.homeHeader.startsWith('http')){
      store.settings.homeHeader = await signedUrlForPath(store.settings.homeHeader);
    }
    for(const it of (store.itineraries || [])){
      for(const im of (it.imgs || [])){
        if(im._storagePath || (im.data && !im.data.startsWith('data:') && !im.data.startsWith('http')))
          await resolveAttachment(im);
      }
    }

    migrate();
    db.write(store);
  }finally{
    dbRemoteLoading = false;
  }
}

async function bootstrapRemoteData(){
  const orgId = await ensureOrgForUser();
  currentOrgId = orgId;
  const local = db.read();
  const sb = getSupabase();
  let cloudEmpty = true;
  if(sb){
    const { count, error } = await sb.from('shows').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
    if(!error) cloudEmpty = !count;
  }
  const pushLocal = local?.events?.length && cloudEmpty &&
    (!isMigrated(orgId) || isDevHardwireMode());
  if(pushLocal){
    store = local;
    if(store.tab == null) store.tab = 'home';
    migrate();
    await pushToSupabase(orgId);
    markMigrated(orgId);
    if(isDevHardwireMode()) toast('Uploaded local tour to cloud', 'check');
  } else {
    await loadFromSupabase(orgId);
    markMigrated(orgId);
  }
}
