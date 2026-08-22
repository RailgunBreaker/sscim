import { describe, it, expect } from 'vitest';
import { facilityIconHtml, facilityLegendItems, FACILITY_KIND_LABEL, IDLE_COLOR, QUIET_BAND, STRONG_BAND } from './facilityIcon.js';
import { C } from '../theme.js';

const KINDS = Object.keys(FACILITY_KIND_LABEL);

describe('facility icons — shape carries function, colour carries state', () => {
  it('draws a visibly different glyph for every kind', () => {
    const shapes = KINDS.map((kind) => {
      const html = facilityIconHtml({ kind });
      // strip the wrapper so only the geometry is compared
      return html.slice(html.indexOf('<g'), html.indexOf('</g>'));
    });
    expect(new Set(shapes).size).toBe(KINDS.length);
  });

  /* The whole point of the redesign: at rest the map is geography, not a
     wall of alarm-coloured bubbles. Colour appears only where something is
     actually happening. */
  it('is neutral at rest and coloured only when the field is non-zero', () => {
    KINDS.forEach((kind) => {
      expect(facilityIconHtml({ kind, impact: 0 })).toContain(IDLE_COLOR);
      expect(facilityIconHtml({ kind, impact: 0 })).not.toContain(C.red);
    });
    expect(facilityIconHtml({ kind: 'fab', impact: 0.5 })).toContain(C.red);
    expect(facilityIconHtml({ kind: 'fab', impact: -0.5 })).toContain(C.green);
  });

  it('treats a negligible field as quiet rather than as an alarm', () => {
    expect(facilityIconHtml({ kind: 'fab', impact: 0.01 })).toContain(IDLE_COLOR);
    expect(facilityIconHtml({ kind: 'fab', impact: -0.01 })).toContain(IDLE_COLOR);
  });

  /* A single large event propagates across the whole graph, so on a normal
     day the median site sits well above zero. A flat low threshold made 267
     of 275 plants red, and a map where everything is an alarm carries as
     much information as one where nothing is. */
  it('grades the adverse side instead of painting everything red', () => {
    expect(facilityIconHtml({ kind: 'fab', impact: QUIET_BAND - 0.01 })).toContain(IDLE_COLOR);
    expect(facilityIconHtml({ kind: 'fab', impact: QUIET_BAND + 0.01 })).toContain(C.amber);
    expect(facilityIconHtml({ kind: 'fab', impact: STRONG_BAND - 0.01 })).toContain(C.amber);
    expect(facilityIconHtml({ kind: 'fab', impact: STRONG_BAND + 0.01 })).toContain(C.red);
  });

  it('uses the same four-way vocabulary as the country legend', () => {
    const colours = [0, 0.2, 0.9, -0.9].map((impact) => {
      const html = facilityIconHtml({ kind: 'fab', impact });
      return [IDLE_COLOR, C.amber, C.red, C.green].find((c) => html.includes(c));
    });
    expect(colours).toEqual([IDLE_COLOR, C.amber, C.red, C.green]);
  });

  /* A site with nothing to lose must never read as running capacity. */
  it('draws a site with no exposure weight hollow', () => {
    const html = facilityIconHtml({ kind: 'fab', live: false });
    expect(html).toContain('fill="none"');
  });

  it('draws an R&D site hollow whatever its state — it makes nothing', () => {
    expect(facilityIconHtml({ kind: 'rnd', impact: 0.9, live: true })).toContain('fill="none"');
  });

  it('rings a selected site in the text colour and a hazard-caught one in amber', () => {
    expect(facilityIconHtml({ kind: 'fab', selected: true })).toContain(`stroke="${C.text}"`);
    expect(facilityIconHtml({ kind: 'fab', inHazard: true })).toContain(`stroke="${C.amber}"`);
    // selection wins over the hazard ring, since it is the thing you pinned
    expect(facilityIconHtml({ kind: 'fab', selected: true, inHazard: true })).toContain(`stroke="${C.text}"`);
  });

  it('scales with the requested size and stays a valid standalone svg', () => {
    const html = facilityIconHtml({ kind: 'fab', size: 24 });
    expect(html).toContain('width="24"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html.trim().startsWith('<svg')).toBe(true);
    expect(html.trim().endsWith('</svg>')).toBe(true);
  });

  it('falls back to a circle for an unknown kind instead of drawing nothing', () => {
    expect(facilityIconHtml({ kind: 'something-new' })).toContain('<circle');
  });

  /* The markup is geometry and theme colours only — no dataset text ever
     reaches it, which is what makes rendering it as HTML safe. */
  it('contains no interpolated text at all', () => {
    KINDS.forEach((kind) => {
      const html = facilityIconHtml({ kind });
      expect(html).not.toMatch(/<text|onerror|<script|javascript:/i);
    });
  });

  it('builds a legend row per kind, drawn by the same generator as the map', () => {
    const items = facilityLegendItems();
    expect(items).toHaveLength(KINDS.length);
    items.forEach((it) => {
      expect(it.label).toBe(FACILITY_KIND_LABEL[it.kind]);
      expect(it.html).toBe(facilityIconHtml({ kind: it.kind, impact: 0, live: true, size: 13 }));
    });
  });
});
