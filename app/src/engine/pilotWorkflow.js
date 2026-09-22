import { validDate } from './evidenceContract.js';
export const PILOT_TYPES = ['watch', 'investigation', 'action', 'delivery'];
const fail = message => { throw new Error(message); };
function text(value, label, max = 2000, optional = false) {
  if (optional && (value == null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
function date(value, label, latest) {
  if (!validDate(value) || (latest && value > latest)) fail(`${label} must be a valid date${latest ? ' no later than today' : ''}.`);
  return value;
}
function positive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e12) fail(`${label} must be a positive finite number, at most 1 trillion.`);
  return value;
}
// Operator records are never promoted to independently verified public claims.
export function validatePilotRecord(type, input, today) {
  if (!PILOT_TYPES.includes(type) || !input || typeof input !== 'object' || Array.isArray(input) || !validDate(today)) fail('Invalid pilot record.');
  const companyId = text(input.companyId, 'Company', 100);
  if (type === 'watch') return { companyId, objective: text(input.objective, 'Monitoring objective'),
    productScope: text(input.productScope, 'Product or business scope', 300) };
  if (type === 'investigation') {
    const sourceUrl = text(input.sourceUrl, 'Evidence URL', 2048);
    let url; try { url = new URL(sourceUrl); } catch { fail('Evidence URL must use HTTPS.'); }
    if (url.protocol !== 'https:' || url.username || url.password) fail('Evidence URL must use HTTPS without embedded credentials.');
    const status = input.status || 'open';
    if (!['open', 'awaiting_confirmation', 'monitoring', 'closed'].includes(status)) fail('Invalid investigation status.');
    return { companyId, question: text(input.question, 'Investigation question'),
      productScope: text(input.productScope, 'Product or business scope', 300), sourceUrl,
      sourceDate: date(input.sourceDate, 'Source publication date', today),
      status, resolution: text(input.resolution, 'Resolution', 2000, status !== 'closed'),
      evidenceStatus: 'operator_linked_source_not_adjudicated' };
  }
  const investigationId = text(input.investigationId, 'Investigation', 100);
  if (type === 'action') return { companyId, investigationId,
    occurredOn: date(input.occurredOn, 'Action date', today), description: text(input.description, 'Action'),
    reference: text(input.reference, 'Action reference', 500) };
  if (!Array.isArray(input.receipts) || input.receipts.length > 200) fail('Receipts must be an array of at most 200 entries.');
  const refs = new Set();
  const receipts = input.receipts.map(r => {
    if (!r || typeof r !== 'object') fail('Invalid receipt.');
    const reference = text(r.reference, 'Receipt reference', 500);
    if (refs.has(reference)) fail('Duplicate receipt reference.');
    refs.add(reference);
    return { receivedOn: date(r.receivedOn, 'Receipt date', today), quantity: positive(r.quantity, 'Received quantity'), reference };
  });
  return { companyId, investigationId, orderReference: text(input.orderReference, 'Order reference', 500),
    productScope: text(input.productScope, 'Part or product', 300), units: text(input.units, 'Quantity units', 60),
    promisedOn: date(input.promisedOn, 'Promised delivery date'), orderedQuantity: positive(input.orderedQuantity, 'Ordered quantity'),
    receipts, attribution: 'cause_not_established' };
}

export function deliveryOutcome(delivery, asOf) {
  const d = validatePilotRecord('delivery', delivery, asOf);
  const receipts = [...d.receipts].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  let received = 0, completedOn = null;
  for (const r of receipts) { received += r.quantity; if (!completedOn && received >= d.orderedQuantity) completedOn = r.receivedOn; }
  const lateDays = completedOn ? Math.max(0, Math.round((Date.parse(completedOn) - Date.parse(d.promisedOn)) / 86400000)) : null;
  return { receivedQuantity: received, outstandingQuantity: Math.max(0, d.orderedQuantity - received), completedOn, lateDays,
    status: completedOn ? (lateDays ? 'completed_late' : 'completed_on_time') : d.promisedOn < asOf ? 'overdue_pending' : 'pending',
    attributedDisruptionLoss: null };
}

export function pilotSummary(records, asOf) {
  const outcomes = records.filter(r => r.type === 'delivery').map(r => ({ id: r.id, ...deliveryOutcome(r.payload, asOf) }));
  const completed = outcomes.filter(r => r.completedOn);
  return { trackedCompanies: records.filter(r => r.type === 'watch').length,
    openInvestigations: records.filter(r => r.type === 'investigation' && r.payload.status !== 'closed').length,
    actions: records.filter(r => r.type === 'action').length, deliveries: outcomes.length, completedDeliveries: completed.length,
    lateCompleted: completed.filter(r => r.status === 'completed_late').length,
    pending: outcomes.filter(r => !r.completedOn).length, overduePending: outcomes.filter(r => r.status === 'overdue_pending').length,
    onTimeRateAmongCompleted: completed.length ? completed.filter(r => r.status === 'completed_on_time').length / completed.length : null,
    outcomes, modelAccuracy: null,
    limitation: 'Operator-entered sample; completed-delivery rates exclude pending orders. Investigation links do not establish the cause of a delay or validate a predictive model.' };
}
