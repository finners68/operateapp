import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import App, { prepareAppBoot } from '../app/App.jsx';
import {
  setSheetState, setToastState, setLockState, setAuthState, setViewerState, sheetState,
} from '../shell/chromeState.js';
import { notifyStore, call } from '../api/operate.js';
import * as navApi from '../app/nav.js';

function paint(root, node){
  flushSync(() => { root.render(node); });
}

let appRoot = null;
let appMounted = false;
let toastTimer = null;
let sheetKey = 0;

export function mountApp(el){
  prepareAppBoot();
  const host = el || document.getElementById('react-app-root') || document.body;
  if(!host) return;
  if(appRoot){
    notifyStore();
    return;
  }
  /* Hidden mount host — UI is portaled into #view / #nav / chrome hosts. */
  let mountEl = document.getElementById('react-app-root');
  if(!mountEl){
    mountEl = document.createElement('div');
    mountEl.id = 'react-app-root';
    mountEl.style.display = 'contents';
    const app = document.getElementById('app');
    if(app) app.insertBefore(mountEl, app.firstChild);
    else document.body.appendChild(mountEl);
  }
  appRoot = createRoot(mountEl);
  paint(appRoot, <App />);
  appMounted = true;
  navApi.setAppMounted(true);
}

export function isAppMounted(){
  return appMounted && navApi.isAppMounted();
}

export function unmountApp(){
  if(appRoot){
    try{ appRoot.unmount(); }catch(_){}
  }
  appRoot = null;
  appMounted = false;
  navApi.setAppMounted(false);
}

/* Back-compat aliases while vanilla still calls mountShell during boot. */
export function mountShell(){
  mountApp();
}
export function isShellMounted(){
  return isAppMounted();
}
export function refreshShell(){
  notifyStore();
}

export const nav = {
  navigateTo: navApi.navigateTo,
  goTab: navApi.goTab,
  goBack: navApi.goBack,
  pathForOverlay: navApi.pathForOverlay,
  pathForTab: navApi.pathForTab,
  isAppMounted: navApi.isAppMounted,
};

export function chromeToast(msg, icon = 'check'){
  clearTimeout(toastTimer);
  setToastState({ msg: String(msg || ''), icon: icon || 'check', on: true });
  if(typeof call === 'function'){ /* haptic via toast caller */ }
  toastTimer = setTimeout(() => setToastState({ on: false }), 2100);
}

export function chromeOpenSheet(title, bodyHTML, opts = {}){
  sheetKey += 1;
  setSheetState({
    key: sheetKey,
    title: title || '',
    bodyHTML: bodyHTML || '',
    bodyKind: null,
    bodyProps: null,
    opts: opts || {},
    open: true,
    closing: false,
  });
}

export function chromeOpenSheetReact(title, bodyKind, bodyProps = {}, opts = {}){
  sheetKey += 1;
  setSheetState({
    key: sheetKey,
    title: title || '',
    bodyHTML: '',
    bodyKind: bodyKind || null,
    bodyProps: bodyProps || {},
    opts: opts || {},
    open: true,
    closing: false,
  });
}

export function chromeCloseSheet(instant, onDone){
  const finish = () => {
    setSheetState(null);
    if(typeof window !== 'undefined') window.sheetEl = null;
    if(typeof onDone === 'function') onDone();
  };
  if(!sheetState || !sheetState.open){
    finish();
    return;
  }
  if(instant){
    finish();
    return;
  }
  setSheetState(Object.assign({}, sheetState, { closing: true }));
  setTimeout(finish, 280);
}

export function chromeOpenViewer(src){
  setViewerState({ open: true, src: src || '' });
}

export function chromeCloseViewer(){
  setViewerState({ open: false, src: '' });
}

export function chromeShowLock(state){
  setLockState(Object.assign({
    open: true,
    err: false,
    pinLen: 0,
  }, state || {}));
}

export function chromeUpdateLock(partial){
  setLockState(partial || {});
}

export function chromeHideLock(){
  setLockState({ open: false, pinLen: 0, err: false, purpose: null });
}

export function chromeShowAuth(partial){
  setAuthState(Object.assign({ open: true }, partial || {}));
}

export function chromeHideAuth(){
  setAuthState({ open: false, msg: '', msgKind: '', sending: false });
}

export function chromeSetAuthMsg(msg, isErr){
  setAuthState({
    msg: msg || '',
    msgKind: msg ? (isErr ? 'err' : 'ok') : '',
  });
}
