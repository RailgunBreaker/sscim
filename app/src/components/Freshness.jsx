import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';

/* Data-freshness readout.

   Deliberately reads `source` from the vault context rather than assuming the
   snapshot: under the current static deploy it always reports "as of <build>",
   and if a live backend is ever configured (VITE_API_BASE_URL) the same
   component distinguishes live data from the fallen-back snapshot with no
   rewrite. That matters because this whole model is time-based — a visitor
   three weeks after the last pipeline run should see that the data is three
   weeks old, not be shown stale numbers as if they were current. */

const DAY = 86400000;

function ageLabel(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / DAY);
  if (!Number.isFinite(days) || days < 0) return 'today';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Freshness() {
  const { data, source } = useVault();
  const meta = data?.META ?? {};
  const stamp = meta.lastRunAt || meta.generatedAt;
  const age = ageLabel(stamp);
  const days = stamp ? Math.floor((Date.now() - Date.parse(stamp)) / DAY) : 0;

  // Amber past a week: the index decays with a 12-day half-life, so week-plus
  // stale data is materially different from current, not just slightly older.
  const color = days > 7 ? C.amber : C.faint;
  const live = source === 'live';

  /* The header states the dataset date beside this, so repeating it here
     was the same fact twice in one line. What this adds is whether the
     figures are live or from the bundled snapshot, and how old they are —
     the part the date alone does not tell you. */
  return (
    <span
      style={{ fontSize: 12, color, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      title={live
        ? `Live from the vault API. Snapshot date ${meta.snapshotDate ?? 'unknown'}.`
        : `Latest available dataset. Data as of the last pipeline run${stamp ? ` (${new Date(stamp).toLocaleString()})` : ''}; dataset date ${meta.snapshotDate ?? 'unknown'}.`}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: live ? C.green : color, flexShrink: 0 }} />
      {live ? 'Live' : age ? `Updated ${age}` : 'Static snapshot'}
    </span>
  );
}
