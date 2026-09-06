import { useId } from 'react';
import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import { STAGE_INTRO, introForCompany } from '../data/glossary.js';
import Logo from './Logo.jsx';
import Detail from './Detail.jsx';
import DecadeHistory from './DecadeHistory.jsx';
import Quote from './Quote.jsx';
import Watchlist from './Watchlist.jsx';
import FacilityExplorer from './FacilityExplorer.jsx';
import EventFeed from './EventFeed.jsx';

/* ====================================================================
   Intel — Layer 3, the intelligence panel.

   THE LAYOUT DEFECT THIS FIXES. The feed wrapper carried
   `maxHeight: horizontal ? 420 : 440`. On a 1363×936 desktop the panel
   itself was ~1317px tall — its height set by the left detail column —
   while the feed was pinned to a 420px internal scroller, leaving roughly
   900px of empty panel below the Events list. Every tab shared the
   wrapper, so every tab had it; Events and Explore just made it obvious.

   THE FIX, and why it is CSS rather than arithmetic. The horizontal
   layout is a two-column grid whose items stretch, so the right column
   already receives exactly the left column's height — the browser
   computes it, and it stays correct at every viewport without a resize
   listener or a measured pixel value. Inside that column:

     display: flex; flex-direction: column   tab bar, then content
     the panel: flex: 1; min-height: 0       fills what is left over
     overflow-y: auto on the panel           one scrollbar, in one place

   `min-height: 0` is the load-bearing line. A flex item's default
   `min-height: auto` refuses to shrink below its content, so without it
   the panel grows to fit 167 event cards and pushes the page to ten
   thousand pixels instead of scrolling internally. That is the failure
   mode the acceptance criteria name explicitly.

   A `minHeight` floor on the grid keeps the panel usable when the detail
   column happens to be short, and it is viewport-relative rather than a
   magic number, so 1366×768 and 1920×1080 both get a sensible panel.

   NARROW/MOBILE. No nested scroller at all: the tabs stack above the
   content and the content flows into the document, which is what phone
   readers expect and what makes a long feed reachable by ordinary page
   scrolling. `maxHeight: none` rather than a smaller box.

   TAB SEMANTICS. The bar is a real tablist — role, aria-selected,
   aria-controls, roving tabindex, arrow-key navigation — because seven
   unlabelled buttons above a changing region is otherwise unnavigable by
   keyboard or screen reader. It scrolls horizontally instead of crushing
   its labels when there is not enough width.
   ==================================================================== */

/* [key, english label, i18n key]. The third entry is the ALL-CAPS string
   the translation dictionaries are keyed on; it stays so that the four
   languages keep working, while English now renders a sentence-case label
   without a decorative glyph in front of it. A star and a pair of arrows
   were doing no work that the word beside them was not already doing. */
const TABS = [
  ['watch', 'Watchlist', '★ WATCH'],
  ['explore', 'Explore', '⇄ EXPLORE'],
  ['events', 'Events', 'EVENTS'],
  ['history', 'History', 'HISTORY'],
  ['companies', 'Companies', 'COMPANIES'],
  ['movers', 'Movers 7d', 'MOVERS 7D'],
  ['capital', 'Capital', 'CAPITAL'],
];

/* English falls through to the plain label; every other language uses the
   dictionary entry keyed on the original string. */
const tabLabel = (english, key) => {
  const translated = t(key);
  return translated === key ? english : translated;
};

export default function Intel({ sel, setSel, model, scenario, onResetScenario, onPlayScenario, scenarioActive, horizontal, feedTab, setFeedTab, baseGraph }) {
  const { data, engine } = useVault();
  const { EVENTS, COMPANY_BY_ID, COUNTRY_NAMES, SUPPLIERS, CUSTOMERS, QUOTES } = data;
  const { STAGE_BY_ID, CAP_RANK, MOVERS7D, COMPANY_CRITICALITY, COMPANY_RANK } = engine;
  const baseId = useId();
  const tabId = (k) => `${baseId}-tab-${k}`;
  const panelId = (k) => `${baseId}-panel-${k}`;

  /* Arrow keys move between tabs, Home/End jump to the ends — the
     standard tablist keyboard contract. */
  const onTabKeyDown = (e) => {
    const i = TABS.findIndex(([k]) => k === feedTab);
    const go = (n) => { e.preventDefault(); const [k] = TABS[(n + TABS.length) % TABS.length]; setFeedTab(k); document.getElementById(tabId(k))?.focus(); };
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(TABS.length - 1);
  };

  return (
    <div style={{
      display: horizontal ? 'grid' : 'block',
      gridTemplateColumns: horizontal ? '1.5fr 1fr' : undefined,
      // Stretch is the default, stated because the whole fix depends on it:
      // the right column takes the left column's height.
      alignItems: horizontal ? 'stretch' : undefined,
      // A floor, so a short detail column does not produce a cramped feed.
      // Viewport-relative rather than a magic pixel count.
      minHeight: horizontal ? 'clamp(440px, 58vh, 900px)' : undefined,
    }}>
      <div style={{
        padding: 12,
        borderRight: horizontal ? `1px solid ${C.line}` : 'none',
        borderBottom: horizontal ? 'none' : `1px solid ${C.line}`,
        minWidth: 0,
      }}>
        <Detail sel={sel} setSel={setSel} model={model} scenario={scenario} onResetScenario={onResetScenario} onPlayScenario={onPlayScenario} scenarioActive={scenarioActive} baseGraph={baseGraph} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div role="tablist" aria-label="Intelligence panel sections" onKeyDown={onTabKeyDown}
          style={{
            display: 'flex', gap: 0, borderBottom: `1px solid ${C.line}`, flexShrink: 0,
            // Seven labels do not fit at 375px. Scrolling the bar keeps every
            // tab reachable without shrinking the type below legibility.
            overflowX: 'auto', scrollbarWidth: 'thin',
          }}>
          {TABS.map(([k, english, key]) => (
            <button key={k} id={tabId(k)} role="tab" type="button"
              aria-selected={feedTab === k} aria-controls={panelId(k)}
              tabIndex={feedTab === k ? 0 : -1}
              onClick={() => setFeedTab(k)} className="ui-button"
              style={{
                flex: '1 0 auto', minWidth: 84, padding: '10px 14px', background: 'transparent', border: 'none',
                borderBottom: feedTab === k ? `2px solid ${C.copper}` : '2px solid transparent',
                color: feedTab === k ? C.text : C.dim,
                /* Was 9.5px with 1.5px of letter-spacing, which is smaller
                   than the body text it navigates. */
                fontSize: 13, fontWeight: feedTab === k ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
              {tabLabel(english, key)}
            </button>
          ))}
        </div>

        {/* The one intentional internal scroller, and only in horizontal
            mode. flex:1 + minHeight:0 is what makes it fill the remaining
            column height and scroll rather than grow. */}
        <div role="tabpanel" id={panelId(feedTab)} aria-labelledby={tabId(feedTab)} tabIndex={0}
          style={{
            flex: horizontal ? '1 1 auto' : undefined,
            minHeight: 0,
            overflowY: horizontal ? 'auto' : 'visible',
            maxHeight: horizontal ? undefined : 'none',
            padding: '8px 12px 12px',
          }}>
          {feedTab === 'watch' && <Watchlist model={model} setSel={setSel} />}
          {feedTab === 'explore' && <FacilityExplorer setSel={setSel} model={model} />}
          {feedTab === 'events' && <EventFeed sel={sel} setSel={setSel} engine={engine} events={EVENTS} />}
          {feedTab === 'history' && <DecadeHistory onSelectEvent={(id) => setSel({ type: 'event', id })} />}

          {feedTab === 'capital' && (
            <>
              <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
                CAPITAL POWER = Σ ownership% × company systemic criticality (§10 in ⓘ Methodology). <b>Not</b> a 0–10 score — it&apos;s an unbounded ranking number, useful only to compare owners against each other. <span style={{ color: C.amber }}>Amber = state-linked capital.</span> Data from public filings.
              </div>
              {CAP_RANK.slice(0, 14).map((r, i) => (
                <div key={r.o} style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: '7px 10px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12, color: C.faint, width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: r.gov ? C.amber : C.text }}>{r.o}</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: C.copper }}
                      title="Capital Power = Σ (ownership share × that company's systemic criticality, 0–10). Unbounded — compares owners relative to each other, not a 0–10 score.">
                      {r.power.toFixed(2)}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>
                    {r.holdings.slice(0, 4).map(([cid, sh]) => `${COMPANY_BY_ID[cid].name} ${(sh * 100).toFixed(1)}%`).join(' · ')}
                  </div>
                </div>
              ))}
            </>
          )}

          {feedTab === 'movers' && (
            <>
              <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
                Score = each stage&apos;s baseline operational-impact display index (0–10, 5 = neutral), recomputed 7 days ago via engine replay. Δ = today&apos;s score minus that — never the active scenario, which never touches this baseline history.
              </div>
              {MOVERS7D.slice(0, 12).map((m) => {
                const st = STAGE_BY_ID[m.id];
                const up = m.d >= 0;
                return (
                  <div key={m.id} className="evcard" onClick={() => setSel({ type: 'stage', id: m.id })}
                    role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: 'stage', id: m.id }))}
                    title={STAGE_INTRO[m.id]}
                    style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: '7px 10px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{st.name}</span>
                    <span className="mono" style={{ fontSize: 12, color: C.dim }} title="Baseline operational-impact display index right now: 0–10, 5=neutral, above 5=net adverse, below 5=net mitigating.">{m.now.toFixed(1)} / 10</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: Math.abs(m.d) < 0.03 ? C.faint : up ? C.red : C.green, width: 52, textAlign: 'right' }}
                      title="Change vs. the same baseline score 7 days ago (engine replay, not a live time series).">
                      {Math.abs(m.d) < 0.03 ? '—' : `${up ? '▲' : '▼'} ${Math.abs(m.d).toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {feedTab === 'companies' && (
            <>
              <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
                Ranked by systemic criticality (0–10): the modeled chain effect if that company&apos;s production were fully disrupted — see a company&apos;s own detail view for its separate vulnerability/contribution numbers (§9 in ⓘ Methodology).
              </div>
              {COMPANY_RANK.slice(0, 18).map((co, i) => {
                const active = sel.type === 'company' && sel.id === co.id;
                const criticality = COMPANY_CRITICALITY[co.id].value;
                return (
                  <div key={co.id} className="evcard" onClick={() => setSel({ type: 'company', id: co.id })}
                    role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: 'company', id: co.id }))}
                    title={introForCompany(co, { STAGE_BY_ID, COUNTRY_NAMES, CUSTOMERS, SUPPLIERS })}
                    style={{ border: `1px solid ${active ? C.copper : C.line}`, background: active ? C.raised : C.panel, borderRadius: 6, padding: '7px 10px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12, color: C.faint, width: 20 }}>#{i + 1}</span>
                    <Logo cid={co.id} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{co.name}</span>
                    <Quote quote={(QUOTES || {})[co.id]} compact />
                    <span className="mono" style={{ fontSize: 12, color: C.dim }}>HQ: {COUNTRY_NAMES[co.country]}</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: riskColor(criticality) }}
                      title="Systemic criticality: modeled chain effect if this company's production were fully disrupted. Scale 0–10.">
                      {criticality.toFixed(2)} / 10
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
