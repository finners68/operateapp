/* Load V2 entity collections, then compose look-identical view projections. */

function _dirtyIdSet(table){
  const d = store && store._dirty;
  if(!d) return new Set();
  if(d['*'] === '*' || d[table] === '*') return null; /* null = keep all */
  if(d[table] instanceof Set) return new Set(d[table]);
  return new Set();
}

function _mergeDirtyById(cloudRows, prevRows, dirtyIds, patchFn){
  if(!prevRows || !prevRows.length) return cloudRows || [];
  const byId = new Map((cloudRows || []).map(r => [r.id, r]));
  prevRows.forEach(local => {
    if(!local || !local.id) return;
    const keep = dirtyIds == null || dirtyIds.has(local.id);
    if(!keep) return;
    const cloud = byId.get(local.id);
    const localTs = local.updated || local.updatedAt || 0;
    const cloudTs = cloud ? (cloud.updated || cloud.updatedAt || 0) : 0;
    if(!cloud || localTs >= cloudTs || dirtyIds == null || dirtyIds.has(local.id)){
      byId.set(local.id, local);
      if(typeof patchFn === 'function') patchFn(local);
    }
  });
  return [...byId.values()];
}

async function loadFromSupabaseV2(orgId, sb){
  const prevEvents = store?.events ? store.events.slice() : [];
  const prevTab = store?.tab;
  const prevActiveTrip = store?.activeTripId;
  const prevActiveShow = store?.activeShowId;
  const prevPacking = store?.packing || [];
  const prevReminders = store?.reminders || [];

  /* Keep dirty local rows across cloud reload so mid-edit work is not wiped. */
  const prevNotes = (store?.notes || []).slice();
  const prevIdeas = (store?.ideas || []).slice();
  const prevContacts = (store?.contacts || []).slice();
  const prevDirtyNotes = _dirtyIdSet('notes');
  const prevDirtyIdeas = _dirtyIdSet('ideas');
  const prevDirtyContacts = _dirtyIdSet('contacts');
  const prevDirtyShows = _dirtyIdSet('shows');
  const prevDirtyJourneys = _dirtyIdSet('journeys');
  const prevDirtyHotels = _dirtyIdSet('hotel_bookings');
  const prevDirtyMarkers = _dirtyIdSet('schedule_items');
  const prevDirtyTours = _dirtyIdSet('tours');
  const prevTrips = (store?.trips || []).slice();
  const keepDirtySnap = (typeof cloneDirty === 'function') ? cloneDirty(store?._dirty) : null;

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

  /* Notes */
  if(prevNotes.length){
    store.notes = _mergeDirtyById(store.notes, prevNotes, prevDirtyNotes, (local) => {
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
    });
  }

  /* Ideas */
  if(prevIdeas.length){
    store.ideas = _mergeDirtyById(store.ideas, prevIdeas, prevDirtyIdeas);
  }

  /* Contacts */
  if(prevContacts.length){
    store.contacts = _mergeDirtyById(store.contacts, prevContacts, prevDirtyContacts);
  }

  /* Trips / tours */
  if(prevTrips.length){
    store.trips = _mergeDirtyById(store.trips, prevTrips, prevDirtyTours);
  }

  /* Shows + logistics events: prefer dirty locals */
  if(prevEvents.length){
    const byId = new Map((store.events || []).map(e => [e.id, e]));
    const eventIsDirty = (ev) => {
      if(!ev || !ev.id) return false;
      const kind = ev.kind || 'show';
      if(kind === 'show') return prevDirtyShows == null || prevDirtyShows.has(ev.id);
      if(kind === 'travel') return prevDirtyJourneys == null || prevDirtyJourneys.has(ev.id);
      if(kind === 'stay') return prevDirtyHotels == null || prevDirtyHotels.has(ev.id);
      if(kind === 'marker') return prevDirtyMarkers == null || prevDirtyMarkers.has(ev.id);
      return prevDirtyShows == null || prevDirtyShows.has(ev.id);
    };
    prevEvents.forEach(local => {
      if(!eventIsDirty(local)) return;
      const cloud = byId.get(local.id);
      const localTs = local.updated || 0;
      const cloudTs = cloud ? (cloud.updated || 0) : 0;
      if(!cloud || localTs >= cloudTs || eventIsDirty(local)){
        byId.set(local.id, local);
      }
    });
    store.events = [...byId.values()];
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

  clearDirty();
  /* Restore dirty flags so offline / in-flight edits still flush after reload. */
  if(keepDirtySnap && typeof isEmptyDirty === 'function' && !isEmptyDirty(keepDirtySnap)){
    store._dirty = keepDirtySnap;
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
