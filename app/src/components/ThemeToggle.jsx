import { useEffect, useState } from 'react';

/* ====================================================================
   ThemeToggle — dark field or paper, remembered.

   WHY ONLY HERE. The dashboard is an instrument: its map, flow graph and
   network graph are drawn for a dark field, and their tier ramps and
   state colours were validated against the dark surfaces. Those do not
   become correct by inverting a stylesheet, so the instrument stays dark.

   Documents are different. Sixty files of prose and mathematics is
   long-form reading, and long-form reading is easier on paper. So the
   documentation reader — the library and every generated document page —
   offers paper as a choice. DARK IS STILL THE DEFAULT, so moving between
   the dashboard and a document never flips the lights.

   The choice is stored under one key and applied by the inline bootstrap
   in each page's <head> (THEME_BOOTSTRAP in ui/css.js) before the first
   paint, so a reader who chose paper never sees a dark flash.
   ==================================================================== */

const KEY = 'sscim-theme';
const read = () => {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
};

export default function ThemeToggle({ className = 'btn btn-quiet btn-sm' }) {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* private mode: the page still renders */ }
  }, [theme]);

  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className={className}
      aria-pressed={theme === 'light'}
      /* The name says what pressing it DOES, which is what a screen-reader
         user needs; the visible glyph shows where you would go. */
      aria-label={`Switch to ${next === 'light' ? 'paper' : 'dark'} reading theme`}
      title={`Switch to ${next === 'light' ? 'paper' : 'dark'} reading theme`}
      onClick={() => setTheme(next)}
    >
      <span aria-hidden="true">{theme === 'light' ? '◐' : '◑'}</span>
      <span className="sr">{theme === 'light' ? 'Paper theme is on' : 'Dark theme is on'}</span>
    </button>
  );
}
