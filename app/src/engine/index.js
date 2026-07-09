/* ====================================================================
   Engine factory — takes the vault data fetched from the backend API at
   runtime and returns every derived computation (graph structure, risk
   scores, shock propagation, spread trees, capital power, history).
   This used to be a set of modules that computed everything once at
   import time from statically-imported data tables; now that the tables
   themselves come from a live API call, the same computations run once
   per data load instead, wrapped in a single factory so nothing is
   computed from stale/partial data.
   ==================================================================== */

const clamp10 = (v) => Math.min(10, Math.max(0, v));
const CONF_W = { High: 1.0, Medium: 0.75, Low: 0.5, Simulated: 1.0 };
const WEIGHTS = { choke: 0.25, geo: 0.2, policy: 0.2, subst: 0.15, shock: 0.1, market: 0.1 };

export function buildEngine({ STAGES, FLOW_EDGES, COMPANIES, CUSTOMERS, POLICIES, EVENTS, OWNERS }) {
  const OUT = {}, IN = {};
  STAGES.forEach((s) => { OUT[s.id] = []; IN[s.id] = []; });
  FLOW_EDGES.forEach(([a, b]) => { OUT[a].push(b); IN[b].push(a); });
  const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));

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

  const TOPO = (() => {
    const indeg = {}; STAGES.forEach((s) => (indeg[s.id] = IN[s.id].length));
    const q = STAGES.filter((s) => indeg[s.id] === 0).map((s) => s.id), order = [];
    while (q.length) { const n = q.shift(); order.push(n); OUT[n].forEach((m) => { if (--indeg[m] === 0) q.push(m); }); }
    return order;
  })();

  const CHOKE = (() => {
    const pTo = {}, pFrom = {};
    TOPO.forEach((n) => (pTo[n] = IN[n].length ? IN[n].reduce((a, p) => a + pTo[p], 0) : 1));
    [...TOPO].reverse().forEach((n) => (pFrom[n] = OUT[n].length ? OUT[n].reduce((a, c) => a + pFrom[c], 0) : 1));
    const th = {}; let max = 0;
    STAGES.forEach((s) => { th[s.id] = pTo[s.id] * pFrom[s.id]; max = Math.max(max, th[s.id]); });
    const o = {}; STAGES.forEach((s) => (o[s.id] = 10 * Math.sqrt(th[s.id] / max)));
    return o;
  })();

  const MAX_LOG_V = Math.max(...STAGES.map((s) => Math.log(s.value)));
  const IMPORTANCE = (() => {
    const o = {};
    STAGES.forEach((s) => (o[s.id] = 10 * (0.6 * (CHOKE[s.id] / 10) + 0.4 * (Math.log(s.value) / MAX_LOG_V))));
    return o;
  })();
  const IMP_RANK = Object.entries(IMPORTANCE).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const EDGE_W = (() => {
    const o = {};
    STAGES.forEach((s) => {
      const tot = OUT[s.id].reduce((a, c) => a + STAGE_BY_ID[c].value, 0);
      OUT[s.id].forEach((c) => (o[s.id + ">" + c] = STAGE_BY_ID[c].value / tot));
    });
    return o;
  })();

  const GEO = Object.fromEntries(STAGES.map((s) => [s.id, 10 * Object.values(s.shares).reduce((a, v) => a + v * v, 0)]));
  const POLICY = Object.fromEntries(STAGES.map((s) => {
    const sevs = POLICIES.filter((p) => p.stages.includes(s.id)).map((p) => p.sev).sort((a, b) => b - a);
    return [s.id, sevs.length ? clamp10(sevs[0] + 0.4 * sevs.slice(1).reduce((a, v) => a + v, 0)) : 0];
  }));

  const STAGE_COMPANIES = {};
  STAGES.forEach((s) => (STAGE_COMPANIES[s.id] = []));
  COMPANIES.forEach((c) => Object.entries(c.stakes).forEach(([sid, sh]) => STAGE_COMPANIES[sid]?.push([c.id, sh])));
  Object.values(STAGE_COMPANIES).forEach((arr) => arr.sort((a, b) => b[1] - a[1]));

  function propagate(sources, confW, decay) {
    const shock = {}; STAGES.forEach((s) => (shock[s.id] = 0));
    const bump = (id, v) => (shock[id] = Math.max(shock[id], clamp10(v)));
    for (const [s0, sev] of sources) {
      const base = sev * confW * decay;
      bump(s0, base);
      (OUT[s0] || []).forEach((d1) => {
        const f1 = 0.55 * (0.5 + 0.5 * EDGE_W[s0 + ">" + d1]);
        bump(d1, base * f1);
        (OUT[d1] || []).forEach((d2) => bump(d2, base * f1 * 0.55 * (0.5 + 0.5 * EDGE_W[d1 + ">" + d2])));
      });
      (IN[s0] || []).forEach((u1) => bump(u1, base * 0.3));
    }
    return shock;
  }
  const eventShock = (e) => propagate(e.stages.map((s) => [s, e.sev]), CONF_W[e.conf] ?? 0.75, Math.exp(-e.daysAgo / 12));
  function mergeShocks(list) {
    const m = {}; STAGES.forEach((s) => (m[s.id] = 0));
    list.forEach((sh) => STAGES.forEach((s) => (m[s.id] = Math.max(m[s.id], sh[s.id]))));
    return m;
  }

  const TOT_IMP = STAGES.reduce((a, s) => a + IMPORTANCE[s.id], 0);
  const chainImpact = (shock) => STAGES.reduce((a, s) => a + shock[s.id] * IMPORTANCE[s.id], 0) / TOT_IMP;

  function companyImpact(c) {
    const shock = propagate(Object.entries(c.stakes).map(([s, sh]) => [s, 10 * sh]), 1.0, 1.0);
    return { shock, index: chainImpact(shock) };
  }
  const COMPANY_IMPACTS = Object.fromEntries(COMPANIES.map((c) => [c.id, companyImpact(c)]));
  const COMPANY_RANK = [...COMPANIES].sort((a, b) => COMPANY_IMPACTS[b.id].index - COMPANY_IMPACTS[a.id].index);

  const CAP_RANK = (() => {
    const m = {};
    Object.entries(OWNERS).forEach(([cid, list]) => {
      const w = COMPANY_IMPACTS[cid]?.index ?? 0;
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

  function companyExposure(c, shock) {
    let num = 0, den = 0;
    Object.entries(c.stakes).forEach(([sid, sh]) => { num += sh * shock[sid]; den += sh; });
    return den ? num / den : 0;
  }

  function companySpread(sourceStages, shock, excludeCompany) {
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
        rows.push({ cid, sid, exp: sh * shock[sid] });
      }));
      const best = {};
      rows.forEach((r) => { if (!best[r.cid] || r.exp > best[r.cid].exp) best[r.cid] = r; });
      const top = Object.values(best).sort((a, b) => b.exp - a.exp).slice(0, 5);
      top.forEach((r) => seenCo.add(r.cid));
      return top;
    });
  }

  function customerSpread(cid, shock) {
    const seen = new Set([cid]);
    const mk = (list) => list
      .filter(([c]) => !seen.has(c))
      .map(([c, rel]) => ({ cid: c, rel, exp: companyExposure(COMPANY_BY_ID[c], shock) }))
      .sort((a, b) => b.rel * b.exp - a.rel * a.exp).slice(0, 5);
    const h1 = mk(CUSTOMERS[cid] || []);
    h1.forEach((r) => seen.add(r.cid));
    const pool = [];
    h1.forEach((r) => (CUSTOMERS[r.cid] || []).forEach(([c2, rel2]) => pool.push([c2, rel2 * r.rel])));
    const best = {};
    pool.forEach(([c, w]) => { if (!seen.has(c) && (!best[c] || w > best[c])) best[c] = w; });
    const h2 = Object.entries(best)
      .map(([c, w]) => ({ cid: c, rel: w, exp: companyExposure(COMPANY_BY_ID[c], shock) }))
      .sort((a, b) => b.rel * b.exp - a.rel * a.exp).slice(0, 5);
    return [h1, h2];
  }

  const stageComponents = (s, shock) => ({ choke: CHOKE[s.id], geo: GEO[s.id], policy: POLICY[s.id], subst: s.subst, shock: shock[s.id], market: s.market });
  const total = (comp) => Object.keys(WEIGHTS).reduce((a, k) => a + WEIGHTS[k] * clamp10(comp[k]), 0);

  function countryData(events, shock, COUNTRY_NAMES) {
    const acc = {};
    Object.keys(COUNTRY_NAMES).forEach((c) => (acc[c] = { w: 0, comp: { choke: 0, geo: 0, policy: 0, subst: 0, shock: 0, market: 0 }, stages: [] }));
    STAGES.forEach((s) => {
      const comp = stageComponents(s, shock);
      Object.entries(s.shares).forEach(([c, sh]) => {
        if (!acc[c]) return;
        acc[c].w += sh; acc[c].stages.push([s.id, sh]);
        Object.keys(comp).forEach((k) => (acc[c].comp[k] += sh * clamp10(comp[k])));
      });
    });
    const out = {};
    Object.entries(acc).forEach(([c, a]) => {
      if (!a.w) return;
      const comp = {}; Object.keys(a.comp).forEach((k) => (comp[k] = a.comp[k] / a.w));
      let direct = 0;
      for (const e of events) if (e.countries?.includes(c))
        direct = Math.max(direct, e.sev * (CONF_W[e.conf] ?? 0.75) * Math.exp(-e.daysAgo / 12));
      comp.shock = Math.max(comp.shock, direct);
      out[c] = { comp, score: total(comp), weight: a.w, stages: a.stages.sort((x, y) => y[1] - x[1]) };
    });
    return out;
  }

  const shockAtT = (t) => mergeShocks(EVENTS.filter((e) => e.daysAgo - t >= 0).map((e) => eventShock({ ...e, daysAgo: e.daysAgo - t })));
  const chainIndexAt = (t) => { const sh = shockAtT(t); return STAGES.reduce((a, s) => a + total(stageComponents(s, sh)) * IMPORTANCE[s.id], 0) / TOT_IMP; };
  const HISTORY = Array.from({ length: 22 }, (_, i) => chainIndexAt(21 - i));
  const stageScoreAt = (sid, t) => total(stageComponents(STAGE_BY_ID[sid], shockAtT(t)));
  const MOVERS7D = STAGES.map((s) => { const now = stageScoreAt(s.id, 0), prev = stageScoreAt(s.id, 7); return { id: s.id, now, d: now - prev }; })
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));

  return {
    OUT, IN, STAGE_BY_ID, COMPANY_BY_ID, SUPPLIERS, COUNTRY_LINKS, TOPO, CHOKE, IMPORTANCE, IMP_RANK, EDGE_W,
    GEO, POLICY, STAGE_COMPANIES, clamp10, CONF_W, WEIGHTS, propagate, eventShock, mergeShocks, TOT_IMP, chainImpact,
    companyImpact, COMPANY_IMPACTS, COMPANY_RANK, CAP_RANK, supplierSpread, companyExposure, companySpread,
    customerSpread, stageComponents, total, countryData, shockAtT, chainIndexAt, HISTORY, stageScoreAt, MOVERS7D,
  };
}
