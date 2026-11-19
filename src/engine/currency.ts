/* Frontend currency helpers — defaults GBP/EUR, optional live ECB rates (Frankfurter). */

var DEFAULT_CURRENCY_CODES = ['GBP', 'EUR'];

var OPTIONAL_CURRENCY_CODES = [
  'USD', 'CHF', 'AUD', 'CAD', 'AED', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'ZAR', 'JPY', 'NZD', 'HKD'
];

/** Static fallbacks: 1 unit of code → GBP (when base is GBP). */
var STATIC_FX_IN_GBP = {
  GBP: 1,
  EUR: 0.86,
  USD: 0.79,
  CHF: 0.88,
  AUD: 0.52,
  CAD: 0.58,
  AED: 0.215,
  SGD: 0.59,
  SEK: 0.075,
  NOK: 0.075,
  DKK: 0.114,
  PLN: 0.20,
  CZK: 0.034,
  ZAR: 0.043,
  JPY: 0.0051,
  NZD: 0.48,
  HKD: 0.10
};

var FRANKFURTER_URL = 'https://api.frankfurter.app/latest';

function normalizeCurrencyCode(v){
  const s = String(v || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : '';
}

function defaultFxTable(base){
  const b = normalizeCurrencyCode(base) || 'GBP';
  const fx = {};
  const codes = DEFAULT_CURRENCY_CODES.concat(OPTIONAL_CURRENCY_CODES);
  const inGbp = STATIC_FX_IN_GBP;
  const gbpPerBase = (inGbp[b] || 1);
  codes.forEach(code => {
    const inGbpVal = inGbp[code];
    if(inGbpVal == null) return;
    fx[code] = b === code ? 1 : (inGbpVal / gbpPerBase);
  });
  if(fx[b] == null) fx[b] = 1;
  DEFAULT_CURRENCY_CODES.forEach(code => {
    if(fx[code] == null && inGbp[code] != null) fx[code] = b === code ? 1 : (inGbp[code] / gbpPerBase);
  });
  return fx;
}

function currencyCodes(settings){
  const s = settings || (typeof store !== 'undefined' && store.settings) || {};
  const fromFx = Object.keys(s.fx || {}).filter(c => /^[A-Z]{3}$/.test(c));
  const merged = DEFAULT_CURRENCY_CODES.concat(fromFx);
  const out = [];
  merged.forEach(c => { if(!out.includes(c)) out.push(c); });
  return out.sort();
}

function ensureCurrencySettings(settings){
  const s = settings || (typeof store !== 'undefined' ? store.settings : null);
  if(!s) return null;
  if(!s.fx || typeof s.fx !== 'object') s.fx = {};
  const base = normalizeCurrencyCode(s.baseCurrency) || (typeof homeCurrency === 'function' ? homeCurrency() : 'GBP');
  s.baseCurrency = base;
  const defaults = defaultFxTable(base);
  DEFAULT_CURRENCY_CODES.forEach(code => {
    if(s.fx[code] == null || !Number.isFinite(Number(s.fx[code]))) s.fx[code] = defaults[code] || (code === base ? 1 : defaults[code]);
  });
  if(s.fx[base] == null || !Number.isFinite(Number(s.fx[base]))) s.fx[base] = 1;
  Object.keys(s.fx).forEach(code => {
    const n = Number(s.fx[code]);
    if(!Number.isFinite(n) || n <= 0) delete s.fx[code];
  });
  s.fx[base] = 1;
  return s;
}

/** When the user picks a new base currency, rescale stored fx so totals stay consistent. */
function rebaseFxForNewBase(settings, newBase){
  const s = settings || store.settings;
  if(!s || !s.fx) return;
  const next = normalizeCurrencyCode(newBase);
  const prev = normalizeCurrencyCode(s.baseCurrency);
  if(!next || !prev || next === prev) return;
  const oldFx = { ...s.fx };
  const prevBaseRate = oldFx[prev];
  if(!prevBaseRate || !Number.isFinite(prevBaseRate)) {
    s.baseCurrency = next;
    ensureCurrencySettings(s);
    return;
  }
  const oneUnitNewInPrev = (oldFx[next] || prevBaseRate) / prevBaseRate;
  if(!oneUnitNewInPrev || !Number.isFinite(oneUnitNewInPrev) || oneUnitNewInPrev <= 0) {
    s.baseCurrency = next;
    ensureCurrencySettings(s);
    return;
  }
  const nextFx = {};
  nextFx[next] = 1;
  currencyCodes(s).forEach(code => {
    if(code === next) return;
    const oneUnitCodeInPrev = (oldFx[code] || 0) / prevBaseRate;
    if(!oneUnitCodeInPrev || !Number.isFinite(oneUnitCodeInPrev) || oneUnitCodeInPrev <= 0) return;
    nextFx[code] = oneUnitCodeInPrev / oneUnitNewInPrev;
  });
  DEFAULT_CURRENCY_CODES.forEach(code => {
    if(code !== next && nextFx[code] == null) {
      const d = defaultFxTable(next);
      if(d[code] != null) nextFx[code] = d[code];
    }
  });
  s.fx = nextFx;
  s.baseCurrency = next;
  ensureCurrencySettings(s);
}

function addAppCurrency(code){
  const c = normalizeCurrencyCode(code);
  if(!c) return { ok: false, error: 'Invalid code' };
  ensureCurrencySettings(store.settings);
  if(store.settings.fx[c] != null) return { ok: true, code: c };
  const defaults = defaultFxTable(store.settings.baseCurrency);
  store.settings.fx[c] = defaults[c] != null ? defaults[c] : 1;
  if(typeof persist === 'function') persist('settings');
  return { ok: true, code: c };
}

function removeAppCurrency(code){
  const c = normalizeCurrencyCode(code);
  if(!c) return { ok: false, error: 'Invalid code' };
  if(DEFAULT_CURRENCY_CODES.includes(c)) return { ok: false, error: 'GBP and EUR stay available as defaults.' };
  if(c === store.settings.baseCurrency) return { ok: false, error: 'Change base currency first.' };
  if(!store.settings.fx || store.settings.fx[c] == null) return { ok: true };
  delete store.settings.fx[c];
  if(typeof persist === 'function') persist('settings');
  return { ok: true, code: c };
}

function convertCurrency(amount, fromCur, toCur){
  const n = Number(amount);
  if(!Number.isFinite(n)) return 0;
  const from = normalizeCurrencyCode(fromCur);
  const to = normalizeCurrencyCode(toCur);
  if(!from || !to) return n;
  if(from === to) return n;
  if(typeof toBase !== 'function' || typeof fxRate !== 'function') return n;
  const inBase = toBase(n, from);
  const rateTo = fxRate(to);
  if(!rateTo) return inBase;
  return inBase / rateTo;
}

async function refreshLiveFxRates(opts){
  const settings = (opts && opts.settings) || store.settings;
  ensureCurrencySettings(settings);
  const base = settings.baseCurrency;
  const targets = currencyCodes(settings).filter(c => c !== base);
  if(!targets.length) return { ok: true, updated: 0, source: 'none' };

  const url = FRANKFURTER_URL + '?from=' + encodeURIComponent(base) + '&to=' + encodeURIComponent(targets.join(','));
  let data;
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('Rate feed unavailable');
    data = await res.json();
  }catch(e){
    return { ok: false, error: e.message || 'Could not load live rates', updated: 0 };
  }

  const rates = data && data.rates;
  if(!rates || typeof rates !== 'object') return { ok: false, error: 'Unexpected rate response', updated: 0 };

  let updated = 0;
  targets.forEach(code => {
    const oneBaseInCode = rates[code];
    if(!oneBaseInCode || !Number.isFinite(oneBaseInCode) || oneBaseInCode <= 0) return;
    /* 1 BASE = X CODE  →  1 CODE = 1/X BASE */
    settings.fx[code] = 1 / oneBaseInCode;
    updated++;
  });
  settings.fx[base] = 1;
  settings.fxUpdatedAt = Date.now();
  if(!(opts && opts.dryRun) && typeof persist === 'function') persist('settings');
  return { ok: true, updated, source: 'frankfurter', date: data.date || null };
}

function fxRatesUpdatedLabel(settings){
  const s = settings || store.settings;
  const t = s && s.fxUpdatedAt;
  if(!t) return '';
  if(typeof timeAgo === 'function') return 'Live rates · ' + timeAgo(t);
  return 'Live rates updated';
}

function pickableExtraCurrencies(settings?){
  const have = new Set(currencyCodes(settings));
  return OPTIONAL_CURRENCY_CODES.filter(c => !have.has(c));
}
