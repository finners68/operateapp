import { useSyncExternalStore, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { activeNavTab, call, enhanceDateTimeFields, getContentMode, getOverlay, getStore, getTabs, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';
import {
  subscribeChrome, getChromeSeq,
  sheetState, toastState, lockState, authState, viewerState,
  setAuthState,
} from './chromeState.js';
import { resolveSheetBody } from '../sheets/registry.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function useChromeTick(){
  return useSyncExternalStore(subscribeChrome, getChromeSeq, () => 0);
}

function activeTab(){
  return activeNavTab();
}

export function NavBar(){
  useStoreTick();
  const tabs = getTabs() || [];
  const active = activeTab();

  return (
    <>
      <div className="nav-brand">
        <span className="nav-brand-mark">O</span>
        <span className="nav-brand-name">Operate</span>
        <button type="button" className="nav-refresh header-btn" onClick={() => call('refreshFromCloud')} title="Refresh from cloud">
          <Icon name="refresh" size={16} />
        </button>
        <button type="button" className="nav-collapse header-btn" onClick={() => call('toggleSidebar', true)} title="Hide sidebar">
          <Icon name="chevL" size={16} />
        </button>
      </div>
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          className={`nav-item ${active === t.id ? 'active' : ''}`}
          title={t.hint || ''}
          onClick={() => call('go', t.id)}
        >
          <span className="ic"><Icon name={t.icon} size={25} /></span>
          <span>{t.label}</span>
        </button>
      ))}
    </>
  );
}

function fabAction(){
  const overlay = getOverlay();
  const store = getStore();
  if(!overlay){
    const tab = store?.tab;
    if(tab === 'shows' || tab === 'calendar') return () => call('sheetEvent');
    if(tab === 'ideas'){
      const mode = getContentMode();
      return mode === 'notes'
        ? () => call('sheetNoteAddChoice')
        : () => call('sheetIdea');
    }
    return null;
  }
  if(overlay.type === 'noteFolder' && overlay.id){
    return () => call('sheetNoteAddChoice', overlay.id);
  }
  return null;
}

export function FabInner(){
  useStoreTick();
  useChromeTick();
  const action = fabAction();

  useEffect(() => {
    const fab = document.getElementById('fab');
    if(!fab) return;
    if(action){
      fab.style.display = 'flex';
      fab.onclick = (e) => { e.preventDefault(); action(); };
    } else {
      fab.style.display = 'none';
      fab.onclick = null;
      fab.removeAttribute('onclick');
    }
  });

  return <Icon name="plus" size={26} />;
}

export function ToastHost(){
  useChromeTick();
  const t = toastState;
  useEffect(() => {
    const el = document.getElementById('toast');
    if(!el) return;
    el.classList.toggle('on', !!t.on);
  }, [t.on, t.msg]);

  if(!t.msg) return null;
  return (
    <>
      <span className="tic"><Icon name={t.icon || 'check'} size={18} /></span>
      {t.msg}
    </>
  );
}

export function SheetHost(){
  useChromeTick();
  const sheet = sheetState;
  const sheetRef = useRef(null);
  const [shown, setShown] = useState(false);
  const app = typeof document !== 'undefined' ? document.getElementById('app') : null;

  useEffect(() => {
    const scrim = document.getElementById('scrim');
    const appEl = document.getElementById('app');
    if(!sheet || !sheet.open){
      if(scrim){ scrim.classList.remove('on'); scrim.onclick = null; }
      if(appEl && !sheet) appEl.classList.remove('sheet-open');
      setShown(false);
      return;
    }
    if(scrim){
      scrim.classList.add('on');
      scrim.onclick = () => call('closeSheet');
    }
    if(appEl) appEl.classList.add('sheet-open');
    if(sheet.closing){
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [sheet, sheet?.open, sheet?.key, sheet?.closing]);

  useEffect(() => {
    if(!sheet?.open || !sheetRef.current) return;
    if(typeof window !== 'undefined') window.sheetEl = sheetRef.current;
    const enhance = enhanceDateTimeFields;
    if(typeof enhance === 'function') enhance(sheetRef.current);
    const actionBtn = sheetRef.current.querySelector('#sheet-action');
    const opts = sheet.opts || {};
    if(actionBtn && typeof opts.action === 'string' && opts.action){
      actionBtn.setAttribute('onclick', opts.action);
    }
  }, [sheet?.key, sheet?.open, sheet?.bodyHTML, sheet?.bodyKind, sheet?.bodyProps, sheet?.opts]);

  if(!sheet || !sheet.open || !app) return null;

  const opts = sheet.opts || {};
  const full = !!opts.full;
  const reactBody = sheet.bodyKind ? resolveSheetBody(sheet.bodyKind, sheet.bodyProps || {}) : null;

  return createPortal(
    <div ref={sheetRef} className={`sheet${full ? ' full' : ''}${shown && !sheet.closing ? ' on' : ''}`}>
      {full ? (
        <div className="sheet-head sheet-full-head bordered">
          <button type="button" className="link-btn plain" onClick={() => call('closeSheet')}>Cancel</button>
          <div className="sheet-title">{sheet.title}</div>
          <button
            type="button"
            className="link-btn"
            id="sheet-action"
            style={opts.action ? undefined : { visibility: 'hidden' }}
          >
            {opts.actionLabel || 'Save'}
          </button>
        </div>
      ) : (
        <>
          <div className="grabber" />
          <div className="sheet-head">
            <div className="sheet-title">{sheet.title}</div>
            <button type="button" className="header-btn" style={{ width: 32, height: 32 }} onClick={() => {
              if(opts.closeHandler) call(opts.closeHandler, opts.closeArg);
              else call('closeSheet');
            }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </>
      )}
      <div className="sheet-body">
        {reactBody || (
          <div dangerouslySetInnerHTML={{ __html: sheet.bodyHTML || '' }} />
        )}
      </div>
    </div>,
    app
  );
}

export function LockHost(){
  useChromeTick();
  const L = lockState;

  useEffect(() => {
    const el = document.getElementById('lock');
    if(!el) return;
    el.classList.toggle('on', !!L.open);
  }, [L.open]);

  if(!L.open) return null;

  return (
    <>
      <div className="lock-logo">
        <svg width="42" height="42" viewBox="0 0 1024 1024" fill="none" stroke="#fff" strokeLinecap="round">
          <circle cx="512" cy="512" r="232" strokeWidth="72" />
          <path d="M 446 512 L 578 512" strokeWidth="46" />
        </svg>
      </div>
      <div className="lock-title">{L.title}</div>
      <div className="lock-sub">{L.sub}</div>
      <div className={`pin-dots${L.err ? ' err' : ''}`} id="pin-dots">
        {[0, 1, 2, 3].map(i => <i key={i} className={i < L.pinLen ? 'f' : ''} />)}
      </div>
      <div className="pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} type="button" className="key" onClick={() => call('pinKey', String(n))}>{n}</button>
        ))}
        <div className="key blank" />
        <button type="button" className="key" onClick={() => call('pinKey', '0')}>0</button>
        <button type="button" className="key act" onClick={() => call('pinDel')}>⌫</button>
      </div>
      {L.bio ? (
        <button type="button" className="lock-bio" onClick={() => call('biometricUnlock')}>
          <Icon name="face" size={18} /> Unlock with Face ID
        </button>
      ) : null}
    </>
  );
}

export function AuthHost(){
  useChromeTick();
  const A = authState;
  const [email, setEmail] = useState(A.email || '');

  useEffect(() => {
    if(A.email) setEmail(A.email);
  }, [A.email]);

  useEffect(() => {
    const el = document.getElementById('authSheet');
    const app = document.getElementById('app');
    if(el) el.classList.toggle('on', !!A.open);
    if(app) app.classList.toggle('auth-locked', !!A.open);
  }, [A.open]);

  const onSend = async () => {
    setAuthState({ sending: true, email });
    const input = document.getElementById('auth-email');
    if(input) input.value = email;
    try{
      await call('sendMagicLink');
    } finally {
      setAuthState({ sending: false });
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-logo">Operate</div>
      <p className="auth-lead">Sign in with a magic link to sync your tour across devices.</p>
      <div className="field">
        <label>Email</label>
        <input
          id="auth-email"
          type="email"
          className="input"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          readOnly={!!A.emailReadOnly}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <p id="auth-msg" className={`auth-msg${A.msgKind === 'err' ? ' err' : A.msgKind === 'ok' ? ' ok' : ''}`}>
        {A.msg || ''}
      </p>
      <button type="button" className="btn" id="auth-send" disabled={!!A.sending} onClick={onSend}>
        {A.sending ? 'Sending…' : 'Send magic link'}
      </button>
      <p className="auth-hint">Without signing in, data stays on this device only.</p>
    </div>
  );
}

export function ViewerHost(){
  useChromeTick();
  const V = viewerState;
  useEffect(() => {
    const el = document.getElementById('viewer');
    if(!el) return;
    el.classList.toggle('on', !!V.open);
  }, [V.open]);

  const host = typeof document !== 'undefined' ? document.getElementById('viewer') : null;
  if(!host || !V.open) return null;

  return createPortal(
    <>
      <button type="button" className="close" onClick={() => call('closeViewer')}>✕</button>
      <img id="viewer-img" src={V.src || ''} alt="" />
    </>,
    host
  );
}

export function ShellOverlays(){
  return (
    <>
      <SheetHost />
      <ViewerHost />
    </>
  );
}
