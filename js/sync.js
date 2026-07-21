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
  if(getAllowedUserId() && (!authUser || !isAllowedUser(authUser))) return false;
  return true;
}

function syncStatusLabel(){
  if(!isSupabaseConfigured()) return 'Local only';
  if(isDevHardwireMode() && !currentOrgId) return 'Dev · connecting…';
  if(isDevHardwireMode() && syncStatus === 'synced') return 'Dev · synced' + (syncLastSync ? ' · ' + timeAgo(syncLastSync) : '');
  if(isDevHardwireMode() && currentOrgId) return 'Dev · connected';
  if(!currentOrgId) return (isAuthRequired() || isSyncEnabled()) ? 'Sign in to sync' : 'Local only';
  if(syncStatus === 'synced') return 'Synced' + (syncLastSync ? ' · ' + timeAgo(syncLastSync) : '');
  if(syncStatus === 'syncing') return 'Syncing…';
  if(syncStatus === 'offline') return 'Offline · will retry';
  if(syncStatus === 'error') return 'Sync error';
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

function queueSync(){
  if(!syncActive() || dbRemoteLoading || dbSyncInProgress) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if(currentOrgId) pushToSupabase(currentOrgId);
  }, 800);
}

function stopRealtime(){
  if(realtimeChannel){
    const sb = getSupabase();
    if(sb) sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function scheduleRemoteReload(){
  if(dbRemoteLoading || dbSyncInProgress || sheetEl) return;
  if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if(!currentOrgId || sheetEl || dbSyncInProgress) return;
    if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
    const before = storeSnapshot();
    dbRemoteLoading = true;
    try{
      await loadFromSupabase(currentOrgId);
      if(!sheetEl && storeSnapshot() !== before) render();
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

  const tables = [
    'shows', 'logistics_items', 'show_flights', 'show_flight_passes',
    'show_files', 'show_checklist_items', 'show_timeline_steps',
    'ideas', 'notes', 'trips', 'org_settings'
  ];

  realtimeChannel = sb.channel('operate:' + orgId);
  tables.forEach(table => {
    realtimeChannel.on('postgres_changes', {
      event: '*', schema: 'public', table,
      filter: `org_id=eq.${orgId}`
    }, () => scheduleRemoteReload());
  });
  realtimeChannel.subscribe();
  bindFocusReload();
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
