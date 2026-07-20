#!/usr/bin/env node
/** Quick smoke test — run after filling js/config.js */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dir, '..', 'js', 'config.js');
const html = readFileSync(join(__dir, '..', 'index.html'), 'utf8');

const cfgSrc = readFileSync(configPath, 'utf8');
const urlMatch = cfgSrc.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
const keyMatch = cfgSrc.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/);
const url = urlMatch?.[1];
const key = keyMatch?.[1];

const placeholders = !url || url.includes('YOUR-PROJECT') || !key || key.includes('YOUR-ANON');

console.log('--- Operate Supabase verify ---');
console.log('index.html loads auth sheet:', html.includes('authSheet') ? 'OK' : 'MISSING');
console.log('config.js:', placeholders ? 'PLACEHOLDERS (local-only mode)' : 'CONFIGURED');

if (!placeholders) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log('REST API:', res.ok ? `OK (${res.status})` : `FAIL (${res.status})`);

  const tables = ['shows', 'orgs', 'org_settings'];
  for (const t of tables) {
    const tr = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${t}?select=count&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    });
    const ok = tr.status === 200 || tr.status === 206;
    console.log(`  table ${t}:`, ok ? 'OK' : `FAIL (${tr.status}) — run combined_dev_setup.sql`);
  }
} else {
  console.log('Skip API checks — fill config via scripts/setup-dev.ps1');
}

console.log('--- done ---');
