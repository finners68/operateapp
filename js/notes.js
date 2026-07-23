/* ============================================================
   NOTES
   ============================================================ */
let noteSearch = '';
function notesSub(){ const all=sel.notes(); const folders=[...new Set(all.map(n=>n.folder).filter(Boolean))]; return all.length+' note'+(all.length!==1?'s':'')+(folders.length?' · '+folders.length+' folder'+(folders.length!==1?'s':''):'')+' · free-form text'; }
function notesControls(){
  return `
    ${pageIntro('notes', 'Your notepad', 'Set lists, rider reminders, track IDs — anything text-based. Use folders to group notes (e.g. "Riders" or "Admin").')}
    ${tabBlurb('Search by title or body. Tap + for a new note.')}
    <div class="searchbar"><span class="ic">${ICON.search(18)}</span><input placeholder="Search notes" value="${esc(noteSearch)}" oninput="noteSearch=this.value;debouncedNotes()"></div>`;
}
function notesListBody(){
  const all = sel.notes();
  const q = noteSearch.toLowerCase();
  const list = q? all.filter(n=>(n.title+' '+n.body+' '+(n.folder||'')).toLowerCase().includes(q)) : all;
  return list.length?`<div class="card flush stagger">${list.map(noteRowFull).join('')}</div>`
    :`<div class="empty"><div class="ic">${ICON.note(28)}</div><b>${q?'No matches':'No notes yet'}</b><span>${q?'Try another search term.':'Set notes, rider reminders, track IDs — tap + to create one.'}</span>${q?'':`<button class="btn secondary" style="margin-top:14px;max-width:220px" onclick="sheetNote()">${ICON.plus(18)} New note</button>`}</div>`;
}
let notesT;
function debouncedNotes(){ clearTimeout(notesT); notesT=setTimeout(()=>{ const el=$('#view .searchbar input'); const pos=el?el.selectionStart:0; renderView(); const n=$('#view .searchbar input'); if(n){n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){}} },160); }
function noteRowFull(n){
  const preview=(n.body||'').split('\n').filter(Boolean)[0]||'No additional text';
  return `<div class="note-row" onclick="openView('note','${n.id}')">
    <div style="display:flex;align-items:center;gap:8px"><b style="flex:1">${esc(n.title||'Untitled')}</b>${n.folder?`<span class="tag" style="background:var(--card-2);color:var(--text-3)">${esc(n.folder)}</span>`:''}</div>
    <span class="meta"><span class="dt">${timeAgo(n.updated)}</span> · ${esc(preview.slice(0,60))}</span>
  </div>`;
}
/* ============================================================
   NOTE EDITOR
   ============================================================ */
function viewNote(id){
  const n = sel.notes().find(x=>x.id===id) || store.notes.find(x=>x.id===id);
  if(!n) return backStub();
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="saveNoteAndBack('${n.id}')">${ICON.chevL(20)} Notes</button>
    <button class="header-btn" style="width:36px;height:36px" onclick="confirmDeleteNote('${n.id}')">${ICON.trash(17)}</button>
  </div></div>
  <div class="screen-pad fade-in">
    <input id="note-title" class="input" style="font-size:24px;font-weight:800;border:none;background:none;padding:8px 2px" placeholder="Title" value="${esc(n.title||'')}" oninput="liveNoteTitle('${n.id}',this.value)">
    <div style="display:flex;align-items:center;gap:8px;margin:2px 2px 10px">
      <span style="color:var(--text-3)">${ICON.folder(15)}</span>
      <input id="note-folder" class="input" style="font-size:13px;padding:6px 10px;background:var(--card);border-radius:9px;width:auto;flex:1" placeholder="Folder (optional)" value="${esc(n.folder||'')}" onblur="liveNoteFolder('${n.id}',this.value)">
      <span style="font-size:12px;color:var(--text-3)">${timeAgo(n.updated)}</span>
    </div>
    <textarea id="note-body" class="textarea" style="min-height:60dvh;font-size:16.5px;border:none;background:none;padding:2px" placeholder="Start writing…" oninput="liveNoteBody('${n.id}',this.value)">${esc(n.body||'')}</textarea>
  </div>`;
}

/* ============================================================
   NOTE — create + live edit
   ============================================================ */
function sheetNote(){
  const n = {id:uid('note'), title:'', folder:'', body:'', updated:nowMs(), created:nowMs()};
  store.notes.push(n); persist();
  openView('note', n.id);
  setTimeout(()=>{ const el=$('#note-title'); if(el) el.focus(); },80);
}
function liveNoteTitle(id,v){ const n=store.notes.find(x=>x.id===id); if(n){n.title=v;n.updated=nowMs();persist();} }
function liveNoteFolder(id,v){ const n=store.notes.find(x=>x.id===id); if(n){n.folder=v.trim();n.updated=nowMs();persist();} }
function liveNoteBody(id,v){ const n=store.notes.find(x=>x.id===id); if(n){n.body=v;n.updated=nowMs();persist();} }
function saveNoteAndBack(id){
  const n=store.notes.find(x=>x.id===id);
  if(n && !n.title.trim() && !n.body.trim()){ store.notes=store.notes.filter(x=>x.id!==id); persist(); }
  back();
}
function confirmDeleteNote(id){ confirmSheet('Delete note?','This can\'t be undone.','Delete note',()=>{ store.notes=store.notes.filter(x=>x.id!==id); persist(); back(); toast('Note deleted','trash'); }, true); }

