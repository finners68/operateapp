/* Unit tests for Operate's pure logic, run against the REAL source (js/state.js)
   loaded into a sandboxed VM context (no build step). Run: `node --test`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moveGridWidget, placeGridWidgetAtPointer, pointerToGridCell } from '../src/home/homeWidgetGrid.ts';
import { browserKeyProblem } from '../scripts/config-key.mjs';

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
    + '\n;this.__x = { jsAttr, esc, setStartMs, parseDT, countdown, logisticTypeLabel, placeRouteEndParts, applyGeneralDriverPlaces, groundTransferTitle, groundRouteRealName, sortJourneysChrono, journeyWhenMs, sortFlightsChrono };';
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

test('countdown uses months, then weeks, then days and hours', () => {
  const hour = 3600000;
  const day = 24 * hour;
  const at = (days, hours) => Date.now() + days * day + hours * hour + 5000;
  assert.equal(S.countdown(at(0, 5)).txt, '5h');
  assert.equal(S.countdown(at(3, 4)).txt, '3d 4h');
  assert.equal(S.countdown(at(10, 2)).txt, '1w 3d');
  const now = new Date();
  const monthTarget = new Date(now.getTime());
  const dom = monthTarget.getDate();
  monthTarget.setDate(1);
  monthTarget.setMonth(monthTarget.getMonth() + 2);
  const last = new Date(monthTarget.getFullYear(), monthTarget.getMonth() + 1, 0).getDate();
  monthTarget.setDate(Math.min(dom, last));
  monthTarget.setTime(monthTarget.getTime() + 8 * day);
  assert.match(S.countdown(monthTarget.getTime()).txt, /^2mo /);
  assert.equal(S.countdown(Date.now() - 1000).done, true);
  assert.equal(S.countdown(Date.now() - 1000).txt, '—');
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

test('unknown PostgREST columns are identified so leftover journey fields can be stripped', () => {
  const sandbox = { window: {}, console };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-repo.js'), 'utf8'), sandbox, { filename: 'db-v2-repo.js' });
  assert.equal(sandbox.v2UnknownColumnFromError({
    message: "Could not find the 'pickup_location' column of 'journeys' in the schema cache"
  }, 'journeys'), 'pickup_location');
  const rows = [{ id: '1', pickup_location: 'Hotel', vehicle_details: 'Van' }];
  assert.equal(sandbox.v2StripUnknownColumn(rows, 'pickup_location'), true);
  assert.equal('pickup_location' in rows[0], false);
  assert.equal(rows[0].vehicle_details, 'Van');
});

test('ground route ends show a compact label over the real place name', () => {
  const hotel = S.placeRouteEndParts('Hotel', 'The Midland Manchester');
  assert.equal(hotel.primary, 'Hotel');
  assert.equal(hotel.secondary, 'The Midland Manchester');
  const venue = S.placeRouteEndParts('Venue', 'Heaton Park');
  assert.equal(venue.primary, 'Venue');
  assert.equal(venue.secondary, 'Heaton Park');
  const same = S.placeRouteEndParts('The Midland Manchester', 'The Midland Manchester');
  assert.equal(same.primary, 'The Midland Manchester');
  assert.equal(same.secondary, '');
  const iata = S.placeRouteEndParts('MAN', 'Manchester Airport');
  assert.equal(iata.primary, 'MAN');
  assert.equal(iata.secondary, 'Manchester Airport');
  const custom = S.placeRouteEndParts('Artist Entrance', "St Monica's High School");
  assert.equal(custom.primary, 'Artist Entrance');
  assert.equal(custom.secondary, "St Monica's High School");
  const nameOnly = S.placeRouteEndParts('', 'Heaton Park');
  assert.equal(nameOnly.primary, 'Heaton Park');
  assert.equal(nameOnly.secondary, '');
});

test('journeys in a section sort earliest-first by date and time', () => {
  const showDate = '2026-09-12';
  const ordered = S.sortJourneysChrono([
    { id: 'late', time: '18:00', date: showDate },
    { id: 'early', time: '09:30', date: showDate },
    { id: 'mid', start: '14:00', date: showDate },
    { id: 'flight', dep: '2026-09-12 11:10' }
  ], showDate);
  assert.deepEqual(ordered.map(x => x.id), ['early', 'flight', 'mid', 'late']);
});

test('journeys with no time sink to the end of their section', () => {
  const ordered = S.sortJourneysChrono([
    { id: 'blank' },
    { id: 'morning', time: '08:00', date: '2026-09-12' },
    { id: 'also-blank', date: '' }
  ], '2026-09-12');
  assert.equal(ordered[0].id, 'morning');
  assert.equal(ordered[1].id, 'blank');
  assert.equal(ordered[2].id, 'also-blank');
});

test('a later-added earlier journey still sorts before a later one', () => {
  const flights = S.sortFlightsChrono([
    { id: 'added-first', code: 'BA2', dep: '2026-09-13 18:40' },
    { id: 'added-second', code: 'BA1', dep: '2026-09-12 07:15' }
  ], '2026-09-12');
  assert.deepEqual(flights.map(x => x.id), ['added-second', 'added-first']);
});

test('same-day post-midnight journeys sort after the evening ones', () => {
  const ordered = S.sortJourneysChrono([
    { id: 'return', time: '01:15', date: '2026-09-12' },
    { id: 'to-venue', time: '22:30', date: '2026-09-12' }
  ], '2026-09-12');
  assert.deepEqual(ordered.map(x => x.id), ['to-venue', 'return']);
});

test('ground cards keep Hotel to Venue as the title and the real place name underneath', () => {
  const show = { hotel: { name: 'The Wilde Grassmarket' }, venue: 'SWG3 Studio Warehouse', eventName: 'FLY Festival' };
  const d = S.applyGeneralDriverPlaces({ from: 'The Wilde Grassmarket', to: 'SWG3 Studio Warehouse' }, show);
  assert.equal(d.from, 'Hotel');
  assert.equal(d.to, 'Venue');
  assert.equal(d.fromName, 'The Wilde Grassmarket');
  assert.equal(d.toName, 'SWG3 Studio Warehouse');
  assert.equal(S.groundTransferTitle(d), 'Drive');
  assert.equal(S.groundRouteRealName('Hotel', '', show), 'The Wilde Grassmarket');
  assert.equal(S.groundRouteRealName('Venue', '', show), 'SWG3 Studio Warehouse');
  assert.equal(S.groundRouteRealName('Hotel', 'Gerodan House', show), 'Gerodan House');
});

function loadRunsHarness() {
  const sandbox = {
    window: { addEventListener() {} },
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return {}; } }; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {}, crypto: { randomUUID: () => 'a'.repeat(32) },
    console, setTimeout, clearTimeout,
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'state.js'), 'utf8'), sandbox, { filename: 'state.js' });
  return sandbox;
}

test('tour runs group shows between home outbound and inbound flights', () => {
  const sb = loadRunsHarness();
  vm.runInContext(`
    store = {
      settings: { homeAirport: 'AMS' },
      events: [
        { id: 'a', kind: 'show', date: '2026-06-01', city: 'Belfast', flights: [
          { fromCode: 'AMS', toCode: 'BFS', dep: '2026-06-01 09:00' }
        ]},
        { id: 'b', kind: 'show', date: '2026-06-03', city: 'Glasgow', flights: [] },
        { id: 'c', kind: 'show', date: '2026-06-05', city: 'Liverpool', flights: [
          { fromCode: 'LPL', toCode: 'AMS', arr: '2026-06-05 23:00' }
        ]},
        { id: 'd', kind: 'show', date: '2026-06-20', city: 'Berlin', flights: [] }
      ],
      trips: []
    };
  `, sb);
  const runs = sb.runs();
  assert.equal(runs.length, 2);
  assert.equal(runs[0].shows.length, 3);
  assert.equal(runs[0].shows.map(s => s.id).join(','), 'a,b,c');
  assert.equal(runs[1].shows.length, 1);
});

test('a flight out of home does not swallow later shows that do not connect', () => {
  const sb = loadRunsHarness();
  vm.runInContext(`
    store = {
      settings: { homeAirport: 'AMS' },
      events: [
        { id: 'a', kind: 'show', date: '2026-08-01', city: 'A', flights: [
          { fromCode: 'AMS', toCode: 'MAN', dep: '2026-08-01 08:00' }
        ]},
        { id: 'b', kind: 'show', date: '2026-08-03', city: 'B', flights: [] },
        { id: 'c', kind: 'show', date: '2026-08-10', city: 'C', flights: [] }
      ],
      trips: []
    };
  `, sb);
  const runs = sb.runs();
  assert.equal(runs.length, 2);
  assert.equal(runs[0].shows.map(s => s.id).join(','), 'a,b');
  assert.equal(runs[1].shows[0].id, 'c');
});

test('connecting flights stay together and a later flight home does not pull in unrelated shows', () => {
  const sb = loadRunsHarness();
  vm.runInContext(`
    store = {
      settings: { homeAirport: 'MAN' },
      events: [
        { id: 'ny', kind: 'show', date: '2026-10-06', city: 'New York', flights: [
          { fromCode: 'MAN', toCode: 'EWR', dep: '2026-10-06 09:00' }
        ]},
        { id: 'nj', kind: 'show', date: '2026-10-12', city: 'New Jersey', flights: [
          { fromCode: 'EWR', toCode: 'EWR', dep: '2026-10-12 12:00' }
        ]},
        { id: 'malta', kind: 'show', date: '2026-10-15', city: 'Malta', flights: [] },
        { id: 'home', kind: 'show', date: '2026-11-25', city: 'Glasgow', flights: [
          { fromCode: 'BCN', toCode: 'MAN', arr: '2026-11-25 18:00' }
        ]}
      ],
      trips: []
    };
  `, sb);
  const runs = sb.runs();
  assert.equal(runs.length, 3);
  assert.equal(runs[0].shows.map(s => s.id).join(','), 'ny,nj');
  assert.equal(runs[1].shows[0].id, 'malta');
  assert.equal(runs[2].shows[0].id, 'home');
});

test('tour runs split on home return, not the next outbound alone', () => {
  const sb = loadRunsHarness();
  vm.runInContext(`
    store = {
      settings: { homeAirport: 'AMS' },
      events: [
        { id: 't1a', kind: 'show', date: '2026-09-01', city: 'A', flights: [
          { fromCode: 'AMS', toCode: 'MAN', dep: '2026-09-01 08:00' }
        ]},
        { id: 't1b', kind: 'show', date: '2026-09-03', city: 'B', flights: [
          { fromCode: 'MAN', toCode: 'AMS', arr: '2026-09-03 22:00' }
        ]},
        { id: 'solo', kind: 'show', date: '2026-09-12', city: 'Solo', flights: [] },
        { id: 't2a', kind: 'show', date: '2026-09-15', city: 'C', flights: [
          { fromCode: 'AMS', toCode: 'BER', dep: '2026-09-15 07:00' }
        ]},
        { id: 't2b', kind: 'show', date: '2026-09-17', city: 'D', flights: [
          { fromCode: 'BER', toCode: 'AMS', arr: '2026-09-17 21:00' }
        ]}
      ],
      trips: []
    };
  `, sb);
  const runs = sb.runs();
  assert.equal(runs.length, 3);
  assert.equal(runs[0].shows.length, 2);
  assert.equal(runs[0].shows.map(s => s.id).join(','), 't1a,t1b');
  assert.equal(runs[1].shows[0].id, 'solo');
  assert.equal(runs[2].shows.length, 2);
});

test('tour runs count IATA-only flights and ignore stray return markers', () => {
  const sb = loadRunsHarness();
  vm.runInContext(`
    store = {
      settings: { homeAirport: 'Amsterdam (AMS)' },
      events: [
        { id: 't1a', kind: 'show', date: '2026-07-01', city: 'A', flights: [
          { fromCode: 'AMS', toCode: 'MAN', dep: '2026-07-01 08:00' }
        ]},
        { id: 't1b', kind: 'show', date: '2026-07-03', city: 'B', flights: [] },
        { id: 't1c', kind: 'show', date: '2026-07-05', city: 'C', flights: [
          { fromCode: 'MAN', toCode: 'AMS', arr: '2026-07-05 22:00' }
        ]},
        { id: 't2a', kind: 'show', date: '2026-07-12', city: 'D', flights: [
          { fromCode: 'AMS', toCode: 'BER', dep: '2026-07-12 07:00' }
        ]},
        { id: 't2b', kind: 'show', date: '2026-07-14', city: 'E', flights: [
          { fromCode: 'BER', toCode: 'AMS', arr: '2026-07-14 21:00' }
        ]}
      ],
      trips: []
    };
  `, sb);
  const runs = sb.runs();
  assert.equal(runs.length, 2);
  assert.equal(runs[0].shows.length, 3);
  assert.equal(runs[1].shows.length, 2);
});

function loadSearch() {
  const sandbox = {
    window: { addEventListener() {} },
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return {}; } }; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {}, crypto: { randomUUID: () => 'a'.repeat(32) },
    console, setTimeout, clearTimeout,
    CATS: { purple: '#6d5efc' },
    ICON: {
      chevR: () => '',
      planeTop: () => '',
      map: () => '',
      bed: () => '',
      car: () => '',
      users: () => '',
      receipt: () => '',
      clip: () => ''
    },
    esc: s => String(s ?? ''),
    jsAttr: s => String(s ?? '').replace(/'/g, "\\'"),
    fmtDate: d => d || '',
    relDay: d => d || '',
    parseDT: (d) => d ? new Date(d + 'T12:00:00') : null,
    showTitle: (e) => e.eventName || e.venue || '',
    cleanVenue: v => String(v || '').trim(),
    runDestinationsSummary: () => '',
    runDateLabel: () => '',
    runs: () => [],
    flightHasDetails: f => !!(f && (f.code || f.from || f.to)),
    flightEndpointCodes: f => ({ from: f.fromCode || f.from || '', to: f.toCode || f.to || '' }),
    travelFlightCodes: e => ({ from: e.fromCode || e.from || '', to: e.toCode || e.to || '' }),
    runs: () => [],
    runDestinationsSummary: () => '',
    runDateLabel: () => ''
  };
  sandbox.store = { events: [], contacts: [], invoices: [] };
  sandbox.sel = {
    events: () => (sandbox.store.events || []).filter(e => (e.kind || 'show') === 'show'),
    event: (id) => (sandbox.store.events || []).find(e => e.id === id)
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'search.js'), 'utf8'), sandbox, { filename: 'search.js' });
  return sandbox;
}

test('global search ignores note bodies and matches structured show fields', () => {
  const sb = loadSearch();
  Object.assign(sb.store, {
    events: [
      { id: 's1', kind: 'show', eventName: 'Parklife', venue: 'Heaton Park', city: 'Manchester', date: '2026-06-20', flights: [] }
    ],
    contacts: [],
    invoices: [],
    notes: [{ id: 'n1', title: 'Ideas', body: 'Parklife should not match from this paragraph' }]
  });
  const pack = sb.globalSearch('parklife');
  assert.equal(pack.results.length, 1);
  assert.equal(pack.results[0].type, 'show');
  assert.equal(pack.results[0].id, 's1');
});

test('global search surfaces flights and venues without scraping travel info notes', () => {
  const sb = loadSearch();
  Object.assign(sb.store, {
    events: [
      { id: 's1', kind: 'show', eventName: 'NYC', venue: 'Terminal 5', city: 'New York', date: '2026-10-06',
        flights: [{ id: 'f1', code: 'BA123', fromCode: 'MAN', toCode: 'JFK', dep: '2026-10-06 09:00' }]
      },
      { id: 't1', kind: 'travel', icon: 'plane', showId: null, fromCode: 'MAN', toCode: 'JFK', flightNo: 'BA123', title: 'Flight', date: '2026-10-06', start: '09:00',
        info: 'random baggage note mentioning unrelated words' }
    ],
    contacts: [],
    invoices: []
  });
  const byCode = sb.globalSearch('ba123');
  assert.ok(byCode.results.some(r => r.type === 'flight'));
  const byVenue = sb.globalSearch('terminal');
  assert.equal(byVenue.results.length, 1);
  assert.equal(byVenue.results[0].type, 'venue');
});

test('global search dedupes show vs venue and ranks exact names first', () => {
  const sb = loadSearch();
  Object.assign(sb.store, {
    events: [
      { id: 'a', kind: 'show', eventName: 'Parklife', venue: 'Heaton Park', city: 'Manchester', date: '2026-06-20', flights: [] },
      { id: 'b', kind: 'show', eventName: 'Other', venue: 'SWG3', city: 'Glasgow', date: '2026-09-10', flights: [] }
    ],
    contacts: [],
    invoices: []
  });
  const exact = sb.globalSearch('parklife');
  assert.equal(exact.results[0].title.toLowerCase().includes('parklife'), true);
  const venueOnly = sb.globalSearch('swg3');
  assert.equal(venueOnly.results.length, 1);
  assert.equal(venueOnly.results[0].type, 'venue');
});

test('home persona follows the saved account type and falls back to DJ', () => {
  const sandbox = {
    window: { addEventListener() {} },
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return {}; } }; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {}, crypto: { randomUUID: () => 'a'.repeat(32) },
    console, setTimeout, clearTimeout,
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'state.js'), 'utf8'), sandbox, { filename: 'state.js' });
  const out = vm.runInContext(`
    store = { settings: {} };
    const missing = homePersona();
    const missingBlurb = homePersonaBlurb();
    store.settings.accountType = 'tm';
    const tm = homePersona();
    const tmBlurb = homePersonaBlurb();
    store.settings.accountType = 'agent';
    const agent = homePersona();
    store.settings.accountType = 'not-a-role';
    const unknown = homePersona();
    ({ missing, missingBlurb, tm, tmBlurb, agent, unknown });
  `, sandbox);
  assert.equal(out.missing, 'dj');
  assert.equal(out.missingBlurb, 'Your next show and travel at a glance');
  assert.equal(out.tm, 'tm');
  assert.equal(out.tmBlurb, "Today's tour operations");
  assert.equal(out.agent, 'agent');
  assert.equal(out.unknown, 'dj');
});

function loadCurrencyHarness() {
  const sandbox = {
    store: { settings: { baseCurrency: 'GBP', fx: { GBP: 1, EUR: 0.86, USD: 0.79 } } },
    console,
    persist() {},
    toBase(amount, cur) {
      const fx = sandbox.store.settings.fx;
      const base = sandbox.store.settings.baseCurrency;
      return (amount || 0) * (fx[cur] || 1) / (fx[base] || 1);
    },
    fxRate(cur) { return sandbox.store.settings.fx[cur] || 1; },
    homeCurrency() { return 'GBP'; },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'currency.js'), 'utf8'), sandbox, { filename: 'currency.js' });
  return sandbox;
}

test('currencyCodes always includes GBP and EUR', () => {
  const C = loadCurrencyHarness();
  const codes = C.currencyCodes({ baseCurrency: 'GBP', fx: { GBP: 1, USD: 0.79 } });
  assert.ok(codes.includes('GBP'));
  assert.ok(codes.includes('EUR'));
  assert.ok(codes.includes('USD'));
});

test('ensureCurrencySettings fills default EUR rate', () => {
  const C = loadCurrencyHarness();
  const settings = { baseCurrency: 'GBP', fx: { GBP: 1 } };
  C.ensureCurrencySettings(settings);
  assert.equal(typeof settings.fx.EUR, 'number');
  assert.ok(settings.fx.EUR > 0);
});

test('convertCurrency converts via base', () => {
  const C = loadCurrencyHarness();
  const inEur = C.convertCurrency(100, 'GBP', 'EUR');
  assert.ok(inEur > 100);
  assert.equal(C.convertCurrency(50, 'EUR', 'EUR'), 50);
});

test('defaultFxTable has unit rate for base', () => {
  const C = loadCurrencyHarness();
  const fx = C.defaultFxTable('EUR');
  assert.equal(fx.EUR, 1);
  assert.ok(fx.GBP > 0);
});

test('removeAppCurrency blocks removing GBP', () => {
  const C = loadCurrencyHarness();
  const r = C.removeAppCurrency('GBP');
  assert.equal(r.ok, false);
});

test('rebaseFxForNewBase keeps GBP/EUR relationship when switching base', () => {
  const C = loadCurrencyHarness();
  C.store.settings = { baseCurrency: 'GBP', fx: { GBP: 1, EUR: 0.86 } };
  C.rebaseFxForNewBase(C.store.settings, 'EUR');
  assert.equal(C.store.settings.baseCurrency, 'EUR');
  assert.equal(C.store.settings.fx.EUR, 1);
  assert.ok(C.store.settings.fx.GBP > 1.1);
  assert.ok(Math.abs(C.convertCurrency(100, 'GBP', 'EUR') - 116) < 2);
});

test('emptyOperateState has no bundled shows', () => {
  const sandbox = { console, crypto: { randomUUID: () => 'aaaaaaaa-bbbb-4ccc-yyyy-xxxxxxxxxxxx' } };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-state.js'), 'utf8'), sandbox, { filename: 'db-v2-state.js' });
  const s = vm.runInContext('emptyOperateState();', sandbox);
  assert.equal(Array.isArray(s.events), true);
  assert.equal(s.events.length, 0);
  assert.equal((s.v2 && s.v2.shows) ? s.v2.shows.length : 0, 0);
});

test('moveGridWidget places widgets side by side on the same row', () => {
  const grid = [
    { id: 'a', x: 0, y: 0, w: 4, h: 3, size: 'small' },
    { id: 'b', x: 0, y: 3, w: 4, h: 3, size: 'small' },
  ];
  const next = moveGridWidget(grid, 'b', 4, 0, 12);
  const b = next.find((g) => g.id === 'b');
  assert.equal(b.x, 4);
  assert.equal(b.y, 0);
  assert.equal(next.find((g) => g.id === 'a').x, 0);
});

test('placeGridWidgetAtPointer snaps to grid column under the pointer', () => {
  const grid = [
    { id: 'a', x: 0, y: 0, w: 6, h: 4, size: 'medium' },
    { id: 'b', x: 0, y: 4, w: 6, h: 4, size: 'medium' },
  ];
  const container = {
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 612, height: 900 }),
  };
  const cell = pointerToGridCell(container, 100 + 320, 200 + 40, 12, 76, 12);
  assert.equal(cell.x, 6);
  assert.equal(cell.y, 0);
  const next = placeGridWidgetAtPointer(grid, 'b', container, 100 + 320, 200 + 40, 12, 76);
  const b = next.find((g) => g.id === 'b');
  assert.equal(b.x, 6);
  assert.equal(b.y, 0);
});

test('venueMapQuery prefers address then venue name with city', () => {
  const sandbox = {
    window: {},
    document: { addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    store: { settings: {} },
    console,
    sel: { event() { return null; } },
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'state.js'), 'utf8'), sandbox, { filename: 'state.js' });
  vm.runInContext(readFileSync(join(root, 'js', 'trip.js'), 'utf8'), sandbox, { filename: 'trip.js' });
  const withAddr = vm.runInContext(`venueMapQuery({
    venue: 'DC10',
    venueAddr: 'Carrer de la Playa',
    city: 'Ibiza',
    country: 'Spain'
  });`, sandbox);
  assert.ok(/playa/i.test(withAddr));
  const nameOnly = vm.runInContext(`venueMapQuery({
    venue: 'DC10',
    city: 'Ibiza',
    country: 'Spain'
  });`, sandbox);
  assert.equal(nameOnly, 'DC10, Ibiza, Spain');
});

function loadDirtyHelpers() {
  const sandbox = { window: {}, console, store: { _dirtyEpoch: Object.create(null) } };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-state.js'), 'utf8'), sandbox, { filename: 'db-v2-state.js' });
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-load.js'), 'utf8'), sandbox, { filename: 'db-v2-load.js' });
  vm.runInContext('this.__x = { mergeDirty, mergePendingItineraries, v2MergeDirtyShow, v2ApplyCloudVenueFields };', sandbox);
  return sandbox.__x;
}

test('mergeDirty keeps edits from both snapshots and does not drop ids', () => {
  const sandbox = { window: {}, console, store: { _dirtyEpoch: Object.create(null) } };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-state.js'), 'utf8'), sandbox, { filename: 'db-v2-state.js' });
  const merged = vm.runInContext(`(() => {
    const a = { shows: new Set(['show-a']) };
    const b = { journeys: new Set(['journey-b']) };
    const both = mergeDirty(a, b);
    const full = mergeDirty(a, { '*': '*' });
    return { shows: [...both.shows], journeys: [...both.journeys], full: full['*'] };
  })()`, sandbox);
  assert.equal(merged.shows.join(','), 'show-a');
  assert.equal(merged.journeys.join(','), 'journey-b');
  assert.equal(merged.full, '*');
});

test('a cloud refresh keeps venue fields from the cloud and an in-progress itinerary', () => {
  const D = loadDirtyHelpers();
  const local = { id: 's1', kind: 'show', venue: 'Old Room', city: 'Manchester' };
  const cloud = { id: 's1', kind: 'show', venue: 'New Room', city: 'Manchester', venueAddr: '1 High St' };
  const merged = D.v2MergeDirtyShow(local, cloud);
  assert.equal(merged.venue, 'New Room');
  assert.equal(merged.venueAddr, '1 High St');
  const pending = { id: 'it-1', scanFields: { venue: 'Shelter' }, imgs: [{ id: 'f' }] };
  const kept = D.mergePendingItineraries([{ id: 'it-2', showId: 's1' }], [pending, { id: 'it-3', showId: 's9' }]);
  assert.equal(kept[0].id, 'it-1');
  assert.equal(kept.some((row) => row.id === 'it-3'), false);
});

function fakeKey(role) {
  const body = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return 'e30.' + body + '.sig';
}

test('the browser config rejects a secret database key', () => {
  assert.equal(browserKeyProblem(''), '');
  assert.equal(browserKeyProblem('YOUR-ANON-KEY'), '');
  assert.equal(browserKeyProblem(fakeKey('anon')), '');
  assert.match(browserKeyProblem(fakeKey('service_role')), /anon key/);
  assert.match(browserKeyProblem('sb_secret_example'), /secret key/);
});


