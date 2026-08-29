import { call, g } from './bridge.js';
import { Icon } from './ui.jsx';

export function UploadBanner({ showId }){
  const map = g('itineraryFullUploadByShow') || {};
  const st = map[showId];
  if(!st) return null;

  if(st.status === 'uploading'){
    return (
      <div className="hint" style={{ textAlign: 'left', margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: 'rgba(99,102,241,.12)', color: 'var(--text-1)', fontWeight: 650 }}>
        {st.message || 'Uploading itinerary details… Make is filling hotel, travel and the rest into this show.'}
      </div>
    );
  }
  if(st.status === 'done'){
    return (
      <div className="hint" style={{ textAlign: 'left', margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: 'rgba(34,197,94,.12)', color: 'var(--text-1)', fontWeight: 650 }}>
        {st.message || 'Itinerary details uploaded successfully.'}
      </div>
    );
  }
  if(st.status === 'error'){
    return (
      <div className="hint" style={{ textAlign: 'left', margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,.12)', color: 'var(--text-1)', fontWeight: 650 }}>
        {st.message || 'Couldn’t finish itinerary upload.'}
        <button type="button" className="link-btn" style={{ display: 'inline', marginLeft: 8 }} onClick={() => call('retryItineraryFullUpload', showId)}>
          Retry
        </button>
      </div>
    );
  }
  return null;
}

function ActTile({ icon, color, label, onClick }){
  return (
    <button type="button" className="act" onClick={onClick}>
      <div className="ic" style={{ background: `${color}22`, color }}><Icon name={icon} size={20} /></div>
      <span>{label}</span>
    </button>
  );
}

function ActFileTile({ icon, color, label, itemId }){
  return (
    <label className="act">
      <div className="ic" style={{ background: `${color}22`, color }}><Icon name={icon} size={20} /></div>
      <span>{label}</span>
      <input
        type="file"
        accept={g('PASS_FILE_ACCEPT') || 'image/*,application/pdf'}
        style={{ display: 'none' }}
        onChange={e => call('uploadItemPass', itemId, e.target)}
      />
    </label>
  );
}

export function QuickLinks({ show }){
  const store = g('store');
  const items = (store?.events || []).filter(x => x.showId === show.id);
  const flights = items.filter(x => x.kind === 'travel' && (x.icon || 'plane') === 'plane');
  const hotelItem = items.find(x => x.kind === 'stay');
  const drivers = items.filter(x => x.kind === 'travel' && call('isDriverItem', x));

  const venueQ = call('venueMapQuery', show)
    || call('formatVenueAddress', show)
    || [show.city, show.country].filter(Boolean).join(', ');

  const tiles = [];
  tiles.push(
    <ActTile key="venue" icon="map" color="var(--blue)" label="Venue" onClick={() => call('openMaps', venueQ)} />
  );

  if(flights.length){
    const withPass = flights.find(f => f.passes && f.passes.length);
    if(withPass){
      tiles.push(
        <ActTile key="board" icon="ticket" color="var(--accent-2)" label="Boarding" onClick={() => call('viewItemPass', withPass.id)} />
      );
    } else {
      tiles.push(
        <ActFileTile key="board" icon="ticket" color="var(--accent-2)" label="Boarding" itemId={flights[0].id} />
      );
    }
  }

  if(hotelItem || show.hotel){
    const q = show.hotel
      ? call('hotelMapQuery', show)
      : `${(hotelItem.place || hotelItem.title || '').replace(/^hotel\s*[-–:]?\s*/i, '').trim()} ${show.city || ''}`.trim();
    tiles.push(
      <ActTile key="hotel" icon="bed" color="var(--orange)" label="Hotel" onClick={() => call('openMaps', q)} />
    );
  }

  const drvPhone = show.driver && show.driver.phone;
  if(drvPhone){
    tiles.push(
      <ActTile key="drv" icon="car" color="var(--green)" label="Driver" onClick={() => call('contactDriver', show.id)} />
    );
  } else if(drivers.length){
    tiles.push(
      <ActTile key="drv" icon="car" color="var(--green)" label="Driver" onClick={() => call('sheetDriver', show.id)} />
    );
  }

  if(show.promoter && (show.promoter.phone || show.promoter.whatsapp)){
    tiles.push(
      <ActTile key="contact" icon="user" color="var(--accent-2)" label="Contact" onClick={() => call('contactPromoter', show.id)} />
    );
  }

  const shown = tiles.slice(0, 4);
  if(!shown.length) return null;
  return (
    <div className="act-grid" style={{ gridTemplateColumns: `repeat(${shown.length}, 1fr)` }}>
      {shown}
    </div>
  );
}
