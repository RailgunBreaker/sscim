import { describe, it, expect } from 'vitest';
import { evaluateNews } from '../../../server/src/ai/evaluate-news.js';
import { groundProposal } from '../../../server/src/ai/proposal-evidence.js';
import { modelIdentity } from '../../../server/src/ai/model-identity.js';
import { newsTimeliness } from '../../../server/src/ai/news-timeliness.js';
const labels = [true, false, true].map((operational, i) => ({ id: `r${i}`, incidentId: `incident${i}`,
  relevant: true, operational, sourceUrl: 'https://example.test/source', labelProvenance: 'synthetic test' }));
describe('news evaluation and quotation boundary', () => {
  it('measures actual ingestion lag without substituting incident dates for publication timestamps', () => {
    const row = { source_feed: 'rss-news', created_at: '2026-09-07 04:00:00', status: 'pending' };
    const report = newsTimeliness([{ ...row, raw: { published: '2026-09-07T01:00:00Z' } },
      { ...row, date_iso: '2026-09-06', raw: {} }, { ...row, raw: { published: '2026-09-08T01:00:00Z' } }], '2026-09-07T06:00:00Z');
    expect(report.feeds['rss-news'].ingestionLag.medianHours).toBe(3);
    expect(report.feeds['rss-news'].pendingAge.medianHours).toBe(2);
    expect(report.feeds['rss-news'].missingPublication).toBe(1);
    expect(report.feeds['rss-news'].invalidTiming).toBe(1);
  });
  it('does not mistake the first helper model for the drafting model', () => {
    const identity = modelIdentity({ modelUsage: { helper: {}, drafter: {} } });
    expect(identity.modelIds).toEqual(['drafter', 'helper']);
    expect(identity.model).toBe('claude-code[drafter,helper]');
    expect(modelIdentity({}).model).toBe('claude-code[unknown]');
  });
  it('keeps missing predictions in recall and reports absent latency as unknown', () => {
    const r = evaluateNews(labels, [{ id: 'r0', relevant: true, operational: true, modelId: 'test' }], { modelId: 'test' });
    expect(r.operational.recall).toBe(.5);
    expect(r.operational.abstained).toBe(2);
    expect(r.latency.medianHours).toBeNull();
    expect(r.operationallyValidated).toBe(false);
  });
  it('rejects incident leakage and model/version mismatches', () => {
    expect(() => evaluateNews(labels, [], { trainingIncidentIds: ['incident0'] })).toThrow(/leakage/);
    expect(() => evaluateNews(labels, [{ id: 'r0', modelId: 'other' }], { modelId: 'test' })).toThrow(/mismatched/);
  });
  it('requires a quotation that is present in the fetched input', () => {
    const text = 'Production at the named factory has stopped following a fire.';
    const candidate = { raw: { excerpt: text } };
    expect(groundProposal(candidate, { proposedOperational: true, evidenceKind: 'observed', evidenceQuote: text }).proposedOperational).toBe(true);
    expect(groundProposal(candidate, { proposedOperational: true, evidenceKind: 'forecast', evidenceQuote: text }).proposedOperational).toBe(false);
    expect(groundProposal(candidate, { proposedOperational: true, evidenceQuote: text }).proposedOperational).toBe(false);
    expect(groundProposal(candidate, { proposedOperational: true, evidenceQuote: 'invented observed production damage' }).proposedOperational).toBe(false);
    expect(groundProposal(candidate, { proposedOperational: true }).evidenceStatus).toBe('missing_supporting_input');
  });
});
