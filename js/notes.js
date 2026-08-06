/* ============================================================
   NOTES — folders (UUID) + unfiled notes
   ============================================================ */
let noteSearch = '';

function notesSub(){
  const all = sel.notes();
  const folders = sel.noteFolders();
  return all.length+' note'+(all.length!==1?'s':'')+(folders.length?' · '+folders.length+' folder'+(folders.length!==1?'s':''):'')+' · free-form text';
}

function notesControls(){
  return `
    ${pageIntro('notes', 'Your notepad', 'Set lists, rider reminders, track IDs — anything text-based. Open a folder to browse its notes, or keep notes unfiled below.')}
    ${tabBlurb('Search by title or body. Tap + for a new note, or create a folder to group them.')}
    <div class="searchbar"><span class="ic">${ICON.search(18)}</span><input placeholder="Search notes" value="${esc(noteSearch)}" oninput="noteSearch=this.value;debouncedNotes()"></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button type="button" class="btn secondary" style="flex:1" onclick="promptCreateNoteFolder()">${ICON.folder(16)} New folder</button>
    </div>`;
}

function notesListBody(){
  const q = noteSearch.toLowerCase().trim();
  const folders = sel.noteFolders();
  const unfiled = sel.unfiledNotes();

  if(q){
    const list = sel.notes().filter(n =>
      (n.title+' '+n.body+' '+(n.folder||'')).toLowerCase().includes(q)
    );
    return list.length
      ? `<div class="card flush stagger">${list.map(noteRowFull).join('')}</div>`
      : `<div class="empty"><div class="ic">${ICON.note(28)}</div><b>No matches</b><span>Try another search term.</span></div>`;
  }

  const folderRows = folders.map(f => {
    const count = sel.notesInFolder(f.id).length;
    return `<div class="row" onclick="openView('noteFolder','${f.id}')">
      <div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.folder(17)}</div>
      <div class="body"><b>${esc(f.name||'Folder')}</b><span>${count} note${count!==1?'s':''}</span></div>
      <div class="trail">${ICON.chevR(15)}</div>
    </div>`;
  }).join('');

  const unfiledBlock = unfiled.length
    ? `<div class="card flush stagger">${unfiled.map(noteRowFull).join('')}</div>`
    : (folders.length
      ? `<div class="hint" style="margin-top:4px">No unfiled notes — open a folder or tap +.</div>`
      : '');

  if(!folders.length && !unfiled.length){
    return `<div class="empty"><div class="ic">${ICON.note(28)}</div><b>No notes yet</b><span>Set notes, rider reminders, track IDs — tap + to create one, or make a folder first.</span>
      <button class="btn secondary" style="margin-top:14px;max-width:220px" onclick="sheetNote()">${ICON.plus(18)} New note</button>
      <button class="btn secondary" style="margin-top:8px;max-width:220px" onclick="promptCreateNoteFolder()">${ICON.folder(16)} New folder</button>
    </div>`;
  }

  return `
    ${folders.length ? `<div class="section"><div class="section-head"><div class="section-title" style="font-size:16px">Folders</div></div><div class="card flush">${folderRows}</div></div>` : ''}
    <div class="section" style="margin-top:${folders.length?'12px':'0'}">
      <div class="section-head"><div class="section-title" style="font-size:16px">Notes</div></div>
      ${unfiledBlock || `<div class="empty" style="padding:20px 12px"><b>No unfiled notes</b><span>Tap + to add one, or move a note into a folder from the editor.</span></div>`}
    </div>`;
}

let notesT;
function debouncedNotes(){
  clearTimeout(notesT);
  notesT = setTimeout(()=>{
    const el = $('#view .searchbar input');
    const pos = el ? el.selectionStart : 0;
    renderView();
    const n = $('#view .searchbar input');
    if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} }
  }, 160);
}

function noteRowFull(n){
  const preview = (n.body||'').split('\n').filter(Boolean)[0] || 'No additional text';
  return `<div class="note-row" onclick="openView('note','${n.id}')">
    <div style="display:flex;align-items:center;gap:8px"><b style="flex:1">${esc(n.title||'Untitled')}</b>${n.folder?`<span class="tag" style="background:var(--card-2);color:var(--text-3)">${esc(n.folder)}</span>`:''}</div>
    <span class="meta"><span class="dt">${timeAgo(n.updated)}</span> · ${esc(preview.slice(0,60))}</span>
  </div>`;
}

/* ============================================================
   FOLDERS
   ============================================================ */
function promptCreateNoteFolder(){
  promptSheet('New folder', 'e.g. Riders', function(v){
    createNoteFolder(v);
  });
}

function createNoteFolder(name){
  const trimmed = (name || '').trim();
  if(!trimmed){ toast('Type a folder name','x'); return null; }
  const existing = (store.noteFolders || []).find(f =>
    (f.name || '').toLowerCase() === trimmed.toLowerCase()
  );
  if(existing){
    toast('Folder already exists','folder');
    return existing;
  }
  const f = { id: uid('nf'), name: trimmed, sortOrder: (store.noteFolders || []).length };
  if(typeof persistNoteFolderLocal === 'function') persistNoteFolderLocal(f);
  else {
    if(!store.noteFolders) store.noteFolders = [];
    store.noteFolders.push(f);
    db.write(store);
  }
  if(typeof pushNoteFolderNow === 'function') pushNoteFolderNow(f);
  toast('Folder created','folder');
  if(typeof renderView === 'function') renderView();
  return f;
}

function ensureNoteFolderByName(name){
  const trimmed = (name || '').trim();
  if(!trimmed) return null;
  const existing = (store.noteFolders || []).find(f =>
    (f.name || '').toLowerCase() === trimmed.toLowerCase()
  );
  if(existing) return existing;
  return createNoteFolder(trimmed);
}

function viewNoteFolder(folderId){
  const f = sel.noteFolder(folderId);
  if(!f) return backStub();
  const list = sel.notesInFolder(folderId);
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="back()">${ICON.chevL(20)} Notes</button>
    <button class="header-btn" style="width:36px;height:36px" onclick="sheetNoteInFolder('${f.id}')">${ICON.plus(20)}</button>
  </div></div>
  <div class="screen-pad fade-in">
    <div style="display:flex;align-items:center;gap:10px;margin:4px 2px 14px">
      <div class="ic" style="background:var(--card-2);color:var(--text-2);width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center">${ICON.folder(20)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:22px;font-weight:800;line-height:1.2">${esc(f.name||'Folder')}</div>
        <div style="font-size:13px;color:var(--text-3)">${list.length} note${list.length!==1?'s':''}</div>
      </div>
    </div>
    ${list.length
      ? `<div class="card flush stagger">${list.map(noteRowFull).join('')}</div>`
      : `<div class="empty"><div class="ic">${ICON.note(28)}</div><b>Empty folder</b><span>Tap + to add a note here.</span>
          <button class="btn secondary" style="margin-top:14px;max-width:220px" onclick="sheetNoteInFolder('${f.id}')">${ICON.plus(18)} New note</button>
        </div>`}
  </div>`;
}

/* ============================================================
   NOTE EDITOR
   ============================================================ */
function viewNote(id){
  const n = sel.notes().find(x=>x.id===id) || store.notes.find(x=>x.id===id);
  if(!n) return backStub();
  const folderLabel = n.folderId
    ? ((sel.noteFolder(n.folderId) || {}).name || n.folder || 'Folder')
    : 'No folder';
  return `
  <div class="detail-top"><div class="detail-bar">
    <button class="back-btn" onclick="saveNoteAndBack('${n.id}')">${ICON.chevL(20)} Notes</button>
    <button class="header-btn" style="width:36px;height:36px" onclick="confirmDeleteNote('${n.id}')">${ICON.trash(17)}</button>
  </div></div>
  <div class="screen-pad fade-in">
    <input id="note-title" class="input" style="font-size:24px;font-weight:800;border:none;background:none;padding:8px 2px" placeholder="Title" value="${esc(n.title||'')}" oninput="liveNoteTitle('${n.id}',this.value)">
    <div style="display:flex;align-items:center;gap:8px;margin:2px 2px 10px">
      <span style="color:var(--text-3)">${ICON.folder(15)}</span>
      <button type="button" class="btn secondary" style="font-size:13px;padding:6px 12px;border-radius:9px;flex:1;justify-content:flex-start;text-align:left" onclick="sheetMoveNoteToFolder('${n.id}')">${esc(folderLabel)}</button>
      <span style="font-size:12px;color:var(--text-3)">${timeAgo(n.updated)}</span>
    </div>
    <textarea id="note-body" class="textarea" style="min-height:60dvh;font-size:16.5px;border:none;background:none;padding:2px" placeholder="Start writing…" oninput="liveNoteBody('${n.id}',this.value)">${esc(n.body||'')}</textarea>
  </div>`;
}

/* ============================================================
   NOTE — create + live edit (instant cloud write when online)
   ============================================================ */
function sheetNote(folderId){
  const folder = folderId ? sel.noteFolder(folderId) : null;
  const n = {
    id: uid('note'),
    title: '',
    folderId: folder ? folder.id : null,
    folder: folder ? folder.name : '',
    body: '',
    updated: nowMs(),
    created: nowMs()
  };
  store.notes.push(n);
  if(typeof persistNoteLocal === 'function') persistNoteLocal(n);
  else db.write(store);
  openView('note', n.id);
  if(typeof pushNoteNow === 'function') pushNoteNow(n);
  setTimeout(()=>{ const el=$('#note-title'); if(el) el.focus(); },80);
}

function sheetNoteInFolder(folderId){
  sheetNote(folderId);
}

function liveNoteTitle(id,v){
  const n=store.notes.find(x=>x.id===id);
  if(!n) return;
  n.title=v; n.updated=nowMs();
  if(typeof persistNoteLocal === 'function') persistNoteLocal(n); else db.write(store);
  if(typeof pushNoteNow === 'function') pushNoteNow(n);
}

function assignNoteFolder(noteId, folderId){
  const n = store.notes.find(x => x.id === noteId);
  if(!n) return;
  if(!folderId){
    n.folderId = null;
    n.folder = '';
  } else {
    const f = sel.noteFolder(folderId);
    if(!f) return;
    n.folderId = f.id;
    n.folder = f.name || '';
  }
  n.updated = nowMs();
  if(typeof persistNoteLocal === 'function') persistNoteLocal(n); else db.write(store);
  if(typeof pushNoteNow === 'function') pushNoteNow(n);
  if(typeof renderView === 'function') renderView();
}

function sheetMoveNoteToFolder(noteId){
  const n = store.notes.find(x => x.id === noteId);
  if(!n) return;
  const folders = sel.noteFolders();
  const rows = [
    `<div class="row" onclick="closeSheet();assignNoteFolder('${noteId}',null)">
      <div class="ic" style="background:var(--card-2);color:var(--text-3)">${ICON.note(17)}</div>
      <div class="body"><b>No folder</b><span>Keep this note unfiled</span></div>
      ${!n.folderId ? '<span class="tag">Current</span>' : ICON.chevR(15)}
    </div>`
  ].concat(folders.map(f => `<div class="row" onclick="closeSheet();assignNoteFolder('${noteId}','${f.id}')">
      <div class="ic" style="background:var(--card-2);color:var(--text-2)">${ICON.folder(17)}</div>
      <div class="body"><b>${esc(f.name||'Folder')}</b><span>${sel.notesInFolder(f.id).length} notes</span></div>
      ${n.folderId===f.id ? '<span class="tag">Current</span>' : ICON.chevR(15)}
    </div>`));

  openSheet('Move to folder', `
    <div class="card flush">${rows.join('')}</div>
    <div class="spacer"></div>
    <button class="btn secondary" onclick="closeSheet();promptNewFolderForNote('${noteId}')">${ICON.folder(16)} New folder…</button>
  `);
}

function promptNewFolderForNote(noteId){
  promptSheet('New folder', 'e.g. Riders', function(v){
    const f = createNoteFolder(v);
    if(f) assignNoteFolder(noteId, f.id);
  });
}

function liveNoteBody(id,v){
  const n=store.notes.find(x=>x.id===id);
  if(!n) return;
  n.body=v; n.updated=nowMs();
  if(typeof persistNoteLocal === 'function') persistNoteLocal(n); else db.write(store);
  if(typeof pushNoteNow === 'function') pushNoteNow(n);
}

function saveNoteAndBack(id){
  const n=store.notes.find(x=>x.id===id);
  if(n && !n.title.trim() && !n.body.trim()){
    store.notes=store.notes.filter(x=>x.id!==id);
    db.write(store);
    if(typeof deleteNoteNow === 'function') deleteNoteNow(id);
  } else if(n && typeof pushNoteNow === 'function'){
    pushNoteNow(n);
  }
  back();
}

function confirmDeleteNote(id){
  confirmSheet('Delete note?','This can\'t be undone.','Delete note',()=>{
    store.notes=store.notes.filter(x=>x.id!==id);
    db.write(store);
    if(typeof deleteNoteNow === 'function') deleteNoteNow(id);
    back();
    toast('Note deleted','trash');
  }, true);
}
