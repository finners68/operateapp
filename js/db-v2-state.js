/* V2-native in-memory state. View projections (events/trips/…) are composed
   for existing screens; entity collections under store.v2 are source of truth. */

const DB_KEY = 'operate.v2.state';
const DB_KEY_LEGACY = 'artisthq.v2';
const DB_BACKUP_KEY = DB_KEY + '.backup';

function newUuid(){
  if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function emptyV2Collections(){
  return {
    organisation_settings: null,
    organisation_billing_profiles: null,
    organisation_exchange_rates: [],
    user_preferences: null,
    artists: [],
    tours: [],
    venues: [],
    shows: [],
    show_advances: [],
    show_financials: [],
    show_expenses: [],
    journeys: [],
    hotels: [],
    hotel_bookings: [],
    hotel_booking_shows: [],
    schedule_items: [],
    checklist_items: [],
    contacts: [],
    show_contacts: [],
    tour_contacts: [],
    journey_contacts: [],
    files: [],
    show_files: [],
    travel_tickets: [],
    invoices: [],
    invoice_line_items: [],
    packing_lists: [],
    packing_list_items: [],
    itinerary_submissions: [],
    itinerary_submission_files: [],
    ideas: [],
    notes: []
  };
}

function emptyOperateState(){
  return {
    _seq: 1,
    organisationId: null,
    activeTripId: null,
    activeShowId: null,
    tab: 'home',
    v2: emptyV2Collections(),
    _dirty: Object.create(null), // table -> Set of ids (or '*' for full table)
    settings: {
      artistName: 'You',
      packingTemplate: ['Passport', 'USBs', 'Headphones', 'Power Bank', 'Chargers', 'Camera', 'SD Cards', 'Laptop', 'IEMs'],
      baseCurrency: 'EUR',
      fx: { GBP: 1, EUR: 0.85, USD: 0.79, CHF: 0.88, AUD: 0.52, CAD: 0.58, AED: 0.215, SGD: 0.59, SEK: 0.075, NOK: 0.075, DKK: 0.114, PLN: 0.20, CZK: 0.034, ZAR: 0.043 },
      billing: { name: '', address: '', taxId: '', iban: '', email: '' },
      invoicePrefix: 'AHQ', invoiceSeq: 1, invoiceTerms: 14,
      accountType: 'dj', homeAirport: 'AMS',
      security: { enabled: false, pin: '', scope: 'finance', biometric: false }
    },
    artists: [{ id: newUuid(), name: 'You', default: true }],
    events: [],
    trips: [],
    ideas: [],
    notes: [],
    drivers: [],
    hotels: [],
    contacts: [],
    invoices: [],
    itineraries: [],
    packing: [],
    reminders: [],
    _known: []
  };
}

function clearLegacyLocalStore(){
  try{ localStorage.removeItem(DB_KEY_LEGACY); }catch(e){}
  try{ localStorage.removeItem(DB_KEY_LEGACY + '.prelogistics'); }catch(e){}
}

function markDirty(table, id){
  if(!store) return;
  if(!store._dirty) store._dirty = Object.create(null);
  if(id == null || id === '*'){
    store._dirty[table] = '*';
    return;
  }
  if(store._dirty[table] === '*') return;
  if(!(store._dirty[table] instanceof Set)) store._dirty[table] = new Set();
  store._dirty[table].add(id);
}

function markDirtyAll(){
  if(!store) return;
  store._dirty = { '*': '*' };
}

function clearDirty(){
  if(store) store._dirty = Object.create(null);
}

function isDirty(table, id){
  if(!store || !store._dirty) return false;
  if(store._dirty['*'] === '*') return true;
  const d = store._dirty[table];
  if(d === '*') return true;
  if(d instanceof Set) return d.has(id);
  return false;
}

function isFullDirty(dirty){
  return !!(dirty && dirty['*'] === '*');
}

function isEmptyDirty(dirty){
  if(!dirty) return true;
  if(dirty['*'] === '*') return false;
  return !Object.keys(dirty).some(k => {
    const d = dirty[k];
    return d === '*' || (d instanceof Set && d.size > 0);
  });
}

function isTableDirty(dirty, table){
  if(!dirty) return false;
  if(dirty['*'] === '*') return true;
  const d = dirty[table];
  if(d === '*') return true;
  return d instanceof Set && d.size > 0;
}

/* null => whole table; Set => only those ids. */
function dirtyIds(dirty, table){
  if(!dirty) return new Set();
  if(dirty['*'] === '*') return null;
  const d = dirty[table];
  if(d === '*') return null;
  if(d instanceof Set) return d;
  return new Set();
}

function cloneDirty(dirty){
  const out = Object.create(null);
  if(!dirty) return out;
  Object.keys(dirty).forEach(k => {
    const d = dirty[k];
    if(d === '*') out[k] = '*';
    else if(d instanceof Set) out[k] = new Set(d);
  });
  return out;
}

/* Remove snapshot entries from live dirty; keep newer ids marked after snapshot. */
function subtractDirty(live, snapshot){
  if(!live || !snapshot) return;
  if(snapshot['*'] === '*'){
    if(live['*'] === '*') delete live['*'];
    return;
  }
  Object.keys(snapshot).forEach(table => {
    const snap = snapshot[table];
    const cur = live[table];
    if(cur == null) return;
    if(snap === '*'){
      delete live[table];
      return;
    }
    if(!(snap instanceof Set)) return;
    if(cur === '*') return; /* live was widened to full table — keep it */
    if(!(cur instanceof Set)) return;
    snap.forEach(id => cur.delete(id));
    if(!cur.size) delete live[table];
  });
}

function filterByDirtyIds(rows, dirty, table, idKey){
  const key = idKey || 'id';
  const ids = dirtyIds(dirty, table);
  if(ids == null) return rows || [];
  return (rows || []).filter(r => r && ids.has(r[key]));
}

/* JSON cannot store Set — persist dirty ids as arrays and revive on read. */
function serializeDirty(dirty){
  const out = Object.create(null);
  if(!dirty) return out;
  Object.keys(dirty).forEach(k => {
    const d = dirty[k];
    if(d === '*') out[k] = '*';
    else if(d instanceof Set) out[k] = Array.from(d);
  });
  return out;
}
function reviveDirty(raw){
  const out = Object.create(null);
  if(!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach(k => {
    const d = raw[k];
    if(d === '*') out[k] = '*';
    else if(Array.isArray(d)) out[k] = new Set(d.filter(Boolean));
  });
  return out;
}

function isUuid(v){
  /* Accept any UUID-shaped id. A strict RFC variant check rejected many
     already-stored journey ids, so each push minted a new row and duplicates exploded. */
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
