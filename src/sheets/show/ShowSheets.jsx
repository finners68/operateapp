import { Icon } from '../../show/ui.jsx';
import { call, g, getEvent, getStore } from '../../show/bridge.js';

const Field = ({ label, id, value = '', placeholder, type = 'text', className = 'input', children, ...rest }) => (
  <div className="field">
    {label ? <label>{label}</label> : null}
    {children || <input id={id} type={type} className={className} defaultValue={value} placeholder={placeholder} {...rest} />}
  </div>
);
const TextArea = ({ label, id, value = '', placeholder, style }) => (
  <div className="field"><label>{label}</label><textarea id={id} className="textarea" defaultValue={value} placeholder={placeholder} style={style} /></div>
);
const Spacer = () => <div className="spacer" />;
const picker = id => call('openInputPicker', id);
const Seg = ({ id, values, selected, onPick }) => (
  <div className="seg" id={id}>{values.map(v => {
    const [value, label = value] = Array.isArray(v) ? v : [v, `${v[0].toUpperCase()}${v.slice(1)}`];
    return <button type="button" key={value} data-v={value} className={selected === value ? 'on' : ''} onClick={e => { call('segPick', e.currentTarget); if(onPick) onPick(value); }}>{label}</button>;
  })}</div>
);
const Swatches = ({ id, selected = 'purple' }) => {
  const cats = g('CATS') || {};
  return <div className="swatches" id={id}>{Object.entries(cats).map(([key, color]) =>
    <div key={key} className={`sw${key === selected ? ' on' : ''}`} style={{ background: color }} data-cat={key} onClick={e => call('pickCat', e.currentTarget)} />
  )}</div>;
};
const eventOf = props => props.event || getEvent(props.eid || props.id) || {};

export function ShowEventSheet({ eid, event }){
  const e = event || (eid ? getEvent(eid) : null);
  const now = new Date();
  const date = e?.date || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const cat = e?.color || 'purple';
  const color = (g('CATS') || {})[cat] || '#7c3aed';
  return <>
    <div className="dhero sheet-event-preview" id="ev-preview" style={{ background:`linear-gradient(155deg,${color}33,var(--card) 65%)`, borderColor:`${color}44` }}>
      <div className="cat-bar" style={{ background:color }} />
      <div className="sheet-event-tone" style={{ fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color }}>{eid?'Edit show':'New show'}</div>
      <div id="ev-preview-venue" style={{fontSize:20,fontWeight:800,marginTop:4}}>{e?.venue || 'Venue name'}</div>
    </div>
    <Field label="Venue" id="ev-venue" value={e?.venue} placeholder="e.g. Shelter" onInput={() => call('updateEventPreviewVenue')} />
    <Field label="Address" id="ev-addr" value={e?.venueAddr} placeholder="Street and number" />
    <Field label="Address line 2" id="ev-addr2" value={e?.venueAddr2} placeholder="Building, floor, unit (optional)" />
    <div className="row-2"><Field label="City" id="ev-city" value={e?.city} placeholder="Amsterdam" /><Field label="Region" id="ev-region" value={e?.venueRegion} placeholder="North Holland" /></div>
    <div className="row-2"><Field label="Postcode" id="ev-postcode" value={e?.venuePostcode} placeholder="1012 AB" /><Field label="Country" id="ev-country" value={e?.country} placeholder="Netherlands" /></div>
    <div className="field picker-field" onClick={() => picker('ev-date')}><label>Date</label><input id="ev-date" type="date" className="input" defaultValue={date} onClick={x=>{x.stopPropagation();picker('ev-date')}} /></div>
    <div className="row-2">
      <div className="field picker-field" onClick={() => picker('ev-set')}><label>Set time</label><input id="ev-set" type="time" className="input" defaultValue={e?.setTime || '23:00'} onClick={x=>{x.stopPropagation();picker('ev-set')}} /></div>
      <div className="field picker-field" onClick={() => picker('ev-arr')}><label>Arrival</label><input id="ev-arr" type="time" className="input" defaultValue={e?.arrival || ''} onClick={x=>{x.stopPropagation();picker('ev-arr')}} /></div>
    </div>
    <Field label="Status"><Seg id="ev-status" values={['confirmed','hold','cancelled']} selected={e?.status || 'confirmed'} /></Field>
    <Field label="Content to capture" id="ev-content" value={e?.content} placeholder="e.g. 2x reels · crowd clip" />
    {eid ? <><div className="row-2"><Field label="End time" id="ev-end" type="time" value={e?.endTime} /><Field label="Artist" id="ev-artist" value={e?.artist} placeholder={getStore()?.settings?.artistName || 'Artist'} /></div><TextArea label="Internal notes" id="ev-notes" value={e?.notes} placeholder="Team-only notes" /></> : null}
    <Field label="Colour"><Swatches id="ev-cat" selected={cat} /></Field>
    {eid ? <button type="button" className="btn secondary" style={{marginBottom:10}} onClick={()=>{call('closeSheet',true,{noReturn:true});call('eventMenu',eid)}}><Icon name="edit" size={16} /> All show sections…</button> : null}
    <button type="button" className="btn" id="ev-save" onClick={()=>call('saveEvent',eid||'')}>{eid?'Save changes':'Add show'}</button><Spacer />
  </>;
}

export function ShowHotelSheet(props){
  const e=eventOf(props), h=props.hotel || e.hotel || {};
  const conf=call('hotelBookingRef',h) || h.conf || h.bookingRef || '';
  return <>
    <Field label="Hotel name" id="ho-name" value={h.name} placeholder="Kimpton De Witt" />
    <Field label="Address" id="ho-addr" value={h.address} placeholder="Street and number" />
    <Field label="Address line 2" id="ho-addr2" value={h.address2} placeholder="Building, floor, unit (optional)" />
    <div className="row-2"><Field label="City" id="ho-city" value={h.city} placeholder={e.city||'Amsterdam'} /><Field label="Region" id="ho-region" value={h.region} placeholder="North Holland" /></div>
    <div className="row-2"><Field label="Postcode" id="ho-post" value={h.postcode} placeholder="1012 AB" /><Field label="Country" id="ho-country" value={h.country||e.country} placeholder="Netherlands" /></div>
    <div className="row-2"><Field label="Phone" id="ho-phone" type="tel" value={h.phone} placeholder="+31 20 123 4567" /><Field label="Email" id="ho-email" type="email" value={h.email} placeholder="reservations@hotel.com" /></div>
    <div className="row-2"><Field label="Check in" id="ho-in" type="date" value={h.checkin||e.date} /><Field label="Check out" id="ho-out" type="date" value={h.checkout} /></div>
    <Field label="Confirmation #" id="ho-conf" value={conf} placeholder="Booking reference" />
    <TextArea label="Room notes" id="ho-notes" value={h.notes} placeholder="Late checkout, floor, etc." />
    <button className="btn" id="ho-save" onClick={()=>call('saveHotel',props.eid||props.id)}>Save hotel</button>
    {e.hotel ? <button className="btn danger" style={{marginTop:10}} onClick={()=>call('removeHotel',props.eid||props.id)}><Icon name="trash" size={16}/> Remove hotel</button>:null}<Spacer />
  </>;
}

export function ShowFlightsListSheet({ eid, flights }){
  const list=flights || eventOf({eid}).flights || [];
  return <><p className="sheet-lede">Flights already on this show — tap one to edit route, gate and passengers.</p>
    <div className="card flush">{list.map(f=><div className="row" key={f.id} onClick={()=>call('openFlightFromList',eid,f.id)}>
      <div className="ic"><Icon name="plane" size={18}/></div><div className="body"><b>{f.code||'Flight'}</b><span>{`${f.from||'?'} → ${f.to||'?'}${f.gate?` · Gate ${f.gate}`:''}${f.terminal?` · Term ${f.terminal}`:''}`}</span></div><Icon name="chevR" size={15}/>
    </div>)}</div>
    <button className="btn secondary" style={{marginTop:14}} onClick={()=>call('openFlightFromList',eid,'__new__')}><Icon name="plus" size={16}/> Add flight</button><Spacer />
  </>;
}

function PaxRow({ pax, eid, fid }){
  const pid=pax.id || call('uid','pax') || `pax-${Math.random()}`;
  return <div className="fl-pax-row" data-pax-id={pid} style={{border:'1px solid var(--stroke)',borderRadius:12,padding:12,marginBottom:8}}>
    <div className="row-2"><Field label="Name"><input className="input fl-pax-name" defaultValue={pax.name||''} placeholder="Passenger name"/></Field><Field label="Seat"><input className="input fl-pax-seat" defaultValue={pax.seat||''} placeholder="4A"/></Field></div>
    {fid?<label className="btn secondary" style={{marginTop:8,display:'inline-flex'}}><Icon name="ticket" size={15}/> Boarding pass<input type="file" accept={g('PASS_FILE_ACCEPT')||'image/*,application/pdf'} hidden onChange={e=>call('uploadPass',eid,fid,e.currentTarget,pid)}/></label>:<div className="hint" style={{padding:'6px 2px 0'}}>Save the flight first to attach boarding passes.</div>}
    <button type="button" className="btn secondary" style={{marginTop:8}} onClick={e=>call('removeFlightPaxFromSheet',e.currentTarget,eid,fid||'',pid)}><Icon name="trash" size={14}/> Remove person</button>
  </div>;
}
export function ShowFlightSheet({ eid, fid, flight, passengers }){
  const e=eventOf({eid}); const f=flight || (e.flights||[]).find(x=>x.id===fid) || {}; const editing=!!(flight || (e.flights||[]).find(x=>x.id===fid));
  const dep=call('flightParseDep',f.dep,e.date) || {date:e.date||'',time:''};
  const pax=passengers || f.passengers || [{id:call('uid','pax'),name:'',seat:'',passes:[]}];
  return <>
    <Field label="Flight number" id="fl-code" value={f.code} placeholder="KL1008" />
    <div className="row-2"><Field label="From" id="fl-from" value={f.from} placeholder="LHR"/><Field label="To" id="fl-to" value={f.to} placeholder="AMS"/></div>
    <div className="row-2"><Field label="Date" id="fl-dep-date" type="date" value={dep.date||e.date}/><Field label="Departs" id="fl-dep-time" type="time" value={dep.time}/></div>
    <div className="block-title" style={{margin:'6px 2px 8px'}}>Day-of flight info</div>
    <div className="row-2"><Field label="Terminal" id="fl-term" value={f.terminal} placeholder="2"/><Field label="Gate" id="fl-gate" value={f.gate} placeholder="B12"/></div>
    <div className="row-2"><Field label="Status" id="fl-status" value={f.fstatus} placeholder="On time / Boarding"/><Field label="Delay" id="fl-delay" value={f.delay} placeholder="+25 min"/></div>
    <TextArea label="Journey notes" id="fl-notes" value={f.notes} placeholder="Connection tips, meeting point, baggage…" style={{minHeight:72}}/>
    <div className="field"><label>Passengers</label><div id="fl-pax-list">{pax.map((p,i)=><PaxRow key={p.id||i} pax={p} eid={eid} fid={editing?f.id:''}/>)}</div>
      <button type="button" className="btn secondary" style={{marginTop:8}} onClick={()=>call('addFlightPaxRow',eid,editing?f.id:'')}><Icon name="plus" size={15}/> Add person</button>
      <div className="hint" style={{padding:'8px 2px 0'}}>Same flight for everyone — each person has their own seat and boarding pass.</div>
    </div>
    <button className="btn" id="fl-save" onClick={()=>call('saveFlight',eid,editing?f.id:'')}>{editing?'Save flight':'Add flight'}</button>
    {editing?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('confirmRemoveFlight',eid,f.id)}><Icon name="trash" size={16}/> Remove flight</button>:null}<Spacer />
  </>;
}

export function ShowContactDriverSheet({ eid, driver }){
  const d=driver||eventOf({eid}).driver||{}, phone=d.phone||'', wa=d.whatsapp||phone;
  return <>{d.name?<div className="hint" style={{textAlign:'left',padding:'0 2px 12px'}}>{d.name}{d.pickup?` · ${d.pickup}`:''}</div>:null}
    {phone?<button className="btn" onClick={()=>call('callNumber',phone)}><Icon name="phone" size={17}/> Call</button>:null}
    {wa?<button className="btn secondary" style={{marginTop:10}} onClick={()=>call('whatsapp',wa)}><Icon name="chat" size={17}/> Message on WhatsApp</button>:null}<Spacer /></>;
}
export function ShowTransportListSheet({ eid, drivers }){
  const list=drivers || call('orderedDrivers',eventOf({eid})) || [];
  return <><div className="card flush">{list.map((x,i)=>{const d=x.d||x;return <div className="info-line" key={d.id||i}><div className="ic"><Icon name={d.noGround?'car':'user'} size={17}/></div><div className="tx" style={{flex:1}}><div className="k">{d.journey||d.name||'Transport'}{d.time?` · ${d.time}`:''}</div><div className="v">{d.noGround?'No grounds — Uber / taxi':`${d.name||'Driver'}${d.phone?` · ${d.phone}`:''}`}</div></div>
    {d.noGround?<button className="header-btn" onClick={()=>call('openExternal','https://m.uber.com/','uber://')}><Icon name="car" size={16}/></button>:<>{d.whatsapp||d.phone?<button className="header-btn" onClick={()=>call('whatsapp',d.whatsapp||d.phone)}><Icon name="chat" size={16}/></button>:null}{d.phone?<button className="header-btn" onClick={()=>call('callNumber',d.phone)}><Icon name="phone" size={16}/></button>:null}</>}</div>})}</div><Spacer /></>;
}
export function ShowContactLiaisonSheet({ eid, liaison }){
  const p=liaison||eventOf({eid}).promoter||{}, phone=p.phone||'', wa=p.whatsapp||phone;
  return <>{p.name?<div className="hint" style={{textAlign:'left',padding:'0 2px 12px'}}>{p.name}</div>:null}{wa?<button className="btn" onClick={()=>call('whatsapp',wa)}><Icon name="chat" size={17}/> Message on WhatsApp</button>:null}{phone?<button className="btn secondary" style={{marginTop:10}} onClick={()=>call('callNumber',phone)}><Icon name="phone" size={17}/> Call</button>:null}<Spacer /></>;
}

export function ShowReminderSheet({ eid, existing, options = [], morningAt, warning }){
  const e=eventOf({eid}), now=Date.now(), current=existing||call('reminderFor',eid)||null;
  const base=call('setStartMs',e.date,e.setTime);
  const generated=base==null?[]:[[0,'At set time'],[30,'30 min before set'],[60,'1 hour before set'],[120,'2 hours before set'],[180,'3 hours before set']].map(([mins,label])=>({at:base-mins*60000,label})).filter(o=>o.at>now);
  const morning=morningAt || call('parseDT',e.date,'09:00')?.getTime?.();
  return <>{current?<div className="hint" style={{padding:'0 2px 12px'}}>A reminder is already set for this show. Pick a new time to replace it, or remove it below.</div>:null}
    <Field label="What to remind you of" id="rem-note" value={current?.label} placeholder="e.g. Bring your USB · check monitors"/>
    {(options.length?options:generated).map((o,i)=><button key={i} className="btn secondary" style={{marginBottom:8}} onClick={()=>call('setShowReminder',eid,o.at,o.label)}><Icon name="reminder" size={15}/> {o.label}</button>)}
    {morning>now?<button className="btn secondary" style={{marginBottom:8}} onClick={()=>call('setShowReminder',eid,morning,'Morning of show')}><Icon name="reminder" size={15}/> On the morning · 9am</button>:null}
    <Field label="Custom time" id="rem-when" type="datetime-local"/><button className="btn" onClick={()=>call('setShowReminderCustom',eid)}>Set custom reminder</button>
    {current?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('clearShowReminder',eid)}><Icon name="trash" size={16}/> Remove reminder</button>:null}
    {warning?<div className="hint" style={{padding:'12px 2px 0',lineHeight:1.4}}>{warning}</div>:null}<Spacer /></>;
}
export function ShowFlightInfoSheet({ id, item }){
  const e=item || (getStore()?.events||[]).find(x=>x.id===id) || {}, has=e.flightNo||e.gate||e.terminal||e.fstatus||e.delay;
  return <><Field label="Flight number" id="fi-no" value={e.flightNo} placeholder="KL1008"/><div className="row-2"><Field label="Terminal" id="fi-term" value={e.terminal} placeholder="2"/><Field label="Gate" id="fi-gate" value={e.gate} placeholder="B12"/></div><div className="row-2"><Field label="Status" id="fi-status" value={e.fstatus} placeholder="On time / Boarding / Delayed"/><Field label="Delay" id="fi-delay" value={e.delay} placeholder="+25 min"/></div><div className="hint" style={{padding:'6px 2px'}}>Enter what you know now.</div><button className="btn" id="fi-save" onClick={()=>call('saveFlightInfo',id)}>Save flight info</button>{has?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('clearFlightInfo',id)}><Icon name="trash" size={15}/> Clear flight info</button>:null}<Spacer /></>;
}

export function ShowTransportSheet({ eid, idx, driver, journeys }){
  const list=call('showDrivers',eventOf({eid}))||[]; const d=driver || (idx!=null?list[idx]:null) || {}; const none=!!d.noGround;
  const presets=journeys || g('DRIVER_JOURNEYS') || [];
  return <><Field label="Journey (optional)" id="dr-journey" value={d.journey} placeholder="e.g. Hotel → Airport"><><input id="dr-journey" className="input" defaultValue={d.journey||''} placeholder="e.g. Hotel → Airport"/><div className="chips" style={{marginTop:8}}>{presets.map(j=><button type="button" className="chip" key={j} onClick={()=>{const el=document.getElementById('dr-journey');if(el)el.value=j;call('haptic')}}>{j}</button>)}</div></></Field>
    <Field label="Time (optional)" id="dr-time" type="time" value={d.time}/><Field label="Arrangement"><Seg id="dr-mode" values={[['driver','Driver contact'],['none','No grounds · Uber/Taxi']]} selected={none?'none':'driver'} onPick={()=>call('drModeToggle')}/></Field>
    <div id="dr-none-hint" className="hint" style={{display:none?'':'none',padding:'2px 2px 12px'}}>No ground transport provided for this journey — book an Uber or taxi.</div>
    <div id="dr-contact" style={{display:none?'none':''}}><Field label="Name" id="dr-name" value={d.name} placeholder="Jan"/><Field label="Phone" id="dr-phone" type="tel" value={d.phone} placeholder="+31 6 12345678"/><Field label="WhatsApp (if different)" id="dr-wa" type="tel" value={d.whatsapp} placeholder="+31 6 12345678"/><Field label="Pickup location" id="dr-pick" value={d.pickup} placeholder="Schiphol Arrivals"/><Field label="Notes" id="dr-notes" value={d.notes} placeholder="Vehicle, plate, etc."/></div>
    <button className="btn" id="dr-save" onClick={()=>call('saveDriver',eid,idx??null)}>{idx!=null?'Save':'Add'}</button>{idx!=null?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('removeDriver',eid,idx)}><Icon name="trash" size={16}/> Remove</button>:null}<Spacer /></>;
}
export function ShowVenueSheet(props){const e=eventOf(props),eid=props.eid||props.id;return <><Field label="Venue name" id="va-venue" value={e.venue} placeholder="Venue name"/><Field label="Address" id="va-addr" value={e.venueAddr} placeholder="Street and number"/><Field label="Address line 2" id="va-addr2" value={e.venueAddr2} placeholder="Building, floor, unit (optional)"/><div className="row-2"><Field label="City" id="va-city" value={e.city} placeholder="Amsterdam"/><Field label="Region" id="va-region" value={e.venueRegion} placeholder="North Holland"/></div><div className="row-2"><Field label="Postcode" id="va-postcode" value={e.venuePostcode} placeholder="1012 AB"/><Field label="Country" id="va-country" value={e.country} placeholder="Netherlands"/></div><button className="btn" id="va-save" onClick={()=>call('saveVenueAddr',eid)}>Save</button><Spacer /></>;}
export function ShowArtistLiaisonSheet(props){const e=eventOf(props),p=props.liaison||e.promoter||{},eid=props.eid||props.id;return <><Field label="Name" id="pr-name" value={p.name} placeholder="Lena"/><Field label="Phone" id="pr-phone" type="tel" value={p.phone} placeholder="+31 6 99887766"/><Field label="WhatsApp (if different)" id="pr-wa" type="tel" value={p.whatsapp&&p.whatsapp!==p.phone?p.whatsapp:''} placeholder="Same as phone if left blank"/><div className="hint" style={{padding:'2px 2px 8px'}}>Leave WhatsApp blank to use the phone number for both.</div><button className="btn" id="pr-save" onClick={()=>call('savePromoter',eid)}>Save contact</button>{e.promoter?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('removePromoter',eid)}><Icon name="trash" size={16}/> Remove contact</button>:null}<Spacer /></>;}

export function ShowDayDetailsSheet(props){
  const e=eventOf(props),a=props.advance||e.advance||{},eid=props.eid||props.id,schedule=a.schedule?.length?a.schedule:[{time:'',label:''}];
  return <><Field label="Stage / area" id="ad-stage" value={a.stage} placeholder="Temple stage"/><div className="field"><label>Running order</label><div id="ad-ro">{schedule.map((s,i)=><div className="row-2 ro-edit" data-id={s.id||''} key={s.id||i}><div className="field" style={{flex:'0 0 34%'}}><input id={`ro-t-${i}`} className="input ro-t" type="time" defaultValue={s.time||''}/></div><div className="field"><input className="input ro-l" defaultValue={s.label||s.title||''} placeholder="Soundcheck / Set / Curfew"/></div></div>)}</div><button className="btn secondary" style={{padding:9,marginTop:6}} onClick={()=>call('addRoRow')}><Icon name="plus" size={14}/> Add time</button></div>
    <div className="row-2"><Field label="Access / arrival" id="ad-access" value={a.access} placeholder="15:00 via Gate C"/><Field label="Sound check" id="ad-sc" value={a.soundcheck} placeholder="16:30"/></div><div className="row-2"><Field label="Curfew" id="ad-curfew" value={a.curfew} placeholder="23:00"/><Field label="Dressing room" id="ad-dr" value={a.dressingRoom} placeholder="Cabin 4, shared"/></div><Field label="Guest list" id="ad-gl" value={a.guestlist} placeholder="+4, email by Thu"/><Field label="Catering / rider" id="ad-cat" value={a.catering} placeholder="Backstage catering, rider in DR"/><div className="row-2"><Field label="Parking" id="ad-park" value={a.parking} placeholder="Artist lot P2"/><Field label="WiFi" id="ad-wifi" value={a.wifi} placeholder="SSID / pass"/></div><Field label="Navigation address" id="ad-nav" value={a.navAddr} placeholder="Gate for artist entrance (if different)"/><TextArea label="Remarks" id="ad-rem" value={a.remarks} placeholder="Anything else from the advance sheet…"/><button className="btn" id="ad-save" onClick={()=>call('saveAdvance',eid)}>Save details</button><Spacer /></>;
}
const ROLES=[['','Select role…'],['artist_liaison','Artist Liaison'],['promoter','Promoter'],['production','Production'],['venue_manager','Venue Manager'],['driver','Driver'],['emergency','Emergency'],['__other__','Other']];
export function ShowContactSheet({eid,cid,contact}){const e=eventOf({eid}),c=contact||(e.contacts||[]).find(x=>x.id===cid)||{};const known=ROLES.some(x=>x[0]===c.role),selected=known?c.role:(c.role?'__other__':'');return <><Field label="Name" id="ct-name" value={c.name} placeholder="Alex"/><Field label="Role"><select id="ct-role" className="input" defaultValue={selected} onChange={()=>call('toggleEventContactRoleOther')}>{ROLES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></Field><div className="field" id="ct-role-other-wrap" style={{display:selected==='__other__'?undefined:'none'}}><label>Custom role</label><input id="ct-role-other" className="input" defaultValue={known?'':c.role||''} placeholder="e.g. Stage manager"/></div><Field label="Phone" id="ct-phone" type="tel" value={c.phone} placeholder="+44 7…"/><Field label="WhatsApp (if different)" id="ct-wa" type="tel" value={c.whatsapp}/><button className="btn" id="ct-save" onClick={()=>call('saveEventContact',eid,cid||'')}>Save contact</button>{cid?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('delEventContact',eid,cid)}><Icon name="trash" size={16}/> Remove</button>:null}<Spacer /></>;}
export function ShowChecklistSheet({eid,items}){const list=items||eventOf({eid}).checklist||[];return <>{list.length?<div className="card flush">{list.map(i=><div className={`check${i.done?' done':''}`} data-id={i.id} key={i.id}><div className="box" onClick={()=>call('toggleEventCheck',eid,i.id)}><Icon name="check" size={15}/></div><div className="lbl" onClick={()=>call('toggleEventCheck',eid,i.id)}>{i.label}</div><button className="del" onClick={()=>call('delEventCheck',eid,i.id)}><Icon name="x" size={16}/></button></div>)}</div>:<div className="hint" style={{padding:'8px 4px 12px'}}>No items yet — add what you need to prep.</div>}<Field label="New item" id="ck-new" placeholder="e.g. Track ID list"/><button className="btn" onClick={()=>call('addEventCheckFromSheet',eid)}><Icon name="plus" size={16}/> Add item</button><Spacer /></>;}
export function ShowTimelineSheet({eid,steps}){const e=eventOf({eid}),list=steps||call('showDayTimeline',e)||e.timeline||[];return <><p className="sheet-lede">{list.filter(s=>s.auto).length||'No'} auto steps · {list.filter(s=>!s.auto).length} custom. Tick items off as you go.</p>{list.length?<div className="card flush">{list.map(s=><div className={`check${s.done?' done':''}`} data-id={s.id} key={s.id}><div className="box" onClick={()=>call('toggleShowTimelineStep',eid,s.id)}><Icon name="check" size={15}/></div><div className="lbl" onClick={()=>s.auto?call('toggleShowTimelineStep',eid,s.id):call('sheetShowTimelineStep',eid,s.id)}>{s.time?`${s.time} · `:''}{s.title}{s.sub?` — ${s.sub}`:''}</div>{!s.auto?<button className="del" onClick={()=>call('delShowTimelineStep',eid,s.id)}><Icon name="x" size={16}/></button>:null}</div>)}</div>:<div className="hint" style={{padding:'8px 4px 12px'}}>Add travel, hotel, transport or set time to build this timeline.</div>}<button className="btn secondary" style={{marginTop:12}} onClick={()=>call('sheetShowTimelineStep',eid)}><Icon name="plus" size={16}/> Add custom step</button><Spacer /></>;}
export function ShowTimelineStepSheet({eid,sid,step}){const e=eventOf({eid}),s=step||(e.timeline||[]).find(x=>x.id===sid)||{};return <><div className="row-2"><Field label="Time" id="est-time" type="time" value={s.time}/><Field label="What" id="est-title" value={s.title} placeholder="Soundcheck"/></div><Field label="Detail (optional)" id="est-sub" value={s.sub} placeholder="Venue, note…"/><button className="btn" id="est-save" onClick={()=>call('saveShowTimelineStep',eid,sid||'')}>{sid?'Save step':'Add step'}</button>{sid?<button className="btn danger" style={{marginTop:10}} onClick={()=>call('delShowTimelineStep',eid,sid)}><Icon name="trash" size={16}/> Remove</button>:null}<Spacer /></>;}
export function ShowTimelineAddSheet({tid}){return <><div className="row-2"><Field label="Time" id="ts-time" type="time"/><Field label="What" id="ts-title" placeholder="Soundcheck"/></div><Field label="Detail (optional)" id="ts-sub" placeholder="Venue, note…"/><button className="btn" id="ts-save" onClick={()=>call('saveTimelineStep',tid)}>Add step</button><Spacer /></>;}
export function ShowEmergencySheet({tid}){return <><Field label="Name" id="em-name" placeholder="Manager — Alex"/><Field label="Phone" id="em-phone" type="tel" placeholder="+44 7700 900123"/><button className="btn" id="em-save" onClick={()=>call('saveEmergency',tid)}>Add contact</button><Spacer /></>;}
export function ShowDealSheet({eid,finance}){const e=eventOf({eid}),f=finance||e.finance||{},s=getStore()?.settings||{},currencies=Object.keys(s.fx||{});return <><div className="row-2"><Field label="Fee" id="fi-fee" type="number" inputMode="decimal" value={f.fee} placeholder="8000"/><Field label="Currency"><select id="fi-cur" className="input" defaultValue={f.currency||s.baseCurrency}>{currencies.map(c=><option key={c}>{c}</option>)}</select></Field></div><Field label="Deal type"><Seg id="fi-deal" values={['Guarantee','Guarantee + Bonus','Door split','Fee + Travel']} selected={f.dealType||'Guarantee'}/></Field><div className="row-2"><Field label="Agent commission %" id="fi-comm" type="number" inputMode="decimal" value={f.commission} placeholder="10"/><Field label="Per diem" id="fi-pd" type="number" inputMode="decimal" value={f.perDiem} placeholder="150"/></div><Field label="Payment status"><Seg id="fi-paid" values={[['0','Unpaid'],['1','Paid']]} selected={f.paid?'1':'0'}/></Field><Field label="Fee visibility"><Seg id="fi-nd" values={[['0','Show fee'],['1','Not disclosed']]} selected={f.notDisclosed?'1':'0'}/></Field><button className="btn" id="fi-save" onClick={()=>call('saveFinance',eid)}>Save deal</button><div className="hint" style={{textAlign:'left',paddingTop:10}}>Foreign fees auto-convert to {s.baseCurrency}.</div><Spacer /></>;}
export function ShowExpenseSheet({eid}){return <><div className="row-2"><Field label="What" id="ex-label" placeholder="Flights, hotel, gear…"/><Field label="Amount" id="ex-amt" type="number" inputMode="decimal" placeholder="220"/></div><button className="btn" onClick={()=>call('saveExpense',eid)}>Add expense</button><Spacer /></>;}
export function ShowDaySheet({eid,text,share=true}){const value=text ?? g('__daysheet') ?? '';return <><div className="card" style={{whiteSpace:'pre-wrap',fontSize:13.5,lineHeight:1.55,fontFamily:'ui-monospace,Menlo,monospace',color:'var(--text-2)',maxHeight:'52dvh',overflow:'auto'}}>{value}</div><Spacer/><div style={{display:'flex',gap:9}}><button className="btn" style={{flex:1}} onClick={()=>{call('copyText',value);call('closeSheet')}}><Icon name="copy" size={16}/> Copy</button>{share&&typeof navigator!=='undefined'&&navigator.share?<button className="btn secondary" style={{flex:1}} onClick={()=>call('daySheetShare')}><Icon name="share" size={16}/> Share</button>:null}</div>{eid?<button className="btn secondary" style={{marginTop:9}} onClick={()=>call('printDaySheet',eid)}><Icon name="file" size={16}/> Print / Save as PDF</button>:null}<Spacer /></>;}
