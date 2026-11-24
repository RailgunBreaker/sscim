// Shared by the authoring pipeline and the browser. Each direction gets its
// own visited set: paths never reverse direction or revisit the centre.
export function supplierCoverage(companies, edges) {
  const up = {}, down = {};
  for (const edge of edges) {
    (up[edge.customer] ||= []).push(edge.supplier);
    (down[edge.supplier] ||= []).push(edge.customer);
  }
  const walk = (root, adjacency) => {
    const seen = new Set([root]);
    let frontier = [[root]];
    const levels = [], examples = [];
    for (let depth = 1; depth <= 3; depth++) {
      const next = [];
      for (const path of frontier) for (const id of adjacency[path.at(-1)] || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        next.push([...path, id]);
      }
      levels.push(next.length);
      examples.push(next[0] || null);
      frontier = next;
    }
    return { levels, examples };
  };
  const grouped = new Map();
  for (const [id, c] of Object.entries(companies)) {
    if (!c.vaultId) continue;
    const suppliers = up[id]?.length || 0, customers = down[id]?.length || 0;
    const existing = grouped.get(c.vaultId);
    if (existing && existing.suppliers + existing.customers >= suppliers + customers) continue;
    const upstream = walk(id, up), downstream = walk(id, down);
    grouped.set(c.vaultId, {
      id, vaultId: c.vaultId, name: c.aliases?.[0] || c.name, suppliers, customers,
      documented: suppliers + customers > 0,
      levels: upstream.levels, downstreamLevels: downstream.levels,
      upstreamPaths: upstream.examples, downstreamPaths: downstream.examples,
      missingUpstreamLevels: upstream.levels.flatMap((n, i) => n ? [] : [i + 1]),
      missingDownstreamLevels: downstream.levels.flatMap((n, i) => n ? [] : [i + 1]),
    });
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function coverageSummary(rows) {
  const count = key => [0, 1, 2].map(i => rows.filter(r => r[key][i] > 0).length);
  const either = [0, 1, 2].map(i => rows.filter(r => r.levels[i] || r.downstreamLevels[i]).length);
  return {
    tracked: rows.length, level1: either[0], level2: either[1], level3: either[2],
    upstream: count('levels'), downstream: count('downstreamLevels'),
    noDocumentedCounterparty: rows.filter(r => !r.documented).map(r => r.vaultId).sort(),
    note: 'Exact shortest-distance coverage, walking each direction separately. Combined coverage means at least one direction reaches that level. Missing paths are research gaps in this dataset, not proof that no supplier exists. Historical, planned and design-enablement links remain qualified by their evidence; paths do not establish simultaneous shipments or a product bill of materials.',
  };
}
