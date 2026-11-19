/* ============================================================
   TRIP MODE  (Home takes over when a trip is active)
   ============================================================ */
function viewTripMode(run) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextShow = run.shows.find(e => { const d = parseDT(e.date); return d && d >= today; }) || run.shows[run.shows.length - 1];
    const tl = runTimeline(run);
    const nextTravelIdx = tl.findIndex(s => !s.done);
    const nextStep = nextTravelIdx >= 0 ? tl[nextTravelIdx] : null;
    const thenStep = nextTravelIdx >= 0 ? tl[nextTravelIdx + 1] : null;
    const p = runProgress(run);
    const pk = store.packing || [];
    return `
  <div class="lg-header">
    <div><div class="lg-title" style="font-size:28px">${esc(run.title)}</div><div class="lg-sub">Trip Mode · ${run.shows.length} show${run.shows.length > 1 ? 's' : ''} · ${p.done}/${p.total} done</div></div>
    <button class="header-btn" onclick="openView('trip','${run.key}')">${ICON.chevR(20)}</button>
  </div>
  <div class="screen-pad stagger">
    <div class="tripmode-banner"><span class="pulse"></span> LIVE · ${fmtDate(run.start)}${run.end !== run.start ? ' – ' + fmtDate(run.end) : ''}</div>

    <div class="section">
      <div class="section-head"><div class="section-title">Day timeline</div><div class="section-link">${tl.filter(x => x.done).length}/${tl.length}</div></div>
      ${dayTimeline(run.key, run)}
    </div>

    ${nextStep ? `
    <div class="hero nextshow">
      <div class="hero-label" style="color:var(--green)">${ICON.clock(14)} Up next${nextStep.time ? ' · ' + esc(nextStep.time) : ''} · ${esc(relDay(nextStep.date))}</div>
      <div class="hero-venue">${esc(nextStep.title)}</div>
      ${nextStep.sub ? `<div class="hero-city">${esc(nextStep.sub)}</div>` : ''}
      <button class="btn" style="margin-top:16px;background:var(--green);box-shadow:0 8px 24px rgba(50,215,75,0.3)" onclick="completeRunStep('${run.key}','${nextStep.id}')">${ICON.check(18)} Mark done</button>
    </div>
    ${thenStep ? `<div class="then-next">
      <div class="then-lab">Then</div>
      <div class="then-ic">${(ICON[thenStep.icon] || ICON.clock)(15)}</div>
      <div class="then-body"><b>${esc(thenStep.title)}</b><span>${thenStep.time ? esc(thenStep.time) + ' · ' : ''}${esc(relDay(thenStep.date))}${thenStep.sub ? ' · ' + esc(thenStep.sub) : ''}</span></div>
    </div>` : ''}` : `
    <div class="hero nextshow">
      <div class="hero-label" style="color:var(--green)">${ICON.check(14)} All steps complete</div>
      <div class="hero-venue">You're on top of it 🎧</div>
    </div>`}

    <div class="section">
      <div class="act-grid">
        <button class="act" onclick="openMaps('${jsAttr(nextShow ? (venueMapQuery(nextShow) || formatVenueAddress(nextShow) || ([nextShow.city, nextShow.country].filter(Boolean).join(', '))) : run.title)}')"><div class="ic" style="background:var(--blue-soft);color:var(--blue)">${ICON.map(20)}</div><span>Venue</span></button>
        <button class="act" onclick="openView('event','${nextShow ? nextShow.id : ''}')"><div class="ic" style="background:var(--accent-soft);color:var(--accent-2)">${ICON.music(20)}</div><span>Show</span></button>
        <button class="act" onclick="go('calendar')"><div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.calendar(20)}</div><span>Calendar</span></button>
        <button class="act" onclick="openView('contacts')"><div class="ic" style="background:var(--orange-soft);color:var(--orange)">${ICON.user(20)}</div><span>Contacts</span></button>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">Shows on this tour</div><div class="section-link">${run.shows.length}</div></div>
      <div class="card flush">${run.shows.map((e, i) => tripLegRow(e, i, nextShow)).join('')}</div>
    </div>

    <div class="section">
      ${foldSection('tm-pack', ICON.checkList(17), 'Packing & checklist', pk.filter(i => i.done).length + '/' + pk.length + ' packed', `<div style="padding:0 16px 4px"><div class="progress" style="margin:12px 0 4px"><i style="width:${pk.length ? Math.round(pk.filter(i => i.done).length / pk.length * 100) : 0}%"></i></div></div>
         <div class="fold-scroll">${pk.map(i => `<div class="check ${i.done ? 'done' : ''}" data-id="${esc(i.id)}"><div class="box" onclick="togglePack('${i.id}')">${ICON.check(15)}</div><div class="lbl">${esc(i.label)}</div><button class="del" onclick="delPack('${i.id}')">${ICON.x(16)}</button></div>`).join('') || '<div class="hint">No items</div>'}</div>
         <div class="fold-pad"><button class="btn secondary" style="padding:11px" onclick="addPackPrompt()">${ICON.plus(15)} Add item</button></div>`, false)}
    </div>

    <div class="section">
      <button class="btn secondary" onclick="endTripMode()">${ICON.flag(18)} End Trip Mode</button>
    </div>
    <div class="spacer"></div>
  </div>`;
}
function tripLegRow(e, i, nextEvent) {
    const c = CATS[e.color] || CATS.green;
    const isNext = nextEvent && e.id === nextEvent.id;
    // NEXT show: full semi-transparent orange card, all one tone
    const bg = isNext ? 'background:rgba(255,159,10,0.13);' : '';
    // Marker: completed = green tick, next = orange number, upcoming = neutral grey number
    const icBg = e.setDone ? 'rgba(50,215,75,0.18)' : isNext ? 'rgba(255,159,10,0.22)' : 'rgba(255,255,255,0.05)';
    const icCol = e.setDone ? 'var(--green)' : isNext ? 'var(--orange)' : 'var(--text-3)';
    return `<div class="row" style="${bg}" onclick="openView('event','${e.id}')">
    <div class="ic" style="background:${icBg};color:${icCol};font-weight:600;font-size:13px">${e.setDone ? ICON.check(16) : i + 1}</div>
    <div class="body"><b>${esc(e.venue)} ${isNext ? '<span class="tag hold" style="margin-left:4px">Next</span>' : ''}</b><span>${esc(e.city)}${e.country ? ', ' + esc(e.country) : ''} · ${esc(fmtDate(e.date))}${e.setTime ? ' · ' + esc(e.setTime) : ''}</span></div>
    ${ICON.chevR(15)}
  </div>`;
}
function stepShow(s) { if (s.kind === 'set')
    return sel.event(s.showId); if (s.ref && s.ref.showId)
    return sel.event(s.ref.showId); return null; }
/* City-aware maps query — always append the show's city/area so searches resolve */
/* Resolve the real airport (IATA code) for a ground transfer that references
   "Airport". Flights are written "BHX - IBZ" (depart BHX, arrive IBZ), so an
   arrival transfer (Airport → Hotel) wants the arrival code and a departure
   transfer (Hotel → Airport) wants the departure code — matched to the flight
   on the same day where possible. */
function transferAirportCode(sh, wantArrival, legDate) {
    if (!sh)
        return null;
    const valid = c => /^[A-Z]{3}$/.test(c);
    const flights = [];
    const push = (from, to, date) => {
        const f = (from || '').toString().trim().toUpperCase(), t = (to || '').toString().trim().toUpperCase();
        flights.push({ from: valid(f) ? f : '', to: valid(t) ? t : '', date: date || '' });
    };
    (sh.flights || []).forEach(f => push(f.from, f.to, sh.date));
    if (typeof showLegs === 'function') {
        showLegs(sh.id).forEach(l => {
            if (l.kind === 'travel' && (l.icon || 'plane') === 'plane') {
                normalizeLogisticItem(l);
                push(l.from, l.to, l.date);
            }
        });
    }
    if (!flights.length)
        return null;
    const arrs = flights.map(f => f.to).filter(Boolean);
    const deps = flights.map(f => f.from).filter(Boolean);
    if (wantArrival) {
        const sameDay = flights.find(f => f.date === legDate && f.to);
        return (sameDay && sameDay.to) || arrs[arrs.length - 1] || arrs[0] || deps[0] || null;
    }
    const sameDay = flights.find(f => f.date === legDate && f.from);
    if (sameDay && sameDay.from)
        return sameDay.from;
    const turnaround = deps.find(c => arrs.includes(c)); // depart from a place we also land at = the local airport
    return turnaround || arrs[arrs.length - 1] || deps[deps.length - 1] || null;
}
/* Turn a route token (Hotel / Airport / Venue / a place name) into a genuine,
   searchable Maps location pulled from the linked show — postcode-first for
   hotels, the real IATA code for airports, address for venues. `role` is
   'origin' or 'destination' so an Airport token maps to the arrival vs
   departure airport of that journey. */
function resolvePlace(token, sh, city, role, legDate) {
    const t = (token || '').replace(/\[[^\]]*\]/g, '').trim();
    if (!t)
        return '';
    if (/^venue$/i.test(t))
        return venueMapQuery(sh) || ('venue ' + city);
    if (/^hotel$/i.test(t)) {
        const q = sh ? hotelMapQuery(sh) : '';
        return q || ('hotel ' + city);
    }
    if (/^airport$/i.test(t)) {
        const code = transferAirportCode(sh, role !== 'destination', legDate);
        return code ? code + ' airport' : (city ? city + ' ' : '') + 'airport';
    }
    if (/^[A-Za-z]{3}$/.test(t))
        return t.toUpperCase() + ' airport'; // a bare IATA code
    return t + (city && !t.toLowerCase().includes(city.toLowerCase()) ? ' ' + city : '');
}
function resolveJourneyEndpoint(leg, side, sh, city, role, legDate) {
    if (!leg)
        return '';
    const isFrom = side === 'from' || side === 'origin' || side === 'departure';
    const kind = isFrom ? (leg.fromKind || '') : (leg.toKind || '');
    const name = isFrom ? (leg.fromName || leg.from) : (leg.toName || leg.to);
    const address = isFrom ? (leg.fromAddress || '') : (leg.toAddress || '');
    const iata = isFrom
        ? (leg.fromCode || (leg.flight_details && leg.flight_details.departure_airport_iata) || '')
        : (leg.toCode || (leg.flight_details && leg.flight_details.arrival_airport_iata) || '');
    const ctx = {
        hotelQuery: sh && typeof hotelMapQuery === 'function' ? hotelMapQuery(sh) : '',
        venueQuery: typeof venueMapQuery === 'function' ? venueMapQuery(sh) : '',
        airportQuery: (typeof transferAirportCode === 'function')
            ? (function () {
                const code = transferAirportCode(sh, role !== 'destination', legDate);
                return code ? code + ' airport' : '';
            })()
            : '',
        city: city || ''
    };
    const query = (typeof v2MapQueryForEndpoint === 'function')
        ? v2MapQueryForEndpoint({ kind, name, address, iata }, ctx)
        : '';
    if (query)
        return query;
    return resolvePlace(name, sh, city, role, legDate);
}
window.resolveJourneyEndpoint = resolveJourneyEndpoint;
/* Clean venue search — the venue NAME leads (it identifies the exact place),
   with city/country as context. The free-text venue address is deliberately
   NOT used: like a foreign hotel postcode, a slightly-off address drags Maps to
   the wrong spot, whereas "DC10, Ibiza" lands on the venue. Falls back to the
   address only when there's no venue name. */
function venueMapQuery(sh) {
    if (!sh)
        return '';
    /* Prefer street address; when missing, use venue name + city so Maps still lands on the right place. */
    const hasStreet = [sh.venueAddr, sh.venueAddr2, sh.venuePostcode].some(x => String(x || '').trim());
    if (hasStreet && typeof formatVenueAddress === 'function') {
        const addr = formatVenueAddress(sh);
        if (addr)
            return addr;
    }
    const venueName = typeof cleanVenue === 'function' ? cleanVenue(sh.venue) : String(sh.venue || '').trim();
    if (venueName) {
        const ctx = [sh.city, sh.country].map(x => String(x || '').trim()).filter(Boolean).join(', ');
        return ctx ? (venueName + ', ' + ctx) : venueName;
    }
    const parts = [sh.venueAddr, sh.venueAddr2, sh.city, sh.venueRegion, sh.venuePostcode, sh.country];
    const seen = new Set();
    return parts
        .map(x => String(x || '').trim())
        .filter(x => { if (!x)
        return false; const k = x.toLowerCase(); if (seen.has(k))
        return false; seen.add(k); return true; })
        .join(', ');
}
/* A driver/transfer leg is a journey (origin > destination) — return both ends for directions. */
function driverRoute(l) {
    if (l)
        normalizeLogisticItem(l);
    const sh = (l && l.showId) ? sel.event(l.showId) : null;
    const city = sh ? (sh.city || '') : '';
    const legDate = l && l.date;
    if (l && (l.from || l.to || l.fromAddress || l.toAddress || l.fromKind || l.toKind)) {
        const origin = resolveJourneyEndpoint(l, 'from', sh, city, 'origin', legDate);
        const dest = resolveJourneyEndpoint(l, 'to', sh, city, 'destination', legDate);
        if (origin && dest)
            return { origin, dest };
    }
    const route = (l && l.title || '').replace(/^\[?[^-\]]*\]?\s*-\s*/, '');
    const parts = route.split('>');
    if (parts.length < 2)
        return null;
    const origin = resolvePlace(parts[0], sh, city, 'origin', legDate);
    const dest = resolvePlace(parts[parts.length - 1], sh, city, 'destination', legDate);
    if (!origin || !dest)
        return null;
    return { origin, dest };
}
/* Open turn-by-turn directions (native Maps on iOS). */
function openDirections(origin, dest) {
    const o = encodeURIComponent(origin), d = encodeURIComponent(dest);
    openExternal('https://www.google.com/maps/dir/?api=1&origin=' + o + '&destination=' + d, 'maps://?saddr=' + o + '&daddr=' + d);
    toast('Opening route', 'map');
}
function tlMapsQuery(s) {
    const sh = stepShow(s);
    const city = sh ? (sh.city || '') : '';
    const it = s.ref || s;
    if (s.kind === 'set') {
        return venueMapQuery(sh);
    }
    if (s.kind === 'stay') {
        if (it && it.kind === 'stay')
            normalizeLogisticItem(it);
        // Prefer the show's saved hotel (postcode-first); fall back to the leg's own place.
        const hq = sh ? hotelMapQuery(sh) : '';
        if (hq)
            return hq;
        const name = (it && it.place) || (it && it.addr) || (s.title || '').replace(/^.*hotel\s*-\s*/i, '').replace(/^\[[^\]]*\]\s*-?\s*/, '').trim();
        return name ? name + (city ? ' ' + city : '') : (city ? 'hotel ' + city : '');
    }
    if (s.kind === 'travel') {
        if (it && it.kind === 'travel')
            normalizeLogisticItem(it);
        // Flights ALWAYS resolve to the DEPARTURE airport alone — the first code in
        // e.g. "MAN > IBZ" is MAN. Never leak the whole route ("MAN > IBZ Ibiza")
        // into the search: pull the code from the from-field, then the route in the
        // title/code, then any 3-letter token, and fall back to the city airport.
        if ((s.icon || 'plane') === 'plane') {
            let dep = '';
            const fromCode = String((it && it.from) || '').match(/[A-Za-z]{3}/);
            if (fromCode)
                dep = fromCode[0];
            if (!/^[A-Za-z]{3}$/.test(dep)) {
                const leg = parseLogisticRouteFromLegacy(String((it && it.title) || s.title || (it && it.code) || ''));
                if (leg) {
                    const c = leg.from.match(/[A-Za-z]{3}/);
                    if (c)
                        dep = c[0];
                }
            }
            if (!/^[A-Za-z]{3}$/.test(dep)) {
                const blob = [it && it.from, it && it.code, it && it.title, s.title].map(x => String(x || '')).join(' ');
                const codes = blob.match(/\b[A-Za-z]{3}\b/g);
                if (codes && codes.length)
                    dep = codes[0];
            }
            if (/^[A-Za-z]{3}$/.test(dep))
                return dep.toUpperCase() + ' airport';
            return (city ? city + ' ' : '') + 'airport';
        }
        let dest = (it && it.to) ? String(it.to).trim() : '';
        if (!dest) {
            const leg = parseLogisticRouteFromLegacy(s.title);
            if (leg)
                dest = leg.to.trim();
        }
        // Resolve the destination to a genuine location from the show info.
        if (it) {
            const destQ = resolveJourneyEndpoint(it, 'to', sh, city, 'destination', it.date || s.date);
            if (destQ)
                return destQ;
        }
        if (/^venue$/i.test(dest))
            return venueMapQuery(sh) || dest;
        if (/^hotel$/i.test(dest)) {
            const hq = sh ? hotelMapQuery(sh) : '';
            return hq || ('hotel ' + (city || ''));
        }
        if (/^airport$/i.test(dest)) {
            const code = transferAirportCode(sh, false, it.date || s.date);
            return code ? code + ' airport' : (city ? city + ' ' : '') + 'airport';
        }
        if (/^[A-Z]{3}$/i.test(dest))
            return dest.toUpperCase() + ' airport';
        return dest + (city && !dest.toLowerCase().includes(city.toLowerCase()) ? ' ' + city : '');
    }
    return '';
}
/* Adaptive action widgets for a step, based on what it is */
function stepPills(s) {
    const sh = stepShow(s);
    const pills = [];
    const mq = tlMapsQuery(s);
    const mapPill = (label, sub) => `<div class="pill" onclick="event.stopPropagation();openMaps('${jsAttr(mq)}')"><div class="ic">${ICON.map(16)}</div><div class="tx"><b>${label}</b><span>${sub}</span></div></div>`;
    if (s.embedded) {
        const d = s.ref || {};
        if (s.kind === 'travel' && d.icon === 'car') {
            if (d.noGround)
                pills.push(`<div class="pill" onclick="event.stopPropagation();openExternal('https://m.uber.com/','uber://')"><div class="ic">${ICON.car(16)}</div><div class="tx"><b>Uber/taxi</b><span>No grounds</span></div></div>`);
            else {
                const wa = d.whatsapp || d.phone || '';
                if (wa)
                    pills.push(`<div class="pill" onclick="event.stopPropagation();whatsapp('${jsAttr(wa)}')"><div class="ic">${ICON.chat(16)}</div><div class="tx"><b>Message</b><span>WhatsApp</span></div></div>`);
                if (d.phone)
                    pills.push(`<div class="pill" onclick="event.stopPropagation();callNumber('${jsAttr(d.phone)}')"><div class="ic">${ICON.phone(16)}</div><div class="tx"><b>Call</b><span>Now</span></div></div>`);
            }
            if (sh)
                pills.push(`<div class="pill" onclick="event.stopPropagation();openTourContacts('${sh.id}')"><div class="ic">${ICON.users(16)}</div><div class="tx"><b>Key contacts</b><span>Call someone</span></div></div>`);
            if (mq)
                pills.push(mapPill('Destination', 'Open in Maps'));
        }
        else if (mq) {
            pills.push(mapPill(s.kind === 'stay' ? 'Accommodation' : 'Maps', 'Open in Maps'));
        }
        if (sh)
            pills.push(`<div class="pill" onclick="event.stopPropagation();openView('event','${sh.id}')"><div class="ic">${ICON.music(16)}</div><div class="tx"><b>Show</b><span>All details</span></div></div>`);
        return pills.join('');
    }
    if (s.kind === 'travel') {
        const isFlight = (s.icon || 'plane') === 'plane';
        if (isFlight) {
            const it = s.ref;
            const has = it && it.passes && it.passes.length;
            if (mq)
                pills.push(mapPill('Maps', 'Open in Maps'));
            if (has)
                pills.push(`<div class="pill" onclick="event.stopPropagation();viewItemPass('${it.id}')"><div class="ic">${ICON.ticket(16)}</div><div class="tx"><b>Boarding pass</b><span>View</span></div></div>`);
            else
                pills.push(`<label class="pill"><div class="ic">${ICON.ticket(16)}</div><div class="tx"><b>Boarding pass</b><span>Upload</span></div><input type="file" accept="${PASS_FILE_ACCEPT}" style="display:none" onchange="uploadItemPass('${it.id}',this)"></label>`);
        }
        else {
            const it = s.ref;
            // Fall back to the show's saved driver contact when the leg itself has none
            const phone = (it && it.phone) || (sh && sh.driver && sh.driver.phone) || '';
            const wa = (it && it.whatsapp) || (sh && sh.driver && sh.driver.whatsapp) || phone;
            if (phone) {
                pills.push(`<div class="pill" onclick="event.stopPropagation();whatsapp('${jsAttr(wa)}')"><div class="ic">${ICON.chat(16)}</div><div class="tx"><b>Message</b><span>WhatsApp</span></div></div>`);
                pills.push(`<div class="pill" onclick="event.stopPropagation();callNumber('${jsAttr(phone)}')"><div class="ic">${ICON.phone(16)}</div><div class="tx"><b>Call driver</b><span>Now</span></div></div>`);
            }
            else if (sh && showDrivers(sh).length) {
                pills.push(`<div class="pill" onclick="event.stopPropagation();showTransport('${sh.id}')"><div class="ic">${ICON.car(16)}</div><div class="tx"><b>Transport</b><span>View</span></div></div>`);
            }
            else {
                pills.push(`<div class="pill" onclick="event.stopPropagation();openItem('${it.id}')"><div class="ic">${ICON.car(16)}</div><div class="tx"><b>Driver</b><span>Add contact</span></div></div>`);
            }
            if (sh)
                pills.push(`<div class="pill" onclick="event.stopPropagation();openTourContacts('${sh.id}')"><div class="ic">${ICON.users(16)}</div><div class="tx"><b>Key contacts</b><span>Call someone</span></div></div>`);
            if (mq)
                pills.push(mapPill('Destination', 'Open in Maps'));
        }
    }
    else if (s.kind === 'stay') {
        if (mq)
            pills.push(mapPill('Accommodation', 'Open in Maps'));
        if (sh)
            pills.push(`<div class="pill" onclick="event.stopPropagation();openView('event','${sh.id}')"><div class="ic">${ICON.bed(16)}</div><div class="tx"><b>Details</b><span>Full show</span></div></div>`);
    }
    else if (s.kind === 'set') {
        if (sh) {
            if (mq) {
                const addrLabel = formatVenueAddress(sh) || sh.venueAddr || '';
                pills.push(mapPill('Venue', addrLabel ? esc(addrLabel.slice(0, 22)) : 'Open in Maps'));
            }
            if (sh.promoter && (sh.promoter.phone || sh.promoter.whatsapp))
                pills.push(`<div class="pill" onclick="event.stopPropagation();contactPromoter('${sh.id}')"><div class="ic">${ICON.user(16)}</div><div class="tx"><b>Liaison</b><span>WhatsApp</span></div></div>`);
            const dl = showDrivers(sh);
            const dn = dl.filter(d => !d.noGround).length;
            const ng = dl.some(d => d.noGround);
            if (dl.length)
                pills.push(`<div class="pill" onclick="event.stopPropagation();showTransport('${sh.id}')"><div class="ic">${ICON.car(16)}</div><div class="tx"><b>Transport</b><span>${dn ? dn + ' driver' + (dn > 1 ? 's' : '') + (ng ? ' · Uber' : '') : 'Uber/taxi'}</span></div></div>`);
            pills.push(`<div class="pill" onclick="event.stopPropagation();openView('event','${sh.id}')"><div class="ic">${ICON.music(16)}</div><div class="tx"><b>Show</b><span>All details</span></div></div>`);
        }
    }
    return pills.join('');
}
/* Compact per-step actions (icon buttons) for the day timeline rows */
function tlActions(s) {
    const btns = [];
    const mq = tlMapsQuery(s);
    if (mq)
        btns.push(`<button class="tl-btn" onclick="event.stopPropagation();openMaps('${jsAttr(mq)}')">${ICON.map(15)}</button>`);
    const sh = stepShow(s);
    const isFlight = s.kind === 'travel' && (s.icon || 'plane') === 'plane';
    if (isFlight) {
        const it = s.ref;
        const has = it && it.passes && it.passes.length;
        if (has)
            btns.push(`<button class="tl-btn" onclick="event.stopPropagation();viewItemPass('${it.id}')">${ICON.ticket(15)}</button>`);
        else
            btns.push(`<label class="tl-btn">${ICON.ticket(15)}<input type="file" accept="${PASS_FILE_ACCEPT}" style="display:none" onchange="uploadItemPass('${it.id}',this)"></label>`);
    }
    if (s.embedded && s.kind === 'travel' && s.ref && s.ref.icon === 'car') {
        const d = s.ref;
        if (d.noGround)
            btns.push(`<button class="tl-btn" onclick="event.stopPropagation();openExternal('https://m.uber.com/','uber://')">${ICON.car(15)}</button>`);
        else {
            const w = d.whatsapp || d.phone;
            if (w)
                btns.push(`<button class="tl-btn" onclick="event.stopPropagation();whatsapp('${jsAttr(w)}')">${ICON.chat(15)}</button>`);
        }
    }
    const isDriver = !s.embedded && s.kind === 'travel' && ((s.icon || 'plane') === 'car' || (s.ref && isDriverItem(s.ref)));
    if (isDriver && sh && sh.driver && (sh.driver.phone || sh.driver.whatsapp)) {
        const w = sh.driver.whatsapp || sh.driver.phone;
        btns.push(`<button class="tl-btn" onclick="event.stopPropagation();whatsapp('${jsAttr(w)}')">${ICON.chat(15)}</button>`);
    }
    if (s.kind === 'set' && sh && showDrivers(sh).length) {
        btns.push(`<button class="tl-btn" onclick="event.stopPropagation();showTransport('${sh.id}')">${ICON.car(15)}</button>`);
    }
    return btns.join('');
}
function viewItemPass(itemId, passId) {
    if (passId) {
        openPassByRef(itemId, passId);
        return;
    }
    const it = store.events.find(x => x.id === itemId);
    if (it && (it.passes || []).length) {
        openPassByRef(itemId, it.passes[0].id);
        return;
    }
    /* Embedded show flights live on the show, not as logistics rows. */
    for (const e of (store.events || [])) {
        if ((e.kind || 'show') !== 'show' || !e.flights)
            continue;
        const f = e.flights.find(x => x.id === itemId);
        if (!f)
            continue;
        const passes = typeof flightAllPasses === 'function' ? flightAllPasses(f) : (f.passes || []);
        if (!passes.length) {
            toast('No pass', 'x');
            return;
        }
        openPassByRef(e.id, passes[0].id, f.id);
        return;
    }
    toast('No pass', 'x');
}
function uploadItemPass(itemId, input) {
    toast('Uploading pass…', 'ticket');
    readFile(input, att => {
        attachPassToLogisticsItem(itemId, att).then(ok => {
            if (ok)
                toast('Boarding pass added', 'check');
            else
                toast('Could not attach pass', 'x');
        });
    });
}
/* Calendar-day groups for the React tour timeline (same date pills as show page). */
function groupRunTimelineForPreview(run) {
    const list = runTimeline(run);
    const n = new Date();
    const today = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
    const groups = [];
    list.forEach(s => {
        const date = String(s.trueDate || s.date || s.showDate || '').slice(0, 10);
        const last = groups[groups.length - 1];
        if (!last || last.date !== date) {
            groups.push({
                date,
                label: (typeof fmtDate === 'function' ? fmtDate(date) : date) || date,
                today: !!(date && date === today),
                steps: [s]
            });
        }
        else {
            last.steps.push(s);
        }
    });
    return { groups, list };
}
/* Live “now” dot for tour timeline steps on today’s calendar date. */
function runTimelineLiveState(run, tl) {
    const list = Array.isArray(tl) ? tl : (run ? runTimeline(run) : []);
    const n = new Date();
    const today = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
    const todaySteps = list.filter(s => String(s.trueDate || s.date || s.showDate || '').slice(0, 10) === today);
    if (typeof showTimelineLiveState !== 'function') {
        return { showDay: false, activeId: null, beforeIds: [], progress: 0, upcoming: false };
    }
    return showTimelineLiveState({ date: today }, todaySteps);
}
/* Group the run timeline by show so overnight items stay on that show's itinerary. */
function runTimelineByDay(run) {
    const rows = runTimeline(run);
    const groups = [];
    const byKey = Object.create(null);
    rows.forEach(r => {
        const key = r.showId || ('date:' + (r.showDate || r.date || ''));
        if (!byKey[key]) {
            const show = r.showId ? run.shows.find(s => s.id === r.showId) : null;
            const date = (show && show.date) || r.showDate || r.date || '';
            byKey[key] = { date, show, rows: [] };
            groups.push(byKey[key]);
        }
        byKey[key].rows.push(r);
    });
    return groups;
}
/* One collapsible block per show — collapsed by default except the current show.
   Overnight items stay with their show instead of splitting onto the next calendar day. */
function dayTimeline(runKey, run) {
    const groups = runTimelineByDay(run);
    if (!groups.length)
        return '<div class="hint">Add flights & hotels inside each show</div>';
    const next = runTimeline(run).find(s => !s.done);
    const openKey = next ? (next.showId || next.showDate || next.date) : (groups[0] && ((groups[0].show && groups[0].show.id) || groups[0].date));
    const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; })();
    return groups.map(g => {
        const d = parseDT(g.date);
        const done = g.rows.filter(r => r.done).length;
        const allDone = g.rows.length > 0 && done === g.rows.length;
        const setRow = g.rows.find(r => r.kind === 'set');
        const label = d ? (DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + (g.date === todayStr ? ' · Today' : '')) : (g.date || 'Show');
        const sub = (setRow ? setRow.title + ' · ' : '') + done + '/' + g.rows.length + ' done';
        const groupKey = g.show ? g.show.id : g.date;
        return foldSection('tld' + runKey + groupKey, allDone ? ICON.check(16) : ICON.calendar(16), label, sub, g.rows.map(s => tlRow(runKey, s)).join(''), allDone ? false : (groupKey === openKey), allDone ? 'fold-done' : '');
    }).join('<div style="height:10px"></div>');
}
function tlRow(runKey, s) {
    const isSet = s.kind === 'set';
    const col = isSet ? 'var(--accent-2)' : logColor({ kind: s.kind, icon: s.icon });
    const btns = stepButtons(s);
    /* Checkbox is on the right and only toggles when that box is tapped.
       Tapping the rest of the row opens edit options (does not mark done). */
    return `<div class="tlr ${s.done ? 'done' : ''}">
    <button type="button" class="tlr-main" onclick="timelineStepOptions('${runKey}','${jsAttr(s.id)}')">
      <div class="tlr-time">${esc(s.time || '')}</div>
      <div class="tlr-ic" style="color:${col}">${(ICON[s.icon] || ICON.clock)(19)}</div>
      <div class="tlr-body"><b>${esc(s.title)}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ''}</div>
    </button>
    <button type="button" class="tlr-tick ${s.done ? 'on' : ''}" aria-label="${s.done ? 'Mark not done' : 'Mark done'}" onclick="event.stopPropagation();completeRunStep('${runKey}','${jsAttr(s.id)}')">${s.done ? ICON.check(15) : ''}</button>
    ${btns ? `<div class="tlr-actions">${btns}</div>` : ''}
  </div>`;
}
/* Tap a timeline row (not the checkbox) → choose Edit / related actions. */
function timelineStepOptions(runKey, stepId) {
    const run = runOf(runKey);
    if (!run)
        return;
    const s = runTimeline(run).find(x => x.id === stepId);
    if (!s)
        return;
    const bits = [s.time ? esc(s.time) : '', s.sub ? esc(s.sub) : ''].filter(Boolean).join(' · ');
    openSheetReact(s.title || 'Timeline step', 'trip.timelineOptions', { runKey, stepId, step: s });
}
function editTimelineStep(runKey, stepId) {
    const run = runOf(runKey);
    if (!run)
        return;
    const s = runTimeline(run).find(x => x.id === stepId);
    if (!s)
        return;
    if (s.kind === 'set' && s.showId) {
        openView('event', s.showId);
        return;
    }
    if (String(stepId).startsWith('shflt_')) {
        const fid = stepId.slice(6);
        const shId = (s.ref && s.ref.showId) || (store.events.find(e => (e.flights || []).some(f => f.id === fid)) || {}).id;
        if (shId && typeof sheetFlight === 'function') {
            sheetFlight(shId, fid);
            return;
        }
    }
    if (String(stepId).startsWith('shhotel_')) {
        const shId = stepId.slice(8);
        if (typeof sheetHotel === 'function') {
            sheetHotel(shId);
            return;
        }
    }
    if (String(stepId).startsWith('shdrv_')) {
        const did = stepId.slice(6);
        const shId = s.ref && s.ref.showId;
        const sh = shId ? sel.event(shId) : null;
        if (sh && typeof sheetDriver === 'function') {
            const idx = showDrivers(sh).findIndex(d => d.id === did);
            sheetDriver(sh.id, idx >= 0 ? idx : undefined);
            return;
        }
    }
    const itemId = (s.ref && s.ref.id && !s.embedded) ? s.ref.id : ((store.events || []).some(x => x.id === stepId) ? stepId : null);
    if (itemId && typeof openItem === 'function') {
        openItem(itemId);
        return;
    }
    if (s.showId) {
        openView('event', s.showId);
        return;
    }
    toast('Open the show to edit this', 'x');
}
function tlItem(tripId, s, isNow) {
    return `<div class="tl-item ${s.done ? 'done' : ''} ${isNow && !s.done ? 'now' : ''}" data-id="${esc(s.id)}">
    <div class="tl-time">${esc(s.time)}</div>
    <div class="tl-line"><div class="tl-node"></div></div>
    <div class="tl-card" onclick="completeStep('${tripId}','${s.id}')">
      <b>${esc(s.title)}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ''}
      ${!s.done ? `<div class="swipe-hint">${ICON.check(12)} Tap to complete</div>` : ''}
    </div>
  </div>`;
}
/* ============================================================
   TRIPS  (list)
   ============================================================ */
function viewTrips() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = runs();
    const upcoming = all.filter(r => parseDT(r.end) >= today);
    const past = all.filter(r => parseDT(r.end) < today).reverse();
    return `
  <div class="lg-header">
    <div><div class="lg-title">Tours</div><div class="lg-sub">Grouped from your shows${activeRun() ? ' · 1 live now' : ''}</div></div>
    <button class="header-btn" onclick="go('calendar')">${ICON.calendar(20)}</button>
  </div>
  <div class="screen-pad">
    ${pageIntro('tours', 'Tours group themselves', 'A tour runs from the flight that leaves your home airport to the flight that brings you back. Tap a tour for the day-of timeline and packing.')}
    ${tabBlurb('A tour starts when you leave your home airport and ends when you fly back.')}
    ${upcoming.length ? `<div class="stagger">${upcoming.map(runCard).join('')}</div>`
        : `<div class="empty"><div class="ic">${ICON.trips(28)}</div><b>No upcoming tours</b><span>Add shows first — a tour starts when you fly out from your home airport and ends when you land back there.</span><button class="btn secondary" style="margin-top:14px;max-width:240px" onclick="go('calendar')">${ICON.calendar(18)} Go to Calendar</button></div>`}
    ${past.length ? `<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px;color:var(--text-2)">Past</div></div>
      <div class="card flush">${past.slice(0, 12).map(runRow).join('')}</div></div>` : ''}
    <div class="spacer"></div>
  </div>`;
}
/* Tours list — destinations as title, date range underneath (Shows → Tours). */
function runDateLabel(run) {
    if (!run || !run.start)
        return 'Tour';
    const a = fmtDate(run.start);
    if (!run.end || run.end === run.start)
        return a;
    return a + ' – ' + fmtDate(run.end);
}
function runDestinationsSummary(run) {
    const shows = (run && run.shows) || [];
    const cities = [];
    shows.forEach(s => {
        const c = String(s.city || '').trim();
        if (c && cities.indexOf(c) === -1)
            cities.push(c);
    });
    if (!cities.length) {
        shows.forEach(s => {
            const v = typeof cleanVenue === 'function' ? cleanVenue(s.venue) : String(s.venue || '').trim();
            const name = String(s.eventName || '').trim();
            const label = (v && v.toLowerCase() !== 'venue' ? v : '') || name;
            if (label && cities.indexOf(label) === -1)
                cities.push(label);
        });
    }
    const n = cities.length;
    if (!n)
        return shows.length ? (shows.length + ' show' + (shows.length !== 1 ? 's' : '')) : 'Tour';
    if (n <= 3)
        return cities.join(', ');
    return cities.slice(0, 2).join(', ') + ' +' + (n - 2) + ' more';
}
function tourListShowRows(run) {
    const body = (run.shows || []).map(e => (typeof showListRow === 'function' ? showListRow(e) : '')).filter(Boolean).join('');
    return body ? '<div class="card flush tour-list-shows">' + body + '</div>' : '<div class="hint" style="padding:12px 16px">No shows in this tour.</div>';
}
function runCard(r) {
    const c = CATS[r.color] || CATS.green;
    const active = activeRun() && activeRun().key === r.key;
    const sub = (active ? 'Live · ' : '') + runDateLabel(r);
    const fold = foldSection('tourlist_' + r.key, ICON.trips(17), runDestinationsSummary(r), sub, tourListShowRows(r), false, active ? 'tour-list-fold tour-list-live' : 'tour-list-fold');
    return '<div class="tour-list-item" style="margin-bottom:14px">' + fold + '</div>';
}
function runRow(r) {
    return runCard(r);
}
/* ============================================================
   TRIP DETAIL
   ============================================================ */
function scrollUpNextCarousel() {
    document.querySelectorAll('.up-next-carousel[data-next-idx]').forEach(el => {
        const idx = parseInt(el.getAttribute('data-next-idx'), 10);
        if (!Number.isFinite(idx) || idx < 0)
            return;
        const slide = el.querySelector('[data-step-idx="' + idx + '"]');
        if (slide)
            slide.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
        upNextCarouselSyncNav(el);
    });
}
function upNextCarouselSyncNav(carousel) {
    if (!carousel)
        return;
    const deck = carousel.closest('.up-next-deck');
    if (!deck)
        return;
    const slides = carousel.querySelectorAll('.up-next-slide');
    const n = slides.length;
    if (!n)
        return;
    const w = Math.max(carousel.clientWidth, 1);
    const idx = Math.max(0, Math.min(Math.round(carousel.scrollLeft / w), n - 1));
    const pos = deck.querySelector('.up-next-deck-pos');
    if (pos)
        pos.textContent = (idx + 1) + ' / ' + n;
    const nav = deck.querySelector('.up-next-deck-nav');
    if (!nav)
        return;
    const prev = nav.querySelector('[data-up-next-prev]');
    const next = nav.querySelector('[data-up-next-next]');
    if (prev)
        prev.disabled = idx <= 0;
    if (next)
        next.disabled = idx >= n - 1;
}
function scrollUpNextCarouselPage(dir, btn) {
    const deck = btn && btn.closest ? btn.closest('.up-next-deck') : null;
    const carousel = deck ? deck.querySelector('.up-next-carousel') : null;
    if (!carousel)
        return;
    carousel.scrollBy({ left: dir * carousel.clientWidth, behavior: 'smooth' });
}
function upNextCarouselScroll(carousel) {
    upNextCarouselSyncNav(carousel);
}
function upNextCarouselHtml(runKey, tl) {
    if (!tl.length)
        return '<div class="hint">Add flights & hotels inside each show</div>';
    const nextIdx = Math.max(0, tl.findIndex(s => !s.done));
    const cards = tl.map((s, i) => {
        const pills = stepPills(s) || '';
        const flight = (s.ref && s.kind === 'travel' && (s.ref.icon || 'plane') === 'plane') ? flightInfoWidget(s.ref) : '';
        return `<article class="up-next-slide up-next-pane hero nextshow" data-step-idx="${i}" onclick="timelineStepOptions('${runKey}','${jsAttr(s.id)}')">
      <div class="hero-label">${(ICON[s.icon] || ICON.clock)(14)} ${esc(relDay(s.date))}${s.time ? ' · ' + esc(s.time) : ''}</div>
      <div class="hero-venue" style="font-size:22px;margin-top:6px">${esc(s.title)}</div>
      ${s.sub ? `<div class="hero-city">${esc(s.sub)}</div>` : ''}
      ${pills ? `<div class="hero-info" style="margin-top:15px;flex-wrap:wrap">${pills}</div>` : ''}
      ${flight}
    </article>`;
    }).join('');
    return `<div class="card up-next-deck">
      <div class="up-next-deck-head">
        <p class="up-next-scroll-hint up-next-scroll-hint--touch">Swipe for earlier or later steps</p>
        <p class="up-next-scroll-hint up-next-scroll-hint--desktop">Use arrows or the scrollbar below</p>
        <div class="up-next-deck-nav">
          <button type="button" class="header-btn" data-up-next-prev title="Previous step" onclick="scrollUpNextCarouselPage(-1, this)">${ICON.chevL(18)}</button>
          <span class="up-next-deck-pos">1 / ${tl.length}</span>
          <button type="button" class="header-btn" data-up-next-next title="Next step" onclick="scrollUpNextCarouselPage(1, this)">${ICON.chevR(18)}</button>
        </div>
      </div>
      <div class="up-next-carousel up-next-carousel--inset up-next-carousel--desktop-bar" data-next-idx="${nextIdx}" onscroll="upNextCarouselScroll(this)">${cards}</div>
    </div>`;
}
function syncTourModeViewToggle(isDay) {
    const seg = document.getElementById('tour-mode-view-seg');
    if (!seg)
        return;
    const opts = seg.querySelectorAll('.tour-mode-seg-opt');
    if (opts[0])
        opts[0].classList.toggle('active', !isDay);
    if (opts[1])
        opts[1].classList.toggle('active', isDay);
    const label = isDay ? 'Tour timeline — click for up next' : 'Up next — click for tour timeline';
    seg.setAttribute('aria-label', label);
}
function flipTourModeDashboardView(btn) {
    let tourDashDay = false;
    try {
        tourDashDay = sessionStorage.getItem('operate_tour_dash_view') === 'day';
    }
    catch (e) { }
    setTourModeDashboardView(tourDashDay ? 'upnext' : 'day');
}
function setTourModeDashboardView(mode) {
    try {
        sessionStorage.setItem('operate_tour_dash_view', mode === 'day' ? 'day' : 'upnext');
    }
    catch (_) { }
    const up = document.getElementById('tour-view-upnext');
    const day = document.getElementById('tour-view-day');
    const isDay = mode === 'day';
    if (up)
        up.style.display = isDay ? 'none' : '';
    if (day)
        day.style.display = isDay ? '' : 'none';
    syncTourModeViewToggle(isDay);
    if (!isDay && typeof scrollUpNextCarousel === 'function')
        requestAnimationFrame(scrollUpNextCarousel);
}
/* The live tour dashboard body — shared by the Tour Mode tab and the tour
   detail overlay so both are always identical. */
function tripBody(r) {
    const c = CATS[r.color] || CATS.green;
    const active = activeRun() && activeRun().key === r.key;
    const tl = runTimeline(r);
    const pk = store.packing || [];
    const nextIdx = tl.findIndex(s => !s.done);
    const nextStep = nextIdx >= 0 ? tl[nextIdx] : null;
    const legShow = nextStep ? (stepShow(nextStep) || r.shows.find(s => !s.setDone)) : null;
    let tourDashDay = false;
    try {
        tourDashDay = sessionStorage.getItem('operate_tour_dash_view') === 'day';
    }
    catch (e) { }
    return `
    <div class="dhero">
      <div class="cat-bar" style="background:${c}"></div>
      ${active ? `<div style="margin-bottom:8px"><span class="tag confirmed"><span class="pulse" style="display:inline-block;margin-right:5px"></span>Live</span></div>` : ''}
      <h1>${esc(r.title)}</h1>
      <div class="sub">${ICON.calendar(14)} ${fmtDateLong(r.start)}${r.end !== r.start ? ' – ' + fmtDate(r.end) : ''}</div>
    </div>
    <button type="button" class="tour-mode-seg" id="tour-mode-view-seg" aria-label="${tourDashDay ? 'Tour timeline — click for up next' : 'Up next — click for tour timeline'}" onclick="flipTourModeDashboardView(this)">
      <span class="tour-mode-seg-opt ${tourDashDay ? '' : 'active'}">Up next</span>
      <span class="tour-mode-seg-opt ${tourDashDay ? 'active' : ''}">Tour timeline</span>
    </button>

    <div class="section" style="margin-top:14px">
      <div id="tour-view-upnext" style="${tourDashDay ? 'display:none' : ''}">${upNextCarouselHtml(r.key, tl)}</div>
      <div id="tour-view-day" style="${tourDashDay ? '' : 'display:none'}">
        <div class="section-head" style="margin-top:0">
          <div class="section-title">Tour timeline</div>
          <div class="section-link">${r.shows.length} day${r.shows.length !== 1 ? 's' : ''}</div>
        </div>
        ${dayTimeline(r.key, r)}
      </div>
    </div>

    ${tourContactsCompactHtml(r)}

    <!-- 3) SHOWS ON THIS TOUR -->
    <div class="section">
      <div class="section-head"><div class="section-title">Shows on this tour</div><div class="section-link">${r.shows.length}</div></div>
      <div class="card flush">${r.shows.map((e, i) => tripLegRow(e, i, legShow)).join('')}</div>
    </div>

    <!-- Packing -->
    <div class="section">
      ${foldSection('trip-pack', ICON.checkList(17), 'Packing & checklist', pk.filter(i => i.done).length + '/' + pk.length + ' packed', `<div style="padding:0 16px 4px"><div class="progress" style="margin:12px 0 4px"><i style="width:${pk.length ? Math.round(pk.filter(i => i.done).length / pk.length * 100) : 0}%"></i></div></div>
         <div class="fold-scroll">${pk.map(i => `<div class="check ${i.done ? 'done' : ''}" data-id="${esc(i.id)}"><div class="box" onclick="togglePack('${i.id}')">${ICON.check(15)}</div><div class="lbl">${esc(i.label)}</div><button class="del" onclick="delPack('${i.id}')">${ICON.x(16)}</button></div>`).join('') || '<div class="hint">No items</div>'}</div>
         <div class="fold-pad"><button class="btn secondary" style="padding:11px" onclick="addPackPrompt()">${ICON.plus(15)} Add item</button></div>`, false)}
    </div>

    ${active ? `<div class="section" style="margin-top:20px"><button class="btn secondary" onclick="endTripMode()">${ICON.flag(17)} End Trip Mode</button></div>` : ''}
    <div class="spacer"></div><div class="spacer"></div>
  `;
}
function viewTrip(id) {
    const r = runOf(id);
    if (!r)
        return backStub();
    const active = activeRun() && activeRun().key === r.key;
    return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Tours</button>
    <div style="font-size:15px;font-weight:700">${active ? 'Trip Mode' : 'Tour'}</div>
    <div style="width:36px"></div>
  </div></div>
  <div class="screen-pad stagger">${tripBody(r)}</div>`;
}
/* Dedicated Tour Mode tab — the DJ's live screen, shown directly (no list or
   click-through). Picks the active tour, else the next upcoming, else latest. */
function viewToursTab() {
    const all = runs();
    if (!all.length)
        return `
  <div class="tab-page">
    <div class="tab-page-sticky">
      <div class="lg-header"><div><div class="lg-title">Tour Mode</div><div class="lg-sub">Your live tour dashboard</div></div></div>
    </div>
    <div class="screen-pad tab-page-body"><div class="empty"><div class="ic">${ICON.trips(28)}</div><b>No tours yet</b><span>A tour is the shows between your flight out from home and your flight back.</span><button class="btn secondary" style="margin-top:14px;max-width:240px" onclick="go('shows')">${ICON.music(18)} Go to Shows</button></div></div>
  </div>`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const r = activeRun() || all.find(x => parseDT(x.end) >= today) || all[all.length - 1];
    const active = activeRun() && activeRun().key === r.key;
    const upcoming = all.filter(x => parseDT(x.end) >= today);
    return `
  <div class="tab-page">
    <div class="tab-page-sticky">
      <div class="lg-header">
        <div><div class="lg-title">Tour Mode</div><div class="lg-sub">${active ? 'Live now' : (parseDT(r.end) >= today ? 'Next tour' : 'Latest tour')}${upcoming.length > 1 ? ' · ' + upcoming.length + ' upcoming' : ''}</div></div>
        <button class="header-btn" onclick="goToursList()" title="All tours">${ICON.trips(20)}</button>
      </div>
    </div>
    <div class="screen-pad tab-page-body stagger">${tripBody(r)}</div>
  </div>`;
}
/* The tours list body — reused inside the Shows/Tours toggle. */
function toursListBody() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = runs();
    const upcoming = all.filter(r => parseDT(r.end) >= today);
    const past = all.filter(r => parseDT(r.end) < today).reverse();
    return `${upcoming.length ? `<div class="stagger">${upcoming.map(runCard).join('')}</div>`
        : `<div class="empty"><div class="ic">${ICON.trips(28)}</div><b>No upcoming tours</b><span>Add shows first — a tour starts when you fly out from your home airport and ends when you land back there.</span><button class="btn secondary" style="margin-top:14px;max-width:240px" onclick="go('calendar')">${ICON.calendar(18)} Go to Calendar</button></div>`}
    ${past.length ? `<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px;color:var(--text-2)">Past</div></div>
      <div class="card flush">${past.slice(0, 12).map(runRow).join('')}</div></div>` : ''}`;
}
function toggleLegDone(runKey, showId) {
    const sh = sel.event(showId);
    if (!sh)
        return;
    sh.setDone = !sh.setDone;
    haptic();
    persist('shows', showId);
    if (!patchCheckRowsById(showId, sh.setDone) && !patchCheckRowsById('set_' + showId, sh.setDone))
        softRender();
    toast(sh.setDone ? 'Leg complete ✓' : 'Leg reopened', sh.setDone ? 'check' : 'arrowUp');
}
/* ============================================================
   TRIP — create / edit
   ============================================================ */
function sheetTrip(tid) {
    const t = tid ? sel.trip(tid) : null;
    const swatches = Object.entries(CATS).map(([k, v]) => `<div class="sw" style="background:${v}" data-cat="${k}" onclick="pickCat(this)"></div>`).join('');
    openSheetReact(tid ? 'Edit trip' : 'New trip', 'trip.edit', { tid, trip: t });
    setTimeout(() => { const cat = t ? t.color : 'pink'; const el = document.querySelector(`#tr-cat .sw[data-cat="${cat}"]`); if (el)
        el.classList.add('on'); }, 40);
}
function saveTrip(tid) {
    const name = val('tr-name');
    if (!name) {
        toast('Name your trip', 'x');
        return;
    }
    const data = { name, startDate: rawVal('tr-start'), endDate: rawVal('tr-end'), color: getCat('tr-cat') };
    withButton($('#tr-save'), () => {
        if (tid) {
            Object.assign(sel.trip(tid), data);
        }
        else {
            tid = uid('trip');
            store.trips.push(Object.assign({ id: tid, archived: false,
                packing: store.settings.packingTemplate.map(x => ({ id: uid('pk'), label: x, done: false })),
                checklist: store.settings.packingTemplate.map(x => ({ id: uid('ck'), label: x, done: false })),
                timeline: [], emergency: [], attachments: [] }, data));
        }
        persist('tours', tid);
        if (typeof pushTourNow === 'function')
            pushTourNow(tid);
        closeSheet();
        renderView();
    }, tid ? 'Trip updated' : 'Trip created');
}
/* ============================================================
   Trip Mode  (runs — no named trips)
   ============================================================ */
function startTripFromShow(showId) { store.activeShowId = showId; persist('user_preferences'); overlay = null; navStack = []; store.tab = 'trips'; if (typeof saveNavState === 'function')
    saveNavState(); render({ resetScroll: true }); toast('Trip Mode on', 'play'); }
function endTripMode() { confirmSheet('End Trip Mode?', 'This turns off the live tour view. Nothing is deleted.', 'End Trip Mode', () => { store.activeShowId = null; persist('user_preferences'); overlay = null; store.tab = 'trips'; if (typeof saveNavState === 'function')
    saveNavState(); render({ resetScroll: true }); toast('Trip Mode off', 'flag'); }); }
function tourShowLabel(s) {
    return cleanVenue(s.venue) || s.city || 'Show';
}
/* Trip Mode contacts — grouped for the sheet (show/venue, drivers, hotel). */
function tourContactsGrouped(run) {
    const showVenue = [];
    const drivers = [];
    const hotel = [];
    (run && run.shows || []).forEach(s => {
        const show = tourShowLabel(s);
        const p = s.promoter;
        if (p && (p.name || p.phone || p.whatsapp)) {
            showVenue.push({
                category: 'show',
                show,
                label: 'Artist liaison',
                sub: show,
                name: p.name || 'Liaison',
                phone: p.phone || '',
                whatsapp: p.whatsapp || p.phone || ''
            });
        }
        (s.contacts || []).forEach(c => {
            const role = String(c.role || '').toLowerCase();
            if (role === 'driver')
                return;
            if (!c.name && !c.phone && !c.whatsapp)
                return;
            showVenue.push({
                category: 'show',
                show,
                label: (typeof showContactRoleLabel === 'function' ? showContactRoleLabel(c.role) : c.role) || 'Contact',
                sub: show,
                name: c.name || 'Contact',
                phone: c.phone || '',
                whatsapp: c.whatsapp || c.phone || ''
            });
        });
        const h = s.hotel;
        if (h && (h.name || h.phone || h.whatsapp)) {
            const bits = [];
            if (h.checkin && typeof fmtDate === 'function')
                bits.push(fmtDate(h.checkin));
            if (s.city)
                bits.push(s.city);
            hotel.push({
                category: 'hotel',
                show,
                label: h.name || 'Accommodation',
                sub: bits.join(' · ') || show,
                name: 'Reception',
                phone: h.phone || '',
                whatsapp: h.whatsapp || h.phone || ''
            });
        }
        if (typeof orderedDrivers === 'function') {
            orderedDrivers(s).forEach(({ d }) => {
                ensureDriverLocations(d);
                if (d.noGround && !d.name && !d.phone && !d.whatsapp)
                    return;
                if (!d.name && !d.phone && !d.whatsapp)
                    return;
                const bits = [];
                const jl = typeof driverJourneyLabel === 'function' ? driverJourneyLabel(d) : (d.journey || '');
                if (jl)
                    bits.push(jl);
                if (d.time)
                    bits.push(d.time);
                else if (d.start)
                    bits.push(d.start);
                drivers.push({
                    category: 'driver',
                    show,
                    sortMs: typeof journeyWhenMs === 'function' ? journeyWhenMs(d, s.date) : Number.POSITIVE_INFINITY,
                    name: d.name || 'Driver',
                    phone: d.phone || '',
                    whatsapp: d.whatsapp || d.phone || '',
                    journeySub: bits.join(' · ') || show,
                    label: '',
                    sub: ''
                });
            });
        }
    });
    drivers.sort((a, b) => {
        const da = Number.isFinite(a.sortMs) ? a.sortMs : Number.POSITIVE_INFINITY;
        const db = Number.isFinite(b.sortMs) ? b.sortMs : Number.POSITIVE_INFINITY;
        if (da !== db)
            return da - db;
        return String(a.show).localeCompare(String(b.show));
    });
    drivers.forEach((row, i) => {
        row.label = `Driver ${i + 1} | ${row.name}`;
        row.sub = row.journeySub;
    });
    return { show: showVenue, drivers, hotel };
}
/* Flat list for counts and legacy callers. */
function tourContacts(run) {
    const g = tourContactsGrouped(run);
    return [...g.show, ...g.drivers, ...g.hotel];
}
function openTourContacts(runKey) {
    const run = runOf(runKey);
    if (!run)
        return;
    const grouped = tourContactsGrouped(run);
    const callable = tourContacts(run).filter(c => c.phone || c.whatsapp);
    if (!callable.length) {
        toast('No contacts with a phone number on this tour yet', 'x');
        return;
    }
    openSheetReact('Key contacts', 'trip.contacts', { runKey, grouped });
}
function tourContactsCompactHtml(run) {
    const list = tourContacts(run).filter(c => c.phone || c.whatsapp);
    if (!list.length)
        return '';
    const preview = list.slice(0, 2);
    const rows = preview.map((c, i) => `<div class="tour-contacts-mini-row">
      <span class="tour-contacts-mini-name">${esc(c.name || c.label)}</span>
      ${c.phone ? `<button type="button" class="tour-contacts-mini-act" title="Call" onclick="callNumber('${jsAttr(c.phone)}')">${ICON.phone(14)}</button>` : ''}
    </div>`).join('');
    return `<div class="section tour-contacts-section"><div class="card tour-contacts-compact">
    <button type="button" class="tour-contacts-compact-head" onclick="openTourContacts('${run.key}')">
      ${ICON.users(16)} <span class="tour-contacts-compact-title">Key contacts</span>
      <span class="tour-contacts-compact-count">${list.length}</span>
      ${ICON.chevR(14)}
    </button>
    ${rows}
  </div></div>`;
}
function completeRunStep(runKey, stepId) {
    let done = null;
    if (stepId.startsWith('set_')) {
        const sh = sel.event(stepId.slice(4));
        if (sh) {
            sh.setDone = !sh.setDone;
            done = !!sh.setDone;
        }
    }
    else if (stepId.startsWith('shhotel_')) {
        const sh = sel.event(stepId.slice(8));
        if (sh && sh.hotel) {
            sh.hotel.done = !sh.hotel.done;
            done = !!sh.hotel.done;
        }
    }
    else if (stepId.startsWith('shflt_')) {
        const id = stepId.slice(6);
        store.events.forEach(e => (e.flights || []).forEach(f => { if (f.id === id) {
            f.done = !f.done;
            done = !!f.done;
        } }));
    }
    else if (stepId.startsWith('shdrv_')) {
        const id = stepId.slice(6);
        store.events.forEach(e => (e.drivers || []).forEach(d => { if (d.id === id) {
            d.done = !d.done;
            done = !!d.done;
        } }));
    }
    else {
        const it = store.events.find(x => x.id === stepId);
        if (it) {
            it.done = !it.done;
            done = !!it.done;
            if (it.done)
                toast('Done ✓', 'check');
        }
    }
    haptic();
    persist('user_preferences');
    if (done == null || !patchCheckRowsById(stepId, done))
        softRender();
    if (typeof scrollUpNextCarousel === 'function')
        requestAnimationFrame(scrollUpNextCarousel);
}
function togglePack(id) {
    const p = store.packing.find(x => x.id === id);
    if (!p)
        return;
    p.done = !p.done;
    haptic();
    persist('user_preferences');
    if (!patchCheckRowsById(id, p.done))
        softRender();
    else {
        const pk = store.packing || [];
        const label = pk.filter(i => i.done).length + '/' + pk.length + ' packed';
        ['tm-pack', 'trip-pack'].forEach(fid => {
            const span = document.querySelector('#fold-' + fid + ' .ft span');
            if (span)
                span.textContent = label;
        });
    }
}
function delPack(id) {
    store.packing = store.packing.filter(x => x.id !== id);
    persist('user_preferences');
    removeCheckRowsById(id);
}
function addPackPrompt() {
    promptSheet('Packing item', 'e.g. Rain jacket', function (v) {
        store.packing.push({ id: uid('pk'), label: v, done: false });
        persist('user_preferences');
        softRender();
        toast('Added', 'check');
    });
}
