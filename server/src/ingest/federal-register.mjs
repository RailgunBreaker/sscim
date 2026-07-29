/* Federal Register API → event candidates.

   Free, keyless, and authoritative for U.S. export-control and trade actions
   (BIS rules, entity-list additions) — the highest-signal automatable feed for
   this model, and the one already demonstrated in
   computation-demo/REAL_DATA_EXAMPLE.md. Everything it yields is a PROPOSAL
   pending review; a published rule is a fact, but its severity and which
   stages it touches are judgments.

   Two queries, deduped, because neither alone is sufficient:

     1. Everything from BIS. Low volume (~30/year) and high relevance density,
        so the AI relevance gate can afford to read all of it. An agency+keyword
        AND-filter looks tighter but silently drops rules whose titles don't say
        "semiconductor" — the Jul 2026 "Enhanced Favorable Treatment for the
        United Arab Emirates Under the EAR" is exactly that shape.
     2. Keyword-matched documents from ANY agency, for semiconductor actions
        that don't originate at BIS. */

const API = 'https://www.federalregister.gov/api/v1/documents.json';
const FIELDS = ['title', 'abstract', 'publication_date', 'html_url', 'type', 'agencies', 'action', 'document_number'];
const BIS = 'industry-and-security-bureau';
const TERMS = 'semiconductor OR "advanced computing" OR "integrated circuit" OR lithography OR "entity list" OR "export administration regulations"';

async function query(extra, { since, until }) {
  const params = new URLSearchParams({
    'conditions[publication_date][gte]': since,
    'conditions[publication_date][lte]': until,
    per_page: '50',
    order: 'newest',
    ...extra,
  });
  for (const f of FIELDS) params.append('fields[]', f);
  if (extra['conditions[agencies][]']) {
    params.delete('conditions[agencies][]');
    params.append('conditions[agencies][]', extra['conditions[agencies][]']);
  }
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'sscim-pipeline/1.0' } });
  if (!res.ok) throw new Error(`Federal Register API returned HTTP ${res.status}`);
  return (await res.json()).results ?? [];
}

export async function fetchPolicyCandidates({ since, until }) {
  const [fromBis, byTerm] = await Promise.all([
    query({ 'conditions[agencies][]': BIS }, { since, until }),
    query({ 'conditions[term]': TERMS }, { since, until }),
  ]);

  const seen = new Set();
  const out = [];
  for (const d of [...fromBis, ...byTerm]) {
    if (seen.has(d.document_number)) continue;
    seen.add(d.document_number);
    out.push({
      sourceFeed: 'federal-register',
      sourceRef: d.document_number,
      dateISO: d.publication_date,
      raw: {
        title: d.title,
        abstract: d.abstract,
        action: d.action,
        // "Rule" | "Proposed Rule" | "Notice" — a proposed rule is not a realized
        // change, which is what should drive it out of the scored index.
        documentType: d.type,
        agencies: (d.agencies ?? []).map((a) => a.name),
        url: d.html_url,
        documentNumber: d.document_number,
      },
    });
  }
  return out;
}
