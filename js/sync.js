/* Debounced push + Realtime pull */
let syncTimer = null;
let reloadTimer = null;
let realtimeChannel = null;
let syncStatus = 'off';
let syncLastSync = 0;

function syncActive(){ return isSupabaseConfigured() && !!currentOrgId; }

function syncStatusLabel(){
  if(!isSupabaseConfigured()) return 'Local only';
  if(!currentOrgId) return 'Sign in to sync';
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
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if(!currentOrgId || sheetEl) return;
    dbRemoteLoading = true;
    try{
      await loadFromSupabase(currentOrgId);
      if(!sheetEl) render();
      syncSetStatus('synced');
      syncMarkLastSync();
    }catch(e){
      syncSetStatus('error');
    }finally{
      dbRemoteLoading = false;
    }
  }, 1200);
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

  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && syncActive()) scheduleRemoteReload();
  });
  window.addEventListener('focus', () => { if(syncActive()) scheduleRemoteReload(); });
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
