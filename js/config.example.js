// Copy to js/config.js and fill in your Supabase project credentials.
// Without valid values the app runs local-only (operate.v2.state in localStorage).
window.OPERATE_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  REQUIRE_AUTH: false,
  SYNC_ENABLED: true,
  // Multi-org (JAKE / FIN): leave OPERATE_ORG_ID unset so each signed-in
  // account loads the organisation they belong to.
  // OPERATE_DEV_MODE: true, // only for single shared org without sign-in
  // OPERATE_ORG_ID: 'uuid', // hardwire one org — do not use with multi-org
  // OPERATE_ALLOWED_USER_ID: 'uuid', // locks the app to one user — remove for multi-org
  // OPERATE_ALLOWED_EMAIL: 'you@example.com',
};
