/* Parent + subtype journey helpers.
   Universal route/times live on journeys; detail tables only enrich. */

const V2_JOURNEY_DETAIL_TABLES = {
  flight: 'journey_flight_details',
  rail: 'journey_rail_details',
  ground_transfer: 'journey_ground_details',
  ferry: 'journey_ferry_details',
  coach: 'journey_coach_details'
};

const V2_GROUND_TRANSPORT_TYPES = [
  'taxi', 'uber', 'private_car', 'chauffeur', 'shuttle', 'minibus', 'bus', 'other'
];

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

/* Canonical route labels — always the universal name fields, with
   type-specific leftovers only as a backfill while old columns remain. */
function v2JourneyFromName(j){
  if(!j) return '';
  return v2Blank(
    j.departure_location_name
    || (j.journey_type === 'rail' ? j.departure_station_name : '')
    || (j.journey_type === 'ferry' ? j.departure_port_name : '')
    || (j.journey_type === 'ground_transfer' ? j.pickup_location : '')
    || j.departure_location_code
  );
}

function v2JourneyToName(j){
  if(!j) return '';
  return v2Blank(
    j.arrival_location_name
    || (j.journey_type === 'rail' ? j.arrival_station_name : '')
    || (j.journey_type === 'ferry' ? j.arrival_port_name : '')
    || (j.journey_type === 'ground_transfer' ? j.dropoff_location : '')
    || j.arrival_location_code
  );
}

function v2JourneyFlightNumber(j){
  return v2Blank((j && j.flight_details && j.flight_details.flight_number) || (j && j.flight_number));
}

function v2JourneyTrainNumber(j){
  return v2Blank((j && j.rail_details && j.rail_details.train_number) || (j && j.train_number));
}

function v2JourneyFerryNumber(j){
  return v2Blank((j && j.ferry_details && j.ferry_details.ferry_service_number) || (j && j.ferry_service_number));
}

function v2JourneyCoachNumber(j){
  return v2Blank((j && j.coach_details && j.coach_details.coach_service_number) || (j && j.coach_service_number));
}

function v2JourneyDepIata(j){
  return v2IataCode(
    (j && j.flight_details && j.flight_details.departure_airport_iata)
    || (j && j.departure_airport_iata)
    || (j && j.departure_location_code)
  );
}

function v2JourneyArrIata(j){
  return v2IataCode(
    (j && j.flight_details && j.flight_details.arrival_airport_iata)
    || (j && j.arrival_airport_iata)
    || (j && j.arrival_location_code)
  );
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

function v2PassengerMetaFromRows(rows, fallbackJson){
  const fromTable = (rows || []).map(r => ({
    id: r.id,
    name: r.name || '',
    seat: r.seat || '',
    booking_reference: r.booking_reference || ''
  })).filter(p => p.id || p.name || p.seat || p.booking_reference);
  if(fromTable.length) return fromTable;
  if(typeof fallbackJson === 'undefined') return [];
  if(Array.isArray(fallbackJson)){
    return fallbackJson.filter(m => m && typeof m === 'object').map(m => ({
      id: m.id,
      name: m.name || '',
      seat: m.seat || '',
      booking_reference: m.booking_reference || m.bookingRef || ''
    }));
  }
  if(fallbackJson && typeof fallbackJson === 'object'){
    return [{
      id: fallbackJson.id,
      name: fallbackJson.name || '',
      seat: fallbackJson.seat || '',
      booking_reference: fallbackJson.booking_reference || fallbackJson.bookingRef || ''
    }];
  }
  return [];
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
  return !!(d.ground_transport_type || d.pickup_instructions || d.vehicle_details);
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
      flight_number: v2Nz(extras.flight_number || journey.flight_number),
      departure_airport_iata: v2IataCode(extras.departure_airport_iata || journey.departure_airport_iata || extras.from || journey.departure_location_code),
      arrival_airport_iata: v2IataCode(extras.arrival_airport_iata || journey.arrival_airport_iata || extras.to || journey.arrival_location_code),
      departure_terminal: v2Nz(extras.departure_terminal || journey.departure_terminal),
      arrival_terminal: v2Nz(extras.arrival_terminal || journey.arrival_terminal),
      departure_gate: v2Nz(extras.departure_gate || journey.departure_gate),
      arrival_gate: v2Nz(extras.arrival_gate || journey.arrival_gate)
    };
    if(!v2HasFlightEnrichment(row)) row = null;
  } else if(type === 'rail'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      train_number: v2Nz(extras.train_number || journey.train_number),
      departure_station_code: v2Nz(extras.departure_station_code || v2LocationCode(journey.departure_location_code)),
      arrival_station_code: v2Nz(extras.arrival_station_code || v2LocationCode(journey.arrival_location_code)),
      departure_platform: v2Nz(extras.departure_platform || journey.departure_platform),
      arrival_platform: v2Nz(extras.arrival_platform || journey.arrival_platform)
    };
    if(!v2HasRailEnrichment(row)) row = null;
  } else if(type === 'ground_transfer'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      ground_transport_type: v2NormalizeGroundTransportType(
        extras.ground_transport_type || extras.groundType
        || v2InferGroundTransportType(extras.vehicle_details, extras.pickup_instructions, extras.name, extras.driverName)
      ),
      pickup_instructions: v2Nz(extras.pickup_instructions || extras.pickup || journey.pickup_instructions),
      vehicle_details: v2Nz(extras.vehicle_details || extras.vehicle || journey.vehicle_details)
    };
    if(!v2HasGroundEnrichment(row)) row = null;
  } else if(type === 'ferry'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      ferry_service_number: v2Nz(extras.ferry_service_number || extras.flightNo || journey.ferry_service_number),
      departure_port_code: v2Nz(extras.departure_port_code || v2LocationCode(journey.departure_location_code)),
      arrival_port_code: v2Nz(extras.arrival_port_code || v2LocationCode(journey.arrival_location_code))
    };
    if(!v2HasFerryEnrichment(row)) row = null;
  } else if(type === 'coach'){
    row = {
      journey_id: journey.id,
      organisation_id: orgId,
      coach_service_number: v2Nz(extras.coach_service_number || extras.flightNo || journey.coach_service_number)
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
