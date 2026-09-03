/* ====================================================================
   Engine factory — SSCIM MODEL v7 ("exposure robustness").

   Takes the vault data (fetched live from server/, or from the static
   build-time snapshot fallback — see VaultContext.jsx) and returns every
   derived computation: graph structure, structural vulnerability, joint
   incident propagation, company measures, capital power, spread trees,
   country measures and history.

   WHAT THIS IS. A deterministic, bounded comparison and sensitivity
   environment over a frozen demonstration snapshot. Its outputs are
   BOUNDED COMPARATIVE EXPOSURE SCORES.

   WHAT THIS IS NOT. Not probabilities. Not monetary losses. Not
   forecasts. Not observed trade flows. Not causal estimates. Not
   calibrated risk estimates. See docs/MODEL_V7_SPEC.md, which is the
   canonical specification this file implements; nothing here may define
   a formula that contradicts it.

   THE THREE LAYERS STAY SEPARATE, as they did in v6:
     1. STRUCTURAL BASELINE   time-invariant, event-free.
     2. OPERATIONAL FIELD     the current incident field.
     3. SCENARIO DELTA        a hypothesis applied on top (buildModel.js).

   CONFIDENCE AND EVIDENCE QUALITY ARE METADATA. They are displayed. They
   never multiply a modelled effect, here or anywhere else.

   ORDER OF OPERATIONS (spec §4):
     raw records -> incident deduplication -> signed source vector
       -> persistence -> joint propagation -> incident aggregation
       -> geographic / company aggregation -> scenario delta
   ==================================================================== */
import { BASE_PARAMS, MODEL_VERSION, resolveParams } from './registry.js';
import { clamp, clamp10, clampSigned, decay, hhiBounds, stageWeights } from './math.js';
import { aggregateNonNegative } from './aggregation.js';
import {
  buildAdjacency, buildEdgeAllocations, buildDependencyMatrices,
  propagateSignedVector, traceSignedVector, findTopPaths,
} from './propagation.js';
import { validateGraph, createDiagnostics } from './diagnostics.js';
import { getEventAssumption, incidentOf } from './event-assumptions.js';
import { groupIncidents, incidentSourceVector, incidentHorizonDays, uniqueStages } from './eventSource.js';
import { EVENT_MODEL, ACTIVE_HORIZON_DAYS } from './event-model.js';
import { policyExposure } from './policy.js';
import { DEFAULT_DATASET_AS_OF } from './priors.js';

export function buildEngine({ STAGES, FLOW_EDGES, COMPANIES, CUSTOMERS, POLICIES, EVENTS, OWNERS, datasetAsOf, params: paramOverrides, computeHistory = true }) {
  /* The snapshot date is data, not a constant: the pipeline advances it in
     the vault's `meta` table and it arrives on the bundle. Only the
     DISPLAYED date varies — every incident's age is already derived
     against it at sync time. */
  const DATASET_AS_OF = datasetAsOf || DEFAULT_DATASET_AS_OF;
  const PARAMS = paramOverrides ? resolveParams(paramOverrides) : BASE_PARAMS;

  const diagnostics = createDiagnostics();
  const stageIds = STAGES.map((s) => s.id);

  const graphCheck = validateGraph(stageIds, FLOW_EDGES);
  graphCheck.errors.forEach((e) => diagnostics.error('graph', e));

  const { OUT, IN } = buildAdjacency(stageIds, FLOW_EDGES);
  const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));

  /* Non-substitutability. The dataset field is still called `subst` for
     backwards compatibility with stored bundles, but by the dataset's own
     convention a HIGH value means the stage is HARD to substitute. v7 uses
     the unambiguous name everywhere in output, UI and documentation; the
     adapter is here and nowhere else. */
  const nonSubstitutabilityOf = (id) => STAGE_BY_ID[id]?.nonSubstitutability ?? STAGE_BY_ID[id]?.subst ?? 0;

  // If the graph is invalid (cycle / dangling edge), fall back to a stable
  // node order so the rest of the engine can still run and expose the
  // diagnostic, rather than throwing or silently propagating garbage.
  const TOPO = graphCheck.valid ? graphCheck.order : stageIds.slice();
  const REV_TOPO = [...TOPO].reverse();

  const SUPPLIERS = {};
  Object.entries(CUSTOMERS).forEach(([supId, list]) => {
    list.forEach(([custId, sh]) => (SUPPLIERS[custId] ||= []).push([supId, sh]));
  });

  const COUNTRY_LINKS = (() => {
    const m = {};
    Object.entries(CUSTOMERS).forEach(([supId, list]) => {
      const sup = COMPANY_BY_ID[supId]; if (!sup) return;
      const mainStage = Object.entries(sup.stakes).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!mainStage) return;
      list.forEach(([custId, sh]) => {
        const cust = COMPANY_BY_ID[custId];
        if (!cust || cust.country === sup.country) return;
        const key = sup.country + ">" + cust.country;
        const e = (m[key] = m[key] || { a: sup.country, b: cust.country, w: 0, sectors: {}, ex: [] });
        e.w += sh;
        e.sectors[mainStage] = (e.sectors[mainStage] || 0) + sh;
        e.ex.push([`${sup.name} → ${cust.name} (${(sh * 100).toFixed(0)}%)`, sh]);
      });
    });
    Object.values(m).forEach((e) => {
      e.top = Object.entries(e.sectors).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([sid]) => STAGE_BY_ID[sid].name);
      e.ex.sort((x, y) => y[1] - x[1]); e.ex = e.ex.slice(0, 3).map((x) => x[0]);
    });
    return Object.values(m).sort((a, b) => b.w - a.w);
  })();

  /* ---------------- edge allocations and dependency matrices ----------------
     D[b][a] = f_d * q_ba * (phi + (1-phi) nu_a),  sum_a q_ba = 1
     U[a][b] = f_u * r_ab,                         sum_b r_ab = 1  */
  const ALLOCATIONS = buildEdgeAllocations(stageIds, OUT, IN, FLOW_EDGES);
  if (ALLOCATIONS.fallbacks.incomingEqualSplit.length) {
    diagnostics.warn('edge-allocation', `${ALLOCATIONS.fallbacks.incomingEqualSplit.length} stage(s) have no evidence-based INCOMING dependency allocation — equal split across inbound edges used and reported: ${ALLOCATIONS.fallbacks.incomingEqualSplit.join(', ')}`);
  }
  if (ALLOCATIONS.fallbacks.outgoingEqualSplit.length) {
    diagnostics.warn('edge-allocation', `${ALLOCATIONS.fallbacks.outgoingEqualSplit.length} stage(s) have no evidence-based OUTGOING exposure allocation — equal split across outbound edges used and reported: ${ALLOCATIONS.fallbacks.outgoingEqualSplit.join(', ')}`);
  }
  ALLOCATIONS.fallbacks.renormalized.forEach((m) => diagnostics.warn('edge-allocation', m));

  const matricesFor = (params) => buildDependencyMatrices(stageIds, OUT, IN, nonSubstitutabilityOf, params, ALLOCATIONS);
  const { D, U, nu: NON_SUBSTITUTABILITY_UNIT } = matricesFor(PARAMS);
  const matrixCache = new Map([[PARAMS, { D, U }]]);
  const matricesOf = (params) => {
    if (params === PARAMS) return { D, U };
    if (!matrixCache.has(params)) matrixCache.set(params, matricesFor(params));
    const m = matrixCache.get(params);
    return { D: m.D, U: m.U };
  };

  /* Propagate one already-built signed source vector. */
  function propagateVectorField(z, channel, params = PARAMS) {
    const m = matricesOf(params);
    return propagateSignedVector({ z, channel, stageIds, OUT, IN, TOPO, REV_TOPO, D: m.D, U: m.U });
  }

  /* Single-stage convenience used by the network-influence and company
     constructs, which inject a unit shock at one stage. */
  function propagateSignedSource(sourceId, magnitude, channel, params = PARAMS) {
    if (!Number.isFinite(magnitude) || magnitude === 0 || !stageIds.includes(sourceId)) {
      return Object.fromEntries(stageIds.map((id) => [id, 0]));
    }
    return propagateVectorField({ [sourceId]: clampSigned(magnitude) }, channel, params).field;
  }

  function propagateTrace(sourceId, magnitude, channel, params = PARAMS) {
    const m = matricesOf(params);
    return traceSignedVector({
      z: { [sourceId]: clampSigned(magnitude) }, channel,
      stageIds, OUT, IN, TOPO, REV_TOPO, D: m.D, U: m.U,
    });
  }

  /* Playback trace over several injected sources, propagated JOINTLY as
     one vector — the same calculation the rest of the engine performs, so
     `field` here is identical to the untraced result rather than a
     re-derivation. */
  function buildTrace(sources, params = PARAMS) {
    const z = {};
    const used = [];
    (sources || []).forEach((s) => {
      if (!Number.isFinite(s.magnitude) || s.magnitude === 0 || !stageIds.includes(s.stageId)) return;
      z[s.stageId] = clampSigned((z[s.stageId] ?? 0) + s.magnitude);
      used.push({ stageId: s.stageId, magnitude: s.magnitude, channel: s.channel });
    });
    // A mixed channel set is resolved to the widest requested channel: the
    // sources are one vector now, and propagating it twice under different
    // channels would reintroduce the per-source separation v7 removes.
    const channels = new Set(used.map((s) => s.channel ?? 'both'));
    const channel = channels.size === 1 ? [...channels][0] : 'both';
    const m = matricesOf(params);
    const traced = traceSignedVector({ z, channel, stageIds, OUT, IN, TOPO, REV_TOPO, D: m.D, U: m.U });
    return { field: traced.field, trace: traced.trace, sources: used };
  }

  /* Strongest modeled propagation routes between two stages. Pure graph
     structure plus the same dependency priors the propagation uses — a
     modeled route, not a measured shipment path. */
  function topPaths(sourceId, targetId, opts = {}) {
    return findTopPaths({ sourceId, targetId, OUT, IN, D, U, ...opts });
  }

  /* ---------------- stage economic weights ----------------
     Normalized DIRECTLY to sum to one, so the headline index is a plain
     weighted mean and the country chain contributions reconcile to it
     exactly. Turnover is an IMPORTANCE PROXY: supply-chain turnover is
     sequential, so it is not an additive economic loss and no output
     derived from it is money. */
  const STAGE_WEIGHT = stageWeights(STAGES.map((s) => [s.id, s.value]), PARAMS.stageWeighting);
  const ECONOMIC_WEIGHT = STAGE_WEIGHT; // compatibility alias — same object, unambiguous name preferred

  /* ---------------- network influence ----------------
     For each stage j: inject a unit adverse shock, propagate downstream
     over the whole DAG, weight the affected stages by their economic
     weight and sum. RAW is published as itself; the 0-10 figure is
     explicitly SNAPSHOT-RELATIVE (divided by the largest raw value in
     THIS snapshot) and is therefore not comparable across snapshots. */
  const NETWORK_INFLUENCE_RAW = {};
  STAGES.forEach((s) => {
    const field = propagateSignedSource(s.id, 1, 'downstream');
    let sum = 0;
    stageIds.forEach((id) => { sum += (STAGE_WEIGHT[id] ?? 0) * Math.abs(field[id] ?? 0); });
    NETWORK_INFLUENCE_RAW[s.id] = sum;
  });
  const MAX_NETWORK_INFLUENCE_RAW = Math.max(...Object.values(NETWORK_INFLUENCE_RAW), 1e-12);
  const NETWORK_INFLUENCE_SNAPSHOT_RELATIVE = Object.fromEntries(
    stageIds.map((id) => [id, clamp10(10 * NETWORK_INFLUENCE_RAW[id] / MAX_NETWORK_INFLUENCE_RAW)]),
  );
  const NETWORK_INFLUENCE = NETWORK_INFLUENCE_SNAPSHOT_RELATIVE; // the 0-10 display score
  const NETWORK_INFLUENCE_RANK = [...stageIds].sort((a, b) =>
    NETWORK_INFLUENCE_RAW[b] - NETWORK_INFLUENCE_RAW[a] || (a < b ? -1 : 1));
  const CHOKE = NETWORK_INFLUENCE; // compatibility alias

  /* ---------------- geographic concentration: HHI with explicit bounds ---------------- */
  const GEO_BOUNDS = {};
  STAGES.forEach((s) => {
    const r = hhiBounds(s.shares);
    GEO_BOUNDS[s.id] = r;
    if (r.overAllocated) diagnostics.warn('geo', `Stage "${s.id}" country shares sum to more than 1 — normalized for computation.`);
    if (r.residual > 1e-6) {
      diagnostics.warn('geo', `Stage "${s.id}" discloses ${(r.observedSum * 100).toFixed(1)}% of country shares — HHI is reported as the interval [${r.lower.toFixed(4)}, ${r.upper.toFixed(4)}]; the conservative upper bound is the published base.`);
    }
  });
  const GEO_CONCENTRATION = Object.fromEntries(stageIds.map((id) => [
    id, PARAMS.hhiResidual === 'lower' ? GEO_BOUNDS[id].lowerScore10 : GEO_BOUNDS[id].upperScore10,
  ]));
  const GEO = GEO_CONCENTRATION; // compatibility alias

  /* ---------------- policy exposure: family-deduplicated, bounded ---------------- */
  const POLICY_RESULT = policyExposure(stageIds, POLICIES, PARAMS.policyAggregator);
  const POLICY_EXPOSURE = POLICY_RESULT.scores;
  const POLICY_FAMILY_BREAKDOWN = POLICY_RESULT.breakdown;
  const POLICY = POLICY_EXPOSURE; // compatibility alias
  if (POLICY_RESULT.duplicateRecords) {
    diagnostics.warn('policy', `${POLICY_RESULT.duplicateRecords} policy record(s) collapsed into an existing family before scoring — a duplicate report or revision cannot raise a stage's policy exposure.`);
  }

  /* ---------------- structural vulnerability ----------------
     Five components, weights from the v7 registry (normalized to sum to
     one). Event-free by construction: there is no "shock" term, and the
     v6 declared-but-unread `shock` weight is deleted. */
  const STRUCTURAL_WEIGHTS = PARAMS.structuralWeights;
  function structuralComponents(stage) {
    return {
      networkInfluence: NETWORK_INFLUENCE[stage.id],
      geo: GEO_CONCENTRATION[stage.id],
      policy: POLICY_EXPOSURE[stage.id],
      nonSubstitutability: stage.nonSubstitutability ?? stage.subst,
      market: stage.market,
    };
  }
  const STRUCTURAL_VULNERABILITY = Object.fromEntries(STAGES.map((s) => {
    const comp = structuralComponents(s);
    const val = Object.entries(STRUCTURAL_WEIGHTS).reduce((a, [k, w]) => a + w * clamp10(comp[k] ?? 0), 0);
    return [s.id, clamp10(val)];
  }));

  const STAGE_COMPANIES = {};
  STAGES.forEach((s) => (STAGE_COMPANIES[s.id] = []));
  COMPANIES.forEach((c) => Object.entries(c.stakes).forEach(([sid, sh]) => STAGE_COMPANIES[sid]?.push([c.id, sh])));
  Object.values(STAGE_COMPANIES).forEach((arr) => arr.sort((a, b) => b[1] - a[1]));

  /* ==================================================================
     OPERATIONAL LAYER
     ================================================================== */

  const assumptionOf = (e) => e?.assumption || getEventAssumption(e?.id);
  const curatedModelOf = (e) => e?.model || EVENT_MODEL[e?.id] || null;

  /* Build one incident's source vector + propagated field. */
  function incidentField(incident, params = PARAMS) {
    const e = incident.primary;
    const assumption = assumptionOf(e);
    const source = incidentSourceVector({
      event: e, assumption, ageDays: e.daysAgo ?? 0, params, curated: curatedModelOf(e),
    });
    if (!source.scored) {
      return {
        incidentId: incident.incidentId,
        field: Object.fromEntries(stageIds.map((id) => [id, 0])),
        source, scored: false, assumption,
      };
    }
    const { field, adverse, mitigating } = propagateVectorField(source.z, source.channel, params);
    return { incidentId: incident.incidentId, field, adverse, mitigating, source, scored: true, assumption };
  }

  /* One record's own propagated field, for the per-record inspection view.
     A record that is not the primary of its incident is displayed but
     contributes nothing to the aggregate — that is what deduplication
     means — so its own field is reported as zero with the reason. */
  function eventField(e, params = PARAMS) {
    const assumption = assumptionOf(e);
    const source = incidentSourceVector({
      event: e, assumption, ageDays: e.daysAgo ?? 0, params, curated: curatedModelOf(e),
    });
    const zero = Object.fromEntries(stageIds.map((id) => [id, 0]));
    if (!source.scored) return { field: zero, source, scored: false, assumption, magnitude: 0 };
    const { field } = propagateVectorField(source.z, source.channel, params);
    // A single representative magnitude for the ranking and status displays:
    // the strongest signed source component of this record.
    const magnitude = Object.values(source.z).reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
    return { field, source, scored: true, assumption, magnitude };
  }

  /* The v6 name, kept because the UI ranks and labels records with it.
     v7 semantics: the strongest signed SOURCE component of the record at
     the evaluation date — severity x exposure x persistence, signed by the
     curated direction, and never multiplied by confidence. */
  function eventCentralMagnitude(e, params = PARAMS) {
    const { magnitude, assumption, source } = eventField(e, params);
    return { magnitude, assumption, source };
  }

  /* Playback trace for one record — the companion to eventField(); its
     `field` equals eventField(e).field exactly. */
  function eventTrace(e, params = PARAMS) {
    const assumption = assumptionOf(e);
    const source = incidentSourceVector({
      event: e, assumption, ageDays: e.daysAgo ?? 0, params, curated: curatedModelOf(e),
    });
    const m = matricesOf(params);
    const traced = traceSignedVector({
      z: source.z, channel: source.channel, stageIds, OUT, IN, TOPO, REV_TOPO, D: m.D, U: m.U,
    });
    const magnitude = Object.values(source.z).reduce((acc, v) => (Math.abs(v) > Math.abs(acc) ? v : acc), 0);
    return { ...traced, sources: Object.entries(source.z).map(([stageId, mag]) => ({ stageId, magnitude: mag, channel: source.channel })), magnitude, assumption, source };
  }

  /* Deduplicate a record list into incidents. */
  function incidentsOf(eventList) {
    return groupIncidents(eventList, { incidentOf });
  }

  /* Aggregate operational field across a list of RECORDS.

     Records are grouped into incidents FIRST, each incident is propagated
     jointly ONCE, and only then are distinct incidents combined with the
     bounded aggregation operator — separately by sign, then netted. */
  function operationalField(eventList, params = PARAMS) {
    const incidents = incidentsOf(eventList);
    const pos = {}; const neg = {};
    stageIds.forEach((id) => { pos[id] = []; neg[id] = []; });
    for (const inc of incidents) {
      const { field, scored } = incidentField(inc, params);
      if (!scored) continue;
      stageIds.forEach((id) => {
        const v = field[id];
        if (v > 0) pos[id].push(v);
        else if (v < 0) neg[id].push(-v);
      });
    }
    const combined = {};
    stageIds.forEach((id) => {
      const a = aggregateNonNegative(pos[id], params.incidentAggregation);
      const m = aggregateNonNegative(neg[id], params.incidentAggregation);
      combined[id] = clampSigned(a - m);
    });
    return combined;
  }

  /* Headline index: the economic-weight-weighted mean of the stage field.
     The weights sum to one, so this is a plain weighted mean in [-1,1]. */
  function operationalIndex(field, params = PARAMS) {
    const w = params === PARAMS ? STAGE_WEIGHT : stageWeights(STAGES.map((s) => [s.id, s.value]), params.stageWeighting);
    let num = 0;
    stageIds.forEach((id) => { num += (field[id] ?? 0) * (w[id] ?? 0); });
    return clampSigned(num);
  }

  // 5 = neutral (no net active operational effect); >5 net adverse, <5 net mitigating.
  const toDisplayIndex = (signed) => clamp10(5 + 5 * signed);

  /* ---------------- assumption envelope ----------------
     The PRINCIPAL uncertainty analysis in v7 is the global sensitivity
     design in engine/sensitivity.js (scripts/build-sensitivity.mjs). This
     is the cheap in-app companion: a one-at-a-time low/high sweep over the
     propagation and persistence parameters, kept because the dashboard
     needs an envelope it can compute in a render. It is an ASSUMPTION
     ENVELOPE, never a confidence interval. */
  const ENVELOPE_PARAMS = ['downstreamTransmission', 'upstreamTransmission', 'minimumDependencyFactor',
    'acuteHalfLifeDays', 'marketHalfLifeDays', 'outageRecoveryDays'];

  function sensitivityEnvelope(eventList) {
    const base = operationalIndex(operationalField(eventList, PARAMS), PARAMS);
    let lo = base, hi = base;
    for (const key of ENVELOPE_PARAMS) {
      for (const level of ['low', 'high']) {
        const p = resolveParams({ [key]: PARAM_LEVEL[key][level] });
        const v = operationalIndex(operationalField(eventList, p), p);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return { low: lo, base, high: hi };
  }

  /* ==================================================================
     COMPANY MEASURES
     ================================================================== */
  const adverseOnly = (v) => Math.max(0, v ?? 0);

  function companyVulnerability(c, field) {
    // Share-INDEPENDENT: the mean adverse impact across the stages the
    // company is present in. Two companies exposed only to the same stage
    // get the same vulnerability regardless of their relative size there.
    const stages = Object.keys(c.stakes);
    if (!stages.length) return 0;
    const sum = stages.reduce((a, sid) => a + adverseOnly(field[sid]), 0);
    return clamp10(10 * (sum / stages.length));
  }

  function companyContribution(c, field) {
    // Share-WEIGHTED: market share does not cancel.
    let total = 0;
    Object.entries(c.stakes).forEach(([sid, share]) => {
      const stageTotal = STAGE_COMPANIES[sid]?.reduce((a, [, sh]) => a + sh, 0) ?? share;
      let normShare = share;
      if (stageTotal > 1 + 1e-6) normShare = share / stageTotal;
      total += normShare * adverseOnly(field[sid]) * (STAGE_WEIGHT[sid] ?? 0);
    });
    return total;
  }

  let companyShareWarningIssued = false;
  Object.entries(STAGE_COMPANIES).forEach(([sid, arr]) => {
    const total = arr.reduce((a, [, sh]) => a + sh, 0);
    if (total > 1 + 1e-6 && !companyShareWarningIssued) {
      companyShareWarningIssued = true;
      diagnostics.warn('company-share', `At least one stage's company shares sum to more than 1 (e.g. "${sid}" at ${total.toFixed(3)}) — contributions are normalized for computation; treat as within the modeled sample.`);
    }
  });

  /* Company criticality: "if this company were fully disrupted".

     TOPOLOGY IS APPLIED EXACTLY ONCE. v6 propagated from every stage the
     company occupies (topology, pass one) and then weighted the resulting
     field by NETWORK_INFLUENCE (which is itself a propagation-derived
     reachability measure — topology, pass two), so a company on a
     well-connected stage was rewarded twice for the same connectivity.
     v7 weights the propagated field by the ECONOMIC WEIGHT, which carries
     no topology at all.

     The company's stakes are injected as ONE joint source vector, so a
     company present in several stages is one disruption, not several. */
  function companyCriticalityRaw(c, params = PARAMS) {
    const z = {};
    Object.entries(c.stakes || {}).forEach(([sid, share]) => {
      if (!stageIds.includes(sid)) return;
      z[sid] = clamp(share, 0, 1);
    });
    const { field } = propagateVectorField(z, 'both', params);
    const w = params === PARAMS ? STAGE_WEIGHT : stageWeights(STAGES.map((s) => [s.id, s.value]), params.stageWeighting);
    let num = 0, den = 0;
    stageIds.forEach((id) => { const ww = w[id] ?? 0; num += adverseOnly(field[id]) * ww; den += ww; });
    return { field, raw: den ? num / den : 0 };
  }

  /* Snapshot-relative rescaling. The 0-10 number is the raw value divided
     by the largest raw value IN THIS SNAPSHOT. It orders companies within
     one snapshot and NOTHING ELSE: it is not comparable across snapshots,
     because the denominator changes when the company set does. The raw
     value is published alongside it for exactly that reason. */
  const COMPANY_CRITICALITY_RAW = Object.fromEntries(COMPANIES.map((c) => [c.id, companyCriticalityRaw(c).raw]));
  const MAX_CRITICALITY_RAW = Math.max(...Object.values(COMPANY_CRITICALITY_RAW), 1e-12);

  function companyCriticality(c, params = PARAMS) {
    const { field, raw } = companyCriticalityRaw(c, params);
    return { field, raw, value: clamp10(10 * (raw / MAX_CRITICALITY_RAW)), snapshotRelative: true };
  }

  const COMPANY_CRITICALITY = Object.fromEntries(COMPANIES.map((c) => [c.id, companyCriticality(c)]));
  const COMPANY_IMPACTS = COMPANY_CRITICALITY; // compatibility alias
  const COMPANY_RANK = [...COMPANIES].sort((a, b) =>
    COMPANY_CRITICALITY_RAW[b.id] - COMPANY_CRITICALITY_RAW[a.id] || (a.id < b.id ? -1 : 1));

  const CAP_RANK = (() => {
    const m = {};
    Object.entries(OWNERS).forEach(([cid, list]) => {
      const w = COMPANY_CRITICALITY[cid]?.value ?? 0;
      list.forEach(([o, sh]) => {
        const e = (m[o] = m[o] || { power: 0, holdings: [] });
        e.power += sh * w;
        e.holdings.push([cid, sh]);
      });
    });
    return Object.entries(m).map(([o, e]) => ({
      o, power: e.power, gov: /gov|SOE|METI/.test(o),
      holdings: e.holdings.sort((a, b) => b[1] - a[1]),
    })).sort((a, b) => b.power - a.power);
  })();

  /* ---------------- spread trees (pure graph traversal) ---------------- */
  function supplierSpread(cid) {
    const seen = new Set([cid]);
    const mk = (list) => list.filter(([c]) => !seen.has(c)).map(([c, rel]) => ({ cid: c, rel })).sort((a, b) => b.rel - a.rel).slice(0, 5);
    const h1 = mk(SUPPLIERS[cid] || []); h1.forEach((r) => seen.add(r.cid));
    const pool = [];
    h1.forEach((r) => (SUPPLIERS[r.cid] || []).forEach(([c2, rel2]) => pool.push([c2, rel2 * r.rel])));
    const best = {};
    pool.forEach(([c, w]) => { if (!seen.has(c) && (!best[c] || w > best[c])) best[c] = w; });
    const h2 = Object.entries(best).map(([c, w]) => ({ cid: c, rel: w })).sort((a, b) => b.rel - a.rel).slice(0, 5);
    return [h1, h2];
  }

  function companySpread(sourceStages, field, excludeCompany) {
    const hops = [new Set(sourceStages)];
    const seenStage = new Set(sourceStages);
    for (let h = 1; h <= 2; h++) {
      const next = new Set();
      hops[h - 1].forEach((s) => (OUT[s] || []).forEach((d) => { if (!seenStage.has(d)) { next.add(d); seenStage.add(d); } }));
      hops.push(next);
    }
    const seenCo = new Set(excludeCompany ? [excludeCompany] : []);
    return hops.map((stageSet) => {
      const rows = [];
      stageSet.forEach((sid) => (STAGE_COMPANIES[sid] || []).forEach(([cid, sh]) => {
        if (seenCo.has(cid)) return;
        rows.push({ cid, sid, contribution: sh * adverseOnly(field[sid]) * (STAGE_WEIGHT[sid] ?? 0) * 10 });
      }));
      const best = {};
      rows.forEach((r) => { if (!best[r.cid] || r.contribution > best[r.cid].contribution) best[r.cid] = r; });
      const top = Object.values(best).sort((a, b) => b.contribution - a.contribution).slice(0, 5);
      top.forEach((r) => seenCo.add(r.cid));
      return top;
    });
  }

  function customerSpread(cid, field) {
    const seen = new Set([cid]);
    const mk = (list) => list
      .filter(([c]) => !seen.has(c))
      .map(([c, rel]) => ({ cid: c, rel, contribution: companyContribution(COMPANY_BY_ID[c], field) }))
      .sort((a, b) => b.rel * b.contribution - a.rel * a.contribution).slice(0, 5);
    const h1 = mk(CUSTOMERS[cid] || []);
    h1.forEach((r) => seen.add(r.cid));
    const pool = [];
    h1.forEach((r) => (CUSTOMERS[r.cid] || []).forEach(([c2, rel2]) => pool.push([c2, rel2 * r.rel])));
    const best = {};
    pool.forEach(([c, w]) => { if (!seen.has(c) && (!best[c] || w > best[c])) best[c] = w; });
    const h2 = Object.entries(best)
      .map(([c, w]) => ({ cid: c, rel: w, contribution: companyContribution(COMPANY_BY_ID[c], field) }))
      .sort((a, b) => b.rel * b.contribution - a.rel * a.contribution).slice(0, 5);
    return [h1, h2];
  }

  /* ==================================================================
     COUNTRY AGGREGATION — two distinct, separately labelled measures.

     LOCAL PRESSURE   share-weighted MEAN of the stage field over the
                      stages this country participates in, normalized by
                      the country's own modeled stage footprint. "How hard
                      is the part of the chain that sits here being
                      squeezed?" Comparable between countries; says nothing
                      about how much of the whole chain that is.

     CHAIN CONTRIBUTION  the country's UNNORMALIZED contribution to the
                      overall weighted field: sum_s share(c,s) * w_s * f_s.
                      Because sum_c share(c,s) = 1 wherever shares are
                      fully disclosed, these reconcile to the headline
                      index exactly. "How much of the headline number is
                      this country?"

     v6's country `directSignals` term is REMOVED. It combined a
     country-tagged event's raw magnitude into the country reading on top
     of the same event's stage field, so a country tagged on an event it
     also hosts stages for counted that event twice. In v7 an incident
     enters a country's output through its stage source and propagation,
     exactly once.
     ================================================================== */
  function countryData(eventList, field, COUNTRY_NAMES) {
    const acc = {};
    Object.keys(COUNTRY_NAMES).forEach((c) => (acc[c] = {
      w: 0, structComp: { networkInfluence: 0, geo: 0, policy: 0, nonSubstitutability: 0, market: 0 }, stages: [],
    }));
    STAGES.forEach((s) => {
      const comp = structuralComponents(s);
      Object.entries(s.shares || {}).forEach(([c, sh]) => {
        if (!acc[c]) return;
        acc[c].w += sh; acc[c].stages.push([s.id, sh]);
        Object.keys(comp).forEach((k) => (acc[c].structComp[k] += sh * clamp10(comp[k] ?? 0)));
      });
    });

    const out = {};
    Object.entries(acc).forEach(([c, a]) => {
      if (!a.w) return;
      const structComp = {}; Object.keys(a.structComp).forEach((k) => (structComp[k] = a.structComp[k] / a.w));
      const structural = clamp10(Object.entries(STRUCTURAL_WEIGHTS).reduce((s, [k, w]) => s + w * clamp10(structComp[k]), 0));

      let pressureNum = 0, pressureDen = 0, chain = 0;
      a.stages.forEach(([sid, sh]) => {
        const f = field[sid] ?? 0;
        pressureNum += sh * f;
        pressureDen += sh;
        chain += sh * (STAGE_WEIGHT[sid] ?? 0) * f;
      });
      const localPressure = pressureDen ? clampSigned(pressureNum / pressureDen) : 0;

      out[c] = {
        structComp, structural,
        localPressure,
        chainContribution: chain,
        /* Deprecated alias for `localPressure`, kept so stored v6 views
           keep resolving. New code and all documentation use the two
           unambiguous names above. */
        operational: localPressure,
        weight: a.w,
        stages: a.stages.sort((x, y) => y[1] - x[1]),
      };
    });
    return out;
  }

  /* ==================================================================
     HISTORY — baseline only, at past offsets from the snapshot date.

     THIS IS A v7 RETROSPECTIVE, AND IT IS LABELLED AS ONE. The series is
     recomputed today, under today's model, over the records as they stood
     at each past date. It is NOT what was published on those dates: the v6
     engine produced materially different numbers from the same records
     (see docs/benchmarks/v6-to-v7-benchmark.json). Archived briefings keep
     their own stored model version and are never restated.
     ==================================================================


     At a date t days before the snapshot, an incident's age was
     (daysAgo - t); incidents with a negative age had not happened yet and
     are excluded. Incidents past their own persistence horizon at that
     date are skipped for speed — the horizon comes from the incident's own
     curated profile (persistence.js), never from one global constant.
     ================================================================== */
  const HORIZON_CACHE = new Map();
  const horizonOf = (e, params) => {
    const key = `${e.id}|${params.acuteHalfLifeDays}|${params.marketHalfLifeDays}|${params.outageRecoveryDays}`;
    if (!HORIZON_CACHE.has(key)) HORIZON_CACHE.set(key, incidentHorizonDays(e, params, curatedModelOf(e)));
    return HORIZON_CACHE.get(key);
  };

  const eventsAsOf = (t, params = PARAMS) => EVENTS
    .filter((e) => {
      const age = (e.daysAgo ?? 0) - t;
      return age >= 0 && age <= horizonOf(e, params);
    })
    .map((e) => ({ ...e, daysAgo: (e.daysAgo ?? 0) - t }));

  const chainIndexAt = (t) => toDisplayIndex(operationalIndex(operationalField(eventsAsOf(t))));
  const stageScoreAt = (sid, t) => toDisplayIndex(operationalField(eventsAsOf(t))[sid] ?? 0);

  /* `computeHistory: false` skips the multi-year replay. The global
     sensitivity sweep builds thousands of engines and reads only the
     current-date outputs; replaying a decade of history for each one would
     cost minutes and change nothing it reports. Nothing else sets it. */
  const HISTORY = computeHistory
    ? Array.from({ length: 22 }, (_, i) => chainIndexAt(21 - i)) // 21 days before snapshot -> snapshot date
    : [];

  /* Long-run computed history — weekly samples back to the oldest record,
     plus an exact sample on each record's own date so spikes are not
     attenuated by grid placement. */
  const maxDaysAgo = EVENTS.reduce((m, e) => Math.max(m, e.daysAgo ?? 0), 0);
  const longSpanDays = Math.min(maxDaysAgo + 14, 4200); // safety cap ~11.5y
  const longOffsets = new Set([0]);
  for (let t = 0; t <= longSpanDays; t += 7) longOffsets.add(t);
  EVENTS.forEach((e) => {
    const d = e.daysAgo ?? 0;
    if (d > 0 && d <= longSpanDays) { longOffsets.add(d); longOffsets.add(Math.max(0, d - 3)); }
  });
  const LONG_HISTORY = computeHistory
    ? [...longOffsets].sort((a, b) => b - a).map((t) => ({ daysAgo: t, index: chainIndexAt(t) }))
    : [];
  const MOVERS7D = computeHistory
    ? STAGES.map((s) => { const now = stageScoreAt(s.id, 0), prev = stageScoreAt(s.id, 7); return { id: s.id, now, d: now - prev }; })
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    : [];

  /* ==================================================================
     MODEL AUDIT — every fallback, counted and machine-readable.
     Each entry corresponds to a documented fallback rule in
     docs/MODEL_V7_SPEC.md §6, so the specification can quote these counts
     rather than claiming coverage the data does not have.
     ================================================================== */
  const MODEL_AUDIT = (() => {
    const codes = {};
    const byCode = {};
    const bump = (code, id, detail) => {
      codes[code] = (codes[code] ?? 0) + 1;
      (byCode[code] ||= []).push({ id, detail });
    };
    const incidents = incidentsOf(EVENTS);
    let scoredIncidents = 0;
    for (const inc of incidents) {
      const e = inc.primary;
      const assumption = assumptionOf(e);
      const source = incidentSourceVector({ event: e, assumption, ageDays: e.daysAgo ?? 0, params: PARAMS, curated: curatedModelOf(e) });
      source.diagnostics.forEach((d) => bump(d.code, d.id, d.detail));
      if (source.scored) scoredIncidents += 1;
      if (inc.recordCount > 1) bump('incident_deduplicated', inc.incidentId, `${inc.recordCount} records collapsed to one incident (primary "${e.id}")`);
    }
    return {
      counts: codes,
      details: byCode,
      recordCount: EVENTS.length,
      incidentCount: incidents.length,
      scoredIncidentCount: scoredIncidents,
      curatedEventCount: Object.keys(EVENT_MODEL).length,
      activeHorizonDays: ACTIVE_HORIZON_DAYS,
      edgeAllocationFallback: {
        incomingEqualSplit: ALLOCATIONS.fallbacks.incomingEqualSplit.length,
        outgoingEqualSplit: ALLOCATIONS.fallbacks.outgoingEqualSplit.length,
        renormalized: ALLOCATIONS.fallbacks.renormalized.length,
      },
      hhiPartialDisclosure: stageIds.filter((id) => GEO_BOUNDS[id].residual > 1e-6).length,
      policyDuplicateRecords: POLICY_RESULT.duplicateRecords,
      policyFamilies: POLICY_RESULT.families.length,
    };
  })();

  /* A missing profile or exposure on an ACTIVE operational incident is a
     hard defect, not a footnote — the audit script fails the build on it. */
  if (MODEL_AUDIT.counts.missing_profile_active) {
    diagnostics.error('event-model', `${MODEL_AUDIT.counts.missing_profile_active} operational incident(s) inside the ${ACTIVE_HORIZON_DAYS}-day curated horizon have no explicit temporal profile.`);
  }
  if (MODEL_AUDIT.counts.missing_profile_archived) {
    diagnostics.warn('event-model', `${MODEL_AUDIT.counts.missing_profile_archived} archived operational record(s) outside the ${ACTIVE_HORIZON_DAYS}-day curated horizon use the legacy "${'acute_exponential'}" profile fallback.`);
  }
  if (MODEL_AUDIT.counts.legacy_equal_stage_exposure) {
    diagnostics.warn('event-model', `${MODEL_AUDIT.counts.legacy_equal_stage_exposure} operational record(s) use the legacy 1/k equal stage-exposure fallback.`);
  }
  if (MODEL_AUDIT.counts.country_only_event) {
    diagnostics.warn('event-model', `${MODEL_AUDIT.counts.country_only_event} record(s) carry countries but no defensible stage mapping — displayed, operationally unscored.`);
  }
  if (MODEL_AUDIT.counts.unknown_direction_unscored) {
    diagnostics.warn('event-model', `${MODEL_AUDIT.counts.unknown_direction_unscored} record(s) have a mixed or unclassified direction with no signed stage components — displayed, operationally unscored.`);
  }

  // bounded-output self-check — surfaces as a diagnostic rather than silently shipping NaN/Infinity to the UI
  Object.entries(NETWORK_INFLUENCE).forEach(([id, v]) => { if (!Number.isFinite(v)) diagnostics.error('bounds', `NETWORK_INFLUENCE[${id}] is not finite.`); });
  HISTORY.forEach((v, i) => { if (!Number.isFinite(v) || v < 0 || v > 10) diagnostics.error('bounds', `HISTORY[${i}] out of [0,10] bounds: ${v}`); });
  LONG_HISTORY.forEach((p, i) => { if (!Number.isFinite(p.index) || p.index < 0 || p.index > 10) diagnostics.error('bounds', `LONG_HISTORY[${i}] out of [0,10] bounds: ${p.index}`); });

  /* The parameter view the UI and the archived-briefing pipeline read.
     Carries the resolved v7 parameters plus the two fields every stored
     artefact needs to be interpretable later. */
  const MODEL_PRIORS = Object.freeze({ ...PARAMS, datasetAsOf: DATASET_AS_OF, modelVersion: MODEL_VERSION });

  return {
    STAGES, OUT, IN, STAGE_BY_ID, COMPANY_BY_ID, SUPPLIERS, COUNTRY_LINKS, TOPO, REV_TOPO,
    MODEL_PRIORS, PARAMS, MODEL_VERSION, datasetAsOf: DATASET_AS_OF,
    diagnostics, graphValid: graphCheck.valid, MODEL_AUDIT,

    D, U, EDGE_ALLOCATIONS: ALLOCATIONS, NON_SUBSTITUTABILITY_UNIT,
    NETWORK_INFLUENCE_RAW, NETWORK_INFLUENCE_SNAPSHOT_RELATIVE, NETWORK_INFLUENCE, NETWORK_INFLUENCE_RANK, CHOKE,
    GEO_BOUNDS, GEO_CONCENTRATION, GEO,
    POLICY_EXPOSURE, POLICY, POLICY_FAMILY_BREAKDOWN, POLICY_FAMILIES: POLICY_RESULT.families,
    STRUCTURAL_VULNERABILITY, STRUCTURAL_WEIGHTS, STAGE_WEIGHT, ECONOMIC_WEIGHT, STAGE_COMPANIES,

    clamp10, clampSigned, decay,
    incidentsOf, incidentField,
    eventCentralMagnitude, eventField, operationalField, operationalIndex, toDisplayIndex, sensitivityEnvelope,
    propagateSignedSource, propagateVectorField, propagateTrace, buildTrace, eventTrace, topPaths,

    companyVulnerability, companyContribution, companyCriticality, companyCriticalityRaw,
    COMPANY_CRITICALITY_RAW, MAX_CRITICALITY_RAW,
    COMPANY_IMPACTS, COMPANY_CRITICALITY, COMPANY_RANK, CAP_RANK,

    supplierSpread, companySpread, customerSpread, countryData,
    structuralComponents, HISTORY, LONG_HISTORY, chainIndexAt, stageScoreAt, MOVERS7D,

    EVENTS, eventsAsOf, longSpanDays,
    /* Every consumer of HISTORY / LONG_HISTORY must be able to say what it
       is looking at. These two fields exist so no surface can present a
       recomputed series as a contemporaneous record by omission. */
    HISTORY_IS_RETROSPECTIVE: true,
    HISTORY_LABEL: `v7 retrospective — recomputed under ${MODEL_VERSION}, not the values published on those dates`,
    indexOf: (eventList, t = 0) => toDisplayIndex(operationalIndex(operationalField(
      (eventList || []).filter((e) => {
        const age = (e.daysAgo ?? 0) - t;
        return age >= 0 && age <= horizonOf(e, PARAMS);
      }).map((e) => ({ ...e, daysAgo: (e.daysAgo ?? 0) - t })),
    ))),
  };
}

/* low/high levels for the in-app envelope sweep, read from the registry so
   they cannot drift from the published parameter table. */
import { PARAMETERS } from './registry.js';
const PARAM_LEVEL = Object.fromEntries(Object.entries(PARAMETERS).map(([k, p]) => [k, { low: p.low, high: p.high }]));

export { uniqueStages };
