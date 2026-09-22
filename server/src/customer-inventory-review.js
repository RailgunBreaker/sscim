import { phisonAnnualDocument } from './customer-loss-review.js';
import { apacerAnnualDocument } from './apacer-counterparty-review.js';

// Expense disclosures, not inventory balances, deferred tax assets or incident losses.
export function customerInventoryObservations(documents) {
  const definitions = [
    [phisonAnnualDocument, 'phison', 'Phison', 'consolidated', 1711889, 135888, 'Inventory obsolescence expense', 'Note 6(7), printed page 241 (PDF page 253), consolidated inventory expense'],
    [phisonAnnualDocument, 'phison', 'Phison', 'parent', 1671654, 135858, 'Inventory obsolescence expense', 'Note 6(7), printed page 328 (PDF page 340), parent-only inventory expense'],
    [apacerAnnualDocument, 'apacer', 'Apacer', 'consolidated', 203606, 161105, 'Inventory write-down expense', 'Note 6(e), printed page 210 (PDF page 212), consolidated inventory write-downs'],
    [apacerAnnualDocument, 'apacer', 'Apacer', 'parent', 191000, 155000, 'Inventory write-down expense', 'Note 6(e), printed page 282 (PDF page 284), parent-only inventory write-downs'],
  ];
  return { customerInventoryEvidence: definitions.flatMap(([expected, companyId, companyName, scope, current, prior, sourceMetric, supportingSection]) => {
    const matches = documents.filter(d => d.id === expected.id);
    const doc = matches[0];
    if (matches.length !== 1 || doc.url !== expected.url || doc.sha256 !== expected.expectedSha256)
      throw new Error('Customer inventory review requires uniquely identified reviewed annual reports');
    return [[2022, current], [2021, prior]].map(([year, value]) => ({
      id: `${companyId}_${scope}_inventory_expense_${year}`, companyId, companyName,
      scopeId: `${companyId}_${scope}`, scopeLabel: `${companyName} ${scope === 'parent' ? 'parent company' : 'consolidated group'}`,
      kind: 'reported_outcome', metric: 'inventory_valuation_expense', sourceMetric,
      value, units: 'TWD thousand', roundingUnit: 1,
      periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`,
      accountingBasis: 'expense_in_cost_of_revenue', attributionStatus: 'incident_unspecified',
      incidentId: null, incidentLoss: null, affectedInventoryLots: null, cashLoss: null,
      claimStatus: 'verified', review: { verifiedAt: '2026-09-22',
        provenance: 'Codex visual review of primary annual-report inventory notes; not independent causal validation' },
      source: { url: doc.url, publicationDate: doc.publicationDate, publicationDateBasis: doc.publicationDateBasis,
        informationAvailableDate: '2026-09-22', sha256: doc.sha256, hashBasis: 'raw_bytes', supportingSection, claimStatus: 'verified' },
      limitation: 'Annual expense has no contamination-specific allocation. Parent and consolidated scopes overlap. Prior-year expense is historical context, not a no-incident counterfactual; group composition can change.',
    }));
  }) };
}
