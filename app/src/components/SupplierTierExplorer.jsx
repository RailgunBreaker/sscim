import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { C, accentWash } from '../theme.js';
import { Button, SegmentedControl, Disclosure, StatusBadge } from '../ui/primitives.jsx';
import {
  buildSupplierIndex, traverseSuppliers, reachableCount, suggestedRoots,
  searchCompanies, EVIDENCE_CLASSES, CHAIN_GROUPS, systemCompanyCoverage, shortestSupplierPath,
} from '../engine/supplierTiers.js';
import SupplierTierGraph, { tierFill, GROUP_FILL } from './SupplierTierGraph.jsx';
import CompanyProfile from './CompanyProfile.jsx';

/* ====================================================================
   SupplierTierExplorer — the second lens of the playground.

   The first lens answers "what does the model attach to this plant".
   This one answers the question a reader is entitled to ask next, and
   which the model cannot answer: "who has anybody actually said supplies
   whom, in public, on the record" — and then shows the document.

   The two lenses share this view rather than living on separate pages
   because they are two readings of the same chain, and a reader who has
   to leave to compare them will not compare them. They are kept visually
   and verbally distinct because confusing a modeled link with a
   documented one is the single worst misreading available here.

   Every relationship on this surface ends in a citation. That is not
   decoration: it is the only thing separating this dataset from the
   thing it was built to replace.
   ==================================================================== */

const BIG_NETWORK = 60;

const chip = {
  background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4,
  color: C.dim, fontSize: 12, padding: '4px 9px', cursor: 'pointer',
};

/* EMBEDDED MODE (`fixedRootId`). The explorer no longer has a page of
   its own: it is rendered inside the profile of the company it is
   centred on. In that mode it loses the parts that only make sense on a
   page of its own — the preamble, the company directory, the free-text
   search, the "centre company" select — because the profile around it
   already names the company, and it loses its nested profile panel,
   because a profile that renders a profile is a loop. Clicking through
   to another firm hands the whole profile over to that firm instead
   (`onOpenCompany`), which is both what a reader means by the click and
   what gives every company a URL of its own. */
export default function SupplierTierExplorer({ compact = false, onSelectVaultCompany, fixedRootId = null, onOpenCompany = null }) {
  const { state: { publicNetworkRequest } } = useInteraction();
  const embedded = Boolean(fixedRootId);
  const index = useMemo(() => buildSupplierIndex(), []);

  const coverage = useMemo(() => systemCompanyCoverage(index), [index]);
  const [rootId, setRootId] = useState(fixedRootId);
  const [trail, setTrail] = useState([]);
  const [direction, setDirection] = useState('both');
  /* Three documented steps from TSMC is 161 firms. That was a legible
     first view at 1180px of workspace; in a profile column it is a cloud.
     Embedded, the graph opens at ONE step — this company's own named
     counterparties, suppliers to the left and customers to the right —
     and the depth control is right there to go further.

     One step rather than two, because two is where a profile stops being
     about its company. Renesas has eight documented suppliers and
     fourteen documented customers; at two steps it has 94 counterparties,
     and 71 of the 72 new ones arrive through a single one of those 22 —
     TSMC, whose published supplier list is 72 firms long. The reader
     opened a Renesas page, so the first thing drawn is Renesas's network,
     not TSMC's. The table below is complete at any depth. */
  const [hops, setHops] = useState(fixedRootId ? 1 : 3);
  const [colourBy, setColourBy] = useState('tier');
  const [anchorTiers, setAnchorTiers] = useState(true);
  const [hiddenGroups, setHiddenGroups] = useState(() => new Set());
  const [selectedKey, setSelectedKey] = useState(null);
  const [query, setQuery] = useState('');
  const [bigWarned, setBigWarned] = useState(false);
  /* Which firm the side panel is describing. Clicking a node inspects it
     and lifts its neighbourhood; only Enter or a double-click re-centres
     the whole traversal. Separating the two means a reader can walk the
     graph reading firms without the picture rebuilding under them on
     every click, which was the single most disorienting thing about
     treating one click as both. */
  const [detailId, setDetailId] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const workspaceRef = useRef(null);
  useEffect(() => {
    /* Embedded, the profile owns the scroll position: yanking the page
       down to the graph every time a reader opens a company is the
       opposite of what they asked for. */
    if (rootId && !embedded) workspaceRef.current?.scrollIntoView({ block: 'start' });
  }, [rootId, publicNetworkRequest, embedded]);
  /* The profile hands the root down. Re-centre on it, and drop every
     selection that belonged to the firm we just left. */
  useEffect(() => {
    if (!fixedRootId) return;
    setRootId(fixedRootId);
    setTrail([]); setSelectedKey(null); setDetailId(null); setProfileId(null);
  }, [fixedRootId]);
  useEffect(() => {
    if (!publicNetworkRequest || !index.companies[publicNetworkRequest.id]) return;
    /* Embedded, a request naming another firm is that firm's business;
       only the direction applies here, and only for this firm. */
    if (embedded && publicNetworkRequest.id !== fixedRootId) return;
    if (!embedded) setRootId(publicNetworkRequest.id);
    setDirection(publicNetworkRequest.direction);
    setHops(embedded ? 1 : 3);
    setTrail([]); setSelectedKey(null); setDetailId(null); setProfileId(null);
    setHiddenGroups(new Set());
  }, [publicNetworkRequest, index, embedded, fixedRootId]);

  const groups = useMemo(
    () => (hiddenGroups.size ? new Set(CHAIN_GROUPS.filter((g) => !hiddenGroups.has(g))) : null),
    [hiddenGroups],
  );

  const traversal = useMemo(
    () => (rootId ? traverseSuppliers(index, rootId, { direction, hops, groups }) : null),
    [index, rootId, direction, hops, groups],
  );

  const viewIndex = useMemo(() => traversal ? {
    ...index,
    tier: Object.fromEntries(traversal.nodes.map(n => [n.id, Math.abs(n.hop)])),
    maxTier: Math.max(0, ...traversal.nodes.map(n => Math.abs(n.hop))),
  } : index, [index, traversal]);
  const selectedPath = useMemo(() => {
    if (!rootId || !detailId || !traversal) return null;
    const keys = new Set(traversal.links.map(e => e.key));
    const visibleIndex = { ...index };
    for (const field of ['suppliersOf', 'customersOf']) {
      visibleIndex[field] = Object.fromEntries(Object.entries(index[field]).map(([id, links]) =>
        [id, links.filter(e => keys.has(e.key))]));
    }
    return (direction !== 'downstream' && shortestSupplierPath(visibleIndex, rootId, detailId, 'upstream', hops))
      || (direction !== 'upstream' && shortestSupplierPath(visibleIndex, rootId, detailId, 'downstream', hops));
  }, [index, rootId, detailId, direction, hops, traversal]);

  const focus = useCallback((id, { asRoot = false } = {}) => {
    /* Embedded, "centre on this firm" means "open that firm's profile":
       the graph follows the profile, never the other way round. */
    if (embedded && onOpenCompany && index.companies[id]) { onOpenCompany(id); return; }
    if (!index.companies[id]?.vaultId) {
      setProfileId(id);
      setDetailId(id);
      setSelectedKey(null);
      return;
    }
    setRootId((prev) => {
      if (prev && prev !== id && !asRoot) setTrail((t) => [...t, prev]);
      return id;
    });
    setSelectedKey(null);
    setDetailId(null);
    setProfileId(null);
    if (asRoot) setTrail([]);
  }, [index, embedded, onOpenCompany]);

  /* Clicking a firm also lights its position in the industry-flow panel
     beside this one, for the 54 firms that are the same company the
     model carries. That is the one place a reader can see both readings
     at once: the documented relationship here, and the stages the model
     puts that company in over there.

     Only crosswalked firms can do it. A supplier named in a document but
     absent from the model has no stage to light, and the panel says so
     rather than lighting something approximate. */
  const lightUpstreamPanel = useCallback((id) => {
    const vaultId = index.companies[id]?.vaultId;
    if (vaultId && onSelectVaultCompany) onSelectVaultCompany(vaultId);
  }, [index, onSelectVaultCompany]);

  /* What the graph calls on a click: inspect without re-centring unless
     the reader actually asked to re-centre. */
  const inspect = useCallback((id, { recentre = false } = {}) => {
    /* Reading a firm in the side panel must not change which company the
       surrounding profile is about — that is what `recentre` is for. */
    if (!embedded) lightUpstreamPanel(id);
    if (recentre) { focus(id); return; }
    setDetailId(id);
    if (!embedded) setProfileId(id);
    setSelectedKey(null);
  }, [focus, lightUpstreamPanel, embedded]);

  const back = useCallback(() => {
    setTrail((t) => {
      if (!t.length) return t;
      setRootId(t[t.length - 1]);
      setSelectedKey(null);
      setDetailId(null);
      setProfileId(null);
      return t.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setRootId(null); setTrail([]); setSelectedKey(null); setDetailId(null); setProfileId(null); setQuery(''); setBigWarned(false);
  }, []);

  const toggleGroup = (g) => setHiddenGroups((s) => {
    const n = new Set(s);
    if (n.has(g)) n.delete(g); else n.add(g);
    return n;
  });

  /* ---------------- starting state ---------------- */
  if (!rootId && embedded) {
    return (
      <p style={{ fontSize: 12.5, color: C.faint, fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
        This company is not registered in the documented-relationship dataset, so there is no documented network
        to draw. An absence of disclosure, not of trade.
      </p>
    );
  }
  if (!rootId) {
    const roots = suggestedRoots(index, Infinity).filter(id => index.companies[id].vaultId).slice(0, 9);
    const hits = searchCompanies(index, query, 10);
    return (
      <div style={{ padding: compact ? 0 : '4px 2px' }}>
        <Preamble index={index} />
        <CompanyDirectory index={index} coverage={coverage} onFocus={(id, dir) => { setDirection(dir); focus(id); }} onProfile={setProfileId} />
        {profileId && <ChainCompanyProfile id={profileId} onOpen={setProfileId} onClose={() => setProfileId(null)} />}
        <label htmlFor="st-search" style={{ display: 'block', fontSize: 12, color: C.faint, margin: '0 0 5px' }}>
          Find a firm among all {Object.keys(index.companies).length} registered firms
        </label>
        <input
          id="st-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="ASML, SUMCO, Unimicron, Senju Metal…" autoComplete="off"
          className="field"
          style={{
            width: '100%', maxWidth: 620, background: C.panel2, color: C.text,
            border: `1px solid ${C.line}`, borderRadius: 4, padding: '9px 11px', fontSize: 14,
          }}
        />
        {query && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9, maxWidth: 820 }}>
            {hits.length === 0 && <span style={{ fontSize: 12.5, color: C.faint }}>No firm of that name is named in these documents.</span>}
            {hits.map((id) => (
              <button key={id} type="button" style={chip} onClick={() => focus(id, { asRoot: true })}>
                {index.companies[id].name}
                {!index.companies[id].vaultId && <span style={{ color: C.faint }}> · profile only</span>}
                <span style={{ color: C.faint }}> · {index.suppliersOf[id].length} named suppliers</span>
              </button>
            ))}
          </div>
        )}

        <h4 style={{ fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', color: C.faint, margin: '20px 0 8px', fontWeight: 600 }}>
          Or start from one of the most-documented firms
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 900 }}>
          {roots.map((id) => {
            const c = index.companies[id];
            const named = index.suppliersOf[id].length + index.customersOf[id].length;
            return (
              <button key={id} type="button" style={{ ...chip, padding: '7px 11px' }} onClick={() => focus(id, { asRoot: true })}>
                <span style={{ color: C.text }}>{c.name}</span>
                <span style={{ color: C.faint }}>{` · ${named} relationships`}</span>
              </button>
            );
          })}
        </div>
        <p className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 10, maxWidth: 760, lineHeight: 1.65 }}>
          &ldquo;{Object.keys(index.companies).length} firms&rdquo; and &ldquo;{index.edges.length} named relationships&rdquo; count
          registered firms and cited relationships, not trade volumes. A firm named more often here appears in more of these particular
          publications &mdash; which is a fact about disclosure practice, not about the chain.
        </p>
      </div>
    );
  }

  /* ---------------- focused state ---------------- */
  const root = index.companies[rootId];
  const reach = reachableCount(index, rootId, direction);
  const selectedLink = selectedKey ? index.edgeByKey[selectedKey] : null;

  const setDepth = (h) => {
    if (h === Infinity && reach > BIG_NETWORK && !bigWarned) { setBigWarned(true); return; }
    setHops(h);
  };

  return (
    <div ref={workspaceRef} style={{ display: 'grid', gap: 12, minWidth: 0, scrollMarginTop: 70 }}>
      {!embedded && (
        <details>
          <summary style={{ cursor: 'pointer', color: C.accent }}>Browse all {coverage.length} tracked companies</summary>
          <CompanyDirectory index={index} coverage={coverage} onFocus={(id, dir) => { setDirection(dir); focus(id); }} onProfile={setProfileId} />
        </details>
      )}
      {!embedded && (
        <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, color: C.dim }}>
          Centre company
          <select aria-label="Centre company" value={rootId} onChange={e => focus(e.target.value)}
            style={{ maxWidth: '100%', padding: 9, background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: 4 }}>
            <optgroup label="Companies tracked in the system">
              {coverage.map(c => <option key={c.id} value={c.id}>{c.name}{c.documented ? '' : ' — evidence gap'}</option>)}
            </optgroup>
            {!index.companies[rootId].vaultId && <option value={rootId}>{root.name} (context company)</option>}
          </select>
          <Button variant="quiet" size="sm" onClick={() => { setProfileId(rootId); setDetailId(rootId); }}>Company profile</Button>
        </label>
      )}
      <p style={{ margin: 0, fontSize: 12, color: C.dim }}>Levels are shortest documented steps from {root.name}. Evidence dates describe disclosures, not live shipments.</p>
      {/* ---- toolbar: history as actions, choices as segmented controls,
             the same division of form the facility lens uses ---- */}
      <div className="cbar" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Exploration history" style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="quiet" size="sm" onClick={back} disabled={!trail.length}
            aria-label="Back to the previously centred firm">Back</Button>
          <Button variant="quiet" size="sm" onClick={reset}
            aria-label="Reset and choose another firm">Reset</Button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>Direction</span>
          <SegmentedControl
            size="sm" label="Traversal direction" value={direction} onChange={setDirection}
            options={[
              { value: 'upstream', label: 'Upstream', title: 'Firms documented as supplying this one' },
              { value: 'downstream', label: 'Downstream', title: 'Firms this one is documented as supplying' },
              { value: 'both', label: 'Both', title: 'Both directions' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>Documented steps</span>
          <SegmentedControl
            size="sm" label="Supplier tier depth" value={hops === Infinity ? 'all' : hops}
            onChange={(v) => setDepth(v === 'all' ? Infinity : v)}
            options={[
              { value: 1, label: 'Level 1', title: 'Direct named counterparties only' },
              { value: 2, label: '+ Level 2', title: 'And their named counterparties' },
              { value: 3, label: '+ Level 3', title: 'And theirs again' },
              { value: 'all', label: 'All', title: 'Everything reachable through named relationships' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>Colour</span>
          <SegmentedControl
            size="sm" label="Colour nodes by" value={colourBy} onChange={setColourBy}
            options={[
              { value: 'tier', label: 'Level', title: 'Documented distance from the selected company' },
              { value: 'chain', label: 'Chain position', title: 'Where the firm sits in the chain' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>Layout</span>
          <SegmentedControl
            size="sm" label="Graph layout" value={anchorTiers ? 'tier' : 'free'}
            onChange={(v) => setAnchorTiers(v === 'tier')}
            options={[
              { value: 'tier', label: 'Tier-anchored', title: 'The simulation settles, but each tier is held to its own band — upstream left, buyer right' },
              { value: 'free', label: 'Free', title: 'Pure force layout: position means connectedness and nothing else' },
            ]}
          />
        </div>
      </div>

      {bigWarned && hops !== Infinity && (
        <div role="alert" className="mono" style={{ fontSize: 12, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 6, padding: '8px 11px', lineHeight: 1.6 }}>
          <b>{reach} firms</b> are reachable from {root.name} through named relationships in the{' '}
          {direction === 'both' ? 'combined' : direction} direction. That is more than this graph can lay out legibly
          &mdash; the table below stays complete at any depth.
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button type="button" onClick={() => { setHops(Infinity); setBigWarned(false); }} style={{ ...chip, borderColor: C.amber, color: C.amber }}>Draw it anyway</button>
            <button type="button" onClick={() => { setHops(3); setBigWarned(false); }} style={chip}>Three tiers instead</button>
            <button type="button" onClick={() => setBigWarned(false)} style={chip}>Cancel</button>
          </div>
        </div>
      )}

      {/* ---- chain-position filter ---- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.faint, marginRight: 3 }}>Chain position</span>
        {CHAIN_GROUPS.map((g) => {
          const on = !hiddenGroups.has(g);
          return (
            <button key={g} type="button" onClick={() => toggleGroup(g)} aria-pressed={on}
              style={{ ...chip, opacity: on ? 1 : 0.45, color: on ? C.dim : C.faint, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: GROUP_FILL[g], display: 'inline-block' }} />
              {g}
            </button>
          );
        })}
        {hiddenGroups.size > 0 && (
          <button type="button" style={chip} onClick={() => setHiddenGroups(new Set())}>Show all</button>
        )}
      </div>

      {/* Keep the legend visible and reserve room beside the network. */}
      {traversal && traversal.nodes.length === 1 ? (
        <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, border: `1px solid ${C.line}`, borderRadius: 6, padding: 14 }}>
          No public document in this set names a{' '}
          {direction === 'downstream' ? 'customer of' : direction === 'both' ? 'counterparty of' : 'supplier to'}{' '}
          {root.name}. That is a statement about what has been published, not about whether the relationships exist.
          {' Try the opposite direction to inspect any documented customers or suppliers.'}
        </div>
      ) : (
        <SupplierTierGraph
          index={viewIndex} traversal={traversal} colourBy={colourBy} compact={compact}
          anchorTiers={anchorTiers} selectedKey={selectedKey}
          onFocus={inspect} onSelectLink={(k) => setSelectedKey(k === selectedKey ? null : k)}
          overlay={<>
            <Legend colourBy={colourBy} index={viewIndex} anchorTiers={anchorTiers}
              root={root}
              onOpenRoot={() => {
                setDetailId(rootId);
                if (embedded) return;
                setProfileId(rootId);
                requestAnimationFrame(() => document.getElementById('chain-company-profile')?.scrollIntoView({ block: 'start' }));
              }} />
            {(selectedLink || detailId) && <div style={{ marginTop: 20, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
              <Button variant="quiet" size="sm" onClick={() => { setSelectedKey(null); setDetailId(null); setProfileId(null); }}>Clear selection</Button>
              {selectedLink
                ? <LinkDetail index={index} link={selectedLink} onClose={() => setSelectedKey(null)} onFocus={inspect} />
                : detailId && index.companies[detailId]
                  ? <FirmDetail index={viewIndex} id={detailId} isRoot={detailId === rootId} onRecentre={focus}
                      onFocus={inspect} onSelectLink={setSelectedKey}
                      profileLabel={embedded ? 'Open this firm as the profile' : 'View company profile'}
                      onOpenProfile={() => {
                        if (embedded) { onOpenCompany?.(detailId); return; }
                        setProfileId(detailId);
                        requestAnimationFrame(() => document.getElementById('chain-company-profile')?.scrollIntoView({ block: 'start' }));
                      }} />
                  : null}
            </div>}
          </>}

        />
      )}


      {/* ---- the complete table, which the graph's column caps never
             apply to: at any depth this reaches every drawn firm ---- */}
      {profileId && !embedded && <ChainCompanyProfile id={profileId} onOpen={inspect} onClose={() => setProfileId(null)} />}
      {traversal && [1, 2, 3].filter(level => level <= hops).map(level => {
        const firms = traversal.nodes.filter(n => Math.abs(n.hop) === level);
        return <Disclosure key={level} summary={`Level ${level}: ${firms.length} firms from ${root.name}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {firms.map(n => <button key={n.id} type="button" style={chip} onClick={() => inspect(n.id)}>
              {index.companies[n.id].name} · {n.dir}
            </button>)}
            {!firms.length && <span style={{ color: C.faint, fontSize: 12 }}>No documented paths at this level with the current filters.</span>}
          </div>
        </Disclosure>;
      })}
      {selectedPath && selectedPath.links.length > 0 && (
        <section aria-label="Documented path" style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Documented path · {selectedPath.links.length} steps</h3>
          <p style={{ fontSize: 12, color: C.dim }}>One shortest path. Each arrow below points from supplier to customer.</p>
          {selectedPath.links.map(link => <div key={link.key} style={{ padding: '6px 0', fontSize: 13 }}>
            <button type="button" style={chip} onClick={() => setSelectedKey(link.key)}>
              {index.companies[link.supplier].name} → {index.companies[link.customer].name}
            </button>{' '}<Cite index={index} sourceIds={link.sources} />
          </div>)}
        </section>
      )}
      {/* Twenty-five relationships with their citations is a full-width
             table. Inside a profile column it is a wall, so there it opens
             on request — the count is in the summary either way. */}
      <RelationshipTable index={viewIndex} traversal={traversal} onSelectLink={setSelectedKey} selectedKey={selectedKey} onOpenCompany={inspect} defaultOpen={!embedded} />

      <Disclosure summary={`The ${Object.keys(index.sources).length} documents this lens is built from`}>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: C.dim, fontSize: 12.5, lineHeight: 1.6 }}>
          {Object.entries(index.sources).map(([id, s]) => (
            <li key={id} style={{ marginBottom: 9 }}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
                {s.publisher}, {s.title}
              </a>
              {s.published ? ` (${s.published})` : ''}
              <br />
              <span style={{ color: C.faint }}>
                {s.kind} · {EVIDENCE_CLASSES[s.evidence].label}
                {s.seen === 'fetched' ? ' · document retrieved and read' : ' · URL recorded, not opened'}
              </span>
              {s.quote && <><br /><span style={{ color: C.faint }}>&ldquo;{s.quote}&rdquo;</span></>}
              {s.note && <><br /><span style={{ color: C.faint }}>{s.note}</span></>}
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ChainCompanyProfile({ id, onOpen, onClose }) {
  return <section id="chain-company-profile" aria-label="Company profile" style={{
    padding: 20, border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel2, minWidth: 0,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Company profile</h2>
      <Button variant="quiet" size="sm" onClick={onClose}>Close profile</Button>
    </div>
    <CompanyProfile key={id} publicCompanyId={id} onOpenPublicCompany={onOpen} />
  </section>;
}

function CompanyDirectory({ index, coverage, onFocus, onProfile }) {
  const [query, setQuery] = useState('');
  const [gapsOnly, setGapsOnly] = useState(false);
  const [coverageDirection, setCoverageDirection] = useState('upstream');
  const [missingLevel, setMissingLevel] = useState('');
  const [limit, setLimit] = useState(15);
  const levelsOf = c => coverageDirection === 'upstream' ? c.levels : c.downstreamLevels;
  const rows = coverage.filter(c => (!gapsOnly || !c.documented)
    && (!missingLevel || !levelsOf(c)[Number(missingLevel) - 1])
    && [c.name, index.companies[c.id].name].join(' ').toLowerCase().includes(query.toLowerCase()));
  const documented = coverage.filter(c => c.documented).length;
  return <section aria-label="System company coverage" style={{ margin: '16px 0 24px', border: `1px solid ${C.line}`, borderRadius: 6, padding: 14 }}>
    <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Track every system company</h3>
    <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
      {coverage.length} companies available · {documented} with documented connections · {coverage.length - documented} evidence gaps.
      {' '}Levels count distinct {coverageDirection} firms at their shortest distance from each company. A zero means no path recorded here.
      <br />Level 2: {coverage.filter(c => levelsOf(c)[1]).length}/{coverage.length} companies · Level 3: {coverage.filter(c => levelsOf(c)[2]).length}/{coverage.length} companies in this direction.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
      <input type="search" aria-label="Find a system company" placeholder="Find NVIDIA, AMD, TSMC…" value={query}
        onChange={e => { setQuery(e.target.value); setLimit(15); }}
        style={{ padding: 8, maxWidth: '100%', background: C.panel, color: C.text, border: `1px solid ${C.line}` }} />
      <label style={{ fontSize: 12, color: C.dim }}><input type="checkbox" checked={gapsOnly}
        onChange={e => { setGapsOnly(e.target.checked); setLimit(15); }} /> Evidence gaps only</label>
      <label style={{ fontSize: 12, color: C.dim }}>Coverage direction{' '}
        <select aria-label="Coverage direction" value={coverageDirection} onChange={e => { setCoverageDirection(e.target.value); setLimit(15); }}>
          <option value="upstream">Upstream suppliers</option><option value="downstream">Downstream customers</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: C.dim }}>Missing paths{' '}
        <select aria-label="Missing documented level" value={missingLevel} onChange={e => { setMissingLevel(e.target.value); setLimit(15); }}>
          <option value="">All companies</option><option value="2">Missing level 2</option><option value="3">Missing level 3</option>
        </select>
      </label>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
        <thead><tr>{['Company', 'Level 1', 'Level 2', 'Level 3', 'Customers', 'Coverage'].map(h =>
          <th key={h} style={{ padding: 8, color: C.dim }}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(0, limit).map(c => <tr key={c.id} style={{ borderTop: `1px solid ${C.line}` }}>
          <td style={{ padding: 8 }}><button type="button" style={{ ...chip, color: C.accent }} onClick={() => onFocus(c.id, coverageDirection)}>{c.name}</button>
            <button type="button" style={chip} aria-label={`View ${c.name} profile`} onClick={() => onProfile(c.id)}>Profile</button></td>
          {levelsOf(c).map((n, i) => <td key={i} style={{ padding: 8, color: C.text }}>{n}</td>)}
          <td style={{ padding: 8, color: C.text }}>{c.customers}</td>
          <td style={{ padding: 8, color: C.faint }}>{!c.documented ? 'No connections documented' : levelsOf(c)[2] ? 'Reaches level 3' : levelsOf(c)[1] ? 'Missing level 3' : levelsOf(c)[0] ? 'Missing levels 2–3' : `No ${coverageDirection} paths`}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p style={{ color: C.faint }}>No matching companies.</p>}
    {rows.length > limit && <Button variant="quiet" size="sm" onClick={() => setLimit(rows.length)}>Show all {rows.length} companies</Button>}
  </section>;
}

function Preamble({ index }) {
  return (
    <>
      <p style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.65, margin: '0 0 10px', maxWidth: 780 }}>
        This lens draws a different chain from the rest of SSCIM. Every connection here is a{' '}
        <b style={{ color: C.text }}>relationship named in a public document</b> &mdash; a supplier list, a supplier
        award, a securities filing, a teardown, a government rule &mdash; and every one of them opens to that document.
        Nothing is composed from stage reachability, nothing carries a modeled share, and{' '}
        <b style={{ color: C.text }}>nothing here is a declared prior</b>.
      </p>
      <p style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.65, margin: '0 0 10px', maxWidth: 780 }}>
        What that costs: there are <b style={{ color: C.text }}>no weights at all</b>, because nobody published any;
        level means documented distance from the selected company, <b style={{ color: C.text }}>not importance</b>; and a
        missing edge means no document names the pair, <b style={{ color: C.text }}>not that no relationship exists</b>.
        Buyer-published lists are selective by construction.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 16px' }}>
        <StatusBadge tone="neutral">{Object.keys(index.companies).length} firms</StatusBadge>
        <StatusBadge tone="neutral">{index.edges.length} named relationships</StatusBadge>
        <StatusBadge tone="neutral">{Object.keys(index.sources).length} documents</StatusBadge>
      </div>
    </>
  );
}

/* The legend, and the overlay's resting state.

   It lives inside the canvas, so it is written as a narrow column
   rather than the wide strip a legend under a chart would be. It also
   carries the one sentence a reader needs before trusting a position —
   what horizontal placement means under the current layout — because
   that is the claim the picture makes most quietly. */
function Legend({ colourBy, index, anchorTiers, root, onOpenRoot }) {
  const dot = (bg) => (
    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: bg, display: 'inline-block', flex: 'none' }} />
  );
  const row = { display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: C.dim, marginBottom: 4 };
  const head = { fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', color: C.faint, margin: '12px 0 6px', fontWeight: 600 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{root.name}</h3>
        <span className="mono" style={{ fontSize: 12, color: C.faint, flex: 'none' }}
          title="Distances are measured from this selected company.">
          Level 0
        </span>
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 12, color: C.faint, lineHeight: 1.55 }}>
        Centred firm. Click any firm to read its record here; click a connection to open the document behind it.
      </p>
      <Button variant="quiet" size="sm" style={{ marginTop: 7 }} onClick={onOpenRoot}>
        Open this firm&apos;s record
      </Button>

      <h4 style={head}>{colourBy === 'tier' ? 'Colour — documented distance' : 'Colour — chain position'}</h4>
      {colourBy === 'tier'
        ? Array.from({ length: index.maxTier + 1 }, (_, t) => (
          <div key={t} style={row}>{dot(tierFill(t))}{t === 0 ? 'Level 0 — selected company' : `Level ${t}`}</div>
        ))
        : CHAIN_GROUPS.map((g) => (
          <div key={g} style={row}>{dot(GROUP_FILL[g])}{g}</div>
        ))}

      <h4 style={head}>Line — who said so</h4>
      {Object.entries(EVIDENCE_CLASSES).map(([k, v]) => (
        <div key={k} style={row}>
          <svg width="26" height="8" aria-hidden="true" style={{ flex: 'none' }}>
            <line x1="1" y1="4" x2="25" y2="4" stroke={C.dim} strokeWidth="1.4" strokeDasharray={v.dash || undefined} />
          </svg>
          {v.label}
        </div>
      ))}

      <h4 style={head}>What position means</h4>
      <p style={{ margin: 0, fontSize: 12, color: C.faint, lineHeight: 1.6 }}>
        {anchorTiers
          ? 'Each tier is held to its own band, upstream on the left, so horizontal position means documented distance. Everything else is the simulation.'
          : 'Free layout: position means only how the firms connect to each other. Nothing about left or right is a claim.'}
      </p>
    </div>
  );
}

function Cite({ index, sourceIds }) {
  return (
    <>
      {sourceIds.map((id, i) => {
        const s = index.sources[id];
        if (!s) return null;
        return (
          <span key={id}>
            {i > 0 && '; '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
              {s.publisher}, {s.title}
            </a>
          </span>
        );
      })}
    </>
  );
}

function RelRow({ index, link, otherId, onFocus, onSelectLink }) {
  const other = index.companies[otherId];
  const ev = EVIDENCE_CLASSES[link.evidence];
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: '9px 0' }}>
      <button type="button" onClick={() => onFocus?.(otherId)}
        style={{ background: 'none', border: 0, padding: 0, color: C.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
        {other.name}
      </button>
      <span style={{ fontSize: 12, color: C.faint, marginLeft: 6 }}>level {index.tier[otherId] ?? 'outside view'}</span>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
        {link.products.length ? link.products.join(' · ') : <em>relationship named, product not stated</em>}
      </div>
      {link.details.length > 0 && (
        <div style={{ fontSize: 12, color: C.faint, marginTop: 3, lineHeight: 1.55 }}>{link.details.join(' ')}</div>
      )}
      <div style={{ fontSize: 12, color: C.faint, marginTop: 4, lineHeight: 1.55 }}>
        <span style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 5px', marginRight: 5 }}>{ev.short}</span>
        named {link.years.join(', ')} &mdash; <Cite index={index} sourceIds={link.sources} />
        {onSelectLink && (
          <> &middot; <button type="button" onClick={() => onSelectLink(link.key)}
            style={{ background: 'none', border: 0, padding: 0, color: C.accent, fontSize: 12, cursor: 'pointer' }}>highlight</button></>
        )}
      </div>
    </div>
  );
}

/* The side panel pages for the same reason the table does, and more
   urgently: Apple names 187 suppliers, and rendering all of them with
   their citations produced a side panel tens of thousands of pixels
   tall, leaving the graph it is meant to annotate off-screen. The exact
   total is in the heading either way, so paging never hides the count. */
const PANEL_PAGE = 8;

function RelList({ index, links, endOf, onFocus, onSelectLink, emptyText }) {
  const [limit, setLimit] = useState(PANEL_PAGE);
  if (!links.length) {
    return <p style={{ fontSize: 12.5, color: C.faint, fontStyle: 'italic', margin: '6px 0 0' }}>{emptyText}</p>;
  }
  return (
    <>
      {links.slice(0, limit).map((l) => (
        <RelRow key={l.key} index={index} link={l} otherId={endOf(l)} onFocus={onFocus} onSelectLink={onSelectLink} />
      ))}
      {links.length > limit && (
        <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
          <Button variant="quiet" size="sm" onClick={() => setLimit((n) => n + PANEL_PAGE)}>
            {`Show ${Math.min(PANEL_PAGE, links.length - limit)} more`}
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setLimit(links.length)}>
            {`Show all ${links.length}`}
          </Button>
        </div>
      )}
    </>
  );
}

function FirmDetail({ index, id, isRoot = true, onRecentre, onFocus, onSelectLink, onOpenProfile, profileLabel = 'View company profile' }) {
  const c = index.companies[id];
  const t = index.tier[id];
  const sup = index.suppliersOf[id];
  const cus = index.customersOf[id];
  const head = { fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', color: C.faint, margin: '16px 0 0', fontWeight: 600 };

  return (
    <div style={{ border: `1px solid ${isRoot ? C.line : C.accent}`, borderRadius: 6, background: C.panel, padding: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>{c.name}</h3>
        {!isRoot && c.vaultId && (
          <Button variant="quiet" size="sm" onClick={() => onRecentre?.(id)}
            aria-label={`Re-centre the graph on ${c.name}`}>Centre</Button>
        )}
      </div>
      <Button variant="quiet" size="sm" onClick={onOpenProfile}>{profileLabel}</Button>
      <p style={{ margin: '3px 0 0', fontSize: 12, color: C.dim }}>
        Level {t ?? 'outside view'} &middot; {index.countryName(c.country)} &middot; {index.layerName(c.layer)}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: C.faint, lineHeight: 1.55 }}>
        {t === 0
          ? 'Selected company: the graph measures documented distance from here.'
          : `${t} documented step${t === 1 ? '' : 's'} from the selected company. Distance, not rank — it says nothing about size or importance.`}
      </p>
      {c.role && <p style={{ margin: '9px 0 0', fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>{c.role}</p>}

      {(c.annotations || []).map((a, i) => (
        <p key={i} style={{ margin: '11px 0 0', padding: '8px 10px', borderLeft: `2px solid ${C.accent}`, background: accentWash(0.06), fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
          {a.text}<br /><Cite index={index} sourceIds={a.sources} />
        </p>
      ))}

      <h4 style={head}>Named suppliers ({sup.length})</h4>
      <RelList key={`${id}-up`} index={index} links={sup} endOf={(l) => l.supplier}
        onFocus={onFocus} onSelectLink={onSelectLink}
        emptyText="No public document in this set names a supplier to this firm." />

      <h4 style={head}>Named customers ({cus.length})</h4>
      <RelList key={`${id}-down`} index={index} links={cus} endOf={(l) => l.customer}
        onFocus={onFocus} onSelectLink={onSelectLink}
        emptyText="No public document in this set names a customer of this firm." />
    </div>
  );
}

function LinkDetail({ index, link, onClose, onFocus }) {
  const ev = EVIDENCE_CLASSES[link.evidence];
  return (
    <div style={{ border: `1px solid ${C.accent}`, borderRadius: 6, background: C.panel, padding: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>
          <button type="button" onClick={() => onFocus(link.supplier)} style={{ background: 'none', border: 0, padding: 0, color: C.text, font: 'inherit', cursor: 'pointer' }}>
            {index.companies[link.supplier].name}
          </button>
          {' → '}
          <button type="button" onClick={() => onFocus(link.customer)} style={{ background: 'none', border: 0, padding: 0, color: C.text, font: 'inherit', cursor: 'pointer' }}>
            {index.companies[link.customer].name}
          </button>
        </h3>
        <Button variant="quiet" size="sm" onClick={onClose} aria-label="Close this citation">Close</Button>
      </div>

      <p style={{ margin: '9px 0 0', fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
        {link.products.length ? link.products.join(' · ') : <em>relationship named, product not stated</em>}
      </p>
      {link.details.map((d, i) => (
        <p key={i} style={{ margin: '8px 0 0', fontSize: 12.5, color: C.faint, lineHeight: 1.6 }}>{d}</p>
      ))}

      <p style={{ margin: '11px 0 0', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
        <b style={{ color: C.text }}>{ev.label}.</b> {ev.detail}
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: C.faint }}>Named in {link.years.join(', ')}.</p>

      <h4 style={{ fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', color: C.faint, margin: '14px 0 6px', fontWeight: 600 }}>
        The document{link.sources.length > 1 ? 's' : ''}
      </h4>
      <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
        {link.sources.map((id) => {
          const s = index.sources[id];
          return (
            <li key={id} style={{ marginBottom: 8 }}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>{s.publisher}, {s.title}</a>
              <br />
              <span style={{ color: C.faint }}>
                {s.kind}{s.published ? `, ${s.published}` : ''}
                {s.seen === 'fetched' ? ' · retrieved and read' : ' · URL recorded, not opened'}
              </span>
              {s.quote && <><br /><span style={{ color: C.faint }}>&ldquo;{s.quote}&rdquo;</span></>}
            </li>
          );
        })}
      </ul>

      <p style={{ margin: '12px 0 0', fontSize: 12, color: C.faint, lineHeight: 1.55 }}>
        This edge records that the relationship was <b style={{ color: C.dim }}>named in public</b>. It carries no
        volume, no revenue share, no contract and no statement about which side depends on the other.
      </p>
    </div>
  );
}

/* Pages rather than dumps, for the reason the Events feed pages: three
   hundred rows rendered at once produced a forty-thousand-pixel page in
   which the graph above it was unreachable. The count shown and the
   count available are both stated exactly, and "show all" is always
   there — paging is a rendering decision, never a quiet truncation. */
const PAGE = 25;

function RelationshipTable({ index, traversal, onSelectLink, selectedKey, onOpenCompany, defaultOpen = true }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(() => {
    if (!traversal) return [];
    const needle = q.trim().toLowerCase();
    return traversal.links
      .filter((l) => {
        if (!needle) return true;
        return (
          index.companies[l.supplier].name.toLowerCase().includes(needle)
          || index.companies[l.customer].name.toLowerCase().includes(needle)
          || l.products.join(' ').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) =>
        index.companies[a.customer].name.localeCompare(index.companies[b.customer].name)
        || index.companies[a.supplier].name.localeCompare(index.companies[b.supplier].name));
  }, [traversal, q, index]);

  if (!traversal) return null;
  const th = { textAlign: 'left', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, fontWeight: 600, padding: '0 10px 6px 0' };
  const td = { padding: '7px 10px 7px 0', verticalAlign: 'top', borderTop: `1px solid ${C.line}` };

  return (
    <Disclosure defaultOpen={defaultOpen} summary={`Every drawn relationship, with its document (${traversal.links.length})`}>
      <input
        type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
        placeholder="Filter by firm or product&hellip;" aria-label="Filter the relationship table"
        style={{ width: '100%', maxWidth: 420, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 4, padding: '7px 10px', fontSize: 13, margin: '2px 0 10px' }}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
          <caption className="mono" style={{ captionSide: 'top', textAlign: 'left', fontSize: 12, color: C.faint, paddingBottom: 8, lineHeight: 1.6 }}>
            Showing {Math.min(limit, rows.length)} of {rows.length}
            {rows.length === traversal.links.length ? '' : ` matching, out of ${traversal.links.length}`} drawn
            relationships. This table reaches every relationship in the drawn graph at any depth &mdash; the column
            caps above apply to the picture, never to the record.
          </caption>
          <thead>
            <tr>
              <th style={th}>Supplier</th>
              <th style={th}>Customer</th>
              <th style={th}>What the document says</th>
              <th style={th}>Named</th>
              <th style={th}>Who said so</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((l) => (
              <tr key={l.key}
                style={{ background: selectedKey === l.key ? accentWash(0.1) : 'transparent', cursor: 'pointer' }}
                onClick={() => onSelectLink(l.key === selectedKey ? null : l.key)}>
                <td style={{ ...td, color: C.text }}><button type="button" style={{ ...chip, color: C.accent, textAlign: 'left' }}
                  onClick={e => { e.stopPropagation(); onOpenCompany(l.supplier); }}>{index.companies[l.supplier].name}</button>
                  <div style={{ color: C.faint, fontSize: 12 }}>level {index.tier[l.supplier]} &middot; {index.countryName(index.companies[l.supplier].country)}</div>
                </td>
                <td style={{ ...td, color: C.text }}><button type="button" style={{ ...chip, color: C.accent, textAlign: 'left' }}
                  onClick={e => { e.stopPropagation(); onOpenCompany(l.customer); }}>{index.companies[l.customer].name}</button>
                  <div style={{ color: C.faint, fontSize: 12 }}>level {index.tier[l.customer]} &middot; {index.countryName(index.companies[l.customer].country)}</div>
                </td>
                <td style={{ ...td, color: C.dim, maxWidth: 420 }}>
                  {l.products.length ? l.products.join(' · ') : <em style={{ color: C.faint }}>relationship named, product not stated</em>}
                </td>
                <td style={{ ...td, color: C.dim, whiteSpace: 'nowrap' }} className="mono">{l.years.join(', ')}</td>
                <td style={{ ...td, color: C.dim, minWidth: 220 }}>
                  <span style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 5px', fontSize: 12, color: C.faint, marginRight: 5 }}>
                    {EVIDENCE_CLASSES[l.evidence].short}
                  </span>
                  <Cite index={index} sourceIds={l.sources} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <Button variant="quiet" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            {`Show ${Math.min(PAGE, rows.length - limit)} more`}
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setLimit(rows.length)}>
            {`Show all ${rows.length}`}
          </Button>
        </div>
      )}
    </Disclosure>
  );
}
