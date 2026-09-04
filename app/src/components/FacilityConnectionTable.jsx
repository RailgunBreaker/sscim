import { useMemo, useState, useEffect } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { pct } from '../interaction/lensEncoding.js';
import { FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import {
  edgesOf, linkKey, localScale, localRel, relationshipClass, evidenceTier,
} from '../engine/facilityTraversal.js';

/* ====================================================================
   FacilityConnectionTable — every modeled connection of one plant, with
   nothing hidden behind a silent cap.

   THE DEFECT THIS REPLACES. The old explorer sliced each direction at
   `MAX_ROWS = 40` and the graph beside it said "the list below has all of
   them". For TSMC Fab 18 that produced a verified contradiction: the
   header reported 53 inbound suppliers, the graph drew the strongest 14,
   and the list showed 40 — so thirteen real modeled relationships were
   unreachable through the interface while the caption asserted
   completeness.

   THE RULE HERE. A page cap still exists, because rendering 891 rows of
   flag-plus-name is slow and unreadable. What changed is that the cap is
   never silent and never terminal:
     · the heading states the exact numbers — "40 of 53";
     · "Show all 53" is one click away and reveals the remainder;
     · search and filters narrow the set rather than truncating it, and
       the count updates to match.
   Every one of a facility's connections is reachable from this table.

   PERCENTAGE SCALE. This table reports the SNAPSHOT-wide scale
   (`link.rel` — share of the strongest modeled link anywhere in the
   dataset) and says so in its own heading, because that is the scale on
   which the numbers are comparable between plants. The graph reports the
   LOCAL scale. Both are labelled at the point of use; they are different
   questions and must never be read as the same number.
   ==================================================================== */

const PAGE = 40;

export default function FacilityConnectionTable({
  facilityId,
  onFocus,
  onSelect,
  onSelectLink,
  selectedLink = null,
  linkFilter = null,
  compact = false,
}) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const byId = FACILITY_LAYER.FACILITY_BY_ID;

  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [dir, setDir] = useState('all');   // all | upstream | downstream

  // A new plant is a new question; do not carry the previous plant's
  // search term or "show all" over onto it.
  useEffect(() => { setQuery(''); setShowAll(false); setDir('all'); }, [facilityId]);

  const scale = useMemo(() => localScale(FACILITY_NETWORK, facilityId), [FACILITY_NETWORK, facilityId]);

  const all = useMemo(() => {
    const rows = edgesOf(FACILITY_NETWORK, facilityId).map((e) => {
      const other = byId[e.otherId];
      return {
        ...e,
        other,
        key: linkKey(e.link),
        cls: relationshipClass(e.link),
        tier: evidenceTier(e.link),
        haystack: [
          other?.name, COMPANY_BY_ID[other?.company]?.name || other?.company,
          COUNTRY_NAMES[other?.country] || other?.country,
          STAGE_BY_ID[e.link.fromStage]?.name, STAGE_BY_ID[e.link.toStage]?.name,
          FACILITY_KIND_LABEL[other?.kind] || other?.kind, e.link.flow, other?.status,
        ].filter(Boolean).join(' ').toLowerCase(),
      };
    }).filter((r) => r.other);
    rows.sort((a, b) => (b.link.weight || 0) - (a.link.weight || 0));
    return rows;
  }, [FACILITY_NETWORK, facilityId, byId, COMPANY_BY_ID, COUNTRY_NAMES, STAGE_BY_ID]);

  const totalUp = all.filter((r) => r.dir === 'upstream').length;
  const totalDown = all.filter((r) => r.dir === 'downstream').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (dir !== 'all' && r.dir !== dir) return false;
      if (linkFilter && !linkFilter(r.link, { dir: r.dir, otherId: r.otherId })) return false;
      if (q && !r.haystack.includes(q)) return false;
      return true;
    });
  }, [all, query, dir, linkFilter]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE);
  const hiddenCount = filtered.length - visible.length;

  if (!all.length) {
    return (
      <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.7 }}>
        No modeled link touches this plant. That happens when its operator has no customer edge in the sample, or when
        no stage it feeds reaches a customer&apos;s stage — not that the site is unconnected in reality.
      </div>
    );
  }

  return (
    <div>
      <div className="mono" style={{ fontSize: 12, color: C.faint, margin: '0 0 6px' }}>
        ALL MODELED CONNECTIONS — {totalUp} INBOUND · {totalDown} OUTBOUND
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 7 }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search these connections…" aria-label="Search this facility's connections"
          style={{ flex: '1 1 160px', minWidth: 120, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, fontFamily: 'inherit', fontSize: 12, padding: '5px 8px' }} />
        <div role="group" aria-label="Filter by direction" style={{ display: 'flex', gap: 4 }}>
          {[['all', 'Both'], ['upstream', 'Inbound'], ['downstream', 'Outbound']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setDir(k)} aria-pressed={dir === k}
              style={{ ...chipStyle, borderColor: dir === k ? C.copper : C.line, color: dir === k ? C.copper : C.dim }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The count sentence. Never "showing some of them" — always the two
          exact numbers, and the control that closes the gap. */}
      <div className="mono" aria-live="polite" style={{ fontSize: 12, color: hiddenCount ? C.amber : C.faint, marginBottom: 6, lineHeight: 1.6 }}>
        {hiddenCount > 0
          ? `Showing ${visible.length} of ${filtered.length} matching connections.`
          : `Showing all ${filtered.length} matching connection${filtered.length === 1 ? '' : 's'}${filtered.length !== all.length ? ` of ${all.length} total` : ''}.`}
        {hiddenCount > 0 && (
          <button type="button" onClick={() => setShowAll(true)} style={{ ...chipStyle, marginLeft: 8, borderColor: C.copper, color: C.copper }}>
            Show all {filtered.length}
          </button>
        )}
        {showAll && filtered.length > PAGE && (
          <button type="button" onClick={() => setShowAll(false)} style={{ ...chipStyle, marginLeft: 8 }}>
            Show first {PAGE}
          </button>
        )}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
        {visible.map((r) => {
          const isSel = selectedLink === r.key;
          const stageFrom = STAGE_BY_ID[r.link.fromStage]?.name || r.link.fromStage;
          const stageTo = STAGE_BY_ID[r.link.toStage]?.name || r.link.toStage;
          return (
            <li key={r.key}>
              <div style={{
                border: `1px solid ${isSel ? C.copper : C.line}`, background: isSel ? '#1A2132' : C.panel,
                borderRadius: 4, padding: '5px 8px', display: 'flex', alignItems: 'flex-start', gap: 7, flexWrap: 'wrap',
              }}>
                <span aria-hidden style={{ fontSize: 12, marginTop: 1 }}>{flagEmoji(r.other.country)}</span>
                <button type="button" onClick={() => onFocus?.(r.otherId)}
                  style={{ flex: '1 1 140px', minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, color: C.text, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', minHeight: 0 }}
                  aria-label={`Centre the network on ${r.other.name}`}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.other.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: C.faint, display: 'block', lineHeight: 1.5 }}>
                    {COMPANY_BY_ID[r.other.company]?.name || r.other.company}
                    {' · '}{r.dir === 'upstream' ? `${stageFrom} → ${stageTo}` : `${stageFrom} → ${stageTo}`}
                    {' · '}{r.cls.short}
                    {' · '}{r.tier.label.toLowerCase()}
                  </span>
                </button>
                <span className="mono" style={{ fontSize: 12, color: r.dir === 'upstream' ? C.copper : C.green, whiteSpace: 'nowrap' }}
                  title={r.dir === 'upstream' ? 'This plant is the customer of that one, in the modeled relationship.' : 'This plant is the supplier to that one, in the modeled relationship.'}>
                  {r.dir === 'upstream' ? '← in' : 'out →'}
                </span>
                <span className="mono" style={{ fontSize: 12, color: C.dim, width: 46, textAlign: 'right' }}
                  title="Strength on the SNAPSHOT-wide scale: share of the strongest modeled link anywhere in the dataset. The graph above uses this plant's own scale — the two numbers are not comparable.">
                  {pct(r.link.rel ?? 0)}
                </span>
                <span className="mono" style={{ fontSize: 12, color: C.faint, width: 44, textAlign: 'right' }}
                  title={`Strength on the LOCAL scale: share of ${byId[facilityId]?.name || 'this plant'}'s strongest modeled link. This is the number the graph draws.`}>
                  {pct(localRel(r.link, scale))}
                </span>
                {onSelectLink && (
                  <button type="button" onClick={() => onSelectLink(r.key)} style={chipStyle}
                    aria-label={`Explain the modeled relationship with ${r.other.name}`}>
                    Why?
                  </button>
                )}
                {onSelect && !compact && (
                  <button type="button" onClick={() => onSelect({ type: 'facility', id: r.otherId })} style={chipStyle}
                    aria-label={`Open the full profile of ${r.other.name}`}>
                    Profile
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!filtered.length && (
        <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, padding: '6px 0' }}>
          No connection matches the current search and filters. {all.length} connection{all.length === 1 ? '' : 's'} exist
          for this plant — clear the filters to see them.
        </div>
      )}

      <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.65 }}>
        Two strength columns, two different scales, both labelled: the first is the share of the strongest modeled link
        in the whole snapshot, the second the share of this plant&apos;s own strongest link (the scale the graph draws).
        They are not comparable to each other. Every row is a modeled stage-mediated relationship — company-level
        supplier-revenue share × each site&apos;s share of its stage × the engine&apos;s reach prior — and never a
        confirmed shipment, customer contract or trade route.
      </div>
    </div>
  );
}

const chipStyle = {
  fontSize: 12, padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0,
};
