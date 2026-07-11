import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { riskColor } from '../utils/colors.js';
import Spark from './Spark.jsx';

/* Reads the already-computed scenario-aware `model` via props — it must
   NOT read engine.HISTORY (baseline-only) directly as "the current value",
   otherwise the chain index never visibly changes when a scenario is
   active (see MISSION defect #1). The sparkline stays baseline history
   (a hypothetical scenario never rewrites the past); the current-value
   readout uses model.activeChainIndex, with the scenario delta shown
   explicitly against model.baselineChainIndex. */
const COMPARE_OPTIONS = [
  ['lens', 'Lens'],
  ['baseline', 'Baseline'],
  ['scenario', 'Scenario'],
  ['difference', 'Difference'],
];

export default function ScenarioBar({ model, whatChanged, compare, setCompare, scenarioActive: scenarioActiveProp }) {
  const { history, baselineChainIndex, activeChainIndex, chainIndexDelta, scenarioActive } = model;
  const prev7 = history[history.length - 8];
  const baselineDelta7d = baselineChainIndex - prev7;
  const showCompare = scenarioActiveProp && setCompare;
  return (
    <div className="mono" style={{ background: scenarioActive ? "#2A1E14" : C.panel2, borderBottom: `1px solid ${C.line}`, padding: "7px 16px", fontSize: 11.5, color: scenarioActive ? C.copper : C.dim, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 240 }}><span style={{ color: C.copper, fontWeight: 600 }}>{t("WHAT CHANGED")} · </span>{whatChanged}</span>
      {showCompare && (
        <span role="radiogroup" aria-label="Compare baseline / scenario / difference" style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: C.faint }}>COMPARE</span>
          {COMPARE_OPTIONS.map(([val, label]) => {
            const on = compare === val;
            return (
              <button key={val} type="button" role="radio" aria-checked={on} onClick={() => setCompare(val)}
                title={val === 'lens' ? 'Follow the global lens' : val === 'baseline' ? 'Show the pre-scenario (baseline) field' : val === 'scenario' ? 'Show the active-scenario field' : 'Show the signed scenario − baseline Δ'}
                style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 3, fontFamily: "inherit", cursor: "pointer",
                  background: on ? C.copper : "transparent", color: on ? "#0C111C" : C.dim,
                  border: `1px solid ${on ? C.copper : C.line}`, fontWeight: on ? 700 : 400 }}>
                {label}
              </button>
            );
          })}
        </span>
      )}
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Spark data={history} />
        <span style={{ fontSize: 10 }}>
          {t("CHAIN INDEX")} <b style={{ color: riskColor(activeChainIndex) }}>{activeChainIndex.toFixed(2)}</b>
          {scenarioActive ? (
            <span style={{ color: chainIndexDelta >= 0 ? C.red : C.green }}> {chainIndexDelta >= 0 ? "▲" : "▼"}{Math.abs(chainIndexDelta).toFixed(2)} vs baseline {baselineChainIndex.toFixed(2)}</span>
          ) : (
            <span style={{ color: baselineDelta7d >= 0 ? C.red : C.green }}> {baselineDelta7d >= 0 ? "▲" : "▼"}{Math.abs(baselineDelta7d).toFixed(2)} 7d</span>
          )}
        </span>
      </span>
    </div>
  );
}
