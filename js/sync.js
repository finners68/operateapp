/* Debounced push + Realtime pull */
let syncTimer = null;
let reloadTimer = null;
let realtimeChannel = null;
let syncStatus = 'off';
let syncLastSync = 0;
let focusListenersBound = false;

function syncActive(){
  if(!isSupabaseConfigured() || !currentOrgId) return false;
  if(isDevHardwireMode()) return true;
  if(!isSyncEnabled()) return false;
  if(getAllowedUserId() && (!authUser || !isAllowedUser(authUser))) return false;
  if(isAuthRequired() && !authUser) return false;
  return true;
}

function syncStatusLabel(){
  if(!isSupabaseConfigured()) return 'Local only';
  if(isDevHardwireMode() && !currentOrgId) return 'Dev · connecting…';
  if(isDevHardwireMode() && syncStatus === 'synced') return 'Dev · synced' + (syncLastSync ? ' · ' + timeAgo(syncLastSync) : '');
  if(isDevHardwireMode() && currentOrgId) return 'Dev · connected';
  if(!currentOrgId) return (isAuthRequired() || isSyncEnabled()) ? 'Sign in to sync' : 'Local only';
  if(syncStatus === 'syncing') return 'Syncing…';
  if(syncStatus === 'error') return (typeof syncDirty!=='undefined' && syncDirty) ? 'Not saved — will retry' : 'Sync error';
  if(typeof syncDirty !== 'undefined' && syncDirty) return 'Unsaved changes…';
  if(syncStatus === 'synced') return 'Synced' + (syncLastSync ? ' · ' + timeAgo(syncLastSync) : '');
  if(syncStatus === 'offline') return 'Offline · will retry';
  return 'Connected';
}

function syncSetStatus(s){
  syncStatus = s;
  const el = document.getElementById('sync-status');
  if(el) el.textContent = syncStatusLabel();
  const sub = document.getElementById('sync-row-sub');
  if(sub) sub.textContent = syncStatusLabel();
}

function syncMarkLastSync(){ syncLastSync = Date.now(); }

let syncDirty = false;          // local changes not yet confirmed pushed
let syncRetryTimer = null;
let syncRetryDelay = 0;
function queueSync(){
  if(!syncActive()) return;
  syncDirty = true;             // mark dirty even mid-sync so nothing is missed
  if(dbRemoteLoading || dbSyncInProgress){
    /* In-flight push should loop; also arm a retry so an edit that lands in
       the finish gap (after the loop check, before dbSyncInProgress clears)
       is never left dirty with no timer scheduled. */
    scheduleSyncRetry(600);
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if(currentOrgId) pushToSupabase(currentOrgId);
  }, 800);
}
/* Retry with backoff when a push fails (offline/flaky signal) or when a change
   arrived while a push was in flight — so local edits are never silently lost. */
function scheduleSyncRetry(delay){
  if(delay == null){ syncRetryDelay = Math.min((syncRetryDelay || 2000) * 2, 60000); }
  else { syncRetryDelay = delay; }
  clearTimeout(syncRetryTimer);
  syncRetryTimer = setTimeout(() => {
    if(!syncDirty || !syncActive() || !currentOrgId) return;
    if(dbSyncInProgress || dbRemoteLoading){
      /* Still busy — keep trying so a key-contact save during reload is not lost. */
      scheduleSyncRetry(Math.max(300, syncRetryDelay));
      return;
    }
    pushToSupabase(currentOrgId);
  }, syncRetryDelay);
}
let syncRetryBound = false;
function bindSyncRetry(){
  if(syncRetryBound) return;
  syncRetryBound = true;
  /* Reconnect / focus: flush the dirty set only — never force a full tour sync. */
  const kick = () => {
    if(!syncActive() || !currentOrgId) return;
    const hasDirty = (typeof isEmptyDirty === 'function')
      ? !isEmptyDirty(store && store._dirty)
      : !!syncDirty;
    if(!hasDirty && !syncDirty) return;
    if(typeof flushDirtyNow === 'function') flushDirtyNow();
    else scheduleSyncRetry(500);
  };
  window.addEventListener('online', kick);
  window.addEventListener('focus', kick);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) kick(); });
}

function stopRealtime(){
  if(realtimeChannel){
    const sb = getSupabase();
    if(sb) sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function editingInline(){
  const el = document.activeElement;
  return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
}
function scheduleRemoteReload(){
  if(dbRemoteLoading || dbSyncInProgress || sheetEl || editingInline()) return;
  if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if(!currentOrgId || sheetEl || dbSyncInProgress || editingInline()) { scheduleRemoteReload(); return; }
    if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
    const before = storeSnapshot();
    dbRemoteLoading = true;
    try{
      await loadFromSupabase(currentOrgId);
      if(!sheetEl && storeSnapshot() !== before){
        renderNav();
        renderView();
      }
      syncSetStatus('synced');
      syncMarkLastSync();
    }catch(e){
      syncSetStatus('error');
    }finally{
      dbRemoteLoading = false;
    }
  }, 1200);
}

function bindFocusReload(){
  if(focusListenersBound) return;
  focusListenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && syncActive()) scheduleRemoteReload();
  });
  window.addEventListener('focus', () => { if(syncActive()) scheduleRemoteReload(); });
}

function startRealtime(orgId){
  stopRealtime();
  const sb = getSupabase();
  if(!sb || !orgId) return;

  /* V2 entity tables — reload recomposes UUID-native view projections. */
  const tables = [
    'shows', 'journeys', 'schedule_items', 'checklist_items', 'tours',
    'organisation_settings', 'files', 'travel_tickets', 'show_files',
    'hotel_bookings', 'ideas', 'notes', 'contacts', 'venues', 'hotels',
    'show_advances', 'show_contacts', 'hotel_booking_shows'
  ];

  realtimeChannel = sb.channel('operate:' + orgId);
  tables.forEach(table => {
    realtimeChannel.on('postgres_changes', {
      event: '*', schema: 'public', table,
      filter: `organisation_id=eq.${orgId}`
    }, (payload) => {
      /* Prefer full reload for correctness; patch local v2 row when possible. */
      try{
        const row = payload.new || payload.old;
        if(payload.eventType === 'DELETE' && row?.id) v2RepoRemoveLocal(table, row.id);
        else if(row?.id) v2RepoPatchLocal(table, row);
      }catch(e){}
      scheduleRemoteReload();
    });
  });
  realtimeChannel.subscribe();
  bindFocusReload();
  bindSyncRetry();
}

async function syncPullNow(){
  if(!currentOrgId) return;
  await loadFromSupabase(currentOrgId);
  render();
  syncSetStatus('synced');
  syncMarkLastSync();
  toast('Updated from cloud', 'check');
}

function syncTeardown(){
  stopRealtime();
  currentOrgId = null;
  clearTimeout(syncTimer);
  clearTimeout(reloadTimer);
  syncSetStatus('off');
}
