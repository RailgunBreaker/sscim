/* ====================================================================
   build-computation-demo.mjs — export the v7 engine's real inputs,
   intermediates and outputs as CSV, so the computation demonstration
   quotes files rather than transcribed numbers.

   Every table here is produced by running the actual engine against the
   committed snapshot. Nothing is illustrative.

   Run:  npm run demo
   ==================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildModel } from '../src/engine/buildModel.js';
import { MODEL_VERSION, parameterRegister } from '../src/engine/registry.js';
import { EVENT_MODEL, ACTIVE_HORIZON_DAYS } from '../src/engine/event-model.js';
import { getEventAssumption } from '../src/engine/event-assumptions.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../docs/computation-demo/csv');
mkdirSync(OUT, { recursive: true });

const bundle = JSON.parse(readFileSync(resolve(here, '../src/data/vault-snapshot.json'), 'utf8'));
const data = buildVaultData(bundle);
const datasetAsOf = bundle.meta?.snapshotDate;
const engine = buildEngine({ ...data, datasetAsOf });
const model = buildModel({ data, engine });

const q = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (name, header, rows) => {
  const text = [header.join(','), ...rows.map((r) => r.map(q).join(','))].join('\n') + '\n';
  writeFileSync(resolve(OUT, name), text);
  console.log(`  ${name.padEnd(38)} ${rows.length} row(s)`);
};
const n = (v, d = 8) => (Number.isFinite(v) ? Number(v.toFixed(d)) : '');

console.log(`SSCIM v7 computation demonstration — model ${MODEL_VERSION}, dataset ${datasetAsOf}`);

/* ---- 01 parameter registry ---- */
const reg = parameterRegister();
csv('01_parameter_registry.csv',
  ['name', 'symbol', 'low', 'base', 'high', 'domain_min', 'domain_max', 'exclusive_max', 'units', 'component', 'status', 'model_version', 'definition', 'rationale'],
  reg.parameters.map((p) => [p.name, p.symbol, p.low, p.base, p.high, p.domain[0], p.domain[1], Boolean(p.exclusiveMax), p.units, p.component, p.status, p.modelVersion, p.definition, p.rationale]));

csv('01b_structural_weights.csv',
  ['component', 'symbol', 'raw_low', 'raw_base', 'raw_high', 'effective_base', 'status', 'rationale'],
  reg.structuralWeights.map((w) => [w.key, w.symbol, w.low, w.base, w.high, n(w.effectiveBase, 10), w.status, w.rationale]));

csv('01c_model_forms.csv',
  ['name', 'options', 'base', 'component', 'status', 'definition', 'rationale'],
  reg.modelForms.map((f) => [f.name, f.options.join('|'), f.base, f.component, f.status, f.definition, f.rationale]));

/* ---- 02 stages ---- */
csv('02_stages.csv',
  ['id', 'name', 'turnover_proxy', 'non_substitutability', 'market', 'stage_weight', 'network_influence_raw', 'network_influence_snapshot_relative',
    'geo_hhi_lower', 'geo_hhi_upper', 'geo_score_published', 'policy_exposure', 'structural_vulnerability', 'operational_field'],
  data.STAGES.map((s) => [
    s.id, s.name, s.value, s.nonSubstitutability ?? s.subst, s.market,
    n(engine.STAGE_WEIGHT[s.id], 10),
    n(engine.NETWORK_INFLUENCE_RAW[s.id], 10),
    n(engine.NETWORK_INFLUENCE[s.id], 6),
    n(engine.GEO_BOUNDS[s.id].lower, 8), n(engine.GEO_BOUNDS[s.id].upper, 8),
    n(engine.GEO_CONCENTRATION[s.id], 6),
    n(engine.POLICY_EXPOSURE[s.id], 6),
    n(engine.STRUCTURAL_VULNERABILITY[s.id], 6),
    n(model.baselineField[s.id], 10),
  ]));

csv('03_stage_country_shares.csv', ['stage', 'country', 'share'],
  data.STAGES.flatMap((s) => Object.entries(s.shares || {}).map(([c, v]) => [s.id, c, v])));

/* ---- 04 edges and dependency matrices ---- */
csv('04_dependency_matrices.csv',
  ['supplier_a', 'buyer_b', 'incoming_allocation_q_ba', 'outgoing_allocation_r_ab', 'non_substitutability_nu_a', 'D_ba', 'U_ab', 'allocation_source'],
  data.FLOW_EDGES.map(([a, b]) => [
    a, b,
    n(engine.EDGE_ALLOCATIONS.q[b]?.[a], 10),
    n(engine.EDGE_ALLOCATIONS.r[a]?.[b], 10),
    n(engine.NON_SUBSTITUTABILITY_UNIT[a], 6),
    n(engine.D[b]?.[a], 10),
    n(engine.U[a]?.[b], 10),
    'equal_split_fallback',
  ]));

/* ---- 05 policy families ---- */
csv('05_policy_families.csv', ['family', 'severity', 'records', 'stages'],
  engine.POLICY_FAMILIES.map((f) => [f.family, f.sev, f.records.join('|'), f.stages.join('|')]));

/* ---- 06 incidents ---- */
const incidents = engine.incidentsOf(data.EVENTS);
csv('06_incidents.csv',
  ['incident_id', 'primary_record', 'record_count', 'records', 'severity', 'days_ago', 'direction', 'channel', 'operational',
    'profile', 'persistence_R', 'severity_intensity_g', 'exposure_source', 'scored', 'unscored_reason', 'source_vector'],
  incidents.map((inc) => {
    const r = engine.incidentField(inc);
    const src = r.source;
    return [
      inc.incidentId, inc.primary.id, inc.recordCount, inc.records.map((x) => `${x.id}:${x.role}`).join('|'),
      inc.primary.sev, inc.primary.daysAgo,
      r.assumption.direction, r.assumption.channel, r.assumption.operational,
      src.profile?.kind ?? '', n(src.persistence, 8), n(src.intensity, 8),
      src.exposureSource, r.scored, src.unscoredReason ?? '',
      Object.entries(src.z).map(([s, v]) => `${s}=${n(v, 8)}`).join('|'),
    ];
  }));

/* ---- 07 curated event model ---- */
csv('07_curated_event_model.csv', ['event_id', 'stage', 'exposure_alpha', 'profile', 'exposure_basis', 'profile_basis'],
  Object.entries(EVENT_MODEL).flatMap(([id, m]) =>
    Object.entries(m.exposure).map(([s, a]) => [id, s, a, m.profile.kind, m.exposureBasis, m.profileBasis])));

/* ---- 08 countries ---- */
csv('08_country_metrics.csv',
  ['country', 'name', 'modeled_stage_weight', 'structural', 'local_pressure', 'chain_contribution'],
  Object.entries(model.countriesBase).map(([c, v]) => [
    c, data.COUNTRY_NAMES[c] ?? c, n(v.weight, 6), n(v.structural, 6), n(v.localPressure, 10), n(v.chainContribution, 10),
  ]));

/* ---- 09 companies ---- */
csv('09_company_metrics.csv',
  ['company', 'name', 'country', 'criticality_raw', 'criticality_snapshot_relative', 'vulnerability', 'contribution', 'stages'],
  data.COMPANIES.map((c) => [
    c.id, c.name, c.country,
    n(engine.COMPANY_CRITICALITY_RAW[c.id], 10),
    n(engine.COMPANY_CRITICALITY[c.id].value, 6),
    n(engine.companyVulnerability(c, model.baselineField), 6),
    n(engine.companyContribution(c, model.baselineField), 10),
    Object.keys(c.stakes).join('|'),
  ]));

/* ---- 10 headline ---- */
csv('10_headline.csv', ['metric', 'value', 'note'], [
  ['model_version', MODEL_VERSION, 'from app/src/engine/registry.js'],
  ['dataset_as_of', datasetAsOf, 'every incident age is measured against this date, never the reader clock'],
  ['records', data.EVENTS.length, 'raw records in the snapshot'],
  ['incidents', engine.MODEL_AUDIT.incidentCount, 'after deduplication by incidentId'],
  ['scored_incidents', engine.MODEL_AUDIT.scoredIncidentCount, 'incidents producing a nonzero source vector'],
  ['operational_index_signed', n(engine.operationalIndex(model.baselineField), 12), 'sum of w_s * F_s; weights sum to one'],
  ['headline_index_displayed', n(model.baselineChainIndex, 12), '5 + 5 * signed; 5 is neutral'],
  ['assumption_envelope_low', n(model.envelope.low, 12), 'one-at-a-time sweep; NOT a confidence interval'],
  ['assumption_envelope_high', n(model.envelope.high, 12), 'one-at-a-time sweep; NOT a confidence interval'],
  ['country_chain_contribution_total', n(Object.values(model.countriesBase).reduce((a, c) => a + c.chainContribution, 0), 12),
    'equals the signed index where country shares sum to one; the gap is the undisclosed residual'],
]);

/* ---- 11 model audit ---- */
csv('11_model_audit.csv', ['diagnostic', 'count', 'meaning'], [
  ...Object.entries(engine.MODEL_AUDIT.counts).map(([k, v]) => [k, v, 'machine-readable fallback diagnostic — see MODEL_V7_SPEC.md §6']),
  ['edge_allocation_incoming_equal_split', engine.MODEL_AUDIT.edgeAllocationFallback.incomingEqualSplit, 'stages with no evidence-based inbound dependency allocation'],
  ['edge_allocation_outgoing_equal_split', engine.MODEL_AUDIT.edgeAllocationFallback.outgoingEqualSplit, 'stages with no evidence-based outbound exposure allocation'],
  ['hhi_partial_disclosure', engine.MODEL_AUDIT.hhiPartialDisclosure, 'stages whose country shares sum to less than one'],
  ['policy_families', engine.MODEL_AUDIT.policyFamilies, 'register rows after family deduplication'],
  ['policy_duplicate_records', engine.MODEL_AUDIT.policyDuplicateRecords, 'rows collapsed into an existing family'],
  ['curated_incidents', engine.MODEL_AUDIT.curatedEventCount, `incidents with an explicit exposure vector and profile (curated horizon ${ACTIVE_HORIZON_DAYS} d)`],
]);

/* ---- 12 unscored records, with the reason ---- */
csv('12_unscored_records.csv', ['record', 'title', 'direction', 'operational', 'reason'],
  data.EVENTS.filter((e) => !engine.eventField(e).scored).map((e) => {
    const { source, assumption } = engine.eventField(e);
    return [e.id, e.title ?? '', assumption.direction, assumption.operational, source.unscoredReason ?? ''];
  }));

console.log(`\nWrote ${OUT}`);
console.log(`  headline index ${n(model.baselineChainIndex, 6)} · ${engine.MODEL_AUDIT.incidentCount} incidents from ${data.EVENTS.length} records`);
