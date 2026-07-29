/* webz.io news feed → event candidates.

   The gap this fills: USGS reports that the ground shook and the Federal
   Register reports that a rule was published, but neither reports that *a fab
   stopped*. Most real supply-chain events — a plant halt, a fire, a licensing
   dispute, a memory squeeze — only ever surface as news. Without this feed the
   pipeline would have caught the Kumamoto earthquake and completely missed
   "Sony halts Kumamoto chip plant operations", which is the part that actually
   moves the model.

   Free tier: 1000 requests/month, 10 posts per request. Each run spends one
   request per query below (~4/day, ~120/month), leaving comfortable headroom.

   Query design, learned the hard way by testing against the live endpoint:
     - Unscoped terms match article BODIES and come back unranked, so
       "semiconductor OR chip" returns lacrosse results. Everything is
       title-scoped.
     - Two title: clauses AND together, which is what gives precision.
     - THE QUERY IS CAPPED AT 100 CHARACTERS, including the language filter.
       Over that the API returns HTTP 500 "internal error" with the real reason
       buried in a warning line — so a too-long query fails silently-ish rather
       than obviously. assertQueryLengths() below makes that a startup error
       instead of a mystery at 06:30.
     - A failing query must not kill the run; each is caught independently. */

const API = 'https://api.webz.io/newsApiLite';
const LANG = 'language:english';
const MAX_QUERY_CHARS = 100;

/* Deliberately narrow, and short enough to fit the cap. The AI relevance gate
   is the real filter, but feeding it 4000 stock-movement headlines a day would
   waste its budget on noise. */
export const QUERIES = [
  { id: 'disruption', q: 'title:(chip OR fab OR wafer) title:(halt OR fire OR quake OR outage)' },
  { id: 'supply',     q: 'title:(chip OR memory) title:(shortage OR supply OR disruption)' },
  { id: 'policy',     q: 'title:(chip OR semiconductor) title:(export OR sanction OR curb)' },
  { id: 'makers',     q: 'title:(TSMC OR ASML OR Micron OR Nexperia OR Renesas)' },
  { id: 'makers2',    q: 'title:(Samsung OR Kioxia OR SMIC OR Intel) title:(chip OR fab)' },
];

/* Called at module load: a query that outgrows the cap must fail loudly here,
   not as an HTTP 500 in an unattended run. */
export function assertQueryLengths(queries = QUERIES) {
  const tooLong = queries
    .map((x) => ({ ...x, len: `${x.q} ${LANG}`.length }))
    .filter((x) => x.len > MAX_QUERY_CHARS);
  if (tooLong.length) {
    throw new Error(`webz queries exceed the ${MAX_QUERY_CHARS}-char cap: ${tooLong.map((x) => `${x.id} (${x.len})`).join(', ')}`);
  }
}
assertQueryLengths();

const MAX_PER_RUN = 12; // bounds analysis cost; newest first

export async function fetchNewsCandidates({ since, until, token = process.env.WEBZ_TOKEN } = {}) {
  if (!token) return [];

  // webz `ts` is a millisecond epoch lower bound.
  const sinceMs = Date.parse(`${since}T00:00:00Z`);
  const untilMs = until ? Date.parse(`${until}T23:59:59Z`) : Date.now();

  const seen = new Set();
  const out = [];

  for (const { id, q } of QUERIES) {
    try {
      const url = `${API}?token=${encodeURIComponent(token)}&q=${encodeURIComponent(`${q} ${LANG}`)}&ts=${sinceMs}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'sscim-pipeline/1.0' } });
      const body = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);

      let json;
      try { json = JSON.parse(body); } catch { throw new Error(`non-JSON response: ${body.slice(0, 120)}`); }

      for (const p of json.posts ?? []) {
        const publishedMs = Date.parse(p.published);
        if (Number.isFinite(publishedMs) && publishedMs > untilMs) continue;

        // Dedupe on two axes. By id/url, because one story matches several
        // queries. And by normalized title, because wire stories are syndicated
        // across sites with different URLs — without this the analysis step
        // pays to read "Sony halts Kumamoto chip plant" three times and the
        // review queue fills with duplicates of one event.
        const ref = p.uuid || p.url;
        if (!ref || seen.has(ref)) continue;
        const titleKey = `t:${(p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)}`;
        if (!titleKey || seen.has(titleKey)) continue;
        seen.add(ref);
        seen.add(titleKey);

        out.push({
          sourceFeed: 'webz-news',
          sourceRef: ref,
          dateISO: (p.published || new Date().toISOString()).slice(0, 10),
          raw: {
            title: p.title,
            // Trimmed: the analysis step can WebFetch the URL when the snippet
            // is too thin to judge.
            excerpt: (p.text || '').replace(/\s+/g, ' ').trim().slice(0, 1200),
            site: p.thread?.site,
            siteType: p.thread?.site_type,
            country: p.thread?.country,
            published: p.published,
            url: p.url,
            matchedQuery: id,
          },
        });
      }
    } catch (err) {
      // One bad query must not lose the other three.
      console.warn(`    webz query "${id}" failed: ${err.message}`);
    }
  }

  out.sort((a, b) => Date.parse(b.raw.published || 0) - Date.parse(a.raw.published || 0));
  return out.slice(0, MAX_PER_RUN);
}
