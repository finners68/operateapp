/* Supabase client singleton — V2 schema (never query *_v1 tables) */
const STORAGE_BUCKET = 'operate-documents-v2';

const V2_TABLES = {
  organisations: 'organisations',
  members: 'organisation_members',
  invites: 'organisation_invites',
  settings: 'organisation_settings',
  billing: 'organisation_billing_profiles',
  fx: 'organisation_exchange_rates',
  userPrefs: 'user_preferences',
  tours: 'tours',
  shows: 'shows',
  venues: 'venues',
  artists: 'artists',
  journeys: 'journeys',
  hotels: 'hotels',
  hotelBookings: 'hotel_bookings',
  schedule: 'schedule_items',
  checklist: 'checklist_items',
  contacts: 'contacts',
  files: 'files',
  showFiles: 'show_files',
  travelTickets: 'travel_tickets',
  ideas: 'ideas',
  noteFolders: 'note_folders',
  notes: 'notes'
};

const V2_RPC = {
  createOrg: 'create_organisation_v2',
  acceptInvite: 'accept_organisation_invite_v2'
};

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

/* Temporary: two hardcoded workspaces, no login. */
function getHardcodedOrgs(){
  const fromConfig = OPERATE_CONFIG && OPERATE_CONFIG.OPERATE_ORGS;
  if(Array.isArray(fromConfig) && fromConfig.length){
    return fromConfig
      .map(o => ({ id: String(o.id || '').trim(), name: String(o.name || '').trim() }))
      .filter(o => o.id && o.name && !o.id.includes('YOUR-ORG'));
  }
  return [
    { id: '1ba17032-5bb2-4310-afa7-3a6fc5e94df4', name: 'JAKE' },
    { id: 'e8fc13af-4b2d-4eed-a5ef-92fd703b03e5', name: 'FIN' }
  ];
}

function getHardcodedOrgName(orgId){
  const hit = getHardcodedOrgs().find(o => o.id === orgId);
  return hit ? hit.name : '';
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

/* No-login dual-org mode: sync on, auth not required, JAKE/FIN hardcoded. */
function isDevHardwireMode(){
  return isSupabaseConfigured()
    && isSyncEnabled()
    && !isAuthRequired()
    && getHardcodedOrgs().length > 0;
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
