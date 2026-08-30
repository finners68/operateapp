/* Magic-link auth gate — app runs local-only until signed in (when Supabase configured) */
let authUser = null;
Object.defineProperty(window, 'authUser', {
  get(){ return authUser; },
  set(v){ authUser = v; },
  configurable: true
});
let authBootDone = false;

function authRequired(){
  return isAuthRequired() && !authUser;
}

function showAuthSheet(){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.mountShell === 'function'){
    OperateReact.mountShell();
  }
  const allowed = typeof getAllowedEmail === 'function' ? getAllowedEmail() : '';
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeShowAuth === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeShowAuth({
      email: allowed || '',
      emailReadOnly: !!allowed,
      msg: '',
      msgKind: '',
    });
    return;
  }
  prefillAuthEmail();
  const el = document.getElementById('authSheet');
  if(el) el.classList.add('on');
  document.getElementById('app')?.classList.add('auth-locked');
}

function hideAuthSheet(){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeHideAuth === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeHideAuth();
    return;
  }
  document.getElementById('authSheet')?.classList.remove('on');
  document.getElementById('app')?.classList.remove('auth-locked');
}

function setAuthMsg(msg, isErr){
  if(typeof OperateReact !== 'undefined' && OperateReact && typeof OperateReact.chromeSetAuthMsg === 'function'
      && typeof OperateReact.isShellMounted === 'function' && OperateReact.isShellMounted()){
    OperateReact.chromeSetAuthMsg(msg, !!isErr);
    return;
  }
  const m = document.getElementById('auth-msg');
  if(!m) return;
  m.textContent = msg || '';
  m.className = 'auth-msg' + (isErr ? ' err' : msg ? ' ok' : '');
}

function wrongUserMessage(){
  const email = getAllowedEmail();
  return email ? `Only ${email} can sync this app.` : 'This account cannot sync this app.';
}

function prefillAuthEmail(){
  const el = document.getElementById('auth-email');
  const allowed = getAllowedEmail();
  if(!el || !allowed) return;
  el.value = allowed;
  el.readOnly = true;
}

async function rejectWrongUser(user){
  if(isAllowedUser(user)) return false;
  const sb = getSupabase();
  syncTeardown();
  authUser = null;
  if(sb) await sb.auth.signOut();
  const msg = wrongUserMessage();
  setAuthMsg(msg, true);
  toast(msg, 'x');
  return true;
}

async function sendMagicLink(){
  const email = (document.getElementById('auth-email')?.value || '').trim();
  if(!email){ setAuthMsg('Enter your email', true); return; }
  const allowed = getAllowedEmail();
  if(allowed && email.toLowerCase() !== allowed){
    setAuthMsg(wrongUserMessage(), true);
    return;
  }
  const sb = getSupabase();
  if(!sb){ setAuthMsg('Supabase not configured', true); return; }
  const btn = document.getElementById('auth-send');
  if(btn){ btn.disabled = true; btn.textContent = 'Sending…'; }
  setAuthMsg('');
  try{
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if(error) throw error;
    setAuthMsg('Check your email for the sign-in link.', false);
    toast('Magic link sent', 'check');
  }catch(e){
    setAuthMsg(e.message || 'Could not send link', true);
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Send magic link'; }
  }
}

async function devHardwireBoot(){
  hideAuthSheet();
  try{
    await bootstrapRemoteData();
    startRealtime(currentOrgId);
    syncSetStatus('synced');
    syncMarkLastSync();
    if(!store){
      const saved = db.read();
      if(saved && saved.events){ store = saved; if(store.tab == null) store.tab = 'home'; migrate(); }
      else seed();
    }
    bootApp();
  }catch(e){
    console.error('dev bootstrap', e);
    toast('Could not connect to dev cloud', 'x');
    bootApp();
  }
}

async function onSignedIn(user){
  if(await rejectWrongUser(user)){
    bootApp();
    if(isAuthRequired()) showAuthSheet();
    return;
  }
  authUser = user;
  hideAuthSheet();
  try{
    // Accept an invite link (?invite=token) before loading data so the joined
    // org is picked up. Never let this break sign-in.
    try{
      const inviteToken = new URLSearchParams(location.search).get('invite');
      if(inviteToken){ await acceptInvite(inviteToken); history.replaceState({}, '', location.pathname); }
    }catch(e){}
    await bootstrapRemoteData();
    startRealtime(currentOrgId);
    syncSetStatus('synced');
    syncMarkLastSync();
    if(!store){
      const saved = db.read();
      if(saved && saved.events){ store = saved; if(store.tab == null) store.tab = 'home'; migrate(); }
      else seed();
    }
    bootApp();
  }catch(e){
    console.error('bootstrap', e);
    if(e.message === 'not_linked_to_dev_org') toast('Not linked to dev org — run seed SQL','x');
    else if(e.message === 'wrong_user') toast(wrongUserMessage(), 'x');
    else toast('Could not load cloud data', 'x');
    bootApp();
  }
}

function bootApp(){
  if(typeof boot === 'function') boot();
}

/* ---- Crew invites (migration 003) ---- */
async function acceptInvite(token){
  const sb = getSupabase();
  if(!sb || !token) return null;
  const { data, error } = await sb.rpc(V2_RPC.acceptInvite, { p_invite_token: token });
  if(error){
    const msg = error.message || '';
    toast(msg.includes('different email') ? 'That invite is for a different email' : 'Invite invalid or already used', 'x');
    return null;
  }
  setStoredOrgId(data);
  toast('Joined the tour', 'check');
  return data;
}
async function createInvite(email, role){
  const sb = getSupabase();
  if(!sb || !currentOrgId){ toast('Sign in first', 'x'); return null; }
  const { data, error } = await sb.from(V2_TABLES.invites)
    .insert({
      organisation_id: currentOrgId,
      email_address: (email||'').trim().toLowerCase(),
      invited_role: role === 'manager' ? 'manager' : 'crew',
      created_by_user_id: authUser?.id
    })
    .select('invite_token').single();
  if(error){ toast('Could not create invite (owner/manager only)', 'x'); return null; }
  return location.origin + location.pathname + '?invite=' + data.invite_token;
}
function sheetInviteCrew(){
  openSheetReact('Invite crew', 'auth.invite', {});
}
function confirmDeleteCloudData(){
  confirmSheet('Delete all cloud data?', 'Organisation deletion is not yet available in the V2 schema. Sign out to stop syncing, or contact support to remove cloud data.', 'OK', ()=>{}, false);
}
async function doCreateInvite(){
  const email = val('inv-email');
  if(!email){ toast('Enter an email', 'x'); return; }
  const role = getSeg('inv-role') || 'crew';
  const link = await createInvite(email, role);
  if(!link) return;
  const out = document.getElementById('inv-out');
  if(out) out.innerHTML = `<div class="hint" style="text-align:left;padding:0 2px 8px">Send this link to ${esc(email)} — they sign in with this email to join:</div>
    <div class="card" style="word-break:break-all;font-size:12.5px;color:var(--text-2);padding:12px">${esc(link)}</div>
    <button class="btn secondary" style="margin-top:10px" onclick="copyText('${jsAttr(link)}');toast('Link copied','check')">${ICON.copy(16)} Copy link</button>`;
}

async function signOut(){
  const sb = getSupabase();
  syncTeardown();
  authUser = null;
  if(sb) await sb.auth.signOut();
  try{ localStorage.removeItem(ORG_KEY); }catch(e){}
  hideAuthSheet();
  if(isAuthRequired()) showAuthSheet();
  toast('Signed out', 'check');
  if(overlay && overlay.type === 'settings') renderView();
}

async function authBoot(){
  if(authBootDone) return;
  authBootDone = true;

  if(!isSupabaseConfigured()){
    bootApp();
    return;
  }

  const sb = getSupabase();
  if(!sb){ bootApp(); return; }

  if(isDevHardwireMode()){
    await devHardwireBoot();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if(session?.user){
    await onSignedIn(session.user);
    return;
  }

  if(!isAuthRequired()){
    bootApp();
    if(isSyncEnabled()){
      sb.auth.onAuthStateChange(async (event, session) => {
        if(event === 'SIGNED_IN' && session?.user){
          await onSignedIn(session.user);
        }
        if(event === 'SIGNED_OUT'){
          authUser = null;
          syncTeardown();
          if(overlay && overlay.type === 'settings') renderView();
        }
      });
    }
    return;
  }

  showAuthSheet();

  sb.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_IN' && session?.user){
      await onSignedIn(session.user);
    }
    if(event === 'SIGNED_OUT'){
      authUser = null;
      if(isAuthRequired()) showAuthSheet();
    }
  });
}

async function listOrganisationsForUser(){
  const sb = getSupabase();
  const user = authUser || (typeof getAuthUser === 'function' ? await getAuthUser() : null);
  if(!sb || !user) return [];
  const { data, error } = await sb.from(V2_TABLES.members)
    .select('organisation_id, organisations(organisation_name)')
    .eq('user_id', user.id);
  if(error || !data) return [];
  return data.map(row => ({
    id: row.organisation_id,
    name: (row.organisations && row.organisations.organisation_name) || 'Organisation'
  })).filter(o => o.id).sort((a, b) => a.name.localeCompare(b.name));
}

async function switchOrganisation(orgId){
  const nextId = String(orgId || '').trim();
  if(!nextId) return;
  if(nextId === String(currentOrgId || '')) return;

  const orgs = await listOrganisationsForUser();
  const match = orgs.find(o => o.id === nextId);
  if(!match){
    toast('You do not have access to that organisation', 'x');
    return;
  }

  try{
    if(typeof flushDirtyNow === 'function' && typeof syncActive === 'function' && syncActive()){
      await flushDirtyNow();
    }
  }catch(e){
    console.warn('flush before org switch', e);
  }

  if(typeof syncTeardown === 'function') syncTeardown();
  setStoredOrgId(nextId);

  try{
    toast('Switching organisation…');
    await loadFromSupabase(nextId);
    const name = await fetchOrganisationName(nextId);
    if(store && name) store.organisationName = name;
    if(typeof startRealtime === 'function') startRealtime(nextId);
    if(typeof syncSetStatus === 'function') syncSetStatus('synced');
    if(typeof syncMarkLastSync === 'function') syncMarkLastSync();
    if(typeof renderView === 'function') renderView();
    sheetAccount();
    toast('Switched to ' + (name || match.name), 'check');
  }catch(e){
    console.error('switchOrganisation', e);
    toast('Could not switch organisation', 'x');
  }
}

function sheetAccount(){
  if(!isSupabaseConfigured()){
    openSheetReact('Account', 'auth.account', { mode: 'unconfigured', message: 'Cloud sync is not configured. Copy js/config.example.js to js/config.js and add your Supabase credentials.' });
    return;
  }
  if(isDevHardwireMode()){
    openSheetReact('Account & sync', 'auth.account', { mode: 'dev', statusLabel: syncStatusLabel() });
    return;
  }
  if(!isAuthRequired() && !authUser){
    if(isSyncEnabled()){
      const emailVal = getAllowedEmail() || '';
      openSheetReact('Account & sync', 'auth.account', {
        mode: 'signin',
        allowedEmail: emailVal,
        singleAccount: isSingleAccountMode(),
        message: isSingleAccountMode()
          ? `This app syncs to one account only${emailVal ? ` (${emailVal})` : ''}. Sign in to load and save tour data.`
          : 'Sign in with your email, then pick JAKE or FIN from the organisation list.'
      });
      return;
    }
    openSheetReact('Account', 'auth.account', { mode: 'disabled' });
    return;
  }
  const email = authUser?.email || 'Not signed in';
  const orgId = currentOrgId || (store && store.organisationId) || null;
  const cachedName = (store && store.organisationName) || '';
  const openSignedIn = (orgName, orgs) => {
    openSheetReact('Account & sync', 'auth.account', {
      mode: 'signedIn',
      email,
      orgName: orgName || '',
      orgId: orgId || '',
      orgs: orgs || [],
      statusLabel: syncStatusLabel(),
      singleAccount: isSingleAccountMode()
    });
  };
  openSignedIn(cachedName, []);
  Promise.all([
    cachedName || !orgId ? Promise.resolve(cachedName) : fetchOrganisationName(orgId),
    listOrganisationsForUser()
  ]).then(([name, orgs]) => {
    if(name && store) store.organisationName = name;
    openSignedIn(name || cachedName, orgs);
  }).catch(()=>{});
}
