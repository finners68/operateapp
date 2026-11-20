/* Appearance: dark (default), light, or match system. Local only — not cloud sync. */
const THEME_PREF_KEY = 'operate.appearance';
function getOperateThemePreference() {
    try {
        const raw = localStorage.getItem(THEME_PREF_KEY);
        if (raw === 'light' || raw === 'dark' || raw === 'system')
            return raw;
    }
    catch (_) { /* private mode */ }
    return 'dark';
}
function resolveOperateTheme(pref) {
    const p = pref || getOperateThemePreference();
    if (p === 'light')
        return 'light';
    if (p === 'dark')
        return 'dark';
    try {
        if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
    }
    catch (_) { }
    return 'dark';
}
function applyOperateTheme(pref) {
    if (typeof document === 'undefined')
        return;
    const resolved = resolveOperateTheme(pref);
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
        meta.setAttribute('content', resolved === 'light' ? '#F7F7FA' : '#0a0a0c');
}
function setOperateThemePreference(pref) {
    try {
        localStorage.setItem(THEME_PREF_KEY, pref);
    }
    catch (_) { }
    applyOperateTheme(pref);
    if (typeof notifyStore === 'function')
        notifyStore();
}
function operateThemeLabel(pref) {
    const p = pref || getOperateThemePreference();
    if (p === 'light')
        return 'Light';
    if (p === 'dark')
        return 'Dark';
    return 'System';
}
let themeMedia = null;
function bindOperateThemeMedia() {
    if (themeMedia || typeof matchMedia !== 'function')
        return;
    themeMedia = matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
        if (getOperateThemePreference() === 'system')
            applyOperateTheme('system');
    };
    try {
        if (typeof themeMedia.addEventListener === 'function') {
            themeMedia.addEventListener('change', onChange);
        }
        else if (typeof themeMedia.addListener === 'function') {
            themeMedia.addListener(onChange);
        }
    }
    catch (_) { }
}
applyOperateTheme();
bindOperateThemeMedia();
window.getOperateThemePreference = getOperateThemePreference;
window.setOperateThemePreference = setOperateThemePreference;
window.applyOperateTheme = applyOperateTheme;
window.resolveOperateTheme = resolveOperateTheme;
window.operateThemeLabel = operateThemeLabel;
