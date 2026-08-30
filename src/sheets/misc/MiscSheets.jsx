import { Icon } from '../../show/ui.jsx';
import { call, fmtMoney, getCats, getIdeaTypes, getRoles, getSel, getStore, showTitle } from '../../api/operate.js';

const Spacer=()=> <div className="spacer"/>;
const Field=({label,id,value='',placeholder,type='text',inputMode,children})=><div className="field"><label>{label}</label>{children||<input id={id} type={type} inputMode={inputMode} className="input" defaultValue={value||''} placeholder={placeholder}/>}</div>;
const store=()=>getStore()||{};
const events=()=>store().events||[];
const eventOptions=()=><><option value="">— Not linked —</option>{events().filter(e=>(e.kind||'show')==='show').map(e=><option key={e.id} value={e.id}>{showTitle(e)} · {[e.city,e.country].filter(Boolean).join(', ')}</option>)}</>;

export function IdeaShowPickerSheet({iid,selectedId}){
  const idea=(store().ideas||[]).find(x=>x.id===iid);
  return <><div className="searchbar"><span className="ic"><Icon name="search" size={18}/></span><input id="idea-show-pick-search" placeholder="Search venue or city" onInput={()=>call('debouncedIdeaShowPick')}/></div><Field label="Show"><select id="idea-show-pick-select" className="input" defaultValue={selectedId||idea?.eventId||''}>{eventOptions(selectedId||idea?.eventId)}</select></Field><button className="btn" onClick={()=>call('confirmIdeaShowPick')}>Link show</button><Spacer/></>;
}
export function IdeaTripPickerSheet({iid,trips}){
  const list=trips||getSel()?.trips?.()||store().trips||[];
  return <><div className="card flush">{list.filter(t=>!t.archived).map(t=><div className="row" key={t.id} onClick={()=>call('doAttachIdea',iid,'trip',t.id)}><div className="ic"><Icon name="bag" size={17}/></div><div className="body"><b>{t.name}</b><span>{getSel()?.tripEvents?.(t.id)?.length||0} shows</span></div><Icon name="chevR" size={15}/></div>)}</div><Spacer/></>;
}
export function IdeaAttachSheet({eid,ideas}){
  const list=ideas||(store().ideas||[]).filter(i=>i.eventId!==eid), types=getIdeaTypes()||{};
  return <>{list.length?<div className="card flush" style={{marginBottom:12}}>{list.map(i=>{const t=types[i.type]||types.other||{};return <div className="row" key={i.id} onClick={()=>call('doAttachIdea',i.id,'event',eid)}><div className="ic"><Icon name={t.icon||'idea'} size={16}/></div><div className="body"><b>{i.title}</b><span>{t.label||i.type}{i.eventId||i.tripId?' · linked elsewhere':''}</span></div><Icon name="plus" size={15}/></div>})}</div>:<div className="hint" style={{padding:'6px 2px 12px'}}>No other ideas yet.</div>}<button className="btn secondary" onClick={()=>{call('closeSheet');call('sheetIdea')}}><Icon name="plus" size={15}/> New idea</button><Spacer/></>;
}
export function IdeaEditSheet({iid,idea}){
  const i=idea||(store().ideas||[]).find(x=>x.id===iid)||{},types=getIdeaTypes()||{};
  return <><div className="field"><label>Idea</label><textarea id="id-title" className="textarea" style={{minHeight:70}} defaultValue={i.title||''} placeholder="What's the concept?"/></div><Field label="Type"><div className="swatches" id="id-type" style={{gap:8,flexWrap:'wrap'}}>{Object.entries(types).map(([k,v])=><button type="button" className={`chip ${(i.type||'reel')===k?'on':''}`} data-v={k} key={k} onClick={e=>call('chipPick',e.currentTarget)}>{v.label}</button>)}</div></Field><Field label="Priority"><div className="seg" id="id-prio">{[['high','High'],['med','Medium'],['low','Low']].map(([k,l])=><button type="button" data-v={k} className={(i.prio||'med')===k?'on':''} key={k} onClick={e=>call('segPick',e.currentTarget)}>{l}</button>)}</div></Field><div className="field"><label>Details</label><textarea id="id-note" className="textarea" style={{minHeight:64}} defaultValue={i.note||''} placeholder="Script, references, notes…"/></div><Field label="Link to a show"><div className="searchbar"><span className="ic"><Icon name="search" size={18}/></span><input id="id-event-search" placeholder="Search venue or city" onInput={()=>call('debouncedIdeaEventSelect')}/></div><select id="id-event" className="input" defaultValue={i.eventId||''}>{eventOptions(i.eventId)}</select></Field><button className="btn" id="id-save" onClick={()=>call('saveIdea',iid||'')}>{iid?'Save':'Add idea'}</button><Spacer/></>;
}

export function NoteAddChoiceSheet({folderId}){
  return <div className="card flush"><div className="row" onClick={()=>{call('closeSheet');call('sheetNote',folderId)}}><div className="ic"><Icon name="note" size={17}/></div><div className="body"><b>Note</b><span>{folderId?'New note in this folder':'New unfiled note'}</span></div><Icon name="chevR" size={15}/></div><div className="row" onClick={()=>{call('closeSheet');call('promptCreateNoteFolder')}}><div className="ic"><Icon name="folder" size={17}/></div><div className="body"><b>Folder</b><span>Group notes together</span></div><Icon name="chevR" size={15}/></div></div>;
}
export function NoteMoveFolderSheet({noteId,folders}){
  const note=(store().notes||[]).find(x=>x.id===noteId)||{}, list=folders||getSel()?.noteFolders?.()||store().noteFolders||[];
  const row=(id,name,count)=><div className="row" key={id||'none'} onClick={()=>{call('closeSheet');call('assignNoteFolder',noteId,id||null)}}><div className="ic"><Icon name={id?'folder':'note'} size={17}/></div><div className="body"><b>{name}</b><span>{id?`${count||0} notes`:'Keep this note unfiled'}</span></div>{note.folderId===id?<span className="tag">Current</span>:<Icon name="chevR" size={15}/>}</div>;
  return <><div className="card flush">{row(null,'No folder')}{list.map(f=>row(f.id,f.name||'Folder',getSel()?.notesInFolder?.(f.id)?.length))}</div><Spacer/><button className="btn secondary" onClick={()=>{call('closeSheet');call('promptNewFolderForNote',noteId)}}><Icon name="folder" size={16}/> New folder…</button></>;
}

export function TripTimelineOptionsSheet({runKey,stepId,step}){
  const run=call('runOf',runKey), s=step||(run?(call('runTimeline',run)||[]).find(x=>x.id===stepId):null)||{};
  return <>{s.time||s.sub?<p className="sheet-lede">{[s.time,s.sub].filter(Boolean).join(' · ')}</p>:null}<button className="btn" onClick={()=>{call('closeSheet');call('editTimelineStep',runKey,stepId)}}><Icon name="edit" size={16}/> Edit</button><button className="btn secondary" style={{marginTop:10}} onClick={()=>{call('closeSheet');call('completeRunStep',runKey,stepId)}}><Icon name={s.done?'x':'check'} size={16}/> {s.done?'Mark not done':'Mark done'}</button><Spacer/><button className="btn secondary" onClick={()=>call('closeSheet')}>Cancel</button><Spacer/></>;
}
export function TripEditSheet({tid,trip}){
  const t=trip||(store().trips||[]).find(x=>x.id===tid)||{},cats=getCats()||{};
  return <><Field label="Trip name" id="tr-name" value={t.name} placeholder="e.g. Europe Weekend"/><div className="row-2"><Field label="Start" id="tr-start" type="date" value={t.startDate}/><Field label="End" id="tr-end" type="date" value={t.endDate}/></div><Field label="Colour"><div className="swatches" id="tr-cat">{Object.entries(cats).map(([k,v])=><div className={`sw${(t.color||'pink')===k?' on':''}`} style={{background:v}} data-cat={k} key={k} onClick={e=>call('pickCat',e.currentTarget)}/>)}</div></Field>{!tid?<div className="hint" style={{textAlign:'left',padding:'2px 2px 6px'}}>A default packing checklist will be added.</div>:null}<button className="btn" id="tr-save" onClick={()=>call('saveTrip',tid||'')}>{tid?'Save changes':'Create trip'}</button><Spacer/></>;
}
export function TripContactsSheet({runKey,contacts,grouped=true}){
  const run=runKey?call('runOf',runKey):null, list=contacts||(run?call('tourContacts',run):null)||[];
  const groups=list.reduce((out,c)=>{(out[c.show||'Contacts']=out[c.show||'Contacts']||[]).push(c);return out},{});
  return <>{Object.entries(groups).map(([show,items])=><div key={show}>{grouped?<div className="prio-head" style={{margin:'14px 4px 8px'}}>{show}</div>:null}<div className="card flush">{items.map((c,i)=><div className="info-line info-line-stacked" key={i}><div className="ic"><Icon name="user" size={17}/></div><div className="tx" style={{flex:1,minWidth:0}}><b>{c.name||c.label}</b><div>{c.label}{c.phone?` · ${c.phone}`:''}</div></div>{c.whatsapp||c.phone?<button className="header-btn" onClick={()=>call('whatsapp',c.whatsapp||c.phone)}><Icon name="chat" size={15}/></button>:null}{c.phone?<button className="header-btn" onClick={()=>call('callNumber',c.phone)}><Icon name="phone" size={15}/></button>:null}</div>)}</div></div>)}<Spacer/></>;
}

export function CalendarAddLogisticSheet({showId,event}){
  const e=event||events().find(x=>x.id===showId)||{};
  return <><Field label="Type"><div className="seg" id="al-kind">{[['travel','Flight / transfer'],['stay','Hotel']].map(([k,l],i)=><button type="button" data-v={k} className={i===0?'on':''} key={k} onClick={x=>{call('segPick',x.currentTarget);call('toggleLogisticAddFields')}}>{l}</button>)}</div></Field><div id="al-travel-fields"><Field label="Travel mode"><div className="seg" id="al-icon">{[['plane','Flight'],['car','Driver'],['ferry','Ferry'],['walk','Walk']].map(([k,l],i)=><button type="button" data-v={k} className={i===0?'on':''} key={k} onClick={x=>{call('segPick',x.currentTarget);call('toggleLogisticAddFields')}}>{l}</button>)}</div></Field><Field label="Flight number (optional)" id="al-code" placeholder="KL1008"/><div className="row-2"><Field label="From" id="al-from" placeholder="AMS"/><Field label="To" id="al-to" placeholder="ZTH"/></div><div className="row-2"><Field label="Departure" id="al-start" type="time"/><Field label="Arrival" id="al-end" type="time"/></div><div id="al-driver-name-wrap" style={{display:'none'}}><Field label="Driver / company name" id="al-driver-name" placeholder="e.g. Marco · Uber"/></div></div><div id="al-stay-fields" style={{display:'none'}}><Field label="Hotel name" id="al-place" placeholder="e.g. Hilton"/><Field label="Address" id="al-addr" placeholder="Street, city"/><Field label="Check-in time" id="al-checkin" type="time"/></div><Field label="Date" id="al-date" type="date" value={e.date}/><button className="btn" onClick={()=>call('saveLogisticFor',showId)}>Add</button><Spacer/></>;
}
export function CalendarItemSheet({id,item}){
  const e=item||events().find(x=>x.id===id)||{},travel=e.kind==='travel',stay=e.kind==='stay',icons=[['plane','Flight'],['car','Driver'],['ferry','Ferry'],['walk','Walk']];
  return <><Field label="Date" id="it-date" type="date" value={e.date}/>{travel?<><Field label="Travel mode"><div className="seg" id="it-icon">{icons.map(([k,l])=><button type="button" data-v={k} className={(e.icon||'plane')===k?'on':''} key={k} onClick={x=>call('segPick',x.currentTarget)}>{l}</button>)}</div></Field><Field label="Flight number (optional)" id="it-code" value={e.flightNo} placeholder="KL1008"/>{(e.icon||'plane')==='car'?<Field label="Driver / company name" id="it-driver-name" value={e.driverName} placeholder="Marco"/>:null}<div className="row-2"><Field label="From" id="it-from" value={e.from} placeholder="AMS"/><Field label="To" id="it-to" value={e.to} placeholder="ZTH"/></div><div className="row-2"><Field label="Departure" id="it-start" type="time" value={e.start}/><Field label="Arrival" id="it-end" type="time" value={e.end}/></div>{(e.icon||'plane')==='car'?<><Field label="Driver phone" id="it-phone" type="tel" value={e.phone}/><Field label="WhatsApp (if different)" id="it-wa" type="tel" value={e.whatsapp}/></>:null}</>:null}{stay?<><Field label="Hotel name" id="it-place" value={e.place} placeholder="Hilton"/><Field label="Address" id="it-addr" value={e.addr} placeholder="Hotel address"/><Field label="Check-in" id="it-info" value={(e.info||'').replace(/^Check-in:\s*/i,'')} placeholder="14:00"/><Field label="Booking reference" id="it-ref" value={e.bookingRef} placeholder="Confirmation number"/></>:null}<button className="btn" onClick={()=>call('saveItem',id)}>Save</button><Spacer/><button className="btn danger" onClick={()=>call('delItem',id)}><Icon name="trash" size={15}/> Delete</button><Spacer/></>;
}

export function BoardingPassSheet({itemId,passId,flightId='',pass}){
  const p=pass||call('findPassByRef',itemId,passId,flightId)||{},pk=!!(p.kind==='pkpass'||p.mime==='application/vnd.apple.pkpass'),img=p.kind==='image'&&!pk,args=[itemId,passId,flightId];
  return <>{img&&p.data?<div className="thumb" style={{width:'100%',height:180,marginBottom:12}} onClick={()=>call('viewPassImage',...args)}><img src={p.data} alt=""/></div>:<div className="hint" style={{textAlign:'left',padding:'0 2px 12px'}}><Icon name="ticket" size={18}/> {p.name||(pk?'Apple Wallet pass':'Boarding pass')}</div>}{img&&p.data?<button className="btn" onClick={()=>call('viewPassImage',...args)}><Icon name="image" size={16}/> View</button>:null}{pk?<><button className="btn" style={{marginTop:10}} onClick={()=>call('addPassToAppleWallet',...args)}><Icon name="wallet" size={16}/> Add to Apple Wallet</button><div className="hint" style={{textAlign:'left',padding:'8px 2px 0'}}>On iPhone, opening this .pkpass file lets Apple Wallet add it.</div></>:null}<button className="btn secondary" style={{marginTop:10}} onClick={()=>call('downloadPassFile',...args)}><Icon name="file" size={16}/> Download / Open</button>{typeof navigator!=='undefined'&&navigator.share?<button className="btn secondary" style={{marginTop:10}} onClick={()=>call('sharePassFile',...args)}><Icon name="share" size={16}/> Share</button>:null}{!pk?<div className="hint" style={{textAlign:'left',padding:'12px 2px 0'}}>Photos and PDFs cannot be added to Apple Wallet; Wallet requires a signed .pkpass file from the airline.</div>:null}<Spacer/></>;
}

export function EventMenuSheet({ eid }){
  const open = (fnName) => () => call('openFromEventMenu', eid, () => call(fnName, eid));
  return (
    <>
      <p className="sheet-lede">Update any part of this show — basics, travel, venue, deal or prep.</p>
      <div className="edit-section-grid">
        <button type="button" className="edit-section-btn" onClick={open('sheetEvent')}><Icon name="edit" size={16}/><span><b>Show basics</b><small>Venue, date, times, status</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetHotel')}><Icon name="bed" size={16}/><span><b>Hotel</b><small>Stay & confirmation</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetFlight')}><Icon name="plane" size={16}/><span><b>Flights</b><small>Route, gate, seats & passes</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetDriver')}><Icon name="car" size={16}/><span><b>Transport</b><small>Driver, Uber or taxi</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetPromoter')}><Icon name="users" size={16}/><span><b>Artist Liaison</b><small>Show-day contact</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetAdvance')}><Icon name="file" size={16}/><span><b>Show-day details</b><small>Stage, catering, access</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetFinance')}><Icon name="coins" size={16}/><span><b>Deal</b><small>Fee, expenses, paid</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetShowTimeline')}><Icon name="clock" size={16}/><span><b>Day timeline</b><small>Schedule steps</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetShowChecklist')}><Icon name="checkList" size={16}/><span><b>Checklist</b><small>Prep tasks</small></span></button>
        <button type="button" className="edit-section-btn" onClick={open('sheetEventContact')}><Icon name="users" size={16}/><span><b>Key contact</b><small>Extra people</small></span></button>
      </div>
      <Spacer />
      <button type="button" className="btn secondary" onClick={() => { call('closeSheet', true, { noReturn: true }); if(typeof window !== 'undefined') window.sheetReturnStack = []; call('startTripFromShow', eid); }}>
        <Icon name="play" size={16} /> Start Trip Mode
      </button>
      <Spacer />
      <button type="button" className="btn danger" onClick={() => { call('closeSheet', true, { noReturn: true }); if(typeof window !== 'undefined') window.sheetReturnStack = []; call('confirmDeleteEvent', eid); }}>
        <Icon name="trash" size={16} /> Delete show
      </button>
      <Spacer />
    </>
  );
}

export function TripMenuSheet({ tid }){
  const trip = (store().trips || []).find(t => t.id === tid) || {};
  return (
    <>
      <button type="button" className="btn secondary" onClick={() => { call('closeSheet'); call('sheetTrip', tid); }}>
        <Icon name="edit" size={16} /> Edit trip
      </button>
      <Spacer />
      {trip.archived ? (
        <button type="button" className="btn secondary" onClick={() => { call('closeSheet'); call('unarchiveTrip', tid); }}>
          <Icon name="archive" size={16} /> Unarchive
        </button>
      ) : (
        <button type="button" className="btn secondary" onClick={() => { call('closeSheet'); call('confirmCompleteTrip', tid); }}>
          <Icon name="flag" size={16} /> Complete & archive
        </button>
      )}
      <Spacer />
      <button type="button" className="btn danger" onClick={() => { call('closeSheet'); call('confirmDeleteTrip', tid); }}>
        <Icon name="trash" size={16} /> Delete trip
      </button>
      <Spacer />
    </>
  );
}

export function InvoicePickShowSheet(){
  const evs = events().filter(e => e.finance && e.finance.fee > 0);
  const invoices = store().invoices || [];
  return (
    <>
      <div className="card flush">
        {evs.map(e => {
          const inv = invoices.find(iv => iv.eventId === e.id);
          return (
            <div
              key={e.id}
              className="row"
              onClick={() => {
                call('closeSheet');
                if(inv) call('openView', 'invoice', inv.id);
                else call('createInvoiceFromEvent', e.id);
              }}
            >
              <div className="ic" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="money" size={17} /></div>
              <div className="body">
                <b>{showTitle(e)}</b>
                <span>{e.city} · {fmtMoney(e.finance.fee, e.finance.currency)}{inv ? ' · invoiced' : ''}</span>
              </div>
              <Icon name="chevR" size={15} />
            </div>
          );
        })}
      </div>
      <Spacer />
    </>
  );
}

export function InvoiceAddLineSheet({ id }){
  return (
    <>
      <div className="row-2">
        <div className="field" style={{ flex: 2 }}><label>Description</label><input id="il-label" className="input" placeholder="Travel, extra set…" /></div>
        <Field label="Amount" id="il-amt" type="number" inputMode="decimal" />
      </div>
      <button type="button" className="btn" onClick={() => call('saveInvLine', id)}>Add</button>
      <Spacer />
    </>
  );
}

export function InvoiceMetaSheet({ id, invoice }){
  const inv = invoice || (store().invoices || []).find(x => x.id === id) || {};
  return (
    <>
      <Field label="Bill to (client)" id="iv-client" value={inv.client} />
      <div className="field"><label>Client address</label><textarea id="iv-caddr" className="textarea" style={{ minHeight: 60 }} defaultValue={inv.clientAddr || ''} /></div>
      <div className="row-2">
        <Field label="Issue date" id="iv-date" type="date" value={inv.date} />
        <Field label="Terms (days)" id="iv-terms" type="number" value={inv.terms || 14} />
      </div>
      <button type="button" className="btn" onClick={() => call('saveInvoiceMeta', id)}>Save</button>
      <Spacer />
    </>
  );
}

export function BillingDetailsSheet({ invId }){
  const s = store().settings || {};
  const b = s.billing || {};
  return (
    <>
      <Field label="Name / business" id="bl-name" value={b.name} placeholder="Your legal / act name" />
      <div className="field"><label>Address</label><textarea id="bl-addr" className="textarea" style={{ minHeight: 70 }} placeholder="Billing address" defaultValue={b.address || ''} /></div>
      <div className="row-2">
        <Field label="VAT / Tax ID" id="bl-tax" value={b.taxId} />
        <Field label="Email" id="bl-email" type="email" value={b.email} />
      </div>
      <Field label="Payment details (IBAN / account)" id="bl-iban" value={b.iban} placeholder="IBAN or bank details" />
      <div className="row-2">
        <Field label="Invoice prefix" id="bl-prefix" value={s.invoicePrefix} />
        <Field label="Default terms (days)" id="bl-terms" type="number" value={s.invoiceTerms || 14} />
      </div>
      <button type="button" className="btn" onClick={() => call('saveBilling', invId || '')}>Save details</button>
      <Spacer />
    </>
  );
}

export function ContactViewSheet({ id, contact }){
  const c = contact || (store().contacts || []).find(x => x.id === id) || {};
  const roles = getRoles() || {};
  const col = roles[c.role] || roles.Other || 'var(--accent)';
  const initial = ((c.name || '?').trim()[0] || '?').toUpperCase();
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: 16, background: `${col}22`, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>{initial}</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 750 }}>{c.name}</div>
          <div style={{ color: 'var(--text-2)', fontWeight: 600 }}>
            <span className="tag" style={{ background: `${col}22`, color: col }}>{c.role}</span>
            {c.company ? ` ${c.company}` : ''}
          </div>
        </div>
      </div>
      <div className="act-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <button type="button" className="act" onClick={() => call('callNumber', c.phone || '')}><div className="ic" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="phone" size={19} /></div><span>Call</span></button>
        <button type="button" className="act" onClick={() => call('whatsapp', c.whatsapp || c.phone || '')}><div className="ic" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="chat" size={19} /></div><span>WhatsApp</span></button>
        <button type="button" className="act" onClick={() => { if(c.email) window.location.href = `mailto:${c.email}`; else call('toast', 'No email', 'x'); }}><div className="ic" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="note" size={19} /></div><span>Email</span></button>
        <button type="button" className="act" onClick={() => call('copyText', c.phone || '')}><div className="ic" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}><Icon name="copy" size={19} /></div><span>Copy</span></button>
      </div>
      {c.phone ? <div className="info-line" style={{ border: '1px solid var(--stroke)', borderRadius: 12, marginBottom: 8 }} onClick={() => call('copyText', c.phone)}><div className="ic"><Icon name="phone" size={16} /></div><div className="tx"><div className="k">Phone</div><div className="v">{c.phone}</div></div></div> : null}
      {c.email ? <div className="info-line" style={{ border: '1px solid var(--stroke)', borderRadius: 12, marginBottom: 8 }} onClick={() => call('copyText', c.email)}><div className="ic"><Icon name="note" size={16} /></div><div className="tx"><div className="k">Email</div><div className="v">{c.email}</div></div></div> : null}
      {c.notes ? <div className="info-line" style={{ border: '1px solid var(--stroke)', borderRadius: 12, marginBottom: 8 }}><div className="ic"><Icon name="edit" size={16} /></div><div className="tx"><div className="k">Notes</div><div className="v" style={{ fontSize: 14 }}>{c.notes}</div></div></div> : null}
      <Spacer />
      <div className="btn-row">
        <button type="button" className="btn secondary" onClick={() => call('sheetContact', c.id)}><Icon name="edit" size={15} /> Edit</button>
        <button type="button" className="btn danger" style={{ flex: '0 0 auto' }} onClick={() => call('delContact', c.id)}><Icon name="trash" size={15} /></button>
      </div>
      <Spacer />
    </>
  );
}

export function ContactEditSheet({ id, contact }){
  const c = contact || (id ? (store().contacts || []).find(x => x.id === id) : null) || {};
  const roles = Object.keys(getRoles() || { Promoter: 1, Other: 1 });
  return (
    <>
      <Field label="Name" id="co-name" value={c.name} placeholder="Full name" />
      <div className="row-2">
        <Field label="Role">
          <select id="co-role" className="input" defaultValue={c.role || 'Promoter'}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Company" id="co-company" value={c.company} placeholder="Club / agency" />
      </div>
      <Field label="Phone" id="co-phone" type="tel" value={c.phone} />
      <Field label="WhatsApp (if different)" id="co-wa" type="tel" value={c.whatsapp} />
      <Field label="Email" id="co-email" type="email" value={c.email} />
      <div className="field"><label>Notes</label><textarea id="co-notes" className="textarea" style={{ minHeight: 60 }} defaultValue={c.notes || ''} /></div>
      <button type="button" className="btn" id="co-save" onClick={() => call('saveContact', id || '')}>{id ? 'Save' : 'Add contact'}</button>
      <Spacer />
    </>
  );
}

