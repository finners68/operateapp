import { useSyncExternalStore } from 'react';
import { call, getContactFilter, getRoles, getStore, pad, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function ContactRow({ c }){
  const ROLES = getRoles() || {};
  const col = ROLES[c.role] || ROLES.Other || 'var(--accent-2)';
  const initial = ((c.name || '?').trim()[0] || '?').toUpperCase();
  return (
    <div className="row" onClick={() => call('contactCard', c.id)}>
      <div className="ic" style={{ background: `${col}22`, color: col, fontWeight: 800, fontSize: 15 }}>{initial}</div>
      <div className="body">
        <b>{c.name}</b>
        <span>{c.role}{c.company ? ` · ${c.company}` : ''}</span>
      </div>
      <div className="trail">
        {c.phone ? (
          <button type="button" className="header-btn" style={{ width: 34, height: 34 }} onClick={e => { e.stopPropagation(); call('callNumber', c.phone); }}>
            <Icon name="phone" size={15} />
          </button>
        ) : null}
        {(c.whatsapp || c.phone) ? (
          <button type="button" className="header-btn" style={{ width: 34, height: 34 }} onClick={e => { e.stopPropagation(); call('whatsapp', c.whatsapp || c.phone); }}>
            <Icon name="chat" size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ContactsPage(){
  useStoreTick();
  const store = getStore();
  const filter = (getContactFilter()) || 'all';
  const all = (store?.contacts || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const roles = [...new Set(all.map(c => c.role).filter(Boolean))];
  const list = filter === 'all' ? all : all.filter(c => c.role === filter);
  const backLabel = call('overlayBackLabel') || 'Back';

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> {backLabel}
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Contacts</div>
          <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('sheetContact')}>
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>
      <div className="screen-pad">
        <div className="chips">
          <button type="button" className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => call('setContactFilter', 'all')}>
            All {all.length}
          </button>
          {roles.map(r => (
            <button key={r} type="button" className={`chip ${filter === r ? 'on' : ''}`} onClick={() => call('setContactFilter', r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="section" style={{ marginTop: 14 }}>
          {list.length ? (
            <div className="card flush">{list.map(c => <ContactRow key={c.id} c={c} />)}</div>
          ) : (
            <div className="empty">
              <div className="ic"><Icon name="users" size={26} /></div>
              <b>No contacts</b>
              <span>Save promoters, drivers and agents once — reuse them on every show.</span>
            </div>
          )}
        </div>
        <div className="section">
          <button type="button" className="btn" onClick={() => call('sheetContact')}>
            <Icon name="plus" size={17} /> Add contact
          </button>
        </div>
        <div className="spacer" />
      </div>
    </>
  );
}
