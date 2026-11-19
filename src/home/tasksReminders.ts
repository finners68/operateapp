import { call, parseDT, showTitle } from '../api/operate.js';
import { priorityShowsForContacts } from './keyContacts.js';

const PRIO_RANK = { high: 0, med: 1, medium: 1, low: 2 };

function pad2(n: any){
  return String(n).padStart(2, '0');
}

function ymdFromMs(ms: any){
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeFromMs(ms: any){
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function showRecordLabel(sel: any, showId: any, fallback: any){
  if(!showId || !sel?.event) return fallback || '';
  const e = sel.event(showId);
  if(!e) return fallback || '';
  if(typeof call('tourShowLabel', e) === 'string') return call('tourShowLabel', e);
  return showTitle(e) || e.venue || 'Show';
}

function showDueMs(show: any, today: any){
  if(!show) return null;
  if(show.date === today){
    const end = call('showSetEndMs', show);
    if(typeof end === 'number' && Number.isFinite(end)) return end;
    const set = call('setStartMs', show.date, show.setTime || '23:59');
    if(typeof set === 'number' && Number.isFinite(set)) return set;
  }
  const morning = parseDT(show.date, '09:00');
  return morning ? morning.getTime() : null;
}

function inferChecklistPriority(show: any, today: any, dueMs: any, now: any){
  if(dueMs != null && dueMs < now) return 'high';
  if(show?.date === today) return 'med';
  if(dueMs != null && dueMs < now + 48 * 3600000) return 'med';
  return 'low';
}

function collectShowsForTasks({ sel, today, nextShow, focusRun, accommodationShow }: Record<string, any>){
  const ordered = priorityShowsForContacts({ sel, today, nextShow, accommodationShow, focusRun });
  const seen = new Set(ordered.map((s: any) => s.id));
  const add = (s: any) => {
    if(!s?.id || seen.has(s.id)) return;
    seen.add(s.id);
    ordered.push(s);
  };
  const upcoming = sel?.upcoming ? sel.upcoming() : [];
  upcoming.slice(0, 18).forEach((e: any) => {
    if((e.checklist || []).some((c: any) => !c.done)) add(e);
  });
  return ordered;
}

function makeTaskKey(kind: any, id: any, parentId: any){
  return `${kind}:${parentId || ''}:${id}`;
}

export function collectHomeTasks({
  sel,
  store,
  today,
  nextShow,
  focusRun,
  accommodationShow,
  now = Date.now(),
}: Record<string, any>){
  const tasks: any[] = [];
  const shows = collectShowsForTasks({ sel, today, nextShow, focusRun, accommodationShow });

  shows.forEach((show: any) => {
    (show.checklist || []).filter((c: any) => !c.done).forEach((item: any) => {
      let dueMs: any = null;
      if(item.dueAt){
        const parsed = typeof item.dueAt === 'number' ? item.dueAt : Date.parse(item.dueAt);
        if(Number.isFinite(parsed)) dueMs = parsed;
      }
      if(dueMs == null) dueMs = showDueMs(show, today);
      const priority = item.prio || item.priority || inferChecklistPriority(show, today, dueMs, now);
      const status = item.status === 'progress' || item.inProgress ? 'progress' : 'pending';
      tasks.push({
        key: makeTaskKey('checklist-show', item.id, show.id),
        kind: 'checklist-show',
        id: item.id,
        showId: show.id,
        title: item.label || 'Task',
        dueMs,
        priority,
        status,
        overdue: dueMs != null && dueMs < now,
        recordLabel: showRecordLabel(sel, show.id, show.venue),
        recordKind: 'show',
      });
    });
  });

  const tripId = focusRun?.key;
  if(tripId && sel?.trip){
    const trip = sel.trip(tripId);
    const tripLabel = trip?.name || trip?.title || 'Tour';
    const tripDue = focusRun?.shows?.[0] ? showDueMs(focusRun.shows[0], today) : null;
    (trip?.checklist || []).filter((c: any) => !c.done).forEach((item: any) => {
      let dueMs: any = null;
      if(item.dueAt){
        const parsed = typeof item.dueAt === 'number' ? item.dueAt : Date.parse(item.dueAt);
        if(Number.isFinite(parsed)) dueMs = parsed;
      }
      if(dueMs == null) dueMs = tripDue;
      const priority = item.prio || item.priority || (dueMs != null && dueMs < now ? 'high' : 'med');
      tasks.push({
        key: makeTaskKey('checklist-tour', item.id, tripId),
        kind: 'checklist-tour',
        id: item.id,
        tripId,
        title: item.label || 'Task',
        dueMs,
        priority,
        status: 'pending',
        overdue: dueMs != null && dueMs < now,
        recordLabel: tripLabel,
        recordKind: 'tour',
      });
    });
  }

  const reminders = Array.isArray(store?.reminders) ? store.reminders : [];
  reminders.forEach((r: any) => {
    if(r.fired) return;
    const at = r.at;
    if(typeof at !== 'number' || !Number.isFinite(at)) return;
    if(at < now - 12 * 3600000) return;
    const kind = r.kind || 'manual';
    const title = kind === 'usb' ? "Don't forget your USB" : (r.label || 'Reminder');
    tasks.push({
      key: makeTaskKey('reminder', r.id, r.showId),
      kind: 'reminder',
      id: r.id,
      showId: r.showId,
      reminderKind: kind,
      title,
      dueMs: at,
      priority: at < now ? 'high' : (at < now + 24 * 3600000 ? 'high' : 'med'),
      status: 'pending',
      overdue: at < now,
      recordLabel: showRecordLabel(sel, r.showId, 'Show'),
      recordKind: 'reminder',
    });
  });

  (store?.ideas || []).forEach((idea: any) => {
    if(idea.done) return;
    if(!idea.eventId && !idea.tripId) return;
    let dueMs: any = null;
    let recordLabel = '';
    if(idea.eventId && sel?.event){
      const e = sel.event(idea.eventId);
      dueMs = e ? showDueMs(e, today) : null;
      recordLabel = showRecordLabel(sel, idea.eventId, 'Show');
    } else if(idea.tripId && sel?.trip){
      const t = sel.trip(idea.tripId);
      recordLabel = t?.name || t?.title || 'Tour';
    }
    tasks.push({
      key: makeTaskKey('idea', idea.id, idea.eventId || idea.tripId),
      kind: 'idea',
      id: idea.id,
      showId: idea.eventId || null,
      tripId: idea.tripId || null,
      title: idea.title || 'Idea',
      dueMs,
      priority: idea.prio || 'med',
      status: 'pending',
      overdue: dueMs != null && dueMs < now,
      recordLabel,
      recordKind: idea.eventId ? 'show' : 'tour',
    });
  });

  tasks.sort((a: any, b: any) => {
    const ao = a.overdue ? 0 : 1;
    const bo = b.overdue ? 0 : 1;
    if(ao !== bo) return ao - bo;
    const ad = a.dueMs ?? Number.POSITIVE_INFINITY;
    const bd = b.dueMs ?? Number.POSITIVE_INFINITY;
    if(ad !== bd) return ad - bd;
    return (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1);
  });

  return tasks;
}

export function formatTaskDue(dueMs: any, now: any){
  if(dueMs == null || !Number.isFinite(dueMs)) return null;
  const overdue = dueMs < now;
  const dateStr = typeof call('fmtDate') === 'function' ? call('fmtDate', ymdFromMs(dueMs)) : ymdFromMs(dueMs);
  const time = timeFromMs(dueMs);
  return { text: `${dateStr} · ${time}`, overdue };
}

export function priorityLabel(prio: any){
  const p = String(prio || 'med').toLowerCase();
  if(p === 'high') return 'High';
  if(p === 'low') return 'Low';
  return 'Medium';
}

export function statusLabel(status: any){
  if(status === 'progress') return 'In progress';
  if(status === 'completed') return 'Completed';
  return 'Pending';
}

export function completeHomeTask(task: any){
  if(!task) return;
  if(task.kind === 'checklist-show') call('toggleEventCheck', task.showId, task.id);
  else if(task.kind === 'checklist-tour') call('toggleTripCheck', task.tripId, task.id);
  else if(task.kind === 'idea') call('toggleIdeaDone', task.id);
  else if(task.kind === 'reminder' && task.showId) call('cancelReminder', task.showId, task.reminderKind || 'manual');
}

export function openHomeTask(task: any){
  if(!task) return;
  if(task.kind === 'reminder' && task.showId) call('sheetReminder', task.showId);
  else if(task.kind === 'checklist-show' && task.showId) call('sheetShowChecklist', task.showId);
  else if(task.kind === 'checklist-tour' && task.tripId) call('openView', 'trip', task.tripId);
  else if(task.kind === 'idea') call('openView', 'idea', task.id);
  else if(task.showId) call('openView', 'event', task.showId);
}

export function addHomeTask(nextShow: any){
  if(nextShow?.id) call('addEventCheckPrompt', nextShow.id);
  else call('sheetEvent');
}

export function addHomeReminder(nextShow: any){
  if(nextShow?.id) call('sheetReminder', nextShow.id);
  else call('toast', 'Add a show first', 'x');
}