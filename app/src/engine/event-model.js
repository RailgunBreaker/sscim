/* ====================================================================
   event-model.js — the v7 CURATED EVENT MODEL: per-incident stage
   exposure and per-incident temporal profile.

   WHAT THIS FIXES. v6 had neither. An incident tagged to four stages
   injected its FULL severity into all four independently, so tagging an
   event more thoroughly made it hit harder; and every event on the table
   decayed with one 12-day half-life, so a standing revocation and a
   same-week inspection halt were treated as the same shape of thing.

   Two curated fields per incident, both keyed by the stable event id:

     exposure   alpha_{e,s} in [0,1] — how much of stage s the incident
                actually touches. NOT a probability and NOT a measured
                capacity share: it is an analyst's reading of the record,
                and `exposureBasis` says what in the record supports it.
                Exposures across stages DO NOT have to sum to anything —
                one incident can touch two stages heavily.

     profile    the temporal profile (persistence.js) and its parameters,
                with `profileBasis` pointing at the dates in the record
                that justify the shape.

   CURATION SCOPE. Every operational incident inside ACTIVE_HORIZON_DAYS
   of the snapshot date is curated here explicitly; the data audit HARD
   FAILS if one is missing. Archived operational records older than that
   fall back to the equal 1/k allocation and the legacy profile, both of
   which are counted as diagnostics rather than being invisible. Their
   persistence multiplier at the snapshot date is below 1e-3 under every
   parameter setting in the registry, so the fallback cannot move a
   published number materially — but it is still reported.

   THE PERSISTENT_POLICY RULE, stated once. `persistent_policy` is used
   only where the record itself carries a dated in-force window. A
   standing regulatory regime's ongoing burden belongs to the STRUCTURAL
   policy layer (the POLICIES register), not to an operational event that
   never decays: representing it in both would count the same control
   twice. So an export-control record whose regime is already in the
   standing register is given `market_exponential` — it models the
   ADJUSTMENT to the rule, which does fade, not the rule's permanent
   existence, which is structural.
   ==================================================================== */

/* An operational incident within this many days of the snapshot date must
   be curated explicitly. Chosen so that every incident whose persistence
   multiplier can still exceed 1e-3 at the snapshot date — under the HIGH
   end of every half-life in the registry (market H_m = 90 d gives
   90*log2(1000) ~ 897 d) — is inside the curated set. */
export const ACTIVE_HORIZON_DAYS = 900;

const E = (exposure, exposureBasis, profile, profileBasis) => Object.freeze({
  exposure: Object.freeze({ ...exposure }),
  exposureBasis,
  profile: Object.freeze({ ...profile }),
  profileBasis,
});

export const EVENT_MODEL = Object.freeze({
  /* ---- 2026 ---- */
  p260807_man0807: E(
    { memory_fab: 0.80, hbm: 0.30, systems: 0.45, m_consumer: 0.50 },
    'The record describes commodity-DRAM wafer starts being moved onto HBM, so the memory-fab stage carries most of the footprint. HBM is named as the destination of those wafer starts rather than as a disrupted stage, hence the low exposure. System builders and consumer devices are the price-taking side the record names explicitly.',
    { kind: 'market_exponential' },
    'An allocation and pricing move with no capacity destroyed: it unwinds on a contracting and qualification timescale, not a repair one.',
  ),
  h2607_kumamoto: E(
    { mature_fab: 0.30, analog: 0.45, m_auto: 0.35, m_consumer: 0.15 },
    'Named affected sites are JASM (specialty/mature logic), Sony Kumamoto image sensors and Renesas automotive MCU lines (both analog/sensor), and Toyota and Honda Kyushu assembly. Each is the Kyushu share of a global stage, not the whole stage: analog carries the largest exposure because two of the named operators sit there and one remains shut.',
    { kind: 'outage_recovery', recoveryStartDays: 7 },
    'The record and its recovery updates give named plants restarting on named dates from 4 August 2026, seven days after the 28 July quake, with residual loss at Kawashiri into late August — a staged restart, so the decline is linear from day 7 over the registry recovery duration, not an exponential decay.',
  ),
  e1: E(
    { logic_ai: 0.90, hbm: 0.70, adv_fab: 0.35, adv_pkg: 0.30 },
    'The interim final rule names top-end AI accelerators and HBM3E-class stacks directly, so those two stages are near-fully in scope. Advanced fab and advanced packaging are touched only through the China-bound share of the parts being restricted, not across their whole output.',
    { kind: 'market_exponential' },
    'The standing BIS AI-chip and SME regime is already carried by the structural policy layer (policy family "bis"), so this record models the ADJUSTMENT to the new rule — re-routing, re-qualification, licence applications — which fades. Modelling it as a permanent operational term as well would count the same control twice.',
  ),
  e2: E(
    { adv_pkg: 0.80, logic_ai: 0.35 },
    'CoWoS is an advanced-packaging capacity line, so the easing lands almost wholly on that stage. It reaches AI logic only by relieving the packaging bottleneck those parts queue for, which is a partial and indirect exposure.',
    { kind: 'market_exponential' },
    'A capacity pull-in eases an allocation constraint; the relief is absorbed into the running baseline over a commercial cycle rather than ending on a date.',
  ),
  e4: E(
    { gases: 0.75, analog: 0.30 },
    'Gallium and germanium are gases-and-materials stage inputs and the licensing regime applies to them directly. Analog is exposed only through the subset of parts that use those materials.',
    { kind: 'market_exponential' },
    'A licensing throughput slowdown, not a physical outage: it eases as licences clear and as buyers qualify alternative sources.',
  ),
  h2606_mpban: E(
    { gases: 0.55, m_auto: 0.25 },
    'Blacklisting named U.S. rare-earth processors restricts part of the materials stage rather than all of it; automotive demand is the downstream end-market the record names.',
    { kind: 'market_exponential' },
    'A counter-designation whose effect is on procurement routing, which re-forms over a commercial cycle.',
  ),
  h2606_subs: E(
    { logic_ai: 0.55, m_ai: 0.60 },
    'Extending the ban to overseas subsidiaries closes a routing path rather than a production line: the AI end-market carries the larger exposure because it is the demand side actually cut off, with AI logic exposed through the share of output routed that way.',
    { kind: 'market_exponential' },
    'Scope extension of the standing regime in the structural policy layer; the operational term models the re-routing period.',
  ),
  h2603_memorypeak: E(
    { memory_fab: 0.85, m_consumer: 0.60, m_ai: 0.45 },
    'A near-doubling of contract DRAM prices is a whole-stage condition for memory fabs. Consumer devices carry the larger downstream exposure because memory is a larger share of their bill of materials than of an AI system.',
    { kind: 'market_exponential' },
    'A price and allocation peak: the record itself states momentum begins cooling at consumer affordability limits, i.e. a commercial-timescale decay.',
  ),
  h2601_ease: E(
    { logic_ai: 0.45, m_ai: 0.55 },
    'Case-by-case review reopens a licensing path for one performance band, so neither stage is wholly in scope; the AI end-market is the side that regains access.',
    { kind: 'market_exponential' },
    'An easing folded into the standing BIS regime carried structurally; the operational term models the transitional relief.',
  ),
  h2512_memory: E(
    { memory_fab: 0.75, hbm: 0.50, m_consumer: 0.45 },
    'The shortage originates in DRAM wafer allocation to HBM, so memory fab carries most of it, HBM is directly implicated as the competing demand, and consumer devices are the named squeezed buyer.',
    { kind: 'market_exponential' },
    'A shortage that clears as capacity and pricing re-equilibrate, on a commercial timescale.',
  ),
  h2510_truce: E(
    { gases: 0.60, analog: 0.25 },
    'The suspension covers the sweeping October materials controls, which are a materials-stage measure; analog is relieved only through the parts that consume them.',
    { kind: 'persistent_policy', effectiveAfterDays: 8, expiresAfterDays: 376 },
    'The record carries an explicit dated window: agreed 30 October 2025, formalized 7 November 2025 (day 8), expiring 10 November 2026 (day 376) unless extended. A suspension is either in force or it is not — it does not fade — so it is modelled as in force across that interval and zero outside it.',
  ),
  h2510_reemax: E(
    { gases: 0.85, analog: 0.35, m_auto: 0.40, m_ai: 0.25 },
    'A sweeping expansion of rare-earth controls is close to a whole-stage measure for materials. Automotive is the end-market with the heaviest magnet dependence in the record; AI systems the lightest of those named.',
    { kind: 'market_exponential' },
    'A control expansion whose operational bite is licence throughput and inventory drawdown, both commercial-timescale effects.',
  ),
  h2509_nexperia: E(
    { analog: 0.30, mature_fab: 0.15, osat: 0.20, m_auto: 0.55 },
    'Nexperia is one operator, so its share of the analog, mature-fab and OSAT stages is partial. Automotive carries the largest exposure because the record describes auto production cuts as the realized consequence of roughly 70% of Nexperia packaged output being frozen.',
    { kind: 'outage_recovery', recoveryStartDays: 32 },
    'The record states partial Chinese exemptions from November 2025 eased the squeeze — roughly 32 days after the 30 September seizure — so the effect declines from that point rather than decaying from day zero.',
  ),
  x2509_affiliates: E(
    { depo: 0.35, etch: 0.35, metro: 0.35, mature_fab: 0.20, memory_fab: 0.25 },
    'Extending Entity List restrictions to majority-owned affiliates widens who is covered, not what is produced: each equipment stage is exposed through the affiliate share of its customer base, and the two fab stages through the tools they were expecting.',
    { kind: 'market_exponential' },
    'A scope extension of the standing regime carried structurally; the operational term is the compliance and re-sourcing adjustment.',
  ),
  x2508_veurevoke: E(
    { memory_fab: 0.45, depo: 0.40, etch: 0.40, metro: 0.40, litho: 0.30 },
    'Revoking validated end-user authorisations for two operators\' China fabs affects those fabs\' tool inflow across every equipment stage named, and the memory-fab stage through the plants themselves. Litho is lower because it was already the most tightly licensed stage before the revocation.',
    { kind: 'persistent_policy', effectiveAfterDays: 124 },
    'The record gives an explicit effective date: notice issued 29 August 2025, effective 31 December 2025, i.e. day 124. This is a standing revocation of a named authorisation that is NOT represented in the structural policy register, and it has not been superseded, so it is in force with no expiry.',
  ),
  h2507_h20back: E(
    { logic_ai: 0.40, m_ai: 0.55 },
    'Resumption under a licence deal restores one SKU family, so the exposure is the share of the AI logic and AI end-market that SKU represents, not the whole of either.',
    { kind: 'market_exponential' },
    'A partial restoration absorbed into the running baseline over a commercial cycle.',
  ),
  x2507_edalift: E(
    { eda: 0.65, design: 0.45 },
    'All three EDA vendors restored China access, so most of the EDA stage is in scope; design is exposed through the share of design work that had actually stopped.',
    { kind: 'market_exponential' },
    'The restoration returns the stage to its previous baseline; the modelled relief is the catch-up period, which fades.',
  ),
  x2506_reelicense: E(
    { gases: 0.55, analog: 0.20, m_auto: 0.30 },
    'Expedited licensing relieves the throughput constraint on the materials stage; the two downstream stages are relieved only in proportion to how much of their input was actually held up.',
    { kind: 'market_exponential' },
    'A licensing-throughput easing, commercial timescale.',
  ),
  x2505_eda: E(
    { eda: 0.70, design: 0.50, adv_fab: 0.20, mature_fab: 0.15 },
    'All three vendors suspended Chinese sales and support, so most of the EDA stage is in scope and design work in progress genuinely stopped. The fab stages are exposed only through tape-outs that were in flight.',
    { kind: 'persistent_policy', effectiveAfterDays: 0, expiresAfterDays: 36 },
    'The record carries both boundary dates: suspensions began 28 May 2025 and restrictions were lifted 3 July 2025, a 36-day window. Modelled as fully in force inside that window and exactly zero after it, which is what "lifted" means.',
  ),
  h2505_rescind: E(
    { logic_ai: 0.35, m_ai: 0.45 },
    'Rescinding a rule that had not yet reached its compliance date removes a pending constraint rather than restoring stopped output, so exposures are modest on both stages.',
    { kind: 'market_exponential' },
    'Removal of a pending cap; the relief is priced in over a commercial cycle.',
  ),
  h2504_h20: E(
    { logic_ai: 0.60, m_ai: 0.70 },
    'Licence requirements on the compliant-SKU accelerators halted a specific, large product line: the AI end-market is the side that lost supply outright, with AI logic exposed through that line\'s share of output.',
    { kind: 'market_exponential' },
    'The standing regime is carried structurally; this models the halt-and-rewrite adjustment.',
  ),
  h2504_ree: E(
    { gases: 0.80, analog: 0.30, m_auto: 0.45 },
    'Controls on seven heavy rare earths plus magnets are close to a whole-stage measure for the materials stage; automotive is the named downstream line-stoppage.',
    { kind: 'market_exponential' },
    'A licensing pause whose bite is inventory drawdown and licence throughput.',
  ),
  x2502_tungsten: E(
    { gases: 0.50, analog: 0.20, substrates: 0.35 },
    'Five additional controlled materials cover part, not all, of the materials stage; substrates are the named packaging-side consumer and analog the named device-side one.',
    { kind: 'market_exponential' },
    'Materials-licensing measure, commercial timescale.',
  ),
  x2501_foundryrule: E(
    { adv_fab: 0.35, adv_pkg: 0.35, osat: 0.30, logic_ai: 0.25 },
    'A due-diligence rule imposes a compliance burden across foundry and packaging rather than removing capacity, so exposures are moderate and roughly even across the stages named.',
    { kind: 'market_exponential' },
    'A due-diligence obligation absorbed into standard practice over a commercial cycle.',
  ),
  h2412_gaban: E(
    { gases: 0.70, analog: 0.25 },
    'A country-targeted ban on gallium, germanium and antimony covers most of the materials stage for the destination named; analog is exposed through the parts that consume them.',
    { kind: 'market_exponential' },
    'An export ban whose operational effect is re-sourcing, which resolves commercially.',
  ),
  h2412_bis3: E(
    { hbm: 0.75, memory_fab: 0.40, depo: 0.35, etch: 0.35 },
    'The package puts HBM under control directly, so that stage carries most of it; memory fab and the two equipment stages are exposed through the entity additions rather than across their whole output.',
    { kind: 'market_exponential' },
    'Standing regime carried structurally; the operational term is the compliance and re-routing adjustment.',
  ),
  x2411_tsmcchina7nm: E(
    { adv_fab: 0.25, logic_ai: 0.30, design: 0.35 },
    'One foundry suspending sub-7nm supply to mainland designers affects the share of each stage represented by that customer set, not the stages as a whole; design carries the most because it is the customer set itself.',
    { kind: 'market_exponential' },
    'A supply suspension that redirects orders over a commercial cycle.',
  ),
  x2409_gaafet: E(
    { adv_fab: 0.20, eda: 0.25, depo: 0.25, metro: 0.25 },
    'Controls on quantum, GAAFET and advanced additive technologies are forward-looking: they touch the leading-edge fraction of each stage rather than current volume output.',
    { kind: 'market_exponential' },
    'A prospective-technology control whose current-period bite is licensing friction.',
  ),
  h2405_huawei: E(
    { design: 0.20, logic_ai: 0.15, m_consumer: 0.20 },
    'Revoking licences for one buyer is a single-customer cut, so the share of each stage exposed is small and the record itself describes a modest magnitude.',
    { kind: 'market_exponential' },
    'A single-buyer supply cutoff absorbed commercially.',
  ),
  h2404_hualien: E(
    { adv_fab: 0.30, memory_fab: 0.20 },
    'Fab halts and wafer scrap at the affected Taiwanese sites, which are a share of each stage rather than all of it.',
    { kind: 'acute_exponential' },
    'The record describes a fast recovery with no staged restart schedule, so an acute exponential decay is the honest shape: physical disruption whose restoration path is not separately recorded.',
  ),
});

/* Fallback profile for ARCHIVED operational records outside the curated
   horizon. Deliberately the shortest-lived profile: an old record with no
   curated persistence should decay away, never linger. Its use is counted
   as a legacy diagnostic on every model build. */
export const LEGACY_PROFILE = Object.freeze({ kind: 'acute_exponential' });

/* Non-operational records are operationally unscored by construction. */
export const UNSCORED_PROFILE = Object.freeze({ kind: 'strategic_context' });

export function eventModelOf(id) {
  return EVENT_MODEL[id] ?? null;
}

export function curatedEventIds() {
  return Object.keys(EVENT_MODEL);
}

/* Internal consistency: every curated exposure must be a finite number in
   [0,1] and every profile must name a supported kind. Enforced at import
   so a typo'd curation cannot ship. */
{
  const errors = [];
  for (const [id, m] of Object.entries(EVENT_MODEL)) {
    if (!m.exposureBasis) errors.push(`${id}: missing exposureBasis`);
    if (!m.profileBasis) errors.push(`${id}: missing profileBasis`);
    const stages = Object.keys(m.exposure);
    if (!stages.length) errors.push(`${id}: empty exposure vector`);
    for (const [s, a] of Object.entries(m.exposure)) {
      if (!Number.isFinite(a) || a < 0 || a > 1) errors.push(`${id}.exposure.${s}=${a} outside [0,1]`);
    }
    if (!m.profile?.kind) errors.push(`${id}: profile has no kind`);
  }
  if (errors.length) throw new Error(`curated event model is invalid:\n  ${errors.join('\n  ')}`);
}
