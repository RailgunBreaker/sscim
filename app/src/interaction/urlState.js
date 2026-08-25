/* ====================================================================
   interaction/urlState.js — serialize the shareable slice of interaction
   state into a compact URL hash and back (task §12), so a specific view
   (lens, pinned entity, reviewed date, explained path) can be linked and
   restored. Pure and dependency-free so it can be unit-tested and reused
   without touching the DOM.

   Encoded keys (all optional; omitted when at their default):
     lens  = analytical lens (omitted when 'structural')
     sel   = "<type>:<id>" pinned entity
     asof  = history-review offset in days before the snapshot date
             (omitted when 0, i.e. live)
     path  = "<sourceId>>" + "<targetId>"  explained route endpoints

   NOT encoded, deliberately:
     · the hazard overlay — a transient screening hypothesis, and a link
       that silently opened on someone else's what-if would be read as an
       observation. Scenario authoring is gone; nothing else creates one.
     · the watchlist — a standing personal preference kept in localStorage,
       never in a shareable URL (see WatchlistContext.jsx).
   ==================================================================== */

import { LENSES, VIEW_MODES, FACILITY_DIRECTIONS } from './reducer.js';

const SEL_TYPES = ['country', 'stage', 'company', 'event', 'scenario', 'centre', 'facility'];

function parseEntity(str, allowed) {
  if (!str) return null;
  const idx = str.indexOf(':');
  if (idx < 0) return null;
  const type = str.slice(0, idx);
  const id = str.slice(idx + 1);
  if (!id || !allowed.includes(type)) return null;
  return { type, id };
}

export function encodeInteractionState({ lens, viewMode, selected, asOfDaysAgo, focusedPath } = {}) {
  const p = new URLSearchParams();

  if (viewMode && viewMode !== 'geographic' && VIEW_MODES.includes(viewMode)) p.set('view', viewMode);
  if (lens && lens !== 'structural' && LENSES.includes(lens)) p.set('lens', lens);
  if (selected && SEL_TYPES.includes(selected.type) && selected.id) p.set('sel', `${selected.type}:${selected.id}`);

  if (Number.isFinite(asOfDaysAgo) && asOfDaysAgo > 0) p.set('asof', String(Math.floor(asOfDaysAgo)));
  if (focusedPath?.sourceId && focusedPath?.targetId) p.set('path', `${focusedPath.sourceId}>${focusedPath.targetId}`);

  return p.toString();
}

/* Network-playground state (§33): active metric, temporary removals, and the
   pinned route (origin>dest>objective, re-derived on restore). Kept in a
   separate helper so the core codec above stays focused. */
export function encodeNetworkState({ analysisMetric, removedNodeIds, removedEdgeIds, route } = {}) {
  const p = new URLSearchParams();
  if (analysisMetric) p.set('metric', analysisMetric);
  if (removedNodeIds?.length) p.set('rn', removedNodeIds.join(','));
  if (removedEdgeIds?.length) p.set('re', removedEdgeIds.join(','));
  if (route?.origin && route?.dest) p.set('rt', `${route.origin}>${route.dest}>${route.objective || 'strongest'}`);
  return p.toString();
}

export function decodeNetworkState(str) {
  const out = {};
  if (!str) return out;
  const p = new URLSearchParams(str.replace(/^[#?]/, ''));
  const metric = p.get('metric');
  if (metric) out.analysisMetric = metric;
  const rn = p.get('rn');
  if (rn) out.removedNodeIds = rn.split(',').filter(Boolean);
  const re = p.get('re');
  if (re) out.removedEdgeIds = re.split(',').filter(Boolean);
  const rt = p.get('rt');
  if (rt) {
    const [origin, dest, objective] = rt.split('>');
    if (origin && dest) out.route = { origin, dest, objective: objective || 'strongest' };
  }
  return out;
}

/* ====================================================================
   Facility-playground state (§ Priority 0).

   Kept in its own codec, and every key prefixed `fac`, so an existing
   SSCIM link that carries none of them decodes to an empty object and
   opens exactly as it did before. Nothing here is required; the
   playground falls back to its own defaults for anything absent.

   Compactness matters — these hashes get pasted into chat — so the
   defaults are omitted rather than written out, ids are comma-joined,
   and filters collapse to one `k:v` list with only the non-default keys.
   ==================================================================== */
const FAC_LIST_KEYS = [['expanded', 'facx'], ['collapsed', 'facc'], ['hidden', 'fach']];

export function encodeFacilityState(fac = {}) {
  const p = new URLSearchParams();
  if (!fac || !fac.focusId) return p.toString();

  p.set('fac', fac.focusId);
  if (fac.rootId && fac.rootId !== fac.focusId) p.set('facr', fac.rootId);
  if (Number.isFinite(fac.hops) && fac.hops !== 1) p.set('facd', String(fac.hops));
  else if (fac.hops === Infinity) p.set('facd', 'all');
  if (fac.direction && fac.direction !== 'both' && FACILITY_DIRECTIONS.includes(fac.direction)) p.set('facdir', fac.direction);

  FAC_LIST_KEYS.forEach(([field, key]) => {
    const list = (fac[field] || []).filter(Boolean);
    if (list.length) p.set(key, list.join(','));
  });

  /* The trail is what makes "move backward through exploration history"
     survive a reload. Bounded hard: a shareable URL is not a place to
     store forty ids, and the tail is the part a reader actually walks
     back to. */
  const trail = (fac.trail || []).filter(Boolean).slice(-8);
  if (trail.length) p.set('fact', trail.join(','));

  const f = fac.filters || {};
  const parts = Object.entries(f)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all' && v !== 0)
    .map(([k, v]) => `${k}:${v}`);
  if (parts.length) p.set('facf', parts.join(','));

  if (fac.selectedLink) p.set('facl', fac.selectedLink);
  if (fac.route?.from && fac.route?.to) p.set('facrt', `${fac.route.from}>${fac.route.to}`);

  return p.toString();
}

export function decodeFacilityState(str) {
  const out = {};
  if (!str) return out;
  const p = new URLSearchParams(str.replace(/^[#?]/, ''));

  const focusId = p.get('fac');
  if (!focusId) return out;
  out.focusId = focusId;
  out.rootId = p.get('facr') || focusId;

  const depth = p.get('facd');
  if (depth === 'all') out.hops = Infinity;
  else if (depth && Number.isFinite(Number(depth))) out.hops = Math.max(1, Math.min(6, Math.floor(Number(depth))));

  const dir = p.get('facdir');
  if (dir && FACILITY_DIRECTIONS.includes(dir)) out.direction = dir;

  FAC_LIST_KEYS.forEach(([field, key]) => {
    const raw = p.get(key);
    if (raw) out[field] = raw.split(',').filter(Boolean);
  });

  const trail = p.get('fact');
  if (trail) out.trail = trail.split(',').filter(Boolean);

  const facf = p.get('facf');
  if (facf) {
    const filters = {};
    facf.split(',').forEach((pair) => {
      const at = pair.indexOf(':');
      if (at < 1) return;
      const k = pair.slice(0, at);
      const v = pair.slice(at + 1);
      filters[k] = k === 'minRel' ? Number(v) || 0 : v;
    });
    if (Object.keys(filters).length) out.filters = filters;
  }

  const link = p.get('facl');
  if (link) out.selectedLink = link;

  const rt = p.get('facrt');
  if (rt && rt.includes('>')) {
    const [from, to] = rt.split('>');
    if (from && to) out.route = { from, to };
  }

  return out;
}

export function decodeInteractionState(str) {
  const out = {};
  if (!str) return out;
  const p = new URLSearchParams(str.replace(/^[#?]/, ''));

  const view = p.get('view');
  if (view && VIEW_MODES.includes(view)) out.viewMode = view;

  const lens = p.get('lens');
  if (lens && LENSES.includes(lens)) out.lens = lens;

  const sel = parseEntity(p.get('sel'), SEL_TYPES);
  if (sel) out.selected = sel;

  const asofRaw = Number(p.get('asof'));
  if (Number.isFinite(asofRaw) && asofRaw > 0) out.asOfDaysAgo = Math.floor(asofRaw);

  const path = p.get('path');
  if (path && path.includes('>')) {
    const [sourceId, targetId] = path.split('>');
    if (sourceId && targetId) out.focusedPath = { sourceId, targetId };
  }

  return out;
}
