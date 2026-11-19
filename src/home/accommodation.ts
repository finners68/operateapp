import { call, fmtDate } from '../api/operate.js';

function ymd(s: any){
  return String(s || '').slice(0, 10);
}

function ymdCompare(a: any, b: any){
  return ymd(a).localeCompare(ymd(b));
}

export function accommodationStatus(booking: any, today: any){
  const ci = ymd(booking?.checkin);
  const co = ymd(booking?.checkout);
  if(!ci && !co) return 'upcoming';
  if(ci && ymdCompare(today, ci) < 0) return 'upcoming';
  if(co && ymdCompare(today, co) > 0) return 'completed';
  if(ci && ymdCompare(today, ci) >= 0) return 'staying';
  return 'upcoming';
}

export function statusLabel(status: any){
  if(status === 'staying') return 'Current stay';
  if(status === 'completed') return 'Completed';
  return 'Upcoming';
}

function hotelHasContent(h: any){
  return !!(h && (h.name || h.address || h.city || h.checkin || h.checkout));
}

function normalizeFromHotel(show: any, hotel: any, extra: any = {}){
  const addr = call('formatHotelAddress', hotel)
    || [hotel.address, hotel.address2, hotel.city, hotel.postcode, hotel.country].filter(Boolean).join(', ');
  const location = [hotel.city || show?.city, hotel.country || show?.country].filter(Boolean).join(', ');
  return {
    id: extra.id || `show-hotel:${show?.id}`,
    showId: show?.id,
    name: (hotel.name || 'Accommodation').trim(),
    address: addr,
    location,
    checkin: ymd(hotel.checkin) || ymd(show?.date),
    checkout: ymd(hotel.checkout),
    checkInTime: hotel.checkIn || hotel.checkinTime || hotel.info || '',
    checkOutTime: hotel.checkOut || hotel.checkoutTime || '',
    room: hotel.room || '',
    roomType: hotel.roomType || '',
    bookingRef: call('hotelBookingRef', hotel) || hotel.conf || hotel.bookingRef || '',
    phone: hotel.phone || '',
    email: hotel.email || '',
    mapsQ: show ? call('hotelMapQuery', show) : '',
    stayLegId: extra.stayLegId || null,
    fallbackDate: show?.date,
  };
}

function normalizeFromStayLeg(show: any, leg: any){
  const place = leg.place || leg.title || '';
  const addr = leg.addr || leg.address || '';
  return {
    id: `leg:${leg.id}`,
    showId: show?.id || leg.showId,
    name: place || 'Accommodation',
    address: addr,
    location: [show?.city, show?.country].filter(Boolean).join(', '),
    checkin: ymd(leg.date || leg.checkin || show?.date),
    checkout: ymd(leg.checkout),
    checkInTime: leg.start || leg.time || leg.info || '',
    checkOutTime: '',
    room: '',
    roomType: '',
    bookingRef: leg.bookingRef || leg.conf || '',
    phone: leg.phone || '',
    email: leg.email || '',
    mapsQ: show ? call('hotelMapQuery', show) : (addr || place),
    stayLegId: leg.id,
    fallbackDate: show?.date,
  };
}

function normalizeFromRunStep(show: any, step: any){
  const ref = step.ref || {};
  const h = show?.hotel;
  if(hotelHasContent(h)){
    return normalizeFromHotel(show, h, { id: `run:${step.id}`, stayLegId: step.id });
  }
  const addr = ref.addr || step.sub || '';
  return {
    id: `run:${step.id}`,
    showId: show?.id || step.showId,
    name: (ref.place || step.title || 'Accommodation').replace(/^\[[^\]]*\]\s*-?\s*/i, '').trim(),
    address: addr,
    location: [show?.city, show?.country].filter(Boolean).join(', '),
    checkin: ymd(step.trueDate || step.date || ref.date),
    checkout: ymd(ref.checkout),
    checkInTime: step.time || ref.info || '',
    checkOutTime: '',
    room: ref.room || '',
    roomType: '',
    bookingRef: ref.bookingRef || ref.conf || '',
    phone: ref.phone || '',
    email: ref.email || '',
    mapsQ: show ? call('hotelMapQuery', show) : '',
    stayLegId: step.id,
    fallbackDate: show?.date,
  };
}

export function collectAccommodationBookings({ sel, focusRun }: Record<string, any>){
  const out: any[] = [];
  const seenShow = new Set();
  const shows = sel?.events ? sel.events() : [];
  const showById = (id: any) => (sel?.event ? sel.event(id) : shows.find((s: any) => s.id === id)) || null;

  shows.forEach((show: any) => {
    if(hotelHasContent(show.hotel) && !seenShow.has(show.id)){
      seenShow.add(show.id);
      out.push(normalizeFromHotel(show, show.hotel));
    }
    (call('showLegs', show.id) || []).filter((l: any) => l.kind === 'stay').forEach((leg: any) => {
      if(seenShow.has(show.id) && hotelHasContent(show.hotel)) return;
      out.push(normalizeFromStayLeg(show, leg));
    });
  });

  if(focusRun){
    (call('runTimeline', focusRun) || []).filter((s: any) => s.kind === 'stay').forEach((step: any) => {
      const show = showById(step.showId);
      const norm = normalizeFromRunStep(show, step);
      const dupe = out.find((b: any) => b.showId === norm.showId && b.name === norm.name);
      if(!dupe) out.push(norm);
    });
  }

  return out;
}

export function pickAccommodation(bookings: any, today: any){
  const list = (bookings || []).map((b: any) => ({
    ...b,
    status: accommodationStatus(b, today),
  })).filter((b: any) => b.status !== 'completed');

  const staying = list.filter((b: any) => b.status === 'staying');
  if(staying.length){
    staying.sort((a: any, b: any) => ymdCompare(a.checkout || '9999', b.checkout || '9999'));
    return staying[0];
  }

  const upcoming = list.filter((b: any) => b.status === 'upcoming');
  upcoming.sort((a: any, b: any) => ymdCompare(a.checkin || a.fallbackDate, b.checkin || b.fallbackDate));
  return upcoming[0] || null;
}

export function formatStayWhen(ymdDate: any, timeStr: any){
  if(!ymdDate) return '';
  const datePart = fmtDate ? fmtDate(ymdDate) : ymdDate;
  const t = String(timeStr || '').trim();
  if(!t) return datePart;
  if(t.length <= 5 && /^\d{1,2}:\d{2}/.test(t)) return `${datePart} · ${t.slice(0, 5)}`;
  return `${datePart} · ${t}`;
}

export function hotelConfirmationPass(show: any){
  if(!show?.id) return null;
  const legs = (call('showLegs', show.id) || []).filter((l: any) => l.kind === 'stay');
  for(const leg of legs){
    const passes = leg.passes || [];
    if(passes.length) return { legId: leg.id, pass: passes[0] };
  }
  return null;
}