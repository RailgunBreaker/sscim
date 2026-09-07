// Deliberately excites both propagation directions and the market decay term.
// These are laboratory inputs, never factual events or calibration evidence.
export function recoveryExperiments(stageIds) {
  return stageIds.map((id, i) => [{
    id: `synthetic_recovery_${i}`, recordKind: 'synthetic', sev: 6,
    daysAgo: 0, stages: [id],
    assumption: { operational: true, direction: 'adverse', channel: 'both' },
    model: { exposure: { [id]: 0.6 }, profile: { kind: 'market_exponential' } },
  }]);
}

export function sensitivityDesign(vector, theta, names) {
  const base = vector(theta);
  const columns = theta.map((v, k) => {
    const h = Math.max(Math.abs(v), 1) * 1e-4;
    const hi = [...theta], lo = [...theta]; hi[k] += h; lo[k] -= h;
    const a = vector(hi), b = vector(lo);
    return base.map((_, i) => (a[i] - b[i]) / (2 * h));
  });
  const norms = columns.map(col => Math.hypot(...col));
  const basis = [];
  for (const col of columns) {
    const norm = Math.hypot(...col);
    if (norm < 1e-10) continue;
    const residual = col.map(v => v / norm);
    for (const q of basis) {
      const dot = q.reduce((s, v, i) => s + v * residual[i], 0);
      residual.forEach((_, i) => { residual[i] -= dot * q[i]; });
    }
    const length = Math.hypot(...residual);
    if (length > 1e-7) basis.push(residual.map(v => v / length));
  }
  return { rank: basis.length, parameters: names.length, observations: base.length,
    columnNorms: Object.fromEntries(names.map((name, i) => [name, norms[i]])),
    unexcitedParameters: names.filter((_, i) => norms[i] < 1e-10),
    identifiableLocally: basis.length === names.length };
}
