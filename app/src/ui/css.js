/* ====================================================================
   css.js — ONE stylesheet, shared by every page of the site.

   WHY THIS EXISTS. There were five separate `const STYLE = ...` blocks,
   one per page, each re-declaring the palette with slightly different
   values: the documentation library set `--dim` to #A5AEC0 while the
   landing page set it to #8C96A8 and the guide set `--faint` to a value
   that failed contrast. Five copies of a design system is not a design
   system, it is five designs that happen to share a logo.

   Everything below is imported by the React pages AND by the Node script
   that generates the documentation pages, so the static documents and the
   application cannot drift apart.

   THE RULES THIS ENCODES
     1. Hierarchy comes from size and weight. Not from colour, and not
        from shouting: there is exactly one all-caps style in the whole
        system (`.eyebrow`) and it is used perhaps four times.
     2. One accent, used for links, selection and focus — nothing else.
        The saturated colours belong to the data.
     3. A border means something: a boundary, a selection, a warning. It
        is never decoration, and nothing is a box inside a box.
     4. Nothing moves on hover. A control changes shade; it does not lift,
        glow, or slide. Lift-and-glow is what makes a page read as an
        advertisement for software rather than as software.
     5. Long-form prose is set in a text face at a reading measure. The
        interface is set in a UI face. They are different jobs.
   ==================================================================== */
import { C } from '../theme.js';

/* ------------------------------------------------------------- stacks */

export const FONT_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = 'ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Mono", Consolas, "Liberation Mono", monospace';
/* A real text face for documents. Nothing is downloaded: every name here
   ships with macOS or Windows, and KaTeX sets its maths in a serif, so
   prose and equations finally belong to the same document. */
export const FONT_TEXT = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, Georgia, "Times New Roman", serif';

/* -------------------------------------------------------------- themes

   The instrument is dark: it is read in a room with other screens, and
   the map and graphs are drawn for a dark field. The documentation reader
   offers PAPER as well, because sixty documents of prose and mathematics
   is long-form reading and long-form reading is easier on paper. Dark
   remains the default everywhere, so moving between pages never flashes.
   ------------------------------------------------------------------- */

const DARK = `
  --page:      ${C.bg};
  --sunken:    ${C.panel2};
  --panel:     ${C.panel};
  --raised:    #21262B;
  --rule:      ${C.line};
  --rule-soft: #22272C;
  --control:   #353C44;

  --ink:       ${C.text};
  --ink-2:     ${C.dim};
  --ink-3:     ${C.faint};

  --accent:    ${C.accent};
  --accent-dim:${C.accentDim};
  --on-accent: ${C.bg};
  --wash:      rgba(127,163,216,.14);
  --wash-soft: rgba(127,163,216,.07);
  --hover:     rgba(255,255,255,.04);

  --adverse:   ${C.red};
  --warning:   ${C.amber};
  --mitigating:${C.green};

  --code-bg:   #0B0D0F;
  --code-ink:  #C9D4DE;
  --shadow:    0 10px 34px rgba(0,0,0,.5);
  color-scheme: dark;
`;

/* Paper. Not white — #FBFAF8 is a warm near-white that stops the page
   glaring, and the ink is #1C1F23 rather than black for the same reason.
   The accent darkens to #2C5B96 so it still carries 6.6:1 on paper. */
const LIGHT = `
  --page:      #FBFAF8;
  --sunken:    #F3F1EC;
  --panel:     #FFFFFF;
  --raised:    #FFFFFF;
  --rule:      #DFDBD3;
  --rule-soft: #EBE8E1;
  --control:   #CFCAC1;

  --ink:       #1C1F23;
  --ink-2:     #4C535B;
  --ink-3:     #6E767F;

  --accent:    #2C5B96;
  --accent-dim:#7C94B4;
  --on-accent: #FFFFFF;
  --wash:      rgba(44,91,150,.10);
  --wash-soft: rgba(44,91,150,.05);
  --hover:     rgba(0,0,0,.035);

  --adverse:   #B5362C;
  --warning:   #8A5A08;
  --mitigating:#1F6E4E;

  --code-bg:   #F6F4EF;
  --code-ink:  #2B3138;
  --shadow:    0 10px 30px rgba(28,31,35,.12);
  color-scheme: light;
`;

/* ------------------------------------------------------------- tokens */

const TOKENS = `
  --sans: ${FONT_SANS};
  --mono: ${FONT_MONO};
  --text: ${FONT_TEXT};

  /* A real scale. The old interface used 9.5, 10.5, 11.5, 12.5, 13.5 and
     14.5px, which is not a scale, it is an accumulation. */
  --t-meta: 12px; --t-small: 13px; --t-body: 14px; --t-lede: 16px;
  --t-h4: 15px;  --t-h3: 18px;  --t-h2: 21px;  --t-h1: 26px;  --t-display: 34px;

  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;
  --r1: 4px; --r2: 6px; --r3: 10px;

  /* The reading measure. 68 characters, which is the width a line of
     prose can be before the eye loses the start of the next one. */
  --measure: 68ch;
  --shell: 1200px;
`;

/* --------------------------------------------------------------- base */

export const BASE_CSS = `
:root{${TOKENS}${DARK}}
:root[data-theme="light"]{${LIGHT}}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--page);color:var(--ink);
  font-family:var(--sans);font-size:var(--t-body);line-height:1.55;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  font-synthesis-weight:none;
}
h1,h2,h3,h4,h5,h6,p,figure,blockquote,dl,dd{margin:0}
/* Letter-spacing is a last resort; headings get none. The old pages set
   -0.8px on a 40px heading and +2px on a 9.5px label, which is backwards
   in both directions. */
h1,h2,h3,h4{font-weight:600;line-height:1.2;letter-spacing:-.011em;color:var(--ink)}
ul,ol{margin:0;padding:0}
img,svg{max-width:100%}
button,input,select,textarea{font:inherit;color:inherit}
hr{border:0;border-top:1px solid var(--rule);margin:var(--s5) 0}
::selection{background:var(--wash);color:var(--ink)}

a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:2px}

/* ONE focus definition, broad on purpose. A control a keyboard cannot
   find is a control that does not exist. */
:is(a,button,input,select,textarea,summary,[tabindex],[role="tab"],[role="radio"],[role="option"]):focus-visible{
  outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r1);
}

::-webkit-scrollbar{width:9px;height:9px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--control);border-radius:9px;border:2px solid var(--page)}
::-webkit-scrollbar-thumb:hover{background:var(--ink-3)}

/* ------------------------------------------------------- typography */

.shell{max-width:var(--shell);margin:0 auto;padding:0 var(--s5)}
.narrow{max-width:860px;margin:0 auto;padding:0 var(--s5)}
.measure{max-width:var(--measure)}

.display{font-size:var(--t-display);font-weight:600;line-height:1.1;letter-spacing:-.02em}
.h1{font-size:var(--t-h1)}.h2{font-size:var(--t-h2)}.h3{font-size:var(--t-h3)}.h4{font-size:var(--t-h4)}
.lede{font-size:var(--t-lede);line-height:1.6;color:var(--ink-2)}
.small{font-size:var(--t-small);color:var(--ink-2)}
.meta{font-size:var(--t-meta);color:var(--ink-3);line-height:1.5}
/* Numbers compared down a column must not jitter. Historically this class
   was called .mono and named a monospace family it never set; tabular
   figures are a font FEATURE, which is what every call site wanted. */
.tnum,.mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
.code{font-family:var(--mono);font-size:var(--t-meta)}
/* The only all-caps style in the system. */
.eyebrow{font-size:var(--t-meta);font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}

/* ---------------------------------------------------------- controls */

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:var(--s2);
  min-height:36px;padding:0 var(--s4);border-radius:var(--r2);
  border:1px solid var(--control);background:transparent;color:var(--ink);
  font-size:var(--t-small);font-weight:500;line-height:1;
  cursor:pointer;text-decoration:none;white-space:nowrap;
}
.btn:hover{background:var(--hover);text-decoration:none}
.btn-primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:600}
.btn-primary:hover{background:var(--accent);filter:brightness(1.07)}
.btn-quiet{border-color:transparent;color:var(--ink-2)}
.btn-quiet:hover{color:var(--ink)}
.btn-sm{min-height:30px;padding:0 var(--s3);font-size:var(--t-meta)}
.btn:disabled{cursor:not-allowed;opacity:.45}

.field{
  width:100%;min-height:36px;padding:0 var(--s3);
  background:var(--sunken);border:1px solid var(--control);border-radius:var(--r2);
  color:var(--ink);font-size:var(--t-small);
}
.field::placeholder{color:var(--ink-3)}
.field:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--wash-soft)}

/* A filter is a toggle, so it reports its own state rather than relying on
   the reader to remember which ones they pressed. */
.chip{
  display:inline-flex;align-items:center;gap:6px;
  min-height:30px;padding:0 var(--s3);border-radius:var(--r2);
  border:1px solid var(--control);background:transparent;color:var(--ink-2);
  font-size:var(--t-meta);cursor:pointer;white-space:nowrap;
}
.chip:hover{background:var(--hover);color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--wash);border-color:var(--accent);color:var(--ink);font-weight:600}
.chip .n{font-variant-numeric:tabular-nums;color:var(--ink-3);font-weight:400}
.chip[aria-pressed="true"] .n{color:var(--accent)}

/* A segmented control: one choice from a set of peers. */
.seg{display:inline-flex;background:var(--sunken);border:1px solid var(--control);border-radius:var(--r2);padding:2px;gap:2px;max-width:100%;overflow-x:auto}
.seg button{
  min-height:28px;padding:0 var(--s3);border:0;border-radius:var(--r1);
  background:transparent;color:var(--ink-2);font-size:var(--t-meta);cursor:pointer;white-space:nowrap;
}
.seg button:hover{color:var(--ink)}
.seg button[aria-checked="true"],.seg button[aria-pressed="true"]{background:var(--accent);color:var(--on-accent);font-weight:600}

/* ------------------------------------------------------------ surfaces */

/* ONE boundary. Structure inside a panel comes from dividers and
   background contrast, never from a second box drawn inside the first. */
.panel{background:var(--panel);border:1px solid var(--rule);border-radius:var(--r3)}
.sunken{background:var(--sunken);border:1px solid var(--rule);border-radius:var(--r3)}

/* An aside the reader must not skip. A rule on the left, not a coloured
   box: a box says "advertisement", a rule says "note". */
.note{border-left:2px solid var(--accent-dim);padding:var(--s2) 0 var(--s2) var(--s4);color:var(--ink-2);font-size:var(--t-small);line-height:1.6}
.note-warn{border-left-color:var(--warning)}
.note strong,.note b{color:var(--ink)}

/* ----------------------------------------------------------- header */

.site-head{position:sticky;top:0;z-index:20;background:var(--page);border-bottom:1px solid var(--rule)}
@supports (backdrop-filter:blur(8px)){
  .site-head{background:color-mix(in srgb, var(--page) 86%, transparent);backdrop-filter:blur(10px)}
}
.site-head .bar{display:flex;align-items:center;gap:var(--s4);min-height:56px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:var(--s2);flex-shrink:0;text-decoration:none}
.brand img{display:block;width:84px;height:auto}
/* The logo is black artwork. On a dark field it is inverted; on paper it
   is left alone — the old rule inverted it unconditionally, which is why
   it would have vanished the moment the page went light. */
:root:not([data-theme="light"]) .brand img{filter:grayscale(1) brightness(0) invert(1)}
.site-nav{display:flex;align-items:center;gap:var(--s4);margin-left:auto;flex-wrap:wrap}
/* The :not(.btn) matters. Without it this rule out-specifies .btn-primary
   — .site-nav a is (0,1,1) against (0,1,0) — and repaints the one primary
   action in the header in muted ink ON the accent fill, which is how the
   "Open dashboard" button came out unreadable. */
.site-nav a:not(.btn){font-size:var(--t-small);color:var(--ink-2)}
.site-nav a:not(.btn):hover{color:var(--ink);text-decoration:none}
.site-nav a:not(.btn)[aria-current="page"]{color:var(--ink);font-weight:600}

/* Breadcrumbs instead of a shouted section label. "DOCUMENTATION
   LIBRARY" in 10.5px caps told the reader what they could already see;
   a crumb trail tells them where they are and lets them leave. */
.crumbs{display:flex;align-items:center;gap:var(--s2);font-size:var(--t-meta);color:var(--ink-3);min-width:0}
.crumbs a{color:var(--ink-3)}
.crumbs a:hover{color:var(--ink)}
.crumbs .sep{opacity:.5}
.crumbs .here{color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* On a phone the bar wrapped to four rows — brand, crumbs, links, button —
   and stayed stuck there, costing about a quarter of an 812px viewport on
   every document. Below 760px the crumbs drop to their own line and keep
   only the last step, and below 640px the secondary links go (they are in
   the mobile document tree and the site map at the foot of every page),
   leaving one row of brand, theme and the primary action. */
@media(max-width:760px){
  .site-head .bar{min-height:52px;gap:var(--s3);row-gap:0}
  .crumbs{order:3;width:100%;padding-bottom:var(--s2)}
  .crumbs a:not(:first-child),.crumbs .sep:first-of-type ~ .sep{display:none}
  .site-nav{gap:var(--s3)}
}
@media(max-width:640px){
  .site-nav a:not(.btn){display:none}
  .brand img{width:72px}
}

/* ------------------------------------------------------------- prose

   Long-form reading: a text face, 17px, 1.7 leading, 68 characters. The
   old reader set 15px Inter at 1.68 across a 1000px column, which is
   roughly 120 characters a line — about twice what the eye tracks.
   ------------------------------------------------------------------- */

.prose{font-family:var(--text);font-size:17px;line-height:1.72;color:var(--ink);max-width:var(--measure)}
.prose > * + *{margin-top:1.05em}
.prose h1,.prose h2,.prose h3,.prose h4{font-family:var(--sans);letter-spacing:-.012em;scroll-margin-top:84px}
.prose h1{font-size:var(--t-h1);margin-top:1.8em}
.prose h2{font-size:var(--t-h2);margin-top:2.1em;padding-bottom:.35em;border-bottom:1px solid var(--rule)}
.prose h3{font-size:var(--t-h3);margin-top:1.8em}
.prose h4{font-size:var(--t-h4);margin-top:1.5em;color:var(--ink-2)}
.prose strong{font-weight:600}
.prose em{font-style:italic}
.prose ul,.prose ol{padding-left:1.35em}
.prose li{margin-top:.35em}
.prose li::marker{color:var(--ink-3)}
.prose blockquote{border-left:2px solid var(--accent-dim);padding-left:var(--s4);color:var(--ink-2);font-style:normal}
.prose a{text-decoration:underline;text-underline-offset:2px;text-decoration-color:var(--accent-dim)}
.prose a:hover{text-decoration-color:var(--accent)}
.prose code{font-family:var(--mono);font-size:.84em;background:var(--sunken);border:1px solid var(--rule-soft);border-radius:var(--r1);padding:.1em .34em;color:var(--code-ink)}
.prose pre{background:var(--code-bg);border:1px solid var(--rule);border-radius:var(--r2);padding:var(--s4);overflow:auto;max-width:none}
.prose pre code{background:none;border:0;padding:0;font-size:13px;line-height:1.6;color:var(--code-ink)}
.prose hr{margin:2.4em 0}
.prose img{border-radius:var(--r2);border:1px solid var(--rule)}

/* Tables are data. Hairline rules under rows, no vertical lines, no
   boxes: a grid of 1px borders in both directions reads as a spreadsheet
   screenshot. Set in the UI face with tabular figures, because the
   columns are compared and the prose face is not for comparing. */
.prose table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:var(--t-small);font-variant-numeric:tabular-nums;max-width:none;display:block;overflow-x:auto}
.prose thead th{text-align:left;font-weight:600;color:var(--ink);border-bottom:1px solid var(--control);padding:var(--s2) var(--s3);white-space:nowrap}
.prose tbody td{border-bottom:1px solid var(--rule-soft);padding:var(--s2) var(--s3);vertical-align:top;color:var(--ink-2)}
.prose tbody tr:last-child td{border-bottom:0}

/* A heading you can link to. The anchor appears on hover and on focus,
   and is hidden from assistive technology, which already has the
   heading. */
.prose :is(h2,h3,h4){position:relative}
.prose .anchor{position:absolute;left:-1.1em;top:0;width:1em;text-align:center;opacity:0;color:var(--ink-3);text-decoration:none;font-family:var(--sans);font-weight:400}
.prose :is(h2,h3,h4):hover .anchor,.prose .anchor:focus-visible{opacity:1}
@media(max-width:1100px){.prose .anchor{display:none}}

.katex{font-size:1.02em}
.katex-display{overflow-x:auto;overflow-y:hidden;padding:2px 0}
.math-error{color:var(--warning)}

/* -------------------------------------------------------------- misc */

.row{display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap}
.spread{display:flex;align-items:center;gap:var(--s3);justify-content:space-between;flex-wrap:wrap}
.bare{list-style:none;margin:0;padding:0}
.rule-top{border-top:1px solid var(--rule)}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

@media (max-width:640px){
  .shell,.narrow{padding:0 var(--s4)}
  /* 44px is the floor for a finger. */
  .btn,.chip,.field{min-height:44px}
  .seg button{min-height:38px}
  .prose{font-size:16px}
}
@media (prefers-reduced-motion:reduce){
  *{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;scroll-behavior:auto !important}
}
`;

/* The site footer, identical on every page. */
export const FOOT_CSS = `
.site-foot{border-top:1px solid var(--rule);margin-top:var(--s8);padding:var(--s6) 0 var(--s7);background:var(--sunken)}
.site-foot h2{font-size:var(--t-meta);font-weight:600;color:var(--ink);margin-bottom:var(--s3)}
.site-foot .cols{display:grid;gap:var(--s5);grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.site-foot li+li{margin-top:var(--s3)}
.site-foot a{font-size:var(--t-small);display:block}
.site-foot small{display:block;font-size:var(--t-meta);color:var(--ink-3);line-height:1.45;margin-top:2px}
.site-foot .fine{margin-top:var(--s5);padding-top:var(--s4);border-top:1px solid var(--rule);font-size:var(--t-meta);color:var(--ink-3);line-height:1.7;max-width:90ch}
`;

/* Remember the reader's choice of paper or dark, and apply it before the
   first paint so the page never flashes the wrong one. Inlined into the
   <head> of the generated documentation pages and the docs shell. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('sscim-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default { BASE_CSS, FOOT_CSS, THEME_BOOTSTRAP, FONT_SANS, FONT_MONO, FONT_TEXT };
