#!/usr/bin/env node
// Assemble the web assets into www/ for Capacitor (the native shells copy from
// webDir). The repo root also holds non-web files (node_modules, native
// projects, supabase/, tests/…), so the native build needs a clean web-only
// directory. Run before every `npx cap sync`.
//
// Credentials: this reuses scripts/generate-config.mjs, which reads
// SUPABASE_URL / SUPABASE_ANON_KEY from the environment. Export them (or your
// existing js/config.js is copied as-is if the env vars are absent and a real
// config already exists) so the bundled app can reach your Supabase project.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const www = join(root, 'www');

// 1. Generate js/config.js + auto-version sw.js (same step Netlify runs).
//    Skip regeneration only if a real (non-placeholder) config already exists
//    and no Supabase env vars are set — so a hand-written js/config.js survives.
const cfgPath = join(root, 'js', 'config.js');
const haveEnv = (process.env.SUPABASE_URL || '').trim() && (process.env.SUPABASE_ANON_KEY || '').trim();
const cfgIsReal = existsSync(cfgPath) && !readFileSync(cfgPath, 'utf8').includes('YOUR-PROJECT');
if (haveEnv || !cfgIsReal) {
  execFileSync(process.execPath, [join(__dir, 'generate-config.mjs')], { stdio: 'inherit' });
} else {
  console.log('Keeping existing js/config.js (no Supabase env vars set)');
}

// 2. Rebuild www/ from the web-only source files.
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
const items = [
  'index.html',
  'styles.css',
  'manifest.json',
  'sw.js',
  'js',
  'icons',
  'assets',
];
for (const item of items) {
  const src = join(root, item);
  if (!existsSync(src)) continue;
  cpSync(src, join(www, item), { recursive: true });
}

console.log('Built www/ for Capacitor');
