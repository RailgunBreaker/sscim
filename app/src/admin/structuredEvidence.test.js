import { it, expect } from 'vitest';
import { buildStructuredEvidence } from '../../../server/src/structured-evidence.js';
it('preserves every scalar and distinguishes forecast evidence from observed measurements', () => {
  const row = { id: 'x', claimStatus: 'verified', kind: 'issuer_forecast', amount: 4, units: 'USD', nested: { 'a/b': [null, false, 'text'] }, source: { url: 'https://example.com/a' } };
  const c = buildStructuredEvidence([{ id: 'fixture', origin: 'fixture.json', data: [row] }]);
  expect(c.records[0].payload).toEqual(row);
  expect(c.records[0].epistemicStatus).toBe('issuer_forecast');
  const estimate = buildStructuredEvidence([{id:'estimate',origin:'fixture',data:[{...row,kind:'issuer_retrospective_estimate'}]}]);
  expect(estimate.records[0].epistemicStatus).toBe('issuer_estimate');
  expect(c.fields.find(f => f.pointer === '/nested/a~1b/1')).toMatchObject({ type: 'boolean', text: 'false' });
  expect(c.fields.find(f => f.pointer === '/nested/a~1b/0')).toMatchObject({ type: 'null', number: null });
  expect(c.recordSources).toHaveLength(1);
  const empty = buildStructuredEvidence([{ id: 'empty', origin: 'fixture', data: { rows: [], optional: null } }]);
  expect(empty.records.find(r => r.pointer === '/rows').payload).toEqual([]);
});
it('keeps legacy company links as assumptions and uses stable dataset-scoped record IDs', () => {
  const input = { id: 'vault.customers', origin: 'db', data: [{ supplier_id: 'a', customer_id: 'b', share: .2 }] };
  const a = buildStructuredEvidence([input]), b = buildStructuredEvidence([input]);
  expect(a).toEqual(b);
  expect(a.relationships[0]).toMatchObject({ fromId: 'a', toId: 'b', epistemicStatus: 'assumption' });
  expect(() => buildStructuredEvidence([input,input])).toThrow(/Duplicate/);
});
