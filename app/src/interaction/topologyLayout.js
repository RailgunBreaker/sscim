/* ====================================================================
   interaction/topologyLayout.js — deterministic hierarchical layout for
   the functional-centre topology view (spec §9B). Places each centre by
   its supply-chain tier on the x-axis (Inputs & IP → … → End markets) and
   spreads centres within a tier on the y-axis, strongest (network
   influence) first. Pure and dependency-free so it is unit-testable and so
   the topology renderer stays a thin view over derived positions.

   Node dragging in the UI overrides these positions locally and never
   changes model data (spec §9B) — this only supplies the initial layout.
   ==================================================================== */

export function layoutCentres(centres, { width = 1200, height = 560, marginX = 80, marginY = 40, tierCount = 7 } = {}) {
  const byTier = {};
  centres.forEach((c) => { (byTier[c.tierId] ||= []).push(c); });
  const tierIds = Object.keys(byTier).map(Number).sort((a, b) => a - b);
  const maxTier = Math.max(tierCount - 1, ...(tierIds.length ? tierIds : [0]));

  const pos = {};
  tierIds.forEach((tid) => {
    const col = byTier[tid].slice().sort(
      (a, b) => (b.networkInfluence - a.networkInfluence) || a.countryId.localeCompare(b.countryId)
    );
    const x = marginX + (maxTier <= 0 ? 0 : tid / maxTier) * (width - 2 * marginX);
    const n = col.length;
    col.forEach((c, i) => {
      const y = n === 1 ? height / 2 : marginY + (i / (n - 1)) * (height - 2 * marginY);
      pos[c.id] = { x, y, tierId: tid };
    });
  });
  return pos;
}

/* A cubic-bezier path between two laid-out points, bowed horizontally so
   many same-tier→next-tier edges stay visually separable. */
export function edgePath(p1, p2) {
  if (!p1 || !p2) return '';
  const dx = (p2.x - p1.x) * 0.45;
  return `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`;
}
