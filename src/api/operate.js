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

/* Cached snapshots for useSyncExternalStore.
   Recompute only when the store version (or the shows filter) changes, and
   return the previous string when the visible data did not change.
   Never stringify whole shows — photos and boarding passes can be huge or
   circular, and that was crashing the screen when you opened one. */
let showsListSnap = { key: '', value: '' };
const showDetailSnaps = new Map();

function storeSeq(){
  const st = getStore();
  return st && st._seq ? st._seq : 0;
}

function trimHeavy(key, value){
  if(key === 'data' && typeof value === 'string' && value.length > 80){
    return value.slice(0, 24) + ':' + value.length;
  }
  return value;
}

function safeJson(value){
  const seen = new WeakSet();
  try{
    return JSON.stringify(value, (key, v) => {
      const trimmed = trimHeavy(key, v);
      if(trimmed && typeof trimmed === 'object'){
        if(seen.has(trimmed)) return null;
        seen.add(trimmed);
      }
      return trimmed;
    });
  }catch(_){
    return '';
  }
}

export function getShowsListRenderSnapshot(){
  if(typeof window === 'undefined') return '';
  const st = getShowsListState() || {};
  const key = [storeSeq(), st.mode || 'shows', st.filter || 'upcoming', st.search || ''].join('\0');
  if(showsListSnap.key === key) return showsListSnap.value;
  let value = '';
  try{
    const sel = getSel();
    const events = sel && sel.events ? sel.events() : [];
    const sorted = events.slice().sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const runsFn = w('runs');
    const runs = typeof runsFn === 'function' ? runsFn() : [];
    value = safeJson({
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
    }) || 'empty';
  }catch(_){
    value = 'err';
  }
  if(value === showsListSnap.value){
    showsListSnap = { key, value: showsListSnap.value };
    return showsListSnap.value;
  }
  showsListSnap = { key, value };
  return value;
}

export function getShowDetailSnapshot(showId){
  /* Do not walk or copy the show here. Photos, passes and odd field types
     were blowing up the page the moment a show opened from Home. */
  if(typeof window === 'undefined') return '';
  const id = String(showId || '');
  const seq = storeSeq();
  const active = (getStore() && getStore().activeShowId) || '';
  const hit = showDetailSnaps.get(id);
  if(hit && hit.seq === seq && hit.active === active) return hit.value;
  const value = id + '\0' + seq + '\0' + active;
  showDetailSnaps.set(id, { seq, active, value });
  return value;
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
