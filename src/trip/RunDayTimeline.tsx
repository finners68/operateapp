import { useEffect, useMemo, useState } from 'react';
import { call } from '../api/operate.js';
import {
  LiveTimelineStepRow,
  TimelineDayRow,
  mapRunStepToTimelineStep
} from '../show/timelineShared.jsx';

function previewRows(groups: any[]){
  const rows: any[] = [];
  (groups || []).forEach((g: any, i: any) => {
    const steps = g.steps || [];
    if(!steps.length) return;
    if(g.label){
      rows.push({ type: 'day', key: 'day-' + (g.date || i), label: g.label, today: !!g.today });
    }
    steps.forEach((s: any) => rows.push({ type: 'step', key: s.id, step: mapRunStepToTimelineStep(s), rawStep: s }));
  });
  return rows;
}

export function RunDayTimeline({
  run,
  todayOnly = false,
  className = '',
  onAfterToggle,
}: Record<string, any>){
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t: any) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const tl = call('runTimeline', run) || [];
  const grouped = call('groupRunTimelineForPreview', run) || { groups: [] };
  const todayKey = String(call('todayISO') || '').slice(0, 10);
  let groups = grouped.groups || [];
  if(todayOnly && todayKey){
    groups = groups.filter((g: any) => g.today || String(g.date || '').slice(0, 10) === todayKey);
  }
  const stepsForLive = todayOnly
    ? tl.filter((s: any) => String(s.trueDate || s.date || s.showDate || '').slice(0, 10) === todayKey)
    : tl;
  const rows = (todayOnly ? groups.some((g: any) => (g.steps || []).length) : tl.length) ? previewRows(groups) : [];
  const live = useMemo(
    () => call('runTimelineLiveState', run, stepsForLive) || { showDay: false, activeId: null, beforeIds: [], progress: 0 },
    [run, stepsForLive, tick],
  );
  const hasNow = !!(live.showDay && live.activeId);

  if(!rows.length){
    return <div className="hint">Nothing on today&apos;s tour timeline yet — add travel and show day details to your shows.</div>;
  }

  const rootClass = [
    'timeline',
    'show-day-timeline',
    'tl-preview',
    hasNow ? 'has-now' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {rows.map((row: any) => {
        if(row.type === 'day'){
          return <TimelineDayRow key={row.key} label={row.label} today={row.today} />;
        }
        const stepId = row.rawStep?.id || row.step.id;
        return (
          <LiveTimelineStepRow
            key={row.key}
            step={row.step}
            rawStep={row.rawStep}
            runKey={run.key}
            live={live}
            onToggle={() => {
              call('completeRunStep', run.key, stepId);
              onAfterToggle?.();
            }}
            onOpen={() => call('timelineStepOptions', run.key, stepId)}
          />
        );
      })}
    </div>
  );
}
