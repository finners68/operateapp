import { useSyncExternalStore, useEffect } from 'react';
import { call, fmtDate, fmtDateLong, getCats, getStore, pad, parseDT, relDay, showTitle, subscribeStore, tickCountdowns } from '../api/operate.js';
import { Icon, LegacyHtml, isOpen, setFold } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function PackingFold({ foldId }){
  const store = getStore();
  const pk = store?.packing || [];
  const open = isOpen(foldId, false);
  const done = pk.filter(i => i.done).length;
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
            {pk.length ? pk.map(i => (
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

function TripLegRow({ show, index, nextShow }){
  const isNext = nextShow && show.id === nextShow.id;
  const bg = isNext ? { background: 'rgba(255,159,10,0.13)' } : undefined;
  const icBg = show.setDone ? 'rgba(50,215,75,0.18)' : isNext ? 'rgba(255,159,10,0.22)' : 'rgba(255,255,255,0.05)';
  const icCol = show.setDone ? 'var(--green)' : isNext ? 'var(--orange)' : 'var(--text-3)';
  return (
    <div className="row" style={bg} onClick={() => call('openView', 'event', show.id)}>
      <div className="ic" style={{ background: icBg, color: icCol, fontWeight: 800, fontSize: 13 }}>
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

/** Shared live tour dashboard — used by Tour Mode tab (and matches tripBody). */
export function TripDashboard({ run, compactHeader = false }){
  const CATS = getCats() || {};
  const c = CATS[run.color] || CATS.green || '#32d74b';
  const active = call('activeRun')?.key === run.key;
  const tl = call('runTimeline', run) || [];
  const nextIdx = tl.findIndex(s => !s.done);
  const nextStep = nextIdx >= 0 ? tl[nextIdx] : null;
  const thenStep = nextIdx >= 0 ? tl[nextIdx + 1] : null;
  const legShow = nextStep
    ? (call('stepShow', nextStep) || run.shows.find(s => !s.setDone))
    : null;
  const contacts = call('tourContacts', run) || [];
  const dayHtml = call('dayTimeline', run.key, run) || '';
  const pillsHtml = nextStep ? (call('stepPills', nextStep) || '') : '';
  const flightWidget = nextStep?.ref && nextStep.kind === 'travel' && (nextStep.ref.icon || 'plane') === 'plane'
    ? call('flightInfoWidget', nextStep.ref)
    : '';

  return (
    <>
      <div className="dhero" style={{ background: `linear-gradient(155deg,${c}33,var(--card) 65%)` }}>
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

      {!active && run.shows[0] ? (
        <div className="section" style={{ marginTop: 14 }}>
          <button type="button" className="btn" onClick={() => call('startTripFromShow', run.shows[0].id)}>
            <Icon name="play" size={18} /> Start Trip Mode
          </button>
        </div>
      ) : null}

      <div className="section" style={{ marginTop: 14 }}>
        <div className="section-head"><div className="section-title">Up next</div></div>
        {nextStep ? (
          <>
            <div className="hero nextshow">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div className="hero-label">
                  <Icon name={nextStep.icon || 'clock'} size={14} />{' '}
                  {relDay ? relDay(nextStep.date) : nextStep.date}
                  {nextStep.time ? ` · ${nextStep.time}` : ''}
                </div>
                <button type="button" className="mini-tick" title="Done — next" onClick={() => call('completeRunStep', run.key, nextStep.id)}>
                  <Icon name="check" size={15} />
                </button>
              </div>
              <div className="hero-venue" style={{ fontSize: 22, marginTop: 6 }}>{nextStep.title}</div>
              {nextStep.sub ? <div className="hero-city">{nextStep.sub}</div> : null}
              {pillsHtml ? <div className="hero-info" style={{ marginTop: 15, flexWrap: 'wrap' }} dangerouslySetInnerHTML={{ __html: pillsHtml }} /> : null}
              {flightWidget ? <LegacyHtml html={flightWidget} /> : null}
            </div>
            {thenStep ? (
              <div className="then-next">
                <div className="then-lab">Then</div>
                <div className="then-ic"><Icon name={thenStep.icon || 'clock'} size={15} /></div>
                <div className="then-body">
                  <b>{thenStep.title}</b>
                  <span>
                    {thenStep.time ? `${thenStep.time} · ` : ''}
                    {relDay ? relDay(thenStep.date) : thenStep.date}
                    {thenStep.sub ? ` · ${thenStep.sub}` : ''}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-2)', padding: 22 }}>
            <Icon name="check" size={24} />
            <div style={{ marginTop: 6, fontWeight: 650 }}>Tour complete</div>
          </div>
        )}
      </div>

      {contacts.length ? (
        <div className="section">
          <button type="button" className="btn secondary" onClick={() => call('openTourContacts', run.key)}>
            <Icon name="users" size={17} /> Key contacts · {contacts.length}
          </button>
        </div>
      ) : null}

      <div className="section">
        <div className="section-head">
          <div className="section-title">Day timeline</div>
          <div className="section-link">{run.shows.length} day{run.shows.length !== 1 ? 's' : ''}</div>
        </div>
        <LegacyHtml html={dayHtml} />
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Shows on this tour</div>
          <div className="section-link">{run.shows.length}</div>
        </div>
        <div className="card flush">
          {run.shows.map((e, i) => (
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
    </>
  );
}

function pickTourRun(){
  const all = call('runs') || [];
  if(!all.length) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return call('activeRun')
    || all.find(x => {
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
      <div className="tab-page">
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
            <span>Add shows on nearby dates — they group into a tour automatically and appear here as your live dashboard.</span>
            <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 240 }} onClick={() => call('go', 'shows')}>
              <Icon name="music" size={18} /> Go to Shows
            </button>
          </div>
        </div>
      </div>
    );
  }

  const r = pickTourRun();
  const active = call('activeRun') && call('activeRun').key === r.key;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = all.filter(x => {
    const end = parseDT ? parseDT(x.end) : null;
    return end && end >= today;
  });

  return (
    <div className="tab-page">
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
