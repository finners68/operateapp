import { useSyncExternalStore, useEffect, useState } from 'react';
import { call, fmtDate, fmtDateLong, getCats, getStore, pad, parseDT, relDay, showTitle, subscribeStore, tickCountdowns } from '../api/operate.js';
import { Icon, isOpen, setFold } from '../show/ui.jsx';
import { RunDayTimeline } from './RunDayTimeline.jsx';
import { UpNextTimelineCarousel } from './UpNextTimelineCarousel.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function TourKeyContactsCompact({ run, contacts }: Record<string, any>){
  const callable = (contacts || []).filter((c: any) => c.phone || c.whatsapp);
  const preview = callable.slice(0, 2);
  if(!callable.length) return null;
  return (
    <div className="section tour-contacts-section">
      <div className="card tour-contacts-compact">
        <button
          type="button"
          className="tour-contacts-compact-head"
          onClick={() => call('openTourContacts', run.key)}
        >
          <Icon name="users" size={16} />
          <span className="tour-contacts-compact-title">Key contacts</span>
          <span className="tour-contacts-compact-count">{callable.length}</span>
          <Icon name="chevR" size={14} />
        </button>
        {preview.map((c: any, i: any) => (
          <div key={`${c.label}-${c.phone}-${i}`} className="tour-contacts-mini-row">
            <span className="tour-contacts-mini-name">{c.name || c.label}</span>
            {c.phone ? (
              <button
                type="button"
                className="tour-contacts-mini-act"
                title="Call"
                onClick={() => call('callNumber', c.phone)}
              >
                <Icon name="phone" size={14} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PackingFold({ foldId }: Record<string, any>){
  const store = getStore();
  const pk = store?.packing || [];
  const open = isOpen(foldId, false);
  const done = pk.filter((i: any) => i.done).length;
  const pct = pk.length ? Math.round(done / pk.length * 100) : 0;

  return (
    <div className={`fold ${open ? 'open' : ''}`} id={`fold-${foldId}`}>
      <div className="fold-head" onClick={() => setFold(foldId, !open)}>
        <div className="ic" style={{ background: 'var(--card-2)' }}><Icon name="checkList" size={17} /></div>
        <div className="ft">
          <b>Packing & checklist</b>
          <span>{done}/{pk.length} packed</span>
        </div>
        <span className="fold-chev"><Icon name="chevDown" size={20} /></span>
      </div>
      <div className="fold-body">
        <div className="fold-inner">
          <div style={{ padding: '0 16px 4px' }}>
            <div className="progress" style={{ margin: '12px 0 4px' }}><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="fold-scroll">
            {pk.length ? pk.map((i: any) => (
              <div key={i.id} className={`check ${i.done ? 'done' : ''}`} data-id={i.id}>
                <div className="box" onClick={() => call('togglePack', i.id)}><Icon name="check" size={15} /></div>
                <div className="lbl">{i.label}</div>
                <button type="button" className="del" onClick={() => call('delPack', i.id)}><Icon name="x" size={16} /></button>
              </div>
            )) : <div className="hint">No items</div>}
          </div>
          <div className="fold-pad">
            <button type="button" className="btn secondary" style={{ padding: 11 }} onClick={() => call('addPackPrompt')}>
              <Icon name="plus" size={15} /> Add item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripLegRow({ show, index, nextShow }: Record<string, any>){
  const isNext = nextShow && show.id === nextShow.id;
  const bg = isNext ? { background: 'rgba(255,159,10,0.13)' } : undefined;
  const icBg = show.setDone ? 'rgba(50,215,75,0.18)' : isNext ? 'rgba(255,159,10,0.22)' : 'rgba(255,255,255,0.05)';
  const icCol = show.setDone ? 'var(--green)' : isNext ? 'var(--orange)' : 'var(--text-3)';
  return (
    <div className="row" style={bg} onClick={() => call('openView', 'event', show.id)}>
      <div className="ic" style={{ background: icBg, color: icCol, fontWeight: 600, fontSize: 13 }}>
        {show.setDone ? <Icon name="check" size={16} /> : index + 1}
      </div>
      <div className="body">
        <b>
          {showTitle(show)}{' '}
          {isNext ? <span className="tag hold" style={{ marginLeft: 4 }}>Next</span> : null}
        </b>
        <span>
          {show.city}{show.country ? `, ${show.country}` : ''} · {fmtDate ? fmtDate(show.date) : show.date}
          {show.setTime ? ` · ${show.setTime}` : ''}
        </span>
      </div>
      <Icon name="chevR" size={15} />
    </div>
  );
}

const TOUR_DASH_VIEW_KEY = 'operate_tour_dash_view';

export function readTourDashView(){
  try{
    return sessionStorage.getItem(TOUR_DASH_VIEW_KEY) === 'day' ? 'day' : 'upnext';
  }catch(_){
    return 'upnext';
  }
}

export function writeTourDashView(mode: any){
  try{ sessionStorage.setItem(TOUR_DASH_VIEW_KEY, mode === 'day' ? 'day' : 'upnext'); }catch(_){}
}

/** One control, two choices — purple ring on the active side. */
export function TourModeViewToggle({ value, onChange }: Record<string, any>){
  const flip = () => onChange(value === 'day' ? 'upnext' : 'day');
  return (
    <button
      type="button"
      className="tour-mode-seg"
      aria-label={value === 'day' ? 'Tour timeline — click for up next' : 'Up next — click for tour timeline'}
      onClick={flip}
    >
      <span className={`tour-mode-seg-opt${value === 'upnext' ? ' active' : ''}`}>Up next</span>
      <span className={`tour-mode-seg-opt${value === 'day' ? ' active' : ''}`}>Tour timeline</span>
    </button>
  );
}

export function useTourDashView(){
  const [dashView, setDashView] = useState(readTourDashView);
  const setView = (mode: any) => {
    const v = mode === 'day' ? 'day' : 'upnext';
    setDashView(v);
    writeTourDashView(v);
  };
  return [dashView, setView];
}

/** Shared live tour dashboard — used by Tour Mode tab (and matches tripBody). */
export function TripDashboard({
  run,
  compactHeader = false,
  dashView: dashViewProp,
  onDashViewChange,
  showViewToggle = true,
  showViewToggleBelowTitle = true,
}: Record<string, any>){
  const CATS = getCats() || {};
  const c = CATS[run.color] || CATS.green || '#32d74b';
  const active = call('activeRun')?.key === run.key;
  const tl = call('runTimeline', run) || [];
  const nextIdx = tl.findIndex((s: any) => !s.done);
  const nextStep = nextIdx >= 0 ? tl[nextIdx] : null;
  const legShow = nextStep
    ? (call('stepShow', nextStep) || run.shows.find((s: any) => !s.setDone))
    : null;
  const contacts = call('tourContacts', run) || [];
  const [internalView, setInternalView] = useState(readTourDashView);
  const dashView = dashViewProp ?? internalView;
  const setDashView = onDashViewChange ?? ((v: any) => {
    const mode = v === 'day' ? 'day' : 'upnext';
    setInternalView(mode);
    writeTourDashView(mode);
  });
  const showToggle = showViewToggle && showViewToggleBelowTitle;

  return (
    <div className="tour-mode">
      <div className="dhero">
        <div className="cat-bar" style={{ background: c }} />
        {active ? (
          <div style={{ marginBottom: 8 }}>
            <span className="tag confirmed"><span className="pulse" style={{ display: 'inline-block', marginRight: 5 }} />Live</span>
          </div>
        ) : null}
        <h1>{run.title}</h1>
        <div className="sub">
          <Icon name="calendar" size={14} />{' '}
          {fmtDateLong ? fmtDateLong(run.start) : (fmtDate ? fmtDate(run.start) : run.start)}
          {run.end !== run.start ? ` – ${fmtDate ? fmtDate(run.end) : run.end}` : ''}
        </div>
      </div>

      {showToggle ? (
        <TourModeViewToggle value={dashView} onChange={setDashView} />
      ) : null}

      <div className="section" style={{ marginTop: 14 }}>
        {dashView === 'upnext' ? (
          <UpNextTimelineCarousel run={run} timeline={tl} />
        ) : (
          <>
            <div className="section-head" style={{ marginTop: 0 }}>
              <div className="section-title">Tour timeline</div>
              <div className="section-link">{run.shows.length} day{run.shows.length !== 1 ? 's' : ''}</div>
            </div>
            <RunDayTimeline run={run} />
          </>
        )}
      </div>

      <TourKeyContactsCompact run={run} contacts={contacts} />

      <div className="section">
        <div className="section-head">
          <div className="section-title">Shows on this tour</div>
          <div className="section-link">{run.shows.length}</div>
        </div>
        <div className="card flush">
          {run.shows.map((e: any, i: any) => (
            <TripLegRow key={e.id} show={e} index={i} nextShow={legShow} />
          ))}
        </div>
      </div>

      <div className="section">
        <PackingFold foldId={compactHeader ? 'tm-pack' : 'trip-pack'} />
      </div>

      {active ? (
        <div className="section" style={{ marginTop: 20 }}>
          <button type="button" className="btn secondary" onClick={() => call('endTripMode')}>
            <Icon name="flag" size={17} /> End Trip Mode
          </button>
        </div>
      ) : null}
      <div className="spacer" /><div className="spacer" />
    </div>
  );
}

function pickTourRun(){
  const all = call('runs') || [];
  if(!all.length) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return call('activeRun')
    || all.find((x: any) => {
      const end = parseDT ? parseDT(x.end) : null;
      return end && end >= today;
    })
    || all[all.length - 1];
}

export default function TripModePage(){
  const tick = useStoreTick();
  useEffect(() => {
    const fn = tickCountdowns;
    if(typeof fn === 'function') try{ fn(); }catch(_){}
  }, [tick]);

  const all = call('runs') || [];
  if(!all.length){
    return (
      <div className="tab-page tour-mode">
        <div className="tab-page-sticky">
          <div className="lg-header">
            <div>
              <div className="lg-title">Tour Mode</div>
              <div className="lg-sub">Your live tour dashboard</div>
            </div>
          </div>
        </div>
        <div className="screen-pad tab-page-body">
          <div className="empty">
            <div className="ic"><Icon name="trips" size={28} /></div>
            <b>No tours yet</b>
            <span>A tour is the shows between your flight out from home and your flight back.</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, maxWidth: 240, width: '100%' }}>
              <button type="button" className="btn" onClick={() => call('sheetEvent')}>
                <Icon name="plus" size={18} /> Add show
              </button>
              <button type="button" className="btn secondary" onClick={() => call('go', 'shows')}>
                <Icon name="music" size={18} /> View shows
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const r = pickTourRun();
  const active = call('activeRun') && call('activeRun').key === r.key;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = all.filter((x: any) => {
    const end = parseDT ? parseDT(x.end) : null;
    return end && end >= today;
  });

  return (
    <div className="tab-page tour-mode">
      <div className="tab-page-sticky">
        <div className="lg-header">
          <div>
            <div className="lg-title">Tour Mode</div>
            <div className="lg-sub">
              {active ? 'Live now' : (parseDT && parseDT(r.end) >= today ? 'Next tour' : 'Latest tour')}
              {upcoming.length > 1 ? ` · ${upcoming.length} upcoming` : ''}
            </div>
          </div>
          <button type="button" className="header-btn" title="All tours" onClick={() => call('goToursList')}>
            <Icon name="trips" size={20} />
          </button>
        </div>
      </div>
      <div className="screen-pad tab-page-body">
        <TripDashboard run={r} compactHeader />
      </div>
    </div>
  );
}
