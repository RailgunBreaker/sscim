import { C } from '../theme.js';
import { useWatchlist } from '../interaction/WatchlistContext.jsx';
import { WATCH_TYPE_LABEL, MAX_WATCHED } from '../interaction/watchlist.js';

/* One control, used wherever a trackable thing is on screen — a company, a
   stage, a facility, a route. Tracking is a per-reader preference, so it
   belongs next to the thing being read rather than behind a separate
   management screen: the moment you learn a supplier matters to you is the
   moment you want to follow it.

   Deliberately shows state rather than an action verb. "★ Tracking" tells
   you where you stand; "Untrack" would make you infer it. */
export default function TrackButton({ type, id, size = 'sm' }) {
  const { watching, toggle, full } = useWatchlist();
  if (!type || !id) return null;

  const on = watching({ type, id });
  const blocked = full && !on;
  const label = WATCH_TYPE_LABEL[type]?.toLowerCase() || type;
  const big = size === 'md';

  return (
    <button type="button" aria-pressed={on} disabled={blocked}
      onClick={() => toggle({ type, id })}
      title={blocked
        ? `Watchlist is full (${MAX_WATCHED}) — remove something first`
        : on ? `Stop tracking this ${label}` : `Track this ${label} on your watchlist`}
      style={{
        fontSize: big ? 11 : 10, padding: big ? '4px 10px' : '2px 8px', borderRadius: 4,
        fontFamily: 'inherit', cursor: blocked ? 'not-allowed' : 'pointer', minHeight: 0,
        background: on ? 'rgba(223,168,61,.16)' : 'transparent',
        color: on ? C.amber : blocked ? C.faint : C.dim,
        border: `1px solid ${on ? C.amber : C.line}`,
        fontWeight: on ? 700 : 400, opacity: blocked ? 0.5 : 1, whiteSpace: 'nowrap',
      }}>
      {on ? '★ Tracking' : '☆ Track'}
    </button>
  );
}
