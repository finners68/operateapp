import { useSyncExternalStore, useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { call, countdown, flightHasDetails, fmtDate, fmtDateLong, getSel, getStore, notifyStore, pad, parseDT, showTitle, subscribeStore, tickCountdowns } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';
import {
  activityKindLabel, buildTodayScheduleRows, stepLocation, todayScheduleLiveState, todayStepDetail, todayStepStatus,
} from './todaySchedule.js';
import {
  collectAccommodationBookings, formatStayWhen, hotelConfirmationPass, pickAccommodation, statusLabel,
} from './accommodation.js';
import {
  collectJourneys, formatJourneyWhen, journeyBoardingPass, journeyCountdown, journeyStatusLabel, pickNextJourney,
} from './upcomingTravel.js';
import {
  collectUpcomingShows, showCountdownLabel, showCountdownMs, showListStatus, showLocationLine,
  showPerformanceTitle, showSetTimeLine, showVenueLine,
} from './upcomingShows.js';
import {
  HOME_CONTACT_CATEGORIES, buildHomeKeyContactsGrouped, openHomeContact,
} from './keyContacts.js';
import {
  addHomeReminder, addHomeTask, collectHomeTasks, completeHomeTask, formatTaskDue,
  openHomeTask, priorityLabel, statusLabel as taskStatusLabel,
} from './tasksReminders.js';
import { previewTime, timelineIcon } from '../show/timelineShared.jsx';
import {
  HOME_GRID_BASE_COLS, HOME_GRID_ROW_PX, appendGridWidget, colsForViewportWidth,
  displayGridItem, listCapForWidget,
  placeGridWidgetAtPointer,
  removeGridWidget, replaceGridWidgetId, setWidgetSize, sizeTitle, sizeToDensity,
  sortGridItems, storeGridItem, widgetSizeOptions,
} from './homeWidgetGrid.js';
import {
  availableHomeWidgets, homeWidgetMeta, readHomeWidgetGrid, resetHomeWidgetLayout,
  swapOptionsForWidget, writeHomeWidgetGrid,
} from './homeWidgetMeta.js';

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
  const choose = (fn: any) => {
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
        <button type="button" className="home-action" aria-expanded={open} onClick={(e: any) => { e.stopPropagation(); setOpen((v: any) => !v); }}>
          <Icon name="plus" size={15} /> Create
        </button>
        {open ? (
          <div className="home-create-menu" onClick={(e: any) => e.stopPropagation()} onPointerLeave={() => setOn('')}>
            {[
              ['idea', 'New idea', () => call('sheetIdea')],
              ['note', 'New note', () => call('sheetNote')],
              ['invoice', 'Create invoice', () => call('pickEventForInvoice')],
              ['contact', 'New contact', () => call('sheetContact')],
            ].map(([id, label, fn]: any) => (
              <button
                key={id}
                type="button"
                className={on === id ? 'is-on' : ''}
                onPointerDown={() => setOn(id)}
                onPointerEnter={(e: any) => { if(e.pointerType === 'mouse' || e.buttons) setOn(id); }}
                onClick={() => choose(fn)}
              >{label}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HomePanel({ title, link, children }: Record<string, any>){
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

function showArtworkUrl(show: any){
  const att = (show?.attachments || []).find((a: any) => a && a.kind === 'image' && a.data);
  return att?.data || null;
}

function showVenueTimeNote(show: any){
  const tz = show?.venueTimezone || show?.venue_timezone || show?.showTimezone || show?.show_timezone;
  if(tz){
    try{
      const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
      const zn = parts.find((p: any) => p.type === 'timeZoneName')?.value;
      if(zn) return `Venue time · ${zn}`;
    }catch(_){}
    return 'Venue local time';
  }
  if(show?.city) return `Venue time · ${show.city}`;
  return null;
}

function showStatusTag(show: any){
  const st = show?.status || 'confirmed';
  if(st === 'hold'){
    return <span className="tag hold home-next-show-status">Tentative</span>;
  }
  if(st === 'cancelled'){
    return <span className="tag cancelled home-next-show-status">Cancelled</span>;
  }
  if(st === 'confirmed'){
    return <span className="tag confirmed home-next-show-status">Confirmed</span>;
  }
  return null;
}

function nextShowCountdownMs(show: any){
  const setMs = call('setStartMs', show.date, show.setTime);
  if(setMs) return setMs;
  const d = parseDT ? parseDT(show.date) : null;
  return d ? d.getTime() : null;
}

function findNextShow(sel: any){
  const list = sel?.events ? sel.events() : [];
  return list.find((e: any) => {
    if(e.status === 'cancelled') return false;
    const passed = call('showPassed', e);
    return passed !== true;
  }) || null;
}

function NextShowHero({ show, density = 'default' }: Record<string, any>){
  const compact = density === 'compact';
  const artwork = showArtworkUrl(show);
  const title = show.eventName || show.venue || 'Show';
  const venueLine = show.eventName && show.venue ? show.venue : (!show.eventName && show.venue ? null : (show.venue && show.venue !== title ? show.venue : null));
  const location = [show.city, show.country].filter(Boolean).join(', ');
  const dateLine = fmtDateLong ? fmtDateLong(show.date) : (fmtDate ? fmtDate(show.date) : show.date);
  const timeNote = showVenueTimeNote(show);
  const setMs = nextShowCountdownMs(show);
  const cS = setMs && countdown ? countdown(setMs) : null;
  const countdownLive = !!(setMs && cS && !cS.done);
  const drivers = call('showDrivers', show) || [];
  const hasContacts = showKeyContacts(show).length > 0
    || drivers.some((d: any) => !d.noGround && (d.phone || d.whatsapp));
  const venueQ = call('venueMapQuery', show)
    || call('formatVenueAddress', show)
    || location;
  const hasSet = !!(show.setTime || show.endTime);

  return (
    <div className={`hero tap nextshow home-next-show${artwork ? ' has-art' : ''}${compact ? ' is-compact' : ''}`} onClick={() => call('openView', 'event', show.id)}>
      <div className="home-next-show-head">
        <div className="home-next-show-intro">
          <span className="hero-label home-next-show-kicker"><Icon name="music" size={14} /> Next show</span>
          <div className="home-next-show-tags">{showStatusTag(show)}</div>
        </div>
        {artwork && !compact ? (
          <div className="home-next-show-art" aria-hidden>
            <img src={artwork} alt="" />
          </div>
        ) : null}
      </div>
      <h2 className="hero-venue home-next-show-title">{title}</h2>
      {venueLine ? <div className="hero-venue-sub home-next-show-venue">{venueLine}</div> : null}
      {location ? (
        <div className="hero-city home-next-show-loc">
          <Icon name="pin" size={14} /> {location}
        </div>
      ) : null}
      {show.date ? <div className="home-next-show-date">{dateLine}</div> : null}
      <div className={`count-row home-next-show-stats${!hasSet ? ' is-single' : ''}`}>
        {hasSet ? (
          <div className="count">
            <div className="count-k"><Icon name="music" size={12} /> Set time</div>
            <div className="count-v home-next-show-set">
              {show.setTime || 'TBA'}{show.endTime ? <small> – {show.endTime}</small> : null}
            </div>
            {timeNote ? <div className="home-next-show-tz">{timeNote}</div> : null}
          </div>
        ) : timeNote ? (
          <div className="count">
            <div className="count-k"><Icon name="clock" size={12} /> Time zone</div>
            <div className="count-v" style={{ fontSize: 15 }}>{timeNote}</div>
          </div>
        ) : null}
        {setMs ? (
          <div className="count">
            <div className="count-k"><Icon name="clock" size={12} /> {countdownLive ? 'Starts in' : 'Show time'}</div>
            <div className="count-v" {...(countdownLive ? { 'data-countdown-ms': setMs } : {})}>
              <span className="cd-txt">{countdownLive ? cS.txt : 'Today'}</span>
              <small className="cd-unit">{countdownLive ? cS.unit : ''}</small>
            </div>
          </div>
        ) : null}
      </div>
      {(venueQ || hasContacts) ? (
        <div className="hero-links home-next-show-links">
          {venueQ ? (
            <button type="button" className="hero-link" onClick={(e: any) => { e.stopPropagation(); call('openMaps', venueQ); }}>
              <Icon name="map" size={14} /> Directions
            </button>
          ) : null}
          {hasContacts ? (
            <button type="button" className="hero-link" onClick={(e: any) => { e.stopPropagation(); call('openTourContacts', show.id); }}>
              <Icon name="users" size={14} /> Key contacts
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TourBanner({ run, secondary = false, nextStep = null }: Record<string, any>){
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

function showLabel(show: any){
  return showTitle(show) || show?.venue || 'Show';
}

function UpNextCard({ step, title, large }: Record<string, any>){
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
      {pills ? <div className="hero-links" onClick={(e: any) => e.stopPropagation()} dangerouslySetInnerHTML={{ __html: pills }} /> : null}
    </div>
  );
}

function showKeyContacts(show: any){
  if(!show) return [];
  const out: any[] = [];
  const p = show.promoter;
  if(p && (p.name || p.phone || p.whatsapp)){
    out.push({ name: p.name || 'Promoter', label: 'Promoter', phone: p.phone, whatsapp: p.whatsapp });
  }
  (call('showDrivers', show) || []).forEach((d: any) => {
    if(d.noGround || !(d.name || d.phone || d.whatsapp)) return;
    out.push({ name: d.name || 'Driver', label: d.label || 'Driver', phone: d.phone, whatsapp: d.whatsapp });
  });
  const h = show.hotel;
  if(h && (h.phone || h.whatsapp)){
    out.push({ name: h.name || 'Hotel', label: 'Hotel', phone: h.phone, whatsapp: h.whatsapp });
  }
  return out.filter((c: any) => c.phone || c.whatsapp);
}

function UpcomingTravelWidget({ journey, show, density = 'default' }: Record<string, any>){
  const compact = density === 'compact';
  if(!journey){
    return (
      <HomePanel title="Upcoming travel">
        <div className="home-travel-empty">
          <span className="hint">No upcoming journeys scheduled.</span>
          <span className="hint" style={{ display: 'block', marginTop: 6, fontSize: 12.5 }}>
            Add flights, trains or transfers on a show to see them here.
          </span>
        </div>
      </HomePanel>
    );
  }

  const status = journey.status || 'upcoming';
  const stClass = status === 'ongoing' ? 'is-ongoing' : 'is-upcoming';
  const cd = status === 'upcoming' && journey.depMs ? journeyCountdown(journey.depMs) : null;
  const pass = journeyBoardingPass(journey);
  const detailLine = [journey.detail, journey.provider].filter(Boolean).join(' · ');

  const openDetails = () => {
    if(journey.showId) call('openView', 'event', journey.showId);
  };

  return (
    <HomePanel
      title="Upcoming travel"
      link={journey.showId ? <button type="button" className="home-panel-link" onClick={openDetails}>Details</button> : null}
    >
      <div className={`home-travel-card tap${stClass}${compact ? ' is-compact' : ''}`} onClick={openDetails}>
        <div className="home-travel-head">
          <button type="button" className="home-travel-type" onClick={(e: any) => e.stopPropagation()}>
            <Icon name={journey.icon || 'planeTop'} size={16} /> {journey.typeLabel}
          </button>
          <span className={`tag home-travel-status ${stClass}`}>{journeyStatusLabel(status)}</span>
        </div>
        {cd ? (
          <div className="home-travel-countdown" {...(journey.depMs ? { 'data-countdown-ms': journey.depMs } : {})}>
            <span className="home-travel-countdown-k">Departs in</span>
            <span className="home-travel-countdown-v">
              <span className="cd-txt">{cd.txt}</span>
              {cd.unit ? <small className="cd-unit">{cd.unit}</small> : null}
            </span>
          </div>
        ) : null}
        <div className="home-travel-legs">
          <div className="home-travel-end">
            <span className="home-travel-end-k">Departure</span>
            {journey.depPlace ? <b className="home-travel-place">{journey.depPlace}</b> : null}
            {journey.depDate || journey.depTime ? (
              <span className="home-travel-when">{formatJourneyWhen(journey.depDate, journey.depTime)}</span>
            ) : null}
          </div>
          <div className="home-travel-mid" aria-hidden><Icon name="chevR" size={16} /></div>
          <div className="home-travel-end">
            <span className="home-travel-end-k">Arrival</span>
            {journey.arrPlace ? <b className="home-travel-place">{journey.arrPlace}</b> : null}
            {journey.arrDate || journey.arrTime ? (
              <span className="home-travel-when">{formatJourneyWhen(journey.arrDate, journey.arrTime)}</span>
            ) : null}
          </div>
        </div>
        {detailLine ? <div className="home-travel-detail">{detailLine}</div> : null}
        {journey.bookingRef ? <div className="home-line home-travel-ref"><b>Booking ref</b><span>{journey.bookingRef}</span></div> : null}
        <div className="hero-links home-travel-links" onClick={(e: any) => e.stopPropagation()}>
          {journey.mapsQuery ? (
            <button type="button" className="hero-link" onClick={() => call('openMaps', journey.mapsQuery)}>
              <Icon name="map" size={14} /> Directions
            </button>
          ) : null}
          {(journey.phone || journey.whatsapp) ? (
            <button type="button" className="hero-link" onClick={() => call('whatsapp', journey.whatsapp || journey.phone)}>
              <Icon name="chat" size={14} /> Driver
            </button>
          ) : null}
          {journey.phone ? (
            <button type="button" className="hero-link" onClick={() => call('callNumber', journey.phone)}>
              <Icon name="phone" size={14} /> Call
            </button>
          ) : null}
          {pass?.showId ? (
            <button
              type="button"
              className="hero-link"
              onClick={() => call('openPassByRef', pass.showId, pass.pass?.id, pass.flightId)}
            >
              <Icon name="ticket" size={14} /> Ticket
            </button>
          ) : pass?.legId ? (
            <button type="button" className="hero-link" onClick={() => call('viewItemPass', pass.legId, pass.pass?.id)}>
              <Icon name="ticket" size={14} /> Ticket
            </button>
          ) : null}
          {journey.bookingRef ? (
            <button type="button" className="hero-link" onClick={() => call('copyText', journey.bookingRef)}>
              <Icon name="copy" size={14} /> Copy ref
            </button>
          ) : null}
        </div>
      </div>
    </HomePanel>
  );
}

function AccommodationWidget({ booking, show, density = 'default' }: Record<string, any>){
  const compact = density === 'compact';
  if(!booking){
    return (
      <HomePanel title="Accommodation">
        <div className="home-acc-empty">
          <span className="hint">No accommodation booked yet.</span>
          <span className="hint" style={{ display: 'block', marginTop: 6, fontSize: 12.5 }}>
            Add a hotel on a show and it will appear here before check-in.
          </span>
        </div>
      </HomePanel>
    );
  }

  const checkInLine = formatStayWhen(booking.checkin, booking.checkInTime);
  const checkOutLine = formatStayWhen(booking.checkout, booking.checkOutTime);
  const roomBits = [booking.room, booking.roomType].filter(Boolean).join(booking.room && booking.roomType ? ' · ' : '');
  const pass = hotelConfirmationPass(show);
  const status = booking.status || 'upcoming';
  const stClass = status === 'staying' ? 'is-staying' : 'is-upcoming';

  const openDetails = () => {
    if(booking.showId) call('openView', 'event', booking.showId);
  };

  return (
    <HomePanel
      title="Accommodation"
      link={booking.showId ? <button type="button" className="home-panel-link" onClick={openDetails}>Details</button> : null}
    >
      <div className={`home-acc-card tap${stClass}${compact ? ' is-compact' : ''}`} onClick={openDetails}>
        <div className="home-acc-head">
          <div className="home-acc-icon" aria-hidden><Icon name="bed" size={18} /></div>
          <div className="home-acc-head-text">
            <span className={`tag home-acc-status ${stClass}`}>{statusLabel(status)}</span>
            <h3 className="home-acc-name">{booking.name}</h3>
            {booking.location ? <div className="home-acc-loc"><Icon name="pin" size={13} /> {booking.location}</div> : null}
          </div>
        </div>
        {(checkInLine || checkOutLine) ? (
          <div className="home-acc-dates">
            {checkInLine ? (
              <div className="home-acc-date">
                <span className="home-acc-date-k">Check-in</span>
                <span className="home-acc-date-v">{checkInLine}</span>
              </div>
            ) : null}
            {checkOutLine ? (
              <div className="home-acc-date">
                <span className="home-acc-date-k">Check-out</span>
                <span className="home-acc-date-v">{checkOutLine}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {booking.address ? <div className="home-acc-addr">{booking.address}</div> : null}
        {roomBits ? <div className="home-line home-acc-room"><b>Room</b><span>{roomBits}</span></div> : null}
        {booking.bookingRef ? <div className="home-line home-acc-ref"><b>Booking ref</b><span>{booking.bookingRef}</span></div> : null}
        {booking.phone ? <div className="home-line home-acc-phone"><b>Hotel</b><span>{booking.phone}</span></div> : null}
        <div className="hero-links home-acc-links" onClick={(e: any) => e.stopPropagation()}>
          {booking.mapsQ ? (
            <button type="button" className="hero-link" onClick={() => call('openMaps', booking.mapsQ)}>
              <Icon name="map" size={14} /> Directions
            </button>
          ) : null}
          {booking.phone ? (
            <button type="button" className="hero-link" onClick={() => call('callNumber', booking.phone)}>
              <Icon name="phone" size={14} /> Call hotel
            </button>
          ) : null}
          {pass ? (
            <button
              type="button"
              className="hero-link"
              onClick={() => call('viewItemPass', pass.legId, pass.pass?.id)}
            >
              <Icon name="ticket" size={14} /> Confirmation
            </button>
          ) : null}
          {booking.bookingRef ? (
            <button type="button" className="hero-link" onClick={() => call('copyText', booking.bookingRef)}>
              <Icon name="copy" size={14} /> Copy ref
            </button>
          ) : null}
        </div>
      </div>
    </HomePanel>
  );
}

function HomeTodayCompactRow({ row, live, focusRun, onRefresh }: Record<string, any>){
  const step = row.timelineStep;
  const raw = row.runStep;
  const status = todayStepStatus(step, live);
  const time = previewTime(step) || '—';
  const kind = activityKindLabel(step?.kind);
  const loc = stepLocation(step, row.show, raw);
  const detail = todayStepDetail(step, raw);
  const icon = timelineIcon(step?.kind, step?.icon);
  const rowStyle = status === 'now' && live?.progress
    ? { '--tl-now-progress': String(live.progress) }
    : undefined;

  const open = () => {
    if(raw && focusRun?.key){
      call('timelineStepOptions', focusRun.key, raw.id);
      return;
    }
    if(row.showId) call('openView', 'event', row.showId);
  };

  const toggle = (ev: any) => {
    ev.stopPropagation();
    if(raw && focusRun?.key){
      call('completeRunStep', focusRun.key, raw.id);
      onRefresh?.();
      return;
    }
    if(row.show && row.showStep && call('toggleShowAutoTimelineStep', row.show, row.showStep.id)){
      call('persist', 'shows', row.show.id);
      onRefresh?.();
    }
  };

  return (
    <div
      className={`tl-item home-today-item is-${status}${step?.done ? ' done' : ''}${status === 'now' ? ' is-now' : ''}${status === 'done' ? ' is-before-now' : ''}`}
      style={rowStyle}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(ev: any) => { if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } }}
    >
      <div className="tl-time">{time}</div>
      <div className="tl-rail">
        <button type="button" className="tl-node" aria-label={step?.done ? 'Mark not done' : 'Mark done'} onClick={toggle} />
      </div>
      <div className="tl-content is-logistics home-today-content">
        <div className="tl-type-ic" aria-hidden><Icon name={icon} size={13} /></div>
        <div className="tl-body">
          <span className="home-today-kind">{kind}</span>
          <b className="home-today-title">{step?.title || 'Activity'}</b>
          {loc ? <span className="home-today-loc"><Icon name="pin" size={11} /> {loc}</span> : null}
          {detail ? <span className="tl-sub home-today-detail">{detail}</span> : null}
          {status === 'now' ? <span className="home-today-now-pill">Now</span> : null}
        </div>
      </div>
    </div>
  );
}

function TodayScheduleWidget({ today, sel, focusRun, storeTick, density = 'default', size = 'medium' }: Record<string, any>){
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((t: any) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const rowCap = listCapForWidget('todaySchedule', size);
  const rows = useMemo(() => {
    const all = buildTodayScheduleRows({ today, sel, focusRun });
    return rowCap >= all.length ? all : all.slice(0, rowCap);
  }, [today, sel, focusRun, storeTick, minuteTick, rowCap]);
  const live = useMemo(
    () => todayScheduleLiveState(today, rows),
  [today, rows, minuteTick, storeTick]);

  const bump = useCallback(() => {
    if(typeof call === 'function') try{ call('haptic'); }catch(_){}
    notifyStore();
  }, []);

  return (
    <HomePanel title="Today's schedule">
      {rows.length ? (
        <div className={`card flush home-inset home-today-timeline show-day-timeline tl-preview${live?.activeId ? ' has-now' : ''}`}>
          {rows.map((row: any) => (
            <HomeTodayCompactRow key={row.key} row={row} live={live} focusRun={focusRun} onRefresh={bump} />
          ))}
        </div>
      ) : (
        <div className="home-today-empty">
          <span className="hint">Nothing scheduled for today yet.</span>
          <span className="hint" style={{ display: 'block', marginTop: 6, fontSize: 12.5 }}>
            Flights, transfers, hotels and show day items from your shows will appear here.
          </span>
        </div>
      )}
    </HomePanel>
  );
}

function HomeKeyContactRow({ entry }: Record<string, any>){
  const phone = entry.phone || '';
  const wa = entry.whatsapp || phone;
  const icon = entry.category === 'driver' ? 'car' : entry.category === 'hotel' ? 'bed' : 'user';
  return (
    <div
      className="home-kc-row"
      role="button"
      tabIndex={0}
      onClick={() => openHomeContact(entry)}
      onKeyDown={(ev: any) => { if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openHomeContact(entry); } }}
    >
      <div className="home-kc-ic" aria-hidden><Icon name={icon} size={15} /></div>
      <div className="home-kc-body">
        <b className="home-kc-name">{entry.name || entry.role}</b>
        {entry.role && entry.name && entry.role !== entry.name ? (
          <span className="home-kc-role">{entry.role}</span>
        ) : null}
        {entry.booking ? <span className="home-kc-booking">{entry.booking}</span> : null}
        {entry.detail ? <span className="home-kc-detail">{entry.detail}</span> : null}
        {phone ? <span className="home-kc-phone">{phone}</span> : null}
      </div>
      <span className="home-contact-act" onClick={(e: any) => e.stopPropagation()}>
        {phone ? (
          <button type="button" className="header-btn" style={{ width: 34, height: 34 }} title="Call" onClick={() => call('callNumber', phone)}>
            <Icon name="phone" size={15} />
          </button>
        ) : null}
        {wa ? (
          <button type="button" className="header-btn" style={{ width: 34, height: 34 }} title="WhatsApp" onClick={() => call('whatsapp', wa)}>
            <Icon name="chat" size={15} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function KeyContactsWidget({ grouped, focusRun, nextShow, persona, density = 'default', size = 'medium' }: Record<string, any>){
  const title = persona === 'agent' ? 'Booking contacts' : 'Key contacts';
  const totalCap = listCapForWidget('keyContacts', size);
  const maxCats = density === 'compact' ? 2 : HOME_CONTACT_CATEGORIES.length;
  const perCat = Math.max(1, Math.ceil(totalCap / Math.max(1, maxCats)));
  const sections = HOME_CONTACT_CATEGORIES.slice(0, maxCats).map((cat: any) => ({
    ...cat,
    items: (grouped?.[cat.key] || []).filter((c: any) => c.phone || c.whatsapp).slice(0, perCat),
  })).filter((s: any) => s.items.length);
  const total = sections.reduce((n: any, s: any) => n + s.items.length, 0);

  if(!total){
    return (
      <HomePanel title={title}>
        <div className="home-kc-empty">
          <span className="hint">No contacts with a phone number for today or your next show yet.</span>
          {nextShow ? (
            <button type="button" className="home-action" style={{ marginTop: 10 }} onClick={() => call('sheetKeyContacts', nextShow.id)}>
              <Icon name="plus" size={15} /> Add contacts
            </button>
          ) : null}
        </div>
      </HomePanel>
    );
  }

  const allLink = focusRun
    ? () => call('openTourContacts', focusRun.key)
    : nextShow
      ? () => call('sheetKeyContacts', nextShow.id)
      : null;

  return (
    <HomePanel
      title={title}
      link={allLink ? <button type="button" className="home-panel-link" onClick={allLink}>All</button> : null}
    >
      <div className="home-kc-scroll">
        {sections.map((sec: any) => (
          <div key={sec.key} className="home-kc-group">
            <div className="home-kc-group-head">
              <Icon name={sec.icon} size={14} /> {sec.title}
            </div>
            <div className="card flush home-inset">
              {sec.items.map((c: any, i: any) => (
                <HomeKeyContactRow key={`${sec.key}-${i}-${c.phone}-${c.name}`} entry={c} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </HomePanel>
  );
}

function UpcomingShowsWidget({ shows, title, density = 'default', size = 'medium' }: Record<string, any>){
  const cap = listCapForWidget('upcomingShows', size);
  const visible = shows.slice(0, cap);
  if(!shows.length){
    return (
      <HomePanel title={title}>
        <div className="home-upcoming-empty">
          <span className="hint">No further upcoming performances.</span>
          <button type="button" className="home-action" style={{ marginTop: 10 }} onClick={() => call('sheetEvent')}>
            <Icon name="plus" size={15} /> Add show
          </button>
        </div>
      </HomePanel>
    );
  }

  return (
    <HomePanel
      title={title}
      link={
        <button type="button" className="home-panel-link" onClick={() => call('go', 'calendar')}>
          Calendar
        </button>
      }
    >
      <div className="card flush home-inset home-upcoming-list">
        {visible.map((e: any) => {
          const status = showListStatus(e);
          const cdMs = showCountdownMs(e);
          const cdLabel = showCountdownLabel(e);
          const venue = showVenueLine(e);
          const location = showLocationLine(e);
          const setTime = showSetTimeLine(e);
          const dateLine = fmtDateLong ? fmtDateLong(e.date) : (fmtDate ? fmtDate(e.date) : e.date);
          return (
            <div key={e.id} className="home-upcoming-row row" onClick={() => call('openView', 'event', e.id)}>
              <div className="home-upcoming-date">
                <span className="home-upcoming-date-t">{fmtDate ? fmtDate(e.date) : e.date}</span>
              </div>
              <div className="ic home-upcoming-ic"><Icon name="music" size={16} /></div>
              <div className="body home-upcoming-body">
                <b className="home-upcoming-name">{showPerformanceTitle(e)}</b>
                {venue ? <span className="home-upcoming-venue">{venue}</span> : null}
                {location ? <span className="home-upcoming-loc"><Icon name="pin" size={12} /> {location}</span> : null}
                <span className="home-upcoming-meta">
                  {dateLine}
                  {setTime ? ` · Set ${setTime}` : ''}
                  {status ? (
                    <span className={`tag ${status.className} home-upcoming-tag`}>{status.label}</span>
                  ) : null}
                </span>
              </div>
              {cdLabel ? (
                <div className="home-upcoming-cd" {...(cdMs ? { 'data-countdown-ms': cdMs } : {})}>
                  <span className="home-upcoming-cd-k">In</span>
                  <span className="home-upcoming-cd-v cd-txt">{cdLabel}</span>
                </div>
              ) : null}
              <Icon name="chevR" size={15} />
            </div>
          );
        })}
      </div>
    </HomePanel>
  );
}

function WidgetSizePicker({ widgetId, size, onPick, disabled }: Record<string, any>){
  const options = widgetSizeOptions(widgetId);
  if(options.length < 2) return null;
  return (
    <div className="home-widget-size-bar" role="group" aria-label="Widget size" onClick={(e: any) => e.stopPropagation()}>
      {options.map((opt: any) => (
        <button
          key={opt}
          type="button"
          className={`home-widget-size-opt${size === opt ? ' is-on' : ''}`}
          disabled={disabled}
          title={sizeTitle(opt)}
          onClick={() => onPick(opt)}
        >
          {sizeTitle(opt).charAt(0)}
        </button>
      ))}
    </div>
  );
}

function TasksRemindersWidget({ tasks, nextShow, persona, now, density = 'default', size = 'medium' }: Record<string, any>){
  const cap = listCapForWidget('tasksReminders', size);
  const visible = tasks.slice(0, cap);
  const title = persona === 'dj' ? 'Tasks / reminders' : `Tasks / reminders · ${tasks.length} open`;
  const list = visible;
  const headerLink = nextShow ? (
    <span className="home-task-links" onClick={(e: any) => e.stopPropagation()}>
      <button type="button" className="home-panel-link" onClick={() => addHomeTask(nextShow)}>Add task</button>
      <button type="button" className="home-panel-link" onClick={() => addHomeReminder(nextShow)}>Reminder</button>
    </span>
  ) : null;

  if(!list.length){
    return (
      <HomePanel title={title}>
        <div className="home-task-empty">
          <span className="hint">Nothing outstanding — you&apos;re caught up.</span>
          <div className="home-task-empty-actions">
            <button type="button" className="home-action" onClick={() => addHomeTask(nextShow)}>
              <Icon name="plus" size={15} /> Add task
            </button>
            {nextShow ? (
              <button type="button" className="home-action secondary" onClick={() => addHomeReminder(nextShow)}>
                <Icon name="reminder" size={15} /> Set reminder
              </button>
            ) : null}
          </div>
        </div>
      </HomePanel>
    );
  }

  return (
    <HomePanel title={title} link={headerLink}>
      <div className="card flush home-inset home-task-scroll">
        {list.map((task: any) => {
          const due = formatTaskDue(task.dueMs, now);
          const overdue = task.overdue || due?.overdue;
          const prio = priorityLabel(task.priority);
          const status = taskStatusLabel(task.status);
          return (
            <div
              key={task.key}
              className={`home-task-row check ${overdue ? 'is-overdue' : ''} ${task.status === 'progress' ? 'is-progress' : ''}`}
            >
              <div
                className="box"
                role="checkbox"
                aria-checked="false"
                onClick={(e: any) => { e.stopPropagation(); completeHomeTask(task); }}
              >
                <Icon name="check" size={15} />
              </div>
              <div
                className="home-task-body lbl"
                role="button"
                tabIndex={0}
                onClick={() => openHomeTask(task)}
                onKeyDown={(ev: any) => {
                  if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); openHomeTask(task); }
                }}
              >
                <b className="home-task-title">{task.title}</b>
                {due ? (
                  <span className={`home-task-due${overdue ? ' is-overdue' : ''}`}>
                    {overdue ? 'Overdue · ' : ''}{due.text}
                  </span>
                ) : null}
                <span className="home-task-meta">
                  <span className={`home-task-prio is-${String(task.priority || 'med').toLowerCase()}`}>{prio}</span>
                  <span className="home-task-status">{status}</span>
                  {task.recordLabel ? <span className="home-task-record">{task.recordLabel}</span> : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </HomePanel>
  );
}

export default function HomePage(){
  const tick = useStoreTick();
  const [widgetEditing, setWidgetEditing] = useState(false);
  const [gridDraft, setGridDraft] = useState(readHomeWidgetGrid);
  const [gridCols, setGridCols] = useState(HOME_GRID_BASE_COLS);
  const [swapPickerId, setSwapPickerId] = useState<any>(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState<any>(null);
  const [dragFloat, setDragFloat] = useState<any>(null);
  const gridDraftRef = useRef(gridDraft);
  const widgetItemRefs = useRef(Object.create(null));
  const widgetDragRef = useRef<any>(null);
  const widgetDragRafRef = useRef<any>(null);
  const widgetListRef = useRef<any>(null);
  const pendingFlipRef = useRef<any>(null);
  const pendingFlipExcludeRef = useRef<any>(null);
  const pendingResizeIdRef = useRef<any>(null);
  const WIDGET_FLIP_MS = 520;

  const snapshotWidgetSlotRects = useCallback(() => {
    const snap = Object.create(null);
    Object.keys(widgetItemRefs.current).forEach((wid: any) => {
      const el = widgetItemRefs.current[wid];
      if(el) snap[wid] = el.getBoundingClientRect();
    });
    return snap;
  }, []);

  const clearWidgetSlotMotion = useCallback(() => {
    Object.keys(widgetItemRefs.current).forEach((wid: any) => {
      const el = widgetItemRefs.current[wid];
      if(!el) return;
      el.style.transform = '';
      el.style.transition = '';
      el.style.transformOrigin = '';
    });
  }, []);

  const queueWidgetFlip = useCallback((excludeId: any = null, resizeId: any = null) => {
    pendingFlipRef.current = snapshotWidgetSlotRects();
    pendingFlipExcludeRef.current = excludeId;
    pendingResizeIdRef.current = resizeId;
  }, [snapshotWidgetSlotRects]);

  useLayoutEffect(() => {
    const before = pendingFlipRef.current;
    if(!before) return;
    const excludeId = pendingFlipExcludeRef.current;
    const resizeId = pendingResizeIdRef.current;
    pendingFlipRef.current = null;
    pendingFlipExcludeRef.current = null;
    pendingResizeIdRef.current = null;
    const els = widgetItemRefs.current;
    const moved: any[] = [];
    Object.keys(before).forEach((id: any) => {
      if(excludeId && id === excludeId) return;
      const el = els[id];
      if(!el) return;
      const last = el.getBoundingClientRect();
      const prev = before[id];
      if(!prev || last.width < 1 || last.height < 1) return;
      const dx = prev.left - last.left;
      const dy = prev.top - last.top;
      const sx = prev.width / last.width;
      const sy = prev.height / last.height;
      const isResizeTarget = resizeId && id === resizeId;
      const sizeChanged = Math.abs(sx - 1) >= 0.01 || Math.abs(sy - 1) >= 0.01;
      const movedPos = Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5;
      if(!sizeChanged && !movedPos) return;
      el.style.transition = 'none';
      if(isResizeTarget){
        el.style.transformOrigin = 'center center';
        if(movedPos){
          el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
        } else {
          el.style.transform = `scale(${sx}, ${sy})`;
        }
      } else {
        if(!movedPos) return;
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
      moved.push(el);
    });
    if(!moved.length) return;
    void widgetListRef.current?.offsetHeight;
    requestAnimationFrame(() => {
      moved.forEach((el: any) => {
        el.style.transition = `transform ${WIDGET_FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        el.style.transform = '';
      });
      window.setTimeout(() => {
        moved.forEach((el: any) => {
          el.style.transition = '';
          el.style.transformOrigin = '';
        });
      }, WIDGET_FLIP_MS + 40);
    });
  }, [gridDraft]);

  gridDraftRef.current = gridDraft;

  useEffect(() => {
    const fn = tickCountdowns;
    if(typeof fn === 'function') try{ fn(); }catch(_){}
  }, [tick]);

  useEffect(() => {
    if(!widgetEditing) setGridDraft(readHomeWidgetGrid());
  }, [tick, widgetEditing]);

  useEffect(() => {
    const el = widgetListRef.current;
    if(!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries: any) => {
      const w = entries[0]?.contentRect?.width || el.clientWidth;
      setGridCols(colsForViewportWidth(w));
    });
    ro.observe(el);
    setGridCols(colsForViewportWidth(el.clientWidth));
    return () => ro.disconnect();
  }, [widgetEditing, tick]);

  const [taskClock, setTaskClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTaskClock(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const startWidgetEdit = useCallback(() => {
  setGridDraft(readHomeWidgetGrid().map((g: any) => displayGridItem(g, gridCols)));
    setWidgetEditing(true);
  }, [gridCols]);

  useEffect(() => {
    if(typeof window === 'undefined') return undefined;
    window.__homeStartWidgetEdit = startWidgetEdit;
    return () => { delete window.__homeStartWidgetEdit; };
  }, [startWidgetEdit]);

  const finishWidgetEdit = () => {
    setSwapPickerId(null);
    setDraggingWidgetId(null);
    widgetDragRef.current = null;
    setDragFloat(null);
    const stored = gridDraftRef.current.map((item: any) => storeGridItem(item, gridCols));
    writeHomeWidgetGrid(stored, HOME_GRID_BASE_COLS);
    setGridDraft(readHomeWidgetGrid());
    setWidgetEditing(false);
  };

  const persistGrid = useCallback((next: any) => {
    const stored = next.map((item: any) => storeGridItem(item, gridCols));
    gridDraftRef.current = stored;
    const display = stored.map((g: any) => displayGridItem(g, gridCols));
    setGridDraft(display.slice());
    writeHomeWidgetGrid(stored, HOME_GRID_BASE_COLS);
  }, [gridCols]);

  const endWidgetDrag = useCallback((persist: any) => {
    const drag = widgetDragRef.current;
    if(drag && persist && drag.mode === 'move'){
      persistGrid(gridDraftRef.current);
    }
    if(widgetDragRafRef.current){
      cancelAnimationFrame(widgetDragRafRef.current);
      widgetDragRafRef.current = null;
    }
    widgetDragRef.current = null;
    setDraggingWidgetId(null);
    setDragFloat(null);
    pendingFlipRef.current = null;
    pendingFlipExcludeRef.current = null;
    pendingResizeIdRef.current = null;
    clearWidgetSlotMotion();
    if(typeof document !== 'undefined'){
      document.body.classList.remove('home-widget-dragging');
    }
  }, [persistGrid, clearWidgetSlotMotion]);

  const onWidgetDragMove = useCallback((e: any) => {
    const drag = widgetDragRef.current;
    if(!drag || drag.pointerId !== e.pointerId || drag.mode !== 'move') return;
    drag.clientX = e.clientX;
    drag.clientY = e.clientY;
    if(widgetDragRafRef.current) return;
    widgetDragRafRef.current = requestAnimationFrame(() => {
      widgetDragRafRef.current = null;
      const d = widgetDragRef.current;
      if(!d || d.mode !== 'move') return;
      setDragFloat((prev: any) => (
        prev
          ? {
              ...prev,
              x: d.clientX - d.offsetX,
              y: d.clientY - d.offsetY,
            }
          : prev
      ));
      const displayGrid = gridDraftRef.current.map((g: any) => displayGridItem(g, gridCols));
      const next = placeGridWidgetAtPointer(
        displayGrid,
        d.id,
        widgetListRef.current,
        d.clientX,
        d.clientY,
        gridCols,
        HOME_GRID_ROW_PX,
      );
      const samePlace = displayGrid.every((g: any) => {
        const n = next.find((x: any) => x.id === g.id);
        return n && n.x === g.x && n.y === g.y;
      });
      if(samePlace) return;
      queueWidgetFlip(d.id);
      gridDraftRef.current = next;
      setGridDraft(next.slice());
      if(typeof call === 'function') try{ call('haptic'); }catch(_){}
    });
  }, [gridCols, queueWidgetFlip]);

  const onWidgetDragEnd = useCallback((e: any) => {
    const drag = widgetDragRef.current;
    if(!drag || (e.pointerId != null && drag.pointerId !== e.pointerId)) return;
    endWidgetDrag(true);
    if(typeof call === 'function') try{ call('haptic'); }catch(_){}
  }, [endWidgetDrag]);

  useEffect(() => {
    if(!draggingWidgetId) return undefined;
    window.addEventListener('pointermove', onWidgetDragMove);
    window.addEventListener('pointerup', onWidgetDragEnd);
    window.addEventListener('pointercancel', onWidgetDragEnd);
    return () => {
      window.removeEventListener('pointermove', onWidgetDragMove);
      window.removeEventListener('pointerup', onWidgetDragEnd);
      window.removeEventListener('pointercancel', onWidgetDragEnd);
    };
  }, [draggingWidgetId, onWidgetDragMove, onWidgetDragEnd]);

  const startWidgetDrag = (id: any, e: any) => {
    if(swapPickerId) return;
    if(e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
    const slot = widgetItemRefs.current[id];
    const card = slot?.querySelector('.home-widget');
    [slot, card].forEach((el: any) => {
      if(!el) return;
      el.style.transform = '';
      el.style.transition = '';
      el.style.transformOrigin = '';
    });
    const r = (card || slot)?.getBoundingClientRect();
    if(!r || r.width < 1 || r.height < 1) return;
    const offsetX = e.clientX - r.left;
    const offsetY = e.clientY - r.top;
    widgetDragRef.current = {
      id,
      mode: 'move',
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    setDragFloat({
      x: r.left,
      y: r.top,
      width: r.width,
      height: r.height,
    });
    setDraggingWidgetId(id);
    document.body.classList.add('home-widget-dragging');
    if(typeof call === 'function') try{ call('haptic'); }catch(_){}
  };

  const changeWidgetSize = (id: any, size: any) => {
    queueWidgetFlip(null, id);
    const base = gridDraftRef.current.map((g: any) => displayGridItem(g, gridCols));
    const next = setWidgetSize(base, id, size, gridCols);
    gridDraftRef.current = next;
    setGridDraft(next.slice());
    if(widgetEditing){
      const stored = next.map((item: any) => storeGridItem(item, gridCols));
      writeHomeWidgetGrid(stored, HOME_GRID_BASE_COLS);
    } else {
      persistGrid(next);
    }
    if(typeof call === 'function') try{ call('haptic'); }catch(_){}
  };

  const removeWidget = (id: any) => {
    persistGrid(removeGridWidget(gridDraftRef.current, id));
  };
  const addWidget = (id: any) => {
    if(gridDraftRef.current.some((g: any) => g.id === id)) return;
    persistGrid(appendGridWidget(gridDraftRef.current, id, gridCols));
  };

  const resetWidgets = () => {
    resetHomeWidgetLayout();
    setGridDraft(readHomeWidgetGrid());
    setSwapPickerId(null);
  };

  const changeWidget = (oldId: any, newId: any) => {
    if(oldId === newId || gridDraftRef.current.some((g: any) => g.id === newId)) return;
    persistGrid(replaceGridWidgetId(gridDraftRef.current, oldId, newId));
    setSwapPickerId(null);
  };

  const store = getStore();
  const sel = getSel();
  const persona = call('homePersona') || 'dj';
  const blurb = call('homePersonaBlurb') || 'Your next show and travel at a glance';
  const liveRun = call('activeRun');
  const show = findNextShow(sel);
  const focusRun = liveRun || (show ? call('runOf', show.id) : null);
  const timeline = focusRun ? (call('runTimeline', focusRun) || []) : [];
  const nextStep = timeline.find((s: any) => !s.done) || null;
  const today = isoToday();
  const nextJourney = pickNextJourney(collectJourneys({ sel, focusRun }));
  const nextJourneyShow = nextJourney?.showId ? (sel?.event ? sel.event(nextJourney.showId) : null) : null;
  const accommodationBooking = pickAccommodation(collectAccommodationBookings({ sel, focusRun }), today);
  const accommodationShow = accommodationBooking?.showId
    ? (sel?.event ? sel.event(accommodationBooking.showId) : null)
    : null;
  const greet = greeting();
  const nameBit = store?.settings?.artistName && store.settings.artistName !== 'You'
    ? `, ${store.settings.artistName}`
    : '';
  const photo = store?.settings?._homeHeaderUrl || store?.settings?.homeHeader;
  const homeTasks = collectHomeTasks({
    sel,
    store,
    today,
    nextShow: show,
    focusRun,
    accommodationShow,
    now: taskClock,
  });
  const keyContactsGrouped = buildHomeKeyContactsGrouped({
    sel,
    today,
    nextShow: show,
    accommodationShow,
    focusRun,
  });
  const tourSecondary = false;
  const upcomingTitle = persona === 'agent' ? 'Confirmed shows' : persona === 'tm' ? 'Show schedule' : 'Upcoming shows';

  const sourceGrid = widgetEditing ? gridDraft : readHomeWidgetGrid();
  const widgetGrid = useMemo(
    () => sortGridItems(sourceGrid.map((g: any) => displayGridItem(g, gridCols))),
    [sourceGrid, gridCols, widgetEditing, gridDraft, tick],
  );
  const widgetsToAdd = widgetEditing ? availableHomeWidgets(widgetGrid) : [];
  const gridMaxRow = widgetGrid.reduce((m: any, g: any) => Math.max(m, g.y + g.h), 0);

  const widgetNode = (id: any, density: any, size: any) => {
    switch(id){
      case 'nextShow':
        return liveRun
          ? <div className="tourmode-wrap"><TourBanner run={liveRun} secondary={tourSecondary} nextStep={nextStep} /></div>
          : (show ? <NextShowHero show={show} density={density} /> : <NoShowsCard />);
      case 'todaySchedule':
        return (
          <TodayScheduleWidget
            today={today}
            sel={sel}
            focusRun={focusRun}
            storeTick={tick}
            density={density}
            size={size}
          />
        );
      case 'upcomingTravel':
        return <UpcomingTravelWidget journey={nextJourney} show={nextJourneyShow} density={density} />;
      case 'accommodation':
        return <AccommodationWidget booking={accommodationBooking} show={accommodationShow} density={density} />;
      case 'upcomingShows':
        return (
          <UpcomingShowsWidget
            shows={collectUpcomingShows(sel, {
              persona,
              excludeId: show?.id,
              max: listCapForWidget('upcomingShows', size),
            })}
            title={upcomingTitle}
            density={density}
            size={size}
          />
        );
      case 'keyContacts':
        return (
          <KeyContactsWidget
            grouped={keyContactsGrouped}
            focusRun={focusRun}
            nextShow={show}
            persona={persona}
            density={density}
            size={size}
          />
        );
      case 'tasksReminders':
        return (
          <TasksRemindersWidget
            tasks={homeTasks}
            nextShow={show}
            persona={persona}
            now={taskClock}
            density={density}
            size={size}
          />
        );
      default:
        return null;
    }
  };
  const heroActions = (
    <div className="home-hero-actions">
      <button
        type="button"
        className={`header-btn${photo ? ' glass' : ''}${widgetEditing ? ' is-on' : ''}`}
        onClick={() => (widgetEditing ? finishWidgetEdit() : startWidgetEdit())}
        title={widgetEditing ? 'Done editing' : 'Edit widgets'}
      >
        <Icon name={widgetEditing ? 'check' : 'edit'} size={18} />
      </button>
      <button type="button" className={`header-btn${photo ? ' glass' : ''}`} onClick={() => call('openSearch')}><Icon name="search" size={20} /></button>
      <button type="button" className={`header-btn${photo ? ' glass' : ''}`} onClick={() => call('openView', 'settings')}><Icon name="settings" size={20} /></button>
    </div>
  );

  const header = photo ? (
    <div
      className="home-hero"
      style={{
        backgroundImage: `url('${photo}')`,
        backgroundPosition: call('homeHeaderPositionCss') || 'center',
      }}
    >
      {heroActions}
      <div className="home-hero-text">
        <div className="hero-hello">{greet}{nameBit}</div>
        <div className="hero-home">Home</div>
        <div className="hero-date">{blurb}</div>
      </div>
    </div>
  ) : (
    <header className="home-greet-header screen-pad">
      {heroActions}
      <div className="home-greet-copy">
        <div className="hero-hello">{greet}{nameBit}</div>
        <div className="hero-date">{blurb}</div>
      </div>
    </header>
  );

  return (
    <div className="tab-page">
      {header}
      <div className={`screen-pad home-screen tab-page-body${widgetEditing ? ' home-screen--edit' : ''}`} style={{ marginTop: photo ? 12 : 8 }}>
        {!widgetEditing ? <HomeActions /> : null}
        {widgetEditing ? (
          <div className="home-widget-edit-bar">
            <span className="home-widget-edit-bar-title">Editing widgets</span>
            <span className="home-widget-edit-bar-hint">Drag by the handle to move widgets — drop them beside or below each other when there’s room (two Medium widgets can sit side by side on a wide screen). S / M / L changes size. Tap Done to save.</span>
            <div className="home-widget-edit-bar-actions">
              <button type="button" className="home-action" onClick={resetWidgets}>Reset essentials</button>
              <button type="button" className="home-action is-strong" onClick={finishWidgetEdit}>
                <Icon name="check" size={15} /> Done
              </button>
            </div>
          </div>
        ) : null}
        <div
          ref={widgetListRef}
          className={`home-widgets home-widgets-grid${draggingWidgetId ? ' is-reordering' : ''}${widgetEditing ? ' is-editing-grid' : ''}`}
          style={{
            '--home-cols': gridCols,
            '--home-row-h': `${HOME_GRID_ROW_PX}px`,
            gridTemplateRows: `repeat(${Math.max(gridMaxRow, 1)}, var(--home-row-h))`,
          }}
        >
          {widgetGrid.map((item: any) => {
            const id = item.id;
            const density = sizeToDensity(item.size);
            const node = widgetNode(id, density, item.size);
            const meta = homeWidgetMeta(id);
            if(!node && !widgetEditing) return null;
            const body = node || (
              <div className="home-widget-placeholder">
                <span className="hint">Nothing to show right now — you can remove this or keep it for later.</span>
              </div>
            );
            const swapOpts = widgetEditing ? swapOptionsForWidget(widgetGrid, id) : [];
            const isDragging = draggingWidgetId === id;
            const floatStyle = (isDragging && dragFloat) ? {
              position: 'fixed' as const,
              top: dragFloat.y,
              left: dragFloat.x,
              width: dragFloat.width,
              height: dragFloat.height,
              zIndex: 700,
              boxSizing: 'border-box' as const,
              margin: 0,
            } : undefined;
            const widgetChrome = widgetEditing ? (
              <>
                <div className="home-widget-chrome">
                  <button
                    type="button"
                    className="home-widget-drag-handle header-btn"
                    aria-label={`Drag to move ${meta.title}`}
                    onPointerDown={(e: any) => startWidgetDrag(id, e)}
                    disabled={!!swapPickerId && swapPickerId !== id}
                  >
                    <Icon name="grip" size={18} />
                  </button>
                  <span className="home-widget-chrome-title">{meta.title}</span>
                  <WidgetSizePicker
                    widgetId={id}
                    size={item.size}
                    disabled={!!draggingWidgetId || !!swapPickerId}
                    onPick={(opt: any) => changeWidgetSize(id, opt)}
                  />
                  <div className="home-widget-edit-act">
                    <button
                      type="button"
                      className={`home-widget-change-btn${swapPickerId === id ? ' is-open' : ''}`}
                      disabled={!swapOpts.length || !!draggingWidgetId}
                      onClick={() => setSwapPickerId((cur: any) => (cur === id ? null : id))}
                      title={swapOpts.length ? 'Change widget type' : 'No other widgets available'}
                    >
                      Change
                    </button>
                    <button type="button" className="header-btn" style={{ width: 34, height: 34 }} disabled={!!draggingWidgetId} onClick={() => { removeWidget(id); if(swapPickerId === id) setSwapPickerId(null); }} title="Remove">
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
                {swapPickerId === id ? (
                  <div className="home-widget-swap-panel">
                    <span className="hint" style={{ display: 'block', marginBottom: 8, textAlign: 'left' }}>Replace with</span>
                    <div className="home-widget-swap-list">
                      {swapOpts.map((optId: any) => {
                        const om = homeWidgetMeta(optId);
                        return (
                          <button
                            key={optId}
                            type="button"
                            className="home-widget-swap-opt"
                            onClick={() => changeWidget(id, optId)}
                          >
                            <b>{om.title}</b>
                            <span>{om.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" className="home-panel-link" style={{ marginTop: 8 }} onClick={() => setSwapPickerId(null)}>Cancel</button>
                  </div>
                ) : null}
              </>
            ) : null;
            const floatLayer = (isDragging && dragFloat && typeof document !== 'undefined')
              ? createPortal(
                  <div
                    className={`home-widget${widgetEditing ? ' is-editing' : ''} is-dragging is-floating`}
                    style={floatStyle}
                  >
                    {widgetChrome}
                    <div className={`home-widget-body${widgetEditing ? ' is-dimmed' : ''}`}>{body}</div>
                  </div>,
                  document.body,
                )
              : null;
            return (
              <div
                key={id}
                ref={(el: any) => {
                  if(el) widgetItemRefs.current[id] = el;
                  else delete widgetItemRefs.current[id];
                }}
                className={`home-widget-slot${isDragging ? ' is-gap' : ''}`}
                style={{
                  gridColumn: `${item.x + 1} / span ${item.w}`,
                  gridRow: `${item.y + 1} / span ${item.h}`,
                  '--gh': item.h,
                  ...(isDragging && dragFloat ? { minHeight: dragFloat.height } : null),
                }}
                data-widget={id}
                data-density={density}
              >
                {floatLayer}
                <div
                  className={`home-widget${widgetEditing ? ' is-editing' : ''}${swapPickerId === id ? ' is-swapping' : ''}${isDragging ? ' is-dragging' : ''}`}
                >
                  {widgetChrome}
                  <div className={`home-widget-body${widgetEditing ? ' is-dimmed' : ''}`}>{body}</div>
                </div>
              </div>
            );
          })}
        </div>
        {widgetEditing && widgetsToAdd.length ? (
          <div className="home-widget-add-panel">
            <div className="block-title" style={{ padding: '0 2px 8px' }}>Add widget</div>
            <div className="home-widget-add-grid">
              {widgetsToAdd.map((id: any) => {
                const m = homeWidgetMeta(id);
                return (
                  <button key={id} type="button" className="chip" onClick={() => addWidget(id)}>
                    <Icon name="plus" size={14} /> {m.title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {!widgetEditing ? (
          <div className="home-widgets-foot">
            <button type="button" className="home-panel-link" onClick={startWidgetEdit}>
              <Icon name="edit" size={14} /> Edit widgets
            </button>
          </div>
        ) : null}
        <div className="spacer" />
      </div>
    </div>
  );
}
