#!/usr/bin/env node
import { writeFileSync, readFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const outPath = join(root, 'js', 'config.js');

// Auto-version the service worker from a content hash of the shell so cache
// busting no longer depends on a manual VERSION bump. (#25)
try {
  const hash = createHash('sha1');
  hash.update(readFileSync(join(root, 'index.html')));
  hash.update(readFileSync(join(root, 'styles.css')));
  for (const f of readdirSync(join(root, 'js')).sort()) {
    if (f.endsWith('.js') && f !== 'config.js') hash.update(readFileSync(join(root, 'js', f)));
  }
  const digest = hash.digest('hex').slice(0, 10);
  const swPath = join(root, 'sw.js');
  const sw = readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = 'operate-${digest}';`);
  writeFileSync(swPath, sw, 'utf8');
  console.log('Set SW version operate-' + digest);
} catch (e) {
  console.warn('SW auto-version skipped:', e.message);
}
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
const allowedUserId = (process.env.OPERATE_ALLOWED_USER_ID || '').trim();
const allowedEmail = (process.env.OPERATE_ALLOWED_EMAIL || '').trim();
const devMode = /^true$/i.test((process.env.OPERATE_DEV_MODE || 'false').trim());
const orgLine = orgId ? `\n  OPERATE_ORG_ID: '${orgId}',` : '';
const userIdLine = allowedUserId ? `\n  OPERATE_ALLOWED_USER_ID: '${allowedUserId}',` : '';
const emailLine = allowedEmail ? `\n  OPERATE_ALLOWED_EMAIL: '${allowedEmail.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',` : '';
const devLine = devMode ? `\n  OPERATE_DEV_MODE: true,` : '';
const hasCredentials = url && key && !url.includes('YOUR-PROJECT') && !key.includes('YOUR-ANON');
const content = hasCredentials
  ? `// Generated at build time\nwindow.OPERATE_CONFIG = {\n  SUPABASE_URL: '${url.replace(/\/$/, '')}',\n  SUPABASE_ANON_KEY: '${key}',\n  REQUIRE_AUTH: ${requireAuth},\n  SYNC_ENABLED: ${syncEnabled},${orgLine}${userIdLine}${emailLine}${devLine}\n};\n`
  : `window.OPERATE_CONFIG = window.OPERATE_CONFIG || {\n  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',\n  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',\n  REQUIRE_AUTH: false,\n  SYNC_ENABLED: false,\n};\n`;

writeFileSync(outPath, content, 'utf8');
console.log(hasCredentials ? 'Wrote js/config.js (configured)' : 'Wrote js/config.js (placeholders)');
