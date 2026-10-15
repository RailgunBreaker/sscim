/* ====================================================================
   theme.js — the raw palette. One file, imported by everything.

   WHY IT CHANGED. The old palette was navy (#0C111C, hue 218 at 25%
   saturation) with a copper accent (#C98A3F) and cream text (#E9E4D8).
   Two things were wrong with it, one cosmetic and one functional.

   The functional defect: copper (#C98A3F) and the `warning` state
   (#DFA83D) are the same hue eleven degrees apart. The accent — which
   marks links, selection, focus and every primary control — was the same
   colour as the signal for "this is deteriorating". On a risk instrument
   that is not a style problem, it is a misreading waiting to happen.

   The cosmetic defect: saturated navy plus copper plus cream is the
   default palette of every generated dashboard. It carries no meaning
   here; the project is not about copper.

   WHAT IT IS NOW. Near-neutral graphite surfaces (hue 207 at 8%
   saturation — a tenth of the old chroma), neutral off-white text, and a
   single low-chroma steel-blue accent that sits nowhere near red, amber
   or green. The principle: THE ONLY SATURATED COLOURS ON SCREEN ARE
   RISK. Structure, selection and chrome recede; the data does not.

   Every value is checked by src/ui/designSystem.test.jsx against WCAG AA
   on all three surfaces, so the palette cannot regress unnoticed.
   ==================================================================== */

/* Surfaces, back to front. Depth is background contrast, not shadow. */
const bg = '#101214';      // the page
const panel2 = '#15181B';  // sunken: inset lists, code, wells
const panel = '#1A1E22';   // a panel
const line = '#2A3036';    // a rule

/* The accent. Low chroma on purpose: it has to be visible without
   competing with the state colours, because it appears on every control
   and they appear only where there is something to report. */
const accent = '#7FA3D8';
const accentDim = '#4E6A96';

export const C = {
  bg, panel, panel2, line,

  /* `copper`/`copperDim` are the ACCENT, under their historical names.
     218 call sites across 44 files read `C.copper`, and renaming them in
     one pass would have been 218 opportunities to introduce a typo in
     files this change otherwise does not touch. New code should use
     `accent`; both names are the same value and always will be. */
  accent,
  accentDim,
  copper: accent,
  copperDim: accentDim,

  /* State. Reserved — never used for a series, a tier or decoration. */
  red: '#E05A52',
  amber: '#DFA83D',
  green: '#4FAE86',

  text: '#E8EAEC',
  dim: '#99A1AA',
  /* Non-essential metadata only, and still AA on every surface: "muted"
     must never mean "unreadable". The value this replaced (#5A6478)
     scored 2.89:1 on a panel while carrying essential 9-10px text, and
     the test suite refuses to let it come back. */
  faint: '#838C96',
};

/* The accent as channels, for the translucent washes a selected row uses.
   Written out so no file has to hard-code `rgba(127,163,216,…)` and then
   disagree with the palette the next time it moves. */
export const ACCENT_RGB = '127,163,216';
export const accentWash = (alpha) => `rgba(${ACCENT_RGB},${alpha})`;
