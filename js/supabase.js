/* Supabase client singleton */
const STORAGE_BUCKET = 'operate-documents';

function isSupabaseConfigured(){
  const c = window.OPERATE_CONFIG;
  return !!(c && c.SUPABASE_URL && c.SUPABASE_ANON_KEY
    && !c.SUPABASE_URL.includes('YOUR-PROJECT')
    && !c.SUPABASE_ANON_KEY.includes('YOUR-ANON'));
}

function isAuthRequired(){
  return isSupabaseConfigured() && OPERATE_CONFIG.REQUIRE_AUTH === true;
}

function isSyncEnabled(){
  return isSupabaseConfigured() && OPERATE_CONFIG.SYNC_ENABLED === true;
}

function getFixedOrgId(){
  const id = OPERATE_CONFIG && OPERATE_CONFIG.OPERATE_ORG_ID;
  if(!id || typeof id !== 'string' || id.includes('YOUR-ORG')) return null;
  return id;
}

let _supa = null;
function getSupabase(){
  if(!isSupabaseConfigured()) return null;
  if(!_supa && window.supabase){
    _supa = window.supabase.createClient(
      OPERATE_CONFIG.SUPABASE_URL,
      OPERATE_CONFIG.SUPABASE_ANON_KEY
    );
  }
  return _supa;
}

async function getAccessToken(){
  const sb = getSupabase();
  if(!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}

async function getAuthUser(){
  const sb = getSupabase();
  if(!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user || null;
}
