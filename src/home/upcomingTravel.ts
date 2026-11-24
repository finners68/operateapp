import { call, countdown, fmtDate, parseDT } from '../api/operate.js';

function parseDateTimeField(raw: any, fallbackDate: any){
  const fn = (a: any, b: any) => call('flightParseDep', a, b);
  if(typeof fn === 'function' && raw){
    const p = call('flightParseDep', raw, fallbackDate);
    if(p) return p;
  }
  const s = String(raw || '').trim();
  if(!s) return { date: fallbackDate || '', time: '' };
  const parts = s.split(/\s+/);
  if(/^\d{4}-\d{2}-\d{2}/.test(parts[0])){
    return { date: parts[0].slice(0, 10), time: (parts[1] || '').slice(0, 5) };
  }
  if(/^\d{1,2}:\d{2}/.test(parts[0])){
    return { date: fallbackDate || '', time: parts[0].slice(0, 5) };
  }
  return { date: fallbackDate || '', time: '' };
}

function legMs(date: any, time: any){
  if(!date) return null;
  const d = parseDT(date, time || '00:00');
  return d ? d.getTime() : null;
}

function travelTypeIcon(item: any){
  const ic = String(item?.icon || 'plane').toLowerCase();
  if(ic === 'train') return 'train';
  if(ic === 'ferry') return 'ferry';
  if(ic === 'bus') return 'bus';
  if(ic === 'walk') return 'walk';
  if(ic === 'car') return 'car';
  return 'planeTop';
}

function travelTypeLabel(item: any){
  if(call('isDriverItem', item)) return 'Car transfer';
  const key = call('travelTypeKey', item);
  if(key === 'train') return 'Train';
  if(key === 'ferry') return 'Ferry';
  if(key === 'coach') return 'Coach';
  if(key === 'walk') return 'Walk';
  if(key === 'cycle') return 'Cycle';
  const ic = String(item?.icon || 'plane').toLowerCase();
  if(ic === 'plane') return 'Flight';
  if(ic === 'car') return 'Transfer';
  return call('logisticTypeLabel', item) || 'Travel';
}

function normalizeFlight(show: any, f: any){
  const dep = parseDateTimeField(f.dep, show?.date);
  const arr = parseDateTimeField(f.arr, show?.date);
  return {
    id: `flight:${show?.id}:${f.id}`,
    showId: show?.id,
    typeLabel: 'Flight',
    icon: 'planeTop',
    depPlace: f.from || '',
    arrPlace: f.to || '',
    depDate: dep.date,
    depTime: dep.time,
    depMs: legMs(dep.date, dep.time),
    arrDate: arr.date,
    arrTime: arr.time,
    arrMs: legMs(arr.date, arr.time),
    detail: f.flightNo || f.code || '',
    provider: f.airline || f.operator || '',
    bookingRef: f.conf || f.bookingRef || '',
    done: !!f.done,
    rawFlight: f,
    mapsQuery: dep.date && call('tlMapsQuery', { kind: 'travel', icon: 'plane', ref: f, showId: show?.id }),
  };
}

function normalizeDriver(show: any, d: any){
  const showDate = show?.date;
  const trueDate = call('showItemTrueDate', show, d.time, d.date) || d.date || showDate;
  const depMs = legMs(trueDate, d.time);
  return {
    id: `driver:${show?.id}:${d.id}`,
    showId: show?.id,
    typeLabel: d.noGround ? 'Ground' : 'Car transfer',
    icon: 'car',
    depPlace: d.from || call('driverJourneyLabel', d) || '',
    arrPlace: d.to || '',
    depDate: trueDate,
    depTime: d.time || '',
    depMs,
    arrDate: '',
    arrTime: '',
    arrMs: null,
    detail: d.name || '',
    provider: d.vehicle || '',
    bookingRef: d.conf || d.bookingRef || '',
    done: !!d.done,
    phone: d.phone || '',
    whatsapp: d.whatsapp || '',
    rawDriver: d,
    mapsQuery: call('tlMapsQuery', { kind: 'travel', icon: 'car', ref: d, showId: show?.id }),
  };
}

function normalizeLeg(show: any, leg: any){
  const isDrv = call('isDriverItem', leg);
  const dep = leg.dep ? parseDateTimeField(leg.dep, show?.date || leg.date) : {
    date: leg.date || show?.date,
    time: (leg.start || leg.time || '').slice(0, 5),
  };
  const arr = leg.arr ? parseDateTimeField(leg.arr, dep.date) : { date: '', time: '' };
  const typeLabel = travelTypeLabel(leg);
  return {
    id: `leg:${leg.id}`,
    showId: show?.id || leg.showId,
    typeLabel,
    icon: travelTypeIcon(leg),
    depPlace: leg.from || '',
    arrPlace: leg.to || '',
    depDate: dep.date,
    depTime: dep.time,
    depMs: legMs(dep.date, dep.time),
    arrDate: arr.date,
    arrTime: arr.time,
    arrMs: legMs(arr.date, arr.time),
    detail: leg.flightNo || leg.trainNo || leg.ferryNo || leg.coachNo || leg.code || '',
    provider: leg.airline || leg.operator || (isDrv ? leg.driverName : '') || '',
    bookingRef: leg.bookingRef || leg.conf || '',
    done: !!leg.done,
    phone: leg.phone || '',
    whatsapp: leg.whatsapp || '',
    rawLeg: leg,
    mapsQuery: call('tlMapsQuery', { kind: 'travel', icon: leg.icon, ref: leg, showId: leg.showId }),
  };
}

function normalizeRunStep(show: any, step: any){
  const ref = step.ref || {};
  const merged = Object.assign({}, ref, {
    dep: ref.dep,
    arr: ref.arr,
    from: ref.from,
    to: ref.to,
    date: step.trueDate || step.date,
    start: step.time || ref.start,
    done: step.done,
    showId: step.showId,
    icon: step.icon || ref.icon,
  });
  const j: any = normalizeLeg(show, merged);
  j.id = `run:${step.id}`;
  j.typeLabel = step.icon === 'car' ? 'Car transfer' : travelTypeLabel(merged);
  j.rawStep = step;
  if(step.title && !j.depPlace && !j.arrPlace){
    j.detail = j.detail || step.title;
  }
  if(step.sub) j.detail = j.detail || step.sub;
  return j;
}

function addJourney(out: any, seen: any, journey: any){
  if(!journey || !journey.id || seen.has(journey.id)) return;
  if(!journey.depMs && !journey.depDate && !journey.depPlace && !journey.arrPlace) return;
  seen.add(journey.id);
  out.push(journey);
}

export function collectJourneys({ sel, focusRun }: Record<string, any>){
  const out: any[] = [];
  const seen = new Set();
  const shows = sel?.events ? sel.events() : [];
  const showById = (id: any) => (sel?.event ? sel.event(id) : shows.find((s: any) => s.id === id)) || null;

  shows.forEach((show: any) => {
    (show.flights || []).forEach((f: any) => {
      if(typeof call('flightHasDetails', f) === 'boolean' && !call('flightHasDetails', f)) return;
      addJourney(out, seen, normalizeFlight(show, f));
    });
    (call('showDrivers', show) || []).forEach((d: any) => {
      if(!d.time && !d.from && !d.to && !d.name) return;
      addJourney(out, seen, normalizeDriver(show, d));
    });
    (call('showLegs', show.id) || []).filter((l: any) => l.kind === 'travel').forEach((leg: any) => {
      addJourney(out, seen, normalizeLeg(show, leg));
    });
  });

  if(focusRun){
    (call('runTimeline', focusRun) || []).filter((s: any) => s.kind === 'travel').forEach((step: any) => {
      const show = showById(step.showId);
      addJourney(out, seen, normalizeRunStep(show, step));
    });
  }

  return out;
}

export function journeyStatus(j: any, now: any = Date.now()){
  if(j?.done) return 'completed';
  const dep = j?.depMs;
  const arr = j?.arrMs;
  if(arr && now >= arr) return 'completed';
  if(dep && now >= dep + 8 * 3600000 && !arr) return 'completed';
  if(dep && now >= dep && (!arr || now < arr)) return 'ongoing';
  if(dep && now < dep) return 'upcoming';
  return j?.depDate ? 'upcoming' : 'upcoming';
}

export function pickNextJourney(journeys: any, now: any = Date.now()){
  const list = (journeys || []).map((j: any) => ({ ...j, status: journeyStatus(j, now) }));
  const ongoing = list.filter((j: any) => j.status === 'ongoing');
  if(ongoing.length){
    ongoing.sort((a: any, b: any) => (a.depMs || 0) - (b.depMs || 0));
    return ongoing[0];
  }
  const upcoming = list.filter((j: any) => j.status === 'upcoming' && j.depMs);
  upcoming.sort((a: any, b: any) => (a.depMs || 0) - (b.depMs || 0));
  if(upcoming.length) return upcoming[0];
  const loose = list.filter((j: any) => j.status !== 'completed');
  loose.sort((a: any, b: any) => (a.depMs || Number.MAX_SAFE_INTEGER) - (b.depMs || Number.MAX_SAFE_INTEGER));
  return loose[0] || null;
}

export function formatJourneyWhen(date: any, time: any){
  if(!date) return '';
  const d = fmtDate ? fmtDate(date) : date;
  return time ? `${d} · ${time}` : d;
}

/** Split “Barcelona (BCN)” / “BCN” into code + readable label for route headers. */
export function journeyPlaceDisplay(place: any){
  const s = String(place || '').trim();
  if(!s) return { code: '', label: '' };
  const paren = s.match(/\(([A-Za-z]{2,5})\)\s*$/);
  if(paren){
    const code = paren[1].toUpperCase();
    const label = s.replace(/\s*\([^)]+\)\s*$/, '').trim();
    return { code, label: label || code };
  }
  if(/^[A-Za-z]{3}$/.test(s)){
    return { code: s.toUpperCase(), label: '' };
  }
  if(/^[A-Za-z0-9]{2,5}\s+[-–—]\s+/i.test(s)){
    const parts = s.split(/\s+[-–—]\s+/);
    const code = parts[0].trim().toUpperCase();
    return { code, label: parts.slice(1).join(' — ') };
  }
  return { code: '', label: s };
}

export function journeyDurationText(j: any){
  if(j?.depMs && j?.arrMs && j.arrMs > j.depMs){
    const mins = Math.round((j.arrMs - j.depMs) / 60000);
    if(mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if(h && m) return `${h}h ${m}m`;
    if(h) return `${h}h`;
    return `${m}m`;
  }
  return '';
}

export type JourneyDetailLine = { key: string; label: string; value: string };

function pushJourneyDetail(
  lines: JourneyDetailLine[],
  key: string,
  label: string,
  value: any,
  seen: Set<string>,
){
  const v = String(value ?? '').trim();
  if(!v) return;
  const sig = `${label}:${v}`;
  if(seen.has(sig)) return;
  seen.add(sig);
  lines.push({ key, label, value: v });
}

/** Gate, terminal, platform — including nested v2 flight/rail detail objects. */
function journeyLocationExtras(raw: any){
  if(!raw) return {};
  const fd = raw.flight_details || {};
  const rd = raw.rail_details || {};
  return {
    depTerminal: raw.terminal || raw.depTerminal || fd.departure_terminal,
    depGate: raw.gate || raw.depGate || fd.departure_gate,
    arrTerminal: raw.arrTerminal || fd.arrival_terminal,
    arrGate: raw.arrGate || fd.arrival_gate,
    depPlatform: raw.departure_platform || rd.departure_platform || '',
    arrPlatform: raw.arrival_platform || rd.arrival_platform || '',
    platform: raw.platform || '',
  };
}

/** Short lines under departure/arrival times on the large travel card (gate, terminal, platform). */
export function journeyEndpointHints(j: any, end: 'dep' | 'arr'): string[] {
  const raw = j?.rawFlight || j?.rawLeg || j?.rawDriver || j?.rawStep?.ref;
  const x = journeyLocationExtras(raw);
  const hints: string[] = [];
  const push = (label: string, value: any) => {
    const v = String(value ?? '').trim();
    if(!v) return;
    if(new RegExp(`^${label}\\b`, 'i').test(v)) hints.push(v);
    else hints.push(`${label} ${v}`);
  };
  if(end === 'dep'){
    push('Terminal', x.depTerminal);
    push('Gate', x.depGate);
    push('Platform', x.depPlatform || x.platform);
    if(j?.rawDriver){
      const t = String(j.rawDriver.time || j.depTime || '').trim();
      if(t && !j.depDate) push('Pickup', t);
    }
  }else{
    push('Terminal', x.arrTerminal);
    push('Gate', x.arrGate);
    push('Platform', x.arrPlatform);
  }
  return hints;
}

function journeyNotesText(raw: any){
  if(raw == null) return '';
  if(typeof raw === 'string') return raw.trim();
  const fn = typeof call === 'function' ? call('parseNoteItems') : null;
  if(typeof fn === 'function'){
    try{
      return fn(raw).map((n: any) => String(n?.text || '').trim()).filter(Boolean).join(' · ');
    }catch(_){}
  }
  return '';
}

/** Every travel field we have on the show record — for the large home card. */
export function journeyDetailLines(j: any): JourneyDetailLine[] {
  const lines: JourneyDetailLine[] = [];
  const seen = new Set<string>();
  const f = j?.rawFlight;
  const leg = j?.rawLeg;
  const d = j?.rawDriver;
  const step = j?.rawStep;
  const ref = step?.ref;

  pushJourneyDetail(lines, 'dep-when', 'Departure', formatJourneyWhen(j?.depDate, j?.depTime), seen);
  pushJourneyDetail(lines, 'arr-when', 'Arrival', formatJourneyWhen(j?.arrDate, j?.arrTime), seen);
  pushJourneyDetail(lines, 'duration', 'Duration', journeyDurationText(j) || f?.duration || leg?.duration, seen);

  if(f){
    const fx = journeyLocationExtras(f);
    pushJourneyDetail(lines, 'status', 'Flight status', f.fstatus, seen);
    pushJourneyDetail(lines, 'delay', 'Delay', f.delay, seen);
    pushJourneyDetail(lines, 'flight', 'Flight number', f.flightNo || f.code, seen);
    pushJourneyDetail(lines, 'airline', 'Airline', f.airline || f.operator || j.provider, seen);
    pushJourneyDetail(lines, 'dep-term', 'Departure terminal', fx.depTerminal, seen);
    pushJourneyDetail(lines, 'dep-gate', 'Departure gate', fx.depGate, seen);
    pushJourneyDetail(lines, 'arr-term', 'Arrival terminal', fx.arrTerminal, seen);
    pushJourneyDetail(lines, 'arr-gate', 'Arrival gate', fx.arrGate, seen);
    pushJourneyDetail(lines, 'seat', 'Seat', f.seat, seen);
    pushJourneyDetail(lines, 'booking', 'Booking reference', f.conf || f.bookingRef || j.bookingRef, seen);
    pushJourneyDetail(lines, 'notes', 'Notes', journeyNotesText(f.notes), seen);
    const fi = f.fiUpdated;
    if(fi){
      const ago = call('timeAgo', fi);
      pushJourneyDetail(lines, 'fi-upd', 'Status updated', typeof ago === 'string' && ago ? ago : '', seen);
    }
  }

  if(leg && !f){
    const lx = journeyLocationExtras(leg);
    pushJourneyDetail(lines, 'operator', 'Operator', leg.airline || leg.operator || j.provider, seen);
    pushJourneyDetail(lines, 'ref', 'Reference', leg.flightNo || leg.trainNo || leg.ferryNo || leg.coachNo || leg.code, seen);
    pushJourneyDetail(lines, 'dep-term', 'Departure terminal', lx.depTerminal, seen);
    pushJourneyDetail(lines, 'dep-gate', 'Departure gate', lx.depGate, seen);
    pushJourneyDetail(lines, 'arr-term', 'Arrival terminal', lx.arrTerminal, seen);
    pushJourneyDetail(lines, 'arr-gate', 'Arrival gate', lx.arrGate, seen);
    pushJourneyDetail(lines, 'platform', 'Platform', lx.platform || lx.depPlatform || lx.arrPlatform, seen);
    pushJourneyDetail(lines, 'booking', 'Booking reference', leg.bookingRef || leg.conf || j.bookingRef, seen);
    pushJourneyDetail(lines, 'notes', 'Notes', journeyNotesText(leg.info || leg.notes), seen);
    pushJourneyDetail(lines, 'phone', 'Contact', leg.phone || leg.whatsapp, seen);
  }

  if(d){
    pushJourneyDetail(lines, 'driver', 'Driver', d.name, seen);
    pushJourneyDetail(lines, 'vehicle', 'Vehicle', d.vehicle || j.provider, seen);
    pushJourneyDetail(lines, 'pickup', 'Pickup', d.pickup || d.from, seen);
    pushJourneyDetail(lines, 'dropoff', 'Drop-off', d.to, seen);
    pushJourneyDetail(lines, 'phone', 'Phone', d.phone, seen);
    pushJourneyDetail(lines, 'whatsapp', 'WhatsApp', d.whatsapp, seen);
    pushJourneyDetail(lines, 'booking', 'Booking reference', d.conf || d.bookingRef || j.bookingRef, seen);
    pushJourneyDetail(lines, 'notes', 'Notes', journeyNotesText(d.notes), seen);
  }

  if(ref && !f && !leg){
    const rx = journeyLocationExtras(ref);
    pushJourneyDetail(lines, 'operator', 'Operator', ref.airline || ref.operator, seen);
    pushJourneyDetail(lines, 'ref', 'Reference', ref.flightNo || ref.trainNo || ref.ferryNo || ref.coachNo || ref.code, seen);
    pushJourneyDetail(lines, 'status', 'Status', ref.fstatus, seen);
    pushJourneyDetail(lines, 'delay', 'Delay', ref.delay, seen);
    pushJourneyDetail(lines, 'dep-term', 'Departure terminal', rx.depTerminal, seen);
    pushJourneyDetail(lines, 'dep-gate', 'Departure gate', rx.depGate, seen);
    pushJourneyDetail(lines, 'arr-term', 'Arrival terminal', rx.arrTerminal, seen);
    pushJourneyDetail(lines, 'arr-gate', 'Arrival gate', rx.arrGate, seen);
    pushJourneyDetail(lines, 'platform', 'Platform', rx.platform || rx.depPlatform || rx.arrPlatform, seen);
    pushJourneyDetail(lines, 'booking', 'Booking reference', ref.conf || ref.bookingRef || j.bookingRef, seen);
    pushJourneyDetail(lines, 'notes', 'Notes', journeyNotesText(ref.notes || ref.info || step?.sub), seen);
  }

  if(step?.title && !j.detail){
    pushJourneyDetail(lines, 'title', 'Activity', step.title, seen);
  }
  if(j?.phone && !lines.some((l) => l.key === 'phone' || l.key === 'whatsapp')){
    pushJourneyDetail(lines, 'phone', 'Contact', j.phone, seen);
  }
  if(j?.whatsapp && !lines.some((l) => l.key === 'whatsapp')){
    pushJourneyDetail(lines, 'whatsapp', 'WhatsApp', j.whatsapp, seen);
  }

  return lines;
}

export function journeyRoutePlaceLabel(place: any, raw: any, kind: 'from' | 'to'){
  const code = kind === 'from'
    ? (raw?.fromCode || raw?.from_code)
    : (raw?.toCode || raw?.to_code);
  const name = kind === 'from'
    ? (raw?.fromName || raw?.from_name)
    : (raw?.toName || raw?.to_name);
  const base = String(place || '').trim();
  if(base) return base;
  if(code && name) return `${name} (${String(code).toUpperCase()})`;
  if(code) return String(code).toUpperCase();
  return String(name || '').trim();
}

export function journeyPassengerSummary(j: any){
  const rows: { key: string; name: string; seat?: string; extra?: string }[] = [];
  const f = j?.rawFlight;
  if(f){
    (f.passengers || []).forEach((p: any, i: number) => {
      const name = String(p?.name || '').trim();
      const seat = String(p?.seat || '').trim();
      if(!name && !seat) return;
      const passN = (p.passes || []).length;
      rows.push({
        key: p?.id || `pax-${i}`,
        name: name || 'Passenger',
        seat,
        extra: passN ? `${passN} boarding pass${passN > 1 ? 'es' : ''}` : '',
      });
    });
    const sharedSeat = String(f.seat || '').trim();
    if(!rows.length && sharedSeat){
      rows.push({ key: 'flight-seat', name: 'Seat', seat: sharedSeat });
    }
  }
  const leg = j?.rawLeg;
  if(leg && Array.isArray(leg.passengers)){
    leg.passengers.forEach((p: any, i: number) => {
      const name = String(p?.name || '').trim();
      const seat = String(p?.seat || '').trim();
      if(!name && !seat) return;
      rows.push({ key: p?.id || `leg-pax-${i}`, name: name || 'Passenger', seat });
    });
  }
  const d = j?.rawDriver;
  if(d?.name){
    rows.push({
      key: 'driver',
      name: String(d.name),
      extra: [d.vehicle, j?.provider].filter(Boolean).join(' · ') || undefined,
    });
  }
  return rows;
}

export function journeySupportingChips(j: any){
  const chips: { key: string; label: string; value: string }[] = [];
  const type = String(j?.typeLabel || '').toLowerCase();
  if(j?.detail){
    const label = type.includes('flight') ? 'Flight'
      : type.includes('train') ? 'Train'
      : type.includes('transfer') || type.includes('car') ? 'Driver'
      : 'Reference';
    chips.push({ key: 'detail', label, value: String(j.detail) });
  }
  if(j?.provider) chips.push({ key: 'carrier', label: 'Carrier', value: String(j.provider) });
  if(j?.bookingRef) chips.push({ key: 'book', label: 'Booking', value: String(j.bookingRef) });
  const depWhen = formatJourneyWhen(j?.depDate, j?.depTime);
  const arrWhen = formatJourneyWhen(j?.arrDate, j?.arrTime);
  if(depWhen) chips.push({ key: 'dep-time', label: 'Departs', value: depWhen });
  if(arrWhen) chips.push({ key: 'arr-time', label: 'Arrives', value: arrWhen });
  const raw = j?.rawFlight || j?.rawLeg || j?.rawDriver || j?.rawStep?.ref || {};
  const x = journeyLocationExtras(raw);
  if(x.depTerminal) chips.push({ key: 'term', label: 'Terminal', value: String(x.depTerminal) });
  if(x.depGate) chips.push({ key: 'gate', label: 'Gate', value: String(x.depGate) });
  if(x.platform || x.depPlatform) chips.push({ key: 'plat', label: 'Platform', value: String(x.platform || x.depPlatform) });
  if(raw.fstatus) chips.push({ key: 'fstatus', label: 'Status', value: String(raw.fstatus) });
  if(raw.delay) chips.push({ key: 'delay', label: 'Delay', value: String(raw.delay) });
  return chips;
}

export function journeyStatusLabel(status: any){
  if(status === 'ongoing') return 'In progress';
  if(status === 'completed') return 'Completed';
  return 'Upcoming';
}

export function journeyCountdown(depMs: any){
  if(!depMs || !countdown) return null;
  const c = countdown(depMs);
  if(!c || c.done) return null;
  return c;
}

export function journeyBoardingPass(j: any){
  const f = j?.rawFlight;
  if(f && (f.passes || []).length) return { showId: j.showId, flightId: f.id, pass: f.passes[0] };
  const leg = j?.rawLeg;
  if(leg && (leg.passes || []).length) return { legId: leg.id, pass: leg.passes[0] };
  return null;
}