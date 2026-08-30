import { useSyncExternalStore } from 'react';
import { getStore, subscribeStore, call, g } from '../show/bridge.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function NoteRow({ note }){
  const timeAgo = g('timeAgo');
  const preview = (note.body || '').split('\n').filter(Boolean)[0] || 'No additional text';
  return (
    <div className="note-row" onClick={() => call('openView', 'note', note.id)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ flex: 1 }}>{note.title || 'Untitled'}</b>
      </div>
      <span className="meta">
        <span className="dt">{timeAgo ? timeAgo(note.updated) : ''}</span> · {preview.slice(0, 60)}
      </span>
    </div>
  );
}

function MissingFolder(){
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
          <div className="ic"><Icon name="folder" size={28} /></div>
          <b>Folder not found</b>
          <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('back')}>Go back</button>
        </div>
      </div>
    </>
  );
}

export default function NoteFolderPage({ folderId }){
  useStoreTick();
  const sel = g('sel');
  const folder = sel?.noteFolder ? sel.noteFolder(folderId) : null;
  if(!folder) return <MissingFolder />;
  const list = sel?.notesInFolder ? sel.notesInFolder(folderId) : [];

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Notes
          </button>
          <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('sheetNoteAddChoice', folder.id)}>
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>
      <div className="screen-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 2px 14px' }}>
          <div className="ic" style={{ background: 'var(--card-2)', color: 'var(--text-2)', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="folder" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{folder.name || 'Folder'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{list.length} note{list.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {list.length ? (
          <div className="card flush">
            {list.map(n => <NoteRow key={n.id} note={n} />)}
          </div>
        ) : (
          <div className="empty">
            <div className="ic"><Icon name="note" size={28} /></div>
            <b>Empty folder</b>
            <span>Tap + to add a note here.</span>
            <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('sheetNoteAddChoice', folder.id)}>
              <Icon name="plus" size={18} /> Add
            </button>
          </div>
        )}
      </div>
    </>
  );
}
