import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { facilityConnectivity } from '../engine/facilityNetwork.js';
import { siteWeight } from '../engine/facilities.js';
import { useFacilityPlayground } from './useFacilityPlayground.js';
import FacilityExplorer from './FacilityExplorer.jsx';
import { Button } from '../ui/primitives.jsx';

/* ====================================================================
   CompanyFacilities — this company's plants, inside its profile.

   The facility network used to be reachable only from its own
   workspace, which meant a reader looking at a company had to leave the
   company to find out where it actually makes anything. The plants are
   a property of the firm, so they belong on the firm's page.

   This is not a third explorer. The plant list is new; everything below
   it is the SAME compact explorer the Layer-3 "Explore" tab renders,
   reading the SAME state (useFacilityPlayground → the interaction
   reducer), so picking a plant here, there, or in the full-width
   Facilities workspace always lands on one picture. The full workspace
   stays — a network past one hop has nowhere to go in a profile column.
   ==================================================================== */

export default function CompanyFacilities({ companyId, setSel, model }) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const { fac, facFocus, setViewMode } = useFacilityPlayground();

  /* Ranked the way the map ranks them: by modeled site weight, so the
     plant that carries most of the company's modeled participation is
     the one a reader meets first. */
  const plants = useMemo(() => {
    const list = FACILITY_LAYER?.FACILITIES_BY_COMPANY?.[companyId] || [];
    return [...list].sort((a, b) => (siteWeight(b) ?? 0) - (siteWeight(a) ?? 0));
  }, [FACILITY_LAYER, companyId]);

  if (!plants.length) {
    return (
      <p style={{ fontSize: 12.5, color: C.faint, fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
        No plant in the facility register is attributed to this company. An absence from the register, not of
        production — the register covers named, located sites only.
      </p>
    );
  }

  const ofThisCompany = fac.focusId
    && plants.some((p) => p.id === fac.focusId);

  return (
    <div>
      <p className="mono" style={{ fontSize: 12, color: C.faint, margin: '0 0 7px', lineHeight: 1.55 }}>
        {`${plants.length} plant${plants.length === 1 ? '' : 's'} in the facility register. Pick one to trace the modeled
        network around it — modeled stage-mediated relationships, never a confirmed shipment or contract.`}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {plants.map((f) => {
          const on = fac.focusId === f.id;
          /* `degree` is the COUNT of modeled links; inbound/outbound on
             the same object are summed weights, which is a different
             number and must never be labelled "links". */
          const links = facilityConnectivity(FACILITY_NETWORK, f.id).degree;
          return (
            <button key={f.id} type="button" onClick={() => facFocus(f.id, { asRoot: true })} aria-pressed={on}
              title={(f.stages || []).map((s) => STAGE_BY_ID[s]?.name || s).join(' · ')}
              style={{
                background: on ? C.panel2 : 'transparent',
                border: `1px solid ${on ? C.copper : C.line}`, borderRadius: 4,
                color: on ? C.text : C.dim, fontSize: 12, padding: '5px 9px', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit',
              }}>
              <span>{flagEmoji(f.country)} {f.name}</span>
              <span style={{ color: C.faint }}>
                {` · ${FACILITY_KIND_LABEL[f.kind] || f.kind}`}
                {` · ${COUNTRY_NAMES[f.country] || f.country}`}
                {Number.isFinite(links) ? ` · ${links} modeled links` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {!fac.focusId && (
        <p style={{ fontSize: 12.5, color: C.faint, fontStyle: 'italic', margin: 0 }}>
          Pick a plant above to open its modeled network here.
        </p>
      )}

      {fac.focusId && (
        <>
          {!ofThisCompany && (
            <p className="mono" style={{ fontSize: 12, color: C.amber, margin: '0 0 7px', lineHeight: 1.55 }}>
              The explorer below is centred on a plant that does not belong to this company — you walked there through
              the network. Pick one of the plants above to come back.
            </p>
          )}
          <FacilityExplorer setSel={setSel} model={model} />
          <div style={{ marginTop: 8 }}>
            <Button variant="quiet" size="sm" onClick={() => setViewMode('playground')}>
              Open this network at full width
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
