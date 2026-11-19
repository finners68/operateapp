import type { HomeWidgetGridItem, WidgetSize } from './homeWidgets.js';
import type { AppOverlay, AuthUser, NavReturn, OperateStore, StoreSelection } from './records.js';

/** Catalogue entry stored on `window.HOME_WIDGET_META` by the vanilla home-widgets script. */
export interface HomeWidgetMetaEntry {
  title: string;
  desc: string;
  essential?: boolean;
  priority?: string;
}

/** Legacy globals exposed on `window` for vanilla scripts — typed gradually. */
declare global {
  interface Window {
    /** Classic scripts attach many functions here. Known fields stay listed below. */
    [key: string]: any;
    WIDGET_SIZE_OPTIONS?: Record<string, WidgetSize[]>;
    WIDGET_SIZE_PRESETS?: Record<WidgetSize, { w: number; h: number }>;
    HOME_WIDGET_GRID_SPECS?: unknown;
    HOME_WIDGET_META?: Record<string, HomeWidgetMetaEntry>;
    getHomeWidgetLayout?: () => string[];
    getHomeWidgetGrid?: () => HomeWidgetGridItem[];
    setHomeWidgetLayout?: (layout: string[]) => void;
    setHomeWidgetGrid?: (grid: HomeWidgetGridItem[], cols?: number) => void;
    resetHomeWidgetLayout?: () => void;
    store?: OperateStore;
    sel?: StoreSelection;
    overlay?: AppOverlay | null;
    authUser?: AuthUser | null;
    TABS?: { id: string; label: string; icon?: string; hint?: string }[];
    __navReturn?: NavReturn | null;
    __operateStoreListeners?: Set<() => void>;
    __operateLegacyFromPath?: (pathname: string) => { tab: string; overlay: AppOverlay | null };
    notifyStore?: () => void;
    getStore?: () => OperateStore | null | undefined;
    ideasStale?: boolean;
    prepareShowsList?: () => void;
    persist?: (table?: string) => void;
    saveNavState?: () => void;
    haptic?: () => void;
    setFab?: () => void;
    syncScreenChrome?: () => void;
    financeLockActive?: () => boolean;
    requireUnlock?: (scope: string, next: () => void) => void;
    resetShowFolds?: (id: string) => void;
    sheetEl?: unknown;
  }
}

export {};
