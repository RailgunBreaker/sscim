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
  p260714_fed4132: Object.freeze({ direction: "mitigating", channel: "downstream", operational: false, reason: "Published: Review: reject cand_webz_news_04f59e01b8bab71dc7c23814c78ec641915d994f" }),

  p260728_webef0b: Object.freeze({ direction: "mixed", channel: "upstream", operational: false, reason: "Published: Review: approve p260728_web4420" }),

  p260728_web4420: Object.freeze({ direction: "adverse", channel: "downstream", operational: false, reason: "Published: Review: reject cand_webz_news_4ba0c3389095b2f227635e770868fafa9168c58b" }),

  p260729_web6934: Object.freeze({ direction: "adverse", channel: "upstream", operational: true, reason: "Published: Review: approve p260729_web807f" }),

  p260729_web807f: Object.freeze({ direction: "mitigating", channel: "upstream", operational: false, reason: "Published: Review: reject cand_webz_news_dea3c680f9e6c867539a5c67799ad690aba2b414" }),

  p260729_web2ef3: Object.freeze({ direction: "mitigating", channel: "downstream", operational: false, reason: "Published: Review: approve p260728_usgtgb9" }),

  p260728_usgtgb9: Object.freeze({ direction: "adverse", channel: "both", operational: true, reason: "Realized multi-site production halt with confirmed physical damage at one operator (Renesas) plus regional power and rail outages. This matches the existing M7.1 Kumamoto anchor at 7: several named fabs down with confirmed damage, but concentrated in one prefecture and with the largest local fab (JASM) undamaged and already restoring, so it does not approach the sector-wide breadth of the 9 anchor." }),

  p260729_webaa64: Object.freeze({ direction: "adverse", channel: "both", operational: false, reason: "As reported by this source the event is predominantly precautionary: every named site reports no major damage, halts are inspection-driven and same-day, and the article's own assessment is minimal immediate disruption. That is a hazard signal with assessment underway rather than established capacity loss, so operational=false and severity stays low. This is deliberately lower than the severity assigned to candidate ...b1017aa1 for the same earthquake, because that source establishes confirmed physical damage and multi-day halts at Renesas and Toyota that this earlier snapshot lists only as 'assessing'. If the two are merged, the higher assessment governs." }),

  p260729_web1ae0: Object.freeze({ direction: "adverse", channel: "both", operational: true, reason: "Published: Review: reject cand_webz_news_10d7f9f9b2ab24f1f038d4999d984b36851ca11c" }),

  p260729_webfdb0: Object.freeze({ direction: "mixed", channel: "downstream", operational: false, reason: "Published: Review: approve p260729_web57b8" }),

  p260729_web57b8: Object.freeze({ direction: "adverse", channel: "downstream", operational: true, reason: "Production at a single named fab genuinely stopped, so this is operational rather than a hazard signal — but the realized scale is small: one site, no structural damage found, and resumption already under way at the time of reporting. That sits well below the 6 anchor for a multi-week single-site outage and near the 4 anchor for one company losing one supply line. Direction is adverse because the underlying operational change is a production pause; the resumption framing is why severity stays low rather than making the record mitigating. Channel is downstream because the disruption originates at a foundry and propagates to its customers." }),

  p260729_web3084: Object.freeze({ direction: "adverse", channel: "both", operational: true, reason: "Production was actually stopped, not merely threatened: several named fabs and vehicle plants suspended output and at least one operator (Renesas) reported confirmed physical damage. This matches the dataset's severity-7 anchor for the M7.1 Kumamoto quake halting several named fabs with confirmed damage — multi-site, multi-company, but with halts so far measured in days rather than weeks and partial resumption already underway, so it does not exceed that anchor. Channel is both because upstream wafer/sensor/MCU output and downstream vehicle assembly were hit simultaneously." }),

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

  /* ---- Historical backfill events (server/src/history-events.js) ----
     Real, sourced 2021–2026 events. Classified once per id, same rules as
     above: `operational: false` = displayed + individually propagated but
     excluded from the scored index (hazard signals, policy signals that
     never took effect, mixed-reallocative shocks). */
  h2102_uri:       Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized multi-week fab outage (Texas grid failure).' }),
  h2103_renesas:   Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized capacity loss — fab fire with ~3-month recovery.' }),
  h2108_malaysia:  Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized backend assembly/test throughput loss under lockdowns.' }),
  h2202_kioxia:    Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized NAND output loss from contamination.' }),
  h2202_neon:      Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized input-material supply cut (neon) with severe price effect.' }),
  h2204_shanghai:  Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized assembly/logistics disruption during lockdown.' }),
  h2208_strait22:  Object.freeze({ direction: 'adverse', channel: 'downstream', operational: false, reason: 'Hazard signal — exercises disrupted no physical chip flows.' }),
  h2208_chips:     Object.freeze({ direction: 'mitigating', channel: 'downstream', operational: false, reason: 'Long-term strategic subsidy signal, not a current-period supply change.' }),
  h2210_bis:       Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Broadest realized export-control shock; cuts both tool supply and chip demand paths.' }),
  h2301_alliance:  Object.freeze({ direction: 'adverse', channel: 'downstream', operational: false, reason: 'Policy signal — restrictions arrived via later national rules, counted separately.' }),
  h2307_gage:      Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized material-export licensing pause; exports fell to zero for two months.' }),
  h2307_jpsme:     Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Realized tool-export restriction effective on this date.' }),
  h2308_mate60:    Object.freeze({ direction: 'mixed', channel: 'downstream', operational: false, reason: 'Controls-effectiveness signal with winners and losers; no supply change.' }),
  h2309_duv:       Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Realized lithography-tool export restriction effective on this date.' }),
  h2310_bisupdate: Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Realized widening of AI-chip controls (A800/H800 path closed).' }),
  h2401_noto:      Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized (limited) wafer/materials plant outages after the quake.' }),
  h2404_hualien:   Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized fab halts and wafer scrap, fast recovery.' }),
  h2405_huawei:    Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized supply cutoff for one major buyer — modest magnitude.' }),
  h2412_bis3:      Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Realized HBM controls + mass entity listing.' }),
  h2412_gaban:     Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized country-targeted material export ban.' }),
  h2501_diffusion: Object.freeze({ direction: 'adverse', channel: 'both', operational: false, reason: 'Rescinded before its compliance date — policy volatility, not a realized supply change.' }),
  h2501_deepseek:  Object.freeze({ direction: 'mixed', channel: 'downstream', operational: false, reason: 'Demand-side sentiment shock with winners and losers; no supply disruption.' }),
  h2504_ree:       Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized heavy-REE/magnet export pause with downstream line stoppages.' }),
  h2504_h20:       Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Realized halt of compliant-SKU accelerator sales; inventory written down.' }),
  h2505_rescind:   Object.freeze({ direction: 'mitigating', channel: 'downstream', operational: true,  reason: 'Realized removal of pending worldwide caps — supply-path easing.' }),
  h2507_h20back:   Object.freeze({ direction: 'mitigating', channel: 'downstream', operational: true,  reason: 'Realized partial restoration of China accelerator flows.' }),
  h2509_nexperia:  Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized packaged-output freeze with automaker production cuts.' }),
  h2510_reemax:    Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized (weeks-active) sweeping REE controls with extraterritorial reach before suspension.' }),
  h2510_truce:     Object.freeze({ direction: 'mitigating', channel: 'downstream', operational: true,  reason: 'Realized one-year suspension of the October REE package.' }),
  h2512_memory:    Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized conventional DRAM/NAND supply squeeze from HBM reallocation.' }),
  h2512_yilan:     Object.freeze({ direction: 'adverse', channel: 'downstream', operational: false, reason: 'Hazard signal — fabs confirmed unharmed.' }),
  h2601_ease:      Object.freeze({ direction: 'mitigating', channel: 'downstream', operational: true,  reason: 'Realized licensing-path easing for near-frontier accelerators.' }),
  h2603_memorypeak: Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized peak of the memory price/allocation squeeze.' }),
  h2604_match:     Object.freeze({ direction: 'adverse', channel: 'downstream', operational: false, reason: 'Introduced bill — no realized supply change unless enacted.' }),
  h2606_subs:      Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized closure of the offshore-subsidiary accelerator channel.' }),
  h2606_mpban:     Object.freeze({ direction: 'adverse', channel: 'downstream', operational: true,  reason: 'Realized blacklist cutting Chinese inputs to U.S. REE producers.' }),
  h2607_tsmcq2:    Object.freeze({ direction: 'mixed', channel: 'downstream', operational: false, reason: 'Demand-strength/earnings signal, not a change in physical supply; market reaction was mixed.' }),
  h2607_kumamoto:  Object.freeze({ direction: 'adverse', channel: 'both', operational: true,  reason: 'Realized multi-site production halt (Sony CIS, Renesas MCU, JASM) with damage confirmed — an operational loss, not a hazard signal; upstream channel included because Toyota\'s assembly suspension cuts demand back through the auto chip chain.' }),

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
