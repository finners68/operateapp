import { call } from '../api/operate.js';
import { CompactAddRow, FieldTx, Icon } from './ui.jsx';

function AdvRow({ icon, label, value, extra }){
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

function Mini({ title, action, children }){
  const items = [].concat(children).filter(Boolean);
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

function uniquePeople(show){
  const out = [];
  const seen = new Set();
  const add = p => {
    if(!p || !String(p.name || '').trim()) return;
    const cid = p.contactId || p.contact_id || '';
    const phone = String(p.phone || p.whatsapp || '').replace(/[^\d+]/g, '');
    const name = String(p.name || '').trim().toLowerCase();
    const keys = [];
    if(cid) keys.push('id:' + cid);
    if(phone) keys.push('ph:' + phone);
    if(name) keys.push('n:' + name);
    if(keys.some(k => seen.has(k))) return;
    keys.forEach(k => seen.add(k));
    out.push(p);
  };

  const promoter = show.promoter;
  if(promoter && (promoter.name || promoter.phone)){
    add({
      role: 'Artist liaison',
      name: promoter.name || 'Liaison',
      phone: promoter.phone || '',
      whatsapp: promoter.whatsapp || '',
      kind: 'liaison',
      contactId: promoter.id || promoter.contact_id || ''
    });
  }

  (show.contacts || []).forEach(ct => {
    const role = call('showContactRoleLabel', ct.role) || ct.role || 'Contact';
    add({
      role,
      name: ct.name || 'Contact',
      phone: ct.phone || '',
      whatsapp: ct.whatsapp || '',
      kind: 'contact',
      id: ct.id,
      contactId: ct.contactId || ct.contact_id || ''
    });
  });

  const drivers = call('showDrivers', show) || [];
  drivers.forEach((d, idx) => {
    if(d.noGround || !d.name) return;
    add({
      role: 'Driver',
      name: d.name,
      phone: d.phone || '',
      whatsapp: d.whatsapp || '',
      kind: 'driver',
      driverIdx: idx,
      contactId: d.contactId || d.contact_id || ''
    });
  });

  return out;
}

function openPerson(show, p){
  if(p.kind === 'liaison') return call('sheetPromoter', show.id);
  if(p.kind === 'driver') return call('sheetDriver', show.id, p.driverIdx);
  return call('sheetEventContact', show.id, p.id);
}

function PersonRow({ show, person: p }){
  return (
    <div className="info-line show-venue-row is-compact">
      <div className="ic"><Icon name="user" size={16} /></div>
      <div className="tx" style={{ flex: 1, minWidth: 0 }} onClick={() => openPerson(show, p)}>
        <div className="k">{p.role}</div>
        <div className="v">{p.name}</div>
      </div>
      {p.phone ? (
        <button type="button" className="show-venue-action" onClick={() => call('callNumber', p.phone)}>
          <Icon name="phone" size={15} />
        </button>
      ) : null}
      {(p.whatsapp || p.phone) ? (
        <button
          type="button"
          className="show-venue-action"
          onClick={() => call(p.kind === 'liaison' ? 'contactPromoter' : 'whatsapp', p.kind === 'liaison' ? show.id : (p.whatsapp || p.phone))}
        >
          <Icon name="chat" size={15} />
        </button>
      ) : null}
    </div>
  );
}

export default function VenueGroup({ show }){
  const addr = call('formatVenueAddress', show) || '';
  const addrDisplay = addr
    || (show.city ? [show.city, show.country].filter(Boolean).join(', ') : '');
  const mapQ = call('venueMapQuery', show) || '';
  const a = show.advance || {};
  const sched = (a.schedule || []).filter(s => s.time || s.label || s.title);
  const people = uniquePeople(show);
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

  const peopleGroup = people.length ? (
    <Mini
      title="People"
      action={(
        <button type="button" className="add" onClick={() => call('sheetKeyContacts', show.id)}>Edit</button>
      )}
    >
      {people.map((p, i) => <PersonRow key={p.contactId || p.id || p.role + p.name + i} show={show} person={p} />)}
    </Mini>
  ) : (
    <CompactAddRow label="Add a contact" onAdd={() => call('sheetEventContact', show.id)} />
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
              {sched.map((s, i) => (
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
      {peopleGroup}
      {hasArrival ? arrivalGroup : null}
      {hasBackstage ? backstageGroup : null}
      {!hasArrival && !hasBackstage ? (
        <CompactAddRow label="Add show-day details" onAdd={() => call('sheetAdvance', show.id)} />
      ) : null}
    </>
  );
}
