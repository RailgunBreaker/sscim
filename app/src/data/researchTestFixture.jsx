// Test-only provider for archived research components. Never imported by App.
import { VaultCtx } from './VaultContext.jsx';
import { buildVaultData } from './buildVaultData.js';
import { buildEngine } from '../engine/index.js';
import { buildFacilityNetwork } from '../engine/facilityNetwork.js';
import snapshot from './vault-snapshot.json';
const data = buildVaultData(snapshot);
const engine = buildEngine({ ...data, datasetAsOf: snapshot.meta.snapshotDate });
const cache = {};
data.FACILITY_NETWORK = buildFacilityNetwork({ layer: data.FACILITY_LAYER, CUSTOMERS: data.CUSTOMERS,
  stageIds: data.STAGES.map(s => s.id), dependence: (from,to) =>
    (cache[from] ||= engine.propagateTrace(from, 1, 'downstream').field)[to] ?? 0 });
export function VaultProvider({ children }) {
  return <VaultCtx.Provider value={{ status: 'ready', data, engine, source: 'static' }}>{children}</VaultCtx.Provider>;
}
