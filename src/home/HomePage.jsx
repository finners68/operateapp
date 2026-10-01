import { useSyncExternalStore, useEffect, useState } from 'react';
import { call, countdown, flightHasDetails, fmtBase, fmtDate, getCats, getIdeaTypes, getMoney, getSel, getStore, pad, parseDT, relDay, showTitle, subscribeStore, tickCountdowns, timeAgo } from '../api/operate.js';
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

function HomeActions(){
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState('');
  useEffect(() => {
    if(!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  const choose = (fn) => {
    setOpen(false);
    fn();
  };
  return (
    <div className="home-actions">
      <button type="button" className="home-action" onClick={() => call('sheetEvent')}>
        <Icon name="plus" size={15} /> Add show
      </button>
      <button type="button" className="home-action is-strong" onClick={() => call('sheetItineraryStart')}>
        <Icon name="file" size={15} /> Upload itinerary
      </button>
      <button type="button" className="home-action is-strong" onClick={() => call('sheetCalendarUpload')}>
        <Icon name="calendar" size={15} /> Upload calendar
      </button>
      <div className="home-create">
        <button type="button" className="home-action" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
          <Icon name="plus" size={15} /> Create
        </button>
        {open ? (
          <div className="home-create-menu" onClick={e => e.stopPropagation()} onPointerLeave={() => setOn('')}>
            {[
              ['idea', 'New idea', () => call('sheetIdea')],
              ['note', 'New note', () => call('sheetNote')],
              ['invoice', 'Create invoice', () => call('pickEventForInvoice')],
              ['contact', 'New contact', () => call('sheetContact')],
            ].map(([id, label, fn]) => (
              <button
                key={id}
                type="button"
                className={on === id ? 'is-on' : ''}
                onPointerDown={() => setOn(id)}
                onPointerEnter={e => { if(e.pointerType === 'mouse' || e.buttons) setOn(id); }}
                onClick={() => choose(fn)}
              >{label}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
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

function NoShowsCard(){
  return (
    <div className="home-empty-card">
      <b>No upcoming shows</b>
      <span>Add a show to start planning travel and show day.</span>
      <button type="button" className="home-action" onClick={() => call('sheetEvent')}>
        <Icon name="plus" size={15} /> Add show
      </button>
    </div>
  );
}

function NextShowHero({ show, compact = false }){
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
    <div className={`hero tap nextshow${compact ? ' home-next-compact' : ''}`} onClick={() => call('openView', 'event', show.id)}>
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
            <Icon name="bed" size={14} /> {show.hotel.name || 'Accommodation'}
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

function TourBanner({ run, secondary = false, nextStep = null }){
  const p = call('runProgress', run) || { done: 0, total: 0, pct: 0 };
  return (
    <div className={`tourmode-card tap${secondary ? ' is-secondary' : ''}`} onClick={() => call('go', 'trips')}>
      <div className="tourmode-top">
        <span className="tourmode-badge"><Icon name="planeTop" size={15} /> Tour Mode</span>
        <span className="tourmode-live"><span className="pulse" /> LIVE</span>
      </div>
      <div className="tourmode-title">{run.title}</div>
      <div className="tourmode-meta">{run.shows.length} show{run.shows.length > 1 ? 's' : ''} · {p.done}/{p.total} steps</div>
      <div className="tourmode-bar"><i style={{ width: `${p.pct}%` }} /></div>
      {nextStep ? (
        <div className="tourmode-next">
          <span>Up next{nextStep.time ? ` · ${nextStep.time}` : ''}</span>
          <b>{nextStep.title}</b>
        </div>
      ) : null}
      <div className="tourmode-cta">Open Tour Mode <Icon name="chevR" size={15} /></div>
    </div>
  );
}

function isoToday(){
  const fromApp = call('todayISO');
  if(fromApp) return fromApp;
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function addDays(iso, days){
  const d = parseDT ? parseDT(iso) : null;
  if(!d) return '';
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function showLabel(show){
  return showTitle(show) || show?.venue || 'Show';
}

function invoiceDue(inv){
  if(inv?.dueDate) return String(inv.dueDate).slice(0, 10);
  if(!inv?.date || inv.terms == null || inv.terms === '') return '';
  return addDays(inv.date, Number(inv.terms) || 0);
}

function UpNextCard({ step, title, large }){
  if(!step) return null;
  const pills = call('stepPills', step) || '';
  const showId = step.showId || step.ref?.showId;
  return (
    <div className={`hero nextshow tap${large ? '' : ' home-next-compact'}`} onClick={() => showId && call('openView', 'event', showId)}>
      <div className="hero-label">
        <Icon name={step.icon || 'clock'} size={14} /> {title}{step.time ? ` · ${step.time}` : ''}
      </div>
      <div className="hero-venue">{step.title}</div>
      {step.sub ? <div className="hero-city">{step.sub}</div> : null}
      {pills ? <div className="hero-links" onClick={e => e.stopPropagation()} dangerouslySetInnerHTML={{ __html: pills }} /> : null}
    </div>
  );
}

function ShowRows({ shows }){
  if(!shows.length) return null;
  return (
    <div className="card flush home-inset">
      {shows.map(e => (
        <div key={e.id} className="row" onClick={() => call('openView', 'event', e.id)}>
          <div className="ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent-2)' }}><Icon name="music" size={16} /></div>
          <div className="body">
            <b>
              {showLabel(e)}
              {e.status === 'hold' ? <span className="tag hold" style={{ marginLeft: 6 }}>Hold</span> : null}
            </b>
            <span>
              {fmtDate ? fmtDate(e.date) : e.date}
              {e.city ? ` · ${e.city}` : ''}
              {e.setTime ? ` · ${e.setTime}${e.endTime ? `–${e.endTime}` : ''}` : ''}
            </span>
          </div>
          <Icon name="chevR" size={15} />
        </div>
      ))}
    </div>
  );
}

function ChecklistBlock({ title, rows, link }){
  if(!rows.length) return null;
  return (
    <HomePanel title={title} link={link}>
      <div className="card flush home-inset">
        {rows.map(row => (
          <div key={row.key} className={`check ${row.done ? 'done' : ''}`} onClick={() => call('toggleEventCheck', row.showId, row.id)}>
            <div className="box"><Icon name="check" size={15} /></div>
            <div className="lbl">{row.label}{row.showName ? <span style={{ display: 'block', color: 'var(--text-3)', fontWeight: 400, marginTop: 2 }}>{row.showName}</span> : null}</div>
          </div>
        ))}
      </div>
    </HomePanel>
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
  const persona = call('homePersona') || 'dj';
  const blurb = call('homePersonaBlurb') || 'Your next show and travel at a glance';
  const liveRun = call('activeRun');
  const upcoming = sel?.upcoming ? sel.upcoming() : [];
  const show = upcoming[0] || null;
  const focusRun = liveRun || (show ? call('runOf', show.id) : null);
  const timeline = focusRun ? (call('runTimeline', focusRun) || []) : [];
  const nextStep = timeline.find(s => !s.done) || null;
  const nextTravel = timeline.find(s => !s.done && (s.kind === 'travel' || s.kind === 'stay')) || null;
  const today = isoToday();
  const soon = addDays(today, 14);
  const todaySteps = timeline.filter(s => !s.done && (s.trueDate || s.date) === today && s.id !== nextStep?.id).slice(0, 6);
  const greet = greeting();
  const nameBit = store?.settings?.artistName && store.settings.artistName !== 'You'
    ? `, ${store.settings.artistName}`
    : '';
  const photo = store?.settings?._homeHeaderUrl || store?.settings?.homeHeader;
  const st = call('computeStats') || {};
  const ideasWaiting = sel?.ideas ? sel.ideas().filter(i => !i.done).slice(0, 2) : [];
  const recentNotes = sel?.notes ? sel.notes().slice(0, 2) : [];
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const trips = (call('runs') || []).filter(r => {
    const end = parseDT ? parseDT(r.end) : null;
    if(!end || end < today0) return false;
    if(liveRun && r.key === liveRun.key) return false;
    return true;
  }).slice(0, 2);
  const types = getIdeaTypes() || {};
  const holds = upcoming.filter(e => e.status === 'hold');
  const confirmed = upcoming.filter(e => e.status !== 'hold');
  const listShows = (persona === 'agent' ? confirmed : upcoming).filter(e => liveRun || e.id !== show?.id).slice(0, 6);
  const openChecks = [];
  upcoming.slice(0, 6).forEach(e => {
    (e.checklist || []).forEach(item => {
      if(!item.done) openChecks.push({ key: e.id + '-' + item.id, id: item.id, showId: e.id, label: item.label, showName: persona === 'dj' ? '' : showLabel(e), done: false });
    });
  });
  const artistChecks = (show?.checklist || []).filter(i => !i.done).slice(0, 4).map(i => ({
    key: i.id, id: i.id, showId: show.id, label: i.label, showName: '', done: !!i.done
  }));
  const taskRows = (persona === 'dj' ? artistChecks : openChecks.slice(0, 5));
  const contacts = focusRun ? (call('tourContacts', focusRun) || []).slice(0, 4) : [];
  const journeysLeft = timeline.filter(s => s.kind === 'travel' && !s.done).length;
  const hotelsLeft = timeline.filter(s => s.kind === 'stay' && !s.done).length;
  let driversLeft = 0;
  (focusRun?.shows || []).forEach(s => {
    const ds = call('showDrivers', s) || [];
    driversLeft += ds.filter(d => !d.noGround && (d.name || d.phone || d.whatsapp)).length;
  });
  const moneyApi = getMoney();
  const feeShows = confirmed.filter(e => e.finance && Number(e.finance.fee) > 0);
  const missingFee = confirmed.filter(e => !e.finance || !Number(e.finance.fee)).length;
  const feeSummary = moneyApi && feeShows.length ? moneyApi.summary(feeShows) : null;
  const invoices = store?.invoices || [];
  const sentInvoices = invoices.filter(inv => inv.status === 'sent');
  const overdueInvoices = sentInvoices.filter(inv => {
    const due = invoiceDue(inv);
    return due && due < today;
  });
  const attention = [];
  overdueInvoices.forEach(inv => {
    const ev = inv.eventId && sel?.event ? sel.event(inv.eventId) : null;
    attention.push({ id: 'inv-' + inv.id, title: 'Invoice overdue', sub: ev ? showLabel(ev) : (inv.client || inv.number || 'Invoice'), go: () => call('openView', 'invoice', inv.id) });
  });
  upcoming.slice(0, 8).forEach(e => {
    const hasHotel = !!(e.hotel && (e.hotel.name || e.hotel.address || e.hotel.city));
    const hasFlight = (e.flights || []).some(f => !flightHasDetails || flightHasDetails(f));
    const drivers = call('showDrivers', e) || [];
    const hasGround = drivers.some(d => d.time || d.name || d.phone);
    const hasTravelLeg = (store?.events || []).some(x => x.showId === e.id && x.kind === 'travel');
    if(!hasHotel && (hasFlight || hasGround || hasTravelLeg) && e.date && e.date <= soon){
      attention.push({ id: 'hotel-' + e.id, title: 'No hotel yet', sub: showLabel(e), go: () => call('openView', 'event', e.id) });
    }
  });
  holds.slice(0, 2).forEach(e => {
    attention.push({ id: 'hold-' + e.id, title: 'Hold', sub: showLabel(e), go: () => call('openView', 'event', e.id) });
  });
  const byDate = {};
  upcoming.forEach(e => {
    if(!e.date) return;
    (byDate[e.date] = byDate[e.date] || []).push(e);
  });
  const conflicts = Object.values(byDate).filter(list => list.length > 1);
  const nextFee = show && moneyApi ? moneyApi.eventCalc(show) : null;
  const showNextFee = !!(nextFee && nextFee.gross > 0);
  const tourSecondary = false;
  const upcomingTitle = persona === 'agent' ? 'Confirmed shows' : persona === 'tm' ? 'Show schedule' : 'Upcoming shows';
  const blocks = {
    next: show ? <NextShowHero show={show} /> : <NoShowsCard />,
    attention: attention.length ? (
      <div className="home-panel">
        <div className="home-panel-head">Needs attention</div>
        <div className="home-attn-count">{attention.length} item{attention.length === 1 ? '' : 's'}</div>
        <div className="card flush home-inset">
          {attention.slice(0, 6).map(item => (
            <div key={item.id} className="home-mini-row" onClick={item.go}>
              <span className="home-mini-dot" style={{ background: 'var(--orange)' }} />
              <span className="home-mini-t">{item.title}</span>
              <span className="home-mini-meta">{item.sub}</span>
              <Icon name="chevR" size={14} />
            </div>
          ))}
        </div>
      </div>
    ) : null,
    holds: holds.length ? (
      <HomePanel title="Holds" link={<button type="button" className="home-panel-link" onClick={() => call('go', 'shows')}>Shows</button>}>
        <ShowRows shows={holds.slice(0, 4)} />
      </HomePanel>
    ) : null,
    tour: liveRun ? <div className="tourmode-wrap"><TourBanner run={liveRun} secondary={tourSecondary} nextStep={nextStep} /></div> : null,
    upnext: nextStep ? <UpNextCard step={nextStep} title="Up next" large={false} /> : null,
    travel: persona === 'dj'
      ? (nextTravel ? <UpNextCard step={nextTravel} title="Up next travel" large={false} /> : null)
      : ((journeysLeft || hotelsLeft || driversLeft) ? (
        <HomePanel title={persona === 'tm' ? 'Travel and stay' : 'Travel overview'} link={focusRun ? <button type="button" className="home-panel-link" onClick={() => call('go', 'trips')}>Tour</button> : null}>
          <div className="home-stat-grid">
            {journeysLeft ? <div className="home-stat"><div className="home-stat-k" style={{ color: 'var(--blue)' }}><Icon name="plane" size={14} /> Journeys</div><div className="home-stat-v">{journeysLeft}</div></div> : null}
            {hotelsLeft ? <div className="home-stat"><div className="home-stat-k" style={{ color: 'var(--accent-2)' }}><Icon name="bed" size={14} /> Hotels</div><div className="home-stat-v">{hotelsLeft}</div></div> : null}
            {driversLeft ? <div className="home-stat"><div className="home-stat-k" style={{ color: 'var(--green)' }}><Icon name="car" size={14} /> Drivers</div><div className="home-stat-v">{driversLeft}</div></div> : null}
          </div>
        </HomePanel>
      ) : null),
    today: todaySteps.length ? (
      <HomePanel title="Today">
        <div className="card flush home-inset">
          {todaySteps.map(s => (
            <div key={s.id} className="home-mini-row" onClick={() => s.showId && call('openView', 'event', s.showId)}>
              <span className="home-mini-meta">{s.time || '—'}</span>
              <span className="home-mini-t">{s.title}</span>
            </div>
          ))}
        </div>
      </HomePanel>
    ) : null,
    contacts: contacts.length ? (
      <HomePanel title={persona === 'agent' ? 'Booking contacts' : persona === 'tm' ? 'Key contacts' : 'Quick contacts'} link={focusRun ? <button type="button" className="home-panel-link" onClick={() => call('openTourContacts', focusRun.key)}>All</button> : null}>
        <div className="card flush home-inset">
          {contacts.map((c, i) => (
            <div key={i} className="home-mini-row" onClick={() => call('openTourContacts', focusRun.key)}>
              <span className="home-mini-dot" style={{ background: 'var(--accent-2)' }} />
              <span className="home-mini-t">{c.name || c.label}</span>
              <span className="home-mini-meta">{c.label}</span>
            </div>
          ))}
        </div>
      </HomePanel>
    ) : null,
    upcoming: listShows.length ? (
      <HomePanel title={upcomingTitle} link={<button type="button" className="home-panel-link" onClick={() => call('go', 'shows')}>All</button>}>
        <ShowRows shows={listShows} />
      </HomePanel>
    ) : null,
    conflicts: conflicts.length ? (
      <HomePanel title="Same-day shows" link={<button type="button" className="home-panel-link" onClick={() => call('go', 'calendar')}>Calendar</button>}>
        <div className="card flush home-inset">
          {conflicts.slice(0, 3).map(list => (
            <div key={list[0].date} className="home-mini-row" onClick={() => call('go', 'calendar')}>
              <span className="home-mini-dot" style={{ background: 'var(--orange)' }} />
              <span className="home-mini-t">{fmtDate ? fmtDate(list[0].date) : list[0].date}</span>
              <span className="home-mini-meta">{list.length} shows</span>
            </div>
          ))}
        </div>
      </HomePanel>
    ) : null,
    finance: (feeSummary || missingFee || sentInvoices.length) ? (
      <div className="home-panel">
        <div className="home-panel-head">{persona === 'agent' ? 'Deals' : 'Deals and finance'}</div>
        {feeSummary ? <div className="home-line" onClick={() => call('openView', 'finance')}><b>Confirmed fees</b><span>{fmtBase(feeSummary.grossBase)}</span></div> : null}
        {sentInvoices.length ? <div className="home-line" onClick={() => call('openView', 'invoices')}><b>Invoices sent</b><span>{sentInvoices.length}{overdueInvoices.length ? ` · ${overdueInvoices.length} overdue` : ''}</span></div> : null}
        {missingFee ? <div className="home-line" onClick={() => call('go', 'shows')}><b>No fee yet</b><span>{missingFee}</span></div> : null}
      </div>
    ) : null,
    fee: showNextFee ? (
      <div className="home-panel">
        <div className="home-line" onClick={() => call('openView', 'event', show.id)}><b>Next show fee</b><span>{fmtBase(nextFee.grossBase)}{nextFee.paid ? ' · paid' : ''}</span></div>
      </div>
    ) : null,
    tasks: taskRows.length ? (
      <ChecklistBlock
        title={persona === 'dj' ? 'Today' : `Tasks · ${openChecks.length} open`}
        rows={taskRows}
        link={show ? <button type="button" className="home-panel-link" onClick={() => call('openView', 'event', show.id)}>Open show</button> : null}
      />
    ) : null,
  };
  const header = (
    <div className={`home-hero${photo ? '' : ' is-default'}`} style={photo ? { backgroundImage: `url('${photo}')`, backgroundPosition: call('homeHeaderPositionCss') || 'center' } : undefined}>
      <div className="home-hero-actions">
        <button type="button" className="header-btn glass" onClick={() => call('openSearch')}><Icon name="search" size={20} /></button>
        <button type="button" className="header-btn glass" onClick={() => call('openView', 'settings')}><Icon name="settings" size={20} /></button>
      </div>
      <div className="home-hero-text">
        <div className="hero-hello">{greet}{nameBit}</div>
        <div className="hero-home">Home</div>
        <div className="hero-date">{blurb}</div>
      </div>
    </div>
  );

  return (
    <div className="tab-page">
      {header}
      <div className="screen-pad home-screen tab-page-body" style={{ marginTop: 12 }}>
        <HomeActions />
        <div className="home-board">
          <div className="home-slot home-slot-primary">
            {liveRun ? blocks.tour : blocks.next}
          </div>
          <div className="home-slot home-slot-secondary">
            {persona === 'manager' ? blocks.attention : null}
            {persona === 'agent' ? blocks.holds : null}
            {persona === 'tm' && !liveRun ? blocks.upnext : null}
            {(persona !== 'dj' || !(liveRun && nextTravel && nextStep && nextTravel.id === nextStep.id)) ? blocks.travel : null}
            {persona === 'agent' ? blocks.conflicts : null}
            {persona === 'manager' || persona === 'agent' ? blocks.finance : null}
            {blocks.contacts}
            {persona === 'dj' ? blocks.fee : null}
          </div>
          <div className="home-slot home-slot-tasks">
            {persona === 'tm' ? blocks.today : null}
            {blocks.tasks}
          </div>
          <div className="home-slot home-slot-upcoming">
            {blocks.upcoming}
          </div>
          <div className="home-slot home-slot-snapshot">
            <div className="home-panel tap" onClick={() => call('openView', 'stats')}>
              <div className="home-panel-head home-panel-head-flex">
                <span>Schedule snapshot</span>
                <span className="home-panel-link">All stats</span>
              </div>
              <div className="home-stat-grid">
                {[
                  ['music', 'var(--accent-2)', st.upcoming ?? 0, 'Shows'],
                  ['plane', 'var(--blue)', `${st.flightHrs || 0}h`, 'Flight time'],
                  ['trips', 'var(--green)', st.daysAway ?? 0, 'Days away'],
                  ['globe', 'var(--pink)', st.cities ?? 0, 'Cities'],
                ].map(([icon, color, value, label]) => (
                  <div key={label} className="home-stat">
                    <div className="home-stat-k" style={{ color }}><Icon name={icon} size={14} /> {label}</div>
                    <div className="home-stat-v">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="home-layout">
          <div className="home-feed">
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
