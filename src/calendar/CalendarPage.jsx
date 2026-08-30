import { useSyncExternalStore, useEffect, useRef } from 'react';
import { call, getCalendarState, getCats, getDow, getMonths, getSel, getStore, itemSort, parseDT, relDay, showPassed, showTitle, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function calState(){
  const fn = getCalendarState;
  if(typeof fn === 'function') return fn();
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), sel: null, gridOpen: true };
}

function PageIntro({ id, title, body }){
  const html = call('pageIntro', id, title, body);
  if(!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function pad(n){
  return String(n).padStart(2, '0');
}

function todayStr(){
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function eventsByDate(){
  const byDate = {};
  const sel = getSel();
  const list = sel?.events ? sel.events() : [];
  list.forEach(e => {
    if(!e?.date) return;
    (byDate[e.date] = byDate[e.date] || []).push(e);
  });
  return byDate;
}

function ShowBlock({ e }){
  const c = e.color === 'orange' ? 'var(--orange)' : 'var(--green)';
  const time = e.setTime ? `${e.setTime}${e.endTime ? ` – ${e.endTime}` : ''}` : 'TBA';
  return (
    <div className="ag-show" style={{ background: c }} onClick={() => call('openView', 'event', e.id)}>
      <div className="ag-show-b">
        <b>{showTitle(e, 'Show')}</b>
        <span>{time}</span>
      </div>
      <div className="ag-loc">LOC</div>
    </div>
  );
}

function MarkBlock({ e }){
  return (
    <div className="ag-mark" onClick={() => call('openItem', e.id)}>
      <div className="ag-noent"><Icon name="ban" size={20} /></div>
      <div className="ag-mark-b">
        <b>{e.title}</b>
        <span>All Day</span>
      </div>
    </div>
  );
}

function AgendaItem({ e }){
  if(e.kind === 'travel' || e.kind === 'stay'){
    /* Rare in month agenda (filtered out), keep a safe fallback. */
    const html = call('agendaItem', e);
    if(html) return <div dangerouslySetInnerHTML={{ __html: html }} />;
    return null;
  }
  if(e.kind === 'marker') return <MarkBlock e={e} />;
  return <ShowBlock e={e} />;
}

function MonthAgenda({ y, m, sel, today }){
  const store = getStore();
  const DOW = getDow() || [];
  const days = {};
  (store?.events || []).forEach(e => {
    if(e.kind === 'travel' || e.kind === 'stay') return;
    if(showPassed && showPassed(e)) return;
    const d = parseDT ? parseDT(e.date) : null;
    if(!d || d.getFullYear() !== y || d.getMonth() !== m) return;
    if(sel && e.date !== sel) return;
    (days[e.date] = days[e.date] || []).push(e);
  });
  const dates = Object.keys(days).sort();
  if(!dates.length){
    return (
      <div className="empty">
        <div className="ic"><Icon name="calendar" size={26} /></div>
        <b>Nothing {sel ? 'this day' : 'this month'}</b>
        <span>Tap + (top right) to add a show with venue, date and set time.</span>
        <button type="button" className="btn" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('sheetEvent')}>
          <Icon name="plus" size={18} /> Add show
        </button>
      </div>
    );
  }
  return (
    <div>
      {dates.map(ds => {
        const d = parseDT ? parseDT(ds) : null;
        const items = days[ds].slice().sort(itemSort || ((a, b) => 0));
        return (
          <div className="agenda-day" key={ds}>
            <div className={`agenda-date ${ds === today ? 'today' : ''}`}>
              <span className="ad-dow">{d ? (DOW[d.getDay()] || '') : ''}</span>
              <span className="ad-num">{d ? d.getDate() : ''}</span>
            </div>
            <div className="agenda-list">
              {items.map(e => <AgendaItem key={e.id} e={e} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalGrid({ y, m, sel, today }){
  const MONTHS = getMonths() || [];
  const DOW = getDow() || [];
  const CATS = getCats() || {};
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const byDate = eventsByDate();
  const cells = [];

  for(let i = 0; i < startDow; i++){
    const d = prevDays - startDow + i + 1;
    cells.push(<div className="cal-cell other" key={`p${d}`}>{d}</div>);
  }
  for(let d = 1; d <= daysInMonth; d++){
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const evs = byDate[ds] || [];
    cells.push(
      <div
        key={ds}
        className={`cal-cell ${ds === today ? 'today' : ''} ${evs.length ? 'has' : ''} ${sel === ds ? 'sel' : ''}`}
        onClick={() => call('selectCalDay', ds)}
      >
        {d}
        {evs.length ? (
          <div className="evt-dots">
            {evs.slice(0, 3).map((e, i) => (
              <i key={e.id || i} style={{ background: CATS[e.color] || CATS.purple }} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  const total = startDow + daysInMonth;
  for(let i = total; i % 7 !== 0; i++){
    const d = i - total + 1;
    cells.push(<div className="cal-cell other" key={`n${d}`}>{d}</div>);
  }

  return (
    <div className="card cal-grid-expanded" style={{ padding: '16px 14px 14px' }}>
      <div className="cal-head">
        <div className="cal-month">{MONTHS[m]} {y}</div>
        <div className="cal-nav">
          <button type="button" onClick={() => call('calMove', -1)}><Icon name="chevL" size={18} /></button>
          <button type="button" onClick={() => call('calToday')}><Icon name="reminder" size={17} /></button>
          <button type="button" onClick={() => call('calMove', 1)}><Icon name="chevR" size={18} /></button>
        </div>
      </div>
      <div className="cal-grid">
        {DOW.map(d => <div className="cal-dow" key={d}>{d[0]}</div>)}
        {cells}
      </div>
    </div>
  );
}

function CalCollapsedStrip({ y, m }){
  const MONTHS = getMonths() || [];
  return (
    <div className="card tap cal-grid-collapsed-strip" onClick={() => call('toggleCalGrid')}>
      <div style={{ color: 'var(--accent-2)' }}><Icon name="calendar" size={18} /></div>
      <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{MONTHS[m]} {y}</b></div>
      <div className="cal-nav">
        <button type="button" onClick={e => { e.stopPropagation(); call('calMove', -1); }}><Icon name="chevL" size={16} /></button>
        <button type="button" onClick={e => { e.stopPropagation(); call('calMove', 1); }}><Icon name="chevR" size={16} /></button>
      </div>
      <span style={{ color: 'var(--text-3)' }}><Icon name="chevDown" size={18} /></span>
    </div>
  );
}

export default function CalendarPage(){
  useStoreTick();
  const { y, m, sel, gridOpen } = calState();
  const MONTHS = getMonths() || [];
  const today = todayStr();
  const selApi = getSel();
  const showCount = selApi?.events ? selApi.events().length : 0;
  const store = getStore();
  const pastN = (store?.events || []).filter(e => showPassed && showPassed(e)).length;
  const calSub = showCount
    ? `${showCount} show${showCount !== 1 ? 's' : ''} · tap a day to filter the list`
    : 'Tap + to add a show · swipe the calendar to change month';
  const slideDir = useRef(0);

  useEffect(() => {
    const dir = slideDir.current;
    if(!dir) return;
    slideDir.current = 0;
    const grid = document.querySelector('.cal-grid') || document.querySelector('.cal-month');
    if(!grid) return;
    grid.style.animation = 'none';
    void grid.offsetWidth;
    grid.style.animation = `${dir > 0 ? 'calSlideR' : 'calSlideL'} .26s cubic-bezier(.2,.8,.2,1)`;
  }, [y, m]);

  /* Expose a hook so swipe can ask for a slide without fighting React remount timing. */
  useEffect(() => {
    window.__calMarkSlide = (dir) => { slideDir.current = dir; };
    return () => { delete window.__calMarkSlide; };
  }, []);

  return (
    <div className="tab-page">
      <div className="tab-page-sticky">
        <div className="lg-header">
          <div>
            <div className="lg-title">Calendar</div>
            <div className="lg-sub">{calSub}</div>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <button
              type="button"
              className="header-btn"
              style={{ width: 'auto', padding: '0 12px', gap: 4, borderRadius: 20 }}
              onClick={() => call('toggleCalGrid')}
            >
              <Icon name="calendar" size={17} />
              <Icon name={gridOpen ? 'chevUp' : 'chevDown'} size={15} />
            </button>
            <button type="button" className="header-btn" onClick={() => call('sheetEvent')}>
              <Icon name="plus" size={22} />
            </button>
          </div>
        </div>
      </div>
      <div className="screen-pad tab-page-body">
        <PageIntro
          id="calendar"
          title="Your master schedule"
          body="Coloured blocks are shows. Tap a day to see that day's list. Add or edit shows in the Shows tab — flights, hotels and checklists live inside each show."
        />
        <div className={`desktop-cal-split ${gridOpen ? '' : 'cal-grid-collapsed'}`}>
          <div className="desktop-cal-grid-col">
            <CalGrid y={y} m={m} sel={sel} today={today} />
            <CalCollapsedStrip y={y} m={m} />
          </div>
          <div className="desktop-cal-agenda-col">
            {pastN ? (
              <div className="past-link" onClick={() => call('openView', 'pastshows')}>
                <Icon name="archive" size={13} /> Past shows · {pastN}
                <Icon name="chevR" size={13} />
              </div>
            ) : null}
            <div className="section" style={{ marginTop: 8 }}>
              <div className="section-head">
                <div className="section-title">{sel && relDay ? relDay(sel) : `${MONTHS[m]} Agenda`}</div>
                {sel ? (
                  <div className="section-link" onClick={() => call('clearCalSel')}>Show whole month</div>
                ) : null}
              </div>
              <MonthAgenda y={y} m={m} sel={sel} today={today} />
            </div>
          </div>
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}
