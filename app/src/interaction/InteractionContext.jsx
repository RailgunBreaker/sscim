import { createContext, useContext, useReducer, useMemo, useCallback, useRef } from 'react';
import { interactionReducer, initInteraction, lensAvailable } from './reducer.js';

/* React binding around the pure interaction reducer. Every panel reads and
   writes the shared interaction state through useInteraction() instead of
   holding its own selection rules — see reducer.js for the state shape and
   task §3 for the requirements. A back-compat `sel`/`setSel` pair is
   exposed so existing components (OsmMap, FlowGraph, Intel, Detail) keep
   working unchanged while new features consume lens/hovered/playback. */

const InteractionContext = createContext(null);

export function InteractionProvider({ defaultSelected = null, children }) {
  const [state, dispatch] = useReducer(interactionReducer, defaultSelected, initInteraction);

  // A place for imperative side-effect subscribers (e.g. the Leaflet map's
  // flyTo) to register, so a cross-panel selection can pan the map without
  // the map component re-running its whole render effect. Fire-and-forget.
  const flyToSubscribers = useRef(new Set());
  const subscribeFlyTo = useCallback((fn) => {
    flyToSubscribers.current.add(fn);
    return () => flyToSubscribers.current.delete(fn);
  }, []);
  const requestFlyTo = useCallback((countryId) => {
    flyToSubscribers.current.forEach((fn) => { try { fn(countryId); } catch { /* subscriber gone */ } });
  }, []);

  const select = useCallback((next, opts = {}) => {
    dispatch({ type: 'SELECT', payload: next });
    // Selecting a country from any panel should recenter the map on it (§5).
    if (next && next.type === 'country' && opts.fly !== false) requestFlyTo(next.id);
  }, [requestFlyTo]);

  const api = useMemo(() => ({
    state,
    dispatch,
    // primary action helpers
    select,
    hover: (next) => dispatch({ type: 'HOVER', payload: next }),
    clearHover: () => dispatch({ type: 'CLEAR_HOVER' }),
    clear: () => dispatch({ type: 'CLEAR' }),
    back: () => dispatch({ type: 'BACK' }),
    setLens: (lens) => dispatch({ type: 'SET_LENS', payload: lens }),
    setFocusedPath: (path) => dispatch({ type: 'SET_FOCUSED_PATH', payload: path }),
    setScenarioActive: (active) => dispatch({ type: 'SET_SCENARIO_ACTIVE', payload: active }),
    playback: (patch) => dispatch({ type: 'PLAYBACK', payload: patch }),
    // draft scenario composition (§10)
    draftToggleSource: (src) => dispatch({ type: 'DRAFT_TOGGLE_SOURCE', payload: src }),
    draftSet: (patch) => dispatch({ type: 'DRAFT_SET', payload: patch }),
    draftClear: () => dispatch({ type: 'DRAFT_CLEAR' }),
    lensAvailable: (lens) => lensAvailable(lens, state.scenarioActive),
    // cross-panel flyTo plumbing
    subscribeFlyTo,
    requestFlyTo,
    // back-compat shim: existing components take sel / setSel props
    sel: state.selected,
    setSel: (next) => select(next),
    hovered: state.hovered,
    lens: state.lens,
  }), [state, select, subscribeFlyTo, requestFlyTo]);

  return <InteractionContext.Provider value={api}>{children}</InteractionContext.Provider>;
}

export function useInteraction() {
  const ctx = useContext(InteractionContext);
  if (!ctx) throw new Error('useInteraction() must be used inside <InteractionProvider>');
  return ctx;
}
