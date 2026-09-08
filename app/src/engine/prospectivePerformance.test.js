import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lagTwoRevenue, prepareProspectiveNowcast, scoreProspectiveNowcasts } from './prospectivePerformance.js';
import { parseRevenueDisclosure } from '../../../server/src/revenue-disclosure.js';
const read = file => JSON.parse(readFileSync(new URL(`../../../docs/reference/${file}`, import.meta.url)));
const captured = JSON.parse(readFileSync(new URL('../../../docs/prospective/tsmc-revenue-lag2-prospective-v1-2026-09.json', import.meta.url))).record;
const data = JSON.parse(readFileSync(new URL(`../../../docs/prospective/${captured.inputSnapshotPath}`, import.meta.url))), protocol = read('prospective-protocol.json');
it('uses two-month-old data and keeps an unobserved outcome pending', () => {
  const p = prepareProspectiveNowcast(data, protocol, '2026-09-08T00:00:00.000Z');
  expect(p.lastInputPeriod).toBe('2026-07');
  expect(p.prediction).toBe(lagTwoRevenue(data.records, '2026-09'));
  const r = scoreProspectiveNowcasts([p], data, '2026-09-08T01:00:00.000Z');
  expect(r).toMatchObject({ captured: 1, pending: 1, scored: 0, mae: null, coverage: null, operationallyValidated: false });
});
it('rejects future inputs, changed units, duplicate forecasts and known outcomes', () => {
  const delayed = structuredClone(data); delayed.records.at(-1).availableBy = '2026-09-09';
  expect(() => prepareProspectiveNowcast(delayed, protocol, '2026-09-08T00:00:00.000Z')).toThrow(/available/);
  expect(() => prepareProspectiveNowcast({ ...data, units: 'USD' }, protocol, '2026-09-08T00:00:00.000Z')).toThrow(/target/);
  const p = prepareProspectiveNowcast(data, protocol, '2026-09-08T00:00:00.000Z');
  expect(() => scoreProspectiveNowcasts([p,p],data,'2026-09-09T00:00:00.000Z')).toThrow(/Duplicate/);
  const outcome = { period: '2026-09', amount: p.prediction, availableBy: '2026-10-10', originalDisclosureUrl: 'https://example.com/fixture' };
  const scored = scoreProspectiveNowcasts([p],{ ...data, records: [...data.records, outcome] },'2026-10-11T00:00:00.000Z');
  expect(scored.results[0].absoluteError).toBe(0);
  expect(scored.operationallyValidated).toBe(false);
});
it('rejects wrong currency or title during original disclosure extraction', () => {
  const html = '<p>TSMC July 2026 Revenue Report</p><p>Consolidated (Unit: NT$ million)</p><p>Net Revenue 123,456</p>';
  expect(parseRevenueDisclosure(html,'2026-07').amount).toBe(123456);
  expect(() => parseRevenueDisclosure(html.replace('NT$', 'US$'),'2026-07')).toThrow(/TWD/);
  expect(() => parseRevenueDisclosure(html,'2026-08')).toThrow(/title/);
});
