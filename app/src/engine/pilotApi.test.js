import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { pilotRouter } from '../../../server/src/routes/pilot.js';
import { createPilotStore } from '../../../server/src/pilot-store.js';
const express = createRequire(new URL('../../../server/package.json', import.meta.url))('express');
it('requires authentication for every private operation and keeps revisions after conflicts', async () => {
  const previous = process.env.ADMIN_TOKEN; process.env.ADMIN_TOKEN = 'test-only-pilot-token';
  const store = createPilotStore(':memory:', id => id === 'gf');
  let accesses = 0;
  const app = express(); app.use(express.json()); app.use('/api/admin/pilot', pilotRouter(() => { accesses++; return store; }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/admin/pilot`;
  const headers = { Authorization: 'Bearer test-only-pilot-token', 'Content-Type': 'application/json' };
  try {
    for (const [method, path] of [['GET',''],['POST','/records'],['PUT','/records/id'],['POST','/activate'],['POST','/reviews'],['POST','/audits'],['POST','/audit-labels'],['GET','/audits/id/sources/id'],['GET','/audits/id/handoff'],['POST','/audit-import-preview'],['POST','/audit-imports']]) expect((await fetch(url + path, { method })).status).toBe(401);
    expect(accesses).toBe(0);
    const payload = { companyId: 'gf', objective: 'Review supplier disclosures', productScope: 'SOI wafers' };
    const created = await fetch(url + '/records', { method: 'POST', headers, body: JSON.stringify({ type: 'watch', payload }) });
    expect(created.status).toBe(201); const record = await created.json();
    expect((await fetch(url + '/records/' + record.id, { method: 'PUT', headers, body: JSON.stringify({ version: 1, payload: { ...payload, objective: 'Review changes weekly' }, reason: 'Refine pilot scope' }) })).status).toBe(200);
    expect((await fetch(url + '/records/' + record.id, { method: 'PUT', headers, body: JSON.stringify({ version: 1, payload, reason: 'Stale edit' }) })).status).toBe(409);
    const response = await fetch(url, { headers }); expect(response.headers.get('cache-control')).toBe('no-store');
    const saved = await response.json(); expect(saved.records).toHaveLength(1); expect(saved.history).toHaveLength(2);
    delete process.env.ADMIN_TOKEN; expect((await fetch(url, { headers })).status).toBe(503);
  } finally { if (previous === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = previous; await new Promise(r => server.close(r)); store.close(); }
});
