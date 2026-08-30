import { useSyncExternalStore } from 'react';
import { call, esc, getStore, pad, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function StatTile({ label, value, sub, color }){
  return (
    <div className="card" style={{ padding: '15px 16px' }}>
      <div style={{
        fontSize: 12,
        color: color || 'var(--text-3)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.04em',
      }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 850, letterSpacing: '-0.02em', marginTop: 4 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
}

export default function StatsPage(){
  useStoreTick();
  const st = call('computeStats') || {};
  const y = st.year || {};
  const EARTH = 40075;
  const kmVal = y.km > 0 ? `${y.km.toLocaleString()} km` : '—';
  const kmSub = y.km >= EARTH
    ? `≈ ${(y.km / EARTH).toFixed(1)}× around the world`
    : y.km > 0
      ? `≈ ${Math.max(1, Math.round(y.km / EARTH * 100))}% around the world`
      : 'add flights to see';
  const stageVal = y.stageHrs > 0 ? `${y.stageHrs}h` : '—';

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Settings
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Tour stats</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="hero" style={{ background: 'linear-gradient(155deg,#241a45,#191531 55%,#141418)' }}>
          <div className="hero-label" style={{ color: 'var(--accent-2)' }}>
            <Icon name="trend" size={14} /> This schedule
          </div>
          <div className="hero-venue" style={{ fontSize: 34 }}>{st.shows || 0} shows</div>
          <div className="hero-city">
            {st.upcoming || 0} upcoming · {st.cities || 0} cities · {st.tours || 0} tours
          </div>
        </div>
        <div className="section">
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div className="section-title">Snapshot</div>
            <button type="button" className="section-link" onClick={() => call('openView', 'wrapped')}>
              Year in review <Icon name="chevR" size={13} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <StatTile label="Kilometres flown" value={kmVal} sub={kmSub} color="var(--blue)" />
            </div>
            <StatTile label="Hours played" value={stageVal} sub="behind the decks" color="var(--accent-2)" />
            <StatTile
              label="Flight time"
              value={`${st.flightHrs || 0}h`}
              sub={`approx · ~${st.flightDays || 0} days in the air`}
              color="var(--blue)"
            />
            <StatTile
              label="Days away"
              value={st.daysAway || 0}
              sub={`across ${st.tours || 0} tours`}
              color="var(--green)"
            />
            <StatTile
              label="Flights"
              value={st.flights || 0}
              sub={`${st.hotels || 0} hotel stays`}
              color="var(--accent-2)"
            />
            <StatTile label="Cities" value={st.cities || 0} sub="unique" color="var(--pink)" />
            <StatTile
              label="Busiest month"
              value={st.busiestN || '—'}
              sub={esc(st.busiest || '')}
              color="var(--orange)"
            />
          </div>
        </div>
        <div className="spacer" />
      </div>
    </>
  );
}
