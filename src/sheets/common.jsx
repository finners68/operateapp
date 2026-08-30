import { useEffect } from 'react';
import { call } from '../show/bridge.js';

function callbacks(){
  if(typeof window === 'undefined') return {};
  window.__sheetCallbacks = window.__sheetCallbacks || {};
  return window.__sheetCallbacks;
}

export function ConfirmSheetBody({ msg = '', confirmLabel = 'Confirm', danger = false, onConfirmId, onConfirmKey }){
  const key = onConfirmKey || onConfirmId;
  const confirm = () => {
    const fn = key && callbacks()[key];
    call('closeSheet');
    if(typeof fn === 'function') fn();
  };
  return (
    <>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.5, margin: '2px 2px 18px' }}>{msg}</p>
      <button type="button" className={`btn${danger ? ' danger' : ''}`} id="confirm-yes" onClick={confirm}>{confirmLabel}</button>
      <div className="spacer" />
      <button type="button" className="btn secondary" onClick={() => call('closeSheet')}>Cancel</button>
    </>
  );
}

export function PromptSheetBody({ placeholder = '', initial = '', saveKey }){
  useEffect(() => {
    const timer = setTimeout(() => document.getElementById('prompt-in')?.focus(), 320);
    return () => clearTimeout(timer);
  }, []);

  const save = () => {
    const value = (document.getElementById('prompt-in')?.value || '').trim();
    if(!value){ call('toast', 'Type something', 'x'); return; }
    const fn = saveKey && callbacks()[saveKey];
    call('closeSheet', true, { noReturn: true });
    if(typeof fn === 'function') fn(value);
    const stack = typeof window !== 'undefined' ? window.sheetReturnStack : null;
    const ret = stack && stack.pop ? stack.pop() : null;
    if(ret) call('reopenSheetReturn', ret);
  };

  return (
    <>
      <div className="field"><input id="prompt-in" className="input" placeholder={placeholder} defaultValue={initial} /></div>
      <button type="button" className="btn" onClick={save}>Add</button>
    </>
  );
}
