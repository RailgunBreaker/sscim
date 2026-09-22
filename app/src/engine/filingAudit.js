// These are descriptive document-classification metrics for a frozen census,
// never a forecast score or a population-wide incident-recall estimate.
export const FILING_AUDIT_RUBRIC = {
  version: 'filing-relevance-v1',
  relevant: 'The filing describes a specific semiconductor material contamination, photoresist or defective/unqualified-material incident AND an attributable recovery, reimbursement, lost sales, lost revenue, lost production or supply disruption. The two facts may appear in different sections. Historical incident disclosures count.',
  notRelevant: 'After reviewing the filing, no disclosure meets both conditions. Generic risk factors, unrelated insurance and unrelated losses do not qualify. This does not establish zero loss.',
  uncertain: 'Evidence or incident attribution is insufficient to decide. Leave the case unresolved.',
  method: 'Census of all checks in one frozen collection run; historical positive controls are excluded. Read the archived source rather than relying on the keyword excerpt.',
};
export function filingAuditScore(batch, labels) {
  const cases = batch.cases.filter(c => !c.control);
  const latest = new Map();
  for (const r of labels) latest.set(r.caseId, r);
  const counts = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
  const reviewOrigins = { ai_assisted: 0, operator_human: 0, external_human: 0 };
  const judgments = { relevant: 0, not_relevant: 0, uncertain: 0 };
  let labeled = 0, qualified = 0, uncertain = 0, unavailable = 0;
  for (const c of cases) {
    const r = latest.get(c.id);
    if (!c.sourceSha256 || c.status !== 'retrieved') unavailable++;
    if (!r) continue;
    labeled++;
    if (Object.hasOwn(reviewOrigins, r.reviewerKind)) reviewOrigins[r.reviewerKind]++;
    if (Object.hasOwn(judgments, r.label)) judgments[r.label]++;
    if (r.label === 'uncertain') { uncertain++; continue; }
    const qualifies = r.sourceSha256 === c.sourceSha256 && r.reviewerKind === 'external_human'
      && r.independenceDeclared === true && Boolean(r.reportReference) && r.sourceIntegrityVerified === true;
    if (!qualifies) continue;
    qualified++;
    if (c.matched) counts[r.label === 'relevant' ? 'truePositive' : 'falsePositive']++;
    else counts[r.label === 'relevant' ? 'falseNegative' : 'trueNegative']++;
  }
  const complete = cases.length > 0 && qualified === cases.length && unavailable === 0;
  const ratio = (n, d) => complete && d > 0 ? n / d : null;
  return { total: cases.length, controls: batch.cases.length - cases.length, labeled, qualified, uncertain, unavailable,
    reviewOrigins, judgments, externalReviewNeeded: cases.length - qualified,
    pending: cases.length - labeled, complete, confusion: complete ? counts : null,
    accuracy: ratio(counts.truePositive + counts.trueNegative, cases.length),
    precision: ratio(counts.truePositive, counts.truePositive + counts.falsePositive),
    recall: ratio(counts.truePositive, counts.truePositive + counts.falseNegative),
    independentlyValidatedAccuracy: null,
    qualification: 'Agreement with declared external human reviews of this frozen run only. Reviewer identity and independence are operator-declared, not authenticated by this single-operator workspace. No generalization to incident recall or predictive performance.' };
}
