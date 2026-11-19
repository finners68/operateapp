import { call, countdown, fmtDate, fmtDateLong, parseDT } from '../api/operate.js';

export function collectUpcomingShows(sel: any, { persona = 'dj', excludeId = null, max = 12 }: Record<string, any> = {}){
  const events = sel?.events ? sel.events() : [];
  let list = events.filter((e: any) => {
    if(e.status === 'cancelled') return false;
    if(call('showPassed', e) === true) return false;
    return true;
  });
  if(persona === 'agent'){
    list = list.filter((e: any) => e.status !== 'hold');
  }
  if(excludeId){
    list = list.filter((e: any) => e.id !== excludeId);
  }
  return list.slice(0, Math.min(Math.max(1, max), 12));
}

export function showPerformanceTitle(e: any){
  return e?.eventName || e?.venue || 'Show';
}

export function showVenueLine(e: any){
  if(e?.eventName && e?.venue) return e.venue;
  return '';
}

export function showLocationLine(e: any){
  return [e?.city, e?.country].filter(Boolean).join(', ');
}

export function showSetTimeLine(e: any){
  if(!e?.setTime) return '';
  return e.endTime ? `${e.setTime} – ${e.endTime}` : e.setTime;
}

export function showListStatus(show: any){
  const st = show?.status || 'confirmed';
  if(st === 'hold') return { label: 'Tentative', className: 'hold' };
  if(st === 'cancelled') return { label: 'Cancelled', className: 'cancelled' };
  if(st === 'confirmed') return { label: 'Confirmed', className: 'confirmed' };
  return null;
}

export function showCountdownMs(show: any){
  const setMs = call('setStartMs', show?.date, show?.setTime);
  if(setMs) return setMs;
  const d = parseDT(show?.date);
  return d ? d.getTime() : null;
}

export function showCountdownLabel(show: any){
  const ms = showCountdownMs(show);
  if(ms && countdown){
    const c = countdown(ms);
    if(c && !c.done) return c.txt;
    if(c?.done) return 'Now';
  }
  const d = parseDT(show?.date);
  if(!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diff = Math.round((dd.getTime() - today.getTime()) / 86400000);
  if(diff === 0) return 'Today';
  if(diff === 1) return '1 day';
  if(diff > 1) return `${diff} days`;
  return '';
}