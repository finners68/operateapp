import { useSyncExternalStore } from 'react';
import { getStore, subscribeStore, call, g } from '../show/bridge.js';
import { Icon } from '../show/ui.jsx';
import { TripDashboard } from './TripModePage.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function MissingTrip(){
  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Back
          </button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Tour</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="empty" style={{ marginTop: 24 }}>
          <div className="ic"><Icon name="trips" size={28} /></div>
          <b>Tour not found</b>
          <span>It may have been removed or the link is out of date.</span>
          <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('back')}>
            Go back
          </button>
        </div>
      </div>
    </>
  );
}

export default function TripDetailPage({ tripId }){
  useStoreTick();
  const run = (call('runs') || []).find(r => r.key === tripId) || call('runOf', tripId);
  if(!run) return <MissingTrip />;

  const active = call('activeRun')?.key === run.key;

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Tours
          </button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{active ? 'Trip Mode' : 'Tour'}</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <TripDashboard run={run} />
      </div>
    </>
  );
}
