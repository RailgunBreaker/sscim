<!-- tags: reference, engineering -->

# SSCIM design system

The one description of how this site looks and why. It covers the palette,
the typographic scale, the components, and the two reading themes.

**No model output changed when this was written.** The design lives entirely
in `app/src/ui/`, the page components and the documentation generator; no
engine, registry or data file was touched. Model version
`sscim-model-v7.1-exposure-robustness`.

Related: [`DESIGN_PASS.md`](DESIGN_PASS.md) records an earlier interface pass
against the dashboard. This document describes the system as it now stands,
across all six pages.

## Where it lives

| File | What it holds |
| --- | --- |
| `app/src/theme.js` | The raw palette. Every colour in the product, named once. |
| `app/src/ui/css.js` | The stylesheet every page loads: custom properties for both themes, the reset, the type scale, the controls, the prose rules, the site header and footer. |
| `app/src/ui/tokens.js` | The same values as a JavaScript vocabulary, for components that compose inline styles. |
| `app/src/ui/primitives.jsx` | The small set of React controls the dashboard repeats. |
| `app/scripts/build-doc-pages.mjs` | The documentation reader, which imports `ui/css.js` so the static pages and the application cannot drift. |

Before this, each of the five pages carried its own `const STYLE` block with
its own copy of the palette, and they disagreed: the documentation library set
`--dim` to `#A5AEC0`, the landing page set it to `#8C96A8`, and the guide set
`--faint` to a value that had already been found to fail contrast. There is now
one source and five consumers.

## Palette

Near-neutral graphite surfaces, neutral off-white text, and a single
low-chroma steel-blue accent.

| Role | Dark | Paper |
| --- | --- | --- |
| Page | `#101214` | `#FBFAF8` |
| Sunken | `#15181B` | `#F3F1EC` |
| Panel | `#1A1E22` | `#FFFFFF` |
| Rule | `#2A3036` | `#DFDBD3` |
| Primary text | `#E8EAEC` | `#1C1F23` |
| Secondary text | `#99A1AA` | `#4C535B` |
| Muted text | `#838C96` | `#6E767F` |
| Accent | `#7FA3D8` | `#2C5B96` |

State colours, which are the same in both themes and are **reserved** —
never used for a series, a tier, a changelog label or decoration:

| State | Hex |
| --- | --- |
| Adverse | `#E05A52` |
| Warning | `#DFA83D` |
| Mitigating | `#4FAE86` |

### Why the accent moved

The previous accent was copper, `#C98A3F`. The `warning` state is `#DFA83D`.
Those are the same hue eleven degrees apart — so the colour marking links,
selection, focus and every primary control was the colour that elsewhere means
"this is deteriorating". On a tool whose entire job is reporting degrees of
exposure, that is a misreading waiting to happen, not a question of taste.

The replacement is deliberately low in chroma, and the governing rule is:
**the only saturated colours on screen are risk.** Structure, chrome and
selection recede; red, amber and green do not.

### Contrast

Every pairing is asserted by `app/src/ui/designSystem.test.jsx` rather than
eyeballed. Primary, secondary and muted text each clear WCAG AA (4.5:1) on all
three dark surfaces; the accent clears AA on all three; text on the accent fill
clears AA; each state colour clears 3:1 on a panel. The suite also refuses the
specific muted value that once failed, so it cannot return unnoticed.

## Typography

Two faces, each doing one job. Nothing is downloaded.

- **Interface** — the platform UI face (`Segoe UI Variable Text` on Windows,
  the system face on macOS). The old stack led with Inter, which this project
  never loads, so the code named a typeface nobody ever saw.
- **Documents** — a text face (`Iowan Old Style`, `Palatino Linotype`,
  Charter, Georgia) for the documentation reader and the guide. KaTeX sets its
  mathematics in a serif, so prose and equations now belong to the same page
  instead of looking spliced together.
- **Numbers** are the interface face with tabular figures, so columns of
  figures do not jitter. The class that does this is still called `.mono` for
  historical reasons; it has never set a monospace family.

The scale, in pixels: 12 · 13 · 14 · 15 · 16 · 18 · 21 · 26 · 34. The previous
interface used 8, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5 and 14.5 as well, which is
not a scale but an accumulation.

Floors, enforced by test: nothing a reader must read is below 12px, and no
graph annotation is below 11px. Seventeen SVG labels were below that — as small
as 8px, several with 1.2 to 2px of letter-spacing — and are now at 11.

Letter-spacing has one legitimate use: a short eyebrow label, at `.07em`. There
is one such style in the system.

## Spacing, shape, motion

A 4px spacing scale (4 · 8 · 12 · 16 · 24 · 32 · 48 · 64), with off-scale
values asserted against. Radii are 4 / 6 / 10. Controls are 36px high and 44px
below 640px, which is the floor for a finger.

**Nothing moves on hover.** A control changes shade; it does not lift, glow or
slide. The guide page previously opened with a 340px ring rotating on a
twelve-second loop and a row of six bars pulsing like an audio equaliser,
neither of which encoded anything. Both are gone. Everything that still
animates — the live pulse, the tour highlight — honours
`prefers-reduced-motion`, which a test checks file by file.

## Components

`app/src/ui/css.js` defines `.btn` (with `-primary`, `-quiet`, `-sm`),
`.field`, `.chip`, `.seg`, `.panel`, `.sunken`, `.note`, `.site-head`,
`.crumbs`, `.prose` and `.site-foot`. `primitives.jsx` adds the dashboard's
React controls: `Button`, `IconButton`, `SegmentedControl`, `Tabs`, `Panel`,
`SectionHeader`, `StatusBadge`, `Metric`, `Disclosure`, `EmptyState`.

Three rules run through all of them:

1. A row that is not interactive does not look interactive. A border means a
   boundary, a selection, a warning or a real control — never decoration, and
   nothing is a box drawn inside another box.
2. Every interactive element has a visible focus ring, defined once and applied
   broadly, and every icon-only control has an accessible name. `IconButton`
   throws without one.
3. Meaning is never carried by colour alone. Where a state is shown in colour, a
   word or a shape carries it too.

## The two themes

The **dashboard is dark, always**. It is an instrument: the map, the flow graph
and the network graph are drawn for a dark field, and their colour ramps were
checked against the dark surfaces. They do not become correct by inverting a
stylesheet.

The **documentation reader offers paper**, because forty-one documents of prose
and mathematics is long-form reading. Dark remains the default everywhere, so
moving between the dashboard and a document never flips the lights. The choice
is stored in `localStorage` under `sscim-theme` and applied by an inline script
in each page's `<head>` before first paint, so a reader who chose paper never
sees a dark flash.

## Charts and graphs

Colour is assigned by the job it does, not by preference.

The functional-centre network's **tier ramp** was seven unrelated hues: blue,
teal, copper, orange, red, violet, green. Two things were wrong with that.
Tiers are *ordered* — Inputs & IP through to End markets — and seven arbitrary
hues say they are not; a rainbow encodes identity, which is the wrong job.
Worse, three of those hues were the reserved state colours, so a tier was
painted the same red that means "deteriorating" on the same screen.

It is now a single-hue ordinal ramp, dark upstream to light downstream, which
is also the direction the model propagates in:

`#154a8c` · `#2063b4` · `#3480da` · `#679fe9` · `#97c1f3` · `#c7defa` · `#eef5fe`

Checked as an ordinal ramp against the pane's own background (`#101214`):
lightness is monotone, every adjacent step clears 0.06 in OKLab lightness, and
the darkest step holds 2.14:1 against the surface. Tier is additionally carried
by the column position, the column label and each node's accessible name, so it
is never colour alone.

## The documentation reader

The library (`docs.html`) and the generated document pages are the site's
document-management surface, and are built around four things that a listing of
forty-one filenames does not give a reader:

- **Search that looks inside.** The index carries each document's own level-2
  headings and an opening summary, so a query matches a section as well as a
  title; where it matched a heading, the heading is shown. `/` or `⌘K` focuses
  the box.
- **Options that are stated rather than assumed.** Sort, grouping, row density,
  and whether selected topics combine as *any* or *all* — the previous library
  chose union silently on the reader's behalf. Every option is in the URL, so a
  narrowed, sorted view is a link that can be sent.
- **Enough to decide from the list.** Each row carries its summary, length in
  minutes, tags and the date it last changed, instead of a title and a path.
- **A three-column reader.** The file tree, the prose at a 68-character measure
  in a text face, and the document's own headings on the right, tracking the
  reading position. Previously the headings sat below a forty-one-file tree,
  which meant most readers never saw them, and the prose ran to roughly 120
  characters a line — about twice what the eye tracks.

Each document page also carries heading anchors, a copy button on every code
block, a previous/next pager in reading order, and a breadcrumb trail.

## Screenshots

`npm run shots` drives the built artifact at four viewports with animation
disabled, so two runs over one build produce the same images, and writes to
[`screenshots/after/`](screenshots/).

The reading pages were never in that record, which is a large part of how they
came to hold five different palettes while the dashboard was being watched
screenshot by screenshot. The record now also covers the guide, the changelog,
the library, a searched library, a document page, and a document page in the
paper theme.
