/* Operate — Supabase row sync (maps store ↔ Postgres, keeps artisthq.v2 shape) */
const ORG_KEY = 'operate_org_id';
const MIGRATION_PREFIX = 'operate_supabase_migrated:';
const BUCKET = STORAGE_BUCKET;

let currentOrgId = null;
let dbRemoteLoading = false;
let dbSyncInProgress = false;
const signedUrlCache = new Map(); // path -> { url, exp }

function getStoredOrgId(){ try{ return localStorage.getItem(ORG_KEY); }catch(e){ return null; } }
function setStoredOrgId(id){ try{ localStorage.setItem(ORG_KEY, id); }catch(e){} currentOrgId = id; }
function migrationKey(orgId){ return MIGRATION_PREFIX + orgId; }
function isMigrated(orgId){ return !!localStorage.getItem(migrationKey(orgId)); }
function markMigrated(orgId){ try{ localStorage.setItem(migrationKey(orgId), '1'); }catch(e){} }

function mimeToKind(m){ return (m||'').startsWith('image/') ? 'image' : 'pdf'; }

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

function hostImg(att, showLegacyId, fileRole, parentLegacyId){
  if(!isSupabaseConfigured() || !currentOrgId) return;
  if(!att || typeof att.data !== 'string' || !att.data.startsWith('data:')) return;
  uploadFileDataUrl(att.data, showLegacyId, fileRole || 'attachment', att.id, parentLegacyId)
    .then(({ path, url }) => { att.data = url; att._storagePath = path; persist(); })
    .catch(() => {});
}

async function ensureOrgForUser(){
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

  const { data: org, error: orgErr } = await sb.from('orgs').insert({ name: 'My Tour' }).select('id').single();
  if(orgErr) throw orgErr;
  await sb.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner' });
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
    driver: e.driver || null,
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
    title: e.title || null,
    start_time: e.start || null,
    end_time: e.end || null,
    icon: e.icon || null,
    info: e.info || null,
    all_day: !!e.allDay,
    done: !!e.done,
    passes: e.passes || []
  };
}

async function pushToSupabase(orgId){
  if(!orgId || !store) return;
  const sb = getSupabase();
  if(!sb) return;
  dbSyncInProgress = true;
  syncSetStatus('syncing');
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

    // Logistics
    const logRows = logistics.map(l => logisticsToRow(l, org, showUuidMap));
    if(logRows.length) await sb.from('logistics_items').upsert(logRows, { onConflict: 'org_id,legacy_id' });

    // Child rows per show
    const flightRows = [], passRows = [], fileRows = [], chkRows = [], tlRows = [];
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
          let path = pp._storagePath || null;
          if(!path && pp.data && pp.data.startsWith('data:')){
            try{
              const up = await uploadFileDataUrl(pp.data, s.id, 'pass', pp.id, f.id);
              path = up.path; pp._storagePath = path; pp.data = up.url;
            }catch(e){}
          }
          passRows.push({
            org_id: org, flight_id: fid, legacy_id: pp.id,
            name: pp.name || null, mime_type: pp.kind || null,
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

    async function deleteOrphans(table, localSet){
      const { data: rows } = await sb.from(table).select('legacy_id').eq('org_id', org);
      const orphans = (rows || []).filter(r => !localSet.has(r.legacy_id)).map(r => r.legacy_id);
      if(orphans.length) await sb.from(table).delete().eq('org_id', org).in('legacy_id', orphans);
    }
    await deleteOrphans('shows', localShowIds);
    await deleteOrphans('logistics_items', localLogIds);
    await deleteOrphans('trips', localTripIds);
    await deleteOrphans('ideas', localIdeaIds);
    await deleteOrphans('notes', localNoteIds);

    db.write(store);
    syncSetStatus('synced');
    syncMarkLastSync();
  }catch(e){
    console.error('pushToSupabase', e);
    syncSetStatus('error');
  }finally{
    dbSyncInProgress = false;
  }
}

async function loadFromSupabase(orgId){
  const sb = getSupabase();
  if(!sb || !orgId) return;
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
    (files || []).forEach(f => {
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

    const events = [];

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
        fiLive: s.fi_live, hotel: s.hotel, driver: s.driver,
        promoter: s.promoter, finance: s.finance, advance: s.advance,
        contacts: s.show_contacts || [], flights: fl, attachments,
        checklist: (chkByShow[leg] || []).map(c => ({ id: c.legacy_id, label: c.label, done: c.done })),
        timeline: (tlByShow[leg] || []).map(t => ({
          id: t.legacy_id, time: t.time, title: t.title, sub: t.sub, done: t.done
        }))
      });
    }

    for(const l of (logistics || [])){
      const passes = (l.passes || []).map(p => ({
        id: p.id || p.legacy_id || uid('pp'), name: p.name, kind: p.kind || 'image',
        data: p.data, _storagePath: p._storagePath
      }));
      for(const p of passes) await resolveAttachment(p);
      events.push({
        id: l.legacy_id, kind: l.kind, date: l.item_date, showId: l.show_legacy_id,
        title: l.title, start: l.start_time, end: l.end_time, icon: l.icon,
        info: l.info, allDay: l.all_day, done: l.done, passes
      });
    }

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const st = settingsRow || {};
    store = {
      _seq: st.seq || 1,
      activeTripId: st.active_trip_id,
      activeShowId: st.active_show_id,
      tab: st.tab || 'home',
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
  if(!isMigrated(orgId) && local && local.events && local.events.length){
    store = local;
    if(store.tab == null) store.tab = 'home';
    migrate();
    await pushToSupabase(orgId);
    markMigrated(orgId);
  } else {
    await loadFromSupabase(orgId);
    markMigrated(orgId);
  }
}
