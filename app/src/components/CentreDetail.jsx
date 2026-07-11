import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { onEnterSpace } from '../utils/a11y.js';
import { flagEmoji } from '../data/glossary.js';
import { fmtSigned } from '../interaction/lensEncoding.js';
import { deriveAnalysisGraph, directNeighbors, reachabilitySummary, weightedDegree } from '../engine/networkOps.js';

/* Functional-centre detail panel (spec §11). Rendered in Layer 3 whenever a
   country × stage centre is the shared selection. Everything shown is
   derived from the immutable base graph + existing engine scores — no new
   facts. Neighbor rows select the neighbor centre, keeping every view in
   sync. Connections are modeled stage-mediated exposure, not shipments. */
export default function CentreDetail({ centreId, baseGraph, model, setSel }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const { state, pgToggleNode, pgToggleMulti } = useInteraction();
  const { playground } = state;

  const analysis = useMemo(
    () => deriveAnalysisGraph(baseGraph, { removedNodeIds: playground.removedNodeIds, removedEdgeIds: playground.removedEdgeIds }),
    [baseGraph, playground.removedNodeIds, playground.removedEdgeIds]
  );
  const centre = baseGraph.centreById[centreId];
  const isRemoved = playground.removedNodeIds.includes(centreId);
  const isMulti = playground.multi.some((m) => m.type === 'centre' && m.id === centreId);

  if (!centre) {
    return <div className="mono" style={{ fontSize: 12, color: C.dim }}>Functional centre not found in the current graph.</div>;
  }

  const stage = STAGE_BY_ID[centre.stageId];
  const neighbors = directNeighbors(analysis, centreId, 'both');
  const up = neighbors.filter((n) => n.dir === 'upstream').slice(0, 6);
  const down = neighbors.filter((n) => n.dir === 'downstream').slice(0, 6);
  const reach = reachabilitySummary(analysis, centreId);
  const degIn = weightedDegree(analysis, centreId, 'upstream');
  const degOut = weightedDegree(analysis, centreId, 'downstream');
  const op = model.activeField?.[centre.stageId] ?? 0;
  const delta = model.stageDelta?.[centre.stageId] ?? 0;

  const nameOf = (cid) => {
    const c = baseGraph.centreById[cid];
    return c ? `${flagEmoji(c.countryId)} ${COUNTRY_NAMES[c.countryId] || c.countryId} · ${STAGE_BY_ID[c.stageId]?.name || c.stageId}` : cid;
  };

  const Row = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, marginBottom: 3 }}>
      <span className="mono" style={{ color: C.faint, fontSize: 10.5 }}>{label}</span>
      <span style={{ color: color || C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );

  const NeighborRow = ({ n }) => (
    <div role="button" tabIndex={0}
      onClick={() => setSel({ type: 'centre', id: n.neighborId })}
      onKeyDown={onEnterSpace(() => setSel({ type: 'centre', id: n.neighborId }))}
      style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, cursor: 'pointer', padding: '2px 0' }}>
      <span>{nameOf(n.neighborId)}</span>
      <span className="mono" style={{ color: C.copper }}>{n.edge.rawDisplayWeight.toFixed(3)}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: '#0C111C', background: C.copper, borderRadius: 3, padding: '2px 7px', fontWeight: 700 }}>FUNCTIONAL CENTRE</span>
        <h3 style={{ margin: 0, fontSize: 15 }}>{flagEmoji(centre.countryId)} {COUNTRY_NAMES[centre.countryId] || centre.countryId} · {stage?.name || centre.stageId}</h3>
      </div>
      <div className="mono" style={{ fontSize: 10, color: C.faint, margin: '4px 0 8px' }}>{centre.tierLabel} tier · country × stage centre{isRemoved ? ' · TEMPORARILY REMOVED' : ''}</div>

      {/* Node actions (§25) — also available here in the accessible side panel */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => pgToggleNode(centreId)}
          style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer', background: isRemoved ? 'rgba(201,138,63,.16)' : 'transparent', color: isRemoved ? C.copper : C.dim, border: `1px solid ${isRemoved ? C.copper : C.line}` }}>
          {isRemoved ? '↺ Restore centre' : '✕ Temporarily remove'}
        </button>
        <button type="button" onClick={() => pgToggleMulti({ type: 'centre', id: centreId })}
          style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer', background: isMulti ? 'rgba(224,164,88,.16)' : 'transparent', color: isMulti ? C.amber : C.dim, border: `1px solid ${isMulti ? C.amber : C.line}` }}>
          {isMulti ? '− Remove from selection' : '+ Add to multi-selection'}
        </button>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
        <Row label="COUNTRY SHARE OF STAGE" value={`${(centre.countryShare * 100).toFixed(1)}%`} />
        <Row label="STRUCTURAL SCORE (stage)" value={`${centre.structuralScore.toFixed(1)} / 10`} />
        <Row label="NETWORK INFLUENCE (stage)" value={`${centre.networkInfluence.toFixed(1)} / 10`} />
        <Row label="OPERATIONAL IMPACT (stage)" value={fmtSigned(op)} color={op >= 0 ? C.red : C.green} />
        {model.scenarioActive && <Row label="SCENARIO Δ (stage)" value={`${fmtSigned(delta)} vs baseline`} color={delta >= 0 ? C.red : C.green} />}
        <Row label="WEIGHTED IN / OUT DEGREE" value={`${degIn.toFixed(3)} / ${degOut.toFixed(3)}`} />
        <Row label="UPSTREAM / DOWNSTREAM REACH" value={`${reach.upstreamCount} / ${reach.downstreamCount} centres`} />
      </div>

      {centre.companies.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, margin: '8px 0 3px' }}>COMPANIES AT THIS CENTRE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {centre.companies.slice(0, 10).map((co) => (
              <span key={co.id} role="button" tabIndex={0}
                onClick={() => setSel({ type: 'company', id: co.id })}
                onKeyDown={onEnterSpace(() => setSel({ type: 'company', id: co.id }))}
                className="mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: `1px solid ${C.line}`, color: C.copper, cursor: 'pointer' }}>
                {co.name} {(co.stake * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, marginBottom: 3 }}>DIRECT UPSTREAM ({up.length})</div>
          {up.length === 0 && <div className="mono" style={{ fontSize: 10.5, color: C.faint }}>none</div>}
          {up.map((n) => <NeighborRow key={n.edge.id} n={n} />)}
        </div>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, marginBottom: 3 }}>DIRECT DOWNSTREAM ({down.length})</div>
          {down.length === 0 && <div className="mono" style={{ fontSize: 10.5, color: C.faint }}>none</div>}
          {down.map((n) => <NeighborRow key={n.edge.id} n={n} />)}
        </div>
      </div>

      <div className="mono" style={{ fontSize: 9, color: C.faint, marginTop: 10, lineHeight: 1.6 }}>
        Weights are modeled stage-mediated connection weights (share × stage-edge prior × share) — model-derived exposure, not measured bilateral trade or verified shipments.
      </div>
    </div>
  );
}
