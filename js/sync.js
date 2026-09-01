/* Debounced push + Realtime pull */
let syncTimer = null;
let reloadTimer = null;
let localRebuildTimer = null;
let fullReconcileTimer = null;
let realtimeChannel = null;
let syncStatus = 'off';
let syncLastSync = 0;
let lastRemotePullAt = 0;
let focusListenersBound = false;
/* Skip focus cloud pulls when we already synced recently — realtime covers live edits. */
const FOCUS_PULL_MIN_MS = 45000;

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
  const orgLabel = (typeof getHardcodedOrgName === 'function' && currentOrgId)
    ? getHardcodedOrgName(currentOrgId)
    : ((store && store.organisationName) || '');
  if(isDevHardwireMode() && !currentOrgId) return 'Connecting…';
  if(isDevHardwireMode() && syncStatus === 'synced'){
    return (orgLabel || 'Synced') + (syncLastSync ? ' · ' + timeAgo(syncLastSync) : '');
  }
  if(isDevHardwireMode() && currentOrgId) return (orgLabel || 'Connected');
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
function uiBusyForQuietSync(){
  return !!(
    (typeof sheetEl !== 'undefined' && sheetEl) ||
    (typeof dtPickerEl !== 'undefined' && dtPickerEl) ||
    editingInline()
  );
}
function captureQuietUi(){
  const screen = document.getElementById('screen');
  return {
    scrollY: screen ? screen.scrollTop : 0,
    tab: store && store.tab,
    overlay: (typeof overlay !== 'undefined' && overlay)
      ? { type: overlay.type, id: overlay.id }
      : null
  };
}
/* Update on-screen data without resetting tab/detail/scroll when avoidable. */
function renderAfterQuietSync(ui){
  if(typeof applySavedNavToStore === 'function') applySavedNavToStore();
  /* Overlay is module state (survives store replace). Re-assert if cleared mid-flight. */
  if(ui && ui.overlay && typeof overlay !== 'undefined' && !overlay){
    overlay = { type: ui.overlay.type, id: ui.overlay.id };
  }
  if(typeof renderView === 'function'){
    renderView({ quiet: true, scrollY: ui ? ui.scrollY : undefined });
  } else if(typeof renderNav === 'function'){
    renderNav();
  }
}
function hasPendingDirtySync(){
  if(typeof isEmptyDirty === 'function') return !isEmptyDirty(store && store._dirty);
  return !!syncDirty;
}

function retryLocalRealtimeSoon(){
  clearTimeout(localRebuildTimer);
  localRebuildTimer = setTimeout(() => scheduleLocalRealtimeRefresh(), 700);
}

/* Full network pull — used on focus (throttled) and when a local rebuild is unsafe. */
function scheduleRemoteReload(opts){
  opts = opts || {};
  if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
  if(opts.reason === 'focus'){
    const sincePull = Date.now() - (lastRemotePullAt || 0);
    const sinceSync = Date.now() - (syncLastSync || 0);
    if(sincePull < FOCUS_PULL_MIN_MS && sinceSync < FOCUS_PULL_MIN_MS) return;
  }
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if(!currentOrgId) return;
    if(dbRemoteLoading || dbSyncInProgress || uiBusyForQuietSync()){
      scheduleRemoteReload(opts);
      return;
    }
    if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
    if(opts.reason === 'focus'){
      const sincePull = Date.now() - (lastRemotePullAt || 0);
      const sinceSync = Date.now() - (syncLastSync || 0);
      if(sincePull < FOCUS_PULL_MIN_MS && sinceSync < FOCUS_PULL_MIN_MS) return;
    }
    const ui = captureQuietUi();
    const before = storeSnapshot();
    try{
      await loadFromSupabase(currentOrgId);
      lastRemotePullAt = Date.now();
      if(uiBusyForQuietSync()){
        if(typeof applySavedNavToStore === 'function') applySavedNavToStore();
        return;
      }
      if(storeSnapshot() !== before) renderAfterQuietSync(ui);
      else if(typeof applySavedNavToStore === 'function') applySavedNavToStore();
      syncSetStatus('synced');
      syncMarkLastSync();
    }catch(e){
      syncSetStatus('error');
    }
  }, 1400);
}

/* Realtime: patch is already applied — rebuild from memory first (no store replace,
   so the current tab/detail cannot jump). Fall back to full pull if dirty or rebuild fails.
   A slower full reconcile catches any patch drift. */
function scheduleLocalRealtimeRefresh(){
  if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
  clearTimeout(localRebuildTimer);
  localRebuildTimer = setTimeout(async () => {
    if(!currentOrgId) return;
    if(dbRemoteLoading || dbSyncInProgress || uiBusyForQuietSync()){
      /* Wait and retry locally — do not escalate every collision into a cloud pull. */
      retryLocalRealtimeSoon();
      return;
    }
    if(Date.now() - lastPushAt < PUSH_ECHO_MS) return;
    if(hasPendingDirtySync() || !store?.v2 || typeof rebuildViewFromLocalV2 !== 'function'){
      scheduleRemoteReload();
      return;
    }
    const ui = captureQuietUi();
    const before = storeSnapshot();
    dbRemoteLoading = true;
    try{
      await rebuildViewFromLocalV2();
      if(typeof db !== 'undefined' && typeof db.write === 'function') db.write(store);
      if(uiBusyForQuietSync()) return;
      if(storeSnapshot() !== before) renderAfterQuietSync(ui);
      syncSetStatus('synced');
      syncMarkLastSync();
      scheduleFullReconcile();
    }catch(e){
      scheduleRemoteReload();
    }finally{
      dbRemoteLoading = false;
      /* A save during rebuild is still dirty — push once the quiet path is done. */
      if(hasPendingDirtySync() && typeof scheduleSyncRetry === 'function') scheduleSyncRetry(200);
    }
  }, 450);
}

function scheduleFullReconcile(){
  clearTimeout(fullReconcileTimer);
  fullReconcileTimer = setTimeout(() => {
    if(!syncActive() || !currentOrgId) return;
    /* Skip if a cloud pull already landed recently. */
    if(Date.now() - (lastRemotePullAt || 0) < 30000) return;
    scheduleRemoteReload();
  }, 60000);
}

function bindFocusReload(){
  if(focusListenersBound) return;
  focusListenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && syncActive()) scheduleRemoteReload({ reason: 'focus' });
  });
  window.addEventListener('focus', () => {
    if(syncActive()) scheduleRemoteReload({ reason: 'focus' });
  });
}

function startRealtime(orgId){
  stopRealtime();
  const sb = getSupabase();
  if(!sb || !orgId) return;

  /* V2 entity tables — patch locally, then quiet-rebuild (throttled full pull on focus). */
  const tables = [
    'shows', 'journeys', 'schedule_items', 'checklist_items', 'tours',
    'organisation_settings', 'files', 'travel_tickets', 'show_files',
    'hotel_bookings', 'ideas', 'notes', 'contacts', 'venues', 'hotels',
    'show_advances', 'show_contacts', 'hotel_booking_shows', 'pending_show_imports'
  ];

  realtimeChannel = sb.channel('operate:' + orgId);
  tables.forEach(table => {
    realtimeChannel.on('postgres_changes', {
      event: '*', schema: 'public', table,
      filter: `organisation_id=eq.${orgId}`
    }, (payload) => {
      try{
        if(table === 'pending_show_imports'){
          const row = payload.new || payload.old;
          if(row && row.show_id && typeof onPendingShowImportRealtime === 'function'){
            onPendingShowImportRealtime(row);
          }
        } else {
          const row = payload.new || payload.old;
          if(payload.eventType === 'DELETE' && row?.id) v2RepoRemoveLocal(table, row.id);
          else if(row?.id) v2RepoPatchLocal(table, row);
        }
      }catch(e){}
      scheduleLocalRealtimeRefresh();
    });
  });
  realtimeChannel.subscribe();
  bindFocusReload();
  bindSyncRetry();
  if(typeof resumeItineraryUploadWatchers === 'function'){
    setTimeout(()=>{ try{ resumeItineraryUploadWatchers(); }catch(_){} }, 800);
  }
}

async function syncPullNow(opts){
  opts = opts || {};
  if(!currentOrgId){
    if(!opts.quiet) toast('Nothing to refresh — pick an organisation first', 'x');
    return false;
  }
  if(typeof syncActive === 'function' && !syncActive()){
    if(!opts.quiet) toast('Cloud sync isn’t available right now', 'x');
    return false;
  }
  const ui = captureQuietUi();
  syncSetStatus('syncing');
  await loadFromSupabase(currentOrgId);
  lastRemotePullAt = Date.now();
  if(typeof applySavedNavToStore === 'function') applySavedNavToStore();
  renderAfterQuietSync(ui);
  syncSetStatus('synced');
  syncMarkLastSync();
  if(!opts.quiet) toast('Updated from cloud', 'check');
  return true;
}

let syncRefreshInFlight = false;
/* Manual refresh: save any pending edits, then pull the latest cloud data. */
async function refreshFromCloud(opts){
  opts = opts || {};
  if(syncRefreshInFlight) return false;
  if(!currentOrgId || (typeof syncActive === 'function' && !syncActive())){
    if(!opts.quiet) toast('Cloud sync isn’t available right now', 'x');
    return false;
  }
  syncRefreshInFlight = true;
  document.documentElement.classList.add('is-refreshing');
  const btn = document.getElementById('desktop-refresh');
  if(btn) btn.classList.add('spinning');
  document.querySelectorAll('.nav-refresh').forEach(el => el.classList.add('spinning'));
  syncSetStatus('syncing');
  try{
    if(typeof flushDirtyNow === 'function'){
      try{ await flushDirtyNow(); }catch(e){ console.warn('refresh push', e); }
    }
    await syncPullNow({ quiet: !!opts.quiet });
    if(typeof haptic === 'function') haptic();
    return true;
  }catch(e){
    console.error('refreshFromCloud', e);
    syncSetStatus('error');
    if(!opts.quiet) toast('Refresh failed — try again', 'x');
    return false;
  }finally{
    syncRefreshInFlight = false;
    document.documentElement.classList.remove('is-refreshing');
    if(btn) btn.classList.remove('spinning');
    document.querySelectorAll('.nav-refresh').forEach(el => el.classList.remove('spinning'));
  }
}
window.refreshFromCloud = refreshFromCloud;
window.syncPullNow = syncPullNow;

function syncTeardown(){
  stopRealtime();
  currentOrgId = null;
  clearTimeout(syncTimer);
  clearTimeout(reloadTimer);
  clearTimeout(localRebuildTimer);
  clearTimeout(fullReconcileTimer);
  syncSetStatus('off');
}
