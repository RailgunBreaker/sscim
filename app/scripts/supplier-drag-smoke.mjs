import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.PREVIEW_URL || 'http://127.0.0.1:5173'}/sscim-app.html`);
  await page.getByRole('radio', { name: 'Network', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find a system company' }).fill('NVIDIA');
  await page.getByRole('button', { name: 'NVIDIA', exact: true }).click();
  const node = page.locator('.stg-node').filter({ has: page.locator('title', { hasText: /^NVIDIA\n/ }) });
  const dot = node.locator('.stg-dot');
  await dot.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const positions = () => page.locator('.stg-node').evaluateAll(nodes => nodes.map(n => {
    const d = n.querySelector('.stg-dot');
    return { x: +d.getAttribute('cx'), y: +d.getAttribute('cy') };
  }));
  const box = await dot.boundingBox();
  const viewBox = await page.locator('.stg-surface').getAttribute('viewBox');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2 + 60, { steps: 12 });
  const held = await dot.evaluate(d => [d.getAttribute('cx'), d.getAttribute('cy')]);
  const during = await positions();
  await page.waitForTimeout(350);
  const following = await positions();
  const moved = following.filter((p, i) => Math.hypot(p.x - during[i].x, p.y - during[i].y) > 0.1).length;
  assert(moved > 1, 'Other nodes must move while the pointer is held still during a drag');
  assert.deepEqual(await dot.evaluate(d => [d.getAttribute('cx'), d.getAttribute('cy')]), held,
    'The dragged node must remain pinned under the pointer');
  assert.equal(await page.locator('.stg-surface').getAttribute('viewBox'), viewBox, 'Dragging must not refit the camera');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Release all 1 pinned firms' }).waitFor();
  await page.waitForTimeout(1800);
  const settled = await positions();
  await page.waitForTimeout(200);
  assert.deepEqual(await positions(), settled, 'Animation must stop after settling');
  assert.deepEqual(errors, []);
  console.log(`PASS: ${moved} other nodes animated during drag; pin, camera and settling verified.`);
} finally {
  await browser.close();
}
