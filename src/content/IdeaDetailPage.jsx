import { useSyncExternalStore } from 'react';
import { call, getIdeaTypes, getPrio, getSel, getStore, pad, relDay, subscribeStore, timeAgo } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function MissingIdea(){
  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Ideas
          </button>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="empty" style={{ marginTop: 24 }}>
          <div className="ic"><Icon name="idea" size={28} /></div>
          <b>Idea not found</b>
          <button type="button" className="btn secondary" style={{ marginTop: 14, maxWidth: 220 }} onClick={() => call('back')}>Go back</button>
        </div>
      </div>
    </>
  );
}

export default function IdeaDetailPage({ ideaId }){
  useStoreTick();
  const store = getStore();
  const idea = (store?.ideas || []).find(x => x.id === ideaId);
  if(!idea) return <MissingIdea />;

  const types = getIdeaTypes() || {};
  const PRIO = getPrio() || {};
  const t = types[idea.type] || types.other || { label: 'Idea', color: 'var(--accent-2)', icon: 'idea' };
  const sel = getSel();
  const linkedShow = idea.eventId && sel?.event ? sel.event(idea.eventId) : null;

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> Ideas
          </button>
          <button type="button" className="header-btn" style={{ width: 36, height: 36 }} onClick={() => call('confirmDeleteIdea', idea.id)}>
            <Icon name="trash" size={17} />
          </button>
        </div>
      </div>
      <div className="screen-pad">
        <div className="dhero" style={{ background: `linear-gradient(155deg,${t.color}33,var(--card) 65%)` }}>
          <div className="cat-bar" style={{ background: t.color }} />
          <div style={{ marginBottom: 8 }}>
            <span className="tag" style={{ background: `${t.color}22`, color: t.color }}>
              <Icon name={t.icon} size={13} /> {t.label}
            </span>
          </div>
          <h1 style={{ fontSize: 22 }}>{idea.title}</h1>
          <div className="meta-row">
            <span className="meta-chip">
              <span className="prio" style={{ background: PRIO[idea.prio] }} />
              {idea.prio} priority
            </span>
            <span className="meta-chip">
              <Icon name="clock" size={13} /> {timeAgo ? timeAgo(idea.created) : ''}
            </span>
          </div>
        </div>

        <div className="section" style={{ marginTop: 16 }}>
          <div className="card">
            <textarea
              className="textarea"
              placeholder="Add details, script, references…"
              defaultValue={idea.note || ''}
              key={`note-${idea.id}`}
              onBlur={e => call('saveIdeaNote', idea.id, e.target.value)}
            />
          </div>
        </div>

        <div className="block">
          <div className="block-title">Use it on</div>
          {(idea.eventId || idea.tripId) ? (
            <div className="card flush">
              {linkedShow ? (
                <div className="row" onClick={() => call('openView', 'event', idea.eventId)}>
                  <div className="ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent-2)' }}>
                    <Icon name="music" size={17} />
                  </div>
                  <div className="body">
                    <b>{linkedShow.venue}</b>
                    <span>{linkedShow.city} · {relDay ? relDay(linkedShow.date) : linkedShow.date}</span>
                  </div>
                  <button
                    type="button"
                    className="del"
                    style={{ opacity: 0.6 }}
                    onClick={e => { e.stopPropagation(); call('detachIdea', idea.id); }}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button type="button" className="btn secondary" onClick={() => call('attachIdeaTo', idea.id, 'event')}>
              <Icon name="music" size={15} /> Link to a show
            </button>
          )}
        </div>

        <div className="section">
          <button
            type="button"
            className={`btn ${idea.done ? 'secondary' : ''}`}
            onClick={() => call('toggleIdeaDone', idea.id)}
          >
            {idea.done ? <><Icon name="arrowUp" size={17} /> Mark as still to use</> : <><Icon name="check" size={18} /> Mark as done</>}
          </button>
        </div>
        <div className="section">
          <button type="button" className="btn secondary" onClick={() => call('editIdea', idea.id)}>
            <Icon name="edit" size={16} /> Edit idea
          </button>
        </div>
        <div className="section">
          <button type="button" className="btn danger" onClick={() => call('confirmDeleteIdea', idea.id)}>
            <Icon name="trash" size={17} /> Delete idea
          </button>
        </div>
        <div className="spacer" />
      </div>
    </>
  );
}
