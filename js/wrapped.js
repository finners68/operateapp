/* Year-in-review "wrapped" card — a shareable, editorial recap of the year.
   In-app it renders as a stack of bold panels; Share exports a story-format PNG
   drawn on a canvas (no external libs, works offline, CSP-safe). */
function wrappedName(){
  const n = store.settings && store.settings.artistName;
  return (n && n !== 'You') ? n : '';
}
function viewWrapped(){
  const y = computeYearStats();
  const name = wrappedName();
  const EARTH = 40075;
  const kmScale = y.km>=EARTH ? `${(y.km/EARTH).toFixed(1)}× around the planet`
    : y.km>0 ? `${Math.max(1,Math.round(y.km/EARTH*100))}% of the way around the planet` : '';
  const longest = (y.longest && y.longest.km>0) ? `${y.longest.from} → ${y.longest.to} · ${Math.round(y.longest.km).toLocaleString()} km` : '';
  const flags = y.flags.slice(0,16).join(' ');
  const hasData = y.shows>0 || y.km>0 || y.countries>0;

  const panel = (grad, inner) => `<section class="yr-panel" style="background:${grad}">${inner}</section>`;
  const big = (v,l,sub) => `<div class="yr-eyebrow">${esc(l)}</div><div class="yr-big">${v}</div>${sub?`<div class="yr-sub">${sub}</div>`:''}`;

  const panels = hasData ? [
    panel('linear-gradient(160deg,#2c2060,#1c1740 55%,#141127)',
      `<div class="yr-cover">
         <div class="yr-eyebrow" style="color:var(--accent-2)">Operate · Year in review</div>
         <div class="yr-year">${y.year}</div>
         ${name?`<div class="yr-name">${esc(name)}</div>`:''}
         <div class="yr-hint">Scroll ↓</div>
       </div>`),
    panel('linear-gradient(160deg,#241a45,#191531)',
      big(y.shows, 'You played', y.topCity?`most often in ${esc(y.topCity)}`:'shows this year') + `<div class="yr-word">SHOWS</div>`),
    panel('linear-gradient(160deg,#12233f,#141531)',
      big(y.km>0?y.km.toLocaleString():'—', 'You flew', [kmScale, longest].filter(Boolean).map(esc).join(' · ')) + `<div class="yr-word">KILOMETRES</div>`),
    panel('linear-gradient(160deg,#3a1638,#1d1330)',
      big(y.countries, 'You played in', y.busiestMonth?`busiest in ${esc(y.busiestMonth)}`:'') + `<div class="yr-flags">${flags||'countries'}</div>`),
    panel('linear-gradient(160deg,#231a48,#161326)',
      big(y.stageHrs>0?y.stageHrs+'h':'—', 'On the decks', 'hours played') + `<div class="yr-word">LIVE</div>`),
    panel('linear-gradient(160deg,#2c2060,#141127)',
      `<div class="yr-outro">
         <div class="yr-eyebrow" style="color:var(--accent-2)">That's a wrap</div>
         <div class="yr-summary">
           <span><b>${y.shows}</b> shows</span>
           <span><b>${y.km>0?y.km.toLocaleString():'—'}</b> km</span>
           <span><b>${y.countries}</b> countries</span>
           <span><b>${y.stageHrs>0?y.stageHrs+'h':'—'}</b> played</span>
         </div>
         <button class="btn" style="max-width:280px;margin:22px auto 0" onclick="shareWrapped()">${ICON.share?ICON.share(17):''} Share your year</button>
         <div class="yr-brand">operate</div>
       </div>`)
  ].join('') : `<section class="yr-panel" style="background:linear-gradient(160deg,#241a45,#141127)"><div class="yr-cover"><div class="yr-year">${y.year}</div><div class="yr-sub" style="max-width:260px">Add shows and flights and your year in review builds itself.</div></div></section>`;

  return `
  <style>
    .yr-wrap{background:#0e0b1c}
    .yr-panel{min-height:calc(100vh - 58px);scroll-snap-align:start;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;padding:40px 28px;color:#f4f2fb;position:relative}
    .yr-eyebrow{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#b3aecb;margin-bottom:14px}
    .yr-year{font-size:112px;font-weight:900;letter-spacing:-.04em;line-height:.9;background:linear-gradient(120deg,#c9bfff,#8b7dff);-webkit-background-clip:text;background-clip:text;color:transparent}
    .yr-name{margin-top:14px;font-size:22px;font-weight:700;color:#e7e3fb}
    .yr-hint,.yr-brand{position:absolute;left:0;right:0;color:#7d7899;font-size:13px;font-weight:600}
    .yr-hint{bottom:26px;letter-spacing:.05em}
    .yr-big{font-size:88px;font-weight:900;letter-spacing:-.035em;line-height:1;margin:4px 0}
    .yr-sub{font-size:15px;color:#b3aecb;font-weight:600;margin-top:12px;max-width:320px}
    .yr-word{margin-top:20px;font-size:14px;font-weight:800;letter-spacing:.32em;color:#8b7dff}
    .yr-flags{margin-top:22px;font-size:30px;line-height:1.5;letter-spacing:6px;max-width:340px}
    .yr-outro{display:flex;flex-direction:column;align-items:center}
    .yr-summary{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 22px;margin-top:20px;font-size:16px;color:#cfc9ee}
    .yr-summary b{color:#fff;font-size:22px;font-weight:850}
    .yr-brand{bottom:24px;letter-spacing:.3em;text-transform:lowercase;font-weight:800;color:#6b6690}
    @media(min-width:520px){ .yr-big{font-size:104px} .yr-year{font-size:128px} }
  </style>
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Stats</button>
    <div style="font-size:16px;font-weight:700">Year in review</div>
    <button class="back-btn" style="justify-content:flex-end" onclick="shareWrapped()">Share</button>
  </div></div>
  <div class="yr-wrap" style="scroll-snap-type:y proximity">${panels}</div>`;
}

/* Draw a 1080×1920 story-format poster and share/download it as a PNG. */
function drawWrappedCanvas(y, name){
  const W=1080, H=1920, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const grad=g.createLinearGradient(0,0,W*0.4,H);
  grad.addColorStop(0,'#2c2060'); grad.addColorStop(0.55,'#1a1538'); grad.addColorStop(1,'#110e22');
  g.fillStyle=grad; g.fillRect(0,0,W,H);
  const glow=g.createRadialGradient(W*0.8,H*0.12,0,W*0.8,H*0.12,W*0.9);
  glow.addColorStop(0,'rgba(139,125,255,0.28)'); glow.addColorStop(1,'rgba(139,125,255,0)');
  g.fillStyle=glow; g.fillRect(0,0,W,H);

  const PAD=96; let cy=170;
  g.textAlign='left';
  g.fillStyle='#a99dff'; g.font='800 30px system-ui,-apple-system,sans-serif';
  g.fillText('OPERATE · YEAR IN REVIEW', PAD, cy);
  cy+=120;
  g.fillStyle='#f4f2fb'; g.font='900 170px system-ui,-apple-system,sans-serif';
  g.fillText(String(y.year), PAD, cy);
  cy+=54;
  if(name){ g.fillStyle='#d7d2f2'; g.font='700 40px system-ui,-apple-system,sans-serif'; g.fillText(name, PAD, cy); cy+=30; }
  cy+=70;

  const EARTH=40075;
  const kmScale = y.km>=EARTH ? `${(y.km/EARTH).toFixed(1)}× around the planet`
    : y.km>0 ? `${Math.max(1,Math.round(y.km/EARTH*100))}% around the planet` : '';
  const longest = (y.longest && y.longest.km>0) ? `Longest: ${y.longest.from}→${y.longest.to}` : '';

  const stat=(label,value,sub)=>{
    g.fillStyle='#9b93c4'; g.font='800 26px system-ui,-apple-system,sans-serif';
    g.fillText(label.toUpperCase(), PAD, cy); cy+=78;
    g.fillStyle='#ffffff'; g.font='900 96px system-ui,-apple-system,sans-serif';
    g.fillText(value, PAD, cy); cy+=(sub?46:96);
    if(sub){ g.fillStyle='#b3aecb'; g.font='600 30px system-ui,-apple-system,sans-serif'; g.fillText(sub, PAD, cy); cy+=90; }
  };
  stat('Shows played', String(y.shows), y.topCity?('Most often in '+y.topCity):'');
  stat('Kilometres flown', y.km>0?y.km.toLocaleString():'—', [kmScale,longest].filter(Boolean).join('  ·  '));
  stat('Countries', String(y.countries), y.flags.slice(0,10).join(' '));
  stat('Hours played', y.stageHrs>0?(y.stageHrs+'h'):'—', y.busiestMonth?('Busiest in '+y.busiestMonth):'');

  g.textAlign='center';
  g.fillStyle='#6b6690'; g.font='800 34px system-ui,-apple-system,sans-serif';
  g.fillText('o p e r a t e', W/2, H-90);
  return cv;
}
function shareWrapped(){
  const y=computeYearStats(); const name=wrappedName();
  let cv; try{ cv=drawWrappedCanvas(y,name); }catch(e){ toast('Could not build image','x'); return; }
  cv.toBlob(async (blob)=>{
    if(!blob){ toast('Could not build image','x'); return; }
    const file=new File([blob], 'operate-'+y.year+'.png', {type:'image/png'});
    try{
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({ files:[file], title:(name?name+' · ':'')+y.year+' on Operate' });
        return;
      }
    }catch(e){ if(e && e.name==='AbortError') return; }
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=file.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Image saved','image');
  }, 'image/png');
}
