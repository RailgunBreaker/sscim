import { C } from '../theme.js';
import { t } from '../i18n/index.js';

export default function Pane({ title, children, id, highlight }) {
  return (
    /* minWidth: 0 lets this pane shrink below its content's intrinsic
       width. Without it, a grid/flex item's default `min-width: auto`
       refuses to go below min-content — and Layer 2's flow graph has an
       860px minimum on its SVG (which it scrolls internally, correctly).
       The result was that in the Topology and Split views, where Layer 2
       sits in the narrow column, the track widened to fit the SVG and
       pushed the whole PAGE into horizontal scrolling: 201px of it at
       1600px wide, 435px at 1366px. The panes scroll their own overflow;
       the document must not. */
    <section id={id} className={highlight ? 'tour-target' : undefined} style={{ background: C.bg, display: "flex", flexDirection: "column", minWidth: 0, overflowX: "hidden" }}>
      <div className="mono" style={{ padding: "7px 14px", fontSize: 10, letterSpacing: 2, color: C.copper, borderBottom: `1px solid ${C.line}` }}>{t(title)}</div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
    </section>
  );
}
