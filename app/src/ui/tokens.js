/* ====================================================================
   tokens.js — the semantic vocabulary the interface is built from.

   theme.js holds the raw palette and stays as it is, because fifty files
   import `C` from it. This adds a layer of MEANING on top: components ask
   for `text.muted` or `state.adverse`, not for `#99A1AA`. A colour with a
   name can be reasoned about and audited; a hex literal repeated across
   forty files cannot.

   The palette itself lives in theme.js and is documented there. What
   this file adds is the vocabulary: `raised`, `selected`, `control` and
   the washes are DERIVED from the accent rather than typed, so moving
   the accent moves them too.
   ==================================================================== */
import { C, accentWash } from '../theme.js';
import { FONT_SANS, FONT_MONO, FONT_TEXT } from './css.js';

/* ---------------------------------------------------------------- colour */

export const color = {
  /* Surfaces, from furthest back to nearest front. Depth is expressed by
     background contrast, so that structure does not need a border. */
  surface: {
    page: C.bg,
    sunken: C.panel2,
    panel: C.panel,
    raised: '#21262B',
    /* A wash for a selected or active row: readable, and not a box. */
    selected: accentWash(0.14),
    hover: 'rgba(255,255,255,.04)',
  },

  text: {
    primary: C.text,
    secondary: C.dim,
    /* Non-essential metadata ONLY. Still AA-compliant, because "muted"
       must never mean "unreadable". */
    muted: C.faint,
    /* On a copper fill. */
    onAccent: '#101214',
    accent: C.copper,
  },

  /* What a number MEANS, never what colour it is. A reader who cannot
     distinguish these still gets the meaning, because every use pairs the
     colour with a word or a shape. */
  state: {
    adverse: C.red,
    warning: C.amber,
    mitigating: C.green,
    neutral: C.dim,
    accent: C.copper,
  },

  border: {
    /* Structure inside a panel: dividers, table rules. */
    subtle: C.line,
    /* The single boundary of a panel. */
    default: C.line,
    /* An interactive control at rest. */
    control: '#353C44',
    /* Selection, focus, and things the reader is acting on. */
    strong: C.copper,
  },

  focus: C.copper,
};

/* ------------------------------------------------------------- spacing */

/* A 4px base. Anything not on this scale is an accident. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/* ---------------------------------------------------------- typography */

/* The stacks live in css.js, which is also where the stylesheet that
   every page loads declares them as custom properties. One home. */

/* WHY THESE SIZES. Essential content was routinely set at 9-11px with
   1-2px of letter-spacing, which reads as a debug overlay rather than a
   document. The floor for anything a user must read is 12px, and 11px is
   reserved for annotations inside a graph, where the label competes with
   the drawing for space and the drawing wins. */
export const font = {
  /* One family. The old `.mono` class named a monospace font and then set
     a sans-serif, which is why numbers never aligned. Tabular figures are
     what was actually wanted, and they are a font FEATURE, not a family. */
  sans: FONT_SANS,
  /* Real monospace, for content that behaves like code: identifiers,
     digests, file paths. Not for numbers — those get tabular figures. */
  mono: FONT_MONO,
  /* Long-form reading only — the documentation reader and the guide. A
     text face rather than a UI face, and it is the same family KaTeX sets
     its math in, so prose and equations stop looking like two documents
     spliced together. */
  text: FONT_TEXT,

  size: {
    display: 30,   // landing hero only
    title: 20,     // page or major section title
    heading: 16,   // panel heading
    body: 14,      // primary content
    secondary: 13, // supporting content
    meta: 12,      // metadata, captions, timestamps
    annotation: 11, // graph labels ONLY, where space is genuinely constrained
  },

  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },

  leading: { tight: 1.25, normal: 1.45, relaxed: 1.6 },

  /* Letter-spacing is a last resort. The only legitimate use left is a
     short eyebrow label, and even there it is 0.06em, not 2px. */
  tracking: { normal: 0, eyebrow: '.06em' },
};

/* Numbers that are compared down a column must not jitter. */
export const tabular = { fontVariantNumeric: 'tabular-nums' };

/* ------------------------------------------------------------- shape */

export const radius = { sm: 4, md: 6, lg: 10, pill: 999 };

/* One height per control class, so that a row of mixed controls lines up
   without anyone nudging padding. 32px is the desktop control; 44px is the
   minimum touch target and is applied at small viewports. */
export const control = { sm: 26, md: 32, lg: 38, touch: 44 };

/* Used almost nowhere. A shadow on a dark interface reads as haze, not
   elevation. Reserved for things that genuinely float above the page. */
export const shadow = {
  none: 'none',
  overlay: '0 10px 34px rgba(0,0,0,.5)',
};

/* A focus ring must be visible against every surface, and must not be
   removed. This is the single definition. */
export const focusRing = {
  outline: `2px solid ${color.focus}`,
  outlineOffset: '2px',
};

/* ------------------------------------------------------- composed text */

/* Ready-made style objects for the four levels of the hierarchy the
   interface is supposed to express: what the answer is, what you can do,
   what supports it, and what qualifies it. */
export const typeStyle = {
  title: { fontSize: font.size.title, fontWeight: font.weight.semibold, lineHeight: font.leading.tight, color: color.text.primary, letterSpacing: 0 },
  heading: { fontSize: font.size.heading, fontWeight: font.weight.semibold, lineHeight: font.leading.tight, color: color.text.primary, letterSpacing: 0 },
  body: { fontSize: font.size.body, fontWeight: font.weight.regular, lineHeight: font.leading.normal, color: color.text.primary },
  secondary: { fontSize: font.size.secondary, fontWeight: font.weight.regular, lineHeight: font.leading.normal, color: color.text.secondary },
  meta: { fontSize: font.size.meta, fontWeight: font.weight.regular, lineHeight: font.leading.normal, color: color.text.muted },
  /* The one place letter-spacing survives: a short label above a section,
     in sentence case, never a shouted sentence. */
  eyebrow: { fontSize: font.size.meta, fontWeight: font.weight.semibold, letterSpacing: font.tracking.eyebrow, textTransform: 'uppercase', color: color.text.muted },
  number: { ...tabular, fontWeight: font.weight.semibold, color: color.text.primary },
};

export default { color, space, font, radius, control, shadow, focusRing, typeStyle, tabular };
