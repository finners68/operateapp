/* Parent + subtype journey helpers.
   Universal route/times live on journeys; detail tables only enrich. */

const V2_JOURNEY_DETAIL_TABLES = {
  flight: 'journey_flight_details',
  rail: 'journey_rail_details',
  ground_transfer: 'journey_ground_details',
  ferry: 'journey_ferry_details',
  coach: 'journey_coach_details'
};

/* Shared route/times only. Type-specific fields belong on the detail tables. */
const V2_JOURNEY_PARENT_COLUMNS = [
  'id', 'organisation_id', 'legacy_id', 'tour_id', 'related_show_id',
  'journey_type', 'journey_title', 'booking_reference', 'operator_name',
  'departure_at', 'arrival_at',
  'departure_location_kind', 'departure_location_name', 'departure_location_address',
  'arrival_location_kind', 'arrival_location_name', 'arrival_location_address',
  'journey_status', 'delay_description', 'status_updated_at',
  'is_live_status', 'is_done', 'note_items', 'sort_order', 'deleted_at'
];

function v2SlimJourneyParentRow(row){
  if(!row) return row;
  const out = {};
  V2_JOURNEY_PARENT_COLUMNS.forEach(k => {
    if(Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
  });
  ['departure_location_kind', 'arrival_location_kind'].forEach(k => {
    if(out[k] === '') out[k] = null;
  });
  return out;
}

const V2_GROUND_TRANSPORT_TYPES = [
  'taxi', 'uber', 'private_car', 'chauffeur', 'shuttle', 'minibus', 'bus', 'other'
];
const V2_LOCATION_KINDS = ['airport', 'hotel', 'venue', 'station', 'port', 'custom'];
const V2_LOCATION_KIND_LABELS = {
  airport: 'Airport', hotel: 'Hotel', venue: 'Venue',
  station: 'Station', port: 'Port', custom: 'Custom'
};
const V2_GROUND_ARRANGEMENTS = ['pre_arranged', 'arrange_at_time'];
const V2_GROUND_PREFERRED_METHODS = ['uber', 'taxi', 'either'];
const V2_UI_PLACE_KINDS = ['airport', 'hotel', 'venue', 'custom'];

function v2Blank(v){
  if(v == null) return '';
  return String(v).trim();
}

function v2Nz(v){
  const s = v2Blank(v);
  return s ? s : null;
}

function v2IndexByJourneyId(rows){
  const m = Object.create(null);
  (rows || []).forEach(r => {
    if(!r || !r.journey_id) return;
    if(!m[r.journey_id]) m[r.journey_id] = [];
    m[r.journey_id].push(r);
  });
  return m;
}

function v2FirstByJourneyId(rows){
  const m = Object.create(null);
  (rows || []).forEach(r => {
    if(r && r.journey_id && !m[r.journey_id]) m[r.journey_id] = r;
  });
  return m;
}

function v2IataCode(v){
  const s = v2Blank(v).toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

function v2LocationCode(v){
  const s = v2Blank(v).toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(s) ? s : null;
}

function v2InferGroundTransportType(){
  const parts = [];
  for(let i = 0; i < arguments.length; i++) parts.push(v2Blank(arguments[i]).toLowerCase());
  const src = parts.join(' ');
  if(!src) return null;
  if(/\buber\b/.test(src)) return 'uber';
  if(/\btaxi\b/.test(src)) return 'taxi';
  if(/chauffeur|private driver/.test(src)) return 'chauffeur';
  if(/\bshuttle\b/.test(src)) return 'shuttle';
  if(/\bminibus\b/.test(src)) return 'minibus';
  if(/\bbus\b/.test(src)) return 'bus';
  if(/private car/.test(src)) return 'private_car';
  return null;
}

function v2NormalizeGroundTransportType(v){
  const s = v2Blank(v).toLowerCase().replace(/[\s-]+/g, '_');
  if(s === 'privatecar') return 'private_car';
  if(V2_GROUND_TRANSPORT_TYPES.includes(s)) return s;
  return v2InferGroundTransportType(v);
}

function v2NormalizeLocationKind(v){
  const s = v2Blank(v).toLowerCase().replace(/[\s-]+/g, '_');
  if(!s) return null;
  if(s === 'airports') return 'airport';
  if(s === 'train_station' || s === 'rail' || s === 'train') return 'station';
  if(s === 'harbour' || s === 'harbor' || s === 'ferry') return 'port';
  if(V2_LOCATION_KINDS.includes(s)) return s;
  if(V2_LOCATION_KIND_LABELS[s]) return s;
  return null;
}

function v2LocationKindFromToken(name){
  const t = v2Blank(name);
  if(/^hotel$/i.test(t)) return 'hotel';
  if(/^venue$/i.test(t)) return 'venue';
  if(/^airport$/i.test(t)) return 'airport';
  if(/^station$/i.test(t)) return 'station';
  if(/^port$/i.test(t)) return 'port';
  return null;
}

function v2InferLocationKind(name, journeyType){
  const direct = v2NormalizeLocationKind(name) || v2LocationKindFromToken(name);
  if(direct) return direct;
  if(v2IataCode(name)) return 'airport';
  if(journeyType === 'flight') return 'airport';
  if(journeyType === 'rail') return 'station';
  if(journeyType === 'ferry') return 'port';
  if(v2Blank(name)) return 'custom';
  return null;
}

function v2NormalizeArrangement(v){
  const s = v2Blank(v).toLowerCase().replace(/[\s-]+/g, '_');
  if(s === 'pre' || s === 'prearranged' || s === 'pre_arranged') return 'pre_arranged';
  if(s === 'time' || s === 'arrange_at_time' || s === 'arrangeattime' || s === 'arrange_at_time') return 'arrange_at_time';
  return null;
}

function v2NormalizePreferredMethod(v){
  const s = v2Blank(v).toLowerCase();
  if(s === 'uber' || s === 'taxi' || s === 'either') return s;
  if(s === 'other') return 'either';
  return null;
}

function v2NamedGroundPerson(name){
  const s = v2Blank(name);
  return !!(s && !/^driver$/i.test(s));
}

function v2InferLegacyArrangement(opts){
  opts = opts || {};
  const stored = v2NormalizeArrangement(opts.arrangement);
  if(stored) return stored;
  const named = v2NamedGroundPerson(opts.name || opts.driverName || opts.operator_name);
  const gt = v2NormalizeGroundTransportType(opts.groundType || opts.ground_transport_type) || '';
  if(!named && (gt === 'uber' || gt === 'taxi' || gt === 'other')) return 'arrange_at_time';
  if(named || gt === 'private_car' || gt === 'chauffeur' || gt === 'shuttle' || gt === 'minibus' || gt === 'bus') return 'pre_arranged';
  return null;
}

function v2InferLegacyPreferredMethod(opts){
  opts = opts || {};
  const stored = v2NormalizePreferredMethod(opts.preferredMethod || opts.preferred_method);
  if(stored) return stored;
  const arrangement = v2InferLegacyArrangement(opts);
  if(arrangement !== 'arrange_at_time') return null;
  const gt = v2NormalizeGroundTransportType(opts.groundType || opts.ground_transport_type) || '';
  if(gt === 'uber' || gt === 'taxi') return gt;
  return 'either';
}

function v2CompactLocationLabel(kind, name){
  const k = v2NormalizeLocationKind(kind) || v2LocationKindFromToken(name);
  const label = v2Blank(name);
  if(k === 'hotel') return 'Hotel';
  if(k === 'venue') return 'Venue';
  if(k === 'airport'){
    const iata = v2IataCode(label);
    if(iata) return iata;
    return label && !/^airport$/i.test(label) ? label : 'Airport';
  }
  if(k === 'station') return label || 'Station';
  if(k === 'port') return label || 'Port';
  if(k === 'custom') return label;
  if(/^hotel$/i.test(label)) return 'Hotel';
  if(/^venue$/i.test(label)) return 'Venue';
  if(/^airport$/i.test(label)) return 'Airport';
  return label;
}

function v2UiPlaceKind(kind, name){
  const k = v2NormalizeLocationKind(kind) || v2LocationKindFromToken(name);
  if(k && V2_UI_PLACE_KINDS.includes(k)) return k;
  if(v2IataCode(name)) return 'airport';
  if(v2Blank(name)) return 'custom';
  return '';
}

function v2PlacesFromEndpoints(fromVal, toVal, extras){
  extras = extras || {};
  const fromName = (typeof v2PlaceForDb === 'function' ? v2PlaceForDb(extras.fromName || fromVal) : (extras.fromName || fromVal || null));
  const toName = (typeof v2PlaceForDb === 'function' ? v2PlaceForDb(extras.toName || toVal) : (extras.toName || toVal || null));
  const fromKind = v2NormalizeLocationKind(extras.fromKind)
    || v2InferLocationKind(fromName, extras.journeyType);
  const toKind = v2NormalizeLocationKind(extras.toKind)
    || v2InferLocationKind(toName, extras.journeyType);
  return {
    departure_location_kind: fromKind,
    departure_location_name: fromName,
    departure_location_address: v2Nz(extras.fromAddress),
    arrival_location_kind: toKind,
    arrival_location_name: toName,
    arrival_location_address: v2Nz(extras.toAddress)
  };
}

function v2MapQueryForEndpoint(ep, ctx){
  ep = ep || {};
  ctx = ctx || {};
  const address = v2Blank(ep.address);
  if(address) return address;
  const iata = v2IataCode(ep.iata) || (v2NormalizeLocationKind(ep.kind) === 'airport' ? v2IataCode(ep.name) : null);
  if(iata) return iata + ' airport';
  const kind = v2NormalizeLocationKind(ep.kind) || v2LocationKindFromToken(ep.name);
  if(kind === 'hotel' && ctx.hotelQuery) return ctx.hotelQuery;
  if(kind === 'venue' && ctx.venueQuery) return ctx.venueQuery;
  if(kind === 'airport' && ctx.airportQuery) return ctx.airportQuery;
  const name = v2Blank(ep.name);
  if(kind === 'custom' && name) return name;
  if(name && !v2LocationKindFromToken(name)){
    const city = v2Blank(ctx.city);
    return name + (city && name.toLowerCase().indexOf(city.toLowerCase()) < 0 ? ' ' + city : '');
  }
  return '';
}

function v2JourneyLocation(j, side){
  const dep = side !== 'arrival';
  return {
    kind: v2NormalizeLocationKind(dep ? j && j.departure_location_kind : j && j.arrival_location_kind),
    name: v2Blank(dep ? j && j.departure_location_name : j && j.arrival_location_name),
    address: v2Blank(dep ? j && j.departure_location_address : j && j.arrival_location_address)
  };
}

/* Canonical persisted names. Compact UI labels use v2JourneyCompactFrom/To. */
function v2JourneyFromName(j){
  if(!j) return '';
  return v2Blank(j.departure_location_name);
}

function v2JourneyToName(j){
  if(!j) return '';
  return v2Blank(j.arrival_location_name);
}

function v2JourneyCompactFrom(j){
  if(!j) return '';
  const iata = v2JourneyDepIata(j);
  if(iata) return iata;
  return v2CompactLocationLabel(j.departure_location_kind, j.departure_location_name);
}

function v2JourneyCompactTo(j){
  if(!j) return '';
  const iata = v2JourneyArrIata(j);
  if(iata) return iata;
  return v2CompactLocationLabel(j.arrival_location_kind, j.arrival_location_name);
}

function v2JourneyFlightNumber(j){
  return v2Blank(j && j.flight_details && j.flight_details.flight_number);
}

function v2JourneyTrainNumber(j){
  return v2Blank(j && j.rail_details && j.rail_details.train_number);
}

function v2JourneyFerryNumber(j){
  return v2Blank(j && j.ferry_details && j.ferry_details.ferry_service_number);
}

function v2JourneyCoachNumber(j){
  return v2Blank(j && j.coach_details && j.coach_details.coach_service_number);
}

function v2JourneyDepIata(j){
  return v2IataCode(j && j.flight_details && j.flight_details.departure_airport_iata);
}

function v2JourneyArrIata(j){
  return v2IataCode(j && j.flight_details && j.flight_details.arrival_airport_iata);
}

function v2AttachJourneyDetails(j, bags){
  if(!j) return j;
  bags = bags || {};
  j.flight_details = (bags.flight && bags.flight[j.id]) || null;
  j.rail_details = (bags.rail && bags.rail[j.id]) || null;
  j.ground_details = (bags.ground && bags.ground[j.id]) || null;
  j.ferry_details = (bags.ferry && bags.ferry[j.id]) || null;
  j.coach_details = (bags.coach && bags.coach[j.id]) || null;
  j.passenger_rows = (bags.passengers && bags.passengers[j.id]) || [];
  return j;
}

function v2PlaceForDb(v){
  const s = v2Blank(v);
  if(!s) return null;
  if(v2IataCode(s)) return v2IataCode(s);
  return s;
}

function v2PassengerMetaFromRows(rows){
  return (rows || []).map(r => ({
    id: r.id,
    name: r.name || '',
    seat: r.seat || '',
    booking_reference: r.booking_reference || ''
  })).filter(p => p.id || p.name || p.seat || p.booking_reference);
}

function v2PassengerIdInUseElsewhere(id, journeyId){
  if(!id) return false;
  const list = store && store.v2 && store.v2.journey_passengers;
  if(!Array.isArray(list)) return false;
  return list.some(r => r && r.id === id && r.journey_id !== journeyId);
}

function v2PassengerRowsForDb(orgId, journeyId, passengers){
  const seen = new Set();
  return (passengers || []).map(p => {
    if(!p) return null;
    let id = (p.id && typeof isUuid === 'function' && isUuid(p.id)) ? p.id : null;
    if(!id || seen.has(id) || v2PassengerIdInUseElsewhere(id, journeyId)){
      id = (typeof newUuid === 'function') ? newUuid() : id;
    }
    seen.add(id);
    p.id = id;
    const booking = v2Nz(p.booking_reference || p.bookingRef);
    return {
      id,
      organisation_id: orgId,
      journey_id: journeyId,
      name: v2Nz(p.name),
      seat: v2Nz(p.seat),
      booking_reference: booking
    };
  }).filter(Boolean);
}

function v2HasFlightEnrichment(d){
  if(!d) return false;
  return !!(d.flight_number || d.departure_airport_iata || d.arrival_airport_iata
    || d.departure_terminal || d.arrival_terminal || d.departure_gate || d.arrival_gate);
}

function v2HasRailEnrichment(d){
  if(!d) return false;
  return !!(d.train_number || d.departure_station_code || d.arrival_station_code
    || d.departure_platform || d.arrival_platform);
}

function v2HasGroundEnrichment(d){
  if(!d) return false;
  return !!(d.ground_transport_type || d.pickup_instructions || d.vehicle_details
    || d.arrangement || d.preferred_method);
}

function v2HasFerryEnrichment(d){
  if(!d) return false;
  return !!(d.ferry_service_number || d.departure_port_code || d.arrival_port_code);
}

function v2HasCoachEnrichment(d){
  if(!d) return false;
  return !!(d.coach_service_number);
}

async function v2UpsertJourneyDetail(sb, table, row){
  if(!sb || !table || !row || !row.journey_id) return null;
  const { data, error } = await sb.from(table).upsert(row, { onConflict: 'journey_id' }).select('*').maybeSingle();
  if(typeof v2Throw === 'function') v2Throw(error, table + ' upsert');
  else if(error) throw error;
  if(data && store && store.v2 && Array.isArray(store.v2[table])){
    const list = store.v2[table];
    const i = list.findIndex(r => r && r.journey_id === data.journey_id);
    if(i >= 0) list[i] = Object.assign({}, list[i], data);
    else list.push(data);
  }
  return data;
}

async function v2DeleteJourneyDetail(sb, table, orgId, journeyId){
  if(!sb || !table || !journeyId) return;
  const { error } = await sb.from(table).delete().eq('organisation_id', orgId).eq('journey_id', journeyId);
  if(typeof v2Throw === 'function') v2Throw(error, table + ' delete');
  else if(error) throw error;
  if(store && store.v2 && Array.isArray(store.v2[table])){
    store.v2[table] = store.v2[table].filter(r => r && r.journey_id !== journeyId);
  }
}

async function v2SyncJourneySubtype(sb, orgId, journey, extras){
  extras = extras || {};
  if(!journey || !journey.id) return;
  const type = journey.journey_type;
  const table = V2_JOURNEY_DETAIL_TABLES[type];
  if(!table){
    /* Walk / cycle / other have no subtype table. */
    return;
  }
  let row = null;
  if(type === 'flight'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      flight_number: v2Nz(extras.flight_number),
      departure_airport_iata: v2IataCode(extras.departure_airport_iata || extras.from),
      arrival_airport_iata: v2IataCode(extras.arrival_airport_iata || extras.to),
      departure_terminal: v2Nz(extras.departure_terminal),
      arrival_terminal: v2Nz(extras.arrival_terminal),
      departure_gate: v2Nz(extras.departure_gate),
      arrival_gate: v2Nz(extras.arrival_gate)
    };
    if(!v2HasFlightEnrichment(row)) row = null;
  } else if(type === 'rail'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      train_number: v2Nz(extras.train_number),
      departure_station_code: v2Nz(extras.departure_station_code || v2LocationCode(extras.from)),
      arrival_station_code: v2Nz(extras.arrival_station_code || v2LocationCode(extras.to)),
      departure_platform: v2Nz(extras.departure_platform || extras.platform),
      arrival_platform: v2Nz(extras.arrival_platform)
    };
    if(!v2HasRailEnrichment(row)) row = null;
  } else if(type === 'ground_transfer'){
    const arrangement = v2NormalizeArrangement(extras.arrangement)
      || v2InferLegacyArrangement(extras);
    const preferred = arrangement === 'arrange_at_time'
      ? (v2NormalizePreferredMethod(extras.preferred_method || extras.preferredMethod)
        || v2InferLegacyPreferredMethod(Object.assign({}, extras, { arrangement })))
      : null;
    let groundType = v2NormalizeGroundTransportType(
      extras.ground_transport_type || extras.groundType
    );
    if(!groundType && arrangement !== 'arrange_at_time'){
      groundType = v2InferGroundTransportType(
        extras.vehicle_details, extras.pickup_instructions, extras.vehicle
      );
    }
    if(arrangement === 'arrange_at_time' && !groundType){
      if(preferred === 'uber' || preferred === 'taxi') groundType = preferred;
    }
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      arrangement,
      preferred_method: preferred,
      ground_transport_type: groundType,
      pickup_instructions: v2Nz(extras.pickup_instructions || extras.pickup),
      vehicle_details: v2Nz(extras.vehicle_details || extras.vehicle)
    };
    if(!v2HasGroundEnrichment(row)) row = null;
  } else if(type === 'ferry'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      ferry_service_number: v2Nz(extras.ferry_service_number || extras.flightNo),
      departure_port_code: v2Nz(extras.departure_port_code || v2LocationCode(extras.from)),
      arrival_port_code: v2Nz(extras.arrival_port_code || v2LocationCode(extras.to))
    };
    if(!v2HasFerryEnrichment(row)) row = null;
  } else if(type === 'coach'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      coach_service_number: v2Nz(extras.coach_service_number || extras.flightNo)
    };
    if(!v2HasCoachEnrichment(row)) row = null;
  }
  if(row) await v2UpsertJourneyDetail(sb, table, row);
  else await v2DeleteJourneyDetail(sb, table, orgId, journey.id);
}

async function v2ReplaceJourneyPassengers(sb, orgId, journeyId, passengers){
  if(!sb || !journeyId) return [];
  const rows = v2PassengerRowsForDb(orgId, journeyId, passengers);
  const keepIds = new Set(rows.map(r => r.id));
  const existing = (store && store.v2 && Array.isArray(store.v2.journey_passengers))
    ? store.v2.journey_passengers.filter(r => r && r.journey_id === journeyId)
    : [];
  const stale = existing.filter(r => r.id && !keepIds.has(r.id));
  for(const gone of stale){
    const { error } = await sb.from('journey_passengers')
      .delete().eq('organisation_id', orgId).eq('id', gone.id);
    if(typeof v2Throw === 'function') v2Throw(error, 'journey_passengers delete');
    else if(error) throw error;
  }
  if(store && store.v2 && Array.isArray(store.v2.journey_passengers)){
    store.v2.journey_passengers = store.v2.journey_passengers.filter(r =>
      !r || r.journey_id !== journeyId || keepIds.has(r.id)
    );
  }
  if(!rows.length){
    const { error } = await sb.from('journey_passengers')
      .delete().eq('organisation_id', orgId).eq('journey_id', journeyId);
    if(typeof v2Throw === 'function') v2Throw(error, 'journey_passengers delete empty');
    else if(error) throw error;
    if(store && store.v2 && Array.isArray(store.v2.journey_passengers)){
      store.v2.journey_passengers = store.v2.journey_passengers.filter(r =>
        !r || r.journey_id !== journeyId
      );
    }
    return [];
  }
  const { data, error } = await sb.from('journey_passengers')
    .upsert(rows, { onConflict: 'id' }).select('*');
  if(typeof v2Throw === 'function') v2Throw(error, 'journey_passengers upsert');
  else if(error) throw error;
  (data || []).forEach(r => {
    if(!r || !store || !store.v2 || !Array.isArray(store.v2.journey_passengers)) return;
    const i = store.v2.journey_passengers.findIndex(x => x && x.id === r.id);
    if(i >= 0) store.v2.journey_passengers[i] = Object.assign({}, store.v2.journey_passengers[i], r);
    else store.v2.journey_passengers.push(r);
  });
  return data || [];
}

function v2JourneyBagsFromV2(v2){
  return {
    flight: v2FirstByJourneyId(v2 && v2.journey_flight_details),
    rail: v2FirstByJourneyId(v2 && v2.journey_rail_details),
    ground: v2FirstByJourneyId(v2 && v2.journey_ground_details),
    ferry: v2FirstByJourneyId(v2 && v2.journey_ferry_details),
    coach: v2FirstByJourneyId(v2 && v2.journey_coach_details),
    passengers: v2IndexByJourneyId(v2 && v2.journey_passengers)
  };
}

function v2ComposeGroundFrontend(j, contact){
  j = j || {};
  const gd = j.ground_details || {};
  const fromLoc = v2JourneyLocation(j, 'departure');
  const toLoc = v2JourneyLocation(j, 'arrival');
  const from = v2JourneyCompactFrom(j);
  const to = v2JourneyCompactTo(j);
  const contactName = v2Blank(contact && contact.display_name);
  const operator = v2Blank(j.operator_name);
  const driverName = contactName || (!gd.arrangement ? operator : '');
  const named = v2NamedGroundPerson(driverName);
  const arrangement = v2NormalizeArrangement(gd.arrangement)
    || v2InferLegacyArrangement({
      arrangement: gd.arrangement,
      name: driverName,
      groundType: gd.ground_transport_type
    });
  const preferredMethod = arrangement === 'arrange_at_time'
    ? (v2NormalizePreferredMethod(gd.preferred_method)
      || v2InferLegacyPreferredMethod({
        preferred_method: gd.preferred_method,
        arrangement,
        groundType: gd.ground_transport_type
      }))
    : null;
  const noGround = arrangement === 'arrange_at_time';
  const company = noGround
    ? ''
    : (operator && operator.toLowerCase() !== (driverName || '').toLowerCase() ? operator : '');
  let journey = '';
  if(from && to) journey = from + ' → ' + to;
  else if(from || to) journey = from || to;
  else journey = j.journey_title || '';
  const row = {
    id: j.id,
    from,
    to,
    fromKind: fromLoc.kind || v2UiPlaceKind('', fromLoc.name),
    toKind: toLoc.kind || v2UiPlaceKind('', toLoc.name),
    fromName: fromLoc.name,
    toName: toLoc.name,
    fromAddress: fromLoc.address,
    toAddress: toLoc.address,
    journey,
    time: j.departure_at ? (typeof v2TimeFromTs === 'function' ? v2TimeFromTs(j.departure_at) : '') : '',
    date: j.departure_at ? (typeof v2DateFromTs === 'function' ? v2DateFromTs(j.departure_at) : '') : '',
    arrangement: arrangement || '',
    preferredMethod: preferredMethod || '',
    groundType: gd.ground_transport_type || '',
    pickup: gd.pickup_instructions || '',
    vehicle: noGround ? '' : (gd.vehicle_details || ''),
    notes: (typeof noteItemsFromDb === 'function' ? noteItemsFromDb(j.note_items) : ''),
    operator: noGround ? '' : (company || ''),
    name: noGround ? '' : (named ? driverName : ''),
    phone: noGround ? '' : ((contact && contact.phone_number) || ''),
    whatsapp: noGround ? '' : ((contact && contact.whatsapp_number) || ''),
    noGround: !!noGround
  };
  if(!from && !to && journey && typeof parseDriverJourney === 'function'){
    const p = parseDriverJourney(journey);
    row.from = p.from;
    row.to = p.to;
    row.journey = (p.from && p.to) ? (p.from + ' → ' + p.to) : journey;
  }
  return row;
}
