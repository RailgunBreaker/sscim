/* ====================================================================
   interaction/watchlist.js — what this reader is tracking.

   The dashboard shows the whole chain. A user watches four or five things
   in it: their own suppliers, the product they buy, the plant that makes
   it, the route it travels. This module is that list — the only piece of
   per-reader state in the application.

   Four kinds, because they answer different questions:

     company   "is my supplier in trouble" — criticality and vulnerability
     stage     "is the product I buy under pressure" — the 24 chain steps,
               which is what a buyer means by a product
     facility  "is the plant that makes it still running" — a named site
     route     "is the path from A to B intact" — a stage-to-stage lane,
               which is what a reader means by a supply chain

   Pure and dependency-free: no React, no storage calls. Persistence is the
   caller's business (WatchlistContext), which keeps the merge/normalise
   rules here testable without a DOM.

   Stored shape is deliberately minimal — {type, id} and nothing else — so a
   watchlist saved today still resolves against a vault rebuilt tomorrow. It
   holds references, never copies: if a company is renamed or a plant closes,
   the watchlist follows the vault rather than preserving a stale snapshot of
   it. An entry whose target no longer exists is reported, not silently
   dropped, because a supplier disappearing from the dataset is exactly the
   kind of thing a reader tracking it should be told about.
   ==================================================================== */

export const WATCH_TYPES = Object.freeze(['company', 'stage', 'facility', 'route']);

export const WATCH_TYPE_LABEL = Object.freeze({
  company: 'Company',
  stage: 'Product / stage',
  facility: 'Facility',
  route: 'Supply route',
});

export const MAX_WATCHED = 40;

/* A route is a stage-to-stage lane, keyed by its endpoints so the same lane
   is the same entry however it was added. */
export const routeId = (fromStage, toStage) => `${fromStage}>${toStage}`;
export const parseRouteId = (id) => {
  const [from, to] = String(id ?? '').split('>');
  return from && to ? { from, to } : null;
};

export const sameEntry = (a, b) => Boolean(a && b && a.type === b.type && a.id === b.id);

export const isWatched = (list, entry) => (list || []).some((w) => sameEntry(w, entry));

/* Reject anything malformed rather than storing it. A watchlist that can
   contain junk becomes a source of render crashes on the next load, in a
   feature whose whole point is that it survives reloads. */
export function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const type = String(entry.type || '');
  const id = String(entry.id ?? '');
  if (!WATCH_TYPES.includes(type) || !id || id.length > 120) return null;
  if (type === 'route' && !parseRouteId(id)) return null;
  return { type, id };
}

export function normalizeList(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const e = normalizeEntry(raw);
    if (!e || isWatched(out, e)) continue;
    out.push(e);
    if (out.length >= MAX_WATCHED) break;
  }
  return out;
}

export function toggleEntry(list, entry) {
  const e = normalizeEntry(entry);
  if (!e) return list || [];
  const current = list || [];
  if (isWatched(current, e)) return current.filter((w) => !sameEntry(w, e));
  if (current.length >= MAX_WATCHED) return current; // cap, reported by the UI
  return [...current, e];
}

export function removeEntry(list, entry) {
  const e = normalizeEntry(entry);
  return (list || []).filter((w) => !sameEntry(w, e));
}

/* Resolve a watchlist against the current vault + model into rows the panel
   renders. Each row carries a `value` (its headline reading), a `signed`
   operational effect where one applies, and `missing: true` when the target
   is no longer in the vault.

   `ctx` needs: COMPANY_BY_ID, STAGE_BY_ID, FACILITY_LAYER, engine, model. */
export function resolveWatchlist(list, ctx) {
  const { COMPANY_BY_ID = {}, STAGE_BY_ID = {}, FACILITY_LAYER = null, engine = null, model = null } = ctx || {};
  const field = model?.activeField || {};

  return (list || []).map((w) => {
    const base = { ...w, label: w.id, sublabel: '', value: null, signed: 0, missing: false };

    if (w.type === 'company') {
      const co = COMPANY_BY_ID[w.id];
      if (!co) return { ...base, missing: true, sublabel: 'no longer in the vault' };
      const crit = engine?.COMPANY_CRITICALITY?.[w.id]?.value ?? null;
      const vuln = engine?.companyVulnerability ? engine.companyVulnerability(co, field) : null;
      return {
        ...base,
        label: co.name,
        sublabel: `criticality ${crit != null ? crit.toFixed(2) : '—'} · vulnerability ${vuln != null ? vuln.toFixed(2) : '—'}`,
        value: crit,
        signed: Object.keys(co.stakes || {}).reduce((m, sid) => (Math.abs(field[sid] ?? 0) > Math.abs(m) ? field[sid] : m), 0),
      };
    }

    if (w.type === 'stage') {
      const st = STAGE_BY_ID[w.id];
      if (!st) return { ...base, missing: true, sublabel: 'no longer in the vault' };
      const structural = engine?.STRUCTURAL_VULNERABILITY?.[w.id] ?? null;
      return {
        ...base,
        label: st.name,
        sublabel: `structural ${structural != null ? structural.toFixed(2) : '—'}`,
        value: structural,
        signed: field[w.id] ?? 0,
      };
    }

    if (w.type === 'facility') {
      const f = FACILITY_LAYER?.FACILITY_BY_ID?.[w.id];
      if (!f) return { ...base, missing: true, sublabel: 'no longer in the vault' };
      const signed = (f.stages || []).reduce((m, sid) => (Math.abs(field[sid] ?? 0) > Math.abs(m) ? field[sid] : m), 0);
      return {
        ...base,
        label: f.name,
        sublabel: `${f.status} · ${(f.stages || []).map((sid) => STAGE_BY_ID[sid]?.name || sid).join(', ')}`,
        value: null,
        signed,
      };
    }

    // route
    const parsed = parseRouteId(w.id);
    const from = parsed && STAGE_BY_ID[parsed.from];
    const to = parsed && STAGE_BY_ID[parsed.to];
    if (!from || !to) return { ...base, missing: true, sublabel: 'one end is no longer in the vault' };
    /* A route's reading is the worse of its two endpoints. A lane is only as
       intact as its most disrupted end; averaging would let a healthy origin
       hide a stopped destination. */
    const a = field[parsed.from] ?? 0;
    const b = field[parsed.to] ?? 0;
    const signed = Math.abs(a) >= Math.abs(b) ? a : b;
    return {
      ...base,
      label: `${from.name} → ${to.name}`,
      sublabel: 'worse of the two endpoints',
      value: null,
      signed,
    };
  });
}
