import { useState } from 'react';
import { call } from '../api/operate.js';
import { Icon, LegacyHtml } from './ui.jsx';

const IMPORTANT_CUSTOM_RE = /sound\s*check|meet\s*(&|and)?\s*greet|deadline|curfew|load[\s-]?in|doors|press|interview|performance|\bshow\b/;

export function timelineIcon(kind: any, icon: any){
  const ic = String(icon || '').toLowerCase();
  if(kind === 'flight' || ic === 'planetop' || ic === 'plane') return 'planeTop';
  if(kind === 'hotel' || ic === 'bed') return 'bed';
  if(ic === 'train' || ic === 'rail') return 'train';
  if(ic === 'ferry' || ic === 'boat') return 'ferry';
  if(ic === 'walk') return 'walk';
  if(kind === 'transport' || ic === 'car') return 'car';
  if(kind === 'arrival' || ic === 'pin') return 'pin';
  if(kind === 'set' || ic === 'music') return 'music';
  if(kind === 'advance' || ic === 'clock') return 'clock';
  return icon || 'clock';
}

export function stepShowsRoute(step: any){
  return (step.kind === 'flight' || step.kind === 'transport') && !!(step.from || step.to);
}

function isImportantCustom(step: any){
  return IMPORTANT_CUSTOM_RE.test(String(step.title || '').toLowerCase());
}

export function timelineTier(step: any){
  if(step.kind === 'set') return 'performance';
  if(step.kind === 'arrival' || step.kind === 'advance') return 'milestone';
  if(step.kind === 'custom' && isImportantCustom(step)) return 'milestone';
  return 'logistics';
}

export function previewSecondary(step: any){
  const sub = String(step.sub || '').trim();
  if(step.kind === 'set'){
    return { text: step.endTime ? ('until ' + step.endTime) : '', hasNote: false };
  }
  if(!sub) return { text: '', hasNote: false };
  if(step.kind === 'transport'){
    if(sub === 'No grounds' || /^Arrange at time/.test(sub)) return { text: sub === 'No grounds' ? 'Uber / taxi' : sub, hasNote: false };
    const parts = sub.split(' · ');
    const operator = (parts[0] || '').trim();
    const rest = parts.slice(1).join(' · ').trim();
    const opOk = operator.length > 0 && operator.length <= 42;
    return { text: opOk ? operator : '', hasNote: !!rest || (!!operator && !opOk) };
  }
  if(step.kind === 'flight'){
    if(sub.length <= 48) return { text: sub, hasNote: false };
    return { text: '', hasNote: true };
  }
  if(step.kind === 'advance'){
    const t = previewTime(step);
    if(t && (sub === t || sub.startsWith(t))) return { text: '', hasNote: false };
  }
  if(sub.length > 48 || sub.includes('\n')) return { text: '', hasNote: true };
  return { text: sub, hasNote: false };
}

export function previewTime(step: any){
  if(step.time) return step.time;
  if(step.kind === 'advance' && /^\d{1,2}:\d{2}\b/.test(String(step.sub || '').trim())){
    return String(step.sub).trim().slice(0, 5);
  }
  return '';
}

export function TimelineStepTitle({ step }: Record<string, any>){
  if(step.kind === 'flight' && (step.from || step.to)){
    const html = call('flightRouteHtml', step.from, step.to);
    if(html) return <div className="tl-route" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if(step.kind === 'transport' && (step.from || step.to)){
    const html = call('groundRouteHtml', step.from, step.to, step.icon || 'car');
    if(html) return <div className="tl-route" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <b>{step.title || 'Step'}</b>;
}

export function TimelineDayRow({ label, today }: Record<string, any>){
  return (
    <div className={`tl-day-banner-row${today ? ' today' : ''}`}>
      <div className="tl-day-date-pill">
        <span className="tl-day-date-text">{label}</span>
      </div>
    </div>
  );
}

/** Run timeline step → same shape as show-day timeline rows. */
export function mapRunStepToTimelineStep(s: any){
  if(!s) return s;
  let kind = s.kind;
  let from;
  let to;
  const icon = s.icon;
  if(kind === 'stay'){
    kind = 'hotel';
  } else if(kind === 'travel'){
    const ic = String(s.icon || 'plane').toLowerCase();
    if(ic === 'car'){
      kind = 'transport';
      from = s.ref?.from || '';
      to = s.ref?.to || '';
    } else {
      kind = 'flight';
      from = s.ref?.from || '';
      to = s.ref?.to || '';
    }
  }
  return {
    ...s,
    kind,
    icon,
    from,
    to,
    done: !!s.done
  };
}

export function LiveTimelineStepRow({ step: s, live, onToggle, onOpen, rawStep, runKey, expandOnRowClick = true, location = '' }: Record<string, any>){
  const [expanded, setExpanded] = useState(false);
  const tier = timelineTier(s);
  const bits = previewSecondary(s);
  const time = previewTime(s);
  const icon = timelineIcon(s.kind, s.icon);
  const showTypeIcon = !stepShowsRoute(s);
  const isNow = live && live.activeId === s.id;
  const isBefore = live && (live.beforeIds || []).includes(s.id);
  const rowStyle = isNow && live && live.progress
    ? { '--tl-now-progress': String(live.progress) }
    : undefined;
  const expandable = !!rawStep;
  const pillsHtml = expandable ? (call('stepPills', rawStep) || '') : '';
  const flightWidget = expandable && rawStep?.ref && rawStep.kind === 'travel' && (rawStep.ref?.icon || 'plane') === 'plane'
    ? call('flightInfoWidget', rawStep.ref)
    : '';
  const fullSub = expandable ? String(rawStep.sub || '').trim() : '';
  const hasExpandBody = expandable && !!(fullSub || pillsHtml || flightWidget);

  const toggleExpand = () => {
    if(!hasExpandBody) return;
    setExpanded((v: any) => !v);
  };

  return (
    <>
      <div
        className={`tl-item is-${tier}${s.done ? ' done' : ''}${isNow ? ' is-now' : ''}${isBefore ? ' is-before-now' : ''}${expanded ? ' is-expanded' : ''}`}
        data-id={s.id}
        style={rowStyle}
      >
        <div className="tl-time">{time}</div>
        <div className="tl-rail">
          <button
            type="button"
            className="tl-node"
            aria-label={s.done ? 'Mark not done' : 'Mark done'}
            onClick={(ev: any) => {
              ev.stopPropagation();
              onToggle(s);
            }}
          />
        </div>
        <div
          className={`tl-content is-${tier}${stepShowsRoute(s) ? ' has-route' : ''}${expandable ? ' has-expand' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            if(expandable && hasExpandBody && expandOnRowClick) toggleExpand();
            else onOpen(s);
          }}
          onKeyDown={(ev: any) => {
            if(ev.key === 'Enter' || ev.key === ' '){
              ev.preventDefault();
              if(expandable && hasExpandBody && expandOnRowClick) toggleExpand();
              else onOpen(s);
            }
          }}
        >
          {showTypeIcon ? (
            <div className="tl-type-ic" aria-hidden="true"><Icon name={icon} size={tier === 'performance' ? 16 : 13} /></div>
          ) : null}
          <div className="tl-body">
            <TimelineStepTitle step={s} />
            {bits.text ? <span className="tl-sub">{bits.text}</span> : null}
            {location ? <span className="tl-sub tl-loc">{location}</span> : null}
            {bits.hasNote ? (
              <span className="tl-note"><Icon name="note" size={11} /> Note</span>
            ) : null}
          </div>
          {expandable && hasExpandBody ? (
            <button
              type="button"
              className={`tl-expand-chev${expanded ? ' open' : ''}`}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              onClick={(ev: any) => {
                ev.stopPropagation();
                toggleExpand();
              }}
            >
              <Icon name="chevDown" size={16} />
            </button>
          ) : null}
        </div>
      </div>
      {expanded && hasExpandBody ? (
        <div className="tl-expand-panel">
          {fullSub ? <p className="tl-expand-detail">{fullSub}</p> : null}
          {pillsHtml ? (
            <div className="hero-info tl-expand-pills" style={{ marginTop: fullSub ? 10 : 0, flexWrap: 'wrap' }} dangerouslySetInnerHTML={{ __html: pillsHtml }} />
          ) : null}
          {flightWidget ? <LegacyHtml html={flightWidget} /> : null}
          {runKey ? (
            <button
              type="button"
              className="btn secondary tl-expand-more"
              onClick={() => call('timelineStepOptions', runKey, rawStep.id)}
            >
              Edit &amp; more actions
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
