/* ====================================================================
   EVENT_ASSUMPTIONS — explicit, hand-curated semantic classification of
   the current snapshot's events and scenarios.

   This is NOT inferred from event prose at runtime (no LLM, no keyword
   matching, no sentiment analysis) — it is a small, versioned lookup
   table that a person wrote after reading each event's actual text once,
   keyed by the event/scenario's stable id. If the data layer ever adds a
   new event id not listed here, getEventAssumption() returns the safe
   "unclassified" default below rather than guessing, and the UI excludes
   unclassified events from scored operational impact.

   direction:  'adverse' | 'mitigating' | 'mixed'
   channel:    'downstream' | 'upstream' | 'both'
   operational: whether this event's effect should be included in the
                single scored "operational impact" number at all (see
                README "Model status and limitations"). Hazard-signal,
                mixed-reallocative, and long-term-strategic events are
                real and displayed, but are excluded from that one score
                because collapsing them into a signed magnitude would
                misrepresent what they actually describe.
   ==================================================================== */

export const UNCLASSIFIED_ASSUMPTION = Object.freeze({
  direction: 'adverse',
  channel: 'downstream',
  operational: false,
  reason: 'No explicit assumption recorded for this id — displayed but excluded from scored operational impact rather than guessed.',
});

export const EVENT_ASSUMPTIONS = Object.freeze({
  // U.S. expands AI-chip export-control rules — policy/export-control channel,
  // affects both the exporting equipment/materials side (upstream echo) and
  // the restricted downstream logic/HBM/packaging demand side.
  e1: Object.freeze({ direction: 'adverse', channel: 'both', operational: true, reason: 'Export-control policy shock; both directions per BIS rule scope.' }),

  // TSMC accelerates CoWoS capacity expansion — a capacity increase easing a
  // downstream packaging bottleneck: a mitigating (not adverse) signal.
  e2: Object.freeze({ direction: 'mitigating', channel: 'downstream', operational: true, reason: 'Reported capacity pull-in eases a downstream bottleneck.' }),

  // Elevated Taiwan Strait military activity — the event's own text states
  // explicitly that no supply disruption occurred; this is a hazard/risk
  // signal, not a realized operational shock, so it is displayed but
  // excluded from the scored operational number.
  e3: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: false, reason: "Event text states no supply disruption occurred — hazard signal only, not realized operational loss." }),

  // China tightens gallium/germanium licensing — adverse supply/material
  // channel, downstream (input availability/price effect on stages that
  // consume these materials).
  e4: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true, reason: 'Administrative licensing slowdown reduces material availability downstream.' }),

  // Major memory maker trims legacy DRAM capex while reallocating to HBM —
  // this has winners (HBM toolmakers) and losers (legacy-DRAM equipment
  // suppliers) at once; collapsing it into one signed operational number
  // would misrepresent it, so it is displayed but excluded.
  e5: Object.freeze({ direction: 'mixed', channel: 'downstream', operational: false, reason: 'Reallocative signal with both winners and losers; not reducible to one signed operational effect.' }),

  // Japan approves next Rapidus funding tranche — a long-term strategic /
  // resilience-building signal (multi-year capacity diversification), not
  // a current-period operational shock.
  e6: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: false, reason: 'Long-term strategic/resilience signal (multi-year subsidy), not a current-period operational shock.' }),

  // Bundled scenario presets (see server seed-data SCENARIOS) and the
  // in-app custom scenario builder, which — absent an explicit direction
  // supplied by the builder itself — defaults to an adverse downstream
  // operational shock (matching what the builder's UI copy already implies).
  strait: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true, reason: 'Blockade-level disruption scenario: adverse operational supply shock.' }),
  materials: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true, reason: 'Hard export-ban scenario: adverse operational supply shock.' }),
  exportmax: Object.freeze({ direction: 'adverse', channel: 'both', operational: true, reason: 'Export-controls-max scenario: adverse policy shock, both directions.' }),
  custom: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true, reason: 'User-built scenario; the Scenario Builder does not yet capture direction/channel explicitly, so this is the documented default.' }),
});

export function getEventAssumption(id) {
  return EVENT_ASSUMPTIONS[id] ?? UNCLASSIFIED_ASSUMPTION;
}
