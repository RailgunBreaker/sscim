// Shared by React, SVG, map markers, and the public pages.
// Legacy copper names now represent a neutral interaction accent.
export const THEMES = {
  dark: {
    bg: '#111214', panel: '#191B1E', panel2: '#151719', raised: '#24272B',
    line: '#303338', control: '#43474E', copper: '#E4E7EB', copperDim: '#969DA7',
    red: '#F08080', amber: '#E1B360', green: '#72C6A1',
    text: '#F1F2F4', dim: '#B0B5BE', faint: '#969DA7', onAccent: '#17191C',
    selected: 'rgba(228,231,235,.08)', hover: 'rgba(228,231,235,.05)',
    logoFilter: 'grayscale(1) brightness(0) invert(1)', mapFilter: 'invert(1) grayscale(1) brightness(.85)',
    labelShadow: '0 1px 3px #000', overlay: '0 12px 36px rgba(0,0,0,.28)',
  },
  light: {
    bg: '#F5F6F7', panel: '#FFFFFF', panel2: '#EFF1F3', raised: '#E8EBEF',
    line: '#DDE0E4', control: '#B8BEC7', copper: '#252930', copperDim: '#58616E',
    red: '#B7353D', amber: '#886017', green: '#217250',
    text: '#1B1F25', dim: '#505A67', faint: '#606A77', onAccent: '#FFFFFF',
    selected: 'rgba(37,41,48,.06)', hover: 'rgba(37,41,48,.04)',
    logoFilter: 'grayscale(1) brightness(0)', mapFilter: 'grayscale(1)',
    labelShadow: '0 1px 3px #fff', overlay: '0 12px 36px rgba(24,32,44,.12)',
  },
};
export const C = Object.fromEntries(Object.keys(THEMES.dark).map((key) => [key, `var(--${key})`]));
export const THEME_KEY = 'sscim-theme';
export function preferredTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Storage may be disabled. */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
export function applyTheme(theme, { persist = false } = {}) {
  if (!Object.hasOwn(THEMES, theme) || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  for (const [key, value] of Object.entries(THEMES[theme])) root.style.setProperty(`--${key}`, value);
  if (persist) {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* Optional persistence. */ }
  }
  window.dispatchEvent(new Event('sscim-theme-change'));
}
if (typeof document !== 'undefined') applyTheme(preferredTheme());
