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
      shown[signed] = Math.min(list.length, maxPerColumn);
    });

    const signedKeys = [...columns.keys()].sort((a, b) => a - b);
    const minCol = Math.min(0, ...signedKeys);
    const maxCol = Math.max(0, ...signedKeys);
    const colCount = maxCol - minCol + 1;

    const width = Math.max(760, colCount * COL_W + 120);
    const tallest = Math.max(1, ...signedKeys.map((k) => shown[k] || 0));
    const height = heightProp || Math.max(320, tallest * ROW + PAD_Y * 2);
    const usable = height - PAD_Y * 2;

    /* x is a pure function of column index, so a facility never moves
       between renders and the reader can point at "the second column". */
    const xOf = (signed) => 60 + (signed - minCol) * ((width - 120) / Math.max(1, colCount - 1 || 1));
    const cx = colCount === 1 ? width / 2 : xOf(0);

    const placed = [];
    columns.forEach((list, signed) => {
      const n = shown[signed];
      const step = n <= 1 ? 0 : usable / (n - 1);
      const top = n <= 1 ? height / 2 : PAD_Y;
      list.slice(0, n).forEach((node, i) => {
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

  /* ---- edges ---- */
  const edge = (l) => {
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

    return (
      <g key={key}>
        <path d={d} fill="none"
          stroke={onRoute ? C.green : isSel ? C.text : colour}
          strokeWidth={onRoute || isSel ? 2.6 : 0.7 + 2.4 * rel}
          strokeDasharray={FLOW_DASH[l.flow] || undefined}
          opacity={onRoute || isSel ? 1 : 0.3 + 0.55 * rel} />
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
  const node = (p) => {
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
      <g key={f.id} data-node={f.id} style={{ cursor: 'pointer' }}
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
            <circle r="7.5" fill={C.panel} stroke={isExpanded ? C.copper : C.line} strokeWidth="1" />
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

      <svg ref={svgRef} viewBox={viewBox} width="100%"
        style={{ display: 'block', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, touchAction: 'none', maxHeight: compact ? 380 : '62vh' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        role="img"
        aria-label={`Modeled connection graph centred on ${focus.name}: ${traversal.nodes.length - 1} connected facilities drawn, ${traversal.links.length} modeled relationships. A complete, searchable table of every connection is provided below this graph.`}>

        <text x={16} y={20} fill={C.faint} fontSize="10" letterSpacing="1.2">
          ← SUPPLIED BY ({upShown === upTotal ? upTotal : `${upShown} of ${upTotal}`})
        </text>
        <text x={layout.width - 16} y={20} textAnchor="end" fill={C.faint} fontSize="10" letterSpacing="1.2">
          SUPPLIES → ({downShown === downTotal ? downTotal : `${downShown} of ${downTotal}`})
        </text>

        {traversal.links.map(edge)}
        {layout.placed.map(node)}

        {/* the focus, drawn last so it sits on top of its own edges */}
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

        {anyCapped && (
          <text x={layout.cx} y={layout.height - 12} textAnchor="middle" fill={C.amber} fontSize="10">
            {`showing the strongest ${upShown} of ${upTotal} suppliers and ${downShown} of ${downTotal} customers — the table below reaches every one`}
          </text>
        )}
      </svg>

      <div className="mono" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 9.5, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>
        <span style={{ color: FLOW_COLOR.forward }}>——— upstream supply (output flows toward the customer)</span>
        <span style={{ color: FLOW_COLOR.service }}>– – – service (the die flows to the supplier and back)</span>
        <span style={{ color: FLOW_COLOR['co-input'] }}>· · · co-input (both feed a common downstream step)</span>
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
