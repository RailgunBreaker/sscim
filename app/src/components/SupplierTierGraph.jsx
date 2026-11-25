import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { C } from '../theme.js';
import { EVIDENCE_CLASSES, chainGroup } from '../engine/supplierTiers.js';
import { createLayout, neighbourhood, placeLabels } from '../engine/supplierForce.js';

/* ====================================================================
   SupplierTierGraph — the documented supplier network as a settling
   force-directed graph you can actually handle.

   It is built the way the reference network this lens was modelled on
   builds: a physics simulation that starts tangled and settles while
   you watch, with a progress readout, and a click that lifts a firm's
   two-degree neighbourhood out of the field while everything else fades
   to grey and drops its label.

   THE VIEWPORT. Three hundred firms do not fit in one legible frame, so
   the graph is a workspace rather than a picture:

     · wheel or the +/- controls zoom, around the pointer rather than
       around the centre, because zooming toward what you are looking at
       is the only version that feels like magnification rather than
       teleportation
     · dragging the background pans
     · dragging a NODE moves it and pins it there, and the graph relaxes
       around it at low temperature — the arrangement you make by hand
       survives, which is the whole reason to allow dragging at all
     · Fit returns to the whole graph, Release frees every pinned node
     · full screen hands the whole viewport to the graph

   Keyboard parity throughout: +/- zoom, 0 fits, arrows pan, and every
   node is tabbable with Enter to centre and Space to lift its
   neighbourhood. A graph you can only use with a mouse is a graph half
   the readers cannot use.

   TWO THINGS THE REFERENCE DID NOT DO, both added because without them
   the picture makes claims it cannot support:

   1. It is DETERMINISTIC. Positions come from a seeded simulation
      (engine/supplierForce.js), so the same firm always draws the same
      picture until someone drags it.

   2. There is NO SIZE OR THICKNESS RAMP FROM STRENGTH, because this
      dataset has no strengths. Node radius encodes the NUMBER OF
      DOCUMENTS naming a firm, which is a fact about disclosure, and the
      caption says exactly that. Edge width is constant.
   ==================================================================== */

const NODE_MIN = 5.5;
const NODE_MAX = 17;
const FS_NAME = 12;
const FS_SUB = 11;
const LABEL_BUDGET = 70;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const DRAG_THRESHOLD = 4;   // px before a press becomes a drag, not a click

const TIER_FILL = ['#F2F5F9', '#A8C4E8', '#7FA3D8', '#5A7CAA', '#415A80', '#33425C'];
export const tierFill = (t) => TIER_FILL[Math.min(t ?? TIER_FILL.length - 1, TIER_FILL.length - 1)];

export const GROUP_FILL = {
  'Equipment & optics': '#6E9BD6',
  'Wafers & masks': '#45AFB5',
  'Materials & metals': '#DCD3AE',
  Chips: '#A98BD6',
  'Packaging, boards & components': '#D47FA6',
  'Modules, assembly & brand': '#C8A15C',
  'Fab build & services': '#94A1AE',
};

const GRAPH_STYLE = `
  .stg-node { transition: opacity .18s ease-out; }
  .stg-node circle.stg-dot { transition: r .16s ease-out; }
  .stg-node:hover circle.stg-dot, .stg-node:focus-visible circle.stg-dot { r: var(--r-hover); }
  .stg-edge { transition: opacity .18s ease-out, stroke .18s ease-out; }
  .stg-surface { touch-action: none; min-width: 0; }
  .stg-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
  .stg-legend { grid-column: 2; grid-row: 1; margin: 12px 12px 12px 0; max-height: 610px; overflow-y: auto; }
  .stg-caption { grid-column: 1 / -1; }
  @container (max-width: 760px) {
    .stg-workspace { grid-template-columns: minmax(0, 1fr); }
    .stg-legend { grid-column: 1; grid-row: auto; margin: 0 12px 12px; max-height: 360px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .stg-node, .stg-node circle.stg-dot, .stg-edge { transition: none; }
  }
`;

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const btn = (active) => ({
  background: active ? C.accent : C.panel,
  color: active ? '#0C1218' : C.dim,
  border: `1px solid ${active ? C.accent : C.line}`,
  borderRadius: 4,
  width: 30,
  height: 28,
  fontSize: 13,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
});

const wideBtn = { ...btn(false), width: 'auto', padding: '0 9px', fontSize: 12 };

export default function SupplierTierGraph({
  index, traversal, colourBy = 'tier', anchorTiers = true, compact = false,
  selectedKey = null, onFocus, onSelectLink, overlay = null,
}) {
  const markerId = useId().replace(/:/g, "");
  const { companies, tier } = index;
  const [, setTick] = useState(0);
  const [progress, setProgress] = useState(0);
  const [picked, setPicked] = useState(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [dragging, setDragging] = useState(null);     // node id, for the cursor

  const layoutRef = useRef(null);
  const frameRef = useRef(0);
  const svgRef = useRef(null);
  const shellRef = useRef(null);
  const gestureRef = useRef(null);
  const relaxRef = useRef(0);

  const nodeIds = useMemo(() => (traversal ? traversal.nodes.map((n) => n.id) : []), [traversal]);
  const links = traversal ? traversal.links : [];

  /* ---- the simulation ---- */
  useEffect(() => {
    cancelAnimationFrame(relaxRef.current);
    relaxRef.current = 0;
    gestureRef.current = null;
    setDragging(null);
    if (!nodeIds.length) return undefined;
    const signedHop = Object.fromEntries(traversal.nodes.map(n => [n.id, n.hop]));
    const maxT = Math.max(...Object.values(signedHop));
    const minT = Math.min(...Object.values(signedHop));
    const span = Math.max(1, maxT - minT);
    const tierX = anchorTiers
      ? (id) => {
        const t = signedHop[id];
        if (t === undefined) return null;
        const band = (compact ? 230 : 330) + Math.sqrt(nodeIds.length) * (compact ? 9 : 16);
        return ((t - minT) / span - 0.5) * 2 * band;
      }
      : null;

    const layout = createLayout(nodeIds, links, {
      tierX,
      width: compact ? 760 : 1180,
      height: compact ? 420 : 660,
    });
    layoutRef.current = layout;
    setPicked(null);
    setProgress(0);
    setPinnedCount(0);
    setView({ k: 1, tx: 0, ty: 0 });

    if (prefersReducedMotion()) {
      layout.run(layout.total);
      setProgress(1);
      setTick((v) => v + 1);
      return undefined;
    }

    let cancelled = false;
    const pump = () => {
      if (cancelled) return;
      layout.run(14);
      setProgress(layout.progress);
      setTick((v) => v + 1);
      if (!layout.done) frameRef.current = requestAnimationFrame(pump);
    };
    frameRef.current = requestAnimationFrame(pump);
    return () => { cancelled = true; cancelAnimationFrame(frameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds, anchorTiers, compact]);

  /* Keep one animation loop alive throughout a drag. The held node is
     pinned; springs and repulsion move its neighbours on every frame. */
  const relax = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const held = gestureRef.current?.nodeId && gestureRef.current.moved;
    layout.reheat(held ? 120 : 70);
    if (prefersReducedMotion()) {
      layout.run(held ? 2 : 120);
      setTick(v => v + 1);
      return;
    }
    if (relaxRef.current) return;
    const pump = () => {
      relaxRef.current = 0;
      if (layoutRef.current !== layout) return;
      const draggingNode = gestureRef.current?.nodeId && gestureRef.current.moved;
      if (draggingNode) layout.reheat(120);
      layout.run(2);
      setTick((v) => v + 1);
      if (draggingNode || !layout.done) relaxRef.current = requestAnimationFrame(pump);
    };
    relaxRef.current = requestAnimationFrame(pump);
  }, []);

  useEffect(() => () => cancelAnimationFrame(relaxRef.current), []);

  /* ---- full screen ---- */
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => { /* refused: stay inline */ });
  }, []);

  const halo = useMemo(
    () => (picked ? neighbourhood(links, picked, 2) : null),
    [picked, links],
  );

  const layout = layoutRef.current;
  const pos = layout ? layout.positions() : null;
  const box = useMemo(
    /* Wider than it is tall, because the names are drawn beside the
       nodes and the firms at the edges are the ones that get cut. */
    () => gestureRef.current?.bounds || (layout ? layout.bounds(compact ? 70 : 100, compact ? 110 : 140) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, compact, progress],
  );

  /* Pointer position in LAYOUT coordinates, undoing both the viewBox
     mapping and the current zoom/pan. Everything that has to agree with
     where the reader is pointing goes through this one function. */
  const toLayout = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const inSvg = pt.matrixTransform(ctm.inverse());
    return { x: (inSvg.x - view.tx) / view.k, y: (inSvg.y - view.ty) / view.k, raw: inSvg };
  }, [view]);

  /* ---- zoom ---- */
  const zoomAround = useCallback((factor, anchorSvg) => {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      if (k === v.k) return v;
      const a = anchorSvg || { x: (box ? box.minX + box.w / 2 : 0), y: (box ? box.minY + box.h / 2 : 0) };
      /* Hold the anchor point still: the content under the pointer must
         be the content under the pointer afterwards. */
      return { k, tx: a.x - ((a.x - v.tx) / v.k) * k, ty: a.y - ((a.y - v.ty) / v.k) * k };
    });
  }, [box]);

  const onWheel = useCallback((e) => {
    if (!box) return;
    e.preventDefault();
    const p = toLayout(e);
    zoomAround(Math.exp(-e.deltaY * 0.0014), p ? p.raw : null);
  }, [box, toLayout, zoomAround]);

  /* Wheel is attached non-passively, because a passive listener cannot
     preventDefault and the page would scroll instead of the graph
     zooming. React's onWheel is passive, so this is done by hand. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const fit = useCallback(() => setView({ k: 1, tx: 0, ty: 0 }), []);

  const releaseAll = useCallback(() => {
    const l = layoutRef.current;
    if (!l) return;
    l.unpin();
    setPinnedCount(0);
    relax();
  }, [relax]);

  /* ---- pointer gestures: pan the field, drag a node ---- */
  const startGesture = useCallback((e, nodeId) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = toLayout(e);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gestureRef.current = {
      nodeId: nodeId ?? null,
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startLayout: p,
      startView: { ...view },
      bounds: box,
      moved: false,
    };
    if (nodeId) setDragging(nodeId);
  }, [toLayout, view, box]);

  const moveGesture = useCallback((e) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dxClient = e.clientX - g.startClient.x;
    const dyClient = e.clientY - g.startClient.y;
    if (!g.moved && Math.hypot(dxClient, dyClient) < DRAG_THRESHOLD) return;
    g.moved = true;

    const p = toLayout(e);
    if (!p) return;

    if (g.nodeId) {
      // Stop the initial settling loop and hold the camera steady while dragging.
      cancelAnimationFrame(frameRef.current);
      setProgress(1);
      layoutRef.current?.place(g.nodeId, p.x, p.y);
      relax();
    } else {
      /* Panning moves the view by the raw SVG delta, not the layout
         delta, so the field tracks the cursor one-for-one at any zoom. */
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!ctm) return;
      const scaleX = ctm.a || 1;
      const scaleY = ctm.d || 1;
      setView({ k: g.startView.k, tx: g.startView.tx + dxClient / scaleX, ty: g.startView.ty + dyClient / scaleY });
    }
  }, [toLayout, relax]);

  const endGesture = useCallback((e) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    setDragging(null);
    if (g.nodeId && g.moved) {
      setPinnedCount(layoutRef.current?.pinnedCount() ?? 0);
      relax();
    }
    return g;
  }, [relax]);

  /* ---- keyboard ---- */
  const onKeyDown = useCallback((e) => {
    const step = 60 / view.k;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAround(1.25, null); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAround(0.8, null); }
    else if (e.key === '0') { e.preventDefault(); fit(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setView((v) => ({ ...v, tx: v.tx + step })); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setView((v) => ({ ...v, tx: v.tx - step })); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setView((v) => ({ ...v, ty: v.ty + step })); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setView((v) => ({ ...v, ty: v.ty - step })); }
  }, [view.k, zoomAround, fit]);

  if (!traversal || !nodeIds.length || !layout || !pos || !box) {
    return <div style={{ height: compact ? 260 : 360 }} aria-hidden="true" />;
  }

  const maxDeg = Math.max(1, ...nodeIds.map((id) => pos[id]?.deg ?? 0));
  const radius = (id) => {
    if (id === traversal.rootId) return NODE_MAX;
    const d = pos[id]?.deg ?? 0;
    return NODE_MIN + (NODE_MAX - NODE_MIN - 3) * Math.sqrt(d / maxDeg);
  };

  const fillOf = (id) =>
    colourBy === 'tier' ? tierFill(tier[id]) : GROUP_FILL[chainGroup(companies[id].layer)];

  const dim = (id) => (halo ? !halo.has(id) : false);
  const near = (id) => (halo ? halo.get(id) : undefined);

  const labelOrder = [...nodeIds].sort((a, b) => {
    if (a === traversal.rootId) return -1;
    if (b === traversal.rootId) return 1;
    if (halo) {
      const da = halo.has(a) ? halo.get(a) : 9;
      const db = halo.has(b) ? halo.get(b) : 9;
      if (da !== db) return da - db;
    }
    return (pos[b]?.deg ?? 0) - (pos[a]?.deg ?? 0);
  });
  const shortName = (id) => {
    const n = companies[id].name;
    return n.length > 34 ? `${n.slice(0, 33)}…` : n;
  };
  /* The label budget grows as the reader zooms in: at 3x there is three
     times the room between nodes, and withholding names then would be
     withholding them for no reason. Collision rejection still decides. */
  const budget = Math.round(LABEL_BUDGET * Math.min(3, Math.max(1, view.k)));
  const labelled = placeLabels(labelOrder.slice(0, budget), pos, {
    radiusOf: radius,
    labelOf: shortName,
    charWidth: 6.1 / view.k,
    lineHeight: 15 / view.k,
  });

  const edge = (l) => {
    const a = pos[l.supplier];
    const b = pos[l.customer];
    if (!a || !b) return null;
    const ev = EVIDENCE_CLASSES[l.evidence];
    const selected = selectedKey === l.key;
    const faded = halo ? (!halo.has(l.supplier) || !halo.has(l.customer)) : false;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const cx = mx - (dy / d) * d * 0.09;
    const cy = my + (dx / d) * d * 0.09;
    // Keep arrowheads outside the node circles, including while zooming.
    const al = Math.hypot(cx - a.x, cy - a.y) || 1;
    const bl = Math.hypot(b.x - cx, b.y - cy) || 1;
    const ap = Math.min(radius(l.supplier) + 3 / view.k, d / 3);
    const bp = Math.min(radius(l.customer) + 5 / view.k, d / 3);
    const path = `M ${a.x + (cx - a.x) / al * ap} ${a.y + (cy - a.y) / al * ap} Q ${cx} ${cy} ${b.x - (b.x - cx) / bl * bp} ${b.y - (b.y - cy) / bl * bp}`;

    return (
      <g key={l.key} className="stg-edge" opacity={faded ? 0.07 : selected ? 1 : 0.7}>
        <path d={path} fill="none"
          stroke={selected ? C.accent : C.dim}
          strokeWidth={(selected ? 2 : 1.2) / view.k}
          strokeDasharray={ev.dash ? ev.dash.split(' ').map((v) => Number(v) / view.k).join(' ') : undefined}
          markerEnd={`url(#${markerId}-arrow${selected ? '-sel' : ''})`} />
        <path d={path} fill="none" stroke="transparent" strokeWidth={12 / view.k}
          style={{ cursor: onSelectLink ? 'pointer' : 'default' }}
          role="button" tabIndex={0}
          aria-label={`${companies[l.supplier].name} supplies ${companies[l.customer].name}. ${ev.label}. Open the citation.`}
          onClick={(e) => { e.stopPropagation(); onSelectLink?.(l.key); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLink?.(l.key); } }}>
          <title>
            {`${companies[l.supplier].name} → ${companies[l.customer].name}`
              + `\n${l.products.join(' · ') || 'relationship named, product not stated'}`
              + `\nnamed ${l.years.join(', ')} · ${ev.label}`
              + '\nclick for the document behind it'}
          </title>
        </path>
      </g>
    );
  };

  const node = (id) => {
    const p = pos[id];
    if (!p) return null;
    const c = companies[id];
    const t = tier[id];
    const isRoot = id === traversal.rootId;
    const r = radius(id);
    const faded = dim(id);
    const degree = near(id);
    const onFrontier = traversal.frontier.includes(id);
    const showLabel = !faded && labelled.has(id);
    const pinnedHere = layout.isPinned(id);
    const fill = faded ? 'rgba(130,138,148,0.30)' : degree === 2 ? 'rgba(140,150,164,0.62)' : fillOf(id);

    return (
      <g key={id} className="stg-node" opacity={faded ? 0.5 : 1}
        style={{ cursor: dragging === id ? 'grabbing' : 'grab', '--r-hover': `${r + 2.5}px` }}
        role="button" tabIndex={0}
        aria-label={`${c.name}, level ${t}, ${index.countryName(c.country)}, ${index.layerName(c.layer)}, named in ${index.suppliersOf[id].length + index.customersOf[id].length} documented relationships.${pinnedHere ? ' Pinned in place.' : ''} Enter to centre the graph on it, Space to lift its neighbourhood.`}
        onPointerDown={(e) => { e.stopPropagation(); startGesture(e, id); }}
        onPointerMove={moveGesture}
        onPointerUp={(e) => {
          e.stopPropagation();
          const g = endGesture(e);
          if (g && !g.moved) { setPicked(id === picked ? null : id); onFocus?.(id, { recentre: false }); }
        }}
        onPointerCancel={endGesture}
        onDoubleClick={(e) => { e.stopPropagation(); onFocus?.(id, { recentre: true }); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onFocus?.(id, { recentre: true }); }
          if (e.key === ' ') { e.preventDefault(); setPicked(id === picked ? null : id); onFocus?.(id, { recentre: false }); }
        }}>
        <title>
          {`${c.name}\n${index.countryName(c.country)} · ${index.layerName(c.layer)}`
            + `\nlevel ${t} — ${t === 0 ? 'selected company' : `${t} documented step${t === 1 ? '' : 's'} from the selected company`}`
            + `\n${index.suppliersOf[id].length} named suppliers · ${index.customersOf[id].length} named customers`
            + (onFrontier ? '\nhas further documented suppliers beyond this depth' : '')
            + (pinnedHere ? '\npinned where you put it' : '')
            + '\ndrag to move it · click to lift its neighbourhood · double-click to centre on it'}
        </title>
        {isRoot && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={C.text} strokeWidth={1.1 / view.k} opacity={faded ? 0.3 : 0.75} />}
        {onFrontier && !isRoot && (
          <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke={C.faint} strokeWidth={0.8 / view.k} strokeDasharray={`${2 / view.k} ${3 / view.k}`} opacity={faded ? 0.25 : 0.9} />
        )}
        {/* A pinned node is marked, because a reader who drags one and
            then wonders why the layout stopped obeying the physics is
            owed the reason on the node itself. */}
        {pinnedHere && !faded && (
          <circle cx={p.x} cy={p.y} r={r + 2.5} fill="none" stroke={C.accent} strokeWidth={1.4 / view.k} />
        )}
        <circle className="stg-dot" cx={p.x} cy={p.y} r={r} fill={fill} />
        {showLabel && (
          <>
            <text x={p.x} y={p.y - r - 6 / view.k} textAnchor="middle" fill={C.text} fontSize={FS_NAME / view.k}
              stroke={C.panel2} strokeWidth={3.5 / view.k} paintOrder="stroke" strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}>
              {shortName(id)}
            </text>
            {(isRoot || (halo && degree <= 1)) && (
              <text x={p.x} y={p.y + r + (FS_SUB + 3) / view.k} textAnchor="middle" fill={C.faint} fontSize={FS_SUB / view.k}
                stroke={C.panel2} strokeWidth={3 / view.k} paintOrder="stroke" strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}>
                {`T${t} · ${index.countryName(c.country)}`}
              </text>
            )}
          </>
        )}
      </g>
    );
  };

  const unlabelled = nodeIds.length - labelled.size;
  const settling = progress < 1;
  const zoomPct = `${Math.round(view.k * 100)}%`;
  const moved = view.k !== 1 || view.tx !== 0 || view.ty !== 0;

  return (
    <div ref={shellRef} style={{
      containerType: 'inline-size',
      position: 'relative',
      background: C.panel2,
      borderRadius: fullscreen ? 0 : 6,
      border: `1px solid ${C.line}`,
      height: fullscreen ? '100vh' : undefined,
      display: fullscreen ? 'flex' : undefined,
      flexDirection: fullscreen ? 'column' : undefined,
    }}>
      <div className="stg-workspace" style={{ minHeight: 0, flex: fullscreen ? 1 : undefined }}>
      <svg
        ref={svgRef}
        className="stg-surface"
        viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
        width="100%"
        style={{
          display: 'block',
          height: fullscreen ? '100%' : compact ? 400 : 640,
          flex: fullscreen ? 1 : undefined,
          cursor: dragging ? 'grabbing' : 'grab',
          outline: 'none',
        }}
        role="application"
        tabIndex={0}
        aria-label={`Publicly documented supplier network around ${companies[traversal.rootId].name}: ${nodeIds.length} firms and ${links.length} named relationships. Drag to pan, drag a firm to move it, plus and minus to zoom, 0 to fit.`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => startGesture(e, null)}
        onPointerMove={moveGesture}
        onPointerUp={(e) => {
          const g = endGesture(e);
          if (g && !g.moved) setPicked(null);
        }}
        onPointerCancel={endGesture}
      >
        <style>{GRAPH_STYLE}</style>
        <defs>
          <marker id={`${markerId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={C.dim} />
          </marker>
          <marker id={`${markerId}-arrow-sel`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={C.accent} />
          </marker>
        </defs>
        {/* A transparent plate so a press anywhere in the field starts a
            pan — without it, dragging only works over drawn pixels. */}
        <rect x={box.minX} y={box.minY} width={box.w} height={box.h} fill="transparent" />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {links.map(edge)}
          {nodeIds.map(node)}
        </g>
      </svg>

      {/* ---- viewport controls, top-left so the overlay panel owns the
             right-hand side of the canvas ---- */}
      <div style={{
        position: 'absolute', left: 10, top: 10, display: 'flex', flexDirection: 'column', gap: 5,
        alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" style={btn(false)} aria-label="Zoom in" title="Zoom in (+)"
            onClick={() => zoomAround(1.25, null)}>+</button>
          <button type="button" style={btn(false)} aria-label="Zoom out" title="Zoom out (−)"
            onClick={() => zoomAround(0.8, null)}>−</button>
          <button type="button" style={{ ...wideBtn, opacity: moved ? 1 : 0.55 }} disabled={!moved}
            aria-label="Fit the whole graph in view" title="Fit to view (0)" onClick={fit}>Fit</button>
          <button type="button" style={btn(fullscreen)}
            aria-label={fullscreen ? 'Leave full screen' : 'Show the graph full screen'}
            title={fullscreen ? 'Leave full screen' : 'Full screen'}
            onClick={toggleFullscreen}>{fullscreen ? '✕' : '⛶'}</button>
        </div>
        {pinnedCount > 0 && (
          <button type="button" style={{ ...wideBtn, borderColor: C.accent, color: C.accent }}
            aria-label={`Release all ${pinnedCount} pinned firms`} title="Release pinned firms"
            onClick={releaseAll}>{`Release ${pinnedCount}`}</button>
        )}
      </div>

      {/* Reserved legend space; stacks below the graph on narrow screens. */}
      {overlay && (
        <aside className="stg-legend" aria-label="Graph legend and selection" style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
          padding: 16, overscrollBehavior: 'contain',
        }}>
          {overlay}
        </aside>
      )}

      <div className="mono" style={{
        position: 'absolute', right: 10, bottom: 10, fontSize: 12, color: C.faint,
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: '2px 7px',
        pointerEvents: 'none',
      }}>{zoomPct}</div>

      {settling && (
        <div className="mono" aria-live="polite" style={{
          position: 'absolute', left: 10, bottom: 10, background: C.panel, border: `1px solid ${C.line}`,
          borderRadius: 4, padding: '5px 9px', fontSize: 12, color: C.dim, pointerEvents: 'none',
        }}>
          {`Settling ${nodeIds.length} firms… ${Math.round(progress * 100)}%`}
        </div>
      )}

      {!fullscreen && (
        <p className="mono stg-caption" style={{
          fontSize: 12, color: C.faint, margin: 0, padding: '7px 10px 9px', lineHeight: 1.65,
          borderTop: `1px solid ${C.line}`,
        }}>
          {nodeIds.length} firms, {links.length} named relationships.
          {' '}Dot size is the <b style={{ color: C.dim }}>number of documented relationships</b> a firm has here &mdash;
          a fact about how often it is named in these publications, not about how much it supplies.
          {unlabelled > 0 && ` ${unlabelled} names are withheld where they would have landed on another name; zoom in to read them.`}
          {traversal.frontier.length > 0 && ` ${traversal.frontier.length} ringed firm${traversal.frontier.length === 1 ? ' has' : 's have'} further documented suppliers past this depth.`}
          {' '}Scroll or +/− to zoom, drag to pan, drag a firm to pin it where you want it.
          {picked && ' Click the background to clear the highlight.'}
        </p>
      )}
      </div>
    </div>
  );
}
