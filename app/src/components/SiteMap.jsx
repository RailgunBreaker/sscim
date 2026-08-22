import { C } from '../theme.js';
import { SITE_SECTIONS, SITE_MAP_FOOTNOTE } from './siteMapLinks.js';

/* ====================================================================
   SiteMap — every page of the project, listed at the bottom of every page.

   This site is five separate entry points (landing, guide, dashboard,
   documentation, updates) plus a documentation library of a dozen-odd
   documents. Until now each page linked to two or three of the others
   from its header, which meant most of the project was reachable only if
   you already knew it existed — the methodology, the academic guide and
   the data-sources document in particular.

   Deliberately styled from the theme object rather than from CSS custom
   properties: the landing and guide pages define `--copper` and friends
   in their own stylesheet, the dashboard does not, and a shared footer
   that renders correctly on three pages and invisibly on a fourth is
   worse than no shared footer at all.

   `current` dims the page you are already on rather than hiding it, so
   the map has the same shape everywhere and you can see where you are.
   ==================================================================== */

export default function SiteMap({ current, prefix = '' }) {
  const href = (link) => (link.external ? link.href : `${prefix}${link.href}`);

  return (
    <nav aria-label="Site map" style={{
      borderTop: `1px solid ${C.line}`, background: C.panel2,
      padding: '26px 20px 22px', marginTop: 40,
    }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, marginBottom: 14 }}>
          SITE MAP
        </div>
        <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {SITE_SECTIONS.map((section) => (
            <div key={section.heading}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: 1.4, color: C.dim, marginBottom: 8, fontWeight: 700 }}>
                {section.heading}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
                {section.links.map((link) => {
                  const here = link.id && link.id === current;
                  return (
                    <li key={link.href}>
                      <a href={here ? undefined : href(link)}
                        aria-current={here ? 'page' : undefined}
                        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        style={{
                          textDecoration: 'none', display: 'block',
                          color: here ? C.faint : C.copper,
                          fontSize: 12.5, lineHeight: 1.35,
                          cursor: here ? 'default' : 'pointer',
                        }}>
                        {link.label}{here ? ' ·' : ''}
                      </a>
                      <span style={{ display: 'block', fontSize: 10.5, color: C.faint, lineHeight: 1.45 }}>
                        {here ? 'you are here' : link.note}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mono" style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.line}`, fontSize: 10, color: C.faint, lineHeight: 1.7 }}>
          {SITE_MAP_FOOTNOTE}
        </div>
      </div>
    </nav>
  );
}
