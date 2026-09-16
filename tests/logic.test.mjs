/* Unit tests for Operate's pure logic, run against the REAL source (js/state.js)
   loaded into a sandboxed VM context (no build step). Run: `node --test`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadState() {
  const sandbox = {
    window: { addEventListener() {} },
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return {}; } }; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {}, crypto: { randomUUID: () => 'a'.repeat(32) },
    console, setTimeout, clearTimeout,
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  const src = readFileSync(join(root, 'js', 'state.js'), 'utf8')
    + '\n;this.__x = { jsAttr, esc, setStartMs, parseDT, countdown, logisticTypeLabel };';
  vm.runInContext(src, sandbox, { filename: 'state.js' });
  return sandbox.__x;
}
const S = loadState();

test('jsAttr neutralises JS-string breakout in inline handlers', () => {
  const out = S.jsAttr(`'); alert(1); //`);
  assert.ok(!/(^|[^\\])'/.test(out.replace(/&#?\w+;/g, '')), 'raw single-quote must be escaped');
  assert.equal(S.jsAttr('a"b').includes('&quot;'), true);
  assert.equal(S.jsAttr('a\\b'), 'a\\\\b');
});

test('esc HTML-encodes the dangerous set', () => {
  assert.equal(S.esc('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});

test('setStartMs rolls small-hours set times to the next morning', () => {
  const thu = S.setStartMs('2026-07-23', '01:00'); // Thu 23rd listed, 01:00 => Fri 24th
  assert.equal(new Date(thu).getDate(), 24);
  const day = S.setStartMs('2026-07-23', '22:00'); // evening stays same day
  assert.equal(new Date(day).getDate(), 23);
  assert.equal(S.setStartMs('2026-07-23', ''), null);
});

test('countdown formats include minutes and never go negative', () => {
  const future = Date.now() + (26 * 3600 + 5 * 60) * 1000;
  const c = S.countdown(future);
  assert.equal(c.done, false);
  assert.match(c.txt + c.unit, /\d/);
  assert.equal(S.countdown(Date.now() - 1000).done, true);
});

test('logisticTypeLabel uses travel mode and ground subtype', () => {
  assert.equal(S.logisticTypeLabel({ kind: 'travel', icon: 'plane' }), 'Flight');
  assert.equal(S.logisticTypeLabel({ kind: 'travel', icon: 'train' }), 'Train');
  assert.equal(S.logisticTypeLabel({ kind: 'travel', icon: 'cycle' }), 'Cycle');
  assert.equal(S.logisticTypeLabel({ kind: 'travel', icon: 'bus' }), 'Coach');
  assert.equal(S.logisticTypeLabel({ kind: 'travel', icon: 'car', groundType: 'uber' }), 'Uber');
  assert.equal(S.logisticTypeLabel({ kind: 'stay' }), 'Accommodation');
});

function loadJourneyHelpers() {
  const sandbox = {
    window: {},
    console,
    isUuid: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '')),
    newUuid: () => '11111111-1111-4111-8111-111111111111',
    v2TimeFromTs: () => '09:00',
    v2DateFromTs: () => '2026-09-16',
    noteItemsFromDb: (v) => v || ''
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-journeys.js'), 'utf8'), sandbox, { filename: 'db-v2-journeys.js' });
  vm.runInContext('this.__x = { v2JourneyFromName, v2JourneyToName, v2JourneyCompactFrom, v2JourneyCompactTo, v2InferGroundTransportType, v2SlimJourneyParentRow, v2CompactLocationLabel, v2PlacesFromEndpoints, v2MapQueryForEndpoint, v2NormalizeArrangement, v2NormalizePreferredMethod, v2InferLegacyArrangement, v2InferLegacyPreferredMethod, v2HasGroundEnrichment, v2ComposeGroundFrontend, v2UiPlaceKind, V2_JOURNEY_DETAIL_TABLES, V2_JOURNEY_PARENT_COLUMNS };', sandbox);
  return sandbox.__x;
}

test('universal journey route uses shared location names only', () => {
  const J = loadJourneyHelpers();
  assert.equal(J.v2JourneyFromName({
    journey_type: 'rail',
    departure_location_name: 'Colwyn Bay',
    departure_station_name: 'Old Station'
  }), 'Colwyn Bay');
  assert.equal(J.v2JourneyFromName({
    journey_type: 'ground_transfer',
    pickup_location: 'Airport'
  }), '');
  assert.equal(J.v2JourneyToName({
    journey_type: 'ferry',
    arrival_location_name: 'Hook of Holland',
    arrival_port_name: 'Hoek'
  }), 'Hook of Holland');
  assert.equal(J.v2InferGroundTransportType('Please book an Uber'), 'uber');
});

test('journey parent writes drop type-specific leftover columns', () => {
  const sandbox = {
    window: {},
    console,
    isUuid: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '')),
    newUuid: () => '11111111-1111-4111-8111-111111111111'
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-journeys.js'), 'utf8'), sandbox, { filename: 'db-v2-journeys.js' });
  const slim = sandbox.v2SlimJourneyParentRow({
    id: '11111111-1111-4111-8111-111111111111',
    organisation_id: '22222222-2222-4222-8222-222222222222',
    journey_type: 'flight',
    journey_title: 'BA123',
    departure_location_name: 'Heathrow',
    arrival_location_name: 'JFK',
    departure_location_kind: 'airport',
    arrival_location_kind: 'airport',
    departure_location_address: 'Heathrow Airport',
    flight_number: 'BA123',
    departure_airport_iata: 'LHR',
    pickup_location: 'Terminal 5',
    passengers: [{ name: 'Jake' }],
    journey_notes: 'old'
  });
  assert.equal(slim.journey_title, 'BA123');
  assert.equal(slim.departure_location_name, 'Heathrow');
  assert.equal(slim.departure_location_kind, 'airport');
  assert.equal(slim.departure_location_address, 'Heathrow Airport');
  assert.equal('flight_number' in slim, false);
  assert.equal('passengers' in slim, false);
  assert.equal('pickup_location' in slim, false);
  assert.equal('journey_notes' in slim, false);
});

test('ground arrangement persists explicitly and legacy rows still infer', () => {
  const J = loadJourneyHelpers();
  assert.equal(J.v2NormalizeArrangement('pre'), 'pre_arranged');
  assert.equal(J.v2NormalizeArrangement('time'), 'arrange_at_time');
  assert.equal(J.v2NormalizePreferredMethod('either'), 'either');
  assert.equal(J.v2NormalizePreferredMethod('other'), 'either');
  assert.equal(J.v2HasGroundEnrichment({ arrangement: 'arrange_at_time', preferred_method: 'uber' }), true);
  assert.equal(J.v2InferLegacyArrangement({
    groundType: 'uber',
    name: ''
  }), 'arrange_at_time');
  assert.equal(J.v2InferLegacyPreferredMethod({
    groundType: 'other',
    name: ''
  }), 'either');
  assert.equal(J.v2InferLegacyArrangement({
    groundType: 'chauffeur',
    name: 'John'
  }), 'pre_arranged');
  const pre = J.v2ComposeGroundFrontend({
    id: 'j1',
    operator_name: 'Parklife Ground Transport',
    departure_location_kind: 'hotel',
    departure_location_name: 'The Midland Manchester',
    departure_location_address: '16 Peter Street, Manchester',
    arrival_location_kind: 'venue',
    arrival_location_name: 'Heaton Park',
    arrival_location_address: 'Middleton Road',
    ground_details: {
      arrangement: 'pre_arranged',
      ground_transport_type: 'chauffeur',
      vehicle_details: 'Black V-Class'
    }
  }, { display_name: 'John Smith', phone_number: '+44111' });
  assert.equal(pre.arrangement, 'pre_arranged');
  assert.equal(pre.noGround, false);
  assert.equal(pre.from, 'Hotel');
  assert.equal(pre.to, 'Venue');
  assert.equal(pre.fromName, 'The Midland Manchester');
  assert.equal(pre.fromAddress, '16 Peter Street, Manchester');
  assert.equal(pre.name, 'John Smith');
  assert.equal(pre.operator, 'Parklife Ground Transport');
  assert.equal(pre.preferredMethod, '');

  const atTime = J.v2ComposeGroundFrontend({
    id: 'j2',
    departure_location_kind: 'airport',
    departure_location_name: 'MAN',
    arrival_location_kind: 'custom',
    arrival_location_name: 'Artist Entrance',
    arrival_location_address: 'St Monica\'s RC High School',
    ground_details: {
      arrangement: 'arrange_at_time',
      preferred_method: 'either'
    }
  }, null);
  assert.equal(atTime.noGround, true);
  assert.equal(atTime.preferredMethod, 'either');
  assert.equal(atTime.name, '');
  assert.equal(atTime.toName, 'Artist Entrance');
  assert.equal(atTime.toAddress, 'St Monica\'s RC High School');

  const legacy = J.v2ComposeGroundFrontend({
    id: 'j3',
    operator_name: '',
    departure_location_name: 'Hotel',
    arrival_location_name: 'Venue',
    ground_details: {
      ground_transport_type: 'uber'
    }
  }, null);
  assert.equal(legacy.arrangement, 'arrange_at_time');
  assert.equal(legacy.preferredMethod, 'uber');
  assert.equal(legacy.noGround, true);
  assert.equal(legacy.from, 'Hotel');
  assert.equal(legacy.to, 'Venue');
});

test('maps prefer explicit address then IATA then contextual kind', () => {
  const J = loadJourneyHelpers();
  assert.equal(J.v2MapQueryForEndpoint({
    kind: 'custom',
    name: 'Artist Entrance',
    address: 'St Monica\'s RC High School, Prestwich'
  }, {}), 'St Monica\'s RC High School, Prestwich');
  assert.equal(J.v2MapQueryForEndpoint({
    kind: 'airport',
    name: 'Airport',
    iata: 'MAN'
  }, { airportQuery: 'city airport' }), 'MAN airport');
  assert.equal(J.v2MapQueryForEndpoint({
    kind: 'hotel',
    name: 'Hotel'
  }, { hotelQuery: '16 Peter Street, Manchester' }), '16 Peter Street, Manchester');
  assert.equal(J.v2MapQueryForEndpoint({
    kind: 'venue',
    name: 'Venue'
  }, { venueQuery: 'Heaton Park, Manchester' }), 'Heaton Park, Manchester');
  assert.equal(J.v2MapQueryForEndpoint({
    kind: 'custom',
    name: 'Artist Entrance'
  }, {}), 'Artist Entrance');
  assert.equal(J.v2MapQueryForEndpoint({
    kind: 'hotel',
    name: 'Hotel'
  }, {}), '');
});

test('location helpers keep real names while compact UI stays short', () => {
  const J = loadJourneyHelpers();
  const places = J.v2PlacesFromEndpoints('Hotel', 'Artist Entrance', {
    fromKind: 'hotel',
    toKind: 'custom',
    fromName: 'The Midland Manchester',
    fromAddress: '16 Peter Street',
    toName: 'Artist Entrance',
    toAddress: '',
    journeyType: 'ground_transfer'
  });
  assert.equal(places.departure_location_kind, 'hotel');
  assert.equal(places.departure_location_name, 'The Midland Manchester');
  assert.equal(places.departure_location_address, '16 Peter Street');
  assert.equal(places.arrival_location_kind, 'custom');
  assert.equal(places.arrival_location_name, 'Artist Entrance');
  assert.equal(places.arrival_location_address, null);
  assert.equal(J.v2CompactLocationLabel('hotel', 'The Midland Manchester'), 'Hotel');
  assert.equal(J.v2CompactLocationLabel('custom', 'Artist Entrance'), 'Artist Entrance');
  assert.equal(J.v2UiPlaceKind('hotel', 'The Midland Manchester'), 'hotel');
  assert.equal(J.v2JourneyCompactFrom({
    departure_location_kind: 'airport',
    flight_details: { departure_airport_iata: 'MAN' }
  }), 'MAN');
  assert.equal(J.v2PlacesFromEndpoints('Hotel', 'Venue').departure_location_kind, 'hotel');
});

test('journey subtype map stays 1:1 and still includes cycle/walk', () => {
  const J = loadJourneyHelpers();
  assert.equal(J.V2_JOURNEY_DETAIL_TABLES.flight, 'journey_flight_details');
  assert.equal(J.V2_JOURNEY_DETAIL_TABLES.rail, 'journey_rail_details');
  assert.equal(J.V2_JOURNEY_DETAIL_TABLES.ground_transfer, 'journey_ground_details');
  assert.equal(J.V2_JOURNEY_DETAIL_TABLES.ferry, 'journey_ferry_details');
  assert.equal(J.V2_JOURNEY_DETAIL_TABLES.coach, 'journey_coach_details');
  assert.equal('walk' in J.V2_JOURNEY_DETAIL_TABLES, false);
  assert.equal('cycle' in J.V2_JOURNEY_DETAIL_TABLES, false);
  assert.ok(J.V2_JOURNEY_PARENT_COLUMNS.includes('departure_location_kind'));
  assert.ok(J.V2_JOURNEY_PARENT_COLUMNS.includes('arrival_location_address'));
});

test('travel icon map still includes cycle, walk, rail, ferry and coach', () => {
  const sandbox = { window: {}, console };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-maps.js'), 'utf8'), sandbox, { filename: 'db-v2-maps.js' });
  assert.equal(sandbox.v2JourneyTypeFromEvent({ icon: 'cycle' }), 'cycle');
  assert.equal(sandbox.v2JourneyTypeFromEvent({ icon: 'walk' }), 'walk');
  assert.equal(sandbox.v2JourneyTypeFromEvent({ icon: 'train' }), 'rail');
  assert.equal(sandbox.v2JourneyTypeFromEvent({ icon: 'ferry' }), 'ferry');
  assert.equal(sandbox.v2JourneyTypeFromEvent({ icon: 'bus' }), 'coach');
  assert.equal(sandbox.v2IconFromJourneyType('cycle'), 'cycle');
});

test('legacy generalizePlaceLabel still maps tokens for compact display', () => {
  const sandbox = {
    window: { addEventListener() {} },
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return {}; } }; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {}, crypto: { randomUUID: () => 'a'.repeat(32) },
    console, setTimeout, clearTimeout
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(join(root, 'js', 'state.js'), 'utf8')
    + '\n;this.__x = { generalizePlaceLabel, applyGeneralDriverPlaces };',
    sandbox,
    { filename: 'state.js' }
  );
  const show = { hotel: { name: 'The Midland Manchester' }, venue: 'Heaton Park' };
  assert.equal(sandbox.__x.generalizePlaceLabel('Hotel', show), 'Hotel');
  assert.equal(sandbox.__x.generalizePlaceLabel('Venue', show), 'Venue');
  assert.equal(sandbox.__x.generalizePlaceLabel('Airport', show), 'Airport');
  const kept = sandbox.__x.applyGeneralDriverPlaces({
    fromKind: 'custom',
    toKind: 'custom',
    from: 'Artist Entrance',
    to: 'Festival Parking',
    fromName: 'Artist Entrance',
    toName: 'Festival Parking'
  }, show);
  assert.equal(kept.from, 'Artist Entrance');
  assert.equal(kept.to, 'Festival Parking');
});

