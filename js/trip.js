/* ============================================================
   TRIP MODE  (Home takes over when a trip is active)
   ============================================================ */
function viewTripMode(run){
  const today = new Date(); today.setHours(0,0,0,0);
  const nextShow = run.shows.find(e=>{ const d=parseDT(e.date); return d && d>=today; }) || run.shows[run.shows.length-1];
  const tl = runTimeline(run);
  const nextTravelIdx = tl.findIndex(s=>!s.done);
  const nextStep = nextTravelIdx>=0 ? tl[nextTravelIdx] : null;
  const thenStep = nextTravelIdx>=0 ? tl[nextTravelIdx+1] : null;
  const p = runProgress(run);
  const pk = store.packing||[];

  return `
  <div class="lg-header">
    <div><div class="lg-title" style="font-size:28px">${esc(run.title)}</div><div class="lg-sub">Trip Mode · ${run.shows.length} show${run.shows.length>1?'s':''} · ${p.done}/${p.total} done</div></div>
    <button class="header-btn" onclick="openView('trip','${run.key}')">${ICON.chevR(20)}</button>
  </div>
  <div class="screen-pad stagger">
    <div class="tripmode-banner"><span class="pulse"></span> LIVE · ${fmtDate(run.start)}${run.end!==run.start?' – '+fmtDate(run.end):''}</div>

    ${nextStep?`
    <div class="hero" style="background:linear-gradient(155deg,#1e3a2a,#15251d 60%,#141418)">
      <div class="hero-label" style="color:var(--green)">${ICON.clock(14)} Up next${nextStep.time?' · '+esc(nextStep.time):''} · ${esc(relDay(nextStep.date))}</div>
      <div class="hero-venue">${esc(nextStep.title)}</div>
      ${nextStep.sub?`<div class="hero-city">${esc(nextStep.sub)}</div>`:''}
      <button class="btn" style="margin-top:16px;background:var(--green);box-shadow:0 8px 24px rgba(50,215,75,0.3)" onclick="completeRunStep('${run.key}','${nextStep.id}')">${ICON.check(18)} Mark done</button>
    </div>
    ${thenStep?`<div class="then-next">
      <div class="then-lab">Then</div>
      <div class="then-ic">${(ICON[thenStep.icon]||ICON.clock)(15)}</div>
      <div class="then-body"><b>${esc(thenStep.title)}</b><span>${thenStep.time?esc(thenStep.time)+' · ':''}${esc(relDay(thenStep.date))}${thenStep.sub?' · '+esc(thenStep.sub):''}</span></div>
    </div>`:''}`:`
    <div class="hero" style="background:linear-gradient(155deg,#1e3a2a,#15251d 60%,#141418)">
      <div class="hero-label" style="color:var(--green)">${ICON.check(14)} All steps complete</div>
      <div class="hero-venue">You're on top of it 🎧</div>
    </div>`}

    <div class="section">
      <div class="act-grid">
        <button class="act" onclick="openMaps('${esc(nextShow?(nextShow.venue+' '+(nextShow.venueAddr||nextShow.city)):run.title)}')"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.map(20)}</div><span>Venue</span></button>
        <button class="act" onclick="openView('event','${nextShow?nextShow.id:''}')"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.music(20)}</div><span>Show</span></button>
        <button class="act" onclick="go('calendar')"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.calendar(20)}</div><span>Calendar</span></button>
        <button class="act" onclick="openView('contacts')"><div class="ic" style="background:var(--orange-soft);color:var(--orange)">${ICON.user(20)}</div><span>Contacts</span></button>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">Shows on this tour</div><div class="section-link">${run.shows.length}</div></div>
      <div class="card flush">${run.shows.map((e,i)=>tripLegRow(e,i,nextShow)).join('')}</div>
    </div>

    <div class="section">
      ${foldSection('tm-timeline'+run.key, ICON.clock(17), 'Day timeline', tl.filter(x=>x.done).length+'/'+tl.length+' done'+(nextStep&&nextStep.time?' · next '+nextStep.time:''),
        `<div class="fold-pad"><div class="timeline">${tl.map((s,idx)=>runTlItem(run.key,s,idx===nextTravelIdx)).join('')||'<div class="hint">No steps yet</div>'}</div></div>`, true)}
    </div>

    <div class="section">
      ${foldSection('tm-pack', ICON.checkList(17), 'Packing & checklist', pk.filter(i=>i.done).length+'/'+pk.length+' packed',
        `<div style="padding:0 16px 4px"><div class="progress" style="margin:12px 0 4px"><i style="width:${pk.length?Math.round(pk.filter(i=>i.done).length/pk.length*100):0}%"></i></div></div>
         <div class="fold-scroll">${pk.map(i=>`<div class="check ${i.done?'done':''}"><div class="box" onclick="togglePack('${i.id}')">${ICON.check(15)}</div><div class="lbl" onclick="togglePack('${i.id}')">${esc(i.label)}</div><button class="del" onclick="delPack('${i.id}')">${ICON.x(16)}</button></div>`).join('')||'<div class="hint">No items</div>'}</div>
         <div class="fold-pad"><button class="btn secondary" style="padding:11px" onclick="addPackPrompt()">${ICON.plus(15)} Add item</button></div>`, false)}
    </div>

    <div class="section">
      <button class="btn secondary" onclick="endTripMode()">${ICON.flag(18)} End Trip Mode</button>
    </div>
    <div class="spacer"></div>
  </div>`;
}
function tripLegRow(e, i, nextEvent){
  const c = CATS[e.color]||CATS.green;
  const isNext = nextEvent && e.id===nextEvent.id;
  // NEXT show: full semi-transparent orange card, all one tone
  const bg = isNext ? 'background:rgba(255,159,10,0.13);' : '';
  // Marker: completed = green tick, next = orange number, upcoming = neutral grey number
  const icBg = e.setDone ? 'rgba(50,215,75,0.18)' : isNext ? 'rgba(255,159,10,0.22)' : 'rgba(255,255,255,0.05)';
  const icCol = e.setDone ? 'var(--green)' : isNext ? 'var(--orange)' : 'var(--text-3)';
  return `<div class="row" style="${bg}" onclick="openView('event','${e.id}')">
    <div class="ic" style="background:${icBg};color:${icCol};font-weight:800;font-size:13px">${e.setDone?ICON.check(16):i+1}</div>
    <div class="body"><b>${esc(e.venue)} ${isNext?'<span class="tag hold" style="margin-left:4px">Next</span>':''}</b><span>${esc(e.city)}${e.country?', '+esc(e.country):''} · ${esc(fmtDate(e.date))}${e.setTime?' · '+esc(e.setTime):''}</span></div>
    ${ICON.chevR(15)}
  </div>`;
}
function stepShow(s){ if(s.kind==='set') return sel.event(s.showId); if(s.ref&&s.ref.showId) return sel.event(s.ref.showId); return null; }
/* City-aware maps query — always append the show's city/area so searches resolve */
/* Turn a route token (Hotel / Airport / Venue / a place name) into a searchable place with city context. */
function resolvePlace(token, sh, city){
  const t=(token||'').replace(/\[[^\]]*\]/g,'').trim();
  if(!t) return '';
  if(/^venue$/i.test(t)) return sh?(cleanVenue(sh.venue)+' '+(sh.venueAddr||city||'')):('venue '+city);
  if(/^hotel$/i.test(t)) return (sh&&sh.hotel&&sh.hotel.name?sh.hotel.name+' ':'hotel ')+city;
  if(/^airport$/i.test(t)) return (city?city+' ':'')+'airport';
  return t + (city && !t.toLowerCase().includes(city.toLowerCase()) ? ' '+city : '');
}
/* A driver/transfer leg is a journey (origin > destination) — return both ends for directions. */
function driverRoute(l){
  if(l) normalizeLogisticItem(l);
  const sh=(l&&l.showId)?sel.event(l.showId):null; const city=sh?(sh.city||''):'';
  if(l && (l.from || l.to)){
    const origin=resolvePlace(l.from, sh, city);
    const dest=resolvePlace(l.to, sh, city);
    if(origin&&dest) return {origin, dest};
  }
  const route=(l&&l.title||'').replace(/^\[?[^-\]]*\]?\s*-\s*/,'');
  const parts=route.split('>');
  if(parts.length<2) return null;
  const origin=resolvePlace(parts[0], sh, city);
  const dest=resolvePlace(parts[parts.length-1], sh, city);
  if(!origin||!dest) return null;
  return {origin, dest};
}
/* Open turn-by-turn directions (native Maps on iOS). */
function openDirections(origin, dest){
  const o=encodeURIComponent(origin), d=encodeURIComponent(dest);
  openExternal('https://www.google.com/maps/dir/?api=1&origin='+o+'&destination='+d, 'maps://?saddr='+o+'&daddr='+d);
  toast('Opening route','map');
}
function tlMapsQuery(s){
  const sh=stepShow(s); const city=sh?(sh.city||''):'';
  const it = s.ref || s;
  if(s.kind==='set'){ return sh?(cleanVenue(sh.venue)+' '+(sh.venueAddr||sh.city||'')):''; }
  if(s.kind==='stay'){
    if(it && it.kind==='stay') normalizeLogisticItem(it);
    const name = (it&&it.place) || (it&&it.addr) || (s.title||'').replace(/^.*hotel\s*-\s*/i,'').replace(/^\[[^\]]*\]\s*-?\s*/,'').trim();
    return name+(city?' '+city:'');
  }
  if(s.kind==='travel'){
    if(it && it.kind==='travel') normalizeLogisticItem(it);
    let dest = (it&&it.to) ? String(it.to).trim() : '';
    if(!dest){
      const parts=(s.title||'').split('>');
      dest=parts.length>1?parts[parts.length-1].trim():'';
    }
    if(/^venue$/i.test(dest)) return sh?(cleanVenue(sh.venue)+' '+(sh.venueAddr||sh.city||'')):dest;
    if(/^hotel$/i.test(dest)) return 'hotel '+(city||'');
    if(/^airport$/i.test(dest)) return (city?city+' ':'')+'airport';
    if((s.icon||'plane')==='plane' && /^[A-Z]{3}$/i.test(dest)) return dest.toUpperCase()+' airport';
    return dest+(city&&!dest.toLowerCase().includes(city.toLowerCase())?' '+city:'');
  }
  return '';
}
/* Adaptive action widgets for a step, based on what it is */
function stepPills(s){
  const sh=stepShow(s); const pills=[];
  const mq=tlMapsQuery(s);
  const mapPill=(label,sub)=>`<div class="pill" onclick="event.stopPropagation();openMaps('${esc(mq)}')"><div class="ic">${ICON.map(16)}</div><div class="tx"><b>${label}</b><span>${sub}</span></div></div>`;
  if(s.kind==='travel'){
    const isFlight=(s.icon||'plane')==='plane';
    if(isFlight){
      const it=s.ref; const has=it&&it.passes&&it.passes.length;
      if(mq) pills.push(mapPill('Maps','Open in Maps'));
      if(has) pills.push(`<div class="pill" onclick="event.stopPropagation();viewItemPass('${it.id}')"><div class="ic">${ICON.ticket(16)}</div><div class="tx"><b>Boarding pass</b><span>View</span></div></div>`);
      else pills.push(`<label class="pill"><div class="ic">${ICON.ticket(16)}</div><div class="tx"><b>Boarding pass</b><span>Upload</span></div><input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadItemPass('${it.id}',this)"></label>`);
    } else {
      const it=s.ref;
      if(it&&it.phone){ pills.push(`<div class="pill" onclick="event.stopPropagation();callNumber('${it.phone}')"><div class="ic">${ICON.phone(16)}</div><div class="tx"><b>Call driver</b><span>Now</span></div></div>`);
        pills.push(`<div class="pill" onclick="event.stopPropagation();whatsapp('${it.whatsapp||it.phone}')"><div class="ic">${ICON.chat(16)}</div><div class="tx"><b>Message</b><span>WhatsApp</span></div></div>`); }
      else { pills.push(`<div class="pill" onclick="event.stopPropagation();openItem('${it.id}')"><div class="ic">${ICON.car(16)}</div><div class="tx"><b>Driver</b><span>Add contact</span></div></div>`); }
      if(mq) pills.push(mapPill('Destination','Open in Maps'));
    }
  } else if(s.kind==='stay'){
    if(mq) pills.push(mapPill('Hotel','Open in Maps'));
    if(sh) pills.push(`<div class="pill" onclick="event.stopPropagation();openView('event','${sh.id}')"><div class="ic">${ICON.bed(16)}</div><div class="tx"><b>Details</b><span>Full show</span></div></div>`);
  } else if(s.kind==='set'){
    if(sh){
      if(mq) pills.push(mapPill('Venue', sh.venueAddr?esc(sh.venueAddr.slice(0,22)):'Open in Maps'));
      if(sh.promoter&&sh.promoter.phone) pills.push(`<div class="pill" onclick="event.stopPropagation();callNumber('${sh.promoter.phone}')"><div class="ic">${ICON.user(16)}</div><div class="tx"><b>Promoter</b><span>Call</span></div></div>`);
      else pills.push(`<div class="pill" onclick="event.stopPropagation();openView('event','${sh.id}')"><div class="ic">${ICON.music(16)}</div><div class="tx"><b>Show</b><span>All details</span></div></div>`);
    }
  }
  return pills.join('');
}
/* Compact per-step actions (icon buttons) for the day timeline rows */
function tlActions(s){
  const btns=[]; const mq=tlMapsQuery(s);
  if(mq) btns.push(`<button class="tl-btn" onclick="event.stopPropagation();openMaps('${esc(mq)}')">${ICON.map(15)}</button>`);
  const sh=stepShow(s);
  const isFlight=s.kind==='travel'&&(s.icon||'plane')==='plane';
  if(isFlight){ const it=s.ref; const has=it&&it.passes&&it.passes.length;
    if(has) btns.push(`<button class="tl-btn" onclick="event.stopPropagation();viewItemPass('${it.id}')">${ICON.ticket(15)}</button>`);
    else btns.push(`<label class="tl-btn">${ICON.ticket(15)}<input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadItemPass('${it.id}',this)"></label>`); }
  const isDriver=s.kind==='travel'&&((s.icon||'plane')==='car'||(s.ref&&isDriverItem(s.ref)));
  if(isDriver&&sh&&sh.driver&&sh.driver.phone){ btns.push(`<button class="tl-btn" onclick="event.stopPropagation();callNumber('${sh.driver.phone}')">${ICON.phone(15)}</button>`); }
  return btns.join('');
}
function viewItemPass(itemId){ const it=store.events.find(x=>x.id===itemId); const p=(it&&it.passes||[])[0]; if(!p){toast('No pass','x');return;} if(p.kind==='image') openViewer(p.data); else toast('PDF pass saved on device','file'); }
function uploadItemPass(itemId, input){ toast('Uploading pass…','ticket'); readFile(input, att=>{ const it=store.events.find(x=>x.id===itemId); if(!it) return; (it.passes=it.passes||[]).push(att); persist(); renderView(); toast('Boarding pass added','check'); hostImg(att, it.showId||it.id, 'pass', itemId); }); }
/* Group the run timeline by day (clearer, day-by-day) */
function runTimelineByDay(run){
  const rows=runTimeline(run); const byDay={};
  rows.forEach(r=>{ (byDay[r.date]=byDay[r.date]||[]).push(r); });
  return Object.keys(byDay).sort().map(d=>({date:d, rows:byDay[d]}));
}
/* Day-by-day, each day a collapsible dropdown — collapsed by default except the current day.
   Keeps Trip Mode calm: you only open the day you want. */
function dayTimeline(runKey, run){
  const groups=runTimelineByDay(run);
  if(!groups.length) return '<div class="hint">Add flights & hotels inside each show</div>';
  const next=runTimeline(run).find(s=>!s.done);
  const openDate=next?next.date:(groups[0]&&groups[0].date);
  const todayStr=(()=>{const n=new Date();return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;})();
  return groups.map(g=>{
    const d=parseDT(g.date); const done=g.rows.filter(r=>r.done).length;
    const allDone=g.rows.length>0 && done===g.rows.length;
    const setRow=g.rows.find(r=>r.kind==='set');
    const label=DOW[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+(g.date===todayStr?' · Today':'');
    const sub=(setRow?setRow.title+' · ':'')+done+'/'+g.rows.length+' done'; // raw — foldSection escapes
    return foldSection('tld'+runKey+g.date, allDone?ICON.check(16):ICON.calendar(16), label, sub, g.rows.map(s=>tlRow(runKey,s)).join(''), allDone?false:(g.date===openDate), allDone?'fold-done':'');
  }).join('<div style="height:10px"></div>');
}
function tlRow(runKey, s){
  const isSet=s.kind==='set';
  const col=isSet?'var(--accent-2)':logColor({kind:s.kind,icon:s.icon});
  const btns=stepButtons(s);
  return `<div class="tlr ${s.done?'done':''}">
    <button class="tlr-tick ${s.done?'on':''}" onclick="completeRunStep('${runKey}','${s.id}')">${s.done?ICON.check(13):''}</button>
    <div class="tlr-time">${esc(s.time||'')}</div>
    <div class="tlr-ic" style="color:${col}">${(ICON[s.icon]||ICON.clock)(19)}</div>
    <div class="tlr-body" onclick="${isSet?`openView('event','${s.showId}')`:`completeRunStep('${runKey}','${s.id}')`}"><b>${esc(s.title)}</b>${s.sub?`<span>${esc(s.sub)}</span>`:''}</div>
    ${btns?`<div class="tlr-actions">${btns}</div>`:''}
  </div>`;
}

function tlItem(tripId, s, isNow){
  return `<div class="tl-item ${s.done?'done':''} ${isNow&&!s.done?'now':''}">
    <div class="tl-time">${esc(s.time)}</div>
    <div class="tl-line"><div class="tl-node"></div></div>
    <div class="tl-card" onclick="completeStep('${tripId}','${s.id}')">
      <b>${esc(s.title)}</b>${s.sub?`<span>${esc(s.sub)}</span>`:''}
      ${!s.done?`<div class="swipe-hint">${ICON.check(12)} Tap to complete</div>`:''}
    </div>
  </div>`;
}
/* ============================================================
   TRIPS  (list)
   ============================================================ */
function viewTrips(){
  const today = new Date(); today.setHours(0,0,0,0);
  const all = runs();
  const upcoming = all.filter(r=> parseDT(r.end) >= today);
  const past = all.filter(r=> parseDT(r.end) < today).reverse();
  return `
  <div class="lg-header">
    <div><div class="lg-title">Tours</div><div class="lg-sub">Grouped from your shows${activeRun()?' · 1 live now':''}</div></div>
    <button class="header-btn" onclick="go('calendar')">${ICON.calendar(20)}</button>
  </div>
  <div class="screen-pad">
    ${pageIntro('tours', 'Tours group themselves', 'When you add shows in Calendar, nearby dates auto-form a tour run — no manual setup. Tap a tour for day-of timeline and packing.')}
    ${tabBlurb('Shows on back-to-back dates become one tour. Flying home ends the run.')}
    ${upcoming.length?`<div class="stagger">${upcoming.map(runCard).join('')}</div>`
      :`<div class="empty"><div class="ic">${ICON.trips(28)}</div><b>No upcoming tours</b><span>Add shows in Calendar first — they appear here grouped by date.</span><button class="btn secondary" style="margin-top:14px;max-width:240px" onclick="go('calendar')">${ICON.calendar(18)} Go to Calendar</button></div>`}
    ${past.length?`<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px;color:var(--text-2)">Past</div></div>
      <div class="card flush">${past.slice(0,12).map(runRow).join('')}</div></div>`:''}
    <div class="spacer"></div>
  </div>`;
}
function runCard(r){
  const c = CATS[r.color]||CATS.green;
  const active = activeRun() && activeRun().key===r.key;
  const p = runProgress(r);
  return `<div class="card tap" style="margin-bottom:14px;border-color:${active?c+'66':'var(--stroke)'}" onclick="openView('trip','${r.key}')">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="ic" style="width:44px;height:44px;border-radius:13px;background:${c}22;color:${c};display:flex;align-items:center;justify-content:center">${ICON.trips(22)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px"><b style="font-size:17px;font-weight:700">${esc(r.title)}</b>${active?'<span class="tag confirmed">Live</span>':''}</div>
        <div style="font-size:13px;color:var(--text-2);margin-top:2px">${fmtDate(r.start)}${r.end!==r.start?' – '+fmtDate(r.end):''}</div>
      </div>
      ${ICON.chevR(18)}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12.5px;color:var(--text-3);font-weight:600"><span>${r.shows.length} show${r.shows.length!==1?'s':''}</span><span>${esc(relDay(r.start))}</span></div>
  </div>`;
}
function runRow(r){
  const c = CATS[r.color]||CATS.green;
  return `<div class="row" onclick="openView('trip','${r.key}')">
    <div class="ic" style="background:${c}22;color:${c}">${ICON.trips(18)}</div>
    <div class="body"><b>${esc(r.title)}</b><span>${r.shows.length} show${r.shows.length!==1?'s':''} · ${fmtDate(r.start)}</span></div>
    ${ICON.chevR(15)}
  </div>`;
}
/* ============================================================
   TRIP DETAIL
   ============================================================ */
function viewTrip(id){
  const r = runOf(id);
  if(!r) return backStub();
  const c = CATS[r.color]||CATS.green;
  const active = activeRun() && activeRun().key===r.key;
  const tl = runTimeline(r);
  const pk = store.packing||[];
  const today = new Date(); today.setHours(0,0,0,0);
  const nextIdx = tl.findIndex(s=>!s.done);
  const nextStep = nextIdx>=0 ? tl[nextIdx] : null;
  const thenStep = nextIdx>=0 ? tl[nextIdx+1] : null;
  const legShow = nextStep ? (stepShow(nextStep) || r.shows.find(s=>!s.setDone)) : null;
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Tours</button>
    <div style="font-size:15px;font-weight:700">${active?'Trip Mode':'Tour'}</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">
    <div class="dhero" style="background:linear-gradient(155deg,${c}33,var(--card) 65%)">
      <div class="cat-bar" style="background:${c}"></div>
      ${active?`<div style="margin-bottom:8px"><span class="tag confirmed"><span class="pulse" style="display:inline-block;margin-right:5px"></span>Live</span></div>`:''}
      <h1>${esc(r.title)}</h1>
      <div class="sub">${ICON.calendar(14)} ${fmtDateLong(r.start)}${r.end!==r.start?' – '+fmtDate(r.end):''}</div>
    </div>

    ${active?'':`<div class="section" style="margin-top:14px"><button class="btn" onclick="startTripFromShow('${r.shows[0].id}')">${ICON.play(18)} Start Trip Mode</button></div>`}

    <!-- 1) UP NEXT — the next thing to do; adaptive widgets; small tick advances -->
    <div class="section" style="margin-top:14px">
      <div class="section-head"><div class="section-title">Up next</div></div>
      ${nextStep ? `
      <div class="hero nextshow">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div class="hero-label">${(ICON[nextStep.icon]||ICON.clock)(14)} ${esc(relDay(nextStep.date))}${nextStep.time?' · '+esc(nextStep.time):''}</div>
          <button class="mini-tick" onclick="completeRunStep('${r.key}','${nextStep.id}')" title="Done — next">${ICON.check(15)}</button>
        </div>
        <div class="hero-venue" style="font-size:22px;margin-top:6px">${esc(nextStep.title)}</div>
        ${nextStep.sub?`<div class="hero-city">${esc(nextStep.sub)}</div>`:''}
        <div class="hero-info" style="margin-top:15px;flex-wrap:wrap">${stepPills(nextStep)}</div>
        ${(nextStep.ref && nextStep.kind==='travel' && (nextStep.ref.icon||'plane')==='plane')?flightInfoWidget(nextStep.ref):''}
      </div>
      ${thenStep?`<div class="then-next">
        <div class="then-lab">Then</div>
        <div class="then-ic">${(ICON[thenStep.icon]||ICON.clock)(15)}</div>
        <div class="then-body"><b>${esc(thenStep.title)}</b><span>${thenStep.time?esc(thenStep.time)+' · ':''}${esc(relDay(thenStep.date))}${thenStep.sub?' · '+esc(thenStep.sub):''}</span></div>
      </div>`:''}` : `<div class="card" style="text-align:center;color:var(--text-2);padding:22px">${ICON.check(24)}<div style="margin-top:6px;font-weight:650">Tour complete 🎧</div></div>`}
    </div>

    <!-- 2) DAY TIMELINE — each day is its own dropdown, collapsed by default -->
    <div class="section">
      <div class="section-head"><div class="section-title">Day timeline</div><div class="section-link">${r.shows.length} day${r.shows.length!==1?'s':''}</div></div>
      ${dayTimeline(r.key, r)}
    </div>

    <!-- 3) SHOWS ON THIS TOUR -->
    <div class="section">
      <div class="section-head"><div class="section-title">Shows on this tour</div><div class="section-link">${r.shows.length}</div></div>
      <div class="card flush">${r.shows.map((e,i)=>tripLegRow(e,i,legShow)).join('')}</div>
    </div>

    <!-- Packing -->
    <div class="section">
      ${foldSection('trip-pack', ICON.checkList(17), 'Packing & checklist', pk.filter(i=>i.done).length+'/'+pk.length+' packed',
        `<div style="padding:0 16px 4px"><div class="progress" style="margin:12px 0 4px"><i style="width:${pk.length?Math.round(pk.filter(i=>i.done).length/pk.length*100):0}%"></i></div></div>
         <div class="fold-scroll">${pk.map(i=>`<div class="check ${i.done?'done':''}"><div class="box" onclick="togglePack('${i.id}')">${ICON.check(15)}</div><div class="lbl" onclick="togglePack('${i.id}')">${esc(i.label)}</div><button class="del" onclick="delPack('${i.id}')">${ICON.x(16)}</button></div>`).join('')||'<div class="hint">No items</div>'}</div>
         <div class="fold-pad"><button class="btn secondary" style="padding:11px" onclick="addPackPrompt()">${ICON.plus(15)} Add item</button></div>`, false)}
    </div>

    ${active?`<div class="section" style="margin-top:20px"><button class="btn secondary" onclick="endTripMode()">${ICON.flag(17)} End Trip Mode</button></div>`:''}
    <div class="spacer"></div><div class="spacer"></div>
  </div>`;
}
function toggleLegDone(runKey, showId){ const sh=sel.event(showId); if(sh){ sh.setDone=!sh.setDone; haptic(); persist(); renderView(); toast(sh.setDone?'Leg complete ✓':'Leg reopened', sh.setDone?'check':'arrowUp'); } }

/* ============================================================
   TRIP — create / edit
   ============================================================ */
function sheetTrip(tid){
  const t = tid? sel.trip(tid):null;
  const swatches = Object.entries(CATS).map(([k,v])=>`<div class="sw" style="background:${v}" data-cat="${k}" onclick="pickCat(this)"></div>`).join('');
  openSheet(tid?'Edit trip':'New trip', `
    <div class="field"><label>Trip name</label><input id="tr-name" class="input" placeholder="e.g. Europe Weekend" value="${esc(t?t.name:'')}"></div>
    <div class="row-2">
      <div class="field"><label>Start</label><input id="tr-start" type="date" class="input" value="${t?t.startDate||'':''}"></div>
      <div class="field"><label>End</label><input id="tr-end" type="date" class="input" value="${t?t.endDate||'':''}"></div>
    </div>
    <div class="field"><label>Colour</label><div class="swatches" id="tr-cat">${swatches}</div></div>
    ${tid?'':`<div class="hint" style="text-align:left;padding:2px 2px 6px">A default packing checklist will be added — you can edit it after.</div>`}
    <button class="btn" id="tr-save" onclick="saveTrip('${tid||''}')">${tid?'Save changes':'Create trip'}</button>
    <div class="spacer"></div>
  `);
  setTimeout(()=>{ const cat=t?t.color:'pink'; const el=document.querySelector(`#tr-cat .sw[data-cat="${cat}"]`); if(el) el.classList.add('on'); },40);
}
function saveTrip(tid){
  const name = val('tr-name');
  if(!name){ toast('Name your trip','x'); return; }
  const data = {name, startDate:rawVal('tr-start'), endDate:rawVal('tr-end'), color:getCat('tr-cat')};
  withButton($('#tr-save'), ()=>{
    if(tid){ Object.assign(sel.trip(tid), data); }
    else {
      store.trips.push(Object.assign({id:uid('trip'), archived:false,
        packing:store.settings.packingTemplate.map(x=>({id:uid('pk'),label:x,done:false})),
        checklist:store.settings.packingTemplate.map(x=>({id:uid('ck'),label:x,done:false})),
        timeline:[], emergency:[], attachments:[]}, data));
    }
    persist(); closeSheet(); renderView();
  }, tid?'Trip updated':'Trip created');
}

/* ============================================================
   Trip Mode  (runs — no named trips)
   ============================================================ */
function startTripFromShow(showId){ store.activeShowId=showId; persist(); overlay=null; store.tab='home'; render({ resetScroll: true }); toast('Trip Mode on','play'); }
function endTripMode(){ confirmSheet('End Trip Mode?','This turns off the live tour view. Nothing is deleted.','End Trip Mode',()=>{ store.activeShowId=null; persist(); overlay=null; store.tab='home'; render(); toast('Trip Mode off','flag'); }); }
function completeRunStep(runKey, stepId){
  if(stepId.startsWith('set_')){ const sh=sel.event(stepId.slice(4)); if(sh){ sh.setDone=!sh.setDone; } }
  else { const it=store.events.find(x=>x.id===stepId); if(it){ it.done=!it.done; if(it.done) toast('Done ✓','check'); } }
  haptic(); persist(); renderView();
}
function togglePack(id){ const p=store.packing.find(x=>x.id===id); if(p){p.done=!p.done; haptic(); persist(); renderView();} }
function delPack(id){ store.packing=store.packing.filter(x=>x.id!==id); persist(); renderView(); }
function addPackPrompt(){ promptSheet('Packing item','e.g. Rain jacket', function(v){ store.packing.push({id:uid('pk'),label:v,done:false}); persist(); renderView(); toast('Added','check'); }); }
