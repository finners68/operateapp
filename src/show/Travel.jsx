import { call, flightHasDetails, fmtDate, sortJourneysChrono } from '../api/operate.js';
import { Subsection, CompactAddRow, LegacyHtml, Icon } from './ui.jsx';
import { NoteItemsRead } from './NoteItems.jsx';

const TRAVEL_MODES = [
  { key: 'flight', icon: 'plane', title: 'Flight', sub: 'Number, times, passengers and boarding passes' },
  { key: 'train', icon: 'train', title: 'Train', sub: 'Stations, times and service number' },
  { key: 'coach', icon: 'bus', title: 'Coach', sub: 'Service and times' },
  { key: 'ferry', icon: 'ferry', title: 'Ferry', sub: 'Ports and times' },
  { key: 'ground', icon: 'car', title: 'Drive', sub: 'Pre-arranged or arrange at time' },
  { key: 'walk', icon: 'walk', title: 'Walk', sub: 'On foot between places' },
  { key: 'cycle', icon: 'cycle', title: 'Cycle', sub: 'Bike between places' }
];

function legsOf(showId){
  return call('showLegs', showId) || [];
}

function chrono(list, fallbackDate){
  const sorted = sortJourneysChrono(list, fallbackDate);
  return Array.isArray(sorted) ? sorted : (list || []).slice();
}

function flightLegs(show){
  return chrono(
    legsOf(show.id).filter(x => x.kind === 'travel' && (x.icon || 'plane') === 'plane'),
    show.date
  );
}

function stayLegs(show){
  return chrono(
    legsOf(show.id).filter(x => x.kind === 'stay'),
    show.date
  );
}

function driverLegs(show){
  return chrono(
    legsOf(show.id).filter(x => x.kind === 'travel' && call('isDriverItem', x)),
    show.date
  );
}

function transferLegs(show){
  return chrono(
    legsOf(show.id).filter(x => x.kind === 'travel' && call('travelTypeKey', x)),
    show.date
  );
}

function legsOfType(show, key){
  return chrono(
    legsOf(show.id).filter(x => x.kind === 'travel' && call('travelTypeKey', x) === key),
    show.date
  );
}

function manualFlights(show){
  const list = (show.flights || []).filter(f => {
    const fn = flightHasDetails;
    return typeof fn !== 'function' || fn(f);
  });
  return chrono(list, show.date);
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
      <div className="card flush">
        {legs.map(l => <LegacyHtml key={l.id} html={call('journeyRow', l)} />)}
      </div>
    );
  }
  return (
    <>
      {legs.map(l => (
        <div className="card flush flight-card-wrap" key={l.id}>
          <LegacyHtml html={call('travelLegCard', l)} />
        </div>
      ))}
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
  const cards = chrono([
    ...legs.map(l => ({ id: 'leg-' + l.id, _kind: 'leg', date: l.date, start: l.start, time: l.time, dep: l.dep, trueDate: l.trueDate, data: l })),
    ...manual.map(f => ({ id: 'flt-' + f.id, _kind: 'flight', date: show.date, dep: f.dep, data: f }))
  ], show.date);
  if(!cards.length) return null;
  return (
    <Subsection
      id={`ss-${show.id}-flights`}
      title="Flights"
      addLabel="Add"
      onAdd={() => call('sheetFlight', show.id, '__new__')}
      defaultOpen
    >
      {cards.map(card => (
        <div className="card flush flight-card-wrap" key={card.id}>
          <LegacyHtml html={card._kind === 'leg' ? call('travelLegCard', card.data) : call('flightLine', show.id, card.data)} />
        </div>
      ))}
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
      defaultOpen
    >
      {has ? (
        <>
          {!h && legs.length ? <JourneyCards legs={legs} /> : null}
          {h ? (
            <div className="card flush show-stay-card" onClick={() => call('sheetHotel', show.id)}>
              <div className="show-stay-main">
                <div className="ic"><Icon name="bed" size={17} /></div>
                <div className="show-stay-body">
                  <div className="show-stay-name">{h.name || 'Accommodation'}</div>
                  {addr ? <div className="show-stay-addr">{addr}</div> : null}
                  {(() => {
                    const inn = h.checkin && fmtDate ? fmtDate(h.checkin) : (h.checkin || '');
                    const out = h.checkout && fmtDate ? fmtDate(h.checkout) : (h.checkout || '');
                    const dates = [inn, out].filter(Boolean).join(' → ');
                    return dates ? <div className="show-stay-meta">{dates}</div> : null;
                  })()}
                  {conf ? <div className="show-stay-meta">Ref {conf}</div> : null}
                </div>
                {mapQ ? (
                  <button
                    type="button"
                    className="show-stay-maps"
                    title="Open in Maps"
                    onClick={e => { e.stopPropagation(); call('openMaps', mapQ); }}
                  >
                    <Icon name="map" size={16} /> Maps
                  </button>
                ) : null}
              </div>
              {h.phone ? (
                <div className="show-stay-extra" onClick={e => { e.stopPropagation(); call('callNumber', h.phone); }}>
                  {h.phone}
                </div>
              ) : null}
              <NoteItemsRead label="Room notes" value={h.notes} />
            </div>
          ) : null}
        </>
      ) : none ? (
        <CompactAddRow label="No accommodation" onAdd={() => call('sheetHotel', show.id)} />
      ) : (
        <>
          <CompactAddRow
            label="Add accommodation"
            onAdd={() => call('sheetHotel', show.id)}
          />
          <button
            type="button"
            className="quiet-add"
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
  const ordered = call('orderedDrivers', show) || drivers.map((d, idx) => ({ d, idx }));
  const cards = chrono([
    ...legs.map(l => ({ id: 'leg-' + l.id, _kind: 'leg', date: l.date, start: l.start, time: l.time, dep: l.dep, trueDate: l.trueDate, data: l })),
    ...ordered.map(o => ({ id: 'drv-' + (o.d.id || o.idx), _kind: 'driver', date: o.d.date, time: o.d.time, start: o.d.start, dep: o.d.dep, data: o }))
  ], show.date);
  if(!cards.length) return null;

  return (
    <Subsection
      id={`ss-${show.id}-driver`}
      title="Ground transport"
      addLabel="Add"
      onAdd={() => call('sheetDriver', show.id)}
      defaultOpen
    >
      {cards.map(card => (
        <div className="card flush flight-card-wrap" key={card.id}>
          <LegacyHtml html={
            card._kind === 'leg'
              ? call('travelLegCard', card.data)
              : call('driverCard', show.id, card.data.d, card.data.idx)
          } />
        </div>
      ))}
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
        <div className="card flush flight-card-wrap" key={l.id}>
          <LegacyHtml html={call('travelLegCard', l)} />
        </div>
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
