import { C } from '../theme.js';
import { t } from '../i18n/index.js';

export default function Pane({ title, children, id, highlight }) {
  return (
    <section id={id} className={highlight ? 'tour-target' : undefined} style={{ background: C.bg, display: "flex", flexDirection: "column" }}>
      <div className="mono" style={{ padding: "7px 14px", fontSize: 10, letterSpacing: 2, color: C.copper, borderBottom: `1px solid ${C.line}` }}>{t(title)}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}
