/* Small synthetic dataset shared by the engine unit tests — a 5-stage
   chain (s1->s2->s3->s4->s5, deliberately 4 hops deep so tests can prove
   propagation reaches beyond the old fixed 2-hop cutoff) plus one
   isolated stage with no edges at all (to prove disconnected nodes stay
   unaffected). Real event ids (e1/e2/e3/e5/e6) are reused so tests
   exercise the actual EVENT_ASSUMPTIONS classification, not a fake one. */
export function makeFixtureData() {
  const STAGES = [
    { id: 's1', name: 'Stage 1', x: 0, y: 0, value: 10, subst: 2, market: 5, shares: { us: 1 } },
    { id: 's2', name: 'Stage 2', x: 1, y: 0, value: 10, subst: 8, market: 5, shares: { us: 1 } },
    { id: 's3', name: 'Stage 3', x: 2, y: 0, value: 10, subst: 5, market: 5, shares: { cn: 1 } },
    { id: 's4', name: 'Stage 4', x: 3, y: 0, value: 10, subst: 5, market: 5, shares: { cn: 1 } },
    { id: 's5', name: 'Stage 5', x: 4, y: 0, value: 10, subst: 5, market: 5, shares: { us: 1 } },
    { id: 'siso', name: 'Isolated stage', x: 5, y: 0, value: 10, subst: 5, market: 5, shares: { us: 1 } },
  ];
  const FLOW_EDGES = [['s1', 's2'], ['s2', 's3'], ['s3', 's4'], ['s4', 's5']];
  const COMPANIES = [
    { id: 'coA', name: 'Co A', country: 'us', stakes: { s1: 0.6 } },
    { id: 'coB', name: 'Co B', country: 'us', stakes: { s1: 0.2 } },
    { id: 'coC', name: 'Co C', country: 'cn', stakes: { s5: 1 } },
  ];
  const CUSTOMERS = {};
  const POLICIES = [];
  const OWNERS = {};
  const EVENTS = [
    { id: 'e1', date: 'Jul 03', sev: 8, daysAgo: 0, conf: 'High', type: 'Export Control', title: 'e1 title', summary: 's', first: 'f', second: 's2', watch: 'w', stages: ['s1'], countries: ['us'] },
    { id: 'e2', date: 'Jul 02', sev: 4, daysAgo: 0, conf: 'Medium', type: 'Technology Update', title: 'e2 title', summary: 's', first: 'f', second: 's2', watch: 'w', stages: ['s1'], countries: ['us'] },
    { id: 'e3', date: 'Jun 30', sev: 6, daysAgo: 0, conf: 'Medium', type: 'Geopolitical Risk', title: 'e3 title', summary: 's', first: 'f', second: 's2', watch: 'w', stages: ['s1'], countries: ['us'] },
    { id: 'e5', date: 'Jun 25', sev: 5, daysAgo: 0, conf: 'Medium', type: 'Company Guidance', title: 'e5 title', summary: 's', first: 'f', second: 's2', watch: 'w', stages: ['s1'], countries: ['us'] },
    { id: 'e6', date: 'Jun 24', sev: 3, daysAgo: 0, conf: 'Medium', type: 'Policy Signal', title: 'e6 title', summary: 's', first: 'f', second: 's2', watch: 'w', stages: ['s1'], countries: ['us'] },
  ];
  const COUNTRY_NAMES = { us: 'United States', cn: 'China' };
  return { STAGES, FLOW_EDGES, COMPANIES, CUSTOMERS, POLICIES, EVENTS, OWNERS, COUNTRY_NAMES };
}
