/* ====================================================================
   diagnostics.js — graph validation and a lightweight diagnostics
   collector shared by the engine (attached to its return value as
   `diagnostics`) and by app/scripts/audit-snapshot.mjs (which runs the
   same graph validation against the committed snapshot file, read-only,
   at CI time).
   ==================================================================== */
import { topologicalSort } from './math.js';

/* Validates that a stage graph is usable for directional propagation:
   - every edge's endpoints exist among the declared stage ids
   - no duplicate edges
   - no cycles (propagation requires a DAG)
   Returns { valid, errors, order } — `order` is the topological order,
   only meaningful when valid is true. */
export function validateGraph(stageIds, edges) {
  const errors = [];
  const idSet = new Set(stageIds);
  const seenEdges = new Set();
  const out = {};
  stageIds.forEach((id) => (out[id] = []));

  for (const edge of edges) {
    const [a, b] = edge;
    if (!idSet.has(a)) errors.push(`Edge ${JSON.stringify(edge)} references unknown source stage "${a}".`);
    if (!idSet.has(b)) errors.push(`Edge ${JSON.stringify(edge)} references unknown target stage "${b}".`);
    const key = `${a}>${b}`;
    if (seenEdges.has(key)) errors.push(`Duplicate edge "${key}".`);
    seenEdges.add(key);
    if (idSet.has(a) && idSet.has(b)) out[a].push(b);
  }

  const { order, hasCycle } = topologicalSort(stageIds, out);
  if (hasCycle) errors.push('Graph contains a cycle (or an edge to/from an unreachable node) — directional propagation requires a DAG.');

  return { valid: errors.length === 0, errors, order, out, hasCycle };
}

/* Simple accumulator: engine internals call diag.warn(...)/diag.error(...)
   as they run; the final list is attached to the engine's return value
   (and to per-request model diagnostics in App.jsx) so the UI can show a
   developer-facing panel instead of silently returning arbitrary numbers
   when the input data is malformed. */
export function createDiagnostics() {
  const notes = [];
  return {
    warn(scope, message) { notes.push({ level: 'warning', scope, message }); },
    error(scope, message) { notes.push({ level: 'error', scope, message }); },
    get list() { return notes.slice(); },
    get hasErrors() { return notes.some((n) => n.level === 'error'); },
  };
}

export function isFiniteBounded(value, min = -Infinity, max = Infinity) {
  return Number.isFinite(value) && value >= min && value <= max;
}
