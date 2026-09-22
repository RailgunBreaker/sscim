// Real UI + authenticated HTTP routes + isolated in-memory SQLite. These
// synthetic interaction fixtures never enter the user's private workspace.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import { createPilotStore } from '../../server/src/pilot-store.js';
import { pilotRouter } from '../../server/src/routes/pilot.js';
import { loadPilotIntake } from '../../server/src/pilot-intake.js';
import { archiveFiling, readArchivedFiling } from '../../server/src/filing-archive.js';
const express = createRequire(new URL('../../server/package.json', import.meta.url))('express');
const snapshot = JSON.parse(readFileSync(new URL('../src/data/operational-snapshot.json', import.meta.url)));
const previousToken = process.env.ADMIN_TOKEN;
process.env.ADMIN_TOKEN = 'isolated-pilot-browser-token';
const app = express(); app.use(express.json());
let store;
app.use('/api/admin/pilot', pilotRouter(() => store));
app.get('/api/bundle', (req, res) => res.json(snapshot));
app.get('/api/quotes', (req, res) => res.json({ quotes: {} }));
app.use(express.static(fileURLToPath(new URL('../../dist-app/', import.meta.url))));
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const shots = new URL('../../artifacts/dashboard-check/', import.meta.url); mkdirSync(shots, { recursive: true });
// Every frozen source in this interaction test is an explicitly synthetic,
// content-addressed fixture. A fresh checkout has no private research archive.
const archiveDirectory = mkdtempSync(fileURLToPath(new URL('pilot-fixtures-', shots)));
const intakeFixture = structuredClone(loadPilotIntake());
intakeFixture.checks = intakeFixture.checks.map((check, index) => ({ ...check,
  url: `https://example.test/browser-fixture-${index}.html`,
  ...archiveFiling(`<html><body><h1>Synthetic browser filing fixture ${index}</h1><p>No real issuer judgment or incident loss is asserted.</p></body></html>`, archiveDirectory),
}));
let browser, checks = 0;
const check = (value, label) => { if (!value) throw new Error(label); checks++; console.log('PASS ' + label); };
try {
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  else for (const channel of ['msedge', 'chrome', 'chromium']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch { /* next installed browser */ } }
  if (!browser) browser = await chromium.launch({ headless: true });
  for (const width of [1366, 375]) {
    let draftRecords = [];
    store = createPilotStore(':memory:', id => snapshot.companies.some(c => c.id === id), undefined,
      () => intakeFixture, () => ({ records: draftRecords }), hash => readArchivedFiling(hash, archiveDirectory));
    const page = await browser.newPage({ viewport: { width, height: 936 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: base + url.pathname + url.search }); await route.fulfill({ response });
    });
    await page.goto(base + '/sscim-app.html');
    await page.getByRole('button', { name: 'Investigations', exact: true }).click();
    const panel = page.locator('.evidence-content[aria-label="Supplier investigations"]');
    await panel.getByLabel('Workspace access token').fill('wrong-token');
    await panel.getByRole('button', { name: 'Connect workspace' }).click();
    await panel.getByRole('alert').waitFor();
    check((await panel.innerText()).includes('Unauthorized'), `${width}: private records reject incorrect credentials`);
    await panel.getByLabel('Workspace access token').fill(process.env.ADMIN_TOKEN);
    await panel.getByRole('button', { name: 'Connect workspace' }).click();
    await panel.getByRole('button', { name: 'Disconnect' }).waitFor();
    const watch = panel.locator('form').filter({ has: page.getByRole('button', { name: 'Add company to watchlist' }) });
    await watch.getByLabel('Product or business scope').fill('Test SOI wafer portfolio');
    await watch.getByLabel('Monitoring objective').fill('Test supplier confirmation workflow');
    await watch.getByRole('button').click();
    await page.waitForFunction(() => document.body.innerText.includes('Monitoring objective: Test supplier confirmation workflow'));
    check(store.snapshot().summary.trackedCompanies === 1, `${width}: watchlist persists`);
    await panel.getByText('Start a source-linked investigation', { exact: true }).click();
    const createCase = panel.locator('form').filter({ has: page.getByRole('button', { name: 'Create investigation' }) });
    await createCase.getByLabel('Question to investigate').fill('Test whether delivery timing changed');
    await createCase.getByLabel('Product or business scope').fill('Test SOI wafers');
    await createCase.getByLabel('Evidence URL').fill('https://example.com/test-source');
    await createCase.getByLabel('Source publication date').fill('2026-09-01');
    await createCase.getByRole('button').click();
    await panel.getByLabel('Investigation', { exact: true }).waitFor();
    check(store.snapshot().summary.openInvestigations === 1, `${width}: source-linked investigation persists`);
    const action = panel.locator('form').filter({ has: page.getByRole('button', { name: 'Record action' }) });
    await action.getByLabel('Action taken').fill('Reviewed the test disclosure');
    await action.getByLabel('Action date').fill('2026-09-02');
    await action.getByLabel('Supporting reference').fill('test-review-1'); await action.getByRole('button').click();
    await page.waitForFunction(() => document.body.innerText.includes('2026-09-02: Reviewed the test disclosure'));
    check(store.snapshot().summary.actions === 1, `${width}: actions retain references`);
    await panel.getByText('Track an expected delivery', { exact: true }).click();
    const delivery = panel.locator('form').filter({ has: page.getByRole('button', { name: 'Track delivery', exact: true }) });
    for (const [label, value] of [['Order or order-line reference','test-order-1'],['Part or product','Test wafers'],['Promised delivery date','2026-09-05'],['Ordered quantity','100'],['Quantity units','wafers']]) await delivery.getByLabel(label).fill(value);
    await delivery.getByRole('button').click(); await panel.getByText('Add receipt or correct delivery record', { exact: true }).waitFor();
    check(store.snapshot().summary.overduePending === 1, `${width}: undelivered past-due order remains pending`);
    await panel.getByText('Add receipt or correct delivery record', { exact: true }).click();
    let receiptForm = panel.locator('form').filter({ has: page.getByRole('button', { name: 'Save delivery update' }) });
    const addReceipt = async (quantity, date, reference) => {
      const fieldset = receiptForm.locator('fieldset').filter({ hasText: 'New receipt (optional)' });
      await fieldset.getByLabel('Received date').fill(date); await fieldset.getByLabel('Received quantity').fill(quantity); await fieldset.getByLabel('Receipt reference').fill(reference);
      await receiptForm.getByLabel('Reason for this update').fill('Record test receipt'); await receiptForm.getByRole('button').click();
    };
    await addReceipt('30', '2026-09-06', 'test-receipt-1');
    await page.waitForFunction(() => document.body.innerText.includes('Received 30 of 100'));
    check(store.snapshot().summary.completedDeliveries === 0, `${width}: partial receipt is not a completed delivery`);
    await addReceipt('70', '2026-09-08', 'test-receipt-2');
    await page.waitForFunction(() => document.body.innerText.includes('3 days late'));
    check(store.snapshot().summary.lateCompleted === 1 && store.snapshot().summary.overduePending === 0, `${width}: full receipt uses actual completion date`);
    await panel.getByRole('button', { name: 'Reload workspace' }).click();
    check((await panel.innerText()).includes('test-order-1'), `${width}: persisted delivery survives reload`);
    await panel.getByText('Change history (6)', { exact: true }).waitFor();
    check(store.snapshot().history.length === 6, `${width}: corrections preserve an audit trail`);
    await panel.getByRole('button', { name: 'Activate disclosure pilot' }).click();
    await page.waitForFunction(() => document.body.innerText.includes('3 historical or backfilled documents'));
    await panel.getByRole('button', { name: 'Activate disclosure pilot' }).waitFor({ state: 'detached' });
    check(store.snapshot().protocol.historicalInvestigations.length === 3, `${width}: activation imports historical cases with source provenance`);
    const intake = panel.getByRole('region', { name: 'Disclosure pilot' });
    await intake.getByRole('heading', { name: 'Filing review queue' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL(`pilot-queue-${width}.png`, shots)) });
    const queueCard = intake.locator('article').first();
    await queueCard.getByLabel('Review decision').selectOption('investigate');
    await queueCard.getByLabel('Decision reason').fill('Test review of historical disclosure; determine the remaining recovery boundary.');
    await queueCard.getByRole('button', { name: 'Save review decision' }).click();
    await queueCard.getByRole('button', { name: 'Open linked investigation' }).waitFor();
    check(store.snapshot().evaluation.triaged === 1 && store.snapshot().reviews[0].independentOutcomeLabel === false, `${width}: triage is persisted without claiming independent validation`);
    await queueCard.getByRole('button', { name: 'Open linked investigation' }).click();
    check(await panel.getByLabel('Pilot company', { exact: true }).inputValue() === 'wdc', `${width}: monitored issuer absent from map is selectable`);
    check((await panel.innerText()).includes('Who paid the remaining disclosed recovery'), `${width}: source review opens its historical investigation`);
    await panel.getByRole('button', { name: 'Reload workspace' }).click();
    await panel.getByText('Review history (1)', { exact: true }).waitFor();
    check(store.snapshot().records.filter(r => r.type === 'investigation').length === 4, `${width}: existing historical case is linked without duplication`);
    const auditPanel = panel.getByRole('region', { name: 'Filing accuracy audit' });
    await auditPanel.getByRole('button', { name: 'Freeze audit census' }).click();
    await auditPanel.getByText('Review rubric', { exact: true }).waitFor();
    check(store.snapshot().audits[0].score.total === 11 && store.snapshot().audits[0].score.controls === 1, `${width}: audit freezes all regular filings and separates the control`);
    const frozenAudit = store.snapshot().audits[0], draftCase = frozenAudit.cases[0];
    draftRecords = [{ batchId: frozenAudit.id, caseId: draftCase.id, sourceSha256: draftCase.sourceSha256,
      preparedAt: new Date().toISOString(), proposedLabel: 'uncertain', rationale: 'Synthetic browser draft; no real classification asserted.',
      evidenceSection: 'Test draft scope', quote: '' }];
    await panel.getByRole('button', { name: 'Reload workspace' }).click();
    await auditPanel.getByText('1 AI screening drafts available.', { exact: false }).waitFor();
    check(store.snapshot().audits[0].labels.length === 0 && store.snapshot().audits[0].score.externalReviewNeeded === 11, `${width}: drafts do not create judgments or reduce the review backlog`);
    const auditCase = auditPanel.locator('details.pilot-card details.pilot-card').first();
    await auditCase.locator(':scope > summary').click();
    check(await auditCase.getByText('AI screening draft — not a saved judgment', { exact: true }).isVisible(), `${width}: draft is distinguished from a saved judgment`);
    await auditCase.getByRole('button', { name: 'Read frozen source' }).click();
    const archivedText = auditCase.getByLabel('Archived filing text', { exact: true });
    await archivedText.waitFor();
    check((await archivedText.inputValue()).includes('Synthetic browser filing fixture')
      && (await archivedText.inputValue()).includes('No real issuer judgment'), `${width}: isolated archived source is readable inside the app`);
    await auditCase.getByLabel('Reviewer identity').fill('Browser test fixture reviewer');
    await auditCase.getByLabel('Review origin').selectOption('ai_assisted');
    await auditCase.getByLabel('Sections reviewed').fill('Test interaction only; no real source judgment');
    await auditCase.getByLabel('Judgment rationale').fill('Synthetic browser test remains uncertain and excluded from scoring.');
    await auditCase.getByRole('button', { name: 'Save source judgment' }).click();
    await auditPanel.getByText('Judgment history (1)', { exact: true }).waitFor();
    check(store.snapshot().audits[0].score.accuracy === null && store.snapshot().audits[0].score.uncertain === 1, `${width}: AI-assisted uncertain judgment cannot unlock scores`);
    await panel.getByRole('button', { name: 'Reload workspace' }).click();
    await auditPanel.getByText('Judgment history (1)', { exact: true }).waitFor();
    check(store.snapshot().audits[0].labels.length === 1, `${width}: audit judgment and provenance survive reload`);
    await auditPanel.getByText('External reviewer handoff', { exact: true }).click();
    const downloadEvent = page.waitForEvent('download');
    await auditPanel.getByRole('button', { name: 'Download reviewer package' }).click();
    const download = await downloadEvent;
    const handoff = JSON.parse(readFileSync(await download.path(), 'utf8'));
    check(handoff.cases.length === 11 && handoff.cases.every(c => !Object.hasOwn(c, 'matched'))
      && !JSON.stringify(handoff).includes('Browser test fixture reviewer'), `${width}: reviewer download omits predictions and previous judgments`);
    const importedReview = { ...handoff.responseTemplate.reviews[1], label: 'uncertain', reviewerId: 'Import test fixture',
      reviewerKind: 'ai_assisted', evidenceSection: 'Synthetic import interaction only', rationale: 'No real source judgment; this fixture stays unresolved.' };
    const returnedResponse = { ...handoff.responseTemplate, reviews: [importedReview] };
    await auditPanel.getByLabel('Completed reviewer response').setInputFiles({ name: 'fixture-response.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(returnedResponse)) });
    await auditPanel.getByRole('button', { name: 'Preview reviewer response' }).click();
    await auditPanel.getByRole('button', { name: 'Import reviewed response' }).waitFor();
    check(store.snapshot().audits[0].labels.length === 1, `${width}: import preview leaves judgments unchanged`);
    await auditPanel.getByRole('button', { name: 'Import reviewed response' }).click();
    await auditPanel.getByText('Judgment history (2)', { exact: true }).waitFor();
    check(store.snapshot().audits[0].importHistory.length === 1 && store.snapshot().audits[0].score.accuracy === null, `${width}: explicit import records provenance without promoting AI labels`);
    await auditPanel.getByRole('heading', { name: 'Filing accuracy audit' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL(`pilot-audit-${width}.png`, shots)) });
    await panel.getByRole('heading', { name: 'Delivery outcomes' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL(`pilot-${width}.png`, shots)) });
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    check(size.scroll <= size.width + 1, `${width}: workflow fits viewport`);
    await panel.getByRole('button', { name: 'Disconnect' }).click();
    check(!(await panel.innerText()).includes('test-order-1'), `${width}: disconnect removes private records from view`);
    check(errors.length === 0, `${width}: no browser runtime errors`);
    await page.close(); store.close(); store = null;
  }
  console.log(`${checks}/${checks} pilot checks passed`);
} catch (error) {
  for (const context of browser?.contexts() || []) for (const page of context.pages()) {
    console.error('Pilot UI failure:', await page.locator('[role="alert"]').allTextContents());
    await page.screenshot({ path: fileURLToPath(new URL('pilot-failure.png', shots)) });
  }
  console.error('Saved test record types:', store?.snapshot().records.map(r => r.type));
  throw error;
} finally {
  await browser?.close(); await new Promise(r => server.close(r)); store?.close();
  if (dirname(resolve(archiveDirectory)) !== resolve(fileURLToPath(shots))) throw new Error('Unexpected test archive path');
  rmSync(archiveDirectory, { recursive: true, force: true });
  if (previousToken === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = previousToken;
}
