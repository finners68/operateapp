/** Home widget grid — 12 columns: Large = 12; two Medium (6+6) = Large width; three Small (2+2+2) = one Medium width; Small height = half Medium. */

import type {
  GridCell,
  GridRect,
  HomeWidgetGridItem,
  HomeWidgetId,
  WidgetDensity,
  WidgetSize,
} from '../types/homeWidgets.js';

export const HOME_GRID_ROW_PX = 76;
export const HOME_GRID_BASE_COLS = 12;

export const WIDGET_SIZE_PRESETS: Record<WidgetSize, { w: number; h: number }> = {
  small: { w: 2, h: 2 },
  medium: { w: 6, h: 4 },
  large: { w: 12, h: 4 },
};

/** Per-widget footprints — height matches typical content (not one tall box for all). */
export const WIDGET_SIZE_PRESETS_BY_WIDGET: Partial<
  Record<HomeWidgetId, Partial<Record<WidgetSize, { w: number; h: number }>>>
> = {
  nextShow: {
    small: { w: 2, h: 2 },
    medium: { w: 6, h: 3 },
    large: { w: 12, h: 3 },
  },
  upcomingTravel: {
    medium: { w: 6, h: 3 },
    large: { w: 12, h: 4 },
  },
  accommodation: {
    small: { w: 2, h: 2 },
    medium: { w: 6, h: 3 },
  },
  upcomingShows: {
    medium: { w: 6, h: 4 },
    large: { w: 12, h: 4 },
  },
  keyContacts: {
    medium: { w: 6, h: 3 },
    large: { w: 6, h: 5 },
  },
  tasksReminders: {
    small: { w: 2, h: 2 },
    medium: { w: 6, h: 4 },
    large: { w: 12, h: 4 },
  },
  todaySchedule: {
    medium: { w: 6, h: 4 },
    large: {
      w: WIDGET_SIZE_PRESETS.medium.w,
      h: WIDGET_SIZE_PRESETS.medium.h * 2,
    },
  },
};

/** Which preset sizes each widget may use (per product spec). */
export const WIDGET_SIZE_OPTIONS: Record<string, WidgetSize[]> = {
  nextShow: ['small', 'medium', 'large'],
  todaySchedule: ['medium', 'large'],
  upcomingTravel: ['medium', 'large'],
  accommodation: ['small', 'medium'],
  upcomingShows: ['medium', 'large'],
  keyContacts: ['medium', 'large'],
  tasksReminders: ['small', 'medium', 'large'],
};

export function colsForViewportWidth(px: number): number {
  if (px >= 1024) return 12;
  if (px >= 640) return 8;
  return 4;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function widgetSizeOptions(id: HomeWidgetId): WidgetSize[] {
  const fromWin = typeof window !== 'undefined' ? window.WIDGET_SIZE_OPTIONS?.[id] : undefined;
  const opts = fromWin || WIDGET_SIZE_OPTIONS[id] || (['medium'] as WidgetSize[]);
  return opts.slice();
}

export function defaultSizeForWidget(id: HomeWidgetId): WidgetSize {
  const opts = widgetSizeOptions(id);
  if (id === 'todaySchedule' && opts.includes('large')) return 'large';
  return opts.includes('medium') ? 'medium' : opts[0];
}

function inferSizeFromDims(id: HomeWidgetId, w?: number, h?: number): WidgetSize {
  const opts = widgetSizeOptions(id);
  let best: WidgetSize = defaultSizeForWidget(id);
  let bestD = Number.POSITIVE_INFINITY;
  opts.forEach((key) => {
    const p = dimensionsForWidget(id, key);
    const d = Math.abs(p.w - (w || 0)) + Math.abs(p.h - (h || 0));
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  });
  return best;
}

export function normalizeWidgetSize(
  id: HomeWidgetId,
  size: WidgetSize | null | undefined,
  w?: number,
  h?: number,
): WidgetSize {
  const opts = widgetSizeOptions(id);
  let s = size;
  if (!s || !opts.includes(s)) s = inferSizeFromDims(id, w, h);
  if (!opts.includes(s)) s = defaultSizeForWidget(id);
  return s;
}

export function dimensionsForWidget(
  id: HomeWidgetId,
  size?: WidgetSize | null,
): { w: number; h: number; size: WidgetSize } {
  const s = normalizeWidgetSize(id, size);
  const preset =
    WIDGET_SIZE_PRESETS_BY_WIDGET[id]?.[s] || WIDGET_SIZE_PRESETS[s] || WIDGET_SIZE_PRESETS.medium;
  return { w: preset.w, h: preset.h, size: s };
}

export function sizeToDensity(size?: WidgetSize | string): WidgetDensity {
  if (size === 'small') return 'compact';
  if (size === 'large') return 'expanded';
  return 'default';
}

export function sizeLabel(size?: WidgetSize | string): 'S' | 'M' | 'L' {
  if (size === 'small') return 'S';
  if (size === 'large') return 'L';
  return 'M';
}

export function sizeTitle(size?: WidgetSize | string): 'Small' | 'Medium' | 'Large' {
  if (size === 'small') return 'Small';
  if (size === 'large') return 'Large';
  return 'Medium';
}

export function densityListLimit<T>(density: WidgetDensity, compact: T, def: T, expanded: T): T {
  if (density === 'compact') return compact;
  if (density === 'expanded') return expanded;
  return def;
}

/** Max list rows that fit inside a preset without inner scrolling. */
export function listCapForWidget(widgetId: HomeWidgetId, size?: WidgetSize | string): number {
  const caps: Record<string, Partial<Record<WidgetSize, number>>> = {
    tasksReminders: { small: 3, medium: 5, large: 7 },
    keyContacts: { small: 4, medium: 6, large: 8 },
    todaySchedule: { medium: 5, large: 10 },
    upcomingShows: { medium: 4, large: 6 },
  };
  const byWidget = caps[widgetId];
  const s = (size || 'medium') as WidgetSize;
  if (byWidget && byWidget[s] != null) return byWidget[s] as number;
  if (s === 'small') return 3;
  if (s === 'large') return 7;
  return 5;
}

export function defaultGridFromIds(ids: HomeWidgetId[] | null | undefined): HomeWidgetGridItem[] {
  let y = 0;
  return (ids || []).map((id: any) => {
    const size = defaultSizeForWidget(id);
    const { w, h } = dimensionsForWidget(id, size);
    const item: HomeWidgetGridItem = { id, x: 0, y, w, h, size };
    y += h;
    return item;
  });
}

export function sortGridItems(grid: HomeWidgetGridItem[] | null | undefined): HomeWidgetGridItem[] {
  return (grid || []).slice().sort((a: any, b: any) => a.y - b.y || a.x - b.x);
}

function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Remove empty rows between widgets while keeping each widget’s column when it still fits. */
export function compactGridItems(
  grid: HomeWidgetGridItem[] | null | undefined,
  cols: number,
): HomeWidgetGridItem[] {
  const items = sortGridItems((grid || []).map((g) => ({ ...g })));
  const out: HomeWidgetGridItem[] = [];
  items.forEach((raw) => {
    const size = normalizeWidgetSize(raw.id, raw.size, raw.w, raw.h);
    const dims = dimensionsForWidget(raw.id, size);
    const w = Math.min(dims.w, cols);
    const x = clamp(Number(raw.x) || 0, 0, Math.max(0, cols - w));
    let y = 0;
    const place: GridRect = { x, y, w, h: dims.h };
    while (out.some((o) => rectsOverlap(place, o))) {
      y += 1;
      place.y = y;
    }
    out.push({ id: raw.id, x: place.x, y: place.y, w, h: dims.h, size: dims.size });
  });
  return out;
}

/** Place items without overlap — pushes widgets down like making room on the home screen. */
export function packGridItems(grid: HomeWidgetGridItem[] | null | undefined, cols: number): HomeWidgetGridItem[] {
  const items = sortGridItems((grid || []).map((g: any) => ({ ...g })));
  const out: HomeWidgetGridItem[] = [];
  items.forEach((raw: any) => {
    const size = normalizeWidgetSize(raw.id, raw.size, raw.w, raw.h);
    const dims = dimensionsForWidget(raw.id, size);
    const w = Math.min(dims.w, cols);
    const x = clamp(Number(raw.x) || 0, 0, Math.max(0, cols - w));
    let y = Math.max(0, Number(raw.y) || 0);
    const place: GridRect = { x, y, w, h: dims.h };
    while (out.some((o: any) => rectsOverlap(place, o))) {
      place.y += 1;
      y += 1;
    }
    out.push({ id: raw.id, x: place.x, y: place.y, w, h: dims.h, size: dims.size });
  });
  return out;
}

export function swapGridWidgetPositions(
  grid: HomeWidgetGridItem[] | null | undefined,
  idA: HomeWidgetId,
  idB: HomeWidgetId,
): HomeWidgetGridItem[] {
  const list = grid || [];
  const a = list.find((g: any) => g.id === idA);
  const b = list.find((g: any) => g.id === idB);
  if (!a || !b || idA === idB) return list;
  const ax = a.x;
  const ay = a.y;
  return list.map((g: any) => {
    if (g.id === idA) return { ...g, x: b.x, y: b.y };
    if (g.id === idB) return { ...g, x: ax, y: ay };
    return g;
  });
}

export function findWidgetIdAtPoint(
  grid: HomeWidgetGridItem[] | null | undefined,
  dragId: HomeWidgetId,
  clientX: number,
  clientY: number,
  slotRefs?: Record<string, HTMLElement | null | undefined> | null,
): HomeWidgetId | null {
  let hit: HomeWidgetId | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  (grid || []).forEach((item: any) => {
    if (item.id === dragId) return;
    const el = slotRefs?.[item.id];
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return;
    const area = r.width * r.height;
    if (area < bestArea) {
      bestArea = area;
      hit = item.id;
    }
  });
  return hit;
}

function itemRect(item: HomeWidgetGridItem, cols: number): GridRect {
  const dims = dimensionsForWidget(item.id, item.size);
  const w = Math.min(dims.w, cols);
  return { x: item.x || 0, y: item.y || 0, w, h: dims.h };
}

/** Snap the left column so multi-column widgets line up (e.g. w=6 → columns 0 and 6 on a 12-wide grid). */
export function snapGridX(x: number, w: number, cols: number): number {
  const max = Math.max(0, cols - w);
  if (w < 1 || cols < 1) return clamp(x, 0, max);
  if (cols % w === 0) {
    const snapped = Math.round(x / w) * w;
    return clamp(snapped, 0, max);
  }
  return clamp(x, 0, max);
}

export function moveGridWidget(
  grid: HomeWidgetGridItem[],
  id: HomeWidgetId,
  x: number,
  y: number,
  cols: number,
): HomeWidgetGridItem[] {
  const items = grid.slice().map((g) => {
    const dims = dimensionsForWidget(g.id, g.size);
    const w = Math.min(dims.w, cols);
    return { ...g, w, h: dims.h };
  });
  const idx = items.findIndex((g: any) => g.id === id);
  if (idx < 0) return items;
  const item = items[idx];
  const w = item.w;
  const nx = snapGridX(x, w, cols);
  const ny = Math.max(0, y);
  const next: HomeWidgetGridItem = { ...item, x: nx, y: ny, w };
  const target = itemRect(next, cols);
  const hit = items.find((o: any) => o.id !== id && rectsOverlap(target, itemRect(o, cols)));
  if (hit) {
    return items.map((g: any) => {
      if (g.id === id) return { ...next, x: hit.x, y: hit.y };
      if (g.id === hit.id) return { ...hit, x: item.x, y: item.y };
      return g;
    });
  }
  return items.map((g: any) => (g.id === id ? next : g));
}

function nudgeOverlapping(items: HomeWidgetGridItem[], anchorIdx: number): HomeWidgetGridItem[] {
  const anchor = items[anchorIdx];
  if (!anchor) return items;
  const box: GridRect = { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h };
  let guard = 0;
  let changed = true;
  while (changed && guard < 32) {
    guard += 1;
    changed = false;
    items.forEach((g: any, j: any) => {
      if (j === anchorIdx) return;
      if (rectsOverlap(box, g)) {
        const pushedY = box.y + box.h;
        if (g.y < pushedY) {
          items[j] = { ...g, y: pushedY };
          changed = true;
        }
      }
    });
  }
  return items;
}

/** Resize in place (same anchor cell); only nudge neighbours that overlap. */
export function setWidgetSize(
  grid: HomeWidgetGridItem[],
  id: HomeWidgetId,
  size: WidgetSize,
  cols: number,
): HomeWidgetGridItem[] {
  const opts = widgetSizeOptions(id);
  const chosen = opts.includes(size) ? size : defaultSizeForWidget(id);
  const dims = dimensionsForWidget(id, chosen);
  const items = grid.map((g: any) => ({ ...g }));
  const idx = items.findIndex((g: any) => g.id === id);
  if (idx < 0) return items;
  const item = items[idx];
  const oldH = item.h;
  const oldBottom = item.y + oldH;
  const nw = Math.min(dims.w, cols);
  const nx = clamp(item.x, 0, Math.max(0, cols - nw));
  const ny = item.y;
  const nh = dims.h;
  items[idx] = { ...item, x: nx, y: ny, w: nw, h: nh, size: chosen };
  nudgeOverlapping(items, idx);
  const deltaH = nh - oldH;
  if (deltaH < 0) {
    items.forEach((g: any, j: any) => {
      if (j === idx) return;
      if (g.y >= oldBottom) {
        items[j] = { ...g, y: Math.max(ny + nh, g.y + deltaH) };
      }
    });
    nudgeOverlapping(items, idx);
  }
  return items;
}

export function appendGridWidget(
  grid: HomeWidgetGridItem[] | null | undefined,
  id: HomeWidgetId,
  cols: number,
): HomeWidgetGridItem[] {
  const size = defaultSizeForWidget(id);
  const { w, h } = dimensionsForWidget(id, size);
  const y = (grid || []).reduce((m: any, g: any) => Math.max(m, g.y + g.h), 0);
  return [...(grid || []), { id, x: 0, y, w: Math.min(w, cols), h, size }];
}

export function removeGridWidget(
  grid: HomeWidgetGridItem[] | null | undefined,
  id: HomeWidgetId,
): HomeWidgetGridItem[] {
  return (grid || []).filter((g: any) => g.id !== id);
}

export function replaceGridWidgetId(
  grid: HomeWidgetGridItem[] | null | undefined,
  oldId: HomeWidgetId,
  newId: HomeWidgetId,
): HomeWidgetGridItem[] {
  if (oldId === newId) return grid || [];
  return (grid || []).map((g: any) => {
    if (g.id !== oldId) return g;
    const size = defaultSizeForWidget(newId);
    const dims = dimensionsForWidget(newId, size);
    return { ...g, id: newId, w: dims.w, h: dims.h, size: dims.size };
  });
}

export function normalizeGridItem(item: Partial<HomeWidgetGridItem> | null | undefined, cols: number): HomeWidgetGridItem | null {
  if (!item?.id) return null;
  const size = normalizeWidgetSize(item.id, item.size, item.w, item.h);
  const dims = dimensionsForWidget(item.id, size);
  const w = Math.min(dims.w, cols || HOME_GRID_BASE_COLS);
  const x = clamp(Number(item.x) || 0, 0, Math.max(0, (cols || HOME_GRID_BASE_COLS) - w));
  const y = Math.max(0, Number(item.y) || 0);
  return { id: item.id, x, y, w, h: dims.h, size: dims.size };
}

export function normalizeGrid(grid: Partial<HomeWidgetGridItem>[] | null | undefined, cols: number): HomeWidgetGridItem[] {
  const out: HomeWidgetGridItem[] = [];
  (grid || []).forEach((item: any) => {
    const n = normalizeGridItem(item, cols);
    if (n && !out.some((x: any) => x.id === n.id)) out.push(n);
  });
  return out;
}

function readGridGaps(containerEl: Element, fallback: any = 12): { col: number; row: number } {
  if (typeof window === 'undefined' || !containerEl) return { col: fallback, row: fallback };
  const cs = getComputedStyle(containerEl);
  const pair = parseFloat(cs.gap);
  if (Number.isFinite(pair) && pair >= 0) return { col: pair, row: pair };
  const col = parseFloat(cs.columnGap);
  const row = parseFloat(cs.rowGap);
  return {
    col: Number.isFinite(col) && col >= 0 ? col : fallback,
    row: Number.isFinite(row) && row >= 0 ? row : fallback,
  };
}

/** Map pointer position to the grid column/row under the finger (respects CSS grid gap). */
export function pointerToGridCell(
  containerEl: Element | { getBoundingClientRect: () => DOMRect },
  clientX: number,
  clientY: number,
  cols: number,
  rowPx: any = HOME_GRID_ROW_PX,
  gapPx?: number,
): GridCell {
  if (!containerEl || cols < 1) return { x: 0, y: 0 };
  const rect = containerEl.getBoundingClientRect();
  const gaps =
    gapPx != null
      ? { col: gapPx, row: gapPx }
      : 'getComputedStyle' in containerEl
        ? readGridGaps(containerEl as Element, 12)
        : { col: 12, row: 12 };
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const colW = (Math.max(1, rect.width) - gaps.col * Math.max(0, cols - 1)) / cols;
  let x = cols - 1;
  for (let c = 0; c < cols; c++) {
    const start = c * (colW + gaps.col);
    if (relX < start + colW + gaps.col * 0.5) {
      x = c;
      break;
    }
  }
  const rowStep = rowPx + gaps.row;
  const y = Math.max(0, Math.floor(Math.max(0, relY) / rowStep));
  return { x: clamp(x, 0, cols - 1), y };
}

/** Move (or swap) the dragged widget to the grid cell under the pointer — enables side‑by‑side layouts. */
export function placeGridWidgetAtPointer(
  grid: HomeWidgetGridItem[],
  id: HomeWidgetId,
  containerEl: Element | { getBoundingClientRect: () => DOMRect } | null,
  clientX: number,
  clientY: number,
  cols: number,
  rowPx: any = HOME_GRID_ROW_PX,
): HomeWidgetGridItem[] {
  const items = grid || [];
  const item = items.find((g: any) => g.id === id);
  if (!item || !containerEl) return items;
  const cell = pointerToGridCell(containerEl, clientX, clientY, cols, rowPx);
  const dims = dimensionsForWidget(item.id, item.size);
  const w = Math.min(dims.w, cols);
  const nx = snapGridX(cell.x, w, cols);
  const ny = Math.max(0, cell.y);
  const next = packGridItems(moveGridWidget(items, id, nx, ny, cols), cols);
  const unchanged =
    items.length === next.length &&
    items.every((g: any) => {
      const n = next.find((x: any) => x.id === g.id);
      return n && n.x === g.x && n.y === g.y;
    });
  return unchanged ? items : next;
}

export function displayGridItem(item: HomeWidgetGridItem, cols: number): HomeWidgetGridItem;
export function displayGridItem(item: HomeWidgetGridItem | null | undefined, cols: number): HomeWidgetGridItem | null | undefined;
/** Snap stored grid items to canonical w/h/size for the widget’s preset (12-col storage). */
export function reconcileGridItem(item: HomeWidgetGridItem): HomeWidgetGridItem {
  const size = normalizeWidgetSize(item.id, item.size, item.w, item.h);
  const dims = dimensionsForWidget(item.id, size);
  const w = Math.min(dims.w, HOME_GRID_BASE_COLS);
  const x = clamp(Number(item.x) || 0, 0, Math.max(0, HOME_GRID_BASE_COLS - w));
  return {
    id: item.id,
    x,
    y: Math.max(0, Number(item.y) || 0),
    w,
    h: dims.h,
    size,
  };
}

/** View mode: honour saved x/y/w/h without re-packing the user’s layout. */
export function displayGridLayout(
  grid: HomeWidgetGridItem[] | null | undefined,
  cols: number,
): HomeWidgetGridItem[] {
  return sortGridItems(
    (grid || [])
      .map((g) => displayGridItem(reconcileGridItem(g), cols))
      .filter(Boolean) as HomeWidgetGridItem[],
  );
}

export function displayGridItem(item: HomeWidgetGridItem | null | undefined, cols: number): HomeWidgetGridItem | null | undefined {
  if (!item) return item;
  const base = reconcileGridItem(item);
  const ratio = cols / HOME_GRID_BASE_COLS;
  const size = base.size;
  const dims = dimensionsForWidget(item.id, size);
  let w = Math.max(1, Math.round(dims.w * ratio));
  w = Math.min(w, cols);
  let x = Math.round((base.x || 0) * ratio);
  x = clamp(x, 0, Math.max(0, cols - w));
  return { ...item, x, w, h: dims.h, size };
}

export function storeGridItem(item: HomeWidgetGridItem, cols: number): HomeWidgetGridItem {
  const size = item.size || normalizeWidgetSize(item.id, null, item.w, item.h);
  const base = dimensionsForWidget(item.id, size);
  if (cols === HOME_GRID_BASE_COLS) {
    return { id: item.id, x: item.x || 0, y: item.y || 0, w: base.w, h: base.h, size };
  }
  const ratio = HOME_GRID_BASE_COLS / cols;
  return {
    id: item.id,
    x: Math.round((item.x || 0) * ratio),
    y: item.y || 0,
    w: base.w,
    h: base.h,
    size,
  };
}

if (typeof window !== 'undefined') {
  window.WIDGET_SIZE_PRESETS = WIDGET_SIZE_PRESETS;
  window.WIDGET_SIZE_PRESETS_BY_WIDGET = WIDGET_SIZE_PRESETS_BY_WIDGET;
  window.WIDGET_SIZE_OPTIONS = WIDGET_SIZE_OPTIONS;
  window.HOME_WIDGET_GRID_SPECS = undefined;
}