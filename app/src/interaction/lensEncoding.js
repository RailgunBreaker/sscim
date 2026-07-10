/* ====================================================================
   interaction/lensEncoding.js — turns the active analytical lens + the
   current selection into concrete per-country and per-stage display
   values, plus a legend descriptor, in ONE place so the world map and
   industry graph always agree and every legend reflects the live lens
   (task §4 / §13).

   Pure and dependency-free of React/Leaflet so it can be unit-tested.
   Every value here is derived deterministically from existing snapshot
   fields — no new empirical parameters are invented (§1, §14). Where a
   value is a display-only transform (e.g. a normalized ramp), the raw
   value is preserved in `value` and only `sizeFactor`/`color` are scaled.
   ==================================================================== */
import { C } from '../theme.js';
import { riskColor } from '../utils/colors.js';

/* Signed operational/delta values live roughly in [-1, 1]: positive =
   adverse, negative = mitigating. Never color-only — callers pair this
   with a signed badge and/or ring (§4). */
export function signedColor(v) {
  const a = Math.abs(v);
  if (a < 0.02) return C.faint;
  if (v > 0) return a >= 0.4 ? C.red : C.amber; // adverse
  return C.green; // mitigating
}

export const fmtSigned = (v, dp = 2) => `${v >= 0 ? '+' : ''}${Number(v).toFixed(dp)}`;
export const pct = (v) => `${Math.round(v * 100)}%`;

const shareRampColor = (frac) => (frac >= 0.66 ? C.copper : frac >= 0.33 ? C.copperDim : C.faint);

/* ---- WORLD MAP: one entry per country id ----
   entry = { value, signed, has, color, sizeFactor(0..1), ringFactor(0..1),
             badge, aria } */
export function mapEncoding({ lens, model, engine, selected }) {
  const { countriesActive = {}, countriesBase = {}, countryDelta = {} } = model;
  const ids = Object.keys(countriesActive);
  const enc = {};
  const maxWeight = Math.max(...ids.map((id) => countriesActive[id].weight), 1e-9);
  const weightFactor = (id) => countriesActive[id].weight / maxWeight;

  // SHARE lens, stage selected → each country's share of that stage.
  if (lens === 'share' && selected?.type === 'stage') {
    const stage = engine.STAGE_BY_ID[selected.id];
    const shares = stage?.shares || {};
    const maxShare = Math.max(...Object.values(shares), 1e-9);
    const sum = Object.values(shares).reduce((a, v) => a + v, 0);
    ids.forEach((id) => {
      const share = shares[id] ?? 0;
      enc[id] = {
        value: share, signed: false, has: share > 0,
        color: share > 0 ? shareRampColor(share / maxShare) : C.faint,
        sizeFactor: share > 0 ? 0.28 + 0.72 * (share / maxShare) : 0.1,
        ringFactor: 0,
        badge: share > 0 ? pct(share) : '',
        aria: share > 0 ? `${pct(share)} share of ${stage.name}` : `no modeled share of ${stage.name}`,
      };
    });
    return {
      enc,
      legend: {
        title: `Selected share · ${stage?.name || selected.id}`,
        encoding: 'Marker size + % label = each country’s modeled share of this stage',
        note: sum < 0.999
          ? `Disclosed shares sum to ${pct(sum)} — remainder is unmodeled residual in the static snapshot.`
          : 'Raw modeled shares from the static snapshot.',
      },
    };
  }

  // SHARE lens with a country/company selected → the map just marks the
  // relevant country; the share detail lives on the graph (country→stages)
  // or in the panel. Fall through to a neutral footprint here.
  const shareFallback = lens === 'share';

  ids.forEach((id) => {
    const c = countriesActive[id];
    if (lens === 'operational') {
      const v = c.operational;
      enc[id] = { value: v, signed: true, has: Math.abs(v) > 0.001, color: signedColor(v), sizeFactor: weightFactor(id), ringFactor: Math.min(1, Math.abs(v)), badge: Math.abs(v) > 0.02 ? fmtSigned(v) : '', aria: `operational impact ${fmtSigned(v)}` };
    } else if (lens === 'delta') {
      const v = countryDelta[id] ?? 0;
      enc[id] = { value: v, signed: true, has: Math.abs(v) > 0.001, color: signedColor(v), sizeFactor: weightFactor(id), ringFactor: Math.min(1, Math.abs(v) * 2), badge: Math.abs(v) > 0.02 ? fmtSigned(v) : '', aria: `scenario Δ ${fmtSigned(v)} vs baseline` };
    } else {
      // structural (default) — also the share-with-non-stage-selection fallback
      const v = c.structural;
      enc[id] = { value: v, signed: false, has: true, color: riskColor(v), sizeFactor: weightFactor(id), ringFactor: 0, badge: v.toFixed(1), aria: `structural vulnerability ${v.toFixed(1)} of 10` };
    }
  });

  const legends = {
    structural: { title: 'Structural vulnerability', encoding: 'Color = structural vulnerability (0–10) · marker size = modeled stage participation', note: 'Time-invariant; excludes any event/scenario term.' },
    operational: { title: 'Operational impact', encoding: 'Color/ring = modeled operational impact (signed) · size = participation', note: 'Positive = adverse, negative = mitigating. From active modeled events.' },
    delta: { title: 'Scenario Δ', encoding: 'Color/ring/badge = scenario minus baseline (signed) · size = participation', note: 'Adverse (red/amber) vs mitigating (green). Switch lens for baseline.' },
    share: { title: 'Selected share', encoding: 'Select a stage to size countries by their share of it', note: 'With a country or company selected, share detail shows on the industry graph.' },
  };
  return { enc, legend: shareFallback ? legends.share : legends[lens] || legends.structural };
}

/* ---- INDUSTRY GRAPH: one entry per stage id ----
   entry = { value, signed, has, color, badge, ringFactor(0..1), aria } */
export function graphEncoding({ lens, model, engine, selected, data }) {
  const stageIds = Object.keys(engine.STAGE_BY_ID);
  const enc = {};

  // SHARE lens: encoding depends on what is selected.
  if (lens === 'share') {
    if (selected?.type === 'country') {
      const cid = selected.id;
      stageIds.forEach((sid) => {
        const share = engine.STAGE_BY_ID[sid].shares?.[cid] ?? 0;
        enc[sid] = { value: share, signed: false, has: share > 0, color: share > 0 ? shareRampColor(share) : C.faint, badge: share > 0 ? pct(share) : '', ringFactor: share, aria: share > 0 ? `${pct(share)} of this stage` : 'no modeled share' };
      });
      const cname = data?.COUNTRY_NAMES?.[cid] || cid;
      return { enc, legend: { title: `Selected share · ${cname}`, encoding: `Node ring + % = ${cname}’s modeled share of each stage`, note: 'Raw modeled country shares from the static snapshot.' } };
    }
    if (selected?.type === 'company') {
      const co = data?.COMPANY_BY_ID?.[selected.id];
      const stakes = co?.stakes || {};
      stageIds.forEach((sid) => {
        const share = stakes[sid] ?? 0;
        enc[sid] = { value: share, signed: false, has: share > 0, color: share > 0 ? shareRampColor(share) : C.faint, badge: share > 0 ? pct(share) : '', ringFactor: share, aria: share > 0 ? `${pct(share)} within-stage share` : 'not present in this stage' };
      });
      return { enc, legend: { title: `Selected share · ${co?.name || selected.id}`, encoding: `Node ring + % = ${co?.name || 'company'}’s within-stage share`, note: 'Raw modeled company shares; some stages sum >100% (overlapping sample).' } };
    }
    if (selected?.type === 'stage') {
      stageIds.forEach((sid) => {
        const on = sid === selected.id;
        const v = engine.STRUCTURAL_VULNERABILITY[sid];
        enc[sid] = { value: v, signed: false, has: on, color: on ? C.copper : C.faint, badge: on ? 'selected' : '', ringFactor: on ? 1 : 0, aria: on ? 'selected stage' : '' };
      });
      const sname = engine.STAGE_BY_ID[selected.id]?.name || selected.id;
      return { enc, legend: { title: `Selected share · ${sname}`, encoding: 'Selected stage highlighted; country shares shown on the world map', note: 'Switch the world map to see each country’s share of this stage.' } };
    }
    // share lens with nothing shareable selected → fall back to structural
  }

  stageIds.forEach((sid) => {
    if (lens === 'operational') {
      const v = model.activeField?.[sid] ?? 0;
      enc[sid] = { value: v, signed: true, has: Math.abs(v) > 0.001, color: signedColor(v), badge: Math.abs(v) > 0.02 ? fmtSigned(v) : '', ringFactor: Math.min(1, Math.abs(v)), aria: `operational impact ${fmtSigned(v)}` };
    } else if (lens === 'delta') {
      const v = model.stageDelta?.[sid] ?? 0;
      enc[sid] = { value: v, signed: true, has: Math.abs(v) > 0.001, color: signedColor(v), badge: Math.abs(v) > 0.02 ? fmtSigned(v) : '', ringFactor: Math.min(1, Math.abs(v) * 2), aria: `scenario Δ ${fmtSigned(v)}` };
    } else {
      const v = engine.STRUCTURAL_VULNERABILITY[sid];
      enc[sid] = { value: v, signed: false, has: true, color: riskColor(v), badge: v.toFixed(1), ringFactor: 0, aria: `structural vulnerability ${v.toFixed(1)} of 10` };
    }
  });

  const legends = {
    structural: { title: 'Structural vulnerability', encoding: 'Node color = structural vulnerability (0–10)', note: 'Time-invariant; excludes any event/scenario term.' },
    operational: { title: 'Operational impact', encoding: 'Node color/badge = modeled operational impact (signed)', note: 'Positive = adverse, negative = mitigating.' },
    delta: { title: 'Scenario Δ', encoding: 'Node color/badge = scenario minus baseline (signed)', note: 'Adverse (red/amber) vs mitigating (green).' },
    share: { title: 'Selected share', encoding: 'Select a country or company to shade stages by its share', note: 'Nothing shareable selected — showing structural vulnerability.' },
  };
  return { enc, legend: lens === 'share' ? legends.share : (legends[lens] || legends.structural) };
}
