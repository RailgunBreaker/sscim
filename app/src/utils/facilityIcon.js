/* ====================================================================
   Facility map icons — shape carries FUNCTION, colour carries STATE.

   The site layer first shipped as coloured circles, which put both jobs on
   one channel: a red dot meant "materials plant currently disrupted", and
   also "advanced fab currently disrupted", and a reader had to open a
   popup to learn which. With 244 plants on one map that is a wall of
   identical alarm-coloured bubbles.

   So the two are separated:

     SHAPE = what the site does in the chain. A fab is a square (a wafer
             lot), assembly is a diamond (a package), materials is a
             triangle (feedstock), equipment is a hexagon (a tool), R&D is
             an open circle (nothing physical leaves it), a datacentre is a
             stack of bars (racks). Distinguishable at 12px and, more to
             the point, distinguishable from each other without colour —
             which is also what makes the layer legible to a reader who
             cannot separate red from green.

     COLOUR = what is happening to it now, and only when something is.
             At rest every marker is the same neutral steel, so the map
             reads as geography. Colour appears only where the operational
             field is actually non-zero, which makes the few sites under
             live pressure the thing your eye lands on instead of the
             whole map shouting at once.

   Built as an SVG string for a Leaflet divIcon. It contains NO dataset
   text — only geometry and theme colours — so there is no injection
   surface here; names and descriptions go through the DOM-building
   helpers in tooltip.js exactly as before.
   ==================================================================== */
import { C } from '../theme.js';

export const FACILITY_KIND_LABEL = Object.freeze({
  fab: 'Wafer fab',
  assembly: 'Assembly & test',
  materials: 'Materials',
  equipment: 'Equipment',
  rnd: 'R&D / design',
  datacenter: 'Datacentre',
});

/* Neutral resting colour: present, legible, not alarming. */
export const IDLE_COLOR = '#7C8AA5';

/* Where the colour bands sit, and why they are not near zero.

   The first version treated anything past |0.02| as adverse and painted it
   red. That looked principled and was useless in practice: a single large
   event propagates across the whole graph, so on a normal day the median
   site sits around |0.20| and 267 of 275 plants came out red. A map where
   everything is an alarm carries exactly as much information as a map where
   nothing is.

   So the bands are graded, and they use the same four-way vocabulary the
   country markers and the legend already use — adverse / moderate /
   mitigating / ~neutral — rather than inventing a second scale for the same
   underlying field. */
export const QUIET_BAND = 0.10;   // below this the site is drawn as geography
export const STRONG_BAND = 0.35;  // above this an adverse effect reads as red

/* One path per kind, drawn inside a 16×16 box centred on (8,8). Kept as
   geometry rather than glyph characters so it renders identically without
   depending on a font that may not be installed. */
function shape(kind, size) {
  const s = size;
  const c = s / 2;
  const r = s * 0.34;
  switch (kind) {
    case 'fab': // square — a wafer lot
      return `<rect x="${c - r}" y="${c - r}" width="${r * 2}" height="${r * 2}" rx="1"/>`;
    case 'assembly': // diamond — a finished package
      return `<path d="M ${c} ${c - r * 1.2} L ${c + r * 1.2} ${c} L ${c} ${c + r * 1.2} L ${c - r * 1.2} ${c} Z"/>`;
    case 'materials': // triangle — feedstock entering the chain
      return `<path d="M ${c} ${c - r * 1.25} L ${c + r * 1.15} ${c + r * 0.9} L ${c - r * 1.15} ${c + r * 0.9} Z"/>`;
    case 'equipment': { // hexagon — a machine
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${(c + r * 1.15 * Math.cos(a)).toFixed(2)},${(c + r * 1.15 * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      return `<polygon points="${pts}"/>`;
    }
    case 'datacenter': // stacked bars — racks
      return `<rect x="${c - r * 1.15}" y="${c - r}" width="${r * 2.3}" height="${r * 0.55}" rx="0.8"/>`
        + `<rect x="${c - r * 1.15}" y="${c - r * 0.22}" width="${r * 2.3}" height="${r * 0.55}" rx="0.8"/>`
        + `<rect x="${c - r * 1.15}" y="${c + r * 0.56}" width="${r * 2.3}" height="${r * 0.55}" rx="0.8"/>`;
    case 'rnd': // open circle — nothing physical leaves
    default:
      return `<circle cx="${c}" cy="${c}" r="${r}"/>`;
  }
}

/* `impact` is the signed operational field at the site's stages;
   `live` is false for a site with no output to lose (construction / idle),
   which is drawn hollow so it is never counted by eye as running capacity. */
export function facilityIconHtml({ kind, impact = 0, live = true, size = 16, selected = false, inHazard = false }) {
  const mag = Math.abs(impact);
  const state = !live ? 'idle'
    : mag < QUIET_BAND ? 'quiet'
    : impact < 0 ? 'mitigating'
    : mag >= STRONG_BAND ? 'adverse'
    : 'moderate';

  const fill = state === 'adverse' ? C.red
    : state === 'moderate' ? C.amber
    : state === 'mitigating' ? C.green
    : state === 'idle' ? 'none'
    : IDLE_COLOR;
  const stroke = selected ? C.text : inHazard ? C.amber : state === 'idle' ? IDLE_COLOR : fill;
  const strokeWidth = selected ? 2 : inHazard ? 1.6 : state === 'idle' ? 1 : 0.75;
  // R&D sites are open by construction: they make nothing, and the hollow
  // glyph says so before the popup does.
  const hollow = kind === 'rnd' || state === 'idle';

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
    style="overflow:visible;display:block">
    <g fill="${hollow ? 'none' : fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"
       opacity="${state === 'quiet' ? 0.92 : 1}">
      ${shape(kind, size)}
    </g>
  </svg>`;
}

/* A group of plants that overlap at this zoom, drawn as a count rather than a
   pile. Deliberately a ROUNDED SQUARE, not any of the function shapes: a
   cluster usually mixes fabs, packaging and materials, and borrowing one of
   their glyphs would claim a homogeneity it does not have. The number is the
   information; the shape only has to say "this is a group, open it". */
export function clusterIconHtml({ count, impact = 0, size = 22, selected = false, inHazard = false }) {
  const mag = Math.abs(impact);
  const accent = mag < QUIET_BAND ? IDLE_COLOR
    : impact < 0 ? C.green
    : mag >= STRONG_BAND ? C.red
    : C.amber;
  const stroke = selected ? C.text : inHazard ? C.amber : accent;
  /* Digits only, by construction. This is the one icon that renders text, so
     the value is coerced and stripped rather than trusted — nothing that ever
     reaches it should be able to carry markup. */
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const label = n > 99 ? '99+' : String(n).replace(/[^\d]/g, '');
  const fontSize = Math.max(8, Math.round(size * (label.length > 2 ? 0.34 : 0.42)));

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"
    style="overflow:visible;display:block">
    <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${size * 0.3}"
      fill="${C.panel}" fill-opacity="0.94" stroke="${stroke}" stroke-width="${selected || inHazard ? 2 : 1.4}"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      font-size="${fontSize}" font-weight="700" fill="${accent}">${label}</text>
  </svg>`;
}

/* Legend rows for the map key: every shape, drawn the same way the markers
   are, so the key cannot drift from the map it describes. */
export function facilityLegendItems(size = 13) {
  return Object.entries(FACILITY_KIND_LABEL).map(([kind, label]) => ({
    kind, label, html: facilityIconHtml({ kind, impact: 0, live: true, size }),
  }));
}
