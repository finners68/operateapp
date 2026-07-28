/* ============================================================
   Native (Capacitor) bridge — only active inside the iOS/Android
   shell. On the web this file is a no-op, so nothing here changes
   browser behaviour.

   Its main job is magic-link sign-in. In the browser Supabase can
   redirect back to the page and finish the session automatically.
   Inside the native shell the app is served from a local scheme
   (operate://localhost / https://localhost), so the emailed link
   can't return here on its own. We instead:
     1. ask Supabase to redirect to our custom scheme
        (operate://auth-callback) — see OPERATE_NATIVE_REDIRECT,
     2. catch that URL via the App plugin's appUrlOpen event,
     3. hand the tokens/code to Supabase to complete sign-in.
   ============================================================ */
(function () {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  // Custom-scheme URL Supabase redirects back to after the user taps the
  // magic link. This exact URL must be added to your Supabase project's
  // Authentication → URL Configuration → Redirect URLs allow-list.
  const REDIRECT = 'operate://auth-callback';
  window.OPERATE_NATIVE_REDIRECT = REDIRECT;

  const Plugins = cap.Plugins || {};
  const App = Plugins.App;
  const StatusBar = Plugins.StatusBar;

  // Dark status bar text/icons to match the app's near-black chrome.
  if (StatusBar && StatusBar.setStyle) {
    StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
  }

  async function completeSignIn(url) {
    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!sb || !url) return;
    try {
      const u = new URL(url);
      const code = u.searchParams.get('code');
      if (code) {
        // PKCE flow — exchange the returned code for a session.
        await sb.auth.exchangeCodeForSession(code);
        return;
      }
      // Implicit flow — tokens arrive in the URL fragment.
      const hash = new URLSearchParams((u.hash || '').replace(/^#/, ''));
      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      if (access_token && refresh_token) {
        await sb.auth.setSession({ access_token, refresh_token });
      }
    } catch (e) {
      try { if (typeof toast === 'function') toast('Could not finish sign-in', 'x'); } catch (_) {}
    }
  }

  if (App && App.addListener) {
    App.addListener('appUrlOpen', (data) => {
      const url = data && data.url;
      if (url && url.indexOf('auth-callback') !== -1) completeSignIn(url);
    });
  }
})();
