import { useSyncExternalStore, useEffect, useRef, useState, useMemo } from 'react';
import { call, getSearchQ, subscribeStore, getStore, getCats, iconHtml } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

const DEBOUNCE_MS = 150;

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function useDebounced(value: any, ms: any){
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function SearchResultRow({ hit }: Record<string, any>){
  const CATS = getCats() || {};
  const typeLabel = call('searchTypeLabel', hit.type) || 'Record';
  const iconName = call('searchTypeIcon', hit.type) || 'clip';
  const col = hit.color ? (CATS[hit.color] || CATS.purple || '#6d5efc') : null;
  const icStyle = col
    ? { background: `${col}22`, color: col }
    : { background: 'var(--card-2)', color: 'var(--text)' };

  return (
    <div
      className="row search-hit-row"
      role="button"
      tabIndex={0}
      onClick={() => call('searchOpenResult', hit)}
      onKeyDown={(e: any) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); call('searchOpenResult', hit); } }}
    >
      <div className="ic" style={icStyle}>
        <span dangerouslySetInnerHTML={{ __html: iconHtml(iconName, 17) }} />
      </div>
      <div className="body">
        <b>{hit.title}</b>
        <span>
          <span className="tag" style={{ marginRight: 6, fontSize: 10, padding: '2px 7px', verticalAlign: 'middle' }}>
            {typeLabel}
          </span>
          {hit.subtitle}
        </span>
      </div>
      <div className="trail"><Icon name="chevR" size={15} /></div>
    </div>
  );
}

export default function SearchPage(){
  const storeTick = useStoreTick();
  const [q, setQ] = useState(() => String(getSearchQ() || ''));
  const [category, setCategory] = useState('all');
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);
  const inputRef = useRef<any>(null);
  const chips = (typeof window !== 'undefined' && window.SEARCH_FILTER_CHIPS) || [
    { id: 'all', label: 'All' },
    { id: 'show', label: 'Shows' },
    { id: 'tour', label: 'Tours' },
    { id: 'flight', label: 'Flights' },
    { id: 'venue', label: 'Venues' },
    { id: 'hotel', label: 'Hotels' },
    { id: 'ground', label: 'Transport' },
    { id: 'contact', label: 'Contacts' }
  ];

  useEffect(() => {
    const el = inputRef.current;
    if(el){
      el.focus();
      try{ el.setSelectionRange(el.value.length, el.value.length); }catch(_){}
    }
  }, []);

  const pack = useMemo(
    () => call('globalSearchWithIndex', debouncedQ, { category }) || { results: [], total: 0 },
    [debouncedQ, category, storeTick]
  );

  const tokens = call('searchTokens', debouncedQ) || [];
  const hasQ = tokens.length > 0;
  const results = pack.results || [];
  const total = pack.total || results.length;

  const onChange = (v: any) => {
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
              placeholder="Search shows, tours, flights, venues…"
              value={q}
              onChange={(e: any) => onChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
      <div className="screen-pad">
        <div className="chips shows-filter-chips" style={{ marginBottom: 12 }}>
          {chips.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${category === c.id ? 'on' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {!hasQ ? (
          <div className="empty">
            <div className="ic"><Icon name="search" size={26} /></div>
            <b>Search your tour</b>
            <span>Find shows, tours, flights, venues, hotels, transport and contacts. Notes and long descriptions are not searched.</span>
          </div>
        ) : total === 0 ? (
          <div className="empty">
            <div className="ic"><Icon name="search" size={26} /></div>
            <b>No matches for &quot;{debouncedQ.trim()}&quot;</b>
            <span>Try a venue, city, flight number or booking reference.</span>
          </div>
        ) : (
          <div className="card flush">
            {results.map((h: any) => <SearchResultRow key={h.recordKey || h.id} hit={h} />)}
          </div>
        )}
        <div className="spacer" />
      </div>
    </>
  );
}
