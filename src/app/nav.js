/* Hash-route navigation shared by React and vanilla openView/go/back wrappers. */

const TAB_PATH = {
  home: '/',
  calendar: '/calendar',
  shows: '/shows',
  trips: '/trips',
  ideas: '/ideas',
  notes: '/ideas',
};

const OVERLAY_PATH = {
  event: (id) => `/shows/${encodeURIComponent(id || '')}`,
  trip: (id) => `/trips/${encodeURIComponent(id || '')}`,
  idea: (id) => `/ideas/${encodeURIComponent(id || '')}`,
  note: (id) => `/notes/${encodeURIComponent(id || '')}`,
  noteFolder: (id) => `/notes/folder/${encodeURIComponent(id || '')}`,
  settings: () => '/settings',
  search: () => '/search',
  finance: () => '/finance',
  invoices: () => '/invoices',
  invoice: (id) => `/invoices/${encodeURIComponent(id || '')}`,
  contacts: () => '/contacts',
  pastshows: () => '/past-shows',
  stats: () => '/stats',
  itinerary: () => '/itinerary',
  wrapped: () => '/wrapped',
};

let navigateFn = null;
let appMounted = false;

export function setNavigate(fn){
  navigateFn = typeof fn === 'function' ? fn : null;
}

export function setAppMounted(v){
  appMounted = !!v;
}

export function isAppMounted(){
  return appMounted;
}

export function pathForTab(tab){
  return TAB_PATH[tab] || '/';
}

export function pathForOverlay(type, id){
  const build = OVERLAY_PATH[type];
  if(!build) return '/';
  return build(id);
}

export function locationToLegacy(pathname){
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

function applyLegacy(tab, overlay){
  const w = typeof window !== 'undefined' ? window : null;
  if(!w) return;
  if(w.store && tab) w.store.tab = tab;
  w.overlay = overlay || null;
}

function doNavigate(to, opts = {}){
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

export function goTab(tab, opts = {}){
  const t = tab === 'notes' ? 'ideas' : tab;
  applyLegacy(t, null);
  if(t === 'ideas' && typeof window !== 'undefined' && typeof window.ideasStale !== 'undefined'){
    window.ideasStale = false;
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

export function navigateTo(type, id, opts = {}){
  const w = typeof window !== 'undefined' ? window : null;
  if(type === 'finance' && w && typeof w.financeLockActive === 'function' && w.financeLockActive()){
    if(typeof w.requireUnlock === 'function'){
      w.requireUnlock('finance', () => navigateTo('finance', id, opts));
    }
    return;
  }
  if(type === 'event' && id && w && typeof w.resetShowFolds === 'function') w.resetShowFolds(id);

  const path = pathForOverlay(type, id);
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

export function hashPathFromLegacy(tab, overlay){
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
