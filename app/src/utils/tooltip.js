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

/* A click-triggered country popup (distinct from the hover tooltip above):
   flag + name, a plain-language introduction, and clickable chips for every
   company headquartered there — same DOM/textContent construction, so
   company names can never be interpreted as markup. `onSelectCompany`
   fires with a company id when a chip is clicked. */
export function buildCountryPopupEl({ flag, name, intro, companies, colors, onSelectCompany }) {
  const root = document.createElement('div');
  root.style.minWidth = '200px';
  root.style.maxWidth = '260px';

  const head = document.createElement('div');
  head.style.fontWeight = '700';
  head.style.fontSize = '13px';
  head.style.marginBottom = '4px';
  head.textContent = `${flag} ${name}`.trim();
  root.appendChild(head);

  const introEl = document.createElement('div');
  introEl.style.fontSize = '10.5px';
  introEl.style.color = colors.dim;
  introEl.style.lineHeight = '1.5';
  introEl.style.marginBottom = '6px';
  introEl.textContent = intro;
  root.appendChild(introEl);

  if (companies.length) {
    const label = document.createElement('div');
    label.style.fontSize = '9px';
    label.style.letterSpacing = '1px';
    label.style.color = colors.copper;
    label.textContent = `HEADQUARTERED HERE (${companies.length})`;
    root.appendChild(label);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';
    list.style.gap = '4px';
    list.style.marginTop = '4px';
    companies.slice(0, 12).forEach((co) => {
      const chip = document.createElement('span');
      chip.textContent = co.name;
      chip.style.cursor = 'pointer';
      chip.style.fontSize = '10px';
      chip.style.padding = '2px 7px';
      chip.style.borderRadius = '10px';
      chip.style.border = `1px solid ${colors.line}`;
      chip.style.color = colors.copper;
      chip.addEventListener('click', () => onSelectCompany(co.id));
      list.appendChild(chip);
    });
    root.appendChild(list);
    if (companies.length > 12) {
      const more = document.createElement('div');
      more.style.fontSize = '9px';
      more.style.color = colors.faint;
      more.style.marginTop = '4px';
      more.textContent = `+${companies.length - 12} more — open the country's detail view for the full list`;
      root.appendChild(more);
    }
  }
  return root;
}
