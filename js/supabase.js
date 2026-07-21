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

function getAllowedUserId(){
  const id = OPERATE_CONFIG && OPERATE_CONFIG.OPERATE_ALLOWED_USER_ID;
  if(!id || typeof id !== 'string' || id.includes('YOUR-USER')) return null;
  return id;
}

function getAllowedEmail(){
  const e = OPERATE_CONFIG && OPERATE_CONFIG.OPERATE_ALLOWED_EMAIL;
  if(!e || typeof e !== 'string' || e.includes('@example')) return null;
  return e.trim().toLowerCase();
}

function isSingleAccountMode(){
  return !!(getFixedOrgId() && getAllowedUserId());
}

function isDevHardwireMode(){
  return isSupabaseConfigured()
    && OPERATE_CONFIG.OPERATE_DEV_MODE === true
    && !!getFixedOrgId()
    && isSyncEnabled();
}

function isAllowedUser(user){
  if(!user) return false;
  const allowedId = getAllowedUserId();
  if(allowedId && user.id !== allowedId) return false;
  const allowedEmail = getAllowedEmail();
  if(allowedEmail && (user.email || '').trim().toLowerCase() !== allowedEmail) return false;
  return true;
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
