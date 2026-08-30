import { useSyncExternalStore } from 'react';
import { call, esc, fmtDate, getEvent, getStore, showTitle, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function ItinCard({ it }){
  const show = it.showId ? getEvent(it.showId) : null;
  const pending = !!(it.scanFields && !it.showId);
  const when = (it.date ? fmtDate(it.date) : '') + (it.time ? ` · ${it.time}` : '');

  return (
    <div className="card" style={{ marginTop: 12, padding: 14 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}
        onClick={() => call('openItineraryEntry', it.id)}
      >
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 15.5 }}>{esc(it.source || 'Itinerary')}</b>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
            {pending ? 'Review show basics' : (when || 'No date set')}
            {show ? ` · ${esc(showTitle(show))}` : ''}
          </div>
          {pending ? (
            <div style={{ fontSize: 12.5, color: 'var(--accent-2)', marginTop: 4, fontWeight: 650 }}>
              Waiting for you to confirm & create the show
            </div>
          ) : null}
          {it.note ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 5, whiteSpace: 'pre-wrap' }}>
              {esc(it.note)}
            </div>
          ) : null}
        </div>
        <Icon name="chevR" size={15} />
      </div>
      {(it.imgs || []).length ? (
        <div className="thumb-row" style={{ marginTop: 11 }}>
          {(it.imgs || []).map((im, i) => (
            im.kind === 'image' ? (
              <div
                key={i}
                className="thumb"
                onClick={e => { e.stopPropagation(); call('openViewer', im.data); }}
              >
                <img src={im.data} alt="" />
              </div>
            ) : (
              <div key={i} className="thumb">
                <div className="pdf">
                  <Icon name="file" size={26} />
                  <span>{esc(im.name || 'PDF')}</span>
                </div>
              </div>
            )
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ItineraryPage(){
  useStoreTick();
  const store = getStore();
  const list = (store?.itineraries || [])
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0));

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Home
          </button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Itinerary inbox</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => call('sheetItineraryStart')}>
          <Icon name="plus" size={18} /> Submit itinerary
        </button>
        <div className="hint" style={{ textAlign: 'left', padding: '11px 2px 2px' }}>
          Choose <b>new show</b> or <b>existing show</b>, then upload. New-show uploads are sent straight to your Make webhook.
        </div>
        {list.length ? (
          list.map(it => <ItinCard key={it.id} it={it} />)
        ) : (
          <div className="empty" style={{ marginTop: 22 }}>
            <div className="ic"><Icon name="file" size={26} /></div>
            <b>Nothing submitted yet</b>
            <span>Upload your first itinerary screenshot.</span>
          </div>
        )}
        <div className="spacer" />
        <div className="spacer" />
      </div>
    </>
  );
}
