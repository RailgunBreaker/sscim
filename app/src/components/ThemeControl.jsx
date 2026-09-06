import { t } from '../i18n/index.js';
import { useLanguage } from '../i18n/useLanguage.js';
import { useEffect, useState } from 'react';
import { applyTheme, preferredTheme, THEME_KEY } from '../theme.js';
import '../ui/appearance.css';

export default function ThemeControl() {
  useLanguage();
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || preferredTheme());
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme || preferredTheme());
    const storage = (event) => {
      if (event.key === THEME_KEY || event.key === null) applyTheme(preferredTheme());
    };
    window.addEventListener('sscim-theme-change', sync);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('sscim-theme-change', sync);
      window.removeEventListener('storage', storage);
    };
  }, []);
  return (
    <div className="theme-control" role="group" aria-label={t('Color theme')}>
      {['light', 'dark'].map((mode) => (
        <button key={mode} type="button" aria-label={t(mode === 'light' ? 'Light theme' : 'Dark theme')}
          aria-pressed={theme === mode} title={t(mode === 'light' ? 'Light theme' : 'Dark theme')}
          onClick={() => applyTheme(mode, { persist: true })}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {mode === 'light' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
              : <path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z" />}
          </svg>
          <span>{t(mode === 'light' ? 'Light' : 'Dark')}</span>
        </button>
      ))}
    </div>
  );
}
