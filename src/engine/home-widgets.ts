/* Home dashboard widgets — layout saved on store.settings.homeWidgets */



const HOME_WIDGET_LEGACY = {

  primary: 'nextShow',

  upcoming: 'upcomingShows',

  contacts: 'keyContacts',

  travel: 'upcomingTravel',

  today: 'todaySchedule',

  tasks: 'tasksReminders',

  snapshot: null,

  attention: null,

  finance: null,

  ideas: null,

  tours: null,

  notes: null,

  holds: null,

  conflicts: null,

};



const HOME_WIDGET_META = {

  nextShow: {

    title: 'Next show',

    essential: true,

    priority: 'essential',

    desc: 'Date, venue, set time and countdown — opens the full show',

  },

  todaySchedule: {

    title: "Today's schedule",

    essential: true,

    priority: 'essential',

    desc: 'Today’s timeline: flights, transfers, hotels and performance',

  },

  upcomingTravel: {

    title: 'Upcoming travel',

    essential: true,

    priority: 'essential',

    desc: 'Next flight, train or transfer with times and booking details',

  },

  accommodation: {

    title: 'Accommodation',

    essential: true,

    priority: 'essential',

    desc: 'Hotel check-in/out, address, room and booking ref',

  },

  upcomingShows: {

    title: 'Upcoming shows',

    essential: false,

    priority: 'high',

    desc: 'Next 3–5 performances with dates and venues',

  },

  keyContacts: {

    title: 'Key contacts',

    essential: false,

    priority: 'high',

    desc: 'Promoter, driver, tour manager, hotel — call or WhatsApp',

  },

  tasksReminders: {

    title: 'Tasks / reminders',

    essential: false,

    priority: 'optional',

    desc: 'Checklist items and outstanding to-dos (optional at launch)',

  },

};



const DEFAULT_HOME_WIDGET_LAYOUT = [

  'nextShow',

  'todaySchedule',

  'upcomingTravel',

  'accommodation',

];

const HOME_SIZE_PRESETS = { small: { w: 2, h: 2 }, medium: { w: 6, h: 4 }, large: { w: 12, h: 5 } };

const HOME_SIZE_PRESETS_BY_WIDGET = {
  todaySchedule: {
    large: { w: HOME_SIZE_PRESETS.medium.w, h: HOME_SIZE_PRESETS.medium.h * 2 },
  },
};

const HOME_WIDGET_SIZE_OPTS = {

  nextShow: ['small', 'medium', 'large'],

  todaySchedule: ['medium', 'large'],

  upcomingTravel: ['medium', 'large'],

  accommodation: ['small', 'medium'],

  upcomingShows: ['medium', 'large'],

  keyContacts: ['medium', 'large'],

  tasksReminders: ['small', 'medium', 'large'],

};

function homeWidgetSizeOptions(id){

  const fromWin = (typeof window !== 'undefined' && window.WIDGET_SIZE_OPTIONS) ? window.WIDGET_SIZE_OPTIONS[id] : null;

  return fromWin || HOME_WIDGET_SIZE_OPTS[id] || ['medium'];

}

function homeWidgetDefaultSize(id){

  const opts = homeWidgetSizeOptions(id);

  if(id === 'todaySchedule' && opts.indexOf('large') >= 0) return 'large';

  return opts.indexOf('medium') >= 0 ? 'medium' : opts[0];

}

function homePresetDims(id, size){

  const byWidget = (typeof window !== 'undefined' && (window as any).WIDGET_SIZE_PRESETS_BY_WIDGET && (window as any).WIDGET_SIZE_PRESETS_BY_WIDGET[id])
    || HOME_SIZE_PRESETS_BY_WIDGET[id];

  const base = (typeof window !== 'undefined' && (window as any).WIDGET_SIZE_PRESETS) || HOME_SIZE_PRESETS;

  const p = (byWidget && byWidget[size]) || base[size] || base.medium;

  return p;

}

function homeInferSizeFromDims(id: string, w?: number, h?: number){

  const opts = homeWidgetSizeOptions(id);

  let best = homeWidgetDefaultSize(id);

  let bestD = Number.POSITIVE_INFINITY;

  opts.forEach((s: string) => {

    const p = homePresetDims(id, s);

    const d = Math.abs(p.w - (w || 0)) + Math.abs(p.h - (h || 0));

    if(d < bestD){

      bestD = d;

      best = s;

    }

  });

  return best;

}

function homeDimsForSize(id, size){

  const opts = homeWidgetSizeOptions(id);

  let s = size;

  if(!s || opts.indexOf(s) < 0) s = homeWidgetDefaultSize(id);

  const p = homePresetDims(id, s);

  return { w: p.w, h: p.h, size: s };

}



function migrateWidgetId(id){

  if(!id) return null;

  if(HOME_WIDGET_META[id]) return id;

  if(Object.prototype.hasOwnProperty.call(HOME_WIDGET_LEGACY, id)){

    return HOME_WIDGET_LEGACY[id];

  }

  return null;

}



function normalizeHomeWidgetLayout(layout){

  const ids = Object.keys(HOME_WIDGET_META);

  const set = new Set(ids);

  const src = Array.isArray(layout) ? layout : DEFAULT_HOME_WIDGET_LAYOUT;

  const out = [];

  src.forEach((id) => {

    const mapped = migrateWidgetId(id);

    if(mapped && set.has(mapped) && !out.includes(mapped)) out.push(mapped);

  });

  return out.length ? out : DEFAULT_HOME_WIDGET_LAYOUT.slice();

}



function getHomeWidgetLayout(){

  if(!store || !store.settings) return DEFAULT_HOME_WIDGET_LAYOUT.slice();

  const raw = store.settings.homeWidgets;

  if(!raw || !Array.isArray(raw.layout)) return DEFAULT_HOME_WIDGET_LAYOUT.slice();

  return normalizeHomeWidgetLayout(raw.layout);

}



function normalizeHomeWidgetGrid(grid, cols){

  const ids = Object.keys(HOME_WIDGET_META);

  const set = new Set(ids);

  const c = cols || 12;

  const src = Array.isArray(grid) ? grid : [];

  const out = [];

  src.forEach((item) => {

    if(!item || !item.id) return;

    const id = migrateWidgetId(item.id);

    if(!id || !set.has(id) || out.some((x) => x.id === id)) return;

    const opts = homeWidgetSizeOptions(id);

    let size = item.size;

    if(!size || opts.indexOf(size) < 0){

      size = homeInferSizeFromDims(id, Number(item.w), Number(item.h));

    }

    const dims = homeDimsForSize(id, size);

    const w = Math.min(dims.w, c);

    const x = Math.max(0, Math.min(c - w, Number(item.x) || 0));

    const y = Math.max(0, Number(item.y) || 0);

    out.push({ id, x, y, w, h: dims.h, size: dims.size });

  });

  return out.length ? out : defaultGridFromIds(DEFAULT_HOME_WIDGET_LAYOUT, c);

}



function defaultGridFromIds(ids, cols){

  const c = cols || 12;

  let y = 0;

  return ids.map((id) => {

    const dims = homeDimsForSize(id, homeWidgetDefaultSize(id));

    const w = Math.min(dims.w, c);

    const item = { id, x: 0, y, w, h: dims.h, size: dims.size };

    y += dims.h;

    return item;

  });

}



function gridSlotNeedsRepair(raw: any, n: any){
  if(!raw) return true;
  if(Number(raw.w) !== n.w || Number(raw.h) !== n.h) return true;
  const storedSize = raw.size || homeInferSizeFromDims(n.id, Number(raw.w), Number(raw.h));
  return storedSize !== n.size;
}

function applyHomeWidgetGridLocal(normalized, cols){
  if(!store.settings) store.settings = {};
  store.settings.homeWidgets = {
    layout: normalized.map((x) => x.id),
    grid: normalized,
    cols,
  };
  if(typeof db !== 'undefined' && typeof db.write === 'function') db.write(store);
}

/** Canonical w/h/size after cloud load — does not hit the network. */
function canonicalizeHomeWidgets(hw){
  if(!hw || typeof hw !== 'object' || !Array.isArray(hw.grid)) return hw;
  const cols = Number(hw.cols) > 0 ? Number(hw.cols) : 12;
  const normalized = normalizeHomeWidgetGrid(hw.grid, cols);
  return {
    cols,
    layout: normalized.map((x) => x.id),
    grid: normalized,
  };
}

function getHomeWidgetGrid(){

  if(!store || !store.settings) return defaultGridFromIds(DEFAULT_HOME_WIDGET_LAYOUT, 12);

  const raw = store.settings.homeWidgets;

  const cols = (raw && raw.cols) || 12;

  if(raw && Array.isArray(raw.grid) && raw.grid.length){

    const normalized = normalizeHomeWidgetGrid(raw.grid, cols);

    const stale = normalized.some((n) => {
      const r = raw.grid.find((g: any) => migrateWidgetId(g?.id) === n.id);
      return gridSlotNeedsRepair(r, n);
    });

    if(stale){
      applyHomeWidgetGridLocal(normalized, cols);
      if(!store._homeWidgetGridRepairQueued){
        store._homeWidgetGridRepairQueued = true;
        persist('user_preferences');
      }
    }

    return normalized;

  }

  const ids = getHomeWidgetLayout();

  return defaultGridFromIds(ids, cols);

}



function setHomeWidgetGrid(grid, cols){

  if(!store.settings) store.settings = {};

  const c = cols || (store.settings.homeWidgets && store.settings.homeWidgets.cols) || 12;

  const normalized = normalizeHomeWidgetGrid(grid, c);

  store.settings.homeWidgets = {

    layout: normalized.map((x) => x.id),

    grid: normalized,

    cols: c,

  };

  persist('user_preferences');

  if(typeof notifyStore === 'function') notifyStore();

}



function setHomeWidgetLayout(layout){

  if(!store.settings) store.settings = {};

  const ids = normalizeHomeWidgetLayout(layout);

  const cols = (store.settings.homeWidgets && store.settings.homeWidgets.cols) || 12;

  store.settings.homeWidgets = {

    layout: ids,

    grid: defaultGridFromIds(ids, cols),

    cols,

  };

  persist('user_preferences');

  if(typeof notifyStore === 'function') notifyStore();

}



function resetHomeWidgetLayout(){

  setHomeWidgetLayout(DEFAULT_HOME_WIDGET_LAYOUT);

}



function homeWidgetsNotInLayout(){

  const have = new Set(getHomeWidgetLayout());

  return Object.keys(HOME_WIDGET_META).filter((id) => !have.has(id));

}



function homeWidgetTitle(id){

  const m = HOME_WIDGET_META[id];

  return m ? m.title : id;

}



if(typeof window !== 'undefined'){

  window.HOME_WIDGET_META = HOME_WIDGET_META;

  window.DEFAULT_HOME_WIDGET_LAYOUT = DEFAULT_HOME_WIDGET_LAYOUT;

  window.getHomeWidgetLayout = getHomeWidgetLayout;

  window.getHomeWidgetGrid = getHomeWidgetGrid;

  window.setHomeWidgetLayout = setHomeWidgetLayout;

  window.setHomeWidgetGrid = setHomeWidgetGrid;

  window.resetHomeWidgetLayout = resetHomeWidgetLayout;

  window.homeWidgetsNotInLayout = homeWidgetsNotInLayout;

  window.homeWidgetTitle = homeWidgetTitle;
  window.canonicalizeHomeWidgets = canonicalizeHomeWidgets;

}
