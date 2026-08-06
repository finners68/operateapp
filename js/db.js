/* Operate — Supabase sync (V2-native entity state + composed view projections) */
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
  const v2 = store.v2 || {};
  add((v2.shows||[]).length); add((v2.journeys||[]).length); add((v2.tours||[]).length);
  (store.events||[]).forEach(e=>{
    add(e.id); add(e.date); add(e.start); add(e.end); add(e.setTime); add(e.endTime);
    add(e.title); add(e.venue); add(e.venueAddr); add(e.city); add(e.info); add(e.from); add(e.to);
    add(e.setDone?1:0); add(e.done?1:0); add(e.notes);
    (e.drivers||[]).forEach(d=>{ add(d.journey); add(d.time); add(d.phone); add(d.name); add(d.noGround?1:0); });
    (e.flights||[]).forEach(f=>{ add(f.id); add(f.from); add(f.to); add(f.dep); add(f.code); });
    if(e.hotel){ add(e.hotel.name); add(e.hotel.postcode); add(e.hotel.address); }
  });
  (store.ideas||[]).forEach(x=>{ add(x.id); add(x.title); add(x.done?1:0); });
  (store.notes||[]).forEach(x=>{ add(x.id); add(x.updated); add(x.body); });
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
async function attachPassToShowFlight(showId, flightId, att){
  const e = sel.event(showId);
  const f = e && e.flights && e.flights.find(x => x.id === flightId);
  if(!f || !att) return false;
  (f.passes = f.passes || []).push(att);
  if(syncActive()) await ensurePassUploaded(att, showId, flightId);
  persist('shows', showId);
  if(typeof pushShowNow === 'function') pushShowNow(showId);
  renderView();
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

async function uploadFileDataUrl(dataUrl, showLegacyId, fileRole, legacyId, parentLegacyId){
  const sb = getSupabase();
  if(!sb || !currentOrgId) throw new Error('no_client');
  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type && blob.type.includes('pdf')) ? 'pdf'
    : ((blob.type && blob.type.split('/')[1]) || 'jpg');
  let path;
  if(fileRole === 'pass' && parentLegacyId){
    path = v2StoragePathJourney(currentOrgId, parentLegacyId, legacyId, ext);
  } else if(showLegacyId === 'itineraries'){
    path = v2StoragePathOrg(currentOrgId, legacyId, ext);
  } else {
    path = v2StoragePathShow(currentOrgId, showLegacyId || 'general', legacyId, ext);
  }
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
    const { data: ok } = await sb.from(V2_TABLES.members).select('organisation_id')
      .eq('organisation_id', fixed).eq('user_id', user.id).maybeSingle();
    if(!ok) throw new Error('not_linked_to_dev_org');
    setStoredOrgId(fixed);
    return fixed;
  }

  const stored = getStoredOrgId();
  if(stored){
    const { data: ok } = await sb.from(V2_TABLES.members).select('organisation_id')
      .eq('organisation_id', stored).eq('user_id', user.id).maybeSingle();
    if(ok) { currentOrgId = stored; return stored; }
  }

  const { data: memberships } = await sb.from(V2_TABLES.members)
    .select('organisation_id').eq('user_id', user.id).limit(1);
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
  return {
    id: note.id,
    organisation_id: currentOrgId,
    legacy_id: null,
    note_title: note.title || '',
    note_body: note.body || '',
    folder_id: note.folderId || null,
    folder_name: note.folder || null,
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
  if(dbSyncInProgress){
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
  if(dbSyncInProgress){
    if(typeof syncDirty !== 'undefined') syncDirty = true;
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
  /* Prefer cloud. Only seed-push when cloud is empty and local V2 cache has events. */
  const localIsV2 = !!(local && local.v2);
  const pushLocal = localIsV2 && local?.events?.length && cloudEmpty &&
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
}
