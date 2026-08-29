import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { facilityIconHtml, FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { facilityImpact, siteWeight } from '../engine/facilities.js';
import { pct } from '../interaction/lensEncoding.js';
import { linkKey, localScale, localRel, relationshipClass } from '../engine/facilityTraversal.js';

/* ====================================================================
   FacilityGraph — one plant and the modeled network around it, on a
   blank background.

   The map answers "where is this". This answers "what is it attached to",
   which is a different question and a worse fit for geography: on a map
   the answer is a fan of long lines across an ocean, where the
   informative part is not the distance but the shape — how many, in which
   direction, at what strength, through which step of the chain.

   So: no basemap, no coastline, no scale. The focus sits in the middle,
   suppliers to the left, customers to the right, ordered by strength.
   That left-to-right convention is the same one the industry flow graph
   uses, so "upstream is left" means the same thing in both panels — and
   it holds at every hop depth: hop 2 upstream is further left again.

   Layout is deterministic — a fixed ladder per column, not a force
   simulation. Two readers looking at the same plant see the same picture,
   and it does not wander while you watch it. A force layout would look
   more organic and would be worse: the positions would carry no meaning
   while implying they did. Multi-hop did not change that judgement; it
   only added columns.

   Every node is the same glyph the map draws (utils/facilityIcon.js), so
   a square is a fab here exactly as it is there.

   HONEST COUNTS. A column shows at most `maxPerColumn` nodes because
   twenty-five labels in one column are unreadable. What it never does is
   imply that is all of them: the caption states the exact visible count
   against the exact total ("showing the strongest 14 of 53 suppliers"),
   and the connection table beside it reaches every single one. The
   previous version said "the list below has all of them" while the list
   was itself capped at 40 — the specific contradiction this replaces.
   ==================================================================== */

const ROW = 34;            // vertical pitch — one label block, so they never collide
const PAD_Y = 52;
const COL_W = 250;         // horizontal pitch per hop
const NODE = 17;

/* Labels were 8–9.5px, which is legible at full width and turns to grey
   fuzz once a 760px SVG is scaled into a 360px sidebar. These are the
   floor; the compact surface scales the whole viewBox up rather than
   shrinking the type further. */
const FS_NAME = 12;
const FS_SUB = 10;

const FLOW_COLOR = { forward: C.copper, service: C.amber, 'co-input': '#7C8AA5' };
/* Pattern as well as colour, so the three relationship classes are
   distinguishable without colour vision. */
const FLOW_DASH = { forward: null, service: '5 4', 'co-input': '1.5 4' };

/* ====================================================================
   MOTION, AND WHAT IT IS ALLOWED TO MEAN.

   The layout stays deterministic — nothing here moves a plant. A node's
   position is still a pure function of its column and its rank, so two
   readers see the same picture and it does not wander while watched.
   What animates is either (a) an entrance, which carries no meaning and
   ends, or (b) direction of flow along an edge, which is the one thing
   the still picture genuinely under-states: an elbow between two glyphs
   does not say which way the output travels, and the arrowless line had
   readers guessing from left/right position alone.

   So the travelling dot is drawn ONLY where direction is a claim the
   data actually supports:
     · forward  — output moves from `from` to `to`. Dot travels that way.
     · service  — the die goes to the supplier and comes back. Dot
                  alternates, because that is what the relationship is.
     · co-input — both ends feed a COMMON downstream step; neither
                  supplies the other. A dot travelling between them would
                  assert a flow the model does not contain, so co-input
                  edges get no dot at all. This is the whole reason the
                  particle set is opt-in per class rather than "all edges".

   Everything is off under prefers-reduced-motion, and the dots are
   @supports-gated so a browser without offset-path shows the same static
   graph rather than a pile of dots parked at the origin. */
export const FLOW_PARTICLES = 44;   // animated dots is a frame-budget, not a data limit
const PARTICLE_ALTERNATE = { service: 'alternate' };

/* Which edges may carry a travelling dot. Exported and pure so the
   co-input exclusion is testable as a rule rather than inferred from the
   rendered DOM — it is the one part of the animation that makes a claim
   about the data, so it is the part worth pinning down. */
export function flowParticleKeys(links, posOf, cap = FLOW_PARTICLES) {
  return new Set(
    (links || [])
      .filter((l) => l.flow !== 'co-input' && posOf?.[l.from] && posOf?.[l.to])
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, cap)
      .map(linkKey),
  );
}

const GRAPH_STYLE = `
  .fg-node { animation: fg-node-in .5s cubic-bezier(.2,.75,.3,1) backwards; transition: transform .16s ease-out; }
  .fg-node:hover, .fg-node:focus-visible { transform: scale(1.13); }
  @keyframes fg-node-in { from { opacity: 0; transform: scale(.68); } to { opacity: 1; transform: scale(1); } }

  .fg-edge { animation: fg-edge-in .6s ease-out backwards; }
  @keyframes fg-edge-in { from { opacity: 0; } }

  .fg-flow { display: none; }
  @supports (offset-path: path('M 0 0 L 1 1')) {
    .fg-flow { display: inline; offset-rotate: 0deg; animation-name: fg-travel; animation-timing-function: linear; animation-iteration-count: infinite; }
  }
  @keyframes fg-travel { from { offset-distance: 0%; } to { offset-distance: 100%; } }

  /* Both animations on one declaration: a route edge still fades in with
     its neighbours, then keeps marching. Two competing \`animation\`
     shorthands on two classes would have let the later rule silently drop
     the entrance instead. */
  .fg-route { animation: fg-edge-in .6s ease-out backwards, fg-march 1s linear infinite; }
  @keyframes fg-march { to { stroke-dashoffset: -24; } }

  .fg-sonar { animation: fg-sonar 3s ease-out infinite; }
  @keyframes fg-sonar { 0% { opacity: .5; transform: scale(.8); } 70%, 100% { opacity: 0; transform: scale(1.55); } }

  .fg-frontier { animation: fg-breathe 2.4s ease-in-out infinite; }
  @keyframes fg-breathe { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }

  @media (prefers-reduced-motion: reduce) {
    .fg-node, .fg-edge, .fg-route, .fg-sonar, .fg-frontier { animation: none !important; transition: none !important; }
    .fg-flow { display: none !important; }
  }
`;

export default function FacilityGraph({
  focusId,
  traversal,
  model,
  onFocus,
  onSelect,
  onSelectLink,
  onToggleExpand,
  selectedLink = null,
  routeLinkKeys = null,
  expanded = [],
  maxPerColumn = 14,
  height: heightProp = null,
  compact = false,
}) {
  const { data } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COMPANY_BY_ID } = data;

  const focus = FACILITY_LAYER.FACILITY_BY_ID[focusId];
  const byId = FACILITY_LAYER.FACILITY_BY_ID;
  const field = model?.activeField || {};
  const expandedSet = useMemo(() => new Set(expanded || []), [expanded]);

  /* One scale for the whole picture: this plant's strongest modeled link.
     Named in the caption. See engine/facilityTraversal.js on why the
     snapshot-wide scale is useless in a single-plant view (almost every
     link rounds to 0%) and why the two must never be shown side by side
     without saying which is which. */
  const scale = useMemo(() => localScale(FACILITY_NETWORK, focusId), [FACILITY_NETWORK, focusId]);

  const layout = useMemo(() => {
    if (!traversal || !focus) return null;

    /* Group every traversed node into a column keyed by signed depth:
       negative upstream (left), positive downstream (right), 0 the focus.
       Deduplication already happened in traverse(); a node appears in
       exactly one column, at the shallowest depth it was reached. */
    const columns = new Map();
    traversal.nodes.forEach((n) => {
      if (n.depth === 0) return;
      const signed = n.dir === 'upstream' ? -n.depth : n.depth;
      if (!columns.has(signed)) columns.set(signed, []);
      columns.get(signed).push(n);
    });

    const strengthOf = (n) => n.via?.weight || 0;
    const totals = {};
    const shown = {};
    columns.forEach((list, signed) => {
      list.sort((a, b) => strengthOf(b) - strengthOf(a) || a.id.localeCompare(b.id));
      totals[signed] = list.length;
    });

    /* WHICH NODES A COLUMN ACTUALLY DRAWS.

       The cap is not the only reason to leave a node out. A node is only
       placeable if the node it was reached THROUGH is itself drawn —
       otherwise the edge that explains its presence has one endpoint
       missing, edge() returns null for it, and the reader is left with a
       plant floating in a column with nothing joining it to the chain. At
       one hop that could not happen (every parent was the focus); opening
       at three made it reachable from three of the 275 plants, so the rule
       is enforced here rather than left to chance.

       Nearest-first, so a parent is always settled before its children are
       considered. The dropped ones are not silently gone: they stay in
       `totals`, which is what the caption counts. */
    const parentOf = (n) => (n.via ? (n.via.from === n.id ? n.via.to : n.via.from) : null);
    const drawnIds = new Set([focus.id]);
    const keep = {};
    [...columns.keys()]
      .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
      .forEach((signed) => {
        const parentDrawn = (n) => { const p = parentOf(n); return !p || drawnIds.has(p); };
        keep[signed] = columns.get(signed).filter(parentDrawn).slice(0, maxPerColumn);
        keep[signed].forEach((n) => drawnIds.add(n.id));
        shown[signed] = keep[signed].length;
      });

    const signedKeys = [...columns.keys()].sort((a, b) => a - b);
    // Geometry ignores a column that ended up with nothing in it, so an
    // emptied hop does not reserve 250px of blank canvas.
    const drawnKeys = signedKeys.filter((k) => shown[k] > 0);
    const minCol = Math.min(0, ...drawnKeys);
    const maxCol = Math.max(0, ...drawnKeys);
    const colCount = maxCol - minCol + 1;

    const width = Math.max(760, colCount * COL_W + 120);
    const tallest = Math.max(1, ...drawnKeys.map((k) => shown[k] || 0));
    const height = heightProp || Math.max(320, tallest * ROW + PAD_Y * 2);
    const usable = height - PAD_Y * 2;

    /* x is a pure function of column index, so a facility never moves
       between renders and the reader can point at "the second column". */
    const xOf = (signed) => 60 + (signed - minCol) * ((width - 120) / Math.max(1, colCount - 1 || 1));
    const cx = colCount === 1 ? width / 2 : xOf(0);

    const placed = [];
    drawnKeys.forEach((signed) => {
      const n = shown[signed];
      const step = n <= 1 ? 0 : usable / (n - 1);
      const top = n <= 1 ? height / 2 : PAD_Y;
      keep[signed].forEach((node, i) => {
        const facility = byId[node.id];
        if (!facility) return;
        placed.push({
          node, facility, signed,
          side: signed < 0 ? 'left' : 'right',
          x: colCount === 1 ? width / 2 : xOf(signed),
          y: top + step * i,
        });
      });
    });

    const posOf = {};
    placed.forEach((p) => { posOf[p.node.id] = p; });
    posOf[focus.id] = { x: cx, y: height / 2, node: { id: focus.id, depth: 0 }, facility: focus, signed: 0 };

    return { placed, posOf, width, height, cx, cy: height / 2, totals, shown, signedKeys, minCol, maxCol };
  }, [traversal, focus, byId, maxPerColumn, heightProp]);

  /* ---- zoom / pan / fit ---- */
  const [view, setView] = useState(null);   // null = fit to the whole network
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  // A new focus or a new hop depth means a new picture; refit rather than
  // leaving the reader looking at empty space where the old graph was.
  useEffect(() => { setView(null); }, [focusId, traversal?.nodes.length]);

  const baseBox = layout ? { x: 0, y: 0, w: layout.width, h: layout.height } : { x: 0, y: 0, w: 760, h: 320 };
  const box = view || baseBox;
  const viewBox = `${box.x} ${box.y} ${box.w} ${box.h}`;

  const zoomBy = useCallback((factor) => {
    setView((prev) => {
      const cur = prev || baseBox;
      const w = Math.max(120, Math.min(baseBox.w * 4, cur.w * factor));
      const h = Math.max(60, Math.min(baseBox.h * 4, cur.h * factor));
      return { x: cur.x + (cur.w - w) / 2, y: cur.y + (cur.h - h) / 2, w, h };
    });
  }, [baseBox.w, baseBox.h]);

  const onPointerDown = (e) => {
    if (e.target.closest('[data-node]')) return;   // dragging a node means clicking it
    dragRef.current = { x: e.clientX, y: e.clientY, box: view || baseBox };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = d.box.w / (rect.width || 1);
    const sy = d.box.h / (rect.height || 1);
    setView({ ...d.box, x: d.box.x - (e.clientX - d.x) * sx, y: d.box.y - (e.clientY - d.y) * sy });
  };
  const endDrag = (e) => {
    dragRef.current = null;
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
  };

  if (!focus || !layout) return null;

  const routeSet = routeLinkKeys instanceof Set ? routeLinkKeys : new Set(routeLinkKeys || []);
  const relOf = (l) => localRel(l, scale);

  /* Strongest first and capped, because this is a frame budget rather than
     a statement about the data — an edge without a dot is not a weaker
     claim, and the caption says so. */
  const particleKeys = flowParticleKeys(traversal.links, layout.posOf);

  /* ---- edges ---- */
  const edge = (l, i) => {
    const a = layout.posOf[l.from];
    const b = layout.posOf[l.to];
    if (!a || !b) return null;                       // an endpoint fell outside the column cap
    const key = linkKey(l);
    const cls = relationshipClass(l);
    const colour = FLOW_COLOR[l.flow] || C.copper;
    const rel = relOf(l);
    const isSel = selectedLink === key;
    const onRoute = routeSet.has(key);

    /* Elbow rather than a straight line: at ladder spacing the straight
       version crosses its own neighbours' labels on the way across. */
    const mid = (a.x + b.x) / 2;
    const d = `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;

    /* One travelling speed across the whole picture rather than one
       duration: a dot crossing a long hop-3 edge in the same second as a
       short hop-1 edge would read as "this link is faster", which is not a
       quantity this model has. Distance/constant, clamped so the extremes
       stay watchable. */
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const travel = Math.min(5.2, Math.max(1.7, span / 95));

    return (
      <g key={key}>
        <path d={d} fill="none"
          className={onRoute ? 'fg-route' : 'fg-edge'}
          style={{ animationDelay: `${Math.min(i * 9, 420)}ms` }}
          stroke={onRoute ? C.green : isSel ? C.text : colour}
          strokeWidth={onRoute || isSel ? 2.6 : 0.7 + 2.4 * rel}
          strokeDasharray={onRoute ? '7 5' : (FLOW_DASH[l.flow] || undefined)}
          opacity={onRoute || isSel ? 1 : 0.3 + 0.55 * rel} />
        {particleKeys.has(key) && (
          <circle className="fg-flow" r={onRoute || isSel ? 3 : 1.5 + 1.4 * rel}
            fill={onRoute ? C.green : isSel ? C.text : colour}
            opacity={onRoute || isSel ? 1 : 0.45 + 0.5 * rel}
            style={{
              offsetPath: `path('${d}')`,
              animationDuration: `${travel}s`,
              /* Negative delay starts each dot part-way along instead of
                 releasing forty of them from the focus in lockstep. */
              animationDelay: `${-((i % 7) * 0.45).toFixed(2)}s`,
              animationDirection: PARTICLE_ALTERNATE[l.flow] || 'normal',
            }}
            aria-hidden />
        )}
        {/* A wide, invisible hit target so a hairline edge is still
            clickable, plus a keyboard stop so every connection — not only
            every facility — is reachable without a mouse. */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={14}
          style={{ cursor: onSelectLink ? 'pointer' : 'default' }}
          role="button" tabIndex={0}
          aria-label={`${cls.label} between ${byId[l.from]?.name || l.from} and ${byId[l.to]?.name || l.to}, ${pct(rel)} of this plant's strongest modeled link. Open its explanation.`}
          onClick={() => onSelectLink?.(key)}
          onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelectLink?.(key); } }}>
          <title>{`${cls.label} · ${pct(rel)} of this plant's strongest modeled link\nmodeled stage-mediated relationship — not a confirmed shipment\nclick for the full explanation`}</title>
        </path>
      </g>
    );
  };

  /* ---- nodes ---- */
  const node = (p, i) => {
    const f = p.facility;
    const impact = facilityImpact(f, field);
    const live = siteWeight(f) > 0;
    const rel = p.node.via ? relOf(p.node.via) : 0;
    const labelAnchor = p.side === 'left' ? 'end' : 'start';
    const labelX = p.x + (p.side === 'left' ? -(NODE / 2 + 8) : NODE / 2 + 8);
    const isExpanded = expandedSet.has(f.id);
    const onFrontier = traversal.frontier.includes(f.id);
    const cls = p.node.via ? relationshipClass(p.node.via) : null;

    return (
      /* transform-box: view-box pins the scale origin to this plant's own
         coordinates, so the entrance and the hover grow OUT OF the glyph
         instead of out of the SVG's top-left corner. The staggered delay
         is capped: past ~600ms the reader is waiting on the picture rather
         than watching it arrive. */
      <g key={f.id} data-node={f.id} className="fg-node"
        style={{
          cursor: 'pointer',
          transformBox: 'view-box',
          transformOrigin: `${p.x}px ${p.y}px`,
          animationDelay: `${Math.min(i * 20, 600)}ms`,
        }}
        onClick={() => onFocus?.(f.id)}
        role="button" tabIndex={0}
        aria-label={`${f.name}, ${COMPANY_BY_ID[f.company]?.name || f.company}, hop ${p.node.depth} ${p.node.dir}. Enter to centre the graph on it.`}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onFocus?.(f.id); }
          if (ev.key === 'e' || ev.key === 'E') { ev.preventDefault(); onToggleExpand?.(f.id); }
          if (ev.key === 'i' || ev.key === 'I') { ev.preventDefault(); onSelect?.({ type: 'facility', id: f.id }); }
        }}>
        <title>
          {`${f.name}\n${COMPANY_BY_ID[f.company]?.name || f.company}`
            + `\nhop ${p.node.depth} ${p.node.dir === 'upstream' ? 'upstream (supplies this chain)' : 'downstream (this chain supplies it)'}`
            + (cls ? `\n${cls.label} · ${pct(rel)} of the focus plant's strongest modeled link` : '')
            + '\nEnter: centre on it · E: expand its own connections · I: full profile'}
        </title>
        <g transform={`translate(${p.x - NODE / 2}, ${p.y - NODE / 2})`}
          dangerouslySetInnerHTML={{ __html: facilityIconHtml({ kind: f.kind, impact, live, size: NODE }) }} />
        {/* Depth ring: hop 2+ nodes carry a marker so a reader can tell
            how far from the focus they are without counting columns. */}
        {p.node.depth > 1 && (
          <circle cx={p.x} cy={p.y} r={NODE / 2 + 4} fill="none" stroke={C.faint} strokeWidth="0.8" strokeDasharray="2 3" />
        )}
        <text x={labelX} y={p.y - 1} textAnchor={labelAnchor} fill={C.text} fontSize={FS_NAME}>
          {f.name.length > 30 ? `${f.name.slice(0, 29)}…` : f.name}
        </text>
        <text x={labelX} y={p.y + FS_SUB + 2} textAnchor={labelAnchor} fill={C.faint} fontSize={FS_SUB}>
          {(COMPANY_BY_ID[f.company]?.name || f.company).slice(0, 22)}
          {p.node.via ? ` · ${pct(rel)}` : ''}
          {p.node.depth > 1 ? ` · hop ${p.node.depth}` : ''}
        </text>
        {/* Expand affordance, only where there is something left to open. */}
        {(onFrontier || isExpanded) && onToggleExpand && (
          <g transform={`translate(${p.x + (p.side === 'left' ? -(NODE / 2 + 6) : NODE / 2 + 6)}, ${p.y + 16})`}
            role="button" tabIndex={0}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} the connections of ${f.name}`}
            onClick={(ev) => { ev.stopPropagation(); onToggleExpand(f.id); }}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); onToggleExpand(f.id); } }}>
            {/* An unopened frontier node is the one place the graph is
                hiding something the reader can still get to, so its
                affordance breathes rather than sitting flat among the
                already-opened ones. */}
            <circle className={onFrontier && !isExpanded ? 'fg-frontier' : undefined}
              r="7.5" fill={C.panel} stroke={isExpanded ? C.copper : C.line} strokeWidth="1" />
            <text y="3.5" textAnchor="middle" fill={isExpanded ? C.copper : C.dim} fontSize="10">{isExpanded ? '−' : '+'}</text>
          </g>
        )}
      </g>
    );
  };

  const focusImpact = facilityImpact(focus, field);
  const upTotal = layout.totals[-1] || 0;
  const downTotal = layout.totals[1] || 0;
  const upShown = layout.shown[-1] || 0;
  const downShown = layout.shown[1] || 0;
  const anyCapped = layout.signedKeys.some((k) => layout.shown[k] < layout.totals[k]);

  /* The hop-1 caption below can say "the table below reaches every one",
     because that table lists every connection OF THE FOCUSED PLANT. It is
     not true one column further out: the table knows nothing about hop-2
     neighbours, so a column cap out there hides facilities that no panel
     on this screen lists. Opening at three hops made that the normal case
     rather than a rarity, so it gets its own line and its own remedy —
     re-centre — instead of being folded into a sentence that would then
     be making a promise the table cannot keep. */
  const deeperHidden = layout.signedKeys
    .filter((k) => Math.abs(k) > 1)
    .reduce((n, k) => n + Math.max(0, (layout.totals[k] || 0) - (layout.shown[k] || 0)), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, marginRight: 'auto' }}>
          ← UPSTREAM · SUPPLIERS &nbsp;|&nbsp; DOWNSTREAM · CUSTOMERS →
        </span>
        <button type="button" onClick={() => zoomBy(1 / 1.3)} style={ctrlStyle} aria-label="Zoom in">＋</button>
        <button type="button" onClick={() => zoomBy(1.3)} style={ctrlStyle} aria-label="Zoom out">－</button>
        <button type="button" onClick={() => setView(null)} style={ctrlStyle} aria-label="Fit the whole network in view">Fit</button>
        <button type="button" onClick={() => setView(null)} style={ctrlStyle} aria-label="Reset the view">Reset view</button>
      </div>

      {/* The graph gets WIDER with depth — one more column per hop — and an
          SVG pinned to width:100% answers that by scaling itself down, which
          spends the whole increase on shrinking the type. At three hops that
          put every label under 9px, the floor this file sets a few lines
          above FS_NAME, and turned the labels into the grey fuzz that floor
          exists to prevent.

          So the box stops shrinking at its natural width and the container
          scrolls instead. Below that width the picture is pannable (and
          scrollable) rather than illegible; above it, it still fills the
          space. Type size is therefore never a function of hop depth. */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%' }}>
      <svg ref={svgRef} viewBox={viewBox} width="100%"
        style={{ display: 'block', minWidth: layout.width, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, touchAction: 'none', maxHeight: compact ? 380 : '62vh' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        role="img"
        aria-label={`Modeled connection graph centred on ${focus.name}: ${traversal.nodes.length - 1} connected facilities drawn, ${traversal.links.length} modeled relationships. A complete, searchable table of every connection is provided below this graph.`}>

        <style>{GRAPH_STYLE}</style>

        <text x={16} y={20} fill={C.faint} fontSize="10" letterSpacing="1.2">
          ← SUPPLIED BY ({upShown === upTotal ? upTotal : `${upShown} of ${upTotal}`})
        </text>
        <text x={layout.width - 16} y={20} textAnchor="end" fill={C.faint} fontSize="10" letterSpacing="1.2">
          SUPPLIES → ({downShown === downTotal ? downTotal : `${downShown} of ${downTotal}`})
        </text>

        {traversal.links.map(edge)}
        {layout.placed.map(node)}

        {/* the focus, drawn last so it sits on top of its own edges */}
        {/* Two sonar rings half a cycle apart, purely to say "you are here"
            on a picture that now reaches three hops in both directions and
            no longer has an obvious middle. They are decoration and encode
            nothing — no radius, count or rate is read from the data. */}
        {[0, 1.5].map((delay) => (
          <circle key={delay} className="fg-sonar" cx={layout.cx} cy={layout.cy} r={38}
            fill="none" stroke={C.copper} strokeWidth="1.1" aria-hidden
            style={{ transformBox: 'view-box', transformOrigin: `${layout.cx}px ${layout.cy}px`, animationDelay: `${delay}s` }} />
        ))}
        <circle cx={layout.cx} cy={layout.cy} r={32} fill={C.panel} stroke={C.copper} strokeWidth="2.4" />
        <circle cx={layout.cx} cy={layout.cy} r={38} fill="none" stroke={C.copper} strokeWidth="0.8" opacity="0.5" />
        <g transform={`translate(${layout.cx - 14}, ${layout.cy - 14})`}
          dangerouslySetInnerHTML={{ __html: facilityIconHtml({ kind: focus.kind, impact: focusImpact, live: siteWeight(focus) > 0, size: 28, selected: true }) }} />
        <text x={layout.cx} y={layout.cy + 54} textAnchor="middle" fill={C.text} fontSize="13" fontWeight="700">
          {focus.name.length > 42 ? `${focus.name.slice(0, 41)}…` : focus.name}
        </text>
        <text x={layout.cx} y={layout.cy + 68} textAnchor="middle" fill={C.copper} fontSize="10">
          {FACILITY_KIND_LABEL[focus.kind] || focus.kind} · {COMPANY_BY_ID[focus.company]?.name || focus.company}
        </text>

        {deeperHidden > 0 && (
          <text x={layout.cx} y={layout.height - 26} textAnchor="middle" fill={C.amber} fontSize="10">
            {`${deeperHidden} more facilities at hop 2 or deeper are reachable but not drawn — centre on a nearer plant to see its own connections in full`}
          </text>
        )}
        {anyCapped && (
          <text x={layout.cx} y={layout.height - 12} textAnchor="middle" fill={C.amber} fontSize="10">
            {`showing the strongest ${upShown} of ${upTotal} suppliers and ${downShown} of ${downTotal} customers — the table below reaches every one`}
          </text>
        )}
      </svg>
      </div>

      <div className="mono" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 9.5, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>
        <span style={{ color: FLOW_COLOR.forward }}>——— upstream supply (output flows toward the customer)</span>
        <span style={{ color: FLOW_COLOR.service }}>– – – service (the die flows to the supplier and back)</span>
        <span style={{ color: FLOW_COLOR['co-input'] }}>· · · co-input (both feed a common downstream step)</span>
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 4, lineHeight: 1.6 }}>
        A travelling dot shows which way output moves along a link — one way for supply, back and forth for a service
        relationship. <b style={{ color: C.dim }}>Co-input links carry no dot</b>, because neither end supplies the
        other. Only the strongest {FLOW_PARTICLES} links are animated, to keep the frame rate up on a large network:
        an undotted line is not a weaker relationship, and speed encodes distance on screen, never anything measured.
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 4, lineHeight: 1.6 }}>
        Percentages and line thickness on this graph are relative to <b style={{ color: C.dim }}>{focus.name}</b>&apos;s
        strongest modeled link — a local scale. The connection table uses the snapshot-wide scale and labels it as
        such; the two numbers are not comparable and are never shown as if they were. Positions are fixed, not a
        simulation, and do not move between viewings. Every line is a <b style={{ color: C.dim }}>modeled
        stage-mediated relationship</b>, never a confirmed shipment, contract or trade route.
      </div>
      {traversal.truncated && (
        <div className="mono" style={{ fontSize: 9.5, color: C.amber, marginTop: 4, lineHeight: 1.6 }}>
          The traversal hit its node budget before it finished. {traversal.reachableTotal} facilities are reachable
          from here at this depth and direction; the graph is drawing the first {traversal.nodes.length}. Narrow the
          direction, lower the hop depth, or use the table below, which is not capped.
        </div>
      )}
    </div>
  );
}

const ctrlStyle = {
  fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0, minWidth: 28,
};
