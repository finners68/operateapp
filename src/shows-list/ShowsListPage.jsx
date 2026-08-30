import { useSyncExternalStore, useRef, useEffect, useState } from 'react';
import { call, fmtDate, getCats, getMon, getMonths, getSel, getShowsListState, getStore, iconHtml, notifyStore, pad, parseDT, relDay, showPassed, showTitle, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function listState(){
  const fn = getShowsListState;
  if(typeof fn === 'function') return fn();
  return { mode: 'shows', filter: 'upcoming', search: '' };
}

function PageIntro({ id, title, body }){
  const html = call('pageIntro', id, title, body);
  if(!html) return null;
  /* pageIntro returns HTML with a dismiss button — keep behavior via Legacy. */
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function ShowRow({ show }){
  const CATS = getCats() || {};
  const col = CATS[show.color] || CATS.purple || '#6d5efc';
  const MON = getMon() || [];
  const d = parseDT ? parseDT(show.date) : null;
  const meta = [show.city, show.country].filter(Boolean).join(', ');
  const timeBit = show.setTime ? `${show.setTime}${show.endTime ? ` – ${show.endTime}` : ''}` : '—';
  const detail = [meta, timeBit].filter(Boolean).join(' · ');
  const statusTag = show.status && show.status !== 'confirmed' ? (
    <span className={`tag ${show.status}`} style={{ marginLeft: 6, verticalAlign: 'middle', fontSize: 10, padding: '2px 7px' }}>{show.status}</span>
  ) : null;

  return (
    <div className="row show-row" onClick={() => call('openView', 'event', show.id)}>
      {d ? (
        <div className="ic show-date-ic" style={{ background: `${col}22`, color: col }} aria-label={fmtDate ? fmtDate(show.date) : show.date}>
          <span className="show-date-day">{d.getDate()}</span>
          <span className="show-date-mon">{MON[d.getMonth()] || ''}</span>
        </div>
      ) : (
        <div className="ic show-date-ic" style={{ background: `${col}22`, color: col }}>—</div>
      )}
      <div className="body">
        <b>{showTitle(show)}{statusTag}</b>
        <span>{detail}</span>
      </div>
      <button
        type="button"
        className="header-btn show-row-edit"
        title="Edit show"
        onClick={e => { e.stopPropagation(); call('eventMenu', show.id); }}
      >
        <Icon name="edit" size={16} />
      </button>
      <div className="trail">
        <span style={{ fontSize: 12, fontWeight: 600 }}>{relDay ? relDay(show.date) : show.date}</span>
        <Icon name="chevR" size={15} />
      </div>
    </div>
  );
}

function filteredShows(filter, search){
  const sel = getSel();
  const all = sel?.events ? sel.events() : [];
  const q = String(search || '').toLowerCase().trim();
  let list = all.slice();
  if(filter === 'upcoming') list = all.filter(e => !(showPassed && showPassed(e)) && e.status !== 'cancelled');
  else if(filter === 'past') list = all.filter(e => showPassed && showPassed(e));
  else if(filter === 'confirmed' || filter === 'hold' || filter === 'cancelled') list = all.filter(e => e.status === filter);
  if(filter === 'past') list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if(q) list = list.filter(e => `${e.eventName || ''} ${e.venue || ''} ${e.city || ''} ${e.country || ''} ${e.date || ''}`.toLowerCase().includes(q));
  return { all, list };
}

function groupByMonth(list){
  const MONTHS = getMonths() || [];
  const out = [];
  let cur = null;
  list.forEach(e => {
    const d = parseDT ? parseDT(e.date) : null;
    const key = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'No date';
    if(key !== cur){ cur = key; out.push({ label: key, items: [] }); }
    out[out.length - 1].items.push(e);
  });
  return out;
}

function ShowsBody({ filter, search }){
  const { list } = filteredShows(filter, search);
  const q = String(search || '').trim();
  if(!list.length){
    return (
      <div className="empty">
        <div className="ic"><Icon name="music" size={28} /></div>
        <b>{q ? 'No matches' : 'No shows here'}</b>
        <span>
          {q
            ? 'Try another search term.'
            : filter === 'past'
              ? 'Past shows appear 24h after they finish.'
              : 'Tap + to add a venue, date and set time — then open the show for flights and hotels.'}
        </span>
        {!q ? (
          <button type="button" className="btn" style={{ marginTop: 14, maxWidth: 240 }} onClick={() => call('sheetEvent')}>
            <Icon name="plus" size={18} /> Add show
          </button>
        ) : null}
      </div>
    );
  }
  const groups = groupByMonth(list);
  return groups.map(grp => (
    <div key={grp.label}>
      <div className="shows-month">{grp.label} · {grp.items.length}</div>
      <div className="card flush" style={{ marginBottom: 12 }}>
        {grp.items.map(e => <ShowRow key={e.id} show={e} />)}
      </div>
    </div>
  ));
}

function RunCard({ run }){
  const CATS = getCats() || {};
  const c = CATS[run.color] || CATS.green || '#32d74b';
  const active = call('activeRun')?.key === run.key;
  return (
    <div
      className="card tap"
      style={{ marginBottom: 14, borderColor: active ? `${c}66` : 'var(--stroke)' }}
      onClick={() => call('openView', 'trip', run.key)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="ic" style={{ width: 44, height: 44, borderRadius: 13, background: `${c}22`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="trips" size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 17, fontWeight: 700 }}>{run.title}</b>
            {active ? <span className="tag confirmed">Live</span> : null}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
            {fmtDate ? fmtDate(run.start) : run.start}
            {run.end !== run.start ? ` – ${fmtDate ? fmtDate(run.end) : run.end}` : ''}
          </div>
        </div>
        <Icon name="chevR" size={18} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>
        <span>{run.shows.length} show{run.shows.length !== 1 ? 's' : ''}</span>
        <span>{relDay ? relDay(run.start) : run.start}</span>
      </div>
    </div>
  );
}

function RunRow({ run }){
  const CATS = getCats() || {};
  const c = CATS[run.color] || CATS.green || '#32d74b';
  return (
    <div className="row" onClick={() => call('openView', 'trip', run.key)}>
      <div className="ic" style={{ background: `${c}22`, color: c }}><Icon name="trips" size={18} /></div>
      <div className="body">
        <b>{run.title}</b>
        <span>{run.shows.length} show{run.shows.length !== 1 ? 's' : ''} · {fmtDate ? fmtDate(run.start) : run.start}</span>
      </div>
      <Icon name="chevR" size={15} />
    </div>
  );
}

function ToursBody(){
  const all = call('runs') || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = all.filter(r => {
    const end = parseDT ? parseDT(r.end) : null;
    return end && end >= today;
  });
  const past = all.filter(r => {
    const end = parseDT ? parseDT(r.end) : null;
    return end && end < today;
  }).reverse();

  return (
    <>
      {upcoming.length ? (
        <div>
          {upcoming.map(r => <RunCard key={r.key} run={r} />)}
        </div>
      ) : (
        <div className="empty">
          <div className="ic"><Icon name="trips" size={28} /></div>
          <b>No upcoming tours</b>
          <span>Add shows first — a tour starts when you fly out from your home airport and ends when you land back there.</span>
          <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 240 }} onClick={() => call('go', 'calendar')}>
            <Icon name="calendar" size={18} /> Go to Calendar
          </button>
        </div>
      )}
      {past.length ? (
        <div className="section">
          <div className="section-head">
            <div className="section-title" style={{ fontSize: 16, color: 'var(--text-2)' }}>Past</div>
          </div>
          <div className="card flush">
            {past.slice(0, 12).map(r => <RunRow key={r.key} run={r} />)}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SearchAndChips({ filter, search, onSearch }){
  const sel = getSel();
  const all = sel?.events ? sel.events() : [];
  const upcomingN = all.filter(e => !(showPassed && showPassed(e)) && e.status !== 'cancelled').length;
  const chips = [
    { k: 'upcoming', l: `Upcoming · ${upcomingN}` },
    { k: 'all', l: `All · ${all.length}` },
    { k: 'past', l: 'Past' },
    { k: 'confirmed', l: 'Confirmed' },
    { k: 'hold', l: 'Hold' },
    { k: 'cancelled', l: 'Cancelled' },
  ];
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => { setLocalSearch(search); }, [search]);

  return (
    <>
      <div className="searchbar">
        <span className="ic" dangerouslySetInnerHTML={{ __html: iconHtml('search', 18) }} />
        <input
          placeholder="Search venue or city"
          value={localSearch}
          onChange={e => {
            const v = e.target.value;
            setLocalSearch(v);
            onSearch(v);
          }}
        />
      </div>
      <div className="chips shows-filter-chips">
        {chips.map(c => (
          <button
            key={c.k}
            type="button"
            className={`chip ${filter === c.k ? 'on' : ''}`}
            onClick={() => call('setShowFilter', c.k)}
          >
            {c.l}
          </button>
        ))}
      </div>
    </>
  );
}

export default function ShowsListPage(){
  useStoreTick();
  const { mode, filter, search } = listState();
  const isTours = mode === 'tours';
  const sel = getSel();
  const all = sel?.events ? sel.events() : [];
  const upcomingN = all.filter(e => !(showPassed && showPassed(e)) && e.status !== 'cancelled').length;
  const tourN = (call('runs') || []).length;
  const title = isTours ? 'Tours' : 'Shows';
  const sub = `${isTours ? `${tourN} tour${tourN !== 1 ? 's' : ''}` : `${upcomingN} upcoming`} · tap to open`;

  const searchTimer = useRef(null);
  const onSearch = (v) => {
    call('setShowSearchQuiet', v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const n = notifyStore;
      if(typeof n === 'function') n();
      else if(typeof window !== 'undefined' && window.OperateReact?.refreshShowsList) window.OperateReact.refreshShowsList();
    }, 120);
  };

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  return (
    <div className="tab-page" id="shows-mode-page">
      <div className="tab-page-sticky">
        <div className="lg-header">
          <div>
            <div className="lg-title" id="shows-mode-title">{title}</div>
            <div className="lg-sub" id="shows-mode-sub">{sub}</div>
          </div>
          <div id="shows-mode-actions" className="shows-header-actions">
            <div className="seg shows-mode-seg-compact" id="shows-mode-seg">
              <button type="button" data-v="shows" className={isTours ? '' : 'on'} aria-label="Shows" onClick={() => call('setShowsMode', 'shows')}>
                <Icon name="music" size={15} />
              </button>
              <button type="button" data-v="tours" className={isTours ? 'on' : ''} aria-label="Tours" onClick={() => call('setShowsMode', 'tours')}>
                <Icon name="trips" size={15} />
              </button>
            </div>
            <button type="button" className="header-btn" onClick={() => call('sheetEvent')}>
              <Icon name="plus" size={22} />
            </button>
          </div>
        </div>
        <div id="shows-mode-sticky-tools" className="shows-sticky-tools">
          {isTours ? null : <SearchAndChips filter={filter} search={search} onSearch={onSearch} />}
        </div>
      </div>
      <div className="screen-pad tab-page-body" id="shows-mode-panel">
        <PageIntro
          id="shows"
          title="Shows & tours in one place"
          body="Every show, and the tours they auto-group into. Switch views with the toggle top-right. Tap a row to open details."
        />
        <div className="section" style={{ marginTop: 8 }}>
          {isTours ? <ToursBody /> : <ShowsBody filter={filter} search={search} />}
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}
