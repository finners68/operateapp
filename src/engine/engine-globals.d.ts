/**
 * Names the classic engine scripts share.
 * These files are compiled as scripts, not modules, so they cannot import each other.
 * Declarations here describe globals that already exist at runtime.
 * Nothing in this file is emitted into the browser bundle.
 */

interface OperateConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  REQUIRE_AUTH?: boolean;
  SYNC_ENABLED?: boolean;
  OPERATE_ORG_ID?: string;
  OPERATE_ORGS?: { id?: string; name?: string }[];
  OPERATE_ALLOWED_USER_ID?: string;
  OPERATE_ALLOWED_EMAIL?: string;
  ensureDevHardwireAnonSession?: () => Promise<void>;
  getOperateThemePreference?: () => 'dark' | 'light' | 'system';
  setOperateThemePreference?: (pref: 'dark' | 'light' | 'system') => void;
  applyOperateTheme?: (pref?: 'dark' | 'light' | 'system') => void;
  operateThemeLabel?: (pref?: 'dark' | 'light' | 'system') => string;
  /** Optional auth.users id for user_preferences when using no-login dev sync. */
  OPERATE_DEV_PREFS_USER_ID?: string;
}

interface OperateReactApi {
  mountApp?: (el?: HTMLElement | null) => void;
  unmountApp?: () => void;
  isAppMounted?: () => boolean;
  mountShow?: (el: HTMLElement, id: string) => void;
  unmountShow?: () => void;
  mountShell?: () => void;
  isShellMounted?: () => boolean;
  refreshShell?: () => void;
  nav?: {
    navigateTo?: (path: string, opts?: { replace?: boolean }) => void;
    goTab?: (tab: string, opts?: { replace?: boolean }) => void;
    goBack?: () => void;
    pathForOverlay?: (...args: unknown[]) => string;
    pathForTab?: (tab: string) => string;
    isAppMounted?: () => boolean;
  };
  chromeToast?: (msg: string, icon?: string) => void;
  chromeOpenSheet?: (title: string, bodyHTML: string, opts?: Record<string, unknown>) => void;
  chromeOpenSheetReact?: (title: string, bodyKind: string, bodyProps?: Record<string, unknown>, opts?: Record<string, unknown>) => void;
  chromeCloseSheet?: (instant?: boolean, onDone?: () => void) => void;
  chromeOpenViewer?: (src: string) => void;
  chromeCloseViewer?: () => void;
  chromeShowLock?: (state: Record<string, unknown>) => void;
  chromeUpdateLock?: (partial: Record<string, unknown>) => void;
  chromeHideLock?: () => void;
  chromeShowAuth?: (partial: Record<string, unknown>) => void;
  chromeHideAuth?: () => void;
  chromeSetAuthMsg?: (msg: string, isErr?: boolean) => void;
  refreshContentTab?: () => void;
  isContentTabMounted?: () => boolean;
  refreshShowsList?: () => void;
  isShowsListMounted?: () => boolean;
  refreshNoteFolder?: () => void;
  isNoteFolderMounted?: () => boolean;
  refreshNoteDetail?: () => void;
  isNoteDetailMounted?: () => boolean;
  refreshCalendar?: () => void;
  isCalendarMounted?: () => boolean;
  isSearchMounted?: () => boolean;
  refreshSearch?: () => void;
  isContactsMounted?: () => boolean;
  refreshContacts?: () => void;
  refresh?: () => void;
}

/** Rows the engine builds up field by field. Extra fields are normal on saved shows and journeys. */
interface EngineRow {
  [key: string]: any;
}

/** querySelector returns Element. The engine reads form fields and data attributes from those nodes. */
interface Element {
  value?: string;
  disabled?: boolean;
  dataset?: DOMStringMap;
  style?: CSSStyleDeclaration;
  offsetWidth?: number;
  isContentEditable?: boolean;
}
interface HTMLElement {
  value?: string;
  disabled?: boolean;
  readOnly?: boolean;
  selectionStart?: number | null;
  setSelectionRange?: (start: number, end: number, direction?: string) => void;
  showPicker?: () => void;
}

interface SupabaseGlobal {
  createClient: (url: string, key: string) => {
    auth: {
      getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
      signInWithPassword?: (creds: { email: string; password: string }) => Promise<unknown>;
      signOut?: () => Promise<unknown>;
      onAuthStateChange?: (cb: (event: string, session: unknown) => void) => { data: { subscription: { unsubscribe: () => void } } };
    };
    from: (table: string) => unknown;
    rpc: (fn: string, args?: Record<string, unknown>) => unknown;
  };
}

/** Experimental Notification Triggers API used by reminders. */
declare class TimestampTrigger {
  constructor(timestamp: number);
}

interface NotificationOptions {
  showTrigger?: TimestampTrigger;
  badge?: string;
}

interface GetNotificationOptions {
  includeTriggered?: boolean;
}

declare const OPERATE_CONFIG: OperateConfig | undefined;
declare const OperateReact: OperateReactApi | undefined;
declare function notifyStore(): void;
declare function buildTourLogisticsCatalog(): { kind?: string; label?: string; icon?: string }[];

interface Window {
  OPERATE_CONFIG?: OperateConfig;
  supabase?: SupabaseGlobal;
  OperateReact?: OperateReactApi;
  notifyStore?: () => void;
  __calMarkSlide?: (dir: number) => void;
  __navReturn?: { tab?: string; path?: string; label?: string } | null;
  __operateLegacyFromPath?: (path: string) => { tab?: string; overlay?: unknown; navReturn?: { tab?: string; path?: string; label?: string } | null };
  __sheetCallbacks?: Record<string, (...args: unknown[]) => void>;
  __homeStartWidgetEdit?: () => void;
  __daysheet?: string;
  __daysheetEid?: string | null;
  __daysheetTitle?: string;
  __operateOrgNameCache?: Record<string, string>;
  __operateStoreListeners?: Set<() => void>;
  TABS?: { id: string; label: string; icon?: string }[];
  ICON?: Record<string, (size?: number) => string>;
  CATS?: Record<string, unknown>;
  IDEA_TYPES?: Record<string, unknown>;
  PRIO?: Record<string, unknown>;
  ROLES?: unknown;
  PASS_FILE_ACCEPT?: string;
  HOME_WIDGET_META?: Record<string, unknown>;
  DEFAULT_HOME_WIDGET_LAYOUT?: unknown;
  WIDGET_SIZE_OPTIONS?: Record<string, unknown>;
  TRAVEL_TYPE_SECTIONS?: unknown;
  DRIVER_PLACE_KINDS?: unknown;
  store?: unknown;
  sel?: unknown;
}
