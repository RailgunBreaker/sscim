import { useEffect, useMemo, useState } from 'react';
import snapshot from '../data/vault-snapshot.json';
import { getEventAssumption } from '../engine/event-assumptions.js';

/* Rolling headline strip for the landing and intro pages.

   Replaces a static line of ad copy with the actual event record — the same
   `events` the dashboard scores, newest first. It is the cheapest honest
   demonstration that there is a real dataset behind the product: a visitor
   sees dated, sourced headlines before they click anything.

   Two deliberate constraints:

   - The "not investment advice" notice does NOT scroll. It is a disclaimer,
     so it sits pinned at the left where it is always legible, and only the
     headlines move past it. A disclaimer that animates out of view is not a
     disclaimer.
   - Direction (adverse/mitigating) comes from the hand-curated assumption
     table, never from the headline text, and is carried by a text marker as
     well as colour so it survives colour-blindness and greyscale.

   Data: the build-time snapshot, so it works on the static deploy with no
   backend. When an API is reachable the newest events are fetched instead —
   same shape, fresher rows. */

const MAX_ITEMS = 14;
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

/* Two things here are load-bearing on small screens and easy to lose:

   `.nt-track{min-width:0}` — a flex item defaults to min-width:auto, which
   refuses to shrink below its content. The content is a rail several thousand
   pixels wide, so without this the strip forces the whole page wider than the
   viewport and the phone scrolls sideways.

   `flex:none` on the rail's copies and items — they are flex items too, and
   would otherwise shrink to fit instead of overflowing, compressing the
   headlines into an unreadable smear rather than scrolling them.

   Below 640px the label moves above the track rather than beside it: pinned
   alongside, it left roughly 80px of a 360px screen for the headlines. The
   disclaimer still never scrolls. */
const STYLE = `
  .nt{border-bottom:1px solid var(--line);background:var(--panel2);position:relative;font-size:11px;overflow:hidden}
  .nt-inner{display:flex;align-items:center;gap:0;width:100%;min-width:0}
  .nt-label{flex:none;padding:8px 12px 8px 0;color:var(--copper);letter-spacing:1.5px;font-size:9.5px;white-space:nowrap;z-index:2;background:var(--panel2)}
  .nt-label b{color:var(--dim);letter-spacing:.5px;font-weight:400}
  .nt-track{flex:1 1 auto;min-width:0;overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(90deg,transparent,#000 28px,#000 calc(100% - 46px),transparent);mask-image:linear-gradient(90deg,transparent,#000 28px,#000 calc(100% - 46px),transparent)}
  .nt-rail{display:flex;width:max-content;align-items:center;white-space:nowrap;will-change:transform;animation:nt-roll linear infinite}
  .nt-copy{display:flex;flex:none;align-items:center}
  .nt:hover .nt-rail,.nt:focus-within .nt-rail{animation-play-state:paused}
  .nt-item{display:inline-flex;flex:none;align-items:center;gap:7px;padding:8px 26px 8px 0;color:var(--dim)}
  .nt-date{color:var(--faint);font-size:9.5px;letter-spacing:.5px}
  .nt-mark{font-size:9px;letter-spacing:.5px}
  .nt-title{color:var(--text)}
  @keyframes nt-roll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @media(max-width:640px){
    .nt-inner{display:block}
    .nt-label{display:block;padding:7px 0 0;font-size:9px;letter-spacing:1.1px;white-space:normal}
    .nt-track{width:100%;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent)}
    .nt-item{padding:6px 20px 7px 0}
  }
  @media(prefers-reduced-motion:reduce){
    .nt-rail{animation:none;width:auto}
    .nt-track{overflow-x:auto;-webkit-overflow-scrolling:touch;-webkit-mask-image:none;mask-image:none}
    .nt-copy:nth-child(2){display:none}
  }
`;

function markerFor(id) {
  const a = getEventAssumption(id);
  if (!a?.operational) return { mark: '–', color: 'var(--faint)', label: 'context only' };
  if (a.direction === 'mitigating') return { mark: '▼', color: 'var(--green)', label: 'mitigating' };
  return { mark: '▲', color: 'var(--red)', label: 'adverse' };
}

export default function NewsTicker({ note = 'Not investment advice' }) {
  const [events, setEvents] = useState(() => snapshot.events || []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/events`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((live) => { if (!cancelled && Array.isArray(live) && live.length) setEvents(live); })
      .catch(() => { /* static deploy: the bundled snapshot is the whole story */ });
    return () => { cancelled = true; };
  }, []);

  const items = useMemo(() => (events || [])
    .filter((e) => e.title)
    .slice()
    .sort((a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0))
    .slice(0, MAX_ITEMS)
    .map((e) => ({ ...e, ...markerFor(e.id) })), [events]);

  if (!items.length) return null;

  /* The rail holds the list twice and translates by exactly -50%, so the
     second copy lands where the first began and the loop has no seam. Duration
     scales with item count to keep the reading speed constant. */
  const duration = Math.max(30, items.length * 5);
  const rail = (
    <span className="nt-rail" style={{ animationDuration: `${duration}s` }}>
      {[0, 1].map((copy) => (
        <span className="nt-copy" key={copy} aria-hidden={copy === 1}>
          {items.map((e) => (
            <span className="nt-item" key={`${copy}-${e.id}`}>
              <span className="nt-date">{e.date}</span>
              <span className="nt-mark" style={{ color: e.color }} title={e.label}>{e.mark}</span>
              <span className="nt-title">{e.title}</span>
            </span>
          ))}
        </span>
      ))}
    </span>
  );

  return (
    <div className="nt mono">
      <style>{STYLE}</style>
      <div className="wrap nt-inner">
        <span className="nt-label">SSCIM INTELLIGENCE <b>· {note}</b></span>
        <div className="nt-track" role="marquee" aria-label={`Recent supply-chain events, newest first. ${note}.`}>
          {rail}
        </div>
      </div>
    </div>
  );
}
