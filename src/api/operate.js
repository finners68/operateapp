/* Single window bridge for React. UI code imports from here — not window/g(). */

import {
  navigateTo, goTab, goBack, pathForOverlay, pathForTab, isAppMounted,
} from '../app/nav.js';

function w(name){
  return typeof window !== 'undefined' ? window[name] : undefined;
}

export function getStore(){
  return w('store');
}

export function getEvent(id){
  const sel = getSel();
  return sel && sel.event ? sel.event(id) : null;
}

export function subscribeStore(listener){
  if(typeof window === 'undefined') return () => {};
  if(!window.__operateStoreListeners) window.__operateStoreListeners = new Set();
  window.__operateStoreListeners.add(listener);
  return () => window.__operateStoreListeners.delete(listener);
}

export function notifyStore(){
  if(typeof window === 'undefined') return;
  const store = window.store;
  if(store) store._seq = (store._seq || 0) + 1;
  const set = window.__operateStoreListeners;
  if(!set || !set.size) return;
  set.forEach(fn => {
    try{ fn(); }catch(e){ console.error('store listener', e); }
  });
}

if(typeof window !== 'undefined'){
  window.notifyStore = notifyStore;
}

export function call(name, ...args){
  const fn = w(name);
  if(typeof fn === 'function') return fn(...args);
}

export function iconHtml(name, size = 16){
  const ICON = getIcon();
  return ICON && typeof ICON[name] === 'function' ? ICON[name](size) : '';
}

export function getSel(){ return w('sel'); }
export function getCats(){ return w('CATS') || {}; }
export function getTabs(){ return w('TABS') || []; }
export function getIcon(){ return w('ICON'); }
export function getIdeaTypes(){ return w('IDEA_TYPES') || {}; }
export function getPrio(){ return w('PRIO') || {}; }
export function getRoles(){ return w('ROLES') || {}; }
export function getMonths(){ return w('MONTHS') || []; }
export function getMon(){ return w('MON') || []; }
export function getDow(){ return w('DOW') || []; }
export function getCursym(){ return w('CURSYM') || {}; }
export function getMoney(){ return w('money'); }
export function getAccountTypes(){ return w('ACCOUNT_TYPES') || {}; }
export function getDriverJourneys(){ return w('DRIVER_JOURNEYS') || []; }
export function getPassFileAccept(){ return w('PASS_FILE_ACCEPT') || 'image/*,application/pdf'; }
export function getOverlay(){ return w('overlay'); }
export function getContentMode(){ return w('contentMode'); }
export function getSearchQ(){ return w('searchQ') || ''; }
export function getContactFilter(){ return w('contactFilter') || 'all'; }
export function getAuthUser(){ return w('authUser'); }
export function getItineraryFullUploadByShow(){ return w('itineraryFullUploadByShow') || {}; }
export function getSelectedIdeaId(){ return w('selectedIdeaId'); }
export function getDaySheetText(){ return w('__daysheet') || ''; }

export function esc(s){
  const fn = w('esc');
  if(typeof fn === 'function') return fn(s);
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function showTitle(e, fallback){
  const fn = w('showTitle');
  if(typeof fn === 'function') return fn(e, fallback);
  if(!e) return fallback || 'Untitled show';
  const eventName = String(e.eventName || '').trim();
  const venue = String(e.venue || '').trim();
  if(eventName && venue) return `${eventName} - ${venue}`;
  return eventName || venue || fallback || 'Untitled show';
}
export function fmtDate(...a){ const fn = w('fmtDate'); return typeof fn === 'function' ? fn(...a) : (a[0] || ''); }
export function fmtDateLong(...a){ const fn = w('fmtDateLong'); return typeof fn === 'function' ? fn(...a) : (a[0] || ''); }
export function fmtMoney(...a){ const fn = w('fmtMoney'); return typeof fn === 'function' ? fn(...a) : String(a[0] ?? ''); }
export function fmtBase(...a){ const fn = w('fmtBase'); return typeof fn === 'function' ? fn(...a) : String(a[0] ?? ''); }
export function toBase(...a){ const fn = w('toBase'); return typeof fn === 'function' ? fn(...a) : (a[0] || 0); }
export function relDay(...a){ const fn = w('relDay'); return typeof fn === 'function' ? fn(...a) : ''; }
export function parseDT(...a){ const fn = w('parseDT'); return typeof fn === 'function' ? fn(...a) : null; }
export function timeAgo(...a){ const fn = w('timeAgo'); return typeof fn === 'function' ? fn(...a) : ''; }
export function pad(...a){ const fn = w('pad'); return typeof fn === 'function' ? fn(...a) : String(a[0] ?? '').padStart(2, '0'); }
export function countdown(...a){ const fn = w('countdown'); return typeof fn === 'function' ? fn(...a) : null; }
export function showPassed(...a){ const fn = w('showPassed'); return typeof fn === 'function' ? fn(...a) : false; }
export function itemSort(...a){ const fn = w('itemSort'); return typeof fn === 'function' ? fn(...a) : 0; }
export function legSort(...a){ const fn = w('legSort'); return typeof fn === 'function' ? fn(...a) : 0; }
export function sortJourneysChrono(...a){ const fn = w('sortJourneysChrono'); return typeof fn === 'function' ? fn(...a) : (Array.isArray(a[0]) ? a[0].slice() : []); }
export function journeyWhenMs(...a){ const fn = w('journeyWhenMs'); return typeof fn === 'function' ? fn(...a) : Number.POSITIVE_INFINITY; }
export function isOpen(...a){ const fn = w('isOpen'); return typeof fn === 'function' ? fn(...a) : !!a[1]; }
export function flightHasDetails(...a){ const fn = w('flightHasDetails'); return typeof fn === 'function' ? fn(...a) : false; }
export function activeNavTab(){ const fn = w('activeNavTab'); return typeof fn === 'function' ? fn() : (getStore()?.tab || 'home'); }
export function enhanceDateTimeFields(...a){ const fn = w('enhanceDateTimeFields'); return typeof fn === 'function' ? fn(...a) : undefined; }
export function getContentTabState(){ const fn = w('getContentTabState'); return typeof fn === 'function' ? fn() : { mode: 'ideas' }; }
export function getCalendarState(){ const fn = w('getCalendarState'); return typeof fn === 'function' ? fn() : {}; }
export function getShowsListState(){ const fn = w('getShowsListState'); return typeof fn === 'function' ? fn() : {}; }
export function tickCountdowns(...a){ const fn = w('tickCountdowns'); return typeof fn === 'function' ? fn(...a) : undefined; }
export function persist(...a){ const fn = w('persist'); return typeof fn === 'function' ? fn(...a) : undefined; }

/** Snapshots for useSyncExternalStore — avoid re-rendering Shows list on unrelated notifyStore() churn. */
export function getShowsListRenderSnapshot(){
  if(typeof window === 'undefined') return '';
  try{
    const sel = getSel();
    const events = sel && sel.events ? sel.events() : [];
    const sorted = events.slice().sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const st = getShowsListState() || {};
    const runsFn = w('runs');
    const runs = typeof runsFn === 'function' ? runsFn() : [];
    return JSON.stringify({
      mode: st.mode || 'shows',
      filter: st.filter || 'upcoming',
      search: st.search || '',
      rows: sorted.map(e => ({
        i: e.id,
        d: e.date,
        t: e.setTime,
        e: e.endTime,
        s: e.status,
        v: e.venue,
        n: e.eventName,
        c: e.city,
        y: e.country,
        col: e.color,
        tr: e.tripId,
      })),
      tours: (runs || []).map(r => ({
        k: r.key,
        ti: r.title,
        a: r.start,
        b: r.end,
        n: (r.shows || []).length,
      })),
    });
  }catch(err){
    return 'err';
  }
}

/** Show detail screen — re-render when this show or trip-mode anchor changes, not on every global tick. */
export function getShowDetailSnapshot(showId){
  if(typeof window === 'undefined') return '';
  const id = String(showId || '');
  const e = getEvent(id);
  const st = getStore();
  const active = st && st.activeShowId;
  if(!e){
    return JSON.stringify({ id, missing: true, active: active || null });
  }
  return JSON.stringify({ id, active: active || null, e });
}

export const nav = {
  navigateTo,
  goTab,
  goBack,
  pathForOverlay,
  pathForTab,
  isAppMounted,
};

export {
  navigateTo, goTab, goBack, pathForOverlay, pathForTab, isAppMounted,
};
