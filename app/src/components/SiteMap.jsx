import { SITE_SECTIONS, SITE_MAP_FOOTNOTE } from './siteMapLinks.js';

/* ====================================================================
   SiteMap — every page of the project, at the bottom of every page.

   This site is five separate entry points (landing, guide, dashboard,
   documentation, updates) plus a library of forty-odd documents. Without
   this, most of the project is reachable only if you already know it
   exists — the methodology, the academic guide and the source register in
   particular.

   It is styled by `.site-foot` in ui/css.js, which every page loads, so
   the same markup renders identically here and in the static HTML the
   document generator emits from the same link list. The previous version
   carried its colours as inline styles read from the theme object,
   because the pages used to define different CSS variables from each
   other; they no longer do, and one shared stylesheet is what lets this
   footer follow the paper theme on a document page.

   `current` marks the page you are on rather than hiding it, so the map
   has the same shape everywhere and you can see where you are.
   ==================================================================== */

export default function SiteMap({ current, prefix = '' }) {
  const href = (link) => (link.external ? link.href : `${prefix}${link.href}`);

  return (
    <footer className="site-foot">
      <nav className="shell" aria-label="Site map">
        <div className="cols">
          {SITE_SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2>{section.heading}</h2>
              <ul className="bare">
                {section.links.map((link) => {
                  const here = link.id && link.id === current;
                  return (
                    <li key={link.href}>
                      {here ? (
                        <span
                          aria-current="page"
                          style={{ display: 'block', fontSize: 'var(--t-small)', color: 'var(--ink)', fontWeight: 600 }}
                        >
                          {link.label}
                        </span>
                      ) : (
                        <a
                          href={href(link)}
                          {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        >
                          {link.label}
                        </a>
                      )}
                      <small>{here ? 'You are here' : link.note}</small>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="fine">{SITE_MAP_FOOTNOTE}</p>
      </nav>
    </footer>
  );
}
