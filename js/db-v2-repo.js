/* Targeted V2 table access — load org slice, upsert/delete by primary key. */

function v2RepoThrow(error, label){
  if(!error) return;
  const msg = error.message || error.error_description || JSON.stringify(error);
  const e = new Error((label || 'v2 repo') + ': ' + msg);
  e.cause = error;
  throw e;
}

async function v2RepoFetchOrg(sb, orgId){
  const q = (table, opts) => {
    let chain = sb.from(table).select('*').eq('organisation_id', orgId);
    if(opts?.isNull) chain = chain.is(opts.isNull, null);
    if(opts?.order) chain = chain.order(opts.order);
    return chain;
  };

  const [
    { data: organisation_settings, error: e0 },
    { data: organisation_billing_profiles, error: e1 },
    { data: organisation_exchange_rates, error: e2 },
    { data: user_preferences, error: e3 },
    { data: artists, error: e4 },
    { data: tours, error: e5 },
    { data: venues, error: e6 },
    { data: shows, error: e7 },
    { data: show_advances, error: e8 },
    { data: show_financials, error: e9 },
    { data: show_expenses, error: e10 },
    { data: journeys, error: e11 },
    { data: hotels, error: e12 },
    { data: hotel_bookings, error: e13 },
    { data: hotel_booking_shows, error: e14 },
    { data: schedule_items, error: e15 },
    { data: checklist_items, error: e16 },
    { data: contacts, error: e17 },
    { data: show_contacts, error: e18 },
    { data: tour_contacts, error: e19 },
    { data: journey_contacts, error: e20 },
    { data: files, error: e21 },
    { data: show_files, error: e22 },
    { data: travel_tickets, error: e23 },
    { data: invoices, error: e24 },
    { data: invoice_line_items, error: e25 },
    { data: packing_lists, error: e26 },
    { data: packing_list_items, error: e27 },
    { data: itinerary_submissions, error: e28 },
    { data: itinerary_submission_files, error: e29 },
    { data: ideas, error: e30 },
    { data: notes, error: e31 }
  ] = await Promise.all([
    q('organisation_settings').maybeSingle(),
    q('organisation_billing_profiles').maybeSingle(),
    q('organisation_exchange_rates'),
    sb.from('user_preferences').select('*').eq('organisation_id', orgId).maybeSingle(),
    q('artists'),
    q('tours', { order: 'start_date' }),
    q('venues'),
    q('shows', { order: 'show_date' }),
    q('show_advances'),
    q('show_financials'),
    q('show_expenses', { order: 'sort_order' }),
    q('journeys', { order: 'sort_order' }),
    q('hotels'),
    q('hotel_bookings'),
    q('hotel_booking_shows'),
    q('schedule_items', { order: 'sort_order' }),
    q('checklist_items', { order: 'sort_order' }),
    q('contacts'),
    q('show_contacts', { order: 'sort_order' }),
    q('tour_contacts', { order: 'sort_order' }),
    q('journey_contacts', { order: 'sort_order' }),
    q('files'),
    q('show_files', { order: 'sort_order' }),
    q('travel_tickets', { order: 'sort_order' }),
    q('invoices'),
    q('invoice_line_items', { order: 'sort_order' }),
    sb.from('packing_lists').select('*').eq('organisation_id', orgId).eq('is_organisation_template', true),
    q('packing_list_items', { order: 'sort_order' }),
    q('itinerary_submissions', { order: 'created_at' }),
    q('itinerary_submission_files'),
    q('ideas', { order: 'sort_order' }),
    q('notes', { order: 'sort_order' })
  ]);

  const errs = [e0,e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e18,e19,e20,e21,e22,e23,e24,e25,e26,e27,e28,e29,e30,e31];
  const first = errs.find(Boolean);
  if(first) v2RepoThrow(first, 'v2RepoFetchOrg');

  return {
    organisation_settings: organisation_settings || null,
    organisation_billing_profiles: organisation_billing_profiles || null,
    organisation_exchange_rates: organisation_exchange_rates || [],
    user_preferences: user_preferences || null,
    artists: artists || [],
    tours: tours || [],
    venues: venues || [],
    shows: shows || [],
    show_advances: show_advances || [],
    show_financials: show_financials || [],
    show_expenses: show_expenses || [],
    journeys: journeys || [],
    hotels: hotels || [],
    hotel_bookings: hotel_bookings || [],
    hotel_booking_shows: hotel_booking_shows || [],
    schedule_items: schedule_items || [],
    checklist_items: checklist_items || [],
    contacts: contacts || [],
    show_contacts: show_contacts || [],
    tour_contacts: tour_contacts || [],
    journey_contacts: journey_contacts || [],
    files: files || [],
    show_files: show_files || [],
    travel_tickets: travel_tickets || [],
    invoices: invoices || [],
    invoice_line_items: invoice_line_items || [],
    packing_lists: packing_lists || [],
    packing_list_items: packing_list_items || [],
    itinerary_submissions: itinerary_submissions || [],
    itinerary_submission_files: itinerary_submission_files || [],
    ideas: ideas || [],
    notes: notes || []
  };
}

async function v2RepoUpsert(sb, table, rowOrRows, onConflict){
  const rows = (Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]).filter(Boolean);
  if(!rows.length) return [];
  const conflict = onConflict || 'id';
  const { data, error } = await sb.from(table).upsert(rows, { onConflict: conflict }).select('*');
  v2RepoThrow(error, table + ' upsert');
  return data || [];
}

async function v2RepoUpsertOne(sb, table, row, onConflict){
  const rows = await v2RepoUpsert(sb, table, row, onConflict);
  return rows[0] || null;
}

async function v2RepoDelete(sb, table, id){
  if(!id) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  v2RepoThrow(error, table + ' delete');
}

async function v2RepoDeleteWhere(sb, table, filters){
  let q = sb.from(table).delete();
  Object.keys(filters || {}).forEach(k => { q = q.eq(k, filters[k]); });
  const { error } = await q;
  v2RepoThrow(error, table + ' deleteWhere');
}

/* Patch a row into the in-memory v2 collection by id. */
function v2RepoPatchLocal(table, row){
  if(!store || !store.v2 || !row || !row.id) return;
  const list = store.v2[table];
  if(!Array.isArray(list)){
    store.v2[table] = row;
    return;
  }
  const i = list.findIndex(r => r.id === row.id);
  if(i >= 0) list[i] = Object.assign({}, list[i], row);
  else list.push(row);
}

function v2RepoRemoveLocal(table, id){
  if(!store || !store.v2 || !id) return;
  const list = store.v2[table];
  if(!Array.isArray(list)) return;
  store.v2[table] = list.filter(r => r.id !== id);
}
