import { useSyncExternalStore, useEffect, useRef, useState, useCallback } from 'react';
import { call, getStore, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function reduceMotion(){
  try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; }
}

const WR_CSS = `
.wr-root{position:fixed;inset:0;z-index:2000;background:#0c0a18;overflow:hidden;
  font-family:var(--font,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);color:#f4f2fb;
  -webkit-tap-highlight-color:transparent;user-select:none}
.wr-stage{position:absolute;inset:0;pointer-events:none}
.wr-slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:64px 30px 90px;opacity:0;visibility:hidden;
  background:radial-gradient(120% 90% at 78% 8%,rgba(139,125,255,.28),transparent 60%),linear-gradient(158deg,var(--g1),var(--g2));
  transition:opacity .5s ease}
.wr-slide.on{opacity:1;visibility:visible}
.wr-slide::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;mix-blend-mode:overlay;
  background-image:radial-gradient(rgba(255,255,255,.10) 1px,transparent 1px);background-size:4px 4px}
.wr-slide .r{opacity:0;transform:translateY(22px);filter:blur(6px)}
.wr-slide.on .r{animation:wrIn .72s cubic-bezier(.2,.7,.2,1) forwards}
.wr-slide.on .r:nth-child(2){animation-delay:.10s}
.wr-slide.on .r:nth-child(3){animation-delay:.20s}
.wr-slide.on .r:nth-child(4){animation-delay:.30s}
.wr-slide.on .r:nth-child(5){animation-delay:.40s}
@keyframes wrIn{to{opacity:1;transform:none;filter:blur(0)}}
.wr-eyebrow{font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#b9b2e0;margin-bottom:12px}
.wr-year{font-size:clamp(96px,30vw,168px);font-weight:900;letter-spacing:-.05em;line-height:.86;
  background:linear-gradient(120deg,#e7e1ff,#8b7dff);-webkit-background-clip:text;background-clip:text;color:transparent}
.wr-name{margin-top:16px;font-size:24px;font-weight:800;color:#efeaff}
.wr-lede{margin-top:16px;font-size:17px;font-weight:600;color:#c3bce6;max-width:300px}
.wr-lede b{color:#fff}
.wr-big{font-size:clamp(84px,26vw,148px);font-weight:900;letter-spacing:-.045em;line-height:.9;
  font-variant-numeric:tabular-nums;text-shadow:0 8px 40px rgba(139,125,255,.35)}
.wr-word{margin-top:14px;font-size:15px;font-weight:800;letter-spacing:.4em;color:#a99dff;padding-left:.4em}
.wr-chip{margin-top:18px;font-size:13px;font-weight:700;color:#dcd6f6;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 14px;backdrop-filter:blur(6px)}
.wr-flags{margin-top:26px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px 12px;max-width:340px;font-size:32px;line-height:1}
.wr-hms{display:flex;flex-direction:column;gap:22px;margin-top:14px}
.wr-hms>div{display:flex;flex-direction:column;align-items:center}
.wr-hms b{font-size:clamp(54px,16vw,88px);font-weight:900;letter-spacing:-.04em;line-height:.9;font-variant-numeric:tabular-nums;text-shadow:0 8px 40px rgba(139,125,255,.35)}
.wr-hms span{margin-top:3px;font-size:12px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:#a99dff}
.wr-hl{display:flex;flex-direction:column;gap:14px;margin-top:22px;width:100%;max-width:360px}
.wr-hl>div{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:15px 18px;text-align:left;display:flex;flex-direction:column;backdrop-filter:blur(6px)}
.wr-hl span{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a99dff}
.wr-hl b{font-size:23px;font-weight:850;margin-top:5px}
.wr-hl i{font-style:normal;font-size:13px;color:#b3aecb;margin-top:3px;font-weight:600}
.wr-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 20px;margin-top:24px;width:100%;max-width:380px}
.wr-grid>div{display:flex;flex-direction:column;align-items:flex-start;text-align:left}
.wr-grid b{font-size:32px;font-weight:900;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.wr-grid span{margin-top:4px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#a99dff}
.wr-flags span{opacity:0;transform:scale(.4);animation:wrPop .5s cubic-bezier(.2,1.5,.4,1) forwards;animation-delay:calc(.5s + var(--d))}
@keyframes wrPop{to{opacity:1;transform:none}}
.wr-map{position:absolute;inset:0;width:100%;height:100%}
.wr-map-fade{position:absolute;inset:0;background:linear-gradient(to top,rgba(12,10,24,.95) 6%,rgba(12,10,24,.15) 46%,rgba(12,10,24,.55) 100%);pointer-events:none}
.wr-map-copy{position:absolute;left:0;right:0;bottom:96px;padding:0 30px;text-align:center}
.wr-map-copy .wr-big{font-size:clamp(64px,20vw,120px)}
.wr-summary{display:grid;grid-template-columns:1fr 1fr;gap:16px 26px;margin:8px 0 8px}
.wr-summary div{display:flex;flex-direction:column}
.wr-summary b{font-size:40px;font-weight:900;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.wr-summary span{margin-top:5px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b0a9d6}
.wr-share{position:relative;z-index:7;pointer-events:auto;margin-top:30px;display:inline-flex;align-items:center;gap:9px;font-size:16px;font-weight:800;
  color:#1b1533;background:linear-gradient(120deg,#d7cfff,#a99dff);border:none;border-radius:14px;padding:15px 26px;
  box-shadow:0 12px 34px rgba(139,125,255,.4);cursor:pointer}
.wr-share:active{transform:scale(.97)}
.wr-brand{position:absolute;bottom:26px;left:0;right:0;letter-spacing:.34em;text-transform:lowercase;font-weight:800;color:#6b6690;font-size:13px}
.wr-progress{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);left:14px;right:14px;z-index:6;display:flex;gap:5px}
.wr-bar{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.24);overflow:hidden}
.wr-bar i{display:block;height:100%;width:0;background:#fff;border-radius:3px}
.wr-bar.done i{width:100%}
.wr-bar.active i{animation:wrFill linear forwards}
@keyframes wrFill{from{width:0}to{width:100%}}
.wr-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 24px);right:16px;z-index:8;width:38px;height:38px;
  display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;color:#fff;
  background:rgba(0,0,0,.28);backdrop-filter:blur(6px);cursor:pointer}
.wr-tap{position:absolute;top:0;bottom:0;z-index:5}
.wr-prev{left:0;width:32%}
.wr-next{left:32%;right:0}
@media(prefers-reduced-motion:reduce){ .wr-slide .r,.wr-flags span{animation:none!important;opacity:1;transform:none;filter:none} }
`;

function CountUp({ value, suffix = '', active }){
  const [n, setN] = useState(0);
  useEffect(() => {
    if(!active) return;
    const to = parseInt(value, 10) || 0;
    if(reduceMotion() || to <= 0){ setN(to); return; }
    const dur = 1200;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * e));
      if(p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, active, suffix]);
  return <>{n.toLocaleString()}{suffix}</>;
}

function Recap({ label, value }){
  return <div><b>{value}</b><span>{label}</span></div>;
}

export default function WrappedPage(){
  useStoreTick();
  const y = call('computeYearStats') || {};
  const name = call('wrappedName') || '';
  const EARTH = 40075;
  const kmScale = y.km >= EARTH
    ? `${(y.km / EARTH).toFixed(1)}× around the planet`
    : y.km > 0
      ? `${Math.max(1, Math.round(y.km / EARTH * 100))}% of the way around the planet`
      : '';
  const flags = (y.flags || []).slice(0, 18);
  const hasData = y.shows > 0 || y.km > 0 || y.countries > 0;
  const totMin = y.stageMins || 0;
  const hH = Math.round(totMin / 60);
  const hM = totMin;
  const hS = totMin * 60;

  const slidesMeta = hasData
    ? [5200, 5200, 7200, 5200, 6200, 7000, 8000, 30000]
    : [5200];
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const rootRef = useRef(null);
  const n = slidesMeta.length;

  const go = useCallback((dir) => {
    setIdx(cur => {
      const next = cur + dir;
      if(next < 0) return 0;
      if(next >= n) return cur;
      return next;
    });
  }, [n]);

  useEffect(() => {
    if(timerRef.current) clearTimeout(timerRef.current);
    if(idx >= n - 1) return undefined;
    const dur = Math.max(2600, slidesMeta[idx] || 5200);
    timerRef.current = setTimeout(() => go(1), dur);
    return () => { if(timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, n, go, slidesMeta]);

  useEffect(() => {
    if(!hasData || idx !== 2) return;
    const t = setTimeout(() => {
      call('prepareWrappedMap');
      call('wrDrawMapAnimated');
    }, 50);
    return () => clearTimeout(t);
  }, [idx, hasData]);

  if(!hasData){
    return (
      <>
        <style>{WR_CSS}</style>
        <div className="wr-root" ref={rootRef}>
          <button type="button" className="wr-x" onClick={() => call('back')}><Icon name="x" size={20} /></button>
          <section className="wr-slide on" style={{ '--g1': '#241a45', '--g2': '#141127' }}>
            <div className="wr-year">{y.year}</div>
            <div className="wr-lede">Add a few shows and flights — your year in review builds itself.</div>
          </section>
        </div>
      </>
    );
  }

  const firstName = name ? name.split(' ')[0] : 'legend';

  return (
    <>
      <style>{WR_CSS}</style>
      <div className="wr-root" id="wrapped-root" ref={rootRef}>
        <div className="wr-progress">
          {slidesMeta.map((dur, i) => (
            <div
              key={i}
              className={`wr-bar${i < idx ? ' done' : ''}${i === idx && i < n - 1 ? ' active' : ''}${i === idx && i === n - 1 ? ' done' : ''}`}
            >
              <i style={i === idx && i < n - 1 && !reduceMotion()
                ? { animation: `wrFill ${Math.max(2600, dur)}ms linear forwards` }
                : undefined}
              />
            </div>
          ))}
        </div>
        <button type="button" className="wr-x" onClick={() => call('back')}><Icon name="x" size={20} /></button>
        <div className="wr-stage">
          <section className={`wr-slide${idx === 0 ? ' on' : ''}`} data-i="0" style={{ '--g1': '#2c2060', '--g2': '#161230' }}>
            <div className="wr-eyebrow r" style={{ color: 'var(--accent-2)' }}>Operate · Year in review</div>
            <div className="wr-year r">{y.year}</div>
            {name ? <div className="wr-name r">{name}</div> : null}
            <div className="wr-lede r">Let&apos;s rewind your year on the road.</div>
          </section>
          <section className={`wr-slide${idx === 1 ? ' on' : ''}`} data-i="1" style={{ '--g1': '#241a45', '--g2': '#181334' }}>
            <div className="wr-eyebrow r">You played</div>
            <div className="wr-big r"><CountUp value={y.shows} active={idx === 1} /></div>
            <div className="wr-word r">SHOWS</div>
            <div className="wr-lede r">across <b>{y.tours}</b> tour{y.tours === 1 ? '' : 's'} · <b>{y.daysOnRoad}</b> days on the road</div>
          </section>
          <section className={`wr-slide${idx === 2 ? ' on' : ''}`} data-i="2" style={{ '--g1': '#0f1f3d', '--g2': '#141230' }}>
            <canvas className="wr-map" id="wr-map" />
            <div className="wr-map-fade" />
            <div className="wr-map-copy">
              <div className="wr-eyebrow r">You flew</div>
              <div className="wr-big r"><CountUp value={y.km} suffix=" km" active={idx === 2} /></div>
              {kmScale ? <div className="wr-lede r">{kmScale}</div> : null}
              <div className="wr-chip r">
                {y.flights} flights · {y.airports} airports
                {y.longest?.from ? ` · longest ${y.longest.from}→${y.longest.to}` : ''}
              </div>
            </div>
          </section>
          <section className={`wr-slide${idx === 3 ? ' on' : ''}`} data-i="3" style={{ '--g1': '#3a1638', '--g2': '#1b1230' }}>
            <div className="wr-eyebrow r">You touched down in</div>
            <div className="wr-big r"><CountUp value={y.countries} active={idx === 3} /></div>
            <div className="wr-word r">COUNTRIES</div>
            <div className="wr-lede r"><b>{y.cities}</b> different cities</div>
            <div className="wr-flags r">
              {flags.map((f, i) => <span key={i} style={{ '--d': `${i * 0.06}s` }}>{f}</span>)}
            </div>
          </section>
          <section className={`wr-slide${idx === 4 ? ' on' : ''}`} data-i="4" style={{ '--g1': '#20184a', '--g2': '#151228' }}>
            <div className="wr-eyebrow r">Behind the decks</div>
            <div className="wr-hms">
              <div className="r"><b><CountUp value={hH} active={idx === 4} /></b><span>hours</span></div>
              <div className="r"><b><CountUp value={hM} active={idx === 4} /></b><span>minutes</span></div>
              <div className="r"><b><CountUp value={hS} active={idx === 4} /></b><span>seconds</span></div>
            </div>
          </section>
          <section className={`wr-slide${idx === 5 ? ' on' : ''}`} data-i="5" style={{ '--g1': '#12233f', '--g2': '#141230' }}>
            <div className="wr-eyebrow r">Highlights</div>
            <div className="wr-hl r">
              {y.longest?.km > 0 ? (
                <div>
                  <span>Longest hop</span>
                  <b>{y.longest.from} → {y.longest.to}</b>
                  <i>{Math.round(y.longest.km).toLocaleString()} km</i>
                </div>
              ) : null}
              {y.topCity ? (
                <div>
                  <span>Home from home</span>
                  <b>{y.topCity}</b>
                  <i>{y.topCityN} show{y.topCityN === 1 ? '' : 's'}</i>
                </div>
              ) : null}
              {y.busiestMonth ? (
                <div>
                  <span>Busiest month</span>
                  <b>{y.busiestMonth}</b>
                  <i>{y.busiestMonthN} show{y.busiestMonthN === 1 ? '' : 's'}</i>
                </div>
              ) : null}
              <div><span>Nights away</span><b>{y.nights}</b><i>hotel stays</i></div>
            </div>
          </section>
          <section className={`wr-slide${idx === 6 ? ' on' : ''}`} data-i="6" style={{ '--g1': '#241a45', '--g2': '#141127' }}>
            <div className="wr-eyebrow r">{y.year} by the numbers</div>
            <div className="wr-grid r">
              <Recap label="Shows" value={y.shows} />
              <Recap label="Km flown" value={y.km > 0 ? y.km.toLocaleString() : '—'} />
              <Recap label="Flights" value={y.flights} />
              <Recap label="Airports" value={y.airports} />
              <Recap label="Countries" value={y.countries} />
              <Recap label="Cities" value={y.cities} />
              <Recap label="Hours played" value={y.stageHrs > 0 ? `${y.stageHrs}h` : '—'} />
              <Recap label="Nights away" value={y.nights} />
              <Recap label="Days on road" value={y.daysOnRoad} />
              <Recap label="Tours" value={y.tours} />
            </div>
          </section>
          <section className={`wr-slide${idx === 7 ? ' on' : ''}`} data-i="7" style={{ '--g1': '#2c2060', '--g2': '#120f26' }}>
            <div className="wr-eyebrow r" style={{ color: 'var(--accent-2)' }}>That&apos;s a wrap, {firstName}</div>
            <div className="wr-summary r">
              <div><b>{y.shows}</b><span>shows</span></div>
              <div><b>{y.km > 0 ? y.km.toLocaleString() : '—'}</b><span>km flown</span></div>
              <div><b>{y.countries}</b><span>countries</span></div>
              <div><b>{y.stageHrs > 0 ? `${y.stageHrs}h` : '—'}</b><span>played</span></div>
            </div>
            <button type="button" className="wr-share r" onClick={e => { e.stopPropagation(); call('shareWrapped'); }}>
              <Icon name="share" size={17} /> Share your year
            </button>
            <div className="wr-brand r">operate</div>
          </section>
        </div>
        <div className="wr-tap wr-prev" onClick={() => go(-1)} />
        <div className="wr-tap wr-next" onClick={() => go(1)} />
      </div>
    </>
  );
}
