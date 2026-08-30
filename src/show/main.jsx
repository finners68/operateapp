import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ShowPage from './ShowPage.jsx';
import ShowsListPage from '../shows-list/ShowsListPage.jsx';
import HomePage from '../home/HomePage.jsx';
import TripModePage from '../trip/TripModePage.jsx';
import TripDetailPage from '../trip/TripDetailPage.jsx';
import CalendarPage from '../calendar/CalendarPage.jsx';
import ContentTabPage from '../content/ContentTabPage.jsx';
import IdeaDetailPage from '../content/IdeaDetailPage.jsx';
import NoteDetailPage from '../content/NoteDetailPage.jsx';
import NoteFolderPage from '../content/NoteFolderPage.jsx';
import SettingsPage from '../settings/SettingsPage.jsx';
import SearchPage from '../search/SearchPage.jsx';
import FinancePage from '../finance/FinancePage.jsx';
import InvoicesPage from '../finance/InvoicesPage.jsx';
import InvoiceDetailPage from '../finance/InvoiceDetailPage.jsx';
import ContactsPage from '../contacts/ContactsPage.jsx';
import PastShowsPage from '../calendar/PastShowsPage.jsx';
import StatsPage from '../stats/StatsPage.jsx';
import ItineraryPage from '../itinerary/ItineraryPage.jsx';
import WrappedPage from '../wrapped/WrappedPage.jsx';
import { NavBar, FabInner, ToastHost, LockHost, AuthHost, ShellOverlays } from '../shell/AppShell.jsx';
import {
  setSheetState, setToastState, setLockState, setAuthState, setViewerState, sheetState,
} from '../shell/chromeState.js';
import { notifyStore, call } from './bridge.js';

function paint(root, node){
  flushSync(() => { root.render(node); });
}

let showRoot = null;
let mountedShowId = null;
let listRoot = null;
let homeRoot = null;
let tripRoot = null;
let tripDetailRoot = null;
let mountedTripId = null;
let calendarRoot = null;
let contentRoot = null;
let ideaRoot = null;
let mountedIdeaId = null;
let noteRoot = null;
let mountedNoteId = null;
let noteFolderRoot = null;
let mountedNoteFolderId = null;
let settingsRoot = null;
let searchRoot = null;
let financeRoot = null;
let invoicesRoot = null;
let invoiceRoot = null;
let mountedInvoiceId = null;
let contactsRoot = null;
let pastShowsRoot = null;
let statsRoot = null;
let itineraryRoot = null;
let wrappedRoot = null;

export function unmountAllIslands(){
  unmountShow();
  unmountShowsList();
  unmountHome();
  unmountTripMode();
  unmountTripDetail();
  unmountCalendar();
  unmountContentTab();
  unmountIdeaDetail();
  unmountNoteDetail();
  unmountNoteFolder();
  unmountSettings();
  unmountSearch();
  unmountFinance();
  unmountInvoices();
  unmountInvoiceDetail();
  unmountContacts();
  unmountPastShows();
  unmountStats();
  unmountItinerary();
  unmountWrapped();
}

function clearOthers(...keep){
  const all = {
    show: unmountShow,
    list: unmountShowsList,
    home: unmountHome,
    tripMode: unmountTripMode,
    tripDetail: unmountTripDetail,
    calendar: unmountCalendar,
    content: unmountContentTab,
    idea: unmountIdeaDetail,
    note: unmountNoteDetail,
    noteFolder: unmountNoteFolder,
    settings: unmountSettings,
    search: unmountSearch,
    finance: unmountFinance,
    invoices: unmountInvoices,
    invoice: unmountInvoiceDetail,
    contacts: unmountContacts,
    pastShows: unmountPastShows,
    stats: unmountStats,
    itinerary: unmountItinerary,
    wrapped: unmountWrapped,
  };
  Object.keys(all).forEach(k => {
    if(!keep.includes(k)) all[k]();
  });
}

export function mountShow(showId, el){
  if(!el || showId == null) return;
  clearOthers('show');
  if(showRoot && mountedShowId === showId){ notifyStore(); return; }
  if(showRoot){ try{ showRoot.unmount(); }catch(_){} showRoot = null; }
  mountedShowId = showId;
  showRoot = createRoot(el);
  paint(showRoot, <ShowPage showId={showId} />);
}
export function unmountShow(){ if(showRoot){ try{ showRoot.unmount(); }catch(_){} } showRoot = null; mountedShowId = null; }
export function isShowMounted(){ return !!showRoot; }
export function getMountedShowId(){ return mountedShowId; }
export function refreshShow(){ notifyStore(); }

export function mountShowsList(el){
  if(!el) return;
  clearOthers('list');
  if(listRoot){ notifyStore(); return; }
  listRoot = createRoot(el);
  paint(listRoot, <ShowsListPage />);
}
export function unmountShowsList(){ if(listRoot){ try{ listRoot.unmount(); }catch(_){} } listRoot = null; }
export function isShowsListMounted(){ return !!listRoot; }
export function refreshShowsList(){ notifyStore(); }

export function mountHome(el){
  if(!el) return;
  clearOthers('home');
  if(homeRoot){ notifyStore(); return; }
  homeRoot = createRoot(el);
  paint(homeRoot, <HomePage />);
}
export function unmountHome(){ if(homeRoot){ try{ homeRoot.unmount(); }catch(_){} } homeRoot = null; }
export function isHomeMounted(){ return !!homeRoot; }
export function refreshHome(){ notifyStore(); }

export function mountTripMode(el){
  if(!el) return;
  clearOthers('tripMode');
  if(tripRoot){ notifyStore(); return; }
  tripRoot = createRoot(el);
  paint(tripRoot, <TripModePage />);
}
export function unmountTripMode(){ if(tripRoot){ try{ tripRoot.unmount(); }catch(_){} } tripRoot = null; }
export function isTripModeMounted(){ return !!tripRoot; }
export function refreshTripMode(){ notifyStore(); }

export function mountTripDetail(tripId, el){
  if(!el || tripId == null) return;
  clearOthers('tripDetail');
  if(tripDetailRoot && mountedTripId === tripId){ notifyStore(); return; }
  if(tripDetailRoot){ try{ tripDetailRoot.unmount(); }catch(_){} tripDetailRoot = null; }
  mountedTripId = tripId;
  tripDetailRoot = createRoot(el);
  paint(tripDetailRoot, <TripDetailPage tripId={tripId} />);
}
export function unmountTripDetail(){ if(tripDetailRoot){ try{ tripDetailRoot.unmount(); }catch(_){} } tripDetailRoot = null; mountedTripId = null; }
export function isTripDetailMounted(){ return !!tripDetailRoot; }
export function getMountedTripId(){ return mountedTripId; }
export function refreshTripDetail(){ notifyStore(); }

export function mountCalendar(el){
  if(!el) return;
  clearOthers('calendar');
  if(calendarRoot){ notifyStore(); return; }
  calendarRoot = createRoot(el);
  paint(calendarRoot, <CalendarPage />);
}
export function unmountCalendar(){ if(calendarRoot){ try{ calendarRoot.unmount(); }catch(_){} } calendarRoot = null; }
export function isCalendarMounted(){ return !!calendarRoot; }
export function refreshCalendar(){ notifyStore(); }

export function mountContentTab(el){
  if(!el) return;
  clearOthers('content');
  if(contentRoot){ notifyStore(); return; }
  contentRoot = createRoot(el);
  paint(contentRoot, <ContentTabPage />);
}
export function unmountContentTab(){
  if(contentRoot){ try{ contentRoot.unmount(); }catch(_){} }
  contentRoot = null;
  call('deselectIdea');
}
export function isContentTabMounted(){ return !!contentRoot; }
export function refreshContentTab(){ notifyStore(); }

export function mountIdeaDetail(ideaId, el){
  if(!el || ideaId == null) return;
  clearOthers('idea');
  if(ideaRoot && mountedIdeaId === ideaId){ notifyStore(); return; }
  if(ideaRoot){ try{ ideaRoot.unmount(); }catch(_){} ideaRoot = null; }
  mountedIdeaId = ideaId;
  ideaRoot = createRoot(el);
  paint(ideaRoot, <IdeaDetailPage ideaId={ideaId} />);
}
export function unmountIdeaDetail(){ if(ideaRoot){ try{ ideaRoot.unmount(); }catch(_){} } ideaRoot = null; mountedIdeaId = null; }
export function isIdeaDetailMounted(){ return !!ideaRoot; }
export function getMountedIdeaId(){ return mountedIdeaId; }
export function refreshIdeaDetail(){ notifyStore(); }

export function mountNoteDetail(noteId, el){
  if(!el || noteId == null) return;
  clearOthers('note');
  if(noteRoot && mountedNoteId === noteId){ notifyStore(); return; }
  if(noteRoot){ try{ noteRoot.unmount(); }catch(_){} noteRoot = null; }
  mountedNoteId = noteId;
  noteRoot = createRoot(el);
  paint(noteRoot, <NoteDetailPage noteId={noteId} />);
}
export function unmountNoteDetail(){ if(noteRoot){ try{ noteRoot.unmount(); }catch(_){} } noteRoot = null; mountedNoteId = null; }
export function isNoteDetailMounted(){ return !!noteRoot; }
export function getMountedNoteId(){ return mountedNoteId; }
export function refreshNoteDetail(){ notifyStore(); }

export function mountNoteFolder(folderId, el){
  if(!el || folderId == null) return;
  clearOthers('noteFolder');
  if(noteFolderRoot && mountedNoteFolderId === folderId){ notifyStore(); return; }
  if(noteFolderRoot){ try{ noteFolderRoot.unmount(); }catch(_){} noteFolderRoot = null; }
  mountedNoteFolderId = folderId;
  noteFolderRoot = createRoot(el);
  paint(noteFolderRoot, <NoteFolderPage folderId={folderId} />);
}
export function unmountNoteFolder(){ if(noteFolderRoot){ try{ noteFolderRoot.unmount(); }catch(_){} } noteFolderRoot = null; mountedNoteFolderId = null; }
export function isNoteFolderMounted(){ return !!noteFolderRoot; }
export function getMountedNoteFolderId(){ return mountedNoteFolderId; }
export function refreshNoteFolder(){ notifyStore(); }

export function mountSettings(el){
  if(!el) return;
  clearOthers('settings');
  if(settingsRoot){ notifyStore(); return; }
  settingsRoot = createRoot(el);
  paint(settingsRoot, <SettingsPage />);
}
export function unmountSettings(){ if(settingsRoot){ try{ settingsRoot.unmount(); }catch(_){} } settingsRoot = null; }
export function isSettingsMounted(){ return !!settingsRoot; }
export function refreshSettings(){ notifyStore(); }

export function mountSearch(el){
  if(!el) return;
  clearOthers('search');
  if(searchRoot){ notifyStore(); return; }
  searchRoot = createRoot(el);
  paint(searchRoot, <SearchPage />);
}
export function unmountSearch(){ if(searchRoot){ try{ searchRoot.unmount(); }catch(_){} } searchRoot = null; }
export function isSearchMounted(){ return !!searchRoot; }
export function refreshSearch(){ notifyStore(); }

export function mountFinance(el){
  if(!el) return;
  clearOthers('finance');
  if(financeRoot){ notifyStore(); return; }
  financeRoot = createRoot(el);
  paint(financeRoot, <FinancePage />);
}
export function unmountFinance(){ if(financeRoot){ try{ financeRoot.unmount(); }catch(_){} } financeRoot = null; }
export function isFinanceMounted(){ return !!financeRoot; }
export function refreshFinance(){ notifyStore(); }

export function mountInvoices(el){
  if(!el) return;
  clearOthers('invoices');
  if(invoicesRoot){ notifyStore(); return; }
  invoicesRoot = createRoot(el);
  paint(invoicesRoot, <InvoicesPage />);
}
export function unmountInvoices(){ if(invoicesRoot){ try{ invoicesRoot.unmount(); }catch(_){} } invoicesRoot = null; }
export function isInvoicesMounted(){ return !!invoicesRoot; }
export function refreshInvoices(){ notifyStore(); }

export function mountInvoiceDetail(invoiceId, el){
  if(!el || invoiceId == null) return;
  clearOthers('invoice');
  if(invoiceRoot && mountedInvoiceId === invoiceId){ notifyStore(); return; }
  if(invoiceRoot){ try{ invoiceRoot.unmount(); }catch(_){} invoiceRoot = null; }
  mountedInvoiceId = invoiceId;
  invoiceRoot = createRoot(el);
  paint(invoiceRoot, <InvoiceDetailPage invoiceId={invoiceId} />);
}
export function unmountInvoiceDetail(){ if(invoiceRoot){ try{ invoiceRoot.unmount(); }catch(_){} } invoiceRoot = null; mountedInvoiceId = null; }
export function isInvoiceDetailMounted(){ return !!invoiceRoot; }
export function getMountedInvoiceId(){ return mountedInvoiceId; }
export function refreshInvoiceDetail(){ notifyStore(); }

export function mountContacts(el){
  if(!el) return;
  clearOthers('contacts');
  if(contactsRoot){ notifyStore(); return; }
  contactsRoot = createRoot(el);
  paint(contactsRoot, <ContactsPage />);
}
export function unmountContacts(){ if(contactsRoot){ try{ contactsRoot.unmount(); }catch(_){} } contactsRoot = null; }
export function isContactsMounted(){ return !!contactsRoot; }
export function refreshContacts(){ notifyStore(); }

export function mountPastShows(el){
  if(!el) return;
  clearOthers('pastShows');
  if(pastShowsRoot){ notifyStore(); return; }
  pastShowsRoot = createRoot(el);
  paint(pastShowsRoot, <PastShowsPage />);
}
export function unmountPastShows(){ if(pastShowsRoot){ try{ pastShowsRoot.unmount(); }catch(_){} } pastShowsRoot = null; }
export function isPastShowsMounted(){ return !!pastShowsRoot; }
export function refreshPastShows(){ notifyStore(); }

export function mountStats(el){
  if(!el) return;
  clearOthers('stats');
  if(statsRoot){ notifyStore(); return; }
  statsRoot = createRoot(el);
  paint(statsRoot, <StatsPage />);
}
export function unmountStats(){ if(statsRoot){ try{ statsRoot.unmount(); }catch(_){} } statsRoot = null; }
export function isStatsMounted(){ return !!statsRoot; }
export function refreshStats(){ notifyStore(); }

export function mountItinerary(el){
  if(!el) return;
  clearOthers('itinerary');
  if(itineraryRoot){ notifyStore(); return; }
  itineraryRoot = createRoot(el);
  paint(itineraryRoot, <ItineraryPage />);
}
export function unmountItinerary(){ if(itineraryRoot){ try{ itineraryRoot.unmount(); }catch(_){} } itineraryRoot = null; }
export function isItineraryMounted(){ return !!itineraryRoot; }
export function refreshItinerary(){ notifyStore(); }

export function mountWrapped(el){
  if(!el) return;
  clearOthers('wrapped');
  if(wrappedRoot){ notifyStore(); return; }
  wrappedRoot = createRoot(el);
  paint(wrappedRoot, <WrappedPage />);
}
export function unmountWrapped(){ if(wrappedRoot){ try{ wrappedRoot.unmount(); }catch(_){} } wrappedRoot = null; }
export function isWrappedMounted(){ return !!wrappedRoot; }
export function refreshWrapped(){ notifyStore(); }

/* ---------- Persistent chrome (nav, fab, toast, lock, auth, sheets) ---------- */
let shellMounted = false;
let navRoot = null;
let fabRoot = null;
let toastRoot = null;
let lockRoot = null;
let authRoot = null;
let overlaysRoot = null;
let toastTimer = null;
let sheetKey = 0;

export function mountShell(){
  if(shellMounted) return;
  const nav = document.getElementById('nav');
  const fab = document.getElementById('fab');
  const toast = document.getElementById('toast');
  const lock = document.getElementById('lock');
  const auth = document.getElementById('authSheet');
  const app = document.getElementById('app');
  if(!nav || !fab || !toast || !lock || !auth || !app) return;

  navRoot = createRoot(nav);
  fabRoot = createRoot(fab);
  toastRoot = createRoot(toast);
  lockRoot = createRoot(lock);
  authRoot = createRoot(auth);
  const holder = document.createElement('div');
  holder.id = 'react-shell-overlays';
  holder.style.display = 'contents';
  app.appendChild(holder);
  overlaysRoot = createRoot(holder);

  paint(navRoot, <NavBar />);
  paint(fabRoot, <FabInner />);
  paint(toastRoot, <ToastHost />);
  paint(lockRoot, <LockHost />);
  paint(authRoot, <AuthHost />);
  paint(overlaysRoot, <ShellOverlays />);
  shellMounted = true;
}

export function isShellMounted(){ return shellMounted; }
export function refreshShell(){ notifyStore(); }

export function chromeToast(msg, icon = 'check'){
  clearTimeout(toastTimer);
  setToastState({ msg: String(msg || ''), icon: icon || 'check', on: true });
  if(typeof call === 'function'){ /* haptic via toast caller */ }
  toastTimer = setTimeout(() => setToastState({ on: false }), 2100);
}

export function chromeOpenSheet(title, bodyHTML, opts = {}){
  sheetKey += 1;
  setSheetState({
    key: sheetKey,
    title: title || '',
    bodyHTML: bodyHTML || '',
    bodyKind: null,
    bodyProps: null,
    opts: opts || {},
    open: true,
    closing: false,
  });
}

export function chromeOpenSheetReact(title, bodyKind, bodyProps = {}, opts = {}){
  sheetKey += 1;
  setSheetState({
    key: sheetKey,
    title: title || '',
    bodyHTML: '',
    bodyKind: bodyKind || null,
    bodyProps: bodyProps || {},
    opts: opts || {},
    open: true,
    closing: false,
  });
}

export function chromeCloseSheet(instant, onDone){
  const finish = () => {
    setSheetState(null);
    if(typeof window !== 'undefined') window.sheetEl = null;
    if(typeof onDone === 'function') onDone();
  };
  if(!sheetState || !sheetState.open){
    finish();
    return;
  }
  if(instant){
    finish();
    return;
  }
  setSheetState(Object.assign({}, sheetState, { closing: true }));
  setTimeout(finish, 280);
}

export function chromeOpenViewer(src){
  setViewerState({ open: true, src: src || '' });
}

export function chromeCloseViewer(){
  setViewerState({ open: false, src: '' });
}

export function chromeShowLock(state){
  setLockState(Object.assign({
    open: true,
    err: false,
    pinLen: 0,
  }, state || {}));
}

export function chromeUpdateLock(partial){
  setLockState(partial || {});
}

export function chromeHideLock(){
  setLockState({ open: false, pinLen: 0, err: false, purpose: null });
}

export function chromeShowAuth(partial){
  setAuthState(Object.assign({ open: true }, partial || {}));
}

export function chromeHideAuth(){
  setAuthState({ open: false, msg: '', msgKind: '', sending: false });
}

export function chromeSetAuthMsg(msg, isErr){
  setAuthState({
    msg: msg || '',
    msgKind: msg ? (isErr ? 'err' : 'ok') : '',
  });
}
