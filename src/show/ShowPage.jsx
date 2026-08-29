import { useSyncExternalStore } from 'react';
import { getEvent, getStore, subscribeStore, notifyStore, call, iconHtml } from './bridge.js';

function useShow(showId){
  return useSyncExternalStore(
    subscribeStore,
    () => getEvent(showId),
    () => null
  );
}

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function Icon({ name, size = 16 }){
  return <span dangerouslySetInnerHTML={{ __html: iconHtml(name, size) }} />;
}

function isOpen(id, def){
  const fn = typeof window !== 'undefined' ? window.isOpen : null;
  if(typeof fn === 'function') return !!fn(id, def);
  return !!def;
}

function setFold(id, open){
  if(typeof window === 'undefined') return;
  if(typeof window.setFoldOpen === 'function') window.setFoldOpen(id, open);
  else if(typeof window.folds === 'object' && window.folds) window.folds[id] = open;
  notifyStore();
}

function Group({ id, title, icon, summary, defaultOpen = true, children }){
  const open = isOpen(id, defaultOpen);
  return (
    <section className={`show-group ${open ? 'open' : ''}`} id={`fold-${id}`}>
      <div
        className="show-group-head"
        role="button"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setFold(id, !open)}
      >
        <div className="show-group-ic" dangerouslySetInnerHTML={{ __html: icon }} />
        <div className="show-group-titles">
          <b>{title}</b>
          {summary ? <span>{summary}</span> : null}
        </div>
        <span
          className="fold-chev show-group-chev"
          dangerouslySetInnerHTML={{ __html: iconHtml('chevDown', 20) || iconHtml('chevR', 20) }}
        />
      </div>
      {open ? <div className="show-group-body">{children}</div> : null}
    </section>
  );
}

function Subsection({ id, title, addLabel, onAdd, defaultOpen = false, children }){
  const open = isOpen(id, defaultOpen);
  return (
    <div className={`show-subsection ${open ? 'open' : ''}`} id={`fold-${id}`}>
      <div
        className="show-subsection-head"
        role="button"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setFold(id, !open)}
      >
        <span>{title}</span>
        <div className="show-subsection-actions" onClick={e => e.stopPropagation()}>
          {onAdd ? (
            <button type="button" className="add" onClick={onAdd}>{addLabel || 'Add'}</button>
          ) : null}
          <span
            className="fold-chev show-subsection-chev"
            onClick={e => { e.stopPropagation(); setFold(id, !open); }}
            dangerouslySetInnerHTML={{ __html: iconHtml('chevDown', 16) || iconHtml('chevR', 16) }}
          />
        </div>
      </div>
      {open ? <div className="show-subsection-body">{children}</div> : null}
    </div>
  );
}

function Checklist({ show }){
  const list = show.checklist || [];
  const done = list.filter(i => i.done).length;
  const title = list.length ? `Checklist · ${done}/${list.length}` : 'Checklist';
  return (
    <Subsection
      id={`ss-${show.id}-checklist`}
      title={title}
      addLabel="Add"
      onAdd={() => call('sheetShowChecklist', show.id)}
      defaultOpen={list.length > 0}
    >
      {list.length ? (
        <div className="card flush">
          {list.map(item => (
            <div key={item.id} className={`check ${item.done ? 'done' : ''}`} data-id={item.id}>
              <div className="box" onClick={() => call('toggleEventCheck', show.id, item.id)}>
                <Icon name="check" size={15} />
              </div>
              <div className="lbl" onClick={() => call('toggleEventCheck', show.id, item.id)}>
                {item.label}
              </div>
              <button type="button" className="del" onClick={() => call('delEventCheck', show.id, item.id)}>
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="card tap"
          style={{ textAlign: 'center', color: 'var(--text-3)', padding: 18, fontWeight: 600 }}
          onClick={() => call('sheetShowChecklist', show.id)}
        >
          <Icon name="checkList" size={20} /> Add a checklist item
        </div>
      )}
    </Subsection>
  );
}

function Timeline({ show }){
  const tl = call('showDayTimeline', show) || show.timeline || [];
  return (
    <Subsection
      id={`ss-${show.id}-timeline`}
      title="Day timeline"
      addLabel={tl.length ? 'Edit' : 'Add'}
      onAdd={() => call('sheetShowTimeline', show.id)}
      defaultOpen={tl.length > 0}
    >
      {tl.length ? (
        <>
          <div className="card flush">
            {tl.map(s => (
              <div key={s.id} className={`check ${s.done ? 'done' : ''}`} data-id={s.id}>
                <div className="box" onClick={() => call('toggleShowTimelineStep', show.id, s.id)}>
                  <Icon name="check" size={15} />
                </div>
                <div className="lbl" style={{ flex: 1, minWidth: 0 }} onClick={() => call('toggleShowTimelineStep', show.id, s.id)}>
                  <b>{s.time || '—'}</b> {s.title || 'Step'}
                  {s.sub ? <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>{s.sub}</span> : null}
                  {s.auto ? <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>From show info</span> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="hint" style={{ textAlign: 'left', padding: '8px 4px 0' }}>
            Flights, hotel, transport and set time appear here automatically. Tap Edit to add custom steps.
          </div>
        </>
      ) : (
        <div
          className="card tap"
          style={{ textAlign: 'center', color: 'var(--text-3)', padding: 18, fontWeight: 600 }}
          onClick={() => call('sheetShowTimeline', show.id)}
        >
          <Icon name="clock" size={20} /> Add show details — timeline fills in automatically
        </div>
      )}
    </Subsection>
  );
}

function Notes({ show }){
  const has = !!(show.notes && String(show.notes).trim());
  return (
    <Subsection id={`ss-${show.id}-notes`} title="Internal notes" defaultOpen={has}>
      <div className="card" style={{ margin: 10 }}>
        <textarea
          className="textarea"
          placeholder="Anything to remember about this show…"
          defaultValue={show.notes || ''}
          key={show.id + ':' + (show.notes || '').length}
          onBlur={e => call('saveEventNotes', show.id, e.target.value)}
        />
      </div>
    </Subsection>
  );
}

function HtmlBlock({ html }){
  if(!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ShowPage({ showId }){
  useStoreTick();
  const show = useShow(showId);
  if(!show){
    return <div className="empty"><b>Gone</b></div>;
  }
  if(typeof window.migrateShowFlightInfo === 'function') window.migrateShowFlightInfo(show);

  const CATS = g('CATS') || {};
  const c = CATS[show.color] || CATS.purple || '#6d5efc';
  const trip = show.tripId && g('sel')?.trip ? g('sel').trip(show.tripId) : null;
  const backLabel = trip ? trip.name : (call('overlayBackLabel') || 'Back');

  const travelSummary = call('travelGroupSummary', show) || '';
  const venueSummary = call('venueGroupSummary', show) || '';
  const dealSummary = call('dealGroupSummary', show) || '';
  const prepSummary = call('prepGroupSummary', show) || '';

  const fmtDate = g('fmtDate');
  const relDay = g('relDay');

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> {backLabel}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('shareDaySheet', show.id)}>
              <Icon name="share" size={17} />
            </button>
            <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('eventMenu', show.id)}>
              <Icon name="edit" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="screen-pad show-detail show-detail-react">
        <HtmlBlock html={call('itineraryFullUploadBanner', show.id)} />

        <div className="dhero show-hero" style={{ background: `linear-gradient(155deg,${c}33,var(--card) 65%)` }}>
          <div className="cat-bar" style={{ background: c }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className={`tag ${show.status}`}>{show.status}</span>
            {trip ? (
              <span className="tag" style={{ background: `${c}22`, color: c }} onClick={() => call('openView', 'trip', trip.id)}>
                {trip.name}
              </span>
            ) : null}
          </div>
          <div className="show-hero-eyebrow">
            <Icon name="music" size={12} /> Show · {relDay ? relDay(show.date) : show.date}
          </div>
          <h1 className="show-hero-title">{show.venue || 'Untitled show'}</h1>
          <div className="show-hero-location">
            <Icon name="pin" size={14} /> {show.city || 'City TBA'}{show.country ? `, ${show.country}` : ''}
          </div>
          <div className="show-stats">
            <div className="show-stat">
              <span className="show-stat-k">Date</span>
              <span className="show-stat-v">{fmtDate ? fmtDate(show.date) : show.date}</span>
            </div>
            <div className="show-stat">
              <span className="show-stat-k">Set time</span>
              <span className="show-stat-v">
                {show.setTime ? `${show.setTime}${show.endTime ? ` – ${show.endTime}` : ''}` : 'TBA'}
              </span>
            </div>
            {show.arrival ? (
              <div className="show-stat">
                <span className="show-stat-k">Arrival</span>
                <span className="show-stat-v">{show.arrival}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="show-detail-quick">
          <div className="block-title">Quick access</div>
          <HtmlBlock html={call('showQuickLinks', show)} />
        </div>

        <div className="show-groups">
          <Group id={`sg-${show.id}-travel`} title="Travel" icon={iconHtml('plane', 20)} summary={travelSummary}>
            <HtmlBlock html={call('travelGroupBody', show)} />
          </Group>
          <Group id={`sg-${show.id}-venue`} title="Venue & show day" icon={iconHtml('pin', 20)} summary={venueSummary}>
            <HtmlBlock html={call('venueGroupBody', show)} />
          </Group>
          <Group id={`sg-${show.id}-deal`} title="Fee & deal" icon={iconHtml('coins', 20)} summary={dealSummary}>
            <HtmlBlock html={call('moneyGroupBody', show)} />
          </Group>
          <Group id={`sg-${show.id}-prep`} title="Day prep" icon={iconHtml('checkList', 20)} summary={prepSummary}>
            <Timeline show={show} />
            <HtmlBlock html={(call('contentSubsection', show) || '') + (call('attachmentsSubsection', show) || '')} />
            <Checklist show={show} />
            <Notes show={show} />
          </Group>
        </div>

        <div className="show-detail-foot">
          <Foot show={show} />
        </div>
        <div className="spacer" /><div className="spacer" />
      </div>
    </>
  );
}

function Foot({ show }){
  const run = call('runOf', show.id);
  const otherShows = run ? run.shows.length - 1 : 0;
  const store = getStore();
  const active = store?.activeShowId && call('runOf', store.activeShowId)?.key === (run && run.key);
  return (
    <>
      <div className="section" style={{ marginTop: 20 }}>
        {active ? (
          <button type="button" className="btn" onClick={() => call('go', 'home')}>
            <Icon name="play" size={18} /> Trip Mode is live — open it
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => call('startTripFromShow', show.id)}>
            <Icon name="play" size={18} /> Start Trip Mode{otherShows > 0 ? ` (this run · ${run.shows.length} shows)` : ''}
          </button>
        )}
        {otherShows > 0 ? (
          <div className="hint" style={{ textAlign: 'left', padding: '8px 2px 0' }}>
            Auto-grouped with {otherShows} nearby show{otherShows > 1 ? 's' : ''} into one tour — no naming needed.
          </div>
        ) : null}
      </div>
      <div className="section">
        <button type="button" className="btn danger" onClick={() => call('confirmDeleteEvent', show.id)}>
          <Icon name="trash" size={17} /> Delete show
        </button>
      </div>
    </>
  );
}

function g(name){
  return typeof window !== 'undefined' ? window[name] : undefined;
}
