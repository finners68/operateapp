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
    provider: f.airline || '',
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