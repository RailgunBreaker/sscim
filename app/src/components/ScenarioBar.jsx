import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';
import Spark from './Spark.jsx';

export default function ScenarioBar({ scenarioId, whatChanged }) {
  const { engine } = useVault();
  const { HISTORY } = engine;
  return (
    <div className="mono" style={{ background: scenarioId === "none" ? C.panel2 : "#2A1E14", borderBottom: `1px solid ${C.line}`, padding: "7px 16px", fontSize: 11.5, color: scenarioId === "none" ? C.dim : C.copper, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 240 }}><span style={{ color: C.copper, fontWeight: 600 }}>{t("WHAT CHANGED")} · </span>{whatChanged}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Spark data={HISTORY} />
        <span style={{ fontSize: 10 }}>{t("CHAIN INDEX")} <b style={{ color: riskColor(HISTORY[HISTORY.length - 1]) }}>{HISTORY[HISTORY.length - 1].toFixed(2)}</b>
          <span style={{ color: HISTORY[HISTORY.length - 1] - HISTORY[HISTORY.length - 8] >= 0 ? C.red : C.green }}> {HISTORY[HISTORY.length - 1] - HISTORY[HISTORY.length - 8] >= 0 ? "▲" : "▼"}{Math.abs(HISTORY[HISTORY.length - 1] - HISTORY[HISTORY.length - 8]).toFixed(2)} 7d</span>
        </span>
      </span>
    </div>
  );
}
