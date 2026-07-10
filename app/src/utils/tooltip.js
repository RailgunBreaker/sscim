/* Builds tooltip content as real DOM nodes (never HTML strings) so that
   dataset-derived text — company names, stage names, event titles — can
   never be interpreted as markup. Each line is `{ text, color, bold, size }`;
   `text` is always inserted via textContent, so a value like
   `<img src=x onerror=...>` renders as literal characters instead of an
   element. Shared by OsmMap.jsx (Leaflet tooltips) and its unit test. */
export function buildTooltipEl(lines) {
  const root = document.createElement('div');
  lines.forEach(({ text, color, bold, size }, i) => {
    const line = document.createElement('div');
    if (i > 0) line.style.marginTop = '2px';
    if (color) line.style.color = color;
    if (bold) line.style.fontWeight = '700';
    if (size) line.style.fontSize = size;
    line.textContent = text;
    root.appendChild(line);
  });
  return root;
}
