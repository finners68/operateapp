import { call } from '../api/operate.js';
import { CompactAddRow, FieldTx, Icon } from './ui.jsx';

function AdvRow({ icon, label, value, extra }: Record<string, any>){
  if(!value) return null;
  return (
    <div className="info-line show-venue-row is-block">
      <div className="ic"><Icon name={icon} size={16} /></div>
      <div className="tx" style={{ width: '100%' }}>
        <div className="k">{label}</div>
        <div className="v" style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
      </div>
      {extra || null}
    </div>
  );
}

function Mini({ title, action, children }: Record<string, any>){
  const items: any[] = [].concat(children).filter(Boolean);
  if(!items.length) return null;
  return (
    <div className="show-adv-mini">
      <div className="show-adv-mini-head">
        <span>{title}</span>
        {action || null}
      </div>
      <div className="show-venue-stack">{items}</div>
    </div>
  );
}

export default function VenueGroup({ show }: Record<string, any>){
  const addr = call('formatVenueAddress', show) || '';
  const addrDisplay = addr
    || (show.city ? [show.city, show.country].filter(Boolean).join(', ') : '');
  const mapQ = call('venueMapQuery', show) || '';
  const a = show.advance || {};
  const sched = (a.schedule || []).filter((s: any) => s.time || s.label || s.title);
  const hasAdvance = (call('countAdvanceFields', a) || 0) > 0;

  const venueGroup = (
    <Mini
      title="Venue"
      action={(
        <button type="button" className="add" onClick={() => call('sheetVenueAddr', show.id)}>Edit</button>
      )}
    >
      {addrDisplay ? (
        <div className="info-line show-venue-row is-block">
          <div className="ic"><Icon name="pin" size={16} /></div>
          <FieldTx label="Address"><span>{addrDisplay}</span></FieldTx>
          {mapQ ? (
            <button type="button" className="show-venue-action" title="Open in Maps" onClick={() => call('openMaps', mapQ)}>
              <Icon name="map" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
      <AdvRow icon="pin" label="Stage / area" value={a.stage} />
      <AdvRow
        icon="pin"
        label="Navigation / artist entrance"
        value={a.navAddr}
        extra={a.navAddr ? (
          <button type="button" className="show-venue-action" onClick={() => call('openMaps', a.navAddr)}>
            <Icon name="map" size={16} />
          </button>
        ) : null}
      />
    </Mini>
  );

  const arrivalGroup = (
    <Mini
      title="Arrival & access"
      action={hasAdvance ? (
        <button type="button" className="add" onClick={() => call('sheetAdvance', show.id)}>Edit</button>
      ) : null}
    >
      <AdvRow icon="planeUp" label="Access / arrival" value={a.access} />
      <AdvRow icon="car" label="Parking" value={a.parking} />
      <AdvRow icon="music" label="Sound check" value={a.soundcheck} />
      <AdvRow icon="clock" label="Curfew" value={a.curfew} />
      {sched.length ? (
        <div className="info-line show-venue-row is-block" style={{ alignItems: 'flex-start' }}>
          <div className="ic"><Icon name="clock" size={16} /></div>
          <div className="tx" style={{ width: '100%' }}>
            <div className="k">Running order</div>
            <div className="ro-list">
              {sched.map((s: any, i: any) => (
                <div key={i} className="ro-row">
                  <div className="ro-lab">{s.label || s.title || ''}</div>
                  <div className="ro-time">{s.time || ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Mini>
  );

  const backstageGroup = (
    <Mini title="Backstage">
      <AdvRow icon="face" label="Dressing room" value={a.dressingRoom} />
      <AdvRow icon="users" label="Guest list" value={a.guestlist} />
      <AdvRow icon="bag" label="Catering / rider" value={a.catering} />
      <AdvRow icon="globe" label="Wi-Fi" value={a.wifi} />
      <AdvRow icon="note" label="Remarks" value={a.remarks} />
    </Mini>
  );

  const hasVenue = !!(addrDisplay || a.stage || a.navAddr);
  const hasArrival = !!(a.access || a.parking || a.soundcheck || a.curfew || sched.length);
  const hasBackstage = !!(a.dressingRoom || a.guestlist || a.catering || a.wifi || a.remarks);

  return (
    <>
      {hasVenue ? venueGroup : (
        <CompactAddRow label="Add venue address" onAdd={() => call('sheetVenueAddr', show.id)} />
      )}
      {hasArrival ? arrivalGroup : null}
      {hasBackstage ? backstageGroup : null}
      {!hasArrival && !hasBackstage ? (
        <CompactAddRow label="Add show-day details" onAdd={() => call('sheetAdvance', show.id)} />
      ) : null}
    </>
  );
}
