/* Global search — frontend-only, structured records with relevance ranking.
   Modular API: globalSearch(q, opts) → ranked hits; backend can mirror later. */
var SEARCH_DEBOUNCE_MS = 150;
var SEARCH_FILTER_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'show', label: 'Shows' },
    { id: 'tour', label: 'Tours' },
    { id: 'flight', label: 'Flights' },
    { id: 'venue', label: 'Venues' },
    { id: 'hotel', label: 'Hotels' },
    { id: 'ground', label: 'Transport' },
    { id: 'contact', label: 'Contacts' }
];
function normalizeSearchQuery(q) {
    return String(q || '').trim().toLowerCase();
}
function searchTokens(q) {
    const s = normalizeSearchQuery(q);
    if (s.length < 2)
        return [];
    return s.split(/\s+/).filter(t => t.length >= 2);
}
function fieldsMatch(tokens, fields) {
    if (!tokens.length)
        return false;
    const blob = fields
        .map(f => String(f == null ? '' : f))
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    if (!blob)
        return false;
    return tokens.every(t => blob.includes(t));
}
function relevanceScore(query, tokens, primary, secondary) {
    const q = normalizeSearchQuery(query);
    if (!q)
        return 0;
    let best = 0;
    const consider = (text, tiers) => {
        const t = String(text || '').trim().toLowerCase();
        if (!t)
            return;
        if (t === q)
            best = Math.max(best, tiers[0]);
        else if (q.length >= 2 && t.startsWith(q))
            best = Math.max(best, tiers[1]);
        else if (q.length >= 2 && t.includes(q))
            best = Math.max(best, tiers[2]);
        else if (tokens.length && tokens.every(tok => t.includes(tok)))
            best = Math.max(best, tiers[3]);
    };
    const primaryTiers = [1000, 850, 650, 450];
    const secondaryTiers = [0, 0, 380, 280];
    consider(primary, primaryTiers);
    (secondary || []).forEach(s => consider(s, secondaryTiers));
    return best;
}
function isUpcomingShowDate(dateStr) {
    if (!dateStr || typeof parseDT !== 'function')
        return false;
    const d = parseDT(dateStr);
    if (!d)
        return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
}
function searchTypeLabel(type) {
    const labels = {
        show: 'Show',
        tour: 'Tour',
        flight: 'Flight',
        venue: 'Venue',
        hotel: 'Hotel',
        stay: 'Hotel',
        ground: 'Transport',
        contact: 'Contact',
        invoice: 'Invoice'
    };
    return labels[type] || 'Record';
}
function searchTypeIcon(type) {
    const icons = {
        show: 'music',
        tour: 'trips',
        flight: 'planeTop',
        venue: 'map',
        hotel: 'bed',
        stay: 'bed',
        ground: 'car',
        contact: 'users',
        invoice: 'receipt'
    };
    return icons[type] || 'clip';
}
function searchOpenResult(hit) {
    if (!hit || !hit.type)
        return;
    if (hit.type === 'tour')
        return openView('trip', hit.id);
    if (hit.type === 'contact')
        return openView('contacts');
    if (hit.type === 'invoice')
        return openView('invoice', hit.id);
    const sid = hit.showId || hit.id;
    if (sid)
        return openView('event', sid);
}
function pushRanked(list, seen, row) {
    if (!row || row.score <= 0)
        return;
    const key = row.recordKey;
    if (!key || seen.has(key))
        return;
    seen.add(key);
    list.push(row);
}
function globalSearch(q, opts) {
    const query = normalizeSearchQuery(q);
    const tokens = searchTokens(q);
    if (!tokens.length)
        return { query, results: [] };
    const category = (opts && opts.category) || 'all';
    const fmt = typeof fmtDate === 'function' ? fmtDate : d => d || '';
    const events = typeof sel !== 'undefined' && sel.events ? sel.events() : [];
    const runsList = typeof runs === 'function' ? runs() : [];
    const results = [];
    const seen = new Set();
    events.forEach(e => {
        const title = typeof showTitle === 'function' ? showTitle(e) : (e.eventName || e.venue || 'Show');
        const venue = typeof cleanVenue === 'function' ? cleanVenue(e.venue) : String(e.venue || '').trim();
        const ctx = [e.city, e.country, fmt(e.date), typeof relDay === 'function' ? relDay(e.date) : ''].filter(Boolean).join(' · ');
        const upcoming = isUpcomingShowDate(e.date) ? 40 : 0;
        const showScore = relevanceScore(q, tokens, title, [
            e.eventName, e.city, e.country, e.promoter && e.promoter.name, e.date, fmt(e.date)
        ]);
        const venueScore = venue
            ? relevanceScore(q, tokens, venue, [e.city, e.country])
            : 0;
        if (showScore > 0 && showScore >= venueScore) {
            pushRanked(results, seen, {
                type: 'show',
                recordKey: 'show:' + e.id,
                id: e.id,
                showId: e.id,
                title,
                subtitle: ctx,
                score: showScore + upcoming,
                upcoming: isUpcomingShowDate(e.date),
                color: e.color
            });
        }
        else if (venueScore > 0) {
            pushRanked(results, seen, {
                type: 'venue',
                recordKey: 'venue:' + e.id,
                id: e.id,
                showId: e.id,
                title: venue,
                subtitle: ctx,
                score: venueScore + upcoming,
                upcoming: isUpcomingShowDate(e.date),
                color: e.color
            });
        }
        const h = e.hotel;
        if (h) {
            const hScore = relevanceScore(q, tokens, h.name, [h.addr, h.bookingRef, h.confirmation, e.city]);
            if (hScore > 0) {
                pushRanked(results, seen, {
                    type: 'hotel',
                    recordKey: 'hotel:' + e.id,
                    id: e.id,
                    showId: e.id,
                    title: h.name || 'Hotel',
                    subtitle: [searchTypeLabel('hotel'), e.city, h.bookingRef].filter(Boolean).join(' · '),
                    score: hScore + upcoming,
                    upcoming: isUpcomingShowDate(e.date),
                    color: e.color
                });
            }
        }
        (e.flights || []).forEach(f => {
            if (typeof flightHasDetails === 'function' && !flightHasDetails(f))
                return;
            const codes = typeof flightEndpointCodes === 'function' ? flightEndpointCodes(f) : { from: f.from, to: f.to };
            const code = String(f.code || f.flightNo || '').trim();
            const route = [codes.from || f.from || '?', codes.to || f.to || '?'].join(' → ');
            const primary = code || route;
            const fScore = relevanceScore(q, tokens, primary, [
                codes.from, codes.to, f.from, f.to, f.fromName, f.toName, f.bookingRef
            ]);
            if (fScore <= 0)
                return;
            const fid = f.id || (e.id + ':' + route);
            pushRanked(results, seen, {
                type: 'flight',
                recordKey: 'flight:' + fid,
                id: fid,
                flightId: f.id,
                showId: e.id,
                title: code ? (code + ' · ' + route) : route,
                subtitle: [searchTypeLabel('flight'), title, ctx].filter(Boolean).join(' · '),
                score: fScore + upcoming,
                upcoming: isUpcomingShowDate(e.date),
                color: e.color
            });
        });
    });
    runsList.forEach(r => {
        const dest = typeof runDestinationsSummary === 'function' ? runDestinationsSummary(r) : (r.title || 'Tour');
        const dates = typeof runDateLabel === 'function' ? runDateLabel(r) : '';
        const tScore = relevanceScore(q, tokens, dest, [dates, r.start, r.end].concat(r.cities || []));
        if (tScore <= 0)
            return;
        const upcoming = isUpcomingShowDate(r.end || r.start) ? 40 : 0;
        pushRanked(results, seen, {
            type: 'tour',
            recordKey: 'tour:' + r.key,
            id: r.key,
            title: dest,
            subtitle: [searchTypeLabel('tour'), dates].filter(Boolean).join(' · '),
            score: tScore + upcoming,
            upcoming: isUpcomingShowDate(r.end || r.start),
            color: r.color
        });
    });
    (store.events || []).forEach(e => {
        if (!e || e.kind !== 'travel' || (e.icon || 'plane') !== 'plane')
            return;
        if (e.showId && seen.has('flight:' + e.id))
            return;
        const codes = typeof travelFlightCodes === 'function' ? travelFlightCodes(e) : {};
        const code = String(e.flightNo || e.code || '').trim();
        const route = [codes.from || e.from || '?', codes.to || e.to || '?'].join(' → ');
        const fScore = relevanceScore(q, tokens, code || route, [
            codes.from, codes.to, e.from, e.to, e.fromName, e.toName, e.bookingRef
        ]);
        if (fScore <= 0)
            return;
        const sh = e.showId && sel.event ? sel.event(e.showId) : null;
        pushRanked(results, seen, {
            type: 'flight',
            recordKey: 'flight:' + e.id,
            id: e.id,
            showId: e.showId || null,
            title: code ? (code + ' · ' + route) : route,
            subtitle: [searchTypeLabel('flight'), sh ? showTitle(sh) : fmt(e.date)].filter(Boolean).join(' · '),
            score: fScore,
            upcoming: sh ? isUpcomingShowDate(sh.date) : false,
            color: sh && sh.color
        });
    });
    (store.events || []).forEach(e => {
        if (!e || !e.showId)
            return;
        const sh = sel.event ? sel.event(e.showId) : null;
        const upcoming = sh && isUpcomingShowDate(sh.date) ? 40 : 0;
        if (e.kind === 'stay') {
            const title = e.title || e.place || 'Accommodation';
            const sScore = relevanceScore(q, tokens, title, [e.place, e.addr, e.bookingRef]);
            if (sScore <= 0)
                return;
            pushRanked(results, seen, {
                type: 'stay',
                recordKey: 'stay:' + e.id,
                id: e.id,
                showId: e.showId,
                title,
                subtitle: [searchTypeLabel('stay'), e.bookingRef, sh && sh.city].filter(Boolean).join(' · '),
                score: sScore + upcoming,
                upcoming: !!(sh && isUpcomingShowDate(sh.date)),
                color: sh && sh.color
            });
            return;
        }
        if (e.kind === 'travel' && (e.icon || 'plane') !== 'plane') {
            const title = e.title || [e.from, e.to].filter(Boolean).join(' → ') || 'Travel';
            const gScore = relevanceScore(q, tokens, title, [
                e.from, e.to, e.fromName, e.toName, e.operator, e.bookingRef
            ]);
            if (gScore <= 0)
                return;
            pushRanked(results, seen, {
                type: 'ground',
                recordKey: 'ground:' + e.id,
                id: e.id,
                showId: e.showId,
                title,
                subtitle: [searchTypeLabel('ground'), e.bookingRef || e.operator, sh && sh.city].filter(Boolean).join(' · '),
                score: gScore + upcoming,
                upcoming: !!(sh && isUpcomingShowDate(sh.date)),
                color: sh && sh.color
            });
        }
    });
    (store.contacts || []).forEach(c => {
        const name = c.name || c.display_name || '';
        const cScore = relevanceScore(q, tokens, name, [c.role, c.company, c.phone, c.phone_number, c.email]);
        if (cScore <= 0)
            return;
        pushRanked(results, seen, {
            type: 'contact',
            recordKey: 'contact:' + c.id,
            id: c.id,
            contactId: c.id,
            title: name || 'Contact',
            subtitle: [searchTypeLabel('contact'), c.role, c.company].filter(Boolean).join(' · '),
            score: cScore,
            upcoming: false
        });
    });
    (store.invoices || []).forEach(inv => {
        const iScore = relevanceScore(q, tokens, inv.number, [inv.client]);
        if (iScore <= 0)
            return;
        pushRanked(results, seen, {
            type: 'invoice',
            recordKey: 'invoice:' + inv.id,
            id: inv.id,
            invoiceId: inv.id,
            title: inv.number || 'Invoice',
            subtitle: [searchTypeLabel('invoice'), inv.client].filter(Boolean).join(' · '),
            score: iScore,
            upcoming: false
        });
    });
    results.sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        if (b.upcoming !== a.upcoming)
            return (b.upcoming ? 1 : 0) - (a.upcoming ? 1 : 0);
        return String(a.title || '').localeCompare(String(b.title || ''));
    });
    const filtered = category === 'all'
        ? results
        : results.filter(r => {
            if (category === 'hotel')
                return r.type === 'hotel' || r.type === 'stay';
            if (category === 'ground')
                return r.type === 'ground';
            return r.type === category;
        });
    return { query, results: filtered, total: filtered.length };
}
/* Legacy grouped buckets (HTML fallbacks) */
function globalSearchResults(q) {
    const { results } = globalSearch(q, { category: 'all' });
    if (!results.length)
        return null;
    const out = { shows: [], tours: [], flights: [], venues: [], bookings: [] };
    results.forEach(r => {
        const ev = r.showId && sel.event ? sel.event(r.showId) : null;
        if (r.type === 'show' && ev)
            out.shows.push(ev);
        else if (r.type === 'venue' && ev)
            out.venues.push(ev);
        else if (r.type === 'tour') {
            const run = (typeof runs === 'function' ? runs() : []).find(x => x.key === r.id);
            if (run)
                out.tours.push(run);
        }
        else if (r.type === 'flight') {
            out.flights.push({
                showId: r.showId,
                flightId: r.flightId,
                route: r.title,
                code: '',
                show: ev
            });
        }
        else if (r.type === 'hotel' || r.type === 'stay' || r.type === 'ground' || r.type === 'contact' || r.type === 'invoice') {
            out.bookings.push({
                kind: r.type === 'stay' ? 'stay' : r.type,
                id: r.id,
                showId: r.showId,
                contactId: r.contactId,
                invoiceId: r.invoiceId,
                title: r.title,
                sub: r.subtitle
            });
        }
    });
    return out;
}
function globalSearchTotal(res) {
    if (Array.isArray(res && res.results))
        return res.results.length;
    if (!res)
        return 0;
    return (res.shows || []).length + (res.tours || []).length + (res.flights || []).length
        + (res.venues || []).length + (res.bookings || []).length;
}
function searchResultRow(hit) {
    if (!hit)
        return '';
    const typeLabel = searchTypeLabel(hit.type);
    const iconName = searchTypeIcon(hit.type);
    const icFn = ICON && ICON[iconName];
    const ic = icFn ? icFn(17) : '';
    const col = hit.color && typeof CATS !== 'undefined' ? (CATS[hit.color] || CATS.purple) : null;
    const icStyle = col
        ? `background:${col}22;color:${col}`
        : 'background:var(--card-2);color:var(--text)';
    const rawKey = hit.recordKey || hit.id || '';
    const attrKey = typeof jsAttr === 'function' ? jsAttr(rawKey) : esc(rawKey);
    return `<div class="row search-hit-row" data-search-key="${esc(rawKey)}" onclick="searchOpenResult(searchHitByKey('${attrKey}'))">`
        + `<div class="ic" style="${icStyle}">${ic}</div>`
        + `<div class="body"><b>${esc(hit.title)}</b><span><span class="tag" style="margin-right:6px;font-size:10px;padding:2px 7px">${esc(typeLabel)}</span>${esc(hit.subtitle || '')}</span></div>`
        + `<div class="trail">${ICON.chevR(15)}</div></div>`;
}
var __searchHitIndex = {};
function globalSearchWithIndex(q, opts) {
    const pack = globalSearch(q, opts);
    __searchHitIndex = {};
    (pack.results || []).forEach(h => {
        if (h.recordKey)
            __searchHitIndex[h.recordKey] = h;
    });
    return pack;
}
function searchHitByKey(key) {
    return __searchHitIndex[key] || null;
}
function searchFlightRow(hit) { return searchResultRow(hit); }
function searchVenueRow(e) {
    const hit = {
        type: 'venue',
        recordKey: 'venue:' + e.id,
        id: e.id,
        showId: e.id,
        title: typeof cleanVenue === 'function' ? cleanVenue(e.venue) : e.venue,
        subtitle: [e.city, typeof relDay === 'function' ? relDay(e.date) : e.date].filter(Boolean).join(' · '),
        color: e.color
    };
    return searchResultRow(hit);
}
function searchBookingRow(row) {
    const hit = {
        type: row.kind || 'hotel',
        recordKey: (row.kind || 'hotel') + ':' + (row.id || row.showId),
        id: row.id,
        showId: row.showId,
        contactId: row.contactId,
        invoiceId: row.invoiceId,
        title: row.title,
        subtitle: row.sub
    };
    return searchResultRow(hit);
}
function filterShowsList(list, q) {
    const tokens = searchTokens(q);
    if (!tokens.length)
        return list || [];
    const fmt = typeof fmtDate === 'function' ? fmtDate : d => d || '';
    return (list || []).filter(e => fieldsMatch(tokens, [
        e.eventName, e.venue, e.city, e.country, e.date, fmt(e.date)
    ]));
}
