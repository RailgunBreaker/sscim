/* Score-breakdown labels — fixed UI metadata, not vault content.

   v7 names. `choke` and `subst` were the v6 keys and are kept as aliases
   only so a stored v6 view still renders a label; the v7 engine emits
   `networkInfluence` and `nonSubstitutability`, and there is no `shock`
   component at all — the structural layer is event-free by construction. */
export const COMP_META = {
  networkInfluence: ["Network influence (snapshot-relative)", "GRAPH"],
  geo: ["Geographic concentration (HHI, upper bound)", "HHI"],
  policy: ["Policy exposure (policy families)", "POLICY DB"],
  nonSubstitutability: ["Non-substitutability", "ANALYST"],
  market: ["Market sensitivity", "ANALYST"],

  // v6 aliases, read-only.
  choke: ["Network influence (snapshot-relative)", "GRAPH"],
  subst: ["Non-substitutability", "ANALYST"],
};
