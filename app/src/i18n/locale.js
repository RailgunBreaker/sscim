export const LANGUAGE_KEY = 'sscim-language';
export const LOCALES = { en: 'en-US', zh: 'zh-CN', tw: 'zh-TW', ja: 'ja-JP' };
export const LANGUAGE_NAMES = { en: 'English', zh: '简体中文', tw: '繁體中文', ja: '日本語' };
export function normalizeLanguage(value) {
  const tag = String(value || '').replace('_', '-').toLowerCase();
  if (tag === 'tw' || /^zh-(tw|hk|mo|hant)(-|$)/.test(tag)) return 'tw';
  if (/^zh(-|$)/.test(tag)) return 'zh';
  if (/^ja(-|$)/.test(tag)) return 'ja';
  if (/^en(-|$)/.test(tag)) return 'en';
  return null;
}
function preferredLanguage() {
  try {
    const saved = normalizeLanguage(window.localStorage.getItem(LANGUAGE_KEY));
    if (saved) return saved;
  } catch { /* Browser storage is optional. */ }
  return typeof navigator === 'undefined' ? 'en' : normalizeLanguage(navigator.language) || 'en';
}
let language = preferredLanguage();
const listeners = new Set();
export const getLanguage = () => language;
export const subscribeLanguage = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function setLanguage(value, { persist = true } = {}) {
  const next = normalizeLanguage(value);
  if (!next) return;
  language = next;
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALES[next];
  if (persist) {
    try { window.localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Keep the in-memory choice. */ }
  }
  listeners.forEach((listener) => listener());
}
if (typeof window !== 'undefined') {
  setLanguage(language, { persist: false });
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_KEY || event.key === null) setLanguage(preferredLanguage(), { persist: false });
  });
}
export function formatDate(value, options = {}) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(LOCALES[language], { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC', ...options }).format(date) : String(value);
}

export function countryName(code, fallback = code) {
  if (language === 'en') return fallback;
  try { return new Intl.DisplayNames([LOCALES[language]], { type: 'region' }).of(String(code).toUpperCase()) || fallback; }
  catch { return fallback; }
}
