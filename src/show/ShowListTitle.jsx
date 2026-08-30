/** Overview label: event name + optional glassy venue chip. */
export function ShowListTitle({ show, statusTag = null, fallback = 'Untitled show' }){
  if(!show) return fallback;
  const eventName = String(show.eventName || '').trim();
  const venue = String(show.venue || '').trim();
  const primary = eventName || venue || fallback;
  return (
    <span className="show-list-title">
      <span className="show-list-event">{primary}</span>
      {statusTag}
      {eventName && venue ? <span className="show-list-venue">{venue}</span> : null}
    </span>
  );
}
