import { Fragment } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import Logo from './Logo.jsx';

/* ====================================================================
   CompanyChainSpread — ONE modeled chain, read left to right.

   WHAT THIS REPLACES. Two separate widgets stacked on the company
   profile: UPSTREAM ORIGINS (tier-2 origins → direct suppliers →
   company) and CUSTOMER-GRAPH SPREAD (company → direct customers →
   their customers). Both were three-column trees, both were drawn the
   same way, and both had the SAME COMPANY as one of their columns — the
   last column of the first and the first column of the second. A reader
   met the company's own card twice, under two headings, with the chain
   broken in the middle at exactly the point the chain is continuous.

   They are now one five-column row with the company in the centre:

     TIER-2 ORIGINS → DIRECT SUPPLIERS → [COMPANY] → DIRECT CUSTOMERS →
     THEIR CUSTOMERS

   which is what the two of them always were.

   THE TWO SIDES STILL MEAN DIFFERENT THINGS, so they are still labelled
   differently rather than blended into one number:

     upstream    % = the supplier's sales share along the path. A
                 relationship weight, nothing more.
     downstream  % = supplier-revenue share, and the figure on the right
                 of the card is the MODELED CONTRIBUTION (share-weighted
                 adverse impact), which is why those cards are coloured
                 by risk and the upstream ones are not.

   Nothing here is a documented relationship. Every edge is composed by
   the engine from declared priors; the documented chain is a separate
   dataset shown separately, and the two are never merged.
   ==================================================================== */

const card = {
  border: `1px solid ${C.line}`, borderRadius: 4, background: C.panel,
  padding: '5px 7px', marginBottom: 4,
};

function Col({ title, note, children }) {
  return (
    /* Five columns have to fit the profile column, which is narrower than
       the workspace the three-column trees used to have. 126px holds a firm
       name on two lines without clipping it; past that the row scrolls, as
       it always could. */
    <div style={{ minWidth: 126, flex: 1 }}>
      <div className="mono" style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>{title}</div>
      {note && <div className="mono" style={{ fontSize: 11, color: C.faint, opacity: 0.8, marginBottom: 4 }}>{note}</div>}
      {children}
    </div>
  );
}

const Arrow = () => (
  <div aria-hidden="true" style={{ alignSelf: 'center', color: C.copper, fontSize: 13, flexShrink: 0 }}>→</div>
);

export default function CompanyChainSpread({ cid, field, setSel }) {
  const { data, engine } = useVault();
  const { COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { supplierSpread, customerSpread, companyContribution } = engine;

  const self = COMPANY_BY_ID[cid];
  if (!self) return null;

  const [sup1, sup2] = supplierSpread(cid);
  /* The downstream half is share-weighted against the ACTIVE field, so it
     cannot be drawn without one. A profile opened outside the dashboard
     (chain context only) gets the upstream half and says nothing it
     cannot support. */
  const [cus1, cus2] = field ? customerSpread(cid, field) : [[], []];
  if (!sup1.length && !cus1.length) return null;

  const open = (id) => setSel?.({ type: 'company', id });

  const Firm = ({ r, side, showPct }) => {
    const co = COMPANY_BY_ID[r.cid];
    if (!co) return null;
    const tone = side === 'down' ? riskColor((r.contribution || 0) * 10) : C.copperDim;
    return (
      <div className="evcard" role={setSel ? 'button' : undefined} tabIndex={setSel ? 0 : undefined}
        onClick={() => open(r.cid)} onKeyDown={onEnterSpace(() => open(r.cid))}
        style={{ ...card, borderLeft: `3px solid ${tone}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Logo cid={r.cid} size={13} />{co.name}
          </span>
          {side === 'down'
            ? <span className="mono" style={{ fontSize: 11, color: tone, fontWeight: 600 }}>{(r.contribution || 0).toFixed(3)}</span>
            : showPct && <span className="mono" style={{ fontSize: 11, color: C.dim }}>{`${(r.rel * 100).toFixed(0)}%`}</span>}
        </div>
        <div className="mono" style={{ fontSize: 11, color: C.faint }}>
          {side === 'down'
            ? `${(r.rel * 100).toFixed(0)}% supplier-revenue share`
            : `HQ: ${COUNTRY_NAMES[co.country] || co.country}`}
        </div>
      </div>
    );
  };

  const empty = <div className="mono" style={{ fontSize: 11, color: C.faint }}>—</div>;
  const selfContribution = field ? companyContribution(self, field) : null;

  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: C.copper, margin: '10px 0 5px', lineHeight: 1.5 }}>
        MODELED CHAIN · TWO LAYERS EACH SIDE
        <span style={{ color: C.faint }}>
          {' · upstream % = supplier’s sales share along the path · downstream % = supplier-revenue share, value = modeled contribution'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', alignItems: 'stretch' }}>
        <Col title="TIER-2 ORIGINS">
          {sup2.length ? sup2.map((r) => <Firm key={r.cid} r={r} side="up" showPct />) : empty}
        </Col>
        <Arrow />
        <Col title="DIRECT SUPPLIERS">
          {sup1.length ? sup1.map((r) => <Firm key={r.cid} r={r} side="up" showPct />) : empty}
        </Col>
        <Arrow />
        {/* The centre column is the company itself — drawn once, where the
            two halves meet, instead of once at the end of each. */}
        <Col title="THIS COMPANY">
          <div style={{ ...card, borderLeft: `3px solid ${C.copper}`, background: C.panel2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Logo cid={cid} size={13} />{self.name}
              </span>
              {selfContribution != null && (
                <span className="mono" style={{ fontSize: 11, color: C.copper, fontWeight: 600 }}>{selfContribution.toFixed(3)}</span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 11, color: C.faint }}>
              {`HQ: ${COUNTRY_NAMES[self.country] || self.country}`}
            </div>
          </div>
        </Col>
        <Arrow />
        <Col title="DIRECT CUSTOMERS">
          {cus1.length ? cus1.map((r) => <Firm key={r.cid} r={r} side="down" />) : empty}
        </Col>
        <Arrow />
        <Col title="THEIR CUSTOMERS">
          {cus2.length ? cus2.map((r) => <Firm key={r.cid} r={r} side="down" />) : empty}
        </Col>
      </div>
      {!field && (
        <p className="mono" style={{ fontSize: 11, color: C.faint, margin: '6px 0 0', lineHeight: 1.55 }}>
          The downstream half is share-weighted against the active operational field, which is not available in this
          context, so only the upstream half is drawn.
        </p>
      )}
    </div>
  );
}
