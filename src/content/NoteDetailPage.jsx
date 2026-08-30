import { useSyncExternalStore } from 'react';
import { call, getSel, getStore, pad, subscribeStore, timeAgo } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function MissingNote(){
  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Notes
          </button>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="empty" style={{ marginTop: 24 }}>
          <div className="ic"><Icon name="note" size={28} /></div>
          <b>Note not found</b>
          <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('back')}>Go back</button>
        </div>
      </div>
    </>
  );
}

export default function NoteDetailPage({ noteId }){
  useStoreTick();
  const store = getStore();
  const sel = getSel();
  const note = (sel?.notes ? sel.notes() : []).find(x => x.id === noteId)
    || (store?.notes || []).find(x => x.id === noteId);
  if(!note) return <MissingNote />;
  const folderLabel = note.folderId
    ? ((sel?.noteFolder ? sel.noteFolder(note.folderId) : null)?.name || note.folder || 'Folder')
    : 'No folder';

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('saveNoteAndBack', note.id)}>
            <Icon name="chevL" size={20} /> Notes
          </button>
          <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('confirmDeleteNote', note.id)}>
            <Icon name="trash" size={17} />
          </button>
        </div>
      </div>
      <div className="screen-pad">
        <input
          id="note-title"
          className="input"
          style={{ fontSize: 24, fontWeight: 800, border: 'none', background: 'none', padding: '8px 2px' }}
          placeholder="Title"
          defaultValue={note.title || ''}
          key={`title-${note.id}`}
          onChange={e => call('liveNoteTitle', note.id, e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 2px 10px' }}>
          <span style={{ color: 'var(--text-3)' }}><Icon name="folder" size={15} /></span>
          <button
            type="button"
            className="btn secondary"
            style={{ fontSize: 13, padding: '6px 12px', borderRadius: 9, flex: 1, justifyContent: 'flex-start', textAlign: 'left' }}
            onClick={() => call('sheetMoveNoteToFolder', note.id)}
          >
            {folderLabel}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo ? timeAgo(note.updated) : ''}</span>
        </div>
        <textarea
          id="note-body"
          className="textarea"
          style={{ minHeight: '60dvh', fontSize: 16.5, border: 'none', background: 'none', padding: 2 }}
          placeholder="Start writing…"
          defaultValue={note.body || ''}
          key={`body-${note.id}`}
          onChange={e => call('liveNoteBody', note.id, e.target.value)}
        />
      </div>
    </>
  );
}
