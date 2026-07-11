import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { deriveAnalysisGraph, weightedDegree, reachableSet } from '../engine/networkOps.js';
import { betweenness, nodeRemovalImpact } from '../engine/networkAnalysis.js';

/* ================= Comparison workspace (§31) ==========================
   Compares up to four pinned functional centres side by side across the
   measures that are meaningful for a centre (no irrelevant metrics). Values
   are modeled / topology measures over the current analysis graph — not
   calibrated risk. Highest value per row is emphasized. */

const ROWS = [
  { id: 'share', label: 'Country share of stage', fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { id: 'structural', label: 'Structural score (stage)', fmt: (v) => v.toFixed(1) },
  { id: 'influence', label: 'Network influence (stage)', fmt: (v) => v.toFixed(1) },
  { id: 'degIn', label: 'Weighted in-degree', fmt: (v) => v.toFixed(3) },
  { id: 'degOut', label: 'Weighted out-degree', fmt: (v) => v.toFixed(3) },
  { id: 'reachUp', label: 'Upstream reach (centres)', fmt: (v) => String(v) },
  { id: 'reachDown', label: 'Downstream reach (centres)', fmt: (v) => String(v) },
  { id: 'betw', label: 'Betweenness (topology)', fmt: (v) => v.toFixed(4) },
  { id: 'removalLost', label: 'Removal impact (lost pairs)', fmt: (v) => String(v) },
];

export default function NetworkComparePanel({ baseGraph }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const { state, cmpToggle, cmpClear, select } = useInteraction();
  const { comparison, playground } = state;

  const analysis = useMemo(
    () => deriveAnalysisGraph(baseGraph, { removedNodeIds: playground.removedNodeIds, removedEdgeIds: playground.removedEdgeIds }),
    [baseGraph, playground.removedNodeIds, playground.removedEdgeIds]
  );
  const centres = comparison.filter((c) => c.type === 'centre').map((c) => c.id);
  const btMap = useMemo(() => (centres.length ? betweenness(analysis) : {}), [analysis, centres.length ? centres.join(',') : '']); // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(() => centres.map((id) => {
    const c = baseGraph.centreById[id];
    if (!c) return null;
    const removal = nodeRemovalImpact(baseGraph, id, (b, o) => deriveAnalysisGraph(b, o));
    return {
      id,
      centre: c,
      values: {
        share: c.countryShare,
        structural: c.structuralScore,
        influence: c.networkInfluence,
        degIn: weightedDegree(analysis, id, 'upstream'),
        degOut: weightedDegree(analysis, id, 'downstream'),
        reachUp: reachableSet(analysis, id, 'upstream').size,
        reachDown: reachableSet(analysis, id, 'downstream').size,
        betw: btMap[id] ?? 0,
        removalLost: removal.lostReachablePairs,
      },
    };
  }).filter(Boolean), [centres, analysis, baseGraph, btMap]);

  if (!comparison.length) return null;

  return (
    <div style={{ padding: 10, borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper }}>COMPARISON WORKSPACE · {cols.length}/4</span>
        <button type="button" onClick={cmpClear} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
      </div>

      {cols.length < 2 && <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 6 }}>Add another centre (centre detail → “Add to comparison”) to compare side by side.</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '3px 6px', color: C.faint, fontWeight: 400 }} className="mono"></th>
              {cols.map((col) => (
                <th key={col.id} style={{ padding: '3px 6px', textAlign: 'right', minWidth: 96 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <button type="button" onClick={() => select({ type: 'centre', id: col.id })}
                      style={{ background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 600, padding: 0, textAlign: 'right' }}>
                      {flagEmoji(col.centre.countryId)} {STAGE_BY_ID[col.centre.stageId]?.name || col.centre.stageId}
                    </button>
                    <button type="button" aria-label="Remove from comparison" onClick={() => cmpToggle({ type: 'centre', id: col.id })}
                      style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
                  </div>
                  <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>{COUNTRY_NAMES[col.centre.countryId] || col.centre.countryId}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const vals = cols.map((col) => col.values[row.id]);
              const max = Math.max(...vals);
              return (
                <tr key={row.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="mono" style={{ padding: '3px 6px', color: C.faint, fontSize: 9.5 }}>{row.label}</td>
                  {cols.map((col, i) => {
                    const v = col.values[row.id];
                    const isMax = cols.length > 1 && v === max && v > 0;
                    return <td key={col.id} style={{ padding: '3px 6px', textAlign: 'right', color: isMax ? C.copper : C.text, fontWeight: isMax ? 700 : 400 }} className="mono">{row.fmt(v)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mono" style={{ fontSize: 8.5, color: C.faint, lineHeight: 1.6, marginTop: 6 }}>
        Modeled / topology measures over the current (post-removal) graph — betweenness and removal impact are graph-structure sensitivities, not calibrated risk or economic-loss estimates.
      </div>
    </div>
  );
}
