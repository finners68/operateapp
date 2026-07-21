/* Removal of uploaded items is only offered while editing from the Calendar tab,
   never in Trip Mode (day-of view stays clean). */
function passEditable(){
  return store.tab==='calendar' || (overlay && overlay.type==='event');
}
function passThumb(itemId, pass, delAction, flightId){
  const del = delAction?`<div class="del-badge" onclick="event.stopPropagation();${delAction}">${ICON.x(13)}</div>`:'';
  const open = flightId
    ? `openPassByRef('${itemId}','${pass.id}','${flightId}')`
    : `openPassByRef('${itemId}','${pass.id}')`;
  if(pass.kind==='image'){
    const src = esc(pass.data || '');
    return `<div class="thumb" onclick="${open}"><img src="${src}" alt="">${del}</div>`;
  }
  return `<div class="thumb" onclick="${open}"><div class="pdf">${ICON.file(26)}<span>${esc(pass.name||'Pass')}</span></div>${del}</div>`;
}

/* ============================================================
   CALENDAR
   ============================================================ */
let calCursor = null; // {y,m}
let lastCalRenderKey = '';
function viewCalendar(){
  const now = new Date();
  if(!calCursor) calCursor = {y:now.getFullYear(), m:now.getMonth()};
  const {y,m} = calCursor;
  const renderKey = `${y}-${m}-${calSel}-${calGridOpen}`;
  const fadeClass = renderKey !== lastCalRenderKey ? ' fade-in' : '';
  lastCalRenderKey = renderKey;
  const first = new Date(y,m,1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const prevDays = new Date(y,m,0).getDate();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

  const byDate = {};
  sel.events().forEach(e=>{ (byDate[e.date]=byDate[e.date]||[]).push(e); });

  let cells = '';
  for(let i=0;i<startDow;i++){ const d=prevDays-startDow+i+1; cells+=`<div class="cal-cell other">${d}</div>`; }
  for(let d=1;d<=daysInMonth;d++){
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    const evs = byDate[ds]||[];
    const sel_ = calSel===ds;
    cells += `<div class="cal-cell ${ds===todayStr?'today':''} ${evs.length?'has':''} ${sel_?'sel':''}" onclick="selectCalDay('${ds}')">
      ${d}${evs.length?`<div class="evt-dots">${evs.slice(0,3).map(e=>`<i style="background:${CATS[e.color]||CATS.purple}"></i>`).join('')}</div>`:''}
    </div>`;
  }
  const total = startDow+daysInMonth;
  for(let i=total;i%7!==0;i++){ cells+=`<div class="cal-cell other">${i-total+1}</div>`; }

  // Event list — selected day, else whole visible month sorted
  let listEvents;
  if(calSel){ listEvents = (byDate[calSel]||[]).slice().sort((a,b)=>(a.setTime||'').localeCompare(b.setTime||'')); }
  else { listEvents = store.events.filter(e=>{ const d=parseDT(e.date); return d&&d.getFullYear()===y&&d.getMonth()===m; }).sort((a,b)=>a.date.localeCompare(b.date)); }

  const calGridCard = `<div class="card${fadeClass} cal-grid-expanded" style="padding:16px 14px 14px">
      <div class="cal-head">
        <div class="cal-month">${MONTHS[m]} ${y}</div>
        <div class="cal-nav">
          <button onclick="calMove(-1)">${ICON.chevL(18)}</button>
          <button onclick="calToday()">${ICON.reminder(17)}</button>
          <button onclick="calMove(1)">${ICON.chevR(18)}</button>
        </div>
      </div>
      <div class="cal-grid">${DOW.map(d=>`<div class="cal-dow">${d[0]}</div>`).join('')}${cells}</div>
    </div>`;
  const calCollapsedStrip = `<div class="card tap${fadeClass} cal-grid-collapsed-strip" onclick="toggleCalGrid()">
      <div style="color:var(--accent-2)">${ICON.calendar(18)}</div>
      <div style="flex:1"><b style="font-size:15px">${MONTHS[m]} ${y}</b></div>
      <div class="cal-nav"><button onclick="event.stopPropagation();calMove(-1)">${ICON.chevL(16)}</button><button onclick="event.stopPropagation();calMove(1)">${ICON.chevR(16)}</button></div>
      <span style="color:var(--text-3)">${ICON.chevDown(18)}</span>
    </div>`;

  const showCount = sel.events().length;
  const calSub = showCount
    ? `${showCount} show${showCount!==1?'s':''} · tap a day to filter the list`
    : 'Tap + to add a show · swipe the calendar to change month';

  return `
  <div class="lg-header">
    <div><div class="lg-title">Calendar</div><div class="lg-sub">${calSub}</div></div>
    <div style="display:flex;gap:9px;align-items:center">
      <button class="header-btn" style="width:auto;padding:0 12px;gap:4px;border-radius:20px" onclick="toggleCalGrid()">${ICON.calendar(17)} ${(calGridOpen?ICON.chevUp:ICON.chevDown)(15)}</button>
      <button class="header-btn" onclick="sheetEvent()">${ICON.plus(22)}</button>
    </div>
  </div>
  <div class="screen-pad">
    ${pageIntro('calendar', 'Your master schedule', 'Coloured blocks are shows. Tap a day to see that day\'s list. Add or edit shows in the Shows tab — flights, hotels and checklists live inside each show.')}
    <div class="desktop-cal-split ${calGridOpen?'':'cal-grid-collapsed'}">
      <div class="desktop-cal-grid-col">
        ${calGridCard}
        ${calCollapsedStrip}
      </div>
      <div class="desktop-cal-agenda-col">
        ${(()=>{ const n=store.events.filter(showPassed).length; return n?`<div class="past-link" onclick="openView('pastshows')">${ICON.archive(13)} Past shows · ${n}${ICON.chevR(13)}</div>`:''; })()}
        <div class="section" style="margin-top:8px">
          <div class="section-head"><div class="section-title">${calSel?relDay(calSel):MONTHS[m]+' Agenda'}</div>${calSel?`<div class="section-link" onclick="clearCalSel()">Show whole month</div>`:''}</div>
          ${monthAgenda(y,m,todayStr)}
        </div>
      </div>
    </div>
    <div class="spacer"></div>
  </div>`;
}
let calGridOpen = true;
function toggleCalGrid(){ calGridOpen=!calGridOpen; haptic(); renderView(); }
/* Past shows — everything that finished more than 24h ago, newest first. */
function viewPastShows(){
  const past=store.events.filter(showPassed).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} ${overlayBackLabel()}</button>
    <div style="font-size:15px;font-weight:700">Past shows</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">
    <div class="hint" style="text-align:left;padding:12px 2px 6px">${past.length} show${past.length!==1?'s':''} that have wrapped. They move here automatically 24h after the set finishes.</div>
    ${past.length? `<div class="card flush">${past.map(eventRow).join('')}</div>` : `<div class="empty" style="margin-top:12px"><div class="ic">${ICON.calendar(26)}</div><b>No past shows yet</b><span>Shows land here 24h after they finish.</span></div>`}
    <div class="spacer"></div>
  </div>`;
}
/* A show counts as "past" 24h after its set finishes (endTime, else setTime, else end of day). */
function showPassed(e){
  if(e.kind && e.kind!=='show') return false;
  const t = e.endTime || e.setTime;
  let end = t ? parseDT(e.date, t) : parseDT(e.date);
  if(!end) return false;
  if(!t) end.setHours(23,59,0,0);
  return (Date.now() - end.getTime()) > 24*3600*1000;
}
/* Day-by-day agenda for a single month (ABOSS-style). Past shows drop out into the Past shows area. */
function monthAgenda(y,m,todayStr){
  const days={};
  store.events.forEach(e=>{ if(e.kind==='travel'||e.kind==='stay') return; // logistics live inside the show
    if(showPassed(e)) return; // moved to Past shows
    const d=parseDT(e.date); if(d&&d.getFullYear()===y&&d.getMonth()===m){ if(calSel && e.date!==calSel) return; (days[e.date]=days[e.date]||[]).push(e); } });
  const dates=Object.keys(days).sort();
  if(!dates.length) return `<div class="empty"><div class="ic">${ICON.calendar(26)}</div><b>Nothing ${calSel?'this day':'this month'}</b><span>Tap + (top right) to add a show with venue, date and set time.</span><button class="btn" style="margin-top:14px;max-width:220px" onclick="sheetEvent()">${ICON.plus(18)} Add show</button></div>`;
  return `<div class="stagger">`+dates.map(ds=>{
    const d=parseDT(ds); const items=days[ds].slice().sort(itemSort);
    return `<div class="agenda-day">
      <div class="agenda-date ${ds===todayStr?'today':''}"><span class="ad-dow">${DOW[d.getDay()]}</span><span class="ad-num">${d.getDate()}</span></div>
      <div class="agenda-list">${items.map(agendaItem).join('')}</div>
    </div>`;
  }).join('')+`</div>`;
}
function itemTimeKey(e){
  let hhmm = e.start || e.setTime || '';
  if(!hhmm && e.kind==='stay' && e.info){ const mt=e.info.match(/(\d{1,2}):(\d{2})/); if(mt) hhmm=mt[0]; }
  if(!hhmm) return -1;
  const [h,m]=hhmm.split(':').map(Number); let mins=h*60+(m||0);
  if(h<5) mins+=1440; // post-midnight items belong to the end of the touring day
  return mins;
}
function itemSort(a,b){
  const am=a.kind==='marker'?0:1, bm=b.kind==='marker'?0:1;
  if(am!==bm) return am-bm;              // all-day markers first
  return itemTimeKey(a)-itemTimeKey(b);  // then chronological (late-night last)
}
function legSort(a,b){ if((a.date||'')!==(b.date||'')) return (a.date||'').localeCompare(b.date||''); return itemTimeKey({start:a.start||a.info})-itemTimeKey({start:b.start||b.info}); }
function showLegs(eid){ return store.events.filter(x=>x.showId===eid && (x.kind==='travel'||x.kind==='stay')); }
function agendaItem(e){
  if(e.kind==='travel') return travBlock(e);
  if(e.kind==='stay') return stayBlock(e);
  if(e.kind==='marker') return markBlock(e);
  return showBlock(e);
}
function showBlock(e){
  const c = e.color==='orange' ? 'var(--orange)' : 'var(--green)';
  const time = e.setTime ? `${e.setTime}${e.endTime?' – '+e.endTime:''}` : 'TBA';
  return `<div class="ag-show" style="background:${c}" onclick="openView('event','${e.id}')">
    <div class="ag-show-b"><b>${esc(e.venue||e.title||'Show')}</b><span>${time}</span></div>
    <div class="ag-loc">LOC</div>
  </div>`;
}
function travBlock(e){
  normalizeLogisticItem(e);
  const d = logisticDisplayLines(e);
  return `<div class="ag-log" onclick="openItem('${e.id}')">
    <div class="ag-ic">${(ICON[e.icon]||ICON.plane)(18)}</div>
    <div class="ag-log-b">${detailParts(esc(d.title), d.primary?esc(d.primary):'', d.meta?esc(d.meta):'')}</div>
    <div class="ag-loc2">LOC</div>
  </div>`;
}
function stayBlock(e){
  normalizeLogisticItem(e);
  const d = logisticDisplayLines(e);
  return `<div class="ag-log" onclick="openItem('${e.id}')">
    <div class="ag-ic">${ICON.bed(18)}</div>
    <div class="ag-log-b">${detailParts(esc(d.title), d.primary?esc(d.primary):'', d.meta?esc(d.meta):'')}</div>
    <div class="ag-loc2">LOC</div>
  </div>`;
}
function markBlock(e){
  return `<div class="ag-mark" onclick="openItem('${e.id}')">
    <div class="ag-noent">${ICON.ban(20)}</div>
    <div class="ag-mark-b"><b>${esc(e.title)}</b><span>All Day</span></div>
  </div>`;
}
function logColor(l){
  if(l.kind==='stay') return 'var(--orange)';
  const ic=l.icon||'plane';
  return ic==='plane'?'var(--blue)':ic==='ferry'?'var(--teal)':ic==='car'?'var(--green)':ic==='walk'?'var(--text-2)':'var(--accent-2)';
}
/* Labeled quick-access widgets (logo + text) */
function jbtn(icon,label,onclick,cls){ return `<button class="jbtn ${cls||''}" onclick="event.stopPropagation();${onclick}">${icon}<span>${esc(label)}</span></button>`; }
function jbtnFile(icon,label,itemId,cls){ return `<label class="jbtn ${cls||''}">${icon}<span>${esc(label)}</span><input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadItemPass('${itemId}',this)"></label>`; }
function isDriverItem(l){ return l && l.kind==='travel' && ((l.icon||'plane')==='car' || /driver|uber|taxi/i.test(l.title||'')); }
function itemButtons(l){
  const isFlight = l.kind==='travel' && (l.icon||'plane')==='plane';
  const isDriver = isDriverItem(l);
  const b=[];
  if(isFlight){ const has=l.passes&&l.passes.length;
    if(has){ b.push(jbtn(ICON.ticket(15),'Boarding pass',`viewItemPass('${l.id}')`,'pass'));
      if(passEditable()) b.push(jbtn(ICON.trash(15),'Remove',`delItemPass('${l.id}')`,'danger')); }
    else b.push(jbtnFile(ICON.ticket(15),'Add boarding pass',l.id,'pass')); }
  if(isDriver){ if(l.phone){ b.push(jbtn(ICON.phone(15),'Call',`callNumber('${l.phone}')`,'call')); b.push(jbtn(ICON.chat(15),'Message',`whatsapp('${l.whatsapp||l.phone}')`,'call')); } else { b.push(jbtn(ICON.user(15),'Add contact',`openItem('${l.id}')`)); } }
  if(l.kind==='stay' && l.bookingRef){ b.push(jbtn(ICON.copy(15),'Ref '+esc(l.bookingRef),`copyText('${esc(l.bookingRef)}')`,'pass')); }
  // Driver/transfer legs open turn-by-turn directions (origin -> destination); other legs search the destination place.
  if(isDriver){ const rt=driverRoute(l);
    if(rt) b.push(jbtn(ICON.map(15),'Route',`openDirections('${esc(rt.origin)}','${esc(rt.dest)}')`));
    else { const mq=tlMapsQuery({kind:l.kind,title:l.title,icon:l.icon,ref:l}); if(mq) b.push(jbtn(ICON.map(15),'Maps',`openMaps('${esc(mq)}')`)); }
  } else { const mq=tlMapsQuery({kind:l.kind,title:l.title,icon:l.icon,ref:l}); if(mq) b.push(jbtn(ICON.map(15),'Maps',`openMaps('${esc(mq)}')`)); }
  return b.join('');
}
function setButtons(s){ const sh=sel.event(s.showId); const mq=tlMapsQuery(s); const b=[];
  if(mq) b.push(jbtn(ICON.map(15),'Venue',`openMaps('${esc(mq)}')`));
  if(sh&&sh.promoter&&sh.promoter.phone) b.push(jbtn(ICON.phone(15),'Promoter',`callNumber('${sh.promoter.phone}')`,'call'));
  if(sh) b.push(jbtn(ICON.music(15),'Show details',`openView('event','${sh.id}')`));
  return b.join('');
}
function stepButtons(s){ return s.kind==='set'?setButtons(s):itemButtons(s.ref); }
function journeyRow(l){
  const icon = l.kind==='stay'?'bed':(l.icon||'plane');
  const col = logColor(l);
  const btns = itemButtons(l);
  const isFlight = l.kind==='travel' && (l.icon||'plane')==='plane';
  return `<div class="jitem">
    <div class="jitem-top" onclick="openItem('${l.id}')">
      <div class="jic" style="background:${col}22;color:${col}">${(ICON[icon]||ICON.plane)(24)}</div>
      <div class="body tx">${logisticRowHtml(l)}</div>
      ${ICON.chevR(15)}
    </div>
    ${btns?`<div class="jitem-actions">${btns}</div>`:''}
    ${isFlight?flightInfoWidget(l):''}
    ${isFlight&&l.passes&&l.passes.length?`<div class="jitem-passes"><div class="thumb-row">${l.passes.map(p=>passThumb(l.id, p, passEditable()?`delItemPass('${l.id}','${p.id}')`:null)).join('')}</div></div>`:''}
  </div>`;
}
/* Journey grouped by day, chronological, each day collapsible */
function journeyByDay(e){
  const items = store.events.filter(x=>x.showId===e.id && (x.kind==='travel'||x.kind==='stay'));
  items.sort((a,b)=>{ if(a.date!==b.date) return a.date.localeCompare(b.date); return itemTimeKey({start:a.start||a.info})-itemTimeKey({start:b.start||b.info}); });
  const byDay={}; items.forEach(it=>{ (byDay[it.date]=byDay[it.date]||[]).push(it); });
  const dates=Object.keys(byDay).sort();
  if(!dates.length) return `<div class="card tap" onclick="addLogisticFor('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.plane(20)} Add flights, hotels & transfers</div>`;
  return dates.map(ds=>{ const d=parseDT(ds);
    return foldSection('jd'+e.id+ds, ICON.calendar(16), DOW[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()], byDay[ds].length+' item'+(byDay[ds].length>1?'s':''),
      byDay[ds].map(journeyRow).join(''), true);
  }).join('<div style="height:10px"></div>');
}
/* Adaptive quick-access grid under the show header — 2-4 tiles based on what's inputted */
function showQuickLinks(e){
  const items = store.events.filter(x=>x.showId===e.id);
  const flights = items.filter(x=>x.kind==='travel' && (x.icon||'plane')==='plane');
  const hotelItem = items.find(x=>x.kind==='stay');
  const drivers = items.filter(x=>x.kind==='travel' && isDriverItem(x));
  const tile=(icon,color,label,onclick)=>`<button class="act" onclick="${onclick}"><div class="ic" style="background:${color}22;color:${color}">${icon}</div><span>${label}</span></button>`;
  const tileFile=(icon,color,label,itemId)=>`<label class="act"><div class="ic" style="background:${color}22;color:${color}">${icon}</div><span>${label}</span><input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadItemPass('${itemId}',this)"></label>`;
  const tiles=[];
  tiles.push(tile(ICON.map(20),'var(--blue)','Venue',`openMaps('${esc(cleanVenue(e.venue)+' '+(e.venueAddr||e.city||''))}')`));
  if(flights.length){ const wp=flights.find(f=>f.passes&&f.passes.length);
    tiles.push(wp?tile(ICON.ticket(20),'var(--accent-2)','Boarding',`viewItemPass('${wp.id}')`):tileFile(ICON.ticket(20),'var(--accent-2)','Boarding',flights[0].id)); }
  if(hotelItem||e.hotel){ const q=e.hotel?((e.hotel.name||'')+' '+(e.hotel.address||e.city||'')):((hotelItem.place||hotelItem.title||'').replace(/^hotel\s*[-–:]?\s*/i,'').trim()+' '+(e.city||'')); tiles.push(tile(ICON.bed(20),'var(--orange)','Hotel',`openMaps('${esc(q)}')`)); }
  const drvPhone=e.driver&&e.driver.phone;
  if(drvPhone) tiles.push(tile(ICON.car(20),'var(--green)','Driver',`contactDriver('${e.id}')`));
  else if(drivers.length) tiles.push(tile(ICON.car(20),'var(--green)','Driver',`sheetDriver('${e.id}')`));
  if(e.promoter&&e.promoter.phone) tiles.push(tile(ICON.user(20),'var(--accent-2)','Contact',`callNumber('${e.promoter.phone}')`));
  const shown=tiles.slice(0,4);
  return `<div class="act-grid" style="grid-template-columns:repeat(${shown.length},1fr)">${shown.join('')}</div>`;
}
function toggleLogisticAddFields(){
  const kind = getSeg('al-kind') || 'travel';
  const tr = document.getElementById('al-travel-fields');
  const st = document.getElementById('al-stay-fields');
  const icon = getSeg('al-icon') || 'plane';
  const dr = document.getElementById('al-driver-name-wrap');
  if(tr) tr.style.display = kind==='travel' ? '' : 'none';
  if(st) st.style.display = kind==='stay' ? '' : 'none';
  if(dr) dr.style.display = (kind==='travel' && icon==='car') ? '' : 'none';
}
function addLogisticFor(showId){
  const e=sel.event(showId);
  openSheet('Add to journey', `
    <div class="field"><label>Type</label><div class="seg" id="al-kind">
      ${[['travel','Flight / transfer'],['stay','Hotel']].map(([k,l],i)=>`<button type="button" data-v="${k}" class="${i===0?'on':''}" onclick="segPick(this);toggleLogisticAddFields()">${l}</button>`).join('')}
    </div></div>
    <div id="al-travel-fields">
      <div class="field"><label>Travel mode</label><div class="seg" id="al-icon">
        ${[['plane','Flight'],['car','Driver'],['ferry','Ferry'],['walk','Walk']].map(([k,l],i)=>`<button type="button" data-v="${k}" class="${i===0?'on':''}" onclick="segPick(this);toggleLogisticAddFields()">${l}</button>`).join('')}
      </div></div>
      <div class="field"><label>Flight number (optional)</label><input id="al-code" class="input" placeholder="KL1008"></div>
      <div class="row-2">
        <div class="field"><label>From</label><input id="al-from" class="input" placeholder="AMS"></div>
        <div class="field"><label>To</label><input id="al-to" class="input" placeholder="ZTH"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>Departure</label><input id="al-start" type="time" class="input"></div>
        <div class="field"><label>Arrival</label><input id="al-end" type="time" class="input"></div>
      </div>
      <div class="field" id="al-driver-name-wrap" style="display:none"><label>Driver / company name</label><input id="al-driver-name" class="input" placeholder="e.g. Marco · Uber"></div>
    </div>
    <div id="al-stay-fields" style="display:none">
      <div class="field"><label>Hotel name</label><input id="al-place" class="input" placeholder="e.g. Hilton"></div>
      <div class="field"><label>Address</label><input id="al-addr" class="input" placeholder="Street, city"></div>
      <div class="field"><label>Check-in time</label><input id="al-checkin" type="time" class="input"></div>
    </div>
    <div class="field"><label>Date</label><input id="al-date" type="date" class="input" value="${e?e.date:''}"></div>
    <button class="btn" onclick="saveLogisticFor('${showId}')">Add</button><div class="spacer"></div>
  `);
  setTimeout(toggleLogisticAddFields, 30);
}
function saveLogisticFor(showId){
  const kind=getSeg('al-kind')||'travel';
  const date=rawVal('al-date')|| sel.event(showId).date;
  const it={id:uid('evt'), kind, date, showId};
  if(kind==='travel'){
    const icon = getSeg('al-icon') || 'plane';
    it.icon = icon;
    it.from = (val('al-from')||'').toUpperCase().trim();
    it.to = (val('al-to')||'').toUpperCase().trim();
    it.flightNo = (val('al-code')||'').toUpperCase().trim();
    it.start = rawVal('al-start');
    it.end = rawVal('al-end');
    if(icon==='car') it.driverName = val('al-driver-name');
    if(!it.from && !it.to && !it.start && !it.driverName){ toast('Add a route, driver name, or time','x'); return; }
    it.title = logisticTypeLabel(it);
  } else {
    it.place = val('al-place');
    it.addr = val('al-addr');
    it.info = rawVal('al-checkin') ? ('Check-in: '+rawVal('al-checkin')) : '';
    it.icon = 'bed';
    it.title = 'Hotel';
    if(!it.place && !it.addr){ toast('Add a hotel name or address','x'); return; }
  }
  store.events.push(it); persist(); closeSheet(); renderView(); toast('Added to journey','check');
}
/* Lightweight editor for travel / stay / marker items */
function openItem(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  normalizeLogisticItem(e);
  const label = e.kind==='travel'?'Travel':e.kind==='stay'?'Stay':'Note';
  const iconOpts = ['plane','car','ferry','walk','bed'];
  openSheet(label, `
    <div class="field"><label>Date</label><input id="it-date" type="date" class="input" value="${e.date}"></div>
    ${e.kind==='travel'?`
      <div class="field"><label>Travel mode</label><div class="seg" id="it-icon">${iconOpts.slice(0,4).map(ic=>`<button type="button" data-v="${ic}" class="${(e.icon||'plane')===ic?'on':''}" onclick="segPick(this)">${ic==='plane'?'Flight':ic==='car'?'Driver':ic==='ferry'?'Ferry':'Walk'}</button>`).join('')}</div></div>
      <div class="field"><label>Flight number (optional)</label><input id="it-code" class="input" value="${esc(e.flightNo||'')}" placeholder="KL1008"></div>
      ${(e.icon||'plane')==='car'?`<div class="field"><label>Driver / company name</label><input id="it-driver-name" class="input" value="${esc(e.driverName||'')}" placeholder="Marco"></div>`:''}
      <div class="row-2">
        <div class="field"><label>From</label><input id="it-from" class="input" value="${esc(e.from||'')}" placeholder="AMS"></div>
        <div class="field"><label>To</label><input id="it-to" class="input" value="${esc(e.to||'')}" placeholder="ZTH"></div>
      </div>
      <div class="row-2"><div class="field"><label>Departure</label><input id="it-start" type="time" class="input" value="${e.start||''}"></div><div class="field"><label>Arrival</label><input id="it-end" type="time" class="input" value="${e.end||''}"></div></div>
      ${isDriverItem(e)?`<div class="field"><label>Driver phone</label><input id="it-phone" type="tel" class="input" value="${esc(e.phone||'')}" placeholder="+34 600 000 000"></div>
      <div class="field"><label>WhatsApp (if different)</label><input id="it-wa" type="tel" class="input" value="${esc(e.whatsapp||'')}"></div>`:''}`:''}
    ${e.kind==='stay'?`<div class="field"><label>Hotel name</label><input id="it-place" class="input" value="${esc(e.place||'')}" placeholder="Hilton"></div>
      <div class="field"><label>Address</label><input id="it-addr" class="input" value="${esc(e.addr||'')}" placeholder="Hotel address"></div>
      <div class="field"><label>Check-in</label><input id="it-info" class="input" value="${esc((e.info||'').replace(/^Check-in:\s*/i,''))}" placeholder="14:00"></div>
      <div class="field"><label>Booking reference</label><input id="it-ref" class="input" value="${esc(e.bookingRef||'')}" placeholder="Confirmation number"></div>`:''}
    <button class="btn" onclick="saveItem('${id}')">Save</button>
    <div class="spacer"></div>
    <button class="btn danger" onclick="delItem('${id}')">${ICON.trash(15)} Delete</button>
    <div class="spacer"></div>
  `);
}
function saveItem(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  e.date=rawVal('it-date')||e.date;
  if(e.kind==='travel'){
    e.icon=getSeg('it-icon')||e.icon||'plane';
    e.from=(val('it-from')||'').toUpperCase().trim();
    e.to=(val('it-to')||'').toUpperCase().trim();
    e.flightNo=(val('it-code')||'').toUpperCase().trim();
    e.start=rawVal('it-start');
    e.end=rawVal('it-end');
    if((e.icon||'plane')==='car') e.driverName=val('it-driver-name');
    else e.driverName='';
    e.title=logisticTypeLabel(e);
    if(isDriverItem(e)){ e.phone=val('it-phone'); e.whatsapp=val('it-wa'); }
  }
  if(e.kind==='stay'){
    e.place=val('it-place');
    e.addr=val('it-addr');
    const ci=rawVal('it-info')||val('it-info');
    e.info=ci ? (ci.includes('Check-in')?ci:'Check-in: '+ci) : '';
    e.bookingRef=val('it-ref');
    e.title='Hotel';
  }
  persist(); closeSheet(); renderView(); toast('Saved','check');
}
function delItem(id){ store.events=store.events.filter(x=>x.id!==id); persist(); closeSheet(); renderView(); toast('Deleted','trash'); }
let calSel = null;
function calMove(d){ calCursor.m+=d; if(calCursor.m<0){calCursor.m=11;calCursor.y--;} if(calCursor.m>11){calCursor.m=0;calCursor.y++;} calSel=null; renderView(); }
function calToday(){ const n=new Date(); calCursor={y:n.getFullYear(),m:n.getMonth()}; calSel=null; renderView(); }
function selectCalDay(ds){ calSel = (calSel===ds?null:ds); haptic(); renderView(); }
function clearCalSel(){ calSel=null; renderView(); }

function eventRow(e){
  const st = e.status==='confirmed'?'confirmed':e.status==='hold'?'hold':e.status==='cancelled'?'cancelled':'past';
  const past = parseDT(e.date) < new Date().setHours(0,0,0,0);
  return `<div class="row" onclick="openView('event','${e.id}')">
    <div class="ic" style="background:${CATS[e.color]||CATS.purple}22;color:${CATS[e.color]||CATS.purple}">${ICON.music(18)}</div>
    <div class="body"><b>${esc(e.venue||'Untitled show')}</b><span>${esc(e.city)}${e.country?', '+esc(e.country):''} · ${e.setTime?esc(e.setTime):'—'}</span></div>
    <div class="trail"><span class="dot" style="width:0"></span><span style="font-size:12px">${esc(relDay(e.date))}</span>${ICON.chevR(15)}</div>
  </div>`;
}
