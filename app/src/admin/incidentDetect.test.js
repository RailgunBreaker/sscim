/* Incident-level duplicate detection, tested against the cluster that
   actually got through.

   The Kumamoto records are the fixture on purpose. Their real titles share
   too few tokens for the existing title-similarity check to flag them —
   which is why all seven entered the queue as separate events, all were
   scored, and one earthquake moved the index as though several had
   happened. If this detector would not have flagged them, it is not worth
   having, so that is what the first block asserts. */
import { describe, it, expect } from 'vitest';
import {
  incidentType, incidentMarkers, properNouns, incidentMatch,
  findIncidentMatch, incidentNote, INCIDENT_FLAG_THRESHOLD,
} from '../../../server/src/ingest/incident.js';
import { similarity, tokenize } from '../../../server/src/ingest/dedupe.js';

const cand = (id, dateISO, title, summary = '', sourceFeed = 'webz_news') => ({
  id, dateISO, date_iso: dateISO, sourceFeed, source_feed: sourceFeed, raw: { title, summary },
});

/* The real titles, verbatim from the events table. */
const KUMAMOTO = [
  cand('c1', '2026-07-28', 'M7.1 Kumamoto earthquake halts multiple Kyushu semiconductor fabs',
    'A magnitude 7.1 earthquake struck Kumamoto prefecture, Japan, halting production at several fabs.', 'usgs'),
  cand('c2', '2026-07-29', 'M7.1 Kumamoto earthquake halts Renesas, Sony and Tokyo Electron plants; Toyota and Honda suspend Kyushu output',
    'Renesas halted operations at two Kumamoto plants after ceiling panels fell; Sony and Tokyo Electron suspended output.'),
  cand('c3', '2026-07-29', 'Sony halts Kumamoto image-sensor fab indefinitely after Kyushu earthquake',
    'Sony Semiconductor Manufacturing halted its Kumamoto Technology Center in Kikuyo after the 2026-07-28 earthquake.'),
  cand('c4', '2026-07-29', "TSMC's JASM Kumamoto fab resumes operations after M7.1 earthquake, no structural damage found",
    'TSMC resumed its JASM Kumamoto plant after inspection found no structural damage following the magnitude 7.1 quake.'),
  cand('c5', '2026-07-29', 'Kumamoto M7.1: TSMC JASM confirmed safe, Tokyo Electron suspends both Kumamoto plants for inspection',
    'TrendForce reports JASM safe while Tokyo Electron halted both Kumamoto plants for inspection.'),
];

const UNRELATED = [
  cand('u1', '2026-07-28', 'BIS investigating possible Blackwell export violations to China; Huang meets Commerce Secretary',
    'Nvidia CEO Jensen Huang met Commerce Secretary Howard Lutnick during a Washington visit.'),
  cand('u2', '2026-07-29', 'TSMC Fab 20 reaches 20k wpm on 2nm as leading-edge capacity ramps',
    "TSMC's Fab 20 in Taiwan has reached 20,000 wafers per month on its 2nm process."),
  cand('u3', '2026-07-29', 'Thailand launches Siam Silica national semiconductor framework targeting 2030 fabs',
    'Thailand unveiled a national roadmap designating semiconductor development a government priority.'),
];

describe('the cluster that got through', () => {
  /* The premise. If title similarity already caught these, nothing here
     is needed — so this asserts that it does not. */
  it('is NOT caught by title similarity alone', () => {
    const threshold = 0.6; // dedupe.js DUPLICATE_THRESHOLD
    const pairs = [];
    for (let i = 0; i < KUMAMOTO.length; i += 1) {
      for (let j = i + 1; j < KUMAMOTO.length; j += 1) {
        pairs.push(similarity(tokenize(KUMAMOTO[i].raw.title), tokenize(KUMAMOTO[j].raw.title)));
      }
    }
    expect(Math.max(...pairs), 'title similarity would already have flagged these').toBeLessThan(threshold);
  });

  it('IS caught by incident matching — every pair of them', () => {
    for (let i = 0; i < KUMAMOTO.length; i += 1) {
      for (let j = i + 1; j < KUMAMOTO.length; j += 1) {
        const { score, reasons } = incidentMatch(KUMAMOTO[i], KUMAMOTO[j]);
        expect(score, `${KUMAMOTO[i].id} vs ${KUMAMOTO[j].id} (${reasons.join('; ')})`)
          .toBeGreaterThanOrEqual(INCIDENT_FLAG_THRESHOLD);
      }
    }
  });

  it('flags the recovery report against the disruption reports', () => {
    // c4 is "JASM resumes ... no structural damage" — the record that was
    // classified adverse and scored, so a fab coming back online raised
    // the disruption reading.
    const match = findIncidentMatch(KUMAMOTO[3], [KUMAMOTO[0], KUMAMOTO[1], KUMAMOTO[2]]);
    expect(match).toBeTruthy();
    expect(match.uncertain).toBe(true);
  });

  it('explains itself in words a reviewer can act on', () => {
    const match = findIncidentMatch(KUMAMOTO[2], [KUMAMOTO[0]]);
    expect(match.reasons.length).toBeGreaterThan(1);
    const note = incidentNote(match);
    expect(note).toMatch(/Possibly the same incident as c1/);
    expect(note).toMatch(/noisy-OR/);
    expect(note).toMatch(/recovery update/);
    expect(note).toMatch(/Not auto-rejected/);
  });
});

describe('it does not over-match', () => {
  it('does not flag unrelated stories from the same days', () => {
    for (let i = 0; i < UNRELATED.length; i += 1) {
      for (let j = i + 1; j < UNRELATED.length; j += 1) {
        const { score, reasons } = incidentMatch(UNRELATED[i], UNRELATED[j]);
        expect(score, `${UNRELATED[i].id} vs ${UNRELATED[j].id} (${reasons.join('; ')})`)
          .toBeLessThan(INCIDENT_FLAG_THRESHOLD);
      }
    }
  });

  it('does not match an unrelated story to the earthquake cluster', () => {
    UNRELATED.forEach((u) => {
      expect(findIncidentMatch(u, KUMAMOTO), `${u.id} must not match the quake cluster`).toBeNull();
    });
  });

  it('refuses anything outside the incident window', () => {
    const later = cand('c9', '2026-09-20', KUMAMOTO[0].raw.title, KUMAMOTO[0].raw.summary);
    const { score, reasons } = incidentMatch(KUMAMOTO[0], later);
    expect(score).toBe(0);
    expect(reasons[0]).toMatch(/outside the incident window/);
  });

  it('penalises two records that describe different kinds of incident', () => {
    const quake = cand('q', '2026-07-28', 'M7.1 earthquake halts Kumamoto fabs', 'Kumamoto Kyushu Sony Renesas');
    const cyber = cand('h', '2026-07-28', 'Ransomware breach halts Kumamoto supplier systems', 'Kumamoto Kyushu Sony Renesas');
    const { reasons } = incidentMatch(quake, cyber);
    expect(reasons.join(' ')).toMatch(/different incident types/);
  });
});

describe('the individual signals', () => {
  it('classifies the incident type, preferring the cause over the consequence', () => {
    expect(incidentType('M7.1 earthquake halts multiple fabs')).toBe('earthquake');
    expect(incidentType('Fire at a chemical plant suspends output')).toBe('fire');
    expect(incidentType('Typhoon forces plants offline')).toBe('flood');
    expect(incidentType('BIS adds firms to the entity list')).toBe('export_control');
    // No named cause: falls back to the generic consequence.
    expect(incidentType('Fab halts production for maintenance')).toBe('outage');
    expect(incidentType('Company reports quarterly revenue')).toBeNull();
  });

  it('extracts the identifiers an incident actually has', () => {
    expect([...incidentMarkers('M7.1 Kumamoto earthquake')]).toContain('mag:7.1');
    expect([...incidentMarkers('a magnitude-7.1 quake')]).toContain('mag:7.1');
    expect([...incidentMarkers('published at 90 FR 12345')]).toContain('fr:90-12345');
    expect([...incidentMarkers('Executive Order 14117')]).toContain('eo:14117');
    expect([...incidentMarkers('no identifiers here')]).toEqual([]);
  });

  it('extracts named entities without treating sentence filler as names', () => {
    const names = properNouns('After the earthquake, Sony halted its Kumamoto plant in Kikuyo');
    expect(names.has('sony')).toBe(true);
    expect(names.has('kumamoto')).toBe(true);
    expect(names.has('kikuyo')).toBe(true);
    expect(names.has('after')).toBe(false);
    expect(names.has('the')).toBe(false);
  });

  it('scores date proximity, and stops scoring it past a week', () => {
    const a = cand('a', '2026-07-28', 'Fab halt in Kumamoto', 'Sony Renesas Kyushu');
    const sameDay = cand('b', '2026-07-28', 'Kumamoto fab stoppage', 'Sony Renesas Kyushu');
    const tenDays = cand('c', '2026-08-07', 'Kumamoto fab stoppage', 'Sony Renesas Kyushu');
    expect(incidentMatch(a, sameDay).score).toBeGreaterThan(incidentMatch(a, tenDays).score);
    expect(incidentMatch(a, sameDay).reasons).toContain('same day');
  });
});

describe('it never decides on its own', () => {
  it('always marks a match as uncertain, for a human', () => {
    const m = findIncidentMatch(KUMAMOTO[1], [KUMAMOTO[0]]);
    expect(m.uncertain).toBe(true);
  });

  it('returns null rather than a low-confidence guess', () => {
    expect(findIncidentMatch(UNRELATED[0], [UNRELATED[1], UNRELATED[2]])).toBeNull();
    expect(findIncidentMatch(KUMAMOTO[0], [])).toBeNull();
    expect(findIncidentMatch(KUMAMOTO[0], null)).toBeNull();
  });
});
