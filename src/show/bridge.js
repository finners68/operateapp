/* Bridge React ↔ the existing global store / helpers (vanilla Operate). */

export function g(name){
  return typeof window !== 'undefined' ? window[name] : undefined;
}

export function getStore(){
  return g('store');
}

export function getEvent(id){
  const sel = g('sel');
  return sel && sel.event ? sel.event(id) : null;
}

export function subscribeStore(listener){
  if(typeof window === 'undefined') return () => {};
  if(!window.__operateStoreListeners) window.__operateStoreListeners = new Set();
  window.__operateStoreListeners.add(listener);
  return () => window.__operateStoreListeners.delete(listener);
}

/* Bump a counter so React sees a new snapshot even when show objects are mutated in place. */
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
  const fn = g(name);
  if(typeof fn === 'function') return fn(...args);
}

export function iconHtml(name, size = 16){
  const ICON = g('ICON');
  return ICON && typeof ICON[name] === 'function' ? ICON[name](size) : '';
}
