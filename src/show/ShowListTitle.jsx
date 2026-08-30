/** Overview: keep normal title layout; add a quieter glassy venue beside the event name. */
export function ShowListTitle({ show, statusTag = null, fallback = 'Untitled show' }){
  if(!show) return fallback;
  const eventName = String(show.eventName || '').trim();
  const venue = String(show.venue || '').trim();
  const primary = eventName || venue || fallback;
  return (
    <>
      {primary}
      {statusTag}
      {eventName && venue ? <>{' '}<span className="show-list-venue">{venue}</span></> : null}
    </>
  );
}
