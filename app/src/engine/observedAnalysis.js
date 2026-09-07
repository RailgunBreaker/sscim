import { reviewedClaim, validDate } from './evidenceContract.js';

// This analysis consumes observed records only. It never reads scale ordinals,
// stage shares, an LLM confidence label or the seven research-model parameters.
export function buildObservedAnalysis({ observations = [], relationships = [], manufacturingRoutes = [], asOf } = {}) {
  const rejected = [];
  const observationsById = new Map();
  for (const row of observations) {
    const bounds = row.value;
    const numeric = row.units === 'fraction' && Number.isFinite(bounds?.low) && Number.isFinite(bounds?.high)
      && bounds.low >= 0 && bounds.high <= 1 && bounds.low <= bounds.high;
    const qualitative = bounds == null && row.units === 'qualitative' && typeof row.observationText === 'string' && row.observationText.trim().length > 0;
    const dated = validDate(row.observedAt) && row.observedAt <= asOf;
    const imprecise = row.observedAt == null && qualitative && Boolean(row.observationDateText);
    if (!row.id || observationsById.has(row.id) || !reviewedClaim(row, asOf)
      || (!dated && !imprecise) || row.kind !== 'observed'
      || !row.scope || !row.metric || !row.units || !row.denominator
      || (!numeric && !qualitative)) {
      rejected.push({ id: row.id, reason: 'invalid_or_unavailable_observation' });
      continue;
    }
    observationsById.set(row.id, row);
  }
  const observed = [...observationsById.values()];
  const links = [];
  const ids = new Set();
  for (const row of relationships) {
    if (!row.id || ids.has(row.id) || !reviewedClaim(row, asOf)
      || !row.supplier || !row.customer || row.supplier === row.customer
      || !row.productScope || !validDate(row.periodEnd) || row.periodEnd > asOf
      || !['company', 'facility'].includes(row.level)) {
      rejected.push({ id: row.id, reason: 'invalid_or_unavailable_relationship' });
      continue;
    }
    ids.add(row.id);
    links.push(row);
  }

  const routeIds = new Set();
  const routes = manufacturingRoutes.filter(r => {
    const valid = r.id && !routeIds.has(r.id) && reviewedClaim(r, asOf)
      && r.kind === 'reported_manufacturing_route' && validDate(r.reportedAt) && r.reportedAt <= asOf
      && r.from?.id && r.to?.id && r.from.id !== r.to.id && r.from.name && r.to.name
      && r.from.companyId && r.to.companyId && r.productScope && r.evidenceBasis;
    if (!valid) rejected.push({ id: r.id, reason: 'invalid_or_unavailable_manufacturing_route' });
    else routeIds.add(r.id);
    return valid;
  });
  function traceManufacturing(facilityId) {
    const found = new Map([[facilityId, []]]), queue = [facilityId];
    for (let i = 0; i < queue.length; i++) for (const route of routes.filter(r => r.from.id === queue[i])) {
      if (found.has(route.to.id)) continue;
      found.set(route.to.id, [...found.get(queue[i]), route.id]); queue.push(route.to.id);
    }
    found.delete(facilityId);
    return [...found].map(([id, path]) => ({ id, path, productionImpact: null,
      reason: 'Reported process route; shipment allocation, inventory and alternatives are unknown.' }));
  }

  function trace(companyId, direction = 'downstream') {
    if (!['downstream', 'upstream'].includes(direction)) throw new Error('Invalid direction');
    const from = direction === 'downstream' ? 'supplier' : 'customer';
    const to = direction === 'downstream' ? 'customer' : 'supplier';
    const found = new Map([[companyId, []]]);
    const queue = [companyId];
    for (let i = 0; i < queue.length; i++) {
      for (const edge of links.filter(r => r.level === 'company' && r[from] === queue[i])) {
        if (found.has(edge[to])) continue;
        found.set(edge[to], [...found.get(queue[i]), edge.id]);
        queue.push(edge[to]);
      }
    }
    found.delete(companyId);
    return [...found].map(([id, path]) => ({ id, path, inference: path.length > 1,
      // Consecutive commercial relationships need not carry the same product.
      productionImpact: null, reason: 'Product continuity, inventory and substitution are not established.' }));
  }

  function companyAssessment(id) {
    const downstream = trace(id);
    const upstream = trace(id, 'upstream');
    return { id, upstream, downstream, documentedCustomerReach: downstream.length,
      coverageComplete: false, productionImpact: null,
      reason: 'Documented reach is a graph count, not a capacity-loss estimate. Missing links are unknown.' };
  }

  function inputExposure(customerId, { supplierDisruptions = {}, productScope, periodEnd } = {}) {
    const rows = links.filter(r => r.level === 'company' && r.customer === customerId
      && r.productScope === productScope && r.periodEnd === periodEnd);
    if (!rows.length) return { status: 'unavailable', value: null, reason: 'No matching documented dependency scope.' };
    const suppliers = new Set();
    let total = 0, exposed = 0;
    for (const row of rows) {
      if (suppliers.has(row.supplier)) return { status: 'unavailable', value: null, reason: 'Duplicate supplier scope.' };
      suppliers.add(row.supplier);
      if (row.inputShare == null) continue;
      if (!Number.isFinite(row.inputShare) || row.inputShare < 0 || row.inputShare > 1) {
        return { status: 'unavailable', value: null, reason: 'Invalid dependency share.' };
      }
      total += row.inputShare;
      const shock = supplierDisruptions[row.supplier];
      if (!Number.isFinite(shock) || shock < 0 || shock > 1) {
        return { status: 'unavailable', value: null, reason: 'Explicit supplier disruption assumptions required.' };
      }
      exposed += row.inputShare * shock;
    }
    if (total > 1 + 1e-9) return { status: 'unavailable', value: null, reason: 'Incompatible or overlapping dependency shares.' };
    return { status: 'conditional_scenario', productScope, periodEnd,
      value: { low: exposed, high: Math.min(1, exposed + Math.max(0, 1 - total)) },
      documentedShare: total, evidenceIds: rows.map(r => r.id), productionImpact: null,
      reason: 'Input exposure conditional on supplier shocks; does not estimate lost output or revenue.' };
  }

  function latestObservation(scope, metric) {
    const rows = observed.filter(r => r.scope === scope && r.metric === metric)
      .sort((a, b) => (b.observedAt || b.source.publicationDate).localeCompare(a.observedAt || a.source.publicationDate)
        || b.source.publicationDate.localeCompare(a.source.publicationDate));
    if (!rows.length) return { status: 'unavailable', value: null };
    const row = rows[0];
    return { status: row.observedAt === asOf ? 'observed' : 'historical_observation',
      ...row, currentValue: row.observedAt === asOf ? row.value : null };
  }

  return { asOf, observations: observed, relationships: links, manufacturingRoutes: routes, traceManufacturing, rejected,
    companyAssessment, inputExposure, latestObservation,
    // A company disclosure cannot be expanded into a Cartesian product of plants.
    facilityLinks: links.filter(r => r.level === 'facility'),
    productionRisk: { status: 'unavailable', value: null,
      reason: 'No independently validated mapping from observed scope to production loss across this supply chain.' } };
}

export function measuredCapacityShares(rows, { scope, units, period, asOf, expectedFacilityIds } = {}) {
  if (!scope || !units || !period || !Array.isArray(expectedFacilityIds) || !expectedFacilityIds.length
    || new Set(expectedFacilityIds).size !== expectedFacilityIds.length) {
    return { status: 'unavailable', shares: null, reason: 'A defined denominator and complete facility population are required.' };
  }
  const selected = rows.filter(r => r.scope === scope && r.units === units && r.period === period);
  if (new Set(selected.map(r => r.basis)).size > 1) {
    return { status: 'unavailable', shares: null, reason: 'Measured output and maximum capacity cannot share a denominator.' };
  }
  const values = new Map();
  for (const row of selected) {
    if (values.has(row.facilityId) || !expectedFacilityIds.includes(row.facilityId)
      || !['measured', 'issuer_reported_maximum'].includes(row.basis)
      || !validDate(period) || period > asOf || !reviewedClaim(row, asOf) || !Number.isFinite(row.capacity) || row.capacity < 0) {
      return { status: 'unavailable', shares: null, reason: 'Invalid, duplicated or incompatible measured capacity.' };
    }
    values.set(row.facilityId, row.capacity);
  }
  const missing = expectedFacilityIds.filter(id => !values.has(id));
  if (missing.length) return { status: 'unavailable', shares: null, missing, reason: 'Incomplete measured capacity denominator.' };
  const total = [...values.values()].reduce((a, b) => a + b, 0);
  return total > 0 ? { status: selected.every(r => r.basis === 'measured') ? 'measured' : 'issuer_reported_maximum', total, scope, units, period,
    shares: Object.fromEntries([...values].map(([id, value]) => [id, value / total])) }
    : { status: 'unavailable', shares: null, reason: 'Zero measured denominator.' };
}
