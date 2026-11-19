/* Hash-route navigation shared by React and vanilla openView/go/back wrappers. */

const TAB_PATH: Record<string, string> = {
  home: '/',
  calendar: '/calendar',
  shows: '/shows',
  trips: '/trips',
  ideas: '/ideas',
  notes: '/ideas',
};

const OVERLAY_PATH: Record<string, (id?: string) => string> = {
  event: (id: any) => `/shows/${encodeURIComponent(id || '')}`,
  trip: (id: any) => `/trips/${encodeURIComponent(id || '')}`,
  idea: (id: any) => `/ideas/${encodeURIComponent(id || '')}`,
  note: (id: any) => `/notes/${encodeURIComponent(id || '')}`,
  noteFolder: (id: any) => `/notes/folder/${encodeURIComponent(id || '')}`,
  settings: () => '/settings',
  search: () => '/search',
  finance: () => '/finance',
  invoices: () => '/invoices',
  invoice: (id: any) => `/invoices/${encodeURIComponent(id || '')}`,
  contacts: () => '/contacts',
  pastshows: () => '/past-shows',
  stats: () => '/stats',
  itinerary: () => '/itinerary',
  wrapped: () => '/wrapped',
};

let navigateFn: ((to: any, opts?: { replace?: boolean }) => void) | null = null;
let appMounted = false;

const DETAIL_OVERLAY_TYPES = new Set(['event', 'trip', 'idea', 'note', 'noteFolder', 'invoice']);

function currentHashPath(){
  if(typeof window === 'undefined') return '/';
  const raw = String(window.location.hash || '').replace(/^#/, '').trim();
  if(!raw || raw === '/') return '/';
  return raw.startsWith('/') ? raw : '/' + raw;
}

export function tabLabelFor(tab: any){
  const tabs = typeof window !== 'undefined' ? window.TABS : null;
  if(Array.isArray(tabs)){
    const row = tabs.find((t: any) => t.id === tab);
    if(row) return row.label;
  }
  if(tab === 'home') return 'Home';
  if(!tab) return 'Back';
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function pathScreenKind(path: any){
  const legacy = locationToLegacy(path);
  if(!legacy.overlay) return 'tab';
  if(DETAIL_OVERLAY_TYPES.has(legacy.overlay.type)) return 'detail';
  return 'panel';
}

export function getNavReturn(){
  if(typeof window === 'undefined') return null;
  return window.__navReturn || null;
}

export function setNavReturn(ctx: any){
  if(typeof window === 'undefined') return;
  window.__navReturn = ctx || null;
}

export function clearNavReturn(){
  if(typeof window === 'undefined') return;
  window.__navReturn = null;
}

function rememberReturnBeforeDrill(fromPath: any, toPath: any){
  if(typeof window === 'undefined') return;
  if(!fromPath || fromPath === toPath) return;
  const fromKind = pathScreenKind(fromPath);
  const toKind = pathScreenKind(toPath);
  if(toKind !== 'detail') return;
  if(fromKind !== 'tab' && fromKind !== 'panel' && window.__navReturn) return;
  const fromLegacy = locationToLegacy(fromPath);
  const tab = fromLegacy.tab || window.store?.tab || 'home';
  let label = tabLabelFor(tab);
  if(fromKind === 'panel' && fromLegacy.overlay){
    if(fromLegacy.overlay.type === 'pastshows') label = 'Calendar';
    else if(fromLegacy.overlay.type === 'finance') label = 'Money';
    else if(fromLegacy.overlay.type === 'invoices') label = 'Money';
    else if(fromLegacy.overlay.type === 'contacts') label = 'Home';
    else if(fromLegacy.overlay.type === 'search') label = 'Home';
    else if(fromLegacy.overlay.type === 'settings') label = 'Home';
  }
  window.__navReturn = { tab, path: fromPath, label };
}

export function setNavigate(fn: any){
  navigateFn = typeof fn === 'function' ? fn : null;
}

export function setAppMounted(v: any){
  appMounted = !!v;
}

export function isAppMounted(){
  return appMounted;
}

export function pathForTab(tab: any){
  return TAB_PATH[tab] || '/';
}

export function pathForOverlay(type: any, id: any){
  const build = OVERLAY_PATH[type];
  if(!build) return '/';
  return build(id);
}

export function locationToLegacy(pathname: any){
  const p = String(pathname || '/').replace(/\/+$/, '') || '/';
  if(p === '/') return { tab: 'home', overlay: null };
  if(p === '/calendar') return { tab: 'calendar', overlay: null };
  if(p === '/shows') return { tab: 'shows', overlay: null };
  if(p === '/trips') return { tab: 'trips', overlay: null };
  if(p === '/ideas') return { tab: 'ideas', overlay: null };

  let m;
  if((m = p.match(/^\/shows\/([^/]+)$/))) return { tab: 'shows', overlay: { type: 'event', id: decodeURIComponent(m[1]) } };
  if((m = p.match(/^\/trips\/([^/]+)$/))) return { tab: 'trips', overlay: { type: 'trip', id: decodeURIComponent(m[1]) } };
  if((m = p.match(/^\/ideas\/([^/]+)$/))) return { tab: 'ideas', overlay: { type: 'idea', id: decodeURIComponent(m[1]) } };
  if((m = p.match(/^\/notes\/folder\/([^/]+)$/))) return { tab: 'ideas', overlay: { type: 'noteFolder', id: decodeURIComponent(m[1]) } };
  if((m = p.match(/^\/notes\/([^/]+)$/))) return { tab: 'ideas', overlay: { type: 'note', id: decodeURIComponent(m[1]) } };
  if((m = p.match(/^\/invoices\/([^/]+)$/))) return { tab: 'home', overlay: { type: 'invoice', id: decodeURIComponent(m[1]) } };

  if(p === '/settings') return { tab: 'home', overlay: { type: 'settings', id: undefined } };
  if(p === '/search') return { tab: 'home', overlay: { type: 'search', id: undefined } };
  if(p === '/finance') return { tab: 'home', overlay: { type: 'finance', id: undefined } };
  if(p === '/invoices') return { tab: 'home', overlay: { type: 'invoices', id: undefined } };
  if(p === '/contacts') return { tab: 'home', overlay: { type: 'contacts', id: undefined } };
  if(p === '/past-shows') return { tab: 'calendar', overlay: { type: 'pastshows', id: undefined } };
  if(p === '/stats') return { tab: 'home', overlay: { type: 'stats', id: undefined } };
  if(p === '/itinerary') return { tab: 'home', overlay: { type: 'itinerary', id: undefined } };
  if(p === '/wrapped') return { tab: 'home', overlay: { type: 'wrapped', id: undefined } };

  return { tab: 'home', overlay: null };
}

function applyLegacy(tab: any, overlay: any){
  const w = typeof window !== 'undefined' ? window : null;
  if(!w) return;
  if(w.store && tab) w.store.tab = tab;
  w.overlay = overlay || null;
}

function doNavigate(to: any, opts: any = {}){
  if(navigateFn){
    navigateFn(to, opts);
    return;
  }
  if(typeof window === 'undefined') return;
  const path = typeof to === 'number' ? null : to;
  if(typeof to === 'number'){
    window.history.go(to);
    return;
  }
  const hash = '#' + (path.startsWith('/') ? path : '/' + path);
  if(opts.replace) window.location.replace(hash);
  else window.location.hash = hash;
}

export function goTab(tab: any, opts: any = {}){
  const t = tab === 'notes' ? 'ideas' : tab;
  clearNavReturn();
  applyLegacy(t, null);
  if(t === 'ideas' && typeof window !== 'undefined' && typeof window.ideasStale !== 'undefined'){
    window.ideasStale = false;
  }
  if(t === 'shows' && typeof window !== 'undefined' && typeof window.prepareShowsList === 'function'){
    window.prepareShowsList();
  }
  doNavigate(pathForTab(t), opts);
  if(typeof window !== 'undefined'){
    if(typeof window.persist === 'function') window.persist('user_preferences');
    if(typeof window.saveNavState === 'function') window.saveNavState();
    if(typeof window.haptic === 'function') window.haptic();
    if(typeof window.notifyStore === 'function') window.notifyStore();
    if(typeof window.setFab === 'function') window.setFab();
    if(typeof window.syncScreenChrome === 'function') window.syncScreenChrome();
  }
}

export function navigateTo(type: any, id: any, opts: any = {}){
  const w = typeof window !== 'undefined' ? window : null;
  if(type === 'finance' && w && typeof w.financeLockActive === 'function' && w.financeLockActive()){
    if(typeof w.requireUnlock === 'function'){
      w.requireUnlock('finance', () => navigateTo('finance', id, opts));
    }
    return;
  }
  if(type === 'event' && id && w && typeof w.resetShowFolds === 'function') w.resetShowFolds(id);

  const path = pathForOverlay(type, id);
  const fromPath = currentHashPath();
  if(!opts.replace) rememberReturnBeforeDrill(fromPath, path);
  const legacy = locationToLegacy(path);
  applyLegacy(legacy.tab, legacy.overlay);
  doNavigate(path, opts);
  if(w){
    if(typeof w.haptic === 'function') w.haptic();
    if(typeof w.saveNavState === 'function') w.saveNavState();
    if(typeof w.notifyStore === 'function') w.notifyStore();
    if(typeof w.setFab === 'function') w.setFab();
    if(typeof w.syncScreenChrome === 'function') w.syncScreenChrome();
  }
}

export function goBack(){
  doNavigate(-1);
  if(typeof window !== 'undefined'){
    if(typeof window.saveNavState === 'function') window.saveNavState();
    if(typeof window.notifyStore === 'function') window.notifyStore();
    if(typeof window.setFab === 'function') window.setFab();
    if(typeof window.syncScreenChrome === 'function') window.syncScreenChrome();
  }
}

export function hashPathFromLegacy(tab: any, overlay: any){
  if(overlay && overlay.type) return pathForOverlay(overlay.type, overlay.id);
  return pathForTab(tab || 'home');
}

export function bootstrapHashFromNav(){
  if(typeof window === 'undefined') return;
  const raw = window.location.hash.replace(/^#/, '');
  if(raw && raw !== '/') return;
  try{
    const ns = JSON.parse(localStorage.getItem('operate_nav') || 'null');
    if(!ns) return;
    let overlay = ns.overlay || null;
    if(overlay && overlay.type === 'finance' && typeof window.financeLockActive === 'function' && window.financeLockActive()){
      overlay = null;
    }
    const path = hashPathFromLegacy(ns.tab || 'home', overlay);
    if(path && path !== '/'){
      window.location.replace('#' + path);
    }
  }catch(_){}
}
