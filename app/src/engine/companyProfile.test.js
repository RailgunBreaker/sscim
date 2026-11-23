import { describe, it, expect } from 'vitest';
import {
  companyProfile, companyControl, controlSentence, documentedChain,
  controlCoverage, documentedCoverage, CONTROL_TYPES, PASSIVE_MANAGERS, publicCompanyProfile,
  publicCompanyName,
} from './companyProfile.js';
import COMPANY_CONTROL from '../data/companyControl.json';
import snapshot from '../data/vault-snapshot.json';
import publicNetwork from '../data/publicSupplierTiers.json';

const COMPANIES = snapshot.companies;
const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));
const COUNTRY_NAMES = snapshot.countryNames || {};
const STAGE_BY_ID = Object.fromEntries((snapshot.stages || []).map((s) => [s.id, s]));
const CUSTOMERS = snapshot.customers || {};
const SUPPLIERS = (() => {
  const out = {};
  for (const [s, rows] of Object.entries(CUSTOMERS)) for (const [c, r] of rows) (out[c] ||= []).push([s, r]);
  return out;
})();
const ctx = { COMPANY_BY_ID, COUNTRY_NAMES, STAGE_BY_ID, CUSTOMERS, SUPPLIERS, COMPANY_RANK: [] };

describe('profiles for every chain company, with a fixed tracked set', () => {
  it('provides the standard profile fields for every public-network company', () => {
    for (const id of Object.keys(publicNetwork.companies)) {
      const profile = publicCompanyProfile(id, ctx);
      expect(profile.name).toBeTruthy();
      expect(profile.intro).toBeTruthy();
      for (const field of ['facts', 'stageRoles', 'caveats', 'sourceIds']) expect(Array.isArray(profile[field])).toBe(true);
      expect(profile.documented.suppliers.every(e => e.customer === id)).toBe(true);
      expect(profile.documented.customers.every(e => e.supplier === id)).toBe(true);
    }
  });
  it('allows tracking only existing system identities', () => {
    const profiles = Object.keys(publicNetwork.companies).map(id => publicCompanyProfile(id, ctx));
    const trackable = [...new Set(profiles.filter(p => p.tracked).map(p => p.modeledCompanyId))].sort();
    expect(trackable).toEqual(COMPANIES.map(c => c.id).sort());
    for (const p of profiles.filter(p => !p.tracked)) {
      expect(p.modeledCompanyId).toBeNull();
      expect(p.stageRoles).toEqual([]);
      expect(p.control).toBeNull();
    }
  });
  it('does not assign Siltronic control or modeled shares to its Wacker supplier', () => {
    const p = publicCompanyProfile('wacker-chemie-ag', ctx);
    expect(p.tracked).toBe(false);
    expect(p.control).toBeNull();
    expect(p.documented.customers.some(e => e.customer === 'system-siltronic')).toBe(true);
    expect(p.facts.find(([k]) => k === 'Criticality rank')[1]).toBe('Not ranked');
  });
  it('keeps the established NVIDIA profile and control record', () => {
    const p = publicCompanyProfile('system-nvidia', ctx);
    expect(p.tracked).toBe(true);
    expect(p.control).toEqual(companyControl('nvidia'));
    expect(p.stageRoles.length).toBeGreaterThan(0);
  });
});

describe('control is recorded for every company', () => {
  it('covers all of them, with no gaps', () => {
    const missing = COMPANIES.filter((c) => !companyControl(c.id));
    expect(missing.map((c) => c.id)).toEqual([]);
    expect(Object.keys(COMPANY_CONTROL.control).length).toBe(COMPANIES.length);
  });

  it('uses only declared control types', () => {
    for (const [id, ctl] of Object.entries(COMPANY_CONTROL.control)) {
      expect(CONTROL_TYPES[ctl.type], `${id} has type ${ctl.type}`).toBeTruthy();
    }
  });

  it('gives every entry a basis and an evidence tier', () => {
    for (const [id, ctl] of Object.entries(COMPANY_CONTROL.control)) {
      expect(ctl.basis, `${id} has no basis`).toBeTruthy();
      expect(['A', 'B', 'C', 'D'], `${id} tier ${ctl.tier}`).toContain(ctl.tier);
    }
  });

  it('flags every tier-D entry as low confidence, and no other', () => {
    for (const [id, ctl] of Object.entries(COMPANY_CONTROL.control)) {
      expect(ctl.confidence === 'low', id).toBe(ctl.tier === 'D');
    }
  });
});

describe('the distinction the dataset exists to make', () => {
  /* The whole point: a passive index manager is a custodian of other
     people's money, not a controller of the business. If one is ever
     recorded as a controller, the dataset has become the thing it
     replaced. */
  it('never names a passive index manager as a controller', () => {
    for (const [id, ctl] of Object.entries(COMPANY_CONTROL.control)) {
      if (!ctl.controller) continue;
      for (const passive of PASSIVE_MANAGERS) {
        expect(ctl.controller.includes(passive), `${id} names ${passive} as controller`).toBe(false);
      }
    }
  });

  it('names no controller at all where the company is widely held', () => {
    for (const [id, ctl] of Object.entries(COMPANY_CONTROL.control)) {
      if (ctl.type !== 'widely_held') continue;
      expect(ctl.controller, id).toBeNull();
      expect(ctl.stake, id).toBeNull();
    }
  });

  it('names a controller for every type that claims one', () => {
    for (const [id, ctl] of Object.entries(COMPANY_CONTROL.control)) {
      if (ctl.type === 'widely_held' || ctl.type === 'unestablished') continue;
      expect(ctl.controller, `${id} is ${ctl.type} with no controller`).toBeTruthy();
    }
  });

  it('says "no controlling shareholder" out loud rather than leaving a blank', () => {
    const s = controlSentence('micron', ctx);
    expect(s).toMatch(/no controlling shareholder/i);
    expect(s).toMatch(/custodians, not controllers/i);
  });

  it('states the mechanism for control that does not run through a majority', () => {
    expect(controlSentence('meta', ctx)).toMatch(/Class B/);
    expect(controlSentence('bosch', ctx)).toMatch(/foundation|Stiftung/i);
    expect(controlSentence('alibaba', ctx)).toMatch(/Partnership/);
    expect(controlSentence('st', ctx)).toMatch(/French and Italian/);
  });

  it('records the firms that disclose having no actual controller', () => {
    /* AMEC discloses this in its own filings. Recording it as "widely
       held" rather than inventing a state owner is the honest reading of
       a Chinese equipment maker that says it has none. */
    expect(companyControl('amec').type).toBe('widely_held');
    expect(companyControl('amec').basis).toMatch(/no actual controller/i);
  });

  it('does not let a founder stake that has fallen below control read as control', () => {
    /* Foxconn is widely described as founder-controlled; on the current
       register it is not, and the dataset follows the register. */
    expect(companyControl('foxconn').type).toBe('widely_held');
  });
});

describe('state control is identified where it exists', () => {
  it('finds the clear sovereign and state cases', () => {
    expect(companyControl('gf').type).toBe('state');          // Mubadala
    expect(companyControl('st').type).toBe('state');           // France + Italy
    expect(companyControl('jsr').type).toBe('state');          // JIC
    expect(companyControl('smic').type).toBe('state');
  });

  it('does not call a company state-controlled for holding a government stake short of control', () => {
    /* Intel's largest single holder is the U.S. government at ~9.9%.
       That is an anchor stake, not control, and the difference matters. */
    expect(companyControl('intel').type).toBe('widely_held');
    expect(companyControl('intel').basis).toMatch(/9\.9|government/i);
    expect(companyControl('tsmc').type).toBe('widely_held');
  });
});

describe('the generated profile', () => {
  const profiles = COMPANIES.map((c) => companyProfile(c, ctx));

  it('produces one for every company, with no stub', () => {
    expect(profiles.length).toBe(COMPANIES.length);
    for (const p of profiles) {
      expect(p.headline.length, p.id).toBeGreaterThan(8);
      expect(p.intro.length, p.id).toBeGreaterThan(80);
      expect(p.caveats.length, p.id).toBeGreaterThan(0);
    }
  });

  it('gives every profile the same fact rows in the same order', () => {
    const keys = profiles[0].facts.map(([k]) => k);
    for (const p of profiles) expect(p.facts.map(([k]) => k), p.id).toEqual(keys);
  });

  it('writes an em dash rather than dropping a row it cannot fill', () => {
    const widely = companyProfile(COMPANY_BY_ID.micron, ctx);
    const row = widely.facts.find(([k]) => k === 'Controlling stake');
    expect(row[1]).toBe('—');
  });

  it('never leaves a company without a control line in its intro', () => {
    for (const p of profiles) {
      expect(p.intro, p.id).toMatch(/controlled by|no controlling shareholder|could not establish|division|institute/i);
    }
  });

  it('states the chain twice and never merges the two readings', () => {
    const p = companyProfile(COMPANY_BY_ID.tsmc, ctx);
    expect(p.intro).toMatch(/The model gives it/);
    expect(p.intro).toMatch(/named in a public document/);
  });

  it('says plainly when a company has no modeled chain edge at all', () => {
    const p = companyProfile(COMPANY_BY_ID.kioxia, ctx);
    expect(p.intro).toMatch(/no supplier or customer edge/);
    expect(p.caveats.join(' ')).toMatch(/coverage gap|no modeled chain edge/i);
  });

  it('carries the passive-holder caveat on every widely-held company', () => {
    for (const p of profiles) {
      if (p.control?.type !== 'widely_held') continue;
      expect(p.caveats.join(' '), p.id).toMatch(/custodians rather than controllers/);
    }
  });
});

describe('the documented chain crosswalk', () => {
  it('links the modeled company to the public dataset where they are the same firm', () => {
    const doc = documentedChain('tsmc');
    expect(doc.covered).toBe(true);
    expect(doc.suppliers.length).toBeGreaterThan(10);
    expect(doc.customers.length).toBeGreaterThan(0);
  });

  it('reports no coverage, rather than an empty list, where nothing names the firm', () => {
    const doc = documentedChain('cambricon');
    expect(doc.covered).toBe(false);
    expect(doc.suppliers).toEqual([]);
  });

  it('keeps Nanya Technology and Nan Ya PCB apart', () => {
    /* One makes DRAM, the other makes substrates. They share a group
       name and nothing else, and mapping them together would invent
       relationships for a firm that was never named.

       Nanya Technology now HAS a documented chain — ChipMOS names it
       among its top customers — so this no longer tests for absence.
       It tests the thing that actually matters: that the chain it has
       is its own. Nan Ya Printed Circuit Board is named as a substrate
       supplier to ASE in ASE's 20-F, and that relationship must never
       appear on the DRAM maker's profile. */
    const doc = documentedChain('nanya');
    const related = [...doc.suppliers, ...doc.customers];
    expect(related.length, 'ChipMOS names Nanya Technology, so it has a chain').toBeGreaterThan(0);

    const names = related.flatMap((e) => [publicCompanyName(e.supplier), publicCompanyName(e.customer)]);
    for (const n of names) {
      expect(n, 'Nan Ya PCB must not appear anywhere on Nanya Technology').not.toMatch(/Printed Circuit/i);
    }
    /* Nan Ya PCB's one documented relationship is as a substrate
       supplier to ASE. If the two firms were ever merged into one node,
       ASE would surface here. */
    expect(names.some((n) => /Advanced Semiconductor Engineering|ASE Technology/i.test(n))).toBe(false);
  });

  it('carries a source for every documented relationship it returns', () => {
    const doc = documentedChain('intel');
    for (const e of [...doc.suppliers, ...doc.customers]) {
      expect(e.sources.length).toBeGreaterThan(0);
    }
  });
});

describe('coverage is reported, not implied', () => {
  it('counts control by type across all companies', () => {
    const cov = controlCoverage(COMPANIES);
    expect(cov.total).toBe(COMPANIES.length);
    expect(Object.values(cov.byType).reduce((a, b) => a + b, 0)).toBe(COMPANIES.length);
    expect(cov.byType.missing).toBeUndefined();
  });

  it('counts how many companies the public record reaches, and it is a minority', () => {
    const cov = documentedCoverage(COMPANIES);
    expect(cov.covered).toBeGreaterThan(30);
    expect(cov.covered).toBeLessThan(cov.total);
  });
});
