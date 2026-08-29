import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ShowPage from './ShowPage.jsx';
import ShowsListPage from '../shows-list/ShowsListPage.jsx';
import HomePage from '../home/HomePage.jsx';
import TripModePage from '../trip/TripModePage.jsx';
import { notifyStore } from './bridge.js';

/* Paint in the same turn as the mount so tab switches never flash blank. */
function paint(root, node){
  flushSync(() => { root.render(node); });
}

let showRoot = null;
let mountedShowId = null;
let listRoot = null;
let homeRoot = null;
let tripRoot = null;

export function unmountAllIslands(){
  unmountShow();
  unmountShowsList();
  unmountHome();
  unmountTripMode();
}

export function mountShow(showId, el){
  if(!el || showId == null) return;
  unmountShowsList();
  unmountHome();
  unmountTripMode();
  if(showRoot && mountedShowId === showId){
    notifyStore();
    return;
  }
  if(showRoot){
    try{ showRoot.unmount(); }catch(_){}
    showRoot = null;
  }
  mountedShowId = showId;
  showRoot = createRoot(el);
  paint(showRoot, <ShowPage showId={showId} />);
}

export function unmountShow(){
  if(showRoot){
    try{ showRoot.unmount(); }catch(_){}
  }
  showRoot = null;
  mountedShowId = null;
}

export function isShowMounted(){ return !!showRoot; }
export function getMountedShowId(){ return mountedShowId; }
export function refreshShow(){ notifyStore(); }

export function mountShowsList(el){
  if(!el) return;
  unmountShow();
  unmountHome();
  unmountTripMode();
  if(listRoot){
    notifyStore();
    return;
  }
  listRoot = createRoot(el);
  paint(listRoot, <ShowsListPage />);
}

export function unmountShowsList(){
  if(listRoot){
    try{ listRoot.unmount(); }catch(_){}
  }
  listRoot = null;
}

export function isShowsListMounted(){ return !!listRoot; }
export function refreshShowsList(){ notifyStore(); }

export function mountHome(el){
  if(!el) return;
  unmountShow();
  unmountShowsList();
  unmountTripMode();
  if(homeRoot){
    notifyStore();
    return;
  }
  homeRoot = createRoot(el);
  paint(homeRoot, <HomePage />);
}

export function unmountHome(){
  if(homeRoot){
    try{ homeRoot.unmount(); }catch(_){}
  }
  homeRoot = null;
}

export function isHomeMounted(){ return !!homeRoot; }
export function refreshHome(){ notifyStore(); }

export function mountTripMode(el){
  if(!el) return;
  unmountShow();
  unmountShowsList();
  unmountHome();
  if(tripRoot){
    notifyStore();
    return;
  }
  tripRoot = createRoot(el);
  paint(tripRoot, <TripModePage />);
}

export function unmountTripMode(){
  if(tripRoot){
    try{ tripRoot.unmount(); }catch(_){}
  }
  tripRoot = null;
}

export function isTripModeMounted(){ return !!tripRoot; }
export function refreshTripMode(){ notifyStore(); }
