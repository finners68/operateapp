/* ---------- PWA: register offline service worker ---------- */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
  // Tapping a reminder notification opens the relevant show
  navigator.serviceWorker.addEventListener('message', (ev)=>{
    const d=ev.data||{};
    if(d.type==='reminder-open' && d.showId && typeof openView==='function'){ openView('event', d.showId); }
  });
}

/* ============================================================
   REMINDERS — schedule a notification for a show. Uses the
   Notification Triggers API for true background delivery when the
   browser supports it (Android / desktop Chrome); otherwise fires
   in-app while Operate is open. Reminders are device-local.
   ============================================================ */
function notifSupported(){ return typeof Notification !== 'undefined'; }
async function ensureNotifPermission(){
  if(!notifSupported()) return false;
  if(Notification.permission==='granted') return true;
  if(Notification.permission==='denied') return false;
  try{ return (await Notification.requestPermission())==='granted'; }catch(e){ return false; }
}
function reminderList(){ if(!Array.isArray(store.reminders)) store.reminders=[]; return store.reminders; }
/* The manual "Set reminder" badge ignores the automatic USB reminder. */
function reminderFor(showId){ return reminderList().find(r=>r.showId===showId && !r.fired && (r.kind||'manual')!=='usb') || null; }
function reminderTitle(r){
  if(r && r.kind==='usb') return "Don't forget your USB";
  const e=sel.event(r.showId); return e?('🎧 '+(e.venue||'Show')):'Show reminder';
}
function reminderBody(r){
  if(r && r.kind==='usb') return "You can thank us later";
  const e=sel.event(r.showId); const bits=[r.label||'Reminder']; if(e&&e.setTime) bits.push('set '+e.setTime); if(e&&e.city) bits.push(e.city); return bits.join(' · ');
}
function triggersSupported(){ return notifSupported() && 'showTrigger' in Notification.prototype; }

async function scheduleReminder(showId, atMs, label, kind){
  kind = kind || 'manual';
  const list=reminderList();
  let r=list.find(x=>x.showId===showId && (x.kind||'manual')===kind);
  if(r){ cancelTrigger(r); } else { r={id:uid('rem'), showId, kind}; list.push(r); }
  r.at=atMs; r.label=label; r.kind=kind; r.fired=false; r.triggered=false;
  const ok=await ensureNotifPermission();
  if(ok) await armTrigger(r);
  persist();
  return ok;
}
/* Auto-schedule the built-in "Don't forget your USB" reminder at every upcoming
   show's set END time. Never prompts — it arms an OS notification only if
   notifications are already allowed; otherwise it fires in-app when the app is
   open at set-end (see checkDueReminders). */
function ensureUsbReminders(){
  if(store.settings && store.settings.usbReminder===false) return;
  const list=reminderList(); const now=Date.now(), horizon=now+60*24*3600000; let changed=false;
  (typeof sel!=='undefined' && sel.events ? sel.events() : []).forEach(e=>{
    const at = e.endTime ? setStartMs(e.date, e.endTime) : null;
    if(at==null || at<=now || at>horizon) return;
    let r=list.find(x=>x.showId===e.id && x.kind==='usb');
    if(!r){ r={id:uid('rem'), showId:e.id, kind:'usb', at, label:"Don't forget your USB", fired:false, triggered:false}; list.push(r); changed=true; }
    else if(!r.fired && r.at!==at){ cancelTrigger(r); r.at=at; r.triggered=false; changed=true; }
    if(!r.triggered && !r.fired && notifSupported() && Notification.permission==='granted' && triggersSupported()){ armTrigger(r); changed=true; }
  });
  if(changed) persist();
}
async function armTrigger(r){
  if(!triggersSupported() || !('serviceWorker' in navigator)) return;
  try{
    const reg=await navigator.serviceWorker.ready;
    reg.showNotification(reminderTitle(r), {
      body: reminderBody(r), tag:'rem-'+r.id, data:{showId:r.showId},
      icon:'icons/icon-192.png', badge:'icons/icon-192.png',
      showTrigger: new TimestampTrigger(r.at)
    });
    r.triggered=true;
  }catch(e){}
}
function cancelTrigger(r){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(reg=>reg.getNotifications({tag:'rem-'+r.id, includeTriggered:true}).then(ns=>ns.forEach(n=>n.close()))).catch(()=>{});
}
function cancelReminder(showId, kind){
  kind = kind || 'manual';
  const list=reminderList(); const r=list.find(x=>x.showId===showId && (x.kind||'manual')===kind);
  if(!r) return;
  cancelTrigger(r);
  store.reminders=list.filter(x=>x!==r);
  persist();
}
function fireReminderNow(r){
  if(!notifSupported() || Notification.permission!=='granted') return;
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.ready
        .then(reg=>reg.showNotification(reminderTitle(r), {body:reminderBody(r), tag:'rem-'+r.id, data:{showId:r.showId}, icon:'icons/icon-192.png'}))
        .catch(()=>{ new Notification(reminderTitle(r), {body:reminderBody(r)}); });
    } else { new Notification(reminderTitle(r), {body:reminderBody(r)}); }
  }catch(e){}
}
/* Fallback + cleanup: fire any due reminders the browser couldn't schedule
   in the background, and drop stale ones. Called on boot and on a timer. */
function checkDueReminders(){
  try{ ensureUsbReminders(); }catch(e){}
  const list=reminderList(); const now=Date.now(); let changed=false;
  list.forEach(r=>{
    if(!r.fired && !r.triggered && r.at<=now && (now-r.at) < 6*3600000){
      fireReminderNow(r);
      // In-app fallback so the message still lands when notifications are off / app is open.
      if(typeof toast==='function'){ toast(r.kind==='usb' ? "Don't forget your USB — thank us later" : reminderTitle(r), 'reminder'); }
      r.fired=true; changed=true;
    }
  });
  const kept=list.filter(r=>!(r.at < now - 12*3600000));   // forget reminders >12h past
  if(kept.length!==list.length){ store.reminders=kept; changed=true; }
  if(changed) persist();
}
