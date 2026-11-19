import { call } from '../api/operate.js';
import { mapRunStepToTimelineStep, previewSecondary, previewTime } from '../show/timelineShared.jsx';

function stepDay(step: any, show: any){
  return String(step?.trueDate || step?.date || show?.date || '').slice(0, 10);
}

function clockSortKey(step: any){
  const t = previewTime(step) || step?.time || '';
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if(m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if(step?.kind === 'set') return 20 * 60;
  if(step?.kind === 'performance') return 20 * 60;
  return 24 * 60 + 30;
}

export function activityKindLabel(kind: any){
  const k = String(kind || '').toLowerCase();
  if(k === 'flight') return 'Flight';
  if(k === 'transport' || k === 'car') return 'Transfer';
  if(k === 'hotel' || k === 'stay') return 'Hotel';
  if(k === 'set' || k === 'performance') return 'Performance';
  if(k === 'arrival') return 'Venue arrival';
  if(k === 'advance') return 'Schedule';
  if(k === 'custom') return 'Event';
  if(k === 'travel') return 'Travel';
  return 'Activity';
}

export function stepLocation(step: any, show: any, rawRunStep: any){
  if(!step && !show) return '';
  if(step.kind === 'set' || step.kind === 'arrival' || step.kind === 'performance'){
    return [show?.venue, show?.city].filter(Boolean).join(', ');
  }
  if(step.kind === 'hotel' || step.kind === 'stay'){
    return rawRunStep?.title || show?.hotel?.name || show?.hotel?.city || '';
  }
  if(step.kind === 'flight'){
    return step.to || step.from || '';
  }
  if(step.kind === 'transport' || step.kind === 'car' || step.kind === 'travel'){
    return step.to || step.from || show?.venue || show?.city || '';
  }
  return show?.city || show?.venue || '';
}

function scheduleRowKey(kind: any, showId: any, id: any){
  return `${kind}:${showId || 'x'}:${id}`;
}

/**
 * All activities for `today` from tour run timeline and/or per-show day timelines.
 */
export function buildTodayScheduleRows({ today, sel, focusRun }: Record<string, any>){
  if(!today) return [];
  const rows: any[] = [];
  const seen = new Set();
  const shows = sel?.events ? sel.events() : [];
  const showById = (id: any) => (sel?.event ? sel.event(id) : shows.find((s: any) => s.id === id)) || null;

  const addShowStep = (show: any, step: any) => {
    if(!show || !step) return;
    if(stepDay(step, show) !== today) return;
    const key = scheduleRowKey('show', show.id, step.id);
    if(seen.has(key)) return;
    seen.add(key);
    rows.push({
      key,
      showId: show.id,
      show,
      showStep: step,
      timelineStep: step,
    });
  };

  const addRunStep = (step: any) => {
    if(!step) return;
    const d = String(step.trueDate || step.date || step.showDate || '').slice(0, 10);
    if(d !== today) return;
    const key = scheduleRowKey('run', step.showId, step.id);
    if(seen.has(key)) return;
    seen.add(key);
    const show = showById(step.showId);
    const timelineStep = mapRunStepToTimelineStep(step);
    rows.push({
      key,
      showId: step.showId,
      show,
      runStep: step,
      timelineStep,
    });
  };

  if(focusRun){
    (call('runTimeline', focusRun) || []).forEach(addRunStep);
    (focusRun.shows || []).forEach((show: any) => {
      (call('showDayTimeline', show) || []).forEach((step: any) => {
        if(stepDay(step, show) !== today) return;
        const k = String(step.kind || '');
        if(k === 'flight' || k === 'transport' || k === 'hotel' || k === 'set') return;
        addShowStep(show, step);
      });
    });
  }else{
    shows.forEach((show: any) => {
      const tl = call('showDayTimeline', show) || [];
      tl.forEach((step: any) => addShowStep(show, step));
    });
  }

  rows.sort((a: any, b: any) => {
    const ka = clockSortKey(a.timelineStep);
    const kb = clockSortKey(b.timelineStep);
    if(ka !== kb) return ka - kb;
    return String(a.timelineStep?.title || '').localeCompare(String(b.timelineStep?.title || ''));
  });

  return rows;
}

export function todayScheduleLiveState(today: any, rows: any){
  const steps = (rows || []).map((r: any) => r.timelineStep).filter(Boolean);
  const live = call('showTimelineLiveState', { date: today }, steps);
  return live || { showDay: false, activeId: null, beforeIds: [], progress: 0, upcoming: false };
}

export function todayStepDetail(step: any, rawRunStep: any){
  const bits = previewSecondary(step);
  const detail = bits.text || '';
  if(detail) return detail;
  const sub = String(rawRunStep?.sub || step?.sub || '').trim();
  if(sub && sub.length <= 72) return sub;
  return '';
}

export function todayStepStatus(step: any, live: any){
  if(step?.done) return 'done';
  if(!live?.showDay) return 'upcoming';
  if(live.activeId === step?.id) return 'now';
  if((live.beforeIds || []).includes(step?.id)) return 'done';
  return 'upcoming';
}