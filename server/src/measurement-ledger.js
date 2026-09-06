/* Numeric provenance is independent of citation completeness. Unknown fields
   stay null; legacy numbers are preserved as assumptions, not measurements. */
export const DENOMINATOR_ISSUES = Object.freeze({
  logic_ai: 'Incompatible product scope: the NVIDIA note describes merchant AI accelerators, while this stage also includes captive Google/Amazon programs and broader logic. Reference periods and common denominator are unknown.',
  memory_fab: 'Incompatible product scope: DRAM-only and NAND-only vendor shares were entered against a combined stage. The seed proposed a Q1 2026 blend using annual 2025 market weights; that unverified transformation was never applied to the canonical database and is not adopted.',
});

export function measurementRecord({ scope, value, units, basis, productScope, source = null, geography = null, issue = null }) {
  return { scope, originalValue: value, modeledValue: value, units, measurementBasis: basis,
    referencePeriod: null, productScope, geographicScope: geography, marketDenominator: null,
    source, supportingLocation: null, status: 'assumed', claimVerification: 'unresolved',
    denominatorStatus: issue ? 'incompatible' : 'unknown', issue,
    transformation: 'identity: original numeric prior retained; no factual normalization or measured-capacity claim',
    review: { agent: 'Codex automated research review', humanReviewer: null, date: '2026-09-06' } };
}

export function buildMeasurementLedger(bundle) {
  const notesFor = (scope) => bundle.dataNotes.filter(n => n.scope === scope).map(n => n.source).filter(Boolean).join('; ') || null;
  const records = [];
  const add = (scope, value, units, basis, productScope, source, geography, issue) => records.push(measurementRecord({ scope, value, units, basis, productScope, source, geography, issue }));
  for (const s of bundle.stages) {
    add(`stage:${s.id}:value`, s.value, 'USD billion proxy', 'stage importance proxy; not additive industry revenue', s.name, notesFor(`stage:${s.id}`));
    for (const key of ['subst', 'market']) add(`stage:${s.id}:${key}`, s[key], 'ordinal 0–10', 'analyst ordinal', s.name, notesFor(`stage:${s.id}`));
    for (const [country, value] of Object.entries(s.shares)) add(`stage:${s.id}:country:${country}`, value, 'dimensionless coefficient', 'modeled country exposure; manufacturing-location versus domicile basis unresolved', s.name, notesFor(`stage:${s.id}`), country);
  }
  for (const c of bundle.companies) for (const [stage, value] of Object.entries(c.stakes)) {
    add(`company:${c.id}:stage:${stage}`, value, 'dimensionless coefficient', 'analyst company exposure prior; not measured capacity or global output share', stage, notesFor(`company:${c.id}`) || notesFor(`stage:${stage}`), null, DENOMINATOR_ISSUES[stage]);
  }
  for (const f of bundle.facilities) add(`facility:${f.id}:scale`, f.scale, 'ordinal 1–5', 'analyst relative significance within modeled site sample; not capacity', f.stages.join(', '), f.source, f.country);
  return records;
}

export function persistMeasurementLedger(db, records) {
  db.exec('CREATE TABLE IF NOT EXISTS measurement_evidence (scope TEXT PRIMARY KEY, record_json TEXT NOT NULL)');
  const put = db.prepare('INSERT INTO measurement_evidence (scope, record_json) VALUES (?, ?) ON CONFLICT(scope) DO UPDATE SET record_json=excluded.record_json');
  db.transaction(() => { for (const record of records) put.run(record.scope, JSON.stringify(record)); })();
}

export function getMeasurementLedger(db) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name='measurement_evidence'").get()) return [];
  return db.prepare('SELECT record_json FROM measurement_evidence ORDER BY scope').all().map(r => JSON.parse(r.record_json));
}
