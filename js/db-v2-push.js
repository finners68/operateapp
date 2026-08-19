/* Decompose view projections into V2 relational upserts by primary key (UUID). */

function v2Throw(error, label){
  if(!error) return;
  const msg = error.message || error.error_description || JSON.stringify(error);
  const e = new Error((label || 'v2 push') + ': ' + msg);
  e.cause = error;
  throw e;
}

function v2Currency(v, fallback){
  const s = String(v || fallback || 'GBP').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : (fallback || 'GBP');
}
function v2Iata(v){
  const s = String(v || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
}
function v2CountryCode(v){
  const s = String(v || '').trim().toUpperCase();
  if(/^[A-Z]{2}$/.test(s)) return s;
  if(typeof countryISO === 'function') return countryISO(v);
  return null;
}
function v2EnsureId(obj){
  if(!obj) return null;
  if(!obj.id || !isUuid(obj.id)) obj.id = newUuid();
  return obj.id;
}

function v2FindLocalByLegacy(table, legacyId){
  if(!legacyId || !store?.v2) return null;
  const list = store.v2[table];
  if(!Array.isArray(list)) return null;
  return list.find(r => r.legacy_id === legacyId) || null;
}

function v2IdForLegacy(table, legacyId, preferredId){
  /* Prefer existing DB row for this classification tag so upsert-by-id
     does not collide with unique (organisation_id, legacy_id). */
  const existing = v2FindLocalByLegacy(table, legacyId);
  if(existing?.id) return existing.id;
  if(preferredId && isUuid(preferredId)){
    const byId = (store?.v2?.[table] || []).find(r => r.id === preferredId);
    if(byId?.id) return byId.id;
    return preferredId;
  }
  return newUuid();
}

async function v2ResolveLegacyId(sb, table, orgId, legacyId, preferredId){
  const local = v2IdForLegacy(table, legacyId, preferredId);
  if(legacyId){
    const byLocalLegacy = v2FindLocalByLegacy(table, legacyId);
    if(byLocalLegacy?.id) return byLocalLegacy.id;
  }
  if(preferredId && isUuid(preferredId)){
    const byId = (store?.v2?.[table] || []).find(r => r.id === preferredId);
    if(byId?.id) return byId.id;
  }
  if(legacyId){
    const { data } = await sb.from(table).select('id,legacy_id')
      .eq('organisation_id', orgId).eq('legacy_id', legacyId).maybeSingle();
    if(data?.id){
      v2RepoPatchLocal(table, data);
      return data.id;
    }
  }
  if(preferredId && isUuid(preferredId)) return preferredId;
  return local || newUuid();
}

function v2PreserveLegacyId(table, row){
  if(!row || !row.id) return row;
  const existing = (store?.v2?.[table] || []).find(r => r.id === row.id);
  if(existing?.legacy_id) row.legacy_id = existing.legacy_id;
  return row;
}

function v2FindTravelTicket(journeyId, fileId){
  return (store?.v2?.travel_tickets || []).find(t => t.journey_id === journeyId && t.file_id === fileId) || null;
}

async function v2UpsertTravelTicket(sb, orgId, pass, journeyId, fileId, pax){
  const existing = v2FindTravelTicket(journeyId, fileId);
  const row = {
    id: existing?.id || (pass._ticketId && isUuid(pass._ticketId) ? pass._ticketId : newUuid()),
    organisation_id: orgId,
    legacy_id: null,
    journey_id: journeyId,
    file_id: fileId,
    ticket_type: 'boarding_pass',
    passenger_name: (pax && pax.name) || pass._passengerName || null,
    seat_number: (pax && pax.seat) || pass._passengerSeat || null,
    ticket_reference: (pax && pax.id) || pass._passengerId || null,
    sort_order: 0
  };
  const data = await v2UpsertOneByLegacy(sb, 'travel_tickets', orgId, row);
  if(data) pass._ticketId = data.id;
  return data;
}

async function v2GetMemberRole(sb, orgId){
  if(isDevHardwireMode()) return 'owner';
  const user = await getAuthUser();
  if(!user) return 'owner';
  const { data, error } = await sb.from('organisation_members')
    .select('member_role')
    .eq('organisation_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();
  if(error) console.warn('v2 member role', error);
  return data?.member_role || 'owner';
}

/* UUID-primary upsert. Classification tags may still set legacy_id. */
async function v2UpsertById(sb, table, orgId, rowOrRows){
  const rows = (Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]).filter(Boolean);
  if(!rows.length) return [];
  const mapped = [];
  for(const r of rows){
    const row = Object.assign({}, r, { organisation_id: orgId });
    if(row.legacy_id){
      row.id = await v2ResolveLegacyId(sb, table, orgId, row.legacy_id, row.id);
    } else if(!row.id || !isUuid(row.id)){
      row.id = newUuid();
    }
    if(table === 'journeys' || table === 'hotel_bookings' || table === 'hotels' || table === 'schedule_items' || table === 'checklist_items'){
      v2PreserveLegacyId(table, row);
    }
    mapped.push(row);
  }
  /* Postgres rejects upsert payloads that touch the same id twice.
     Also collapse duplicate legacy_id tags in one batch. */
  const byId = new Map();
  const byLegacy = new Map();
  mapped.forEach(r => {
    if(r.legacy_id && byLegacy.has(r.legacy_id)){
      const keep = byLegacy.get(r.legacy_id);
      byId.delete(keep.id);
      r.id = keep.id;
    }
    if(r.legacy_id) byLegacy.set(r.legacy_id, r);
    byId.set(r.id, r);
  });
  const payload = [...byId.values()];
  try{
    const data = await v2RepoUpsert(sb, table, payload, 'id');
    (data || []).forEach(r => { if(r) v2RepoPatchLocal(table, r); });
    return data || [];
  }catch(e){
    const msg = String(e && e.message || e);
    if(!/legacy_id/i.test(msg) || !payload.some(r => r.legacy_id)) throw e;
    /* Stale local cache: resolve each legacy_id from DB and retry once. */
    for(const row of payload){
      if(!row.legacy_id) continue;
      row.id = await v2ResolveLegacyId(sb, table, orgId, row.legacy_id, row.id);
      v2PreserveLegacyId(table, row);
    }
    const retryMap = new Map();
    payload.forEach(r => retryMap.set(r.id, r));
    const data = await v2RepoUpsert(sb, table, [...retryMap.values()], 'id');
    (data || []).forEach(r => { if(r) v2RepoPatchLocal(table, r); });
    return data || [];
  }
}

async function v2UpsertByLegacy(sb, table, orgId, rowOrRows){
  return v2UpsertById(sb, table, orgId, rowOrRows);
}
async function v2UpsertOneByLegacy(sb, table, orgId, row){
  const rows = await v2UpsertById(sb, table, orgId, row);
  return rows[0] || null;
}
async function v2LoadLegacyIds(_sb, _table, _orgId){
  return {};
}

async function v2UpsertFile(sb, orgId, att, storagePath, mime){
  const fileId = (att.id && isUuid(att.id)) ? att.id : newUuid();
  att.id = fileId;
  const row = {
    id: fileId,
    organisation_id: orgId,
    legacy_id: null,
    bucket_name: STORAGE_BUCKET,
    storage_path: storagePath,
    original_filename: att.name || null,
    file_title: att.name || null,
    mime_type: mime || mimeFromPassKind(att.kind),
    uploaded_by_user_id: (await getAuthUser())?.id || null
  };
  const { data: byPath } = await sb.from('files')
    .select('id').eq('organisation_id', orgId).eq('storage_path', storagePath).maybeSingle();
  if(byPath){
    row.id = byPath.id;
    att.id = byPath.id;
    const { data, error } = await sb.from('files').update(row).eq('id', byPath.id).select('id').single();
    v2Throw(error, 'files update');
    return data.id;
  }
  const upserted = await v2UpsertOneByLegacy(sb, 'files', orgId, row);
  return upserted.id;
}

async function v2EnsureContact(sb, orgId, c, cache){
  if(!c || !c.name) return null;
  const key = (c.email || c.phone || c.name).toLowerCase();
  if(cache.has(key)) return cache.get(key);
  const list = store?.v2?.contacts || [];
  let existing = null;
  if(c.id && isUuid(c.id)) existing = list.find(x => x.id === c.id) || null;
  if(!existing && c.email){
    const em = String(c.email).toLowerCase();
    existing = list.find(x => (x.email_address || '').toLowerCase() === em) || null;
  }
  if(!existing && c.phone){
    existing = list.find(x => x.phone_number === c.phone) || null;
  }
  if(!existing){
    const nm = String(c.name).toLowerCase();
    existing = list.find(x => (x.display_name || '').toLowerCase() === nm) || null;
  }
  const cid = existing?.id || (c.id && isUuid(c.id) ? c.id : newUuid());
  c.id = cid;
  const row = {
    id: cid,
    organisation_id: orgId,
    legacy_id: existing?.legacy_id || null,
    display_name: c.name,
    email_address: c.email || null,
    phone_number: c.phone || null,
    whatsapp_number: c.whatsapp || c.phone || null,
    contact_notes: c.notes || null
  };
  const data = await v2UpsertOneByLegacy(sb, 'contacts', orgId, row);
  cache.set(key, data.id);
  return data.id;
}

/* Map UI / free-text key-contact roles onto show_contacts.contact_role.
   Custom "Other" labels are stored as role=other + contact_notes. */
const V2_SHOW_CONTACT_ROLE_MAP = {
  artist_liaison: 'artist_liaison',
  'artist liaison': 'artist_liaison',
  promoter: 'promoter',
  production: 'production',
  venue_manager: 'venue_manager',
  'venue manager': 'venue_manager',
  driver: 'driver',
  emergency: 'emergency',
  other: 'other'
};
function v2MapShowContactRole(role){
  const raw = role == null ? '' : String(role).trim();
  if(!raw) return { role: 'other', notes: null };
  const underscored = raw.toLowerCase().replace(/\s+/g, '_');
  const spaced = raw.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
  const mapped = V2_SHOW_CONTACT_ROLE_MAP[underscored] || V2_SHOW_CONTACT_ROLE_MAP[spaced];
  if(mapped) return { role: mapped, notes: null };
  return { role: 'other', notes: raw };
}

/* If local state still has duplicate copies of a show, collapse onto the
   existing cloud row (same date + venue) instead of inserting another. */
function v2ResolveShowId(s){
  if(!s) return newUuid();
  if(s.id && isUuid(s.id)){
    const byId = (store?.v2?.shows || []).find(sh => sh.id === s.id);
    if(byId?.id) return byId.id;
  }
  const name = String(s.venue || '').trim().toLowerCase();
  const date = s.date;
  if(date && name){
    const match = (store?.v2?.shows || []).find(sh => {
      if(String(sh.show_date || '') !== String(date)) return false;
      const v = (store?.v2?.venues || []).find(x => x.id === sh.venue_id);
      return !!v && String(v.venue_name || '').trim().toLowerCase() === name;
    });
    if(match?.id){
      s.id = match.id;
      return match.id;
    }
  }
  return v2EnsureId(s);
}

/* Reuse the show's current venue row. Minting a new venue UUID on every
   save was creating duplicate venue rows and leaving old ones behind. */
function v2ResolveVenueIdForShow(s){
  if(!s) return newUuid();
  const existingShow = (store?.v2?.shows || []).find(sh => sh.id === s.id);
  if(existingShow?.venue_id) return existingShow.venue_id;
  const name = String(s.venue || '').trim().toLowerCase();
  const city = String(s.city || '').trim().toLowerCase();
  if(name){
    const match = (store?.v2?.venues || []).find(v =>
      String(v.venue_name || '').trim().toLowerCase() === name &&
      String(v.city || '').trim().toLowerCase() === city
    );
    if(match?.id) return match.id;
  }
  return newUuid();
}

async function v2UpsertPk(sb, table, row, onConflict){
  const { data, error } = await sb.from(table).upsert(row, { onConflict }).select('*').maybeSingle();
  v2Throw(error, table + ' upsert');
  /* show_advances / show_financials use show_id as PK — patch local by that key. */
  if(data && store?.v2){
    const pk = onConflict || 'id';
    if(pk === 'id' && typeof v2RepoPatchLocal === 'function'){
      v2RepoPatchLocal(table, data);
    } else if(store.v2[table] && Array.isArray(store.v2[table]) && data[pk]){
      const list = store.v2[table];
      const i = list.findIndex(r => r && r[pk] === data[pk]);
      if(i >= 0) list[i] = Object.assign({}, list[i], data);
      else list.push(data);
    }
  }
  return data;
}

async function pushToSupabaseV2(orgId, dirtyIn){
  const sb = getSupabase();
  if(!sb || !orgId || !store) return null;

  let dirty = dirtyIn ? cloneDirty(dirtyIn) : cloneDirty(store._dirty);
  /* Empty dirty = no-op (never invent a full-tour rewrite here). Full sync is
     only via persistAll / _forceFullSync which passes { '*': '*' }. */
  if(isEmptyDirty(dirty)) return null;
  const full = isFullDirty(dirty);
  const needSettings = full || isTableDirty(dirty, 'settings') || isTableDirty(dirty, 'organisation_settings');
  const needPrefs = full || needSettings || isTableDirty(dirty, 'user_preferences');
  const needContacts = full || isTableDirty(dirty, 'contacts');
  const needArtists = full || isTableDirty(dirty, 'artists');
  const needTours = full || isTableDirty(dirty, 'tours');
  const needShows = full || isTableDirty(dirty, 'shows');
  const needIdeas = full || isTableDirty(dirty, 'ideas');
  const needNoteFolders = full || isTableDirty(dirty, 'note_folders');
  const needNotes = full || isTableDirty(dirty, 'notes');
  const needLogistics = full || isTableDirty(dirty, 'journeys')
    || isTableDirty(dirty, 'hotel_bookings') || isTableDirty(dirty, 'schedule_items');
  const needInvoices = full || isTableDirty(dirty, 'invoices');
  const needShowNested = needShows; /* dirty shows still push nested rows for those shows */
  const needTripNested = full || needTours;

  /* Snapshot view data BEFORE any await. Concurrent cloud reloads can replace
     store.events mid-push; reading after awaits would upload stale notes. */
  const eventsSnap = (store.events || []).slice();
  const tripsSnap = (store.trips || []).slice();
  const artistsSnap = (store.artists || []).slice();
  const contactsSnap = (store.contacts || []).slice();
  const ideasSnap = (store.ideas || []).slice();
  const noteFoldersSnap = (store.noteFolders || []).slice();
  const notesSnap = (store.notes || []).slice();
  const invoicesSnap = (store.invoices || []).slice();
  const settingsSnap = store.settings ? Object.assign({}, store.settings) : {};
  const packingTemplateSnap = (settingsSnap.packingTemplate || []).slice();
  const knownSnap = new Set(store._known || []);
  const tabSnap = store.tab || 'home';
  const itinerariesSnap = (store.itineraries || []).slice();

  const memberRole = (needInvoices || needShowNested || full) ? await v2GetMemberRole(sb, orgId) : 'owner';
  const canFinance = v2CanManageFinance(memberRole);
  const contactCache = new Map();

  const showsAll = eventsSnap.filter(e => (e.kind || 'show') === 'show');
  const logisticsAll = eventsSnap.filter(e => ['travel','stay','marker'].includes(e.kind));
  /* Freeze nested contact fields so a concurrent cloud reload cannot empty
     s.contacts on the live store object before we upload them. */
  const shows = needShows
    ? filterByDirtyIds(showsAll, dirty, 'shows').map(s => {
        const copy = Object.assign({}, s);
        copy.contacts = Array.isArray(s.contacts)
          ? s.contacts.map(c => (c && typeof c === 'object') ? Object.assign({}, c) : c)
          : [];
        if(s.promoter && typeof s.promoter === 'object') copy.promoter = Object.assign({}, s.promoter);
        if(Array.isArray(s.drivers)){
          copy.drivers = s.drivers.map(d => (d && typeof d === 'object') ? Object.assign({}, d) : d);
        }
        return copy;
      })
    : [];
  const logistics = (() => {
    if(!needLogistics) return [];
    if(full) return logisticsAll;
    const seen = new Set();
    const out = [];
    const add = (row) => { if(row && row.id && !seen.has(row.id)){ seen.add(row.id); out.push(row); } };
    const jIds = dirtyIds(dirty, 'journeys');
    const hIds = dirtyIds(dirty, 'hotel_bookings');
    const mIds = dirtyIds(dirty, 'schedule_items');
    if(isTableDirty(dirty, 'journeys')){
      logisticsAll.filter(l => l.kind === 'travel' && (jIds == null || jIds.has(l.id))).forEach(add);
    }
    if(isTableDirty(dirty, 'hotel_bookings')){
      logisticsAll.filter(l => l.kind === 'stay' && (hIds == null || hIds.has(l.id))).forEach(add);
    }
    if(isTableDirty(dirty, 'schedule_items')){
      logisticsAll.filter(l => l.kind === 'marker' && (mIds == null || mIds.has(l.id))).forEach(add);
    }
    return out;
  })();
  const tripsPush = needTours ? filterByDirtyIds(tripsSnap, dirty, 'tours') : [];
  const contactsPush = needContacts ? filterByDirtyIds(contactsSnap, dirty, 'contacts') : [];
  const ideasPush = needIdeas ? filterByDirtyIds(ideasSnap, dirty, 'ideas') : [];
  const noteFoldersPush = (needNoteFolders || needNotes)
    ? filterByDirtyIds(noteFoldersSnap, dirty, 'note_folders')
    : [];
  /* Notes need their folder rows first — also push any folders those notes reference. */
  const notesPush = needNotes ? filterByDirtyIds(notesSnap, dirty, 'notes') : [];
  if(needNotes && notesPush.length){
    const folderIds = new Set(noteFoldersPush.map(f => f.id));
    notesPush.forEach(n => {
      if(!n.folderId) return;
      if(folderIds.has(n.folderId)) return;
      const f = noteFoldersSnap.find(x => x.id === n.folderId);
      if(f){ noteFoldersPush.push(f); folderIds.add(f.id); }
    });
  }
  const invoicesPush = needInvoices ? filterByDirtyIds(invoicesSnap, dirty, 'invoices') : [];

  const uiPrefs = {
    security: settingsSnap.security || {},
    packingTemplate: packingTemplateSnap,
    homeHeaderPath: settingsSnap._homeHeaderPath
      || (typeof settingsSnap.homeHeader === 'string' && !settingsSnap.homeHeader.startsWith('http') && !settingsSnap.homeHeader.startsWith('data:')
        ? settingsSnap.homeHeader : null),
    artistName: settingsSnap.artistName,
    itineraries: itinerariesSnap
  };

  if(needSettings){
    const settingsRow = {
      organisation_id: orgId,
      base_currency_code: v2Currency(settingsSnap.baseCurrency, 'GBP'),
      home_airport_iata: v2Iata(settingsSnap.homeAirport),
      account_type: V2_ACCT_FROM_STORE[settingsSnap.accountType] || null,
      invoice_prefix: settingsSnap.invoicePrefix || 'INV',
      invoice_next_sequence: Math.max(1, settingsSnap.invoiceSeq || 1),
      invoice_default_terms_days: Math.max(0, settingsSnap.invoiceTerms || 30),
      store_sequence: Math.max(1, store._seq || 1)
    };
    {
      const { error } = await sb.from('organisation_settings').upsert(settingsRow, { onConflict: 'organisation_id' });
      if(error && /store_sequence/i.test(error.message || '')){
        delete settingsRow.store_sequence;
        const retry = await sb.from('organisation_settings').upsert(settingsRow, { onConflict: 'organisation_id' });
        v2Throw(retry.error, 'organisation_settings');
      } else {
        v2Throw(error, 'organisation_settings');
      }
    }

    const bill = settingsSnap.billing || {};
    await v2UpsertPk(sb, 'organisation_billing_profiles', {
      organisation_id: orgId,
      billing_name: bill.name || null,
      billing_email_address: bill.email || null,
      billing_phone_number: bill.phone || null,
      address_line_1: bill.address || null,
      address_line_2: bill.addressLine2 || null,
      city: bill.city || null,
      region: bill.region || null,
      postal_code: bill.postcode || null,
      country_code: v2CountryCode(bill.countryCode || bill.country),
      tax_identifier: bill.vatNumber || null,
      bank_account_name: bill.bankAccountName || null,
      bank_account_number: bill.bankAccountNumber || null,
      bank_sort_code: bill.sortCode || null,
      bank_iban: bill.iban || null,
      bank_swift_bic: bill.swift || null,
      payment_notes: bill.paymentNotes || null
    }, 'organisation_id');

    const fx = settingsSnap.fx || {};
    const fxRows = Object.keys(fx).filter(k => /^[A-Z]{3}$/i.test(k)).map(k => ({
      organisation_id: orgId,
      currency_code: k.toUpperCase(),
      rate_to_base: Number(fx[k]) || 1
    }));
    if(fxRows.length){
      const { error } = await sb.from('organisation_exchange_rates').upsert(fxRows, { onConflict: 'organisation_id,currency_code' });
      v2Throw(error, 'organisation_exchange_rates');
    }
  }

  if(needPrefs){
    const user = await getAuthUser();
    if(user){
      const { error } = await sb.from('user_preferences').upsert({
        organisation_id: orgId,
        user_id: user.id,
        last_open_tab: tabSnap,
        ui_preferences: uiPrefs
      }, { onConflict: 'organisation_id,user_id' });
      v2Throw(error, 'user_preferences');
    }
  }

  if(needContacts){
    for(const c of contactsPush){
      await v2EnsureContact(sb, orgId, c, contactCache);
    }
  }

  let defaultArtistId = artistsSnap.find(a => a.default)?.id || artistsSnap[0]?.id || null;
  if(needArtists || needShows){
    const artistRows = (needArtists ? artistsSnap : artistsSnap.slice(0, 0)).map(a => {
      const id = v2EnsureId(a);
      return {
        id,
        organisation_id: orgId,
        legacy_id: null,
        display_name: a.name || a.display_name || 'Artist',
        is_default: !!a.default
      };
    });
    if(needArtists){
      if(!artistRows.length && settingsSnap.artistName){
        const id = newUuid();
        artistRows.push({
          id,
          organisation_id: orgId,
          legacy_id: null,
          display_name: settingsSnap.artistName,
          is_default: true
        });
        artistsSnap.push({ id, name: settingsSnap.artistName, default: true });
        if(store) store.artists = artistsSnap.slice();
      }
      if(artistRows.length) await v2UpsertById(sb, 'artists', orgId, artistRows);
    }
    defaultArtistId = artistsSnap.find(a => a.default)?.id || artistsSnap[0]?.id || null;
  }

  if(needTours){
    const tripRows = tripsPush.map(t => ({
      id: v2EnsureId(t),
      organisation_id: orgId,
      legacy_id: null,
      tour_name: t.name,
      color_key: t.color,
      start_date: t.start || null,
      end_date: t.end || null,
      is_archived: !!t.archived
    }));
    if(tripRows.length) await v2UpsertById(sb, 'tours', orgId, tripRows);
  }

  const venueIdByShow = {};
  if(needShows){
    const venueRows = [];
    for(const s of shows){
      /* Resolve/collapse show id before venue lookup so keys stay stable. */
      v2ResolveShowId(s);
      if(!s.venue && !s.city) continue;
      const vid = v2ResolveVenueIdForShow(s);
      venueIdByShow[s.id] = vid;
      const existingVenue = (store.v2?.venues || []).find(v => v.id === vid);
      venueRows.push({
        id: vid,
        organisation_id: orgId,
        legacy_id: existingVenue?.legacy_id || null,
        venue_name: s.venue || 'Venue',
        address_line_1: s.venueAddr || null,
        address_line_2: s.venueAddr2 || null,
        city: s.city || null,
        region: s.venueRegion || null,
        postal_code: s.venuePostcode || null,
        country_code: v2CountryCode(s.country)
      });
    }
    if(venueRows.length) await v2UpsertById(sb, 'venues', orgId, venueRows);

    const showRows = shows.map(s => {
      const sid = v2ResolveShowId(s);
      const cached = (store.v2?.shows || []).find(sh => sh.id === sid);
      return {
      id: sid,
      organisation_id: orgId,
      legacy_id: cached?.legacy_id || null,
      tour_id: (s.tripId && isUuid(s.tripId)) ? s.tripId : null,
      primary_artist_id: s.artist ? defaultArtistId : null,
      venue_id: venueIdByShow[sid] || cached?.venue_id || null,
      venue_name: s.venue || null,
      show_date: s.date,
      show_status: V2_SHOW_STATUS_FROM_STORE[s.status] || 'confirmed',
      color_key: s.color || null,
      venue_arrival_time: s.arrival || null,
      set_start_time: s.setTime || null,
      set_end_time: s.endTime || null,
      internal_notes: s.notes || null,
      content_plan: s.content || null,
      is_set_done: !!s.setDone
    };
    });
    if(showRows.length) await v2UpsertById(sb, 'shows', orgId, showRows);
  }

  /* Notes + ideas early: small and user-facing. Folders before notes (FK). */
  if(needIdeas){
    const ideaRows = ideasPush.map((x, i) => ({
      id: v2EnsureId(x),
      organisation_id: orgId,
      legacy_id: null,
      show_id: (x.eventId && isUuid(x.eventId)) ? x.eventId : null,
      tour_id: (x.tripId && isUuid(x.tripId)) ? x.tripId : null,
      idea_type: ['reel','caption','hook','youtube','podcast','interview','location'].includes(x.type) ? x.type : 'other',
      idea_title: x.title,
      idea_note: x.note,
      priority_level: V2_PRIO_FROM_STORE[x.prio] || null,
      is_done: !!x.done,
      sort_order: i
    }));
    if(ideaRows.length) await v2UpsertById(sb, 'ideas', orgId, ideaRows);
    const ideaDirty = dirtyIds(dirty, 'ideas');
    if(ideaDirty){
      const local = new Set(ideasSnap.map(x => x.id));
      const gone = [...ideaDirty].filter(id => id && !local.has(id));
      if(gone.length){
        const { error } = await sb.from('ideas').delete().eq('organisation_id', orgId).in('id', gone);
        if(error) console.warn('ideas targeted delete', error);
      }
    }
  }

  if(needNoteFolders || noteFoldersPush.length){
    const folderRows = noteFoldersPush.map((x, i) => ({
      id: v2EnsureId(x),
      organisation_id: orgId,
      legacy_id: null,
      folder_name: (x.name || '').trim() || 'Folder',
      sort_order: x.sortOrder != null ? x.sortOrder : i
    }));
    if(folderRows.length) await v2UpsertById(sb, 'note_folders', orgId, folderRows);
    const folderDirty = dirtyIds(dirty, 'note_folders');
    if(folderDirty){
      const local = new Set(noteFoldersSnap.map(x => x.id));
      const gone = [...folderDirty].filter(id => id && !local.has(id));
      if(gone.length){
        const { error } = await sb.from('note_folders').delete().eq('organisation_id', orgId).in('id', gone);
        if(error) console.warn('note_folders targeted delete', error);
      }
    }
  }

  if(needNotes){
    const noteRows = notesPush.map((x, i) => ({
      id: v2EnsureId(x),
      organisation_id: orgId,
      legacy_id: null,
      note_title: x.title,
      note_body: x.body,
      folder_id: x.folderId || null,
      folder_name: x.folder || null,
      sort_order: i,
      updated_at: x.updated ? new Date(x.updated).toISOString() : undefined
    }));
    if(noteRows.length) await v2UpsertById(sb, 'notes', orgId, noteRows);
    const noteDirty = dirtyIds(dirty, 'notes');
    if(noteDirty){
      const local = new Set(notesSnap.map(x => x.id));
      const gone = [...noteDirty].filter(id => id && !local.has(id));
      if(gone.length){
        const { error } = await sb.from('notes').delete().eq('organisation_id', orgId).in('id', gone);
        if(error) console.warn('notes targeted delete', error);
      }
    }
  }

  const showUuidMap = {};
  showsAll.forEach(s => { showUuidMap[s.id] = s.id; });
  const tourUuidMap = {};
  tripsSnap.forEach(t => { tourUuidMap[t.id] = t.id; });

  for(const s of (needShowNested ? shows : [])){
    const sid = s.id;
    if(!sid) continue;

    if(s.advance){
      const a = s.advance;
      const runningOrder = (a.schedule || []).map(item => {
        if(!item.id || !isUuid(item.id)) item.id = newUuid();
        return {
          id: item.id,
          time: item.time || '',
          label: (item.label || item.title || '').trim()
        };
      }).filter(item => item.time || item.label);
      await v2UpsertPk(sb, 'show_advances', {
        show_id: sid,
        organisation_id: orgId,
        stage_name: a.stage || null,
        access_notes: a.access || null,
        soundcheck_notes: a.soundcheck || null,
        curfew_notes: a.curfew || null,
        dressing_room_notes: a.dressingRoom || null,
        guestlist_notes: a.guestlist || null,
        catering_notes: a.catering || null,
        parking_notes: a.parking || null,
        wifi_notes: a.wifi || null,
        navigation_address: a.navAddr || null,
        general_remarks: a.remarks || null,
        running_order: runningOrder
      }, 'show_id');
    }

    if(canFinance && s.finance){
      const f = s.finance;
      await v2UpsertPk(sb, 'show_financials', {
        show_id: sid,
        organisation_id: orgId,
        agreed_fee_amount: f.fee,
        currency_code: v2Currency(f.currency, settingsSnap.baseCurrency),
        deal_type: f.dealType || null,
        commission_percent: f.commission,
        per_diem_amount: f.perDiem,
        is_paid: !!f.paid,
        is_estimated: !!f.estimated,
        is_not_disclosed: !!f.notDisclosed
      }, 'show_id');

      await sb.from('show_expenses').delete().eq('organisation_id', orgId).eq('show_id', sid);
      const expRows = (f.expenses || []).map((x, i) => ({
        organisation_id: orgId,
        show_id: sid,
        expense_label: x.label || 'Expense',
        expense_amount: Math.max(0, Number(x.amount) || 0),
        currency_code: v2Currency(f.currency, settingsSnap.baseCurrency),
        sort_order: i
      }));
      if(expRows.length){
        const { error } = await sb.from('show_expenses').insert(expRows);
        v2Throw(error, 'show_expenses');
      }
    }

    /* Show contacts: primary Artist Liaison (e.promoter) + key contacts (e.contacts).
       Build rows first, then replace-all — never delete before we know inserts work. */
    {
      const scRows = [];
      let scSort = 0;
      const scSeen = new Set();

      if(s.promoter && s.promoter.name){
        const cid = await v2EnsureContact(sb, orgId, s.promoter, contactCache);
        if(cid){
          scSeen.add(cid + '|artist_liaison');
          scRows.push({
            organisation_id: orgId,
            show_id: sid,
            contact_id: cid,
            contact_role: 'artist_liaison',
            is_primary: true,
            contact_notes: null,
            sort_order: scSort++
          });
        }
      }

      for(const ct of (s.contacts || [])){
        if(!ct || !ct.name) continue;
        const mapped = v2MapShowContactRole(ct.role);
        const cid = await v2EnsureContact(sb, orgId, ct, contactCache);
        if(!cid) continue;
        const dedupe = cid + '|' + mapped.role;
        if(scSeen.has(dedupe)) continue;
        scSeen.add(dedupe);
        scRows.push({
          organisation_id: orgId,
          show_id: sid,
          contact_id: cid,
          contact_role: mapped.role,
          is_primary: false,
          contact_notes: mapped.notes,
          sort_order: scSort++
        });
      }

      const { error: scDelErr } = await sb.from('show_contacts')
        .delete().eq('organisation_id', orgId).eq('show_id', sid);
      v2Throw(scDelErr, 'show_contacts delete');
      if(store?.v2?.show_contacts){
        store.v2.show_contacts = store.v2.show_contacts.filter(sc => sc.show_id !== sid);
      }

      if(scRows.length){
        const { data: scData, error: scErr } = await sb.from('show_contacts').insert(scRows).select('*');
        v2Throw(scErr, 'show_contacts');
        if(scData && typeof v2RepoPatchLocal === 'function'){
          scData.forEach(r => { if(r) v2RepoPatchLocal('show_contacts', r); });
        }
      }
    }

    for(const [i, d] of showDrivers(s).entries()){
      if(!d.name && !d.phone) continue;
      const cid = await v2EnsureContact(sb, orgId, { id: d.id, name: d.name || 'Driver', phone: d.phone, whatsapp: d.whatsapp }, contactCache);
      const driverLegacy = 'show_driver_journey:' + (d.id || (sid + ':' + i));
      const jRow = await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        id: v2IdForLegacy('journeys', driverLegacy, d.id),
        organisation_id: orgId,
        legacy_id: driverLegacy,
        related_show_id: sid,
        tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
        journey_type: 'ground_transfer',
        journey_title: d.journey || 'Transfer',
        pickup_location: d.journey || null,
        vehicle_details: d.name || null,
        departure_at: v2CombineDateTime(s.date, d.time),
        sort_order: i
      });
      if(cid && jRow){
        await v2UpsertPk(sb, 'journey_contacts', {
          organisation_id: orgId,
          journey_id: jRow.id,
          contact_id: cid,
          contact_role: 'driver',
          sort_order: 0
        }, 'journey_id,contact_id,contact_role');
      }
    }

    if(s.hotel && (s.hotel.name || s.hotel.address || s.hotel.city)){
      const h = s.hotel;
      const hotelLegacy = 'hotel:' + sid;
      const bookingRef = (h.bookingRef || h.conf || '').trim() || null;
      const roomNotes = (h.notes || '').trim() || null;
      const hotelRow = await v2UpsertOneByLegacy(sb, 'hotels', orgId, {
        id: v2IdForLegacy('hotels', hotelLegacy, h._hotelId),
        organisation_id: orgId,
        legacy_id: hotelLegacy,
        hotel_name: h.name || 'Hotel',
        address_line_1: h.address || null,
        address_line_2: h.address2 || null,
        city: h.city || null,
        region: h.region || null,
        postal_code: h.postcode || null,
        country_code: v2CountryCode(h.country),
        phone_number: h.phone || null,
        email_address: h.email || null,
        hotel_notes: roomNotes
      });
      if(hotelRow){
        h._hotelId = hotelRow.id;
        const checkIn = h.checkin || s.date;
        const checkOut = h.checkout || h.checkin || s.date;
        const bookingLegacy = 'show_hotel:' + sid;
        const bk = await v2UpsertOneByLegacy(sb, 'hotel_bookings', orgId, {
          id: v2IdForLegacy('hotel_bookings', bookingLegacy, h._bookingId),
          organisation_id: orgId,
          legacy_id: bookingLegacy,
          hotel_id: hotelRow.id,
          tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
          check_in_date: checkIn,
          check_out_date: checkOut >= checkIn ? checkOut : checkIn,
          booking_reference: bookingRef,
          room_notes: roomNotes,
          is_done: !!h.done
        });
        if(bk){
          h._bookingId = bk.id;
          await v2UpsertPk(sb, 'hotel_booking_shows', {
            organisation_id: orgId,
            hotel_booking_id: bk.id,
            show_id: sid
          }, 'hotel_booking_id,show_id');
        }
      }
    }

    if(s.flightNo && !(s.flights || []).length){
      const primaryLegacy = 'show_primary_flight:' + sid;
      await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        id: v2IdForLegacy('journeys', primaryLegacy, s._primaryFlightId),
        organisation_id: orgId,
        legacy_id: primaryLegacy,
        related_show_id: sid,
        tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
        journey_type: 'flight',
        journey_title: s.flightNo,
        flight_number: s.flightNo,
        departure_terminal: s.terminal || null,
        departure_gate: s.gate || null,
        journey_status: s.fstatus || null,
        delay_description: s.delay || null,
        status_updated_at: s.fiUpdated ? new Date(s.fiUpdated).toISOString() : null,
        is_live_status: !!s.fiLive,
        sort_order: -1
      });
    }

    for(const [i, f] of (s.flights || []).entries()){
      if(typeof ensureFlightPassengers === 'function') ensureFlightPassengers(f);
      const flightTimes = v2NormalizeJourneyTimes(
        v2CombineDateTime(s.date, f.dep),
        v2CombineDateTime(s.date, f.arr)
      );
      const flightLegacy = 'show_flight:' + f.id;
      const paxMeta = (f.passengers || []).map(p => {
        if(!p.id) p.id = newUuid();
        return { id: p.id, name: p.name || '', seat: p.seat || '' };
      });
      const jRow = await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        id: v2IdForLegacy('journeys', flightLegacy, f.id),
        organisation_id: orgId,
        legacy_id: flightLegacy,
        related_show_id: sid,
        tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
        journey_type: 'flight',
        journey_title: f.code || 'Flight',
        flight_number: f.code || null,
        departure_location_code: f.from || null,
        arrival_location_code: f.to || null,
        departure_at: flightTimes.departure_at,
        arrival_at: flightTimes.arrival_at,
        journey_notes: null,
        departure_terminal: f.terminal || null,
        departure_gate: f.gate || null,
        journey_status: f.fstatus || null,
        delay_description: f.delay || null,
        status_updated_at: f.fiUpdated ? new Date(f.fiUpdated).toISOString() : null,
        passengers: paxMeta,
        sort_order: i
      });

      for(const pax of (f.passengers || [])){
        for(const pp of (pax.passes || [])){
          const path = await ensurePassUploaded(pp, s.id, f.id);
          if(!path || !jRow) continue;
          const fileId = await v2UpsertFile(sb, orgId, pp, path, mimeFromPassKind(pp.kind));
          await v2UpsertTravelTicket(sb, orgId, pp, jRow.id, fileId, pax);
        }
      }
      /* Legacy top-level passes (pre-passenger model) attach to first passenger.
         Skip any pass already owned by a passenger so we never double-upload. */
      const claimedPassIds = new Set();
      (f.passengers || []).forEach(pax => (pax.passes || []).forEach(pp => {
        if(pp && pp.id) claimedPassIds.add(pp.id);
      }));
      const legacyPasses = (f.passes || []).filter(pp => pp && pp.id && !claimedPassIds.has(pp.id));
      if(legacyPasses.length && jRow){
        const fallbackPax = (f.passengers && f.passengers[0]) || { id: null, name: '', seat: f.seat || '' };
        for(const pp of legacyPasses){
          const path = await ensurePassUploaded(pp, s.id, f.id);
          if(!path) continue;
          const fileId = await v2UpsertFile(sb, orgId, pp, path, mimeFromPassKind(pp.kind));
          await v2UpsertTravelTicket(sb, orgId, pp, jRow.id, fileId, fallbackPax);
        }
      }
    }

    const chkBatch = (s.checklist || []).map((c, i) => {
      v2EnsureId(c);
      const leg = 'show_checklist:' + c.id;
      const id = v2IdForLegacy('checklist_items', leg, c.id);
      c.id = id;
      return {
        id,
        organisation_id: orgId,
        legacy_id: leg,
        show_id: sid,
        item_label: c.label,
        is_done: !!c.done,
        sort_order: i
      };
    });
    if(chkBatch.length) await v2UpsertById(sb, 'checklist_items', orgId, chkBatch);

    const tlBatch = (s.timeline || []).map((t, i) => {
      v2EnsureId(t);
      const leg = 'show_timeline:' + t.id;
      const id = v2IdForLegacy('schedule_items', leg, t.id);
      t.id = id;
      return {
        id,
        organisation_id: orgId,
        legacy_id: leg,
        show_id: sid,
        schedule_item_type: 'custom',
        item_title: t.title || 'Schedule item',
        item_notes: t.sub || null,
        scheduled_date: s.date,
        scheduled_time: t.time || null,
        is_done: !!t.done,
        sort_order: i
      };
    });
    if(tlBatch.length) await v2UpsertById(sb, 'schedule_items', orgId, tlBatch);

    for(const att of (s.attachments || [])){
      let path = att._storagePath || null;
      if(!path && att.data && att.data.startsWith('data:')){
        try{
          const up = await uploadFileDataUrl(att.data, s.id, 'attachment', att.id);
          path = up.path; att._storagePath = path; att.data = up.url;
        }catch(e){}
      }
      if(!path) continue;
      const fileId = await v2UpsertFile(sb, orgId, att, path, att.kind || att.mime);
      await v2UpsertPk(sb, 'show_files', {
        organisation_id: orgId,
        show_id: sid,
        file_id: fileId,
        file_type: 'other',
        file_title: att.name || null,
        sort_order: 0
      }, 'show_id,file_id');
    }
  }

  for(const l of (needLogistics ? logistics : [])){
    if(l.kind === 'travel'){
      const jType = v2JourneyTypeFromEvent(l) || 'other';
      const showUuid = (l.showId && isUuid(l.showId)) ? l.showId : null;
      const travelTimes = v2NormalizeJourneyTimes(
        v2CombineDateTime(l.date, l.start),
        v2CombineDateTime(l.date, l.end)
      );
      const travelLegacy = 'logistics:' + l.id;
      const jRow = await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        id: v2IdForLegacy('journeys', travelLegacy, l.id),
        organisation_id: orgId,
        legacy_id: travelLegacy,
        related_show_id: showUuid,
        journey_type: jType,
        journey_title: l.title || logisticTypeLabel(l),
        departure_at: travelTimes.departure_at,
        arrival_at: travelTimes.arrival_at,
        departure_location_name: l.from || null,
        arrival_location_name: l.to || null,
        flight_number: l.flightNo || null,
        departure_gate: l.gate || null,
        departure_terminal: l.terminal || null,
        journey_status: l.fstatus || null,
        delay_description: l.delay || null,
        journey_notes: packLogisticInfo(l),
        is_done: !!l.done,
        sort_order: 0
      });

      for(const pp of (l.passes || [])){
        const path = await ensurePassUploaded(pp, l.showId || l.id, l.id);
        if(!path || !jRow) continue;
        const fileId = await v2UpsertFile(sb, orgId, pp, path, mimeFromPassKind(pp.kind));
        await v2UpsertTravelTicket(sb, orgId, pp, jRow.id, fileId);
      }
    } else if(l.kind === 'stay'){
      const stayHotelLegacy = 'hotel:stay:' + l.id;
      const hotelRow = await v2UpsertOneByLegacy(sb, 'hotels', orgId, {
        id: v2IdForLegacy('hotels', stayHotelLegacy, l._hotelId),
        organisation_id: orgId,
        legacy_id: stayHotelLegacy,
        hotel_name: l.place || l.title || 'Hotel',
        address_line_1: l.addr || null
      });
      if(hotelRow){
        l._hotelId = hotelRow.id;
        const showUuid = (l.showId && isUuid(l.showId)) ? l.showId : null;
        const stayLegacy = 'logistics_stay:' + l.id;
        const bk = await v2UpsertOneByLegacy(sb, 'hotel_bookings', orgId, {
          id: v2IdForLegacy('hotel_bookings', stayLegacy, l.id),
          organisation_id: orgId,
          legacy_id: stayLegacy,
          hotel_id: hotelRow.id,
          check_in_date: l.date,
          check_out_date: l.date,
          booking_reference: l.bookingRef || null,
          is_done: !!l.done,
          booking_notes: packLogisticInfo(l)
        });
        if(showUuid && bk){
          await v2UpsertPk(sb, 'hotel_booking_shows', {
            organisation_id: orgId,
            hotel_booking_id: bk.id,
            show_id: showUuid
          }, 'hotel_booking_id,show_id');
        }
      }
    } else if(l.kind === 'marker'){
      const showUuid = (l.showId && isUuid(l.showId)) ? l.showId : null;
      {
        const markerLegacy = 'logistics_marker:' + l.id;
        await v2UpsertOneByLegacy(sb, 'schedule_items', orgId, {
          id: v2IdForLegacy('schedule_items', markerLegacy, l.id),
          organisation_id: orgId,
          legacy_id: markerLegacy,
          show_id: showUuid,
          schedule_item_type: 'calendar_marker',
          item_title: l.title || 'Calendar marker',
          item_notes: l.info || null,
          scheduled_date: l.date,
          scheduled_time: l.start || null,
          scheduled_end_time: l.end || null,
          is_all_day: !!l.allDay,
          is_done: !!l.done,
          sort_order: 0
        });
      }
    }
  }

  for(const t of (needTripNested ? (full ? tripsSnap : tripsPush) : [])){
    const tid = t.id;
    if(!tid) continue;
    for(const [i, c] of (t.checklist || []).entries()){
      await v2UpsertOneByLegacy(sb, 'checklist_items', orgId, {
        id: v2EnsureId(c),
        organisation_id: orgId,
        legacy_id: 'tour_checklist:' + c.id,
        tour_id: tid,
        item_label: c.label,
        is_done: !!c.done,
        sort_order: i
      });
    }
    for(const [i, tl] of (t.timeline || []).entries()){
      await v2UpsertOneByLegacy(sb, 'schedule_items', orgId, {
        id: v2EnsureId(tl),
        organisation_id: orgId,
        legacy_id: 'tour_timeline:' + tl.id,
        tour_id: tid,
        schedule_item_type: tl.type === 'deadline' ? 'deadline' : (tl.type === 'marker' ? 'calendar_marker' : 'custom'),
        item_title: tl.title || 'Tour schedule item',
        item_notes: tl.sub || null,
        scheduled_date: tl.date || t.start,
        scheduled_time: tl.time || null,
        scheduled_end_time: tl.endTime || null,
        is_all_day: !!tl.allDay,
        is_done: !!tl.done,
        sort_order: i
      });
    }
    for(const [i, em] of (t.emergency || []).entries()){
      const cid = await v2EnsureContact(sb, orgId, em, contactCache);
      if(cid){
        await v2UpsertPk(sb, 'tour_contacts', {
          organisation_id: orgId,
          tour_id: tid,
          contact_id: cid,
          contact_role: 'emergency',
          sort_order: i
        }, 'tour_id,contact_id,contact_role');
      }
    }
  }

  const packingTemplate = packingTemplateSnap;
  if(needSettings && packingTemplate.length){
    let pl = null;
    const { data: existing } = await sb.from('packing_lists')
      .select('id')
      .eq('organisation_id', orgId)
      .eq('is_organisation_template', true)
      .limit(1)
      .maybeSingle();
    pl = existing;
    if(!pl){
      const { data: inserted, error } = await sb.from('packing_lists').insert({
        organisation_id: orgId,
        list_name: 'Default packing list',
        is_organisation_template: true,
        is_archived: false
      }).select('id').single();
      v2Throw(error, 'packing_lists');
      pl = inserted;
    }
    if(pl){
      await sb.from('packing_list_items').delete().eq('organisation_id', orgId).eq('packing_list_id', pl.id);
      const itemRows = packingTemplate.map((label, i) => ({
        organisation_id: orgId,
        packing_list_id: pl.id,
        item_label: label,
        is_done: false,
        sort_order: i
      }));
      if(itemRows.length){
        const { error } = await sb.from('packing_list_items').insert(itemRows);
        v2Throw(error, 'packing_list_items');
      }
    }
  }

  if(canFinance && needInvoices){
    for(const inv of invoicesPush){
      if(!inv.number) continue;
      const showUuid = (inv.eventId && isUuid(inv.eventId)) ? inv.eventId : null;
      const invPayload = {
        organisation_id: orgId,
        show_id: showUuid,
        invoice_number: inv.number,
        invoice_date: inv.date || new Date().toISOString().slice(0, 10),
        due_date: inv.dueDate || null,
        client_name: inv.client || 'Unknown client',
        client_email_address: inv.clientEmail || null,
        client_address: inv.clientAddr || null,
        currency_code: v2Currency(inv.currency, settingsSnap.baseCurrency),
        invoice_status: inv.status || 'draft',
        payment_terms_days: inv.terms || 30,
        invoice_notes: inv.notes || null
      };
      const existingInv = (store.v2?.invoices || []).find(x => x.invoice_number === inv.number);
      if(existingInv?.id) invPayload.id = existingInv.id;
      else if(inv.id && isUuid(inv.id)) invPayload.id = inv.id;
      const { data: invRow, error: invErr } = await sb.from('invoices')
        .upsert(invPayload, { onConflict: 'organisation_id,invoice_number' })
        .select('*').maybeSingle();
      if(invErr){
        console.warn('invoices upsert', invErr);
        continue;
      }
      if(invRow){
        inv.id = invRow.id;
        await sb.from('invoice_line_items').delete().eq('organisation_id', orgId).eq('invoice_id', invRow.id);
        const lines = (inv.lines || []).map((l, i) => ({
          organisation_id: orgId,
          invoice_id: invRow.id,
          line_label: l.label || 'Item',
          line_description: l.description || null,
          quantity: 1,
          unit_amount: l.amount || 0,
          sort_order: i
        }));
        if(lines.length){
          const { error } = await sb.from('invoice_line_items').insert(lines);
          if(error) console.warn('invoice_line_items', error);
        }
      }
    }
  }

  // Itineraries live in user_preferences.ui_preferences (already written above).
  // Avoid re-inserting itinerary_submissions on every push (duplicate rows).

  /* Targeted deletes for dirty show/tour ids removed locally. */
  if(needShows){
    const showDirty = dirtyIds(dirty, 'shows');
    if(showDirty){
      const local = new Set(showsAll.map(s => s.id));
      const gone = [...showDirty].filter(id => id && !local.has(id));
      if(gone.length){
        const { error } = await sb.from('shows').delete().eq('organisation_id', orgId).in('id', gone);
        if(error) console.warn('shows targeted delete', error);
      }
    }
  }
  if(needTours){
    const tourDirty = dirtyIds(dirty, 'tours');
    if(tourDirty){
      const local = new Set(tripsSnap.map(t => t.id));
      const gone = [...tourDirty].filter(id => id && !local.has(id));
      if(gone.length){
        const { error } = await sb.from('tours').delete().eq('organisation_id', orgId).in('id', gone);
        if(error) console.warn('tours targeted delete', error);
      }
    }
  }

  if(full){
    const localShowIds = new Set(showsAll.map(s => s.id));
    const localLogIds = new Set(logisticsAll.map(l => l.id));
    const localTripIds = new Set(tripsSnap.map(t => t.id));
    const localIdeaIds = new Set(ideasSnap.map(x => x.id));
    const localNoteFolderIds = new Set(noteFoldersSnap.map(x => x.id));
    const localNoteIds = new Set(notesSnap.map(x => x.id));
    const localFileIds = new Set();
    showsAll.forEach(s => {
      (s.attachments || []).forEach(a => { if(a.id) localFileIds.add(a.id); });
      (s.flights || []).forEach(f => {
        if(typeof flightAllPasses === 'function'){
          flightAllPasses(f).forEach(p => { if(p.id) localFileIds.add(p.id); });
        } else {
          (f.passes || []).forEach(p => { if(p.id) localFileIds.add(p.id); });
          (f.passengers || []).forEach(pax => (pax.passes || []).forEach(p => { if(p.id) localFileIds.add(p.id); }));
        }
      });
    });
    logisticsAll.forEach(l => (l.passes || []).forEach(p => { if(p.id) localFileIds.add(p.id); }));

    const known = knownSnap;

    async function deleteOrphansById(table, localSet){
      const { data: rows } = await sb.from(table).select('id').eq('organisation_id', orgId);
      const orphans = (rows || [])
        .map(r => r.id)
        .filter(id => id && !localSet.has(id) && known.has(id));
      if(orphans.length){
        const { error } = await sb.from(table).delete().eq('organisation_id', orgId).in('id', orphans);
        if(error) console.warn('orphan delete', table, error);
      }
    }

    const journeyLocalIds = new Set([
      ...localLogIds,
      ...showsAll.flatMap(s => (s.flights || []).map(f => f.id)),
      ...showsAll.flatMap(s => showDrivers(s).map(d => d.id)),
      ...showsAll.map(s => s._primaryFlightId).filter(Boolean)
    ]);

    await deleteOrphansById('shows', localShowIds);
    await deleteOrphansById('journeys', journeyLocalIds);
    await deleteOrphansById('tours', localTripIds);
    await deleteOrphansById('ideas', localIdeaIds);
    await deleteOrphansById('notes', localNoteIds);
    await deleteOrphansById('note_folders', localNoteFolderIds);
    await deleteOrphansById('files', localFileIds);

    store._known = [
      ...localShowIds, ...localLogIds, ...localTripIds, ...localIdeaIds,
      ...localNoteFolderIds, ...localNoteIds, ...localFileIds,
      ...showsAll.flatMap(s => (s.flights || []).map(f => f.id))
    ];
  }

  return dirty;
}
