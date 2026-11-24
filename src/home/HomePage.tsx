import { useSyncExternalStore, useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { call, countdown, flightHasDetails, fmtDate, fmtDateLong, getSel, getStore, notifyStore, pad, parseDT, showTitle, subscribeStore, tickCountdowns } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';
import {
  buildTodayScheduleRows, stepLocation, todayScheduleLiveState, todayScheduleVisibleRows,
} from './todaySchedule.js';
import {
  collectAccommodationBookings, formatStayWhen, hotelConfirmationPass, pickAccommodation, statusLabel,
} from './accommodation.js';
import {
  collectJourneys, formatJourneyWhen, journeyBoardingPass, journeyCountdown, journeyDurationText,
  journeyDetailLines, journeyEndpointHints,
  journeyPassengerSummary, journeyPlaceDisplay, journeyRoutePlaceLabel, journeyStatusLabel,
  journeySupportingChips, pickNextJourney,
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
import { LiveTimelineStepRow, TimelineDayRow } from '../show/timelineShared.jsx';
import { openTimelineStep } from '../show/openTimelineStep.js';
import {
  HOME_GRID_BASE_COLS, HOME_GRID_ROW_PX, appendGridWidget,   compactGridItems, colsForViewportWidth,
  dimensionsForWidget, displayGridItem, displayGridLayout, listCapForWidget, reconcileGridItem,
  placeGridWidgetAtPointer,
  removeGridWidget, replaceGridWidgetId, setWidgetSize, sizeTitle, sizeToDensity,
  sortGridItems, storeGridItem, widgetSizeOptions,
} from './homeWidgetGrid.js';
import {
  availableHomeWidgets, homeWidgetMeta, readHomeWidgetGrid, resetHomeWidgetLayout,
  swapOptionsForWidget, writeHomeWidgetGrid,
} from './homeWidgetMeta.js';
import { DailyOverview, buildDailyOverviewLines } from './dailyOverview.jsx';

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

function HomeActions({ className = '' }: { className?: string }){
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
    <div className={`home-actions${className ? ` ${className}` : ''}`}>
      <button type="button" className="home-action" onClick={() => call('sheetEvent')}>
        <Icon name="plus" size={15} /> Add show
      </button>
      <button type="button" className="home-action" onClick={() => call('sheetItineraryStart')}>
        <Icon name="file" size={15} /> Upload itinerary
      </button>
      <button type="button" className="home-action" onClick={() => call('sheetCalendarUpload')}>
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

function HomePanel({ title, link, children, className = '' }: Record<string, any>){
  return (
    <div className={`home-panel${className ? ` ${className}` : ''}`}>
      <div className="home-panel-head home-panel-head-flex">
        <span>{title}</span>
        {link || null}
      </div>
      <div className="home-panel-body">{children}</div>
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

function nextShowMediumStatus(show: any){
  const st = show?.status || 'confirmed';
  if(st === 'hold'){
    return <span className="home-next-show-medium-status is-hold">Tentative</span>;
  }
  if(st === 'confirmed'){
    return <span className="home-next-show-medium-status is-confirmed">Confirmed</span>;
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

/** Small Next Show widget — e.g. "In 3 days" from calendar day of `show.date`. */
function nextShowSnippetCountdown(show: any){
  const d = parseDT ? parseDT(show?.date) : null;
  if(!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const showDay = new Date(d);
  showDay.setHours(0, 0, 0, 0);
  const diff = Math.round((showDay.getTime() - today.getTime()) / 86400000);
  if(diff < 0) return '';
  if(diff === 0) return 'Today';
  if(diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function nextShowExtraDetails(show: any){
  const a = show?.advance;
  if(!a) return [];
  const rows: any[] = [];
  if(a.access){
    rows.push({ key: 'access', label: 'Doors / access', value: String(a.access), icon: 'clock' });
  }
  if(a.soundcheck){
    rows.push({ key: 'soundcheck', label: 'Sound check', value: String(a.soundcheck), icon: 'music' });
  }
  if(a.curfew){
    rows.push({ key: 'curfew', label: 'Curfew', value: String(a.curfew), icon: 'clock' });
  }
  (a.schedule || []).forEach((s: any, i: number) => {
    if(!(s?.time || s?.label || s?.title)) return;
    const title = s.label || s.title || 'Schedule';
    const value = [s.time, s.title && s.title !== title ? s.title : ''].filter(Boolean).join(' · ') || title;
    rows.push({ key: `sched-${i}`, label: title, value, icon: 'clock' });
  });
  return rows.slice(0, 6);
}

function NextShowHero({ show, density = 'default' }: Record<string, any>){
  const compact = density === 'compact';
  const expanded = density === 'expanded';
  const title = show.eventName || show.venue || 'Show';
  const venueLine = show.eventName && show.venue ? show.venue : (!show.eventName && show.venue ? null : (show.venue && show.venue !== title ? show.venue : null));
  const location = [show.city, show.country].filter(Boolean).join(', ');
  const dateLine = fmtDateLong ? fmtDateLong(show.date) : (fmtDate ? fmtDate(show.date) : show.date);
  const drivers = call('showDrivers', show) || [];
  const hasContacts = showKeyContacts(show).length > 0
    || drivers.some((d: any) => !d.noGround && (d.phone || d.whatsapp));
  const venueQ = call('venueMapQuery', show)
    || call('formatVenueAddress', show)
    || location;

  if(compact){
    const countdownLine = nextShowSnippetCountdown(show);
    const dateShort = show.date
      ? (fmtDate ? fmtDate(show.date) : show.date)
      : '';
    return (
      <div
        className="hero tap nextshow home-next-show is-compact is-snippet"
        onClick={() => call('openView', 'event', show.id)}
      >
        <div className="home-next-show-snippet-top">
          <span className="home-next-show-snippet-label">
            <Icon name="music" size={13} /> Next Show
          </span>
          {countdownLine ? (
            <span className="home-next-show-snippet-cd">{countdownLine}</span>
          ) : null}
        </div>
        <h2 className="home-next-show-snippet-title">{title}</h2>
        {location ? <p className="home-next-show-snippet-loc">{location}</p> : null}
        {dateShort || show.setTime ? (
          <div className="home-next-show-snippet-meta">
            {dateShort ? (
              <span className="home-next-show-snippet-date">
                <Icon name="calendar" size={13} />
                <span>{dateShort}</span>
              </span>
            ) : null}
            {dateShort && show.setTime ? <span className="home-next-show-snippet-dot" aria-hidden>·</span> : null}
            {show.setTime ? <span className="home-next-show-snippet-time">{show.setTime}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  if(!expanded){
    const countdownLine = nextShowSnippetCountdown(show);
    const dateShort = show.date
      ? (fmtDate ? fmtDate(show.date) : show.date)
      : '';
    const setLine = show.setTime
      ? (show.endTime ? `${show.setTime} – ${show.endTime}` : show.setTime)
      : '';
    const placeParts = [venueLine, location].filter(Boolean);
    const placeLine = placeParts.join(placeParts.length > 1 ? ' · ' : '');
    const statusChip = nextShowMediumStatus(show);

    return (
      <div className="hero nextshow home-next-show is-medium-panel">
        <div
          className="home-next-show-medium-main tap"
          onClick={() => call('openView', 'event', show.id)}
        >
          <div className="home-next-show-snippet-top">
            <span className="home-next-show-snippet-label">
              <Icon name="music" size={13} /> Next Show
            </span>
            {countdownLine ? (
              <span className="home-next-show-snippet-cd">{countdownLine}</span>
            ) : null}
          </div>
          <h2 className="home-next-show-snippet-title home-next-show-medium-title">{title}</h2>
          {placeLine ? <p className="home-next-show-medium-place">{placeLine}</p> : null}
          {dateShort || setLine ? (
            <div className="home-next-show-medium-datetime">
              {dateShort ? (
                <span className="home-next-show-medium-dt">
                  <Icon name="calendar" size={13} />
                  <span>{dateShort}</span>
                </span>
              ) : null}
              {setLine ? (
                <span className="home-next-show-medium-dt">
                  <Icon name="music" size={13} />
                  <span>{setLine}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {statusChip ? <div className="home-next-show-medium-status-wrap">{statusChip}</div> : null}
        </div>
        {(venueQ || hasContacts) ? (
          <div className="home-next-show-medium-actions">
            {venueQ ? (
              <button
                type="button"
                className="home-next-show-medium-action"
                onClick={(e: any) => { e.stopPropagation(); call('openMaps', venueQ); }}
              >
                <Icon name="map" size={14} /> Directions
              </button>
            ) : null}
            {hasContacts ? (
              <button
                type="button"
                className="home-next-show-medium-action"
                onClick={(e: any) => { e.stopPropagation(); call('openTourContacts', show.id); }}
              >
                <Icon name="users" size={14} /> Key contacts
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const countdownLine = nextShowSnippetCountdown(show);
  const setLine = show.setTime
    ? (show.endTime ? `${show.setTime} – ${show.endTime}` : show.setTime)
    : '';
  const venueAddress = call('formatVenueAddress', show) || '';
  const extraDetails = nextShowExtraDetails(show);
  const contacts = showKeyContacts(show);
  const primaryContact = contacts[0] || null;
  const statusChip = nextShowMediumStatus(show);

  return (
    <div className="hero nextshow home-next-show is-large-panel">
      <div className="home-next-show-large-top">
        <span className="home-next-show-snippet-label">
          <Icon name="music" size={13} /> Next Show
        </span>
        <div className="home-next-show-large-top-meta">
          {countdownLine ? (
            <span className="home-next-show-snippet-cd">{countdownLine}</span>
          ) : null}
          {statusChip}
        </div>
      </div>
      <div className="home-next-show-large-cols">
        <div
          className="home-next-show-large-col home-next-show-large-col--primary tap"
          onClick={() => call('openView', 'event', show.id)}
        >
          <h2 className="home-next-show-large-title">{title}</h2>
          {venueLine ? <p className="home-next-show-large-venue">{venueLine}</p> : null}
          {location ? <p className="home-next-show-large-loc">{location}</p> : null}
          {(show.date || setLine) ? (
            <div className="home-next-show-medium-datetime home-next-show-large-datetime">
              {show.date ? (
                <span className="home-next-show-medium-dt">
                  <Icon name="calendar" size={14} />
                  <span>{dateLine}</span>
                </span>
              ) : null}
              {setLine ? (
                <span className="home-next-show-medium-dt">
                  <Icon name="music" size={14} />
                  <span>{setLine}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {venueAddress ? (
            <p className="home-next-show-large-address">
              <Icon name="pin" size={14} />
              <span>{venueAddress}</span>
            </p>
          ) : null}
        </div>
        {(extraDetails.length > 0 || primaryContact) ? (
          <div
            className="home-next-show-large-col home-next-show-large-col--secondary"
            onClick={(e: any) => e.stopPropagation()}
          >
            {extraDetails.length > 0 ? (
              <ul className="home-next-show-large-details">
                {extraDetails.map((row) => (
                  <li key={row.key} className="home-next-show-large-detail">
                    <Icon name={row.icon || 'clock'} size={13} />
                    <span className="home-next-show-large-detail-lab">{row.label}</span>
                    <span className="home-next-show-large-detail-val">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {primaryContact ? (
              <div className="home-next-show-large-contact">
                <div className="home-next-show-large-contact-body">
                  <span className="home-next-show-large-contact-name">{primaryContact.name}</span>
                  <span className="home-next-show-large-contact-role">{primaryContact.label}</span>
                </div>
                <div className="home-next-show-large-contact-act">
                  {primaryContact.phone ? (
                    <button
                      type="button"
                      className="home-next-show-large-icon-btn"
                      title="Call"
                      onClick={() => call('callNumber', primaryContact.phone)}
                    >
                      <Icon name="phone" size={15} />
                    </button>
                  ) : null}
                  {(primaryContact.whatsapp || primaryContact.phone) ? (
                    <button
                      type="button"
                      className="home-next-show-large-icon-btn"
                      title="WhatsApp"
                      onClick={() => call('whatsapp', primaryContact.whatsapp || primaryContact.phone)}
                    >
                      <Icon name="whatsapp" size={15} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="home-next-show-medium-actions home-next-show-large-actions">
        {venueQ ? (
          <button
            type="button"
            className="home-next-show-medium-action"
            onClick={() => call('openMaps', venueQ)}
          >
            <Icon name="map" size={14} /> Directions
          </button>
        ) : null}
        {hasContacts ? (
          <button
            type="button"
            className="home-next-show-medium-action"
            onClick={() => call('openTourContacts', show.id)}
          >
            <Icon name="users" size={14} /> Key contacts
          </button>
        ) : null}
        <button
          type="button"
          className="home-next-show-medium-action"
          onClick={() => call('openView', 'event', show.id)}
        >
          <Icon name="chevR" size={14} /> View show
        </button>
      </div>
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

function UpcomingTravelActions({ journey, pass, onNavigate }: Record<string, any>){
  return (
    <div className="home-travel-journey-actions" onClick={(e: any) => e.stopPropagation()}>
      {journey.mapsQuery ? (
        <button type="button" className="home-next-show-medium-action" onClick={() => call('openMaps', journey.mapsQuery)}>
          <Icon name="map" size={14} /> Directions
        </button>
      ) : null}
      {pass?.showId ? (
        <button
          type="button"
          className="home-next-show-medium-action"
          onClick={() => call('openPassByRef', pass.showId, pass.pass?.id, pass.flightId)}
        >
          <Icon name="ticket" size={14} /> View booking
        </button>
      ) : pass?.legId ? (
        <button type="button" className="home-next-show-medium-action" onClick={() => call('viewItemPass', pass.legId, pass.pass?.id)}>
          <Icon name="ticket" size={14} /> View booking
        </button>
      ) : journey.showId ? (
        <button type="button" className="home-next-show-medium-action" onClick={onNavigate}>
          <Icon name="chevR" size={14} /> View booking
        </button>
      ) : null}
      {(journey.phone || journey.whatsapp) ? (
        <button type="button" className="home-next-show-medium-action" onClick={() => call('whatsapp', journey.whatsapp || journey.phone)}>
          <Icon name="chat" size={14} /> Contact driver
        </button>
      ) : null}
      {journey.phone ? (
        <button type="button" className="home-next-show-medium-action" onClick={() => call('callNumber', journey.phone)}>
          <Icon name="phone" size={14} /> Call
        </button>
      ) : null}
      {journey.bookingRef ? (
        <button type="button" className="home-next-show-medium-action" onClick={() => call('copyText', journey.bookingRef)}>
          <Icon name="copy" size={14} /> Copy ref
        </button>
      ) : null}
    </div>
  );
}

function UpcomingTravelJourneyCard({ journey, onOpen }: Record<string, any>){
  const status = journey.status || 'upcoming';
  const stClass = status === 'ongoing' ? 'is-ongoing' : 'is-upcoming';
  const cd = status === 'upcoming' && journey.depMs ? journeyCountdown(journey.depMs) : null;
  const pass = journeyBoardingPass(journey);
  const duration = journeyDurationText(journey) || journey.typeLabel || '';
  const chips = journeySupportingChips(journey);
  const detailLines = journeyDetailLines(journey);
  const passengers = journeyPassengerSummary(journey);
  const raw = journey.rawFlight || journey.rawLeg || journey.rawDriver || journey.rawStep?.ref;
  const depPlaceLabel = journeyRoutePlaceLabel(journey.depPlace, raw, 'from');
  const arrPlaceLabel = journeyRoutePlaceLabel(journey.arrPlace, raw, 'to');
  const dep = journeyPlaceDisplay(depPlaceLabel);
  const arr = journeyPlaceDisplay(arrPlaceLabel);
  const depWhen = formatJourneyWhen(journey.depDate, journey.depTime);
  const arrWhen = formatJourneyWhen(journey.arrDate, journey.arrTime);
  const depHints = journeyEndpointHints(journey, 'dep');
  const arrHints = journeyEndpointHints(journey, 'arr');

  return (
    <div className={`home-travel-journey tap${stClass}`} onClick={onOpen}>
      <div className="home-travel-journey-top">
        <span className="home-travel-journey-heading">Upcoming travel</span>
        <div className="home-travel-journey-top-meta">
          <span className="home-travel-journey-type">
            <Icon name={journey.icon || 'planeTop'} size={15} />
            {journey.typeLabel}
          </span>
          <span className={`home-travel-journey-status ${stClass}`}>{journeyStatusLabel(status)}</span>
          {journey.showId ? (
            <button type="button" className="home-travel-journey-details" onClick={(e: any) => { e.stopPropagation(); onOpen(); }}>
              Details
            </button>
          ) : null}
        </div>
      </div>
      <div className="home-travel-journey-main">
        <div className="home-travel-journey-route-wrap">
          <div className="home-travel-journey-route">
            <div className="home-travel-journey-end is-dep">
              {dep.code ? <span className="home-travel-journey-code">{dep.code}</span> : null}
              <span className="home-travel-journey-place">{dep.label || depPlaceLabel || 'Departure'}</span>
              {depWhen ? <span className="home-travel-journey-when">{depWhen}</span> : null}
              {depHints.length ? (
                <div className="home-travel-journey-end-meta">
                  {depHints.map((hint) => (
                    <span key={hint} className="home-travel-journey-end-hint">{hint}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="home-travel-journey-mid" aria-hidden>
              <Icon name={journey.icon || 'planeTop'} size={20} />
              {duration ? <span className="home-travel-journey-dur">{duration}</span> : null}
            </div>
            <div className="home-travel-journey-end is-arr">
              {arr.code ? <span className="home-travel-journey-code">{arr.code}</span> : null}
              <span className="home-travel-journey-place">{arr.label || arrPlaceLabel || 'Arrival'}</span>
              {arrWhen ? <span className="home-travel-journey-when">{arrWhen}</span> : null}
              {arrHints.length ? (
                <div className="home-travel-journey-end-meta">
                  {arrHints.map((hint) => (
                    <span key={hint} className="home-travel-journey-end-hint">{hint}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {(cd || chips.length) ? (
            <div className="home-travel-journey-meta">
              {cd ? (
                <span className="home-travel-journey-countdown" {...(journey.depMs ? { 'data-countdown-ms': journey.depMs } : {})}>
                  <span className="home-travel-journey-countdown-k">Departs in</span>
                  <span className="home-travel-journey-countdown-v">
                    <span className="cd-txt">{cd.txt}</span>
                    {cd.unit ? <small className="cd-unit">{cd.unit}</small> : null}
                  </span>
                </span>
              ) : null}
              {chips.map((chip) => (
                <span key={chip.key} className="home-travel-journey-chip">
                  <span className="home-travel-journey-chip-k">{chip.label}</span>
                  <span className="home-travel-journey-chip-v">{chip.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <aside className="home-travel-journey-side" onClick={(e: any) => e.stopPropagation()}>
          {detailLines.length ? (
            <div className="home-travel-journey-details">
              <span className="home-travel-journey-side-title">Travel details</span>
              <ul className="home-travel-journey-detail-list">
                {detailLines.map((line) => (
                  <li key={line.key} className="home-travel-journey-detail-row">
                    <span className="home-travel-journey-detail-k">{line.label}</span>
                    <span className="home-travel-journey-detail-v">{line.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="home-travel-journey-pax">
            <span className="home-travel-journey-side-title">Passengers</span>
            {passengers.length ? (
              <ul className="home-travel-journey-pax-list">
                {passengers.map((p) => (
                  <li key={p.key} className="home-travel-journey-pax-row">
                    <span className="home-travel-journey-pax-name">{p.name}</span>
                    {p.seat ? <span className="home-travel-journey-pax-seat">Seat {p.seat}</span> : null}
                    {p.extra ? <span className="home-travel-journey-pax-extra">{p.extra}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-travel-journey-pax-empty">No passenger names on this booking yet.</p>
            )}
          </div>
        </aside>
      </div>
      <UpcomingTravelActions journey={journey} pass={pass} onNavigate={onOpen} />
    </div>
  );
}

function UpcomingTravelWidget({ journey, show, density = 'default' }: Record<string, any>){
  const compact = density === 'compact';
  const expanded = density === 'expanded';
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

  if(expanded){
    return <UpcomingTravelJourneyCard journey={journey} onOpen={openDetails} />;
  }

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
        <div className="home-travel-body">
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
        </div>
        <div className="hero-links home-travel-links">
          <UpcomingTravelActions journey={journey} pass={pass} onNavigate={openDetails} />
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
        <div className={`home-acc-layout${!compact ? ' is-wide' : ''}`}>
          <div className="home-acc-head">
            <div className="home-acc-icon" aria-hidden><Icon name="bed" size={18} /></div>
            <div className="home-acc-head-text">
              <span className={`tag home-acc-status ${stClass}`}>{statusLabel(status)}</span>
              <h3 className="home-acc-name">{booking.name}</h3>
              {booking.location ? <div className="home-acc-loc"><Icon name="pin" size={13} /> {booking.location}</div> : null}
            </div>
          </div>
          <div className="home-acc-facts">
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
          </div>
        </div>
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

function TodayScheduleWidget({ today, sel, focusRun, storeTick, density = 'default', size = 'medium', gridH }: Record<string, any>){
  const [minuteTick, setMinuteTick] = useState(0);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const isLarge = size === 'large' || density === 'expanded';
  const rowCap = listCapForWidget('todaySchedule', size);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((t: any) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(
    () => buildTodayScheduleRows({ today, sel, focusRun }),
    [today, sel, focusRun, storeTick, minuteTick],
  );
  const live = useMemo(
    () => todayScheduleLiveState(today, rows),
    [today, rows, minuteTick, storeTick],
  );
  const visibleRows = useMemo(
    () => (isLarge ? rows : todayScheduleVisibleRows(rows, live, rowCap)),
    [rows, live, isLarge, rowCap],
  );
  const dayLabel = fmtDateLong ? fmtDateLong(today) : (fmtDate ? fmtDate(today) : today);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  const bump = useCallback(() => {
    if(typeof call === 'function') try{ call('haptic'); }catch(_){}
    notifyStore();
  }, []);

  return (
    <HomePanel title="Today's schedule" className={`home-today-panel${isLarge ? ' home-today-panel--full' : ''}`}>
      {rows.length ? (
        <div
          ref={timelineRef}
          className={`timeline show-day-timeline tl-preview home-today-timeline${
            isLarge ? ' home-today-timeline--scroll' : ''
          }${live?.activeId ? ' has-now' : ''}`}
        >
          <TimelineDayRow label={`${dayLabel} · Today`} today />
          {visibleRows.map((row: any) => {
            const isRun = !!row.runStep;
            const raw = isRun ? row.runStep : undefined;
            const runKey = isRun && focusRun?.key ? focusRun.key : undefined;
            const loc = stepLocation(row.timelineStep, row.show, row.runStep);
            return (
              <LiveTimelineStepRow
                key={row.key}
                step={row.timelineStep}
                rawStep={raw}
                runKey={runKey}
                expandOnRowClick={false}
                live={live}
                location={loc}
                onToggle={() => {
                  if(row.runStep && focusRun?.key){
                    call('completeRunStep', focusRun.key, row.runStep.id);
                  } else if(row.show && row.showStep && call('toggleShowAutoTimelineStep', row.show, row.showStep.id)){
                    call('persist', 'shows', row.show.id);
                  }
                  bump();
                }}
                onOpen={() => {
                  if(row.runStep && focusRun?.key){
                    call('timelineStepOptions', focusRun.key, row.runStep.id);
                  } else if(row.show && row.showStep){
                    openTimelineStep(row.show, row.showStep);
                  }
                }}
              />
            );
          })}
          {hiddenCount > 0 ? (
            <div className="tl-more-row">
              <span />
              <span />
              <span className="home-today-more hint">{hiddenCount} more later today — switch to Large or open a show</span>
            </div>
          ) : null}
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
    const display = readHomeWidgetGrid().map((g: any) => displayGridItem(g, gridCols));
    setGridDraft(compactGridItems(display, gridCols));
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
    const packed = compactGridItems(gridDraftRef.current, gridCols);
    const stored = packed.map((item: any) => storeGridItem(item, gridCols));
    writeHomeWidgetGrid(stored, HOME_GRID_BASE_COLS);
    setGridDraft(readHomeWidgetGrid());
    setWidgetEditing(false);
  };

  const persistGrid = useCallback((next: any) => {
    const packed = compactGridItems(next, gridCols);
    const stored = packed.map((item: any) => storeGridItem(item, gridCols));
    const display = stored.map((g: any) => displayGridItem(g, gridCols));
    gridDraftRef.current = display;
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
      const layoutGrid = widgetEditing
        ? gridDraftRef.current.slice()
        : gridDraftRef.current.map((g: any) => displayGridItem(g, gridCols));
      const next = placeGridWidgetAtPointer(
        layoutGrid,
        d.id,
        widgetListRef.current,
        d.clientX,
        d.clientY,
        gridCols,
        HOME_GRID_ROW_PX,
      );
      const samePlace = layoutGrid.every((g: any) => {
        const n = next.find((x: any) => x.id === g.id);
        return n && n.x === g.x && n.y === g.y;
      });
      if(samePlace) return;
      queueWidgetFlip(d.id);
      gridDraftRef.current = next;
      setGridDraft(next.slice());
      if(typeof call === 'function') try{ call('haptic'); }catch(_){}
    });
  }, [gridCols, queueWidgetFlip, widgetEditing]);

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
    const base = widgetEditing
      ? gridDraftRef.current.slice()
      : gridDraftRef.current.map((g: any) => displayGridItem(g, gridCols));
    const next = compactGridItems(setWidgetSize(base, id, size, gridCols), gridCols);
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
  const personaBlurb = call('homePersonaBlurb') || '';
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
  const widgetGrid = useMemo(() => {
    if (widgetEditing) {
      return sortGridItems(
        sourceGrid.map((g: any) => {
          const dims = dimensionsForWidget(g.id, g.size);
          const w = Math.min(dims.w, gridCols);
          const x = Math.min(Math.max(0, g.x || 0), Math.max(0, gridCols - w));
          return { ...g, x, y: Math.max(0, g.y || 0), w, h: dims.h, size: dims.size };
        }),
      );
    }
    return displayGridLayout(sourceGrid, gridCols);
  }, [sourceGrid, gridCols, widgetEditing, gridDraft, tick]);
  const widgetsToAdd = widgetEditing ? availableHomeWidgets(widgetGrid) : [];
  const gridMaxRow = widgetGrid.reduce((m: any, g: any) => Math.max(m, g.y + g.h), 0);
  const dailyOverviewLines = useMemo(
    () => buildDailyOverviewLines({
      today,
      sel,
      focusRun,
      liveRun,
      nextShow: show,
      nextJourney,
      tasks: homeTasks,
      personaBlurb,
    }),
    [today, sel, focusRun, liveRun, show, nextJourney, homeTasks, personaBlurb, tick],
  );
  const dateLine = useMemo(() => fmtDateLong(today), [today, tick]);

  const widgetNode = (id: any, density: any, size: any, gridH?: number) => {
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
            gridH={gridH}
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

  const header = (
    <div
      className={`home-hero${photo ? '' : ' is-default'}`}
      style={photo ? {
        backgroundImage: `url('${photo}')`,
        backgroundPosition: call('homeHeaderPositionCss') || 'center',
      } : undefined}
    >
      {heroActions}
      <div className="home-hero-text">
        <div className="hero-hello">{greet}{nameBit}</div>
        <div className="hero-date">{dateLine}</div>
      </div>
    </div>
  );

  return (
    <div className="tab-page home-tab">
      <section className="home-permanent" aria-label="Home">
        {header}
        <div className="home-permanent-body screen-pad">
          {!widgetEditing ? (
            <>
              <DailyOverview lines={dailyOverviewLines} />
              <HomeActions className="home-quick-actions" />
            </>
          ) : null}
        </div>
      </section>
      <section
        className={`screen-pad home-screen home-workspace tab-page-body${widgetEditing ? ' home-screen--edit' : ''}`}
        aria-label="Your widgets"
      >
        {!widgetEditing ? (
          <p className="home-workspace-eyebrow" aria-hidden>Your workspace</p>
        ) : null}
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
            const node = widgetNode(id, density, item.size, item.h);
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
                data-size={item.size || 'medium'}
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
        <div className="spacer" />
      </section>
    </div>
  );
}
