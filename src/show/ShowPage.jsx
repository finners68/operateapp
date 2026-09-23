import { useSyncExternalStore } from 'react';
import { call, fmtDate, getCats, getEvent, getSel, getStore, iconHtml, subscribeStore } from '../api/operate.js';
import { Group, Icon } from './ui.jsx';
import { UploadBanner, QuickLinks } from './Banner.jsx';
import TravelGroup from './Travel.jsx';
import VenueGroup from './Venue.jsx';
import DealGroup from './Deal.jsx';
import { DayOverview, Checklist, Notes, ContentBlock, Attachments } from './Prep.jsx';

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

function todayISO(){
  const t = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

function showIsPast(show){
  if(!show) return false;
  if(show.status === 'cancelled') return true;
  const d = String(show.date || '').slice(0, 10);
  return !!(d && d < todayISO());
}

function Foot({ show }){
  const run = call('runOf', show.id);
  const otherShows = run ? run.shows.length - 1 : 0;
  const store = getStore();
  const active = store?.activeShowId && call('runOf', store.activeShowId)?.key === (run && run.key);
  const past = showIsPast(show);
  return (
    <>
      {!past || active ? (
        <div className={`show-trip-cta${past && active ? ' is-quiet' : ''}`}>
          {active ? (
            <button type="button" className="btn" onClick={() => call('go', 'home')}>
              <Icon name="play" size={18} /> Tour Mode is live — open it
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => call('startTripFromShow', show.id)}>
              <Icon name="play" size={18} /> Start Tour Mode{otherShows > 0 ? ` (this run · ${run.shows.length} shows)` : ''}
            </button>
          )}
          {otherShows > 0 && !past ? (
            <div className="hint" style={{ textAlign: 'left', padding: '8px 2px 0' }}>
              Auto-grouped with {otherShows} nearby show{otherShows > 1 ? 's' : ''} into one tour — no naming needed.
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="show-danger-zone">
        <button type="button" className="show-danger-link" onClick={() => call('confirmDeleteEvent', show.id)}>
          Delete show
        </button>
      </div>
    </>
  );
}

export default function ShowPage({ showId }){
  useStoreTick();
  const show = useShow(showId);
  if(!show){
    return <div className="empty"><b>Gone</b></div>;
  }
  if(typeof window.migrateShowFlightInfo === 'function') window.migrateShowFlightInfo(show);

  const CATS = getCats() || {};
  const c = CATS[show.color] || CATS.purple || '#6d5efc';
  const titleColor = show.textColor && CATS[show.textColor] ? CATS[show.textColor] : '';
  const trip = show.tripId && getSel()?.trip ? getSel().trip(show.tripId) : null;
  const backLabel = trip ? trip.name : (call('overlayBackLabel') || 'Back');

  const travelSummary = call('travelGroupSummary', show) || '';
  const venueSummary = call('venueGroupSummary', show) || '';
  const dealSummary = call('dealGroupSummary', show) || '';
  const prepSummary = call('prepGroupSummary', show) || '';
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

      <div
        className={`screen-pad show-detail show-detail-react${titleColor ? ' show-title-toned' : ''}`}
        style={{ '--show-color': c, ...(titleColor ? { '--show-title': titleColor } : {}) }}
      >
        <UploadBanner showId={show.id} />

        <div className="dhero show-hero" style={{ background: `linear-gradient(155deg,${c}33,var(--card) 65%)` }}>
          <div className="cat-bar" style={{ background: c }} />
          <div className="show-hero-top">
            <span className={`tag ${show.status}`}>{show.status}</span>
            {trip ? (
              <span className="tag" style={{ background: `${c}22`, color: c }} onClick={() => call('openView', 'trip', trip.id)}>
                {trip.name}
              </span>
            ) : null}
          </div>
          <h1 className="show-hero-title">{show.eventName || show.venue || 'Untitled show'}</h1>
          {(() => {
            const bits = [];
            if(show.eventName && show.venue) bits.push(show.venue);
            const loc = [show.city, show.country].filter(Boolean).join(', ');
            if(loc) bits.push(loc);
            else if(!show.eventName && !show.venue) bits.push('City TBA');
            return bits.length ? <div className="show-hero-place">{bits.join(' · ')}</div> : null;
          })()}
          <div className="show-hero-facts">
            <span>{fmtDate ? fmtDate(show.date) : show.date}</span>
            {show.setTime ? (
              <span>Set {show.setTime}{show.endTime ? `–${show.endTime}` : ''}</span>
            ) : null}
            {show.arrival ? <span>Venue arrival {show.arrival}</span> : null}
          </div>
        </div>

        <QuickLinks show={show} />

        <DayOverview show={show} />

        <div className="show-groups">
          <Group id={`sg-${show.id}-travel`} title="Travel & stay" icon={iconHtml('plane', 20)} summary={travelSummary}>
            <TravelGroup show={show} />
          </Group>
          <Group id={`sg-${show.id}-venue`} className="show-venue-panel" title="Venue & show day" icon={iconHtml('pin', 20)} summary={venueSummary}>
            <VenueGroup show={show} />
          </Group>
          <Group id={`sg-${show.id}-prep`} className="is-mid" title="Day prep" icon={iconHtml('checkList', 20)} summary={prepSummary}>
            <Checklist show={show} />
            <ContentBlock show={show} />
            <Attachments show={show} />
            <Notes show={show} />
          </Group>
          <Group id={`sg-${show.id}-deal`} className="is-quiet" title="Fee & deal" icon={iconHtml('coins', 20)} summary={dealSummary}>
            <DealGroup show={show} />
          </Group>
        </div>

        <div className="show-detail-foot">
          <Foot show={show} />
        </div>
      </div>
    </>
  );
}
