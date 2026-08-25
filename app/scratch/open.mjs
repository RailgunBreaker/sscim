import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, 'live');
const errors = [];

const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

const shot = async (name) => { await page.screenshot({ path: path.join(shots, `${name}.png`) }); };

// 1. Dashboard, default view — live API is running, so this should say LIVE VAULT.
await page.goto('http://localhost:5173/sscim-app.html', { waitUntil: 'load' });
await page.waitForSelector('footer', { timeout: 40000 });
await page.waitForTimeout(2500);
const bar = await page.locator('body').innerText();
console.log('source label :', /LIVE VAULT/.test(bar) ? 'LIVE VAULT' : /STATIC SNAPSHOT/.test(bar) ? 'STATIC SNAPSHOT' : '(neither)');
console.log('opening event:', (bar.match(/WHAT CHANGED · [^\n]{0,110}/) || [''])[0].slice(0, 130));
await shot('01-dashboard');

// 2. Facility Playground, TSMC Fab 18.
// ?nav=2 forces a real document load: changing only the fragment fires
// hashchange, and the app reads its shareable state once, on mount.
await page.goto('http://localhost:5173/sscim-app.html?nav=2#view=playground&fac=tsmc_fab18', { waitUntil: 'load' });
await page.waitForSelector('section[aria-label="Complete connection table"]', { timeout: 30000 });
await page.waitForTimeout(1200);
const pg = await page.locator('#pane-map').innerText();
console.log('fab18 counts :', (pg.match(/\d+ inbound · \d+ outbound · \d+ total/) || [''])[0]);
console.log('graph caption:', (pg.match(/showing the strongest[^\n]+/) || [''])[0]);
await shot('02-playground-tsmc');

// 3. Landing page.
await page.goto('http://localhost:5173/index.html', { waitUntil: 'load' });
await page.waitForSelector('footer', { timeout: 30000 });
await page.waitForTimeout(800);
await shot('03-landing');

console.log('console errors:', errors.length ? errors.slice(0, 4) : 'none');
await browser.close();
