// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { formatDate, LANGUAGE_KEY, getLanguage, normalizeLanguage, setLanguage } from './locale.js';
import { useLanguage } from './useLanguage.js';
import { t } from './index.js';
import { MESSAGES } from './messages.js';
import LanguagePicker from '../components/LanguagePicker.jsx';
import ThemeControl from '../components/ThemeControl.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => {
  localStorage.clear(); setLanguage('en');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); setLanguage('en');
});
function Screen() {
  useLanguage();
  return <><LanguagePicker /><h1>{t('Supply chain overview')}</h1><input defaultValue="TSMC" /><ThemeControl /></>;
}
describe('shared language support', () => {
  it('maps browser locale variants to the supported languages', () => {
    expect(['zh-Hans', 'zh-CN', 'zh-SG'].map(normalizeLanguage)).toEqual(['zh', 'zh', 'zh']);
    expect(['zh-Hant', 'zh-TW', 'zh-HK'].map(normalizeLanguage)).toEqual(['tw', 'tw', 'tw']);
    expect(normalizeLanguage('ja-JP')).toBe('ja');
    expect(normalizeLanguage('unknown')).toBeNull();
  });
  it('changes UI, document language, and persistence together without clearing user input', () => {
    act(() => root.render(<Screen />));
    const input = host.querySelector('input');
    for (const code of ['zh', 'tw', 'ja', 'en']) {
      act(() => {
        const select = host.querySelector('select'); select.value = code;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(getLanguage()).toBe(code);
      expect(localStorage.getItem(LANGUAGE_KEY)).toBe(code);
      expect(host.querySelector('h1').textContent).toBe(t('Supply chain overview'));
      expect(host.querySelector('input')).toBe(input);
      expect(input.value).toBe('TSMC');
      expect(host.querySelector('.theme-control').getAttribute('aria-label')).toBe(t('Color theme'));
    }
    act(() => setLanguage('tw'));
    expect(document.documentElement.lang).toBe('zh-TW');
  });
  it('keeps cross-tab changes in sync and works when storage is unavailable', () => {
    act(() => root.render(<Screen />));
    act(() => { localStorage.setItem(LANGUAGE_KEY, 'ja'); window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_KEY })); });
    expect(host.querySelector('select').value).toBe('ja');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    act(() => setLanguage('zh'));
    expect(host.querySelector('h1').textContent).toBe('供应链概览');
  });
  it('formats dates in the chosen locale and preserves English fallback and placeholders', () => {
    setLanguage('ja');
    expect(formatDate('2026-09-06')).toContain('2026');
    expect(formatDate('2026-09-06')).toContain('9');
    expect(t('Show {count} more', { count: 12 })).toBe('さらに12件表示');
    expect(t('Untranslated source title')).toBe('Untranslated source title');
    setLanguage('bad'); expect(getLanguage()).toBe('ja');
  });
  it('supplies all three translations with the same interpolation fields', () => {
    const fields = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, translations] of Object.entries(MESSAGES)) {
      expect(translations).toHaveLength(3);
      for (const translation of translations) {
        expect(translation.length, key).toBeGreaterThan(0);
        expect(fields(translation), key).toEqual(fields(key));
      }
    }
  });
});
