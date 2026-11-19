import { call, showTitle } from '../api/operate.js';

function tourShowLabel(s: any){
  return typeof call('tourShowLabel', s) === 'string'
    ? call('tourShowLabel', s)
    : (showTitle(s) || s?.venue || 'Show');
}

export function priorityShowsForContacts({ sel, today, nextShow, accommodationShow, focusRun }: Record<string, any>){
  const ordered: any[] = [];
  const seen = new Set();
  const add = (s: any) => {
    if(!s?.id || seen.has(s.id)) return;
    seen.add(s.id);
    ordered.push(s);
  };
  (sel?.events ? sel.events() : []).forEach((e: any) => {
    if(e.date === today) add(e);
  });
  add(nextShow);
  add(accommodationShow);
  if(focusRun?.shows){
    focusRun.shows
      .filter((s: any) => s.date && String(s.date).slice(0, 10) >= today)
      .slice(0, 4)
      .forEach(add);
  }
  if(!ordered.length) add(nextShow);
  return ordered;
}

export function buildHomeKeyContactsGrouped({ sel, today, nextShow, accommodationShow, focusRun }: Record<string, any>){
  const shows = priorityShowsForContacts({ sel, today, nextShow, accommodationShow, focusRun });
  if(!shows.length){
    return { show: [], drivers: [], hotel: [] };
  }

  const g = call('tourContactsGrouped', { shows, key: focusRun?.key || shows[0]?.id });
  if(g){
    const labelToId = new Map();
    shows.forEach((s: any) => labelToId.set(tourShowLabel(s), s.id));
    const attach = (rows: any) => (rows || []).map((row: any) => {
      const showId = row.showId || labelToId.get(row.show) || shows[0]?.id;
      const booking = row.show || tourShowLabel(shows.find((s: any) => s.id === showId) || shows[0]);
      const dm = /^Driver (\d+)(?:\s*\|\s*(.+))?$/.exec(String(row.label || ''));
      const role = dm ? `Driver ${dm[1]}` : (row.label || 'Contact');
      const name = dm?.[2]?.trim() || row.name || role;
      return {
        ...row,
        showId,
        booking: row.category === 'driver' ? booking : (row.sub || booking),
        role,
        name,
        detail: row.category === 'driver' ? (row.sub || row.journeySub || '') : '',
      };
    });
    return {
      show: attach(g.show),
      drivers: attach(g.drivers),
      hotel: attach(g.hotel),
    };
  }

  return buildFallbackGrouped(shows);
}

function buildFallbackGrouped(shows: any){
  const showVenue: any[] = [];
  const drivers: any[] = [];
  const hotel: any[] = [];
  shows.forEach((s: any) => {
    const booking = tourShowLabel(s);
    const p = s.promoter;
    if(p && (p.phone || p.whatsapp)){
      showVenue.push({
        category: 'show',
        showId: s.id,
        booking,
        role: 'Promoter',
        name: p.name || 'Promoter',
        label: 'Promoter',
        sub: booking,
        phone: p.phone || '',
        whatsapp: p.whatsapp || p.phone || '',
      });
    }
    (s.contacts || []).forEach((c: any) => {
      if(String(c.role || '').toLowerCase() === 'driver') return;
      if(!(c.phone || c.whatsapp || c.name)) return;
      showVenue.push({
        category: 'show',
        showId: s.id,
        booking,
        role: call('showContactRoleLabel', c.role) || c.role || 'Contact',
        name: c.name || 'Contact',
        label: call('showContactRoleLabel', c.role) || 'Contact',
        sub: booking,
        phone: c.phone || '',
        whatsapp: c.whatsapp || c.phone || '',
      });
    });
    const h = s.hotel;
    if(h && (h.phone || h.whatsapp || h.name)){
      hotel.push({
        category: 'hotel',
        showId: s.id,
        booking: h.name || booking,
        role: 'Hotel',
        name: h.name ? 'Reception' : 'Hotel',
        label: h.name || 'Accommodation',
        sub: booking,
        phone: h.phone || '',
        whatsapp: h.whatsapp || h.phone || '',
      });
    }
    let n = 0;
    (call('showDrivers', s) || []).forEach((d: any) => {
      if(d.noGround && !(d.phone || d.whatsapp)) return;
      if(!(d.name || d.phone || d.whatsapp)) return;
      n += 1;
      const jl = call('driverJourneyLabel', d) || '';
      const bits = [jl, d.time].filter(Boolean);
      drivers.push({
        category: 'driver',
        showId: s.id,
        booking,
        role: `Driver ${n}`,
        name: d.name || `Driver ${n}`,
        label: `Driver ${n}`,
        sub: bits.join(' · ') || booking,
        detail: jl,
        sortMs: call('journeyWhenMs', d, s.date) || Number.POSITIVE_INFINITY,
        phone: d.phone || '',
        whatsapp: d.whatsapp || d.phone || '',
      });
    });
  });
  drivers.sort((a: any, b: any) => {
    const da = Number.isFinite(a.sortMs) ? a.sortMs : Number.POSITIVE_INFINITY;
    const db = Number.isFinite(b.sortMs) ? b.sortMs : Number.POSITIVE_INFINITY;
    if(da !== db) return da - db;
    return String(a.name).localeCompare(String(b.name));
  });
  drivers.forEach((row: any, i: any) => {
    row.role = `Driver ${i + 1}`;
    row.label = `Driver ${i + 1}`;
    if(row.name && !row.name.startsWith('Driver')) row.label = `Driver ${i + 1} | ${row.name}`;
  });
  return { show: showVenue, drivers, hotel };
}

export const HOME_CONTACT_CATEGORIES = [
  { key: 'show', title: 'Show & venue', icon: 'music' },
  { key: 'drivers', title: 'Transport', icon: 'car' },
  { key: 'hotel', title: 'Accommodation', icon: 'bed' },
];

export function openHomeContact(entry: any){
  const sid = entry?.showId;
  if(!sid) return;
  if(entry.category === 'driver') call('showTransport', sid);
  else if(entry.label === 'Artist liaison' || entry.role === 'Promoter') call('contactPromoter', sid);
  else if(entry.category === 'hotel') call('openView', 'event', sid);
  else call('sheetKeyContacts', sid);
}