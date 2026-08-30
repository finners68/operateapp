// Copy to js/config.js and fill in your Supabase project credentials.
// Without valid values the app runs local-only (operate.v2.state in localStorage).
window.OPERATE_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  REQUIRE_AUTH: false,
  SYNC_ENABLED: true,
  // With SYNC_ENABLED + REQUIRE_AUTH false, the app uses hardcoded JAKE / FIN
  // organisations and a Settings → Organisation picker (no sign-in).
};
