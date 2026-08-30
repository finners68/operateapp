/* Deprecated: import from '../api/operate.js' instead. */
export {
  getStore,
  getEvent,
  subscribeStore,
  notifyStore,
  call,
  iconHtml,
} from '../api/operate.js';

/** @deprecated Use named helpers from api/operate.js */
export function g(name){
  return typeof window !== 'undefined' ? window[name] : undefined;
}
