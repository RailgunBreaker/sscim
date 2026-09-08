import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const pointer = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const json = value => JSON.stringify(value);
export function evidenceStatus(row, datasetId) {
  if (row?.claimStatus === 'unreviewed') return 'unreviewed';
  if (row?.kind === 'issuer_forecast') return 'issuer_forecast';
  if (row?.kind === 'external_retrospective_estimate') return 'external_estimate';
  if (row?.kind === 'issuer_retrospective_estimate') return 'issuer_estimate';
  if (row?.modelId && ('prediction' in row || 'operational' in row)) return 'model_prediction';
  if (row?.claimStatus === 'verified' || row?.matchesAnnualTable === true) return 'source_reported';
  if (row?.status === 'assumed' || row?.status === 'assumption' || /measurement.evidence|vault\.(stages|customers)/.test(datasetId)) return 'assumption';
  if (datasetId.includes('benchmarks/') || /computation-demo\/.*results\.json$/.test(datasetId)) return 'evaluation_result';
  if (datasetId.includes('event_candidates')) return 'unreviewed';
  return 'reference_unverified';
}
export function buildStructuredEvidence(inputs) {
  const datasets = [], records = [], fields = [], sources = [], recordSources = [], entities = [], relationships = [];
  const sourceIds = new Map(), inputIds = new Set(), entityIds = new Set();
  function addEntity(id, type, name, payload) {
    const key = `${type}:${id}`;
    if (entityIds.has(key)) return;
    entityIds.add(key); entities.push({ id: key, originalId: String(id), type, name: name || String(id), payload });
  }
  for (const input of inputs) {
    if (inputIds.has(input.id)) throw new Error('Duplicate dataset ID');
    inputIds.add(input.id);
    const units = [];
    function split(value, at) {
      if (Array.isArray(value) && value.length) value.forEach((row, i) => units.push([`${at}/${i}`, row]));
      else units.push([at, value]);
    }
    if (Array.isArray(input.data)) split(input.data, '');
    else if (input.data && typeof input.data === 'object' && Object.keys(input.data).length) Object.entries(input.data).forEach(([key, value]) => split(value, `/${pointer(key)}`));
    else split(input.data, '');
    datasets.push({ id: input.id, origin: input.origin, sha256: hash(json(input.data)), recordCount: units.length,
      sourceDataShape: Array.isArray(input.data) ? 'array' : input.data === null ? 'null' : typeof input.data });
    for (const [path, row] of units) {
      const id = `record:${hash(`${input.id}#${path}`)}`, outer = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
      const object = outer.record_json && typeof outer.record_json === 'object' ? outer.record_json : outer;
      const context = path.startsWith('/records/') ? input.data : {};
      const point = typeof object.value === 'number' ? object.value : object.amount ?? object.prediction ?? (object.value?.low === object.value?.high ? object.value?.low : null);
      const record = { id, datasetId: input.id, pointer: path, originalId: object.id == null ? null : String(object.id),
        epistemicStatus: context.historicalVintagesVerified && object.availableBy && Number.isFinite(object.amount) ? 'source_reported' : evidenceStatus(object, input.id),
        subjectId: object.companyId || object.facilityId || object.company_id || context.companyId || null,
        incidentId: object.incidentId || null, metric: object.metric || context.metric || null,
        periodStart: object.periodStart || object.period || object.targetPeriod || object.observedAt || object.date_iso || null,
        periodEnd: object.periodEnd || object.period || object.targetPeriod || object.observedAt || object.date_iso || null,
        availableAt: object.source?.informationAvailableDate || object.source?.publicationDate || object.availableBy || null,
        value: Number.isFinite(point) ? point : null, units: object.units || context.units || null, payload: row };
      records.push(record);
      const linked = new Set();
      function flatten(value, fieldPath) {
        if (value !== null && typeof value === 'object') {
          Object.entries(value).forEach(([key, child]) => flatten(child, `${fieldPath}/${pointer(key)}`)); return;
        }
        const type = value === null ? 'null' : typeof value;
        fields.push({ recordId: id, pointer: fieldPath, type, number: type === 'number' ? value : null,
          text: type === 'string' ? value : type === 'boolean' ? String(value) : null });
        if (type === 'string' && /^https?:\/\/\S+$/.test(value)) {
          let url; try { url = new URL(value).href; } catch { return; }
          if (!sourceIds.has(url)) { const sid = `source:${hash(url)}`; sourceIds.set(url, sid); sources.push({ id: sid, url, claimVerification: 'URL reference only; verification belongs to individual claims' }); }
          const sid = sourceIds.get(url);
          if (!linked.has(sid)) { recordSources.push({ recordId: id, sourceId: sid }); linked.add(sid); }
        }
      }
      flatten(row, '');
      const kind = input.id.replace('vault.', '');
      if (['companies','facilities','countries','stages'].includes(kind) && object.id) addEntity(object.id, kind.slice(0, -1).replace('companie','company').replace('facilitie','facility').replace('countrie','country'), object.name, row);
      if (path.startsWith('/entities/') && object.id && object.type) addEntity(object.id, object.type, object.name, row);
      if (kind === 'customers') relationships.push({ id, fromId: object.supplier_id, toId: object.customer_id,
        type: 'legacy_company_relationship', epistemicStatus: 'assumption', payload: row });
      if (kind === 'flow_edges') relationships.push({ id, fromId: object.from_stage, toId: object.to_stage,
        type: 'modeled_stage_dependency', epistemicStatus: 'assumption', payload: row });
      if (object.supplier && object.customer) relationships.push({ id, fromId: object.supplier, toId: object.customer,
        type: object.level || 'company', epistemicStatus: record.epistemicStatus, payload: row });
      if (object.supplierCompanyId && object.customerCompanyId) relationships.push({ id, fromId: object.supplierCompanyId, toId: object.customerCompanyId,
        type: object.relationshipKind || 'unspecified', epistemicStatus: record.epistemicStatus, payload: row });
    }
  }
  const counts = { datasets: datasets.length, records: records.length, fields: fields.length, sources: sources.length,
    recordSources: recordSources.length, entities: entities.length, relationships: relationships.length };
  return { schemaVersion: 1, scope: 'All analytical vault tables, reference JSON, benchmark JSON, current computation-demo JSON, monitoring baseline and captured prospective records',
    limitations: ['Structure is not factual verification. Legacy assumptions and unreviewed candidates retain their status.',
      'Record status is not blanket verification of every field. Original payload and numeric-provenance records are retained.',
      'Dataset namespaces distinguish duplicate representations of the same claim; record counts are not independent-event counts.'],
    counts, datasets, records, fields, sources, recordSources, entities, relationships };
}
