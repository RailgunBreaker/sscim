/* ====================================================================
   browser-smoke.mjs — the checks that only a real browser can make.

   vitest+jsdom already covers behaviour. What it cannot cover is LAYOUT,
   and layout is where the defects this suite exists for actually lived:
   jsdom reports every element as 0×0, so a 900px blank region under the
   Events feed, a page that scrolls horizontally at 375px, and a feed
   pinned to 420px inside a 1317px panel are all completely invisible to
   it. Those need measured boxes from an engine that does layout.

   Deliberately NOT a new framework. It drives the production build with
   playwright-core against the browser already installed on the machine
   (Edge, then Chrome), serves ../dist-app over a plain node http server,
   and reports pass/fail lines. No test runner, no config file, no new
   dependency to install — playwright-core is already in the tree.

   Run:  npm run smoke              (headless, all viewports)
         npm run smoke -- --shots   (also writes screenshots)
         npm run smoke -- --headed  (watch it work)
   ==================================================================== */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', 'dist-app');
const shotDir = path.resolve(here, '..', '..', 'docs', 'screenshots');
const WANT_SHOTS = process.argv.includes('--shots');
const HEADED = process.argv.includes('--headed');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.md': 'text/markdown',
};

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1366x936', width: 1366, height: 936 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const results = [];
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); };
const fail = (name, detail = '') => { results.push({ ok: false, name, detail }); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); };
const check = (cond, name, detail) => (cond ? pass(name, detail) : fail(name, detail));

function serve() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: !HEADED }); } catch { /* try the next one */ }
  }
  try { return await chromium.launch({ headless: !HEADED }); } catch (e) {
    throw new Error(`No usable Chromium found (tried Edge, Chrome, bundled). ${e.message}`);
  }
}

/* The dashboard fetches the vault API and falls back to the static
   snapshot when it is unreachable. Nothing is running on 8787 here, so
   the fallback path is what gets exercised — which is also the path the
   GitHub Pages deploy uses, so it is the right one to smoke-test. */
let nav = 0;
async function openDashboard(page, base, hash = '') {
  /* A unique query string per navigation. Without it, going from
     "sscim-app.html" to "sscim-app.html#fac=..." changes only the fragment,
     so the browser fires hashchange instead of loading the document — and
     the dashboard reads its shareable state once, on mount. That is correct
     behaviour for the app (a shared link opened or reloaded restores the
     state, which is what is required) but it means a smoke test must force
     a real navigation to exercise the restore path at all. */
  nav += 1;
  await page.goto(`${base}/sscim-app.html?nav=${nav}${hash}`, { waitUntil: 'load' });
  /* The footer only renders once the vault has resolved (live or static
     fallback), so it is the one selector that means "the dashboard is up"
     at every viewport — Layer 3 itself is behind a tab below 1080px. */
  await page.waitForSelector('footer', { timeout: 30000 });
  await page.waitForTimeout(500);
}

const shot = async (page, name) => {
  if (!WANT_SHOTS) return;
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: false });
};

async function main() {
  if (!fs.existsSync(path.join(root, 'sscim-app.html'))) {
    console.error(`No build found at ${root}. Run "npm run build" first.`);
    process.exit(2);
  }
  const { server, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const browser = await launch();
  const consoleErrors = [];

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n── ${vp.name} ─────────────────────────────`);
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        // The deliberate, expected fallback notice is not a defect.
        if (/vault API unreachable|Failed to load resource|net::ERR|ERR_CONNECTION/i.test(text)) return;
        consoleErrors.push(`${vp.name}: ${text}`);
      });
      page.on('pageerror', (e) => consoleErrors.push(`${vp.name}: ${e.message}`));

      await openDashboard(page, base);

      /* ---- no page-level horizontal overflow, at any width ---- */
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 2, `${vp.name} no horizontal page overflow`, `${overflow}px`);

      const wide = vp.width >= 1080;
      if (!wide) {
        // Layer 3 is behind a tab on narrow layouts.
        const intelTab = page.locator('button', { hasText: /^Intel$/ }).first();
        if (await intelTab.count()) await intelTab.click();
        await page.waitForTimeout(250);
      }

      /* ---- THE LAYOUT DEFECT: blank space under the active tab ---- */
      for (const tab of ['WATCH', 'EXPLORE', 'EVENTS', 'HISTORY', 'COMPANIES', 'MOVERS', 'CAPITAL']) {
        const btn = page.locator('[role="tab"]').filter({ hasText: new RegExp(tab, 'i') }).first();
        if (!(await btn.count())) { fail(`${vp.name} tab ${tab} present`); continue; }
        await btn.click();
        await page.waitForTimeout(220);

        const box = await page.evaluate(() => {
          const panel = document.querySelector('[role="tabpanel"]');
          if (!panel) return null;
          const column = panel.parentElement;
          const grid = column?.parentElement;
          const left = grid?.firstElementChild;
          return {
            panelH: Math.round(panel.getBoundingClientRect().height),
            contentH: Math.round(panel.scrollHeight),
            columnH: Math.round(column.getBoundingClientRect().height),
            leftH: left ? Math.round(left.getBoundingClientRect().height) : 0,
            scrolls: panel.scrollHeight > panel.clientHeight + 1,
            docH: Math.round(document.documentElement.scrollHeight),
          };
        });
        if (!box) { fail(`${vp.name} ${tab} panel found`); continue; }

        if (wide) {
          /* The gap that used to be ~900px: panel height minus the height
             its content actually occupies, when the content does not fill
             it. A scrolling panel has no gap by definition. */
          const gap = box.scrolls ? 0 : Math.max(0, box.panelH - box.contentH);
          check(gap < 260, `${vp.name} ${tab}: no large blank region`, `gap ${gap}px (panel ${box.panelH}, content ${box.contentH}${box.scrolls ? ', scrolls' : ''})`);
          // The right column should track the left detail column's height.
          const diff = Math.abs(box.columnH - box.leftH);
          check(diff < 40, `${vp.name} ${tab}: right column matches the detail column`, `${box.columnH} vs ${box.leftH}`);
          check(box.docH < 9000, `${vp.name} ${tab}: page height stays sane`, `${box.docH}px`);
        } else {
          // Narrow: no nested scroller — the content flows into the document.
          check(!box.scrolls, `${vp.name} ${tab}: no nested scroll box on narrow`, `panel ${box.panelH}px`);
        }
      }

      if (vp.name === '1366x936') {
        await page.locator('[role="tab"]').filter({ hasText: /EVENTS/i }).first().click();
        await page.waitForTimeout(250);
        const countText = await page.locator('[role="tabpanel"] [aria-live="polite"]').first().innerText().catch(() => '');
        check(/matching event/i.test(countText), 'events feed reports a match count', countText.split('\n')[0]);
        await shot(page, 'events-layout-1366x936');
      }

      /* ---- Facility Playground ---- */
      const pgBtn = page.locator('[role="radio"]').filter({ hasText: /Playground/i }).first();
      if (await pgBtn.count()) {
        await pgBtn.click();
        await page.waitForTimeout(400);
        if (!wide) {
          // Below 1080px the three layers are one-at-a-time tabs; Layer 1
          // (which hosts the playground) is behind "Map".
          const mapTab = page.locator('button', { hasText: /^Map$/ }).first();
          if (await mapTab.count()) await mapTab.click();
          await page.waitForTimeout(400);
        }
        const hasSearch = await page.locator('input[type="search"]').first().count();
        check(hasSearch > 0, `${vp.name} playground opens on a search field`);
        const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(ov2 <= 2, `${vp.name} playground: no horizontal page overflow`, `${ov2}px`);
        if (vp.name === '1920x1080') await shot(page, 'playground-start-1920x1080');
        if (vp.name === '375x812') await shot(page, 'playground-mobile-375x812');
      } else {
        fail(`${vp.name} playground view button present`);
      }

      await context.close();
    }

    /* ---- deep checks, one viewport ---- */
    console.log('\n── deep checks (1920x1080) ─────────────');
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => consoleErrors.push(`deep: ${e.message}`));
    await openDashboard(page, base);

    // Newest event is selected, not EVENTS[0].
    const detailText = await page.locator('#pane-intel').first().innerText();
    check(!/Jul 0?3, 2026/.test(detailText.slice(0, 400)), 'dashboard does not open on the stale July 3 event');

    // Static-snapshot labelling.
    const bodyText = await page.locator('body').innerText();
    check(/STATIC SNAPSHOT/i.test(bodyText), 'static fallback is labelled STATIC SNAPSHOT, not LIVE');
    check(!/●\s*LIVE\b(?!\s*VAULT)/.test(bodyText), 'no bare "LIVE" label while on the static snapshot');

    // No internal review notes anywhere in the rendered page.
    const html = await page.content();
    const leak = html.match(/Published:\s*Review|Review:\s*(approve|reject)\b|cand_[a-z0-9_]{8,}/i);
    check(!leak, 'no internal review notes in the rendered dashboard', leak ? leak[0] : '');

    // TSMC Fab 18: all 53 inbound relationships reachable.
    await openDashboard(page, base, '#view=playground&fac=tsmc_fab18');
    await page.waitForSelector('section[aria-label="Complete connection table"]', { timeout: 20000 });
    await page.waitForTimeout(400);
    const pgText = await page.locator('#pane-map').innerText();
    check(/53 INBOUND/i.test(pgText), 'TSMC Fab 18 reports 53 inbound relationships', (pgText.match(/\d+ INBOUND · \d+ OUTBOUND/i) || [''])[0]);
    check(/Showing \d+ of \d+ matching connections/i.test(pgText) || /Showing all \d+/i.test(pgText),
      'connection table states an exact visible-of-total count');

    const showAll = page.locator('button', { hasText: /^Show all \d+$/ }).first();
    if (await showAll.count()) {
      await showAll.click();
      await page.waitForTimeout(500);
      const rows = await page.locator('section[aria-label="Complete connection table"] ul > li').count();
      check(rows >= 60, 'Show all reveals every one of the 60 connections', `${rows} rows`);
    } else {
      fail('Show all control present on a 60-connection facility');
    }
    // The graph must state its own cap honestly.
    check(/showing the strongest \d+ of \d+ suppliers/i.test(pgText), 'graph states the exact visible-of-total supplier count');
    await shot(page, 'playground-tsmc-fab18');

    // URL round-trip: the shared link reproduces the state.
    const hash = await page.evaluate(() => window.location.hash);
    check(/fac=tsmc_fab18/.test(hash), 'playground focus is encoded in the URL', hash.slice(0, 90));

    // ASML, two hops.
    await openDashboard(page, base, '#view=playground&fac=asml_veldhoven&facd=2');
    await page.waitForSelector('section[aria-label="Complete connection table"]', { timeout: 20000 });
    await page.waitForTimeout(600);
    const asml = await page.locator('#pane-map').innerText();
    check(/ASML — Veldhoven/i.test(asml), 'ASML Veldhoven opens in the playground');
    const hop2 = await page.locator('svg text').filter({ hasText: /hop 2/ }).count();
    check(hop2 > 0, 'two-hop traversal draws hop-2 nodes', `${hop2} nodes`);
    await shot(page, 'playground-asml-2hop');

    // Focus survives a Layer-3 tab switch (the state-loss defect).
    await openDashboard(page, base, '#fac=asml_veldhoven');
    await page.waitForTimeout(600);
    await page.locator('[role="tab"]').filter({ hasText: /EVENTS/i }).first().click();
    await page.waitForTimeout(300);
    await page.locator('[role="tab"]').filter({ hasText: /EXPLORE/i }).first().click();
    await page.waitForTimeout(500);
    const explore = await page.locator('[role="tabpanel"]').first().innerText();
    check(/ASML/i.test(explore), 'facility focus survives switching Layer-3 tabs');

    /* HAZARD RADIUS BY KEYBOARD — the regression the brief says must be
       preserved: End takes the radius to 800km and the affected-facility
       readout recomputes. The control only exists once an epicentre is on
       the map, so this drives the real flow (enable hazard mode, click the
       map over the Taiwan/Japan cluster, then use the keyboard) rather
       than asserting against a control that is not on screen yet. */
    await openDashboard(page, base);
    const hazardBtn = page.locator('button[aria-pressed]').filter({ hasText: /hazard/i }).first();
    if (await hazardBtn.count()) {
      await hazardBtn.click();
      await page.waitForTimeout(300);
      /* The centre of the Leaflet pane: away from the site markers, which
         have their own click handlers and would open a facility instead of
         dropping an epicentre. */
      const mapBox = await page.locator('.leaflet-container').first().boundingBox();
      if (mapBox) {
        await page.mouse.click(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.5);
        await page.waitForTimeout(900);
      }
      const radius = page.locator('input[aria-label="Hazard radius in kilometres"]').first();
      if (await radius.count()) {
        await radius.focus();
        const before = await radius.inputValue();
        const readoutBefore = await page.locator('#pane-map').first().innerText();
        await radius.press('End');
        await page.waitForTimeout(500);
        const after = await radius.inputValue();
        const readoutAfter = await page.locator('#pane-map').first().innerText();
        check(after === '800' && after !== before, 'hazard radius: End takes it to the maximum', `${before} -> ${after} km`);
        /* The readout must actually recompute, not just redraw the ring.
           Whether the epicentre catches plants depends where the click
           landed, so both outcomes are accepted — what is asserted is that
           the panel re-derived itself against the new radius. */
        check(readoutAfter !== readoutBefore && /800 km/.test(readoutAfter),
          'hazard radius: the affected-facility readout recomputes',
          (readoutAfter.match(/(No modeled site within \d+ km|\d+ modeled sites? inside the radius)/) || [''])[0]);
        await radius.press('Home');
        await page.waitForTimeout(400);
        check(await radius.inputValue() === '25', 'hazard radius: Home takes it to the minimum');
      } else {
        fail('hazard radius control did not appear after placing an epicentre');
      }
    } else {
      fail('hazard mode button not found on the map toolbar');
    }

    await context.close();

    /* ---- the four Layer-1 views, and history review ---- */
    console.log('\n── views and history review ────────');
    const vctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const vp = await vctx.newPage();
    vp.on('pageerror', (e) => consoleErrors.push(`views: ${e.message}`));
    await openDashboard(vp, base);

    for (const [label, expect] of [
      ['Geographic', /WORLD MAP/i],
      ['Topology', /FUNCTIONAL-CENTRE NETWORK/i],
      ['Split', /WORLD MAP \+ FUNCTIONAL-CENTRE NETWORK/i],
      ['Facility Playground', /FACILITY PLAYGROUND/i],
    ]) {
      const btn = vp.locator('[role="radio"]').filter({ hasText: new RegExp(label, 'i') }).first();
      if (!(await btn.count())) { fail(`view "${label}" is offered`); continue; }
      await btn.click();
      await vp.waitForTimeout(700);
      const title = await vp.locator('#pane-map').first().innerText();
      check(expect.test(title), `view "${label}" renders its own Layer 1`, title.split('\n')[0].slice(0, 70));
      const ov = await vp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(ov <= 2, `view "${label}": no horizontal overflow`, `${ov}px`);
      /* Scoped to the VIEW radiogroup: the lens bar has a second one, so
         counting checked radios across the page always finds two. */
      const checkedView = await vp.locator('[role="radiogroup"][aria-label="View mode"] [role="radio"][aria-checked="true"]').count();
      const checkedLabel = await vp.locator('[role="radiogroup"][aria-label="View mode"] [role="radio"][aria-checked="true"]').first().innerText();
      check(checkedView === 1 && new RegExp(label, 'i').test(checkedLabel),
        `view "${label}" is announced as selected`, checkedLabel.trim());
    }

    /* History review: a past date, then back to the live reading. The two
       are different claims and must be labelled differently. */
    await vp.locator('[role="radio"]').filter({ hasText: /Geographic/i }).first().click();
    await vp.waitForTimeout(500);
    const liveLabel = await vp.locator('body').innerText();
    check(/STATIC SNAPSHOT/.test(liveLabel), 'starts on the current snapshot, labelled as such');

    const timeSlider = vp.locator('input[aria-label="Review the chain as of a past date"]').first();
    if (await timeSlider.count()) {
      await timeSlider.focus();
      const before = await timeSlider.inputValue();
      for (let i = 0; i < 40; i += 1) await timeSlider.press('ArrowLeft');
      await vp.waitForTimeout(700);
      const after = await timeSlider.inputValue();
      check(after !== before, 'history review moves to a past date by keyboard', `${before} -> ${after}`);
      const reviewing = await vp.locator('body').innerText();
      check(/HISTORY REVIEW/i.test(reviewing), 'a reviewed past date is labelled HISTORY REVIEW, not LIVE');
      check(/STATIC SNAPSHOT/.test(reviewing), 'the data source is still stated while reviewing the past');

      const back = vp.locator('button', { hasText: /Return to live/i }).first();
      if (await back.count()) {
        await back.click();
        await vp.waitForTimeout(700);
        const returned = await vp.locator('body').innerText();
        check(!/HISTORY REVIEW/i.test(returned), 'returning to live clears the history-review label');
        check(/STATIC SNAPSHOT/.test(returned), 'and lands back on the current snapshot');
      } else {
        fail('"Return to live" control not found while reviewing a past date');
      }
    } else {
      fail('history-review slider not found');
    }
    await vctx.close();

    /* ---- accessibility: keyboard reach and announced state ---- */
    console.log('\n── accessibility ──────────────────────');
    const actx = await browser.newContext({ viewport: { width: 1366, height: 936 } });
    const ap = await actx.newPage();
    ap.on('pageerror', (e) => consoleErrors.push(`a11y: ${e.message}`));
    await openDashboard(ap, base);

    // Layer 3 is a real tablist with the standard keyboard contract.
    const tabs = ap.locator('[role="tab"]');
    check(await tabs.count() === 7, 'seven Layer-3 tabs with role="tab"', `${await tabs.count()}`);
    const selected = ap.locator('[role="tab"][aria-selected="true"]');
    check(await selected.count() === 1, 'exactly one tab is announced as selected');
    const roving = await ap.locator('[role="tab"][tabindex="0"]').count();
    check(roving === 1, 'roving tabindex: the tab group is one tab stop', `${roving}`);

    await selected.first().focus();
    const beforeTab = await selected.first().innerText();
    await ap.keyboard.press('ArrowRight');
    await ap.waitForTimeout(250);
    const afterTab = await ap.locator('[role="tab"][aria-selected="true"]').first().innerText();
    check(afterTab !== beforeTab, 'ArrowRight moves between tabs', `${beforeTab.trim()} -> ${afterTab.trim()}`);
    await ap.keyboard.press('End');
    await ap.waitForTimeout(250);
    const endTab = await ap.locator('[role="tab"][aria-selected="true"]').first().innerText();
    check(/CAPITAL/i.test(endTab), 'End jumps to the last tab', endTab.trim());
    await ap.keyboard.press('Home');
    await ap.waitForTimeout(250);
    check(/WATCH/i.test(await ap.locator('[role="tab"][aria-selected="true"]').first().innerText()), 'Home jumps to the first tab');

    // The tabpanel is associated with its tab, in both directions.
    const panelId = await ap.locator('[role="tabpanel"]').first().getAttribute('id');
    const controls = await ap.locator('[role="tab"][aria-selected="true"]').first().getAttribute('aria-controls');
    const labelledBy = await ap.locator('[role="tabpanel"]').first().getAttribute('aria-labelledby');
    const tabIdNow = await ap.locator('[role="tab"][aria-selected="true"]').first().getAttribute('id');
    check(controls === panelId && labelledBy === tabIdNow, 'tab and panel reference each other');

    // Focus indicators survive.
    await ap.locator('button').first().focus();
    const outline = await ap.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { w: cs.outlineWidth, style: cs.outlineStyle };
    });
    check(outline.style !== 'none' || parseFloat(outline.w) > 0, 'focused controls show a visible outline', JSON.stringify(outline));

    // Graph nodes and connections are keyboard-reachable in the playground.
    await openDashboard(ap, base, '#view=playground&fac=asml_veldhoven');
    await ap.waitForSelector('section[aria-label="Complete connection table"]', { timeout: 20000 });
    await ap.waitForTimeout(500);
    const svgFocusable = await ap.locator('svg [role="button"][tabindex="0"]').count();
    check(svgFocusable > 0, 'graph nodes and edges are keyboard-reachable', `${svgFocusable} focus targets`);
    const nodeLabels = await ap.locator('svg g[data-node][role="button"]').evaluateAll(
      (els) => els.filter((e) => (e.getAttribute('aria-label') || '').length > 10).length,
    );
    check(nodeLabels > 0, 'graph nodes carry an accessible name', `${nodeLabels} named`);

    // The graph is an image WITH a text alternative that points at the table.
    const svgLabel = await ap.locator('svg[role="img"]').first().getAttribute('aria-label');
    check(/table/i.test(svgLabel || ''), 'the graph points at its accessible table alternative');

    // Label legibility: no critical SVG text below 9px after scaling.
    const tiny = await ap.evaluate(() => {
      const svg = document.querySelector('#pane-map svg[role="img"]');
      if (!svg) return -1;
      const vb = svg.viewBox.baseVal;
      const scale = svg.getBoundingClientRect().width / (vb.width || 1);
      return [...svg.querySelectorAll('text')]
        .filter((t) => (t.textContent || '').trim().length > 2)
        .filter((t) => parseFloat(getComputedStyle(t).fontSize) * scale < 9).length;
    });
    check(tiny === 0, 'no facility-graph label renders below 9px', `${tiny} too small`);

    // The filter slider announces its current value.
    const filtersBtn = ap.locator('button', { hasText: /Filters/ }).first();
    if (await filtersBtn.count()) {
      await filtersBtn.click();
      await ap.waitForTimeout(250);
      const slider = ap.locator('input[type="range"][aria-valuetext]').first();
      check(await slider.count() > 0, 'the strength slider announces its current value',
        (await slider.getAttribute('aria-valuetext')) || '');
    }
    await actx.close();

    /* ---- landing page: every language, real buttons, honest figures ---- */
    console.log('\n── landing page ────────────────────────');
    const lctx = await browser.newContext({ viewport: { width: 1366, height: 936 } });
    const lp = await lctx.newPage();
    lp.on('pageerror', (e) => consoleErrors.push(`landing: ${e.message}`));
    await lp.goto(`${base}/index.html`, { waitUntil: 'load' });
    await lp.waitForSelector('footer', { timeout: 20000 });
    await lp.waitForTimeout(400);

    const langButtons = lp.locator('.langbar button');
    check(await langButtons.count() === 4, 'four language selectors, as real buttons', `${await langButtons.count()}`);
    check(await lp.locator('.langbar b').count() === 0, 'no clickable <b> elements left in the language bar');

    // Keyboard reachable — the whole point of the conversion.
    await lp.locator('.langbar button').first().focus();
    const focused = await lp.evaluate(() => document.activeElement?.tagName);
    check(focused === 'BUTTON', 'the language control takes keyboard focus', focused);

    for (const i of [0, 1, 2, 3]) {
      const btn = langButtons.nth(i);
      const label = (await btn.innerText()).trim();
      await btn.click();
      await lp.waitForTimeout(250);
      const pressed = await btn.getAttribute('aria-pressed');
      const body = await lp.locator('body').innerText();
      check(pressed === 'true' && body.length > 500, `language "${label}" renders`, `${body.length} chars`);
      const ov = await lp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(ov <= 2, `language "${label}": no horizontal overflow`, `${ov}px`);
    }

    await langButtons.first().click();
    await lp.waitForTimeout(250);
    const landing = await lp.locator('body').innerText();
    /* The stale claims. 244 was the count when the vault held 275; the
       one-tap hypothetical and the Taiwan Strait briefing described
       features that were removed. */
    check(!/\b244\b/.test(landing), 'landing no longer advertises 244 named sites');
    check(/275 named/.test(landing), 'landing quotes the real facility count', (landing.match(/\d+ named sites?/) || [''])[0]);
    check(!/Taiwan Strait crisis briefing/i.test(landing), 'no Taiwan Strait crisis-briefing example');
    check(!/One tap runs a hypothetical/i.test(landing), 'no one-tap hypothetical-scenario claim');
    check(/16 scored countries|16 carry a production share/.test(landing), 'scored vs host-only countries is spelled out');
    check(/Facility Playground/i.test(landing) || /FACILITY PLAYGROUND/.test(landing), 'the Facility Playground is described');
    check(/What it actually does/i.test(landing), 'the page lists what the product actually does');
    await shot(lp, 'landing-1366x936');
    await lctx.close();

    check(consoleErrors.length === 0, 'no SSCIM console errors', consoleErrors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (WANT_SHOTS) console.log(`Screenshots written to ${shotDir}`);
  if (failed.length) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
