import { call, g, getStore } from './bridge.js';
import { Subsection, EmptyTap, Icon } from './ui.jsx';

function openTimelineStep(show, s){
  if(!s.auto){
    call('toggleShowTimelineStep', show.id, s.id);
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
              <div key={s.id} className={`check ${s.done ? 'done' : ''}`} data-id={s.id}>
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
                  {s.auto ? <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>From show info</span> : null}
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
  const has = !!(show.notes && String(show.notes).trim());
  return (
    <Subsection id={`ss-${show.id}-notes`} title="Internal notes" defaultOpen={has}>
      <div className="card" style={{ margin: 10 }}>
        <textarea
          className="textarea"
          placeholder="Anything to remember about this show…"
          defaultValue={show.notes || ''}
          key={`${show.id}:${show.notes || ''}`}
          onBlur={e => call('saveEventNotes', show.id, e.target.value)}
        />
      </div>
    </Subsection>
  );
}

export function ContentBlock({ show }){
  const store = getStore();
  const linked = (store?.ideas || []).filter(x => x.eventId === show.id);
  const types = g('IDEA_TYPES') || {};
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
