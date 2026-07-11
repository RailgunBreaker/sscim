import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { deriveAnalysisGraph } from '../engine/networkOps.js';
import { METRICS, metricValues, rankByMetric, betweenness, nodeRemovalImpact, edgeCriticalityImpact } from '../engine/networkAnalysis.js';

/* ================= Network analysis mode (§21–§23) =====================
   Topology / graph-structure metrics over the functional-centre network,
   each shown with its plain-language question and an explicit limitation
   (§22 guardrails). These are NOT calibrated risk or economic-loss
   estimates, and generic centrality is kept separate from SSCIM's
   propagation-based network influence. Nothing is folded into a hidden
   composite score. */
export default function NetworkAnalysisPanel({ baseGraph }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const { state, select, setMetric } = useInteraction();
  const { selected, playground, analysisMetric } = state;

  const analysis = useMemo(
    () => deriveAnalysisGraph(baseGraph, { removedNodeIds: playground.removedNodeIds, removedEdgeIds: playground.removedEdgeIds }),
    [baseGraph, playground.removedNodeIds, playground.removedEdgeIds]
  );

  const metric = analysisMetric || 'degree_out';
  const meta = METRICS.find((m) => m.id === metric) || METRICS[0];

  const btMap = useMemo(() => (metric === 'betweenness' || metric === 'removal_impact' ? betweenness(analysis) : null), [analysis, metric]);
  const values = useMemo(() => metricValues(analysis, metric === 'removal_impact' ? 'betweenness' : metric, { betweenness: btMap }), [analysis, metric, btMap]);
  const ranked = useMemo(() => rankByMetric(values).slice(0, 12), [values]);

  const centreName = (id) => {
    const c = baseGraph.centreById[id];
    return c ? `${flagEmoji(c.countryId)} ${COUNTRY_NAMES[c.countryId] || c.countryId} · ${STAGE_BY_ID[c.stageId]?.name || c.stageId}` : id;
  };

  const removal = useMemo(
    () => (selected?.type === 'centre' ? nodeRemovalImpact(baseGraph, selected.id, (b, o) => deriveAnalysisGraph(b, o)) : null),
    [baseGraph, selected]
  );
  const edgeCrit = useMemo(
    () => (selected?.type === 'edge' ? edgeCriticalityImpact(baseGraph, selected.id, (b, o) => deriveAnalysisGraph(b, o)) : null),
    [baseGraph, selected]
  );

  const maxVal = Math.max(...ranked.map((r) => r.value), 1e-9);

  return (
    <div style={{ padding: 10, borderTop: `1px solid ${C.line}` }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper, marginBottom: 6 }}>NETWORK ANALYSIS</div>

      <div role="radiogroup" aria-label="Analysis metric" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {METRICS.map((m) => {
          const on = metric === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on}
              onClick={() => setMetric(on ? null : m.id)}
              style={{ fontSize: 9.5, padding: '3px 7px', borderRadius: 3, fontFamily: 'inherit', cursor: 'pointer', background: on ? C.copper : 'transparent', color: on ? '#0C111C' : C.dim, border: `1px solid ${on ? C.copper : C.line}`, fontWeight: on ? 700 : 400 }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* §22 guardrails */}
      <div className="mono" style={{ fontSize: 9.5, color: C.faint, lineHeight: 1.6, marginBottom: 6, border: `1px solid ${C.line}`, borderRadius: 5, padding: '6px 8px' }}>
        <div style={{ color: C.dim }}>“{meta.question}”</div>
        <div>Level: functional centre · Weighted: {meta.weighted ? 'yes' : 'no'} · Scope: current analysis graph</div>
        <div style={{ color: C.amber }}>{meta.limitation}</div>
        <div>Generic centrality is a topology measure — separate from SSCIM’s propagation-based Network Influence, which it does not replace.</div>
      </div>

      {metric === 'removal_impact' ? (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.6 }}>
          Select a centre, then use the ranking below (by betweenness, a bridging proxy) or the toolbar’s “Remove centre” to run a hypothetical node-removal and read the reachability change here.
          {removal && (
            <div style={{ marginTop: 6, color: C.text }}>
              <b>{centreName(removal.removed)}</b> — lost reachable pairs: <b style={{ color: C.red }}>{removal.lostReachablePairs}</b> · newly isolated centres: {removal.newlyIsolated.length} · downstream reach {removal.directDownstream} · upstream reach {removal.directUpstream}
              <div style={{ color: C.faint }}>Hypothetical node-removal sensitivity — not a predicted shutdown outcome.</div>
            </div>
          )}
        </div>
      ) : (
        ranked.map((r, i) => (
          <div key={r.id} role="button" tabIndex={0}
            onClick={() => select({ type: 'centre', id: r.id })}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select({ type: 'centre', id: r.id }))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer', padding: '2px 0' }}>
            <span className="mono" style={{ color: C.faint, width: 18 }}>#{i + 1}</span>
            <span style={{ flex: 1 }}>{centreName(r.id)}</span>
            <span style={{ width: 70, height: 4, background: C.panel2, borderRadius: 2, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${(r.value / maxVal) * 100}%`, height: '100%', background: C.copper }} />
            </span>
            <span className="mono" style={{ color: C.copper, width: 54, textAlign: 'right' }}>{r.value < 1 ? r.value.toFixed(4) : r.value.toFixed(3)}</span>
          </div>
        ))
      )}

      {edgeCrit && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.6, marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
          EDGE CRITICALITY · {centreName(edgeCrit.sourceId)} → {centreName(edgeCrit.targetId)}
          <div style={{ color: C.text }}>lost reachable pairs: <b style={{ color: C.red }}>{edgeCrit.lostReachablePairs}</b> · alternative modeled path exists: {edgeCrit.alternativeExists ? 'yes' : 'no'}</div>
          <div style={{ color: C.faint }}>Hypothetical edge-removal sensitivity over modeled connectivity — not a predicted disruption.</div>
        </div>
      )}
    </div>
  );
}
