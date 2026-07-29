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

  return (
    <span className="mono" style={{ fontSize: 9.5, color, letterSpacing: 0.5, whiteSpace: 'nowrap' }}
      title={live
        ? `Live from the vault API. Snapshot date ${meta.snapshotDate ?? 'unknown'}.`
        : `Latest available dataset. Data as of the last pipeline run${stamp ? ` (${new Date(stamp).toLocaleString()})` : ''}; dataset date ${meta.snapshotDate ?? 'unknown'}.`}>
      <span style={{ color: live ? C.green : color }}>●</span>{' '}
      {live ? 'LIVE' : 'DATASET'}
      {meta.snapshotDate ? ` ${meta.snapshotDate}` : ''}
      {age && !live ? ` · updated ${age}` : ''}
    </span>
  );
}
