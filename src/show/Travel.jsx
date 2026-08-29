import { call, g } from './bridge.js';
import { Subsection, EmptyTap, SourceLabel, LegacyHtml, FieldTx, DetailTx, Icon } from './ui.jsx';

function legsOf(showId){
  return call('showLegs', showId) || [];
}

function byLegSort(a, b){
  const sort = g('legSort');
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
    .filter(x => x.kind === 'travel' && (x.icon || 'plane') !== 'plane' && !call('isDriverItem', x))
    .sort(byLegSort);
}

function manualFlights(show){
  return (show.flights || []).filter(f => {
    const fn = g('flightHasDetails');
    return typeof fn !== 'function' || fn(f);
  });
}

function JourneyCards({ legs }){
  if(!legs.length) return null;
  return (
    <>
      <SourceLabel text="From journey" />
      <div className="card flush">
        {legs.map(l => <LegacyHtml key={l.id} html={call('journeyRow', l)} />)}
      </div>
    </>
  );
}

function Flights({ show }){
  const legs = flightLegs(show);
  const manual = manualFlights(show);
  const has = !!(legs.length || manual.length);
  return (
    <Subsection
      id={`ss-${show.id}-flights`}
      title="Flights"
      addLabel="Add"
      onAdd={() => call('sheetFlight', show.id)}
      defaultOpen={has}
    >
      {!has ? (
        <EmptyTap
          icon="plane"
          title="Add flight"
          sub="Number, times, passengers and boarding passes"
          onClick={() => call('sheetFlight', show.id)}
        />
      ) : (
        <>
          <JourneyCards legs={legs} />
          {manual.length ? (
            <>
              {legs.length ? <SourceLabel text="Added to show" /> : null}
              <div className="card flush">
                {manual.map(f => <LegacyHtml key={f.id} html={call('flightLine', show.id, f)} />)}
              </div>
            </>
          ) : null}
        </>
      )}
    </Subsection>
  );
}

function Hotel({ show }){
  const legs = stayLegs(show);
  const h = show.hotel;
  const has = !!(legs.length || h);
  const fmtDate = g('fmtDate');
  const addr = h
    ? (call('formatHotelAddress', h)
      || [h.address, h.postcode].filter(Boolean).join(', '))
    : '';
  const conf = h ? (call('hotelBookingRef', h) || h.conf || h.bookingRef || '') : '';
  const mapQ = call('hotelMapQuery', show) || '';

  return (
    <Subsection
      id={`ss-${show.id}-hotel`}
      title="Hotel"
      addLabel={h ? 'Edit' : 'Add'}
      onAdd={() => call('sheetHotel', show.id)}
      defaultOpen={has}
    >
      {!has ? (
        <EmptyTap
          icon="bed"
          title="Add hotel details"
          sub="Name, dates, confirmation and maps"
          onClick={() => call('sheetHotel', show.id)}
        />
      ) : (
        <>
          <JourneyCards legs={legs} />
          {h ? (
            <>
              {legs.length ? <SourceLabel text="Added to show" /> : null}
              <div className="card flush">
                <div className="info-line info-line-stacked">
                  <div className="ic"><Icon name="bed" size={17} /></div>
                  <DetailTx title={h.name || 'Hotel'} primary={addr || 'Tap to add address'} />
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
                {h.notes ? (
                  <div className="info-line">
                    <div className="ic"><Icon name="note" size={17} /></div>
                    <FieldTx label="Room notes" value={h.notes} />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
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

  return (
    <Subsection
      id={`ss-${show.id}-driver`}
      title="Transport"
      addLabel="Add"
      onAdd={() => call('sheetDriver', show.id)}
      defaultOpen={has}
    >
      {!has ? (
        <EmptyTap
          icon="car"
          title="Add transport"
          sub="Driver details, pickup, or Uber / taxi"
          onClick={() => call('sheetDriver', show.id)}
        />
      ) : (
        <>
          <JourneyCards legs={legs} />
          {drivers.length ? (
            <>
              {legs.length ? <SourceLabel text="Added to show" /> : null}
              {ordered.map(o => (
                <LegacyHtml key={o.d.id || o.idx} html={call('driverCard', show.id, o.d, o.idx)} />
              ))}
            </>
          ) : null}
        </>
      )}
    </Subsection>
  );
}

function Transfers({ show }){
  const legs = transferLegs(show);
  if(!legs.length) return null;
  return (
    <Subsection
      id={`ss-${show.id}-transfers`}
      title="Transfers"
      addLabel="Add"
      onAdd={() => call('addLogisticFor', show.id)}
      defaultOpen
    >
      <JourneyCards legs={legs} />
    </Subsection>
  );
}

export default function TravelGroup({ show }){
  return (
    <>
      <Flights show={show} />
      <Hotel show={show} />
      <Transport show={show} />
      <Transfers show={show} />
    </>
  );
}
