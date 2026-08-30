import { useSyncExternalStore, useEffect, useRef, useState } from 'react';
import { call, getContentTabState, getIdeaTypes, getPrio, getSel, getSelectedIdeaId, getStore, notifyStore, pad, subscribeStore, timeAgo } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function contentState(){
  const fn = getContentTabState;
  if(typeof fn === 'function') return fn();
  return { mode: 'ideas', ideaFilter: 'all', noteSearch: '', selectedIdeaId: null };
}

function PageIntro({ id, title, body }){
  const html = call('pageIntro', id, title, body);
  if(!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function IdeaCard({ idea }){
  const types = getIdeaTypes() || {};
  const PRIO = getPrio() || {};
  const t = types[idea.type] || types.other || { label: 'Idea', color: 'var(--accent-2)', icon: 'idea' };
  const link = call('ideaLinkLabel', idea) || '';
  const selected = getSelectedIdeaId() === idea.id;
  return (
    <div
      className={`idea ${idea.done ? 'is-done' : ''}${selected ? ' sel' : ''}`}
      data-idea={idea.id}
      style={{ background: `linear-gradient(160deg, ${t.color}22, var(--card))`, borderColor: `${t.color}33` }}
      onClick={e => call('toggleIdeaSelect', e.nativeEvent || e, idea.id)}
    >
      <button
        type="button"
        className="idea-sel-btn"
        aria-label={idea.done ? 'Mark as to use' : 'Mark as done'}
        onClick={e => call('toggleIdeaDoneFromCard', e.nativeEvent || e, idea.id)}
      >
        <Icon name="check" size={15} />
      </button>
      <div className="type" style={{ color: t.color }}><Icon name={t.icon} size={13} /> {t.label}</div>
      <div className="ttl">{idea.title}</div>
      <div className="foot">
        <span className="prio" style={{ background: PRIO[idea.prio] }} />
        {idea.prio}
      </div>
      {link ? (
        <div className="link-tag"><Icon name="chevR" size={11} /> {link}</div>
      ) : null}
    </div>
  );
}

function IdeasBody({ filter }){
  const sel = getSel();
  const all = sel?.ideas ? sel.ideas() : [];
  const types = getIdeaTypes() || {};
  let list = all;
  if(filter === 'active') list = all.filter(i => !i.done);
  else if(filter === 'done') list = all.filter(i => i.done);
  else if(filter !== 'all') list = all.filter(i => i.type === filter);

  const grouped = filter === 'all' || filter === 'active';
  const typeKey = i => (types[i.type] ? i.type : 'other');
  const PRIO_RANK = { high: 0, med: 1, low: 2 };

  if(!list.length){
    return (
      <div className="empty">
        <div className="ic"><Icon name="idea" size={28} /></div>
        <b>No ideas yet</b>
        <span>Type above to capture a reel hook, caption or content plan — link it to a show later.</span>
        <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 240 }} onClick={() => call('sheetIdea')}>
          <Icon name="plus" size={18} /> New idea
        </button>
      </div>
    );
  }

  if(grouped){
    const active = list.filter(i => !i.done);
    const done = filter === 'all' ? list.filter(i => i.done) : [];
    const byType = t => active.filter(i => typeKey(i) === t).sort((a, b) => (PRIO_RANK[a.prio] ?? 1) - (PRIO_RANK[b.prio] ?? 1));
    return (
      <>
        {Object.entries(types).map(([t, def]) => {
          const group = byType(t);
          if(!group.length) return null;
          return (
            <div key={t}>
              <div className="prio-head">
                <span className="pd" style={{ background: def.color }} />
                {def.label} · {group.length}
              </div>
              <div className="idea-grid">
                {group.map(i => <IdeaCard key={i.id} idea={i} />)}
              </div>
            </div>
          );
        })}
        {done.length ? (
          <div>
            <div className="prio-head">
              <span className="pd" style={{ background: 'var(--text-3)' }} />
              Done · {done.length}
            </div>
            <div className="idea-grid">
              {done.map(i => <IdeaCard key={i.id} idea={i} />)}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="idea-grid">
      {list.map(i => <IdeaCard key={i.id} idea={i} />)}
    </div>
  );
}

function IdeasControls({ filter }){
  const sel = getSel();
  const all = sel?.ideas ? sel.ideas() : [];
  const types = getIdeaTypes() || {};
  const typesPresent = [...new Set(all.map(i => i.type))];
  const chips = [
    { k: 'all', l: `All ${all.length}` },
    { k: 'active', l: 'To use' },
    { k: 'done', l: 'Done' },
    ...typesPresent.map(t => ({ k: t, l: (types[t] || types.other || {}).label || t })),
  ];
  return (
    <>
      <PageIntro
        id="ideas"
        title="Capture content ideas"
        body="Reels, hooks and captions live here. Tap ＋ to add one, then open it to link it to a show."
      />
      <div className="chips" style={{ marginTop: 2 }}>
        {chips.map(c => (
          <button
            key={c.k}
            type="button"
            className={`chip ${filter === c.k ? 'on' : ''}`}
            onClick={() => call('setIdeaFilter', c.k)}
          >
            {c.l}
          </button>
        ))}
      </div>
    </>
  );
}

function NoteRow({ note, inFolder = false }){
  const sel = getSel();
  const preview = (note.body || '').split('\n').filter(Boolean)[0] || 'No additional text';
  const showFolderTag = !inFolder && sel?.noteBelongsToFolder && sel.noteBelongsToFolder(note);
  return (
    <div className="note-row" onClick={() => call('openView', 'note', note.id)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ flex: 1 }}>{note.title || 'Untitled'}</b>
        {showFolderTag ? (
          <span className="tag" style={{ background: 'var(--card-2)', color: 'var(--text-3)' }}>{note.folder || ''}</span>
        ) : null}
      </div>
      <span className="meta">
        <span className="dt">{timeAgo ? timeAgo(note.updated) : ''}</span> · {preview.slice(0, 60)}
      </span>
    </div>
  );
}

function NotesBody({ search }){
  const sel = getSel();
  const q = String(search || '').toLowerCase().trim();
  const searching = !!q;
  const folders = sel?.noteFolders ? sel.noteFolders() : [];
  const unfiled = sel?.unfiledNotes ? sel.unfiledNotes() : [];

  if(!searching && !folders.length && !unfiled.length){
    return (
      <div className="empty">
        <div className="ic"><Icon name="note" size={28} /></div>
        <b>No notes yet</b>
        <span>Set notes, rider reminders, track IDs — tap + to add a note or folder.</span>
        <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('sheetNoteAddChoice')}>
          <Icon name="plus" size={18} /> Add
        </button>
      </div>
    );
  }

  const folderItems = searching
    ? folders.filter(f => (f.name || '').toLowerCase().includes(q))
    : folders;
  const noteItems = searching
    ? (sel?.notes ? sel.notes() : []).filter(n => `${n.title || ''} ${n.body || ''} ${n.folder || ''}`.toLowerCase().includes(q))
    : unfiled;

  const folderSection = (searching || folders.length) ? (
    <div className="section">
      <div className="section-head"><div className="section-title" style={{ fontSize: 16 }}>Folders</div></div>
      {folderItems.length ? (
        <div className="card flush">
          {folderItems.map(f => {
            const count = sel?.notesInFolder ? sel.notesInFolder(f.id).length : 0;
            return (
              <div key={f.id} className="row" onClick={() => call('openView', 'noteFolder', f.id)}>
                <div className="ic" style={{ background: 'var(--card-2)', color: 'var(--text-2)' }}><Icon name="folder" size={17} /></div>
                <div className="body">
                  <b>{f.name || 'Folder'}</b>
                  <span>{count} note{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="trail"><Icon name="chevR" size={15} /></div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 4 }}>{searching ? 'No matching folders.' : 'No folders yet.'}</div>
      )}
    </div>
  ) : null;

  return (
    <>
      {folderSection}
      <div className="section" style={{ marginTop: folderSection ? 12 : 0 }}>
        <div className="section-head"><div className="section-title" style={{ fontSize: 16 }}>Notes</div></div>
        {noteItems.length ? (
          <div className="card flush">
            {noteItems.map(n => <NoteRow key={n.id} note={n} />)}
          </div>
        ) : (
          <div className="hint" style={{ marginTop: 4 }}>
            {searching ? 'No matching notes.' : 'No unfiled notes — open a folder or tap +.'}
          </div>
        )}
      </div>
    </>
  );
}

function NotesControls({ search, onSearch }){
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => { setLocalSearch(search); }, [search]);
  return (
    <>
      <PageIntro
        id="notes"
        title="Your notepad"
        body="Set lists, rider reminders, track IDs — anything text-based. Open a folder to browse its notes, or keep notes unfiled below."
      />
      <div className="tab-blurb">Search by title or body. Tap + to add a note or folder.</div>
      <div className="searchbar">
        <span className="ic"><Icon name="search" size={18} /></span>
        <input
          placeholder="Search notes"
          value={localSearch}
          onChange={e => {
            const v = e.target.value;
            setLocalSearch(v);
            onSearch(v);
          }}
        />
      </div>
    </>
  );
}

export default function ContentTabPage(){
  useStoreTick();
  const { mode, ideaFilter, noteSearch } = contentState();
  const isNotes = mode === 'notes';
  const sub = isNotes ? (call('notesSub') || '') : (call('ideasSub') || '');
  const searchTimer = useRef(null);

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    call('deselectIdea');
  }, []);

  const onSearch = (v) => {
    call('setNoteSearchQuiet', v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const n = notifyStore;
      if(typeof n === 'function') n();
      else if(typeof window !== 'undefined' && window.OperateReact?.refreshContentTab) window.OperateReact.refreshContentTab();
    }, 120);
  };

  return (
    <div className="tab-page" id="content-mode-page">
      <div className="tab-page-sticky">
        <div className="lg-header">
          <div>
            <div className="lg-title">Ideas / Notes</div>
            <div className="lg-sub" id="content-mode-sub">{sub}</div>
          </div>
          <div id="content-mode-actions">
            <button
              type="button"
              className="header-btn"
              onClick={() => isNotes ? call('sheetNoteAddChoice') : call('sheetIdea')}
            >
              <Icon name="plus" size={22} />
            </button>
          </div>
        </div>
        <div className="hub-bar">
          <div className="seg hub-seg" id="content-mode-seg">
            <button type="button" data-v="ideas" className={isNotes ? '' : 'on'} onClick={() => call('setContentMode', 'ideas')}>
              <Icon name="idea" size={15} /> Ideas
            </button>
            <button type="button" data-v="notes" className={isNotes ? 'on' : ''} onClick={() => call('setContentMode', 'notes')}>
              <Icon name="note" size={15} /> Notes
            </button>
          </div>
        </div>
      </div>
      <div className="screen-pad tab-page-body" id="content-mode-panel">
        {isNotes ? (
          <>
            <NotesControls search={noteSearch} onSearch={onSearch} />
            <div id="notes-list-body" style={{ marginTop: 8 }}>
              <NotesBody search={noteSearch} />
            </div>
          </>
        ) : (
          <>
            <IdeasControls filter={ideaFilter} />
            <div className="section" style={{ marginTop: 8 }}>
              <IdeasBody filter={ideaFilter} />
            </div>
          </>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
