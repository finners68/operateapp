import { useEffect, useMemo, useState } from 'react';
import { call } from '../api/operate.js';
import {
  LiveTimelineStepRow,
  TimelineDayRow,
  mapRunStepToTimelineStep
} from '../show/timelineShared.jsx';

function previewRows(grouped: any){
  const groups = grouped?.groups || [];
  const rows: any[] = [];
  groups.forEach((g: any, i: any) => {
    const steps = g.steps || [];
    if(!steps.length) return;
    if(g.label){
      rows.push({ type: 'day', key: 'day-' + (g.date || i), label: g.label, today: !!g.today });
    }
    steps.forEach((s: any) => rows.push({ type: 'step', key: s.id, step: mapRunStepToTimelineStep(s), rawStep: s }));
  });
  return rows;
}

export function RunDayTimeline({ run }: Record<string, any>){
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t: any) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const tl = call('runTimeline', run) || [];
  const grouped = call('groupRunTimelineForPreview', run) || { groups: [] };
  const rows = tl.length ? previewRows(grouped) : [];
  const live = useMemo(
    () => call('runTimelineLiveState', run, tl) || { showDay: false, activeId: null, beforeIds: [], progress: 0 },
    [run, tl, tick]
  );
  const hasNow = !!(live.showDay && live.activeId);

  if(!tl.length){
    return <div className="hint">Add flights &amp; hotels inside each show</div>;
  }

  return (
    <div className={`timeline show-day-timeline tl-preview${hasNow ? ' has-now' : ''}`}>
      {rows.map((row: any) => {
        if(row.type === 'day'){
          return <TimelineDayRow key={row.key} label={row.label} today={row.today} />;
        }
        return (
          <LiveTimelineStepRow
            key={row.key}
            step={row.step}
            rawStep={row.rawStep}
            runKey={run.key}
            live={live}
            onToggle={() => call('completeRunStep', run.key, row.rawStep?.id || row.step.id)}
            onOpen={() => call('timelineStepOptions', run.key, row.rawStep?.id || row.step.id)}
          />
        );
      })}
    </div>
  );
}
