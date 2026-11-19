import { useState } from 'react';
import { Icon } from '../../show/ui.jsx';

function metaFor(id: any){
  const m = typeof window !== 'undefined' && window.HOME_WIDGET_META ? window.HOME_WIDGET_META[id] : null;
  return m || { title: id, desc: '', essential: false };
}

export default function HomeWidgetsSheet(){
  const [layout, setLayout] = useState(() => {
    const fn = typeof window !== 'undefined' ? window.getHomeWidgetLayout : null;
    return typeof fn === 'function' ? fn().slice() : ['primary', 'tasks', 'upcoming', 'snapshot'];
  });

  const save = (next: any) => {
    const fn = typeof window !== 'undefined' ? window.setHomeWidgetLayout : null;
    if(typeof fn === 'function') fn(next);
    setLayout(next.slice());
  };

  const remove = (id: any) => save(layout.filter((x: any) => x !== id));
  const add = (id: any) => {
    if(layout.includes(id)) return;
    save([...layout, id]);
  };
  const move = (id: any, dir: any) => {
    const i = layout.indexOf(id);
    if(i < 0) return;
    const j = i + dir;
    if(j < 0 || j >= layout.length) return;
    const next = layout.slice();
    const [row] = next.splice(i, 1);
    next.splice(j, 0, row);
    save(next);
  };
  const reset = () => {
    const fn = typeof window !== 'undefined' ? window.resetHomeWidgetLayout : null;
    if(typeof fn === 'function') fn();
    const read = typeof window !== 'undefined' ? window.getHomeWidgetLayout : null;
    setLayout(typeof read === 'function' ? read().slice() : ['primary', 'tasks', 'upcoming', 'snapshot']);
  };

  const meta = (typeof window !== 'undefined' && window.HOME_WIDGET_META) || {};
  const available = Object.keys(meta).filter((id: any) => !layout.includes(id));

  return (
    <div className="sheet-stack">
      <p className="hint" style={{ textAlign: 'left', marginBottom: 14 }}>
        The photo banner at the top always stays. Pick widgets below it and set their order.
      </p>
      <div className="block-title" style={{ padding: '0 2px 8px' }}>On your home</div>
      {layout.map((id: any, i: any) => {
        const m = metaFor(id);
        return (
          <div key={id} className="row" style={{ marginBottom: 6 }}>
            <div className="body">
              <b>{m.title}</b>
              <span>{m.desc}</span>
            </div>
            <div className="home-widget-edit-act">
              <button type="button" className="header-btn" style={{ width: 34, height: 34 }} disabled={i === 0} onClick={() => move(id, -1)} title="Move up">
                <Icon name="chevUp" size={16} />
              </button>
              <button type="button" className="header-btn" style={{ width: 34, height: 34 }} disabled={i === layout.length - 1} onClick={() => move(id, 1)} title="Move down">
                <Icon name="chevDown" size={16} />
              </button>
              <button type="button" className="header-btn" style={{ width: 34, height: 34 }} onClick={() => remove(id)} title="Remove">
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        );
      })}
      {!layout.length ? (
        <div className="hint" style={{ padding: '8px 2px 12px' }}>No widgets — add some below.</div>
      ) : null}

      {available.length ? (
        <>
          <div className="block-title" style={{ padding: '16px 2px 8px', marginTop: 8 }}>Add widget</div>
          <div className="home-widget-add-grid">
            {available.map((id: any) => {
              const m = metaFor(id);
              return (
                <button key={id} type="button" className="chip" onClick={() => add(id)}>
                  <Icon name="plus" size={14} /> {m.title}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <button type="button" className="btn secondary" style={{ marginTop: 18 }} onClick={reset}>
        Reset to essentials
      </button>
    </div>
  );
}