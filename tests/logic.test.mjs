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
    + '\n;this.__x = { jsAttr, esc, setStartMs, parseDT, countdown };';
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
