import { C } from '../theme.js';

export default function Legend({ items, note }) {
  return (
    <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "7px 4px 0", fontSize: 10, color: C.dim }}>
      {items.map(([label, col]) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: col, display: "inline-block" }} />{label}
        </span>
      ))}
      <span style={{ color: C.faint }}>{note}</span>
    </div>
  );
}
