// Validate accounting snapshots without converting dollars to physical buffers.
export function reconcileInventorySnapshots(records) {
  const metrics = ['inventory_work_in_progress_and_others', 'inventory_raw_materials_and_supplies', 'inventory_reserves', 'inventory_total'];
  const inventory = records.filter(r => r.metric?.startsWith('inventory_'));
  const groups = [...new Set(inventory.map(r => r.snapshotGroup))];
  return groups.map(group => {
    const rows = inventory.filter(r => r.snapshotGroup === group);
    const compatible = group && rows.length === metrics.length && metrics.every(metric => rows.filter(r => r.metric === metric).length === 1)
      && rows.every(r => r.units === 'USD_million' && r.currency === 'USD' && Number.isFinite(r.value)
        && r.measurementBasis === 'accounting_carrying_value')
      && ['companyId', 'periodEnd', 'scope'].every(key => rows[0][key] && rows.every(r => r[key] === rows[0][key]));
    if (!compatible) return { group, status: 'incompatible_or_incomplete', difference: null, inventoryDays: null };
    const amounts = Object.fromEntries(rows.map(r => [r.metric, r.value]));
    const difference = amounts.inventory_work_in_progress_and_others + amounts.inventory_raw_materials_and_supplies
      + amounts.inventory_reserves - amounts.inventory_total;
    const validSigns = amounts.inventory_reserves <= 0 && metrics.filter(m => m !== 'inventory_reserves').every(m => amounts[m] >= 0);
    return { group, status: validSigns && Math.abs(difference) < 1e-9 ? 'reconciled' : 'unreconciled',
      difference, units: 'USD_million', inventoryDays: null,
      reason: 'Accounting identity only. Physical quantities, usage rate and supplier allocation are undisclosed.' };
  });
}
