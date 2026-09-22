import { describe, it, expect, afterEach } from 'vitest';
import { deliveryOutcome, pilotSummary, validatePilotRecord } from './pilotWorkflow.js';
import { createPilotStore } from '../../../server/src/pilot-store.js';
const today = '2026-09-19';
const base = { companyId: 'gf', investigationId: 'case', orderReference: 'PO-1', productScope: 'SOI wafer', units: 'wafers',
  promisedOn: '2026-09-10', orderedQuantity: 100, receipts: [] };
const investigation = { companyId: 'gf', question: 'Confirm shipment timing', productScope: 'SOI wafers', sourceUrl: 'https://example.com/disclosure', sourceDate: '2026-09-01' };
const opened = [];
afterEach(() => opened.splice(0).forEach(s => s.close()));
function store() { const s = createPilotStore(':memory:', id => ['gf', 'tsmc'].includes(id), () => today + 'T12:00:00Z'); opened.push(s); return s; }
describe('pilot outcome boundaries', () => {
  it('keeps partial overdue deliveries pending and uses the date full quantity arrived', () => {
    const partial = { ...base, receipts: [{ quantity: 30, receivedOn: '2026-09-09', reference: 'receipt-1' }] };
    expect(deliveryOutcome(partial, today)).toMatchObject({ status: 'overdue_pending', outstandingQuantity: 70, completedOn: null, lateDays: null });
    const full = { ...partial, receipts: [...partial.receipts, { quantity: 70, receivedOn: '2026-09-12', reference: 'receipt-2' }] };
    expect(deliveryOutcome(full, today)).toMatchObject({ status: 'completed_late', lateDays: 2, attributedDisruptionLoss: null });
    const future = { ...base, promisedOn: '2026-09-25' };
    const summary = pilotSummary([{ id: '1', type: 'delivery', payload: partial }, { id: '2', type: 'delivery', payload: future }], today);
    expect(summary).toMatchObject({ completedDeliveries: 0, pending: 2, overduePending: 1, onTimeRateAmongCompleted: null, modelAccuracy: null });
  });
  it('rejects invalid quantities, duplicate receipts, future outcomes and unsafe source URLs', () => {
    for (const value of [0, -1, null, '100', Infinity, NaN]) expect(() => validatePilotRecord('delivery', { ...base, orderedQuantity: value }, today)).toThrow();
    const receipt = { quantity: 10, receivedOn: today, reference: 'r1' };
    expect(() => validatePilotRecord('delivery', { ...base, receipts: [receipt, receipt] }, today)).toThrow('Duplicate');
    expect(() => validatePilotRecord('delivery', { ...base, receipts: [{ ...receipt, receivedOn: '2026-09-20' }] }, today)).toThrow();
    for (const sourceUrl of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) expect(() => validatePilotRecord('investigation', { ...investigation, sourceUrl }, today)).toThrow();
    expect(() => validatePilotRecord('investigation', { ...investigation, status: 'closed' }, today)).toThrow('Resolution');
  });
  it('does not equate closing an investigation with a verified incident outcome', () => {
    const r = validatePilotRecord('investigation', { ...investigation, status: 'closed', resolution: 'No further information available', verified: true }, today);
    expect(r.evidenceStatus).toBe('operator_linked_source_not_adjudicated');
    expect(r).not.toHaveProperty('verified');
  });
});
describe('private pilot persistence', () => {
  it('replays a retried creation without creating a duplicate or audit entry', () => {
    const s = store(), options = { id: 'request-1', replayCreate: true };
    const first = s.save('investigation', investigation, options);
    expect(s.save('investigation', investigation, options).id).toBe(first.id);
    expect(s.snapshot().history).toHaveLength(1);
    expect(() => s.save('investigation', { ...investigation, question: 'A different question' }, options)).toThrow('already used');
  });
  it('preserves revisions and rejects stale edits without adding an audit record', () => {
    const s = store(), r = s.save('investigation', investigation);
    const edited = s.save('investigation', { ...r.payload, status: 'monitoring' }, { id: r.id, version: 1, reason: 'Follow-up underway' });
    expect(edited.version).toBe(2);
    expect(() => s.save('investigation', r.payload, { id: r.id, version: 1, reason: 'Stale edit' })).toThrow('Reload');
    const snapshot = s.snapshot();
    expect(snapshot.history).toHaveLength(2);
    expect(snapshot.history[0].payload.status).toBe('open');
    expect(snapshot.records[0].payload.status).toBe('monitoring');
  });
  it('enforces company and investigation boundaries and prevents duplicate order counting', () => {
    const s = store(), parent = s.save('investigation', investigation);
    expect(() => s.save('watch', { companyId: 'unknown', objective: 'Review', productScope: 'Parts' })).toThrow('Unknown company');
    const order = { ...base, investigationId: parent.id };
    s.save('delivery', order);
    expect(() => s.save('delivery', order)).toThrow('already exists');
    expect(() => s.save('delivery', { ...order, companyId: 'tsmc' })).toThrow('this company');
    expect(() => s.save('action', { companyId: 'gf', investigationId: 'missing', occurredOn: today, description: 'Reviewed source', reference: 'review-1' })).toThrow('investigation');
    expect(s.snapshot().records).toHaveLength(2);
  });
});
