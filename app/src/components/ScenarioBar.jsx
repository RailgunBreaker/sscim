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
export default function ScenarioBar({ model, whatChanged }) {
  const { history, baselineChainIndex, activeChainIndex, chainIndexDelta, scenarioActive } = model;
  const prev7 = history[history.length - 8];
  const baselineDelta7d = baselineChainIndex - prev7;
  return (
    <div className="mono" style={{ background: scenarioActive ? "#2A1E14" : C.panel2, borderBottom: `1px solid ${C.line}`, padding: "7px 16px", fontSize: 11.5, color: scenarioActive ? C.copper : C.dim, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 240 }}><span style={{ color: C.copper, fontWeight: 600 }}>{t("WHAT CHANGED")} · </span>{whatChanged}</span>
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
