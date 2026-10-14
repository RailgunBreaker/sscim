import { useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';

export default function Logo({ cid, size = 18 }) {
  const { data } = useVault();
  const co = data.COMPANY_BY_ID[cid];
  const [err, setErr] = useState(false);
  if (!co) return null;
  const d = data.DOMAINS[cid];
  const initials = co.name.replace(/\(.*\)/, "").trim().split(/[\s/]+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span style={{ width: size, height: size, borderRadius: 4, background: "#1A2132", border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, verticalAlign: "middle" }}>
      {d && !err
        ? <img src={`https://www.google.com/s2/favicons?domain=${d}&sz=64`} width={size - 4} height={size - 4} style={{ objectFit: "contain", display: "block" }} onError={() => setErr(true)} loading="lazy" alt="" />
        : <span className="mono" style={{ fontSize: Math.max(7, size * 0.4), color: C.copper, fontWeight: 700, lineHeight: 1 }}>{initials}</span>}
    </span>
  );
}
