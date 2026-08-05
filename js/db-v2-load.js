/* Assemble artisthq.v2 store from V2 relational tables */

async function loadFromSupabaseV2(orgId, sb){
  const prevEvents = store?.events ? store.events.slice() : [];

  const q = (table, opts) => {
    let chain = sb.from(table).select('*').eq('organisation_id', orgId);
    if(opts?.isNull) chain = chain.is(opts.isNull, null);
    if(opts?.order) chain = chain.order(opts.order);
    return chain;
  };

  const [
    { data: orgSettings },
    { data: billing },
    { data: fxRates },
    { data: userPrefs },
    { data: artists },
    { data: tours },
    { data: venues },
    { data: shows },
    { data: advances },
    { data: financials },
    { data: expenses },
    { data: journeys },
    { data: hotels },
    { data: hotelBookings },
    { data: hotelBookingShows },
    { data: scheduleItems },
    { data: checklistItems },
    { data: contacts },
    { data: showContacts },
    { data: tourContacts },
    { data: journeyContacts },
    { data: files },
    { data: showFileLinks },
    { data: travelTickets },
    { data: invoices },
    { data: invoiceLines },
    { data: packingLists },
    { data: packingItems },
    { data: itinerarySubs },
    { data: itinerarySubFiles },
    { data: ideas },
    { data: notes }
  ] = await Promise.all([
    q('organisation_settings').maybeSingle(),
    q('organisation_billing_profiles').maybeSingle(),
    q('organisation_exchange_rates'),
    sb.from('user_preferences').select('*').eq('organisation_id', orgId).maybeSingle(),
    q('artists'),
    q('tours', { order: 'start_date' }),
    q('venues'),
    q('shows', { order: 'show_date' }),
    q('show_advances'),
    q('show_financials'),
    q('show_expenses', { order: 'sort_order' }),
    q('journeys', { order: 'sort_order' }),
    q('hotels'),
    q('hotel_bookings'),
    q('hotel_booking_shows'),
    q('schedule_items', { order: 'sort_order' }),
    q('checklist_items', { order: 'sort_order' }),
    q('contacts'),
    q('show_contacts', { order: 'sort_order' }),
    q('tour_contacts', { order: 'sort_order' }),
    q('journey_contacts', { order: 'sort_order' }),
    q('files'),
    q('show_files', { order: 'sort_order' }),
    q('travel_tickets', { order: 'sort_order' }),
    q('invoices'),
    q('invoice_line_items', { order: 'sort_order' }),
    sb.from('packing_lists').select('*').eq('organisation_id', orgId).eq('is_organisation_template', true),
    q('packing_list_items', { order: 'sort_order' }),
    q('itinerary_submissions', { order: 'created_at' }),
    q('itinerary_submission_files'),
    q('ideas', { order: 'sort_order' }),
    q('notes', { order: 'sort_order' })
  ]);

  const showUuidToLegacy = v2BuildUuidToLegacy(shows);
  const tourUuidToLegacy = v2BuildUuidToLegacy(tours);
  const venueById = {};
  (venues || []).forEach(v => { venueById[v.id] = v; });
  const artistById = {};
  (artists || []).forEach(a => { artistById[a.id] = a; });
  const contactById = {};
  (contacts || []).forEach(c => { contactById[c.id] = c; });
  const fileById = {};
  (files || []).forEach(f => { fileById[f.id] = f; });
  const hotelById = {};
  (hotels || []).forEach(h => { hotelById[h.id] = h; });

  const advanceByShow = {};
  (advances || []).forEach(a => { advanceByShow[a.show_id] = a; });
  const finByShow = {};
  (financials || []).forEach(f => { finByShow[f.show_id] = f; });
  const expByShow = {};
  (expenses || []).forEach(x => {
    (expByShow[x.show_id] = expByShow[x.show_id] || []).push(x);
  });

  const chkByShow = {}, chkByTour = {};
  (checklistItems || []).forEach(c => {
    if(c.show_id) (chkByShow[c.show_id] = chkByShow[c.show_id] || []).push(c);
    if(c.tour_id) (chkByTour[c.tour_id] = chkByTour[c.tour_id] || []).push(c);
  });

  const schedByShow = {}, schedByTour = {};
  (scheduleItems || []).forEach(s => {
    if(s.show_id) (schedByShow[s.show_id] = schedByShow[s.show_id] || []).push(s);
    if(s.tour_id) (schedByTour[s.tour_id] = schedByTour[s.tour_id] || []).push(s);
  });

  const showContactsByShow = {};
  (showContacts || []).forEach(sc => {
    (showContactsByShow[sc.show_id] = showContactsByShow[sc.show_id] || []).push(sc);
  });

  const emergencyByTour = {};
  (tourContacts || []).forEach(tc => {
    if(tc.contact_role !== 'emergency') return;
    (emergencyByTour[tc.tour_id] = emergencyByTour[tc.tour_id] || []).push(tc);
  });

  const journeyContactByJourney = {};
  (journeyContacts || []).forEach(jc => {
    (journeyContactByJourney[jc.journey_id] = journeyContactByJourney[jc.journey_id] || []).push(jc);
  });

  const ticketsByJourney = {};
  (travelTickets || []).forEach(t => {
    (ticketsByJourney[t.journey_id] = ticketsByJourney[t.journey_id] || []).push(t);
  });

  const attachmentsByShow = {};
  (showFileLinks || []).forEach(link => {
    const f = fileById[link.file_id];
    if(!f) return;
    const leg = showUuidToLegacy[link.show_id];
    if(!leg) return;
    (attachmentsByShow[leg] = attachmentsByShow[leg] || []).push({ link, file: f });
  });

  const bookingShowsByBooking = {};
  (hotelBookingShows || []).forEach(hbs => {
    (bookingShowsByBooking[hbs.hotel_booking_id] = bookingShowsByBooking[hbs.hotel_booking_id] || []).push(hbs);
  });

  const embeddedHotelByShow = {};
  const stayEvents = [];
  (hotelBookings || []).forEach(b => {
    const h = hotelById[b.hotel_id];
    const links = bookingShowsByBooking[b.id] || [];
    const legacyBooking = v2StripLegacyId(b.legacy_id || '');
    if((b.legacy_id || '').startsWith('show_hotel:')){
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
          email: h?.email_address || ''
        };
      }
      return;
    }
    if((b.legacy_id || '').startsWith('logistics_stay:')){
      const showLink = links[0];
      stayEvents.push({
        booking: b, hotel: h,
        showLegacy: showLink ? showUuidToLegacy[showLink.show_id] : null,
        legacyId: legacyBooking
      });
    }
  });

  const flightJourneysByShow = {};
  const travelJourneys = [];
  const driverJourneysByShow = {};
  (journeys || []).forEach(j => {
    const leg = v2StripLegacyId(j.legacy_id || j.id);
    if((j.legacy_id || '').startsWith('show_primary_flight:')){
      const showLeg = showUuidToLegacy[j.related_show_id];
      if(showLeg){
        (flightJourneysByShow[showLeg] = flightJourneysByShow[showLeg] || { primary: null, flights: [] }).primary = j;
      }
      return;
    }
    if(j.journey_type === 'flight' && j.related_show_id && (j.legacy_id || '').startsWith('show_flight:')){
      const showLeg = showUuidToLegacy[j.related_show_id];
      if(showLeg){
        (flightJourneysByShow[showLeg] = flightJourneysByShow[showLeg] || { primary: null, flights: [] }).flights.push(j);
      }
      return;
    }
    if(j.journey_type === 'ground_transfer' && j.related_show_id){
      const showLeg = showUuidToLegacy[j.related_show_id];
      if(showLeg){
        (driverJourneysByShow[showLeg] = driverJourneysByShow[showLeg] || []).push(j);
      }
      return;
    }
    if((j.legacy_id || '').startsWith('logistics:')){
      travelJourneys.push(j);
    }
  });

  const markers = (scheduleItems || []).filter(s =>
    s.schedule_item_type === 'calendar_marker' && (s.legacy_id || '').startsWith('logistics_marker:')
  );

  function contactToStore(c){
    if(!c) return null;
    return {
      id: c.legacy_id ? v2StripLegacyId(c.legacy_id) : c.id,
      name: c.display_name || '',
      phone: c.phone_number || '',
      whatsapp: c.whatsapp_number || '',
      email: c.email_address || '',
      notes: c.contact_notes || '',
      company: ''
    };
  }

  function advanceToStore(a, showSched){
    if(!a && !showSched?.length) return null;
    const adv = a ? {
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
    } : {};
    const schedule = (showSched || [])
      .filter(s => ['soundcheck', 'doors', 'set', 'curfew', 'deadline', 'venue_arrival'].includes(s.schedule_item_type))
      .map(s => ({
        id: v2StripLegacyId(s.legacy_id || s.id),
        time: s.scheduled_time ? String(s.scheduled_time).slice(0, 5) : '',
        title: s.item_title || '',
        sub: s.item_notes || '',
        done: s.is_done
      }));
    if(schedule.length) adv.schedule = schedule;
    return Object.keys(adv).length ? adv : null;
  }

  function financeToStore(showId){
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
        id: v2StripLegacyId(t.legacy_id || f.legacy_id || t.id),
        name: f.file_title || f.original_filename || '',
        kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path,
        data: f.storage_path
      };
      await resolveAttachment(p);
      out.push(p);
    }
    return out;
  }

  let events = [];

  for(const s of (shows || [])){
    const leg = v2StripLegacyId(s.legacy_id);
    const v = s.venue_id ? venueById[s.venue_id] : null;
    const ar = s.primary_artist_id ? artistById[s.primary_artist_id] : null;
    const fj = flightJourneysByShow[leg] || { primary: null, flights: [] };

    const fl = [];
    for(const j of fj.flights.sort((a,b) => (a.sort_order||0) - (b.sort_order||0))){
      const dep = j.departure_at ? new Date(j.departure_at) : null;
      const arr = j.arrival_at ? new Date(j.arrival_at) : null;
      fl.push({
        id: v2StripLegacyId(j.legacy_id),
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
    for(const { file: f } of (attachmentsByShow[leg] || [])){
      const att = {
        id: v2StripLegacyId(f.legacy_id || f.id),
        name: f.file_title || f.original_filename || '',
        kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path,
        data: f.storage_path
      };
      await resolveAttachment(att);
      attachments.push(att);
    }

    const scList = showContactsByShow[s.id] || [];
    const promoterSc = scList.find(x => x.contact_role === 'artist_liaison');
    const promoter = promoterSc ? contactToStore(contactById[promoterSc.contact_id]) : null;
    const showContactList = scList
      .filter(x => x.contact_role !== 'artist_liaison' && x.contact_role !== 'driver')
      .map(x => {
        const c = contactToStore(contactById[x.contact_id]);
        if(!c) return null;
        c.role = x.contact_role;
        return c;
      }).filter(Boolean);

    const drivers = (driverJourneysByShow[s.id] || []).map((j, i) => {
      const jcs = journeyContactByJourney[j.id] || [];
      const jc = jcs[0];
      const c = jc ? contactById[jc.contact_id] : null;
      return {
        id: v2StripLegacyId(j.legacy_id || `drv${i}`),
        journey: j.journey_title || j.pickup_location || '',
        time: j.departure_at ? v2TimeFromTs(j.departure_at) : '',
        phone: c?.phone_number || '',
        whatsapp: c?.whatsapp_number || '',
        name: c?.display_name || j.vehicle_details || '',
        noGround: false
      };
    });

    const timeline = (schedByShow[s.id] || [])
      .filter(t => t.schedule_item_type === 'custom' || (t.legacy_id || '').startsWith('show_timeline:'))
      .map(t => ({
        id: v2StripLegacyId(t.legacy_id),
        time: t.scheduled_time ? String(t.scheduled_time).slice(0, 5) : '',
        title: t.item_title || '',
        sub: t.item_notes || '',
        done: t.is_done
      }));

    const primary = fj.primary;
    events.push({
      id: leg, kind: 'show', date: s.show_date,
      artist: ar?.display_name || '',
      tripId: s.tour_id ? tourUuidToLegacy[s.tour_id] : null,
      status: V2_SHOW_STATUS_TO_STORE[s.show_status] || s.show_status,
      color: s.color_key,
      venue: v?.venue_name || '',
      city: v?.city || '',
      country: v?.country_code || '',
      setTime: s.set_start_time ? String(s.set_start_time).slice(0, 5) : '',
      endTime: s.set_end_time ? String(s.set_end_time).slice(0, 5) : '',
      arrival: s.venue_arrival_time ? String(s.venue_arrival_time).slice(0, 5) : '',
      venueAddr: [v?.address_line_1, v?.address_line_2].filter(Boolean).join(', '),
      notes: s.internal_notes || '',
      content: s.content_plan || '',
      setDone: s.is_set_done,
      flightNo: primary?.flight_number || '',
      terminal: primary?.departure_terminal || '',
      gate: primary?.departure_gate || '',
      fstatus: primary?.journey_status || '',
      delay: primary?.delay_description || '',
      fiUpdated: primary?.status_updated_at ? new Date(primary.status_updated_at).getTime() : null,
      fiLive: primary?.is_live_status || false,
      hotel: embeddedHotelByShow[s.id] || null,
      drivers, driver: drivers.find(d => !d.noGround) || null,
      promoter, finance: financeToStore(s.id),
      advance: advanceToStore(advanceByShow[s.id], schedByShow[s.id]),
      contacts: showContactList,
      flights: fl, attachments,
      checklist: (chkByShow[s.id] || []).map(c => ({
        id: v2StripLegacyId(c.legacy_id), label: c.item_label, done: c.is_done
      })),
      timeline
    });
  }

  for(const j of travelJourneys){
    const dep = j.departure_at ? new Date(j.departure_at) : null;
    const arr = j.arrival_at ? new Date(j.arrival_at) : null;
    const passes = await passesFromJourney(j);
    const it = {
      id: v2StripLegacyId(j.legacy_id),
      kind: 'travel',
      date: dep ? v2DateFromTs(j.departure_at) : (arr ? v2DateFromTs(j.arrival_at) : ''),
      showId: j.related_show_id ? showUuidToLegacy[j.related_show_id] : null,
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
    normalizeLogisticItem(it);
    events.push(it);
  }

  for(const st of stayEvents){
    const b = st.booking, h = st.hotel;
    const it = {
      id: st.legacyId,
      kind: 'stay',
      date: b.check_in_date,
      showId: st.showLegacy,
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
      info: b.check_in_date || ''
    };
    normalizeLogisticItem(it);
    events.push(it);
  }

  for(const m of markers){
    events.push({
      id: v2StripLegacyId(m.legacy_id),
      kind: 'marker',
      date: m.scheduled_date,
      showId: m.show_id ? showUuidToLegacy[m.show_id] : null,
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
  events = dedupeEventsById(events);
  applyLocalPassMerge(prevEvents, events);

  const fx = {};
  (fxRates || []).forEach(r => { fx[r.currency_code] = Number(r.rate_to_base); });
  const uiPrefs = userPrefs?.ui_preferences || {};
  const settings = {
    artistName: (artists || []).find(a => a.is_default)?.display_name || uiPrefs.artistName || 'You',
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

  const defaultPackingList = (packingLists || [])[0];
  if(defaultPackingList){
    settings.packingTemplate = (packingItems || [])
      .filter(p => p.packing_list_id === defaultPackingList.id)
      .sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
      .map(p => p.item_label);
  } else if(uiPrefs.packingTemplate){
    settings.packingTemplate = uiPrefs.packingTemplate;
  }

  const orgContacts = (contacts || [])
    .filter(c => c.legacy_id)
    .map(c => ({
      id: v2StripLegacyId(c.legacy_id),
      name: c.display_name || '',
      role: 'Promoter',
      company: '',
      phone: c.phone_number || '',
      whatsapp: c.whatsapp_number || '',
      email: c.email_address || '',
      notes: c.contact_notes || ''
    }));

  const invById = {};
  (invoices || []).forEach(inv => { invById[inv.id] = inv; });
  const linesByInv = {};
  (invoiceLines || []).forEach(l => {
    (linesByInv[l.invoice_id] = linesByInv[l.invoice_id] || []).push(l);
  });
  const storeInvoices = (invoices || []).map(inv => ({
    id: v2StripLegacyId(inv.legacy_id || inv.id),
    eventId: inv.show_id ? showUuidToLegacy[inv.show_id] : null,
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
  (itinerarySubFiles || []).forEach(sf => {
    (subFilesBySub[sf.itinerary_submission_id] = subFilesBySub[sf.itinerary_submission_id] || []).push(sf);
  });
  const storeItineraries = [];
  if(Array.isArray(uiPrefs.itineraries) && uiPrefs.itineraries.length){
    for(const it of uiPrefs.itineraries){
      const imgs = [];
      for(const im of (it.imgs || [])){
        const copy = Object.assign({}, im);
        await resolveAttachment(copy);
        imgs.push(copy);
      }
      storeItineraries.push(Object.assign({}, it, { imgs }));
    }
  }
  for(const sub of (itinerarySubs || [])){
    const payload = sub.raw_scan_response || {};
    const imgs = [];
    for(const sf of (subFilesBySub[sub.id] || [])){
      const f = fileById[sf.file_id];
      if(!f) continue;
      const im = {
        id: v2StripLegacyId(f.legacy_id || f.id),
        name: f.file_title || f.original_filename || '',
        kind: mimeToKind(f.mime_type),
        _storagePath: f.storage_path,
        data: f.storage_path
      };
      await resolveAttachment(im);
      imgs.push(im);
    }
    const payloadImgs = Array.isArray(payload.imgs) ? payload.imgs : [];
    for(const pim of payloadImgs){
      if(pim._storagePath || (pim.data && !pim.data.startsWith('data:'))){
        const im = Object.assign({}, pim);
        await resolveAttachment(im);
        imgs.push(im);
      } else if(pim.data && pim.data.startsWith('data:')){
        imgs.push(pim);
      }
    }
    const entry = {
      id: payload.id || sub.id,
      date: payload.date || '',
      showId: payload.showId || payload.show_id || null,
      note: payload.note || '',
      created: payload.created || (sub.created_at ? new Date(sub.created_at).getTime() : null),
      imgs: mergePassesById(imgs, [])
    };
    if(!storeItineraries.some(x => x.id === entry.id)) storeItineraries.push(entry);
  }

  const uiTab = store?.tab;
  store = {
    _seq: orgSettings?.store_sequence || 1,
    activeTripId: store?.activeTripId || null,
    activeShowId: store?.activeShowId || null,
    tab: uiTab || userPrefs?.last_open_tab || 'home',
    settings,
    artists: (artists || []).map(a => ({
      id: a.legacy_id ? v2StripLegacyId(a.legacy_id) : a.id,
      name: a.display_name,
      default: a.is_default
    })),
    events,
    trips: (tours || []).map(t => ({
      id: v2StripLegacyId(t.legacy_id),
      name: t.tour_name,
      color: t.color_key,
      start: t.start_date,
      end: t.end_date,
      archived: t.is_archived,
      checklist: (chkByTour[t.id] || []).map(c => ({
        id: v2StripLegacyId(c.legacy_id), label: c.item_label, done: c.is_done
      })),
      timeline: (schedByTour[t.id] || []).map(s => ({
        id: v2StripLegacyId(s.legacy_id),
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
        const c = contactToStore(contactById[tc.contact_id]);
        return c ? Object.assign(c, { role: 'Emergency' }) : null;
      }).filter(Boolean)
    })),
    ideas: (ideas || []).map(x => ({
      id: v2StripLegacyId(x.legacy_id),
      type: x.idea_type,
      title: x.idea_title,
      note: x.idea_note,
      prio: V2_PRIO_TO_STORE[x.priority_level] || x.priority_level,
      done: x.is_done,
      eventId: x.show_id ? showUuidToLegacy[x.show_id] : null,
      tripId: x.tour_id ? tourUuidToLegacy[x.tour_id] : null
    })),
    notes: (notes || []).map(x => ({
      id: v2StripLegacyId(x.legacy_id),
      title: x.note_title,
      body: x.note_body,
      folder: x.folder_name,
      updated: x.updated_at ? new Date(x.updated_at).getTime() : null
    })),
    contacts: orgContacts,
    invoices: storeInvoices,
    itineraries: storeItineraries,
    packing: (store?.packing) || []
  };

  if(store.settings.homeHeader && !store.settings.homeHeader.startsWith('data:') && !store.settings.homeHeader.startsWith('http')){
    store.settings.homeHeader = await signedUrlForPath(store.settings.homeHeader);
  }

  const knownIds = [];
  store.events.forEach(e => {
    knownIds.push(e.id);
    (e.attachments || []).forEach(a => a.id && knownIds.push(a.id));
    (e.flights || []).forEach(f => (f.passes || []).forEach(p => p.id && knownIds.push(p.id)));
    (e.passes || []).forEach(p => p.id && knownIds.push(p.id));
  });
  (store.trips || []).forEach(t => knownIds.push(t.id));
  (store.ideas || []).forEach(x => knownIds.push(x.id));
  (store.notes || []).forEach(x => knownIds.push(x.id));
  store._known = knownIds;

  migrate();
  db.write(store);
}
