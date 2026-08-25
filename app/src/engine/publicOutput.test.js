/* The publish gate: internal review-workflow text must not be in anything
   the public sees.

   THE DEFECT. Eight published events carried the review queue's own
   bookkeeping as their public classification note — strings like
   "Published: Review: reject cand_webz_news_04f59e01b8bab71dc7c23814c78e…"
   and "Published: Review: approve p260728_web4420". Those appeared in the
   live Events feed's tooltips, putting internal candidate identifiers and
   the literal approve/reject commands on a public page.

   THIS TEST IS THE GATE. It runs over the generated snapshot — the exact
   artefact the static site ships and the API serves — and over the
   assumptions table the dashboard renders from. If a pipeline run ever
   writes workflow text into a public field again, this fails before the
   build is deployed rather than after a reader finds it.

   The audit trail is not being destroyed, only relocated: it still lives
   in event_candidates (reviewed_by, ai_notes), behind the admin token. */
import { describe, it, expect } from 'vitest';
import {
  EVENT_ASSUMPTIONS, INTERNAL_NOTE_PATTERNS, looksInternal, publicClassificationNote,
  EVENT_INCIDENTS, incidentOf, incidentGroup,
} from './event-assumptions.js';
import snapshot from '../data/vault-snapshot.json';

/* Every public string in the bundle. Keys are walked rather than listed so
   that a future column cannot be added and quietly escape the check. */
function publicStrings(obj, path = '') {
  const out = [];
  if (typeof obj === 'string') return [[path, obj]];
  if (Array.isArray(obj)) { obj.forEach((v, i) => out.push(...publicStrings(v, `${path}[${i}]`))); return out; }
  if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => out.push(...publicStrings(v, path ? `${path}.${k}` : k)));
  }
  return out;
}

describe('looksInternal', () => {
  it('recognises every form the leak actually took', () => {
    expect(looksInternal('Published: Review: reject cand_webz_news_04f59e01b8bab71dc')).toBe(true);
    expect(looksInternal('Published: Review: approve p260728_web4420')).toBe(true);
    expect(looksInternal('Review: publish 3 approved')).toBe(true);
    expect(looksInternal('Recorded. 1 decision(s) awaiting publication.')).toBe(true);
    expect(looksInternal('cand_manual_kyushu_restart_2026')).toBe(true);
  });

  it('does not flag ordinary classification prose', () => {
    for (const ok of [
      'A licensing-status change, not a change in production.',
      'The reviewer note explains why this is excluded from the score.',
      'Reviewed by a person before publication.',
      'Realized multi-site production halt with confirmed physical damage.',
      '',
      null,
    ]) expect(looksInternal(ok), JSON.stringify(ok)).toBe(false);
  });

  it('has patterns that are all real regular expressions', () => {
    expect(INTERNAL_NOTE_PATTERNS.length).toBeGreaterThan(3);
    INTERNAL_NOTE_PATTERNS.forEach((re) => expect(re).toBeInstanceOf(RegExp));
  });
});

describe('the assumptions table is publishable', () => {
  it('carries no internal review text in any reason', () => {
    const leaks = Object.entries(EVENT_ASSUMPTIONS)
      .filter(([, a]) => looksInternal(a.reason))
      .map(([id]) => id);
    expect(leaks, `internal notes in: ${leaks.join(', ')}`).toEqual([]);
  });

  it('gives every classified event a substantive rationale, not a stub', () => {
    Object.entries(EVENT_ASSUMPTIONS).forEach(([id, a]) => {
      expect(typeof a.reason, id).toBe('string');
      expect(a.reason.trim().length, `${id} has an empty reason`).toBeGreaterThan(20);
    });
  });

  /* The render-side guard, independent of the data being clean. */
  it('suppresses an internal note at render time even if one gets in', () => {
    expect(publicClassificationNote('nonexistent_id')).toMatch(/No explicit assumption recorded/i);
    Object.keys(EVENT_ASSUMPTIONS).forEach((id) => {
      expect(looksInternal(publicClassificationNote(id)), id).toBe(false);
    });
  });
});

describe('the generated snapshot is publishable', () => {
  it('has no internal review text in any field of any event', () => {
    const leaks = [];
    (snapshot.events || []).forEach((e) => {
      publicStrings(e).forEach(([field, value]) => {
        if (looksInternal(value)) leaks.push(`${e.id}.${field}: ${value.slice(0, 80)}`);
      });
    });
    expect(leaks, leaks.join('\n')).toEqual([]);
  });

  it('has no internal review text anywhere else in the bundle either', () => {
    const leaks = publicStrings(snapshot)
      .filter(([, v]) => looksInternal(v))
      .map(([path, v]) => `${path}: ${v.slice(0, 80)}`);
    expect(leaks, leaks.join('\n')).toEqual([]);
  });
});

describe('event provenance is truthful in the published bundle', () => {
  const events = snapshot.events || [];

  it('records a provenance value for every event', () => {
    events.forEach((e) => {
      expect(['human', 'automatic', 'curated', 'legacy'], `${e.id}: ${e.provenance}`).toContain(e.provenance);
    });
  });

  /* The contradiction this replaces: an event approved by automatic triage
     whose source string claimed a human had reviewed it. */
  it('never claims human review for an automatically approved event', () => {
    const automatic = events.filter((e) => e.provenance === 'automatic');
    automatic.forEach((e) => {
      expect(e.source, e.id).not.toMatch(/(?<!not )human-reviewed/i);
      expect(e.source, e.id).toMatch(/not human-reviewed/i);
    });
  });

  it('does not invent a reviewer identity for an automatic approval', () => {
    events.filter((e) => e.provenance === 'automatic')
      .forEach((e) => expect(e.reviewedBy, e.id).toBe('auto-triage'));
  });

  it('leaves the human-reviewed claim intact where a person did review it', () => {
    const human = events.filter((e) => e.provenance === 'human' && /AI-drafted/i.test(e.source || ''));
    expect(human.length).toBeGreaterThan(0);
    human.forEach((e) => expect(e.source, e.id).toMatch(/human-reviewed/i));
  });
});

describe('incident grouping', () => {
  it('groups the Kumamoto records under one incident', () => {
    const group = incidentGroup('kumamoto_m71_2026_07');
    expect(group.length).toBeGreaterThan(5);
    expect(group[0].role).toBe('primary');
  });

  it('has exactly one primary per incident', () => {
    const byIncident = {};
    Object.values(EVENT_INCIDENTS).forEach((v) => {
      byIncident[v.incident] ||= [];
      byIncident[v.incident].push(v.role);
    });
    Object.entries(byIncident).forEach(([incident, roles]) => {
      expect(roles.filter((r) => r === 'primary'), incident).toHaveLength(1);
    });
  });

  it('uses only the three declared roles', () => {
    Object.entries(EVENT_INCIDENTS).forEach(([id, v]) => {
      expect(['primary', 'update', 'recovery'], id).toContain(v.role);
    });
  });

  it('mirrors the grouping into the published bundle', () => {
    (snapshot.events || []).forEach((e) => {
      const declared = incidentOf(e.id);
      if (declared) {
        expect(e.incidentId, e.id).toBe(declared.incident);
        expect(e.incidentRole, e.id).toBe(declared.role);
      }
    });
  });
});
