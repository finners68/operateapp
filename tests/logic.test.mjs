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
    newUuid: () => '11111111-1111-4111-8111-111111111111'
  };
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js', 'db-v2-journeys.js'), 'utf8'), sandbox, { filename: 'db-v2-journeys.js' });
  vm.runInContext('this.__x = { v2JourneyFromName, v2JourneyToName, v2InferGroundTransportType };', sandbox);
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
    flight_number: 'BA123',
    departure_airport_iata: 'LHR',
    pickup_location: 'Terminal 5',
    passengers: [{ name: 'Jake' }],
    journey_notes: 'old'
  });
  assert.equal(slim.journey_title, 'BA123');
  assert.equal(slim.departure_location_name, 'Heathrow');
  assert.equal('flight_number' in slim, false);
  assert.equal('passengers' in slim, false);
  assert.equal('pickup_location' in slim, false);
  assert.equal('journey_notes' in slim, false);
});
