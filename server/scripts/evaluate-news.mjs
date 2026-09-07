import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateNews } from '../src/ai/evaluate-news.js';
const root = new URL('../../', import.meta.url);
const args = process.argv.slice(2);
const arg = key => args.includes(key) ? args[args.indexOf(key) + 1] : null;
if (!arg('--predictions') || !arg('--model')) {
  throw new Error('Provide --predictions PATH --model MODEL_ID. No saved benchmark report has been changed.');
}
const benchmark = JSON.parse(readFileSync(new URL('docs/reference/news-benchmark.json', root), 'utf8'));
const predictions = JSON.parse(readFileSync(arg('--predictions'), 'utf8'));
const report = evaluateNews(benchmark.records, predictions, { modelId: arg('--model'), trainingIncidentIds: benchmark.trainingIncidentIds });
report.benchmarkLimitations = benchmark.limitations;
writeFileSync(arg('--output') || new URL('docs/benchmarks/news-evaluation-offline.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
