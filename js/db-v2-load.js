/* Load V2 entity collections, then compose look-identical view projections. */

async function loadFromSupabaseV2(orgId, sb){
  const prevEvents = store?.events ? store.events.slice() : [];
  const prevTab = store?.tab;
  const prevActiveTrip = store?.activeTripId;
  const prevActiveShow = store?.activeShowId;
  const prevPacking = store?.packing || [];
  const prevReminders = store?.reminders || [];

  /* Keep newer/dirty local notes across cloud reload so an in-progress
     notepad edit is not wiped by realtime echo. */
  const prevNotes = (store?.notes || []).slice();
  const prevDirtyNotes = (store?._dirty && store._dirty.notes instanceof Set)
    ? new Set(store._dirty.notes)
    : (store?._dirty?.notes === '*' || store?._dirty?.['*'] === '*') ? null : new Set();

  const v2 = await v2RepoFetchOrg(sb, orgId);
  const view = await composeViewFromV2(v2, { prevEvents });

  if(view.settings.homeHeader && !view.settings.homeHeader.startsWith('data:') && !view.settings.homeHeader.startsWith('http')){
    if(typeof signedUrlForPath === 'function'){
      view.settings.homeHeader = await signedUrlForPath(view.settings.homeHeader);
    }
  }

  store = emptyOperateState();
  store.organisationId = orgId;
  store.v2 = v2;
  store._seq = v2.organisation_settings?.store_sequence || 1;
  store.activeTripId = prevActiveTrip || null;
  store.activeShowId = prevActiveShow || null;
  store.tab = prevTab || v2.user_preferences?.last_open_tab || 'home';
  store.settings = view.settings;
  store.artists = view.artists.length ? view.artists : store.artists;
  store.events = view.events;
  store.trips = view.trips;
  store.ideas = view.ideas;
  store.notes = view.notes;
  store.contacts = view.contacts;
  store.invoices = view.invoices;
  store.itineraries = view.itineraries;
  store.packing = prevPacking;
  store.reminders = prevReminders;

  if(prevNotes.length){
    const byId = new Map(store.notes.map(n => [n.id, n]));
    prevNotes.forEach(local => {
      if(!local || !local.id) return;
      const keep = prevDirtyNotes == null || prevDirtyNotes.has(local.id);
      const cloud = byId.get(local.id);
      if(!keep) return;
      if(!cloud || (local.updated || 0) >= (cloud.updated || 0)){
        byId.set(local.id, local);
        if(typeof v2RepoPatchLocal === 'function'){
          v2RepoPatchLocal('notes', {
            id: local.id,
            organisation_id: orgId,
            note_title: local.title || '',
            note_body: local.body || '',
            folder_name: local.folder || null,
            updated_at: local.updated ? new Date(local.updated).toISOString() : null
          });
        }
      }
    });
    store.notes = [...byId.values()];
    if(prevDirtyNotes == null){
      /* full dirty — restore all dirty flags after clear below */
    } else if(prevDirtyNotes.size){
      store._dirty = store._dirty || Object.create(null);
      store._dirty.notes = prevDirtyNotes;
    }
  }

  const knownIds = [];
  store.events.forEach(e => {
    knownIds.push(e.id);
    (e.attachments || []).forEach(a => a.id && knownIds.push(a.id));
    (e.flights || []).forEach(f => {
      if(f.id) knownIds.push(f.id);
      (f.passes || []).forEach(p => p.id && knownIds.push(p.id));
    });
    (e.passes || []).forEach(p => p.id && knownIds.push(p.id));
  });
  (store.trips || []).forEach(t => knownIds.push(t.id));
  (store.ideas || []).forEach(x => knownIds.push(x.id));
  (store.notes || []).forEach(x => knownIds.push(x.id));
  store._known = knownIds;

  const keepNoteDirty = store._dirty && store._dirty.notes;
  clearDirty();
  if(keepNoteDirty){
    store._dirty = store._dirty || Object.create(null);
    store._dirty.notes = keepNoteDirty;
  }

  if(typeof migrate === 'function') migrate();
  db.write(store);
}

/* Rebuild view projection from current store.v2 without hitting the network. */
async function rebuildViewFromLocalV2(){
  if(!store?.v2) return;
  const view = await composeViewFromV2(store.v2, { prevEvents: store.events || [] });
  store.settings = Object.assign({}, store.settings, view.settings, {
    security: store.settings?.security || view.settings.security,
    homeHeader: store.settings?.homeHeader || view.settings.homeHeader
  });
  store.artists = view.artists;
  store.events = view.events;
  store.trips = view.trips;
  store.ideas = view.ideas;
  store.notes = view.notes;
  store.contacts = view.contacts;
  store.invoices = view.invoices;
  store.itineraries = view.itineraries;
}
