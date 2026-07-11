/* ====================================================================
   interaction/urlState.js — serialize the shareable slice of interaction
   state into a compact URL hash and back (task §12), so a specific view
   (lens, pinned entity, active scenario, playback hop, explained path) can
   be linked and restored. Pure and dependency-free so it can be
   unit-tested and reused without touching the DOM.

   Encoded keys (all optional; omitted when at their default):
     lens  = analytical lens (omitted when 'structural')
     sel   = "<type>:<id>" pinned entity
     scn   = active scenario id (omitted when 'none')
     src   = "<type>:<id>,…" custom-scenario draft sources (scn=custom only)
     sev   = custom-scenario severity      (scn=custom only)
     dir   = custom-scenario direction     (scn=custom only)
     step  = playback hop index (omitted when 0)
     path  = "<sourceId>>" + "<targetId>"  explained route endpoints
   ==================================================================== */

import { LENSES, DRAFT_DIRECTIONS, VIEW_MODES } from './reducer.js';

const SEL_TYPES = ['country', 'stage', 'company', 'event', 'scenario', 'centre'];
const SRC_TYPES = ['stage', 'country'];

function parseEntity(str, allowed) {
  if (!str) return null;
  const idx = str.indexOf(':');
  if (idx < 0) return null;
  const type = str.slice(0, idx);
  const id = str.slice(idx + 1);
  if (!id || !allowed.includes(type)) return null;
  return { type, id };
}

export function encodeInteractionState({ lens, viewMode, selected, scenarioId, draft, playbackStep, focusedPath } = {}) {
  const p = new URLSearchParams();

  if (viewMode && viewMode !== 'geographic' && VIEW_MODES.includes(viewMode)) p.set('view', viewMode);
  if (lens && lens !== 'structural' && LENSES.includes(lens)) p.set('lens', lens);
  if (selected && SEL_TYPES.includes(selected.type) && selected.id) p.set('sel', `${selected.type}:${selected.id}`);

  if (scenarioId && scenarioId !== 'none') {
    p.set('scn', scenarioId);
    if (scenarioId === 'custom' && draft) {
      const src = (draft.sources || [])
        .filter((s) => SRC_TYPES.includes(s.type) && s.id)
        .map((s) => `${s.type}:${s.id}`);
      if (src.length) p.set('src', src.join(','));
      if (typeof draft.severity === 'number') p.set('sev', String(draft.severity));
      if (draft.direction) p.set('dir', draft.direction);
    }
  }

  if (playbackStep && playbackStep > 0) p.set('step', String(playbackStep));
  if (focusedPath?.sourceId && focusedPath?.targetId) p.set('path', `${focusedPath.sourceId}>${focusedPath.targetId}`);

  return p.toString();
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

  const scn = p.get('scn');
  if (scn) {
    out.scenarioId = scn;
    if (scn === 'custom') {
      const sources = (p.get('src') || '')
        .split(',')
        .map((s) => parseEntity(s, SRC_TYPES))
        .filter(Boolean);
      const sevRaw = Number(p.get('sev'));
      const dir = p.get('dir');
      out.draft = {
        sources,
        severity: Number.isFinite(sevRaw) ? Math.max(1, Math.min(10, sevRaw)) : 6,
        direction: DRAFT_DIRECTIONS.includes(dir) ? dir : 'adverse',
      };
    }
  }

  const stepRaw = Number(p.get('step'));
  if (Number.isFinite(stepRaw) && stepRaw > 0) out.playbackStep = Math.floor(stepRaw);

  const path = p.get('path');
  if (path && path.includes('>')) {
    const [sourceId, targetId] = path.split('>');
    if (sourceId && targetId) out.focusedPath = { sourceId, targetId };
  }

  return out;
}
