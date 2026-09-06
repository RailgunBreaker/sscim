import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { factualEligibility } from './evidence.js';
import { incidentSourceVector } from './eventSource.js';
import { BASE_PARAMS } from './registry.js';
import { buildVaultData } from '../data/buildVaultData.js';
import { buildEngine } from './index.js';

const verified = () => ({ recordKind: 'factual', id: 'test', dateISO: '2026-07-01', sev: 8, stages: ['x'], conf: 'Low',
  evidence: { occurrence: { status: 'verified' }, exposure: { status: 'assumed' }, baseline: { eligible: true },
    sources: [{ url: 'https://example.org/document', supportingSection: 'section 1', informationAvailableDate: '2026-07-05', claimStatus: 'verified', supports: ['occurrence'] }],
    review: { verifiedAt: '2026-09-06', provenance: 'synthetic test fixture' } } });
const vector = (event) => incidentSourceVector({ event, assumption: { operational: true, direction: 'adverse' }, ageDays: 20,
  params: BASE_PARAMS, curated: { exposure: { x: .5 }, profile: { kind: 'persistent_policy' } } });

describe('factual eligibility boundary', () => {
  it('quarantines missing evidence and does not treat a URL as verification', () => {
    expect(vector({ ...verified(), evidence: null }).z).toEqual({});
    const event = verified(); event.evidence.sources[0].claimStatus = 'unresolved';
    expect(factualEligibility(event, '2026-07-20').reason).toBe('source_exists_but_claim_unverified');
    expect(vector(event).scored).toBe(false);
  });
  it('gates information dates without retroactively requiring the review date', () => {
    expect(factualEligibility(verified(), '2026-07-04').eligible).toBe(false);
    expect(factualEligibility(verified(), '2026-07-05').eligible).toBe(true);
  });
  it('does not reduce assumed exposure because confidence is low', () => {
    expect(vector(verified()).z).toEqual({ x: .4 });
    expect(vector({ ...verified(), conf: 'High' }).z).toEqual(vector(verified()).z);
  });
  it('respects an explicit context-only decision even for a verified occurrence', () => {
    const event = verified(); event.evidence.baseline.eligible = false;
    expect(vector(event).scored).toBe(false);
  });
  it('marks all canonical records factual and excludes unresolved incidents from every baseline', () => {
    const bundle = JSON.parse(readFileSync(new URL('../data/vault-snapshot.json', import.meta.url)));
    const data = buildVaultData(bundle);
    expect(data.EVENTS.every(e => e.recordKind === 'factual')).toBe(true);
    const engine = buildEngine({ ...data, datasetAsOf: bundle.meta.snapshotDate });
    for (const id of ['e1', 'p260807_man0807', 'h2606_subs']) expect(engine.eventField(data.EVENTS.find(e => e.id === id)).scored).toBe(false);
    const unresolved = data.EVENTS.filter(e => !factualEligibility(e, bundle.meta.snapshotDate).eligible);
    expect(engine.operationalIndex(engine.operationalField(unresolved))).toBe(0);
  });
});
