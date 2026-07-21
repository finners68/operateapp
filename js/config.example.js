// Copy to js/config.js and fill in your Supabase project credentials.
// Without valid values the app runs local-only (artisthq.v2 in localStorage).
window.OPERATE_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  REQUIRE_AUTH: false,
  SYNC_ENABLED: false,
  // OPERATE_ORG_ID: 'your-dev-org-uuid',
  // OPERATE_DEV_MODE: true, // no sign-in; anon RLS on one org (run dev_hardwire_setup.sql)
  // OPERATE_ALLOWED_USER_ID: 'your-supabase-user-uuid',
  // OPERATE_ALLOWED_EMAIL: 'you@example.com',
};
