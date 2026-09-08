import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calibrateRecoveryDurations, fitRecoveryDuration, recoveryBootstrap, validateRecoveryDurations } from './recoveryCalibration.js';
import { PARAMETERS } from './registry.js';
const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const original = load('../../../docs/reference/recovery-durations.json');
const protocol = load('../../../docs/reference/recovery-calibration-protocol.json');
const clone = () => structuredClone(original);

describe('empirical recovery duration calibration', () => {
  it('gives equal likelihood weight to incidents regardless of site count', () => {
    const rows = [{ incidentId:'a', durationDays:4 }, { incidentId:'b', durationDays:16 }];
    expect(fitRecoveryDuration(rows).medianDays).toBeCloseTo(8);
    expect(fitRecoveryDuration([...rows, { incidentId:'a', durationDays:4 }]).medianDays).toBeCloseTo(8);
    expect(fitRecoveryDuration(rows).logSigma).toBeCloseTo(Math.log(2));
    expect(() => fitRecoveryDuration([{ incidentId:'a',durationDays:0 }])).toThrow();
  });
  it('enumerates cluster uncertainty and does not mislabel it a prediction interval', () => {
    const ci = recoveryBootstrap([{ incidentId:'a',durationDays:4 }, { incidentId:'b',durationDays:16 }]);
    expect(ci.resamples).toBe(4);
    expect(ci.lowerDays).toBeCloseTo(4.3);
    expect(ci.upperDays).toBeCloseTo(15.4);
    expect(ci.target).toContain('not an individual');
    expect(recoveryBootstrap([{incidentId:'a',durationDays:4}]).status).toBe('unavailable');
  });
  it('measures six sourced durations across five independent incident clusters', () => {
    const { accepted, rejected } = validateRecoveryDurations(clone(), protocol.asOf);
    expect(rejected).toEqual([]);
    expect(accepted.map(r => r.durationDays)).toEqual([30,6,9,6,5,19]);
    expect(new Set(accepted.map(r => r.incidentId)).size).toBe(5);
  });
  it.each([
    ['tools', r => { r.metric = 'tools_restored'; }],
    ['forecast', r => { r.kind = 'issuer_forecast'; }],
    ['missing review', r => { r.claimStatus = 'unreviewed'; }],
    ['future review', r => { r.review.verifiedAt = '2027-01-01'; }],
    ['impossible date', r => { r.restart.date = '2016-02-30'; }],
    ['reversed recovery', r => { r.completion.date = r.restart.date; }],
    ['future disclosure', r => { r.completion.source.informationAvailableDate = '2027-01-01'; }],
    ['anticipated outcome', r => { r.completion.date = '2016-06-01'; }],
  ])('rejects %s before fitting', (_, mutate) => {
    const data = clone(); mutate(data.records[0]);
    expect(calibrateRecoveryDurations(data, protocol).status).toBe('invalid_data');
  });
  it('rejects duplicated facility outcomes and conflicting incident chronologies', () => {
    const data = clone(); data.records.push({ ...data.records[0], id:'duplicate' });
    expect(calibrateRecoveryDurations(data,protocol).status).toBe('invalid_data');
    const other = clone(); other.records[3].incidentDate = '2022-03-15';
    expect(calibrateRecoveryDurations(other,protocol).status).toBe('invalid_data');
  });
  it('keeps the 2026 outcome out of the earlier fitted coefficient and uncertainty', () => {
    const before = calibrateRecoveryDurations(clone(),protocol);
    const data = clone(); data.records.at(-1).completion.date = '2026-08-22';
    const after = calibrateRecoveryDurations(data,protocol);
    expect(after.chronologicalTest.fit).toEqual(before.chronologicalTest.fit);
    expect(after.chronologicalTest.parameterUncertainty).toEqual(before.chronologicalTest.parameterUncertainty);
    expect(after.chronologicalTest.metrics.candidate).not.toEqual(before.chronologicalTest.metrics.candidate);
    expect(before.chronologicalTest.trainingIncidentIds).not.toContain('kumamoto_earthquake_2026');
  });
  it('never lets a later-publication training label into a rolling prediction', () => {
    const data = clone();
    data.records[0].completion.source.publicationDate = '2026-08-30';
    data.records[0].completion.source.informationAvailableDate = '2026-08-30';
    const result = calibrateRecoveryDurations(data, protocol);
    expect(result.chronologicalTest.trainingIncidentIds).not.toContain('kumamoto_earthquake_2016');
    expect(result.rollingTests.every(r => !r.trainingIncidentIds.includes('kumamoto_earthquake_2016'))).toBe(true);
  });
  it('requires the restart report before the outcome for a retrospective origin', () => {
    const data = clone();
    data.records.at(-1).restart.source.publicationDate = '2026-08-24';
    data.records.at(-1).restart.source.informationAvailableDate = '2026-08-24';
    expect(() => calibrateRecoveryDurations(data,protocol)).toThrow(/Outcome known/);
  });
  it('reports the issuer target winning rather than promoting the better-than-default candidate', () => {
    const result = calibrateRecoveryDurations(clone(),protocol);
    expect(result.chronologicalTest.fit.medianDays).toBeCloseTo(9.017992);
    expect(result.chronologicalTest.metrics.registry.maeDays).toBe(41);
    expect(result.chronologicalTest.issuerComparison.issuerTargetMaeDays).toBe(2);
    expect(result.chronologicalTest.metrics.candidate.maeDays).toBeGreaterThan(2);
    expect(result.calibratedGlobalParameters).toEqual([]);
    expect(result.replacementAssessment.globalReplacementJustified).toBe(false);
    expect(result.replacementAssessment.beatsRegistryOnEveryRollingIncident).toBe(true);
    expect(result.replacementAssessment.beatsEmpiricalMedianOverall).toBe(false);
    expect(PARAMETERS.outageRecoveryDays.base).toBe(60);
    expect(result.rollingTests).toHaveLength(3);
    expect(result.rollingMetrics.candidate.maeDays).toBeCloseTo((5.916407864998739 + 5.977154959951623 + 9.982007966022255)/3);
    expect(result.rollingMetrics.candidate.maeDays).toBeGreaterThan(result.rollingMetrics.empiricalMedian.maeDays);
  });
  it('does not score an issuer schedule learned after the reconstructed prediction', () => {
    const data = clone(); data.records.at(-1).issuerTarget.source.publicationDate = '2026-08-25';
    const result = calibrateRecoveryDurations(data,protocol);
    expect(result.chronologicalTest.issuerComparison.records).toBe(0);
    expect(result.chronologicalTest.issuerComparison.issuerTargetMaeDays).toBeNull();
  });
});
