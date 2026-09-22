// Exercise the built dashboard on desktop and mobile with a real browser.
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const snapshot = JSON.parse(readFileSync(new URL('../src/data/vault-snapshot.json', import.meta.url)));
const root = fileURLToPath(new URL('../../dist-app/', import.meta.url));
const shots = fileURLToPath(new URL('../../artifacts/dashboard-check/', import.meta.url));
mkdirSync(shots, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = http.createServer((req,res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!path.startsWith(resolve(root) + sep) || !existsSync(path)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
  res.end(readFileSync(path));
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
let browser, checks = 0;
function check(value,message) { if (!value) throw new Error(message); checks++; console.log('PASS '+message); }
try {
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  else for (const channel of ['msedge','chrome','chromium']) {
    try { browser = await chromium.launch({ channel, headless: true }); break; } catch { /* next installed browser */ }
  }
  if (!browser) browser = await chromium.launch({ headless: true });
  for (const width of [1366,375]) {
    const page = await browser.newPage({ viewport: { width, height: 936 }, colorScheme: 'dark' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    // Exercise a static deployment; unrelated local APIs cannot mask missing data.
    await page.route('**/api/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/sscim-app.html`);
    await page.getByRole('heading',{ name:'Supply chain overview' }).waitFor();
    check(await page.getByRole('region',{ name:'Map of documented facilities' }).isVisible(), `${width}: map in main dashboard`);
    check((await page.locator('[aria-label="Selected company evidence"]').innerText()).includes('71% of SOI wafer spend'), `${width}: real GF data integrated`);
    check(await page.locator('[data-testid="open-research"]').count() === 0, `${width}: no separate research gate`);
    await page.screenshot({ path: resolve(shots,`dashboard-${width}.png`), fullPage: false });
    for (const [id, expected] of [['umc','3,131,000'],['tsmc','514,806'],['renesas','Reported recovery']]) {
      await page.getByLabel('Select company',{exact:true}).selectOption(id);
      check((await page.locator('[aria-label="Selected company evidence"]').innerText()).includes(expected), `${width}: ${id} selection updates company evidence`);
    }
    for (const [tab, target] of [['Disruption losses','Supplier loss allocation'],['Validation','Additional retrospective revenue validation'],['News','Reviewed occurrences']]) {
      await page.getByRole('button',{ name:tab, exact:true }).click();
      check((await page.locator('#pane-intel').innerText()).includes(target), `${width}: ${tab} available inline`);
      if (tab === 'Disruption losses') {
        const panel = page.locator('[aria-label="Chain-wide loss verification"]');
        const customers = panel.locator('[aria-label="Customer trading evidence"]');
        check((await customers.innerText()).includes('11,413,643 TWD thousand') && (await customers.innerText()).includes('32% of phison parent-company total purchases'), `${width}: reviewed customer purchases and denominator visible`);
        check((await customers.innerText()).includes('Phison Electronics Corporation → Kioxia Corporation')
          && (await customers.innerText()).includes('1,640,541 TWD thousand') && (await customers.innerText()).includes('Apacer Technology Inc.'), `${width}: transaction directions and normalized sales are preserved`);
        check((await customers.innerText()).includes('not affected shipments') && (await customers.innerText()).includes('affected-customer coverage: unknown'), `${width}: trading counterparties are not counted as affected customers`);
        const comparison = customers.locator('[aria-label="Buyer seller reconciliation"]');
        await comparison.locator('summary').click();
        check((await comparison.innerText()).includes('1,073,281 TWD thousand') && (await comparison.innerText()).includes('130,914 TWD thousand')
          && (await comparison.innerText()).includes('1,204,195 TWD thousand') && (await comparison.innerText()).includes('reported scopes reconcile'), `${width}: buyer parent and subsidiary scopes reconcile`);
        check((await comparison.innerText()).includes('918 TWD thousand') && (await comparison.innerText()).includes('unreconciled difference')
          && (await comparison.innerText()).includes('Loss attributable to this difference: unknown'), `${width}: counterparty discrepancy does not become incident loss`);
        await comparison.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`counterparty-reconciliation-${width}.png`), fullPage: false });
        const inventory = customers.locator('[aria-label="Customer inventory costs"]');
        await inventory.locator('summary').click();
        const inventoryText = await inventory.innerText();
        check(inventoryText.includes('1,711,889 TWD thousand') && inventoryText.includes('203,606 TWD thousand')
          && inventoryText.includes('1,671,654 TWD thousand') && inventoryText.includes('191,000 TWD thousand'), `${width}: inventory expenses preserve consolidated and parent scopes`);
        check(inventoryText.includes('135,888 TWD thousand') && inventoryText.includes('161,105 TWD thousand')
          && inventoryText.includes('not a no-incident counterfactual') && inventoryText.includes('Excluded from incident totals and model calibration'), `${width}: prior-year context is not incident validation`);
        check(await inventory.getByRole('link').count() === 8 && await inventory.locator('h4').count() === 4, `${width}: every inventory amount has a source and reporting scope`);
        await inventory.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`customer-inventory-${width}.png`), fullPage: false });
        await customers.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`customer-evidence-${width}.png`), fullPage: false });
        check((await panel.innerText()).includes('36 + 1 = 37'), `${width}: chain loss verification integrated`);
        check((await panel.innerText()).includes('203 + 4 = 207'), `${width}: annual charge period reconciliation integrated`);
        const costs = panel.locator('[aria-label="Producer cost boundaries"]');
        await costs.locator('summary').click();
        check((await costs.innerText()).includes('207 USD million') && (await costs.innerText()).includes('33.2 JPY billion')
          && (await costs.innerText()).includes('amount undisclosed'), `${width}: producer cost scope preserves unknown components`);
        check((await costs.innerText()).includes('286 USD million') && (await costs.innerText()).includes('249 USD million')
          && (await costs.innerText()).includes('excluded from the 2022 contamination account'), `${width}: demand-related utilization costs excluded`);
        const salesContext = panel.locator('[aria-label="Kioxia sales attribution"]');
        await salesContext.locator('summary').click();
        check((await salesContext.innerText()).includes('-26.5 JPY billion') && (await salesContext.innerText()).includes('COVID-19')
          && (await salesContext.innerText()).includes('downstream customer loss: unknown'), `${width}: mixed-cause sales evidence cannot become incident loss`);
        await salesContext.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`kioxia-sales-context-${width}.png`), fullPage: false });
        const historical = panel.locator('details').filter({has: page.getByText('Sandisk historical recovery: excluded from additional payments', {exact:true})});
        await historical.locator('summary').click();
        check((await historical.innerText()).includes('historical amount corroborated not additive'), `${width}: historical Sandisk recovery is not a new payment`);
        const product = panel.locator('details').filter({has: page.getByText('Observed effects on enterprise SSD sales', {exact:true})});
        await product.locator('summary').click();
        check((await product.innerText()).includes('38% year-over-year growth') && (await product.innerText()).includes('later growth does not establish complete catch-up'), `${width}: product revenue context preserves unknown catch-up`);
        check((await panel.innerText()).includes('7.571 JPY billion') && (await panel.innerText()).includes('Approximately 25.6 JPY billion'), `${width}: Kioxia recovery and limited net charge integrated`);
        const unassigned = panel.locator('[aria-label="Unassigned insurance evidence"]');
        check((await unassigned.innerText()).includes('2,695 JPY million') && (await unassigned.innerText()).includes('188 JPY million')
          && (await unassigned.innerText()).includes('excluded from the contamination account'), `${width}: later insurance income remains unattributed`);
        check((await panel.locator('[aria-label="Chain loss completion requirements"]').innerText()).includes('No reliable completion date')
          && await panel.locator('[aria-label="Chain loss completion requirements"] h4').count() === 3, `${width}: evidence needed for completion visible inline`);
        await unassigned.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`unassigned-insurance-${width}.png`), fullPage: false });
        check((await panel.innerText()).includes('whole-chain loss remains unverified') && (await panel.innerText()).includes('Joint-venture accounting boundary'), `${width}: joint-venture evidence preserves whole-chain limitation`);
        const production = panel.locator('[aria-label="Production loss evidence"]');
        check((await production.innerText()).includes('At least 6.5 exabytes') && (await production.innerText()).includes('Approximately 7 exabytes'), `${width}: source-linked forecast revision history visible`);
        check((await panel.innerText()).includes('Receipt in the March 2024 quarter is reported') && (await panel.innerText()).includes('not an independently disclosed cash amount'), `${width}: receipt and cash evidence distinguished`);
        const photoresist = panel.locator('[aria-label="TSMC photoresist loss verification"]');
        check((await photoresist.innerText()).includes('forecast 2.6, subsequently reported 2.6') && (await photoresist.innerText()).includes('not independent causal validation'), `${width}: TSMC issuer comparison is not model validation`);
        await photoresist.locator('summary').click();
        check(await photoresist.locator('tbody tr').count() === 8 && (await photoresist.innerText()).includes('550 USD million') && (await photoresist.innerText()).includes('3,400 TWD million'), `${width}: TSMC timing forecasts and accounting charge are inspectable`);
        await photoresist.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`photoresist-loss-${width}.png`), fullPage: false });
        await panel.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`chain-loss-${width}.png`), fullPage: false });
        await panel.getByRole('heading',{ name:'Kioxia charge and insurance recovery' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`kioxia-loss-${width}.png`), fullPage: false });
        await production.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(shots,`production-loss-${width}.png`), fullPage: false });
      }
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      check(sizes.scroll <= sizes.width + 1, `${width}: ${tab} fits viewport`);
    }
    await page.getByRole('button',{ name:'Validation', exact:true }).click();
    const extension = page.locator('[aria-label="Latest revenue validation"]');
    check((await extension.innerText()).includes('did not outperform every'), `${width}: failed baseline comparison remains visible`);
    await extension.locator('summary').click();
    check(await extension.locator('details tbody tr').count() === snapshot.lagTwoValidation.laterPeriodDiagnostic.test.months, `${width}: all source-linked outcomes inspectable`);
    await extension.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(shots,`validation-${width}.png`), fullPage: false });
    check(errors.length === 0, `${width}: no runtime errors (${errors.join('; ')})`);
    await page.close();
  }
  console.log(`${checks}/${checks} checks passed`);
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
