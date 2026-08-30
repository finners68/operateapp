import { createContext, useContext, useSyncExternalStore } from 'react';
import { getStore, subscribeStore } from './operate.js';

const StoreSeqContext = createContext(0);

export function StoreProvider({ children }){
  const seq = useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
  return (
    <StoreSeqContext.Provider value={seq}>
      {children}
    </StoreSeqContext.Provider>
  );
}

export function useStoreSeq(){
  return useContext(StoreSeqContext);
}

export function useStore(){
  useStoreSeq();
  return getStore();
}

/** Drop-in for pages that only need a re-render tick when store mutates. */
export function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}
