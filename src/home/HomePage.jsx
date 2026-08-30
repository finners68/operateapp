import { useSyncExternalStore, useEffect } from 'react';
import { call, countdown, flightHasDetails, fmtDate, getCats, getIdeaTypes, getSel, getStore, pad, parseDT, relDay, subscribeStore, tickCountdowns, timeAgo } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function greeting(){
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function HomeShortcut({ onClick, icon, color, label }){
  return (
    <button type="button" className="home-sc" onClick={onClick}>
      <span className="ic" style={{ background: `${color}22`, color }}><Icon name={icon} size={18} /></span>
      <span>{label}</span>
    </button>
  );
}

function HomePanel({ title, link, children }){
  return (
    <div className="home-panel">
      <div className="home-panel-head home-panel-head-flex">
        <span>{title}</span>
        {link || null}
      </div>
      {children}
    </div>
  );
}

function NextShowHero({ show }){
  const flight = (show.flights || []).find(f => {
    const fn = flightHasDetails;
    return typeof fn !== 'function' || fn(f);
  });
  const flightMs = flight && flight.dep && parseDT
    ? parseDT(...String(flight.dep).split(' '))?.getTime()
    : null;
  const setMs = call('setStartMs', show.date, show.setTime);
  const cF = flightMs && countdown ? countdown(flightMs) : null;
  const cS = setMs && countdown ? countdown(setMs) : null;
  const flightPass = (show.flights || []).map(f => {
    const passes = call('flightAllPasses', f) || f.passes || [];
    return passes.length ? { f, p: passes[0] } : null;
  }).filter(Boolean)[0];
  const drivers = call('showDrivers', show) || [];
  const hasContacts = !!(show.promoter && (show.promoter.phone || show.promoter.whatsapp))
    || drivers.some(d => !d.noGround && (d.phone || d.whatsapp))
    || (show.contacts || []).some(c => c.phone || c.whatsapp);
  const hasTransport = drivers.length > 0;
  const liaisonReach = show.promoter && (show.promoter.phone || show.promoter.whatsapp);
  const store = getStore();
  const hasRem = (store?.reminders || []).some(r => r.showId === show.id && !r.fired && (r.kind || 'manual') !== 'usb');
  const hotelQ = call('hotelMapQuery', show);
  const venueQ = call('venueMapQuery', show);

  return (
    <div className="hero tap nextshow" onClick={() => call('openView', 'event', show.id)}>
      <div className="hero-label"><Icon name="music" size={14} /> Next show · {relDay ? relDay(show.date) : show.date}</div>
      <div className="hero-venue">{show.eventName || show.venue}</div>
      {show.eventName && show.venue ? <div className="hero-venue-sub"><Icon name="pin" size={13} /> {show.venue}</div> : null}
      <div className="hero-city">
        <Icon name="pin" size={14} /> {show.city}{show.country ? `, ${show.country}` : ''}
      </div>
      <div className="count-row">
        <div className="count">
          <div className="count-k"><Icon name="music" size={12} /> Set time</div>
          <div className="count-v" style={{ fontSize: 19 }}>
            {show.setTime || 'TBA'}{show.endTime ? <small> – {show.endTime}</small> : null}
          </div>
        </div>
        <div className="count">
          <div className="count-k"><Icon name="clock" size={12} /> Starts in</div>
          <div className="count-v" {...(setMs ? { 'data-countdown-ms': setMs } : {})}>
            <span className="cd-txt">{cS && !cS.done ? cS.txt : '—'}</span>
            <small className="cd-unit">{cS && !cS.done ? cS.unit : ''}</small>
          </div>
        </div>
        {flight ? (
          <div className="count">
            <div className="count-k"><Icon name="plane" size={12} /> Flight</div>
            <div className="count-v" {...(flightMs ? { 'data-countdown-ms': flightMs, 'data-countdown-off': 'Off' } : {})}>
              <span className="cd-txt">{cF?.done ? 'Off' : cF?.txt}</span>
              <small className="cd-unit">{cF?.done ? '' : cF?.unit}</small>
            </div>
          </div>
        ) : null}
      </div>
      <div className="hero-links">
        <button type="button" className="hero-link" style={{ background: 'rgba(255,159,10,0.2)', borderColor: 'rgba(255,159,10,0.42)', color: 'var(--text)' }} onClick={e => { e.stopPropagation(); call('sheetReminder', show.id); }}>
          <Icon name="reminder" size={14} /> {hasRem ? 'Reminder on' : 'Set reminder'}
        </button>
        {flightPass ? (
          <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('openPassByRef', show.id, flightPass.p.id, flightPass.f.id); }}>
            <Icon name="ticket" size={14} /> Boarding pass
          </button>
        ) : null}
        {hasContacts ? (
          <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('openTourContacts', show.id); }}>
            <Icon name="users" size={14} /> Key contacts
          </button>
        ) : null}
        {hasTransport ? (
          <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('showTransport', show.id); }}>
            <Icon name="car" size={14} /> Transport
          </button>
        ) : null}
        {liaisonReach ? (
          <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('contactPromoter', show.id); }}>
            <Icon name="chat" size={14} /> Liaison
          </button>
        ) : null}
        {show.hotel ? (
          <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('openMaps', hotelQ); }}>
            <Icon name="bed" size={14} /> {show.hotel.name || 'Hotel'}
          </button>
        ) : null}
        <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('openMaps', venueQ); }}>
          <Icon name="pin" size={14} /> Venue
        </button>
        <button type="button" className="hero-link" onClick={e => { e.stopPropagation(); call('shareDaySheet', show.id); }}>
          <Icon name="share" size={14} /> Day sheet
        </button>
      </div>
    </div>
  );
}

function TourBanner({ run }){
  const p = call('runProgress', run) || { done: 0, total: 0, pct: 0 };
  return (
    <div className="tourmode-card tap" onClick={() => call('go', 'trips')}>
      <div className="tourmode-top">
        <span className="tourmode-badge"><Icon name="planeTop" size={15} /> Tour Mode</span>
        <span className="tourmode-live"><span className="pulse" /> LIVE</span>
      </div>
      <div className="tourmode-title">{run.title}</div>
      <div className="tourmode-meta">{run.shows.length} show{run.shows.length > 1 ? 's' : ''} · {p.done}/{p.total} done</div>
      <div className="tourmode-bar"><i style={{ width: `${p.pct}%` }} /></div>
      <div className="tourmode-cta">Open Tour Mode <Icon name="chevR" size={15} /></div>
    </div>
  );
}

export default function HomePage(){
  const tick = useStoreTick();
  useEffect(() => {
    const fn = tickCountdowns;
    if(typeof fn === 'function') try{ fn(); }catch(_){}
  }, [tick]);

  const store = getStore();
  const sel = getSel();
  const run = call('activeRun');
  const show = sel?.nextEvent ? sel.nextEvent() : null;
  const greet = greeting();
  const nameBit = store?.settings?.artistName && store.settings.artistName !== 'You'
    ? `, ${store.settings.artistName}`
    : '';
  const photo = store?.settings?._homeHeaderUrl || store?.settings?.homeHeader;
  const st = call('computeStats') || {};
  const todayChecklist = show?.checklist?.length ? show.checklist : [];
  const ideasWaiting = sel?.ideas ? sel.ideas().filter(i => !i.done).slice(0, 2) : [];
  const recentNotes = sel?.notes ? sel.notes().slice(0, 2) : [];
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const trips = (call('runs') || []).filter(r => {
    const end = parseDT ? parseDT(r.end) : null;
    return end && end >= today0;
  }).slice(0, 2);
  const types = getIdeaTypes() || {};
  const header = photo ? (
    <div className="home-hero" style={{ backgroundImage: `url('${photo}')` }}>
      <div className="home-hero-actions">
        <button type="button" className="header-btn glass" onClick={() => call('openSearch')}><Icon name="search" size={20} /></button>
        <button type="button" className="header-btn glass" onClick={() => call('openView', 'settings')}><Icon name="settings" size={20} /></button>
      </div>
      <div className="home-hero-text">
        <div className="hero-hello">{greet}{nameBit}</div>
        <div className="hero-home">Home</div>
      </div>
    </div>
  ) : (
    <div className="tab-page-sticky">
      <div className="lg-header">
        <div>
          <div className="lg-title">Home</div>
          <div className="lg-sub">{greet}{nameBit} · your tour dashboard</div>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" className="header-btn" onClick={() => call('openSearch')}><Icon name="search" size={20} /></button>
          <button type="button" className="header-btn" onClick={() => call('openView', 'settings')}><Icon name="settings" size={20} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tab-page">
      {header}
      <div className="screen-pad home-screen tab-page-body" style={photo ? { marginTop: 12 } : undefined}>
        <section className="home-focus">
          {show ? (
            <NextShowHero show={show} />
          ) : (
            <div className="empty">
              <div className="ic"><Icon name="calendar" size={28} /></div>
              <b>No upcoming shows</b>
              <span>Your next show appears here with countdowns and travel info.</span>
              <button type="button" className="btn" style={{ marginTop: 16, maxWidth: 260 }} onClick={() => call('sheetEvent')}>
                <Icon name="plus" size={18} /> Add your first show
              </button>
            </div>
          )}
        </section>

        {run ? <div className="tourmode-wrap"><TourBanner run={run} /></div> : null}

        <div className="home-layout">
          <div className="home-panel">
            <div className="home-panel-head">Shortcuts</div>
            <div className="home-panel-body">
              <div className="home-sc-group">
                <div className="home-sc-label">Tour</div>
                <div className="home-sc-row home-sc-grid">
                  <HomeShortcut onClick={() => call('go', 'shows')} icon="music" color="var(--accent-2)" label="Shows" />
                  <HomeShortcut onClick={() => call('go', 'trips')} icon="trips" color="var(--pink)" label="Tours" />
                  <HomeShortcut onClick={() => call('openView', 'itinerary')} icon="file" color="var(--blue)" label="Itinerary" />
                  <HomeShortcut onClick={() => call('sheetCalendarUpload')} icon="calendar" color="var(--green)" label="Upload calendar" />
                </div>
              </div>
              <div className="home-sc-group">
                <div className="home-sc-label">Desk</div>
                <div className="home-sc-row home-sc-grid">
                  <HomeShortcut onClick={() => call('sheetIdea')} icon="idea" color="var(--orange)" label="New idea" />
                  <HomeShortcut onClick={() => call('sheetNote')} icon="note" color="var(--blue)" label="New note" />
                  <HomeShortcut onClick={() => call('openView', 'finance')} icon="coins" color="var(--green)" label="Finance" />
                  <HomeShortcut onClick={() => call('openView', 'invoices')} icon="receipt" color="var(--blue)" label="Invoice" />
                  <HomeShortcut onClick={() => call('openView', 'contacts')} icon="users" color="var(--accent-2)" label="Contacts" />
                </div>
              </div>
            </div>
          </div>

          <div className="home-feed">
            {st.shows ? (
              <div className="home-panel tap" onClick={() => call('openView', 'stats')}>
                <div className="home-panel-head home-panel-head-flex">
                  <span>Schedule snapshot</span>
                  <span className="home-panel-link">All stats</span>
                </div>
                <div className="home-stat-grid">
                  {[
                    ['music', 'var(--accent-2)', st.upcoming, 'Shows'],
                    ['plane', 'var(--blue)', `${st.flightHrs}h`, 'In the air'],
                    ['trips', 'var(--green)', st.daysAway, 'Days away'],
                    ['globe', 'var(--pink)', st.cities, 'Cities'],
                  ].map(([icon, color, value, label]) => (
                    <div key={label} className="home-stat">
                      <div className="home-stat-k" style={{ color }}><Icon name={icon} size={14} /> {label}</div>
                      <div className="home-stat-v">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {todayChecklist.length && show ? (
              <HomePanel title="Today's checklist" link={<button type="button" className="home-panel-link" onClick={() => call('openView', 'event', show.id)}>Open show</button>}>
                <div className="card flush home-inset">
                  {todayChecklist.slice(0, 4).map(i => (
                    <div key={i.id} className={`check ${i.done ? 'done' : ''}`} data-id={i.id} onClick={() => call('toggleEventCheck', show.id, i.id)}>
                      <div className="box"><Icon name="check" size={15} /></div>
                      <div className="lbl">{i.label}</div>
                    </div>
                  ))}
                </div>
              </HomePanel>
            ) : null}

            {ideasWaiting.length ? (
              <HomePanel title="Ideas" link={<button type="button" className="home-panel-link" onClick={() => call('go', 'ideas')}>All</button>}>
                <div className="card flush home-inset">
                  {ideasWaiting.map(i => {
                    const t = types[i.type] || types.other || { label: 'Idea', color: 'var(--accent-2)' };
                    return (
                      <div key={i.id} className="home-mini-row" onClick={() => call('openView', 'idea', i.id)}>
                        <span className="home-mini-dot" style={{ background: t.color }} />
                        <span className="home-mini-t">{i.title}</span>
                        <span className="home-mini-meta">{t.label}</span>
                        <Icon name="chevR" size={14} />
                      </div>
                    );
                  })}
                </div>
              </HomePanel>
            ) : null}

            {trips.length ? (
              <HomePanel title="Upcoming tours" link={<button type="button" className="home-panel-link" onClick={() => call('goToursList')}>All</button>}>
                <div className="card flush home-inset">
                  {trips.map(r => {
                    const CATS = getCats() || {};
                    const c = CATS[r.color] || CATS.green || '#32d74b';
                    return (
                      <div key={r.key} className="row" onClick={() => call('openView', 'trip', r.key)}>
                        <div className="ic" style={{ background: `${c}22`, color: c }}><Icon name="trips" size={18} /></div>
                        <div className="body">
                          <b>{r.title}</b>
                          <span>{r.shows.length} show{r.shows.length !== 1 ? 's' : ''} · {fmtDate ? fmtDate(r.start) : r.start}</span>
                        </div>
                        <Icon name="chevR" size={15} />
                      </div>
                    );
                  })}
                </div>
              </HomePanel>
            ) : null}

            {recentNotes.length ? (
              <HomePanel title="Recent notes" link={<button type="button" className="home-panel-link" onClick={() => call('goNotes')}>All</button>}>
                <div className="card flush home-inset">
                  {recentNotes.map(n => {
                    const preview = (n.body || '').split('\n').filter(Boolean)[0] || 'No additional text';
                    return (
                      <div key={n.id} className="note-row" onClick={() => call('openView', 'note', n.id)}>
                        <b>{n.title || 'Untitled'}</b>
                        <span className="meta">
                          <span className="dt">{timeAgo ? timeAgo(n.updated) : ''}</span> · {preview.slice(0, 50)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </HomePanel>
            ) : null}
          </div>
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}
