import { useSyncExternalStore } from 'react';
import { getStore, subscribeStore, call, g } from '../show/bridge.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

export default function PastShowsPage(){
  useStoreTick();
  const store = getStore();
  const cats = g('CATS') || {};
  const past = (store?.events || [])
    .filter(e => !!call('showPassed', e))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const backLabel = call('overlayBackLabel') || 'Back';
  const esc = g('esc') || (s => String(s ?? ''));
  const relDay = g('relDay') || (() => '');

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> {backLabel}
          </button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Past shows</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="hint" style={{ textAlign: 'left', padding: '12px 2px 6px' }}>
          {past.length} show{past.length !== 1 ? 's' : ''} that have wrapped. They move here automatically 24h after the set finishes.
        </div>
        {past.length ? (
          <div className="card flush">
            {past.map(e => {
              const color = cats[e.color] || cats.purple || 'var(--accent)';
              return (
                <div key={e.id} className="row" onClick={() => call('openView', 'event', e.id)}>
                  <div className="ic" style={{ background: `${color}22`, color }}>
                    <Icon name="music" size={18} />
                  </div>
                  <div className="body">
                    <b>{esc(e.venue || 'Untitled show')}</b>
                    <span>
                      {esc(e.city)}{e.country ? `, ${esc(e.country)}` : ''} · {e.setTime ? esc(e.setTime) : '—'}
                    </span>
                  </div>
                  <div className="trail">
                    <span className="dot" style={{ width: 0 }} />
                    <span style={{ fontSize: 12 }}>{esc(relDay(e.date))}</span>
                    <Icon name="chevR" size={15} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 12 }}>
            <div className="ic"><Icon name="calendar" size={26} /></div>
            <b>No past shows yet</b>
            <span>Shows land here 24h after they finish.</span>
          </div>
        )}
        <div className="spacer" />
      </div>
    </>
  );
}
