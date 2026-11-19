import { defaultGridFromIds } from './homeWidgetGrid.js';
import type { HomeWidgetGridItem, HomeWidgetId } from '../types/homeWidgets.js';
import type { HomeWidgetMetaEntry } from '../types/window-bridge.js';

const FALLBACK_LAYOUT: HomeWidgetId[] = ['nextShow', 'todaySchedule', 'upcomingTravel', 'accommodation'];

function widgetMetaMap(): Record<string, HomeWidgetMetaEntry> {
  return (typeof window !== 'undefined' && window.HOME_WIDGET_META) || {};
}

function idsFromLayoutOrGrid(layoutOrGrid: HomeWidgetId[] | HomeWidgetGridItem[] | null | undefined): string[] {
  if (!layoutOrGrid?.length) return [];
  const first = layoutOrGrid[0];
  if (typeof first === 'object' && first && 'id' in first) {
    return (layoutOrGrid as HomeWidgetGridItem[]).map((g: any) => g.id);
  }
  return layoutOrGrid as HomeWidgetId[];
}

export function homeWidgetMeta(id: HomeWidgetId): HomeWidgetMetaEntry {
  const m = widgetMetaMap()[id];
  return m || { title: id, desc: '', essential: false };
}

export function readHomeWidgetLayout(): HomeWidgetId[] {
  const fn = typeof window !== 'undefined' ? window.getHomeWidgetLayout : null;
  return typeof fn === 'function' ? fn().slice() : FALLBACK_LAYOUT.slice();
}

export function readHomeWidgetGrid(): HomeWidgetGridItem[] {
  const fn = typeof window !== 'undefined' ? window.getHomeWidgetGrid : null;
  if (typeof fn === 'function') return fn().slice();
  return defaultGridFromIds(readHomeWidgetLayout());
}

export function writeHomeWidgetLayout(layout: HomeWidgetId[]): void {
  const fn = typeof window !== 'undefined' ? window.setHomeWidgetLayout : null;
  if (typeof fn === 'function') fn(layout);
}

export function writeHomeWidgetGrid(grid: HomeWidgetGridItem[], cols?: number): void {
  const fn = typeof window !== 'undefined' ? window.setHomeWidgetGrid : null;
  if (typeof fn === 'function') fn(grid, cols);
}

export function resetHomeWidgetLayout(): void {
  const fn = typeof window !== 'undefined' ? window.resetHomeWidgetLayout : null;
  if (typeof fn === 'function') fn();
}

export function availableHomeWidgets(layoutOrGrid: HomeWidgetId[] | HomeWidgetGridItem[] | null | undefined): string[] {
  const have = new Set(idsFromLayoutOrGrid(layoutOrGrid));
  return Object.keys(widgetMetaMap()).filter((id: any) => !have.has(id));
}

/** Widget types you can swap in for `currentId` (not already on the home row). */
export function swapOptionsForWidget(
  layoutOrGrid: HomeWidgetId[] | HomeWidgetGridItem[] | null | undefined,
  currentId: HomeWidgetId,
): string[] {
  const have = new Set(idsFromLayoutOrGrid(layoutOrGrid));
  return Object.keys(widgetMetaMap()).filter((id: any) => id !== currentId && !have.has(id));
}
