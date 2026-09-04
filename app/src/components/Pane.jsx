import { C } from '../theme.js';
import { color, space, font, typeStyle } from '../ui/tokens.js';
import { t } from '../i18n/index.js';

/* Pane headers used to read "LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS
   SUBSECTION" — all caps, 10px, 2px of letter-spacing, in copper. Three
   problems at once: "Layer 2" is the internal architecture rather than
   anything a reader wants, the shouted setting made a title harder to scan
   than the body text beneath it, and the instruction was welded onto the
   name.

   The layer numbering stays in the developer documentation, where it is
   accurate and useful. Here a pane gets a name and, where an instruction
   genuinely helps, a separate line of ordinary prose. */

export default function Pane({ title, hint, children, id, highlight }) {
  return (
    /* minWidth: 0 lets this pane shrink below its content's intrinsic
       width. Without it, a grid/flex item's default `min-width: auto`
       refuses to go below min-content — and the flow graph has an 860px
       minimum on its SVG (which it scrolls internally, correctly). The
       result was that in the Network and side-by-side views, where the flow
       graph sits in the narrow column, the track widened to fit the SVG and
       pushed the whole PAGE into horizontal scrolling: 201px of it at
       1600px wide, 435px at 1366px. The panes scroll their own overflow;
       the document must not. */
    <section
      id={id}
      className={highlight ? 'tour-target' : undefined}
      aria-label={t(title)}
      style={{ background: C.bg, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}
    >
      <div
        style={{
          padding: `${space.sm}px ${space.lg - 2}px`,
          borderBottom: `1px solid ${color.border.subtle}`,
          display: 'flex',
          alignItems: 'baseline',
          gap: space.sm,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ ...typeStyle.heading, fontSize: font.size.body, margin: 0 }}>{t(title)}</h2>
        {hint && <span style={{ ...typeStyle.meta }}>{t(hint)}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
    </section>
  );
}
