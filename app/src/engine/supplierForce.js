/* ====================================================================
   supplierForce — a small force-directed layout, written out rather
   than pulled in.

   WHY A FORCE LAYOUT HERE, when every other graph in SSCIM is laid out
   deterministically on a ladder. The modeled network answers "what is
   attached to this plant", and for that a fixed ladder is better: the
   positions carry meaning and the picture does not wander. This lens
   answers a different question — "what shape does the documented
   evidence make" — and the answer is genuinely a shape: clusters where
   several buyers name the same supplier, long thin chains where one
   document leads to the next, and isolated stubs where the record runs
   out after a single step. A ladder flattens all three into columns.

   The reference network this lens was modelled on builds exactly that
   way: a physics simulation that settles while you watch it, with the
   settling itself telling you how tangled the graph is.

   DETERMINISM IS KEPT ANYWAY. The simulation is seeded from a fixed
   hash of each node's id, never from Math.random, and runs a fixed
   number of iterations. Two readers opening the same firm get the same
   picture, and reopening it gives back the one you had. That is the one
   property a physics layout usually throws away and the one this
   project is least willing to lose.

   Barnes-Hut is deliberately absent: at the few hundred nodes this lens
   draws, the exact O(n^2) repulsion is well under a frame and has no
   approximation error to explain.
   ==================================================================== */

/* Deterministic per-id seed: same id, same starting point, always. */
function seedOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export const DEFAULT_SETTINGS = {
  iterations: 460,
  /* Spread is tuned for LABELS, not for the prettiest ball of nodes. A
     tighter cloud looks better empty and becomes unreadable the moment
     company names are written on it, because every name then overlaps
     its neighbours' and the picture stops naming anything. */
  repulsion: 9800,     // node-node push
  spring: 0.0075,      // edge pull
  springLength: 118,
  gravity: 0.013,      // pull toward the middle, so nothing drifts off
  /* Gravity pulls harder vertically than horizontally, which flattens
     the cloud into the landscape box the panel actually gives it. With
     equal gravity the simulation settles into a circle, and a circle in
     a 2:1 frame wastes a third of the width while stacking labels in
     the middle — the graph ends up smaller and less readable than the
     space allows. */
  gravityAspect: 2.3,
  damping: 0.86,
  tierPull: 0.07,      // how hard a node is held to its tier's band
  width: 1100,
  height: 620,
};

/* One simulation, stepped by the caller so the settling can be drawn.

   `tierX` maps a node id to the x it would sit at if tiers were columns.
   Passing it on anchors the physics to the tier structure — the graph
   still finds its own shape, but upstream stays left, the way it does
   everywhere else in this product. Passing null gives the free layout
   the reference uses, where position means nothing but connectedness. */
export function createLayout(nodeIds, links, { tierX = null, ...opts } = {}) {
  const s = { ...DEFAULT_SETTINGS, ...opts };
  const n = nodeIds.length;
  const index = new Map(nodeIds.map((id, i) => [id, i]));

  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const anchorX = new Float64Array(n);
  const hasAnchor = new Uint8Array(n);
  const deg = new Float64Array(n);

  for (let i = 0; i < n; i += 1) {
    const id = nodeIds[i];
    const a = seedOf(id) * Math.PI * 2;
    const r = 40 + seedOf(`${id}#r`) * Math.min(s.width, s.height) * 0.42;
    /* Seeded on a ring rather than at a point: starting every node at
       the centre makes the first twenty iterations an explosion, which
       looks dramatic and wastes most of the budget untangling it. */
    x[i] = Math.cos(a) * r;
    y[i] = Math.sin(a) * r;
    if (tierX) {
      const tx = tierX(id);
      if (tx !== null && tx !== undefined) { anchorX[i] = tx; hasAnchor[i] = 1; x[i] = tx + (seedOf(`${id}#x`) - 0.5) * 70; }
    }
  }

  const edges = [];
  for (const l of links) {
    const a = index.get(l.supplier);
    const b = index.get(l.customer);
    if (a === undefined || b === undefined || a === b) continue;
    edges.push([a, b]);
    deg[a] += 1;
    deg[b] += 1;
  }

  /* Pinned nodes are held exactly where they were put and are excluded
     from integration, while still pushing on everything else. That is
     what makes dragging mean something: the node you are holding stays
     under the cursor, and the graph rearranges around it rather than
     springing back and discarding the arrangement you just made. */
  const pinnedFlag = new Uint8Array(n);

  let step = 0;
  const run = (steps) => {
    for (let it = 0; it < steps && step < s.iterations; it += 1, step += 1) {
      /* Cooling: big moves early, fine adjustment late. Without it the
         graph keeps jittering forever and never looks settled. */
      const t = 1 - step / s.iterations;
      const cool = 0.15 + 0.85 * t * t;

      for (let i = 0; i < n; i += 1) {
        let fx = 0;
        let fy = 0;

        for (let j = 0; j < n; j += 1) {
          if (i === j) continue;
          let dx = x[i] - x[j];
          let dy = y[i] - y[j];
          let d2 = dx * dx + dy * dy;
          if (d2 < 1e-4) { dx = (seedOf(`${i}:${j}`) - 0.5) * 0.1; dy = 0.1; d2 = 0.01; }
          const f = s.repulsion / d2;
          const d = Math.sqrt(d2);
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }

        fx -= x[i] * s.gravity;
        fy -= y[i] * s.gravity * s.gravityAspect;
        if (hasAnchor[i]) fx += (anchorX[i] - x[i]) * s.tierPull;

        vx[i] = (vx[i] + fx * cool) * s.damping;
        vy[i] = (vy[i] + fy * cool) * s.damping;
      }

      for (const [a, b] of edges) {
        const dx = x[b] - x[a];
        const dy = y[b] - y[a];
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-3;
        const f = (d - s.springLength) * s.spring * cool;
        const ux = (dx / d) * f;
        const uy = (dy / d) * f;
        vx[a] += ux; vy[a] += uy;
        vx[b] -= ux; vy[b] -= uy;
      }

      for (let i = 0; i < n; i += 1) {
        if (pinnedFlag[i]) { vx[i] = 0; vy[i] = 0; continue; }
        /* A single step is clamped so one node flung by a near-collision
           cannot cross the whole canvas in a frame and drag its
           neighbours after it. */
        const vmax = 26;
        if (vx[i] > vmax) vx[i] = vmax; else if (vx[i] < -vmax) vx[i] = -vmax;
        if (vy[i] > vmax) vy[i] = vmax; else if (vy[i] < -vmax) vy[i] = -vmax;
        x[i] += vx[i];
        y[i] += vy[i];
      }
    }
    return step;
  };

  const positions = () => {
    const out = {};
    for (let i = 0; i < n; i += 1) out[nodeIds[i]] = { x: x[i], y: y[i], deg: deg[i] };
    return out;
  };

  /* The drawn extent, so the caller can fit the viewBox to what the
     simulation actually produced rather than to a guessed canvas. */
  /* padX defaults to pad, but a caller that draws names under its nodes
     needs more room sideways than vertically: a name is a horizontal
     object centred on a point, so the firm at the right-hand edge of a
     graph has half its name outside a symmetrically padded frame. That
     is how "National Electric Vehicle Sweden AB" arrived on screen as
     "National Electric Vehicle Swede". */
  const bounds = (pad = 90, padX = pad) => {
    if (!n) return { minX: -padX, minY: -pad, w: padX * 2, h: pad * 2 };
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (x[i] < minX) minX = x[i];
      if (x[i] > maxX) maxX = x[i];
      if (y[i] < minY) minY = y[i];
      if (y[i] > maxY) maxY = y[i];
    }
    return { minX: minX - padX, minY: minY - pad, w: (maxX - minX) + padX * 2, h: (maxY - minY) + pad * 2 };
  };

  /* Move a node and hold it there. Used by dragging: the position comes
     from the pointer, not from the physics. */
  const place = (id, px, py, { pin = true } = {}) => {
    const i = index.get(id);
    if (i === undefined) return;
    x[i] = px;
    y[i] = py;
    vx[i] = 0;
    vy[i] = 0;
    pinnedFlag[i] = pin ? 1 : 0;
  };

  const unpin = (id) => {
    if (id === undefined) {
      pinnedFlag.fill(0);
      return;
    }
    const i = index.get(id);
    if (i !== undefined) pinnedFlag[i] = 0;
  };

  const isPinned = (id) => {
    const i = index.get(id);
    return i === undefined ? false : pinnedFlag[i] === 1;
  };

  const pinnedCount = () => pinnedFlag.reduce((a, b) => a + b, 0);

  /* Let the graph relax again after a drag, at a LOW temperature.

     Rewinding `step` all the way to zero would re-run the full cooling
     schedule and throw away the arrangement the reader just made by
     hand, which is the opposite of what dragging is for. Rewinding a
     little lets the neighbours follow the node that moved and leaves
     everything else where it was. */
  const reheat = (steps = 90) => {
    step = Math.max(0, Math.min(step, s.iterations - steps));
  };

  return {
    run,
    positions,
    bounds,
    place,
    unpin,
    isPinned,
    pinnedCount,
    reheat,
    total: s.iterations,
    get progress() { return s.iterations ? step / s.iterations : 1; },
    get done() { return step >= s.iterations; },
  };
}

/* Which labels can be written without overlapping each other.

   A force layout puts nodes where the physics wants them, which is
   frequently on top of one another as far as a 12px name is concerned.
   Writing every label produces a legible graph with an illegible
   overlay: names stacked two and three deep, none of them readable, and
   the reader cannot tell which name belongs to which dot.

   So labels are placed greedily in priority order — the centred firm
   first, then the best-documented — and any label whose box would hit
   one already placed is dropped. The node stays drawn and clickable;
   only its name is withheld, and the caller reports how many.

   Pure and deterministic: same positions in, same labels out. Boxes are
   estimated from character count rather than measured, which is both
   cheap and stable; a measured box would depend on the font actually
   loaded and would change the picture between machines.
   ==================================================================== */
export function placeLabels(order, positions, { radiusOf, labelOf, charWidth = 6.1, lineHeight = 15, pad = 2 } = {}) {
  const placed = [];
  const keep = new Set();
  for (const id of order) {
    const p = positions[id];
    if (!p) continue;
    const text = labelOf ? labelOf(id) : id;
    const w = text.length * charWidth + pad * 2;
    const r = radiusOf ? radiusOf(id) : 6;
    /* The label sits above the dot, centred, which is where the
       component draws it; the box has to match or the test is of a
       different picture than the one on screen. */
    const box = { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - r - 6 - lineHeight, y1: p.y - r - 4 };
    const clash = placed.some((b) => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1));
    if (clash) continue;
    placed.push(box);
    keep.add(id);
  }
  return keep;
}

/* Two degrees out from a node, which is what the reference network
   highlights on a click: the selected firm, everything it touches, and
   everything those touch. Pure, so the rule is testable without a DOM. */
export function neighbourhood(links, rootId, degrees = 2) {
  const adj = new Map();
  const add = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const l of links) { add(l.supplier, l.customer); add(l.customer, l.supplier); }

  const level = new Map([[rootId, 0]]);
  let frontier = [rootId];
  for (let d = 1; d <= degrees; d += 1) {
    const next = [];
    for (const id of frontier) {
      for (const other of adj.get(id) || []) {
        if (!level.has(other)) { level.set(other, d); next.push(other); }
      }
    }
    frontier = next;
  }
  return level;
}
