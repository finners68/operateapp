import { useRef } from 'react';
import { call, getIdeaTypes, getStore } from '../api/operate.js';
import { Subsection, EmptyTap, Icon } from './ui.jsx';
import { NoteItemsEditor } from './NoteItems.jsx';

const PREVIEW_SOFT_LIMIT = 8;
const PREVIEW_SOFT_CAP = 9;
const IMPORTANT_CUSTOM_RE = /sound\s*check|meet\s*(&|and)?\s*greet|deadline|curfew|load[\s-]?in|doors|press|interview|performance|\bshow\b/;

function timelineIcon(kind, icon){
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

function stepShowsRoute(step){
  return (step.kind === 'flight' || step.kind === 'transport') && !!(step.from || step.to);
}

function isImportantCustom(step){
  return IMPORTANT_CUSTOM_RE.test(String(step.title || '').toLowerCase());
}

function timelineTier(step){
  if(step.kind === 'set') return 'performance';
  if(step.kind === 'arrival' || step.kind === 'advance') return 'milestone';
  if(step.kind === 'custom' && isImportantCustom(step)) return 'milestone';
  return 'logistics';
}

function previewSecondary(step){
  const sub = String(step.sub || '').trim();
  if(step.kind === 'set'){
    return { text: step.endTime ? ('until ' + step.endTime) : '', hasNote: false };
  }
  if(!sub) return { text: '', hasNote: false };
  if(step.kind === 'transport'){
    if(sub === 'No grounds') return { text: 'Uber / taxi', hasNote: false };
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

function previewTime(step){
  if(step.time) return step.time;
  if(step.kind === 'advance' && /^\d{1,2}:\d{2}\b/.test(String(step.sub || '').trim())){
    return String(step.sub).trim().slice(0, 5);
  }
  return '';
}

function compactKeepIds(tl){
  const n = tl.length;
  if(n <= PREVIEW_SOFT_LIMIT) return { ids: tl.map(s => s.id), hidden: 0 };
  const keep = new Set();
  const setIdx = tl.findIndex(s => s.kind === 'set');
  tl.forEach((s, i) => {
    if(timelineTier(s) !== 'logistics' || s.kind === 'flight' || s.kind === 'hotel') keep.add(i);
  });
  const focus = setIdx >= 0 ? setIdx : tl.findIndex(s => timelineTier(s) === 'milestone');
  if(focus >= 0){
    for(let i = Math.max(0, focus - 2); i <= Math.min(n - 1, focus + 2); i++) keep.add(i);
  }
  if(keep.size > PREVIEW_SOFT_CAP){
    const extras = [...keep].filter(i => {
      const s = tl[i];
      return timelineTier(s) === 'logistics' && s.kind !== 'flight' && s.kind !== 'hotel';
    }).sort((a, b) => {
      const origin = focus >= 0 ? focus : 0;
      return Math.abs(b - origin) - Math.abs(a - origin);
    });
    for(const i of extras){
      if(keep.size <= PREVIEW_SOFT_CAP) break;
      keep.delete(i);
    }
  }
  const ids = [...keep].sort((a, b) => a - b).map(i => tl[i].id);
  return { ids, hidden: n - ids.length };
}

function TimelineStepTitle({ step }){
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

function openTimelineStep(show, s){
  if(!s.auto){
    call('sheetShowTimelineStep', show.id, s.id);
    return;
  }
  if(s.kind === 'flight' && s.refId) return call('sheetFlight', show.id, s.refId);
  if(s.kind === 'hotel') return call('sheetHotel', show.id);
  if(s.kind === 'transport'){
    const list = call('showDrivers', show) || [];
    const idx = list.findIndex(d => String(d.id) === String(s.refId));
    return idx >= 0 ? call('sheetDriver', show.id, idx) : call('sheetDriver', show.id);
  }
  if(s.kind === 'set' || s.kind === 'arrival') return call('sheetEvent', show.id);
  if(s.kind === 'advance') return call('sheetAdvance', show.id);
}

function groupedTimelineDays(show, tl){
  const grouped = call('groupShowTimelineByDay', show, tl);
  if(grouped && grouped.groups && grouped.groups.length) return grouped;
  return { multi: false, groups: [{ date: show.date || '', label: '', today: false, steps: tl }] };
}

function previewRows(show, tl){
  const { multi, groups } = groupedTimelineDays(show, tl);
  const { ids, hidden } = compactKeepIds(tl);
  const keep = new Set(ids);
  const rows = [];
  groups.forEach((g, i) => {
    const steps = (g.steps || []).filter(s => keep.has(s.id));
    if(!steps.length) return;
    if(multi && g.label){
      rows.push({ type: 'day', key: 'day-' + (g.date || i), label: g.label, today: !!g.today });
    }
    steps.forEach(s => rows.push({ type: 'step', key: s.id, step: s }));
  });
  if(hidden > 0) rows.push({ type: 'more', key: 'more', hidden });
  return rows;
}

function TimelineStepRow({ show, step: s }){
  const tier = timelineTier(s);
  const bits = previewSecondary(s);
  const time = previewTime(s);
  const icon = timelineIcon(s.kind, s.icon);
  const showTypeIcon = !stepShowsRoute(s);
  return (
    <div className={`tl-item is-${tier}${s.done ? ' done' : ''}`} data-id={s.id}>
      <div className="tl-time">{time}</div>
      <div className="tl-rail">
        <button
          type="button"
          className="tl-node"
          aria-label={s.done ? 'Mark not done' : 'Mark done'}
          onClick={ev => {
            ev.stopPropagation();
            call('toggleShowTimelineStep', show.id, s.id);
          }}
        />
      </div>
      <div
        className={`tl-content is-${tier}${stepShowsRoute(s) ? ' has-route' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => openTimelineStep(show, s)}
        onKeyDown={ev => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); openTimelineStep(show, s); } }}
      >
        {showTypeIcon ? (
          <div className="tl-type-ic" aria-hidden="true"><Icon name={icon} size={tier === 'performance' ? 16 : 13} /></div>
        ) : null}
        <div className="tl-body">
          <TimelineStepTitle step={s} />
          {bits.text ? <span className="tl-sub">{bits.text}</span> : null}
          {bits.hasNote ? (
            <span className="tl-note"><Icon name="note" size={11} /> Note</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimelineDayRow({ label, today }){
  return (
    <div className={`tl-day-row${today ? ' today' : ''}`}>
      <div className="tl-time" />
      <div className="tl-rail" />
      <div className="tl-day-head">{label}</div>
    </div>
  );
}

function TimelineMoreRow({ hidden, onOpen }){
  return (
    <div className="tl-more-row">
      <div className="tl-time" />
      <div className="tl-rail" />
      <button type="button" className="tl-more" onClick={onOpen}>
        +{hidden} more itinerary item{hidden === 1 ? '' : 's'}
      </button>
    </div>
  );
}

/** Always-visible day plan at the top of a show page. */
export function DayOverview({ show }){
  const tl = call('showDayTimeline', show) || show.timeline || [];
  const rows = tl.length ? previewRows(show, tl) : [];
  const openFull = () => call('sheetShowTimeline', show.id);
  const copy = tl.length
    ? `${tl.length} timeline item${tl.length === 1 ? '' : 's'} · Travel, stay and show details update automatically`
    : 'Builds from flights, hotel, transport and set time';
  return (
    <section className="show-day-overview">
      <div className="show-day-overview-head">
        <div>
          <div className="block-title">Show timeline</div>
          <div className="show-day-overview-sub">{copy}</div>
        </div>
        <div className="show-day-overview-actions">
          {tl.length ? (
            <button type="button" className="show-day-overview-link" onClick={openFull}>
              View full timeline
            </button>
          ) : null}
          <button type="button" className="show-day-overview-edit" onClick={openFull}>
            {tl.length ? 'Edit' : 'Add'}
          </button>
        </div>
      </div>
      {tl.length ? (
        <div className="timeline show-day-timeline tl-preview">
          {rows.map(row => {
            if(row.type === 'day') return <TimelineDayRow key={row.key} label={row.label} today={row.today} />;
            if(row.type === 'more') return <TimelineMoreRow key={row.key} hidden={row.hidden} onOpen={openFull} />;
            return <TimelineStepRow key={row.key} show={show} step={row.step} />;
          })}
        </div>
      ) : (
        <EmptyTap
          icon="clock"
          title="Add show details — this overview fills in automatically"
          onClick={openFull}
        />
      )}
    </section>
  );
}

/** Nested checklist-style timeline (kept for sheets / older surfaces). */
export function Timeline({ show }){
  const tl = call('showDayTimeline', show) || show.timeline || [];
  return (
    <Subsection
      id={`ss-${show.id}-timeline`}
      title="Day timeline"
      addLabel={tl.length ? 'Edit' : 'Add'}
      onAdd={() => call('sheetShowTimeline', show.id)}
      defaultOpen={tl.length > 0}
    >
      {tl.length ? (
        <>
          <div className="card flush">
            {tl.map(s => (
              <div key={s.id} className={`check is-circle ${s.done ? 'done' : ''}`} data-id={s.id}>
                <div className="box" onClick={() => call('toggleShowTimelineStep', show.id, s.id)}>
                  <Icon name="check" size={15} />
                </div>
                <div
                  className="lbl"
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() => openTimelineStep(show, s)}
                >
                  <b>{s.time || '—'}</b> {s.title || 'Step'}
                  {s.sub ? <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>{s.sub}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="hint" style={{ textAlign: 'left', padding: '8px 4px 0' }}>
            Flights, hotel, transport and set time appear here automatically. Tap Edit to add custom steps.
          </div>
        </>
      ) : (
        <EmptyTap
          icon="clock"
          title="Add show details — timeline fills in automatically"
          onClick={() => call('sheetShowTimeline', show.id)}
        />
      )}
    </Subsection>
  );
}

export function Checklist({ show }){
  const list = show.checklist || [];
  const done = list.filter(i => i.done).length;
  const title = list.length ? `Checklist · ${done}/${list.length}` : 'Checklist';
  return (
    <Subsection
      id={`ss-${show.id}-checklist`}
      title={title}
      addLabel="Add"
      onAdd={() => call('sheetShowChecklist', show.id)}
      defaultOpen={list.length > 0}
    >
      {list.length ? (
        <div className="card flush">
          {list.map(item => (
            <div key={item.id} className={`check ${item.done ? 'done' : ''}`} data-id={item.id}>
              <div className="box" onClick={() => call('toggleEventCheck', show.id, item.id)}>
                <Icon name="check" size={15} />
              </div>
              <div className="lbl" onClick={() => call('toggleEventCheck', show.id, item.id)}>
                {item.label}
              </div>
              <button type="button" className="del" onClick={() => call('delEventCheck', show.id, item.id)}>
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyTap icon="checkList" title="Add a checklist item" onClick={() => call('sheetShowChecklist', show.id)} />
      )}
    </Subsection>
  );
}

export function Notes({ show }){
  const editorRef = useRef(null);
  const has = !!(typeof call === 'function' && call('noteItemsHas', show.notes));
  return (
    <Subsection
      id={`ss-${show.id}-notes`}
      title="Internal notes"
      addLabel="Add"
      onAdd={() => editorRef.current && editorRef.current.add()}
      defaultOpen={has}
    >
      <NoteItemsEditor
        ref={editorRef}
        listId={`show-notes-${show.id}`}
        value={show.notes}
        placeholder="Anything to remember about this show…"
        onCommit={items => call('saveEventNotes', show.id, items)}
      />
    </Subsection>
  );
}

export function ContentBlock({ show }){
  const store = getStore();
  const linked = (store?.ideas || []).filter(x => x.eventId === show.id);
  const types = getIdeaTypes() || {};
  const has = !!(show.content || linked.length);

  return (
    <Subsection
      id={`ss-${show.id}-content`}
      title="Content to capture"
      addLabel="Add idea"
      onAdd={() => call('attachIdeaPickForEvent', show.id)}
      defaultOpen={has}
    >
      {show.content ? (
        <div className="card show-brief" style={{ background: 'linear-gradient(150deg,var(--accent-soft),var(--card))', margin: 10 }}>
          <div className="show-brief-k"><Icon name="camera" size={14} /> Brief</div>
          <div className="show-brief-v">{show.content}</div>
        </div>
      ) : null}
      {linked.length ? (
        <div className="card flush">
          {linked.map(i => {
            const t = types[i.type] || types.other || { label: 'Idea', color: 'var(--accent-2)', icon: 'idea' };
            return (
              <div key={i.id} className="row" onClick={() => call('openView', 'idea', i.id)}>
                <div className="ic" style={{ background: `${t.color}22`, color: t.color }}>
                  <Icon name={t.icon} size={16} />
                </div>
                <div className="body">
                  <b>{i.title}</b>
                  <span>{t.label}{i.done ? ' · done' : ''}</span>
                </div>
                <Icon name="chevR" size={15} />
              </div>
            );
          })}
        </div>
      ) : null}
      {!has ? (
        <EmptyTap
          icon="camera"
          title="Set what to film / capture"
          onClick={() => call('sheetEvent', show.id)}
        />
      ) : null}
    </Subsection>
  );
}

export function Attachments({ show }){
  const list = show.attachments || [];
  return (
    <Subsection id={`ss-${show.id}-attachments`} title="Attachments" defaultOpen={list.length > 0}>
      <div className="thumb-row">
        {list.map(a => (
          <div
            key={a.id}
            className="thumb"
            onClick={() => (a.kind === 'image' ? call('openViewer', a.data) : call('toast', 'PDF saved', 'file'))}
          >
            {a.kind === 'image' ? (
              <img src={a.data} alt="" />
            ) : (
              <div className="pdf">
                <Icon name="file" size={26} />
                <span>{a.name || 'File'}</span>
              </div>
            )}
            <div
              className="del-badge"
              onClick={e => { e.stopPropagation(); call('delAttachment', show.id, a.id); }}
            >
              <Icon name="x" size={13} />
            </div>
          </div>
        ))}
        <label className="thumb thumb-add">
          <Icon name="plus" size={22} />
          <span>Add</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={e => call('uploadAttachment', show.id, e.target)}
          />
        </label>
      </div>
    </Subsection>
  );
}
