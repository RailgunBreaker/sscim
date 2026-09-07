// Runs the installed production drafting backend against saved inputs without
// writing candidates, events, assumptions, or a publication queue.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { analyzeBatchWithClaudeCode, claudeCodeAvailable } from '../src/ai/analyze-claude-code.mjs';
import { evaluateNews } from '../src/ai/evaluate-news.js';
const root = new URL('../../', import.meta.url);
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const benchmarkPath = option('--benchmark', 'docs/reference/news-benchmark.json');
const outputPrefix = option('--output-prefix', 'docs/benchmarks/news');
const bytes = readFileSync(new URL(benchmarkPath, root));
const benchmark = JSON.parse(bytes);
if (!claudeCodeAvailable()) throw new Error('The installed news drafting backend is unavailable. No evaluation was performed.');
// Validate frozen labels and incident separation before incurring model calls.
evaluateNews(benchmark.records, [], { trainingIncidentIds: benchmark.trainingIncidentIds });
const inputs = benchmark.records.map((r, i) => ({ id: `evaluation_${i}`, sourceFeed: 'benchmark', dateISO: r.asOf || null,
  raw: { title: r.title || 'Source report for review', excerpt: r.text, url: r.sourceUrl } }));
const startedAt = new Date().toISOString();
const hashFile = path => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
const sourceHashes = { backendSha256: hashFile('server/src/ai/analyze-claude-code.mjs'),
  groundingSha256: hashFile('server/src/ai/proposal-evidence.js'), identitySha256: hashFile('server/src/ai/model-identity.js') };
const result = await analyzeBatchWithClaudeCode(inputs, { chunkSize: 6, timeoutMs: 180000,
  onProgress: event => console.log(JSON.stringify({ chunk: event.chunk, of: event.of, ok: event.ok })) });
const predictions = inputs.flatMap((input, i) => {
  const r = result.get(input.id);
  if (!r?.proposal) return [];
  return [{ id: benchmark.records[i].id, modelId: r.model, relevant: r.proposal.relevant,
    operational: r.proposal.proposedOperational, evidenceStatus: r.proposal.evidenceStatus,
    evidenceKind: r.proposal.evidenceKind, evidenceQuote: r.proposal.evidenceQuote,
    classificationReason: r.proposal.classificationReason, modelIds: r.modelIds, modelIdentityBasis: r.modelIdentityBasis }];
});
const models = [...new Set(predictions.map(r => r.modelId))];
if (models.length > 1) throw new Error('Backend changed model during evaluation; do not pool model versions.');
const report = evaluateNews(benchmark.records, predictions, { modelId: models[0], trainingIncidentIds: benchmark.trainingIncidentIds });
Object.assign(report, { startedAt, finishedAt: new Date().toISOString(), benchmarkSha256: createHash('sha256').update(bytes).digest('hex'),
  ...sourceHashes,
  benchmarkLimitations: benchmark.limitations, failures: inputs.filter(i => !result.get(i.id)?.proposal).map(i => ({ id: i.id, reason: result.get(i.id)?.notes || 'No proposal' })) });
writeFileSync(new URL(`${outputPrefix}-predictions.json`, root), JSON.stringify(predictions, null, 2) + '\n');
writeFileSync(new URL(`${outputPrefix}-evaluation.json`, root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!predictions.length) process.exitCode = 1;
