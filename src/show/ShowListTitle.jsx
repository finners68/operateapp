/** Overview: bold event name, quieter venue to the right. */
export function ShowListTitle({ show, statusTag = null, fallback = 'Untitled show' }){
  if(!show) return fallback;
  const eventName = String(show.eventName || '').trim();
  const venue = String(show.venue || '').trim();
  if(eventName && venue){
    return (
      <>
        <span className="show-list-event">{eventName}</span>
        {statusTag}
        <span className="show-list-venue">{venue}</span>
      </>
    );
  }
  return (
    <>
      <span className="show-list-event">{eventName || venue || fallback}</span>
      {statusTag}
    </>
  );
}
