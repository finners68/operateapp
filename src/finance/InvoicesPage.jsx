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

function InvRow({ inv }){
  const fmtDate = g('fmtDate');
  const fmtMoney = g('fmtMoney');
  const total = call('invTotal', inv) || 0;
  const stCls = inv.status === 'paid' ? 'confirmed' : inv.status === 'sent' ? 'hold' : 'past';
  return (
    <div className="row" onClick={() => call('openView', 'invoice', inv.id)}>
      <div className="ic" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="receipt" size={17} /></div>
      <div className="body">
        <b>{inv.number}</b>
        <span>{inv.client} · {fmtDate ? fmtDate(inv.date) : inv.date}</span>
      </div>
      <div className="trail">
        <span className={`tag ${stCls}`}>{inv.status}</span>{' '}
        {fmtMoney ? fmtMoney(total, inv.currency) : total} <Icon name="chevR" size={15} />
      </div>
    </div>
  );
}

export default function InvoicesPage(){
  useStoreTick();
  const store = getStore();
  const list = (store?.invoices || []).slice().sort((a, b) => String(b.number || '').localeCompare(String(a.number || '')));
  const toBase = g('toBase');
  const fmtBase = g('fmtBase');
  const outstanding = list
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + (toBase ? toBase(call('invTotal', i) || 0, i.currency) : 0), 0);
  const nextNum = call('nextInvoiceNumber') || '';

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('openView', 'finance')}>
            <Icon name="chevL" size={20} /> Money
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Invoices</div>
          <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('pickEventForInvoice')}>
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>
      <div className="screen-pad">
        <div className="subtabs">
          <button type="button" onClick={() => call('openView', 'finance')}><Icon name="trend" size={15} /> Overview</button>
          <button type="button" className="on">
            <Icon name="receipt" size={15} /> Invoices{list.length ? ` (${list.length})` : ''}
          </button>
        </div>
        <div className="card" style={{ background: 'linear-gradient(150deg,rgba(10,132,255,0.12),var(--card))' }}>
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            <Icon name="receipt" size={13} /> Outstanding invoiced
          </div>
          <div style={{ fontSize: 28, fontWeight: 850, marginTop: 3 }}>{fmtBase ? fmtBase(outstanding) : outstanding}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>
            {list.length} invoice{list.length !== 1 ? 's' : ''} · next # {nextNum}
          </div>
        </div>
        <div className="section">
          {list.length ? (
            <div className="card flush">{list.map(inv => <InvRow key={inv.id} inv={inv} />)}</div>
          ) : (
            <div className="empty">
              <div className="ic"><Icon name="receipt" size={26} /></div>
              <b>No invoices yet</b>
              <span>Generate one from any show&apos;s deal in a tap — properly numbered, ready to send.</span>
            </div>
          )}
        </div>
        <div className="section">
          <button type="button" className="btn" onClick={() => call('pickEventForInvoice')}>
            <Icon name="plus" size={17} /> New invoice from a show
          </button>
        </div>
        <div className="hint">Sequential, uniquely-numbered and multi-currency.</div>
        <div className="spacer" />
      </div>
    </>
  );
}
