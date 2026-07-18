/* ====================================================================
   mle-validation.mjs — statistical validation of the SSCIM engine.

   PART A  (MLE confidence-interval test / parameter recovery):
     Simulate "observed" stage-impact data from the engine at KNOWN true
     parameters θ* = (f_down=0.55, f_up=0.30, H=12) plus Gaussian
     observation noise; estimate θ by maximum likelihood (Gaussian noise
     => nonlinear least squares); build Wald 95% CIs from the Jacobian
     (Var(θ̂) = σ̂²(JᵀJ)⁻¹); repeat R times and check empirical coverage
     ≈ 95%. Validates: (1) the three transmission parameters are
     IDENTIFIABLE from the kind of panel data the roadmap plans to
     collect (stage impacts observed over several days), and (2) the
     MLE/CI machinery a future calibration would use is correct.

   PART B  (Monte-Carlo robustness of the algorithm's results):
     Draw θ uniformly over the declared ±30% sensitivity band, recompute
     the full pipeline per draw (network influence, structural scores,
     chain index, all-109-company criticality), and measure how stable
     the headline outputs are: percentile intervals for the chain index,
     rank stability for stages and companies.

   PART C  (cross-implementation regression check):
     This script re-implements the scoring pipeline from the engine's
     primitive functions; at base θ its outputs must match buildEngine's
     published numbers exactly (chain index 6.135723, TSMC criticality
     10, litho structural 8.004899). A mismatch fails the run.

   What this does NOT do: calibrate against real-world disruption
   episodes (no such outcome dataset exists yet — MODEL_ROADMAP.md).
   ==================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'c:/Users/Guohua/Documents/sscim-1';
const OUT = path.join(ROOT, 'computation-demo', 'validation');
fs.mkdirSync(OUT, { recursive: true });

const eng_ = await import(pathToFileURL(path.join(ROOT, 'app/src/engine/index.js')));
const math = await import(pathToFileURL(path.join(ROOT, 'app/src/engine/math.js')));
const graph = await import(pathToFileURL(path.join(ROOT, 'app/src/engine/graph.js')));
const { MODEL_PRIORS } = await import(pathToFileURL(path.join(ROOT, 'app/src/engine/priors.js')));
const { getEventAssumption } = await import(pathToFileURL(path.join(ROOT, 'app/src/engine/event-assumptions.js')));
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/src/data/vault-snapshot.json'), 'utf8'));

const { clamp, clamp10, clampSigned, decay, combineSigned, log1pNormalized, hhiWithResidual } = math;
const { buildAdjacency, buildDependenceMatrices, propagateFromSource } = graph;

/* ---------------- shared fixed structure (θ-independent) ---------------- */
const STAGES = snap.stages, EVENTS = snap.events, COMPANIES = snap.companies, POLICIES = snap.policies;
const stageIds = STAGES.map((s) => s.id);
const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const { OUT: ADJ_OUT, IN: ADJ_IN } = buildAdjacency(stageIds, snap.flowEdges);
const { order: TOPO } = math.topologicalSort(stageIds, ADJ_OUT);
const REV_TOPO = [...TOPO].reverse();
const EW = log1pNormalized(STAGES.map((s) => [s.id, s.value]));
const GEO = Object.fromEntries(STAGES.map((s) => [s.id, hhiWithResidual(s.shares).score10]));
const POL = Object.fromEntries(STAGES.map((s) => {
  const sevs = POLICIES.filter((p) => p.stages.includes(s.id)).map((p) => p.sev).sort((a, b) => b - a);
  return [s.id, sevs.length ? clamp10(sevs[0] + 0.4 * sevs.slice(1).reduce((a, v) => a + v, 0)) : 0];
}));
const W = { networkInfluence: 0.25 / 0.9, geo: 0.20 / 0.9, policy: 0.20 / 0.9, subst: 0.15 / 0.9, market: 0.10 / 0.9 };

const makePriors = ([fd, fu, H]) => ({ ...MODEL_PRIORS, downstreamTransmission: fd, upstreamTransmission: fu, halfLifeDays: H });

/* ---------------- θ-parameterized pipeline (mirrors engine/index.js) ---------------- */
function pipeline(theta) {
  const priors = makePriors(theta);
  const { D, U } = buildDependenceMatrices(stageIds, ADJ_OUT, ADJ_IN, (id) => STAGE_BY_ID[id]?.subst, priors);
  const prop = (sourceId, magnitude, channel) => propagateFromSource({
    sourceId, magnitude, channel, stageIds, OUT: ADJ_OUT, IN: ADJ_IN, TOPO, REV_TOPO, D, U,
    tolerance: priors.contributionTolerance,
  });

  const niRaw = {};
  for (const s of STAGES) {
    const f = prop(s.id, 1, 'downstream');
    niRaw[s.id] = stageIds.reduce((a, id) => a + (EW[id] ?? 0) * Math.abs(f[id] ?? 0), 0);
  }
  const maxNi = Math.max(...Object.values(niRaw), 1e-9);
  const NI = Object.fromEntries(stageIds.map((id) => [id, clamp10(10 * niRaw[id] / maxNi)]));

  const structural = Object.fromEntries(STAGES.map((s) => {
    const comp = { networkInfluence: NI[s.id], geo: GEO[s.id], policy: POL[s.id], subst: s.subst, market: s.market };
    return [s.id, clamp10(Object.entries(W).reduce((a, [k, w]) => a + w * clamp10(comp[k]), 0))];
  }));

  const eventField = (e) => {
    const assumption = e.assumption || getEventAssumption(e.id);
    const sign = assumption.direction === 'mitigating' ? -1 : 1;
    const magnitude = clampSigned(sign * clamp((e.sev ?? 0) / 10, 0, 1) * decay(e.daysAgo ?? 0, priors.halfLifeDays));
    const per = (e.stages || []).map((sid) => prop(sid, magnitude, assumption.channel));
    const combined = {};
    stageIds.forEach((id) => {
      const vals = per.map((f) => f[id]).filter((v) => v);
      combined[id] = vals.length ? combineSigned(vals) : 0;
    });
    return { field: combined, operational: assumption.operational };
  };

  const operationalField = (events) => {
    const perNode = {}; stageIds.forEach((id) => (perNode[id] = []));
    for (const e of events) {
      const { field, operational } = eventField(e);
      if (!operational) continue;
      stageIds.forEach((id) => { if (field[id]) perNode[id].push(field[id]); });
    }
    return Object.fromEntries(stageIds.map((id) => [id, combineSigned(perNode[id])]));
  };

  const opIndex = (field) => {
    let num = 0, den = 0;
    stageIds.forEach((id) => { num += (field[id] ?? 0) * (EW[id] ?? 0); den += EW[id] ?? 0; });
    return den ? clampSigned(num / den) : 0;
  };

  const critRaw = (c) => {
    const per = Object.entries(c.stakes).map(([sid, sh]) => prop(sid, clampSigned(sh), 'both'));
    const field = {};
    stageIds.forEach((id) => {
      const vals = per.map((f) => f[id]).filter((v) => v);
      field[id] = vals.length ? combineSigned(vals) : 0;
    });
    let num = 0, den = 0;
    stageIds.forEach((id) => { num += Math.max(0, field[id]) * (NI[id] ?? 0); den += NI[id] ?? 0; });
    return den ? num / den : 0;
  };

  return { NI, structural, eventField, operationalField, opIndex, critRaw };
}

/* ---------------- PART C: regression check vs buildEngine at base θ ---------------- */
const THETA_STAR = [0.55, 0.30, 12];
const base = pipeline(THETA_STAR);
const engine = eng_.buildEngine({
  STAGES, FLOW_EDGES: snap.flowEdges, COMPANIES, CUSTOMERS: snap.customers,
  POLICIES, EVENTS, OWNERS: snap.owners,
});
const chk = (label, got, want, tol = 1e-9) => {
  if (Math.abs(got - want) > tol) throw new Error(`REGRESSION CHECK FAILED: ${label} got ${got} want ${want}`);
  console.log(`  ✔ ${label}: ${got.toFixed(6)} == engine ${want.toFixed(6)}`);
};
console.log('PART C — cross-implementation regression check at base θ');
const baseChain = 5 + 5 * base.opIndex(base.operationalField(EVENTS));
chk('chain index', baseChain, engine.toDisplayIndex(engine.operationalIndex(engine.operationalField(EVENTS))));
chk('litho structural', base.structural.litho, engine.STRUCTURAL_VULNERABILITY.litho);
chk('adv_fab NI', base.NI.adv_fab, engine.NETWORK_INFLUENCE.adv_fab);
const baseCritRaws = COMPANIES.map((c) => base.critRaw(c));
const baseMax = Math.max(...baseCritRaws);
const tsmcIdx = COMPANIES.findIndex((c) => c.id === 'tsmc');
chk('TSMC criticality', clamp10(10 * baseCritRaws[tsmcIdx] / baseMax), engine.COMPANY_CRITICALITY.tsmc.value);

/* ---------------- deterministic RNG ---------------- */
function mulberry32(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

/* ---------------- PART A: MLE + Wald CIs + coverage ----------------
   Observation model: at each offset t ∈ T_OFFSETS days before the
   snapshot date, we "observe" every stage's operational impact:
       y[t,n] = operationalField(events aged +t; θ*)[n] + ε,  ε~N(0,σ²)
   Gaussian noise ⇒ the MLE of θ minimizes the residual sum of squares.
   σ is profiled out (σ̂² = RSS/N). */
const T_OFFSETS = [0, 3, 6, 9, 12, 15];
const SIGMA_TRUE = 0.02;
const shifted = (t) => EVENTS.map((e) => ({ ...e, daysAgo: (e.daysAgo ?? 0) + t }));

function modelVector(theta) {
  // invalid region guard for the optimizer
  if (theta[0] <= 0.01 || theta[0] >= 0.99 || theta[1] <= 0.01 || theta[1] >= 0.99 || theta[2] <= 1 || theta[2] >= 120) return null;
  const p = pipeline(theta);
  const v = [];
  for (const t of T_OFFSETS) {
    const f = p.operationalField(shifted(t));
    for (const id of stageIds) v.push(f[id] ?? 0);
  }
  return v;
}
const Y_TRUE = modelVector(THETA_STAR);
const NOBS = Y_TRUE.length; // 24 stages × 6 offsets = 144

const rss = (theta, y) => {
  const m = modelVector(theta);
  if (!m) return Infinity;
  let s = 0; for (let i = 0; i < y.length; i++) { const r = y[i] - m[i]; s += r * r; }
  return s;
};

/* Nelder-Mead simplex minimizer */
function nelderMead(f, x0, { step = [0.08, 0.06, 2], maxIter = 400, tol = 1e-12 } = {}) {
  const n = x0.length;
  let simplex = [x0.slice(), ...x0.map((_, i) => { const p = x0.slice(); p[i] += step[i]; return p; })];
  let fv = simplex.map(f);
  for (let iter = 0; iter < maxIter; iter++) {
    const idx = fv.map((v, i) => i).sort((a, b) => fv[a] - fv[b]);
    simplex = idx.map((i) => simplex[i]); fv = idx.map((i) => fv[i]);
    if (Math.abs(fv[n] - fv[0]) < tol) break;
    const centroid = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    const worst = simplex[n];
    const refl = centroid.map((c, j) => c + (c - worst[j]));
    const fr = f(refl);
    if (fr < fv[0]) {
      const exp_ = centroid.map((c, j) => c + 2 * (c - worst[j]));
      const fe = f(exp_);
      if (fe < fr) { simplex[n] = exp_; fv[n] = fe; } else { simplex[n] = refl; fv[n] = fr; }
    } else if (fr < fv[n - 1]) { simplex[n] = refl; fv[n] = fr; }
    else {
      const contr = centroid.map((c, j) => c + 0.5 * (worst[j] - c));
      const fc = f(contr);
      if (fc < fv[n]) { simplex[n] = contr; fv[n] = fc; }
      else for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); fv[i] = f(simplex[i]); }
    }
  }
  const best = fv.indexOf(Math.min(...fv));
  return { x: simplex[best], fx: fv[best] };
}

/* Wald CI from Jacobian: Var(θ̂) = σ̂² (JᵀJ)⁻¹ */
function waldCI(thetaHat, y) {
  const m0 = modelVector(thetaHat);
  const J = []; // NOBS × 3
  const h = [1e-4, 1e-4, 1e-3];
  const cols = thetaHat.map((_, k) => {
    const tp = thetaHat.slice(); tp[k] += h[k];
    const tm = thetaHat.slice(); tm[k] -= h[k];
    const mp = modelVector(tp), mm = modelVector(tm);
    return m0.map((_, i) => (mp[i] - mm[i]) / (2 * h[k]));
  });
  for (let i = 0; i < NOBS; i++) J.push([cols[0][i], cols[1][i], cols[2][i]]);
  // JtJ (3×3) and inverse via adjugate
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const row of J) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[a][b] += row[a] * row[b];
  const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  const inv = [
    [(A[1][1] * A[2][2] - A[1][2] * A[2][1]) / det, (A[0][2] * A[2][1] - A[0][1] * A[2][2]) / det, (A[0][1] * A[1][2] - A[0][2] * A[1][1]) / det],
    [(A[1][2] * A[2][0] - A[1][0] * A[2][2]) / det, (A[0][0] * A[2][2] - A[0][2] * A[2][0]) / det, (A[0][2] * A[1][0] - A[0][0] * A[1][2]) / det],
    [(A[1][0] * A[2][1] - A[1][1] * A[2][0]) / det, (A[0][1] * A[2][0] - A[0][0] * A[2][1]) / det, (A[0][0] * A[1][1] - A[0][1] * A[1][0]) / det],
  ];
  const sigma2 = rss(thetaHat, y) / (NOBS - 3);
  const se = [0, 1, 2].map((k) => Math.sqrt(Math.max(0, sigma2 * inv[k][k])));
  return { se, ci: thetaHat.map((v, k) => [v - 1.96 * se[k], v + 1.96 * se[k]]), sigmaHat: Math.sqrt(sigma2) };
}

console.log('\nPART A — MLE parameter recovery + 95% CI coverage');
console.log(`  observation design: ${stageIds.length} stages × ${T_OFFSETS.length} day-offsets = ${NOBS} obs/replication, noise σ = ${SIGMA_TRUE}`);
const R = 200;
const rng = mulberry32(20260712);
const START = [0.40, 0.20, 8]; // deliberately far from truth
const reps = [];
const covered = [0, 0, 0];
for (let r = 0; r < R; r++) {
  const y = Y_TRUE.map((v) => v + SIGMA_TRUE * gauss(rng));
  const fit = nelderMead((th) => rss(th, y), START);
  const { se, ci, sigmaHat } = waldCI(fit.x, y);
  for (let k = 0; k < 3; k++) if (THETA_STAR[k] >= ci[k][0] && THETA_STAR[k] <= ci[k][1]) covered[k]++;
  reps.push({ thetaHat: fit.x, se, ci, sigmaHat });
  if (r === 0) {
    console.log('  first replication (illustrative):');
    ['f_down', 'f_up', 'halfLife'].forEach((nm, k) =>
      console.log(`    ${nm}: truth ${THETA_STAR[k]}  MLE ${fit.x[k].toFixed(4)}  SE ${se[k].toFixed(4)}  95% CI [${ci[k][0].toFixed(4)}, ${ci[k][1].toFixed(4)}]`));
    console.log(`    σ̂ = ${sigmaHat.toFixed(4)} (truth ${SIGMA_TRUE})`);
  }
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) * (v - m)))); };
const summaryA = ['f_down', 'f_up', 'halfLife'].map((nm, k) => ({
  parameter: nm, truth: THETA_STAR[k],
  meanEstimate: mean(reps.map((r) => r.thetaHat[k])),
  sdEstimate: sd(reps.map((r) => r.thetaHat[k])),
  meanSE: mean(reps.map((r) => r.se[k])),
  coverage95: covered[k] / R,
}));
console.log(`  coverage over ${R} replications (target ≈ 0.95):`);
summaryA.forEach((s) => console.log(`    ${s.parameter}: mean θ̂ ${s.meanEstimate.toFixed(4)} (truth ${s.truth}), empirical SD ${s.sdEstimate.toFixed(4)}, mean SE ${s.meanSE.toFixed(4)}, coverage ${(s.coverage95 * 100).toFixed(1)}%`));

fs.writeFileSync(path.join(OUT, 'mle_replications.csv'),
  ['rep,fdown_hat,fup_hat,halflife_hat,fdown_se,fup_se,halflife_se,fdown_lo,fdown_hi,fup_lo,fup_hi,halflife_lo,halflife_hi,sigma_hat',
    ...reps.map((r, i) => [i + 1, ...r.thetaHat, ...r.se, ...r.ci.flat(), r.sigmaHat].map((v) => (+v).toFixed(6)).join(','))].join('\n') + '\n');

/* ---------------- PART B: Monte-Carlo robustness of outputs ---------------- */
console.log('\nPART B — Monte-Carlo robustness across the ±30% prior band');
const NB = 400;
const rng2 = mulberry32(777);
const draws = [];
const baseRankIds = engine.COMPANY_RANK.map((c) => c.id);
for (let i = 0; i < NB; i++) {
  const th = [0.55 * (0.7 + 0.6 * rng2()), 0.30 * (0.7 + 0.6 * rng2()), 12 * (0.7 + 0.6 * rng2())];
  const p = pipeline(th);
  const chain = 5 + 5 * p.opIndex(p.operationalField(EVENTS));
  const raws = COMPANIES.map((c) => p.critRaw(c));
  const mx = Math.max(...raws, 1e-9);
  const crit = Object.fromEntries(COMPANIES.map((c, j) => [c.id, 10 * raws[j] / mx]));
  const rank = COMPANIES.map((c) => c.id).sort((a, b) => crit[b] - crit[a]);
  const structRank = [...stageIds].sort((a, b) => p.structural[b] - p.structural[a]);
  // Kendall tau vs base company ranking
  const pos = Object.fromEntries(rank.map((id, j) => [id, j]));
  let concordant = 0, total = 0;
  for (let a = 0; a < baseRankIds.length; a++) for (let b = a + 1; b < baseRankIds.length; b++) {
    total++; if (pos[baseRankIds[a]] < pos[baseRankIds[b]]) concordant++;
  }
  draws.push({
    theta: th, chain,
    tsmcTop1: rank[0] === 'tsmc' ? 1 : 0,
    top5: rank.slice(0, 5).join('|'),
    lithoStructTop: structRank[0],
    advfabStructRank: structRank.indexOf('adv_fab') + 1,
    kendallTau: 2 * concordant / total - 1,
    tsmcCrit: crit.tsmc, nvidiaCrit: crit.nvidia, asmlCrit: crit.asml,
  });
}
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const chains = draws.map((d) => d.chain);
const taus = draws.map((d) => d.kendallTau);
const summaryB = {
  draws: NB,
  chainIndex: { base: baseChain, mean: mean(chains), p2_5: q(chains, 0.025), p97_5: q(chains, 0.975) },
  tsmcTop1Rate: mean(draws.map((d) => d.tsmcTop1)),
  lithoStructuralTop1Rate: mean(draws.map((d) => (d.lithoStructTop === 'litho' ? 1 : 0))),
  advfabStructuralTopRate: mean(draws.map((d) => (d.lithoStructTop === 'adv_fab' ? 1 : 0))),
  kendallTau: { mean: mean(taus), min: Math.min(...taus) },
  top5Modal: (() => { const c = {}; draws.forEach((d) => (c[d.top5] = (c[d.top5] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ top5: k, share: v / NB })); })(),
  nvidiaCrit: { p2_5: q(draws.map((d) => d.nvidiaCrit), 0.025), p97_5: q(draws.map((d) => d.nvidiaCrit), 0.975) },
  asmlCrit: { p2_5: q(draws.map((d) => d.asmlCrit), 0.025), p97_5: q(draws.map((d) => d.asmlCrit), 0.975) },
};
console.log(`  chain index: base ${baseChain.toFixed(3)}, MC mean ${summaryB.chainIndex.mean.toFixed(3)}, 95% interval [${summaryB.chainIndex.p2_5.toFixed(3)}, ${summaryB.chainIndex.p97_5.toFixed(3)}]`);
console.log(`  TSMC ranked #1 in ${(summaryB.tsmcTop1Rate * 100).toFixed(1)}% of draws`);
console.log(`  structural #1 = adv_fab in ${(summaryB.advfabStructuralTopRate * 100).toFixed(1)}%, = litho in ${(summaryB.lithoStructuralTop1Rate * 100).toFixed(1)}%`);
console.log(`  company-ranking Kendall τ vs base: mean ${summaryB.kendallTau.mean.toFixed(4)}, min ${summaryB.kendallTau.min.toFixed(4)}`);

fs.writeFileSync(path.join(OUT, 'mc_robustness_draws.csv'),
  ['draw,fdown,fup,halflife,chain_index,tsmc_top1,litho_struct_top1,kendall_tau,tsmc_crit,nvidia_crit,asml_crit',
    ...draws.map((d, i) => [i + 1, d.theta[0].toFixed(5), d.theta[1].toFixed(5), d.theta[2].toFixed(4), d.chain.toFixed(5),
      d.tsmcTop1, d.lithoStructTop === 'litho' ? 1 : 0, d.kendallTau.toFixed(5),
      d.tsmcCrit.toFixed(4), d.nvidiaCrit.toFixed(4), d.asmlCrit.toFixed(4)].join(','))].join('\n') + '\n');

fs.writeFileSync(path.join(OUT, 'validation-results.json'), JSON.stringify({
  partC: { chainIndexBase: baseChain, matchedEngine: true },
  partA: { design: { stages: stageIds.length, offsets: T_OFFSETS, nObs: NOBS, sigmaTrue: SIGMA_TRUE, replications: R, start: START }, summary: summaryA },
  partB: summaryB,
}, null, 2));
console.log('\nWrote validation-results.json, mle_replications.csv, mc_robustness_draws.csv');
