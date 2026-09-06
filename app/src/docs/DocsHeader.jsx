import ThemeControl from '../components/ThemeControl.jsx';
import LanguagePicker from '../components/LanguagePicker.jsx';
import { useLanguage } from '../i18n/useLanguage.js';
import { t } from '../i18n/index.js';
import './docs.css';

export default function DocsHeader({ root = '', reader = false }) {
  useLanguage();
  return <header className="docs-header"><div className="docs-bar">
    <a className="docs-brand" href={`${root}index.html`} aria-label="SSCIM home"><img src={`${root}sscim-logo.png`} alt="SSCIM" /></a>
    <span className="docs-section">{t('Documentation')}</span>
    <nav aria-label={t('Site navigation')}>
      <ThemeControl />
      <LanguagePicker />
      <a href={`${root}${reader ? 'docs.html' : 'index.html'}`}>{t(reader ? 'All documents' : 'Home')}</a>
      <a href={`${root}intro.html`}>{t('Guide')}</a>
      <a href={`${root}updates.html`}>{t('Updates')}</a>
      <a className="button fill" href={`${root}sscim-app.html`}>{t('Open dashboard')}</a>
    </nav>
  </div></header>;
}
