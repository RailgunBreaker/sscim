import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { pct } from '../interaction/lensEncoding.js';
import { explainConnection } from '../engine/facilityTraversal.js';

/* ====================================================================
   FacilityConnectionDetail — why this line exists.

   A graph edge is an assertion. This panel is the receipt for it: what
   kind of relationship it claims to be, which two companies and which two
   stages produced it, the exact arithmetic that gave it its strength, how
   well evidenced it is, and what it explicitly does not mean.

   The phrasing is deliberately un-upgradable. A reader skimming this
   panel must not be able to come away with "TSMC ships wafers to this
   plant" when what the dataset supports is "TSMC's operator sells to this
   plant's operator, and a stage one runs reaches a stage the other runs".
   The words for that are "modeled stage-mediated relationship", and they
   appear in the heading, not in a footnote.
   ==================================================================== */

export default function FacilityConnectionDetail({ link, viewFrom, onFocus, onSelect, onClose }) {
  const { data, engine } = useVault();
  const { FACILITY_NETWORK, FACILITY_LAYER, COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;

  if (!link) return null;
  const x = explainConnection(link, {
    network: FACILITY_NETWORK,
    viewFrom,
    COMPANY_BY_ID,
    STAGE_BY_ID,
    FACILITY_BY_ID: FACILITY_LAYER.FACILITY_BY_ID,
  });
  if (!x) return null;

  const row = (label, value, title) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2.5px 0' }}>
      <span className="mono" style={{ fontSize: 12, color: C.faint, width: 108, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }} title={title}>{value}</span>
    </div>
  );

  return (
    <section aria-label="Explanation of the selected modeled connection"
      style={{ border: `1px solid ${C.copperDim}`, borderRadius: 6, background: C.panel, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 12, color: C.copper }}>
          MODELED STAGE-MEDIATED RELATIONSHIP
        </span>
        {onClose && (
          <button type="button" onClick={onClose} style={{ ...chipStyle, marginLeft: 'auto' }} aria-label="Close this explanation">
            Close
          </button>
        )}
      </div>

      {row('Direction', x.direction === 'upstream'
        ? `${x.from?.name || x.link.from} supplies ${x.to?.name || x.link.to}`
        : `${x.from?.name || x.link.from} supplies ${x.to?.name || x.link.to}`,
      'The arrow of the modeled relationship, from supplier site to customer site.')}
      {row('Class', `${x.relationshipClass.label} — ${x.relationshipClass.describes}`)}
      {row('Source plant', `${x.from?.name || x.link.from}${x.from ? ` · ${COUNTRY_NAMES[x.from.country] || x.from.country}` : ''}`)}
      {row('Target plant', `${x.to?.name || x.link.to}${x.to ? ` · ${COUNTRY_NAMES[x.to.country] || x.to.country}` : ''}`)}
      {row('Companies', `${x.fromCompany.name} → ${x.toCompany.name}`)}
      {row('Stages', `${x.fromStage.name} → ${x.toStage.name}`)}

      <div style={{ borderTop: `1px solid ${C.line}`, margin: '8px 0 7px' }} />

      <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>
        WHAT PRODUCED THIS EDGE, AND HOW IT WAS SIZED
      </div>
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, marginBottom: 6 }}>
        The edge exists because <b style={{ color: C.text }}>{x.fromCompany.name}</b> sells
        to <b style={{ color: C.text }}>{x.toCompany.name}</b> in the customer table, and
        because <b style={{ color: C.text }}>{x.fromStage.name}</b> reaches <b style={{ color: C.text }}>{x.toStage.name}</b> in
        the flow graph. The commercial edge is what gates the relationship; the graph only sizes it.
      </div>
      {row('Formula', x.formula)}
      {row('Company share', x.factors.companyShare != null ? `${(x.factors.companyShare * 100).toFixed(1)}% of ${x.fromCompany.name}'s modeled customer revenue` : '—')}
      {row('Stage reach', x.factors.stageReach != null ? x.factors.stageReach.toFixed(4) : '—',
        'The engine’s own signed downstream propagation from a unit shock — the same function every event uses.')}

      <div style={{ borderTop: `1px solid ${C.line}`, margin: '8px 0 7px' }} />

      <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>
        STRENGTH — TWO SCALES, NOT COMPARABLE
      </div>
      {row('Local', x.strength.localPct != null ? pct(x.strength.localPct) : '—', x.strength.localScaleLabel || undefined)}
      <div className="mono" style={{ fontSize: 12, color: C.faint, marginLeft: 116, marginBottom: 4 }}>
        {x.strength.localScaleLabel || 'no focus plant selected'} — this is the number the graph draws.
      </div>
      {row('Snapshot', x.strength.snapshotPct != null ? pct(x.strength.snapshotPct) : '—', x.strength.snapshotScaleLabel)}
      <div className="mono" style={{ fontSize: 12, color: C.faint, marginLeft: 116 }}>
        {x.strength.snapshotScaleLabel} — this is the number the connection table lists.
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, margin: '8px 0 7px' }} />

      <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>
        EVIDENCE — {x.evidence.label.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, marginBottom: 6 }}>{x.evidence.note}</div>

      <div className="mono" style={{ fontSize: 12, color: C.amber, marginBottom: 4 }}>Known limitations</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.faint, lineHeight: 1.65 }}>
        {x.limitations.map((l) => <li key={l}>{l}</li>)}
      </ul>

      <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
        {onFocus && x.from && (
          <button type="button" onClick={() => onFocus(x.from.id)} style={chipStyle}>Centre on {shortName(x.from.name)}</button>
        )}
        {onFocus && x.to && (
          <button type="button" onClick={() => onFocus(x.to.id)} style={chipStyle}>Centre on {shortName(x.to.name)}</button>
        )}
        {onSelect && (
          <button type="button" onClick={() => onSelect({ type: 'company', id: x.fromCompany.id })} style={chipStyle}>
            {x.fromCompany.name} profile
          </button>
        )}
        {onSelect && (
          <button type="button" onClick={() => onSelect({ type: 'stage', id: x.fromStage.id })} style={chipStyle}>
            {x.fromStage.name} stage
          </button>
        )}
      </div>
    </section>
  );
}

function shortName(name) {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

const chipStyle = {
  fontSize: 12, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0,
};
