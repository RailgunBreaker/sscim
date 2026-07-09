import { C } from '../theme.js';

export default function Spark({ data }) {
  const w = 90, h = 22;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / rng) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-label="21-day chain risk index">
      <polyline points={pts} fill="none" stroke={C.copper} strokeWidth="1.4" />
      <circle cx={w} cy={h - 2 - ((data[data.length - 1] - min) / rng) * (h - 4)} r="2" fill={C.copper} />
    </svg>
  );
}
