import { useSyncExternalStore, useEffect, useRef, useState } from 'react';
import { subscribeStore, call, g, getStore } from '../show/bridge.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

export default function SearchPage(){
  useStoreTick();
  const [q, setQ] = useState(() => String(g('searchQ') || ''));
  const inputRef = useRef(null);

  useEffect(() => {
    const el = inputRef.current;
    if(el){
      el.focus();
      try{ el.setSelectionRange(el.value.length, el.value.length); }catch(_){}
    }
  }, []);

  const query = q.trim().toLowerCase();
  const sel = g('sel');
  let ev = [], tr = [], id = [], nt = [];
  if(query){
    ev = (sel?.events ? sel.events() : []).filter(e =>
      `${e.venue || ''} ${e.city || ''} ${e.country || ''} ${e.promoter?.name || ''}`.toLowerCase().includes(query)
    );
    tr = (call('runs') || []).filter(r =>
      String(r.title || '').toLowerCase().includes(query) || (r.cities || []).join(' ').toLowerCase().includes(query)
    );
    id = (sel?.ideas ? sel.ideas() : []).filter(i => String(i.title || '').toLowerCase().includes(query));
    nt = (sel?.notes ? sel.notes() : []).filter(n =>
      `${n.title || ''} ${n.body || ''} ${n.folder || ''}`.toLowerCase().includes(query)
    );
  }
  const total = ev.length + tr.length + id.length + nt.length;

  const onChange = (v) => {
    setQ(v);
    if(typeof window !== 'undefined') window.searchQ = v;
  };

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar" style={{ paddingRight: 14 }}>
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} />
          </button>
          <div className="searchbar" style={{ flex: 1, margin: 0 }}>
            <span className="ic"><Icon name="search" size={18} /></span>
            <input
              id="search-input"
              ref={inputRef}
              placeholder="Search shows, trips, ideas, notes"
              value={q}
              onChange={e => onChange(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="screen-pad">
        {!query ? (
          <div className="empty">
            <div className="ic"><Icon name="search" size={26} /></div>
            <b>Search everything</b>
            <span>Find any show, trip, idea or note instantly.</span>
          </div>
        ) : total === 0 ? (
          <div className="empty">
            <div className="ic"><Icon name="search" size={26} /></div>
            <b>No matches for &quot;{q}&quot;</b>
          </div>
        ) : (
          <>
            {ev.length ? (
              <div className="section" style={{ marginTop: 6 }}>
                <div className="section-head">
                  <div className="section-title" style={{ fontSize: 16 }}>Shows</div>
                  <span className="section-link">{ev.length}</span>
                </div>
                <div className="card flush" dangerouslySetInnerHTML={{ __html: ev.map(e => call('eventRow', e) || '').join('') }} />
              </div>
            ) : null}
            {tr.length ? (
              <div className="section">
                <div className="section-head">
                  <div className="section-title" style={{ fontSize: 16 }}>Tours</div>
                  <span className="section-link">{tr.length}</span>
                </div>
                <div className="card flush" dangerouslySetInnerHTML={{ __html: tr.map(r => call('runRow', r) || '').join('') }} />
              </div>
            ) : null}
            {id.length ? (
              <div className="section">
                <div className="section-head">
                  <div className="section-title" style={{ fontSize: 16 }}>Ideas</div>
                  <span className="section-link">{id.length}</span>
                </div>
                <div className="idea-grid" dangerouslySetInnerHTML={{ __html: id.map(i => call('ideaCard', i) || '').join('') }} />
              </div>
            ) : null}
            {nt.length ? (
              <div className="section">
                <div className="section-head">
                  <div className="section-title" style={{ fontSize: 16 }}>Notes</div>
                  <span className="section-link">{nt.length}</span>
                </div>
                <div className="card flush" dangerouslySetInnerHTML={{ __html: nt.map(n => call('noteRowFull', n) || '').join('') }} />
              </div>
            ) : null}
          </>
        )}
        <div className="spacer" />
      </div>
    </>
  );
}
