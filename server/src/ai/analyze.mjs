/* AI analysis step: turns a raw feed record into a DRAFTED, PROPOSED event.

   ────────────────────────────────────────────────────────────────────────
   Why nothing here is authoritative
   ────────────────────────────────────────────────────────────────────────
   README 4.8 and event-assumptions.js both state that event semantics are
   hand-curated and never inferred at runtime. That property is load-bearing:
   it is why the scored index can be defended. So this module writes to
   `event_candidates`, never to `events` — the model proposes severity,
   direction, channel, and operational-inclusion, and a human accepts or
   rejects them via scripts/review.mjs before any of it reaches the model.
   The AI is doing the tedious 90% (finding, reading, drafting, suggesting);
   the judgment stays human.

   Requires ANTHROPIC_API_KEY (or an `ant auth login` profile) on the machine
   running the pipeline. If no credential is present the pipeline still runs —
   candidates are queued undrafted for manual review.
   ──────────────────────────────────────────────────────────────────────── */
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db.js';

const MODEL = process.env.SSCIM_AI_MODEL || 'claude-opus-5';

const SYSTEM = `You are a research assistant for SSCIM, a semiconductor supply-chain risk model.

You are given a raw record from an automated feed (a USGS earthquake, or a U.S. Federal Register document). Your job is to decide whether it is a genuine semiconductor-supply-chain event and, if so, draft the event record a human analyst will review.

Ground rules, in order of importance:

1. Be conservative about relevance. Most records are not supply-chain events. An earthquake near a fab cluster is only relevant if it plausibly disrupted production; a proposed rule or a routine notice is usually not a realized change. Set relevant=false rather than manufacturing significance.

2. Severity (1-10) measures REALIZED operational scale — capacity share affected, duration, breadth — not newsworthiness, not market reaction, and not how alarming it sounds. Anchors from the existing dataset: 9 = the Oct 2022 BIS controls (broadest sector-wide export restriction). 7 = M7.1 Kumamoto quake halting several named fabs with confirmed damage; China's Ga/Ge licensing regime. 6 = a multi-week single-site outage. 4 = a single company losing one supply line. If you cannot establish that production was actually affected, the honest severity is low.

3. operational=false is the right answer more often than people expect. Set it false for: hazard signals where no disruption occurred, mixed/reallocative events with simultaneous winners and losers, long-term strategic or subsidy signals, and anything announced but not yet in effect. Only realized, current-period, signed operational effects belong in the scored index.

4. Distinguish what the source states from what you infer. Put only source-supported facts in summary/detail. Use the uncertainty field to say plainly what you could not establish — especially fab-level impact, which seismic and regulatory feeds never report. A human reads this to decide whether to accept your proposal.

5. Use only stage and country ids from the provided lists. Never invent one.`;

function vaultIds() {
  return {
    stages: db.prepare('SELECT id FROM stages ORDER BY id').all().map((r) => r.id),
    countries: db.prepare('SELECT id FROM countries ORDER BY id').all().map((r) => r.id),
  };
}

function proposalSchema({ stages, countries }) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      relevant: { type: 'boolean', description: 'False if this record is not a genuine semiconductor-supply-chain event.' },
      irrelevantReason: { type: 'string', description: 'If not relevant, one sentence explaining why. Empty string otherwise.' },
      title: { type: 'string', description: 'Headline, under ~80 characters.' },
      summary: { type: 'string', description: 'One or two sentences of what happened, source-supported only.' },
      eventType: { type: 'string', enum: ['Export Control', 'Policy Signal', 'Natural Disaster', 'Industrial Accident', 'Critical Material Risk', 'Geopolitical Risk', 'Company Guidance', 'Technology Update', 'Market Shock', 'Pandemic Disruption'] },
      proposedSev: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      proposedDirection: { type: 'string', enum: ['adverse', 'mitigating', 'mixed'] },
      proposedChannel: { type: 'string', enum: ['downstream', 'upstream', 'both'] },
      proposedOperational: { type: 'boolean', description: 'Whether this belongs in the scored operational index. See rule 3.' },
      classificationReason: { type: 'string', description: 'One sentence justifying direction/channel/operational, in the style of event-assumptions.js.' },
      confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
      stages: { type: 'array', items: { type: 'string', enum: stages } },
      countries: { type: 'array', items: { type: 'string', enum: countries } },
      first: { type: 'string', description: 'First-order effect.' },
      second: { type: 'string', description: 'Second-order effect.' },
      watch: { type: 'string', description: 'What to watch next, middot-separated.' },
      detail: { type: 'string', description: 'Background paragraph. State what the source establishes and what it does not.' },
      uncertainty: { type: 'string', description: 'What you could NOT establish from the source. Never leave this empty for a relevant event.' },
    },
    required: ['relevant', 'irrelevantReason', 'title', 'summary', 'eventType', 'proposedSev', 'proposedDirection',
      'proposedChannel', 'proposedOperational', 'classificationReason', 'confidence', 'stages', 'countries',
      'first', 'second', 'watch', 'detail', 'uncertainty'],
  };
}

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/* Returns { proposal, model, notes } or null if the model judged the record
   irrelevant / declined / errored. Never throws — a failed analysis must
   degrade to "queued for manual review", not break the pipeline. */
export async function analyzeCandidate(candidate) {
  const client = new Anthropic();
  const ids = vaultIds();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Opt into server-side fallbacks: semiconductor export-control material can
      // brush the cyber classifiers, and a declined draft would otherwise silently
      // leave the candidate undrafted.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: proposalSchema(ids) } },
      messages: [{
        role: 'user',
        content: `Feed: ${candidate.sourceFeed}\nDate: ${candidate.dateISO}\n\nRaw record:\n${JSON.stringify(candidate.raw, null, 2)}`,
      }],
    });

    if (response.stop_reason === 'refusal') {
      return { proposal: null, model: MODEL, notes: `Model declined to analyze (${response.stop_details?.category ?? 'unspecified'}). Queued for manual review.` };
    }

    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) return { proposal: null, model: MODEL, notes: 'Model returned no text block.' };

    const proposal = JSON.parse(text);
    return {
      proposal,
      model: response.model || MODEL,
      notes: proposal.relevant ? proposal.uncertainty : `Judged not relevant: ${proposal.irrelevantReason}`,
    };
  } catch (err) {
    return { proposal: null, model: MODEL, notes: `Analysis failed: ${err.message}` };
  }
}
