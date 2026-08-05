/* V2 ↔ store mapping helpers (legacy_id prefixes, journey types, settings) */

const V2_LEGACY_PREFIXES = [
  'show_flight:', 'show_primary_flight:', 'logistics:', 'logistics_marker:',
  'logistics_stay:', 'show_hotel:', 'show_timeline:', 'show_checklist:',
  'show_driver_journey:', 'tour_timeline:', 'tour_checklist:'
];

function v2StripLegacyId(raw){
  if(!raw) return raw;
  for(const p of V2_LEGACY_PREFIXES){
    if(raw.startsWith(p)) return raw.slice(p.length);
  }
  return raw;
}

function v2PrefixedLegacy(prefix, id){ return prefix + id; }

const V2_ICON_TO_JOURNEY = {
  plane: 'flight', train: 'rail', car: 'ground_transfer', ferry: 'ferry',
  bus: 'coach', walk: 'walk'
};
const V2_JOURNEY_TO_ICON = {
  flight: 'plane', rail: 'train', ground_transfer: 'car', ferry: 'ferry',
  coach: 'bus', walk: 'walk', other: 'plane'
};

function v2JourneyTypeFromEvent(e){
  const icon = (e.icon || 'plane').toLowerCase();
  if(icon === 'bed') return null;
  return V2_ICON_TO_JOURNEY[icon] || 'other';
}

function v2IconFromJourneyType(t){ return V2_JOURNEY_TO_ICON[t] || 'plane'; }

const V2_PRIO_TO_STORE = { low: 'low', medium: 'med', high: 'high' };
const V2_PRIO_FROM_STORE = { low: 'low', med: 'medium', medium: 'medium', high: 'high' };

const V2_ACCT_TO_STORE = {
  dj: 'dj', manager: 'manager', tour_manager: 'tm', agent: 'agent', other: 'other'
};
const V2_ACCT_FROM_STORE = {
  dj: 'dj', manager: 'manager', tm: 'tour_manager', tour_manager: 'tour_manager',
  agent: 'agent', other: 'other'
};

const V2_SHOW_STATUS_TO_STORE = {
  draft: 'draft', hold: 'hold', confirmed: 'confirmed', cancelled: 'cancelled'
};
const V2_SHOW_STATUS_FROM_STORE = {
  draft: 'draft', hold: 'hold', pending: 'hold', tentative: 'hold',
  confirmed: 'confirmed', cancelled: 'cancelled', canceled: 'cancelled'
};

function v2TimeFromTs(ts){
  if(!ts) return null;
  const d = new Date(ts);
  if(isNaN(d)) return null;
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

function v2DateFromTs(ts){
  if(!ts) return null;
  const d = new Date(ts);
  if(isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

function v2ParseTs(dateStr, timeStr){
  if(!dateStr) return null;
  const t = timeStr || '00:00';
  const iso = `${dateStr}T${t.length === 5 ? t + ':00' : t}Z`;
  const d = new Date(iso);
  return isNaN(d) ? null : d.toISOString();
}

function v2CombineDateTime(dateStr, timeVal){
  if(!dateStr) return null;
  if(!timeVal) return `${dateStr}T00:00:00.000Z`;
  const t = typeof timeVal === 'string' ? timeVal : v2TimeFromTs(timeVal);
  return v2ParseTs(dateStr, t);
}

function v2BuildLegacyMap(rows, idField){
  const m = {};
  (rows || []).forEach(r => {
    if(r.legacy_id) m[v2StripLegacyId(r.legacy_id)] = r[idField || 'id'];
    m[r[idField || 'id']] = r[idField || 'id'];
  });
  return m;
}

function v2BuildUuidToLegacy(rows){
  const m = {};
  (rows || []).forEach(r => {
    if(r.legacy_id) m[r.id] = v2StripLegacyId(r.legacy_id);
  });
  return m;
}

function v2CanManageFinance(role){
  return role === 'owner' || role === 'manager';
}

function v2StoragePathShow(orgId, showLegacyId, fileLegacyId, ext){
  return `${orgId}/shows/${showLegacyId}/documents/${fileLegacyId}.${ext}`;
}

function v2StoragePathJourney(orgId, journeyLegacyId, fileLegacyId, ext){
  return `${orgId}/journeys/${journeyLegacyId}/tickets/${fileLegacyId}.${ext}`;
}

function v2StoragePathOrg(orgId, fileLegacyId, ext){
  return `${orgId}/organisation/${fileLegacyId}.${ext}`;
}
