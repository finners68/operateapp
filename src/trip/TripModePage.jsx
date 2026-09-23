import { useSyncExternalStore, useEffect } from 'react';
import { call, fmtDate, getCats, getMon, getStore, parseDT, showTitle, subscribeStore, tickCountdowns } from '../api/operate.js';
import { Icon, LegacyHtml, isOpen, setFold } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function compactDate(dstr){
  const d = parseDT ? parseDT(dstr) : null;
  if(!d) return dstr || '';
  const mon = getMon() || [];
  return `${d.getDate()} ${mon[d.getMonth()] || ''}`.trim();
}

function stepLines(step){
  const parts = String(step?.sub || '').split(' · ').map(s => s.trim()).filter(Boolean);
  return { lead: parts[0] || '', extra: parts.slice(1) };
}

function PackingFold({ foldId }){
  const store = getStore();
  const pk = store?.packing || [];
  const open = isOpen(foldId, false);
  const done = pk.filter(i => i.done).length;
  const pct = pk.length ? Math.round(done / pk.length * 100) : 0;

  if(!pk.length){
    return (
      <div className="tm-pack-empty" onClick={() => call('addPackPrompt')}>
        <div className="tm-pack-empty-copy">
          <b>Packing & checklist</b>
          <span>No items</span>
        </div>
        <button
          type="button"
          className="add"
          onClick={e => { e.stopPropagation(); call('addPackPrompt'); }}
        >
          Add
        </button>
      </div>
    );
  }

  return (
    <div className={`fold tm-pack-fold ${open ? 'open' : ''}`} id={`fold-${foldId}`}>
      <div className="fold-head" onClick={() => setFold(foldId, !open)}>
        <div className="ic" style={{ background: 'var(--card-2)' }}><Icon name="checkList" size={17} /></div>
        <div className="ft">
          <b>Packing & checklist</b>
          <span>{done} / {pk.length} packed</span>
        </div>
        <span className="fold-chev"><Icon name="chevDown" size={20} /></span>
      </div>
      <div className="fold-body">
        <div className="fold-inner">
          <div style={{ padding: '0 16px 4px' }}>
            <div className="progress" style={{ margin: '12px 0 4px' }}><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="fold-scroll">
            {pk.map(i => (
              <div key={i.id} className={`check ${i.done ? 'done' : ''}`} data-id={i.id}>
                <div className="box" onClick={() => call('togglePack', i.id)}><Icon name="check" size={15} /></div>
                <div className="lbl">{i.label}</div>
                <button type="button" className="del" onClick={() => call('delPack', i.id)}><Icon name="x" size={16} /></button>
              </div>
            ))}
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
  return (
    <div className="tm-show-row" onClick={() => call('openView', 'event', show.id)}>
      <div className="tm-show-num">{show.setDone ? <Icon name="check" size={14} /> : index + 1}</div>
      <div className="tm-show-body">
        <div className="tm-show-title">
          <b>{showTitle(show)}</b>
          {isNext ? <span className="tm-next-chip">Next</span> : null}
        </div>
        <span>
          {[show.venue, fmtDate ? fmtDate(show.date) : show.date, show.setTime].filter(Boolean).join(' · ')}
        </span>
      </div>
      <Icon name="chevR" size={15} />
    </div>
  );
}

function ThenPreview({ step }){
  const lines = stepLines(step);
  return (
    <div className="tm-then">
      <div className="tm-then-lab">Then</div>
      <div className="tm-then-row">
        <div className="tm-then-time">{step.time || '—'}</div>
        <div className="tm-then-ic"><Icon name={step.icon || 'clock'} size={15} /></div>
        <div className="tm-then-body">
          <b>{step.title}</b>
          {lines.lead ? <span>{lines.lead}</span> : null}
          {lines.extra.map((x, i) => <em key={i}>{x}</em>)}
        </div>
      </div>
    </div>
  );
}

/** Shared live tour dashboard — used by Tour Mode tab (and matches tripBody). */
export function TripDashboard({ run, compactHeader = false }){
  const CATS = getCats() || {};
  const c = CATS[run.color] || CATS.green || '#32d74b';
  const active = call('activeRun')?.key === run.key;
  const tl = call('runTimeline', run) || [];
  const progress = call('runProgress', run) || { done: 0, total: tl.length, pct: 0 };
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
  const nextLines = nextStep ? stepLines(nextStep) : { lead: '', extra: [] };
  const showCount = run.shows.length;
  const itemCount = tl.length;

  return (
    <div className="tm-dash">
      <div className="tm-hero" style={{ background: `linear-gradient(155deg,${c}28,var(--card) 70%)` }}>
        <div className="cat-bar" style={{ background: c }} />
        {active ? (
          <div className="tm-hero-live">
            <span className="tag confirmed"><span className="pulse" style={{ display: 'inline-block', marginRight: 5 }} />Live</span>
          </div>
        ) : null}
        <h1>{run.title}</h1>
        <div className="tm-hero-dates">
          {compactDate(run.start)}
          {run.end !== run.start ? ` – ${compactDate(run.end)}` : ''}
        </div>
        <div className="tm-hero-meta">
          {showCount} show{showCount !== 1 ? 's' : ''}
          {itemCount ? ` · ${itemCount} itinerary item${itemCount !== 1 ? 's' : ''}` : ''}
        </div>
        {progress.total ? (
          <div className="tm-hero-progress">
            <span>{progress.done} / {progress.total} complete</span>
            <div className="progress"><i style={{ width: `${progress.pct || 0}%` }} /></div>
          </div>
        ) : null}
      </div>

      {!active && run.shows[0] ? (
        <button type="button" className="btn tm-start-btn" onClick={() => call('startTripFromShow', run.shows[0].id)}>
          <Icon name="play" size={18} /> Start Tour Mode
        </button>
      ) : null}

      <section className="tm-upnext-block">
        <div className="tm-kicker">Up next</div>
        {nextStep ? (
          <>
            <div className="hero nextshow tm-upnext">
              <div className="tm-upnext-top">
                <div className="tm-upnext-time">{nextStep.time || (nextStep.date ? compactDate(nextStep.date) : '—')}</div>
                <button type="button" className="mini-tick" title="Done — next" aria-label="Mark done" onClick={() => call('completeRunStep', run.key, nextStep.id)}>
                  <Icon name="check" size={15} />
                </button>
              </div>
              <div className="tm-upnext-title">{nextStep.title}</div>
              {nextLines.lead ? <div className="tm-upnext-sub">{nextLines.lead}</div> : null}
              {nextLines.extra.map((x, i) => <div className="tm-upnext-extra" key={i}>{x}</div>)}
              {pillsHtml ? <div className="hero-info tm-upnext-actions" dangerouslySetInnerHTML={{ __html: pillsHtml }} /> : null}
              {flightWidget ? <LegacyHtml html={flightWidget} /> : null}
            </div>
            {thenStep ? <ThenPreview step={thenStep} /> : null}
          </>
        ) : (
          <div className="tm-complete">
            <Icon name="check" size={22} />
            <div>Tour complete</div>
          </div>
        )}
      </section>

      {contacts.length ? (
        <button type="button" className="tm-contacts" onClick={() => call('openTourContacts', run.key)}>
          <span><Icon name="users" size={16} /> Key contacts · {contacts.length}</span>
          <Icon name="chevR" size={14} />
        </button>
      ) : null}

      <section className="tm-section">
        <div className="section-head">
          <div className="section-title">Day timeline</div>
          <div className="section-link">{showCount} day{showCount !== 1 ? 's' : ''}</div>
        </div>
        <LegacyHtml html={dayHtml} />
      </section>

      <section className="tm-section tm-shows">
        <div className="section-head">
          <div className="section-title">Shows on this tour</div>
          <div className="section-link">{showCount}</div>
        </div>
        <div className="tm-show-list">
          {run.shows.map((e, i) => (
            <TripLegRow key={e.id} show={e} index={i} nextShow={legShow} />
          ))}
        </div>
      </section>

      <section className="tm-section">
        <PackingFold foldId={compactHeader ? 'tm-pack' : 'trip-pack'} />
      </section>

      {active ? (
        <button type="button" className="tm-end" onClick={() => call('endTripMode')}>
          End Tour Mode
        </button>
      ) : null}
    </div>
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
      <div className="tab-page tm-page">
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
    <div className="tab-page tm-page">
      <div className="tab-page-sticky">
        <div className="lg-header">
          <div>
            <div className="lg-title">Tour Mode</div>
            <div className="lg-sub">
              {active ? 'Live now' : (parseDT && parseDT(r.end) >= today ? 'Next tour' : 'Latest tour')}
              {upcoming.length > 1 ? ` · ${upcoming.length} upcoming` : ''}
            </div>
          </div>
          <button type="button" className="header-btn" title="Tours" aria-label="Tours" onClick={() => call('goToursList')}>
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
