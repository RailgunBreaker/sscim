import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { reconcileInventorySnapshots } from '../src/operating-evidence.js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/gf-operating-evidence.json', root)));
const inventory = reconcileInventorySnapshots(data.records);
if (inventory.length !== 3 || inventory.some(r => r.status !== 'reconciled')) throw new Error('Inventory reconciliation failed');
const share = data.records.find(r => r.metric === 'supplier_procurement_spend_share');
const capacity = data.records.find(r => r.metric === 'installed_capacity');
const contract = data.records.find(r => r.kind === 'reported_supply_contract');
if (share.inputShare !== null || share.units !== 'fraction_of_soi_wafer_spend'
  || capacity.waferBasis !== null || capacity.facilityAllocation !== null
  || ['committedVolumes', 'unitPrices', 'supplierAllocation', 'facilityRoutes'].some(key => contract[key] !== null)) {
  throw new Error('Unsupported physical share, capacity basis or redacted contract allocation');
}
const report = { asOf: data.reviewedAt, records: data.records.length, primaryDocuments: data.sourceArtifacts.length,
  inventory, physicalInputShare2025: null, installedCapacityUtilization: null, chainWideLoss: null,
  prospectiveOutcomesAdded: 0, globalParametersCalibrated: 0,
  limitation: 'These records add company operating evidence, not incident-attributed losses or independent prospective outcomes.' };
writeAtomicJson(new URL('docs/benchmarks/gf-operating-evaluation.json', root), report);
console.log(JSON.stringify({ records: report.records, inventorySnapshotsReconciled: inventory.length }));
