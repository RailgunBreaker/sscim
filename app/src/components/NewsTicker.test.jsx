// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import NewsTicker from './NewsTicker.jsx';
import snapshot from '../data/vault-snapshot.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* The ticker is the first thing a visitor reads and it carries the "not
   investment advice" notice, so what is worth pinning down is: it shows real
   event rows newest-first, and the disclaimer is present and NOT part of the
   scrolling content (a disclaimer that animates out of view is not one). */

function mount(el) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(el); });
  return host;
}

describe('NewsTicker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline')))); // static-deploy path
  });

  const newest = [...snapshot.events].sort((a, b) => a.daysAgo - b.daysAgo)[0];

  it('renders headlines from the vault snapshot, newest first', () => {
    const host = mount(<NewsTicker />);
    const first = host.querySelector('.nt-item .nt-title');
    expect(first.textContent).toBe(newest.title);
  });

  it('keeps the disclaimer pinned outside the scrolling rail', () => {
    const host = mount(<NewsTicker />);
    expect(host.querySelector('.nt-label').textContent).toMatch(/not investment advice/i);
    expect(host.querySelector('.nt-rail').textContent).not.toMatch(/not investment advice/i);
  });

  it('duplicates the item list exactly once so the loop has no seam', () => {
    const host = mount(<NewsTicker />);
    const copies = host.querySelectorAll('.nt-rail > span');
    expect(copies.length).toBe(2);
    expect(copies[0].querySelectorAll('.nt-item').length).toBe(copies[1].querySelectorAll('.nt-item').length);
    expect(copies[1].getAttribute('aria-hidden')).toBe('true'); // screen readers hear it once
  });

  it('marks direction with a glyph, not colour alone', () => {
    const host = mount(<NewsTicker />);
    const marks = [...host.querySelectorAll('.nt-mark')].map((n) => n.textContent);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => ['▲', '▼', '–'].includes(m))).toBe(true);
  });


  it('cannot force the page wider than the viewport on a phone', () => {
    const host = mount(<NewsTicker />);
    const css = host.querySelector('style').textContent;
    // A flex item defaults to min-width:auto and refuses to shrink below its
    // content; the rail is thousands of pixels wide, so without this the strip
    // pushes the whole page sideways on a narrow screen.
    expect(css).toMatch(/\.nt-track\{[^}]*min-width:0/);
    expect(css).toMatch(/\.nt\{[^}]*overflow:hidden/);
  });

  it('keeps the rail copies from being squeezed instead of scrolling', () => {
    const host = mount(<NewsTicker />);
    const css = host.querySelector('style').textContent;
    expect(css).toMatch(/\.nt-copy\{[^}]*flex:none/);
    expect(css).toMatch(/\.nt-item\{[^}]*flex:none/);
    expect(css).toMatch(/\.nt-rail\{[^}]*width:max-content/);
  });

  it('stacks the label above the headlines on a narrow screen', () => {
    const host = mount(<NewsTicker />);
    const css = host.querySelector('style').textContent;
    expect(css).toContain('@media(max-width:640px)');
  });

  it('prefers live API events over the bundled snapshot when reachable', async () => {
    const live = [{ id: 'live_1', date: 'Aug 01, 2026', daysAgo: 0, title: 'Live headline from the API' }];
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(live) })));
    const host = mount(<NewsTicker />);
    await act(async () => { await Promise.resolve(); });
    expect(host.querySelector('.nt-item .nt-title').textContent).toBe('Live headline from the API');
  });
});
