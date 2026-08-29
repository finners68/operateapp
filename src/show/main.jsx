import { createRoot } from 'react-dom/client';
import ShowPage from './ShowPage.jsx';
import { notifyStore } from './bridge.js';

let root = null;
let mountedShowId = null;

export function mountShow(showId, el){
  if(!el || showId == null) return;
  if(root && mountedShowId === showId){
    notifyStore();
    return;
  }
  if(root){
    try{ root.unmount(); }catch(_){}
    root = null;
  }
  mountedShowId = showId;
  root = createRoot(el);
  root.render(<ShowPage showId={showId} />);
}

export function unmountShow(){
  if(root){
    try{ root.unmount(); }catch(_){}
  }
  root = null;
  mountedShowId = null;
}

export function isShowMounted(){
  return !!root;
}

export function getMountedShowId(){
  return mountedShowId;
}

export function refreshShow(){
  notifyStore();
}
