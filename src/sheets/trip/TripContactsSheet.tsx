import { call } from '../../api/operate.js';
import { Icon } from '../../show/ui.jsx';
const Spacer = () => <div className="spacer" />;

const CATEGORIES = [
  { key: 'show', title: 'Show / venue', hint: 'Venue staff, organisers and other show-day contacts' },
  { key: 'drivers', title: 'Drivers', hint: 'Ground transport in journey order' },
  { key: 'hotel', title: 'Hotel', hint: 'Reception and accommodation contacts' }
];

function ContactRow({ entry }: Record<string, any>){
  const phone = entry.phone || '';
  const wa = entry.whatsapp || phone;
  const canCall = !!phone;
  const canWa = !!wa;
  return (
    <div className="info-line info-line-stacked show-venue-row is-block">
      <div className="ic">
        <Icon name={entry.category === 'driver' ? 'car' : entry.category === 'hotel' ? 'bed' : 'user'} size={17} />
      </div>
      <div className="tx" style={{ flex: 1, minWidth: 0 }}>
        <div className="detail-title">{entry.label || 'Contact'}</div>
        {entry.name && entry.category !== 'driver' && entry.name !== entry.label ? (
          <div className="detail-primary">{entry.name}</div>
        ) : null}
        {entry.sub ? <div className="detail-meta">{entry.sub}</div> : null}
        {phone ? <div className="detail-meta">{phone}</div> : null}
      </div>
      {canCall ? (
        <button
          type="button"
          className="show-venue-action"
          title="Call"
          aria-label="Call"
          onClick={() => call('callNumber', phone)}
        >
          <Icon name="phone" size={15} />
        </button>
      ) : null}
      {canWa ? (
        <button
          type="button"
          className="show-venue-action"
          title="WhatsApp"
          aria-label="Message on WhatsApp"
          onClick={() => call('whatsapp', wa)}
        >
          <Icon name="chat" size={15} />
        </button>
      ) : null}
    </div>
  );
}

function CategoryBlock({ title, hint, items }: Record<string, any>){
  const rows = (items || []).filter((c: any) => c.phone || c.whatsapp);
  if(!rows.length){
    return (
      <div className="trip-contacts-cat">
        <div className="section-head" style={{ marginBottom: 6 }}>
          <div className="section-title" style={{ fontSize: 16 }}>{title}</div>
        </div>
        <div className="hint" style={{ padding: '0 4px 14px' }}>{hint} — none saved yet.</div>
      </div>
    );
  }
  return (
    <div className="trip-contacts-cat" style={{ marginBottom: 18 }}>
      <div className="section-head" style={{ marginBottom: 6 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{title}</div>
          <div className="hint" style={{ marginTop: 2, textAlign: 'left' }}>{hint}</div>
        </div>
      </div>
      <div className="card flush">
        {rows.map((c: any, i: any) => (
          <ContactRow key={`${title}-${i}-${c.label}-${c.phone}`} entry={c} />
        ))}
      </div>
    </div>
  );
}

export default function TripContactsSheet({ runKey, grouped }: Record<string, any>){
  const run = runKey ? call('runOf', runKey) : null;
  const g = grouped || (run ? call('tourContactsGrouped', run) : null) || { show: [], drivers: [], hotel: [] };
  const multi = (run && run.shows && run.shows.length > 1);
  return (
    <>
      <p className="sheet-lede">
        {multi
          ? 'Everyone on this tour — call or WhatsApp from here.'
          : 'Everyone on this show — call or WhatsApp from here.'}
      </p>
      {CATEGORIES.map((cat: any) => (
        <CategoryBlock
          key={cat.key}
          title={cat.title}
          hint={cat.hint}
          items={g[cat.key]}
        />
      ))}
      <Spacer />
    </>
  );
}
