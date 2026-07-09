import { C } from '../theme.js';

export default function TabBar({ panes, tab, setTab }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
      {Object.entries(panes).map(([k, v]) => (
        <button key={k} onClick={() => setTab(k)}
          style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", borderBottom: tab === k ? `2px solid ${C.copper}` : "2px solid transparent", color: tab === k ? C.text : C.dim, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: tab === k ? 600 : 400 }}>
          {v}
        </button>
      ))}
    </div>
  );
}
