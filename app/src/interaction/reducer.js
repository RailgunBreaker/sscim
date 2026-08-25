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
  delta: 'Hazard Δ',
  share: 'Selected share',
};

export function sameSel(a, b) {
  if (!a || !b) return a === b;
  return a.type === b.type && a.id === b.id;
}

export const DRAFT_DIRECTIONS = ['adverse', 'mitigating', 'neutral'];

export const VIEW_MODES = ['geographic', 'topology', 'split', 'playground'];

/* Facility-playground defaults. This lives in the shared reducer rather
   than inside FacilityExplorer/FacilityPlayground because it was local
   component state, and local state produced two real defects: switching
   the Layer-3 tab from Explore to Events and back erased the selected
   facility, and neither the focus nor the exploration trail appeared in
   the shareable URL. Anything a reader would be annoyed to lose belongs
   here. */
export const FACILITY_DIRECTIONS = ['upstream', 'downstream', 'both'];

export function initFacilityPlayground() {
  return {
    focusId: null,      // the plant currently centred
    rootId: null,       // where this exploration started, for "back to start"
    expanded: [],       // per-node overrides that reach one hop further
    collapsed: [],      // branches folded away (the node itself still shows)
    hidden: [],         // topology-only removals, reversible
    trail: [],          // back-stack of previous focuses
    forward: [],        // redo-stack, so back/forward both work
    hops: 1,
    direction: 'both',
    filters: null,      // null = EMPTY_FILTERS (engine/facilityTraversal.js)
    selectedLink: null, // linkKey of the connection whose explanation is open
    route: null,        // { from, to } highlighted route between two visible plants
  };
}

export function initInteraction(defaultSelected = null) {
  return {
    lens: 'structural',
    // Which renderer(s) are shown (spec §9/§20): geographic (Leaflet),
    // topology (SVG functional-centre network), or both side by side.
    viewMode: 'geographic',
    selected: defaultSelected,
    hovered: null,
    focusedPath: null,
    // A pinned multi-centre route (§16/§20) selected in the route explorer.
    selectedRoute: null,
    // Active network-analysis metric (§21/§23) driving topology node size +
    // ranking; null = size by country-stage share.
    analysisMetric: null,
    // Comparison workspace (§31): up to 4 pinned centres compared side by side.
    comparison: [],
    scenarioActive: false,
    playback: { status: 'idle', step: 0, speed: 1, length: 0 },
    history: [],
    // Draft scenario being composed directly on the map/graph (§10). Its
    // sources are the stages/countries the user has marked as shock origins;
    // building it hands off to the same engine every preset scenario uses.
    draft: { builderMode: false, sources: [], severity: 6, direction: 'adverse' },
    // Reversible network-playground modifications (§26/§32): temporary node/
    // edge removals over the immutable base graph, an undo/redo stack, and a
    // multi-selection set. Reset clears the removals and restores baseline.
    playground: { removedNodeIds: [], removedEdgeIds: [], multi: [], past: [], future: [] },
    // Facility playground (§ Priority 0): focus, traversal shape and filters,
    // shared by the full playground view and the compact Layer-3 Explore tab.
    facility: initFacilityPlayground(),
  };
}

// Snapshot the current removals onto the undo stack (bounded) and clear redo.
function pushPlaygroundHistory(pg) {
  return {
    past: [...pg.past, { removedNodeIds: pg.removedNodeIds, removedEdgeIds: pg.removedEdgeIds }].slice(-50),
    future: [],
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
      return { ...state, selected: null, hovered: null, focusedPath: null, selectedRoute: null };

    case 'SET_ROUTE':
      return { ...state, selectedRoute: action.payload };

    case 'SET_METRIC':
      return { ...state, analysisMetric: action.payload };

    // ---- comparison workspace (§31): up to 4 pinned items ----
    case 'CMP_TOGGLE': {
      const e = action.payload;
      if (!e) return state;
      const key = `${e.type}:${e.id}`;
      const has = state.comparison.some((c) => `${c.type}:${c.id}` === key);
      if (has) return { ...state, comparison: state.comparison.filter((c) => `${c.type}:${c.id}` !== key) };
      if (state.comparison.length >= 4) return state; // cap at 4
      return { ...state, comparison: [...state.comparison, { type: e.type, id: e.id }] };
    }

    case 'CMP_CLEAR':
      return { ...state, comparison: [] };

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

    case 'SET_VIEW_MODE': {
      const viewMode = action.payload;
      if (!VIEW_MODES.includes(viewMode)) return state;
      return { ...state, viewMode };
    }

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

    // ---- network playground: reversible node/edge removal (§26/§32) ----
    case 'PG_TOGGLE_NODE': {
      const pg = state.playground;
      const id = action.payload;
      if (!id) return state;
      const has = pg.removedNodeIds.includes(id);
      const removedNodeIds = has ? pg.removedNodeIds.filter((x) => x !== id) : [...pg.removedNodeIds, id];
      return { ...state, playground: { ...pg, ...pushPlaygroundHistory(pg), removedNodeIds } };
    }

    case 'PG_TOGGLE_EDGE': {
      const pg = state.playground;
      const id = action.payload;
      if (!id) return state;
      const has = pg.removedEdgeIds.includes(id);
      const removedEdgeIds = has ? pg.removedEdgeIds.filter((x) => x !== id) : [...pg.removedEdgeIds, id];
      return { ...state, playground: { ...pg, ...pushPlaygroundHistory(pg), removedEdgeIds } };
    }

    case 'PG_RESET': {
      const pg = state.playground;
      if (!pg.removedNodeIds.length && !pg.removedEdgeIds.length) return state;
      return { ...state, playground: { ...pg, ...pushPlaygroundHistory(pg), removedNodeIds: [], removedEdgeIds: [] } };
    }

    case 'PG_UNDO': {
      const pg = state.playground;
      if (!pg.past.length) return state;
      const prev = pg.past[pg.past.length - 1];
      return { ...state, playground: {
        ...pg,
        removedNodeIds: prev.removedNodeIds,
        removedEdgeIds: prev.removedEdgeIds,
        past: pg.past.slice(0, -1),
        future: [{ removedNodeIds: pg.removedNodeIds, removedEdgeIds: pg.removedEdgeIds }, ...pg.future],
      } };
    }

    case 'PG_REDO': {
      const pg = state.playground;
      if (!pg.future.length) return state;
      const next = pg.future[0];
      return { ...state, playground: {
        ...pg,
        removedNodeIds: next.removedNodeIds,
        removedEdgeIds: next.removedEdgeIds,
        past: [...pg.past, { removedNodeIds: pg.removedNodeIds, removedEdgeIds: pg.removedEdgeIds }],
        future: pg.future.slice(1),
      } };
    }

    case 'PG_SET': {
      // Set removals directly (used when restoring a shared URL); clears the
      // undo/redo stacks since there is no prior in-session history.
      const pg = state.playground;
      const { removedNodeIds = [], removedEdgeIds = [] } = action.payload || {};
      return { ...state, playground: { ...pg, removedNodeIds, removedEdgeIds, past: [], future: [] } };
    }

    case 'PG_TOGGLE_MULTI': {
      const pg = state.playground;
      const e = action.payload;
      if (!e) return state;
      const key = `${e.type}:${e.id}`;
      const has = pg.multi.some((m) => `${m.type}:${m.id}` === key);
      const multi = has ? pg.multi.filter((m) => `${m.type}:${m.id}` !== key) : [...pg.multi, { type: e.type, id: e.id }];
      return { ...state, playground: { ...pg, multi } };
    }

    case 'PG_CLEAR_MULTI':
      return { ...state, playground: { ...state.playground, multi: [] } };

    /* ---- facility playground (§ Priority 0) ----
       Focus moves push onto a back-stack and clear the forward-stack,
       which is what makes browser-style back/forward behave the way a
       reader expects. Expanded/collapsed sets are NOT cleared on a
       recenter: the network the user has opened up is the thing they
       built, and throwing it away to move the camera would be hostile. */
    case 'FAC_FOCUS': {
      const id = action.payload?.id ?? action.payload;
      if (!id) return state;
      const f = state.facility;
      if (f.focusId === id) return state;
      const asRoot = action.payload?.asRoot || !f.rootId;
      return { ...state, facility: {
        ...f,
        focusId: id,
        rootId: asRoot ? id : f.rootId,
        trail: f.focusId ? [...f.trail, f.focusId].slice(-40) : f.trail,
        forward: [],
        selectedLink: null,
        route: null,
        // Starting a fresh exploration drops the previous one's shape.
        expanded: asRoot ? [] : f.expanded,
        collapsed: asRoot ? [] : f.collapsed,
      } };
    }

    case 'FAC_BACK': {
      const f = state.facility;
      if (!f.trail.length) return state;
      const prev = f.trail[f.trail.length - 1];
      return { ...state, facility: {
        ...f,
        focusId: prev,
        trail: f.trail.slice(0, -1),
        forward: f.focusId ? [f.focusId, ...f.forward].slice(0, 40) : f.forward,
        selectedLink: null,
      } };
    }

    case 'FAC_FORWARD': {
      const f = state.facility;
      if (!f.forward.length) return state;
      const next = f.forward[0];
      return { ...state, facility: {
        ...f,
        focusId: next,
        trail: f.focusId ? [...f.trail, f.focusId].slice(-40) : f.trail,
        forward: f.forward.slice(1),
        selectedLink: null,
      } };
    }

    case 'FAC_HOME': {
      const f = state.facility;
      if (!f.rootId || f.focusId === f.rootId) return state;
      return { ...state, facility: {
        ...f,
        focusId: f.rootId,
        trail: f.focusId ? [...f.trail, f.focusId].slice(-40) : f.trail,
        forward: [],
        selectedLink: null,
      } };
    }

    case 'FAC_RESET':
      return { ...state, facility: initFacilityPlayground() };

    case 'FAC_SET': {
      const patch = action.payload || {};
      const f = { ...state.facility, ...patch };
      /* Infinity is the legitimate "all reachable" depth and must survive
         the clamp — `typeof Infinity === 'number'`, so testing the type
         first would silently turn it into 6. Anything else non-finite is a
         bad patch and falls back to what was already set. */
      if (f.hops === Infinity) f.hops = Infinity;
      else if (Number.isFinite(f.hops)) f.hops = Math.max(1, Math.min(6, Math.floor(f.hops)));
      else f.hops = state.facility.hops;
      if (patch.direction && !FACILITY_DIRECTIONS.includes(patch.direction)) f.direction = state.facility.direction;
      return { ...state, facility: f };
    }

    case 'FAC_SET_FILTERS': {
      const f = state.facility;
      return { ...state, facility: { ...f, filters: action.payload ? { ...(f.filters || {}), ...action.payload } : null } };
    }

    case 'FAC_TOGGLE_EXPAND': {
      const id = action.payload;
      if (!id) return state;
      const f = state.facility;
      const has = f.expanded.includes(id);
      return { ...state, facility: {
        ...f,
        expanded: has ? f.expanded.filter((x) => x !== id) : [...f.expanded, id],
        // Expanding a branch that was folded away is the same intent as unfolding it.
        collapsed: has ? f.collapsed : f.collapsed.filter((x) => x !== id),
      } };
    }

    case 'FAC_TOGGLE_COLLAPSE': {
      const id = action.payload;
      if (!id) return state;
      const f = state.facility;
      const has = f.collapsed.includes(id);
      return { ...state, facility: {
        ...f,
        collapsed: has ? f.collapsed.filter((x) => x !== id) : [...f.collapsed, id],
        expanded: has ? f.expanded : f.expanded.filter((x) => x !== id),
      } };
    }

    /* Topology-only, and labelled that way wherever it surfaces: hiding a
       plant changes what the graph can reach and nothing else. It does not
       feed the risk model and is never a capacity estimate. */
    case 'FAC_TOGGLE_HIDDEN': {
      const id = action.payload;
      if (!id || id === state.facility.rootId) return state;
      const f = state.facility;
      const has = f.hidden.includes(id);
      return { ...state, facility: { ...f, hidden: has ? f.hidden.filter((x) => x !== id) : [...f.hidden, id] } };
    }

    case 'FAC_CLEAR_HIDDEN':
      return { ...state, facility: { ...state.facility, hidden: [] } };

    case 'FAC_SELECT_LINK':
      return { ...state, facility: { ...state.facility, selectedLink: action.payload || null } };

    case 'FAC_SET_ROUTE':
      return { ...state, facility: { ...state.facility, route: action.payload || null } };

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
