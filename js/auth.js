/* Magic-link auth gate — app runs local-only until signed in (when Supabase configured) */
let authUser = null;
let authBootDone = false;

function authRequired(){
  return isAuthRequired() && !authUser;
}

function showAuthSheet(){
  const el = document.getElementById('authSheet');
  if(el) el.classList.add('on');
  document.getElementById('app')?.classList.add('auth-locked');
}

function hideAuthSheet(){
  document.getElementById('authSheet')?.classList.remove('on');
  document.getElementById('app')?.classList.remove('auth-locked');
}

function setAuthMsg(msg, isErr){
  const m = document.getElementById('auth-msg');
  if(!m) return;
  m.textContent = msg || '';
  m.className = 'auth-msg' + (isErr ? ' err' : msg ? ' ok' : '');
}

async function sendMagicLink(){
  const email = (document.getElementById('auth-email')?.value || '').trim();
  if(!email){ setAuthMsg('Enter your email', true); return; }
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

async function onSignedIn(user){
  authUser = user;
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
    console.error('bootstrap', e);
    if(e.message === 'not_linked_to_dev_org') toast('Not linked to dev org — run seed SQL','x');
    else toast('Could not load cloud data', 'x');
    bootApp();
  }
}

function bootApp(){
  if(typeof boot === 'function') boot();
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

function sheetAccount(){
  if(!isSupabaseConfigured()){
    openSheet('Account', `<div class="hint" style="text-align:left;padding:2px 2px 16px;line-height:1.5">Cloud sync is not configured. Copy <code>js/config.example.js</code> to <code>js/config.js</code> and add your Supabase credentials.</div><div class="spacer"></div>`);
    return;
  }
  if(!isAuthRequired() && !authUser){
    if(isSyncEnabled()){
      openSheet('Account & sync', `
        <div class="hint" style="text-align:left;padding:2px 2px 14px;line-height:1.5">Sign in once to sync with the dev org. The app stays usable without signing in.</div>
        <div class="field"><label>Email</label><input id="auth-email" type="email" class="input" placeholder="you@example.com" autocomplete="email"></div>
        <p id="auth-msg" class="auth-msg"></p>
        <button class="btn" id="auth-send" onclick="sendMagicLink()">Send magic link</button>
        <div class="spacer"></div>
      `);
      return;
    }
    openSheet('Account', `<div class="hint" style="text-align:left;padding:2px 2px 16px;line-height:1.5">Cloud sync is not enabled yet. Your tour data stays on this device.</div><div class="spacer"></div>`);
    return;
  }
  const email = authUser?.email || 'Not signed in';
  openSheet('Account & sync', `
    <div class="card" style="padding:15px;margin-bottom:6px;text-align:center">
      <div style="font-size:11.5px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.08em">Signed in as</div>
      <div style="font-size:16px;font-weight:700;margin-top:4px">${esc(email)}</div>
      <div style="font-size:13px;color:var(--text-2);margin-top:4px" id="sync-status">${syncStatusLabel()}</div>
    </div>
    <div class="hint" style="text-align:left;padding:8px 2px 14px;line-height:1.5">Your tour data syncs across devices when signed in with the same org. Crew members are read-only.</div>
    <button class="btn secondary" onclick="syncPullNow()">${ICON.reminder(16)} Refresh now</button>
    <button class="btn danger" style="margin-top:10px" onclick="signOut()">${ICON.x(16)} Sign out</button>
    <div class="spacer"></div>
  `);
}
