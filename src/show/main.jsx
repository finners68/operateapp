import { createRoot } from 'react-dom/client';
import ShowPage from './ShowPage.jsx';
import ShowsListPage from '../shows-list/ShowsListPage.jsx';
import { notifyStore } from './bridge.js';

let showRoot = null;
let mountedShowId = null;
let listRoot = null;

export function mountShow(showId, el){
  if(!el || showId == null) return;
  unmountShowsList();
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
  showRoot.render(<ShowPage showId={showId} />);
}

export function unmountShow(){
  if(showRoot){
    try{ showRoot.unmount(); }catch(_){}
  }
  showRoot = null;
  mountedShowId = null;
}

export function isShowMounted(){
  return !!showRoot;
}

export function getMountedShowId(){
  return mountedShowId;
}

export function refreshShow(){
  notifyStore();
}

export function mountShowsList(el){
  if(!el) return;
  unmountShow();
  if(listRoot){
    notifyStore();
    return;
  }
  listRoot = createRoot(el);
  listRoot.render(<ShowsListPage />);
}

export function unmountShowsList(){
  if(listRoot){
    try{ listRoot.unmount(); }catch(_){}
  }
  listRoot = null;
}

export function isShowsListMounted(){
  return !!listRoot;
}

export function refreshShowsList(){
  notifyStore();
}
