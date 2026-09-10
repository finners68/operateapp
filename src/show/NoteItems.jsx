import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { call } from '../api/operate.js';
import { Icon } from './ui.jsx';

function parseItems(value){
  const parsed = call('parseNoteItems', value);
  return Array.isArray(parsed) ? parsed : [];
}

function nextId(){
  return `note-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function blankItem(){
  return { id: nextId(), text: '' };
}

function withDraft(value){
  const items = parseItems(value);
  return items.length ? items : [blankItem()];
}

/** Editable list of notes. Used on the show page and in sheets. */
export const NoteItemsEditor = forwardRef(function NoteItemsEditor({
  listId,
  value,
  placeholder = 'Add a note…',
  onCommit,
  addLabel = 'Add note',
}, ref){
  const [items, setItems] = useState(() => withDraft(value));

  useEffect(() => {
    setItems(prev => {
      const incoming = parseItems(value);
      const drafts = prev.filter(p => !String(p.text || '').trim() && !incoming.some(i => i.id === p.id));
      if(incoming.length) return drafts.length ? incoming.concat(drafts) : incoming;
      return drafts.length ? drafts : [blankItem()];
    });
  }, [value]);

  const commit = (next) => {
    if(typeof onCommit === 'function') onCommit(next.filter(x => String(x.text || '').trim()));
  };

  const add = () => {
    setItems(cur => [...cur, blankItem()]);
  };

  useImperativeHandle(ref, () => ({ add }), []);

  return (
    <div className="note-items" data-note-list={listId || undefined}>
      {items.map((item) => (
        <div className="note-item" data-note-id={item.id} key={item.id}>
          <textarea
            className="textarea note-item-text"
            placeholder={placeholder}
            value={item.text}
            onChange={e => {
              const text = e.target.value;
              setItems(cur => cur.map(x => x.id === item.id ? { ...x, text } : x));
            }}
            onBlur={e => {
              const text = e.target.value;
              setItems(cur => {
                const next = cur.map(x => x.id === item.id ? { ...x, text } : x);
                commit(next);
                return next;
              });
            }}
          />
          {items.length > 1 || String(item.text || '').trim() ? (
            <button
              type="button"
              className="note-item-del"
              aria-label="Remove note"
              onClick={() => {
                const next = items.filter(x => x.id !== item.id);
                const saved = next.length ? next : [blankItem()];
                setItems(saved);
                commit(next);
              }}
            >
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" className="btn secondary note-items-add" onClick={add}>
        <Icon name="plus" size={15} /> {addLabel}
      </button>
    </div>
  );
});

export function NoteItemsField({ label, listId, value, placeholder }){
  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      <NoteItemsEditor listId={listId} value={value} placeholder={placeholder} />
    </div>
  );
}

export function NoteItemsRead({ label, value, icon = 'note' }){
  const items = parseItems(value);
  if(!items.length) return null;
  return (
    <div className="info-line" style={{ alignItems: 'flex-start' }}>
      <div className="ic"><Icon name={icon} size={17} /></div>
      <div className="tx">
        <div className="k">{label}</div>
        {items.map(item => (
          <div className="v note-item-read" key={item.id}>{item.text}</div>
        ))}
      </div>
    </div>
  );
}
