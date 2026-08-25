import { useMemo } from 'react';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import {
  traverseFacilityNetwork, reachableCount, makeLinkFilter, routeBetween,
  linkKey, EMPTY_FILTERS, filtersActive,
} from '../engine/facilityTraversal.js';

/* ====================================================================
   useFacilityPlayground — one derivation of the playground's view, used
   by BOTH the full Facility Playground and the compact Layer-3 Explore
   tab.

   Two surfaces, one state and one traversal. That is the whole point:
   the requirement is that "Open in Playground" from the compact explorer
   lands on the same facility with the same network open, and the way to
   guarantee that is to give the two surfaces nothing of their own to
   disagree about. State lives in the interaction reducer; the traversal
   is computed here from that state; the components only render.
   ==================================================================== */

export function useFacilityPlayground({ maxNodes } = {}) {
  const { data } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK } = data;
  const interaction = useInteraction();
  const fac = interaction.state.facility;

  const filters = useMemo(() => ({ ...EMPTY_FILTERS, ...(fac.filters || {}) }), [fac.filters]);

  const linkFilter = useMemo(
    () => makeLinkFilter(filters, { FACILITY_BY_ID: FACILITY_LAYER.FACILITY_BY_ID }),
    [filters, FACILITY_LAYER],
  );

  const focus = fac.focusId ? FACILITY_LAYER.FACILITY_BY_ID[fac.focusId] : null;

  const traversal = useMemo(() => {
    if (!focus) return null;
    return traverseFacilityNetwork(FACILITY_NETWORK, {
      rootId: focus.id,
      direction: fac.direction,
      maxHops: fac.hops === Infinity ? Number.MAX_SAFE_INTEGER : fac.hops,
      expanded: fac.expanded,
      collapsed: fac.collapsed,
      hidden: fac.hidden,
      linkFilter,
      ...(maxNodes ? { maxNodes } : {}),
    });
  }, [FACILITY_NETWORK, focus, fac.direction, fac.hops, fac.expanded, fac.collapsed, fac.hidden, linkFilter, maxNodes]);

  /* How big "all reachable" would be, computed WITHOUT building it — so
     the warning can appear before the draw, not after the tab locks. */
  const reachable = useMemo(() => {
    if (!focus) return 0;
    return reachableCount(FACILITY_NETWORK, { rootId: focus.id, direction: fac.direction, hidden: fac.hidden });
  }, [FACILITY_NETWORK, focus, fac.direction, fac.hidden]);

  const selectedLinkObj = useMemo(() => {
    if (!fac.selectedLink || !traversal) return null;
    return traversal.links.find((l) => linkKey(l) === fac.selectedLink) || null;
  }, [fac.selectedLink, traversal]);

  const route = useMemo(() => {
    if (!fac.route?.from || !fac.route?.to || !traversal) return null;
    return routeBetween(traversal, fac.route.from, fac.route.to);
  }, [fac.route, traversal]);

  const routeLinkKeys = useMemo(
    () => new Set((route?.links || []).map(linkKey)),
    [route],
  );

  return {
    ...interaction,
    fac,
    focus,
    filters,
    filtersActive: filtersActive(filters),
    linkFilter,
    traversal,
    reachable,
    selectedLinkObj,
    route,
    routeLinkKeys,
  };
}
