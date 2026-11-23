#!/usr/bin/env node
/* ====================================================================
   Who actually controls each of the 109 modeled companies.

   THE DISTINCTION THIS DATASET EXISTS TO MAKE.

   The vault already carried a `OWNERS` table: the largest disclosed
   shareholders, for 27 of 109 companies. For most large listed firms
   that table says "Vanguard 9%, BlackRock 8%, State Street 4%", and a
   reader scanning it concludes that BlackRock controls Micron. It does
   not. Those are passive index managers holding shares on behalf of
   fund investors; they do not direct strategy, cannot appoint
   management at will, and in most cases vote with the board.

   Meanwhile the firms that genuinely ARE controlled — by a state, a
   parent, a founder with a special share class, a foundation — were
   mostly absent from that table, because control there is not expressed
   as a big line in a 13F.

   So this dataset records CONTROL, not size of holding:

     · who, if anyone, can actually direct the company
     · through what mechanism
     · and, where the answer is "nobody", it says so explicitly rather
       than naming the largest passive holder and letting the reader
       draw the wrong conclusion.

   "Actual controller" is not a loose phrase. In Chinese listed-company
   disclosure it is a defined term (实际控制人) that issuers must state,
   and several entries here quote that disclosure directly — including
   the ones that disclose they have NO actual controller.

   EVIDENCE TIERS follow the repository convention:
     C  structural fact from an official filing or company disclosure —
        a subsidiary relationship, a share class, a published stake
     B  institutional or press reporting of a stake or a transaction
     D  analyst judgement where control is genuinely contestable

   `confidence: 'low'` marks entries where the mechanism is real but the
   current holder or percentage may have moved; the note says why.

   This dataset is REFERENCE ONLY. It feeds no score, no index and no
   propagation. It exists so a reader can ask "and who owns this" and
   get an answer that distinguishes a custodian from a controller.

   Run:  node company-control/author-control.mjs
   ==================================================================== */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANIES } from "../server/src/seed-data.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ---------------------------------------------------------------- *
 * The control types. Each is a different ANSWER to "who decides",
 * not a different size of shareholding.
 * ---------------------------------------------------------------- */
const TYPES = {
  parent: {
    label: "Subsidiary",
    short: "parent",
    meaning: "Majority- or wholly-owned by another company, which decides.",
  },
  state: {
    label: "State-controlled",
    short: "state",
    meaning:
      "A government, sovereign fund or state investment vehicle holds control or a decisive bloc.",
  },
  founder: {
    label: "Founder or family controlled",
    short: "founder",
    meaning:
      "A founder, family or their holding vehicles exercise control, whether or not they hold a majority of the economics.",
  },
  dual_class: {
    label: "Dual-class voting control",
    short: "dual class",
    meaning:
      "Voting power is detached from economic ownership by a special share class, so a small economic stake controls the company.",
  },
  foundation: {
    label: "Foundation-controlled",
    short: "foundation",
    meaning: "A charitable or industrial foundation holds the capital, with voting exercised separately.",
  },
  consortium: {
    label: "Consortium-controlled",
    short: "consortium",
    meaning: "Control is held jointly by a defined group of investors under an agreement.",
  },
  strategic: {
    label: "Strategic blockholder",
    short: "strategic",
    meaning:
      "A corporate holder with a large, non-passive stake short of a majority — influential, and not a custodian.",
  },
  partnership: {
    label: "Partnership board control",
    short: "partnership",
    meaning: "A defined partnership body nominates a majority of the board regardless of shareholding.",
  },
  institute: {
    label: "Public research institute",
    short: "institute",
    meaning: "Not an investor-owned company: a public or non-profit research organisation.",
  },
  division: {
    label: "Division, not a company",
    short: "division",
    meaning: "Not a separate legal entity in its own right — a unit of its parent.",
  },
  widely_held: {
    label: "No controller — widely held",
    short: "widely held",
    meaning:
      "No shareholder controls it. The largest holders are passive index managers, which are custodians of other people's money, not directors of the business.",
  },
  unestablished: {
    label: "Control not established here",
    short: "not established",
    meaning: "This dataset could not establish control from a public source it was willing to cite.",
  },
};

/* Who the big passive holders are, so the interface can say plainly why
   they are not listed as controllers. */
const PASSIVE_MANAGERS = [
  "Vanguard", "BlackRock", "State Street", "Fidelity (FMR)", "Capital Group",
  "Geode", "Norges Bank", "Baillie Gifford", "Nomura AM",
  "Master Trust Bank of Japan (nominee)", "Custody Bank of Japan (nominee)",
];

/* ---------------------------------------------------------------- *
 * The table. id: [type, controller, stake|null, basis, tier, note?]
 * `stake` is the controller's holding where a figure is meaningful;
 * null where control does not run through a percentage.
 * ---------------------------------------------------------------- */
const CONTROL = {
  /* ---------- research and IP ---------- */
  arm: ["parent", "SoftBank Group", 0.88,
    "SoftBank retained the large majority of Arm after the September 2023 IPO floated a small minority.", "C"],
  imec: ["institute", "imec (an independent non-profit research institute, Flanders)", null,
    "A Flemish public research institute funded by government and an industry affiliate programme — it has no controlling shareholder because it has no shareholders in the ordinary sense.", "C"],
  ibm_res: ["division", "IBM", null,
    "IBM Research is a division of IBM, not a separate company. It has no ownership of its own.", "C"],
  leti: ["institute", "CEA (French Alternative Energies and Atomic Energy Commission)", null,
    "CEA-Leti is an institute of the CEA, a French state research body.", "C"],

  /* ---------- EDA ---------- */
  synopsys: ["widely_held", null, null,
    "No controlling shareholder. The largest holders are passive index managers.", "B"],
  cadence: ["widely_held", null, null,
    "No controlling shareholder. The largest holders are passive index managers.", "B"],
  siemens_eda: ["division", "Siemens AG", null,
    "Siemens EDA is the former Mentor Graphics, operating inside Siemens Digital Industries Software. It is a business unit, not an independent company.", "C"],
  ansys: ["parent", "Synopsys", 1.0,
    "Synopsys completed its acquisition of Ansys in 2025; Ansys no longer reports independently.", "C"],
  empyrean: ["state", "China Electronics Corporation (central state-owned group)", null,
    "Empyrean's disclosed controlling chain runs to CEC, a centrally administered state-owned enterprise.", "B",
    "The intermediate holding entities have changed with successive restructurings; the state root is the stable part."],

  /* ---------- chip design ---------- */
  nvidia: ["widely_held", null, null,
    "No controlling shareholder. The founder-CEO holds a low single-digit stake, which is influence, not control.", "B"],
  amd: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  qualcomm: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  apple: ["widely_held", null, null,
    "No controlling shareholder. Berkshire Hathaway's position is large in money terms and small in percentage, and is not a control stake.", "B"],
  mediatek: ["widely_held", null, null,
    "No controlling shareholder; founders retain influence through board representation rather than a控制 bloc.", "D",
    "Founder influence is real but not expressible as a control stake, so it is not recorded as one."],
  hisilicon: ["parent", "Huawei Technologies", 1.0,
    "A wholly-owned fabless design subsidiary of Huawei. The U.S. Entity List rule of August 2020 names it among Huawei's affiliates.", "C"],
  broadcom: ["widely_held", null, null,
    "No controlling shareholder. Leadership influence is strong and is not an ownership stake.", "B"],
  marvell: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  unisoc: ["consortium", "the post-restructuring Tsinghua Unigroup consortium (JAC Capital / Wise Road Capital)", null,
    "UNISOC sits under Tsinghua Unigroup, whose 2022 court-supervised restructuring transferred control to an investor consortium.", "B",
    "The consortium's internal split is not fully public; the fact of consortium control is."],
  cambricon: ["founder", "Chen Tianshi (founder)", null,
    "Disclosed in its A-share filings as the actual controller (实际控制人).", "B"],
  biren: ["unestablished", null, null,
    "A private, venture-funded company. Its shareholder register is not public in enough detail to name a controller.", "D",
    "Named here as unestablished rather than guessed."],

  /* ---------- silicon wafers ---------- */
  shinetsu: ["widely_held", null, null, "No controlling shareholder; largest holders are institutions and nominee trusts.", "B"],
  sumco: ["widely_held", null, null,
    "No controlling shareholder. Its founding parents, Sumitomo Metal Industries and Mitsubishi Materials, reduced their stakes after listing.", "B"],
  globalwafers: ["parent", "Sino-American Silicon Products (SAS)", 0.5,
    "GlobalWafers was spun out of SAS, which retains roughly half the shares and board control.", "C"],
  sksiltron: ["parent", "SK Inc. (SK Group)", 0.51,
    "SK Inc. holds a controlling stake; SK Siltron is a member company of the SK chaebol.", "C"],
  siltronic: ["strategic", "Wacker Chemie AG", 0.308,
    "Wacker holds roughly 30.8% — short of a majority, but the decisive bloc, and Siltronic was carved out of Wacker.", "C"],
  nsig: ["state", "Shanghai state investment vehicles with the China National IC Industry Investment Fund", null,
    "National Silicon Industry Group is a Shanghai state-sponsored consolidation of China's wafer industry.", "B"],

  /* ---------- photoresist and wet chemicals ---------- */
  jsr: ["state", "Japan Investment Corporation (JIC), a government-backed fund", 0.84,
    "JIC's vehicle JICC-02 completed a tender offer for about 84% of JSR in April 2024, taking it private. An explicitly industrial-policy acquisition of a photoresist leader.", "C"],
  tok: ["widely_held", null, null, "No controlling shareholder; largest holders are institutions and nominee trusts.", "B"],
  sumitomo_chem: ["widely_held", null, null,
    "No controlling shareholder. Sumitomo group affiliation is a keiretsu relationship, not a control stake.", "B"],
  dupont: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  resonac: ["widely_held", null, null, "No controlling shareholder. Formerly Showa Denko.", "B"],

  /* ---------- gases ---------- */
  linde: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  airliquide: ["widely_held", null, null,
    "No controlling shareholder; a notably dispersed register including a large retail shareholder base.", "B"],
  tnsc: ["parent", "Mitsubishi Chemical Group", 0.506,
    "Nippon Sanso Holdings, the parent of Taiyo Nippon Sanso, is majority-held by Mitsubishi Chemical Group.", "C"],
  airproducts: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  skmaterials: ["parent", "SK Inc. (SK Group)", null,
    "SK Materials was merged into SK Inc. in 2021 and operates as part of the SK group's materials arm.", "C"],
  entegris: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],

  /* ---------- substrates ---------- */
  ibiden: ["widely_held", null, null, "No controlling shareholder; largest holders are institutions and nominee trusts.", "B"],
  unimicron: ["strategic", "United Microelectronics (UMC) group affiliates", null,
    "Unimicron was founded out of the UMC group, whose affiliates remain among the largest identified holders.", "D",
    "The current aggregate affiliate holding is not clearly disclosed; recorded as a strategic bloc rather than control."],
  shinko: ["consortium", "a Japan Investment Corporation-led consortium (JIC 80%, Dai Nippon Printing 15%, Mitsui Chemicals 5%)", 0.8,
    "Acquired from Fujitsu by the JIC-led consortium; the tender offer completed and the company delisted in 2025.", "C"],
  samsungem: ["strategic", "Samsung Electronics and the wider Samsung Group (Lee family)", 0.237,
    "Samsung Electronics holds roughly 23.7% of Samsung Electro-Mechanics, inside the Lee family's group structure.", "C"],
  ats: ["founder", "the Androsch and Dörflinger private foundations, acting under a syndicate agreement", 0.4,
    "Two Austrian private foundations hold roughly 40% jointly and syndicate their votes.", "C",
    "The model files AT&S under Germany; the company is Austrian."],

  /* ---------- lithography and equipment ---------- */
  asml: ["widely_held", null, null,
    "No controlling shareholder. Dutch law and ASML's own structure leave no blockholder; its export exposure is to state policy, not state ownership.", "B"],
  nikon: ["widely_held", null, null, "No controlling shareholder; largest holders are institutions and nominee trusts.", "B"],
  canon: ["widely_held", null, null, "No controlling shareholder; largest holders are institutions and nominee trusts.", "B"],
  amat: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  tel: ["widely_held", null, null,
    "No controlling shareholder. Its two largest lines are Japanese nominee trust banks, which are custodial accounts rather than beneficial owners.", "C"],
  lam: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  kla: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  asmi: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  kokusai: ["strategic", "KKR", null,
    "KKR bought Kokusai Electric from Hitachi, listed it in 2023 and has been selling down a large residual stake.", "B",
    "The residual percentage moves with each sell-down, so no figure is recorded."],
  naura: ["state", "Beijing Electronics Holding (a Beijing municipal state-owned enterprise)", null,
    "NAURA's disclosed actual controller chain runs to the Beijing municipal state assets administration.", "B"],
  amec: ["widely_held", null, null,
    "AMEC states in its own A-share disclosure that it has NO controlling shareholder and NO actual controller (无实际控制人) — an unusual and deliberate structure for a Chinese equipment maker.", "C"],
  hitachiht: ["parent", "Hitachi, Ltd.", 1.0,
    "Hitachi High-Tech was taken fully private by Hitachi in 2020 and is a wholly-owned subsidiary.", "C"],
  ebara: ["widely_held", null, null, "No controlling shareholder; largest holders are institutions and nominee trusts.", "B"],
  onto: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  nova: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],

  /* ---------- foundry and IDM ---------- */
  tsmc: ["widely_held", null, null,
    "No controlling shareholder. Taiwan's National Development Fund is the largest single holder at roughly 6.4% — a government anchor stake that does not amount to control.", "C"],
  samsung: ["founder", "the Lee family, through Samsung Group affiliate cross-holdings", null,
    "Control runs through a web of affiliate holdings (notably Samsung Life and Samsung C&T) rather than a direct majority.", "C"],
  intel: ["widely_held", null, null,
    "No controlling shareholder. The U.S. government took roughly 9.9% in 2025 by converting CHIPS Act funding into common equity — the largest single holder, and still not control.", "C"],
  rapidus: ["consortium", "the Japanese government (NEDO) with a 32-company industrial consortium", null,
    "Built as a national project: state funding with a golden-share arrangement alongside Toyota, Sony, SoftBank, Kioxia, NTT, NEC, MUFG and others.", "C"],
  smic: ["state", "Chinese state investment vehicles acting together (China IC Big Fund, Datang Telecom, Shanghai IC Fund)", null,
    "SMIC discloses no single controlling shareholder; its largest holders are state vehicles whose combined bloc is decisive.", "C",
    "Recorded as state-controlled on the combined bloc, with the no-single-controller disclosure stated alongside."],
  umc: ["widely_held", null, null, "No controlling shareholder; a dispersed register typical of older Taiwanese listings.", "B"],
  gf: ["state", "Mubadala Investment Company (Abu Dhabi sovereign wealth fund)", 0.8,
    "Mubadala has been GlobalFoundries' majority owner since before the 2021 IPO and remains so after it.", "C"],
  ti: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  infineon: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  st: ["state", "the French and Italian governments jointly, through ST Holding N.V.", 0.275,
    "A shareholders' agreement between the two states gives joint control of roughly 27.5% of the capital. One of the few chip firms under explicit dual-state control.", "C"],
  tower: ["widely_held", null, null,
    "No controlling shareholder. Intel's agreed acquisition was abandoned in 2023, leaving Tower independent and dispersed.", "B"],
  skhynix: ["parent", "SK Square, within the SK Group (Chey family)", 0.205,
    "SK Square holds about 20.5%, which is the controlling bloc inside Korea's chaebol holding structure.", "C"],
  micron: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  ymtc: ["state", "Hubei provincial state vehicles with the China IC Big Fund", null,
    "Yangtze Memory is a provincial-state project, funded through Hubei development vehicles and the national fund.", "B"],
  cxmt: ["state", "Hefei municipal state investment vehicles", null,
    "ChangXin Memory was built as a Hefei municipal project and remains state-anchored.", "B"],
  kioxia: ["consortium", "a Bain Capital-led consortium, with Toshiba as the second holder", 0.51,
    "Bain retained roughly half and Toshiba roughly a third after the December 2024 IPO; SK hynix is reported as the third-largest holder.", "B",
    "Reported post-IPO percentages differ between sources, and one report of a full Bain exit could not be confirmed. Treat the figure as approximate."],
  huahong: ["state", "Shanghai Hua Hong (Group), a Shanghai state-owned enterprise", null,
    "Hua Hong Semiconductor's controlling chain runs to the Shanghai state assets administration.", "B"],
  vis: ["strategic", "TSMC", 0.28,
    "TSMC holds roughly 28% of Vanguard International Semiconductor, its largest shareholder, and the two have a long-standing operational relationship.", "C"],
  nexchip: ["state", "Hefei municipal state capital vehicles", null,
    "Nexchip was established as a Hefei municipal joint venture and remains state-anchored.", "B"],
  sonysemi: ["parent", "Sony Group", 1.0,
    "Sony Semiconductor Solutions is a wholly-owned subsidiary of Sony Group.", "C"],
  renesas: ["widely_held", null, null,
    "No controlling shareholder following the INCJ sell-down. Denso and Toyota retain strategic stakes well short of control.", "B",
    "Control here moved materially over the last decade; the current state is dispersed."],
  bosch: ["foundation", "Robert Bosch Stiftung, with voting exercised by Robert Bosch Industrietreuhand KG", 0.92,
    "The foundation holds about 92% of the capital while the voting rights sit with an industrial trust — capital and control deliberately separated, and the reason Bosch answers to no public market.", "C"],
  nanya: ["strategic", "Formosa Plastics Group", null,
    "Nanya Technology is a Formosa Plastics group company; group entities hold the decisive bloc.", "C"],
  winbond: ["founder", "the Jiao family through Walsin Lihwa and affiliates", null,
    "Winbond sits inside the Walsin group, controlled by the founding family.", "B"],

  /* ---------- packaging and test ---------- */
  ase: ["founder", "the Chang family (founder Jason Chang and affiliates)", null,
    "ASE Technology Holding is founder-controlled through family and affiliate holdings rather than a single majority line.", "B"],
  amkor: ["founder", "the Kim family (founder James Kim and family trusts)", 0.5,
    "The founding family holds about half the shares, which is outright control of a listed OSAT.", "C"],
  jcet: ["state", "the China IC Big Fund and state-linked holders", null,
    "The national fund has been JCET's largest shareholder; the disclosed controller has changed with successive transfers between state-linked vehicles.", "D",
    "Flagged low confidence: the controlling entity has moved more than once and the current disclosure was not verified here."],
  spil: ["parent", "ASE Technology Holding", 1.0,
    "SPIL has been a wholly-owned ASE subsidiary since 2018; its output is consolidated into ASE's accounts.", "C"],
  pti: ["founder", "the founding management group (D.K. Tsai and affiliates)", null,
    "Powertech is founder-led with management and affiliate holdings forming the largest bloc.", "D",
    "Flagged low confidence: no single disclosed controlling shareholder was verified here."],
  utac: ["parent", "Wise Road Capital", null,
    "UTAC Holdings was acquired by Wise Road Capital in 2020 and is privately held by it.", "B"],
  kyec: ["widely_held", null, null,
    "No controlling shareholder identified; a dispersed Taiwanese register.", "D",
    "Flagged low confidence: dispersed registers are easy to mistake for an absence of research."],
  inari: ["strategic", "Insas Berhad", 0.2,
    "Insas Berhad holds roughly a fifth of Inari Amertron and is its anchor shareholder.", "B"],

  /* ---------- systems and assembly ---------- */
  foxconn: ["widely_held", null, null,
    "No controlling shareholder any longer. The founder's family stake has fallen to mid-single digits, and family holding companies disclosed disposing of their remaining Hon Hai shares in December 2025.", "B",
    "Foxconn is widely read as founder-controlled; on the current register it is not."],
  quanta: ["founder", "Barry Lam (co-founder and chairman) with affiliated holdings", null,
    "Founder-led, with the chairman's holdings forming the largest identified bloc.", "B"],
  wistron: ["founder", "the founding management group", null,
    "Spun out of Acer and run by its founding management; no single majority holder.", "D",
    "Flagged low confidence: recorded as founder-led influence rather than verified control."],
  supermicro: ["founder", "Charles Liang (co-founder and CEO) with family holdings", null,
    "The founder-CEO holds the largest single block, well short of a majority but decisive in practice.", "B"],
  luxshare: ["founder", "Wang Laichun and Wang Laisheng, through Luxshare Limited", null,
    "Disclosed in Luxshare's A-share filings as the actual controllers (实际控制人).", "C"],

  /* ---------- end markets ---------- */
  google: ["dual_class", "Larry Page and Sergey Brin, through Class B super-voting shares", null,
    "The founders hold roughly a majority of voting power on a far smaller economic stake — the textbook case of votes detached from ownership.", "C"],
  meta: ["dual_class", "Mark Zuckerberg, through Class B super-voting shares", null,
    "Roughly 61% of voting power on an economic stake near 13%.", "C"],
  microsoft: ["widely_held", null, null,
    "No controlling shareholder. A former CEO is the largest individual holder at a few percent.", "B"],
  amazon: ["widely_held", null, null,
    "No controlling shareholder. The founder remains the largest individual holder at under a tenth, which is influence rather than control.", "B"],
  alibaba: ["partnership", "the Alibaba Partnership", null,
    "The Partnership has the right to nominate a majority of the board, so board control does not follow shareholding. SoftBank and Altaba were historically the largest holders without controlling it.", "C"],
  tesla: ["founder", "Elon Musk", null,
    "The founder-CEO is by far the largest individual holder and exercises decisive influence without a majority.", "B"],
  denso: ["strategic", "the Toyota Group (Toyota Motor and Toyota Industries)", 0.33,
    "Toyota Motor holds roughly a quarter and Toyota Industries a further slice; Denso is a core Toyota group supplier.", "C"],
  vw: ["founder", "Porsche SE (the Porsche and Piëch families), with the State of Lower Saxony holding a statutory blocking minority", 0.53,
    "Porsche SE holds about 53% of voting rights; the VW Law gives Lower Saxony's ~20% a blocking power no ordinary 20% would carry. Family control and state veto in the same company.", "C"],
  xiaomi: ["dual_class", "Lei Jun (founder), through weighted voting rights", null,
    "Xiaomi's dual-class structure under the Hong Kong WVR regime gives the founder voting control on a minority economic stake.", "C"],
  lenovo: ["strategic", "Legend Holdings, in which the Chinese Academy of Sciences holds an indirect stake", null,
    "Legend Holdings is the largest shareholder; the state connection is indirect, through Legend rather than through Lenovo.", "B"],
  hp: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],

  /* ---------- analog, power and the rest ---------- */
  onsemi: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  adi: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
  nxp: ["widely_held", null, null,
    "No controlling shareholder. The private-equity consortium that once owned it exited long ago.", "B"],
  microchip: ["widely_held", null, null, "No controlling shareholder; largest holders are passive index managers.", "B"],
};

/* ================================================================ */

const ids = COMPANIES.map((c) => c.id);
const missing = ids.filter((id) => !CONTROL[id]);
const extra = Object.keys(CONTROL).filter((id) => !ids.includes(id));

if (missing.length) {
  console.error(`Missing control for ${missing.length} of ${ids.length} companies:`);
  for (const id of missing) console.error("  -", id);
}
if (extra.length) {
  console.error(`Control recorded for ${extra.length} unknown id(s): ${extra.join(", ")}`);
}
if (missing.length || extra.length) process.exit(1);

const control = {};
for (const c of COMPANIES) {
  const [type, controller, stake, basis, tier, note] = CONTROL[c.id];
  if (!TYPES[type]) {
    console.error(`${c.id}: unknown control type ${type}`);
    process.exit(1);
  }
  if (type !== "widely_held" && type !== "unestablished" && !controller) {
    console.error(`${c.id}: type ${type} requires a named controller`);
    process.exit(1);
  }
  if ((type === "widely_held" || type === "unestablished") && controller) {
    console.error(`${c.id}: type ${type} must not name a controller`);
    process.exit(1);
  }
  control[c.id] = {
    type,
    controller: controller ?? null,
    stake: stake ?? null,
    basis,
    tier,
    confidence: tier === "D" ? "low" : "stated",
    ...(note ? { note } : {}),
  };
}

const counts = {};
for (const v of Object.values(control)) counts[v.type] = (counts[v.type] ?? 0) + 1;

const payload = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    companies: ids.length,
    rule:
      "Records who can actually direct the company, not who holds the most shares. Passive index managers are never recorded as controllers; where nobody controls the company, that is stated as the finding.",
    passiveManagers: PASSIVE_MANAGERS,
    types: TYPES,
    counts,
    limits: [
      "Control is a point-in-time fact and the most perishable data in this project. Stakes move, consortia sell down, and a company that was state-controlled last year may not be this year.",
      "A percentage is recorded only where control genuinely runs through one. Founder, foundation, partnership and dual-class control often do not, and a missing percentage there is correct rather than absent.",
      "‘Widely held’ is a positive finding, not a gap: it means no shareholder controls the company. It does not mean the research was not done.",
      "Entries at evidence tier D are flagged low confidence. They name a mechanism this dataset believes is real without a filing it was willing to cite for the current holder.",
      "This dataset feeds no score, no index and no propagation. It is reference material.",
    ],
  },
  control,
};

mkdirSync(join(HERE, "data"), { recursive: true });
writeFileSync(join(HERE, "data", "company-control.json"), JSON.stringify(payload, null, 2) + "\n");
writeFileSync(
  join(HERE, "..", "app", "src", "data", "companyControl.json"),
  JSON.stringify(payload, null, 2) + "\n",
);

console.log(`Control recorded for all ${ids.length} companies.`);
for (const [type, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${TYPES[type].label}`);
}
const lowConf = Object.entries(control).filter(([, v]) => v.confidence === "low").map(([id]) => id);
console.log(`\n${lowConf.length} entr${lowConf.length === 1 ? "y" : "ies"} flagged low confidence: ${lowConf.join(", ")}`);
