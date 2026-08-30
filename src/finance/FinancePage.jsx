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

export default function FinancePage(){
  useStoreTick();
  const store = getStore();
  const sel = g('sel');
  const all = sel?.events ? sel.events() : [];
  const money = g('money');
  const s = money?.summary ? money.summary(all) : {};
  const base = store?.settings?.baseCurrency || '';
  const upcoming = sel?.upcoming ? sel.upcoming() : [];
  const paidPct = s.netBase ? Math.round(s.collectedBase / s.netBase * 100) : 0;
  const secOn = !!call('secOn');
  const locked = secOn && store?.settings?.security?.scope !== 'off';
  const invCount = (store?.invoices || []).length;
  const backLabel = call('overlayBackLabel') || 'Back';
  const fmtBase = g('fmtBase');
  const fmtMoney = g('fmtMoney');
  const toBase = g('toBase');
  const relDay = g('relDay');
  const byCur = s.byCur || {};

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> {backLabel}
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            {locked ? <Icon name="lock" size={13} /> : null} Money
          </div>
          <button
            type="button"
            className="header-btn"
            style={{ width: 36, height: 36 }}
            onClick={() => secOn ? call('lockFinanceNow') : call('openView', 'settings')}
          >
            <Icon name={secOn ? 'lock' : 'settings'} size={secOn ? 17 : 18} />
          </button>
        </div>
      </div>
      <div className="screen-pad">
        <div className="subtabs">
          <button type="button" className="on"><Icon name="trend" size={15} /> Overview</button>
          <button type="button" onClick={() => call('openView', 'invoices')}>
            <Icon name="receipt" size={15} /> Invoices{invCount ? ` (${invCount})` : ''}
          </button>
        </div>

        <div className="hero" style={{ background: 'linear-gradient(155deg,#0e2f1c,#12241b 55%,#141418)' }}>
          <div className="hero-label" style={{ color: 'var(--green)' }}>
            <Icon name="coins" size={14} /> Net booked · {base}
          </div>
          <div className="hero-venue" style={{ fontSize: 38 }}>{fmtBase ? fmtBase(s.netBase) : s.netBase}</div>
          <div className="hero-city">{fmtBase ? fmtBase(s.grossBase) : s.grossBase} gross · after commission & costs</div>
          <div className="count-row">
            <div className="count">
              <div className="count-k"><Icon name="check2" size={12} /> Collected</div>
              <div className="count-v" style={{ fontSize: 18 }}>{fmtBase ? fmtBase(s.collectedBase) : s.collectedBase}</div>
            </div>
            <div className="count">
              <div className="count-k"><Icon name="clock" size={12} /> Outstanding</div>
              <div className="count-v" style={{ fontSize: 18 }}>{fmtBase ? fmtBase(s.outstandingBase) : s.outstandingBase}</div>
            </div>
            <div className="count">
              <div className="count-k"><Icon name="trend" size={12} /> Upcoming</div>
              <div className="count-v" style={{ fontSize: 18 }}>{fmtBase ? fmtBase(s.upcomingBase) : s.upcomingBase}</div>
            </div>
          </div>
          <div className="progress" style={{ marginTop: 14, background: 'rgba(0,0,0,0.3)' }}>
            <i style={{ width: `${paidPct}%`, background: 'var(--green)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, fontWeight: 600 }}>{paidPct}% of net collected</div>
        </div>

        <div className="section">
          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={() => call('openView', 'invoices')}>
              <Icon name="receipt" size={16} /> Invoices{invCount ? ` (${invCount})` : ''}
            </button>
            <button type="button" className="btn secondary" onClick={() => call('openView', 'contacts')}>
              <Icon name="users" size={16} /> Contacts
            </button>
          </div>
        </div>

        <div className="section">
          <div className="section-head"><div className="section-title">Breakdown</div></div>
          <div className="card flush">
            <div className="info-line"><div className="ic" style={{ color: 'var(--text-2)' }}><Icon name="coins" size={17} /></div><div className="tx"><div className="k">Gross fees</div><div className="v">{fmtBase ? fmtBase(s.grossBase) : s.grossBase}</div></div></div>
            <div className="info-line"><div className="ic" style={{ color: 'var(--red)' }}><Icon name="user" size={17} /></div><div className="tx"><div className="k">Agent commission</div><div className="v" style={{ color: 'var(--red)' }}>− {fmtBase ? fmtBase(s.commissionBase) : s.commissionBase}</div></div></div>
            <div className="info-line"><div className="ic" style={{ color: 'var(--red)' }}><Icon name="receipt" size={17} /></div><div className="tx"><div className="k">Expenses</div><div className="v" style={{ color: 'var(--red)' }}>− {fmtBase ? fmtBase(s.expensesBase) : s.expensesBase}</div></div></div>
            <div className="info-line"><div className="ic" style={{ color: 'var(--green)' }}><Icon name="wallet2" size={17} /></div><div className="tx"><div className="k">Net take-home</div><div className="v" style={{ color: 'var(--green)', fontWeight: 800 }}>{fmtBase ? fmtBase(s.netBase) : s.netBase}</div></div></div>
          </div>
        </div>

        {Object.keys(byCur).length > 1 ? (
          <div className="section">
            <div className="section-head"><div className="section-title">By currency</div></div>
            <div className="card flush">
              {Object.entries(byCur).map(([cur, amt]) => (
                <div className="info-line" key={cur}>
                  <div className="ic"><Icon name="globe" size={16} /></div>
                  <div className="tx">
                    <div className="k">{cur}{cur !== base && toBase && fmtBase ? ` · ≈ ${fmtBase(toBase(amt, cur))}` : ''}</div>
                    <div className="v">{fmtMoney ? fmtMoney(amt, cur) : amt}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="section">
          <div className="section-head"><div className="section-title">Per show</div></div>
          <div className="card flush">
            {upcoming.length ? upcoming.map(e => {
              const c = money?.eventCalc ? money.eventCalc(e) : { paid: false, net: 0, cur: base };
              return (
                <div key={e.id} className="row" onClick={() => call('openView', 'event', e.id)}>
                  <div className="ic" style={{ background: c.paid ? 'var(--green-soft)' : 'var(--orange-soft)', color: c.paid ? 'var(--green)' : 'var(--orange)' }}>
                    <Icon name="money" size={17} />
                  </div>
                  <div className="body">
                    <b>{e.venue}</b>
                    <span>{e.city} · {relDay ? relDay(e.date) : e.date} · {c.paid ? 'Paid' : 'Unpaid'}</span>
                  </div>
                  <div className="trail">{fmtMoney ? fmtMoney(c.net, c.cur) : c.net}<Icon name="chevR" size={15} /></div>
                </div>
              );
            }) : <div className="hint">No upcoming shows</div>}
          </div>
        </div>

        <div className="hint">Net = fee − agent commission − expenses + per diem. Converted at your editable {base} rates.</div>
        <div className="spacer" />
      </div>
    </>
  );
}
