import { describe, it, expect } from 'vitest';
import { buildMeasurementLedger, measurementRecord } from '../../../server/src/measurement-ledger.js';

describe('measurement provenance', () => {
  it('does not promote a URL to a verified measurement or invent a period', () => {
    const row = measurementRecord({ scope: 'x', value: .78, units: 'coefficient', source: 'https://example.org' });
    expect(row.claimVerification).toBe('unresolved');
    expect(row.referencePeriod).toBeNull();
    expect(row.marketDenominator).toBeNull();
    expect(row.originalValue).toBe(row.modeledValue);
  });
  it('exposes incompatible scopes without normalizing away the defect', () => {
    const rows = buildMeasurementLedger({ dataNotes: [], stages: [], facilities: [], companies: [
      { id: 'merchant', stakes: { logic_ai: .78 } }, { id: 'captive', stakes: { logic_ai: .3 } },
    ] });
    expect(rows.every(r => r.denominatorStatus === 'incompatible')).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.modeledValue, 0)).toBeCloseTo(1.08);
  });
});
