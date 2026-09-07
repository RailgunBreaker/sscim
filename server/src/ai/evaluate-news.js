// No network or model calls here. Score saved predictions against a separately
// curated incident-held-out set. Missing predictions remain in the denominator.
export function evaluateNews(labels, predictions, { trainingIncidentIds = [], modelId } = {}) {
  const ids = new Set();
  for (const row of labels) {
    if (!row.id || ids.has(row.id) || !row.incidentId || !row.sourceUrl || !row.labelProvenance
      || typeof row.relevant !== 'boolean' || typeof row.operational !== 'boolean') throw new Error('Invalid or duplicate benchmark label');
    if (trainingIncidentIds.includes(row.incidentId)) throw new Error(`Incident leakage: ${row.incidentId}`);
    ids.add(row.id);
  }
  const byId = new Map();
  for (const row of predictions) {
    if (!ids.has(row.id) || byId.has(row.id)) throw new Error('Unknown or duplicate prediction');
    if (!modelId || row.modelId !== modelId) throw new Error('Missing or mismatched model identity');
    byId.set(row.id, row);
  }
  const metric = key => {
    let tp = 0, fp = 0, tn = 0, fn = 0, abstained = 0, missedPositive = 0;
    for (const row of labels) {
      const guess = byId.get(row.id)?.[key];
      if (typeof guess !== 'boolean') { abstained++; if (row[key]) missedPositive++; continue; }
      if (row[key] && guess) tp++;
      else if (!row[key] && guess) fp++;
      else if (row[key]) fn++;
      else tn++;
    }
    return { tp, fp, tn, fn, abstained,
      precision: tp + fp ? tp / (tp + fp) : null,
      recall: byId.size && tp + fn + missedPositive ? tp / (tp + fn + missedPositive) : null,
      accuracyOverAllLabels: byId.size && labels.length ? (tp + tn) / labels.length : null };
  };
  const delays = [];
  for (const row of labels) {
    const predicted = byId.get(row.id);
    if (!predicted?.detectedAt || !row.availableAt) continue;
    const delay = (Date.parse(predicted.detectedAt) - Date.parse(row.availableAt)) / 3600000;
    if (!Number.isFinite(delay) || delay < 0) throw new Error('Invalid detection timestamp');
    delays.push(delay);
  }
  delays.sort((a, b) => a - b);
  return { modelId: modelId || null, status: byId.size ? 'evaluated' : 'not_run',
    labels: labels.length, independentIncidents: new Set(labels.map(r => r.incidentId)).size,
    predictions: byId.size, relevance: metric('relevant'), operational: metric('operational'),
    latency: { observed: delays.length, medianHours: delays.length ? delays[Math.floor(delays.length / 2)] : null,
      p95Hours: delays.length ? delays[Math.min(delays.length - 1, Math.ceil(delays.length * .95) - 1)] : null },
    // Hand-curated development examples cannot authorize unattended triage.
    operationallyValidated: false };
}
