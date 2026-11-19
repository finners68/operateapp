/**
 * Screen-facing records. These are the composed objects the React UI reads
 * (shows, contacts, invoices), not the raw database rows.
 */
import type { HomeWidgetGridItem } from './homeWidgets.js';
import type { V2Collections } from './database.js';

export interface HotelStay {
  [key: string]: any;
  name?: string;
  city?: string;
  address?: string;
  conf?: string;
  bookingRef?: string;
  room?: string;
  roomType?: string;
  checkIn?: string;
  checkOut?: string;
  phone?: string;
}

export interface FlightRecord {
  [key: string]: any;
  id?: string;
  code?: string;
  flightNo?: string;
  from?: string;
  to?: string;
  fromCode?: string;
  toCode?: string;
  dep?: string;
  arr?: string;
  date?: string;
  gate?: string;
  terminal?: string;
}

export interface ShowFinance {
  fee?: number | string;
  currency?: string;
  dealType?: string;
  commission?: number | string;
  perDiem?: number | string;
  paid?: string;
}

/** A show as the screens see it after the engine composes database rows. */
export interface ShowRecord {
  [key: string]: any;
  id: string;
  kind?: string;
  date?: string;
  eventName?: string;
  venue?: string;
  venueAddr?: string;
  city?: string;
  country?: string;
  status?: string;
  color?: string;
  setTime?: string;
  endTime?: string;
  tripId?: string | null;
  artist?: string;
  hotel?: HotelStay | null;
  flights?: FlightRecord[];
  finance?: ShowFinance;
  showId?: string | null;
  title?: string;
  icon?: string;
  info?: string;
  start?: string;
  time?: string;
}

export interface ContactRecord {
  [key: string]: any;
  id: string;
  name?: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  showId?: string | null;
}

export interface TripRecord {
  [key: string]: any;
  id: string;
  title?: string;
  key?: string;
  start?: string;
  end?: string;
  shows?: ShowRecord[];
  color?: string;
}

export interface IdeaRecord {
  [key: string]: any;
  id: string;
  title?: string;
  body?: string;
  note?: string;
  type?: string;
  done?: boolean;
  eventId?: string | null;
  priority?: string;
}

export interface NoteRecord {
  [key: string]: any;
  id: string;
  title?: string;
  body?: string;
  folderId?: string | null;
}

export interface NoteFolderRecord {
  [key: string]: any;
  id: string;
  name?: string;
  title?: string;
}

export interface InvoiceLine {
  label?: string;
  amount?: number | string;
  qty?: number | string;
}

export interface InvoiceRecord {
  [key: string]: any;
  id: string;
  number?: string;
  status?: string;
  currency?: string;
  eventId?: string | null;
  lines?: InvoiceLine[];
}

export interface ReminderRecord {
  [key: string]: any;
  id?: string;
  title?: string;
  due?: string;
  done?: boolean;
  showId?: string | null;
  priority?: string;
}

export interface OperateSettings {
  [key: string]: any;
  artistName?: string;
  packingTemplate?: string[];
  baseCurrency?: string;
  baseCurrencyAuto?: boolean;
  fx?: Record<string, number>;
  billing?: { name?: string; address?: string; taxId?: string; iban?: string; email?: string };
  invoicePrefix?: string;
  invoiceSeq?: number;
  invoiceTerms?: number;
  accountType?: string;
  homeAirport?: string;
  security?: { enabled?: boolean; pin?: string; scope?: string; biometric?: boolean };
  homeWidgets?: { cols?: number; layout?: string[]; grid?: HomeWidgetGridItem[] };
  homeHeader?: { x?: number; y?: number };
}

export interface OperateStore {
  [key: string]: any;
  _seq?: number;
  organisationId?: string | null;
  activeTripId?: string | null;
  activeShowId?: string | null;
  tab?: string;
  settings?: OperateSettings;
  events?: ShowRecord[];
  trips?: TripRecord[];
  ideas?: IdeaRecord[];
  notes?: NoteRecord[];
  noteFolders?: NoteFolderRecord[];
  contacts?: ContactRecord[];
  invoices?: InvoiceRecord[];
  reminders?: ReminderRecord[];
  hotels?: HotelStay[];
  artists?: { id: string; name?: string; default?: boolean }[];
  v2?: V2Collections;
}

export interface StoreSelection {
  event?: (id: string) => ShowRecord | null;
  events?: () => ShowRecord[];
}

export interface AppOverlay {
  type: string;
  id?: string;
}

export interface LegacyLocation {
  tab: string;
  overlay: AppOverlay | null;
}

export interface NavReturn {
  tab: string;
  path: string;
  label: string;
}

export interface TimelineStep {
  [key: string]: any;
  id?: string;
  kind?: string;
  icon?: string;
  title?: string;
  sub?: string;
  time?: string;
  from?: string;
  to?: string;
  endTime?: string;
  date?: string;
  trueDate?: string;
  showDate?: string;
  showId?: string;
  done?: boolean;
}

export interface AuthUser {
  id?: string;
  email?: string;
}

/** Reject values that are not usable show records. Does not throw. */
export function asShowRecord(value: unknown): ShowRecord | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string' || !id) return null;
  return value as ShowRecord;
}

export function asShowList(value: unknown): ShowRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(asShowRecord).filter((row: any): row is ShowRecord => row !== null);
}
