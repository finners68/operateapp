import { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { StoreProvider } from '../api/StoreProvider.jsx';
import { notifyStore } from '../api/operate.js';
import {
  setNavigate, setAppMounted, locationToLegacy, bootstrapHashFromNav,
} from './nav.js';
import { appRoutes } from './routes.jsx';
import { NavBar, FabInner, ToastHost, LockHost, AuthHost, ShellOverlays } from '../shell/AppShell.jsx';

function LocationSync(){
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    setNavigate((to, opts = {}) => {
      if(typeof to === 'number'){
        navigate(to);
        return;
      }
      navigate(to, { replace: !!opts.replace });
    });
    return () => setNavigate(null);
  }, [navigate]);

  useEffect(() => {
    const { tab, overlay } = locationToLegacy(location.pathname);
    if(typeof window !== 'undefined'){
      if(window.store && tab) window.store.tab = tab;
      window.overlay = overlay;
      if(typeof window.saveNavState === 'function') window.saveNavState();
      if(typeof window.setFab === 'function') window.setFab();
      if(typeof window.syncScreenChrome === 'function') window.syncScreenChrome();
      notifyStore();
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}

function ViewOutlet(){
  const location = useLocation();
  useEffect(() => {
    const view = document.getElementById('view');
    if(view) view.classList.add('quiet-paint');
    const screen = document.getElementById('screen');
    if(screen) screen.scrollTop = 0;
  }, [location.pathname]);
  return <Outlet />;
}

function ChromePortals(){
  const nav = document.getElementById('nav');
  const fab = document.getElementById('fab');
  const toast = document.getElementById('toast');
  const lock = document.getElementById('lock');
  const auth = document.getElementById('authSheet');
  const app = document.getElementById('app');
  const view = document.getElementById('view');
  if(view && !view.dataset.reactOutlet){
    view.innerHTML = '';
    view.dataset.reactOutlet = '1';
  }
  /* boot() paints a vanilla nav before React loads — clear so we don't get double tabs. */
  if(nav && !nav.dataset.reactNav){
    nav.innerHTML = '';
    nav.dataset.reactNav = '1';
  }
  if(fab && !fab.dataset.reactFab){
    fab.innerHTML = '';
    fab.dataset.reactFab = '1';
  }
  if(toast && !toast.dataset.reactToast){
    toast.innerHTML = '';
    toast.dataset.reactToast = '1';
  }

  let overlaysHost = document.getElementById('react-shell-overlays');
  if(app && !overlaysHost){
    overlaysHost = document.createElement('div');
    overlaysHost.id = 'react-shell-overlays';
    overlaysHost.style.display = 'contents';
    app.appendChild(overlaysHost);
  }

  return (
    <>
      {nav ? createPortal(<NavBar />, nav) : null}
      {fab ? createPortal(<FabInner />, fab) : null}
      {toast ? createPortal(<ToastHost />, toast) : null}
      {lock ? createPortal(<LockHost />, lock) : null}
      {auth ? createPortal(<AuthHost />, auth) : null}
      {overlaysHost ? createPortal(<ShellOverlays />, overlaysHost) : null}
      {view ? createPortal(
        <>
          <LocationSync />
          <Routes>
            <Route element={<ViewOutlet />}>
              {appRoutes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Route>
          </Routes>
        </>,
        view
      ) : null}
    </>
  );
}

export default function App(){
  useEffect(() => {
    setAppMounted(true);
    return () => setAppMounted(false);
  }, []);

  return (
    <StoreProvider>
      <HashRouter>
        <ChromePortals />
      </HashRouter>
    </StoreProvider>
  );
}

export function prepareAppBoot(){
  bootstrapHashFromNav();
}
