/* Shared keyboard-activation handler for the many `<div onClick>` "card"
   rows across the panels (event/company/stage rows, spread-tree nodes) —
   lets Enter/Space trigger the same selection a click would. */
export function onEnterSpace(fn) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };
}
