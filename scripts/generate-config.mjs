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

const requireAuth = /^true$/i.test((process.env.REQUIRE_AUTH || 'false').trim());
const syncEnabled = /^true$/i.test((process.env.SYNC_ENABLED || 'false').trim());
const orgId = (process.env.OPERATE_ORG_ID || '').trim();
const orgLine = orgId ? `\n  OPERATE_ORG_ID: '${orgId}',` : '';
const hasCredentials = url && key && !url.includes('YOUR-PROJECT') && !key.includes('YOUR-ANON');
const content = hasCredentials
  ? `// Generated at build time\nwindow.OPERATE_CONFIG = {\n  SUPABASE_URL: '${url.replace(/\/$/, '')}',\n  SUPABASE_ANON_KEY: '${key}',\n  REQUIRE_AUTH: ${requireAuth},\n  SYNC_ENABLED: ${syncEnabled},${orgLine}\n};\n`
  : `window.OPERATE_CONFIG = window.OPERATE_CONFIG || {\n  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',\n  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',\n  REQUIRE_AUTH: false,\n  SYNC_ENABLED: false,\n};\n`;

writeFileSync(outPath, content, 'utf8');
console.log(hasCredentials ? 'Wrote js/config.js (configured)' : 'Wrote js/config.js (placeholders)');
