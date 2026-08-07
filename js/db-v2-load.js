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
    const cloud = byId.get(local.id);
    if(dirtyIds == null){
      /* Full dirty: only override existing cloud ids — never append extras. */
      if(!cloud) return;
    } else if(!dirtyIds.has(local.id)){
      return;
    }
    byId.set(local.id, local);
    if(typeof patchFn === 'function') patchFn(local);
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
  const prevNoteFolders = (store?.noteFolders || []).slice();
  const prevIdeas = (store?.ideas || []).slice();
  const prevContacts = (store?.contacts || []).slice();
  const prevDirtyNotes = _dirtyIdSet('notes');
  const prevDirtyNoteFolders = _dirtyIdSet('note_folders');
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
  /* Edits that landed while we were fetching must still win over cloud. */
  const midDirtyShows = _dirtyIdSet('shows');
  const midDirtyJourneys = _dirtyIdSet('journeys');
  const midDirtyHotels = _dirtyIdSet('hotel_bookings');
  const midDirtyMarkers = _dirtyIdSet('schedule_items');
  const midDirtyTours = _dirtyIdSet('tours');
  const midDirtyNotes = _dirtyIdSet('notes');
  const midDirtyNoteFolders = _dirtyIdSet('note_folders');
  const midDirtyIdeas = _dirtyIdSet('ideas');
  const midDirtyContacts = _dirtyIdSet('contacts');
  const midDirtySnap = (typeof cloneDirty === 'function') ? cloneDirty(store?._dirty) : null;
  const view = await composeViewFromV2(v2, { prevEvents });

  if(view.settings.homeHeader && !view.settings.homeHeader.startsWith('data:') && !view.settings.homeHeader.startsWith('http')){
    if(typeof signedUrlForPath === 'function'){
      view.settings.homeHeader = await signedUrlForPath(view.settings.homeHeader);
    }
  }

  store = emptyOperateState();
  store.organisationId = orgId;
  store._forceFullSync = false;
  store.v2 = v2;
  store._seq = v2.organisation_settings?.store_sequence || 1;
  store.activeTripId = prevActiveTrip || null;
  store.activeShowId = prevActiveShow || null;
  store.tab = prevTab || v2.user_preferences?.last_open_tab || 'home';
  /* Prefer the tab the user navigated to while this fetch was in flight. */
  if(typeof applySavedNavToStore === 'function') applySavedNavToStore();
  store.settings = view.settings;
  store.artists = view.artists.length ? view.artists : store.artists;
  store.events = view.events;
  store.trips = view.trips;
  store.ideas = view.ideas;
  store.notes = view.notes;
  store.noteFolders = view.noteFolders || [];
  store.contacts = view.contacts;
  store.invoices = view.invoices;
  store.itineraries = view.itineraries;
  store.packing = prevPacking;
  store.reminders = prevReminders;

  const unionDirty = (a, b) => {
    if(a == null || b == null) return null; /* null = keep all */
    const out = new Set(a || []);
    (b || []).forEach(id => out.add(id));
    return out;
  };
  const dirtyShows = unionDirty(prevDirtyShows, midDirtyShows);
  const dirtyJourneys = unionDirty(prevDirtyJourneys, midDirtyJourneys);
  const dirtyHotels = unionDirty(prevDirtyHotels, midDirtyHotels);
  const dirtyMarkers = unionDirty(prevDirtyMarkers, midDirtyMarkers);
  const dirtyTours = unionDirty(prevDirtyTours, midDirtyTours);
  const dirtyNotes = unionDirty(prevDirtyNotes, midDirtyNotes);
  const dirtyNoteFolders = unionDirty(prevDirtyNoteFolders, midDirtyNoteFolders);
  const dirtyIdeas = unionDirty(prevDirtyIdeas, midDirtyIdeas);
  const dirtyContacts = unionDirty(prevDirtyContacts, midDirtyContacts);

  /* Note folders */
  if(prevNoteFolders.length){
    store.noteFolders = _mergeDirtyById(store.noteFolders, prevNoteFolders, dirtyNoteFolders, (local) => {
      if(typeof v2RepoPatchLocal === 'function'){
        v2RepoPatchLocal('note_folders', {
          id: local.id,
          organisation_id: orgId,
          folder_name: local.name || '',
          sort_order: local.sortOrder || 0
        });
      }
    });
  }

  /* Notes */
  if(prevNotes.length){
    store.notes = _mergeDirtyById(store.notes, prevNotes, dirtyNotes, (local) => {
      if(typeof v2RepoPatchLocal === 'function'){
        v2RepoPatchLocal('notes', {
          id: local.id,
          organisation_id: orgId,
          note_title: local.title || '',
          note_body: local.body || '',
          folder_id: local.folderId || null,
          folder_name: local.folder || null,
          updated_at: local.updated ? new Date(local.updated).toISOString() : null
        });
      }
    });
  }

  /* Ideas */
  if(prevIdeas.length){
    store.ideas = _mergeDirtyById(store.ideas, prevIdeas, dirtyIdeas);
  }

  /* Contacts */
  if(prevContacts.length){
    store.contacts = _mergeDirtyById(store.contacts, prevContacts, dirtyContacts);
  }

  /* Trips / tours */
  if(prevTrips.length){
    store.trips = _mergeDirtyById(store.trips, prevTrips, dirtyTours);
  }

  /* Shows + logistics: keep in-progress dirty locals without inventing duplicates.
     Scoped dirty (Set of ids): keep those locals even if not in cloud yet (new rows).
     Full dirty ('*'): only override matching ids — never re-add old local rows with
     different UUIDs (that was doubling shows/venues on every reload+flush). */
  if(prevEvents.length){
    const byId = new Map((store.events || []).map(e => [e.id, e]));
    const dirtySetFor = (ev) => {
      if(!ev || !ev.id) return { full: false, set: new Set() };
      const kind = ev.kind || 'show';
      if(kind === 'travel') return { full: dirtyJourneys == null, set: dirtyJourneys || new Set() };
      if(kind === 'stay') return { full: dirtyHotels == null, set: dirtyHotels || new Set() };
      if(kind === 'marker') return { full: dirtyMarkers == null, set: dirtyMarkers || new Set() };
      return { full: dirtyShows == null, set: dirtyShows || new Set() };
    };
    prevEvents.forEach(local => {
      const { full, set } = dirtySetFor(local);
      const cloud = byId.get(local.id);
      if(full){
        if(cloud) byId.set(local.id, local);
        return;
      }
      if(!set.has(local.id)) return;
      byId.set(local.id, local);
    });
    store.events = [...byId.values()];
  }

  const knownIds = [];
  store.events.forEach(e => {
    knownIds.push(e.id);
    (e.attachments || []).forEach(a => a.id && knownIds.push(a.id));
    (e.flights || []).forEach(f => {
      if(f.id) knownIds.push(f.id);
      if(typeof flightAllPasses === 'function'){
        flightAllPasses(f).forEach(p => p.id && knownIds.push(p.id));
      } else {
        (f.passes || []).forEach(p => p.id && knownIds.push(p.id));
        (f.passengers || []).forEach(pax => (pax.passes || []).forEach(p => p.id && knownIds.push(p.id)));
      }
    });
    (e.passes || []).forEach(p => p.id && knownIds.push(p.id));
  });
  (store.trips || []).forEach(t => knownIds.push(t.id));
  (store.ideas || []).forEach(x => knownIds.push(x.id));
  (store.notes || []).forEach(x => knownIds.push(x.id));
  store._known = knownIds;

  clearDirty();
  store._forceFullSync = false;
  /* Restore scoped dirty only. Never restore a full-tour dirty snap after
     cloud load — that re-uploaded every local row and duplicated the tour.
     Union start-of-load + mid-load dirty so a key-contact save during fetch
     is still pushed after reload. */
  {
    let restore = keepDirtySnap;
    if(typeof mergeDirty === 'function') restore = mergeDirty(keepDirtySnap, midDirtySnap);
    else if(midDirtySnap && (!keepDirtySnap || isEmptyDirty(keepDirtySnap))) restore = midDirtySnap;
    if(
      restore &&
      typeof isEmptyDirty === 'function' &&
      !isEmptyDirty(restore) &&
      typeof isFullDirty === 'function' &&
      !isFullDirty(restore)
    ){
      store._dirty = restore;
    }
  }

  if(typeof migrate === 'function') migrate();
  if(typeof normalizeNotesFolderIds === 'function') normalizeNotesFolderIds();
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
  store.noteFolders = view.noteFolders || [];
  store.contacts = view.contacts;
  store.invoices = view.invoices;
  store.itineraries = view.itineraries;
  if(typeof normalizeNotesFolderIds === 'function') normalizeNotesFolderIds();
}
