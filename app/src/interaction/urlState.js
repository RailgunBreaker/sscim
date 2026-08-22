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

import { LENSES, VIEW_MODES } from './reducer.js';

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
