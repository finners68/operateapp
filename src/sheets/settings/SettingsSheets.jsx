import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../show/ui.jsx';
import { call, getAccountTypes, getCursym, getStore } from '../../api/operate.js';

const Spacer=()=> <div className="spacer"/>;
const Field=({label,id,value='',placeholder,type='text',children,...rest})=><div className="field"><label>{label}</label>{children||<input id={id} type={type} className="input" defaultValue={value||''} placeholder={placeholder} {...rest}/>}</div>;

export function SettingsAccountTypeSheet(){
  const current = getStore()?.settings?.accountType;
  const types = getAccountTypes() || {};
  return (
    <>
      <div className="acct-grid">
        {Object.entries(types).map(([k, v]) => (
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
export function SettingsHomeAirportSheet({value}){
  const current=value||getStore()?.settings?.homeAirport||'AMS';
  useEffect(()=>{const t=setTimeout(()=>document.getElementById('ha-code')?.focus(),300);return()=>clearTimeout(t)},[]);
  return <><Field label="Airport code (IATA)" id="ha-code" value={current} placeholder="AMS" maxLength={4} style={{textTransform:'uppercase'}}/><div className="hint" style={{textAlign:'left',padding:'2px 2px 12px'}}>A tour ends whenever a flight brings you back here. Change this and tours regroup automatically.</div><button className="btn" onClick={()=>{const s=getStore()?.settings;if(!s)return;const v=document.getElementById('ha-code')?.value.trim()||'AMS';s.homeAirport=v.toUpperCase();if(s.baseCurrencyAuto!==false)s.baseCurrency=call('homeCurrency');call('persist','settings');call('closeSheet');call('renderView');call('toast','Home airport set','check')}}>Save</button><Spacer/></>;
}
export function SettingsProfileNameSheet({value}){
  const s=getStore()?.settings||{}, current=value??(s.artistName==='You'?'':s.artistName||'');
  useEffect(()=>{const t=setTimeout(()=>document.getElementById('pf-name')?.focus(),300);return()=>clearTimeout(t)},[]);
  return <><Field label="Name / act" id="pf-name" value={current} placeholder="Your DJ / act name"/><button className="btn" onClick={()=>{s.artistName=document.getElementById('pf-name')?.value.trim()||'You';call('persist','settings');call('closeSheet');call('renderView');call('toast','Saved','check')}}>Save</button><Spacer/></>;
}
export function SettingsCurrencySheet({settings}){
  const s=settings||getStore()?.settings||{}, currencies=Object.keys(s.fx||{});
  return <><Field label="Base currency"><select id="set-base" className="input" defaultValue={s.baseCurrency}>{currencies.map(c=><option value={c} key={c}>{c} {(getCursym()||{})[c]?`(${getCursym()[c]})`:''}</option>)}</select><div className="hint" style={{textAlign:'left',padding:'6px 2px'}}>All earnings roll up into this currency.</div></Field><div className="field"><label>Exchange rates (value of 1 unit in {s.baseCurrency})</label><div id="set-rates">{currencies.filter(c=>c!==s.baseCurrency).map(c=><div key={c} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}><span style={{width:52,fontWeight:500,color:'var(--text-2)'}}>{c}</span><input className="input" data-cur={c} type="number" step="0.0001" inputMode="decimal" defaultValue={s.fx[c]} style={{flex:1,padding:'9px 12px'}}/></div>)}</div></div><button className="btn" id="set-save" onClick={()=>call('saveCurrency')}>Save rates</button><Spacer/></>;
}
function clampHeaderPct(n){
  const v = Number(n);
  if(!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}
export function SettingsHeaderFrameSheet({ src, x = 50, y = 50 }){
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [metrics, setMetrics] = useState(null);
  const [pos, setPos] = useState({ x: clampHeaderPct(x), y: clampHeaderPct(y) });

  useEffect(() => {
    if(!src) return undefined;
    const img = new Image();
    img.onload = () => setMetrics({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
    return () => { img.onload = null; };
  }, [src]);

  const onPointerDown = (e) => {
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
  const onPointerMove = (e) => {
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
        style={src ? {
          backgroundImage: `url("${String(src).replace(/"/g, '')}")`,
          backgroundPosition: `${pos.x}% ${pos.y}%`
        } : undefined}
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
export function SettingsPackingSheet({items}){
  const list=items||getStore()?.settings?.packingTemplate||[];
  return <><div className="field"><label>One item per line</label><textarea id="set-pack" className="textarea" style={{minHeight:200}} defaultValue={list.join('\n')}/><div className="hint" style={{textAlign:'left',padding:'6px 2px'}}>Added to every new trip.</div></div><button className="btn" onClick={()=>{const s=getStore()?.settings;if(!s)return;s.packingTemplate=(document.getElementById('set-pack')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);call('persist','settings');call('closeSheet');call('renderView');call('toast','Saved','check')}}>Save list</button><Spacer/></>;
}

export function AuthInviteSheet(){
  return <><Field label="Email" id="inv-email" type="email" placeholder="crew@example.com" autoComplete="email"/><Field label="Role"><div className="seg" id="inv-role"><button data-v="crew" className="on" onClick={e=>call('segPick',e.currentTarget)}>Crew</button><button data-v="manager" onClick={e=>call('segPick',e.currentTarget)}>Manager</button></div></Field><div className="hint" style={{textAlign:'left',padding:'2px 2px 10px',lineHeight:1.5}}>Crew can update day-of details. Managers can edit everything.</div><button className="btn" id="inv-make" onClick={()=>call('doCreateInvite')}>Create invite link</button><div id="inv-out" style={{marginTop:12}}/><Spacer/></>;
}
export function AuthAccountSheet({mode,email,statusLabel,message,singleAccount=false,allowedEmail='',orgName='',orgId='',orgs=[]}) {
  if(mode==='unconfigured'||mode==='disabled') return <><div className="hint" style={{textAlign:'left',padding:'2px 2px 16px',lineHeight:1.5}}>{message|| (mode==='unconfigured'?'Cloud sync is not configured. Add your Supabase credentials to enable it.':'Cloud sync is not enabled yet. Your tour data stays on this device.')}</div><Spacer/></>;
  const orgOptions = Array.isArray(orgs) ? orgs : [];
  if(mode==='orgSwitch' || mode==='dev'){
    return <>
      <div className="card" style={{padding:15,marginBottom:6,textAlign:'center'}}>
        <div style={{fontSize:11.5,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.08em'}}>Organisation</div>
        <div style={{fontSize:16,fontWeight:600,marginTop:4}}>{orgName || 'Choose workspace'}</div>
        <div id="sync-status" style={{fontSize:13,color:'var(--text-2)',marginTop:4}}>{statusLabel||call('syncStatusLabel')}</div>
      </div>
      <Field label="Switch organisation">
        <select
          id="acct-org"
          className="input"
          key={orgId || 'org'}
          defaultValue={orgId || orgOptions[0]?.id || ''}
          onChange={e => call('switchOrganisation', e.target.value)}
        >
          {orgOptions.map(o => (
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
      <div style={{fontSize:11.5,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'.08em'}}>Signed in as</div>
      <div style={{fontSize:16,fontWeight:600,marginTop:4}}>{email||'Not signed in'}</div>
      <div id="sync-status" style={{fontSize:13,color:'var(--text-2)',marginTop:4}}>{statusLabel||call('syncStatusLabel')}</div>
    </div>
    {orgOptions.length ? (
      <Field label="Organisation">
        <select
          id="acct-org"
          className="input"
          key={orgId || 'org'}
          defaultValue={orgId || orgOptions[0]?.id || ''}
          onChange={e => call('switchOrganisation', e.target.value)}
        >
          {orgOptions.map(o => (
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
