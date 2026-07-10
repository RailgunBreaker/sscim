import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { getEventAssumption } from '../engine/event-assumptions.js';
import { fmtSigned } from '../interaction/lensEncoding.js';
import { onEnterSpace } from '../utils/a11y.js';

/* Layer-3 Scenario Impact Summary (task §9). Rendered whenever the shared
   selection is the synthetic { type:'scenario' } entity — so activating a
   scenario no longer leaves the previously-selected event's explanation
   sitting in Layer 3 as if it described the scenario. This entity is
   frontend-only; it is never written into the snapshot. */
export default function ScenarioSummary({ model, scenario, setSel, onReset, onPlay }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES, COMPANIES } = data;
  const { STAGE_BY_ID, companyContribution } = engine;
  if (!scenario) return <div className="mono" style={{ fontSize: 12, color: C.dim }}>No scenario is active.</div>;

  const ev = scenario.event || {};
  // A scenario composed in-app carries its own direction on the event; fall
  // back to the curated id lookup for presets (mirrors the engine).
  const assumption = ev.assumption || getEventAssumption(scenario.id);
  const direction = assumption.direction || 'adverse';
  const dirColor = direction === 'mitigating' ? C.green : direction === 'mixed' ? C.amber : C.red;

  const rankSigned = (obj, n = 5) => Object.entries(obj)
    .filter(([, v]) => Math.abs(v) > 1e-4)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, n);

  const topStages = rankSigned(model.stageDelta);
  const topCountries = rankSigned(model.countryDelta);
  const companyDeltas = COMPANIES.map((c) => [c, companyContribution(c, model.activeField) - companyContribution(c, model.baselineField)])
    .filter(([, d]) => Math.abs(d) > 1e-4)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);

  // Deterministic "leading pathway": the most-moved stages listed in the
  // graph's topological order, as a readable chain (not a claimed shipment
  // route — Explain Path gives per-edge decomposition).
  const topoIndex = Object.fromEntries(engine.TOPO.map((id, i) => [id, i]));
  const pathway = topStages.map(([sid]) => sid).sort((a, b) => (topoIndex[a] ?? 0) - (topoIndex[b] ?? 0)).map((sid) => STAGE_BY_ID[sid]?.name || sid);

  const Row = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, marginBottom: 3 }}>
      <span className="mono" style={{ color: C.faint, fontSize: 10.5 }}>{label}</span>
      <span style={{ color: color || C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );

  const Chip = ({ children, onClick }) => (
    <span role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} onKeyDown={onClick ? onEnterSpace(onClick) : undefined}
      className="mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: `1px solid ${C.line}`, color: C.copper, cursor: onClick ? 'pointer' : 'default' }}>
      {children}
    </span>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: '#0C111C', background: C.copper, borderRadius: 3, padding: '2px 7px', fontWeight: 700 }}>SCENARIO</span>
        <h3 style={{ margin: 0, fontSize: 15 }}>{scenario.name}</h3>
        <span className="mono" style={{ fontSize: 10, color: dirColor, border: `1px solid ${dirColor}`, borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase' }}>{direction}</span>
      </div>
      <p style={{ margin: '6px 0 8px', fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{scenario.desc}</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {(ev.countries || []).map((cid) => <Chip key={'c' + cid} onClick={() => setSel({ type: 'country', id: cid })}>{COUNTRY_NAMES[cid] || cid} ×src</Chip>)}
        {(ev.stages || []).map((sid) => <Chip key={'s' + sid} onClick={() => setSel({ type: 'stage', id: sid })}>{STAGE_BY_ID[sid]?.name || sid} ×src</Chip>)}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
        <Row label="SEVERITY" value={`${ev.sev ?? '—'} / 10`} />
        <Row label="BASELINE CHAIN INDEX" value={model.baselineChainIndex.toFixed(2)} />
        <Row label="SCENARIO CHAIN INDEX" value={model.activeChainIndex.toFixed(2)} color={model.chainIndexDelta >= 0 ? C.red : C.green} />
        <Row label="SIGNED DIFFERENCE" value={`${fmtSigned(model.chainIndexDelta)} vs baseline`} color={model.chainIndexDelta >= 0 ? C.red : C.green} />
      </div>

      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, margin: '8px 0 3px' }}>MOST AFFECTED STAGES (SCENARIO Δ)</div>
      {topStages.length === 0 && <div className="mono" style={{ fontSize: 11, color: C.faint }}>No stage moved measurably.</div>}
      {topStages.map(([sid, v]) => (
        <div key={sid} role="button" tabIndex={0} onClick={() => setSel({ type: 'stage', id: sid })} onKeyDown={onEnterSpace(() => setSel({ type: 'stage', id: sid }))}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
          <span>{STAGE_BY_ID[sid]?.name || sid}</span>
          <span className="mono" style={{ color: v >= 0 ? C.red : C.green }}>{fmtSigned(v, 3)}</span>
        </div>
      ))}

      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, margin: '8px 0 3px' }}>MOST AFFECTED COUNTRIES (SCENARIO Δ)</div>
      {topCountries.length === 0 && <div className="mono" style={{ fontSize: 11, color: C.faint }}>No country moved measurably.</div>}
      {topCountries.map(([cid, v]) => (
        <div key={cid} role="button" tabIndex={0} onClick={() => setSel({ type: 'country', id: cid })} onKeyDown={onEnterSpace(() => setSel({ type: 'country', id: cid }))}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
          <span>{COUNTRY_NAMES[cid] || cid}</span>
          <span className="mono" style={{ color: v >= 0 ? C.red : C.green }}>{fmtSigned(v, 3)}</span>
        </div>
      ))}

      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, margin: '8px 0 3px' }}>MOST AFFECTED COMPANIES (Δ MODELED CONTRIBUTION)</div>
      {companyDeltas.length === 0 && <div className="mono" style={{ fontSize: 11, color: C.faint }}>No company contribution moved measurably.</div>}
      {companyDeltas.map(([co, d]) => (
        <div key={co.id} role="button" tabIndex={0} onClick={() => setSel({ type: 'company', id: co.id })} onKeyDown={onEnterSpace(() => setSel({ type: 'company', id: co.id }))}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
          <span>{co.name}</span>
          <span className="mono" style={{ color: d >= 0 ? C.red : C.green }}>{fmtSigned(d, 3)}</span>
        </div>
      ))}

      {pathway.length > 1 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, margin: '8px 0 3px' }}>LEADING MODELED PATHWAY</div>
          <div className="mono" style={{ fontSize: 11, color: C.copper, lineHeight: 1.5 }}>{pathway.join(' → ')}</div>
          <div className="mono" style={{ fontSize: 9, color: C.faint, marginTop: 2 }}>Graph connectivity + modeled contribution — not a verified physical shipment route. Use “Explain path” for per-edge decomposition.</div>
        </>
      )}

      <div className="mono" style={{ fontSize: 9.5, color: C.amber, background: '#2A1E14', border: `1px solid ${C.copperDim}`, borderRadius: 5, padding: '6px 9px', margin: '10px 0 8px', lineHeight: 1.6 }}>
        MODEL LIMITATIONS — hypothetical scenario over a static curated snapshot with unvalidated propagation priors. Signed differences are modeled sensitivities, not predicted real-world outcomes. History is never rewritten by a scenario.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {onPlay && (
          <button type="button" onClick={onPlay} style={{ background: C.copper, color: '#0C111C', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>▶ Play propagation</button>
        )}
        {onReset && (
          <button type="button" onClick={onReset} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Reset to baseline</button>
        )}
      </div>
    </div>
  );
}
