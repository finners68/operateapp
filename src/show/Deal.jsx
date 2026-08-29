import { call, g, getStore } from './bridge.js';
import { Icon } from './ui.jsx';

export default function DealGroup({ show }){
  const fin = show.finance || {};
  if(fin.notDisclosed){
    return (
      <div className="card tap deal-card" style={{ padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => call('sheetFinance', show.id)}>
        <div className="deal-card-ic"><Icon name="coins" size={17} /></div>
        <div className="deal-card-body">
          <span className="deal-card-k">Deal</span>
          <span className="deal-card-v">Not disclosed</span>
        </div>
        <Icon name="chevR" size={15} />
      </div>
    );
  }

  const money = g('money');
  const c = money && money.eventCalc ? money.eventCalc(show) : { gross: 0, cur: 'EUR', paid: false, net: 0 };
  const store = getStore();
  const base = store?.settings?.baseCurrency;
  const showBase = c.cur && base && c.cur !== base;
  const fmtMoney = g('fmtMoney');
  const fmtBase = g('fmtBase');

  if(!c.gross){
    return (
      <div className="card tap" style={{ textAlign: 'center', color: 'var(--text-3)', padding: 16 }} onClick={() => call('sheetFinance', show.id)}>
        <Icon name="money" size={22} />
        <div style={{ marginTop: 6, fontWeight: 600 }}>Add the deal / fee</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="deal-head">
        <div>
          <div className="deal-k">{(fin.dealType || 'Fee')}{fin.estimated ? ' · est.' : ''}</div>
          <div className="deal-amount">{fmtMoney ? fmtMoney(c.gross, c.cur) : c.gross}</div>
          {showBase && fmtBase ? <div className="deal-meta">≈ {fmtBase(c.grossBase)}</div> : null}
        </div>
        <div className="deal-head-actions">
          <span className={`tag ${c.paid ? 'confirmed' : 'hold'}`}>{c.paid ? 'Paid' : 'Unpaid'}</span>
          <button
            type="button"
            className="header-btn"
            style={{ width: 38, height: 38, ...(c.paid ? { background: 'var(--green-soft)', color: 'var(--green)' } : {}) }}
            onClick={() => call('togglePaid', show.id)}
          >
            <Icon name="check2" size={19} />
          </button>
        </div>
      </div>
      <div className="divi" style={{ margin: '13px 0' }} />
      <div className="deal-rows">
        <div className="deal-row">
          <span className="deal-row-k">Fee</span>
          <span className="deal-row-v">{fmtMoney ? fmtMoney(c.gross, c.cur) : c.gross}</span>
        </div>
        {c.commissionAmt ? (
          <div className="deal-row">
            <span className="deal-row-k">Agent commission ({fin.commission}%)</span>
            <span className="deal-row-v neg">− {fmtMoney ? fmtMoney(c.commissionAmt, c.cur) : c.commissionAmt}</span>
          </div>
        ) : null}
        {c.expenses ? (
          <div className="deal-row">
            <span className="deal-row-k">Expenses</span>
            <span className="deal-row-v neg">− {fmtMoney ? fmtMoney(c.expenses, c.cur) : c.expenses}</span>
          </div>
        ) : null}
        {c.perDiem ? (
          <div className="deal-row">
            <span className="deal-row-k">Per diem</span>
            <span className="deal-row-v pos">+ {fmtMoney ? fmtMoney(c.perDiem, c.cur) : c.perDiem}</span>
          </div>
        ) : null}
        <div className="divi" style={{ margin: '4px 0' }} />
        <div className="deal-row deal-row-total">
          <span className="deal-row-k">Net take-home</span>
          <span className="deal-row-v">{fmtMoney ? fmtMoney(c.net, c.cur) : c.net}</span>
        </div>
        {showBase && fmtBase ? (
          <div className="deal-row">
            <span className="deal-row-k" />
            <span className="deal-meta">≈ {fmtBase(c.netBase)}</span>
          </div>
        ) : null}
      </div>
      {(fin.expenses || []).length ? (
        <div className="deal-expenses">
          {fin.expenses.map(x => (
            <div key={x.id} className="deal-row">
              <span className="deal-row-k">{x.label || 'Expense'}</span>
              <span className="deal-row-v">
                {fmtMoney ? fmtMoney(x.amount, c.cur) : x.amount}{' '}
                <button type="button" className="del" style={{ opacity: 0.6, padding: '0 4px' }} onClick={() => call('delExpense', show.id, x.id)}>
                  <Icon name="x" size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn secondary" style={{ padding: 11 }} onClick={() => call('sheetFinance', show.id)}>
          <Icon name="edit" size={15} /> Edit deal
        </button>
        <button type="button" className="btn secondary" style={{ padding: 11 }} onClick={() => call('createInvoiceFromEvent', show.id)}>
          <Icon name="receipt" size={15} /> Invoice
        </button>
      </div>
    </div>
  );
}
