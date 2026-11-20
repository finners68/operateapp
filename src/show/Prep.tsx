import { useRef } from 'react';
import { call, getIdeaTypes, getStore } from '../api/operate.js';
import { Subsection, EmptyTap, CompactAddRow, Icon } from './ui.jsx';
import { NoteItemsEditor } from './NoteItems.jsx';
import { LiveTimelineStepRow, TimelineDayRow } from './timelineShared.jsx';
import { openTimelineStep } from './openTimelineStep.js';

function groupedTimelineDays(show: any, tl: any){
  const grouped = call('groupShowTimelineByDay', show, tl);
  if(grouped && grouped.groups && grouped.groups.length) return grouped;
  return { multi: false, groups: [{ date: show.date || '', label: '', today: false, steps: tl }] };
}

function previewRows(show: any, tl: any){
  const { groups } = groupedTimelineDays(show, tl);
  const rows: any[] = [];
  groups.forEach((g: any, i: any) => {
    const steps = g.steps || [];
    if(!steps.length) return;
    if(g.label){
      rows.push({ type: 'day', key: 'day-' + (g.date || i), label: g.label, today: !!g.today });
    }
    steps.forEach((s: any) => rows.push({ type: 'step', key: s.id, step: s }));
  });
  return rows;
}

/** Always-visible day plan at the top of a show page. */
export function DayOverview({ show }: Record<string, any>){
  const tl = call('showDayTimeline', show) || show.timeline || [];
  const rows = tl.length ? previewRows(show, tl) : [];
  const openEdit = () => call('sheetShowTimeline', show.id);
  const copy = tl.length
    ? 'Travel, stay and show schedule'
    : 'Builds from flights, hotel, transport and set time';
  return (
    <section className="show-day-overview">
      <div className="show-day-overview-head">
        <div>
          <div className="block-title">Show timeline</div>
          <div className="show-day-overview-sub">{copy}</div>
        </div>
        <div className="show-day-overview-actions">
          <button type="button" className="show-day-overview-edit" onClick={openEdit}>
            {tl.length ? 'Edit' : 'Add'}
          </button>
        </div>
      </div>
      {tl.length ? (
        <div className="timeline show-day-timeline tl-preview">
          {rows.map((row: any) => {
            if(row.type === 'day') return <TimelineDayRow key={row.key} label={row.label} today={row.today} />;
            return (
              <LiveTimelineStepRow
                key={row.key}
                step={row.step}
                live={null}
                onToggle={() => call('toggleShowTimelineStep', show.id, row.step.id)}
                onOpen={(s: any) => openTimelineStep(show, s)}
              />
            );
          })}
        </div>
      ) : (
        <div className="show-compact-row" onClick={openEdit}>
          <span>No schedule yet</span>
          <button type="button" className="add" onClick={openEdit}>Add</button>
        </div>
      )}
    </section>
  );
}

/** Nested checklist-style timeline (kept for sheets / older surfaces). */
export function Timeline({ show }: Record<string, any>){
  const tl = call('showDayTimeline', show) || show.timeline || [];
  return (
    <Subsection
      id={`ss-${show.id}-timeline`}
      title="Day timeline"
      addLabel={tl.length ? 'Edit' : 'Add'}
      onAdd={() => call('sheetShowTimeline', show.id)}
      defaultOpen={false}
    >
      {tl.length ? (
        <>
          <div className="card flush">
            {tl.map((s: any) => (
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
                  {s.sub ? <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginTop: 2 }}>{s.sub}</span> : null}
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

export function Checklist({ show }: Record<string, any>){
  const list = show.checklist || [];
  const done = list.filter((i: any) => i.done).length;
  const title = list.length ? `Checklist · ${done}/${list.length}` : 'Checklist';
  if(!list.length){
    return <CompactAddRow label="Checklist" onAdd={() => call('sheetShowChecklist', show.id)} />;
  }
  return (
    <Subsection
      id={`ss-${show.id}-checklist`}
      title={title}
      addLabel="Add"
      onAdd={() => call('sheetShowChecklist', show.id)}
      defaultOpen={false}
      className="is-priority"
    >
      <div className="card flush">
        {list.map((item: any) => (
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
    </Subsection>
  );
}

export function Notes({ show }: Record<string, any>){
  const editorRef = useRef<any>(null);
  const has = !!(typeof call === 'function' && call('noteItemsHas', show.notes));
  if(!has){
    return (
      <CompactAddRow
        label="Internal notes"
        onAdd={() => call('sheetEvent', show.id)}
      />
    );
  }
  return (
    <Subsection
      id={`ss-${show.id}-notes`}
      title="Internal notes"
      addLabel="Add"
      onAdd={() => editorRef.current && editorRef.current.add()}
      defaultOpen={false}
    >
      <NoteItemsEditor
        ref={editorRef}
        listId={`show-notes-${show.id}`}
        value={show.notes}
        placeholder="Anything to remember about this show…"
        onCommit={(items: any) => call('saveEventNotes', show.id, items)}
      />
    </Subsection>
  );
}

export function ContentBlock({ show }: Record<string, any>){
  const store = getStore();
  const linked = (store?.ideas || []).filter((x: any) => x.eventId === show.id);
  const types = getIdeaTypes() || {};
  const has = !!(show.content || linked.length);

  if(!has){
    return <CompactAddRow label="Content" onAdd={() => call('attachIdeaPickForEvent', show.id)} />;
  }
  return (
    <Subsection
      id={`ss-${show.id}-content`}
      title="Content to capture"
      addLabel="Add idea"
      onAdd={() => call('attachIdeaPickForEvent', show.id)}
      defaultOpen={false}
    >
      {show.content ? (
        <div className="card show-brief" style={{ background: 'linear-gradient(150deg,var(--accent-soft),var(--card))', margin: 10 }}>
          <div className="show-brief-k"><Icon name="camera" size={14} /> Brief</div>
          <div className="show-brief-v">{show.content}</div>
        </div>
      ) : null}
      {linked.length ? (
        <div className="card flush">
          {linked.map((i: any) => {
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
    </Subsection>
  );
}

function AttachmentsBody({ show }: Record<string, any>){
  const list = show.attachments || [];
  const originals = list.filter((a: any) => a && a.fromItinerary);
  const openFile = (a: any) => call('openShowAttachment', show.id, a.id);
  return (
    <>
      {originals.map((a: any) => (
        <button type="button" className="show-compact-row" key={`itin-${a.id}`} onClick={() => openFile(a)}>
          <span>Original itinerary</span>
          <span className="add">{a.name || 'View'}</span>
        </button>
      ))}
      <div className="thumb-row">
        {list.map((a: any) => (
          <div
            key={a.id}
            className="thumb"
            onClick={() => openFile(a)}
          >
            {a.kind === 'image' ? (
              <img src={a.data} alt={a.name || 'Attachment'} />
            ) : (
              <div className="pdf">
                <Icon name="file" size={26} />
                <span>{a.fromItinerary ? (a.name || 'Itinerary') : (a.name || 'File')}</span>
              </div>
            )}
            {a.fromItinerary ? <span className="thumb-tag">Itinerary</span> : null}
            <div
              className="del-badge"
              onClick={(e: any) => { e.stopPropagation(); call('delAttachment', show.id, a.id); }}
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
            onChange={(e: any) => call('uploadAttachment', show.id, e.target)}
          />
        </label>
      </div>
    </>
  );
}

export function Attachments({ show, standalone }: Record<string, any>){
  const list = show.attachments || [];
  if(!list.length){
    return (
      <label className="show-compact-row">
        <span>Attachments</span>
        <span className="add">Add</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(e: any) => call('uploadAttachment', show.id, e.target)}
        />
      </label>
    );
  }
  if(standalone) return <AttachmentsBody show={show} />;
  return (
    <Subsection id={`ss-${show.id}-attachments`} title="Attachments" defaultOpen={false}>
      <AttachmentsBody show={show} />
    </Subsection>
  );
}
