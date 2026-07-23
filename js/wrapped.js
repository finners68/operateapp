/* Year-in-review "wrapped" — an animated, story-format recap.
   Full-screen slides with segmented progress, tap-to-advance, count-up numbers,
   and a live flight-map slide that draws the year's actual routes as glowing
   arcs. Share exports a story-format PNG (canvas, no libs, CSP-safe). */

function wrappedName(){
  const n = store.settings && store.settings.artistName;
  return (n && n !== 'You') ? n : '';
}
const WR_REDUCE = () => { try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };

/* All flight legs (year-scoped, matching computeYearStats) with resolved
   coordinates — the data the map slide draws. */
function yearFlightLegs(){
  const allShows = sel.events();
  const yr = new Date().getFullYear();
  const inYr = d => (d||'').slice(0,4) === String(yr);
  const scoped = allShows.some(s=>inYr(s.date));
  const keep = d => scoped ? inYr(d) : true;
  const raw = [];
  store.events.forEach(e=>{
    if(e.kind==='travel' && (e.icon||'plane')==='plane' && (e.from||e.to) && keep(e.date)) raw.push([e.from,e.to]);
    if((e.kind||'show')==='show' && Array.isArray(e.flights) && keep(e.date)) e.flights.forEach(f=>{ if(f.from||f.to) raw.push([f.from,f.to]); });
  });
  const legs=[]; const nodes=new Map();
  raw.forEach(([f,t])=>{
    const a=airportLL(f), b=airportLL(t);
    if(a&&b){
      const km=haversineKm(a,b);
      legs.push({a,b,from:(f||'').toUpperCase(),to:(t||'').toUpperCase(),km});
      nodes.set((f||'').toUpperCase(),a); nodes.set((t||'').toUpperCase(),b);
    }
  });
  return { legs, nodes };
}

function viewWrapped(){
  const y = computeYearStats();
  const name = wrappedName();
  const EARTH = 40075;
  const kmScale = y.km>=EARTH ? `${(y.km/EARTH).toFixed(1)}× around the planet`
    : y.km>0 ? `${Math.max(1,Math.round(y.km/EARTH*100))}% of the way around the planet` : '';
  const longest = (y.longest && y.longest.km>0) ? `${y.longest.from} → ${y.longest.to} · ${Math.round(y.longest.km).toLocaleString()} km` : '';
  const flags = y.flags.slice(0,18);
  const hasData = y.shows>0 || y.km>0 || y.countries>0;
  const homeA = (store.settings&&store.settings.homeAirport||'').toUpperCase();

  if(!hasData){
    return `<div id="wrapped-root" class="wr-root">
      <button class="wr-x" onclick="back()">${ICON.x(20)}</button>
      <section class="wr-slide on" style="--g1:#241a45;--g2:#141127">
        <div class="wr-year">${y.year}</div>
        <div class="wr-lede">Add a few shows and flights — your year in review builds itself.</div>
      </section></div>`;
  }

  const totMin = y.stageMins||0;
  const hH = Math.round(totMin/60), hM = totMin, hS = totMin*60;
  const recap = (l,v)=>`<div><b>${v}</b><span>${l}</span></div>`;
  const slide = (i, vars, inner, dur) => `<section class="wr-slide" data-i="${i}" data-dur="${dur||5200}" style="--g1:${vars[0]};--g2:${vars[1]}">${inner}</section>`;

  const slideArr = [
    // 0 — intro
    slide(0, ['#2c2060','#161230'],
      `<div class="wr-eyebrow r" style="color:var(--accent-2)">Operate · Year in review</div>
       <div class="wr-year r">${y.year}</div>
       ${name?`<div class="wr-name r">${esc(name)}</div>`:''}
       <div class="wr-lede r">Let's rewind your year on the road.</div>`),
    // 1 — shows played
    slide(1, ['#241a45','#181334'],
      `<div class="wr-eyebrow r">You played</div>
       <div class="wr-big r" data-count="${y.shows}">0</div>
       <div class="wr-word r">SHOWS</div>
       <div class="wr-lede r">across <b>${y.tours}</b> tour${y.tours===1?'':'s'} · <b>${y.daysOnRoad}</b> days on the road</div>`),
    // 2 — flight map + km
    slide(2, ['#0f1f3d','#141230'],
      `<canvas class="wr-map" id="wr-map"></canvas>
       <div class="wr-map-fade"></div>
       <div class="wr-map-copy">
         <div class="wr-eyebrow r">You flew</div>
         <div class="wr-big r" data-count="${y.km}" data-suffix=" km">0</div>
         ${kmScale?`<div class="wr-lede r">${esc(kmScale)}</div>`:''}
         <div class="wr-chip r">${y.flights} flights · ${y.airports} airports${longest?` · longest ${esc(y.longest.from)}→${esc(y.longest.to)}`:''}</div>
       </div>`, 7200),
    // 3 — countries & cities
    slide(3, ['#3a1638','#1b1230'],
      `<div class="wr-eyebrow r">You touched down in</div>
       <div class="wr-big r" data-count="${y.countries}">0</div>
       <div class="wr-word r">COUNTRIES</div>
       <div class="wr-lede r"><b>${y.cities}</b> different cities</div>
       <div class="wr-flags r">${flags.map((f,i)=>`<span style="--d:${i*0.06}s">${f}</span>`).join('')||''}</div>`),
    // 4 — hours behind the decks: h / m / s
    slide(4, ['#20184a','#151228'],
      `<div class="wr-eyebrow r">Behind the decks</div>
       <div class="wr-hms">
         <div class="r"><b data-count="${hH}">0</b><span>hours</span></div>
         <div class="r"><b data-count="${hM}">0</b><span>minutes</span></div>
         <div class="r"><b data-count="${hS}">0</b><span>seconds</span></div>
       </div>`, 6200),
    // 5 — highlights
    slide(5, ['#12233f','#141230'],
      `<div class="wr-eyebrow r">Highlights</div>
       <div class="wr-hl r">
         ${longest?`<div><span>Longest hop</span><b>${esc(y.longest.from)} → ${esc(y.longest.to)}</b><i>${Math.round(y.longest.km).toLocaleString()} km</i></div>`:''}
         ${y.topCity?`<div><span>Home from home</span><b>${esc(y.topCity)}</b><i>${y.topCityN} show${y.topCityN===1?'':'s'}</i></div>`:''}
         ${y.busiestMonth?`<div><span>Busiest month</span><b>${esc(y.busiestMonth)}</b><i>${y.busiestMonthN} show${y.busiestMonthN===1?'':'s'}</i></div>`:''}
         <div><span>Nights away</span><b>${y.nights}</b><i>hotel stays</i></div>
       </div>`, 7000),
    // 6 — by the numbers
    slide(6, ['#241a45','#141127'],
      `<div class="wr-eyebrow r">${y.year} by the numbers</div>
       <div class="wr-grid r">
         ${recap('Shows', y.shows)}
         ${recap('Km flown', y.km>0?y.km.toLocaleString():'—')}
         ${recap('Flights', y.flights)}
         ${recap('Airports', y.airports)}
         ${recap('Countries', y.countries)}
         ${recap('Cities', y.cities)}
         ${recap('Hours played', y.stageHrs>0?y.stageHrs+'h':'—')}
         ${recap('Nights away', y.nights)}
         ${recap('Days on road', y.daysOnRoad)}
         ${recap('Tours', y.tours)}
       </div>`, 8000),
    // 7 — outro
    slide(7, ['#2c2060','#120f26'],
      `<div class="wr-eyebrow r" style="color:var(--accent-2)">That's a wrap, ${name?esc(name.split(' ')[0]):'legend'}</div>
       <div class="wr-summary r">
         <div><b>${y.shows}</b><span>shows</span></div>
         <div><b>${y.km>0?y.km.toLocaleString():'—'}</b><span>km flown</span></div>
         <div><b>${y.countries}</b><span>countries</span></div>
         <div><b>${y.stageHrs>0?y.stageHrs+'h':'—'}</b><span>played</span></div>
       </div>
       <button class="wr-share r" onclick="event.stopPropagation();shareWrapped()">${ICON.share?ICON.share(17):''} Share your year</button>
       <div class="wr-brand r">operate</div>`, 30000)
  ];
  const slides = slideArr.join('');
  const bars = slideArr.map(()=>`<div class="wr-bar"><i></i></div>`).join('');

  return `
  ${wrappedCSS()}
  <div id="wrapped-root" class="wr-root">
    <div class="wr-progress">${bars}</div>
    <button class="wr-x" onclick="back()">${ICON.x(20)}</button>
    <div class="wr-stage">${slides}</div>
    <div class="wr-tap wr-prev" onclick="wrappedGo(-1)"></div>
    <div class="wr-tap wr-next" onclick="wrappedGo(1)"></div>
  </div>`;
}

function wrappedCSS(){ return `<style>
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
  /* entrance */
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
  /* hours h/m/s */
  .wr-hms{display:flex;flex-direction:column;gap:22px;margin-top:14px}
  .wr-hms>div{display:flex;flex-direction:column;align-items:center}
  .wr-hms b{font-size:clamp(54px,16vw,88px);font-weight:900;letter-spacing:-.04em;line-height:.9;font-variant-numeric:tabular-nums;text-shadow:0 8px 40px rgba(139,125,255,.35)}
  .wr-hms span{margin-top:3px;font-size:12px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:#a99dff}
  /* highlights */
  .wr-hl{display:flex;flex-direction:column;gap:14px;margin-top:22px;width:100%;max-width:360px}
  .wr-hl>div{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:15px 18px;text-align:left;display:flex;flex-direction:column;backdrop-filter:blur(6px)}
  .wr-hl span{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a99dff}
  .wr-hl b{font-size:23px;font-weight:850;margin-top:5px}
  .wr-hl i{font-style:normal;font-size:13px;color:#b3aecb;margin-top:3px;font-weight:600}
  /* recap grid */
  .wr-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 20px;margin-top:24px;width:100%;max-width:380px}
  .wr-grid>div{display:flex;flex-direction:column;align-items:flex-start;text-align:left}
  .wr-grid b{font-size:32px;font-weight:900;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
  .wr-grid span{margin-top:4px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#a99dff}
  .wr-flags span{opacity:0;transform:scale(.4);animation:wrPop .5s cubic-bezier(.2,1.5,.4,1) forwards;animation-delay:calc(.5s + var(--d))}
  @keyframes wrPop{to{opacity:1;transform:none}}
  /* map slide */
  .wr-map{position:absolute;inset:0;width:100%;height:100%}
  .wr-map-fade{position:absolute;inset:0;background:linear-gradient(to top,rgba(12,10,24,.95) 6%,rgba(12,10,24,.15) 46%,rgba(12,10,24,.55) 100%);pointer-events:none}
  .wr-map-copy{position:absolute;left:0;right:0;bottom:96px;padding:0 30px;text-align:center}
  .wr-map-copy .wr-big{font-size:clamp(64px,20vw,120px)}
  /* summary */
  .wr-summary{display:grid;grid-template-columns:1fr 1fr;gap:16px 26px;margin:8px 0 8px}
  .wr-summary div{display:flex;flex-direction:column}
  .wr-summary b{font-size:40px;font-weight:900;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
  .wr-summary span{margin-top:5px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b0a9d6}
  .wr-share{position:relative;z-index:7;pointer-events:auto;margin-top:30px;display:inline-flex;align-items:center;gap:9px;font-size:16px;font-weight:800;
    color:#1b1533;background:linear-gradient(120deg,#d7cfff,#a99dff);border:none;border-radius:14px;padding:15px 26px;
    box-shadow:0 12px 34px rgba(139,125,255,.4);cursor:pointer}
  .wr-share:active{transform:scale(.97)}
  .wr-brand{position:absolute;bottom:26px;left:0;right:0;letter-spacing:.34em;text-transform:lowercase;font-weight:800;color:#6b6690;font-size:13px}
  /* chrome */
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
</style>`; }

/* ---- story controller ---- */
let wrState = null;
function initWrapped(){
  const root = document.getElementById('wrapped-root');
  if(!root) return;
  const slides = [...root.querySelectorAll('.wr-slide')];
  if(!slides.length) return;
  wrState = { i:-1, n:slides.length, slides, timer:null, mapDone:false };
  wrappedShow(0);
}
function wrClearTimer(){ if(wrState&&wrState.timer){ clearTimeout(wrState.timer); wrState.timer=null; } }
function wrappedShow(i){
  const root = document.getElementById('wrapped-root'); if(!root||!wrState) return;
  if(i<0) i=0; if(i>=wrState.n) i=wrState.n-1;
  wrClearTimer();
  wrState.i = i;
  const bars = [...root.querySelectorAll('.wr-bar')];
  wrState.slides.forEach((s,idx)=>{ s.classList.toggle('on', idx===i); });
  bars.forEach((b,idx)=>{ b.classList.remove('active','done'); const fill=b.querySelector('i'); fill.style.animation='none';
    if(idx<i) b.classList.add('done'); });
  const cur = wrState.slides[i];
  const dur = Math.max(2600, parseInt(cur.getAttribute('data-dur'))||5200);
  // progress fill for the active bar (skip on last slide)
  if(bars[i] && i<wrState.n-1 && !WR_REDUCE()){
    const fill=bars[i].querySelector('i'); bars[i].classList.add('active');
    fill.style.animation=`wrFill ${dur}ms linear forwards`;
  } else if(bars[i] && i===wrState.n-1){ bars[i].classList.add('done'); }
  // per-slide animations
  wrCountUp(cur);
  if(cur.querySelector('#wr-map')) wrDrawMapAnimated();
  // autoplay (not on last slide)
  if(i < wrState.n-1){
    wrState.timer = setTimeout(()=>{ if(document.getElementById('wrapped-root')) wrappedGo(1); }, dur);
  }
}
function wrappedGo(dir){
  if(!wrState) return;
  const next = wrState.i + dir;
  if(next<0){ wrappedShow(0); return; }
  if(next>=wrState.n){ return; } // stay on last
  wrappedShow(next);
}
function wrCountUp(slide){
  slide.querySelectorAll('[data-count]').forEach(el=>{
    const to = parseInt(el.getAttribute('data-count'))||0;
    const suf = el.getAttribute('data-suffix')||'';
    if(WR_REDUCE() || to<=0){ el.textContent = to.toLocaleString()+suf; return; }
    const dur=1200, t0=performance.now();
    const step=(t)=>{ const p=Math.min(1,(t-t0)/dur); const e=1-Math.pow(1-p,3);
      el.textContent = Math.round(to*e).toLocaleString()+suf;
      if(p<1 && document.body.contains(el)) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---- flight map ---- */
function wrProject(legs, nodes, W, H){
  const pts=[...nodes.values()];
  let minLat=90,maxLat=-90,minLng=180,maxLng=-180;
  pts.forEach(([la,ln])=>{ minLat=Math.min(minLat,la);maxLat=Math.max(maxLat,la);minLng=Math.min(minLng,ln);maxLng=Math.max(maxLng,ln); });
  if(pts.length<2){ minLat-=8;maxLat+=8;minLng-=12;maxLng+=12; }
  // pad
  const padLat=(maxLat-minLat||10)*0.22+4, padLng=(maxLng-minLng||10)*0.18+6;
  minLat-=padLat;maxLat+=padLat;minLng-=padLng;maxLng+=padLng;
  const mx=52, myTop=70, myBot=H*0.34;
  const spanLng=maxLng-minLng||1, spanLat=maxLat-minLat||1;
  // keep aspect reasonable
  const proj=([la,ln])=>{
    const x=mx+((ln-minLng)/spanLng)*(W-mx*2);
    const y=myTop+((maxLat-la)/spanLat)*(H-myTop-myBot);
    return [x,y];
  };
  return proj;
}
/* Neon wireframe globe backdrop — rim + latitude/longitude ellipses, softly
   glowing and semi-transparent, with a slow meridian drift when animated. */
function wrDrawGlobe(g, cx, cy, r, alpha, animate){
  if(r<=0 || alpha<=0) return;
  g.save();
  // faint glow disc so it reads as a sphere
  const disc=g.createRadialGradient(cx,cy-r*0.25,r*0.1,cx,cy,r*1.08);
  disc.addColorStop(0,'rgba(90,140,255,0.12)'); disc.addColorStop(1,'rgba(90,140,255,0)');
  g.globalAlpha=0.6*alpha; g.fillStyle=disc; g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.fill();
  // wireframe
  g.globalAlpha=0.30*alpha; g.strokeStyle='rgba(125,170,255,0.95)'; g.lineWidth=1.1;
  g.shadowColor='rgba(110,155,255,0.65)'; g.shadowBlur=8;
  g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.stroke();                 // rim
  [-60,-30,0,30,60].forEach(deg=>{                                       // parallels
    const phi=deg*Math.PI/180, yy=cy-r*Math.sin(phi), rx=r*Math.cos(phi), ry=Math.max(2,rx*0.16);
    g.beginPath(); g.ellipse(cx,yy,rx,ry,0,0,Math.PI*2); g.stroke();
  });
  const phase = animate ? (performance.now()/7000) : 0.4;               // meridians (drift = slow spin)
  for(let i=0;i<6;i++){ const a=(i/6)*Math.PI+phase; const rx=Math.abs(r*Math.cos(a));
    g.beginPath(); g.ellipse(cx,cy,Math.max(0.6,rx),r,0,0,Math.PI*2); g.stroke(); }
  g.shadowBlur=0; g.restore();
}
function wrDrawMap(canvas, progress){
  const dpr=Math.min(2, window.devicePixelRatio||1);
  const W=canvas.clientWidth||canvas.offsetWidth||360, H=canvas.clientHeight||canvas.offsetHeight||640;
  canvas.width=W*dpr; canvas.height=H*dpr;
  const g=canvas.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const { legs, nodes } = wrState._map || {legs:[],nodes:new Map()};
  // neon wireframe globe backdrop
  const gr = Math.min(W*0.46, H*0.30);
  wrDrawGlobe(g, W/2, H*0.34, gr, Math.min(1, progress*1.6), true);
  if(!legs.length) return;
  const proj = wrState._proj || (wrState._proj = wrProject(legs, nodes, W, H));
  const home = (store.settings&&store.settings.homeAirport||'').toUpperCase();
  // longest leg for highlight
  let li=0,lk=0; legs.forEach((l,idx)=>{ if(l.km>lk){lk=l.km;li=idx;} });
  // arcs (staggered reveal)
  const n=legs.length;
  legs.forEach((l,idx)=>{
    const start=idx/n*0.55, local=Math.max(0,Math.min(1,(progress-start)/0.45));
    if(local<=0) return;
    const [x1,y1]=proj(l.a), [x2,y2]=proj(l.b);
    const mxp=(x1+x2)/2, myp=(y1+y2)/2;
    const dist=Math.hypot(x2-x1,y2-y1);
    const cx=mxp, cy=myp-Math.min(180, dist*0.42)-20; // bulge upward
    // sample the quadratic bezier up to `local`
    g.beginPath();
    for(let t=0;t<=local+0.0001;t+=0.02){
      const tt=Math.min(1,t), it=1-tt;
      const x=it*it*x1+2*it*tt*cx+tt*tt*x2, y=it*it*y1+2*it*tt*cy+tt*tt*y2;
      if(t===0) g.moveTo(x,y); else g.lineTo(x,y);
    }
    const hot = idx===li;
    g.strokeStyle = hot ? 'rgba(255,150,214,0.95)' : 'rgba(150,132,255,0.72)';
    g.lineWidth = hot ? 2.4 : 1.5;
    g.shadowColor = hot ? 'rgba(255,120,200,0.7)' : 'rgba(139,125,255,0.6)';
    g.shadowBlur = 10; g.stroke(); g.shadowBlur=0;
  });
  // nodes + labels
  g.font='700 11px system-ui,-apple-system,sans-serif'; g.textAlign='center';
  nodes.forEach((ll,code)=>{
    const [x,yv]=proj(ll); const isHome=code===home;
    g.beginPath(); g.arc(x,yv, isHome?4.5:3, 0, Math.PI*2);
    g.fillStyle=isHome?'#ffd27d':'#cfc6ff'; g.shadowColor=isHome?'rgba(255,210,125,.9)':'rgba(180,165,255,.8)'; g.shadowBlur=10; g.fill(); g.shadowBlur=0;
    if(progress>0.6){ g.globalAlpha=Math.min(1,(progress-0.6)/0.3); g.fillStyle='rgba(233,229,255,0.9)'; g.fillText(code, x, yv-9); g.globalAlpha=1; }
  });
  // plane travelling the longest arc
  if(progress>=1 && legs[li]){
    const l=legs[li]; const [x1,y1]=proj(l.a),[x2,y2]=proj(l.b);
    const mxp=(x1+x2)/2,myp=(y1+y2)/2,dist=Math.hypot(x2-x1,y2-y1);
    const cx=mxp,cy=myp-Math.min(180,dist*0.42)-20;
    const t=((performance.now()/2600)%1), it=1-t;
    const x=it*it*x1+2*it*t*cx+t*t*x2, y=it*it*y1+2*it*t*cy+t*t*y2;
    g.beginPath(); g.arc(x,y,3.2,0,Math.PI*2); g.fillStyle='#fff'; g.shadowColor='#fff'; g.shadowBlur=12; g.fill(); g.shadowBlur=0;
  }
}
function wrDrawMapAnimated(){
  const canvas=document.getElementById('wr-map'); if(!canvas||!wrState) return;
  wrState._map = yearFlightLegs(); wrState._proj=null;
  const reduce=WR_REDUCE();
  const t0=performance.now(), dur=2600;
  const loop=(t)=>{
    if(!document.getElementById('wr-map')) return;
    const p= reduce ? 1 : Math.min(1,(t-t0)/dur);
    wrDrawMap(canvas, p);
    // keep animating the plane after arcs finish, while slide is visible
    if(document.querySelector('.wr-slide.on #wr-map')) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ---- shareable poster (1080×1920 PNG) ---- */
function drawWrappedCanvas(y, name){
  const W=1080,H=1920,cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const grad=g.createLinearGradient(0,0,W*0.4,H);
  grad.addColorStop(0,'#2c2060'); grad.addColorStop(.55,'#1a1538'); grad.addColorStop(1,'#100d20');
  g.fillStyle=grad; g.fillRect(0,0,W,H);
  const glow=g.createRadialGradient(W*0.8,H*0.1,0,W*0.8,H*0.1,W); glow.addColorStop(0,'rgba(139,125,255,.30)'); glow.addColorStop(1,'rgba(139,125,255,0)');
  g.fillStyle=glow; g.fillRect(0,0,W,H);

  const PAD=90;
  // header
  let cy=168; g.textAlign='left';
  g.fillStyle='#a99dff'; g.font='800 30px system-ui,-apple-system,sans-serif'; g.fillText('OPERATE · YEAR IN REVIEW', PAD, cy);
  cy+=128; g.fillStyle='#f4f2fb'; g.font='900 172px system-ui,-apple-system,sans-serif'; g.fillText(String(y.year), PAD, cy);
  if(name){ cy+=48; g.fillStyle='#d7d2f2'; g.font='700 42px system-ui,-apple-system,sans-serif'; g.fillText(name, PAD, cy); }

  // mini flight map band
  try{
    const { legs, nodes } = yearFlightLegs();
    if(legs.length){
      const bx=70,by=430,bw=W-140,bh=360;
      const proj=wrProject(legs,nodes,bw,bh);
      const home=(store.settings&&store.settings.homeAirport||'').toUpperCase();
      let li=0,lk=0; legs.forEach((l,i)=>{ if(l.km>lk){lk=l.km;li=i;} });
      g.save(); g.translate(bx,by);
      wrDrawGlobe(g, bw/2, bh*0.44, Math.min(bw*0.42, bh*0.46), 1, false);
      legs.forEach((l,idx)=>{ const [x1,y1]=proj(l.a),[x2,y2]=proj(l.b);
        const mxp=(x1+x2)/2,myp=(y1+y2)/2,dist=Math.hypot(x2-x1,y2-y1),cyy=myp-Math.min(130,dist*0.4)-12;
        g.beginPath(); g.moveTo(x1,y1); g.quadraticCurveTo(mxp,cyy,x2,y2);
        const hot=idx===li; g.strokeStyle=hot?'rgba(255,150,214,0.95)':'rgba(150,132,255,0.55)'; g.lineWidth=hot?4:2.2;
        g.shadowColor=hot?'rgba(255,120,200,.6)':'rgba(139,125,255,.5)'; g.shadowBlur=12; g.stroke(); g.shadowBlur=0; });
      nodes.forEach((ll,code)=>{ const [x,yv]=proj(ll); const ih=code===home;
        g.beginPath(); g.arc(x,yv,ih?7:5,0,Math.PI*2); g.fillStyle=ih?'#ffd27d':'#d3caff'; g.shadowColor='rgba(180,165,255,.8)'; g.shadowBlur=12; g.fill(); g.shadowBlur=0; });
      g.restore();
    }
  }catch(e){}

  const EARTH=40075;
  const kmScale = y.km>=EARTH ? `${(y.km/EARTH).toFixed(1)}× around the planet` : y.km>0 ? `${Math.max(1,Math.round(y.km/EARTH*100))}% around the planet` : '';
  const totMin=y.stageMins||0;

  // full figure grid — every stat
  const cells = [
    ['Shows', String(y.shows)],
    ['Km flown', y.km>0?y.km.toLocaleString():'—'],
    ['Flights', String(y.flights)],
    ['Airports', String(y.airports)],
    ['Countries', String(y.countries)],
    ['Cities', String(y.cities)],
    ['Hours played', y.stageHrs>0?(y.stageHrs+'h'):'—'],
    ['Nights away', String(y.nights)],
    ['Days on road', String(y.daysOnRoad)],
    ['Tours', String(y.tours)]
  ];
  const colX=[PAD, W/2+20]; const gy0=870, rowH=124;
  cells.forEach((c,idx)=>{ const col=idx%2, row=(idx-col)/2; const x=colX[col], yy=gy0+row*rowH;
    g.fillStyle='#9b93c4'; g.font='800 24px system-ui,-apple-system,sans-serif'; g.fillText(c[0].toUpperCase(), x, yy);
    g.fillStyle='#fff'; g.font='900 66px system-ui,-apple-system,sans-serif'; g.fillText(c[1], x, yy+66);
  });

  // hours h/m/s band
  let by2=gy0+5*rowH+30;
  g.fillStyle='#a99dff'; g.font='800 24px system-ui,-apple-system,sans-serif'; g.fillText('BEHIND THE DECKS', PAD, by2);
  by2+=52; g.fillStyle='#efeaff'; g.font='800 44px system-ui,-apple-system,sans-serif';
  g.fillText(`${Math.round(totMin/60).toLocaleString()}h  ·  ${totMin.toLocaleString()} min  ·  ${(totMin*60).toLocaleString()} sec`, PAD, by2);

  // highlights
  let hy=by2+70;
  const hl=[];
  if(y.longest&&y.longest.km>0) hl.push(['Longest hop', `${y.longest.from} → ${y.longest.to} · ${Math.round(y.longest.km).toLocaleString()} km`]);
  if(y.topCity) hl.push(['Home from home', `${y.topCity} · ${y.topCityN} show${y.topCityN===1?'':'s'}`]);
  if(y.busiestMonth) hl.push(['Busiest month', `${y.busiestMonth} · ${y.busiestMonthN} show${y.busiestMonthN===1?'':'s'}`]);
  if(kmScale) hl.push(['Distance', kmScale]);
  hl.slice(0,4).forEach(h=>{
    g.fillStyle='#8b83b8'; g.font='800 22px system-ui,-apple-system,sans-serif'; g.fillText(h[0].toUpperCase(), PAD, hy); hy+=38;
    g.fillStyle='#e7e3f6'; g.font='700 32px system-ui,-apple-system,sans-serif'; g.fillText(h[1], PAD, hy); hy+=54;
  });

  // flags row
  if(y.flags.length){ g.font='40px system-ui,-apple-system,sans-serif'; g.fillText(y.flags.slice(0,14).join(' '), PAD, Math.min(hy+10, H-150)); }

  g.textAlign='center'; g.fillStyle='#7169a0'; g.font='800 34px system-ui,-apple-system,sans-serif';
  g.fillText('o p e r a t e', W/2, H-70);
  return cv;
}
function shareWrapped(){
  const y=computeYearStats(); const name=wrappedName();
  let cv; try{ cv=drawWrappedCanvas(y,name); }catch(e){ toast('Could not build image','x'); return; }
  toast('Building your card…','image');
  cv.toBlob(async (blob)=>{
    if(!blob){ toast('Could not build image','x'); return; }
    const file=new File([blob], 'operate-'+y.year+'.png', {type:'image/png'});
    try{
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({ files:[file], title:(name?name+' · ':'')+y.year+' on Operate' }); return; }
    }catch(e){ if(e && e.name==='AbortError') return; }
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=file.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Image saved','image');
  }, 'image/png');
}
