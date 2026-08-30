import { showTitle } from '../api/operate.js';

/** Same bold title line: "event - venue" when both exist. */
export function ShowListTitle({ show, statusTag = null, fallback = 'Untitled show' }){
  return (
    <>
      {showTitle(show, fallback)}
      {statusTag}
    </>
  );
}
