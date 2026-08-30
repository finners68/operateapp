import { useSyncExternalStore } from 'react';
import { call, fmtBase, fmtDate, fmtMoney, getStore, pad, parseDT, subscribeStore, toBase } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function MissingInvoice(){
  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Invoices
          </button>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="empty" style={{ marginTop: 24 }}>
          <div className="ic"><Icon name="receipt" size={28} /></div>
          <b>Invoice not found</b>
          <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('back')}>Go back</button>
        </div>
      </div>
    </>
  );
}

export default function InvoiceDetailPage({ invoiceId }){
  useStoreTick();
  const store = getStore();
  const inv = (store?.invoices || []).find(x => x.id === invoiceId);
  if(!inv) return <MissingInvoice />;

  const b = store?.settings?.billing || {};
  const total = call('invTotal', inv) || 0;
  const base = store?.settings?.baseCurrency;
  let due = '';
  const d = parseDT ? parseDT(inv.date) : null;
  if(d){
    d.setDate(d.getDate() + (inv.terms || 14));
    due = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const stCls = inv.status === 'paid' ? 'confirmed' : inv.status === 'sent' ? 'hold' : 'past';

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Invoices
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('shareInvoice', inv.id)}>
              <Icon name="share" size={17} />
            </button>
            <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('invoiceMenu', inv.id)}>
              <Icon name="edit" size={17} />
            </button>
          </div>
        </div>
      </div>
      <div className="screen-pad">
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-0.02em' }}>INVOICE</div>
              <div style={{ color: 'var(--text-3)', fontWeight: 700, marginTop: 2 }}>{inv.number}</div>
            </div>
            <span className={`tag ${stCls}`} style={{ fontSize: 12 }}>{inv.status}</span>
          </div>
          <div className="divi" />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em', marginBottom: 4 }}>From</div>
              <div style={{ fontWeight: 650, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                {b.name || store?.settings?.artistName || 'Your name'}
                {b.address ? `\n${b.address}` : ''}
                {b.taxId ? `\nVAT/Tax: ${b.taxId}` : ''}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em', marginBottom: 4 }}>Bill to</div>
              <div style={{ fontWeight: 650, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                {inv.client}{inv.clientAddr ? `\n${inv.clientAddr}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
            <span>Issued <b style={{ color: 'var(--text)' }}>{fmtDate ? fmtDate(inv.date) : inv.date}</b></span>
            <span>Due <b style={{ color: 'var(--text)' }}>{fmtDate ? fmtDate(due) : due}</b></span>
          </div>
          <div className="divi" />
          {(inv.lines || []).map((l, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--stroke)', fontSize: 14 }}>
              <span style={{ flex: 1, color: 'var(--text-2)' }}>{l.label}</span>
              <span style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>
                {fmtMoney ? fmtMoney(l.amount, inv.currency) : l.amount}{' '}
                <button type="button" className="del" style={{ opacity: 0.5, padding: '0 2px' }} onClick={() => call('delInvLine', inv.id, idx)}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            </div>
          ))}
          <button type="button" className="link-btn" style={{ padding: '8px 0' }} onClick={() => call('addInvLine', inv.id)}>
            <Icon name="plus" size={13} /> Add line
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTop: '2px solid var(--stroke-strong)' }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Total due</span>
            <span style={{ fontSize: 22, fontWeight: 850 }}>{fmtMoney ? fmtMoney(total, inv.currency) : total}</span>
          </div>
          {inv.currency !== base && toBase && fmtBase ? (
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>≈ {fmtBase(toBase(total, inv.currency))}</div>
          ) : null}
          {b.iban ? (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)' }}>Payment:</span> {b.iban}
            </div>
          ) : null}
        </div>

        <div className="section">
          <div className="seg" style={{ marginBottom: 12 }}>
            {['draft', 'sent', 'paid'].map(st => (
              <button key={st} type="button" className={inv.status === st ? 'on' : ''} onClick={() => call('setInvStatus', inv.id, st)}>
                {st[0].toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => call('shareInvoice', inv.id)}>
            <Icon name="share" size={17} /> Send / share invoice
          </button>
        </div>
        <div className="section">
          <button type="button" className="btn secondary" onClick={() => call('openBilling', inv.id)}>
            <Icon name="wallet2" size={16} /> Edit my billing details
          </button>
        </div>
        <div className="section">
          <button type="button" className="btn danger" onClick={() => call('confirmDeleteInvoice', inv.id)}>
            <Icon name="trash" size={16} /> Delete invoice
          </button>
        </div>
        <div className="spacer" />
      </div>
    </>
  );
}
