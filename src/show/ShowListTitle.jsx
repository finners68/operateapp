/** Same title line as before: "event venue", with venue quieter. */
export function ShowListTitle({ show, statusTag = null, fallback = 'Untitled show' }){
  if(!show) return fallback;
  const eventName = String(show.eventName || '').trim();
  const venue = String(show.venue || '').trim();
  if(eventName && venue){
    return (
      <>
        {eventName}{statusTag}{' '}
        <span className="show-list-venue">{venue}</span>
      </>
    );
  }
  return (
    <>
      {eventName || venue || fallback}
      {statusTag}
    </>
  );
}
