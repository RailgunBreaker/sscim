import { readFileSync, writeFileSync } from 'node:fs';
import { chainLossEvidence } from '../../app/src/engine/chainLossEvidence.js';
import { chainLossAccounts } from '../../app/src/engine/chainLossAccounts.js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/chain-loss-evidence.json', root)));
const a = chainLossEvidence(data, new Date().toISOString().slice(0, 10));
if (a.rejected.length) throw new Error(`Rejected loss records: ${a.rejected.join(', ')}`);
const b = chainLossEvidence({ ...data, transmissionEvidence: [] }, a.asOf);
const accounts = chainLossAccounts(data, a.asOf);
if (accounts.rejected.length) throw new Error('Rejected sector estimates');
const report = { asOf: a.asOf, reportedOutcomes: a.records.filter(r => r.kind === 'reported_outcome').length,
  issuerForecasts: a.records.filter(r => r.kind === 'issuer_forecast').length,
  companyAttributedLinks: a.transmission.length,
  ablation: { withLink: a.attributedEffects('renesas_naka_fire_2021').length, withoutLink: b.attributedEffects('renesas_naka_fire_2021').length },
  coveredSubsetExample: a.reportedSubtotal(['ford_2021q1_lost_units','stellantis_2021q3_lost_units']),
  sectorAccounts: { ...accounts, aggregate: undefined },
  chainWideLoss: null, causalAttributionValidated: false, reason: a.reason };
writeFileSync(new URL('docs/benchmarks/chain-loss-evaluation.json', root), JSON.stringify(report,null,2) + '\n');
console.log(JSON.stringify(report,null,2));
