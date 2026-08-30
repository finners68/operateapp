import { Icon } from '../../show/ui.jsx';
import { call, fmtDate, getCats, getStore } from '../../api/operate.js';

const Field=({label,id,value='',placeholder,type='text',children})=><div className="field"><label>{label}</label>{children||<input id={id} type={type} className="input" defaultValue={value||''} placeholder={placeholder}/>}</div>;
const Spacer=()=> <div className="spacer"/>;
const store=()=>getStore()||{};
const itinerary=id=>(store().itineraries||[]).find(x=>x.id===id)||{};
const shows=()=> (store().events||[]).filter(e=>(e.kind||'show')==='show');

export function ItineraryStartSheet(){
  return <><p className="sheet-lede">First choose what this upload is for — then pick the file.</p><div className="edit-section-grid">
    <button className="edit-section-btn" onClick={()=>call('beginItineraryNewShow')}><Icon name="plus" size={16}/><span><b>New show</b><small>Upload → send to Make → review basics</small></span></button>
    <button className="edit-section-btn" onClick={()=>call('beginItineraryExistingShow')}><Icon name="music" size={16}/><span><b>Existing show</b><small>Attach a file to a show you already have</small></span></button>
  </div><Spacer/></>;
}
export function ItineraryNewShowSheet(){
  return <><p className="sheet-lede">Upload the itinerary. It is sent straight to Make, then you check the show basics.</p><label className="btn" style={{marginTop:8}}><Icon name="plus" size={18}/> Upload &amp; send to Make<input type="file" accept="image/*,application/pdf" multiple hidden onChange={e=>call('submitItinerary',e.currentTarget,'new')}/></label><Spacer/></>;
}
export function ItineraryExistingShowSheet({items}){
  const list=items||shows();
  if(!list.length) return <><div className="empty" style={{padding:'18px 8px'}}><div className="ic"><Icon name="music" size={26}/></div><b>No shows yet</b><span>Create a show first, or choose New show instead.</span></div><button className="btn secondary" onClick={()=>call('beginItineraryNewShow')}><Icon name="plus" size={16}/> New show from itinerary</button><Spacer/></>;
  return <><p className="sheet-lede">Pick the show, then upload the file. This path only saves the attachment for now.</p><Field label="Show"><select id="itn-pick-show" className="input">{list.map(s=><option key={s.id} value={s.id}>{s.venue||'Show'} · {fmtDate(s.date)}</option>)}</select></Field><label className="btn" style={{marginTop:8}}><Icon name="plus" size={18}/> Upload itinerary<input type="file" accept="image/*,application/pdf" multiple hidden onChange={e=>call('submitItinerary',e.currentTarget,'existing')}/></label><Spacer/></>;
}
export function ItinerarySendingSheet(){
  return <><div className="empty" style={{padding:'28px 10px'}}><div className="ic"><Icon name="file" size={28}/></div><b>Sending your file…</b><span>Posted straight to your Make webhook. Waiting for show basics.</span></div><Spacer/></>;
}

const statuses=['confirmed','hold','cancelled'];
export function ItineraryReviewSheet({id,fields}){
  const it=itinerary(id),f=fields||it.scanFields||{},settings=store().settings||{};
  const normalDate=call('normalizeScanDate',f.date), normalTime=v=>call('normalizeScanTime',v)||'';
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const venue=f.venue||f.venueName||'',date=normalDate||it.date||today,status=f.status||'confirmed',cat=f.color||'purple';
  const color=(getCats()||{})[cat]||'#7c3aed';
  return <>
    <div className="dhero sheet-event-preview" id="ev-preview" style={{background:`linear-gradient(155deg,${color}33,var(--card) 65%)`,borderColor:`${color}44`}}><div className="cat-bar" style={{background:color}}/><div className="sheet-event-tone" style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color}}>New show from itinerary</div><div id="ev-preview-venue" style={{fontSize:20,fontWeight:800,marginTop:4}}>{venue||'Venue name'}</div></div>
    <Field label="Venue" id="itn-rev-venue" value={venue} placeholder="e.g. Shelter"/>
    <Field label="Address" id="itn-rev-addr" value={f.venueAddress||f.venueAddr} placeholder="Street and number"/>
    <Field label="Address line 2" id="itn-rev-addr2" value={f.venueAddress2||f.venueAddr2} placeholder="Building, floor, unit (optional)"/>
    <div className="row-2"><Field label="City" id="itn-rev-city" value={f.city} placeholder="Amsterdam"/><Field label="Region" id="itn-rev-region" value={f.venueRegion||f.region} placeholder="North Holland"/></div>
    <div className="row-2"><Field label="Postcode" id="itn-rev-postcode" value={f.venuePostcode||f.postcode} placeholder="1012 AB"/><Field label="Country" id="itn-rev-country" value={f.country} placeholder="Netherlands"/></div>
    <Field label="Date" id="itn-rev-date" type="date" value={date}/>
    <div className="row-2"><Field label="Set time" id="itn-rev-set" type="time" value={normalTime(f.setTime)||'23:00'}/><Field label="Arrival" id="itn-rev-arr" type="time" value={normalTime(f.arrival)}/></div>
    <div className="row-2"><Field label="End time" id="itn-rev-end" type="time" value={normalTime(f.endTime)}/><Field label="Artist" id="itn-rev-artist" value={f.artist||settings.artistName} placeholder={settings.artistName||'Artist'}/></div>
    <Field label="Status"><div className="seg" id="itn-rev-status">{statuses.map(s=><button type="button" data-v={s} className={status===s?'on':''} key={s} onClick={e=>call('segPick',e.currentTarget)}>{s[0].toUpperCase()+s.slice(1)}</button>)}</div></Field>
    <Field label="Content to capture" id="itn-rev-content" value={f.content} placeholder="e.g. 2x reels · crowd clip"/>
    <div className="field"><label>Internal notes</label><textarea id="itn-rev-notes" className="textarea" defaultValue={f.notes||f.remarks||''} placeholder="Team-only notes"/></div>
    <Field label="Colour"><div className="swatches" id="itn-rev-cat">{Object.entries(getCats()||{}).map(([k,v])=><div className={`sw${k===cat?' on':''}`} style={{background:v}} data-cat={k} key={k} onClick={e=>call('pickCat',e.currentTarget)}/>)}</div></Field>
    <button className="btn" id="itn-rev-save" onClick={()=>call('saveItineraryReview',id)}>Create show</button>
    <button className="btn secondary" style={{marginTop:10}} onClick={()=>call('scanItineraryForReview',id)}><Icon name="checkList" size={15}/> Send to Make again</button>
    <button className="btn danger" style={{marginTop:10}} onClick={()=>call('discardItineraryReview',id)}><Icon name="trash" size={15}/> Discard upload</button><Spacer/>
  </>;
}
export function ItineraryDiscardSheet({id}){
  const discard=()=>{
    const s=store(),it=(s.itineraries||[]).find(x=>x.id===id);
    if(it) call('notifyItineraryDecision',it,'cancelled',{reason:'discarded'});
    call('clearItineraryReviewGuards');
    s.itineraries=(s.itineraries||[]).filter(x=>x.id!==id);
    call('persist','user_preferences');
    call('closeSheet',true,{noReturn:true});
    call('renderView');
    call('toast','Upload discarded','trash');
  };
  return <><p style={{fontSize:15,color:'var(--text-2)',lineHeight:1.5,margin:'2px 2px 18px'}}>This cancels the itinerary and tells Make not to continue.</p><button className="btn danger" id="itn-discard-yes" onClick={discard}>Discard</button><Spacer/><button className="btn secondary" onClick={()=>call('sheetItineraryReview',id)}>Keep editing</button></>;
}
export function ItineraryDetailsSheet({id,item}){
  const it=item||itinerary(id), list=shows();
  return <><Field label="What is this?" id="itn-src" value={it.source} placeholder="ABOSS itinerary / Google flight status"/><div className="row-2"><Field label="Date" id="itn-date" type="date" value={it.date}/><Field label="Time (optional)" id="itn-time" type="time" value={it.time}/></div><Field label="For which show?"><select id="itn-show" className="input" defaultValue={it.showId||''}><option value="">— Not linked —</option>{list.map(s=><option key={s.id} value={s.id}>{s.venue} · {fmtDate(s.date)}</option>)}</select></Field><div className="field"><label>Notes</label><textarea id="itn-note" className="textarea" defaultValue={it.note||''} placeholder="Anything to flag — gate, hotel, key times…"/></div><div className="field"><label>Screenshots</label><div className="thumb-row">{(it.imgs||[]).map(im=><div className="thumb" key={im.id} onClick={()=>im.kind==='image'&&call('openViewer',im.data)}>{im.kind==='image'?<img src={im.data} alt=""/>:<div className="pdf"><Icon name="file" size={26}/><span>{im.name||'PDF'}</span></div>}<div className="del-badge" onClick={e=>{e.stopPropagation();call('delItinShot',id,im.id)}}><Icon name="x" size={13}/></div></div>)}<label className="thumb thumb-add"><Icon name="plus" size={22}/><span>Add</span><input type="file" accept="image/*,application/pdf" multiple hidden onChange={e=>call('addItineraryShots',id,e.currentTarget)}/></label></div></div><button className="btn" id="itn-save" onClick={()=>call('saveItinerary',id)}>Save itinerary</button><Spacer/></>;
}
