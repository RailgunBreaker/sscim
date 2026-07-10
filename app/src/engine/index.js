/* ====================================================================
   Engine factory — takes the vault data (fetched live from server/, or
   from the static build-time snapshot fallback — see VaultContext.jsx)
   and returns every derived computation: graph structure, structural
   vulnerability, directional shock propagation, company vulnerability/
   contribution/criticality, capital power, spread trees, and history.

   This is a sensitivity/comparison tool over a frozen demonstration
   snapshot — not a calibrated, causal, or probabilistic forecasting
   model. See MODEL_ROADMAP.md and README "Model status and limitations".

   buildEngine()'s input signature is intentionally unchanged (locked by
   VaultContext.jsx, which is out of scope for this pass): it still
   accepts exactly { STAGES, FLOW_EDGES, COMPANIES, CUSTOMERS, POLICIES,
   EVENTS, OWNERS }. Everything about how those tables are used internally
   has been rebuilt — see priors.js, math.js, graph.js, diagnostics.js,
   event-assumptions.js for the pieces this file composes.
   ==================================================================== */
import { MODEL_PRIORS, SENSITIVITY_PRESETS } from './priors.js';
import { clamp, clamp10, clampSigned, decay, combineSigned, hhiWithResidual, log1pNormalized, topologicalSort } from './math.js';
import { buildAdjacency, buildDependenceMatrices, propagateFromSource, findTopPaths } from './graph.js';
import { validateGraph, createDiagnostics } from './diagnostics.js';
import { getEventAssumption } from './event-assumptions.js';

export function buildEngine({ STAGES, FLOW_EDGES, COMPANIES, CUSTOMERS, POLICIES, EVENTS, OWNERS }) {
  const diagnostics = createDiagnostics();
  const stageIds = STAGES.map((s) => s.id);

  const graphCheck = validateGraph(stageIds, FLOW_EDGES);
  graphCheck.errors.forEach((e) => diagnostics.error('graph', e));

  const { OUT, IN } = buildAdjacency(stageIds, FLOW_EDGES);
  const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));

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

  /* ---------------- directional dependence matrices (all reachable paths) ---------------- */
  const { D, U } = buildDependenceMatrices(stageIds, OUT, IN, (id) => STAGE_BY_ID[id]?.subst, MODEL_PRIORS);

  function propagateSignedSource(sourceId, magnitude, channel, priors = MODEL_PRIORS) {
    let matrices = { D, U };
    if (priors !== MODEL_PRIORS) {
      matrices = buildDependenceMatrices(stageIds, OUT, IN, (id) => STAGE_BY_ID[id]?.subst, priors);
    }
    return propagateFromSource({
      sourceId, magnitude, channel, stageIds, OUT, IN, TOPO, REV_TOPO,
      D: matrices.D, U: matrices.U, tolerance: priors.contributionTolerance,
    });
  }

  /* Single-source traced propagation — same field as propagateSignedSource,
     plus a hop-by-hop trace for playback (see graph.js). */
  function propagateTrace(sourceId, magnitude, channel, priors = MODEL_PRIORS) {
    let matrices = { D, U };
    if (priors !== MODEL_PRIORS) {
      matrices = buildDependenceMatrices(stageIds, OUT, IN, (id) => STAGE_BY_ID[id]?.subst, priors);
    }
    return propagateFromSource({
      sourceId, magnitude, channel, stageIds, OUT, IN, TOPO, REV_TOPO,
      D: matrices.D, U: matrices.U, tolerance: priors.contributionTolerance, trace: true,
    });
  }

  /* Combines several single-source traces into one synchronized playback
     trace over the SAME combined field the rest of the engine produces
     (per-source fields, noisy-OR combined at each node — identical to
     eventField / companyCriticalityRaw). This never re-derives the field:
     `field` here equals combineSigned across the per-source fields, and a
     node is revealed at the last step any contributing source reaches it,
     so the cumulative field at the final step equals `field` exactly.

     `sources`: [{ stageId, magnitude, channel }]. Returns
     { field, trace, sources } where sources echoes the effective inputs. */
  function buildTrace(sources, priors = MODEL_PRIORS) {
    const per = (sources || [])
      .filter((s) => Number.isFinite(s.magnitude) && s.magnitude !== 0 && stageIds.includes(s.stageId))
      .map((s) => ({ stageId: s.stageId, magnitude: s.magnitude, channel: s.channel, ...propagateTrace(s.stageId, s.magnitude, s.channel, priors) }));

    const field = {};
    stageIds.forEach((id) => {
      const vals = per.map((p) => p.field[id]).filter((v) => v);
      field[id] = vals.length ? combineSigned(vals) : 0;
    });

    // A node is revealed at the latest step any source settles it; an edge
    // lights up when the node it feeds ("affected": the buyer for downstream
    // links, the supplier for upstream echoes) is revealed.
    const revealStep = {};
    const allEdges = [];
    per.forEach((p) => p.trace.forEach((step) => {
      step.nodes.forEach((id) => { revealStep[id] = Math.max(revealStep[id] ?? 0, step.step); });
      step.edges.forEach((e) => allEdges.push(e));
    }));
    // Anchor every injected source at step 0 so playback opens on the shock
    // itself. A source's displayed value is its final combined field value,
    // so pinning it early keeps the reveal monotonic (it never changes) and
    // the cumulative-at-final-step-equals-field guarantee intact.
    per.forEach((p) => { revealStep[p.stageId] = 0; });

    const reached = stageIds.filter((id) => id in revealStep && field[id]);
    const maxStep = reached.reduce((m, id) => Math.max(m, revealStep[id]), 0);

    const edgeAt = {};
    const seenEdge = new Set();
    allEdges.forEach((e) => {
      const affected = e.dir === 'downstream' ? e.to : e.from;
      if (!(affected in revealStep) || !field[affected]) return;
      const key = `${e.from}|${e.to}|${e.dir}`;
      if (seenEdge.has(key)) return; seenEdge.add(key);
      (edgeAt[revealStep[affected]] ||= []).push(e);
    });

    const trace = [];
    const cumulative = {};
    for (let k = 0; k <= maxStep; k++) {
      const nodesAtK = reached.filter((id) => revealStep[id] === k);
      const incremental = {};
      nodesAtK.forEach((id) => { incremental[id] = field[id]; cumulative[id] = field[id]; });
      trace.push({
        step: k,
        nodes: nodesAtK,
        edges: edgeAt[k] || [],
        incrementalContribution: incremental,
        cumulativeContribution: { ...cumulative },
      });
    }
    return { field, trace, sources: per.map(({ stageId, magnitude, channel }) => ({ stageId, magnitude, channel })) };
  }

  /* Playback trace for one event — the multi-source companion to
     eventField(); its `field` equals eventField(e).field exactly. */
  function eventTrace(e, priors = MODEL_PRIORS) {
    const { magnitude, assumption } = eventCentralMagnitude(e, priors);
    const sources = (e.stages || []).map((sid) => ({ stageId: sid, magnitude, channel: assumption.channel }));
    return { ...buildTrace(sources, priors), magnitude, assumption };
  }

  /* Strongest modeled propagation paths between two stages, for the
     explain-path view (§11). Pure graph structure + the same dependence
     priors — an unvalidated modeled route, not a measured shipment path. */
  function topPaths(sourceId, targetId, opts = {}) {
    return findTopPaths({ sourceId, targetId, OUT, IN, D, U, ...opts });
  }

  /* ---------------- economic weight ("modeled turnover proxy") ---------------- */
  const ECONOMIC_WEIGHT = log1pNormalized(STAGES.map((s) => [s.id, s.value]));

  /* ---------------- network influence (Leontief-style sensitivity proxy) ----------------
     For each stage j: inject a unit adverse shock, propagate downstream
     over all paths, weight affected stages by ECONOMIC_WEIGHT, sum, then
     normalize 0-10. This is a MODELED SENSITIVITY measure, not measured
     economic loss or a validated centrality metric. */
  const NETWORK_INFLUENCE_RAW = {};
  STAGES.forEach((s) => {
    const field = propagateSignedSource(s.id, 1, 'downstream');
    let sum = 0;
    stageIds.forEach((id) => { sum += (ECONOMIC_WEIGHT[id] ?? 0) * Math.abs(field[id] ?? 0); });
    NETWORK_INFLUENCE_RAW[s.id] = sum;
  });
  const maxInfluence = Math.max(...Object.values(NETWORK_INFLUENCE_RAW), 1e-9);
  const NETWORK_INFLUENCE = Object.fromEntries(stageIds.map((id) => [id, clamp10(10 * NETWORK_INFLUENCE_RAW[id] / maxInfluence)]));
  const NETWORK_INFLUENCE_RANK = [...stageIds].sort((a, b) => NETWORK_INFLUENCE[b] - NETWORK_INFLUENCE[a]);
  const CHOKE = NETWORK_INFLUENCE; // compatibility alias — see MISSION spec; UI now labels this "Network influence"

  /* ---------------- geographic concentration (HHI + explicit residual) ---------------- */
  const GEO_CONCENTRATION = {}, GEO_DIAGNOSTIC = {};
  STAGES.forEach((s) => {
    const r = hhiWithResidual(s.shares);
    GEO_CONCENTRATION[s.id] = r.score10;
    if (r.overAllocated) diagnostics.warn('geo', `Stage "${s.id}" country shares sum to more than 1 — normalized for computation.`);
  });
  const GEO = GEO_CONCENTRATION; // compatibility alias

  /* ---------------- policy exposure (unchanged formula — not a flagged defect) ---------------- */
  const POLICY_EXPOSURE = Object.fromEntries(STAGES.map((s) => {
    const sevs = POLICIES.filter((p) => p.stages.includes(s.id)).map((p) => p.sev).sort((a, b) => b - a);
    return [s.id, sevs.length ? clamp10(sevs[0] + 0.4 * sevs.slice(1).reduce((a, v) => a + v, 0)) : 0];
  }));
  const POLICY = POLICY_EXPOSURE; // compatibility alias

  /* ---------------- structural vulnerability (5 static components, renormalized weights) ----------------
     Excludes any event-driven "shock" term entirely — this is the
     time-invariant structural layer. Weights are derived from
     MODEL_PRIORS.componentWeights (the single source of truth for every
     model coefficient — see priors.js) by dropping "choke" -> renamed to
     "networkInfluence" and "shock" (event-driven, not structural), then
     renormalizing the remaining four so they sum to 1. */
  const { shock: _shockWeight, choke: chokeWeight, ...restWeights } = MODEL_PRIORS.componentWeights;
  const structuralWeightSum = chokeWeight + Object.values(restWeights).reduce((a, w) => a + w, 0);
  const STRUCTURAL_WEIGHTS = Object.freeze({
    networkInfluence: chokeWeight / structuralWeightSum,
    ...Object.fromEntries(Object.entries(restWeights).map(([k, w]) => [k, w / structuralWeightSum])),
  });
  function structuralComponents(stage) {
    return { networkInfluence: NETWORK_INFLUENCE[stage.id], geo: GEO_CONCENTRATION[stage.id], policy: POLICY_EXPOSURE[stage.id], subst: stage.subst, market: stage.market };
  }
  const STRUCTURAL_VULNERABILITY = Object.fromEntries(STAGES.map((s) => {
    const comp = structuralComponents(s);
    const val = Object.entries(STRUCTURAL_WEIGHTS).reduce((a, [k, w]) => a + w * clamp10(comp[k]), 0);
    return [s.id, clamp10(val)];
  }));

  const STAGE_COMPANIES = {};
  STAGES.forEach((s) => (STAGE_COMPANIES[s.id] = []));
  COMPANIES.forEach((c) => Object.entries(c.stakes).forEach(([sid, sh]) => STAGE_COMPANIES[sid]?.push([c.id, sh])));
  Object.values(STAGE_COMPANIES).forEach((arr) => arr.sort((a, b) => b[1] - a[1]));

  /* ---------------- operational impact: signed, all-paths, noisy-OR combined ----------------
     eventCentral(e) returns the event's signed origin magnitude at the
     declared snapshot date (MODEL_PRIORS.datasetAsOf), independent of
     confidence — confidence is metadata only (see event-assumptions.js /
     Detail.jsx / Briefing.jsx), never a multiplier on physical impact. */
  function eventCentralMagnitude(e, priors = MODEL_PRIORS) {
    // A scenario built in-app can carry its own semantic classification
    // (direction/channel/operational) on the event object; otherwise fall
    // back to the curated id lookup, then to the safe unclassified default.
    const assumption = e.assumption || getEventAssumption(e.id);
    const sign = assumption.direction === 'mitigating' ? -1 : 1;
    const intensity = clamp((e.sev ?? 0) / 10, 0, 1) * decay(e.daysAgo ?? 0, priors.halfLifeDays);
    return { magnitude: clampSigned(sign * intensity), assumption };
  }

  /* One event's full propagated field (used for the per-event Detail view
     regardless of whether it counts toward the aggregate operational
     score — hazard/mixed/strategic events are still shown their own
     propagated field, just excluded from the combined aggregate below). */
  function eventField(e, priors = MODEL_PRIORS) {
    const { magnitude, assumption } = eventCentralMagnitude(e, priors);
    const perStageFields = (e.stages || []).map((sid) => propagateSignedSource(sid, magnitude, assumption.channel, priors));
    const combined = {};
    stageIds.forEach((id) => {
      const vals = perStageFields.map((f) => f[id]).filter((v) => v);
      combined[id] = vals.length ? combineSigned(vals) : 0;
    });
    return { field: combined, magnitude, assumption };
  }

  /* Aggregate operational field across a list of events — ONLY events whose
     EVENT_ASSUMPTIONS mark them `operational: true` contribute; hazard-only,
     mixed-reallocative, and long-term-strategic events are real and
     individually inspectable (via eventField above) but excluded from this
     single score, per the MISSION spec. */
  function operationalField(eventList, priors = MODEL_PRIORS) {
    const perNode = {}; stageIds.forEach((id) => (perNode[id] = []));
    for (const e of eventList) {
      const { field, assumption } = eventField(e, priors);
      if (!assumption.operational) continue;
      stageIds.forEach((id) => { if (field[id]) perNode[id].push(field[id]); });
    }
    const combined = {};
    stageIds.forEach((id) => { combined[id] = combineSigned(perNode[id]); });
    return combined;
  }

  function operationalIndex(field) {
    let num = 0, den = 0;
    stageIds.forEach((id) => { const w = ECONOMIC_WEIGHT[id] ?? 0; num += (field[id] ?? 0) * w; den += w; });
    return den ? clampSigned(num / den) : 0;
  }
  // 5 = neutral (no net active operational effect); >5 net adverse, <5 net mitigating.
  // This is a deliberately different, separately-labeled metric from
  // STRUCTURAL_VULNERABILITY (see README "Model status and limitations").
  const toDisplayIndex = (signed) => clamp10(5 + 5 * signed);

  function sensitivityEnvelope(eventList) {
    const low = operationalIndex(operationalField(eventList, SENSITIVITY_PRESETS.low));
    const base = operationalIndex(operationalField(eventList, SENSITIVITY_PRESETS.base));
    const high = operationalIndex(operationalField(eventList, SENSITIVITY_PRESETS.high));
    const vals = [low, base, high].sort((a, b) => a - b);
    return { low: vals[0], base, high: vals[2] };
  }

  /* ---------------- company metrics: vulnerability / contribution / criticality ----------------
     Three deliberately distinct numbers — see README "Model status and
     limitations" and MISSION spec "SEPARATE THE METRICS". */
  function adverseOnly(v) { return Math.max(0, v ?? 0); }

  function companyVulnerability(c, field) {
    // Share-INDEPENDENT: the average adverse impact across the stages the
    // company is present in. Two companies exposed only to the same stage
    // get the same vulnerability regardless of their relative size there.
    const stages = Object.keys(c.stakes);
    if (!stages.length) return 0;
    const sum = stages.reduce((a, sid) => a + adverseOnly(field[sid]), 0);
    return clamp10(10 * (sum / stages.length));
  }

  function companyContribution(c, field) {
    // Share-WEIGHTED: market share does not cancel. A larger stage share
    // at the same adverse-impact level produces a larger contribution.
    let total = 0;
    Object.entries(c.stakes).forEach(([sid, share]) => {
      const stageTotal = STAGE_COMPANIES[sid]?.reduce((a, [, sh]) => a + sh, 0) ?? share;
      let normShare = share;
      if (stageTotal > 1 + 1e-6) {
        normShare = share / stageTotal;
        diagnostics.warn('company-share', `Stage "${sid}" company shares sum to ${stageTotal.toFixed(3)} (>1) — contribution normalized for computation; treat as within modeled sample.`);
      }
      total += normShare * adverseOnly(field[sid]) * (ECONOMIC_WEIGHT[sid] ?? 0);
    });
    return total;
  }

  function companyCriticalityRaw(c, priors = MODEL_PRIORS) {
    // "If this company were fully disrupted" — inject a shock at every
    // stage it occupies, sized to its within-stage share, propagate in
    // both directions, and take the network-influence-weighted mean.
    // Unnormalized: this is the raw NI-weighted mean impact, before the
    // max-observed scaling companyCriticality() applies below.
    const perStageFields = Object.entries(c.stakes).map(([sid, share]) => propagateSignedSource(sid, clampSigned(share), 'both', priors));
    const field = {};
    stageIds.forEach((id) => {
      const vals = perStageFields.map((f) => f[id]).filter((v) => v);
      field[id] = vals.length ? combineSigned(vals) : 0;
    });
    let num = 0, den = 0;
    stageIds.forEach((id) => { const w = NETWORK_INFLUENCE[id] ?? 0; num += adverseOnly(field[id]) * w; den += w; });
    return { field, raw: den ? num / den : 0 };
  }

  // Criticality is normalized against the largest raw score actually
  // achieved across the current company set — the same max-observed
  // approach NETWORK_INFLUENCE uses (§1) — rather than against the
  // theoretical, practically-unreachable ceiling of every stage being
  // saturated at once. Dividing by that ceiling squashed every real
  // company's score into a sliver near 0 (the most systemically
  // important company in the snapshot scored under 2/10, indistinguishable
  // from a minor one at ~1/10). This is a strictly increasing rescaling of
  // the same raw number, so "larger market share never reduces
  // criticality" still holds — it just means the single most critical
  // company in the current snapshot now scores at (or near) 10.
  const MAX_CRITICALITY_RAW = Math.max(...COMPANIES.map((c) => companyCriticalityRaw(c).raw), 1e-9);

  function companyCriticality(c, priors = MODEL_PRIORS) {
    const { field, raw } = companyCriticalityRaw(c, priors);
    return { field, value: clamp10(10 * (raw / MAX_CRITICALITY_RAW)) };
  }

  const COMPANY_CRITICALITY = Object.fromEntries(COMPANIES.map((c) => [c.id, companyCriticality(c)]));
  const COMPANY_IMPACTS = COMPANY_CRITICALITY; // compatibility alias (was "companyImpact"/CII)
  const COMPANY_RANK = [...COMPANIES].sort((a, b) => COMPANY_CRITICALITY[b.id].value - COMPANY_CRITICALITY[a.id].value);

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

  /* ---------------- spread trees (pure graph traversal — not a flagged defect) ---------------- */
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
        rows.push({ cid, sid, contribution: sh * adverseOnly(field[sid]) * (ECONOMIC_WEIGHT[sid] ?? 0) * 10 });
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

  /* ---------------- country aggregation: structural (static) + operational (event-driven) ---------------- */
  function countryData(eventList, field, COUNTRY_NAMES) {
    const acc = {};
    Object.keys(COUNTRY_NAMES).forEach((c) => (acc[c] = { w: 0, structComp: { networkInfluence: 0, geo: 0, policy: 0, subst: 0, market: 0 }, stages: [] }));
    STAGES.forEach((s) => {
      const comp = structuralComponents(s);
      Object.entries(s.shares).forEach(([c, sh]) => {
        if (!acc[c]) return;
        acc[c].w += sh; acc[c].stages.push([s.id, sh]);
        Object.keys(comp).forEach((k) => (acc[c].structComp[k] += sh * clamp10(comp[k])));
      });
    });
    const out = {};
    Object.entries(acc).forEach(([c, a]) => {
      if (!a.w) return;
      const structComp = {}; Object.keys(a.structComp).forEach((k) => (structComp[k] = a.structComp[k] / a.w));
      const structural = clamp10(Object.entries(STRUCTURAL_WEIGHTS).reduce((s, [k, w]) => s + w * clamp10(structComp[k]), 0));

      // operational: share-weighted mean of stage operational field for stages this country participates in,
      // combined (not maxed) with any direct country-tagged event effect.
      let opNum = 0, opDen = 0;
      a.stages.forEach(([sid, sh]) => { opNum += sh * (field[sid] ?? 0); opDen += sh; });
      const stageOperational = opDen ? opNum / opDen : 0;
      const directSignals = [];
      for (const e of eventList) {
        if (e.countries?.includes(c)) {
          const { magnitude, assumption } = eventCentralMagnitude(e);
          if (assumption.operational) directSignals.push(magnitude);
        }
      }
      const operational = clampSigned(combineSigned([stageOperational, ...directSignals]));
      out[c] = { structComp, structural, operational, weight: a.w, stages: a.stages.sort((x, y) => y[1] - x[1]) };
    });
    return out;
  }

  /* ---------------- history: baseline-only, at past offsets from the snapshot date ---------------- */
  const shiftedEvents = (t) => EVENTS.map((e) => ({ ...e, daysAgo: (e.daysAgo ?? 0) + t }));
  const chainIndexAt = (t) => toDisplayIndex(operationalIndex(operationalField(shiftedEvents(t))));
  const HISTORY = Array.from({ length: 22 }, (_, i) => chainIndexAt(21 - i)); // 21 days before snapshot -> snapshot date
  const stageScoreAt = (sid, t) => toDisplayIndex(operationalField(shiftedEvents(t))[sid] ?? 0);
  const MOVERS7D = STAGES.map((s) => { const now = stageScoreAt(s.id, 0), prev = stageScoreAt(s.id, 7); return { id: s.id, now, d: now - prev }; })
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));

  // bounded-output self-check — surfaces as a diagnostic rather than silently shipping NaN/Infinity to the UI
  Object.entries(NETWORK_INFLUENCE).forEach(([id, v]) => { if (!Number.isFinite(v)) diagnostics.error('bounds', `NETWORK_INFLUENCE[${id}] is not finite.`); });
  HISTORY.forEach((v, i) => { if (!Number.isFinite(v) || v < 0 || v > 10) diagnostics.error('bounds', `HISTORY[${i}] out of [0,10] bounds: ${v}`); });

  return {
    OUT, IN, STAGE_BY_ID, COMPANY_BY_ID, SUPPLIERS, COUNTRY_LINKS, TOPO, REV_TOPO,
    MODEL_PRIORS, SENSITIVITY_PRESETS, diagnostics, graphValid: graphCheck.valid,

    D, U, NETWORK_INFLUENCE, NETWORK_INFLUENCE_RANK, CHOKE, GEO_CONCENTRATION, GEO, POLICY_EXPOSURE, POLICY,
    STRUCTURAL_VULNERABILITY, STRUCTURAL_WEIGHTS, ECONOMIC_WEIGHT, STAGE_COMPANIES,

    clamp10, clampSigned, decay,
    eventCentralMagnitude, eventField, operationalField, operationalIndex, toDisplayIndex, sensitivityEnvelope,
    propagateTrace, buildTrace, eventTrace, topPaths,

    companyVulnerability, companyContribution, companyCriticality,
    COMPANY_IMPACTS, COMPANY_CRITICALITY, COMPANY_RANK, CAP_RANK,

    supplierSpread, companySpread, customerSpread, countryData,
    structuralComponents, HISTORY, stageScoreAt, MOVERS7D,
  };
}
