import { call, showTitle } from '../api/operate.js';
import {
  activityKindLabel,
  buildTodayScheduleRows,
  todayScheduleLiveState,
  todayStepStatus,
} from './todaySchedule.js';
import { formatJourneyWhen } from './upcomingTravel.js';
import { showCountdownLabel, showPerformanceTitle } from './upcomingShows.js';

/** One or two short lines for the permanent “daily overview” block — not widget-style tiles. */
export function buildDailyOverviewLines({
  today,
  sel,
  focusRun,
  liveRun,
  nextShow,
  nextJourney,
  tasks,
  personaBlurb,
}: Record<string, any>): string[] {
  const lines: string[] = [];
  const blurb = String(personaBlurb || '').trim();

  if (liveRun) {
    const p = call('runProgress', liveRun) || { done: 0, total: 0 };
    lines.push(
      `You’re on tour${liveRun.title ? ` — ${liveRun.title}` : ''}. ${p.done} of ${p.total} steps complete.`,
    );
  } else if (nextShow) {
    const title = showPerformanceTitle(nextShow) || showTitle(nextShow) || 'your next show';
    const when = showCountdownLabel(nextShow);
    lines.push(when ? `Next show: ${title} (${when}).` : `Next show: ${title}.`);
  } else {
    lines.push('No upcoming shows — add one when you’re ready.');
  }

  const scheduleRows = buildTodayScheduleRows({ today, sel, focusRun });
  const liveSchedule = todayScheduleLiveState(today, scheduleRows);
  const spotlight = scheduleRows.find(
    (r: any) => todayStepStatus(r.timelineStep, liveSchedule) === 'now',
  ) || scheduleRows.find(
    (r: any) => todayStepStatus(r.timelineStep, liveSchedule) === 'upcoming',
  );

  const travelBit = nextJourney
    ? `Travel ${formatJourneyWhen(nextJourney.depDate, nextJourney.depTime) || 'upcoming'}`
    : '';

  if (scheduleRows.length) {
    const step = spotlight?.timelineStep;
    const stepLabel = step?.title || (step ? activityKindLabel(step.kind) : 'up next');
    const todayBit = `${scheduleRows.length} thing${scheduleRows.length === 1 ? '' : 's'} today — ${stepLabel} next`;
    lines.push(travelBit ? `${todayBit}. ${travelBit}.` : `${todayBit}.`);
  } else if (travelBit) {
    lines.push(`${travelBit}. Nothing else on today’s schedule.`);
  } else {
    lines.push('Nothing scheduled for today yet.');
  }

  const openTasks = (tasks || []).filter((t: any) => t.status !== 'done');
  const urgent = openTasks.filter((t: any) => t.overdue || t.priority === 'high').length;
  if (openTasks.length) {
    const taskLine = urgent
      ? `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} (${urgent} need attention).`
      : `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}.`;
    lines.push(taskLine);
  } else if (blurb) {
    lines.push(blurb);
  } else {
    lines.push('Tasks are clear.');
  }

  return lines.slice(0, 3);
}

export function DailyOverview({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <section className="home-daily-summary" aria-label="Daily overview">
      {lines.map((line, i) => (
        <p
          key={i}
          className={i === 0 ? 'home-daily-summary-lead' : 'home-daily-summary-sub'}
        >
          {line}
        </p>
      ))}
    </section>
  );
}