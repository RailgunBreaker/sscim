/* Story-level deduplication for ingested news candidates.

   The existing guards are not enough on their own. `ON CONFLICT(source_feed,
   source_ref)` only catches the *same upstream record*, and webz-news.mjs's
   in-run `seen` set only catches repeats within a single invocation. Neither
   catches the case that actually fills the review queue: one story syndicated
   across a dozen sites, each copy carrying its own uuid and url, arriving
   over several days as the wire picks it up. The reviewer then reads
   "Sony halts Kumamoto chip plant operations" eight times and rejects seven.

   So dedupe on what the story *says*, not on where it came from:

     storyKey()  a sorted signature of the meaningful title tokens, so
                 headline reorderings collapse to one key.
     similarity  Jaccard overlap of those token sets, to catch rewrites that
                 change a word or two ("halts" vs "suspends") and so would
                 not produce an identical key.

   Scoped to a time window, because the same headline a year apart is usually
   a genuinely new event (another quake, another export-control package), not
   a duplicate. */

/* Words that carry no distinguishing signal in a supply-chain headline: they
   appear in most of them, so leaving them in inflates similarity between
   unrelated stories. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by',
  'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that',
  'after', 'amid', 'over', 'into', 'out', 'up', 'down', 'new', 'says', 'say', 'said',
  'report', 'reports', 'reported', 'update', 'updates', 'news', 'latest', 'breaking',
  'exclusive', 'analysis', 'will', 'may', 'could', 'would', 'more', 'than', 'about',
]);

export function tokenize(title) {
  return [...new Set(
    String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  )].sort();
}

/* Stable signature: same tokens in any order produce the same key. Capped so
   a very long headline cannot dodge a match on its tail. */
export function storyKey(title) {
  return tokenize(title).slice(0, 12).join('-');
}

export function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t)).length;
  return shared / (a.length + b.length - shared);
}

export const DUPLICATE_THRESHOLD = 0.6;
export const WINDOW_DAYS = 21;

const dayDiff = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;

/* Returns { id, exact } for the candidate this one duplicates, or null.

   `existing` is [{ id, date_iso, dedupe_key, title }]. Checked against every
   status — a story already rejected once should not come back tomorrow under
   a different url and cost the reviewer the same decision twice.

   The two outcomes are deliberately not treated alike. `exact` means an
   identical set of meaningful tokens — a pure reordering or capitalization
   change, which is safe to collapse without a human. A similarity match is a
   *rewrite*, and rewrites are where a genuinely distinct event hides: "export
   curbs on chip equipment" and "export curbs on chip materials" differ by one
   token and are two different rules. Those are only flagged, never
   auto-rejected, because the cost of wrongly dropping a real event is far
   higher than the cost of one extra glance in the queue. */
export function findDuplicate(candidate, existing, { threshold = DUPLICATE_THRESHOLD, windowDays = WINDOW_DAYS } = {}) {
  const title = candidate.raw?.title;
  if (!title) return null;
  const key = storyKey(title);
  if (!key) return null;
  const tokens = tokenize(title);
  let near = null;

  for (const prior of existing) {
    if (prior.date_iso && candidate.dateISO && dayDiff(prior.date_iso, candidate.dateISO) > windowDays) continue;
    if (prior.dedupe_key && prior.dedupe_key === key) return { id: prior.id, exact: true };
    if (!near && prior.title && similarity(tokens, tokenize(prior.title)) >= threshold) near = { id: prior.id, exact: false };
  }
  return near;
}
