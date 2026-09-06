// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ThemeControl from '../components/ThemeControl.jsx';
import { applyTheme, preferredTheme, THEMES, THEME_KEY } from '../theme.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
beforeEach(() => {
  localStorage.clear();
  applyTheme('dark');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('theme preference', () => {
  it('uses the system appearance until the reader chooses a theme', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    expect(preferredTheme()).toBe('light');
    applyTheme('dark', { persist: true });
    expect(preferredTheme()).toBe('dark');
  });

  it('ignores invalid saved preferences and invalid theme requests', () => {
    localStorage.setItem(THEME_KEY, 'invalid');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    expect(preferredTheme()).toBe('dark');
    applyTheme('invalid');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('switches every shared surface and persists a choice without remounting the page', () => {
    act(() => root.render(<><input aria-label="Existing search" defaultValue="Taiwan" /><ThemeControl /></>));
    const search = host.querySelector('input');
    for (const mode of ['light', 'dark']) {
      act(() => host.querySelector(`[aria-label="${mode === 'light' ? 'Light' : 'Dark'} theme"]`).click());
      expect(localStorage.getItem(THEME_KEY)).toBe(mode);
      expect(preferredTheme()).toBe(mode);
      expect(document.documentElement.style.colorScheme).toBe(mode);
      for (const [key, value] of Object.entries(THEMES[mode])) {
        expect(document.documentElement.style.getPropertyValue(`--${key}`)).toBe(value);
      }
      expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
      expect(host.querySelector('input')).toBe(search);
      expect(search.value).toBe('Taiwan');
    }
  });

  it('keeps the theme control in sync with changes in another tab', () => {
    act(() => root.render(<ThemeControl />));
    act(() => {
      localStorage.setItem(THEME_KEY, 'light');
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'light' }));
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(host.querySelector('[aria-label="Light theme"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('still switches when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    act(() => root.render(<ThemeControl />));
    act(() => host.querySelector('[aria-label="Light theme"]').click());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(host.querySelector('[aria-label="Light theme"]').getAttribute('aria-pressed')).toBe('true');
  });
});
