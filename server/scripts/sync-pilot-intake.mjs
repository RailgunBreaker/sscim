import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPilotStore } from '../src/pilot-store.js';
import { loadPilotIntake } from '../src/pilot-intake.js';

const path = fileURLToPath(new URL('../data/private/pilot.db', import.meta.url));
// Never activate a pilot, create business records, or assert review decisions
// from a scheduled collection run. Only retain intake for an existing pilot.
if (!existsSync(path)) console.log(JSON.stringify({ status: 'skipped', reason: 'no_private_workspace' }));
else {
  const store = createPilotStore(path, () => false, undefined, loadPilotIntake);
  try { console.log(JSON.stringify(store.syncIntake())); }
  finally { store.close(); }
}
