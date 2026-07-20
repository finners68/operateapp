/* ============================================================
   HOME
   ============================================================ */
function viewHome(){
  const run = activeRun();
  const e = sel.nextEvent();
  const greeting = (()=>{ const h=new Date().getHours(); return h<12?'Good morning':h<18?'Good afternoon':'Good evening'; })();
  let hero = '';
  if(e){
    const flight = (e.flights&&e.flights[0]);
    const flightMs = flight ? parseDT(...flight.dep.split(' '))?.getTime() : null;
    const setMs = parseDT(e.date, e.setTime)?.getTime();
    const cF = flightMs? countdown(flightMs):null;
    const cS = setMs? countdown(setMs):null;
    hero = `
      <div class="hero tap nextshow" onclick="openView('event','${e.id}')">
        <div class="hero-label">${ICON.music(14)} Next show · ${esc(relDay(e.date))}</div>
        <div class="hero-venue">${esc(e.venue)}</div>
        <div class="hero-city">${ICON.pin(14)} ${esc(e.city)}${e.country?', '+esc(e.country):''}</div>
        <div class="count-row">
          <div class="count"><div class="count-k">${ICON.music(12)} Set time</div><div class="count-v" style="font-size:19px">${e.setTime?esc(e.setTime):'TBA'}${e.endTime?`<small> – ${esc(e.endTime)}</small>`:''}</div></div>
          <div class="count"><div class="count-k">${ICON.clock(12)} Starts in</div><div class="count-v">${cS&&!cS.done?cS.txt:'—'}<small>${cS&&!cS.done?cS.unit:''}</small></div></div>
          ${flight?`<div class="count"><div class="count-k">${ICON.plane(12)} Flight</div><div class="count-v">${cF.done?'Off':cF.txt}<small>${cF.done?'':cF.unit}</small></div></div>`:''}
        </div>
        <div class="hero-info">
          ${e.hotel?`<div class="pill" onclick="event.stopPropagation();openMaps('${esc((e.hotel.name||'')+' '+(e.hotel.address||''))}')"><div class="ic">${ICON.bed(16)}</div><div class="tx"><b>${esc(e.hotel.name||'Hotel')}</b><span>Tap for maps</span></div></div>`:''}
          <div class="pill" onclick="event.stopPropagation();openMaps('${esc(cleanVenue(e.venue)+' '+(e.venueAddr||e.city||''))}')"><div class="ic">${ICON.pin(16)}</div><div class="tx"><b>Venue</b><span>Tap for maps</span></div></div>
        </div>
      </div>`;
  } else {
    hero = `<div class="empty"><div class="ic">${ICON.calendar(28)}</div><b>No upcoming shows</b><span>Add your next event to see it here.</span></div>`;
  }

  // Today's checklist = next event's checklist
  const todayChecklist = e && e.checklist && e.checklist.length ? e.checklist : [];
  const ideasWaiting = sel.ideas().filter(i=>!i.done).slice(0,4);
  const recentNotes = sel.notes().slice(0,3);
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const trips = runs().filter(r=>parseDT(r.end)>=today0).slice(0,2);

  const nameBit = store.settings.artistName&&store.settings.artistName!=='You'?', '+esc(store.settings.artistName):'';
  const photo = store.settings._homeHeaderUrl || store.settings.homeHeader;
  const header = photo ? `
  <div class="home-hero" style="background-image:url('${photo}')">
    <div class="home-hero-actions">
      <button class="header-btn glass" onclick="openSearch()">${ICON.search(20)}</button>
      <button class="header-btn glass" onclick="openView('settings')">${ICON.settings(20)}</button>
    </div>
    <div class="home-hero-text"><div class="hero-hello">${greeting}${nameBit}</div><div class="hero-home">Home</div></div>
  </div>` : `
  <div class="lg-header">
    <div><div class="lg-title">Home</div><div class="lg-sub">${greeting}${nameBit}</div></div>
    <div style="display:flex;gap:9px">
      <button class="header-btn" onclick="openSearch()">${ICON.search(20)}</button>
      <button class="header-btn" onclick="openView('settings')">${ICON.settings(20)}</button>
    </div>
  </div>`;
  return `
  ${header}
  <div class="screen-pad stagger"${photo?' style="margin-top:14px"':''}>
    ${run?activeTripBanner(run):''}
    ${hero}

    <div class="section">
      <div class="section-head"><div class="section-title">Quick add</div></div>
      <div class="qa-grid">
        <button class="qa" onclick="sheetEvent()"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.calendar(20)}</div><span>Event</span></button>
        <button class="qa" onclick="go('trips')"><div class="ic" style="background:var(--pink);color:#fff">${ICON.trips(20)}</div><span>Tours</span></button>
        <button class="qa" onclick="sheetIdea()"><div class="ic" style="background:var(--orange-soft);color:var(--orange)">${ICON.idea(20)}</div><span>Idea</span></button>
        <button class="qa" onclick="sheetNote()"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.note(20)}</div><span>Note</span></button>
      </div>
      <div class="qa-grid" style="margin-top:10px">
        <button class="qa" onclick="openView('finance')"><div class="ic" style="background:var(--green-soft);color:var(--green)">${ICON.coins(20)}</div><span>Money</span></button>
        <button class="qa" onclick="openView('invoices')"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.receipt(20)}</div><span>Invoices</span></button>
        <button class="qa" onclick="openView('contacts')"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.users(20)}</div><span>Contacts</span></button>
        <button class="qa" onclick="openView('itinerary')"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.file(20)}</div><span>Itinerary</span></button>
      </div>
    </div>

    ${todayChecklist.length?`
    <div class="section">
      <div class="section-head"><div class="section-title">Today's checklist</div><div class="section-link" onclick="openView('event','${e.id}')">Open show</div></div>
      <div class="card flush">${todayChecklist.map(i=>checkRow(i, `toggleEventCheck('${e.id}','${i.id}')`)).join('')}</div>
    </div>`:''}

    <div class="section">
      <div class="section-head"><div class="section-title">Ideas to capture</div><div class="section-link" onclick="go('ideas')">All</div></div>
      ${ideasWaiting.length?`<div class="idea-grid">${ideasWaiting.map(ideaCard).join('')}</div>`
        :`<div class="card" style="text-align:center;color:var(--text-3);padding:22px">No ideas waiting — nice and clear.</div>`}
    </div>

    ${trips.length?`
    <div class="section">
      <div class="section-head"><div class="section-title">Tours</div><div class="section-link" onclick="go('trips')">All</div></div>
      <div class="card flush">${trips.map(runRow).join('')}</div>
    </div>`:''}

    ${recentNotes.length?`
    <div class="section">
      <div class="section-head"><div class="section-title">Recent notes</div><div class="section-link" onclick="go('notes')">All</div></div>
      <div class="card flush">${recentNotes.map(noteRow).join('')}</div>
    </div>`:''}

    ${(()=>{ const st=computeStats(); if(!st.shows) return ''; return `
    <div class="section">
      <div class="section-head"><div class="section-title">Your schedule</div><div class="section-link" onclick="openView('stats')">All stats</div></div>
      <div class="card tap" onclick="openView('stats')" style="padding:0;overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr">
          ${homeStat(ICON.music(15),'var(--accent-2)', st.upcoming, 'shows ahead', 0)}
          ${homeStat(ICON.plane(15),'var(--blue)', st.flightHrs+'h', 'in the air', 1)}
          ${homeStat(ICON.trips(15),'var(--green)', st.daysAway, 'days away', 2)}
          ${homeStat(ICON.globe(15),'var(--pink)', st.cities, 'cities', 3)}
        </div>
      </div>
    </div>`; })()}
    <div class="spacer"></div>
  </div>`;
}
function homeStat(icon, color, value, label, idx){
  const leftBorder = (idx%2===1);   // right column
  const bottomBorder = (idx<2);     // top row
  return `<div style="padding:15px 16px;${bottomBorder?'border-bottom:1px solid var(--stroke);':''}${leftBorder?'border-left:1px solid var(--stroke);':''}">
    <div style="color:${color};display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em">${icon} ${esc(label)}</div>
    <div style="font-size:24px;font-weight:850;letter-spacing:-0.02em;margin-top:3px">${value}</div>
  </div>`;
}

function activeTripBanner(run){
  const p=runProgress(run);
  return `<div style="margin-bottom:14px"><div class="card tap" onclick="openView('trip','${run.key}')" style="background:var(--green-soft);border-color:rgba(50,215,75,0.3);display:flex;align-items:center;gap:12px;padding:13px 15px">
    <span class="pulse" style="flex-shrink:0"></span>
    <div style="flex:1;min-width:0"><b style="font-size:15px;color:var(--green)">Active trip · ${esc(run.title)}</b><div style="font-size:12.5px;color:var(--text-2);margin-top:1px">${run.shows.length} show${run.shows.length>1?'s':''} · ${p.pct}% done · tap for trip mode</div></div>
    <span style="color:var(--green)">${ICON.chevR(18)}</span>
  </div></div>`;
}
/* Shared small components */
function checkRow(i, onclick){
  return `<div class="check ${i.done?'done':''}" onclick="${onclick}">
    <div class="box">${ICON.check(15)}</div>
    <div class="lbl">${esc(i.label)}</div>
  </div>`;
}
function ideaCard(i){
  const t = IDEA_TYPES[i.type]||IDEA_TYPES.other;
  const link = ideaLinkLabel(i);
  return `<div class="idea ${i.done?'is-done':''}" style="background:linear-gradient(160deg, ${t.color}22, var(--card));border-color:${t.color}33" onclick="openView('idea','${i.id}')">
    <button class="idea-done-btn" onclick="event.stopPropagation();toggleIdeaDone('${i.id}')">${ICON.check(15)}</button>
    <div class="type" style="color:${t.color}">${ICON[t.icon](13)} ${t.label}</div>
    <div class="ttl">${esc(i.title)}</div>
    <div class="foot"><span class="prio" style="background:${PRIO[i.prio]}"></span>${i.prio}${link?'':''}</div>
    ${link?`<div class="link-tag">${ICON.chevR(11)} ${esc(link)}</div>`:''}
  </div>`;
}
function ideaLinkLabel(i){
  if(i.eventId){ const e=sel.event(i.eventId); if(e) return e.venue; }
  if(i.tripId){ const t=sel.trip(i.tripId); if(t) return t.name; }
  return '';
}
function tripRow(t){
  const evs = sel.tripEvents(t.id); const p = sel.tripProgress(t);
  const active = store.activeTripId===t.id;
  return `<div class="row" onclick="openView('trip','${t.id}')">
    <div class="ic" style="background:${CATS[t.color]||CATS.purple}22;color:${CATS[t.color]||CATS.purple}">${ICON.bag(19)}</div>
    <div class="body"><b>${esc(t.name)} ${active?'<span class="tag confirmed" style="margin-left:4px">Active</span>':''}</b>
      <span>${evs.length} show${evs.length!==1?'s':''} · ${t.startDate?fmtDate(t.startDate):'No dates'}${t.archived?' · Archived':''}</span></div>
    <div class="trail">${p.pct}%${ICON.chevR(16)}</div>
  </div>`;
}
function noteRow(n){
  const preview = (n.body||'').split('\n').filter(Boolean)[0]||'No additional text';
  return `<div class="note-row" onclick="openView('note','${n.id}')">
    <b>${esc(n.title||'Untitled')}</b>
    <span class="meta"><span class="dt">${timeAgo(n.updated)}</span> · ${esc(preview.slice(0,50))}</span>
  </div>`;
}
/* ============================================================
   EVENT DETAIL
   ============================================================ */
function viewEvent(id){
  const e = sel.event(id);
  if(!e) return backStub();
  const c = CATS[e.color]||CATS.purple;
  const trip = e.tripId? sel.trip(e.tripId):null;
  const cp = sel.eventChecklistProgress(e);
  const flight = e.flights&&e.flights[0];
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} ${trip?esc(trip.name):(store.tab==='home'?'Home':'Calendar')}</button>
    <div style="display:flex;gap:8px">
      <button class="header-btn" style="width:36px;height:36px" onclick="shareDaySheet('${e.id}')">${ICON.share(17)}</button>
      <button class="header-btn" style="width:36px;height:36px" onclick="eventMenu('${e.id}')">${ICON.edit(18)}</button>
    </div>
  </div></div>
  <div class="screen-pad stagger">
    <div class="dhero" style="background:linear-gradient(155deg,${c}33,var(--card) 65%)">
      <div class="cat-bar" style="background:${c}"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="tag ${e.status}">${e.status}</span>
        ${trip?`<span class="tag" style="background:${c}22;color:${c}" onclick="openView('trip','${trip.id}')">${esc(trip.name)}</span>`:''}
      </div>
      <h1>${esc(e.venue||'Untitled show')}</h1>
      <div class="sub">${ICON.pin(14)} ${esc(e.city)}${e.country?', '+esc(e.country):''}</div>
      <div class="meta-row">
        <span class="meta-chip">${ICON.calendar(13)} ${esc(fmtDate(e.date))}</span>
        <span class="meta-chip">${ICON.music(13)} ${e.setTime?'Set '+esc(e.setTime)+(e.endTime?' - '+esc(e.endTime):''):'TBA'}</span>
        ${e.arrival?`<span class="meta-chip">${ICON.clock(13)} Arrive ${esc(e.arrival)}</span>`:''}
      </div>
    </div>

    <div class="section" style="margin-top:16px">
      ${showQuickLinks(e)}
    </div>


    ${(()=>{ const linked=store.ideas.filter(x=>x.eventId===e.id); if(!e.content && !linked.length) return '';
      return `<div class="block"><div class="block-title">Content to capture ${linked.length?`<button class="add" onclick="attachIdeaPickForEvent('${e.id}')">Add idea</button>`:''}</div>
      ${e.content?`<div class="card" style="background:linear-gradient(150deg,var(--accent-soft),var(--card));margin-bottom:${linked.length?'10px':'0'}"><div style="display:flex;gap:11px;align-items:flex-start"><div style="color:var(--accent-2);flex-shrink:0;margin-top:1px">${ICON.camera(20)}</div><div style="font-size:15px;font-weight:550;line-height:1.45">${esc(e.content)}</div></div></div>`:''}
      ${linked.length?`<div class="card flush">${linked.map(i=>{const t=IDEA_TYPES[i.type]||IDEA_TYPES.other;return `<div class="row" onclick="openView('idea','${i.id}')"><div class="ic" style="background:${t.color}22;color:${t.color}">${ICON[t.icon](16)}</div><div class="body"><b>${esc(i.title)}</b><span>${t.label}${i.done?' · done':''}</span></div>${ICON.chevR(15)}</div>`;}).join('')}</div>`:''}
      </div>`; })()}
    ${(()=>{ const linked=store.ideas.filter(x=>x.eventId===e.id); if(e.content||linked.length) return '';
      return `<div class="block"><div class="block-title">Content to capture <button class="add" onclick="attachIdeaPickForEvent('${e.id}')">Add idea</button></div>
      <div class="card tap" onclick="sheetEvent('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.camera(20)} Set what to film / capture</div></div>`; })()}

    <!-- Money -->
    ${moneyBlock(e)}

    <!-- Venue -->
    <div class="block"><div class="block-title">Venue</div>
      <div class="card flush">
        <div class="info-line" onclick="sheetVenueAddr('${e.id}')"><div class="ic">${ICON.pin(17)}</div><div class="tx"><div class="k">Address</div><div class="v addr-trunc">${esc(e.venueAddr || (e.city?cleanVenue(e.venue)+' · '+e.city+(e.country?', '+e.country:''):cleanVenue(e.venue)) || 'Tap to add')}</div></div>
          <button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="event.stopPropagation();openMaps('${esc(cleanVenue(e.venue)+' '+(e.venueAddr||e.city||''))}')">${ICON.map(17)}</button></div>
        ${e.promoter?`<div class="info-line"><div class="ic">${ICON.user(17)}</div><div class="tx"><div class="k">Promoter</div><div class="v">${esc(e.promoter.name)}</div></div>
          ${e.promoter.phone?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="callNumber('${e.promoter.phone}')">${ICON.phone(16)}</button>`:''}</div>`:`<div class="info-line" onclick="sheetPromoter('${e.id}')"><div class="ic">${ICON.plus(17)}</div><div class="tx"><div class="v" style="color:var(--accent-2)">Add promoter contact</div></div></div>`}
      </div>
    </div>

    <!-- Advancing: ABOSS-depth show-day detail, only surfaces what's filled in -->
    ${advanceBlock(e)}

    <!-- Key contacts -->
    ${contactsBlock(e)}

    <!-- Hotel — populated from the show's stay legs + any manual hotel -->
    <div class="block"><div class="block-title">Hotel <button class="add" onclick="sheetHotel('${e.id}')">${e.hotel?'Edit':'Add'}</button></div>
      ${(()=>{ const legs=showLegs(e.id).filter(x=>x.kind==='stay').sort(legSort);
        const legHtml=legs.length?`<div class="card flush">${legs.map(journeyRow).join('')}</div>`:'';
        const manual=e.hotel?`<div class="card flush"${legHtml?' style="margin-top:10px"':''}>
          <div class="info-line"><div class="ic">${ICON.bed(17)}</div><div class="tx"><div class="k">${esc(e.hotel.name||'Hotel')}</div><div class="v">${esc(e.hotel.address||'')}</div></div>
            <button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openMaps('${esc((e.hotel.name||'')+' '+(e.hotel.address||''))}')">${ICON.map(16)}</button></div>
          <div class="info-line"><div class="ic">${ICON.clock(17)}</div><div class="tx"><div class="k">Check in / out</div><div class="v">${e.hotel.checkin?fmtDate(e.hotel.checkin):'—'} → ${e.hotel.checkout?fmtDate(e.hotel.checkout):'—'}</div></div></div>
          ${e.hotel.conf?`<div class="info-line" onclick="copyText('${esc(e.hotel.conf)}')"><div class="ic">${ICON.ticket(17)}</div><div class="tx"><div class="k">Confirmation</div><div class="v">${esc(e.hotel.conf)}</div></div><button class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.copy(16)}</button></div>`:''}
          ${e.hotel.notes?`<div class="info-line"><div class="ic">${ICON.note(17)}</div><div class="tx"><div class="k">Room notes</div><div class="v">${esc(e.hotel.notes)}</div></div></div>`:''}
        </div>`:'';
        if(!legHtml && !manual) return `<div class="card tap" onclick="sheetHotel('${e.id}')" style="text-align:center;color:var(--text-3);padding:20px">${ICON.bed(22)}<div style="margin-top:6px;font-weight:600">Add hotel details</div></div>`;
        return legHtml+manual;
      })()}
    </div>

    <!-- Flights — populated from the show's flight legs + any manual flights -->
    <div class="block"><div class="block-title">Flights <button class="add" onclick="sheetFlight('${e.id}')">Add</button></div>
      ${(()=>{ const legs=showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')==='plane').sort(legSort);
        const legHtml=legs.length?`<div class="card flush">${legs.map(journeyRow).join('')}</div>`:'';
        const manual=(e.flights&&e.flights.length)?`<div class="card flush"${legHtml?' style="margin-top:10px"':''}>${e.flights.map(f=>flightLine(e.id,f)).join('')}</div>`:'';
        if(!legHtml && !manual) return `<div class="card tap" onclick="sheetFlight('${e.id}')" style="text-align:center;color:var(--text-3);padding:20px">${ICON.plane(22)}<div style="margin-top:6px;font-weight:600">Add flight</div></div>`;
        return legHtml+manual;
      })()}
    </div>

    <!-- Driver — populated from the show's driver/transfer legs + any manual driver -->
    <div class="block"><div class="block-title">Driver <button class="add" onclick="sheetDriver('${e.id}')">${e.driver?'Edit':'Add'}</button></div>
      ${(()=>{ const legs=showLegs(e.id).filter(x=>x.kind==='travel' && isDriverItem(x)).sort(legSort);
        const legHtml=legs.length?`<div class="card flush">${legs.map(journeyRow).join('')}</div>`:'';
        const manual=e.driver?`<div class="card flush"${legHtml?' style="margin-top:10px"':''}>
          <div class="info-line"><div class="ic">${ICON.car(17)}</div><div class="tx"><div class="k">${esc(e.driver.name||'Driver')}</div><div class="v">${esc(e.driver.pickup||'')}</div></div></div>
          ${e.driver.notes?`<div class="info-line"><div class="ic">${ICON.note(17)}</div><div class="tx"><div class="v" style="font-size:14px">${esc(e.driver.notes)}</div></div></div>`:''}
          <div style="display:flex;gap:9px;padding:12px 16px">
            <button class="btn secondary" style="padding:11px" onclick="callNumber('${e.driver.phone}')">${ICON.phone(16)} Call</button>
            <button class="btn secondary" style="padding:11px" onclick="whatsapp('${e.driver.whatsapp||e.driver.phone}')">${ICON.chat(16)} WhatsApp</button>
            <button class="btn secondary" style="padding:11px;flex:0 0 auto" onclick="copyText('${esc(e.driver.phone||'')}')">${ICON.copy(16)}</button>
          </div>
        </div>`:'';
        if(!legHtml && !manual) return `<div class="card tap" onclick="sheetDriver('${e.id}')" style="text-align:center;color:var(--text-3);padding:20px">${ICON.car(22)}<div style="margin-top:6px;font-weight:600">Add driver</div></div>`;
        return legHtml+manual;
      })()}
    </div>

    <!-- Transfers — any other travel legs (ferry, transfer, walk) so nothing is lost -->
    ${(()=>{ const legs=showLegs(e.id).filter(x=>x.kind==='travel' && (x.icon||'plane')!=='plane' && !isDriverItem(x)).sort(legSort);
      if(!legs.length) return '';
      return `<div class="block"><div class="block-title">Transfers <button class="add" onclick="addLogisticFor('${e.id}')">Add</button></div>
        <div class="card flush">${legs.map(journeyRow).join('')}</div></div>`;
    })()}

    <!-- Checklist -->
    <div class="block"><div class="block-title">Checklist ${cp.total?`· ${cp.done}/${cp.total}`:''} <button class="add" onclick="addEventCheckPrompt('${e.id}')">Add</button></div>
      ${e.checklist&&e.checklist.length?`<div class="card flush">${e.checklist.map(i=>`<div class="check ${i.done?'done':''}"><div class="box" onclick="toggleEventCheck('${e.id}','${i.id}')">${ICON.check(15)}</div><div class="lbl" onclick="toggleEventCheck('${e.id}','${i.id}')">${esc(i.label)}</div><button class="del" onclick="delEventCheck('${e.id}','${i.id}')">${ICON.x(16)}</button></div>`).join('')}</div>`
        :`<div class="card tap" onclick="addEventCheckPrompt('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.checkList(20)} Add a checklist item</div>`}
    </div>

    <!-- Attachments -->
    <div class="block"><div class="block-title">Attachments</div>
      <div class="thumb-row">
        ${(e.attachments||[]).map(a=>attachThumb(e.id,a)).join('')}
        <label class="thumb thumb-add">${ICON.plus(22)}<span>Add</span><input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadAttachment('${e.id}',this)"></label>
      </div>
    </div>

    <!-- Notes -->
    <div class="block"><div class="block-title">Internal notes</div>
      <div class="card"><textarea class="textarea" placeholder="Anything to remember about this show…" onblur="saveEventNotes('${e.id}',this.value)">${esc(e.notes||'')}</textarea></div>
    </div>

    <!-- Trip Mode -->
    ${(()=>{ const run=runOf(e.id); const otherShows=run?run.shows.length-1:0;
      const active = store.activeShowId && runOf(store.activeShowId) && runOf(store.activeShowId).key===(run&&run.key);
      return `<div class="section" style="margin-top:20px">
        ${active
          ? `<button class="btn" onclick="go('home')">${ICON.play(18)} Trip Mode is live — open it</button>`
          : `<button class="btn" onclick="startTripFromShow('${e.id}')">${ICON.play(18)} Start Trip Mode${otherShows>0?` (this run · ${run.shows.length} shows)`:''}</button>`}
        ${otherShows>0?`<div class="hint" style="text-align:left;padding:8px 2px 0">Auto-grouped with ${otherShows} nearby show${otherShows>1?'s':''} into one tour — no naming needed.</div>`:''}
      </div>`; })()}
    <div class="section"><button class="btn danger" onclick="confirmDeleteEvent('${e.id}')">${ICON.trash(17)} Delete show</button></div>
    <div class="spacer"></div><div class="spacer"></div>
  </div>`;
}
function flightLine(eid,f){
  return `<div class="info-line">
    <div class="ic">${ICON.plane(17)}</div>
    <div class="tx"><div class="k">${esc(f.code||'Flight')} ${f.seat?'· Seat '+esc(f.seat):''}</div>
      <div class="v">${esc(f.from||'')} ${f.dep?f.dep.split(' ')[1]||'':''} → ${esc(f.to||'')} ${f.arr?f.arr.split(' ')[1]||'':''}</div></div>
    <label class="header-btn" style="width:34px;height:34px;align-self:center">${ICON.ticket(16)}<input type="file" accept="image/*,application/pdf" style="display:none" onchange="uploadPass('${eid}','${f.id}',this)"></label>
    <button class="del" style="opacity:.5;align-self:center" onclick="delFlight('${eid}','${f.id}')">${ICON.x(15)}</button>
  </div>${f.passes&&f.passes.length?`<div style="padding:0 16px 12px"><div class="thumb-row">${f.passes.map(p=>passThumb(p, passEditable()?`delFlightPass('${eid}','${f.id}','${p.id}')`:null)).join('')}</div></div>`:''}`;
}
function attachThumb(eid,a){
  const inner = a.kind==='image'?`<img src="${a.data}">`:`<div class="pdf">${ICON.file(26)}<span>${esc(a.name||'File')}</span></div>`;
  return `<div class="thumb" onclick="${a.kind==='image'?`openViewer('${a.data}')`:`toast('PDF saved','file')`}">${inner}<div class="del-badge" onclick="event.stopPropagation();delAttachment('${eid}','${a.id}')">${ICON.x(13)}</div></div>`;
}
function backStub(){ setTimeout(back,0); return '<div class="empty"><b>Gone</b></div>'; }
/* ============================================================
   EVENT — create / edit
   ============================================================ */
function sheetEvent(eid){
  const e = eid? sel.event(eid):null;
  const today = new Date();
  const defDate = e?e.date:`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const swatches = Object.entries(CATS).map(([k,v])=>`<div class="sw" style="background:${v}" data-cat="${k}" onclick="pickCat(this)"></div>`).join('');
  openSheet(eid?'Edit show':'New show', `
    <div class="field"><label>Venue</label><input id="ev-venue" class="input" placeholder="e.g. Shelter" value="${esc(e?e.venue:'')}"></div>
    <div class="row-2">
      <div class="field"><label>City</label><input id="ev-city" class="input" placeholder="Amsterdam" value="${esc(e?e.city:'')}"></div>
      <div class="field"><label>Country</label><input id="ev-country" class="input" placeholder="Netherlands" value="${esc(e?e.country:'')}"></div>
    </div>
    <div class="field"><label>Date</label><input id="ev-date" type="date" class="input" value="${defDate}"></div>
    <div class="row-2">
      <div class="field"><label>Set time</label><input id="ev-set" type="time" class="input" value="${e?e.setTime:'23:00'}"></div>
      <div class="field"><label>Arrival</label><input id="ev-arr" type="time" class="input" value="${e?e.arrival:''}"></div>
    </div>
    <div class="field"><label>Status</label>
      <div class="seg" id="ev-status">
        ${['confirmed','hold','cancelled'].map(s=>`<button data-v="${s}" class="${(e?e.status:'confirmed')===s?'on':''}" onclick="segPick(this)">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Content to capture</label><input id="ev-content" class="input" placeholder="e.g. 2x reels · crowd clip" value="${esc(e?e.content:'')}"></div>
    <div class="field"><label>Colour</label><div class="swatches" id="ev-cat">${swatches}</div></div>
    <button class="btn" id="ev-save" onclick="saveEvent('${eid||''}')">${eid?'Save changes':'Add show'}</button>
    <div class="spacer"></div>
  `);
  setTimeout(()=>{ const cat=e?e.color:'purple'; const el=document.querySelector(`#ev-cat .sw[data-cat="${cat}"]`); if(el) el.classList.add('on'); },40);
}
function pickCat(el){ el.parentElement.querySelectorAll('.sw').forEach(s=>s.classList.remove('on')); el.classList.add('on'); haptic(); }
function segPick(el){ el.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on')); el.classList.add('on'); haptic(); }
function getSeg(id){ const el=document.querySelector('#'+id+' button.on'); return el?el.dataset.v:''; }
function getCat(id){ const el=document.querySelector('#'+id+' .sw.on'); return el?el.dataset.cat:'purple'; }

function saveEvent(eid){
  const venue = val('ev-venue');
  if(!venue){ toast('Add a venue name','x'); return; }
  const data = {
    venue, city:val('ev-city'), country:val('ev-country'), date:val('ev-date')||rawVal('ev-date'),
    setTime:rawVal('ev-set'), arrival:rawVal('ev-arr'), status:getSeg('ev-status')||'confirmed',
    content:val('ev-content'), color:getCat('ev-cat'),
  };
  withButton($('#ev-save'), ()=>{
    if(eid){ Object.assign(sel.event(eid), data); }
    else {
      const e = Object.assign({id:uid('evt'), artist:store.settings.artistName, tripId:null,
        venueAddr:'', hotel:null, flights:[], driver:null, promoter:null, notes:'',
        checklist:[], timeline:[], attachments:[],
        finance:{fee:0, currency:store.settings.baseCurrency, dealType:'Guarantee', expenses:[], perDiem:0, commission:0, paid:false}}, data);
      store.events.push(e);
    }
    persist(); closeSheet(); renderView();
    if(!eid) setTimeout(()=>offerAssign(store.events[store.events.length-1].id), 400);
  }, eid?'Show updated':'Show added');
}
function offerAssign(eid){ /* shows auto-group into tours — nothing to assign */ }

/* ============================================================
   Sub-entity sheets: hotel / flight / driver / promoter / timeline / emergency
   ============================================================ */
function sheetHotel(eid){
  const e=sel.event(eid); const h=e.hotel||{};
  openSheet('Hotel', `
    <div class="field"><label>Hotel name</label><input id="ho-name" class="input" value="${esc(h.name||'')}" placeholder="Kimpton De Witt"></div>
    <div class="field"><label>Address</label><input id="ho-addr" class="input" value="${esc(h.address||'')}" placeholder="Street, city"></div>
    <div class="row-2">
      <div class="field"><label>Check in</label><input id="ho-in" type="date" class="input" value="${h.checkin||e.date||''}"></div>
      <div class="field"><label>Check out</label><input id="ho-out" type="date" class="input" value="${h.checkout||''}"></div>
    </div>
    <div class="field"><label>Confirmation #</label><input id="ho-conf" class="input" value="${esc(h.conf||'')}" placeholder="Booking reference"></div>
    <div class="field"><label>Room notes</label><textarea id="ho-notes" class="textarea" placeholder="Late checkout, floor, etc.">${esc(h.notes||'')}</textarea></div>
    <button class="btn" id="ho-save" onclick="saveHotel('${eid}')">Save hotel</button>
    ${(e.hotel&&passEditable())?`<button class="btn danger" style="margin-top:10px" onclick="removeHotel('${eid}')">${ICON.trash(16)} Remove hotel</button>`:''}
    <div class="spacer"></div>
  `);
}
function saveHotel(eid){
  const e=sel.event(eid);
  withButton($('#ho-save'), ()=>{ e.hotel={name:val('ho-name'),address:val('ho-addr'),checkin:rawVal('ho-in'),checkout:rawVal('ho-out'),conf:val('ho-conf'),notes:val('ho-notes')}; persist(); closeSheet(); renderView(); }, 'Hotel saved');
}
function sheetFlight(eid){
  openSheet('Add flight', `
    <div class="field"><label>Flight number</label><input id="fl-code" class="input" placeholder="KL1008"></div>
    <div class="row-2">
      <div class="field"><label>From</label><input id="fl-from" class="input" placeholder="LHR"></div>
      <div class="field"><label>To</label><input id="fl-to" class="input" placeholder="AMS"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Departs</label><input id="fl-dep" type="datetime-local" class="input"></div>
      <div class="field"><label>Seat</label><input id="fl-seat" class="input" placeholder="4A"></div>
    </div>
    <button class="btn" id="fl-save" onclick="saveFlight('${eid}')">Add flight</button>
    <div class="spacer"></div>
  `);
}
function saveFlight(eid){
  const e=sel.event(eid); const code=val('fl-code');
  if(!code){ toast('Add a flight number','x'); return; }
  const depRaw = rawVal('fl-dep'); // yyyy-mm-ddThh:mm
  const dep = depRaw? depRaw.replace('T',' ') : '';
  withButton($('#fl-save'), ()=>{ e.flights.push({id:uid('fl'),code,from:val('fl-from').toUpperCase(),to:val('fl-to').toUpperCase(),dep,arr:'',seat:val('fl-seat'),passes:[]}); persist(); closeSheet(); renderView(); }, 'Flight added');
}
function delFlight(eid,fid){ const e=sel.event(eid); e.flights=e.flights.filter(f=>f.id!==fid); persist(); renderView(); toast('Flight removed','trash'); }
/* Tapping the Driver quick-link opens a chooser — Call or WhatsApp — instead of dialling immediately. */
function contactDriver(eid){
  const e=sel.event(eid); const d=(e&&e.driver)||{};
  const phone=d.phone||''; const wa=d.whatsapp||d.phone||'';
  if(!phone && !wa){ sheetDriver(eid); return; }
  openSheet('Contact driver', `
    ${d.name?`<div class="hint" style="text-align:left;padding:0 2px 12px">${esc(d.name)}${d.pickup?' · '+esc(d.pickup):''}</div>`:''}
    ${phone?`<button class="btn" onclick="callNumber('${esc(phone)}')">${ICON.phone(17)} Call</button>`:''}
    ${wa?`<button class="btn secondary" style="margin-top:10px" onclick="whatsapp('${esc(wa)}')">${ICON.chat(17)} Message on WhatsApp</button>`:''}
    <div class="spacer"></div>
  `);
}
/* ---- Flight status widget: gate / terminal / status / delay.
   Manually entered now (works offline); wired to auto-update from live flight data in Phase 2. ---- */
function flightInfoWidget(e){
  if(!e || e.kind!=='travel' || (e.icon||'plane')!=='plane') return '';
  const has = e.flightNo||e.gate||e.terminal||e.fstatus||e.delay;
  if(!has){ return `<div class="fi-add" onclick="event.stopPropagation();sheetFlightInfo('${e.id}')">${ICON.planeUp(15)} Add flight info · gate, terminal, status</div>`; }
  const st = e.fstatus||'Scheduled';
  const cell=(k,v)=>`<div class="fi-cell"><span>${k}</span><b>${v?esc(v):'—'}</b></div>`;
  const upd = e.fiUpdated?`<span class="fi-upd">${timeAgo(e.fiUpdated)}</span>`:'';
  const track = e.flightNo?`<button class="fi-track" onclick="event.stopPropagation();flightTrack('${e.id}')">${ICON.reminder(13)} Track live</button>`:'';
  return `<div class="fi" onclick="event.stopPropagation();sheetFlightInfo('${e.id}')">
    <div class="fi-head"><span class="fi-live"><i></i>${e.flightNo?esc(e.flightNo)+' · ':''}${esc(st)}</span>
      ${e.delay?`<span class="fi-delay">${esc(e.delay)}</span>`:upd}</div>
    <div class="fi-grid">${cell('Terminal',e.terminal)}${cell('Gate',e.gate)}</div>
    ${track?`<div style="margin-top:9px">${track}</div>`:''}
  </div>`;
}
/* Pull live gate/terminal/status/delay from the Supabase flight-status function. */
async function flightTrack(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  if(!e.flightNo){ toast('Add a flight number first','x'); sheetFlightInfo(id); return; }
  if(!isSupabaseConfigured() || !authUser){ toast('Sign in to track flights','x'); return; }
  const token = await getAccessToken();
  if(!token){ toast('Sign in to track flights','x'); return; }
  toast('Checking live status…','plane');
  try{
    const res=await fetch(OPERATE_CONFIG.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/flight-status', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':OPERATE_CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+token },
      body: JSON.stringify({ flight:e.flightNo, date:e.date })
    });
    const d=await res.json().catch(()=>null);
    if(!d || d.found===false){ toast(d&&d.error==='no_key'?'Flight key not set on server':'Flight not found for that date','x'); return; }
    if(d.status) e.fstatus=d.status;
    if(d.terminal) e.terminal=d.terminal;
    if(d.gate) e.gate=d.gate;
    e.delay=d.delay||'';
    e.fiUpdated=Date.now(); e.fiLive=true;
    persist(); renderView(); toast('Live status updated ✈︎','check');
  }catch(err){ toast('Could not reach flight service','x'); }
}
function sheetFlightInfo(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  const has = e.flightNo||e.gate||e.terminal||e.fstatus||e.delay;
  openSheet('Flight info', `
    <div class="field"><label>Flight number</label><input id="fi-no" class="input" value="${esc(e.flightNo||'')}" placeholder="KL1008"></div>
    <div class="row-2">
      <div class="field"><label>Terminal</label><input id="fi-term" class="input" value="${esc(e.terminal||'')}" placeholder="2"></div>
      <div class="field"><label>Gate</label><input id="fi-gate" class="input" value="${esc(e.gate||'')}" placeholder="B12"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Status</label><input id="fi-status" class="input" value="${esc(e.fstatus||'')}" placeholder="On time / Boarding / Delayed"></div>
      <div class="field"><label>Delay</label><input id="fi-delay" class="input" value="${esc(e.delay||'')}" placeholder="+25 min"></div>
    </div>
    <div class="hint" style="padding:6px 2px">Enter what you know now — in Phase 2 this auto-updates from live flight data.</div>
    <button class="btn" id="fi-save" onclick="saveFlightInfo('${id}')">Save flight info</button>
    ${(has&&passEditable())?`<button class="btn danger" style="margin-top:10px" onclick="clearFlightInfo('${id}')">${ICON.trash(15)} Clear flight info</button>`:''}
    <div class="spacer"></div>
  `);
}
function saveFlightInfo(id){
  const e=store.events.find(x=>x.id===id); if(!e) return;
  e.flightNo=val('fi-no'); e.terminal=val('fi-term'); e.gate=val('fi-gate'); e.fstatus=val('fi-status'); e.delay=val('fi-delay'); e.fiUpdated=Date.now();
  persist(); closeSheet(); renderView(); toast('Flight info saved','check');
}
function clearFlightInfo(id){
  const e=store.events.find(x=>x.id===id); if(e){ e.flightNo=''; e.terminal=''; e.gate=''; e.fstatus=''; e.delay=''; e.fiUpdated=null; }
  persist(); closeSheet(); renderView(); toast('Flight info cleared','trash');
}
function sheetDriver(eid){
  const e=sel.event(eid); const d=e.driver||{};
  openSheet('Driver', `
    <div class="field"><label>Name</label><input id="dr-name" class="input" value="${esc(d.name||'')}" placeholder="Jan"></div>
    <div class="field"><label>Phone</label><input id="dr-phone" type="tel" class="input" value="${esc(d.phone||'')}" placeholder="+31 6 12345678"></div>
    <div class="field"><label>WhatsApp (if different)</label><input id="dr-wa" type="tel" class="input" value="${esc(d.whatsapp||'')}" placeholder="+31 6 12345678"></div>
    <div class="field"><label>Pickup location</label><input id="dr-pick" class="input" value="${esc(d.pickup||'')}" placeholder="Schiphol Arrivals"></div>
    <div class="field"><label>Notes</label><input id="dr-notes" class="input" value="${esc(d.notes||'')}" placeholder="Vehicle, plate, etc."></div>
    <button class="btn" id="dr-save" onclick="saveDriver('${eid}')">Save driver</button>
    ${(e.driver&&passEditable())?`<button class="btn danger" style="margin-top:10px" onclick="removeDriver('${eid}')">${ICON.trash(16)} Remove driver</button>`:''}
    <div class="spacer"></div>
  `);
}
function saveDriver(eid){
  const e=sel.event(eid); const name=val('dr-name');
  if(!name){ toast('Add a name','x'); return; }
  withButton($('#dr-save'), ()=>{ e.driver={name,phone:val('dr-phone'),whatsapp:val('dr-wa'),pickup:val('dr-pick'),notes:val('dr-notes')}; persist(); closeSheet(); renderView(); }, 'Driver saved');
}
function sheetVenueAddr(eid){
  const e=sel.event(eid); if(!e) return;
  openSheet('Venue', `
    <div class="field"><label>Venue name</label><input id="va-venue" class="input" value="${esc(e.venue||'')}" placeholder="Venue name"></div>
    <div class="field"><label>Address</label><textarea id="va-addr" class="textarea" placeholder="Full address">${esc(e.venueAddr||'')}</textarea></div>
    <button class="btn" id="va-save" onclick="saveVenueAddr('${eid}')">Save</button>
    <div class="spacer"></div>
  `);
}
function saveVenueAddr(eid){
  const e=sel.event(eid); if(!e) return;
  withButton($('#va-save'), ()=>{ e.venue=val('va-venue')||e.venue; e.venueAddr=val('va-addr'); persist(); closeSheet(); renderView(); }, 'Saved');
}
function sheetPromoter(eid){
  const e=sel.event(eid); const p=e.promoter||{};
  openSheet('Promoter', `
    <div class="field"><label>Name</label><input id="pr-name" class="input" value="${esc(p.name||'')}" placeholder="Lena"></div>
    <div class="field"><label>Phone</label><input id="pr-phone" type="tel" class="input" value="${esc(p.phone||'')}" placeholder="+31 6 99887766"></div>
    <button class="btn" id="pr-save" onclick="savePromoter('${eid}')">Save contact</button>
    ${(e.promoter&&passEditable())?`<button class="btn danger" style="margin-top:10px" onclick="removePromoter('${eid}')">${ICON.trash(16)} Remove contact</button>`:''}
    <div class="spacer"></div>
  `);
}
function savePromoter(eid){
  const e=sel.event(eid); const name=val('pr-name');
  if(!name){ toast('Add a name','x'); return; }
  withButton($('#pr-save'), ()=>{ e.promoter={name,phone:val('pr-phone')}; persist(); closeSheet(); renderView(); }, 'Promoter saved');
}
/* ---- Advancing: rich, ABOSS-depth show-day info. Every field hidden unless filled. ---- */
function advRow(icon,k,v,extra){ if(!v) return ''; return `<div class="info-line"><div class="ic">${icon}</div><div class="tx"><div class="k">${k}</div><div class="v" style="white-space:pre-wrap">${esc(v)}</div></div>${extra||''}</div>`; }
function advanceBlock(e){
  const a=e.advance||{};
  const sched=(a.schedule||[]).filter(s=>(s.time||s.label));
  const schedHTML = sched.length?`<div class="ro-list">${sched.map(s=>`<div class="ro-row"><div class="ro-time">${esc(s.time||'')}</div><div class="ro-lab">${esc(s.label||'')}</div></div>`).join('')}</div>`:'';
  const navExtra = a.navAddr?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="openMaps('${esc(a.navAddr)}')">${ICON.map(16)}</button>`:'';
  const rows = [
    advRow(ICON.pin(17),'Stage / area',a.stage),
    schedHTML?`<div class="info-line" style="align-items:flex-start"><div class="ic">${ICON.clock(17)}</div><div class="tx" style="width:100%"><div class="k">Running order</div>${schedHTML}</div></div>`:'',
    advRow(ICON.planeUp(17),'Access / arrival',a.access),
    advRow(ICON.music(17),'Sound check',a.soundcheck),
    advRow(ICON.clock(17),'Curfew',a.curfew),
    advRow(ICON.face(17),'Dressing room',a.dressingRoom),
    advRow(ICON.users(17),'Guest list',a.guestlist),
    advRow(ICON.bag(17),'Catering / rider',a.catering),
    advRow(ICON.car(17),'Parking',a.parking),
    advRow(ICON.globe(17),'WiFi',a.wifi),
    advRow(ICON.pin(17),'Navigation address',a.navAddr,navExtra),
    advRow(ICON.note(17),'Remarks',a.remarks),
  ].filter(Boolean).join('');
  return `<div class="block"><div class="block-title">Advancing <button class="add" onclick="sheetAdvance('${e.id}')">${rows?'Edit':'Add'}</button></div>
    ${rows?`<div class="card flush">${rows}</div>`
      :`<div class="card tap" onclick="sheetAdvance('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.checkList(20)} Add show-day details</div>`}
  </div>`;
}
function contactsBlock(e){
  const cs=e.contacts||[];
  if(!cs.length) return `<div class="block"><div class="block-title">Key contacts <button class="add" onclick="sheetEventContact('${e.id}')">Add</button></div>
    <div class="card tap" onclick="sheetEventContact('${e.id}')" style="text-align:center;color:var(--text-3);padding:18px;font-weight:600">${ICON.users(20)} Add a key contact</div></div>`;
  return `<div class="block"><div class="block-title">Key contacts <button class="add" onclick="sheetEventContact('${e.id}')">Add</button></div>
    <div class="card flush">${cs.map(ct=>`<div class="info-line">
      <div class="ic">${ICON.user(17)}</div>
      <div class="tx" onclick="sheetEventContact('${e.id}','${ct.id}')"><div class="k">${esc(ct.name||'Contact')}</div><div class="v">${esc(ct.role||'')}${ct.phone?' · '+esc(ct.phone):''}</div></div>
      ${ct.phone?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="callNumber('${esc(ct.phone)}')">${ICON.phone(15)}</button>`:''}
      ${(ct.whatsapp||ct.phone)?`<button class="header-btn" style="width:34px;height:34px;align-self:center" onclick="whatsapp('${esc(ct.whatsapp||ct.phone)}')">${ICON.chat(15)}</button>`:''}
    </div>`).join('')}</div>
  </div>`;
}
function sheetAdvance(eid){
  const e=sel.event(eid); const a=e.advance||{};
  const sched=(a.schedule&&a.schedule.length?a.schedule:[{time:'',label:''}]);
  const roInputs = sched.map((s,i)=>`<div class="row-2 ro-edit" data-i="${i}">
      <div class="field" style="flex:0 0 34%"><input class="input ro-t" type="time" value="${esc(s.time||'')}"></div>
      <div class="field"><input class="input ro-l" value="${esc(s.label||'')}" placeholder="Soundcheck / Set / Curfew"></div>
    </div>`).join('');
  openSheet('Advancing', `
    <div class="field"><label>Stage / area</label><input id="ad-stage" class="input" value="${esc(a.stage||'')}" placeholder="Temple stage"></div>
    <div class="field"><label>Running order</label><div id="ad-ro">${roInputs}</div>
      <button class="btn secondary" style="padding:9px;margin-top:6px" onclick="addRoRow()">${ICON.plus(14)} Add time</button></div>
    <div class="row-2">
      <div class="field"><label>Access / arrival</label><input id="ad-access" class="input" value="${esc(a.access||'')}" placeholder="15:00 via Gate C"></div>
      <div class="field"><label>Sound check</label><input id="ad-sc" class="input" value="${esc(a.soundcheck||'')}" placeholder="16:30"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Curfew</label><input id="ad-curfew" class="input" value="${esc(a.curfew||'')}" placeholder="23:00"></div>
      <div class="field"><label>Dressing room</label><input id="ad-dr" class="input" value="${esc(a.dressingRoom||'')}" placeholder="Cabin 4, shared"></div>
    </div>
    <div class="field"><label>Guest list</label><input id="ad-gl" class="input" value="${esc(a.guestlist||'')}" placeholder="+4, email by Thu"></div>
    <div class="field"><label>Catering / rider</label><input id="ad-cat" class="input" value="${esc(a.catering||'')}" placeholder="Backstage catering, rider in DR"></div>
    <div class="row-2">
      <div class="field"><label>Parking</label><input id="ad-park" class="input" value="${esc(a.parking||'')}" placeholder="Artist lot P2"></div>
      <div class="field"><label>WiFi</label><input id="ad-wifi" class="input" value="${esc(a.wifi||'')}" placeholder="SSID / pass"></div>
    </div>
    <div class="field"><label>Navigation address</label><input id="ad-nav" class="input" value="${esc(a.navAddr||'')}" placeholder="Gate for artist entrance (if different)"></div>
    <div class="field"><label>Remarks</label><textarea id="ad-rem" class="textarea" placeholder="Anything else from the advance sheet…">${esc(a.remarks||'')}</textarea></div>
    <button class="btn" id="ad-save" onclick="saveAdvance('${eid}')">Save details</button>
    <div class="spacer"></div>
  `);
}
function addRoRow(){
  const wrap=$('#ad-ro'); if(!wrap) return;
  const div=document.createElement('div'); div.className='row-2 ro-edit';
  div.innerHTML=`<div class="field" style="flex:0 0 34%"><input class="input ro-t" type="time"></div><div class="field"><input class="input ro-l" placeholder="Soundcheck / Set / Curfew"></div>`;
  wrap.appendChild(div);
}
function saveAdvance(eid){
  const e=sel.event(eid);
  const schedule=[...document.querySelectorAll('#ad-ro .ro-edit')].map(r=>({time:(r.querySelector('.ro-t')||{}).value||'',label:(r.querySelector('.ro-l')||{}).value||''})).filter(s=>s.time||s.label);
  withButton($('#ad-save'), ()=>{
    e.advance={stage:val('ad-stage'),schedule,access:val('ad-access'),soundcheck:val('ad-sc'),curfew:val('ad-curfew'),dressingRoom:val('ad-dr'),guestlist:val('ad-gl'),catering:val('ad-cat'),parking:val('ad-park'),wifi:val('ad-wifi'),navAddr:val('ad-nav'),remarks:val('ad-rem')};
    persist(); closeSheet(); renderView();
  }, 'Details saved');
}
function sheetEventContact(eid,cid){
  const e=sel.event(eid); const c=(e.contacts||[]).find(x=>x.id===cid)||{};
  openSheet(cid?'Edit contact':'Add contact', `
    <div class="field"><label>Name</label><input id="ct-name" class="input" value="${esc(c.name||'')}" placeholder="Alex"></div>
    <div class="field"><label>Role</label><input id="ct-role" class="input" value="${esc(c.role||'')}" placeholder="Artist liaison / Stage manager"></div>
    <div class="field"><label>Phone</label><input id="ct-phone" type="tel" class="input" value="${esc(c.phone||'')}" placeholder="+44 7…"></div>
    <div class="field"><label>WhatsApp (if different)</label><input id="ct-wa" type="tel" class="input" value="${esc(c.whatsapp||'')}"></div>
    <button class="btn" id="ct-save" onclick="saveEventContact('${eid}','${cid||''}')">Save contact</button>
    ${cid?`<button class="btn danger" style="margin-top:10px" onclick="delEventContact('${eid}','${cid}')">${ICON.trash(16)} Remove</button>`:''}
    <div class="spacer"></div>
  `);
}
function saveEventContact(eid,cid){
  const e=sel.event(eid); const name=val('ct-name');
  if(!name){ toast('Add a name','x'); return; }
  if(!e.contacts) e.contacts=[];
  const data={role:val('ct-role'),name,phone:val('ct-phone'),whatsapp:val('ct-wa')};
  withButton($('#ct-save'), ()=>{
    if(cid){ const c=e.contacts.find(x=>x.id===cid); if(c) Object.assign(c,data); }
    else e.contacts.push({id:uid('ct'),...data});
    persist(); closeSheet(); renderView();
  }, 'Contact saved');
}
function delEventContact(eid,cid){ const e=sel.event(eid); e.contacts=(e.contacts||[]).filter(x=>x.id!==cid); persist(); closeSheet(); renderView(); toast('Contact removed','trash'); }
function sheetTimelineStep(tid){
  openSheet('Add timeline step', `
    <div class="row-2">
      <div class="field" style="flex:0 0 40%"><label>Time</label><input id="ts-time" type="time" class="input"></div>
      <div class="field"><label>What</label><input id="ts-title" class="input" placeholder="Soundcheck"></div>
    </div>
    <div class="field"><label>Detail (optional)</label><input id="ts-sub" class="input" placeholder="Venue, note…"></div>
    <button class="btn" id="ts-save" onclick="saveTimelineStep('${tid}')">Add step</button>
    <div class="spacer"></div>
  `);
}
function saveTimelineStep(tid){
  const t=sel.trip(tid); const time=rawVal('ts-time'); const title=val('ts-title');
  if(!title){ toast('What happens?','x'); return; }
  withButton($('#ts-save'), ()=>{
    t.timeline.push({id:uid('tl'),time:time||'',title,sub:val('ts-sub'),done:false});
    t.timeline.sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    persist(); closeSheet(); renderView();
  }, 'Step added');
}
function sheetEmergency(tid){
  openSheet('Emergency contact', `
    <div class="field"><label>Name</label><input id="em-name" class="input" placeholder="Manager — Alex"></div>
    <div class="field"><label>Phone</label><input id="em-phone" type="tel" class="input" placeholder="+44 7700 900123"></div>
    <button class="btn" id="em-save" onclick="saveEmergency('${tid}')">Add contact</button>
    <div class="spacer"></div>
  `);
}
function saveEmergency(tid){
  const t=sel.trip(tid); const name=val('em-name');
  if(!name){ toast('Add a name','x'); return; }
  withButton($('#em-save'), ()=>{ (t.emergency=t.emergency||[]).push({name,phone:val('em-phone')}); persist(); closeSheet(); renderView(); }, 'Contact added');
}
/* ============================================================
   MONEY — event block, editor, overview
   ============================================================ */
function moneyBlock(e){
  if(e.finance && e.finance.notDisclosed){
    return `<div class="block"><div class="card tap" onclick="sheetFinance('${e.id}')" style="padding:15px 16px;display:flex;align-items:center;gap:12px">
      <div style="width:34px;height:34px;border-radius:10px;background:var(--card-2);display:flex;align-items:center;justify-content:center;color:var(--text-2);flex-shrink:0">${ICON.coins(17)}</div>
      <div style="flex:1;min-width:0"><b style="font-size:16px;font-weight:700">Deal</b><div style="font-size:13px;color:var(--text-2);margin-top:1px">Not disclosed</div></div>
      ${ICON.chevR(15)}
    </div></div>`;
  }
  const c = money.eventCalc(e);
  const base = store.settings.baseCurrency;
  const showBase = c.cur!==base;
  const inner = c.gross ? `
    <div class="fold-pad">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.05em">${esc((e.finance.dealType)||'Fee')}${e.finance.estimated?' · est.':''}</div>
          <div style="font-size:28px;font-weight:850;letter-spacing:-0.02em;margin-top:2px">${fmtMoney(c.gross,c.cur)}</div>
          ${showBase?`<div style="font-size:13px;color:var(--text-3);font-weight:600">≈ ${fmtBase(c.grossBase)}</div>`:''}
        </div>
        <div style="text-align:right">
          <span class="tag ${c.paid?'confirmed':'hold'}">${c.paid?'Paid':'Unpaid'}</span>
          <button class="header-btn" style="width:38px;height:38px;margin-top:8px;margin-left:auto;${c.paid?'background:var(--green-soft);color:var(--green)':''}" onclick="togglePaid('${e.id}')">${ICON.check2(19)}</button>
        </div>
      </div>
      <div class="divi" style="margin:13px 0"></div>
      <div style="display:flex;flex-direction:column;gap:9px;font-size:14.5px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-2)">Fee</span><span style="font-weight:650">${fmtMoney(c.gross,c.cur)}</span></div>
        ${c.commissionAmt?`<div style="display:flex;justify-content:space-between"><span style="color:var(--text-2)">Agent commission (${e.finance.commission}%)</span><span style="font-weight:650;color:var(--red)">− ${fmtMoney(c.commissionAmt,c.cur)}</span></div>`:''}
        ${c.expenses?`<div style="display:flex;justify-content:space-between"><span style="color:var(--text-2)">Expenses</span><span style="font-weight:650;color:var(--red)">− ${fmtMoney(c.expenses,c.cur)}</span></div>`:''}
        ${c.perDiem?`<div style="display:flex;justify-content:space-between"><span style="color:var(--text-2)">Per diem</span><span style="font-weight:650;color:var(--green)">+ ${fmtMoney(c.perDiem,c.cur)}</span></div>`:''}
        <div class="divi" style="margin:4px 0"></div>
        <div style="display:flex;justify-content:space-between;font-size:16px"><span style="font-weight:750">Net take-home</span><span style="font-weight:850">${fmtMoney(c.net,c.cur)}</span></div>
        ${showBase?`<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-3)"><span></span><span>≈ ${fmtBase(c.netBase)}</span></div>`:''}
      </div>
      ${(e.finance.expenses||[]).length?`<div style="margin-top:12px">${e.finance.expenses.map(x=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid var(--stroke);font-size:13.5px"><span style="color:var(--text-2)">${esc(x.label||'Expense')}</span><span>${fmtMoney(x.amount,c.cur)} <button class="del" style="opacity:.6;padding:0 4px" onclick="delExpense('${e.id}','${x.id}')">${ICON.x(13)}</button></span></div>`).join('')}</div>`:''}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn secondary" style="padding:11px" onclick="sheetFinance('${e.id}')">${ICON.edit(15)} Edit deal</button>
        <button class="btn secondary" style="padding:11px" onclick="createInvoiceFromEvent('${e.id}')">${ICON.receipt(15)} Invoice</button>
      </div>
    </div>`
    : `<div class="fold-pad"><div class="card tap" onclick="sheetFinance('${e.id}')" style="text-align:center;color:var(--text-3);padding:16px">${ICON.money(22)}<div style="margin-top:6px;font-weight:600">Add the deal / fee</div></div></div>`;
  const sub = c.gross ? (e.finance.estimated?'Estimated — tap to view/edit':'Private — tap to view') : 'Not set';
  return `<div class="block">${foldSection('money'+e.id, ICON.coins(17), 'Deal', sub, inner, false)}</div>`;
}
function sheetFinance(eid){
  const e=sel.event(eid); const f=e.finance||{};
  const curs = Object.keys(store.settings.fx);
  openSheet('Deal', `
    <div class="row-2">
      <div class="field" style="flex:1.4"><label>Fee</label><input id="fi-fee" type="number" inputmode="decimal" class="input" value="${f.fee||''}" placeholder="8000"></div>
      <div class="field"><label>Currency</label><select id="fi-cur" class="input">${curs.map(c=>`<option value="${c}" ${(f.currency||store.settings.baseCurrency)===c?'selected':''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Deal type</label>
      <div class="seg" id="fi-deal">${['Guarantee','Guarantee + Bonus','Door split','Fee + Travel'].map((d,i)=>`<button data-v="${esc(d)}" class="${(f.dealType||'Guarantee')===d?'on':''}" onclick="segPick(this)" style="font-size:12px">${d}</button>`).join('')}</div>
    </div>
    <div class="row-2">
      <div class="field"><label>Agent commission %</label><input id="fi-comm" type="number" inputmode="decimal" class="input" value="${f.commission||''}" placeholder="10"></div>
      <div class="field"><label>Per diem</label><input id="fi-pd" type="number" inputmode="decimal" class="input" value="${f.perDiem||''}" placeholder="150"></div>
    </div>
    <div class="field"><label>Payment status</label>
      <div class="seg" id="fi-paid">${[['0','Unpaid'],['1','Paid']].map(([v,l])=>`<button data-v="${v}" class="${(f.paid?'1':'0')===v?'on':''}" onclick="segPick(this)">${l}</button>`).join('')}</div>
    </div>
    <div class="field"><label>Fee visibility</label>
      <div class="seg" id="fi-nd">${[['0','Show fee'],['1','Not disclosed']].map(([v,l])=>`<button data-v="${v}" class="${(f.notDisclosed?'1':'0')===v?'on':''}" onclick="segPick(this)">${l}</button>`).join('')}</div>
    </div>
    <button class="btn" id="fi-save" onclick="saveFinance('${eid}')">Save deal</button>
    <div class="hint" style="text-align:left;padding-top:10px">Foreign fees auto-convert to your base currency (${store.settings.baseCurrency}). Edit rates in Settings.</div>
    <div class="spacer"></div>
  `);
}
function saveFinance(eid){
  const e=sel.event(eid); const f=e.finance||{expenses:[]};
  withButton($('#fi-save'), ()=>{
    e.finance = Object.assign({}, f, {
      fee:+val('fi-fee')||0, currency:rawVal('fi-cur'), dealType:getSeg('fi-deal')||'Guarantee',
      commission:+val('fi-comm')||0, perDiem:+val('fi-pd')||0, paid:getSeg('fi-paid')==='1',
      notDisclosed:getSeg('fi-nd')==='1', estimated:false,
      expenses:f.expenses||[],
    });
    persist(); closeSheet(); renderView();
  }, 'Deal saved');
}
function togglePaid(eid){ const e=sel.event(eid); e.finance.paid=!e.finance.paid; haptic(); persist(); renderView(); toast(e.finance.paid?'Marked paid':'Marked unpaid', e.finance.paid?'check':'money'); }
function addExpense(eid){
  openSheet('Add expense', `
    <div class="row-2">
      <div class="field" style="flex:2"><label>What</label><input id="ex-label" class="input" placeholder="Flights, hotel, gear…"></div>
      <div class="field"><label>Amount</label><input id="ex-amt" type="number" inputmode="decimal" class="input" placeholder="220"></div>
    </div>
    <button class="btn" onclick="saveExpense('${eid}')">Add expense</button><div class="spacer"></div>
  `);
}
function saveExpense(eid){
  const label=val('ex-label'); const amount=+val('ex-amt')||0;
  if(!label && !amount){ toast('Add a label or amount','x'); return; }
  const e=sel.event(eid); (e.finance.expenses=e.finance.expenses||[]).push({id:uid('ex'),label,amount});
  persist(); closeSheet(); renderView(); toast('Expense added','receipt');
}
function delExpense(eid,xid){ const e=sel.event(eid); e.finance.expenses=e.finance.expenses.filter(x=>x.id!==xid); persist(); renderView(); }

/* ============================================================
   DAY SHEET — shareable advancing doc (ABOSS core, beaten on UX)
   ============================================================ */
function buildDaySheet(e){
  const c = money.eventCalc(e);
  const L=[];
  L.push(`🎧 DAY SHEET — ${e.venue||'Show'}`);
  L.push(`${e.city||''}${e.country?', '+e.country:''} · ${fmtDateLong(e.date)}`);
  L.push('');
  L.push('⏱ SCHEDULE');
  if(e.arrival) L.push(`  Arrival: ${e.arrival}`);
  if(e.flights&&e.flights.length) e.flights.forEach(f=>L.push(`  Flight ${f.code}: ${f.from} ${f.dep?f.dep.split(' ')[1]:''} → ${f.to} ${f.arr?f.arr.split(' ')[1]:''}${f.seat?' (seat '+f.seat+')':''}`));
  (e.timeline||[]).forEach(s=>L.push(`  ${s.time||''} ${s.title}`));
  if(e.setTime) L.push(`  Set time: ${e.setTime}`);
  L.push('');
  L.push('📍 VENUE');
  L.push(`  ${e.venue||''}`);
  if(e.venueAddr) L.push(`  ${e.venueAddr}`);
  if(e.hotel){ L.push(''); L.push('🏨 HOTEL'); L.push(`  ${e.hotel.name||''}`); if(e.hotel.address)L.push(`  ${e.hotel.address}`); if(e.hotel.conf)L.push(`  Conf: ${e.hotel.conf}`); if(e.hotel.checkin)L.push(`  ${fmtDate(e.hotel.checkin)} → ${e.hotel.checkout?fmtDate(e.hotel.checkout):''}`); }
  const contacts=[];
  if(e.driver) contacts.push(`  Driver — ${e.driver.name||''} ${e.driver.phone||''}`);
  if(e.promoter) contacts.push(`  Promoter — ${e.promoter.name||''} ${e.promoter.phone||''}`);
  if(contacts.length){ L.push(''); L.push('📞 CONTACTS'); contacts.forEach(x=>L.push(x)); }
  if(e.content){ L.push(''); L.push('🎬 CONTENT'); L.push(`  ${e.content}`); }
  if(c.gross){ L.push(''); L.push('💷 DEAL'); L.push(`  ${e.finance.dealType}: ${fmtMoney(c.gross,c.cur)} (${c.paid?'paid':'unpaid'})`); L.push(`  Net take-home: ${fmtMoney(c.net,c.cur)}`); }
  if(e.notes){ L.push(''); L.push('📝 NOTES'); L.push(`  ${e.notes}`); }
  L.push('');
  L.push('— via Operate');
  return L.join('\n');
}
function shareDaySheet(eid){
  const e=sel.event(eid); const text=buildDaySheet(e);
  const title=`Day Sheet — ${e.venue}`;
  if(navigator.share){ navigator.share({title, text}).then(()=>toast('Shared','share')).catch(()=>previewDaySheet(text)); }
  else previewDaySheet(text);
}
function previewDaySheet(text){
  window.__daysheet = text;
  openSheet('Day sheet', `
    <div class="card" style="white-space:pre-wrap;font-size:13.5px;line-height:1.55;font-family:ui-monospace,Menlo,monospace;color:var(--text-2);max-height:52dvh;overflow:auto">${esc(text)}</div>
    <div class="spacer"></div>
    <button class="btn" onclick="copyText(window.__daysheet); closeSheet();">${ICON.copy(16)} Copy day sheet</button>
    <div class="spacer"></div>
  `, {});
}

