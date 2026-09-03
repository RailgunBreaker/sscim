#!/usr/bin/env node
/* ====================================================================
   build-evidence-coverage.mjs — how well evidenced this dataset actually
   is, counted from the vault rather than asserted in prose.

   WHY THIS EXISTS. The source register is a strong foundation: it lists
   every source behind every event and grades how complete each citation
   is. What it does not answer is the question a reader actually arrives
   with — "how much of what I am looking at is sourced at all?" — because
   it only covers the things that HAVE a source. The companies with no
   evidence note, the stages whose shares are analyst judgement, the
   facilities whose `source` line is itself a judgement disclaimer: those
   are invisible in a register of citations, and they are most of the
   uncertainty.

   FIVE DIFFERENT THINGS, KEPT APART. A structural audit is not factual
   validation, and conflating them is the single most misleading thing a
   page like this could do. So they are reported separately and each is
   given its own honest scope:

     1. SCHEMA INTEGRITY   — do the records have the fields and types the
                             model requires? Checkable by machine. Says
                             nothing about whether the values are right.
     2. GRAPH INTEGRITY    — is the stage graph acyclic, connected, and
                             do the declared shares sum sensibly?
                             Checkable by machine. Still says nothing
                             about whether the values are right.
     3. CITATION COMPLETENESS — does each figure carry a source, and how
                             complete is that source as a bibliographic
                             entry? Counted here.
     4. SOURCE QUALITY     — is that source authoritative for the claim it
                             is attached to? A human judgement, recorded
                             per entry where it has been made, and NOT
                             inferred from the presence of a URL.
     5. FACTUAL VALIDATION — is the number correct? NOT ESTABLISHED for
                             this dataset. No figure here has been checked
                             against an independent measurement, and the
                             audit that runs before every deploy does not
                             attempt to.

   NOTHING IS FABRICATED. Where a citation field is missing it is counted
   as missing. An entry never acquires a title, a publisher or a date to
   make the totals look better.

   Run from server/:  node scripts/build-evidence-coverage.mjs
   ==================================================================== */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';
import { MODEL_VERSION } from '../../app/src/engine/registry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', 'docs', 'reference', 'EVIDENCE-COVERAGE.md');
const today = new Date().toISOString().slice(0, 10);

/* The snapshot this count describes. Stating it is not decoration: a
   coverage report that does not say which data it counted cannot be shown
   to be current, and docs:verify fails a report whose snapshot date has
   fallen behind the committed one. */
const SNAPSHOT_DATE = (() => {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'snapshotDate'").get();
    if (row?.value) return row.value;
  } catch { /* older databases have no meta table */ }
  try {
    const snap = JSON.parse(readFileSync(resolve(HERE, '..', '..', 'app', 'src', 'data', 'vault-snapshot.json'), 'utf8'));
    return snap.meta?.snapshotDate ?? 'unknown';
  } catch { return 'unknown'; }
})();

const rows = (sql, ...a) => db.prepare(sql).all(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : '—');

/* ---- events ------------------------------------------------------- */
const events = rows('SELECT id, title, source, provenance FROM events');
const hasUrl = (s) => /https?:\/\//i.test(s || '');
const FR_RE = /\b\d{2,3}\s*FR\s*\d{3,6}\b/i;

const eventClasses = {
  full: events.filter((e) => hasUrl(e.source)),
  legal: events.filter((e) => !hasUrl(e.source) && FR_RE.test(e.source || '')),
  short: events.filter((e) => !hasUrl(e.source) && !FR_RE.test(e.source || '') && (e.source || '').trim()),
  none: events.filter((e) => !(e.source || '').trim()),
};

const provenance = events.reduce((a, e) => { a[e.provenance || 'legacy'] = (a[e.provenance || 'legacy'] || 0) + 1; return a; }, {});

/* ---- facilities ---------------------------------------------------- */
const facilities = rows('SELECT id, name, source FROM facilities');
/* A facility source characteristically does two things at once:
   "TSMC facility listings; scale is an analyst judgement." names where the
   site came from AND discloses that its significance ordinal is a
   judgement. Those are two separate facts and are counted separately —
   collapsing them, as a first version of this script did, reported all 275
   facilities as "analyst judgement, no source", which understated the
   sourcing as badly as ignoring the clause would have overstated it.

   So: strip the judgement clause, classify what is left, and count the
   disclosure independently. */
const JUDGEMENT_RE = /scale is an analyst judge?ment|analyst judgment|analyst ordinal/i;
const sourceBody = (f) => String(f.source || '').replace(/;?\s*scale is an analyst judge?ment\.?/i, '').trim();
const facilityClasses = {
  cited: facilities.filter((f) => hasUrl(f.source)),
  named: facilities.filter((f) => !hasUrl(f.source) && sourceBody(f).length > 3),
  none: facilities.filter((f) => !hasUrl(f.source) && sourceBody(f).length <= 3),
};
const facilityJudgementDisclosed = facilities.filter((f) => JUDGEMENT_RE.test(f.source || ''));

/* ---- evidence notes ------------------------------------------------ */
const notes = rows('SELECT scope, tier, source FROM data_notes');
const noteScopes = new Set(notes.map((n) => n.scope));
const companies = rows('SELECT id, name FROM companies');
const stages = rows('SELECT id, name FROM stages');

const companiesWithNote = companies.filter((c) => noteScopes.has(`company:${c.id}`));
const stagesWithNote = stages.filter((s) => noteScopes.has(`stage:${s.id}`));
const notesByTier = notes.reduce((a, n) => { a[n.tier] = (a[n.tier] || 0) + 1; return a; }, {});

/* ---- customer relationships ---------------------------------------- */
const customerEdges = one('SELECT COUNT(*) AS c FROM customers').c;
const ownerEdges = one('SELECT COUNT(*) AS c FROM owners').c;

const md = `# Evidence coverage

*Generated from the vault by \`server/scripts/build-evidence-coverage.mjs\`. Last generated: ${today}.*
*Model version: \`${MODEL_VERSION}\` · snapshot date: ${SNAPSHOT_DATE} · canonical specification: [MODEL_V7_SPEC.md](../MODEL_V7_SPEC.md).*

How much of this dataset carries a source, counted from
\`server/data/sscim.db\` rather than asserted. The companion
[source register](SOURCE-REGISTER.md) lists the sources themselves and
grades how complete each citation is; this page answers the prior
question — how much of the model is sourced at all.

## Five different claims, kept apart

Conflating these would be the most misleading thing this page could do, so
each is stated with its own scope.

| | What it checks | Status | What it does **not** tell you |
| --- | --- | --- | --- |
| **Schema integrity** | Every record has the fields and types the engine requires | Enforced on every build by \`npm run audit:data\` | Nothing about whether any value is correct |
| **Graph integrity** | The stage graph is acyclic and connected; declared shares sum sensibly | Enforced on every build; residuals reported as warnings | Nothing about whether any value is correct |
| **Citation completeness** | Whether each figure carries a source, and how complete that source is | Counted below | Whether the source supports the claim |
| **Source quality** | Whether the source is authoritative for the claim attached to it | Recorded per entry where a curator has judged it; see the evidence-tier notes | Not inferred from the presence of a URL |
| **Factual validation** | Whether the number is correct | **Not established.** No figure in this dataset has been checked against an independent measurement | Everything |

A passing data audit means the records are *well-formed and internally
consistent*. It is a structural audit. It is not factual validation, and
this project does not claim otherwise.

## Events — ${events.length} records

| Class | Count | Share | What the record carries |
| --- | ---: | ---: | --- |
| **Full** | ${eventClasses.full.length} | ${pct(eventClasses.full.length, events.length)} | A resolvable URL, plus the feed or publisher that supplied it |
| **Legal** | ${eventClasses.legal.length} | ${pct(eventClasses.legal.length, events.length)} | An exact *Federal Register* volume and page — complete by Chicago's convention for government material |
| **Short** | ${eventClasses.short.length} | ${pct(eventClasses.short.length, events.length)} | Issuing body, document type and date only. Hand-curated historical records for which no published document was found |
| **Uncited** | ${eventClasses.none.length} | ${pct(eventClasses.none.length, events.length)} | No source recorded |

See the [source register](SOURCE-REGISTER.md) for each entry, and for why a
short entry stays short rather than acquiring an invented title.

### How each event was approved

Provenance is recorded per event, not implied by the source string.

| Provenance | Count | Meaning |
| --- | ---: | --- |
| **human** | ${provenance.human || 0} | A person approved it through the admin surface |
| **automatic** | ${provenance.automatic || 0} | Automatic triage approved it unattended. The source line says so; no reviewer identity is invented |
| **curated** | ${provenance.curated || 0} | Hand-authored in the seed data, never in the review queue |
| **legacy** | ${provenance.legacy || 0} | Predates the provenance column; how it was approved is not recorded |

Automatic approval is **opt-in and off by default**
(\`SSCIM_TRIAGE_AUTO_APPROVE\`). \`SELECT * FROM events WHERE
provenance='automatic'\` is the complete list of what entered unattended.

## Facilities — ${facilities.length} sites

| Class | Count | Share | What the record carries |
| --- | ---: | ---: | --- |
| **Cited** | ${facilityClasses.cited.length} | ${pct(facilityClasses.cited.length, facilities.length)} | A resolvable URL |
| **Named source, no URL** | ${facilityClasses.named.length} | ${pct(facilityClasses.named.length, facilities.length)} | A named source — company facility listings, site disclosures, filings — without a resolvable link |
| **Uncited** | ${facilityClasses.none.length} | ${pct(facilityClasses.none.length, facilities.length)} | No source recorded |

Separately, and orthogonally to the above:
**${facilityJudgementDisclosed.length} of ${facilities.length}** (${pct(facilityJudgementDisclosed.length, facilities.length)})
facility records explicitly disclose in their own source line that the
site's significance ordinal is an analyst judgement.

Every facility's \`scale\` is an **analyst ordinal from 1 to 5, not measured
capacity**, whether or not the site carries a citation. Every share derived
from it is therefore a share of the modeled sample, never of world output.
The gap worth closing here is the URL: a named company facility listing is a
real source, but a reader cannot follow it without a link.

## Companies and stages — evidence notes

Evidence notes (\`data_notes\`) are where a curator records what a figure
rests on and how strong that is. Their absence is not an error; it is
uncatalogued judgement, and it is counted here rather than left implicit.

| Scope | With an evidence note | Without | Share covered |
| --- | ---: | ---: | ---: |
| Companies | ${companiesWithNote.length} | ${companies.length - companiesWithNote.length} | ${pct(companiesWithNote.length, companies.length)} |
| Stages | ${stagesWithNote.length} | ${stages.length - stagesWithNote.length} | ${pct(stagesWithNote.length, stages.length)} |

Notes by declared evidence tier: ${Object.entries(notesByTier).map(([t, c]) => `**${t}** ${c}`).join(' · ') || '_none recorded_'}.

## Relationships

| | Count | Sourcing |
| --- | ---: | --- |
| Company-to-company supply relationships | ${customerEdges} | Revenue shares are analyst estimates from public disclosure; the supplier lists are sampled, not exhaustive |
| Ownership stakes | ${ownerEdges} | From public filings |
| Facility-to-facility links | *derived* | **Composed, never observed.** No record anywhere in this dataset states which plant ships to which plant. Every one is a modeled stage-mediated relationship |

## Analyst-judgement fields

These are declared judgements, not measurements, and they are load-bearing.
None is fitted to data.

- **Propagation priors** — downstream and upstream transmission coefficients, and the decay half-life. See [Methodology](../METHODOLOGY.md).
- **Facility significance** — the 1–5 ordinal every facility share derives from.
- **Stage substitutability and market weight** — two of the five structural-vulnerability components.
- **Event severity, direction, channel and scoring flag** — recorded per event in \`app/src/engine/event-assumptions.js\`, with the reasoning written out for each.

## What would close the gap

Nothing on this page is closed by better formatting. The short-citation
class shrinks when a URL is captured at review time, which the queue now
does automatically; the uncatalogued-judgement counts shrink when evidence
notes are written. Factual validation would require an independent
measurement to check against, and the [project
roadmap](../MODEL_ROADMAP.md) records what that would take.
`;

writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`  events: ${eventClasses.full.length} full, ${eventClasses.legal.length} legal, ${eventClasses.short.length} short, ${eventClasses.none.length} uncited (of ${events.length})`);
console.log(`  facilities: ${facilityClasses.cited.length} cited, ${facilityClasses.named.length} named-no-url, ${facilityClasses.none.length} uncited (of ${facilities.length}); ${facilityJudgementDisclosed.length} disclose the analyst ordinal`);
console.log(`  evidence notes: ${companiesWithNote.length}/${companies.length} companies, ${stagesWithNote.length}/${stages.length} stages`);
