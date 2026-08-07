/* Compose look-identical view projections from V2 entity collections.
   Screens keep reading events/trips field names; ids are Postgres UUIDs. */

function showDisplay(show, venue, artist){
  if(!show) return null;
  return {
    id: show.id,
    kind: 'show',
    date: show.show_date,
    artist: artist?.display_name || '',
    tripId: show.tour_id || null,
    status: V2_SHOW_STATUS_TO_STORE[show.show_status] || show.show_status,
    color: show.color_key,
    venue: show.venue_name || venue?.venue_name || '',
    city: venue?.city || '',
    country: venue?.country_code || '',
    setTime: show.set_start_time ? String(show.set_start_time).slice(0, 5) : '',
    endTime: show.set_end_time ? String(show.set_end_time).slice(0, 5) : '',
    arrival: show.venue_arrival_time ? String(show.venue_arrival_time).slice(0, 5) : '',
    venueAddr: venue?.address_line_1 || '',
    venueAddr2: venue?.address_line_2 || '',
    venueRegion: venue?.region || '',
    venuePostcode: venue?.postal_code || '',
    notes: show.internal_notes || '',
    content: show.content_plan || '',
    setDone: !!show.is_set_done
  };
}

function v2ClassifyJourney(j){
  const leg = j.legacy_id || '';
  if(leg.startsWith('show_primary_flight:') || j.sort_order === -1 && j.journey_type === 'flight' && j.related_show_id)
    return 'show_primary_flight';
  if(leg.startsWith('show_flight:')) return 'show_flight';
  if(leg.startsWith('show_driver_journey:')) return 'show_driver';
  if(leg.startsWith('logistics:')) return 'travel';
  if(j.related_show_id && j.journey_type === 'ground_transfer') return 'show_driver';
  if(j.related_show_id && j.journey_type === 'flight') return 'show_flight';
  return 'travel';
}

function v2ClassifyHotelBooking(b){
  const leg = b.legacy_id || '';
  if(leg.startsWith('show_hotel:')) return 'show_hotel';
  if(leg.startsWith('logistics_stay:')) return 'stay';
  return 'stay';
}

function v2ContactView(c){
  if(!c) return null;
  return {
    id: c.id,
    name: c.display_name || '',
    phone: c.phone_number || '',
    whatsapp: c.whatsapp_number || '',
    email: c.email_address || '',
    notes: c.contact_notes || '',
    company: ''
  };
}

async function composeViewFromV2(v2, opts){
  opts = opts || {};
  const prevEvents = opts.prevEvents || [];
  const venueById = {};
  (v2.venues || []).forEach(v => { venueById[v.id] = v; });
  const artistById = {};
  (v2.artists || []).forEach(a => { artistById[a.id] = a; });
  const contactById = {};
  (v2.contacts || []).forEach(c => { contactById[c.id] = c; });
  const fileById = {};
  (v2.files || []).forEach(f => { fileById[f.id] = f; });
  const hotelById = {};
  (v2.hotels || []).forEach(h => { hotelById[h.id] = h; });

  const advanceByShow = {};
  (v2.show_advances || []).forEach(a => { advanceByShow[a.show_id] = a; });
  const finByShow = {};
  (v2.show_financials || []).forEach(f => { finByShow[f.show_id] = f; });
  const expByShow = {};
  (v2.show_expenses || []).forEach(x => {
    (expByShow[x.show_id] = expByShow[x.show_id] || []).push(x);
  });
  const chkByShow = {}, chkByTour = {};
  (v2.checklist_items || []).forEach(c => {
    if(c.show_id) (chkByShow[c.show_id] = chkByShow[c.show_id] || []).push(c);
    if(c.tour_id) (chkByTour[c.tour_id] = chkByTour[c.tour_id] || []).push(c);
  });
  const schedByShow = {}, schedByTour = {};
  (v2.schedule_items || []).forEach(s => {
    if(s.show_id) (schedByShow[s.show_id] = schedByShow[s.show_id] || []).push(s);
    if(s.tour_id) (schedByTour[s.tour_id] = schedByTour[s.tour_id] || []).push(s);
  });
  const showContactsByShow = {};
  (v2.show_contacts || []).forEach(sc => {
    (showContactsByShow[sc.show_id] = showContactsByShow[sc.show_id] || []).push(sc);
  });
  const emergencyByTour = {};
  (v2.tour_contacts || []).forEach(tc => {
    if(tc.contact_role !== 'emergency') return;
    (emergencyByTour[tc.tour_id] = emergencyByTour[tc.tour_id] || []).push(tc);
  });
  const journeyContactByJourney = {};
  (v2.journey_contacts || []).forEach(jc => {
    (journeyContactByJourney[jc.journey_id] = journeyContactByJourney[jc.journey_id] || []).push(jc);
  });
  const ticketsByJourney = {};
  (v2.travel_tickets || []).forEach(t => {
    (ticketsByJourney[t.journey_id] = ticketsByJourney[t.journey_id] || []).push(t);
  });
  const attachmentsByShow = {};
  (v2.show_files || []).forEach(link => {
    const f = fileById[link.file_id];
    if(!f) return;
    (attachmentsByShow[link.show_id] = attachmentsByShow[link.show_id] || []).push({ link, file: f });
  });
  const bookingShowsByBooking = {};
  (v2.hotel_booking_shows || []).forEach(hbs => {
    (bookingShowsByBooking[hbs.hotel_booking_id] = bookingShowsByBooking[hbs.hotel_booking_id] || []).push(hbs);
  });

  const embeddedHotelByShow = {};
  const stayEvents = [];
  (v2.hotel_bookings || []).forEach(b => {
    const h = hotelById[b.hotel_id];
    const links = bookingShowsByBooking[b.id] || [];
    const kind = v2ClassifyHotelBooking(b);
    if(kind === 'show_hotel'){
      const showUuid = links[0]?.show_id;
      if(showUuid){
        embeddedHotelByShow[showUuid] = {
          name: h?.hotel_name || '',
          address: h?.address_line_1 || '',
          postcode: h?.postal_code || '',
          checkin: b.check_in_date,
          checkout: b.check_out_date,
          done: b.is_done,
          bookingRef: b.booking_reference || '',
          phone: h?.phone_number || '',
          email: h?.email_address || '',
          _bookingId: b.id,
          _hotelId: h?.id
        };
      }
      return;
    }
    stayEvents.push({
      booking: b, hotel: h,
      showId: links[0]?.show_id || null
    });
  });

  const flightJourneysByShow = {};
  const travelJourneys = [];
  const driverJourneysByShow = {};
  (v2.journeys || []).forEach(j => {
    const kind = v2ClassifyJourney(j);
    if(kind === 'show_primary_flight'){
      if(j.related_show_id){
        (flightJourneysByShow[j.related_show_id] = flightJourneysByShow[j.related_show_id] || { primary: null, flights: [] }).primary = j;
      }
      return;
    }
    if(kind === 'show_flight'){
      if(j.related_show_id){
        (flightJourneysByShow[j.related_show_id] = flightJourneysByShow[j.related_show_id] || { primary: null, flights: [] }).flights.push(j);
      }
      return;
    }
    if(kind === 'show_driver'){
      if(j.related_show_id){
        (driverJourneysByShow[j.related_show_id] = driverJourneysByShow[j.related_show_id] || []).push(j);
      }
      return;
    }
    travelJourneys.push(j);
  });

  const markers = (v2.schedule_items || []).filter(s =>
    s.schedule_item_type === 'calendar_marker' || (s.legacy_id || '').startsWith('logistics_marker:')
  );

  function advanceToStore(a){
    if(!a) return null;
    const adv = {
      stage: a.stage_name || '',
      access: a.access_notes || '',
      soundcheck: a.soundcheck_notes || '',
      curfew: a.curfew_notes || '',
      dressingRoom: a.dressing_room_notes || '',
      guestlist: a.guestlist_notes || '',
      catering: a.catering_notes || '',
      parking: a.parking_notes || '',
      wifi: a.wifi_notes || '',
      navAddr: a.navigation_address || '',
      remarks: a.general_remarks || ''
    };
    let fromCol = a.running_order;
    if(typeof fromCol === 'string'){
      try{ fromCol = JSON.parse(fromCol); }catch(e){ fromCol = []; }
    }
    if(!Array.isArray(fromCol)) fromCol = [];
    const schedule = fromCol
      .map(s => ({
        id: s.id,
        time: s.time ? String(s.time).slice(0, 5) : '',
        label: s.label || s.title || '',
        title: s.label || s.title || '',
        done: !!s.done
      }))
      .filter(s => s.time || s.label);
    adv.schedule = schedule;
    return Object.keys(adv).length ? adv : null;
  }

  function financeToStore(showId, orgSettings){
    const f = finByShow[showId];
    if(!f) return { fee: 0, currency: orgSettings?.base_currency_code || 'GBP', dealType: 'Guarantee', expenses: [], perDiem: 0, commission: 0, paid: false };
    return {
      fee: f.agreed_fee_amount != null ? Number(f.agreed_fee_amount) : 0,
      currency: f.currency_code || orgSettings?.base_currency_code || 'GBP',
      dealType: f.deal_type || 'Guarantee',
      expenses: (expByShow[showId] || []).map(x => ({
        id: x.id, label: x.expense_label, amount: Number(x.expense_amount)
      })),
      perDiem: f.per_diem_amount != null ? Number(f.per_diem_amount) : 0,
      commission: f.commission_percent != null ? Number(f.commission_percent) : 0,
      paid: !!f.is_paid,
      estimated: !!f.is_estimated,
      notDisclosed: !!f.is_not_disclosed
    };
  }

  async function passesFromJourney(j){
    const list = ticketsByJourney[j.id] || [];
    const out = [];
    for(const t of list){
      const f = fileById[t.file_id];
      if(!f) continue;
      const p = {
        id: f.id,
        name: f.file_title || f.original_filename || '',
        kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path,
        data: f.storage_path,
        _ticketId: t.id
      };
      if(typeof resolveAttachment === 'function') await resolveAttachment(p);
      out.push(p);
    }
    return out;
  }

  let events = [];
  const orgSettings = v2.organisation_settings;

  for(const s of (v2.shows || [])){
    const v = s.venue_id ? venueById[s.venue_id] : null;
    const ar = s.primary_artist_id ? artistById[s.primary_artist_id] : null;
    const fj = flightJourneysByShow[s.id] || { primary: null, flights: [] };
    const base = showDisplay(s, v, ar);

    const fl = [];
    for(const j of fj.flights.sort((a,b) => (a.sort_order||0) - (b.sort_order||0))){
      const dep = j.departure_at ? new Date(j.departure_at) : null;
      const arr = j.arrival_at ? new Date(j.arrival_at) : null;
      fl.push({
        id: j.id,
        code: j.flight_number || j.journey_title || '',
        from: j.departure_location_code || j.departure_airport_iata || j.departure_location_name || '',
        to: j.arrival_location_code || j.arrival_airport_iata || j.arrival_location_name || '',
        dep: dep ? `${String(dep.getUTCHours()).padStart(2,'0')}:${String(dep.getUTCMinutes()).padStart(2,'0')}` : '',
        arr: arr ? `${String(arr.getUTCHours()).padStart(2,'0')}:${String(arr.getUTCMinutes()).padStart(2,'0')}` : '',
        seat: (j.journey_notes || '').replace(/^Legacy seat: /, '') || '',
        passes: await passesFromJourney(j)
      });
    }

    const attachments = [];
    for(const { file: f } of (attachmentsByShow[s.id] || [])){
      const att = {
        id: f.id,
        name: f.file_title || f.original_filename || '',
        kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path,
        data: f.storage_path
      };
      if(typeof resolveAttachment === 'function') await resolveAttachment(att);
      attachments.push(att);
    }

    const scList = (showContactsByShow[s.id] || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    /* Primary artist_liaison is the dedicated Artist Liaison field; other
       show_contacts (including driver-role key contacts and custom Other) go
       into e.contacts. Journey drivers still come from journey_contacts. */
    const promoterSc = scList.find(x => x.contact_role === 'artist_liaison' && x.is_primary)
      || scList.find(x => x.contact_role === 'artist_liaison');
    const promoter = promoterSc ? v2ContactView(contactById[promoterSc.contact_id]) : null;
    const showContactList = scList
      .filter(x => !promoterSc || x.id !== promoterSc.id)
      .map(x => {
        const c = v2ContactView(contactById[x.contact_id]);
        if(!c) return null;
        if(x.contact_role === 'other' && x.contact_notes) c.role = x.contact_notes;
        else c.role = x.contact_role || 'other';
        return c;
      }).filter(Boolean);

    const drivers = (driverJourneysByShow[s.id] || [])
      .sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
      .map(j => {
        const jcs = journeyContactByJourney[j.id] || [];
        const jc = jcs[0];
        const c = jc ? contactById[jc.contact_id] : null;
        return {
          id: j.id,
          journey: j.journey_title || j.pickup_location || '',
          time: j.departure_at ? v2TimeFromTs(j.departure_at) : '',
          phone: c?.phone_number || '',
          whatsapp: c?.whatsapp_number || '',
          name: c?.display_name || j.vehicle_details || '',
          noGround: false
        };
      });

    const timeline = (schedByShow[s.id] || [])
      .filter(t => !(t.legacy_id || '').startsWith('advance_schedule:')
        && (t.schedule_item_type === 'custom' || (t.legacy_id || '').startsWith('show_timeline:')))
      .map(t => ({
        id: t.id,
        time: t.scheduled_time ? String(t.scheduled_time).slice(0, 5) : '',
        title: t.item_title || '',
        sub: t.item_notes || '',
        done: t.is_done
      }));

    const primary = fj.primary;
    events.push(Object.assign(base, {
      flightNo: primary?.flight_number || '',
      terminal: primary?.departure_terminal || '',
      gate: primary?.departure_gate || '',
      fstatus: primary?.journey_status || '',
      delay: primary?.delay_description || '',
      fiUpdated: primary?.status_updated_at ? new Date(primary.status_updated_at).getTime() : null,
      fiLive: primary?.is_live_status || false,
      _primaryFlightId: primary?.id || null,
      hotel: embeddedHotelByShow[s.id] || null,
      drivers, driver: drivers.find(d => !d.noGround) || null,
      promoter, finance: financeToStore(s.id, orgSettings),
      advance: advanceToStore(advanceByShow[s.id]),
      contacts: showContactList,
      flights: fl, attachments,
      checklist: (chkByShow[s.id] || []).map(c => ({
        id: c.id, label: c.item_label, done: c.is_done
      })),
      timeline
    }));
  }

  for(const j of travelJourneys){
    const dep = j.departure_at ? new Date(j.departure_at) : null;
    const arr = j.arrival_at ? new Date(j.arrival_at) : null;
    const passes = await passesFromJourney(j);
    const it = {
      id: j.id,
      kind: 'travel',
      date: dep ? v2DateFromTs(j.departure_at) : (arr ? v2DateFromTs(j.arrival_at) : ''),
      showId: j.related_show_id || null,
      title: j.journey_title || '',
      start: dep ? `${String(dep.getUTCHours()).padStart(2,'0')}:${String(dep.getUTCMinutes()).padStart(2,'0')}` : '',
      end: arr ? `${String(arr.getUTCHours()).padStart(2,'0')}:${String(arr.getUTCMinutes()).padStart(2,'0')}` : '',
      icon: v2IconFromJourneyType(j.journey_type),
      info: j.journey_notes || '',
      allDay: false,
      done: j.is_done,
      passes,
      from: j.departure_location_code || j.departure_location_name || '',
      to: j.arrival_location_code || j.arrival_location_name || '',
      flightNo: j.flight_number || '',
      gate: j.departure_gate || '',
      terminal: j.departure_terminal || '',
      fstatus: j.journey_status || '',
      delay: j.delay_description || ''
    };
    if(typeof normalizeLogisticItem === 'function') normalizeLogisticItem(it);
    events.push(it);
  }

  for(const st of stayEvents){
    const b = st.booking, h = st.hotel;
    const it = {
      id: b.id,
      kind: 'stay',
      date: b.check_in_date,
      showId: st.showId,
      title: h?.hotel_name || 'Hotel',
      start: '',
      end: '',
      icon: 'bed',
      allDay: true,
      done: b.is_done,
      passes: [],
      place: h?.hotel_name || '',
      addr: [h?.address_line_1, h?.city, h?.postal_code].filter(Boolean).join(', '),
      bookingRef: b.booking_reference || '',
      info: b.check_in_date || '',
      _hotelId: h?.id
    };
    if(typeof normalizeLogisticItem === 'function') normalizeLogisticItem(it);
    events.push(it);
  }

  for(const m of markers){
    if((m.legacy_id || '').startsWith('show_timeline:')) continue;
    if(m.schedule_item_type === 'custom' && m.show_id && !(m.legacy_id || '').startsWith('logistics_marker:')) continue;
    if(m.schedule_item_type !== 'calendar_marker' && !(m.legacy_id || '').startsWith('logistics_marker:')) continue;
    events.push({
      id: m.id,
      kind: 'marker',
      date: m.scheduled_date,
      showId: m.show_id || null,
      title: m.item_title || '',
      start: m.scheduled_time ? String(m.scheduled_time).slice(0, 5) : '',
      end: m.scheduled_end_time ? String(m.scheduled_end_time).slice(0, 5) : '',
      icon: 'pin',
      info: m.item_notes || '',
      allDay: m.is_all_day,
      done: m.is_done
    });
  }

  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if(typeof dedupeEventsById === 'function') events = dedupeEventsById(events);
  if(typeof applyLocalPassMerge === 'function') applyLocalPassMerge(prevEvents, events);

  const fx = {};
  (v2.organisation_exchange_rates || []).forEach(r => { fx[r.currency_code] = Number(r.rate_to_base); });
  const uiPrefs = v2.user_preferences?.ui_preferences || {};
  const billing = v2.organisation_billing_profiles;
  const settings = {
    artistName: (v2.artists || []).find(a => a.is_default)?.display_name || uiPrefs.artistName || 'You',
    baseCurrency: orgSettings?.base_currency_code || 'GBP',
    homeAirport: orgSettings?.home_airport_iata || 'AMS',
    accountType: V2_ACCT_TO_STORE[orgSettings?.account_type] || orgSettings?.account_type || 'dj',
    invoicePrefix: orgSettings?.invoice_prefix || 'INV',
    invoiceSeq: orgSettings?.invoice_next_sequence || 1,
    invoiceTerms: orgSettings?.invoice_default_terms_days || 30,
    fx,
    billing: billing ? {
      name: billing.billing_name || '',
      email: billing.billing_email_address || '',
      phone: billing.billing_phone_number || '',
      address: billing.address_line_1 || '',
      addressLine2: billing.address_line_2 || '',
      city: billing.city || '',
      region: billing.region || '',
      postcode: billing.postal_code || '',
      countryCode: billing.country_code || '',
      vatNumber: billing.tax_identifier || '',
      bankAccountName: billing.bank_account_name || '',
      bankAccountNumber: billing.bank_account_number || '',
      sortCode: billing.bank_sort_code || '',
      iban: billing.bank_iban || '',
      swift: billing.bank_swift_bic || '',
      paymentNotes: billing.payment_notes || ''
    } : {},
    packingTemplate: [],
    security: uiPrefs.security || { enabled: false, pin: '', scope: 'finance', biometric: false },
    homeHeader: uiPrefs.homeHeaderPath || null
  };

  const defaultPackingList = (v2.packing_lists || [])[0];
  if(defaultPackingList){
    settings.packingTemplate = (v2.packing_list_items || [])
      .filter(p => p.packing_list_id === defaultPackingList.id)
      .sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
      .map(p => p.item_label);
  } else if(uiPrefs.packingTemplate){
    settings.packingTemplate = uiPrefs.packingTemplate;
  }

  const orgContacts = (v2.contacts || []).map(c => Object.assign(v2ContactView(c), { role: 'Promoter' }));

  const linesByInv = {};
  (v2.invoice_line_items || []).forEach(l => {
    (linesByInv[l.invoice_id] = linesByInv[l.invoice_id] || []).push(l);
  });
  const storeInvoices = (v2.invoices || []).map(inv => ({
    id: inv.id,
    eventId: inv.show_id || null,
    number: inv.invoice_number,
    date: inv.invoice_date,
    dueDate: inv.due_date,
    client: inv.client_name || '',
    clientEmail: inv.client_email_address || '',
    clientAddr: inv.client_address || '',
    currency: inv.currency_code,
    status: inv.invoice_status,
    terms: inv.payment_terms_days,
    notes: inv.invoice_notes || '',
    lines: (linesByInv[inv.id] || []).map(l => ({
      label: l.line_label, amount: Number(l.unit_amount), description: l.line_description
    }))
  }));

  const subFilesBySub = {};
  (v2.itinerary_submission_files || []).forEach(sf => {
    (subFilesBySub[sf.itinerary_submission_id] = subFilesBySub[sf.itinerary_submission_id] || []).push(sf);
  });
  const storeItineraries = [];
  if(Array.isArray(uiPrefs.itineraries) && uiPrefs.itineraries.length){
    for(const it of uiPrefs.itineraries){
      const imgs = [];
      for(const im of (it.imgs || [])){
        const copy = Object.assign({}, im);
        if(typeof resolveAttachment === 'function') await resolveAttachment(copy);
        imgs.push(copy);
      }
      storeItineraries.push(Object.assign({}, it, { imgs }));
    }
  }
  for(const sub of (v2.itinerary_submissions || [])){
    const payload = sub.raw_scan_response || {};
    const imgs = [];
    for(const sf of (subFilesBySub[sub.id] || [])){
      const f = fileById[sf.file_id];
      if(!f) continue;
      const im = {
        id: f.id,
        name: f.file_title || f.original_filename || '',
        kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path,
        data: f.storage_path
      };
      if(typeof resolveAttachment === 'function') await resolveAttachment(im);
      imgs.push(im);
    }
    const entry = {
      id: payload.id || sub.id,
      date: payload.date || '',
      showId: payload.showId || payload.show_id || null,
      note: payload.note || '',
      created: payload.created || (sub.created_at ? new Date(sub.created_at).getTime() : null),
      imgs: typeof mergePassesById === 'function' ? mergePassesById(imgs, []) : imgs
    };
    if(!storeItineraries.some(x => x.id === entry.id)) storeItineraries.push(entry);
  }

  const trips = (v2.tours || []).map(t => ({
    id: t.id,
    name: t.tour_name,
    color: t.color_key,
    start: t.start_date,
    end: t.end_date,
    archived: t.is_archived,
    checklist: (chkByTour[t.id] || []).map(c => ({
      id: c.id, label: c.item_label, done: c.is_done
    })),
    timeline: (schedByTour[t.id] || []).map(s => ({
      id: s.id,
      date: s.scheduled_date,
      time: s.scheduled_time ? String(s.scheduled_time).slice(0, 5) : '',
      endTime: s.scheduled_end_time ? String(s.scheduled_end_time).slice(0, 5) : '',
      title: s.item_title || '',
      sub: s.item_notes || '',
      allDay: s.is_all_day,
      done: s.is_done,
      type: s.schedule_item_type
    })),
    emergency: (emergencyByTour[t.id] || []).map(tc => {
      const c = v2ContactView(contactById[tc.contact_id]);
      return c ? Object.assign(c, { role: 'Emergency' }) : null;
    }).filter(Boolean)
  }));

  const ideas = (v2.ideas || []).map(x => ({
    id: x.id,
    type: x.idea_type,
    title: x.idea_title,
    note: x.idea_note,
    prio: V2_PRIO_TO_STORE[x.priority_level] || x.priority_level,
    done: x.is_done,
    eventId: x.show_id || null,
    tripId: x.tour_id || null
  }));

  const noteFolders = (v2.note_folders || [])
    .filter(f => f && !f.deleted_at)
    .map(f => ({
      id: f.id,
      name: f.folder_name || '',
      sortOrder: f.sort_order || 0
    }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

  const folderNameById = new Map(noteFolders.map(f => [f.id, f.name]));

  const notes = (v2.notes || []).map(x => {
    let folderId = x.folder_id || null;
    let folder = x.folder_name || '';
    if(!folderId && folder){
      const match = noteFolders.find(f => f.name.toLowerCase() === folder.trim().toLowerCase());
      if(match) folderId = match.id;
    }
    if(folderId && !folder){
      folder = folderNameById.get(folderId) || '';
    }
    return {
      id: x.id,
      title: x.note_title,
      body: x.note_body,
      folderId,
      folder,
      updated: x.updated_at ? new Date(x.updated_at).getTime() : null,
      created: x.created_at ? new Date(x.created_at).getTime() : null
    };
  });

  const artists = (v2.artists || []).map(a => ({
    id: a.id,
    name: a.display_name,
    default: a.is_default
  }));

  return {
    events, trips, ideas, notes, noteFolders, artists, settings,
    contacts: orgContacts,
    invoices: storeInvoices,
    itineraries: storeItineraries
  };
}
