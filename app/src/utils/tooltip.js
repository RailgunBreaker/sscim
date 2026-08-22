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

/* A click-triggered FACILITY popup: what this plant is, who runs it, what it
   makes, which model stages it feeds, and what the current field says about
   it. Same DOM/textContent construction as everything else here, so a site
   name or an output description can never be interpreted as markup.

   `onSelectCompany` fires with the operator's company id; `onShock` (optional)
   marks the site's stages as scenario shock sources. */
export function buildFacilityPopupEl({
  facility, operatorName, stageNames, impactLine, shareLines, colors,
  onSelectCompany, onOpenProfile, onToggleTrack, tracked = false,
}) {
  const root = document.createElement('div');
  root.style.minWidth = '220px';
  root.style.maxWidth = '290px';

  const head = document.createElement('div');
  head.style.fontWeight = '700';
  head.style.fontSize = '12.5px';
  head.style.lineHeight = '1.35';
  head.textContent = facility.name;
  root.appendChild(head);

  const sub = document.createElement('div');
  sub.style.fontSize = '9.5px';
  sub.style.letterSpacing = '0.8px';
  sub.style.color = colors.copper;
  sub.style.margin = '2px 0 6px';
  sub.textContent = [facility.kind, facility.status, facility.since ? `since ${facility.since}` : null]
    .filter(Boolean).join(' · ').toUpperCase();
  root.appendChild(sub);

  const line = (text, { color = colors.dim, size = '10.5px', top = '3px' } = {}) => {
    const el = document.createElement('div');
    el.style.fontSize = size;
    el.style.color = color;
    el.style.lineHeight = '1.5';
    el.style.marginTop = top;
    el.textContent = text;
    root.appendChild(el);
    return el;
  };

  if (facility.output) line(facility.output, { color: colors.text });
  const spec = [facility.node, facility.waferSize].filter(Boolean).join(' · ');
  if (spec) line(spec, { color: colors.dim, size: '10px' });
  if (stageNames?.length) line(`Feeds: ${stageNames.join(' · ')}`, { color: colors.faint, size: '10px' });
  (shareLines || []).forEach((s) => line(s, { color: colors.copper, size: '10px' }));
  if (impactLine) line(impactLine, { color: colors.text, size: '10.5px', top: '5px' });

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '5px';
  actions.style.marginTop = '7px';
  const button = (label, handler) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cursor = 'pointer';
    b.style.fontSize = '10px';
    b.style.fontFamily = 'inherit';
    b.style.padding = '3px 8px';
    b.style.borderRadius = '4px';
    b.style.border = `1px solid ${colors.line}`;
    b.style.background = 'transparent';
    b.style.color = colors.copper;
    b.addEventListener('click', handler);
    actions.appendChild(b);
  };
  if (onOpenProfile) button('Full profile', () => onOpenProfile(facility));
  if (onSelectCompany) button(`Operator: ${operatorName}`, () => onSelectCompany(facility.company));
  if (onToggleTrack) button(tracked ? '★ Tracking' : '☆ Track this site', () => onToggleTrack(facility));
  if (actions.childElementCount) root.appendChild(actions);

  if (facility.source) {
    line(facility.source, { color: colors.faint, size: '8.5px', top: '6px' });
  }
  line('Site-level sample. "scale" is an analyst ordinal, not capacity; coordinates are approximate.',
    { color: colors.faint, size: '8.5px', top: '3px' });

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
