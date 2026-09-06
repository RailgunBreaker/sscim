/* ====================================================================
   doc-generated.mjs — the blocks the documentation does NOT hand-write.

   Parameter tables, the model-version label, the machine-readable
   fallback-diagnostic list and the worked numerical example are all
   DERIVED from the v7 registry and the engine, and injected into the
   Markdown between markers:

     <!-- BEGIN GENERATED: <name> -->
     …generated content…
     <!-- END GENERATED: <name> -->

   `npm run docs:verify` regenerates every block and fails if what is in
   the file differs, so a coefficient can never be changed in the code
   without the published table changing with it — and a table can never be
   edited by hand into disagreeing with the code.
   ==================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODEL_VERSION, PARAMETERS, STRUCTURAL_WEIGHT_SPECS, STRUCTURAL_COMPONENTS, MODEL_FORMS, BASE_STRUCTURAL_WEIGHTS } from '../../src/engine/registry.js';
import { PROFILE_DEFINITIONS, PROFILE_IDS } from '../../src/engine/persistence.js';
import { workedExample, WORKED_STAGES, WORKED_EDGES, WORKED_INCIDENT, WORKED_SCENARIO } from '../../src/engine/workedExample.js';
import { ACTIVE_HORIZON_DAYS, EVENT_MODEL } from '../../src/engine/event-model.js';
import { DISPLAY_EXPOSURE_THRESHOLD } from '../../src/engine/facilities.js';
import { modelDigest } from '../model-digest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '..', '..', '..');

export const BEGIN = (name) => `<!-- BEGIN GENERATED: ${name} -->`;
export const END = (name) => `<!-- END GENERATED: ${name} -->`;

const num = (v) => (Number.isInteger(v) ? String(v) : String(v));
const fx = (v, n) => Number(v.toFixed(n)).toString();

/* ---------------- individual blocks ---------------- */

function modelVersionBlock() {
  return [`\`${MODEL_VERSION}\``].join('\n');
}

function parameterTableBlock() {
  const rows = Object.values(PARAMETERS).map((p) => [
    `\`${p.name}\``,
    `$${p.symbol}$`,
    num(p.low), num(p.base), num(p.high),
    `\`[${p.domain[0]}, ${p.domain[1]}${p.exclusiveMax ? ')' : ']'}\``,
    p.units,
    p.component,
    p.status,
  ]);
  const head = '| Parameter | Symbol | Low | Base | High | Valid domain | Units | Component | Status |';
  const sep = '| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |';
  return [head, sep, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function parameterDetailBlock() {
  return Object.values(PARAMETERS).map((p) => [
    `#### \`${p.name}\` — $${p.symbol}$`,
    '',
    `**Definition.** ${p.definition}`,
    '',
    `**Assumption range.** low ${num(p.low)} · base ${num(p.base)} · high ${num(p.high)} (${p.units}); valid domain \`[${p.domain[0]}, ${p.domain[1]}${p.exclusiveMax ? ')' : ']'}\`.`,
    '',
    `**Rationale.** ${p.rationale}`,
    '',
    `**Affects.** ${p.affects.join('; ')}.`,
    '',
    `**Status.** \`${p.status}\` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.`,
  ].join('\n')).join('\n\n');
}

function structuralWeightTableBlock() {
  const rows = STRUCTURAL_COMPONENTS.map((k) => {
    const s = STRUCTURAL_WEIGHT_SPECS[k];
    return `| \`${k}\` | $${s.symbol}$ | ${num(s.low)} | ${num(s.base)} | ${num(s.high)} | ${fx(BASE_STRUCTURAL_WEIGHTS[k], 7)} | ${s.status} |`;
  });
  return [
    '| Component | Symbol | Raw low | Raw base | Raw high | Effective base (renormalized) | Status |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...rows,
  ].join('\n');
}

function modelFormTableBlock() {
  const rows = Object.values(MODEL_FORMS).map((f) => [
    `\`${f.name}\``,
    f.options.map((o) => (o === f.base ? `**${o}**` : o)).join(' · '),
    f.component,
    f.status,
  ]);
  return [
    '| Model form | Options (**base** in bold) | Component | Status |',
    '| --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function modelFormDetailBlock() {
  return Object.values(MODEL_FORMS).map((f) => [
    `#### \`${f.name}\``,
    '',
    `**Definition.** ${f.definition}`,
    '',
    `**Options.** ${f.options.map((o) => (o === f.base ? `\`${o}\` (base)` : `\`${o}\``)).join(', ')}`,
    '',
    `**Rationale.** ${f.rationale}`,
    '',
    `**Affects.** ${f.affects.join('; ')}.`,
  ].join('\n')).join('\n\n');
}

function persistenceTableBlock() {
  return [
    '| Profile | Formula | Half-life / duration parameter | Operationally scored |',
    '| --- | --- | --- | --- |',
    ...PROFILE_IDS.map((id) => {
      const d = PROFILE_DEFINITIONS[id];
      return `| \`${id}\` | \`${d.formula}\` | ${d.halfLifeParam ? `\`${d.halfLifeParam}\`` : '—'} | ${d.scoring ? 'yes' : 'no'} |`;
    }),
  ].join('\n');
}

/* Every fallback rule, with the machine-readable diagnostic code the model
   audit emits for it. Hand-written prose next to a hand-written code is
   exactly how the two drift apart, so the codes come from the source. */
export const FALLBACK_RULES = [
  { code: 'factual_evidence_excluded', rule: 'Unresolved factual evidence', detail: 'Factual records require verified occurrence, explicit eligibility, claim-supporting source location and provenance, with evidence available by the evaluation date. Missing or unresolved claims produce no source. Confidence remains metadata.' },
  { code: 'legacy_equal_stage_exposure', rule: 'Legacy 1/k stage exposure', detail: 'An operational record with no curated exposure vector splits one unit of exposure equally across its k unique stages. Sums to exactly 1 by construction, so splitting or duplicating a scope cannot create source mass.' },
  { code: 'curated_exposure_stage_mismatch', rule: 'Curation disagrees with the record', detail: 'The curated exposure names no stage the record carries. The curation is ignored, the legacy 1/k allocation applies, and the mismatch is reported.' },
  { code: 'curated_exposure_orphan_stage', rule: 'Curation names an extra stage', detail: 'A curated stage absent from the record\'s own tags is dropped and reported; the remaining curated stages are used.' },
  { code: 'duplicate_stage_tags', rule: 'Duplicate stage tags', detail: 'Stage ids are deduplicated before the source vector is built, so a stage listed twice cannot change any number.' },
  { code: 'missing_profile_active', rule: 'Missing temporal profile, active record', detail: `An operational record inside the ${ACTIVE_HORIZON_DAYS}-day curated horizon with no explicit profile. HARD FAILURE: the data audit exits non-zero.` },
  { code: 'missing_profile_archived', rule: 'Missing temporal profile, archived record', detail: `An operational record outside the ${ACTIVE_HORIZON_DAYS}-day horizon with no explicit profile falls back to acute_exponential and is counted as a legacy diagnostic.` },
  { code: 'country_only_event', rule: 'Country-only record', detail: 'A record with countries but no defensible stage mapping is displayed and operationally unscored.' },
  { code: 'unknown_direction_unscored', rule: 'Mixed or unclassified direction', detail: 'A record whose direction is not explicitly adverse or mitigating produces no scalar field unless the curation supplies a signed stage decomposition. An unknown direction is never treated as adverse.' },
  { code: 'incident_deduplicated', rule: 'Several records, one incident', detail: 'Records sharing an incidentId are collapsed; only the primary record carries source mass. Updates and recovery reports inform the curated persistence profile and are displayed, never scored independently.' },
  { code: 'edge-allocation (diagnostics scope)', rule: 'Equal edge allocation', detail: 'Where no evidence-based dependency share exists for a node\'s inbound or outbound edges, an equal split is used and the node is named in an engine diagnostic. The shipped snapshot supplies no allocations, so every allocation in it is this fallback.' },
  { code: 'geo (diagnostics scope)', rule: 'Incomplete market-share residual', detail: 'Where disclosed country shares sum to less than one, the HHI is published as the interval [lower, upper] and the conservative upper bound is the base. The residual and the interval are reported per stage.' },
  { code: 'policy (diagnostics scope)', rule: 'Duplicate policy records', detail: 'Register rows resolving to the same policy family are collapsed before scoring; the strongest severity within a family stands, and the collapse count is reported.' },
  { code: 'facility footprint', rule: 'Incomplete facility coverage / ordinal scale', detail: `Facility coverage is a curated sample: an empty radius means no site IN THE SAMPLE. Site weight is an ordinal mapping chosen from a declared model form, never observed capacity. The ${Math.round(DISPLAY_EXPOSURE_THRESHOLD * 100)}% threshold is a display preference and gates nothing the model computes.` },
];

function fallbackTableBlock() {
  return [
    '| Fallback rule | Machine-readable diagnostic | What happens |',
    '| --- | --- | --- |',
    ...FALLBACK_RULES.map((f) => `| ${f.rule} | \`${f.code}\` | ${f.detail} |`),
  ].join('\n');
}

function curationCoverageBlock() {
  return [
    `- Curated horizon: **${ACTIVE_HORIZON_DAYS} days**. Every operational incident within it must carry an explicit stage-exposure vector and an explicit temporal profile, each with a recorded basis; a missing one is a hard audit failure.`,
    `- Explicitly curated incidents in this build: **${Object.keys(EVENT_MODEL).length}**.`,
    '- Factual eligibility is checked before fallback arithmetic. Eligible older records without curation use the equal 1/k exposure and acute_exponential profile; unresolved records remain excluded. Small current persistence says nothing about their potential historical influence. Replay uses the current model and network, with dated evidence availability; zero under missing coverage does not establish safety.',
  ].join('\n');
}

/* ---------------- the worked example ---------------- */
function workedExampleBlock() {
  const w = workedExample();
  const p = w.params;
  const n = (v, d = 10) => Number(v.toFixed(d));
  const row = (o, d = 10) => w.stageIds.map((id) => `${id} = ${n(o[id] ?? 0, d)}`).join(', ');

  const lines = [];
  lines.push('**Fixture.** Four stages in a reconvergent diamond, with country shares that sum to one at every stage.');
  lines.push('');
  lines.push('| Stage | Turnover proxy | $\\nu$ (0–10) | Country shares |');
  lines.push('| --- | ---: | ---: | --- |');
  WORKED_STAGES.forEach((s) => {
    lines.push(`| \`${s.id}\` ${s.name} | ${s.value} | ${s.nonSubstitutability} | ${Object.entries(s.shares).map(([c, v]) => `${c} ${v}`).join(', ')} |`);
  });
  lines.push('');
  lines.push(`Edges: ${WORKED_EDGES.map(([a, b]) => `\`${a}→${b}\``).join(', ')}. Stage \`C\` is reconvergent: it is reached both directly from \`A\` and through \`B\`.`);
  lines.push('');
  lines.push('**Step 1 — normalized stage weights.** $w_s = \\mathrm{value}_s / \\sum_t \\mathrm{value}_t$:');
  lines.push('');
  lines.push(`> ${row(w.stageWeight, 10)}  (sum = 1 exactly)`);
  lines.push('');
  lines.push('**Step 2 — unit non-substitutability.** $\\nu_a = \\mathrm{nonSubstitutability}_a / 10$:');
  lines.push('');
  lines.push(`> ${row(w.nonSubstitutabilityUnit, 10)}`);
  lines.push('');
  lines.push('**Step 3 — edge allocations.** No evidence-based allocations exist for this fixture, so the equal-split fallback applies (and is reported as a diagnostic):');
  lines.push('');
  lines.push(`> incoming $q$: ${Object.entries(w.allocations.q).filter(([, v]) => Object.keys(v).length).map(([b, v]) => Object.entries(v).map(([a, x]) => `q_{${b}${a}} = ${n(x)}`).join(', ')).join('; ')}`);
  lines.push(`> outgoing $r$: ${Object.entries(w.allocations.r).filter(([, v]) => Object.keys(v).length).map(([a, v]) => Object.entries(v).map(([b, x]) => `r_{${a}${b}} = ${n(x)}`).join(', ')).join('; ')}`);
  lines.push('');
  lines.push(`**Step 4 — dependency matrices.** $D_{ba} = f_d\\,q_{ba}[\\phi + (1-\\phi)\\nu_a]$ with $f_d = ${p.downstreamTransmission}$, $\\phi = ${p.minimumDependencyFactor}$; $U_{ab} = f_u\\,r_{ab}$ with $f_u = ${p.upstreamTransmission}$:`);
  lines.push('');
  Object.entries(w.D).forEach(([b, cols]) => {
    Object.entries(cols).forEach(([a, v]) => lines.push(`> $D_{${b}${a}} = ${p.downstreamTransmission} \\times ${n(w.allocations.q[b][a])} \\times (${p.minimumDependencyFactor} + ${1 - p.minimumDependencyFactor} \\times ${n(w.nonSubstitutabilityUnit[a])}) = ${n(v)}$`));
  });
  Object.entries(w.U).forEach(([a, cols]) => {
    Object.entries(cols).forEach(([b, v]) => lines.push(`> $U_{${a}${b}} = ${p.upstreamTransmission} \\times ${n(w.allocations.r[a][b])} = ${n(v)}$`));
  });
  lines.push('');
  lines.push(`**Step 5 — the incident.** Severity $q_e = ${w.incident.severity}$, age ${w.incident.ageDays} days, profile \`acute_exponential\`, curated exposure ${Object.entries(w.incident.exposure).map(([s, a]) => `$\\alpha_{e,${s}} = ${a}$`).join(', ')}, direction adverse ($d = +1$).`);
  lines.push('');
  lines.push(`> severity intensity: $g(${w.incident.severity}) = ${w.incident.severity}/10 = ${n(w.incident.intensity)}$`);
  lines.push(`> persistence multiplier: $R(${w.incident.ageDays}) = 2^{-${w.incident.ageDays}/${p.acuteHalfLifeDays}} = ${n(w.incident.persistence)}$ — the record is exactly one half-life old`);
  lines.push('');
  lines.push('**Step 6 — the signed source vector.** $z_{e,s} = d\\,g(q_e)\\,\\alpha_{e,s}\\,R_e$:');
  lines.push('');
  Object.entries(w.incident.sourceVector).forEach(([s, v]) => {
    lines.push(`> $z_{e,${s}} = 1 \\times ${n(w.incident.intensity)} \\times ${w.incident.exposure[s]} \\times ${n(w.incident.persistence)} = ${n(v)}$`);
  });
  lines.push('');
  lines.push('Every other stage has $z = 0$: the incident is not tagged there.');
  lines.push('');
  lines.push('**Step 7 — downstream channel**, in topological order, $x^d_b = \\mathrm{clip}_{[0,1]}(z_b + \\sum_{a \\in IN(b)} D_{ba} x^d_a)$:');
  lines.push('');
  lines.push(`> ${row(w.channels.xDown)}`);
  lines.push('');
  lines.push(`Stage \`C\` shows the reconvergence explicitly: $x^d_C = D_{CB}x^d_B + D_{CA}x^d_A = ${n(w.D.C.B)} \\times ${n(w.channels.xDown.B)} + ${n(w.D.C.A)} \\times ${n(w.channels.xDown.A)} = ${n(w.channels.xDown.C)}$ — a plain sum, with no independence correction.`);
  lines.push('');
  lines.push('**Step 8 — upstream channel**, in reverse topological order, $x^u_a = \\mathrm{clip}_{[0,1]}(z_a + \\sum_{b \\in OUT(a)} U_{ab} x^u_b)$:');
  lines.push('');
  lines.push(`> ${row(w.channels.xUp)}`);
  lines.push('');
  lines.push('**Step 9 — direct-source deduplication.** $p_{e,s} = \\mathrm{clip}_{[-1,1]}[z_s + (x^d_s - z_s) + (x^u_s - z_s)]$. Both channels start from $z$, so adding them naively would count the direct source twice at every sourced stage:');
  lines.push('');
  w.stageIds.forEach((s) => {
    const z = w.incident.sourceVector[s] ?? 0;
    lines.push(`> $p_{e,${s}} = ${n(z)} + (${n(w.channels.xDown[s])} - ${n(z)}) + (${n(w.channels.xUp[s])} - ${n(z)}) = ${n(w.baselineField[s])}$`);
  });
  lines.push('');
  lines.push('**Step 10 — incident aggregation.** One incident, so the bounded aggregation operator is the identity here and the final stage field is:');
  lines.push('');
  lines.push(`> ${row(w.baselineField)}`);
  lines.push('');
  lines.push('**Step 11 — headline index.** $I = \\sum_s w_s\\,F_s$, then displayed as $5 + 5I$:');
  lines.push('');
  lines.push(`> $I = ${w.stageIds.map((s) => `${n(w.stageWeight[s])} \\times ${n(w.baselineField[s])}`).join(' + ')} = ${n(w.baselineIndexSigned, 12)}$`);
  lines.push(`> displayed index $= 5 + 5 \\times ${n(w.baselineIndexSigned, 12)} = ${n(w.baselineIndexDisplay, 12)}$`);
  lines.push('');
  lines.push('**Step 12 — country measures.**');
  lines.push('');
  lines.push('| Country | Local pressure | Chain contribution |');
  lines.push('| --- | ---: | ---: |');
  Object.entries(w.countries.baseline).forEach(([c, v]) => {
    lines.push(`| \`${c}\` | ${n(v.localPressure)} | ${n(v.chainContribution)} |`);
  });
  lines.push('');
  lines.push(`The chain contributions sum to ${n(Object.values(w.countries.baseline).reduce((a, c) => a + c.chainContribution, 0), 12)}, which is the signed headline index exactly — because every stage's country shares sum to one in this fixture.`);
  lines.push('');
  lines.push(`**Step 13 — scenario delta.** A second, DISTINCT incident on stage \`C\`: severity ${w.scenario.severity}, on its own date so $R = ${n(w.scenario.persistence)}$, curated exposure $\\alpha = 0.4$, giving $z_{C} = ${n(w.scenario.sourceVector.C)}$.`);
  lines.push('');
  lines.push('The two incidents are aggregated per stage with the bounded operator $1 - \\prod_i (1 - x_i)$, applied separately by sign:');
  lines.push('');
  lines.push(`> baseline field: ${row(w.baselineField)}`);
  lines.push(`> scenario-only field: ${row(w.scenario.field)}`);
  lines.push(`> combined field: ${row(w.activeField)}`);
  lines.push('');
  lines.push(`> displayed index with the scenario $= ${n(w.activeIndexDisplay, 12)}$`);
  lines.push(`> **scenario delta** $= ${n(w.activeIndexDisplay, 12)} - ${n(w.baselineIndexDisplay, 12)} = ${n(w.scenarioDelta, 12)}$`);
  lines.push('');
  lines.push(`Check stage \`A\`: $1 - (1 - ${n(w.baselineField.A)})(1 - ${n(w.scenario.field.A)}) = ${n(w.activeField.A)}$ — saturating, so the combined value stays below the sum ${n(w.baselineField.A + w.scenario.field.A)}.`);
  lines.push('');
  lines.push(`This example is generated from \`app/src/engine/workedExample.js\` by \`npm run docs:generate\` and asserted against the live engine by \`app/src/docs/specDocs.test.js\`. The fixture uses incident \`${WORKED_INCIDENT.id}\` and scenario \`${WORKED_SCENARIO.id}\`.`);
  return lines.join('\n');
}

/* THE VERIFICATION-RUN BLOCK MUST NOT CHANGE ON EVERY COMMIT.

   The first version of this rendered the recording timestamp and the
   commit hash. That created a loop with no fixed point: the artefact
   records the commit it ran at, the document quotes the artefact, and the
   document is committed — so every commit invalidated the document, which
   needed a further commit to regenerate, which invalidated it again.
   docs:verify would have failed on main forever.

   The rule this settles on: the document quotes WHAT WAS VERIFIED — the
   commands, their outcomes, and the counts. WHEN and AT WHICH COMMIT is
   provenance, it stays in the JSON artefact, and the document points at
   it. The staleness gate keeps its real job: change a test count or a
   smoke count and this block changes, so the regeneration is required.

   Volatile detail is normalized out for the same reason. An install line
   reads "added 113 packages, and audited 114 packages in 11s", and that
   duration differs on every machine and every run. */
const stableDetail = (detail) => String(detail ?? '')
  // "… in 11s", "… in 1.4s", "… in 4m", "… in 1m 30s" — npm reports whichever
  // unit fits, and all of them differ between machines and between runs.
  .replace(/\s+in\s+(?:\d+(?:\.\d+)?\s*[hms]\s*)+/gi, '')
  .trim();

function verificationRunBlock() {
  let run;
  try {
    run = JSON.parse(readFileSync(resolve(repoRoot, 'docs', 'benchmarks', 'verification-run.json'), 'utf8'));
  } catch {
    return '_No verification run has been recorded yet. Run `npm run verify:all` to produce `docs/benchmarks/verification-run.json`._';
  }
  const rows = run.commands.map((c) => `| \`${c.command}\` | ${c.result} | ${stableDetail(c.detail)} |`);
  return [
    `Model \`${run.modelVersion}\` · dataset \`${run.datasetAsOf}\`. The commit and timestamp of the recorded run are in`,
    '[`docs/benchmarks/verification-run.json`](benchmarks/verification-run.json); they are deliberately not quoted here, because a',
    'document that pins the commit it was generated at can never be up to date with the commit that contains it.',
    '',
    '| Command | Result | Detail |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

/* The current release's identity, as a digest of what the engine computes
   rather than a commit hash. See docs/MODEL_ARCHIVE.md for why a commit
   hash cannot do this job for the CURRENT release. applyGenerated is
   synchronous, so this must be too. */
function modelDigestBlock() {
  const d = modelDigest();
  return [
    '| | |',
    '| --- | --- |',
    `| Model | \`${d.modelVersion}\` |`,
    `| Dataset | \`${d.datasetAsOf}\` |`,
    `| Output digest | \`sha256:${d.digest}\` |`,
  ].join('\n');
}

function publicReviewResultsBlock() {
  const c = JSON.parse(readFileSync(resolve(repoRoot, 'docs/benchmarks/v7-curation-uncertainty-public-review.json'), 'utf8'));
  const s = JSON.parse(readFileSync(resolve(repoRoot, 'docs/benchmarks/v7-sensitivity-public-review.json'), 'utf8'));
  const f = v => Number(v).toFixed(6);
  const r = c.results.headlineIndex;
  const range = v => `[${f(v.low ?? v.min)}, ${f(v.high ?? v.max)}]`;
  return [`Data revision **public-review-2026-09-06**, dataset **${c.datasetAsOf}**, model **${c.modelVersion}**.`, '',
    `Corrected factual-baseline headline: **${f(r.base)}** (previous audited fixture: **6.027797**). The movement is an evidence/data correction, not evidence of declining real-world risk.`, '',
    '| Uncertainty class | Current tested headline range | Scope |', '| --- | --- | --- |',
    `| Numerical parameters | ${range(s.numericalParameters.headlineEnvelope)} | Registry ranges and fixed-seed Saltelli design; bootstrap and convergence retained |`,
    `| Model form | ${range(s.modelForms.headlineEnvelope)} | Discrete form combinations |`,
    `| Curation | ${range(r)} | ${r.testedScenarioCount} scenarios including baseline and opposing adverse/mitigating settings |`,
    '| Data coverage | No scalar interval | Unresolved incidents excluded; missing denominators and site coverage remain explicit |', '',
    'These ranges are not additive, proven bounds over all allowed inputs, or statistical confidence intervals. Company criticality is structurally unaffected by event curation; this is not empirical validation. Numerical-parameter ranking sensitivity is conditional on fixed company priors and network.', '',
    'Reproduce with `npm run curation` and `npm run sensitivity -- --samples 1024`. Current artifacts use the `-public-review.json` suffix; earlier benchmark files remain preserved.'].join('\n');
}

export const GENERATORS = {
  'public-review-results': publicReviewResultsBlock,
  'model-digest': modelDigestBlock,
  'model-version': modelVersionBlock,
  'parameter-table': parameterTableBlock,
  'parameter-detail': parameterDetailBlock,
  'structural-weight-table': structuralWeightTableBlock,
  'model-form-table': modelFormTableBlock,
  'model-form-detail': modelFormDetailBlock,
  'persistence-table': persistenceTableBlock,
  'fallback-table': fallbackTableBlock,
  'curation-coverage': curationCoverageBlock,
  'worked-example': workedExampleBlock,
  'verification-run': verificationRunBlock,
};

/* Replace every generated block in a Markdown source. Returns the new
   text plus the names it found, so a document referring to a block that
   no longer exists is an error rather than a silent no-op. */
export function applyGenerated(markdown) {
  let out = markdown;
  const found = [];
  const missing = [];
  const re = /<!-- BEGIN GENERATED: ([a-z0-9-]+) -->([\s\S]*?)<!-- END GENERATED: \1 -->/g;
  out = out.replace(re, (whole, name) => {
    found.push(name);
    const gen = GENERATORS[name];
    if (!gen) { missing.push(name); return whole; }
    return `${BEGIN(name)}\n${gen()}\n${END(name)}`;
  });
  return { markdown: out, found, missing };
}
