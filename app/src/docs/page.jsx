import React from 'react';
import { createRoot } from 'react-dom/client';
import DocsHeader from './DocsHeader.jsx';
import { formatDate, subscribeLanguage } from '../i18n/locale.js';
import { t } from '../i18n/index.js';

const header = document.getElementById('doc-header');
createRoot(header).render(<DocsHeader root={header.dataset.root} reader />);
const localize = () => {
  document.querySelectorAll('[data-doc-label]').forEach((element) => { element.textContent = t(element.dataset.docLabel); });
  document.querySelectorAll('.doc-modified time').forEach((element) => { element.textContent = formatDate(element.dateTime); });
};
subscribeLanguage(localize);
localize();
