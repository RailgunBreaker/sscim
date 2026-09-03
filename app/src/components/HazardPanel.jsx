import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { footprintToDraftSources, footprintToHazardScenario, DISPLAY_EXPOSURE_THRESHOLD, siteWeight } from '../engine/facilities.js';
import { linksSeveredBy } from '../engine/facilityNetwork.js';
import { flagEmoji } from '../data/glossary.js';
import { pct, fmtSigned } from '../interaction/lensEncoding.js';

/* ====================================================================
   HazardPanel — the readout for "something happened HERE; what does it
   touch?"

   A country marker cannot answer that question, because a hazard happens
   at a point. This panel takes the epicentre and radius drawn on the map
   and reports three separate things, deliberately kept apart:

     1. WHICH PLANTS are inside the radius, named, with operator, distance
        and what they make. This is the part that is closest to fact.
     2. HOW MUCH OF EACH STAGE sits inside it — as a share of the modeled
        site sample, never of world capacity, because `scale` is an analyst
        ordinal and pretending otherwise would manufacture precision.
     3. WHAT THE MODEL WOULD DO with it — handed to the same scenario
        composer every preset uses, so the Δ is computed by the identical
        propagation engine rather than by a second implementation here.

   EVERY stage with a nonzero footprint is shocked, in PROPORTION to that
   footprint. DISPLAY_EXPOSURE_THRESHOLD only dims a row so the eye goes to
   the material ones first — it does not gate anything the model computes.
   (In v6 it did: below 5% a stage scored nothing and above 5% it scored a
   full-severity shock, so 4.99% and 100% were the two available answers.)
   ==================================================================== */

export default function HazardPanel({ footprint, radiusKm, onRadiusChange, onClear, onApplyHazard }) {
  const { data, engine } = useVault();
  const { COMPANY_BY_ID, COUNTRY_NAMES, FACILITY_LAYER, FACILITY_NETWORK } = data;
  const { STAGE_BY_ID } = engine;
  const { setSel } = useInteraction();
  const [severity, setSeverity] = useState(6);

  const sources = useMemo(() => footprintToDraftSources(footprint), [footprint]);
  const hits = footprint?.hits || [];

  /* The network answer to "what does this cut", as distinct from the stage
     answer above it: links with at least one endpoint inside the radius. */
  const severed = useMemo(
    () => linksSeveredBy(FACILITY_NETWORK, hits.map((h) => h.facility.id)),
    [FACILITY_NETWORK, hits],
  );
  const severedPartners = useMemo(() => {
    const inside = new Set(hits.map((h) => h.facility.id));
    const seen = new Map();
    severed.forEach((l) => {
      const otherId = inside.has(l.from) ? l.to : l.from;
      if (inside.has(otherId)) return; // both ends inside: not an external cut
      const prev = seen.get(otherId) || 0;
      seen.set(otherId, prev + (l.rel ?? 0));
    });
    return [...seen.entries()]
      .map(([id, weight]) => ({ facility: FACILITY_LAYER.FACILITY_BY_ID[id], weight }))
      .filter((x) => x.facility)
      .sort((a, b) => b.weight - a.weight);
  }, [severed, hits, FACILITY_LAYER]);

  const applyHazard = () => {
    if (!sources.length || !onApplyHazard) return;
    onApplyHazard(footprintToHazardScenario(footprint, { severity }));
  };

  const stageRow = (s, material) => (
    <li key={s.stageId} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '3px 7px', borderRadius: 4,
      border: `1px solid ${material ? C.line : 'transparent'}`,
      background: material ? C.panel : 'transparent', opacity: material ? 1 : 0.55,
    }}>
      <span style={{ flex: 1, fontSize: 11, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {STAGE_BY_ID[s.stageId]?.name || s.stageId}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: material ? C.copper : C.faint }}>{pct(s.exposure)}</span>
      <span className="mono" style={{ fontSize: 9, color: C.faint, width: 62, textAlign: 'right' }}>
        {s.sites.length} site{s.sites.length === 1 ? '' : 's'}
      </span>
    </li>
  );

  const material = footprint?.displayStages || [];
  const minor = footprint?.minorStages || [];

  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel2, padding: '9px 11px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: 1.2, color: C.amber }}>⌖ HAZARD FOOTPRINT</span>
        <span className="mono" style={{ fontSize: 10, color: C.dim }}>
          {footprint.center.lat.toFixed(2)}°, {footprint.center.lng.toFixed(2)}°
        </span>
        <label className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.dim }}>
          RADIUS
          <input type="range" min="25" max="800" step="25" value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            aria-label="Hazard radius in kilometres" style={{ width: 110, accentColor: C.amber }} />
          <b style={{ color: C.amber }}>{radiusKm} km</b>
        </label>
        <button type="button" onClick={onClear}
          style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', color: C.dim, border: `1px solid ${C.line}` }}>
          Clear
        </button>
      </div>

      {!hits.length ? (
        <div className="mono" style={{ fontSize: 10, color: C.faint, marginTop: 8, lineHeight: 1.6 }}>
          No modeled site within {radiusKm} km. That means none is in this curated sample — not that none exists.
          Widen the radius, or move the epicentre onto a cluster.
        </div>
      ) : (
        <>
          <div className="mono" style={{ fontSize: 10, color: C.dim, marginTop: 7, lineHeight: 1.6 }}>
            <b style={{ color: C.text }}>{hits.length}</b> modeled site{hits.length === 1 ? '' : 's'} inside the radius ·{' '}
            {footprint.countries.map((c) => `${flagEmoji(c)} ${COUNTRY_NAMES[c] || c}`).join(', ')} ·{' '}
            <b style={{ color: C.text }}>{footprint.companies.length}</b> operator{footprint.companies.length === 1 ? '' : 's'}
          </div>

          {/* --- the plants themselves --- */}
          <ul style={{ listStyle: 'none', margin: '7px 0 0', padding: 0, maxHeight: 150, overflowY: 'auto', display: 'grid', gap: 3 }}>
            {hits.map(({ facility, distanceKm }) => (
              <li key={facility.id} style={{ border: `1px solid ${C.line}`, borderRadius: 4, padding: '4px 8px', background: C.panel }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ flex: 1, fontSize: 11, color: C.text }}>{facility.name}</span>
                  <span className="mono" style={{ fontSize: 9.5, color: C.faint }}>{Math.round(distanceKm)} km</span>
                </div>
                <div style={{ fontSize: 9.5, color: C.dim, lineHeight: 1.5, marginTop: 1 }}>{facility.output}</div>
                <div className="mono" style={{ fontSize: 9, color: C.faint, marginTop: 2 }}>
                  <button type="button" onClick={() => setSel({ type: 'company', id: facility.company })}
                    style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: C.copper, cursor: 'pointer' }}>
                    {COMPANY_BY_ID[facility.company]?.name || facility.company}
                  </button>
                  {' · '}{facility.status}{siteWeight(facility) === 0 ? ' · nothing to lose yet' : ''}
                </div>
              </li>
            ))}
          </ul>

          {/* --- stage exposure --- */}
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, margin: '9px 0 4px' }}>
            SHARE OF EACH STAGE&apos;S MODELED SITES INSIDE THE RADIUS
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {material.map((s) => stageRow(s, true))}
            {minor.map((s) => stageRow(s, false))}
          </ul>
          <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 4, lineHeight: 1.6 }}>
            Each stage is shocked in proportion to the share shown — a modeled facility footprint, not a capacity share and
            not physical damage.{minor.length > 0 && ` Dimmed rows sit below the ${pct(DISPLAY_EXPOSURE_THRESHOLD)} display threshold; they are still scored, just small.`}
          </div>

          {/* --- what the radius cuts in the site network --- */}
          {severedPartners.length > 0 && (
            <>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, margin: '9px 0 4px' }}>
                MODELED LINKS SEVERED ({severed.length}) · SITES OUTSIDE THE RADIUS ON THE OTHER END
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2, maxHeight: 108, overflowY: 'auto' }}>
                {severedPartners.slice(0, 10).map(({ facility, weight }) => (
                  <li key={facility.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 7px', border: `1px solid ${C.line}`, borderRadius: 4 }}>
                    <span aria-hidden style={{ fontSize: 10 }}>{flagEmoji(facility.country)}</span>
                    <button type="button" onClick={() => setSel({ type: 'facility', id: facility.id })}
                      style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, font: 'inherit', fontSize: 10.5, color: C.text, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {facility.name}
                    </button>
                    <span className="mono" style={{ fontSize: 9.5, color: C.copper }}>{pct(Math.min(1, weight))}</span>
                  </li>
                ))}
              </ul>
              <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 4, lineHeight: 1.6 }}>
                Modeled links, not shipment routes — company revenue share × site shares × the input-dependence prior.
                The figure is the partner&apos;s summed link strength relative to the strongest modeled link, not a volume.
              </div>
            </>
          )}

          {/* --- hand off to the engine --- */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 9, flexWrap: 'wrap' }}>
            <label className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.dim }}>
              SEVERITY <b style={{ color: C.amber, fontSize: 12 }}>{severity}</b>
              <input type="range" min="1" max="10" value={severity} onChange={(e) => setSeverity(Number(e.target.value))}
                aria-label="Hazard severity" style={{ width: 90, accentColor: C.amber }} />
            </label>
            <button type="button" onClick={applyHazard} disabled={!sources.length || !onApplyHazard}
              title={sources.length ? 'Run this hazard through the propagation engine and show its Δ on the index' : 'No stage is exposed enough to shock'}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, fontFamily: 'inherit',
                cursor: sources.length ? 'pointer' : 'not-allowed', fontWeight: 700,
                background: sources.length ? C.amber : 'transparent', color: sources.length ? '#0C111C' : C.faint,
                border: `1px solid ${sources.length ? C.amber : C.line}`, opacity: sources.length ? 1 : 0.5 }}>
              Apply hazard impact ({sources.length} stage{sources.length === 1 ? '' : 's'})
            </button>
            <span className="mono" style={{ fontSize: 9, color: C.faint, flex: '1 1 200px', lineHeight: 1.6 }}>
              Runs through the same propagation engine as every recorded event. Severity is yours to set: this panel
              says what is exposed, never how hard it was hit.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* Small helper re-exported for the map legend, kept here so the wording of a
   facility's current reading lives next to the panel that explains it. */
export function facilityImpactLine(value) {
  if (!value) return 'No active operational effect at this site’s stages.';
  return `Current operational effect at this site’s stages: ${fmtSigned(value)}`;
}
