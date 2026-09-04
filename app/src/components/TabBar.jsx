import { Tabs } from '../ui/primitives.jsx';

/* The small-viewport pane switcher. It was a row of plain <button>s with no
   tab semantics at all: no role, no aria-selected, no roving tabindex, and
   no arrow-key movement. It LOOKED like a tab bar, which is exactly the
   problem — a screen-reader user was offered three unexplained buttons, and
   a keyboard user had to tab through each one.

   It now uses the shared Tabs primitive, so it announces itself as a
   tablist, marks the selected tab, and moves with the arrow keys. The
   panels it controls are the Pane elements in App, which carry ids of the
   form "pane-<key>". */

export default function TabBar({ panes, tab, setTab }) {
  return (
    <Tabs
      label="Panel"
      idPrefix="panetab"
      panelIdFor={(v) => `pane-${v}`}
      tabs={Object.entries(panes).map(([value, label]) => ({ value, label }))}
      value={tab}
      onChange={setTab}
      style={{ display: 'flex' }}
    />
  );
}
