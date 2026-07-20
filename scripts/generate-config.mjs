#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dir, '..', 'js', 'config.js');
const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
const isNetlify = process.env.NETLIFY === 'true';

if (isNetlify && (!url || !key)) {
  console.error('Netlify build failed: set SUPABASE_URL and SUPABASE_ANON_KEY in Environment variables.');
  process.exit(1);
}

const hasCredentials = url && key && !url.includes('YOUR-PROJECT') && !key.includes('YOUR-ANON');
const content = hasCredentials
  ? `// Generated at build time\nwindow.OPERATE_CONFIG = {\n  SUPABASE_URL: '${url.replace(/\/$/, '')}',\n  SUPABASE_ANON_KEY: '${key}',\n};\n`
  : `window.OPERATE_CONFIG = window.OPERATE_CONFIG || {\n  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',\n  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',\n};\n`;

writeFileSync(outPath, content, 'utf8');
console.log(hasCredentials ? 'Wrote js/config.js (configured)' : 'Wrote js/config.js (placeholders)');
