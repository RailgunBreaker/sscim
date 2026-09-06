import { readFileSync, writeFileSync } from 'node:fs';
import { publicReviewSummary } from './lib/public-review-summary.mjs';
const read = name => JSON.parse(readFileSync(new URL(`../../docs/benchmarks/${name}`, import.meta.url)));
const before = read('public-review-before-79289b1.json');
const curation = read('v7-curation-uncertainty-public-review.json');
const sensitivity = read('v7-sensitivity-public-review.json');
writeFileSync(new URL('../../docs/PUBLIC_RESEARCH_REVIEW.md', import.meta.url), publicReviewSummary(before, curation, sensitivity));
console.log('Generated docs/PUBLIC_RESEARCH_REVIEW.md from preserved and current experiments.');
