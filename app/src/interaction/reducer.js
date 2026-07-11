/* ====================================================================
   interaction/reducer.js — the single source of truth for cross-panel
   interaction state, shared by the world map, industry graph, scenario
   bar, scenario builder, and intelligence panel.

   Pure and dependency-free (no React) so the selection/lens/playback
   rules live in exactly one place and can be unit-tested directly,
   rather than being re-derived independently inside each component.

   Shape (see task §3):
     {
       lens: "structural" | "operational" | "delta" | "share",
       selected: null | { type, id },
       hovered:  null | { type, id },
       focusedPath: null | { sourceId, targetId, edgeIds: [] },
       scenarioActive: boolean,        // mirror so the reducer can gate the Δ lens
       playback: { status, step, speed, length },
       history: [ {type,id}, ... ]      // back-stack of prior selections
     }
   ==================================================================== */

export const LENSES = ['structural', 'operational', 'delta', 'share'];

export const LENS_LABELS = {
  structural: 'Structural',
  operational: 'Operational',
  delta: 'Scenario Δ',
  share: 'Selected share',
};

export function sameSel(a, b) {
  if (!a || !b) return a === b;
  return a.type === b.type && a.id === b.id;
}

export const DRAFT_DIRECTIONS = ['adverse', 'mitigating', 'neutral'];

export function initInteraction(defaultSelected = null) {
  return {
    lens: 'structural',
    selected: defaultSelected,
    hovered: null,
    focusedPath: null,
    scenarioActive: false,
    playback: { status: 'idle', step: 0, speed: 1, length: 0 },
    history: [],
    // Draft scenario being composed directly on the map/graph (§10). Its
    // sources are the stages/countries the user has marked as shock origins;
    // building it hands off to the same engine every preset scenario uses.
    draft: { builderMode: false, sources: [], severity: 6, direction: 'adverse' },
  };
}

/* Whether a given entity is already a draft-scenario source. */
export function isDraftSource(draft, entity) {
  if (!draft || !entity) return false;
  return draft.sources.some((s) => s.type === entity.type && s.id === entity.id);
}

/* Whether a given lens can currently be applied. Scenario Δ is only
   meaningful once a scenario is active; the UI disables it otherwise and
   the reducer refuses to switch to it (§4). */
export function lensAvailable(lens, scenarioActive) {
  if (lens === 'delta') return Boolean(scenarioActive);
  return LENSES.includes(lens);
}

export function interactionReducer(state, action) {
  switch (action.type) {
    case 'SELECT': {
      const next = action.payload; // {type,id} | null
      const history = state.selected && !sameSel(state.selected, next)
        ? [...state.history, state.selected].slice(-25)
        : state.history;
      // Manually selecting another entity pauses playback (§7).
      const playback = state.playback.status === 'playing'
        ? { ...state.playback, status: 'paused' }
        : state.playback;
      return { ...state, selected: next, history, playback };
    }

    case 'HOVER':
      return { ...state, hovered: action.payload };

    case 'CLEAR_HOVER':
      return { ...state, hovered: null };

    case 'CLEAR':
      return { ...state, selected: null, hovered: null, focusedPath: null };

    case 'BACK': {
      if (!state.history.length) return { ...state, selected: null };
      const selected = state.history[state.history.length - 1];
      return { ...state, selected, history: state.history.slice(0, -1) };
    }

    case 'SET_LENS': {
      const lens = action.payload;
      if (!lensAvailable(lens, state.scenarioActive)) return state;
      return { ...state, lens };
    }

    case 'SET_FOCUSED_PATH':
      return { ...state, focusedPath: action.payload };

    // Kept in sync from App whenever the active scenario changes. Activating
    // a scenario makes Scenario Δ the default lens; deactivating it while Δ
    // is showing falls back to Structural so no panel is left on an
    // unavailable lens (§4).
    case 'SET_SCENARIO_ACTIVE': {
      const scenarioActive = Boolean(action.payload);
      if (scenarioActive === state.scenarioActive) return state;
      let lens = state.lens;
      if (scenarioActive) lens = 'delta';
      else if (state.lens === 'delta') lens = 'structural';
      return { ...state, scenarioActive, lens };
    }

    // ---- draft scenario composition (§10) ----
    case 'DRAFT_TOGGLE_SOURCE': {
      const src = action.payload; // { type:'stage'|'country', id }
      if (!src) return state;
      const exists = state.draft.sources.some((s) => s.type === src.type && s.id === src.id);
      const sources = exists
        ? state.draft.sources.filter((s) => !(s.type === src.type && s.id === src.id))
        : [...state.draft.sources, { type: src.type, id: src.id }];
      return { ...state, draft: { ...state.draft, sources } };
    }

    case 'DRAFT_SET': {
      // Patch severity / direction / builderMode, and optionally replace the
      // whole source list (used when restoring a shared URL).
      const patch = action.payload || {};
      const draft = { ...state.draft, ...patch };
      if (Array.isArray(patch.sources)) draft.sources = patch.sources.filter((s) => s && s.type && s.id);
      if (typeof draft.severity === 'number') draft.severity = Math.max(1, Math.min(10, draft.severity));
      if (patch.direction && !DRAFT_DIRECTIONS.includes(patch.direction)) draft.direction = state.draft.direction;
      return { ...state, draft };
    }

    case 'DRAFT_CLEAR':
      return { ...state, draft: { ...state.draft, sources: [] } };

    case 'PLAYBACK': {
      const p = { ...state.playback, ...action.payload };
      // Never let the step run past the trace bounds (§7 / §15).
      if (typeof p.length === 'number' && p.length >= 0) {
        p.step = Math.max(0, Math.min(p.step, Math.max(0, p.length - 1)));
      }
      return { ...state, playback: p };
    }

    default:
      return state;
  }
}
