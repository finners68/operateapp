import { call, getPassFileAccept, iconHtml, isOpen as foldIsOpen, notifyStore } from '../api/operate.js';

export function Icon({ name, size = 16 }){
  return <span dangerouslySetInnerHTML={{ __html: iconHtml(name, size) }} />;
}

export function LegacyHtml({ html, className }){
  if(!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function isOpen(id, def){
  return !!foldIsOpen(id, def);
}

export function setFold(id, open){
  if(typeof window === 'undefined') return;
  if(typeof window.setFoldOpen === 'function') window.setFoldOpen(id, open);
  else if(window.folds) window.folds[id] = open;
  notifyStore();
}

export function Group({ id, title, icon, summary, defaultOpen = true, children }){
  const open = isOpen(id, defaultOpen);
  return (
    <section className={`show-group ${open ? 'open' : ''}`} id={`fold-${id}`}>
      <div
        className="show-group-head"
        role="button"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setFold(id, !open)}
      >
        <div className="show-group-ic" dangerouslySetInnerHTML={{ __html: icon }} />
        <div className="show-group-titles">
          <b>{title}</b>
          {summary ? <span>{summary}</span> : null}
        </div>
        <span
          className="fold-chev show-group-chev"
          dangerouslySetInnerHTML={{ __html: iconHtml('chevDown', 20) || iconHtml('chevR', 20) }}
        />
      </div>
      {open ? <div className="show-group-body">{children}</div> : null}
    </section>
  );
}

export function Subsection({ id, title, addLabel, onAdd, defaultOpen = false, children }){
  const open = isOpen(id, defaultOpen);
  return (
    <div className={`show-subsection ${open ? 'open' : ''}`} id={`fold-${id}`}>
      <div
        className="show-subsection-head"
        role="button"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setFold(id, !open)}
      >
        <span>{title}</span>
        <div className="show-subsection-actions" onClick={e => e.stopPropagation()}>
          {onAdd ? (
            <button type="button" className="add" onClick={onAdd}>{addLabel || 'Add'}</button>
          ) : null}
          <span
            className="fold-chev show-subsection-chev"
            onClick={e => { e.stopPropagation(); setFold(id, !open); }}
            dangerouslySetInnerHTML={{ __html: iconHtml('chevDown', 16) || iconHtml('chevR', 16) }}
          />
        </div>
      </div>
      {open ? <div className="show-subsection-body">{children}</div> : null}
    </div>
  );
}

export function EmptyTap({ icon, title, sub, onClick }){
  return (
    <div
      className="card tap"
      style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20, fontWeight: 600 }}
      onClick={onClick}
    >
      <Icon name={icon} size={22} />
      {title ? <div style={{ marginTop: 6, fontWeight: 600 }}>{title}</div> : null}
      {sub ? <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500 }}>{sub}</div> : null}
    </div>
  );
}

export function SourceLabel({ text }){
  if(!text) return null;
  return <div className="show-source-label">{text}</div>;
}

export function FieldTx({ label, value, children }){
  return (
    <div className="tx">
      <div className="k">{label}</div>
      <div className="v">{children != null ? children : value}</div>
    </div>
  );
}

export function DetailTx({ title, primary, meta }){
  return (
    <div className="tx" style={{ flex: 1, minWidth: 0 }}>
      <div className="detail-title">{title}</div>
      {primary ? <div className="detail-primary">{primary}</div> : null}
      {meta ? <div className="detail-meta">{meta}</div> : null}
    </div>
  );
}

export function passAccept(){
  return getPassFileAccept() || 'image/*,application/pdf';
}
