import { call, flightHasDetails, fmtDate, legSort } from '../api/operate.js';
import { Subsection, EmptyTap, SourceLabel, LegacyHtml, FieldTx, DetailTx, Icon } from './ui.jsx';
import { NoteItemsRead } from './NoteItems.jsx';

const TRAVEL_MODES = [
  { key: 'flight', icon: 'plane', title: 'Flight', sub: 'Number, times, passengers and boarding passes' },
  { key: 'train', icon: 'train', title: 'Train', sub: 'Stations, times and service number' },
  { key: 'coach', icon: 'bus', title: 'Coach', sub: 'Service and times' },
  { key: 'ferry', icon: 'ferry', title: 'Ferry', sub: 'Ports and times' },
  { key: 'ground', icon: 'car', title: 'Ground', sub: 'Pre-arranged or arrange at time' },
  { key: 'walk', icon: 'walk', title: 'Walk', sub: 'On foot between places' },
  { key: 'cycle', icon: 'cycle', title: 'Cycle', sub: 'Bike between places' }
];

function legsOf(showId){
  return call('showLegs', showId) || [];
}

function byLegSort(a, b){
  const sort = legSort;
  return typeof sort === 'function' ? sort(a, b) : 0;
}

function flightLegs(show){
  return legsOf(show.id)
    .filter(x => x.kind === 'travel' && (x.icon || 'plane') === 'plane')
    .sort(byLegSort);
}

function stayLegs(show){
  return legsOf(show.id)
    .filter(x => x.kind === 'stay')
    .sort(byLegSort);
}

function driverLegs(show){
  return legsOf(show.id)
    .filter(x => x.kind === 'travel' && call('isDriverItem', x))
    .sort(byLegSort);
}

function transferLegs(show){
  return legsOf(show.id)
    .filter(x => x.kind === 'travel' && call('travelTypeKey', x))
    .sort(byLegSort);
}

function legsOfType(show, key){
  return legsOf(show.id)
    .filter(x => x.kind === 'travel' && call('travelTypeKey', x) === key)
    .sort(byLegSort);
}

function manualFlights(show){
  const list = (show.flights || []).filter(f => {
    const fn = flightHasDetails;
    return typeof fn !== 'function' || fn(f);
  });
  const sorted = call('sortFlightsChrono', list, show.date);
  return Array.isArray(sorted) ? sorted : list;
}

function hasAnyTravel(show){
  const drivers = call('showDrivers', show) || [];
  return !!(
    flightLegs(show).length
    || manualFlights(show).length
    || driverLegs(show).length
    || drivers.length
    || transferLegs(show).length
  );
}

function JourneyCards({ legs }){
  if(!legs.length) return null;
  const stays = legs.every(l => l.kind === 'stay');
  if(stays){
    return (
      <>
        <SourceLabel text="From journey" />
        <div className="card flush">
          {legs.map(l => <LegacyHtml key={l.id} html={call('journeyRow', l)} />)}
        </div>
      </>
    );
  }
  return (
    <>
      <SourceLabel text="From journey" />
      {legs.map(l => <LegacyHtml key={l.id} html={call('travelLegCard', l)} />)}
    </>
  );
}

export function AddTravelPicker({ show, inSheet }){
  return (
    <div className="edit-section-grid" style={inSheet ? undefined : { marginBottom: 12 }}>
      {TRAVEL_MODES.map(m => (
        <button
          type="button"
          key={m.key}
          className="edit-section-btn"
          onClick={() => call('addTravelMode', show.id, m.key)}
        >
          <Icon name={m.icon} size={16} />
          <span>
            <b>{m.title}</b>
            <small>{m.sub}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function Flights({ show }){
  const legs = flightLegs(show);
  const manual = manualFlights(show);
  const has = !!(legs.length || manual.length);
  if(!has) return null;
  return (
    <Subsection
      id={`ss-${show.id}-flights`}
      title="Flights"
      addLabel="Add"
      onAdd={() => call('sheetFlight', show.id, '__new__')}
      defaultOpen
    >
      <JourneyCards legs={legs} />
      {manual.length ? (
        <>
          {legs.length ? <SourceLabel text="Added to show" /> : null}
          {manual.map(f => (
            <div className="card flush flight-card-wrap" key={f.id}>
              <LegacyHtml html={call('flightLine', show.id, f)} />
            </div>
          ))}
        </>
      ) : null}
    </Subsection>
  );
}

function Accommodation({ show }){
  const legs = stayLegs(show);
  const h = show.hotel;
  const none = !!show.noAccommodation && !h && !legs.length;
  const has = !!(legs.length || h);
  const addr = h
    ? (call('formatHotelAddress', h)
      || [h.address, h.postcode].filter(Boolean).join(', '))
    : '';
  const conf = h ? (call('hotelBookingRef', h) || h.conf || h.bookingRef || '') : '';
  const mapQ = call('hotelMapQuery', show) || '';

  return (
    <Subsection
      id={`ss-${show.id}-hotel`}
      title="Accommodation"
      addLabel={has ? 'Edit' : 'Add'}
      onAdd={() => call('sheetHotel', show.id)}
      defaultOpen={!has}
    >
      {has ? (
        <>
          <JourneyCards legs={legs} />
          {h ? (
            <>
              {legs.length ? <SourceLabel text="Added to show" /> : null}
              <div className="card flush">
                <div className="info-line info-line-stacked">
                  <div className="ic"><Icon name="bed" size={17} /></div>
                  <DetailTx title={h.name || 'Accommodation'} primary={addr || 'Tap to add address'} />
                  <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} onClick={() => call('openMaps', mapQ)}>
                    <Icon name="map" size={16} />
                  </button>
                </div>
                <div className="info-line">
                  <div className="ic"><Icon name="clock" size={17} /></div>
                  <FieldTx
                    label="Check in / out"
                    value={`${h.checkin && fmtDate ? fmtDate(h.checkin) : (h.checkin || '—')} → ${h.checkout && fmtDate ? fmtDate(h.checkout) : (h.checkout || '—')}`}
                  />
                </div>
                {conf ? (
                  <div className="info-line" onClick={() => call('copyText', conf)}>
                    <div className="ic"><Icon name="ticket" size={17} /></div>
                    <FieldTx label="Confirmation" value={conf} />
                    <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }}><Icon name="copy" size={16} /></button>
                  </div>
                ) : null}
                {h.phone ? (
                  <div className="info-line" onClick={() => call('callNumber', h.phone)}>
                    <div className="ic"><Icon name="phone" size={17} /></div>
                    <FieldTx label="Phone" value={h.phone} />
                    <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }}><Icon name="phone" size={16} /></button>
                  </div>
                ) : null}
                {h.email ? (
                  <div className="info-line" onClick={() => call('copyText', h.email)}>
                    <div className="ic"><Icon name="chat" size={17} /></div>
                    <FieldTx label="Email" value={h.email} />
                    <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }}><Icon name="copy" size={16} /></button>
                  </div>
                ) : null}
                <NoteItemsRead label="Room notes" value={h.notes} />
              </div>
            </>
          ) : null}
        </>
      ) : none ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20 }}>
          <Icon name="bed" size={22} />
          <div style={{ marginTop: 6, fontWeight: 600 }}>No accommodation for this show</div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500 }}>You can add a stay later if that changes</div>
          <button
            type="button"
            className="quiet-add"
            onClick={() => call('sheetHotel', show.id)}
          >
            Add accommodation
          </button>
        </div>
      ) : (
        <>
          <EmptyTap
            icon="bed"
            title="Add accommodation"
            sub="Name, dates, confirmation and maps"
            onClick={() => call('sheetHotel', show.id)}
          />
          <button
            type="button"
            className="btn secondary"
            style={{ marginTop: 10 }}
            onClick={() => call('markNoAccommodation', show.id)}
          >
            No accommodation for this show
          </button>
        </>
      )}
    </Subsection>
  );
}

function Transport({ show }){
  const legs = driverLegs(show);
  const drivers = call('showDrivers', show) || [];
  const has = !!(legs.length || drivers.length);
  const ordered = call('orderedDrivers', show) || drivers.map((d, idx) => ({ d, idx }));
  if(!has) return null;

  return (
    <Subsection
      id={`ss-${show.id}-driver`}
      title="Ground transport"
      addLabel="Add"
      onAdd={() => call('sheetDriver', show.id)}
      defaultOpen
    >
      <JourneyCards legs={legs} />
      {drivers.length ? (
        <>
          {legs.length ? <SourceLabel text="Added to show" /> : null}
          {ordered.map(o => (
            <div className="card flush flight-card-wrap" key={o.d.id || o.idx}>
              <LegacyHtml html={call('driverCard', show.id, o.d, o.idx)} />
            </div>
          ))}
        </>
      ) : null}
    </Subsection>
  );
}

function TravelTypeSection({ show, spec }){
  const legs = legsOfType(show, spec.key);
  if(!legs.length) return null;
  return (
    <Subsection
      id={`ss-${show.id}-${spec.key}`}
      title={spec.title}
      addLabel="Add"
      onAdd={() => call('sheetTravelLeg', show.id, spec.mode)}
      defaultOpen
    >
      {legs.map(l => (
        <LegacyHtml key={l.id} html={call('travelLegCard', l)} />
      ))}
    </Subsection>
  );
}

export default function TravelGroup({ show }){
  const hasTravel = hasAnyTravel(show);
  const typeSpecs = (typeof window !== 'undefined' && window.TRAVEL_TYPE_SECTIONS) || [
    { key: 'train', title: 'Trains', mode: 'train' },
    { key: 'coach', title: 'Coaches', mode: 'coach' },
    { key: 'ferry', title: 'Ferries', mode: 'ferry' },
    { key: 'walk', title: 'Walks', mode: 'walk' },
    { key: 'cycle', title: 'Cycles', mode: 'cycle' }
  ];
  const beforeGround = typeSpecs.filter(s => s.key === 'train' || s.key === 'coach' || s.key === 'ferry');
  const afterGround = typeSpecs.filter(s => s.key === 'walk' || s.key === 'cycle');
  return (
    <>
      {hasTravel ? (
        <>
          <Flights show={show} />
          {beforeGround.map(spec => <TravelTypeSection key={spec.key} show={show} spec={spec} />)}
          <Transport show={show} />
          {afterGround.map(spec => <TravelTypeSection key={spec.key} show={show} spec={spec} />)}
          <button
            type="button"
            className="quiet-add"
            onClick={() => call('sheetAddTravel', show.id)}
          >
            Add travel
          </button>
        </>
      ) : (
        <>
          <div className="block-title" style={{ margin: '2px 2px 8px' }}>Add travel</div>
          <AddTravelPicker show={show} />
        </>
      )}
      <Accommodation show={show} />
    </>
  );
}
