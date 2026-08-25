/* ====================================================================
   engine/eventSelection.js — which event the dashboard opens on, and how
   the events feed is searched and filtered.

   THE DEFECT THIS REPLACES. App.jsx derived its initial selection from
   `data.EVENTS[0]`, i.e. from whatever order the bundle happened to
   serialise. The vault's order is not chronological, so the dashboard
   opened on a July 3 event while the newest reviewed record was from
   August 19 — the one thing a live-reading dashboard must not get wrong.

   THE RULE. Newest is the smallest validated `daysAgo`, which is the
   field the whole engine already ages events by (see engine/math.js), and
   the only one guaranteed present and numeric. Ties are broken by the
   same ranking the status bar already uses — distance of the event's own
   operational-impact index from neutral — so "the most consequential of
   the newest" is a deterministic answer rather than an array accident. If
   even that ties, the event id breaks it, so two runs over the same
   snapshot never disagree.

   Everything here is pure and dependency-free, so the rule is unit-
   testable without mounting the dashboard.
   ==================================================================== */

/* A usable age, or null. Guards against the three things that actually
   turn up in a bundle: a missing field, a string, and NaN. */
export function validDaysAgo(event) {
  const raw = event?.daysAgo;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* The newest event in a list, regardless of the list's order.

   `rank` is optional: given one, it is used to break ties among events
   that share the newest date. Without it (or if it throws — a partially
   built engine during a restore is a real case) the tie falls back to the
   id, which is stable but arbitrary, and that is stated rather than
   dressed up as a judgement. */
export function newestEvent(events, { rank } = {}) {
  const list = Array.isArray(events) ? events.filter((e) => e && e.id) : [];
  if (!list.length) return null;

  const dated = list.map((e) => ({ e, age: validDaysAgo(e) })).filter((x) => x.age !== null);
  /* Every event has an invalid age: there is no defensible "newest", so
     return nothing rather than picking the first row and implying it is
     the latest. The caller renders no selection, which is honest. */
  if (!dated.length) return null;

  const newestAge = Math.min(...dated.map((x) => x.age));
  const tied = dated.filter((x) => x.age === newestAge).map((x) => x.e);
  if (tied.length === 1) return tied[0];

  if (typeof rank === 'function') {
    const scored = tied.map((e) => {
      let score = 0;
      try { score = Number(rank(e)) || 0; } catch { score = 0; }
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
    return scored[0].e;
  }
  return [...tied].sort((a, b) => a.id.localeCompare(b.id))[0];
}

/* The dashboard's opening selection. Returns null — not a fabricated
   selection — when the vault has no usable event, so the interface shows
   "nothing selected" instead of pointing at an arbitrary record. */
export function defaultEventSelection(events, opts) {
  const e = newestEvent(events, opts);
  return e ? { type: 'event', id: e.id } : null;
}

/* ====================================================================
   Feed search and filtering.

   Pure so the count the panel displays and the rows it renders come from
   one function — a "17 matching events" that disagreed with the list
   below it would be the same class of defect as a silent truncation.
   ==================================================================== */

export const EMPTY_EVENT_FILTERS = Object.freeze({
  query: '',
  type: 'all',
  scored: 'all',      // all | scored | excluded
  direction: 'all',   // all | adverse | mitigating | mixed
  within: 'all',      // all | 7 | 30 | 90 | 365   (days before the snapshot date)
});

export function eventFiltersActive(filters) {
  const f = { ...EMPTY_EVENT_FILTERS, ...(filters || {}) };
  return Boolean(f.query.trim()) || f.type !== 'all' || f.scored !== 'all'
    || f.direction !== 'all' || f.within !== 'all';
}

/* `assumptionOf(event)` supplies { direction, operational } — passed in
   rather than imported so this module stays free of the assumptions
   table and can be tested with a stub. */
export function filterEvents(events, filters, { assumptionOf } = {}) {
  const f = { ...EMPTY_EVENT_FILTERS, ...(filters || {}) };
  const q = f.query.trim().toLowerCase();
  const within = f.within === 'all' ? null : Number(f.within);

  return (Array.isArray(events) ? events : []).filter((e) => {
    if (!e) return false;
    if (f.type !== 'all' && e.type !== f.type) return false;

    if (within !== null) {
      const age = validDaysAgo(e);
      if (age === null || age > within) return false;
    }

    if (f.scored !== 'all' || f.direction !== 'all') {
      const a = assumptionOf ? assumptionOf(e) : null;
      if (f.scored === 'scored' && !a?.operational) return false;
      if (f.scored === 'excluded' && a?.operational) return false;
      if (f.direction !== 'all' && a?.direction !== f.direction) return false;
    }

    if (q) {
      const hay = [e.title, e.summary, e.type, e.date, ...(e.stages || []), ...(e.countries || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* Chronological, newest first — the order the feed has always used, kept
   as an explicit function so filtering can never quietly reorder it. */
export function sortEventsChronologically(events) {
  return [...(events || [])].sort((a, b) => {
    const av = validDaysAgo(a);
    const bv = validDaysAgo(b);
    if (av === null && bv === null) return String(a?.id).localeCompare(String(b?.id));
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv || String(a.id).localeCompare(String(b.id));
  });
}
