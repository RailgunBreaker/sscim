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

  /* ---- Decade backfill (server/src/decade-events.js) ----
     Real, sourced Aug 2016 - Oct 2025 events extending the vault back to a
     full ten-year window. Classified once per id under the same rules as
     every entry above: operational=true only for realised, current-period,
     signed operational effects. Announcements not yet in force, hazard
     signals, reallocative demand shocks and long-run capacity or subsidy
     commitments are operational=false - displayed and individually
     propagated, but excluded from the scored index. */
  x1609_armsb:           Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Ownership change at the IP layer; no current-period change in physical supply." }),
  x1610_note7:           Object.freeze({ direction: "mixed",       channel: "upstream",    operational: false,  reason: "Demand-side cancellation with winners and losers across component suppliers; not a supply disruption." }),
  x1610_qcomnxp:         Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Announced consolidation; no realized supply effect (and ultimately abandoned in 2018)." }),
  x1612_aixtron:         Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Investment-screening precedent; no change to current tool supply." }),
  x1701_pcast:           Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Strategy document; the policy instruments it anticipates arrive years later." }),
  x1703_dramcycle:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized allocation and price squeeze on memory buyers — the same class of event as the 2025-26 memory shortage." }),
  x1708_twblackout:      Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Hazard signal on grid concentration — no confirmed wafer loss at the major fabs." }),
  x1709_toshibamem:      Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Ownership restructuring; NAND output continues throughout." }),
  x1710_euv:             Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Capacity/technology enablement over a multi-year horizon, not a current-period supply change." }),
  x1710_dramtight:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized allocation constraint at the packaging/passives layer during the cycle peak." }),
  x1712_micronumc:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Litigation stage — the realized supply effect arrives with the Oct 2018 Entity Listing." }),
  x1712_ndrcdram:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Regulatory signal; no licensing or shipment effect established." }),
  x1803_broadcomqcom:    Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Deal prohibition; no realized supply change." }),
  x1804_zte:             Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized: a named large buyer actually stopped producing for roughly three months." }),
  x1806_mlcc:            Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized allocation shortfall that forced board redesigns and build cuts at downstream assemblers." }),
  x1807_zteoff:          Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: true,   reason: "Realized restoration of a supply path that had actually been severed." }),
  x1807_qcomnxpfail:     Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Abandoned transaction; supply unchanged either way." }),
  x1808_tsmcvirus:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized multi-site production stoppage with quantified output loss at the leading edge." }),
  x1808_ndaa:            Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Enabling legislation; the controls it authorizes are counted on their own effective dates." }),
  x1808_gf7nm:           Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Structural narrowing of leading-edge supplier choice — a concentration change, not a current-period outage." }),
  x1810_jinhua:          Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized: the target project actually halted once tool and EDA support stopped." }),
  x1810_memdown:         Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Demand-driven price collapse: easier for buyers, damaging for suppliers — not reducible to one signed operational effect." }),
  x1811_micronindict:    Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Enforcement action; the supply effect is already captured by the Entity Listing." }),
  x1811_anprm:           Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Proposed rulemaking with no compliance obligation." }),
  x1812_meng:            Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Hazard/geopolitical signal; no supply flow changed on this date." }),
  x1901_applewarn:       Object.freeze({ direction: "mixed",       channel: "upstream",    operational: false,  reason: "Demand-side revision; suppliers lose orders while buyers gain capacity — not one signed operational effect." }),
  x1904_samsungcut:      Object.freeze({ direction: "mixed",       channel: "upstream",    operational: false,  reason: "Deliberate supply discipline in a glut; adverse for toolmakers, neutral-to-positive for memory pricing." }),
  x1905_huawei_el:       Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized cutoff across many stages at once for a top-five global chip buyer; broad but narrower in scope than the Oct 2022 sector-wide rules." }),
  x1905_armgoogle:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized suspension of design-IP and software access that HiSilicon depended on." }),
  x1906_kioxiaoutage:    Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized, quantified output loss at a site holding a large share of global NAND." }),
  x1907_jpkr:            Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized licensing pause on inputs where Japan held 70-90% share; Korean makers ran on buffer stock and emergency qualification." }),
  x1908_whitelist:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized administrative friction across a broad materials and tool list feeding Korean fabs." }),
  x1908_huaweitgl:       Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized widening of an already-effective cutoff." }),
  x1911_euvlicense:      Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized denial of the only EUV supply path, fixing China's process ceiling from this point on." }),
  x1912_5gpull:          Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Demand pull-forward; capacity tightened but no established shortfall at this date." }),
  x2002_covidcn:         Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized weeks-long output shortfall across the assembly and packaging layer." }),
  x2003_lockdowns:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized simultaneous shutdown of the automotive demand chain and the mature-node bookings behind it." }),
  x2005_fdpr:            Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized severing of the leading-edge foundry path for a major designer — a genuine capacity reallocation." }),
  x2005_tsmcaz:          Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Multi-year capacity diversification signal, not a current-period supply change." }),
  x2008_fdpr2:           Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized, near-total supply cutoff for the largest Chinese buyer across every silicon stage — the broadest single action before Oct 2022." }),
  x2009_nvarm:           Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Announced (and later abandoned) transaction; no supply effect." }),
  x2009_huaweicut:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "The compliance date on which shipments actually stopped — realized, not announced." }),
  x2009_smicrestrict:    Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized licensing friction that measurably slowed tool deliveries to China's largest foundry." }),
  x2010_amdxilinx:       Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Consolidation with no current-period supply effect." }),
  x2011_asetest:         Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Tightness without an established shortfall on this date; the realized effect shows up in the 2021 events." }),
  x2012_autoshort:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized allocation shortfall that idled vehicle assembly within weeks." }),
  x2012_smicel:          Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized denial of advanced-node tooling to a top-five foundry." }),
  x2101_autocuts:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized, widespread vehicle-assembly output loss traceable to chip allocation." }),
  x2102_eo14017:         Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Policy review; no supply change." }),
  x2103_intel20b:        Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Multi-year capacity commitment, not a current-period change." }),
  x2104_twdrought:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Hazard signal: mitigated at cost, with no confirmed wafer loss at the major fabs." }),
  x2106_review100:       Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Strategy document; instruments arrive in Aug 2022." }),
  x2106_kingyuan:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized, quantified throughput loss at a named backend supplier during peak shortage." }),
  x2108_toyota40:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized 40% single-month output cut at the largest automaker." }),
  x2109_cnpower:         Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized multi-day suspensions at named packaging and substrate sites." }),
  x2110_abf:             Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized allocation constraint at a stage with no substitute, limiting downstream shipments." }),
  x2110_tsmcjapan:       Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Long-run capacity addition; the concentration consequence surfaces in 2026." }),
  x2112_xian:            Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized production adjustment at named memory fabs holding significant global share." }),
  x2201_asmlfire:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized component-supply loss at a single-source site, with limited but genuine tool-delivery effect." }),
  x2201_intelohio:       Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Long-horizon capacity; repeatedly delayed thereafter." }),
  x2202_nvarmdead:       Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Terminated transaction; no supply effect." }),
  x2206_memoryglut:      Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Demand collapse: relief for buyers, damage to suppliers — excluded as reallocative." }),
  x2208_eda:             Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized, immediately effective licensing on the design-software path to next-generation transistors." }),
  x2208_a100:            Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized halt of top-end accelerator shipments to China, effective on notification." }),
  x2210_veu:             Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: true,   reason: "Realized exemption that kept a large block of global memory capacity supplied with tools." }),
  x2210_uspersons:       Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized withdrawal of the service and qualification labour those fabs run on — distinct from the tool-sale ban itself." }),
  x2211_rapidus:         Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Multi-year strategic capacity signal." }),
  x2211_capexcut:        Object.freeze({ direction: "mixed",       channel: "upstream",    operational: false,  reason: "Adverse for equipment demand, corrective for memory pricing — not one signed operational effect." }),
  x2212_tsmcaz40:        Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Long-horizon capacity commitment." }),
  x2212_ymtc:            Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized cutoff that measurably stalled a named producer's capacity ramp." }),
  x2302_chipsguardrails: Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Proposed condition on future investment; no current-period supply effect." }),
  x2304_samsungcut23:    Object.freeze({ direction: "mixed",       channel: "upstream",    operational: false,  reason: "Deliberate supply reduction to correct pricing; adverse for toolmakers, corrective for suppliers." }),
  x2305_micronban:       Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized: a named supplier actually lost a major market, and Chinese buyers had to resource." }),
  x2307_tsmcazdelay:     Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Schedule slip on future capacity; no current-period output change." }),
  x2308_outbound:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Capital-flow restriction with a later compliance date; not a physical supply change." }),
  x2309_euchips:         Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Long-horizon subsidy programme." }),
  x2310_biren:           Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized loss of leading-edge foundry access for named designers, forcing respins." }),
  x2310_kioxiawd:        Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Abandoned consolidation; no supply effect." }),
  x2312_hbmturn:         Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "The reallocation that later causes the 2025-26 shortage; at this date winners and losers are simultaneous." }),
  x2401_duvrevoke:       Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized cancellation of specific tool deliveries already on order." }),
  x2402_jasm:            Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Capacity addition ramping over subsequent quarters." }),
  x2403_intelaward:      Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Funding for capacity that produces years later." }),
  x2404_awards:          Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Long-horizon capacity funding." }),
  x2405_301:             Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Announced with a 2025 effective date; a cost change rather than an availability change." }),
  x2407_fdprleak:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Hazard/market-reaction signal on an unpublished rule; no supply change." }),
  x2409_gaafet:          Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized, immediately effective licensing across a defined technology set." }),
  x2410_asmlbookings:    Object.freeze({ direction: "mixed",       channel: "upstream",    operational: false,  reason: "Demand-side guidance revision, with AI-linked demand still strong — not a signed operational supply effect." }),
  x2411_tsmcchina7nm:    Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized shipment halt from the dominant leading-edge foundry to a whole class of customers." }),
  x2412_nvidiaprobe:     Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Regulatory pressure signal; no shipment effect established." }),
  x2501_foundryrule:     Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized compliance obligation that immediately changed who foundries and OSATs would accept work from." }),
  x2502_tungsten:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: true,   reason: "Realized licensing regime on inputs with high Chinese share and thin substitutes." }),
  x2503_tsmc100:         Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Multi-year capacity commitment." }),
  x2504_tariffs:         Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "A cost and routing shock with simultaneous winners and losers by geography; not a signed availability change." }),
  x2504_232:             Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Investigation only; remedies undetermined at this date." }),
  x2505_gulf:            Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: false,  reason: "Demand-side market access; no change to physical supply." }),
  x2505_eda:             Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized: design tools and support actually stopped, freezing tape-outs across Chinese design houses." }),
  x2506_reelicense:      Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: true,   reason: "Realized improvement in licence throughput for a flow that had actually stopped." }),
  x2507_edalift:         Object.freeze({ direction: "mitigating",  channel: "downstream",  operational: true,   reason: "Realized restoration of a design-tool path that had been severed five weeks earlier." }),
  x2507_malaysia:        Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Administrative requirement targeting diversion; no established effect on legitimate flows." }),
  x2508_revshare:        Object.freeze({ direction: "mixed",       channel: "downstream",  operational: false,  reason: "Enables flows while taxing them; the underlying restoration is already counted at Jul 15, 2025." }),
  x2508_veurevoke:       Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized removal of the blanket authorization a large share of global memory capacity depended on for tooling." }),
  x2509_affiliates:      Object.freeze({ direction: "adverse",     channel: "both",        operational: true,   reason: "Realized, immediately effective expansion of who cannot be supplied." }),
  x2510_ports:           Object.freeze({ direction: "adverse",     channel: "downstream",  operational: false,  reason: "Logistics cost effect without an established availability change." }),

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
