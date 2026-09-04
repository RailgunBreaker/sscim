/* ====================================================================
   screenshots.mjs — a deterministic visual record of the product.

   Distinct from browser-smoke.mjs, which ASSERTS. This one only LOOKS:
   it drives the built artifact to a fixed set of states at a fixed set
   of viewports and writes a PNG for each. A redesign is judged by
   opening these, not by reading a green test line — a suite can pass
   while every heading is unreadable.

   Determinism. Animation, transition and caret blink are disabled
   before capture, the same navigation and settle sequence runs for
   every scene, and no scene depends on live API data (the built app
   falls back to its bundled snapshot, which is what the harness
   exercises). Two runs over one build produce the same images.

   Run:  npm run shots                    write into docs/screenshots/after
         npm run shots -- --phase before  write into docs/screenshots/before
         npm run shots -- --only landing  a single scene
   ==================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', 'dist-app');

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PHASE = arg('--phase', 'after');
const ONLY = arg('--only', null);
const outDir = path.resolve(here, '..', '..', 'docs', 'screenshots', PHASE);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.md': 'text/markdown',
};

/* The landing hero's product shot. */
const HERO_SHOT = {
  viewport: '1366x936',
  path: path.resolve(here, '..', 'public', 'product-dashboard.png'),
};

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1366x936', width: 1366, height: 936 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

/* Every scene is captured at every viewport unless it names its own, so
   that a layout collapse cannot hide between two sizes. */
const SCENES = [
  { id: 'landing', page: 'index.html', what: 'Landing page' },
  { id: 'dashboard', page: 'sscim-app.html', what: 'Default dashboard' },
  { id: 'events', page: 'sscim-app.html', hash: '#view=geographic', tab: 'events', what: 'Events view' },
  { id: 'network', page: 'sscim-app.html', hash: '#view=topology', what: 'Network view' },
  { id: 'playground-start', page: 'sscim-app.html', hash: '#view=playground', what: 'Facility Playground, initial state' },
  { id: 'playground-tsmc-3hop', page: 'sscim-app.html', hash: '#view=playground&fac=tsmc_fab18&facd=3', what: 'Facility Playground, TSMC Fab 18 at three hops' },
  { id: 'mobile-facility-detail', page: 'sscim-app.html', hash: '#view=playground&fac=tsmc_fab18', viewports: ['375x812'], what: 'Mobile facility selection and detail' },
];

/* Anything that moves makes two captures of the same state differ. */
const FREEZE = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  .sscim-flow, [class*="flow"] { animation: none !important; }
`;

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
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

async function launch() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  for (const channel of ['msedge', 'chrome', 'chromium']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* next */ }
  }
  return chromium.launch({ headless: true });
}

let nav = 0;
async function capture(browser, vp, scene) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', () => {});
  page.on('pageerror', () => {});

  nav += 1;
  const url = `${base}/${scene.page}?shot=${nav}${scene.hash ?? ''}`;
  await page.goto(url, { waitUntil: 'load' });

  /* The landing page has no footer gate; the dashboard renders one once
     the vault resolves, live or from the bundled snapshot. */
  if (scene.page === 'sscim-app.html') {
    await page.waitForSelector('footer', { timeout: 30000 }).catch(() => {});
  }
  await page.addStyleTag({ content: FREEZE });

  if (scene.tab) {
    await page.getByRole('tab', { name: new RegExp(scene.tab, 'i') }).first().click({ timeout: 5000 }).catch(() => {});
  }

  /* One settle window for layout, fonts and the graph's first paint. */
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);

  const file = path.join(outDir, `${scene.id}-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: false });

  /* The landing page shows a REAL screenshot of the dashboard, so that
     image has to be the real dashboard rather than a mock-up that drifts
     away from the product. It is captured by the same run that captures
     the record, and written into app/public/ where the build picks it up.
     One capture, two uses: the page cannot show a stale product. */
  if (scene.id === 'dashboard' && vp.name === HERO_SHOT.viewport) {
    fs.mkdirSync(path.dirname(HERO_SHOT.path), { recursive: true });
    await page.screenshot({ path: HERO_SHOT.path, fullPage: false });
  }

  /* Horizontal overflow is the defect most easily missed in a still, so
     it is measured while the page is open rather than eyeballed later. */
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  await context.close();
  return { file: path.relative(path.resolve(here, '..', '..'), file), overflow };
}

let base;
async function main() {
  if (!fs.existsSync(path.join(root, 'sscim-app.html'))) {
    console.error(`No build found at ${root}. Run "npm run build" first.`);
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const { server, port } = await serve();
  base = `http://127.0.0.1:${port}`;
  const browser = await launch();
  const written = [];
  const overflows = [];

  console.log(`SSCIM screenshots — phase "${PHASE}" → docs/screenshots/${PHASE}/`);
  try {
    for (const scene of SCENES) {
      if (ONLY && scene.id !== ONLY) continue;
      const vps = VIEWPORTS.filter((v) => !scene.viewports || scene.viewports.includes(v.name));
      for (const vp of vps) {
        const { file, overflow } = await capture(browser, vp, scene);
        written.push(file);
        if (overflow > 0) overflows.push(`${scene.id} @ ${vp.name}: ${overflow}px`);
        console.log(`  ${scene.id.padEnd(24)} ${vp.name.padEnd(10)} ${overflow > 0 ? `OVERFLOW ${overflow}px` : 'ok'}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${written.length} screenshot(s) written to docs/screenshots/${PHASE}/`);
  if (overflows.length) {
    console.log('\nHorizontal overflow observed:');
    overflows.forEach((o) => console.log(`  ${o}`));
  } else {
    console.log('No horizontal page overflow at any captured viewport.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
