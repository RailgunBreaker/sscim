import { useLanguage } from '../i18n/useLanguage.js';
import { LANGUAGE_NAMES } from '../i18n/locale.js';
import { t } from '../i18n/index.js';
import { C } from '../theme.js';

export default function LanguagePicker() {
  const [language, setLanguage] = useLanguage();
  return <select aria-label={t('Language')} title={t('Language')} value={language}
    onChange={(event) => setLanguage(event.target.value)}
    style={{ minHeight: 36, maxWidth: '100%', background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 7, padding: '0 9px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>
    {Object.entries(LANGUAGE_NAMES).map(([code, label]) => <option key={code} value={code} lang={code === 'tw' ? 'zh-TW' : code}>{label}</option>)}
  </select>;
}
