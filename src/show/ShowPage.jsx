import { useSyncExternalStore } from 'react';
import { call, fmtDate, getCats, getEvent, getSel, getStore, iconHtml, pad, relDay, subscribeStore } from '../api/operate.js';
import { Group, Icon } from './ui.jsx';
import { UploadBanner, QuickLinks } from './Banner.jsx';
import TravelGroup from './Travel.jsx';
import VenueGroup from './Venue.jsx';
import DealGroup from './Deal.jsx';
import { Timeline, Checklist, Notes, ContentBlock, Attachments } from './Prep.jsx';

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

export default function ShowPage({ showId }){
  useStoreTick();
  const show = useShow(showId);
  if(!show){
    return <div className="empty"><b>Gone</b></div>;
  }
  if(typeof window.migrateShowFlightInfo === 'function') window.migrateShowFlightInfo(show);

  const CATS = getCats() || {};
  const c = CATS[show.color] || CATS.purple || '#6d5efc';
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

      <div className="screen-pad show-detail show-detail-react">
        <UploadBanner showId={show.id} />

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
          <QuickLinks show={show} />
        </div>

        <div className="show-groups">
          <Group id={`sg-${show.id}-travel`} title="Travel" icon={iconHtml('plane', 20)} summary={travelSummary}>
            <TravelGroup show={show} />
          </Group>
          <Group id={`sg-${show.id}-venue`} title="Venue & show day" icon={iconHtml('pin', 20)} summary={venueSummary}>
            <VenueGroup show={show} />
          </Group>
          <Group id={`sg-${show.id}-deal`} title="Fee & deal" icon={iconHtml('coins', 20)} summary={dealSummary}>
            <DealGroup show={show} />
          </Group>
          <Group id={`sg-${show.id}-prep`} title="Day prep" icon={iconHtml('checkList', 20)} summary={prepSummary}>
            <Timeline show={show} />
            <ContentBlock show={show} />
            <Attachments show={show} />
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
