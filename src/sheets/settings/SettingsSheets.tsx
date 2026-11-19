import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../show/ui.jsx';
import { call, getAccountTypes, getCursym, getStore, fmtMoney } from '../../api/operate.js';

const Spacer=()=> <div className="spacer"/>;
const Field=({label,id,value='',placeholder,type='text',children,...rest}: Record<string, any>)=><div className="field"><label>{label}</label>{children||<input id={id} type={type} className="input" defaultValue={value||''} placeholder={placeholder} {...rest}/>}</div>;

export function SettingsAccountTypeSheet(){
  const current = getStore()?.settings?.accountType;
  const types = getAccountTypes() || {};
  const entries = Object.keys(types).length ? types : (typeof window !== 'undefined' && window.ACCOUNT_TYPES) || {};
  return (
    <>
      <div className="acct-grid">
        {Object.entries(entries).map(([k, v]: any) => (
          <button key={k} type="button" className={`acct ${current === k ? 'on' : ''}`} onClick={() => call('pickAccountType', k)}>
            <div className="ic"><Icon name={v.icon} size={20} /></div>
            <b>{v.label}</b>
            <span>{v.desc}</span>
          </button>
        ))}
      </div>
      <Spacer />
    </>
  );
}

export function SettingsHomeAirportSheet({value}: Record<string, any>){
  const start = String(value || getStore()?.settings?.homeAirport || 'AMS').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const [code, setCode] = useState(start);
  useEffect(() => {
    const t = setTimeout(() => document.getElementById('ha-code')?.focus(), 300);
    return () => clearTimeout(t);
  }, []);
  const name = code.length === 3 ? (call('airportName', code) || '') : '';
  const known = !!name;
  const save = () => {
    if(!known) return;
    const s = getStore()?.settings;
    if(!s) return;
    s.homeAirport = code;
    if(s.baseCurrencyAuto !== false) s.baseCurrency = call('homeCurrency');
    call('persist', 'settings');
    call('closeSheet');
    call('renderView');
    call('toast', name, 'check');
  };
  return (
    <>
      <div className="field">
        <label>Airport code (IATA)</label>
        <input
          id="ha-code"
          className="input"
          value={code}
          placeholder="AMS"
          maxLength={3}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          style={{ textTransform: 'uppercase' }}
          onChange={(e: any) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
        />
      </div>
      <div
        className="hint"
        style={{
          textAlign: 'left',
          padding: '8px 2px 4px',
          fontWeight: 400,
          color: known ? 'var(--text)' : (code.length === 3 ? 'var(--red)' : 'var(--text-3)')
        }}
      >
        {known ? name : (code.length === 3 ? 'That isn’t a known airport code.' : 'Enter the 3-letter code. The airport name shows here so you can check it.')}
      </div>
      <div className="hint" style={{ textAlign: 'left', padding: '2px 2px 12px' }}>A tour ends whenever a flight brings you back here. Change this and tours regroup automatically.</div>
      <button type="button" className="btn" disabled={!known} onClick={save}>Save</button>
      <Spacer />
    </>
  );
}

export function SettingsProfileNameSheet({value}: Record<string, any>){
  const s=getStore()?.settings||{}, current=value??(s.artistName==='You'?'':s.artistName||'');
  useEffect(()=>{const t=setTimeout(()=>document.getElementById('pf-name')?.focus(),300);return()=>clearTimeout(t)},[]);
  return <><Field label="Name / act" id="pf-name" value={current} placeholder="Your DJ / act name"/><button className="btn" onClick={()=>{s.artistName=(document.getElementById('pf-name') as HTMLInputElement | null)?.value.trim()||'You';call('persist','settings');call('closeSheet');call('renderView');call('toast','Saved','check')}}>Save</button><Spacer/></>;
}

export function SettingsCurrencySheet(){
  const store = getStore();
  const s = store?.settings || {};
  useEffect(() => { call('ensureCurrencySettings'); }, []);
  const cursym = getCursym() || {};
  const [version, setVersion] = useState(0);
  const [showConverter, setShowConverter] = useState(false);
  const [convAmt, setConvAmt] = useState('100');
  const [convFrom, setConvFrom] = useState(s.baseCurrency || 'GBP');
  const [convTo, setConvTo] = useState((s.baseCurrency === 'GBP' ? 'EUR' : 'GBP'));
  const currencies = useMemo(
    () => (call('currencyCodes') || Object.keys(s.fx || {})).slice().sort(),
    [s.fx, s.baseCurrency, version]
  );
  const extras = call('pickableExtraCurrencies') || [];

  const labelFor = (code: any) => {
    const sym = cursym[code];
    return sym ? `${code} (${sym.trim()})` : code;
  };

  const onRemove = (code: any) => {
    const r = call('removeAppCurrency', code);
    if(r && r.ok){
      call('toast', code + ' removed', 'check');
      setVersion((v: any) => v + 1);
    } else if(r && r.error) call('toast', r.error, 'x');
  };

  const converted = useMemo(() => {
    const n = parseFloat(convAmt);
    if(!Number.isFinite(n)) return null;
    return call('convertCurrency', n, convFrom, convTo);
  }, [convAmt, convFrom, convTo, version, s.fxUpdatedAt]);

  return (
    <>
      <Field label="Base currency">
        <select id="set-base" className="input" defaultValue={s.baseCurrency} key={`base-${version}`}>
          {currencies.map((c: any) => <option value={c} key={c}>{labelFor(c)}</option>)}
        </select>
        <div className="hint" style={{ textAlign: 'left', padding: '6px 2px' }}>
          Totals and finance roll up in this currency. GBP and EUR are always available.
        </div>
      </Field>

      <div className="field">
        <label>Exchange rates</label>
        <div className="hint" style={{ textAlign: 'left', padding: '0 2px 8px', lineHeight: 1.45 }}>
          How much one unit of each currency is worth in your base currency ({s.baseCurrency}).
        </div>
        <div id="set-rates">
          {currencies.filter((c: any) => c !== s.baseCurrency).map((c: any) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 88, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{labelFor(c)}</span>
              <input className="input" data-cur={c} type="number" step="0.0001" inputMode="decimal" defaultValue={s.fx?.[c]} key={`rate-${c}-${version}`} style={{ flex: 1, padding: '9px 12px' }} />
              {!['GBP', 'EUR'].includes(c) ? (
                <button type="button" className="header-btn" title={`Remove ${c}`} aria-label={`Remove ${c}`} onClick={() => onRemove(c)}>
                  <Icon name="x" size={16} />
                </button>
              ) : <span style={{ width: 34 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 4 }}>
        {extras.length ? (
          <button type="button" className="link-btn" style={{ padding: '4px 0 8px', display: 'block' }} onClick={() => call('sheetCurrencyAdd')}>
            <Icon name="plus" size={13} /> Add currency
          </button>
        ) : null}
        <button type="button" className="link-btn" style={{ padding: extras.length ? '4px 0 12px' : '4px 0 12px', display: 'block' }} onClick={() => setShowConverter((v: any) => !v)}>
          {showConverter ? 'Hide converter' : 'Quick converter'}
        </button>
      </div>

      {showConverter ? (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="row-2">
            <Field label="Amount" id="set-conv-amt">
              <input id="set-conv-amt-inp" className="input" type="number" inputMode="decimal" value={convAmt} onChange={(e: any) => setConvAmt(e.target.value)} />
            </Field>
          </div>
          <div className="row-2">
            <Field label="From">
              <select className="input" value={convFrom} onChange={(e: any) => setConvFrom(e.target.value)}>
                {currencies.map((c: any) => <option value={c} key={c}>{labelFor(c)}</option>)}
              </select>
            </Field>
            <Field label="To">
              <select className="input" value={convTo} onChange={(e: any) => setConvTo(e.target.value)}>
                {currencies.map((c: any) => <option value={c} key={c}>{labelFor(c)}</option>)}
              </select>
            </Field>
          </div>
          {converted != null && Number.isFinite(converted) ? (
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>
              ≈ {typeof fmtMoney === 'function' ? fmtMoney(converted, convTo) : `${converted} ${convTo}`}
            </div>
          ) : null}
          <div className="hint" style={{ textAlign: 'left', padding: '8px 0 0', fontSize: 12 }}>
            Uses your saved rates. For quotes only — fees on shows use the same rates.
          </div>
        </div>
      ) : null}

      <button className="btn" id="set-save" onClick={() => call('saveCurrency')}>Save</button>
      <Spacer />
    </>
  );
}

export function SettingsCurrencyAddSheet(){
  const cursym = getCursym() || {};
  const extras = (call('pickableExtraCurrencies') || []).slice();

  const labelFor = (code: any) => {
    const sym = cursym[code];
    return sym ? `${code} (${sym.trim()})` : code;
  };

  const pick = (code: any) => {
    const r = call('addAppCurrency', code);
    if(r && r.ok){
      call('toast', code + ' added', 'check');
      call('notifyStore');
      call('closeSheet');
    } else if(r && r.error) call('toast', r.error, 'x');
  };

  if(!extras.length){
    return (
      <>
        <div className="hint" style={{ textAlign: 'left', padding: '2px 2px 16px', lineHeight: 1.5 }}>
          All preset currencies are already on your list.
        </div>
        <button type="button" className="btn secondary" onClick={() => call('closeSheet')}>Back</button>
        <Spacer />
      </>
    );
  }

  return (
    <>
      <div className="hint" style={{ textAlign: 'left', padding: '2px 2px 12px', lineHeight: 1.5 }}>
        Tap a currency to add it. You can edit its rate on the previous screen.
      </div>
      <div className="card flush">
        {extras.map((c: any) => (
          <div className="row" key={c} role="button" tabIndex={0} onClick={() => pick(c)}>
            <div className="ic" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}>
              <Icon name="globe" size={17} />
            </div>
            <div className="body">
              <b>{labelFor(c)}</b>
            </div>
            <Icon name="plus" size={15} />
          </div>
        ))}
      </div>
      <Spacer />
      <button type="button" className="btn secondary" onClick={() => call('closeSheet')}>Cancel</button>
      <Spacer />
    </>
  );
}

function clampHeaderPct(n: any){
  const v = Number(n);
  if(!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}

function measureHomeHeaderBand(){
  if(typeof document === 'undefined') return { w: 215, h: 100 };
  const view = document.getElementById('view');
  const width = Math.max(1, view ? view.getBoundingClientRect().width : window.innerWidth);
  const probe = document.createElement('div');
  probe.className = 'home-hero';
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;margin:0;width:' + width + 'px;';
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  const h = height > 1 ? height : Math.max(188, Math.min(240, width / 2.15));
  return { w: width, h };
}

export function SettingsHeaderFrameSheet({ src, x = 50, y = 50 }: Record<string, any>){
  const frameRef = useRef<any>(null);
  const dragRef = useRef<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [pos, setPos] = useState({ x: clampHeaderPct(x), y: clampHeaderPct(y) });
  const [band, setBand] = useState(measureHomeHeaderBand);

  useLayoutEffect(() => {
    const read = () => setBand(measureHomeHeaderBand());
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  useEffect(() => {
    if(!src) return undefined;
    const img = new Image();
    img.onload = () => setMetrics({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
    return () => { img.onload = null; };
  }, [src]);

  const onPointerDown = (e: any) => {
    if(e.button != null && e.button !== 0) return;
    const frame = frameRef.current?.getBoundingClientRect();
    if(!frame) return;
    dragRef.current = {
      px: e.clientX,
      py: e.clientY,
      x: pos.x,
      y: pos.y,
      frameW: frame.width,
      frameH: frame.height
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: any) => {
    const drag = dragRef.current;
    if(!drag) return;
    const dx = e.clientX - drag.px;
    const dy = e.clientY - drag.py;
    if(metrics && metrics.w && metrics.h){
      const scale = Math.max(drag.frameW / metrics.w, drag.frameH / metrics.h);
      const spanX = drag.frameW - metrics.w * scale;
      const spanY = drag.frameH - metrics.h * scale;
      const nextX = Math.abs(spanX) < 1 ? drag.x : clampHeaderPct(((spanX * drag.x / 100) + dx) / spanX * 100);
      const nextY = Math.abs(spanY) < 1 ? drag.y : clampHeaderPct(((spanY * drag.y / 100) + dy) / spanY * 100);
      setPos({ x: nextX, y: nextY });
      return;
    }
    setPos({
      x: clampHeaderPct(drag.x - dx / Math.max(1, drag.frameW) * 100),
      y: clampHeaderPct(drag.y - dy / Math.max(1, drag.frameH) * 100)
    });
  };
  const endDrag = () => { dragRef.current = null; };

  return (
    <>
      <p className="sheet-lede">Drag the photo. The frame matches the band on Home, so what you see here is what will show.</p>
      <div
        ref={frameRef}
        className="header-frame"
        style={{
          aspectRatio: `${band.w} / ${band.h}`,
          ...(src ? {
            backgroundImage: `url("${String(src).replace(/"/g, '')}")`,
            backgroundPosition: `${pos.x}% ${pos.y}%`
          } : null)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="hint" style={{ textAlign: 'left', padding: '8px 2px 14px' }}>Drag up, down, or sideways until the part you want is in the frame.</div>
      <button type="button" className="btn" onClick={() => call('saveHomeHeaderFrame', pos.x, pos.y)}>Use this view</button>
      <Spacer />
    </>
  );
}

export function SettingsPackingSheet({items}: Record<string, any>){
  const start = (items || getStore()?.settings?.packingTemplate || []).map((label: any, i: any) => ({
    id: 'p' + i,
    text: String(label || '')
  }));
  const [rows, setRows] = useState(start.length ? start : [{ id: 'p0', text: '' }]);
  const nextId = useRef(start.length);
  const add = () => {
    const id = 'p' + (nextId.current++);
    setRows((list: any) => [...list, { id, text: '' }]);
    setTimeout(() => document.getElementById('pack-' + id)?.focus(), 40);
  };
  const save = () => {
    const s = getStore()?.settings;
    if(!s) return;
    s.packingTemplate = rows.map((r: any) => r.text.trim()).filter(Boolean);
    call('persist', 'settings');
    call('closeSheet');
    call('renderView');
    call('toast', 'Saved', 'check');
  };
  return (
    <>
      <div className="hint" style={{ textAlign: 'left', padding: '2px 2px 12px' }}>Added to every new trip.</div>
      <div className="pack-rows">
        {rows.map((row: any, i: any) => (
          <div className="pack-row" key={row.id}>
            <input
              id={'pack-' + row.id}
              className="input"
              value={row.text}
              placeholder={i === 0 ? 'e.g. Passport' : 'Another item'}
              onChange={(e: any) => setRows((list: any) => list.map((r: any) => r.id === row.id ? { ...r, text: e.target.value } : r))}
              onKeyDown={(e: any) => {
                if(e.key === 'Enter'){
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" className="pack-remove" aria-label="Remove item" onClick={() => setRows((list: any) => {
              const next = list.filter((r: any) => r.id !== row.id);
              return next.length ? next : [{ id: 'p' + (nextId.current++), text: '' }];
            })}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="link-btn" style={{ padding: '10px 0 16px' }} onClick={add}>
        <Icon name="plus" size={13} /> Add another item
      </button>
      <button type="button" className="btn" onClick={save}>Save list</button>
      <Spacer />
    </>
  );
}

export function AuthInviteSheet(){
  return <><Field label="Email" id="inv-email" type="email" placeholder="crew@example.com" autoComplete="email"/><Field label="Role"><div className="seg" id="inv-role"><button data-v="crew" className="on" onClick={(e: any)=>call('segPick',e.currentTarget)}>Crew</button><button data-v="manager" onClick={(e: any)=>call('segPick',e.currentTarget)}>Manager</button></div></Field><div className="hint" style={{textAlign:'left',padding:'2px 2px 10px',lineHeight:1.5}}>Crew can update day-of details. Managers can edit everything.</div><button className="btn" id="inv-make" onClick={()=>call('doCreateInvite')}>Create invite link</button><div id="inv-out" style={{marginTop:12}}/><Spacer/></>;
}

export function AuthAccountSheet({mode,email,statusLabel,message,singleAccount=false,allowedEmail='',orgName='',orgId='',orgs=[]}: Record<string, any>) {
  if(mode==='unconfigured'||mode==='disabled') return <><div className="hint" style={{textAlign:'left',padding:'2px 2px 16px',lineHeight:1.5}}>{message|| (mode==='unconfigured'?'Cloud sync is not configured. Add your Supabase credentials to enable it.':'Cloud sync is not enabled yet. Your tour data stays on this device.')}</div><Spacer/></>;
  const orgOptions = Array.isArray(orgs) ? orgs : [];
  if(mode==='orgSwitch' || mode==='dev'){
    return <>
      <div className="card" style={{padding:15,marginBottom:6,textAlign:'center'}}>
        <div style={{fontSize:12,color:'var(--text)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>Organisation</div>
        <div style={{fontSize:16,fontWeight:400,marginTop:4}}>{orgName || 'Choose workspace'}</div>
        <div id="sync-status" style={{fontSize:13,color:'var(--text-2)',marginTop:4}}>{statusLabel||call('syncStatusLabel')}</div>
      </div>
      <Field label="Switch organisation">
        <select
          id="acct-org"
          className="input"
          key={orgId || 'org'}
          defaultValue={orgId || orgOptions[0]?.id || ''}
          onChange={(e: any) => call('switchOrganisation', e.target.value)}
        >
          {orgOptions.map((o: any) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </Field>
      <div className="hint" style={{textAlign:'left',padding:'8px 2px 14px',lineHeight:1.5}}>
        JAKE and FIN are always available. Pick one to view and edit that workspace — no sign-in needed.
      </div>
      <button className="btn secondary" onClick={()=>call('refreshFromCloud')}><Icon name="refresh" size={16}/> Refresh now</button>
      <Spacer/>
    </>;
  }
  if(mode==='signin') return <><div className="hint" style={{textAlign:'left',padding:'2px 2px 14px',lineHeight:1.5}}>{message||'Sign in to load and save tour data.'}</div><Field label="Email" id="auth-email" type="email" value={allowedEmail} placeholder="you@example.com" autoComplete="email" readOnly={!!allowedEmail}/><p id="auth-msg" className="auth-msg"/><button className="btn" id="auth-send" onClick={()=>call('sendMagicLink')}>Send magic link</button><Spacer/></>;
  return <>
    <div className="card" style={{padding:15,marginBottom:6,textAlign:'center'}}>
      <div style={{fontSize:12,color:'var(--text)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>Signed in as</div>
      <div style={{fontSize:16,fontWeight:400,marginTop:4}}>{email||'Not signed in'}</div>
      <div id="sync-status" style={{fontSize:13,color:'var(--text-2)',marginTop:4}}>{statusLabel||call('syncStatusLabel')}</div>
    </div>
    {orgOptions.length ? (
      <Field label="Organisation">
        <select
          id="acct-org"
          className="input"
          key={orgId || 'org'}
          defaultValue={orgId || orgOptions[0]?.id || ''}
          onChange={(e: any) => call('switchOrganisation', e.target.value)}
        >
          {orgOptions.map((o: any) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </Field>
    ) : orgName ? (
      <div className="hint" style={{textAlign:'left',padding:'2px 2px 10px'}}>Organisation · {orgName}</div>
    ) : null}
    <div className="hint" style={{textAlign:'left',padding:'8px 2px 14px',lineHeight:1.5}}>
      {orgOptions.length > 1
        ? 'Pick an organisation above to switch workspaces.'
        : 'Your tour data syncs across signed-in devices for this organisation only.'}
    </div>
    {!singleAccount ? <button className="btn secondary" onClick={()=>call('sheetInviteCrew')}><Icon name="users" size={16}/> Invite crew</button> : null}
    <button className="btn secondary" style={{marginTop:10}} onClick={()=>call('refreshFromCloud')}><Icon name="refresh" size={16}/> Refresh now</button>
    <button className="btn secondary" style={{marginTop:10}} onClick={()=>call('exportData')}><Icon name="file" size={16}/> Export my data</button>
    <button className="btn danger" style={{marginTop:10}} onClick={()=>call('signOut')}><Icon name="x" size={16}/> Sign out</button>
    <button className="btn danger" style={{marginTop:10}} onClick={()=>call('confirmDeleteCloudData')}><Icon name="trash" size={16}/> Delete all cloud data</button>
    <Spacer/>
  </>;
}
