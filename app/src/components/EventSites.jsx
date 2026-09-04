import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { facilitiesForEvent, siteWeight } from '../engine/facilities.js';
import { flagEmoji } from '../data/glossary.js';
import Logo from './Logo.jsx';

/* ====================================================================
   EventSites — "which plants does this event actually sit on top of?"

   The event table records countries and stages, never coordinates: an
   export rule has no epicentre, and neither does a memory price move. So
   the footprint here is the intersection of the two tags the event does
   carry — the modeled sites in its countries that feed its stages. For a
   quake that is the physical cluster; for a policy it is the set of plants
   the rule reaches. Both are useful, and they are the same query.

   This is a LOOKUP, not a second impact model. Nothing here feeds the
   index; the numbers next to each site are that site's share of its
   stage's modeled sites, so a reader can see whether an event landed on
   one small plant or on the place where a third of a step is built.
   ==================================================================== */

const MAX_SHOWN = 8;

export default function EventSites({ event, setSel }) {
  const { data } = useVault();
  const { FACILITY_LAYER, COMPANY_BY_ID, COUNTRY_NAMES } = data;

  const sites = useMemo(
    () => facilitiesForEvent(event, FACILITY_LAYER),
    [event, FACILITY_LAYER],
  );

  if (!sites.length) return null;

  const shown = sites.slice(0, MAX_SHOWN);
  const stageIds = new Set(event.stages || []);

  return (
    <div style={{ marginTop: 10 }}>
      <div className="mono" style={{ fontSize: 12, color: C.dim, margin: '0 0 4px' }}>
        MODELED SITES IN THIS EVENT&apos;S FOOTPRINT ({sites.length})
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        {shown.map((f) => {
          const relevant = (f.stages || []).filter((sid) => stageIds.has(sid));
          const share = relevant.reduce((max, sid) => Math.max(max, FACILITY_LAYER.shareOfStage(f, sid)), 0);
          return (
            <div key={f.id} style={{ border: `1px solid ${C.line}`, borderRadius: 4, padding: '4px 8px', background: C.panel }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden style={{ fontSize: 12 }}>{flagEmoji(f.country)}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.text, lineHeight: 1.35 }}>{f.name}</span>
                <span className="mono" style={{ fontSize: 12, color: siteWeight(f) ? C.copper : C.faint }}>
                  {siteWeight(f) ? `${Math.round(share * 100)}%` : 'not yet running'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginTop: 1 }}>{f.output}</div>
              <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Logo cid={f.company} size={11} />
                <button type="button" onClick={() => setSel({ type: 'company', id: f.company })}
                  style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: C.copper, cursor: 'pointer' }}>
                  {COMPANY_BY_ID[f.company]?.name || f.company}
                </button>
                <span>· {COUNTRY_NAMES[f.country] || f.country} · {f.status}</span>
              </div>
            </div>
          );
        })}
      </div>
      {sites.length > MAX_SHOWN && (
        <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
          +{sites.length - MAX_SHOWN} more modeled site(s) in the same footprint.
        </div>
      )}
      <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 5, lineHeight: 1.6 }}>
        Sites whose country AND stage both match this event&apos;s tags. The percentage is the site&apos;s share of that
        stage&apos;s modeled sites — a curated sample scored on an analyst ordinal, not measured capacity. This list
        does not feed the index; it says where the event lands.
      </div>
    </div>
  );
}
