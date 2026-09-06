import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { getEventAssumption } from '../engine/event-assumptions.js';
import { factualEligibility } from '../engine/evidence.js';
import { riskColor, riskLabel, confColor, TYPE_COLORS } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import { STAGE_INTRO, introForCompany, introForCountry } from '../data/glossary.js';
import ScenarioSummary from './ScenarioSummary.jsx';
import CentreDetail from './CentreDetail.jsx';
import Tex from './Tex.jsx';
import { Disclosure } from '../ui/primitives.jsx';
import Logo from './Logo.jsx';
import Quote from './Quote.jsx';
import Chip from './Chip.jsx';
import SpreadTree from './SpreadTree.jsx';
import UpstreamTree from './UpstreamTree.jsx';
import CustomerSpreadTree from './CustomerSpreadTree.jsx';
import EventSites from './EventSites.jsx';
import FacilityDetail from './FacilityDetail.jsx';
import TrackButton from './TrackButton.jsx';

const Field = ({ k, v, copper }) => (
  <div style={{ marginBottom: 6 }}>
    <span className="mono" style={{ fontSize: 12, color: copper ? C.copper : C.dim }}>{k}</span>
    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: copper ? C.copper : C.text }}>{v}</div>
  </div>
);
const MetricTag = ({ kind }) => {
  const label = kind === 'structural' ? 'Structural' : kind === 'scenario' ? 'SCENARIO Δ' : 'Operational';
  const color = kind === 'structural' ? C.dim : kind === 'scenario' ? C.copper : C.amber;
  return <span className="mono" style={{ fontSize: 12, color, border: `1px solid ${color}`, borderRadius: 3, padding: "0 4px", marginLeft: 5 }}>{label}</span>;
};

export default function Detail({ sel, setSel, model, scenario, onResetScenario, onPlayScenario, scenarioActive, baseGraph }) {
  const { data: vault, engine } = useVault();
  const { COMPANY_BY_ID, COMPANIES, COUNTRY_NAMES, SUPPLIERS, CUSTOMERS, EVENTS, POLICIES, OWNERS, QUOTES } = vault;
  const {
    STAGE_BY_ID, NETWORK_INFLUENCE, NETWORK_INFLUENCE_RANK, STRUCTURAL_VULNERABILITY, STRUCTURAL_WEIGHTS,
    structuralComponents, COUNTRY_LINKS, eventField, operationalIndex, toDisplayIndex,
    COMPANY_CRITICALITY, COMPANY_RANK, companyVulnerability, companyContribution,
  } = engine;

  /* ---- SCENARIO: synthetic frontend entity → Scenario Impact Summary (§9) ---- */
  if (sel.type === "scenario") {
    return <ScenarioSummary model={model} scenario={scenario} setSel={setSel} onReset={onResetScenario} onPlay={onPlayScenario} />;
  }

  /* ---- FUNCTIONAL CENTRE: country × stage node detail (§11) ---- */
  if (sel.type === "centre" && baseGraph) {
    return <CentreDetail centreId={sel.id} baseGraph={baseGraph} model={model} setSel={setSel} />;
  }

  /* ---- FACILITY: one plant's standardized profile + its network links ---- */
  if (sel.type === "facility") {
    return <FacilityDetail facilityId={sel.id} setSel={setSel} model={model} />;
  }

  /* ---- EVENT: summary + engine math + company-to-company spread ---- */
  if (sel.type === "event") {
    const e = EVENTS.find((x) => x.id === sel.id);
    const assumption = getEventAssumption(e.id);
    const { field, magnitude, source } = eventField(e);
    const ownIndex = toDisplayIndex(operationalIndex(field));
    const eligibility = factualEligibility(e, engine.MODEL_PRIORS.datasetAsOf);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span className="mono" style={{ fontSize: 12, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: "2px 7px" }}>{e.type}</span>
          <span className="mono" style={{ fontSize: 12, color: confColor(e.conf) }}>evidence: {e.conf} <span style={{ color: C.faint }}>(metadata, not an impact multiplier)</span></span>
        </div>
        <h3 style={{ margin: "6px 0", fontSize: 15, lineHeight: 1.35 }}>{e.title}</h3>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{e.summary}</p>
        <div style={{ fontSize: 12, color: eligibility.eligible ? C.dim : C.amber, marginBottom: 8, lineHeight: 1.5 }}>
          Factual baseline: {eligibility.eligible ? 'eligible' : 'excluded'} — {eligibility.reason}.
          {' '}Occurrence: {e.evidence?.occurrence?.status || 'unresolved'}; exposure: {e.evidence?.exposure?.status || 'assumed'}; operational status: {e.evidence?.operationalStatus?.status || 'unresolved'}.
          {(e.evidence?.sources || []).map((s, i) => <div key={i}><a href={s.url} target="_blank" rel="noreferrer" style={{ color: C.copper }}>{s.publisher || 'Source'} · {s.documentIdentifier || 'identifier unknown'}</a>{' '}— {s.claimStatus}; {s.supportingSection || 'supporting section unknown'}</div>)}
        </div>
        {!assumption.operational && (
          <div className="mono" style={{ fontSize: 12, color: C.amber, background: "#2A1E14", border: `1px solid ${C.copperDim}`, borderRadius: 5, padding: "6px 9px", marginBottom: 6, lineHeight: 1.5 }}>
            Excluded from the operational impact score — {assumption.reason}
          </div>
        )}
        {e.detail && (<><div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0 3px" }}>Background</div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{e.detail}</p></>)}
        {e.source && <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 6 }}>SOURCE · {e.source}</div>}
        {e.timeline && (<><div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0 3px" }}>Timeline</div>
        {e.timeline.map(([d, txt]) => (
          <div key={d + txt} className="mono" style={{ fontSize: 12, color: C.dim, marginBottom: 2 }}>
            <span style={{ color: C.copper, display: "inline-block", width: 58 }}>{d}</span>{txt}
          </div>
        ))}</>)}
        {/* WHAT THIS USED TO SAY, AND WHY IT WAS WRONG.

              ENGINE - s_0 = clamp(sev/10,0,1) x 2^(-age/12) = <value>

            That is the v6 model: ONE universal 12-day half-life for every
            event. v7 replaced it with five per-incident persistence
            profiles, and the number printed at the end of the line already
            came from the v7 engine - so the formula and the value it
            claimed to produce disagreed on screen. For the Kumamoto
            earthquake the printed formula evaluates to 0.078 against a
            printed result of 0.152; for the memory-price event, 0.000024
            against 0.038. A reader checking our arithmetic would have found
            that it did not check out.

            It survived the v7.1 documentation sweep because that sweep
            scans a list of UI text files which did not include this one.
            This file is now on that list, so docs:verify guards it.

            Below: the profile that actually ran, and the two factors that
            actually produced the magnitude. Formula-level detail is one
            click away rather than inlined. */}
        <div style={{ fontSize: 13, color: C.text, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 5, padding: "8px 11px", margin: "10px 0 4px", lineHeight: 1.7 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ color: C.faint }}>Own-field index</span>
            <b className="mono" style={{ fontSize: 17, color: C.copper }}>{ownIndex.toFixed(2)}</b>
            <MetricTag kind="operational" />
            <span style={{ color: C.faint }}>
              severity {e.sev}/10, {e.daysAgo === 0 ? 'today' : `${e.daysAgo} days ago`}
            </span>
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>
            Persistence profile <b style={{ color: C.text }}>{(source?.profile?.kind || 'acute_exponential').replace(/_/g, ' ')}</b>
            {' '}leaves <b className="mono" style={{ color: C.text }}>{((source?.persistence ?? 0) * 100).toFixed(1)}%</b> of the
            original intensity today, giving a source magnitude of{' '}
            <b className="mono" style={{ color: C.text }}>{magnitude.toFixed(3)}</b>, propagated by
            directional all-paths traversal ({assumption.channel}).
          </div>
          <Disclosure summary="How this is calculated">
            <p style={{ margin: '0 0 8px', fontSize: 13, color: C.dim }}>
              An incident enters the graph as a source vector over the stages it
              touches. Each stage&rsquo;s entry is the incident&rsquo;s intensity, scaled by
              how much of that stage the incident is judged to affect, and decayed
              by the profile assigned to that incident &mdash; not by one universal
              half-life.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <Tex tex={"z_{e,s}(t)=d_{e,s}\\,g(q_e)\\,\\alpha_{e,s}\\,R_e(t)"} block />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: C.faint }}>
              Here <Tex tex={"R_e(t)"} /> is the persistence term for this
              incident&rsquo;s profile and <Tex tex={"\\alpha_{e,s}"} /> is its curated
              exposure to each stage. Both are analyst judgements, and their
              uncertainty is measured separately from parameter and model-form
              uncertainty. Full definitions:{' '}
              <a href="docs/MODEL_V7_SPEC.md.html" style={{ color: C.copper }}>model specification</a>.
            </p>
          </Disclosure>
        </div>
        {(() => { const topCo = COMPANIES.map((c) => ({ c, contribution: companyContribution(c, field) })).sort((a, b) => b.contribution - a.contribution).slice(0, 6);
          return (<><div className="mono" style={{ fontSize: 12, color: C.dim, margin: "8px 0 4px" }}>Top modeled contribution — companies (share-weighted)</div>
          {topCo.map(({ c, contribution }) => (
            <div key={c.id} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c.id })} onKeyDown={onEnterSpace(() => setSel({ type: "company", id: c.id }))}>
              <span className="mono" style={{ fontSize: 12, color: C.text, width: 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={c.id} size={13} />{c.name}</span>
              <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, contribution * 100)}%`, height: "100%", background: riskColor(contribution * 10), opacity: 0.75 }} />
              </div>
              <span className="mono" style={{ fontSize: 12, width: 34, textAlign: "right", color: C.dim }}>{contribution.toFixed(3)}</span>
            </div>
          ))}</>); })()}
        <SpreadTree sourceStages={e.stages} field={field} setSel={setSel} />
        <EventSites event={e} setSel={setSel} />
        <div style={{ marginTop: 10 }}>
          <Field k="First-order" v={e.first} />
          <Field k="Second-order" v={e.second} />
          <Field k="What to watch next" v={e.watch} copper />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {e.stages.map((id) => <Chip key={id} label={STAGE_BY_ID[id]?.name} onClick={() => setSel({ type: "stage", id })} />)}
          {e.countries.map((id) => <Chip key={id} label={COUNTRY_NAMES[id]} onClick={() => setSel({ type: "country", id })} outline />)}
        </div>
      </div>
    );
  }

  /* ---- COMPANY: vulnerability / contribution / criticality + spread ---- */
  if (sel.type === "company") {
    const co = COMPANY_BY_ID[sel.id];
    const { field, value: criticality } = COMPANY_CRITICALITY[sel.id];
    const rank = COMPANY_RANK.findIndex((x) => x.id === sel.id) + 1;
    const vulnerability = companyVulnerability(co, model.activeField);
    const contribution = companyContribution(co, model.activeField);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <Logo cid={co.id} size={26} />
          <h3 style={{ margin: 0, fontSize: 16 }}>{co.name}</h3>
          <span className="mono" style={{ fontSize: 12, color: C.dim }}>HQ: {COUNTRY_NAMES[co.country]}</span>
          <TrackButton type="company" id={co.id} />
          <span className="mono" style={{ fontSize: 12, color: C.copper, marginLeft: "auto" }}>criticality rank #{rank} of {COMPANIES.length}</span>
        </div>
        <div style={{ margin: "5px 0 0" }}><Quote quote={(QUOTES || {})[co.id]} /></div>
        <p style={{ margin: "6px 0 4px", fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>{introForCompany(co, { STAGE_BY_ID, COUNTRY_NAMES, CUSTOMERS, SUPPLIERS })}</p>
        <div className="mono" style={{ margin: "8px 0", fontSize: 12, display: "flex", flexWrap: "wrap", gap: 14 }}>
          <span>Systemic criticality <b style={{ fontSize: 16, color: riskColor(criticality) }}>{criticality.toFixed(2)}</b><span style={{ color: C.faint }}>/10</span></span>
          <span>Vulnerability <b style={{ fontSize: 16, color: riskColor(vulnerability) }}>{vulnerability.toFixed(2)}</b><span style={{ color: C.faint }}>/10 (share-independent)</span></span>
          <span>Contribution <b style={{ fontSize: 16, color: C.copper }}>{contribution.toFixed(3)}</b><span style={{ color: C.faint }}> (share-weighted)</span></span>
        </div>
        <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
          Criticality = modeled chain effect if this company's production were fully disrupted (economic-stage-weighted, then scaled against the most critical company in the snapshot — so 10 means "the most systemically critical company here," not a theoretical ceiling no company can reach). Vulnerability = average adverse impact across its stages, independent of market share — a small and a large single-stage company can share this number. Contribution = assumed-coefficient-weighted modeled effect; share does not cancel here.
          <Tex tex={"\\mathrm{criticality}_c=\\mathrm{clamp}_{10}\\!\\left(10\\cdot\\frac{\\mathrm{raw}_c}{\\max_k \\mathrm{raw}_k}\\right),\\quad \\mathrm{raw}_c=\\frac{\\sum_n \\max(0,\\mathrm{field}_n)\\cdot w_n}{\\sum_n w_n}"} />
        </div>
        <div style={{ fontSize: 12, color: C.amber, lineHeight: 1.5 }}>Illustrative company ranking: exposure coefficients are analyst priors with unresolved measurement denominators. HQ is domicile, not manufacturing location. <a href="docs/reference/MEASUREMENT-BASIS.md.html" style={{ color: C.copper }}>Measurement basis</a></div>
        <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "8px 0 4px" }}>MODELED STAGE EXPOSURE (ASSUMED COEFFICIENT)</div>
        {Object.entries(co.stakes).sort((a, b) => b[1] - a[1]).map(([sid, sh]) => (
          <div key={sid} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer" }} onClick={() => setSel({ type: "stage", id: sid })} onKeyDown={onEnterSpace(() => setSel({ type: "stage", id: sid }))}>
            <span className="mono" style={{ fontSize: 12, color: C.dim, width: 160, flexShrink: 0 }}>{STAGE_BY_ID[sid].name}</span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${sh * 100}%`, height: "100%", background: C.copper, opacity: 0.8 }} />
            </div>
            <span className="mono" style={{ fontSize: 12, width: 34, textAlign: "right", color: C.copper }}>{(sh * 100).toFixed(0)}%</span>
          </div>
        ))}

        {(CUSTOMERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "10px 0 4px" }}>Customers — share of {co.name} sales (supplier-revenue share)</div>
            {(CUSTOMERS[co.id] || []).map(([c2, r]) => (
              <div key={c2} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c2 })} onKeyDown={onEnterSpace(() => setSel({ type: "company", id: c2 }))}>
                <span className="mono" style={{ fontSize: 12, color: C.text, width: 160, flexShrink: 0 }}>{COMPANY_BY_ID[c2].name}</span>
                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r * 100}%`, height: "100%", background: C.green, opacity: 0.6 }} />
                </div>
                <span className="mono" style={{ fontSize: 12, width: 34, textAlign: "right", color: C.dim }}>{(r * 100).toFixed(0)}%</span>
              </div>
            ))}
          </>
        )}
        {(SUPPLIERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "10px 0 4px" }}>Key suppliers — their sales share to {co.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(SUPPLIERS[co.id] || []).slice(0, 8).map(([sup, r]) => (
                <Chip key={sup} label={`${COMPANY_BY_ID[sup].name} ${(r * 100).toFixed(0)}%`} onClick={() => setSel({ type: "company", id: sup })} />
              ))}
            </div>
          </>
        )}

        {(OWNERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "10px 0 4px" }}>MAJOR SHAREHOLDERS (PUBLIC FILINGS)</div>
            {(OWNERS[co.id] || []).map(([o, sh]) => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 12, color: /gov|SOE|METI/.test(o) ? C.amber : C.text, width: 180, flexShrink: 0 }}>{o}</span>
                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, sh * 100)}%`, height: "100%", background: /gov|SOE|METI/.test(o) ? C.amber : C.copper, opacity: 0.7 }} />
                </div>
                <span className="mono" style={{ fontSize: 12, width: 40, textAlign: "right", color: C.dim }}>{(sh * 100).toFixed(1)}%</span>
              </div>
            ))}
          </>
        )}
        <UpstreamTree cid={co.id} setSel={setSel} />
        <CustomerSpreadTree cid={co.id} field={model.activeField} setSel={setSel} />
        <SpreadTree sourceStages={Object.keys(co.stakes)} field={field} exclude={co.id} setSel={setSel} title="STAGE-LEVEL SPREAD (CRITICALITY VIEW)" />
      </div>
    );
  }

  /* ---- STAGE / COUNTRY ---- */
  const isStage = sel.type === "stage";
  const node = isStage ? STAGE_BY_ID[sel.id] : null;
  const structural = isStage ? STRUCTURAL_VULNERABILITY[sel.id] : model.countriesActive[sel.id]?.structural;
  /* For a country this is LOCAL PRESSURE — the share-weighted mean of the
     stage field over the stages the country participates in, normalized by
     its own modeled footprint. Its unnormalized companion, the country's
     chain contribution to the headline index, is shown below. */
  const operationalNow = isStage ? model.activeField[sel.id] : model.countriesActive[sel.id]?.localPressure;
  const operationalBase = isStage ? model.baselineField[sel.id] : model.countriesBase[sel.id]?.localPressure;
  const delta = (operationalNow ?? 0) - (operationalBase ?? 0);
  const name = isStage ? node.name : COUNTRY_NAMES[sel.id];
  const related = EVENTS.filter((e) => (isStage ? e.stages : e.countries).includes(sel.id));
  const policies = isStage ? POLICIES.filter((p) => p.stages.includes(sel.id)) : [];
  const impRank = isStage ? NETWORK_INFLUENCE_RANK.indexOf(sel.id) + 1 : null;
  const comp = isStage ? structuralComponents(node) : model.countriesActive[sel.id]?.structComp;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{name}</h3>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: riskColor(structural) }}>{structural?.toFixed(2)}</span>
        <span className="mono" style={{ fontSize: 12, color: riskColor(structural), border: `1px solid ${riskColor(structural)}`, borderRadius: 3, padding: "1px 6px" }}>{riskLabel(structural)}<MetricTag kind="structural" /></span>
        {isStage && <TrackButton type="stage" id={sel.id} />}
        {scenarioActive && Math.abs(delta) > 0.01 && (
          <span className="mono" style={{ fontSize: 12, color: delta >= 0 ? C.red : C.green }}>{delta >= 0 ? "▲" : "▼"} operational Δ {delta >= 0 ? "+" : ""}{delta.toFixed(3)}<MetricTag kind="scenario" /></span>
        )}
      </div>
      <p style={{ margin: "6px 0 4px", fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>
        {isStage ? STAGE_INTRO[sel.id] : introForCountry(sel.id, { COUNTRY_NAMES, STAGE_BY_ID, COMPANIES }, model)}
      </p>
      <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0" }}>
        {isStage ? 'Operational impact (current)' : 'Local pressure (current)'}: <b style={{ color: (operationalNow ?? 0) > 0 ? C.red : (operationalNow ?? 0) < 0 ? C.green : C.dim }}>{(operationalNow ?? 0).toFixed(3)}</b> (positive = adverse, negative = mitigating)<MetricTag kind="operational" />
        {!isStage && (
          <>
            {' · '}chain contribution <b style={{ color: C.copper }}>{(model.countriesActive[sel.id]?.chainContribution ?? 0).toFixed(4)}</b>
            {' '}<span style={{ color: C.faint }}>(this country&apos;s unnormalized share of the headline field; local pressure is normalized over its own footprint)</span>
          </>
        )}
      </div>
      {isStage && (
        <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0" }}>
          Network influence <span style={{ color: C.copper, fontWeight: 600 }}>{NETWORK_INFLUENCE[sel.id].toFixed(2)}</span> (rank #{impRank}/24, modeled sensitivity proxy — not measured economic loss) · sample value ~${node.value}B · subsection shown under the flow graph
        </div>
      )}
      {!isStage && (
        <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0 8px", lineHeight: 1.6 }}>
          Derived from (geography, not headquarters): {model.countriesActive[sel.id]?.stages.slice(0, 5).map(([sid, sh]) => `${STAGE_BY_ID[sid]?.name} (${(sh * 100).toFixed(0)}%)`).join(" · ")}
        </div>
      )}
      {!isStage && (() => {
        const outL = COUNTRY_LINKS.filter((l) => l.a === sel.id).slice(0, 4);
        const inL = COUNTRY_LINKS.filter((l) => l.b === sel.id).slice(0, 4);
        return (outL.length + inL.length) > 0 ? (
          <>
            <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0 4px" }}>MODELED SUPPLIER-REVENUE RELATIONSHIPS (BY COMPANY HEADQUARTERS)</div>
            {outL.map((l) => (
              <div key={"o" + l.b} role="button" tabIndex={0} className="mono" style={{ fontSize: 12, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.b })} onKeyDown={onEnterSpace(() => setSel({ type: "country", id: l.b }))}>
                <span style={{ color: C.copper }}>supplies →</span> {COUNTRY_NAMES[l.b]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
            {inL.map((l) => (
              <div key={"i" + l.a} role="button" tabIndex={0} className="mono" style={{ fontSize: 12, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.a })} onKeyDown={onEnterSpace(() => setSel({ type: "country", id: l.a }))}>
                <span style={{ color: C.green }}>← sources from</span> {COUNTRY_NAMES[l.a]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
          </>
        ) : null;
      })()}
      {!isStage && COMPANIES.some((c) => c.country === sel.id) && (
        <>
          <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "6px 0 4px" }}>HEADQUARTERED HERE (not necessarily produced here)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
            {COMPANIES.filter((c) => c.country === sel.id).map((c) => (
              <Chip key={c.id} label={c.name} onClick={() => setSel({ type: "company", id: c.id })} />
            ))}
          </div>
        </>
      )}

      <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "8px 0 4px" }}>STRUCTURAL VULNERABILITY BREAKDOWN (TIME-INVARIANT)</div>
      {comp && Object.keys(STRUCTURAL_WEIGHTS).map((k) => {
        const val = Math.min(10, Math.max(0, comp[k]));
        const label = {
          networkInfluence: 'Network influence (snapshot-relative)',
          geo: 'Geographic concentration (HHI, upper bound)',
          policy: 'Policy exposure (policy families)',
          nonSubstitutability: 'Non-substitutability',
          market: 'Market sensitivity',
        }[k];
        const analyst = k === 'nonSubstitutability' || k === 'market';
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 12, color: C.dim, width: 200, flexShrink: 0 }}>
              {label} <span style={{ color: analyst ? C.amber : C.copper, fontSize: 12 }}>[{analyst ? "ANALYST" : "GRAPH/DATA"}]</span> <span style={{ color: C.faint }}>×{STRUCTURAL_WEIGHTS[k].toFixed(2)}</span>
            </span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${val * 10}%`, height: "100%", background: riskColor(val), opacity: 0.7 }} />
            </div>
            <span className="mono" style={{ fontSize: 12, width: 30, textAlign: "right", color: C.dim }}>{val.toFixed(1)}</span>
          </div>
        );
      })}

      {policies.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "10px 0 4px" }}>Active policy instruments</div>
          {policies.map((p) => (
            <div key={p.id} className="mono" style={{ fontSize: 12, color: C.dim, marginBottom: 2 }}>
              <span style={{ color: riskColor(p.sev) }}>sev {p.sev}</span> · {p.name}
            </div>
          ))}
        </>
      )}
      {related.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 12, color: C.dim, margin: "10px 0 4px" }}>Attached events</div>
          {related.map((e) => (
            <div key={e.id} role="button" tabIndex={0} onClick={() => setSel({ type: "event", id: e.id })} onKeyDown={onEnterSpace(() => setSel({ type: "event", id: e.id }))} style={{ fontSize: 12, color: C.copper, cursor: "pointer", marginBottom: 3 }}>→ {e.title}</div>
          ))}
        </>
      )}
    </div>
  );
}
