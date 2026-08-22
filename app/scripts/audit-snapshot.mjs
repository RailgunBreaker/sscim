/* Read-only diagnostics over the frozen static snapshot (app/src/data/
   vault-snapshot.json) — the same demonstration data that ships on the
   GitHub Pages deploy. Never writes to the snapshot; only reports.

   Hard failures (non-zero exit, fails CI): duplicate IDs, a stage/company/
   country referenced by something that doesn't exist, non-finite numeric
   fields, shares outside [0,1], a negative event age, an unsupported
   confidence value, or a stage graph that fails validation (cycle,
   dangling edge, duplicate edge, non-finite/unbounded coefficient).

   Warnings (reported, do not fail the build): a stage's country shares
   summing to <100% (undisclosed residual), a stage's company shares
   summing to >100% (overlapping/overlapping-disclosure sample data),
   thin evidence-note coverage, and events excluded from the scored
   operational impact (hazard-signal-only / mixed / long-term-strategic /
   unclassified) — those are by design, not bugs, but worth surfacing. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { getEventAssumption } from '../src/engine/event-assumptions.js';
import { buildFacilityLayer } from '../src/engine/facilities.js';
import { buildFacilityNetwork } from '../src/engine/facilityNetwork.js';
import { facilityIntro } from '../src/engine/facilityProfile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, '../src/data/vault-snapshot.json');
const CONF_VALUES = new Set(['High', 'Medium', 'Low', 'Simulated']);
const SHARE_TOLERANCE = 1e-6;

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
const inUnit = (v) => isFiniteNum(v) && v >= -SHARE_TOLERANCE && v <= 1 + SHARE_TOLERANCE;

function checkDuplicates(list, idOf, label) {
  const seen = new Map();
  list.forEach((item) => {
    const id = idOf(item);
    seen.set(id, (seen.get(id) || 0) + 1);
  });
  for (const [id, count] of seen) {
    if (count > 1) err(`duplicate ${label} id "${id}" (${count} occurrences)`);
  }
}

function main() {
  const raw = readFileSync(SNAPSHOT_PATH, 'utf8');
  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (e) {
    err(`vault-snapshot.json is not valid JSON: ${e.message}`);
    return report();
  }

  const stageIds = new Set(bundle.stages.map((s) => s.id));
  const countryIds = new Set(bundle.countries.map((c) => c.id));
  const companyIds = new Set(bundle.companies.map((c) => c.id));

  checkDuplicates(bundle.stages, (s) => s.id, 'stage');
  checkDuplicates(bundle.countries, (c) => c.id, 'country');
  checkDuplicates(bundle.companies, (c) => c.id, 'company');
  checkDuplicates(bundle.events, (e) => e.id, 'event');
  checkDuplicates(bundle.policies, (p) => p.id, 'policy');
  checkDuplicates(bundle.scenarios, (s) => s.id, 'scenario');

  const edgeKeys = new Set();
  bundle.flowEdges.forEach(([a, b]) => {
    if (!stageIds.has(a)) err(`flow edge references unknown stage "${a}"`);
    if (!stageIds.has(b)) err(`flow edge references unknown stage "${b}"`);
    const key = `${a}>${b}`;
    if (edgeKeys.has(key)) err(`duplicate flow edge ${key}`);
    edgeKeys.add(key);
  });

  bundle.stages.forEach((s) => {
    if (!isFiniteNum(s.value) || s.value < 0) err(`stage "${s.id}": non-finite or negative value ${s.value}`);
    if (!isFiniteNum(s.subst)) err(`stage "${s.id}": non-finite subst ${s.subst}`);
    let sum = 0;
    Object.entries(s.shares || {}).forEach(([cid, sh]) => {
      if (!countryIds.has(cid)) err(`stage "${s.id}" shares reference unknown country "${cid}"`);
      if (!inUnit(sh)) err(`stage "${s.id}" share for "${cid}" out of [0,1]: ${sh}`);
      sum += sh;
    });
    if (sum < 0.999) warn(`stage "${s.id}": country shares sum to ${(sum * 100).toFixed(1)}% (<100%, undisclosed residual)`);
  });

  const stageCompanyTotals = {};
  bundle.companies.forEach((c) => {
    if (!countryIds.has(c.country)) err(`company "${c.id}" has unknown headquarters country "${c.country}"`);
    Object.entries(c.stakes || {}).forEach(([sid, sh]) => {
      if (!stageIds.has(sid)) err(`company "${c.id}" stakes reference unknown stage "${sid}"`);
      if (!inUnit(sh)) err(`company "${c.id}" stake in "${sid}" out of [0,1]: ${sh}`);
      stageCompanyTotals[sid] = (stageCompanyTotals[sid] || 0) + sh;
    });
  });
  Object.entries(stageCompanyTotals).forEach(([sid, total]) => {
    if (total > 1 + SHARE_TOLERANCE) warn(`stage "${sid}": company shares sum to ${(total * 100).toFixed(1)}% (>100% of modeled sample)`);
  });

  const incompleteCustomerCoverage = [];
  Object.entries(bundle.customers).forEach(([supId, list]) => {
    if (!companyIds.has(supId)) err(`customers map references unknown supplier "${supId}"`);
    let sum = 0;
    list.forEach(([custId, sh]) => {
      if (!companyIds.has(custId)) err(`customers["${supId}"] references unknown company "${custId}"`);
      if (!inUnit(sh)) err(`customers["${supId}"] share for "${custId}" out of [0,1]: ${sh}`);
      sum += sh;
    });
    if (sum < 0.999) incompleteCustomerCoverage.push(`${supId} (${(sum * 100).toFixed(0)}%)`);
  });
  if (incompleteCustomerCoverage.length) {
    warn(`${incompleteCustomerCoverage.length}/${Object.keys(bundle.customers).length} suppliers disclose <100% of customer revenue (by design — sample lists top customers only): ${incompleteCustomerCoverage.join(', ')}`);
  }

  /* ---- facilities: the site layer under the country markers -------------
     A facility that dangles is worse than a missing one — it renders on the
     map, opens a popup, and joins a hazard footprint while pointing at a
     stage the engine cannot propagate through. Hard-fail those. Thin or
     absent coverage is a warning: it is a curated sample by design, and the
     UI says so, but a stage with no modeled site anywhere can never appear
     in a hazard footprint and that is worth knowing. */
  const facilities = bundle.facilities || [];
  const FACILITY_KINDS = new Set(['fab', 'assembly', 'materials', 'equipment', 'rnd', 'datacenter']);
  const FACILITY_STATUSES = new Set(['operating', 'ramping', 'construction', 'idle']);
  checkDuplicates(facilities, (f) => f.id, 'facility');
  const stagesWithSites = new Set();
  facilities.forEach((f) => {
    if (!companyIds.has(f.company)) err(`facility "${f.id}" has unknown operator "${f.company}"`);
    if (!countryIds.has(f.country)) err(`facility "${f.id}" has unknown country "${f.country}"`);
    if (!FACILITY_KINDS.has(f.kind)) err(`facility "${f.id}" has unknown kind "${f.kind}"`);
    if (!FACILITY_STATUSES.has(f.status)) err(`facility "${f.id}" has unknown status "${f.status}"`);
    if (!isFiniteNum(f.lat) || f.lat < -90 || f.lat > 90) err(`facility "${f.id}": latitude out of range (${f.lat})`);
    if (!isFiniteNum(f.lng) || f.lng < -180 || f.lng > 180) err(`facility "${f.id}": longitude out of range (${f.lng})`);
    if (!isFiniteNum(f.scale) || f.scale < 1 || f.scale > 5) err(`facility "${f.id}": scale must be 1-5, got ${f.scale}`);
    if (!Array.isArray(f.stages) || !f.stages.length) err(`facility "${f.id}" feeds no stage`);
    (f.stages || []).forEach((sid) => {
      if (!stageIds.has(sid)) err(`facility "${f.id}" references unknown stage "${sid}"`);
      else stagesWithSites.add(sid);
    });
  });
  if (!facilities.length) {
    warn('no facilities in the snapshot — the map falls back to country markers only and the hazard tool has nothing to find');
  } else {
    const noSite = [...stageIds].filter((sid) => !stagesWithSites.has(sid));
    if (noSite.length) {
      warn(`${noSite.length}/${stageIds.size} stage(s) have no modeled site and can never appear in a hazard footprint (expected for demand-side and pure-IP stages): ${noSite.join(', ')}`);
    }
    const thin = [...stagesWithSites].filter((sid) => facilities.filter((f) => f.stages.includes(sid)).length < 3);
    if (thin.length) {
      warn(`${thin.length} stage(s) are represented by fewer than 3 modeled sites, so a single site dominates their hazard exposure: ${thin.join(', ')}`);
    }
    const companiesWithoutSite = bundle.companies.filter((c) => !facilities.some((f) => f.company === c.id));
    if (companiesWithoutSite.length) {
      warn(`${companiesWithoutSite.length}/${bundle.companies.length} modeled compan(ies) have no site and are invisible on the map: ${companiesWithoutSite.map((c) => c.id).join(', ')}`);
    }

    /* Every site must produce a usable standardized profile. A record that
       renders a blank or stub introduction is a data gap wearing a UI, and
       the facility panel would show it to a reader as fact. */
    const stageNameById = Object.fromEntries(bundle.stages.map((s) => [s.id, s]));
    const profileCtx = {
      COMPANY_BY_ID: Object.fromEntries(bundle.companies.map((c) => [c.id, c])),
      COUNTRY_NAMES: Object.fromEntries(bundle.countries.map((c) => [c.id, c.name])),
      STAGE_BY_ID: stageNameById,
      layer: buildFacilityLayer(facilities),
    };
    const stubProfiles = facilities.filter((f) => {
      try { return facilityIntro(f, profileCtx).length < 80; } catch { return true; }
    });
    if (stubProfiles.length) {
      err(`${stubProfiles.length} facilit(ies) produce an empty or stub standardized profile: ${stubProfiles.map((f) => f.id).join(', ')}`);
    }
    const noOutput = facilities.filter((f) => !f.output);
    if (noOutput.length) {
      warn(`${noOutput.length} facilit(ies) carry no output description, so their profile omits the "what it makes" sentence: ${noOutput.map((f) => f.id).join(', ')}`);
    }
  }

  bundle.policies.forEach((p) => {
    if (!isFiniteNum(p.sev)) err(`policy "${p.id}": non-finite sev ${p.sev}`);
    (p.stages || []).forEach((sid) => { if (!stageIds.has(sid)) err(`policy "${p.id}" references unknown stage "${sid}"`); });
  });

  const excludedEvents = [];
  bundle.events.forEach((e) => {
    if (!isFiniteNum(e.sev)) err(`event "${e.id}": non-finite sev ${e.sev}`);
    if (!isFiniteNum(e.daysAgo) || e.daysAgo < 0) err(`event "${e.id}": invalid/negative daysAgo ${e.daysAgo}`);
    if (!CONF_VALUES.has(e.conf)) err(`event "${e.id}": unsupported confidence value "${e.conf}" (expected High/Medium/Low/Simulated)`);
    (e.stages || []).forEach((sid) => { if (!stageIds.has(sid)) err(`event "${e.id}" references unknown stage "${sid}"`); });
    (e.countries || []).forEach((cid) => { if (!countryIds.has(cid)) err(`event "${e.id}" references unknown country "${cid}"`); });
    const assumption = getEventAssumption(e.id);
    if (!assumption.operational) excludedEvents.push(`${e.id} (${assumption.direction}/${assumption.channel}): ${assumption.reason}`);
  });
  bundle.scenarios.forEach((s) => {
    if (!s.event) return;
    (s.event.stages || []).forEach((sid) => { if (!stageIds.has(sid)) err(`scenario "${s.id}" event references unknown stage "${sid}"`); });
    (s.event.countries || []).forEach((cid) => { if (!countryIds.has(cid)) err(`scenario "${s.id}" event references unknown country "${cid}"`); });
  });

  Object.entries(bundle.owners || {}).forEach(([cid, holders]) => {
    if (!companyIds.has(cid)) err(`owners map references unknown company "${cid}"`);
    holders.forEach(([name, sh]) => { if (!inUnit(sh)) err(`owners["${cid}"] share for "${name}" out of [0,1]: ${sh}`); });
  });

  const notedScopes = new Set((bundle.dataNotes || []).map((n) => n.scope));
  const stagesWithoutNotes = bundle.stages.filter((s) => !notedScopes.has(`stage:${s.id}`)).length;
  const companiesWithoutNotes = bundle.companies.filter((c) => !notedScopes.has(`company:${c.id}`)).length;
  if (stagesWithoutNotes > 0) warn(`${stagesWithoutNotes}/${bundle.stages.length} stages have no evidence note (data-notes.js)`);
  if (companiesWithoutNotes > 0) warn(`${companiesWithoutNotes}/${bundle.companies.length} companies have no evidence note (data-notes.js)`);

  // Reuse the same graph validation + numeric self-checks the running app
  // performs, so a broken graph or non-finite propagated score fails here too.
  let engine;
  try {
    engine = buildEngine({
      STAGES: bundle.stages, FLOW_EDGES: bundle.flowEdges, COMPANIES: bundle.companies,
      CUSTOMERS: bundle.customers, POLICIES: bundle.policies, EVENTS: bundle.events, OWNERS: bundle.owners,
    });
  } catch (e) {
    err(`buildEngine threw while processing the snapshot: ${e.message}`);
  }
  if (engine) {
    if (!engine.graphValid) err('stage dependency graph failed validation (see diagnostics below)');
    engine.diagnostics.list.forEach((d) => (d.level === 'error' ? err(`[engine:${d.scope}] ${d.message}`) : warn(`[engine:${d.scope}] ${d.message}`)));
  }

  /* The site-to-site network is derived, so it cannot contain bad data of its
     own — but it CAN silently come out empty (a dependence lookup wired the
     wrong way round returns 0 for every pair and nothing is drawn), or come
     out truncated. Both are reported. */
  let network = null;
  if (engine && facilities.length) {
    const reachCache = {};
    network = buildFacilityNetwork({
      layer: buildFacilityLayer(facilities),
      CUSTOMERS: bundle.customers,
      dependence: (supplierStage, customerStage) => {
        const field = (reachCache[supplierStage] ||= engine.propagateTrace(supplierStage, 1, 'downstream').field);
        return field[customerStage] ?? 0;
      },
    });
    if (!network.links.length) {
      err('the site-to-site network is empty despite facilities and customer edges existing — check the dependence lookup orientation');
    }
    if (network.stats.dropped > 0) {
      warn(`site network: ${network.stats.dropped} link(s) built but not shown (display cap ${network.stats.shown}); the map reports this too`);
    }
    const unlinked = facilities.filter((f) => !network.linksByFacility[f.id]);
    if (unlinked.length) {
      /* Separate the two reasons, because only one of them is about the site.
         A site whose operator has no edge at all in the customers sample can
         never be linked no matter how the network is built; the rest fell
         outside a per-company-pair cap. */
      const noCompanyEdge = unlinked.filter((f) => {
        const asSupplier = Array.isArray(bundle.customers[f.company]) && bundle.customers[f.company].length;
        const asCustomer = Object.values(bundle.customers).some((list) => list.some(([cid]) => cid === f.company));
        return !asSupplier && !asCustomer;
      });
      warn(`${unlinked.length}/${facilities.length} site(s) have no modeled link: ${noCompanyEdge.length} whose operator has no edge at all in the customers sample, ${unlinked.length - noCompanyEdge.length} that fell outside the per-company-pair cap`);
    }
  }

  console.log(`\nSSCIM static-snapshot audit — ${SNAPSHOT_PATH}`);
  console.log(`stages=${bundle.stages.length} companies=${bundle.companies.length} events=${bundle.events.length} policies=${bundle.policies.length} scenarios=${bundle.scenarios.length} countries=${bundle.countries.length} facilities=${facilities.length}${network ? ` siteLinks=${network.stats.shown}` : ''}`);
  if (excludedEvents.length) {
    console.log(`\nEvents displayed but excluded from scored operational impact (${excludedEvents.length}):`);
    excludedEvents.forEach((line) => console.log(`  - ${line}`));
  }
  report();
}

function report() {
  if (warnings.length) {
    console.log(`\nWARNINGS (${warnings.length}) — reported, do not fail the build:`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }
  if (errors.length) {
    console.log(`\nHARD FAILURES (${errors.length}):`);
    errors.forEach((e) => console.log(`  x ${e}`));
    console.log(`\naudit:data FAILED — ${errors.length} hard failure(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(`\naudit:data PASSED — 0 hard failures, ${warnings.length} warning(s).`);
}

main();
