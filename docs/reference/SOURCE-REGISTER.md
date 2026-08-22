# Source register

*Generated from the vault by `server/scripts/build-source-register.mjs`. Last generated: 2026-08-22.*

Every distinct source behind every event, facility and evidence note in
`server/data/sscim.db`, alphabetised within issuing body.

**On the citation form.** Each entry renders what the vault record actually
carries. Where a record names an institution, an instrument and a date, the
entry reads as a Chicago government or legal citation. Where it names a
corporate disclosure, it reads as a corporate-report citation. Where the
underlying record is thinner than a full Chicago entry — no title, no page —
the entry is thinner too. Nothing here is reconstructed beyond what was
recorded at the time the item was reviewed; inventing an author or a title to
complete the shape of a citation would defeat the purpose of having one.

To trace any entry back to the rows that cite it:

```sql
SELECT id, date_iso, title FROM events WHERE source = '<the source string>';
SELECT id, name  FROM facilities WHERE source LIKE '<publisher>%';
```

## At a glance

| Body | Distinct sources | Events citing them |
| --- | --- | --- |
| Bureau of Industry and Security (US Department of Commerce) | 20 | 20 |
| China — ministries and regulators | 13 | 13 |
| Company disclosures, filings and announcements | 67 | 67 |
| Japan — ministries and agencies | 5 | 5 |
| Netherlands and European Union | 3 | 3 |
| News organisations and trade press | 15 | 15 |
| Other national authorities and courts | 10 | 10 |
| Research and analyst houses | 9 | 9 |
| US federal — other agencies and instruments | 21 | 21 |
| **Total (events)** | **163** | **163** |

Facility records cite **122** distinct publishers across **275** sites. Evidence notes cite **14** further sources.

---

## 1. Event sources

Cited by the dated events in the vault. The bracketed figure is how many
events rest on that source and the span they cover.

### Bureau of Industry and Security (US Department of Commerce)

- BIS advance notice of proposed rulemaking. [1 event; 2018-11-19]
- BIS denial order; ZTE exchange filings. [1 event; 2018-04-16]
- BIS Entity List addition (84 FR 22961). [1 event; 2019-05-16]
- BIS Entity List addition (Dec 18, 2020). [1 event; 2020-12-18]
- BIS Entity List addition; company reporting. [1 event; 2018-10-29]
- BIS Entity List additions (Dec 15, 2022). [1 event; 2022-12-15]
- BIS Entity List additions (Oct 17, 2023). [1 event; 2023-10-17]
- BIS Entity List amendments (Aug 19, 2019). [1 event; 2019-08-19]
- BIS final rule; Congress.gov CRS R48642. [1 event; 2026-01-15]
- BIS final rules 88 FR; NVIDIA 8-K disclosures. [1 event; 2023-10-17]
- BIS interim final rule (Aug 12, 2022). [1 event; 2022-08-12]
- BIS interim final rule (May 15, 2020); TSMC reporting. [1 event; 2020-05-15]
- BIS interim final rule (Sep 29, 2025). [1 event; 2025-09-29]
- BIS interim final rule (Sep 5, 2024). [1 event; 2024-09-05]
- BIS interim final rule 87 FR 62186; CSIS analysis. [1 event; 2022-10-07]
- BIS interim final rule; rescission notice. [1 event; 2025-01-13]
- BIS rescission notice. [1 event; 2025-05-13]
- BIS rule (Aug 17, 2020). [1 event; 2020-08-17]
- BIS rule (Jan 15, 2025). [1 event; 2025-01-15]
- BIS rules 89 FR; CSIS/analyst summaries. [1 event; 2024-12-02]

### China — ministries and regulators

- CAC announcement (May 21, 2023); Micron disclosures. [1 event; 2023-05-21]
- Company exchange filings (Sep 26-30, 2021); provincial notices. [1 event; 2021-09-26]
- MOFCOM announcement (Feb 4, 2025). [1 event; 2025-02-04]
- MOFCOM Announcement No. 23; customs statistics. [1 event; 2023-07-03]
- MOFCOM announcement; automaker disclosures. [1 event; 2025-04-04]
- MOFCOM announcement; Reuters. [1 event; 2024-12-03]
- MOFCOM announcements; Clark Hill / mining-press analysis. [1 event; 2025-10-09]
- MOFCOM listing; FDD analysis (Jun 24, 2026). [1 event; 2026-06-22]
- MOFCOM notices; importer surveys; customs statistics. [1 event; 2026-06-27]
- NDRC statements; Chinese press reporting. [1 event; 2017-12-22]
- Provincial restart orders; supplier disclosures. [1 event; 2020-02-10]
- Qualcomm 8-K; SAMR review record. [1 event; 2018-07-26]
- SAMR announcement (Dec 9, 2024). [1 event; 2024-12-09]

### Company disclosures, filings and announcements

- AMD / Xilinx joint announcement. [1 event; 2020-10-27]
- Apple investor letter (Jan 2, 2019). [1 event; 2019-01-02]
- ASML investor disclosures. [1 event; 2017-10-18]
- ASML Q3 2024 release (Oct 15, 2024). [1 event; 2024-10-15]
- ASML statement (Jan 3, 2022); Q4 2021 disclosure. [1 event; 2022-01-03]
- Commerce authorisations reported Oct 2022. [1 event; 2022-10-10]
- Commerce letter reported Sep 26, 2020; SMIC filings. [1 event; 2020-09-26]
- Commerce notice (Aug 29, 2025); company statements. [1 event; 2025-08-29]
- Commerce notice; Al Jazeera (Jun 1, 2026). [1 event; 2026-06-01]
- Commerce proposed rule (Mar 21, 2023). [1 event; 2023-03-21]
- Company confirmations (Jul 2-3, 2025). [1 event; 2025-07-03]
- Company confirmations; administration statements (Aug 2025). [1 event; 2025-08-11]
- Company disclosures; BIS letters (late May 2025). [1 event; 2025-05-28]
- Company disclosures; national COVID policy record; trade press. [1 event; 2021-08-23]
- Company guidance (Pegatron, Quanta); Shanghai municipal policy record. [1 event; 2022-04-05]
- Company guidance call transcript; sell-side capex trackers. [1 event; 2026-06-25]
- Company statements (Samsung, NXP, Infineon); trade press. [1 event; 2021-02-16]
- Company statements; Commerce confirmations. [1 event; 2025-07-15]
- Company statements; JMA seismic record. [1 event; 2024-01-01]
- Component-maker guidance; distributor lead-time data. [1 event; 2017-11-01]
- Component-maker guidance; handset build-plan surveys. [1 event; 2019-12-01]
- Executive Office of the President, PCAST (Jan 2017). [1 event; 2017-01-06]
- Federal-register (https://www.federalregister.gov/documents/2026/07/14/2026-14132/enhanced-favorable-treatment-for-the-united-arab-emirates-under-the-export-administration) - AI-drafted, human-reviewed. [1 event; 2026-07-14]
- GlobalFoundries announcement; AMD foundry transition disclosures. [1 event; 2018-08-27]
- Intel announcement (Jan 21, 2022). [1 event; 2022-01-21]
- Intel announcement (Mar 23, 2021). [1 event; 2021-03-23]
- Japanese cabinet order (Aug 2, 2019). [1 event; 2019-08-02]
- JASM opening ceremony; TSMC disclosures. [1 event; 2024-02-24]
- Joint statements; automaker confirmations (Jun 2025). [1 event; 2025-06-27]
- Manual (https://tech-insider.org/dram-ram-price-crisis-2026/) - AI-drafted, human-reviewed. [1 event; 2026-08-07]
- Manual (https://ts2.tech/en/tsmc-stock-stalls-as-samsungs-15-price-hikes-expose-an-ai-foundry-bottleneck/) - AI-drafted, human-reviewed. [1 event; 2026-08-19]
- Manual (https://www.automotivemanufacturingsolutions.com/news/kumamoto-earthquake-halts-japan-car-and-chip-plants/2714617) - AI-drafted, human-reviewed. [1 event; 2026-08-04]
- Market data; DeepSeek technical report. [1 event; 2025-01-27]
- Murata / TDK / Taiyo Yuden guidance; distributor data. [1 event; 2018-06-01]
- NVIDIA / SoftBank announcement. [1 event; 2020-09-13]
- NVIDIA / SoftBank termination announcement. [1 event; 2022-02-08]
- NVIDIA and AMD 8-K filings (Aug 26-31, 2022). [1 event; 2022-08-31]
- NVIDIA/AMD 8-K filings; Commerce statements. [1 event; 2025-04-09]
- OEM production announcements (Jan 2021). [1 event; 2021-01-08]
- OEM production announcements (Mar 2020); foundry allocation commentary. [1 event; 2020-03-18]
- Qualcomm / NXP joint announcement. [1 event; 2016-10-27]
- Samsung / Micron statements (Dec 2021); Xi'an municipal orders. [1 event; 2021-12-23]
- Samsung / SK hynix quarterly disclosures. [1 event; 2019-04-30]
- Samsung Electronics statements; regulatory recall notices. [1 event; 2016-10-11]
- Samsung Q1 2023 preliminary results commentary. [1 event; 2023-04-07]
- SoftBank Group and Arm Holdings completion announcements. [1 event; 2016-09-05]
- Supplier confirmations; Huawei statements (Sep 2020). [1 event; 2020-09-15]
- Supplier quarterly guidance (Q4 2022). [1 event; 2022-11-15]
- Toshiba board disclosures; consortium statements. [1 event; 2017-09-20]
- Toyota production announcement (Aug 19, 2021). [1 event; 2021-08-19]
- TSMC announcement (Dec 6, 2022). [1 event; 2022-12-06]
- TSMC announcement (May 15, 2020). [1 event; 2020-05-15]
- TSMC Q2 2023 earnings call. [1 event; 2023-07-20]
- TSMC statements (Aug 3-6, 2018); quarterly disclosure. [1 event; 2018-08-03]
- TSMC/UMC/Micron statements; earnings disclosures. [1 event; 2024-04-03]
- Usgs (https://earthquake.usgs.gov/earthquakes/eventpage/us6000tgb9) - AI-drafted, human-reviewed. [1 event; 2026-07-28]
- Volkswagen / Continental / Bosch statements (Dec 2020). [1 event; 2020-12-11]
- Webz-news (https://bitnewsbot.com/nvidia-ceo-huang-meets-trump/) - AI-drafted, human-reviewed. [1 event; 2026-07-28]
- Webz-news (https://cloudnews.tech/tsmc-resumes-japan-factory-after-magnitude-7-1-earthquake/) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Webz-news (https://economictimes.indiatimes.com/news/international/business/sony-halts-kumamoto-chip-plant-operations-after-japan-earthquake/articleshow/132698188.cms) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Webz-news (https://technori.com/news/samsung-sk-hynix-eye-950b-us-chip-deals/) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Webz-news (https://theedgemalaysia.com/node/812435) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Webz-news (https://www.dzrh.com.ph/post/japan-earthquake-rocks-chip-and-auto-manufacturing-supply-chain-in-kyushu) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Webz-news (https://www.electronicsweekly.com/?p=903469) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Webz-news (https://www.msn.com/en-us/money/markets/chinas-chip-tool-push-shows-asml-caught-in-us-china-squeeze/ar-AA28Shsq) - AI-drafted, human-reviewed. [1 event; 2026-07-28]
- Webz-news (https://www.thefinancialdistrict.com.ph/post/samsung-lands-200-billion-broadcom-chip-manufacturing-deal) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Western Digital / Kioxia disclosures (Jun 2019). [1 event; 2019-06-15]

### Japan — ministries and agencies

- METI announcement (Jul 1, 2019); Korean government response. [1 event; 2019-07-01]
- METI budget announcement; Rapidus press release. [1 event; 2026-06-24]
- METI ordinance; company disclosures. [1 event; 2023-07-23]
- Rapidus founding announcement; METI. [1 event; 2022-11-11]
- TSMC / Sony announcement (Oct 2021); METI subsidy record. [1 event; 2021-10-14]

### Netherlands and European Union

- ASML statement (Jan 1, 2024); Dutch government confirmation. [1 event; 2024-01-01]
- Dutch government gazette; ASML investor disclosures. [1 event; 2023-09-01]
- Dutch ministry statements; CNBC/Reuters; Honda disclosures. [1 event; 2025-09-30]

### News organisations and trade press

- ASE / Amkor utilisation disclosures; DigiTimes supply-chain reporting. [1 event; 2020-11-01]
- BBC / Reuters reporting; company confirmations. [1 event; 2019-05-20]
- Bloomberg report (Jul 17, 2024); market data. [1 event; 2024-07-17]
- Company notices to customers; Reuters (Oct 2022). [1 event; 2022-10-12]
- Company statements; Nikkei reporting (Oct 2023). [1 event; 2023-10-26]
- Ibiden / Unimicron / Shinko guidance; DigiTimes supply reporting. [1 event; 2021-10-01]
- Joint readouts; Bloomberg (Nov 7, 2025 formalization). [1 event; 2025-10-30]
- Renesas official recovery updates; Nikkei/Reuters coverage. [1 event; 2021-03-19]
- Reuters / Nikkei reporting (Nov 2024); customer notifications. [1 event; 2024-11-11]
- Reuters reporting on the unissued licence; ASML commentary. [1 event; 2019-11-01]
- Reuters supplier reporting; TECHCET gas-market analysis. [1 event; 2022-02-24]
- Reuters/Bloomberg reporting on the agreement (no official text released). [1 event; 2023-01-27]
- Sony Semiconductor Solutions official status notice (Jul 29, 2026); TSMC statements; Nikkei Asia / Japan Times / CNN / DigiTimes reporting. [1 event; 2026-07-28]
- TSMC investor disclosures; CNBC/Forbes coverage (Jul 13 & 16, 2026). [1 event; 2026-07-16]
- TSMC statement; Tom's Hardware / DigiTimes coverage. [1 event; 2025-12-27]

### Other national authorities and courts

- Canadian court record; U.S. extradition request. [1 event; 2018-12-01]
- Chinese transport ministry notice (Oct 2025). [1 event; 2025-10-14]
- Court filings; Taiwan prosecutorial statements. [1 event; 2017-12-05]
- King Yuan exchange filings; Taiwan CDC record. [1 event; 2021-06-13]
- Malaysian trade ministry notice (Jul 14, 2025). [1 event; 2025-07-14]
- Taipower incident report; fab operator statements. [1 event; 2017-08-15]
- Taiwan MND activity reports; shipping-data providers. [1 event; 2022-08-04]
- Taiwan MND daily activity reports; shipping-insurance market data. [1 event; 2026-06-30]
- Taiwan supply-chain press; component-order checks (unconfirmed by TSMC IR). [1 event; 2026-07-02]
- Taiwan Water Resources Agency; TSMC / UMC statements. [1 event; 2021-04-06]

### Research and analyst houses

- DRAMeXchange / TrendForce contract-price series. [1 event; 2017-03-31]
- IDC memory-crisis analysis; TrendForce contract data. [1 event; 2025-12-10]
- SK hynix / Micron disclosures; TrendForce. [1 event; 2023-12-01]
- TechInsights teardown; Bloomberg reporting. [1 event; 2023-08-29]
- TrendForce contract data; PC OEM build plans. [1 event; 2022-06-30]
- TrendForce contract data; supplier capex guidance. [1 event; 2018-10-01]
- TrendForce/IDC contract data; NAND Research crisis updates. [1 event; 2026-03-10]
- Webz-news (https://www.trendforce.com/news/2026/07/29/news-7-1-kumamoto-earthquake-tsmc-confirms-jasm-safe-tel-halts-plants-as-chip-supply-chain-assesses-impact/) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- Western Digital/Kioxia disclosures; TrendForce pricing data. [1 event; 2022-02-10]

### US federal — other agencies and instruments

- Bill text via Congress.gov; Semiconductors Insight analysis. [1 event; 2026-04-02]
- CHIPS Program Office announcements (Apr 2024). [1 event; 2024-04-15]
- CHIPS Program Office preliminary memorandum of terms. [1 event; 2024-03-20]
- Commerce Department confirmation; company 8-K disclosures. [1 event; 2024-05-07]
- Commerce Department settlement announcement. [1 event; 2018-07-13]
- Commerce Federal Register notice (Apr 14, 2025). [1 event; 2025-04-14]
- DOJ indictment (Nov 1, 2018). [1 event; 2018-11-01]
- Executive Order 14017 (Feb 24, 2021). [1 event; 2021-02-24]
- Executive Order 14105 (Aug 9, 2023). [1 event; 2023-08-09]
- Executive order; USTR annex (Apr 2, 2025). [1 event; 2025-04-02]
- Federal Register · BIS interim final rule; two trade-press confirmations. [1 event; 2026-07-03]
- Presidential order (Dec 2, 2016); CFIUS public record. [1 event; 2016-12-02]
- Presidential order (Mar 12, 2018); CFIUS letters. [1 event; 2018-03-12]
- Public Law 115-232. [1 event; 2018-08-13]
- Public Law 117-167; CHIPS Program Office awards. [1 event; 2022-08-09]
- Regulation (EU) 2023/1781. [1 event; 2023-09-21]
- TSMC / White House announcement (Mar 3, 2025). [1 event; 2025-03-03]
- USTR Section 301 four-year review (May 14, 2024). [1 event; 2024-05-14]
- Webz-news (http://ciosea.economictimes.indiatimes.com/news/business-analytics/thailands-siam-silica-framework-bets-on-chips-to-anchor-aseans-supply-chain-future/132701417) - AI-drafted, human-reviewed. [1 event; 2026-07-29]
- White House "Building Resilient Supply Chains" report (Jun 2021). [1 event; 2021-06-08]
- White House announcements (May 2025). [1 event; 2025-05-14]

---

## 2. Facility sources

Site identity, location and output come from publicly available company
facility listings and programme announcements. The significance ordinal on
every one of these records is **not** from the publisher — it is an analyst
judgement, and each record says so in its own source string.

| Publisher | Sites cited |
| --- | --- |
| Air Liquide | 2 |
| Air Products | 2 |
| Alibaba Cloud | 1 |
| Amazon/Annapurna | 1 |
| AMD | 4 |
| AMEC | 1 |
| Amkor | 4 |
| Analog Devices | 4 |
| Ansys | 1 |
| Apple | 2 |
| Applied Materials | 5 |
| Arm | 2 |
| ASE | 4 |
| ASM International | 2 |
| ASML | 2 |
| ASML/Cymer | 1 |
| AT&S | 3 |
| AWS | 1 |
| Biren | 1 |
| Bosch | 2 |
| Broadcom | 2 |
| Cadence | 1 |
| Cambricon | 1 |
| Canon | 1 |
| CEA-Leti | 1 |
| CXMT | 2 |
| Denso | 1 |
| DuPont | 1 |
| DuPont Electronics | 1 |
| Ebara | 1 |
| Empyrean | 1 |
| Entegris | 3 |
| ESMC | 1 |
| Foxconn | 5 |
| GlobalFoundries | 4 |
| GlobalWafers | 2 |
| Google | 2 |
| Hitachi High-Tech | 2 |
| HP | 1 |
| Hua Hong | 2 |
| Huawei/HiSilicon | 1 |
| Ibiden | 2 |
| IBM | 1 |
| IBM Research | 1 |
| IBM Research / NY CREATES | 1 |
| imec | 1 |
| Inari | 1 |
| Infineon | 5 |
| Intel | 12 |
| JASM/TSMC | 1 |
| JCET | 4 |
| JSR | 1 |
| JSR/imec joint | 1 |
| Kioxia | 2 |
| KLA | 3 |
| Kokusai Electric | 1 |
| KYEC | 1 |
| Lam Research | 3 |
| Lenovo | 1 |
| Linde | 2 |
| Luxshare | 2 |
| Marvell | 1 |
| MediaTek | 1 |
| Meta | 1 |
| Microchip | 4 |
| Micron | 8 |
| Microsoft | 1 |
| Nanya | 1 |
| NAURA | 1 |
| Nexchip | 1 |
| Nikon | 1 |
| Nova | 1 |
| NSIG | 1 |
| NVIDIA | 2 |
| NXP | 4 |
| onsemi | 6 |
| Onto Innovation | 2 |
| PTI | 1 |
| Qualcomm | 3 |
| Quanta | 1 |
| Rapidus | 1 |
| Renesas | 6 |
| Resonac | 1 |
| Samsung | 8 |
| Samsung Electro-Mechanics | 2 |
| Samsung packaging | 1 |
| Shin-Etsu | 3 |
| Shinko Electric | 1 |
| Siemens EDA | 1 |
| Siltronic | 3 |
| SK hynix | 6 |
| SK Materials | 2 |
| SK Siltron | 1 |
| SK Siltron CSS | 1 |
| SMIC | 4 |
| Sony Semiconductor Solutions | 4 |
| SPIL | 2 |
| STMicroelectronics | 8 |
| SUMCO | 3 |
| Sumitomo Chemical | 1 |
| Supermicro | 2 |
| Synopsys | 2 |
| Taiyo Nippon Sanso | 2 |
| Tesla | 2 |
| Texas Instruments | 7 |
| TOK | 2 |
| Tokyo Electron | 3 |
| Tower Semiconductor | 1 |
| Tower/TPSCo | 1 |
| TSMC | 9 |
| TSMC advanced-packaging | 1 |
| UMC | 2 |
| Unimicron | 2 |
| UNISOC | 1 |
| UTAC | 2 |
| VIS | 2 |
| VIS/NXP | 1 |
| Volkswagen | 1 |
| Winbond | 2 |
| Wistron | 1 |
| Xiaomi | 1 |
| YMTC | 1 |

---

## 3. Evidence-note sources

Attached to specific figures — a stage share, a company share, an ownership
row, a customer relationship. These are the most fully-formed citations in
the vault, because a note exists precisely to carry one.

| Tier | Applies to | Source |
| --- | --- | --- |
| A | `company:ansys` | Synopsys FY2025 disclosures; SemiAnalysis EDA Market Primer (2025). |
| B | `company:cxmt` | SemiAnalysis, 'China's CXMT Is Set to Challenge DRAM Incumbents' (2025-2026). |
| B | `company:nvidia` | Silicon Analysts, 'NVIDIA AI GPU Market Share 2024-2026'. |
| B | `company:tsmc` | TrendForce press release 20260312-12965 (4Q25 Global Top 10 Foundries). |
| B | `customer:apple->foxconn` | CRN Asia (Jan 2026); Hon Hai FY2025/Q1 2026 results. |
| B | `customer:skhynix->nvidia` | TrendForce, 'NVIDIA Reportedly Drives 27% of SK hynix Revenue in 1H25' (2025-08-18). |
| C | `customer:tsmc->nvidia` | CNBC, 'Nvidia set to supplant Apple as TSMC's top customer' (2026-01-26); TSMC FY2025 customer disclosures. |
| B | `owners:foxconn` | Focus Taiwan / TWSE disclosure (2025-12-02). |
| C | `owners:intel` | Intel 8-K filings (SEC EDGAR, Aug 18 & Sept 15 2025); NPR/CNBC/Manufacturing Dive, Aug 2025. |
| C | `owners:tsmc` | TSMC 2025 Annual Report; MarketScreener shareholder data (2025). |
| C | `stage:adv_pkg` | ASE Technology Holding corporate structure disclosures. |
| B | `stage:hbm` | Astute Group HBM market share note (2026); TrendForce Micron HBM coverage (2025-06-26); SK hynix 2026 Market Outlook. |
| B | `stage:litho` | TrendForce 'ASML EUV Dominance' (2025-2026); ASML FY2025 20-F; Nikon/Canon FY2025 segment financials. |
| B | `stage:m_ai` | Dell'Oro/TrendForce/BloombergNEF data-center-spending trackers (late 2025/early 2026). |

---

## 4. Standing data feeds

Queried continuously rather than cited once. Endpoints are in
`server/src/ingest/` and `server/src/quotes.js`.

| Feed | Endpoint | Role |
| --- | --- | --- |
| United States Geological Survey, Earthquake Catalog | `earthquake.usgs.gov/fdsnws/event/1/query` | Candidate discovery |
| Office of the Federal Register, Documents API | `federalregister.gov/api/v1/documents.json` | Candidate discovery |
| Webz.io, News API Lite | `api.webz.io/newsApiLite` | Candidate discovery |
| Yahoo Finance, Quote API | `query1.finance.yahoo.com/v7/finance/quote` | Display metadata only |
| OpenStreetMap contributors; CARTO basemap tiles | `basemaps.cartocdn.com`, `tile.openstreetmap.org` | Map rendering |

A feed is **discovery only**. None of them can write an event: everything
they surface is a candidate until a human approves it.

