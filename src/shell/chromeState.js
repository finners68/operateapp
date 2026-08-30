/* Shared chrome bus — sheets, toast, lock, auth.
   Separate from store notify so typing/toasts don't remount page islands. */

let seq = 0;
const listeners = new Set();

export function subscribeChrome(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getChromeSeq(){ return seq; }

export function notifyChrome(){
  seq += 1;
  listeners.forEach(fn => {
    try{ fn(); }catch(e){ console.error('chrome listener', e); }
  });
}

/* ---- Sheet ---- */
export let sheetState = null; // { title, bodyHTML, opts, open }

export function setSheetState(next){
  sheetState = next;
  notifyChrome();
}

/* ---- Toast ---- */
export let toastState = { msg: '', icon: 'check', on: false };

export function setToastState(next){
  toastState = Object.assign({}, toastState, next);
  notifyChrome();
}

/* ---- Lock ---- */
export let lockState = {
  open: false,
  purpose: null,
  pinLen: 0,
  title: '',
  sub: '',
  bio: false,
  err: false,
};

export function setLockState(next){
  lockState = Object.assign({}, lockState, next);
  notifyChrome();
}

/* ---- Auth ---- */
export let authState = {
  open: false,
  msg: '',
  msgKind: '', // '' | 'err' | 'ok'
  sending: false,
  email: '',
  emailReadOnly: false,
};

export function setAuthState(next){
  authState = Object.assign({}, authState, next);
  notifyChrome();
}

/* ---- Fullscreen image viewer ---- */
export let viewerState = { open: false, src: '' };

export function setViewerState(next){
  viewerState = Object.assign({}, viewerState, next);
  notifyChrome();
}

/* Sheet React body: bodyKind + bodyProps (bodyHTML kept for fallback). */
/* sheetState shape: { title, bodyHTML, bodyKind, bodyProps, opts, open, closing, key } */
