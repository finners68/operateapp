import { call } from '../api/operate.js';
import { CompactAddRow, Icon } from './ui.jsx';

function uniquePeople(show: any){
  const out: any[] = [];
  const seen = new Set();
  const add = (p: any) => {
    if(!p || !String(p.name || '').trim()) return;
    const cid = p.contactId || p.contact_id || '';
    const phone = String(p.phone || p.whatsapp || '').replace(/[^\d+]/g, '');
    const name = String(p.name || '').trim().toLowerCase();
    const keys: any[] = [];
    if(cid) keys.push('id:' + cid);
    if(phone) keys.push('ph:' + phone);
    if(name) keys.push('n:' + name);
    if(keys.some((k: any) => seen.has(k))) return;
    keys.forEach((k: any) => seen.add(k));
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

  (show.contacts || []).forEach((ct: any) => {
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
  drivers.forEach((d: any, idx: any) => {
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

function openPerson(show: any, p: any){
  if(p.kind === 'liaison') return call('sheetPromoter', show.id);
  if(p.kind === 'driver') return call('sheetDriver', show.id, p.driverIdx);
  return call('sheetEventContact', show.id, p.id);
}

function PersonRow({ show, person: p }: Record<string, any>){
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

export default function ContactsGroup({ show }: Record<string, any>){
  const people = uniquePeople(show);
  if(!people.length){
    return (
      <CompactAddRow
        label="Add a key contact"
        onAdd={() => call('sheetKeyContacts', show.id)}
        addLabel="Add"
      />
    );
  }
  return (
    <div className="show-venue-stack">
      <div style={{ padding: '0 2px 8px' }}>
        <button type="button" className="quiet-add" onClick={() => call('sheetKeyContacts', show.id)}>
          Edit contacts
        </button>
      </div>
      {people.map((p: any, i: any) => (
        <PersonRow key={p.contactId || p.id || p.role + p.name + i} show={show} person={p} />
      ))}
    </div>
  );
}
