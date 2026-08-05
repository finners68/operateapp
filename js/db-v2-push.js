/* Decompose artisthq.v2 store into V2 relational upserts.
   Prefer bulk upsert on (organisation_id,legacy_id). Fall back to
   update-or-insert if PostgREST rejects onConflict. */

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
  return /^[A-Z]{2}$/.test(s) ? s : null;
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

/* Load existing id map for an org table by legacy_id (stripped + raw). */
async function v2LoadLegacyIds(sb, table, orgId){
  const { data, error } = await sb.from(table).select('id,legacy_id').eq('organisation_id', orgId);
  v2Throw(error, table + ' select');
  const byLegacy = {};
  (data || []).forEach(r => {
    if(!r.legacy_id) return;
    byLegacy[r.legacy_id] = r.id;
    byLegacy[v2StripLegacyId(r.legacy_id)] = r.id;
  });
  return byLegacy;
}

async function v2UpsertByLegacy(sb, table, orgId, rowOrRows){
  const rows = (Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]).filter(Boolean);
  if(!rows.length) return [];
  const payload = rows.map(r => {
    const row = Object.assign({}, r, { organisation_id: orgId });
    delete row.id;
    return row;
  });

  // Fast path — requires unique index on (organisation_id, legacy_id)
  const { data: upserted, error: upErr } = await sb.from(table)
    .upsert(payload, { onConflict: 'organisation_id,legacy_id' })
    .select('id,legacy_id');
  if(!upErr) return upserted || [];

  // Slow path fallback
  console.warn('v2 bulk upsert fallback for', table, upErr.message || upErr);
  const byLegacy = await v2LoadLegacyIds(sb, table, orgId);
  const out = [];
  for(const row of payload){
    const existingId = row.legacy_id
      ? (byLegacy[row.legacy_id] || byLegacy[v2StripLegacyId(row.legacy_id)])
      : null;
    if(existingId){
      const { data, error } = await sb.from(table).update(row).eq('id', existingId).select('id,legacy_id').single();
      v2Throw(error, table + ' update');
      out.push(data);
      if(data?.legacy_id){
        byLegacy[data.legacy_id] = data.id;
        byLegacy[v2StripLegacyId(data.legacy_id)] = data.id;
      }
    } else {
      const { data, error } = await sb.from(table).insert(row).select('id,legacy_id').single();
      v2Throw(error, table + ' insert');
      out.push(data);
      if(data?.legacy_id){
        byLegacy[data.legacy_id] = data.id;
        byLegacy[v2StripLegacyId(data.legacy_id)] = data.id;
      }
    }
  }
  return out;
}

async function v2UpsertOneByLegacy(sb, table, orgId, row){
  const rows = await v2UpsertByLegacy(sb, table, orgId, row);
  return rows[0] || null;
}

async function v2UpsertFile(sb, orgId, att, storagePath, mime){
  const row = {
    organisation_id: orgId,
    legacy_id: att.id,
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
  const row = {
    organisation_id: orgId,
    legacy_id: c.id || uid('con'),
    display_name: c.name,
    email_address: c.email || null,
    phone_number: c.phone || null,
    whatsapp_number: c.whatsapp || null,
    contact_notes: c.notes || null
  };
  if(!c.id) c.id = row.legacy_id;
  const data = await v2UpsertOneByLegacy(sb, 'contacts', orgId, row);
  cache.set(key, data.id);
  return data.id;
}

async function v2UpsertPk(sb, table, row, onConflict){
  const { data, error } = await sb.from(table).upsert(row, { onConflict }).select('*').maybeSingle();
  v2Throw(error, table + ' upsert');
  return data;
}

async function pushToSupabaseV2(orgId){
  const sb = getSupabase();
  if(!sb || !orgId || !store) return;

  const memberRole = await v2GetMemberRole(sb, orgId);
  const canFinance = v2CanManageFinance(memberRole);
  const contactCache = new Map();

  const shows = store.events.filter(e => (e.kind || 'show') === 'show');
  const logistics = store.events.filter(e => ['travel','stay','marker'].includes(e.kind));

  const uiPrefs = {
    security: store.settings?.security || {},
    packingTemplate: store.settings?.packingTemplate || [],
    homeHeaderPath: store.settings?._homeHeaderPath
      || (typeof store.settings?.homeHeader === 'string' && !store.settings.homeHeader.startsWith('http') && !store.settings.homeHeader.startsWith('data:')
        ? store.settings.homeHeader : null),
    artistName: store.settings?.artistName,
    itineraries: store.itineraries || []
  };

  const settingsRow = {
    organisation_id: orgId,
    base_currency_code: v2Currency(store.settings?.baseCurrency, 'GBP'),
    home_airport_iata: v2Iata(store.settings?.homeAirport),
    account_type: V2_ACCT_FROM_STORE[store.settings?.accountType] || null,
    invoice_prefix: store.settings?.invoicePrefix || 'INV',
    invoice_next_sequence: Math.max(1, store.settings?.invoiceSeq || 1),
    invoice_default_terms_days: Math.max(0, store.settings?.invoiceTerms || 30),
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

  const bill = store.settings?.billing || {};
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

  const fx = store.settings?.fx || {};
  const fxRows = Object.keys(fx).filter(k => /^[A-Z]{3}$/i.test(k)).map(k => ({
    organisation_id: orgId,
    currency_code: k.toUpperCase(),
    rate_to_base: Number(fx[k]) || 1
  }));
  if(fxRows.length){
    const { error } = await sb.from('organisation_exchange_rates').upsert(fxRows, { onConflict: 'organisation_id,currency_code' });
    v2Throw(error, 'organisation_exchange_rates');
  }

  const user = await getAuthUser();
  if(user){
    const { error } = await sb.from('user_preferences').upsert({
      organisation_id: orgId,
      user_id: user.id,
      last_open_tab: store.tab || 'home',
      ui_preferences: uiPrefs
    }, { onConflict: 'organisation_id,user_id' });
    v2Throw(error, 'user_preferences');
  }

  for(const c of (store.contacts || [])){
    await v2EnsureContact(sb, orgId, c, contactCache);
  }

  const artistRows = (store.artists || []).map(a => ({
    organisation_id: orgId,
    legacy_id: a.id,
    display_name: a.name || a.display_name || 'Artist',
    is_default: !!a.default
  }));
  if(!artistRows.length && store.settings?.artistName){
    artistRows.push({
      organisation_id: orgId,
      legacy_id: 'default-artist',
      display_name: store.settings.artistName,
      is_default: true
    });
  }
  if(artistRows.length) await v2UpsertByLegacy(sb, 'artists', orgId, artistRows);

  const tripRows = (store.trips || []).map(t => ({
    organisation_id: orgId,
    legacy_id: t.id,
    tour_name: t.name,
    color_key: t.color,
    start_date: t.start || null,
    end_date: t.end || null,
    is_archived: !!t.archived
  }));
  if(tripRows.length) await v2UpsertByLegacy(sb, 'tours', orgId, tripRows);

  const tourUuidMap = await v2LoadLegacyIds(sb, 'tours', orgId);

  const venueRows = [];
  for(const s of shows){
    if(!s.venue && !s.city) continue;
    venueRows.push({
      organisation_id: orgId,
      legacy_id: 'venue:' + s.id,
      venue_name: s.venue || 'Venue',
      address_line_1: s.venueAddr || null,
      city: s.city || null,
      country_code: v2CountryCode(s.country)
    });
  }
  if(venueRows.length) await v2UpsertByLegacy(sb, 'venues', orgId, venueRows);

  const venueUuidMap = await v2LoadLegacyIds(sb, 'venues', orgId);
  const artistUuidMap = await v2LoadLegacyIds(sb, 'artists', orgId);

  const showRows = shows.map(s => ({
    organisation_id: orgId,
    legacy_id: s.id,
    tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
    primary_artist_id: s.artist
      ? (artistUuidMap['default-artist'] || artistUuidMap[Object.keys(artistUuidMap).find(k => !k.includes(':'))] || null)
      : null,
    venue_id: venueUuidMap['venue:' + s.id] || null,
    show_date: s.date,
    show_status: V2_SHOW_STATUS_FROM_STORE[s.status] || 'confirmed',
    color_key: s.color || null,
    venue_arrival_time: s.arrival || null,
    set_start_time: s.setTime || null,
    set_end_time: s.endTime || null,
    internal_notes: s.notes || null,
    content_plan: s.content || null,
    is_set_done: !!s.setDone
  }));
  if(showRows.length) await v2UpsertByLegacy(sb, 'shows', orgId, showRows);

  const showUuidMap = await v2LoadLegacyIds(sb, 'shows', orgId);

  for(const s of shows){
    const sid = showUuidMap[s.id];
    if(!sid) continue;

    if(s.advance){
      const a = s.advance;
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
        general_remarks: a.remarks || null
      }, 'show_id');
    }

    if(canFinance && s.finance){
      const f = s.finance;
      await v2UpsertPk(sb, 'show_financials', {
        show_id: sid,
        organisation_id: orgId,
        agreed_fee_amount: f.fee,
        currency_code: v2Currency(f.currency, store.settings?.baseCurrency),
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
        currency_code: v2Currency(f.currency, store.settings?.baseCurrency),
        sort_order: i
      }));
      if(expRows.length){
        const { error } = await sb.from('show_expenses').insert(expRows);
        v2Throw(error, 'show_expenses');
      }
    }

    if(s.promoter && s.promoter.name){
      const cid = await v2EnsureContact(sb, orgId, s.promoter, contactCache);
      if(cid){
        await sb.from('show_contacts').delete().eq('organisation_id', orgId)
          .eq('show_id', sid).eq('contact_role', 'artist_liaison');
        const { error } = await sb.from('show_contacts').insert({
          organisation_id: orgId,
          show_id: sid,
          contact_id: cid,
          contact_role: 'artist_liaison',
          is_primary: true,
          sort_order: 0
        });
        v2Throw(error, 'show_contacts promoter');
      }
    }

    for(const [i, d] of showDrivers(s).entries()){
      if(!d.name && !d.phone) continue;
      const cid = await v2EnsureContact(sb, orgId, { id: d.id, name: d.name || 'Driver', phone: d.phone, whatsapp: d.whatsapp }, contactCache);
      const jLegacy = v2PrefixedLegacy('show_driver_journey:', s.id + ':' + i);
      const jRow = await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        organisation_id: orgId,
        legacy_id: jLegacy,
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

    if(s.hotel && (s.hotel.name || s.hotel.address)){
      const h = s.hotel;
      const hotelLegacy = 'hotel:' + s.id;
      const hotelRow = await v2UpsertOneByLegacy(sb, 'hotels', orgId, {
        organisation_id: orgId,
        legacy_id: hotelLegacy,
        hotel_name: h.name || 'Hotel',
        address_line_1: h.address || null,
        postal_code: h.postcode || null,
        phone_number: h.phone || null,
        email_address: h.email || null
      });
      if(hotelRow){
        const bookingLegacy = v2PrefixedLegacy('show_hotel:', s.id);
        const checkIn = h.checkin || s.date;
        const checkOut = h.checkout || h.checkin || s.date;
        const bk = await v2UpsertOneByLegacy(sb, 'hotel_bookings', orgId, {
          organisation_id: orgId,
          legacy_id: bookingLegacy,
          hotel_id: hotelRow.id,
          tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
          check_in_date: checkIn,
          check_out_date: checkOut >= checkIn ? checkOut : checkIn,
          booking_reference: h.bookingRef || null,
          is_done: !!h.done
        });
        if(bk){
          await v2UpsertPk(sb, 'hotel_booking_shows', {
            organisation_id: orgId,
            hotel_booking_id: bk.id,
            show_id: sid
          }, 'hotel_booking_id,show_id');
        }
      }
    }

    if(s.flightNo && !(s.flights || []).length){
      await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        organisation_id: orgId,
        legacy_id: v2PrefixedLegacy('show_primary_flight:', s.id),
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
      const jLegacy = v2PrefixedLegacy('show_flight:', f.id);
      const flightTimes = v2NormalizeJourneyTimes(
        v2CombineDateTime(s.date, f.dep),
        v2CombineDateTime(s.date, f.arr)
      );
      const jRow = await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        organisation_id: orgId,
        legacy_id: jLegacy,
        related_show_id: sid,
        tour_id: s.tripId && tourUuidMap[s.tripId] ? tourUuidMap[s.tripId] : null,
        journey_type: 'flight',
        journey_title: f.code || 'Flight',
        flight_number: f.code || null,
        departure_location_code: f.from || null,
        arrival_location_code: f.to || null,
        departure_at: flightTimes.departure_at,
        arrival_at: flightTimes.arrival_at,
        journey_notes: f.seat ? 'Legacy seat: ' + f.seat : null,
        sort_order: i
      });

      for(const pp of (f.passes || [])){
        const path = await ensurePassUploaded(pp, s.id, f.id);
        if(!path || !jRow) continue;
        const fileId = await v2UpsertFile(sb, orgId, pp, path, mimeFromPassKind(pp.kind));
        await v2UpsertOneByLegacy(sb, 'travel_tickets', orgId, {
          organisation_id: orgId,
          legacy_id: pp.id,
          journey_id: jRow.id,
          file_id: fileId,
          ticket_type: 'boarding_pass',
          sort_order: 0
        });
      }
    }

    const chkBatch = (s.checklist || []).map((c, i) => ({
      organisation_id: orgId,
      legacy_id: v2PrefixedLegacy('show_checklist:', c.id),
      show_id: sid,
      item_label: c.label,
      is_done: !!c.done,
      sort_order: i
    }));
    if(chkBatch.length) await v2UpsertByLegacy(sb, 'checklist_items', orgId, chkBatch);

    const tlBatch = (s.timeline || []).map((t, i) => ({
      organisation_id: orgId,
      legacy_id: v2PrefixedLegacy('show_timeline:', t.id),
      show_id: sid,
      schedule_item_type: 'custom',
      item_title: t.title || 'Schedule item',
      item_notes: t.sub || null,
      scheduled_date: s.date,
      scheduled_time: t.time || null,
      is_done: !!t.done,
      sort_order: i
    }));
    if(tlBatch.length) await v2UpsertByLegacy(sb, 'schedule_items', orgId, tlBatch);

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

  for(const l of logistics){
    if(l.kind === 'travel'){
      const jType = v2JourneyTypeFromEvent(l) || 'other';
      const jLegacy = v2PrefixedLegacy('logistics:', l.id);
      const showUuid = l.showId && showUuidMap[l.showId] ? showUuidMap[l.showId] : null;
      const travelTimes = v2NormalizeJourneyTimes(
        v2CombineDateTime(l.date, l.start),
        v2CombineDateTime(l.date, l.end)
      );
      const jRow = await v2UpsertOneByLegacy(sb, 'journeys', orgId, {
        organisation_id: orgId,
        legacy_id: jLegacy,
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
        await v2UpsertOneByLegacy(sb, 'travel_tickets', orgId, {
          organisation_id: orgId,
          legacy_id: pp.id,
          journey_id: jRow.id,
          file_id: fileId,
          ticket_type: 'boarding_pass',
          sort_order: 0
        });
      }
    } else if(l.kind === 'stay'){
      const hotelLegacy = 'hotel:stay:' + l.id;
      const hotelRow = await v2UpsertOneByLegacy(sb, 'hotels', orgId, {
        organisation_id: orgId,
        legacy_id: hotelLegacy,
        hotel_name: l.place || l.title || 'Hotel',
        address_line_1: l.addr || null
      });
      if(hotelRow){
        const showUuid = l.showId && showUuidMap[l.showId] ? showUuidMap[l.showId] : null;
        const bk = await v2UpsertOneByLegacy(sb, 'hotel_bookings', orgId, {
          organisation_id: orgId,
          legacy_id: v2PrefixedLegacy('logistics_stay:', l.id),
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
      const showUuid = l.showId && showUuidMap[l.showId] ? showUuidMap[l.showId] : null;
      if(showUuid){
        await v2UpsertOneByLegacy(sb, 'schedule_items', orgId, {
          organisation_id: orgId,
          legacy_id: v2PrefixedLegacy('logistics_marker:', l.id),
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

  for(const t of (store.trips || [])){
    const tid = tourUuidMap[t.id];
    if(!tid) continue;
    for(const [i, c] of (t.checklist || []).entries()){
      await v2UpsertOneByLegacy(sb, 'checklist_items', orgId, {
        organisation_id: orgId,
        legacy_id: v2PrefixedLegacy('tour_checklist:', t.id + ':' + c.id),
        tour_id: tid,
        item_label: c.label,
        is_done: !!c.done,
        sort_order: i
      });
    }
    for(const [i, tl] of (t.timeline || []).entries()){
      await v2UpsertOneByLegacy(sb, 'schedule_items', orgId, {
        organisation_id: orgId,
        legacy_id: v2PrefixedLegacy('tour_timeline:', t.id + ':' + (tl.id || i)),
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

  const packingTemplate = store.settings?.packingTemplate || [];
  if(packingTemplate.length){
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

  if(canFinance){
    for(const inv of (store.invoices || [])){
      if(!inv.number) continue;
      const showUuid = inv.eventId && showUuidMap[inv.eventId] ? showUuidMap[inv.eventId] : null;
      const invRow = await v2UpsertOneByLegacy(sb, 'invoices', orgId, {
        organisation_id: orgId,
        legacy_id: inv.id,
        show_id: showUuid,
        invoice_number: inv.number,
        invoice_date: inv.date || new Date().toISOString().slice(0, 10),
        due_date: inv.dueDate || null,
        client_name: inv.client || 'Unknown client',
        client_email_address: inv.clientEmail || null,
        client_address: inv.clientAddr || null,
        currency_code: v2Currency(inv.currency, store.settings?.baseCurrency),
        invoice_status: inv.status || 'draft',
        payment_terms_days: inv.terms || 30,
        invoice_notes: inv.notes || null
      });

      if(invRow){
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
          v2Throw(error, 'invoice_line_items');
        }
      }
    }
  }

  // Itineraries live in user_preferences.ui_preferences (already written above).
  // Avoid re-inserting itinerary_submissions on every push (duplicate rows).

  const ideaRows = (store.ideas || []).map((x, i) => ({
    organisation_id: orgId,
    legacy_id: x.id,
    show_id: x.eventId && showUuidMap[x.eventId] ? showUuidMap[x.eventId] : null,
    tour_id: x.tripId && tourUuidMap[x.tripId] ? tourUuidMap[x.tripId] : null,
    idea_type: ['reel','caption','hook','youtube','podcast','interview','location'].includes(x.type) ? x.type : 'other',
    idea_title: x.title,
    idea_note: x.note,
    priority_level: V2_PRIO_FROM_STORE[x.prio] || null,
    is_done: !!x.done,
    sort_order: i
  }));
  if(ideaRows.length) await v2UpsertByLegacy(sb, 'ideas', orgId, ideaRows);

  const noteRows = (store.notes || []).map((x, i) => ({
    organisation_id: orgId,
    legacy_id: x.id,
    note_title: x.title,
    note_body: x.body,
    folder_name: x.folder,
    sort_order: i,
    updated_at: x.updated ? new Date(x.updated).toISOString() : undefined
  }));
  if(noteRows.length) await v2UpsertByLegacy(sb, 'notes', orgId, noteRows);

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

  const known = new Set(store._known || []);

  async function deleteOrphans(table, localSet){
    const { data: rows } = await sb.from(table).select('legacy_id').eq('organisation_id', orgId);
    const orphans = (rows || [])
      .filter(r => {
        if(!r.legacy_id) return false;
        const stripped = v2StripLegacyId(r.legacy_id);
        return !localSet.has(stripped) && !localSet.has(r.legacy_id) && (known.has(stripped) || known.has(r.legacy_id));
      })
      .map(r => r.legacy_id);
    if(orphans.length){
      const { error } = await sb.from(table).delete().eq('organisation_id', orgId).in('legacy_id', orphans);
      if(error) console.warn('orphan delete', table, error);
    }
  }

  const journeyLocalIds = new Set([
    ...localLogIds,
    ...shows.flatMap(s => (s.flights || []).map(f => f.id)),
    ...shows.flatMap(s => (s.flights || []).map(f => 'show_flight:' + f.id)),
    ...shows.map(s => 'show_primary_flight:' + s.id),
    ...logistics.filter(l => l.kind === 'travel').map(l => 'logistics:' + l.id)
  ]);

  await deleteOrphans('shows', localShowIds);
  await deleteOrphans('journeys', journeyLocalIds);
  await deleteOrphans('tours', localTripIds);
  await deleteOrphans('ideas', localIdeaIds);
  await deleteOrphans('notes', localNoteIds);
  await deleteOrphans('files', localFileIds);
  await deleteOrphans('travel_tickets', localFileIds);

  store._known = [
    ...localShowIds, ...localLogIds, ...localTripIds, ...localIdeaIds,
    ...localNoteIds, ...localFileIds,
    ...shows.flatMap(s => (s.flights || []).map(f => f.id))
  ];
}
