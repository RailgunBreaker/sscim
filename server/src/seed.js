import { truncateAll, seedAll, seedCounts } from './seed-logic.js';

/* CLI entry point (`npm run seed`) — explicit, unconditional reset. */
truncateAll();
seedAll();
console.log('Seeded SSCIM vault:', seedCounts());
