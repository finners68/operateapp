import { call } from '../api/operate.js';
import { Subsection, EmptyTap, FieldTx, Icon } from './ui.jsx';

function AdvRow({ icon, label, value, extra }){
  if(!value) return null;
  return (
    <div className="info-line" style={label === 'Running order' ? { alignItems: 'flex-start' } : undefined}>
      <div className="ic"><Icon name={icon} size={17} /></div>
      <div className="tx" style={{ width: '100%' }}>
        <div className="k">{label}</div>
        <div className="v" style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
      </div>
      {extra || null}
    </div>
  );
}

function Mini({ title, children }){
  if(!children) return null;
  return (
    <div className="show-adv-mini">
      <div className="show-adv-mini-head">{title}</div>
      <div className="card flush">{children}</div>
    </div>
  );
}

function VenueBlock({ show }){
  const addr = call('formatVenueAddress', show) || '';
  const addrDisplay = addr
    || (show.city ? [show.city, show.country].filter(Boolean).join(', ') : '')
    || 'Tap to add';
  const mapQ = call('venueMapQuery', show) || '';
  const p = show.promoter;

  return (
    <Subsection id={`ss-${show.id}-venue`} title="Venue & liaison" defaultOpen>
      <div className="card flush">
        <div className="info-line">
          <div className="ic"><Icon name="pin" size={17} /></div>
          <FieldTx label="Address"><span className="addr-trunc">{addrDisplay}</span></FieldTx>
          {mapQ ? (
            <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} title="Open in Maps" onClick={() => call('openMaps', mapQ)}>
              <Icon name="map" size={17} />
            </button>
          ) : null}
          <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} title="Edit venue" onClick={() => call('sheetVenueAddr', show.id)}>
            <Icon name="edit" size={15} />
          </button>
        </div>
        {p ? (
          <div className="info-line">
            <div className="ic"><Icon name="user" size={17} /></div>
            <FieldTx label="Artist Liaison" value={p.name || 'Liaison'} />
            {(p.phone || p.whatsapp) ? (
              <button
                type="button"
                className="btn secondary"
                style={{ width: 'auto', flex: '0 0 auto', padding: '9px 15px', fontSize: 13.5, alignSelf: 'center', boxShadow: 'none' }}
                onClick={() => call('contactPromoter', show.id)}
              >
                <Icon name="chat" size={15} /> Contact
              </button>
            ) : null}
            <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} title="Edit liaison" onClick={() => call('sheetPromoter', show.id)}>
              <Icon name="edit" size={15} />
            </button>
          </div>
        ) : (
          <div className="info-line" onClick={() => call('sheetPromoter', show.id)}>
            <div className="ic"><Icon name="plus" size={17} /></div>
            <div className="tx"><div className="v" style={{ color: 'var(--accent-2)' }}>Add artist liaison</div></div>
          </div>
        )}
      </div>
    </Subsection>
  );
}

function AdvanceBlock({ show }){
  const a = show.advance || {};
  const hasAny = (call('countAdvanceFields', a) || 0) > 0;
  const sched = (a.schedule || []).filter(s => s.time || s.label || s.title);

  return (
    <Subsection
      id={`ss-${show.id}-advancing`}
      title="Show-day details"
      addLabel={hasAny ? 'Edit' : 'Add'}
      onAdd={() => call('sheetAdvance', show.id)}
      defaultOpen={hasAny}
    >
      {!hasAny ? (
        <EmptyTap
          icon="checkList"
          title="Add show-day details"
          sub="Access, soundcheck, running order, wifi…"
          onClick={() => call('sheetAdvance', show.id)}
        />
      ) : (
        <>
          <Mini title="Schedule">
            <AdvRow icon="pin" label="Stage / area" value={a.stage} />
            {sched.length ? (
              <div className="info-line" style={{ alignItems: 'flex-start' }}>
                <div className="ic"><Icon name="clock" size={17} /></div>
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
          <Mini title="Access">
            <AdvRow icon="planeUp" label="Access / arrival" value={a.access} />
            <AdvRow icon="music" label="Sound check" value={a.soundcheck} />
            <AdvRow icon="clock" label="Curfew" value={a.curfew} />
            <AdvRow
              icon="pin"
              label="Navigation address"
              value={a.navAddr}
              extra={a.navAddr ? (
                <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} onClick={() => call('openMaps', a.navAddr)}>
                  <Icon name="map" size={16} />
                </button>
              ) : null}
            />
          </Mini>
          <Mini title="Backstage">
            <AdvRow icon="face" label="Dressing room" value={a.dressingRoom} />
            <AdvRow icon="users" label="Guest list" value={a.guestlist} />
            <AdvRow icon="bag" label="Catering / rider" value={a.catering} />
            <AdvRow icon="car" label="Parking" value={a.parking} />
            <AdvRow icon="globe" label="WiFi" value={a.wifi} />
          </Mini>
          <Mini title="Other">
            <AdvRow icon="note" label="Remarks" value={a.remarks} />
          </Mini>
        </>
      )}
    </Subsection>
  );
}

function ContactsBlock({ show }){
  const cs = show.contacts || [];
  return (
    <Subsection
      id={`ss-${show.id}-contacts`}
      title="Key contacts"
      addLabel="Add"
      onAdd={() => call('sheetEventContact', show.id)}
      defaultOpen={cs.length > 0}
    >
      {!cs.length ? (
        <EmptyTap icon="users" title="Add a key contact" onClick={() => call('sheetEventContact', show.id)} />
      ) : (
        <div className="card flush">
          {cs.map(ct => {
            const role = call('showContactRoleLabel', ct.role) || ct.role || '';
            return (
              <div key={ct.id} className="info-line info-line-stacked">
                <div className="ic"><Icon name="user" size={17} /></div>
                <div className="tx" style={{ flex: 1, minWidth: 0 }} onClick={() => call('sheetEventContact', show.id, ct.id)}>
                  <div className="detail-title">{role || 'Contact'}</div>
                  <div className="detail-primary">{ct.name || 'Contact'}</div>
                  {ct.phone ? <div className="detail-meta">{ct.phone}</div> : null}
                </div>
                {ct.phone ? (
                  <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} onClick={() => call('callNumber', ct.phone)}>
                    <Icon name="phone" size={15} />
                  </button>
                ) : null}
                {(ct.whatsapp || ct.phone) ? (
                  <button type="button" className="header-btn" style={{ width: 34, height: 34, alignSelf: 'center' }} onClick={() => call('whatsapp', ct.whatsapp || ct.phone)}>
                    <Icon name="chat" size={15} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Subsection>
  );
}

export default function VenueGroup({ show }){
  return (
    <>
      <VenueBlock show={show} />
      <AdvanceBlock show={show} />
      <ContactsBlock show={show} />
    </>
  );
}
