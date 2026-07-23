#!/usr/bin/env node
/* Syntax-gate every browser JS file (the app has no bundler, so this is the
   cheapest regression guard). Exits non-zero on the first parse error. */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'js');
let failed = 0;
for (const f of readdirSync(jsDir).sort()) {
  if (!f.endsWith('.js')) continue;
  try {
    execFileSync(process.execPath, ['--check', join(jsDir, f)], { stdio: 'pipe' });
    console.log('ok  js/' + f);
  } catch (e) {
    failed++;
    console.error('FAIL js/' + f + '\n' + (e.stderr?.toString() || e.message));
  }
}
process.exit(failed ? 1 : 0);
