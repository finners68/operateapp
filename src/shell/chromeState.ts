/* Shared chrome bus — sheets, toast, lock, auth.
   Separate from store notify so typing/toasts don't remount page islands. */

export interface SheetState {
  title: string;
  bodyHTML: string;
  bodyKind: string | null;
  bodyProps: Record<string, any> | null;
  opts: Record<string, any>;
  open: boolean;
  closing: boolean;
  key: number;
}

export interface ToastState {
  msg: string;
  icon: string;
  on: boolean;
}

export interface LockState {
  open: boolean;
  purpose: string | null;
  pinLen: number;
  title: string;
  sub: string;
  bio: boolean;
  err: boolean;
}

export type AuthMsgKind = '' | 'err' | 'ok';

export interface AuthState {
  open: boolean;
  msg: string;
  msgKind: AuthMsgKind;
  sending: boolean;
  email: string;
  emailReadOnly: boolean;
}

export interface ViewerState {
  open: boolean;
  src: string;
}

type ChromeListener = () => void;

let seq = 0;
const listeners = new Set<ChromeListener>();

export function subscribeChrome(fn: ChromeListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getChromeSeq(): number {
  return seq;
}

export function notifyChrome(): void {
  seq += 1;
  listeners.forEach((fn: any) => {
    try {
      fn();
    } catch (e) {
      console.error('chrome listener', e);
    }
  });
}

export let sheetState: SheetState | null = null;

export function setSheetState(next: SheetState | null): void {
  sheetState = next;
  notifyChrome();
}

export let toastState: ToastState = { msg: '', icon: 'check', on: false };

export function setToastState(next: Partial<ToastState>): void {
  toastState = Object.assign({}, toastState, next);
  notifyChrome();
}

export let lockState: LockState = {
  open: false,
  purpose: null,
  pinLen: 0,
  title: '',
  sub: '',
  bio: false,
  err: false,
};

export function setLockState(next: Partial<LockState>): void {
  lockState = Object.assign({}, lockState, next);
  notifyChrome();
}

export let authState: AuthState = {
  open: false,
  msg: '',
  msgKind: '',
  sending: false,
  email: '',
  emailReadOnly: false,
};

export function setAuthState(next: Partial<AuthState>): void {
  authState = Object.assign({}, authState, next);
  notifyChrome();
}

export let viewerState: ViewerState = { open: false, src: '' };

export function setViewerState(next: Partial<ViewerState>): void {
  viewerState = Object.assign({}, viewerState, next);
  notifyChrome();
}
