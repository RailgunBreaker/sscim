import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { facilityIconHtml, FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { facilityImpact, siteWeight } from '../engine/facilities.js';
import { pct } from '../interaction/lensEncoding.js';

/* ====================================================================
   FacilityGraph — one plant and everything it connects to, on a blank
   background.

   The map answers "where is this". This answers "what is it attached to",
   which is a different question and a worse fit for geography: on a map the
   answer is a fan of long lines across an ocean, where the informative part
   is not the distance but the shape — how many, in which direction, at what
   strength, through which step of the chain.

   So: no basemap, no coastline, no scale. The focus sits in the middle,
   suppliers to the left, customers to the right, ordered by strength. That
   left-to-right convention is the same one the industry flow graph uses, so
   "upstream is left" means the same thing in both panels.

   Layout is deterministic — a fixed ladder, not a force simulation.
   Two readers looking at the same plant see the same picture, and it does
   not wander while you watch it. A force layout would look more organic and
   would be worse: the positions would carry no meaning while implying they
   did.

   Every node is the same glyph the map draws (utils/facilityIcon.js), so a
   square is a fab here exactly as it is there.
   ==================================================================== */

const W = 760;
const ROW = 30;          // vertical pitch — one label's worth, so they never collide
const PAD_Y = 46;
const COL_X = 176;       // node column, left and mirrored right
const MAX_PER_SIDE = 14;

/* A LADDER, not a fan.

   The first version fanned nodes radially from the centre, which looked like
   a network diagram and was unreadable: fourteen suppliers on one side put
   their labels on top of each other, and the only way to tell them apart was
   to hover each one. Names are the payload here — "which plant" is the whole
   question — so the layout is chosen to make every name legible rather than
   to look organic.

   So each side is a vertical column, evenly pitched at one label height,
   strongest at the top. Deterministic: two readers see the same picture, and
   it does not move between viewings. */
function ladder(links, side, focusId, byId, height) {
  const n = Math.min(links.length, MAX_PER_SIDE);
  const usable = height - PAD_Y * 2;
  const step = n <= 1 ? 0 : usable / (n - 1);
  const top = n <= 1 ? height / 2 : PAD_Y;
  return links.slice(0, n).map((l, i) => {
    const otherId = l.from === focusId ? l.to : l.from;
    const other = byId[otherId];
    if (!other) return null;
    return {
      link: l,
      other,
      x: side === 'left' ? COL_X : W - COL_X,
      y: top + step * i,
    };
  }).filter(Boolean);
}

const FLOW_COLOR = { forward: C.copper, service: C.amber, 'co-input': '#7C8AA5' };
const FLOW_DASH = { forward: null, service: '4 4', 'co-input': '1 4' };

export default function FacilityGraph({ focusId, model, onFocus, onSelect }) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COMPANY_BY_ID } = data;
  const { STAGE_BY_ID } = engine;

  const focus = FACILITY_LAYER.FACILITY_BY_ID[focusId];
  const byId = FACILITY_LAYER.FACILITY_BY_ID;
  const field = model?.activeField || {};

  const { suppliers, customers, edges, H, localMax } = useMemo(() => {
    const e = FACILITY_NETWORK?.linksByFacility?.[focusId] || { inbound: [], outbound: [] };
    const rows = Math.min(MAX_PER_SIDE, Math.max(e.inbound.length, e.outbound.length, 1));
    const height = Math.max(300, rows * ROW + PAD_Y * 2);
    /* Normalise against THIS plant's strongest link, not the snapshot's.
       Globally, almost every link rounds to 0% — the strongest link in the
       whole network is an order of magnitude above a typical one — so a
       global percentage made every label read "0%" and carried no
       information at all in a single-plant view. Locally it answers the
       question actually being asked: of this plant's connections, which
       matter most. The caption says which normalisation is in force. */
    const all = [...e.inbound, ...e.outbound];
    const max = all.reduce((m, l) => Math.max(m, l.weight || 0), 0) || 1;
    return {
      suppliers: ladder(e.inbound, 'left', focusId, byId, height),
      customers: ladder(e.outbound, 'right', focusId, byId, height),
      edges: e,
      H: height,
      localMax: max,
    };
  }, [FACILITY_NETWORK, focusId, byId]);

  if (!focus) return null;

  const CX = W / 2;
  const CY = H / 2;
  const localRel = (l) => (l.weight || 0) / localMax;

  const node = (n, side) => {
    const impact = facilityImpact(n.other, field);
    const live = siteWeight(n.other) > 0;
    const size = 15;
    const rel = localRel(n.link);
    const colour = FLOW_COLOR[n.link.flow] || C.copper;
    const labelAnchor = side === 'left' ? 'end' : 'start';
    const labelX = n.x + (side === 'left' ? -12 : 12);
    /* Elbow rather than a straight line: at ladder spacing the straight
       version crosses its own neighbours' labels on the way to the centre. */
    const midX = side === 'left' ? CX - 78 : CX + 78;
    return (
      <g key={`${side}:${n.other.id}`} style={{ cursor: 'pointer' }}
        onClick={() => onFocus(n.other.id)}
        role="button" tabIndex={0}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onFocus(n.other.id); } }}>
        <title>{`${n.other.name}\n${COMPANY_BY_ID[n.other.company]?.name || n.other.company}\n${n.link.flow} link · ${pct(rel)} of this plant's strongest link\nclick to centre on it`}</title>
        <path d={`M ${n.x} ${n.y} L ${midX} ${n.y} Q ${CX} ${n.y} ${CX} ${CY}`}
          fill="none" stroke={colour} strokeWidth={0.6 + 2.4 * rel}
          strokeDasharray={FLOW_DASH[n.link.flow] || undefined}
          opacity={0.3 + 0.55 * rel} />
        {/* the node glyph, same generator the map uses */}
        <g transform={`translate(${n.x - size / 2}, ${n.y - size / 2})`}
          dangerouslySetInnerHTML={{ __html: facilityIconHtml({ kind: n.other.kind, impact, live, size }) }} />
        <text x={labelX} y={n.y - 1} textAnchor={labelAnchor} fill={C.text} fontSize="9.5">
          {n.other.name.length > 27 ? `${n.other.name.slice(0, 26)}…` : n.other.name}
        </text>
        <text x={labelX} y={n.y + 9} textAnchor={labelAnchor} fill={C.faint} fontSize="8">
          {(COMPANY_BY_ID[n.other.company]?.name || n.other.company).slice(0, 20)} · {pct(rel)}
        </text>
      </g>
    );
  };

  const focusImpact = facilityImpact(focus, field);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6 }}
        role="img" aria-label={`Connection graph for ${focus.name}: ${edges.inbound.length} suppliers, ${edges.outbound.length} customers`}>
        {/* column captions — the same left-to-right convention as the flow graph */}
        <text x={16} y={20} fill={C.faint} fontSize="9" letterSpacing="1.4">← SUPPLIED BY ({edges.inbound.length})</text>
        <text x={W - 16} y={20} textAnchor="end" fill={C.faint} fontSize="9" letterSpacing="1.4">SUPPLIES → ({edges.outbound.length})</text>

        {suppliers.map((n) => node(n, 'left'))}
        {customers.map((n) => node(n, 'right'))}

        {/* the focus, drawn last so it sits on top of its own edges */}
        <circle cx={CX} cy={CY} r={30} fill={C.panel} stroke={C.copper} strokeWidth="1.6" />
        <g transform={`translate(${CX - 13}, ${CY - 13})`}
          dangerouslySetInnerHTML={{ __html: facilityIconHtml({ kind: focus.kind, impact: focusImpact, live: siteWeight(focus) > 0, size: 26, selected: true }) }} />
        <text x={CX} y={CY + 46} textAnchor="middle" fill={C.text} fontSize="11" fontWeight="700">
          {focus.name.length > 40 ? `${focus.name.slice(0, 39)}…` : focus.name}
        </text>
        <text x={CX} y={CY + 58} textAnchor="middle" fill={C.copper} fontSize="8.5">
          {FACILITY_KIND_LABEL[focus.kind] || focus.kind} · {COMPANY_BY_ID[focus.company]?.name || focus.company}
        </text>

        {(edges.inbound.length > MAX_PER_SIDE || edges.outbound.length > MAX_PER_SIDE) && (
          <text x={CX} y={H - 10} textAnchor="middle" fill={C.faint} fontSize="8.5">
            showing the strongest {MAX_PER_SIDE} per side — the list below has all of them
          </text>
        )}
      </svg>

      <div className="mono" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 8.5, color: C.faint, marginTop: 5, lineHeight: 1.6 }}>
        <span style={{ color: FLOW_COLOR.forward }}>—— forward (supplier output flows toward the customer)</span>
        <span style={{ color: FLOW_COLOR.service }}>- - service (the die flows toward the supplier and back)</span>
        <span style={{ color: FLOW_COLOR['co-input'] }}>·· co-input (both feed a common downstream step)</span>
      </div>
      <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 3, lineHeight: 1.6 }}>
        Percentages and line thickness are relative to THIS plant's strongest link, not the snapshot's — a global
        scale rounds almost every link here to zero and answers a question nobody asked. Rows are ordered by strength,
        strongest at the top; positions are fixed, not a simulation, and do not move between viewings. Click any node to
        centre the graph on it.
      </div>
    </div>
  );
}
