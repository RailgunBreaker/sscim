# Source register

*Generated from the vault by `server/scripts/build-source-register.mjs`. Last generated: 2026-08-24.*

Every source behind every event, facility and evidence note in
`server/data/sscim.db`, in Chicago bibliography style, alphabetised within
issuing body.

## How complete each citation is, and why

A citation can only be as complete as what was recorded when the item was
reviewed. Four classes, counted rather than blurred together:

| Class | Entries | What the record carries |
| --- | --- | --- |
| **Resolved** | 43 | Looked up against the *Federal Register* or SEC EDGAR and tied to the document by an exact identifier: real title, issuer, locator, date and permanent URL |
| **Full** | 20 | Title, publisher, date and URL — captured automatically at review and assembled into a complete entry |
| **Legal** | 0 | Issuing body and an exact *Federal Register* volume and page. Complete by Chicago's convention for government material |
| **Short** | 107 | Issuing body, document type and date only. Hand-curated historical records for which no published document was found |
| Total | 170 | across 167 event(s); every event carries a source |

**No entry is padded out.** A short entry stays short rather than acquiring
an invented title, author or page number to look like the others. Inventing
bibliographic detail to complete the shape of a citation would defeat the
purpose of keeping one, and it is exactly the failure a register like this
exists to prevent.

That constraint is what makes the *resolved* class trustworthy. Every entry
in it was matched to its document by an exact identifier — a register
citation, an executive order number, an SEC accession number — and never by
a similarity score. Two registers were searched exhaustively: the *Federal
Register* for regulatory action, and SEC EDGAR for company announcements,
which a US registrant furnishes as a filing even when it reads as a press
release.

Where neither register held the document, the entry stayed short, and that
is a finding rather than a gap. Presidential CFIUS orders, export-licence
revocations and settlement announcements were never published as *Federal
Register* documents. Samsung, SK hynix, Toshiba, SoftBank, Kioxia, Taipower
and the Chinese, Japanese and Dutch ministries are not SEC registrants, so
their announcements are real and simply not in either register. Several
filings were left alone for a subtler reason: where a company furnished
half a dozen reports in the same week and none could be tied to the event by
its own text, no citation is better than a plausible one.

The remainder is a data-entry task, not a formatting one: everything
arriving through the review queue now captures its URL automatically, so the
*full* class grows with every reviewed event.

---

## 1. Standing datasets and services

Queried continuously rather than cited once. Details verified against each
publisher's own citation guidance where they publish one.

- CARTO. *CARTO Basemaps (dark_all)*. https://carto.com/basemaps.
  *Role:* Basemap tile rendering, over OpenStreetMap data.
- Office of the Federal Register, National Archives and Records Administration. *Federal Register Documents API (v1)*. https://www.federalregister.gov/developers/documentation/api/v1.
  *Role:* Candidate discovery — US rules, notices and entity-list actions.
- OpenStreetMap contributors. *OpenStreetMap*. https://www.openstreetmap.org. Licensed under the Open Database License (ODbL).
  *Role:* Basemap geometry.
- U.S. Geological Survey, Earthquake Hazards Program. *Advanced National Seismic System (ANSS) Comprehensive Catalog of Earthquake Events and Products*. 2017. https://doi.org/10.5066/F7MS3QZH. Queried through the FDSN event web service at earthquake.usgs.gov/fdsnws/event/1/query.
  *Role:* Candidate discovery — seismic events near modeled fab clusters.
- Webz.io. *News API Lite*. https://webz.io/products/news-api.
  *Role:* Candidate discovery — plant halts, fires and shortages as reported.
- Yahoo Finance. Quote API (v7). https://query1.finance.yahoo.com/v7/finance/quote.
  *Role:* Display metadata only — price and P/E. Never an engine input.

A feed is **discovery only**. None of them can write an event: everything
they surface is a candidate until a person approves it.

---

## 2. Event sources

The 170 sources behind the dated events, grouped by issuing body and
alphabetised. The bracketed date is the event the source supports.

### Company disclosures, filings and announcements

- ASML statement (Jan 3, 2022); Q4 2021 disclosure. *(short entry)* [event: 2022-01-03]
- Bill text via Congress.gov; Semiconductors Insight analysis. April 2, 2026. *(short entry)* [event: 2026-04-02]
- Canadian court record; U.S. extradition request. December 1, 2018. *(short entry)* [event: 2018-12-01]
- CHIPS Program Office announcements (Apr 2024). *(short entry)* [event: 2024-04-15]
- CHIPS Program Office preliminary memorandum of terms. March 20, 2024. *(short entry)* [event: 2024-03-20]
- Commerce authorisations reported Oct 2022. October 10, 2022. *(short entry)* [event: 2022-10-10]
- Commerce Department settlement announcement. July 13, 2018. *(short entry)* [event: 2018-07-13]
- Commerce letter reported Sep 26, 2020; SMIC filings. September 26, 2020. *(short entry)* [event: 2020-09-26]
- Commerce notice; Al Jazeera (Jun 1, 2026). *(short entry)* [event: 2026-06-01]
- Company confirmations (Jul 2-3, 2025). *(short entry)* [event: 2025-07-03]
- Company disclosures; BIS letters (late May 2025). *(short entry)* [event: 2025-05-28]
- Company disclosures; national COVID policy record; trade press. August 23, 2021. *(short entry)* [event: 2021-08-23]
- Company exchange filings (Sep 26-30, 2021); provincial notices. *(short entry)* [event: 2021-09-26]
- Company guidance (Pegatron, Quanta); Shanghai municipal policy record. April 5, 2022. *(short entry)* [event: 2022-04-05]
- Company guidance call transcript; sell-side capex trackers. June 25, 2026. *(short entry)* [event: 2026-06-25]
- Company statements (Samsung, NXP, Infineon); trade press. February 16, 2021. *(short entry)* [event: 2021-02-16]
- Company statements; Commerce confirmations. July 15, 2025. *(short entry)* [event: 2025-07-15]
- Company statements; JMA seismic record. January 1, 2024. *(short entry)* [event: 2024-01-01]
- Component-maker guidance; distributor lead-time data. November 1, 2017. *(short entry)* [event: 2017-11-01]
- Component-maker guidance; handset build-plan surveys. December 1, 2019. *(short entry)* [event: 2019-12-01]
- Court filings; Taiwan prosecutorial statements. December 5, 2017. *(short entry)* [event: 2017-12-05]
- DOJ indictment (Nov 1, 2018). *(short entry)* [event: 2018-11-01]
- Executive Office of the President, PCAST (Jan 2017). *(short entry)* [event: 2017-01-06]
- GlobalFoundries announcement; AMD foundry transition disclosures. August 27, 2018. *(short entry)* [event: 2018-08-27]
- Intel announcement (Jan 21, 2022). *(short entry)* [event: 2022-01-21]
- investmentmonitor.ai. "SK Hynix eyes Japan chip plant amid global shortage - report." August 21, 2026. https://www.investmentmonitor.ai/news/sk-hynix-eyes-japan-chip-plant/. Accessed 2026-08-24. [event: 2026-08-21]
- Japanese cabinet order (Aug 2, 2019). *(short entry)* [event: 2019-08-02]
- JASM opening ceremony; TSMC disclosures. February 24, 2024. *(short entry)* [event: 2024-02-24]
- Joint statements; automaker confirmations (Jun 2025). *(short entry)* [event: 2025-06-27]
- King Yuan exchange filings; Taiwan CDC record. June 13, 2021. *(short entry)* [event: 2021-06-13]
- Market data; DeepSeek technical report. January 27, 2025. *(short entry)* [event: 2025-01-27]
- Murata / TDK / Taiyo Yuden guidance; distributor data. June 1, 2018. *(short entry)* [event: 2018-06-01]
- OEM production announcements (Jan 2021). *(short entry)* [event: 2021-01-08]
- OEM production announcements (Mar 2020); foundry allocation commentary. *(short entry)* [event: 2020-03-18]
- Presidential order (Dec 2, 2016); CFIUS public record. *(short entry)* [event: 2016-12-02]
- Presidential order (Mar 12, 2018); CFIUS letters. *(short entry)* [event: 2018-03-12]
- Provincial restart orders; supplier disclosures. February 10, 2020. *(short entry)* [event: 2020-02-10]
- Public Law 115-232. August 13, 2018. *(short entry)* [event: 2018-08-13]
- Public Law 117-167; CHIPS Program Office awards. August 9, 2022. *(short entry)* [event: 2022-08-09]
- Qualcomm / NXP joint announcement. October 27, 2016. *(short entry)* [event: 2016-10-27]
- Regulation (EU) 2023/1781. September 21, 2023. *(short entry)* [event: 2023-09-21]
- Samsung / Micron statements (Dec 2021); Xi'an municipal orders. *(short entry)* [event: 2021-12-23]
- Samsung / SK hynix quarterly disclosures. April 30, 2019. *(short entry)* [event: 2019-04-30]
- Samsung Electronics statements; regulatory recall notices. October 11, 2016. *(short entry)* [event: 2016-10-11]
- Samsung Q1 2023 preliminary results commentary. April 7, 2023. *(short entry)* [event: 2023-04-07]
- SoftBank Group and Arm Holdings completion announcements. September 5, 2016. *(short entry)* [event: 2016-09-05]
- Supplier confirmations; Huawei statements (Sep 2020). *(short entry)* [event: 2020-09-15]
- Supplier quarterly guidance (Q4 2022). *(short entry)* [event: 2022-11-15]
- Taipower incident report; fab operator statements. August 15, 2017. *(short entry)* [event: 2017-08-15]
- Taiwan MND activity reports; shipping-data providers. August 4, 2022. *(short entry)* [event: 2022-08-04]
- Taiwan MND daily activity reports; shipping-insurance market data. June 30, 2026. *(short entry)* [event: 2026-06-30]
- Taiwan supply-chain press; component-order checks (unconfirmed by TSMC IR). July 2, 2026. *(short entry)* [event: 2026-07-02]
- Taiwan Water Resources Agency; TSMC / UMC statements. April 6, 2021. *(short entry)* [event: 2021-04-06]
- tech-insider.org. "DDR4 spot price hits record $42.45 as memory capacity shifts to HBM." August 7, 2026. https://tech-insider.org/dram-ram-price-crisis-2026/. Accessed 2026-08-24. [event: 2026-08-07]
- Toshiba board disclosures; consortium statements. September 20, 2017. *(short entry)* [event: 2017-09-20]
- Toyota production announcement (Aug 19, 2021). *(short entry)* [event: 2021-08-19]
- TSMC statements (Aug 3-6, 2018); quarterly disclosure. *(short entry)* [event: 2018-08-03]
- TSMC/UMC/Micron statements; earnings disclosures. April 3, 2024. *(short entry)* [event: 2024-04-03]
- U.S. Geological Survey, Earthquake Hazards Program. Event page us6000tgb9, M6.8, 2026 Uto, Japan Earthquake . July 28, 2026. https://earthquake.usgs.gov/earthquakes/eventpage/us6000tgb9. Accessed 2026-08-24. [event: 2026-07-28]
- Volkswagen / Continental / Bosch statements (Dec 2020). *(short entry)* [event: 2020-12-11]
- Western Digital / Kioxia disclosures (Jun 2019). *(short entry)* [event: 2019-06-15]
- White House "Building Resilient Supply Chains" report (Jun 2021). *(short entry)* [event: 2021-06-08]
- White House announcements (May 2025). *(short entry)* [event: 2025-05-14]

### Government and regulatory bodies

- Advanced Micro Devices, Inc. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001193125-20-277468, October 27, 2020. https://www.sec.gov/Archives/edgar/data/2488/000119312520277468/d67182d8k.htm. Accessed 2026-08-24. [event: 2020-10-27]
- Apple Inc. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0000320193-19-000002, January 2, 2019. https://www.sec.gov/Archives/edgar/data/320193/000032019319000002/a8-kjanuary2019122019.htm. Accessed 2026-08-24. [event: 2019-01-02]
- ASML Holding N.V. "Report of Foreign Private Issuer on Form 6-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0000937966-17-000017, October 18, 2017. https://www.sec.gov/Archives/edgar/data/937966/000093796617000017/form6kq3resultsoctober1820.htm. Accessed 2026-08-24. [event: 2017-10-18]
- ASML Holding N.V. "Report of Foreign Private Issuer on Form 6-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0000937966-24-000022, October 15, 2024. https://www.sec.gov/Archives/edgar/data/937966/000093796624000022/form6-kquarterlyfilings.htm. Accessed 2026-08-24. [event: 2024-10-15]
- Chinese transport ministry notice (Oct 2025). *(short entry)* [event: 2025-10-14]
- Company confirmations; administration statements (Aug 2025). *(short entry)* [event: 2025-08-11]
- Executive Office of the President. "Executive Order 14017: America's Supply Chains." *Federal Register*, 86 Fed. Reg. 11849, March 1, 2021. https://www.federalregister.gov/documents/2021/03/01/2021-04280/americas-supply-chains. Accessed 2026-08-24. [event: 2021-02-24]
- Executive Office of the President. "Executive Order 14105: Addressing United States Investments in Certain National Security Technologies and Products in Countries of Concern." *Federal Register*, 88 Fed. Reg. 54867, August 11, 2023. https://www.federalregister.gov/documents/2023/08/11/2023-17449/addressing-united-states-investments-in-certain-national-security-technologies-and-products-in. Accessed 2026-08-24. [event: 2023-08-09]
- Executive Office of the President. "Executive Order 14257: Regulating Imports With a Reciprocal Tariff To Rectify Trade Practices That Contribute to Large and Persistent Annual United States Goods Trade Deficits." *Federal Register*, 90 Fed. Reg. 15041, April 7, 2025. https://www.federalregister.gov/documents/2025/04/07/2025-06063/regulating-imports-with-a-reciprocal-tariff-to-rectify-trade-practices-that-contribute-to-large-and. Accessed 2026-08-24. [event: 2025-04-02]
- federal-register. "Enhanced Favorable Treatment for the United Arab Emirates Under the Export Administration Regulations." July 14, 2026. https://www.federalregister.gov/documents/2026/07/14/2026-14132/enhanced-favorable-treatment-for-the-united-arab-emirates-under-the-export-administration. Accessed 2026-08-24. [event: 2026-07-14]
- Government of the Netherlands. ASML statement (Jan 1, 2024); Dutch government confirmation. *(short entry)* [event: 2024-01-01]
- Government of the Netherlands. Dutch government gazette; ASML investor disclosures. September 1, 2023. *(short entry)* [event: 2023-09-01]
- Government of the Netherlands. Dutch ministry statements; CNBC/Reuters; Honda disclosures. September 30, 2025. *(short entry)* [event: 2025-09-30]
- Intel Corporation. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001193125-21-091374, March 23, 2021. https://www.sec.gov/Archives/edgar/data/50863/000119312521091374/d153275d8k.htm. Accessed 2026-08-24. [event: 2021-03-23]
- Japan, Ministry of Economy, Trade and Industry (METI). METI announcement (Jul 1, 2019); Korean government response. *(short entry)* [event: 2019-07-01]
- Japan, Ministry of Economy, Trade and Industry (METI). METI budget announcement; Rapidus press release. June 24, 2026. *(short entry)* [event: 2026-06-24]
- Japan, Ministry of Economy, Trade and Industry (METI). METI ordinance; company disclosures. July 23, 2023. *(short entry)* [event: 2023-07-23]
- Japan, Ministry of Economy, Trade and Industry (METI). Rapidus founding announcement; METI. November 11, 2022. *(short entry)* [event: 2022-11-11]
- Japan, Ministry of Economy, Trade and Industry (METI). TSMC / Sony announcement (Oct 2021); METI subsidy record. *(short entry)* [event: 2021-10-14]
- Malaysian trade ministry notice (Jul 14, 2025). *(short entry)* [event: 2025-07-14]
- Micron Technology, Inc. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0000723125-23-000028, May 22, 2023. https://www.sec.gov/Archives/edgar/data/723125/000072312523000028/mu-20230522.htm. Accessed 2026-08-24. [event: 2023-05-21]
- NVIDIA Corporation. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001045810-22-000005, February 8, 2022. https://www.sec.gov/Archives/edgar/data/1045810/000104581022000005/nvda-20220208.htm. Accessed 2026-08-24. [event: 2022-02-08]
- NVIDIA Corporation. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001045810-22-000146, August 31, 2022. https://www.sec.gov/Archives/edgar/data/1045810/000104581022000146/nvda-20220826.htm. Accessed 2026-08-24. [event: 2022-08-31]
- NVIDIA Corporation. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001193125-20-244601, September 14, 2020. https://www.sec.gov/Archives/edgar/data/1045810/000119312520244601/d13958d8k.htm. Accessed 2026-08-24. [event: 2020-09-13]
- Office of the Federal Register. Federal Register · BIS interim final rule; two trade-press confirmations. July 3, 2026. *(short entry)* [event: 2026-07-03]
- Office of the United States Trade Representative. "Request for Comments on Proposed Modifications and Machinery Exclusion Process in Four-Year Review of Actions Taken in the Section 301 Investigation: China's Acts, Policies, and Practices Related to Technology Transfer, Intellectual Property, and Innovation." *Federal Register*, 89 Fed. Reg. 46252, May 28, 2024. https://www.federalregister.gov/documents/2024/05/28/2024-11634/request-for-comments-on-proposed-modifications-and-machinery-exclusion-process-in-four-year-review. Accessed 2026-08-24. [event: 2024-05-14]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM announcement (Feb 4, 2025). *(short entry)* [event: 2025-02-04]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM Announcement No. 23; customs statistics. July 3, 2023. *(short entry)* [event: 2023-07-03]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM announcement; automaker disclosures. April 4, 2025. *(short entry)* [event: 2025-04-04]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM announcement; Reuters. December 3, 2024. *(short entry)* [event: 2024-12-03]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM announcements; Clark Hill / mining-press analysis. October 9, 2025. *(short entry)* [event: 2025-10-09]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM listing; FDD analysis (Jun 24, 2026). *(short entry)* [event: 2026-06-22]
- People's Republic of China, Ministry of Commerce (MOFCOM). MOFCOM notices; importer surveys; customs statistics. June 27, 2026. *(short entry)* [event: 2026-06-27]
- People's Republic of China, National Development and Reform Commission. NDRC statements; Chinese press reporting. December 22, 2017. *(short entry)* [event: 2017-12-22]
- Qualcomm Incorporated. "Current Report on Form 8-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001104659-18-047166, July 26, 2018. https://www.sec.gov/Archives/edgar/data/804328/000110465918047166/a18-7900_238k.htm. Accessed 2026-08-24. [event: 2018-07-26]
- State Administration for Market Regulation (China). SAMR announcement (Dec 9, 2024). *(short entry)* [event: 2024-12-09]
- Taiwan Semiconductor Manufacturing Company Limited. "Report of Foreign Private Issuer on Form 6-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001046179-25-000024, March 3, 2025. https://www.sec.gov/Archives/edgar/data/1046179/000104617925000024/tsmcexpandinvestmentintheu.htm. Accessed 2026-08-24. [event: 2025-03-03]
- Taiwan Semiconductor Manufacturing Company Limited. "Report of Foreign Private Issuer on Form 6-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001564590-20-025607, May 15, 2020. https://www.sec.gov/Archives/edgar/data/1046179/000156459020025607/tsm-6k_20200514.htm. Accessed 2026-08-24. [event: 2020-05-15]
- Taiwan Semiconductor Manufacturing Company Limited. "Report of Foreign Private Issuer on Form 6-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001564590-22-039051, December 6, 2022. https://www.sec.gov/Archives/edgar/data/1046179/000156459022039051/tsm-6k_20221206.htm. Accessed 2026-08-24. [event: 2022-12-06]
- Taiwan Semiconductor Manufacturing Company Limited. "Report of Foreign Private Issuer on Form 6-K." *U.S. Securities and Exchange Commission, EDGAR*, accession no. 0001628280-23-025146, July 20, 2023. https://www.sec.gov/Archives/edgar/data/1046179/000162828023025146/tsm-20230720x6k.htm. Accessed 2026-08-24. [event: 2023-07-20]
- U.S. Department of Commerce, Bureau of Industry and Security. "Addition of an Entity to the Entity List." *Federal Register*, 83 Fed. Reg. 54519, October 30, 2018. https://www.federalregister.gov/documents/2018/10/30/2018-23693/addition-of-an-entity-to-the-entity-list. Accessed 2026-08-24. [event: 2018-10-29]
- U.S. Department of Commerce, Bureau of Industry and Security. "Addition of Certain Entities to the Entity List and Revision of Entries on the Entity List." *Federal Register*, 84 Fed. Reg. 43493, August 21, 2019. https://www.federalregister.gov/documents/2019/08/21/2019-17921/addition-of-certain-entities-to-the-entity-list-and-revision-of-entries-on-the-entity-list. Accessed 2026-08-24. [event: 2019-08-19]
- U.S. Department of Commerce, Bureau of Industry and Security. "Addition of Entities to the Entity List, Revision of Entry on the Entity List, and Removal of Entities From the Entity List." *Federal Register*, 85 Fed. Reg. 83416, December 22, 2020. https://www.federalregister.gov/documents/2020/12/22/2020-28031/addition-of-entities-to-the-entity-list-revision-of-entry-on-the-entity-list-and-removal-of-entities. Accessed 2026-08-24. [event: 2020-12-18]
- U.S. Department of Commerce, Bureau of Industry and Security. "Addition of Entities to the Entity List." *Federal Register*, 84 Fed. Reg. 22961, May 21, 2019. https://www.federalregister.gov/documents/2019/05/21/2019-10616/addition-of-entities-to-the-entity-list. Accessed 2026-08-24. [event: 2019-05-16]
- U.S. Department of Commerce, Bureau of Industry and Security. "Addition of Huawei Non-U.S. Affiliates to the Entity List, the Removal of Temporary General License, and Amendments to General Prohibition Three (Foreign-Produced Direct Product Rule)." *Federal Register*, 85 Fed. Reg. 51596, August 20, 2020. https://www.federalregister.gov/documents/2020/08/20/2020-18213/addition-of-huawei-non-us-affiliates-to-the-entity-list-the-removal-of-temporary-general-license-and. Accessed 2026-08-24. [event: 2020-08-17]
- U.S. Department of Commerce, Bureau of Industry and Security. "Additions and Modifications to the Entity List; Removals From the Validated End-User (VEU) Program." *Federal Register*, 89 Fed. Reg. 96830, December 5, 2024. https://www.federalregister.gov/documents/2024/12/05/2024-28267/additions-and-modifications-to-the-entity-list-removals-from-the-validated-end-user-veu-program. Accessed 2026-08-24. [event: 2024-12-02]
- U.S. Department of Commerce, Bureau of Industry and Security. "Additions and Revisions to the Entity List and Conforming Removal From the Unverified List." *Federal Register*, 87 Fed. Reg. 77505, December 19, 2022. https://www.federalregister.gov/documents/2022/12/19/2022-27151/additions-and-revisions-to-the-entity-list-and-conforming-removal-from-the-unverified-list. Accessed 2026-08-24. [event: 2022-12-15]
- U.S. Department of Commerce, Bureau of Industry and Security. "Additions to the Entity List." *Federal Register*, 90 Fed. Reg. 4621, January 16, 2025. https://www.federalregister.gov/documents/2025/01/16/2025-00480/additions-to-the-entity-list. Accessed 2026-08-24. [event: 2025-01-15]
- U.S. Department of Commerce, Bureau of Industry and Security. "Commerce Control List Additions and Revisions; Implementation of Controls on Advanced Technologies Consistent With Controls Implemented by International Partners." *Federal Register*, 89 Fed. Reg. 72926, September 6, 2024. https://www.federalregister.gov/documents/2024/09/06/2024-19633/commerce-control-list-additions-and-revisions-implementation-of-controls-on-advanced-technologies. Accessed 2026-08-24. [event: 2024-09-05]
- U.S. Department of Commerce, Bureau of Industry and Security. "Entity List Additions." *Federal Register*, 88 Fed. Reg. 71991, October 19, 2023. https://www.federalregister.gov/documents/2023/10/19/2023-23048/entity-list-additions. Accessed 2026-08-24. [event: 2023-10-17]
- U.S. Department of Commerce, Bureau of Industry and Security. "Expansion of End-User Controls To Cover Affiliates of Certain Listed Entities." *Federal Register*, 90 Fed. Reg. 47201, September 30, 2025. https://www.federalregister.gov/documents/2025/09/30/2025-19001/expansion-of-end-user-controls-to-cover-affiliates-of-certain-listed-entities. Accessed 2026-08-24. [event: 2025-09-29]
- U.S. Department of Commerce, Bureau of Industry and Security. "Export Administration Regulations: Amendments to General Prohibition Three (Foreign-Produced Direct Product Rule) and the Entity List." *Federal Register*, 85 Fed. Reg. 29849, May 19, 2020. https://www.federalregister.gov/documents/2020/05/19/2020-10856/export-administration-regulations-amendments-to-general-prohibition-three-foreign-produced-direct. Accessed 2026-08-24. [event: 2020-05-15]
- U.S. Department of Commerce, Bureau of Industry and Security. "Foreign-Produced Direct Product Rule Additions, and Refinements to Controls for Advanced Computing and Semiconductor Manufacturing Items." *Federal Register*, 89 Fed. Reg. 96790, December 5, 2024. https://www.federalregister.gov/documents/2024/12/05/2024-28270/foreign-produced-direct-product-rule-additions-and-refinements-to-controls-for-advanced-computing. Accessed 2026-08-24. [event: 2024-12-02]
- U.S. Department of Commerce, Bureau of Industry and Security. "Framework for Artificial Intelligence Diffusion." *Federal Register*, 90 Fed. Reg. 4544, January 15, 2025. https://www.federalregister.gov/documents/2025/01/15/2025-00636/framework-for-artificial-intelligence-diffusion. Accessed 2026-08-24. [event: 2025-01-13]
- U.S. Department of Commerce, Bureau of Industry and Security. "Implementation of Additional Due Diligence Measures for Advanced Computing Integrated Circuits; Amendments and Clarifications; and Extension of Comment Period." *Federal Register*, 90 Fed. Reg. 5298, January 16, 2025. https://www.federalregister.gov/documents/2025/01/16/2025-00711/implementation-of-additional-due-diligence-measures-for-advanced-computing-integrated-circuits. Accessed 2026-08-24. [event: 2025-01-15]
- U.S. Department of Commerce, Bureau of Industry and Security. "Implementation of Additional Export Controls: Certain Advanced Computing and Semiconductor Manufacturing Items; Supercomputer and Semiconductor End Use; Entity List Modification." *Federal Register*, 87 Fed. Reg. 62186, October 13, 2022. https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor. Accessed 2026-08-24. [event: 2022-10-07]
- U.S. Department of Commerce, Bureau of Industry and Security. "Implementation of Additional Export Controls: Certain Advanced Computing Items; Supercomputer and Semiconductor End Use; Updates and Corrections." *Federal Register*, 88 Fed. Reg. 73458, October 25, 2023. https://www.federalregister.gov/documents/2023/10/25/2023-23055/implementation-of-additional-export-controls-certain-advanced-computing-items-supercomputer-and. Accessed 2026-08-24. [event: 2023-10-17]
- U.S. Department of Commerce, Bureau of Industry and Security. "Implementation of Certain 2021 Wassenaar Arrangement Decisions on Four Section 1758 Technologies." *Federal Register*, 87 Fed. Reg. 49979, August 15, 2022. https://www.federalregister.gov/documents/2022/08/15/2022-17125/implementation-of-certain-2021-wassenaar-arrangement-decisions-on-four-section-1758-technologies. Accessed 2026-08-24. [event: 2022-08-12]
- U.S. Department of Commerce, Bureau of Industry and Security. "In the Matter of: Zhongxing Telecommunications Equipment Corporation ZTE Plaza, Keji Road South Hi-Tech Industrial Park Nanshan District, Shenzhen China; ZTE Kangxun Telecommunications Ltd. 2/3 Floor, Suite A, Zte Communication Mansion Keji (S) Road Hi-New Shenzhen, 518057 China Respondent'; Order Activating Suspended Denial Order Relating to Zhongxing Telecommunications Equipment Corporation and Zte Kangxun Telecommunications Ltd.." *Federal Register*, 83 Fed. Reg. 17644, April 23, 2018. https://www.federalregister.gov/documents/2018/04/23/2018-08354/in-the-matter-of-zhongxing-telecommunications-equipment-corporation-zte-plaza-keji-road-south. Accessed 2026-08-24. [event: 2018-04-16]
- U.S. Department of Commerce, Bureau of Industry and Security. "Notice of Request for Public Comments on Section 232 National Security Investigation of Imports of Semiconductors and Semiconductor Manufacturing Equipment." *Federal Register*, 90 Fed. Reg. 15950, April 16, 2025. https://www.federalregister.gov/documents/2025/04/16/2025-06591/notice-of-request-for-public-comments-on-section-232-national-security-investigation-of-imports-of. Accessed 2026-08-24. [event: 2025-04-14]
- U.S. Department of Commerce, Bureau of Industry and Security. "Review of Controls for Certain Emerging Technologies." *Federal Register*, 83 Fed. Reg. 58201, November 19, 2018. https://www.federalregister.gov/documents/2018/11/19/2018-25221/review-of-controls-for-certain-emerging-technologies. Accessed 2026-08-24. [event: 2018-11-19]
- U.S. Department of Commerce, Bureau of Industry and Security. "Revision to License Review Policy for Advanced Computing Commodities." *Federal Register*, 91 Fed. Reg. 1684, January 15, 2026. https://www.federalregister.gov/documents/2026/01/15/2026-00789/revision-to-license-review-policy-for-advanced-computing-commodities. Accessed 2026-08-24. [event: 2026-01-15]
- U.S. Department of Commerce, Bureau of Industry and Security. "Revocation of Validated End-User Authorizations in the People's Republic of China." *Federal Register*, 90 Fed. Reg. 42321, September 2, 2025. https://www.federalregister.gov/documents/2025/09/02/2025-16735/revocation-of-validated-end-user-authorizations-in-the-peoples-republic-of-china. Accessed 2026-08-24. [event: 2025-08-29]
- U.S. Department of Commerce, Bureau of Industry and Security. "Temporary General License: Extension of Validity, Clarifications to Authorized Transactions, and Changes to Certification Statement Requirements." *Federal Register*, 84 Fed. Reg. 43487, August 21, 2019. https://www.federalregister.gov/documents/2019/08/21/2019-17920/temporary-general-license-extension-of-validity-clarifications-to-authorized-transactions-and. Accessed 2026-08-24. [event: 2019-08-19]
- U.S. Department of Commerce, Bureau of Industry and Security. BIS rescission notice. May 13, 2025. *(short entry)* [event: 2025-05-13]
- U.S. Department of Commerce, National Institute of Standards and Technology. "Preventing the Improper Use of CHIPS Act Funding." *Federal Register*, 88 Fed. Reg. 17439, March 23, 2023. https://www.federalregister.gov/documents/2023/03/23/2023-05869/preventing-the-improper-use-of-chips-act-funding. Accessed 2026-08-24. [event: 2023-03-21]
- U.S. Securities and Exchange Commission. Commerce Department confirmation; company 8-K disclosures. May 7, 2024. *(short entry)* [event: 2024-05-07]
- U.S. Securities and Exchange Commission. NVIDIA/AMD 8-K filings; Commerce statements. April 9, 2025. *(short entry)* [event: 2025-04-09]

### News organisations and trade press

- automotivemanufacturingsolutions.com. "Kumamoto earthquake recovery: TSMC/JASM, Sony and Renesas restart Kyushu chip plants; Toyota resumes output." August 7, 2026. https://www.automotivemanufacturingsolutions.com/news/kumamoto-earthquake-halts-japan-car-and-chip-plants/2714617. Accessed 2026-08-24. [event: 2026-08-04]
- bitnewsbot.com. "Nvidia CEO Huang meets Trump officials amid AI chip export probe." July 28, 2026. https://bitnewsbot.com/nvidia-ceo-huang-meets-trump/. Accessed 2026-08-24. [event: 2026-07-28]
- Bloomberg. Bloomberg report (Jul 17, 2024); market data. *(short entry)* [event: 2024-07-17]
- Bloomberg. Joint readouts; Bloomberg (Nov 7, 2025 formalization). October 30, 2025. *(short entry)* [event: 2025-10-30]
- cloudnews.tech. "TSMC Resumes Japan Factory After Magnitude 7.1 Earthquake | Cloud News." July 29, 2026. https://cloudnews.tech/tsmc-resumes-japan-factory-after-magnitude-7-1-earthquake/. Accessed 2026-08-24. [event: 2026-07-29]
- CNBC. TSMC investor disclosures; CNBC/Forbes coverage (Jul 13 & 16, 2026). *(short entry)* [event: 2026-07-16]
- coinalertnews.com. "Samsung Fast-Tracks Texas Fab and Raises Foundry Prices Amid AI Chip Crunch." August 20, 2026. https://coinalertnews.com/news/2026/08/20/samsung-texas-fab-price-hikes. Accessed 2026-08-24. [event: 2026-08-20]
- DigiTimes. ASE / Amkor utilisation disclosures; DigiTimes supply-chain reporting. November 1, 2020. *(short entry)* [event: 2020-11-01]
- DigiTimes. Ibiden / Unimicron / Shinko guidance; DigiTimes supply reporting. October 1, 2021. *(short entry)* [event: 2021-10-01]
- DigiTimes. TSMC statement; Tom's Hardware / DigiTimes coverage. December 27, 2025. *(short entry)* [event: 2025-12-27]
- dzrh.com.ph. "Japan earthquake rocks chip and auto manufacturing supply chain in Kyushu." July 29, 2026. https://www.dzrh.com.ph/post/japan-earthquake-rocks-chip-and-auto-manufacturing-supply-chain-in-kyushu. Accessed 2026-08-24. [event: 2026-07-29]
- electronicsweekly.com. "TSMC Fab 20 running 20k 2nm wpm." July 29, 2026. https://www.electronicsweekly.com/?p=903469. Accessed 2026-08-24. [event: 2026-07-29]
- indiatimes.com. "Sony halts Kumamoto chip plant operations after Japan earthquake." July 29, 2026. https://economictimes.indiatimes.com/news/international/business/sony-halts-kumamoto-chip-plant-operations-after-japan-earthquake/articleshow/132698188.cms. Accessed 2026-08-24. [event: 2026-07-29]
- indiatimes.com. "Thailand's Siam Silica Framework bets on chips to anchor ASEAN's supply chain future." July 29, 2026. http://ciosea.economictimes.indiatimes.com/news/business-analytics/thailands-siam-silica-framework-bets-on-chips-to-anchor-aseans-supply-chain-future/132701417. Accessed 2026-08-24. [event: 2026-07-29]
- mitrade.com. "Samsung rushes early equipment sign-off for its second Texas chip fab." August 20, 2026. https://www.mitrade.com/insights/news/live-news/article-3-2017654-20260820. Accessed 2026-08-24. [event: 2026-08-20]
- msn.com. "China's chip tool push shows ASML caught in US-China squeeze." July 28, 2026. https://www.msn.com/en-us/money/markets/chinas-chip-tool-push-shows-asml-caught-in-us-china-squeeze/ar-AA28Shsq. Accessed 2026-08-24. [event: 2026-07-28]
- Nikkei. Company statements; Nikkei reporting (Oct 2023). *(short entry)* [event: 2023-10-26]
- Nikkei. Sony Semiconductor Solutions status notice (Jul 29, 2026); TSMC statements; Nikkei Asia / Japan Times / CNN / DigiTimes reporting. *(short entry)* [event: 2026-07-28]
- Reuters. BBC / Reuters reporting; company confirmations. May 20, 2019. *(short entry)* [event: 2019-05-20]
- Reuters. Company notices to customers; Reuters (Oct 2022). *(short entry)* [event: 2022-10-12]
- Reuters. Renesas recovery updates; Nikkei/Reuters coverage. March 19, 2021. *(short entry)* [event: 2021-03-19]
- Reuters. Reuters / Nikkei reporting (Nov 2024); customer notifications. *(short entry)* [event: 2024-11-11]
- Reuters. Reuters reporting on the unissued licence; ASML commentary. November 1, 2019. *(short entry)* [event: 2019-11-01]
- Reuters. Reuters supplier reporting; TECHCET gas-market analysis. February 24, 2022. *(short entry)* [event: 2022-02-24]
- Reuters. Reuters/Bloomberg reporting on the agreement (no text released). January 27, 2023. *(short entry)* [event: 2023-01-27]
- technori.com. "Samsung, SK Hynix Eye $950B US Chip Deals." July 29, 2026. https://technori.com/news/samsung-sk-hynix-eye-950b-us-chip-deals/. Accessed 2026-08-24. [event: 2026-07-29]
- theedgemalaysia.com. "Japan earthquake rocks chip and auto manufacturing supply chain in Kyushu." July 29, 2026. https://theedgemalaysia.com/node/812435. Accessed 2026-08-24. [event: 2026-07-29]
- thefinancialdistrict.com.ph. "Samsung Lands $200 Billion Broadcom Chip Manufacturing Deal." July 29, 2026. https://www.thefinancialdistrict.com.ph/post/samsung-lands-200-billion-broadcom-chip-manufacturing-deal. Accessed 2026-08-24. [event: 2026-07-29]
- ts2.tech. "Samsung raises foundry prices 10-15% on 4nm, 5nm and 8nm as TSMC capacity tightens." August 19, 2026. https://ts2.tech/en/tsmc-stock-stalls-as-samsungs-15-price-hikes-expose-an-ai-foundry-bottleneck/. Accessed 2026-08-24. [event: 2026-08-19]
- yahoo.com. "A $10 billion Reason Why Micron Stock In Focus." August 20, 2026. https://finance.yahoo.com/markets/stocks/articles/10-billion-reason-why-micron-141402858.html. Accessed 2026-08-24. [event: 2026-08-20]

### Research and analyst houses

- DRAMeXchange (TrendForce). DRAMeXchange / TrendForce contract-price series. March 31, 2017. *(short entry)* [event: 2017-03-31]
- TechInsights. TechInsights teardown; Bloomberg reporting. August 29, 2023. *(short entry)* [event: 2023-08-29]
- TrendForce. IDC memory-crisis analysis; TrendForce contract data. December 10, 2025. *(short entry)* [event: 2025-12-10]
- TrendForce. SK hynix / Micron disclosures; TrendForce. December 1, 2023. *(short entry)* [event: 2023-12-01]
- TrendForce. TrendForce contract data; PC OEM build plans. June 30, 2022. *(short entry)* [event: 2022-06-30]
- TrendForce. TrendForce contract data; supplier capex guidance. October 1, 2018. *(short entry)* [event: 2018-10-01]
- TrendForce. TrendForce/IDC contract data; NAND Research crisis updates. March 10, 2026. *(short entry)* [event: 2026-03-10]
- TrendForce. Western Digital/Kioxia disclosures; TrendForce pricing data. February 10, 2022. *(short entry)* [event: 2022-02-10]
- trendforce.com. "[News] 7.1 Kumamoto Earthquake: TSMC Confirms JASM Safe; TEL Halts Plants as Chip Supply Chain Assesses Impact." July 29, 2026. https://www.trendforce.com/news/2026/07/29/news-7-1-kumamoto-earthquake-tsmc-confirms-jasm-safe-tel-halts-plants-as-chip-supply-chain-assesses-impact/. Accessed 2026-08-24. [event: 2026-07-29]

---

## 3. Methods and the literature behind them

Every technique the engine actually runs, tied to the file that runs it.
Verified against Crossref, Open Library or the issuing body — no DOI here
was written from memory.

**The declared priors are deliberately absent from this section.** The
12-day half-life, the transmission coefficients and the stage weights are
analyst judgement (Tier D). Attaching a reference to one of them would
launder an assumption into a finding, which is the opposite of what this
register is for. What is cited is the *form* of each calculation, never the
*values* fed into it.

### Betweenness centrality

Implemented in `app/src/engine/networkAnalysis.js — betweenness()`.

- Brandes, Ulrik. "A faster algorithm for betweenness centrality." *The Journal of Mathematical Sociology* 25, no. 2 (2001): 163–177. https://doi.org/10.1080/0022250x.2001.9990249.
  *Why cited:* The algorithm implemented, and the normalisation used.
  *Verified against:* Crossref.
- Freeman, Linton C. "A Set of Measures of Centrality Based on Betweenness." *Sociometry* 40, no. 1 (1977): 35. https://doi.org/10.2307/3033543.
  *Why cited:* The definition of the measure the algorithm computes.
  *Verified against:* Crossref.

### Disruption severity in supply chains

Implemented in `app/src/engine/index.js — severity and structural vulnerability`.

- Craighead, Christopher W., et al. "The Severity of Supply Chain Disruptions: Design Characteristics and Mitigation Capabilities." *Decision Sciences* 38, no. 1 (2007): 131–156. https://doi.org/10.1111/j.1540-5915.2007.00151.x.
  *Why cited:* The design factors that determine how severe a supply-chain disruption becomes — density, complexity, node criticality.
  *Verified against:* Crossref.

### Exponential decay of event salience

Implemented in `app/src/engine/persistence.js — the exponential profiles; app/src/engine/registry.js — acuteHalfLifeDays, marketHalfLifeDays`.

- Wu, Fang, and Bernardo A. Huberman. "Novelty and collective attention." *Proceedings of the National Academy of Sciences* 104, no. 45 (2007): 17599–17601. https://doi.org/10.1073/pnas.0704916104.
  *Why cited:* Empirical basis for treating attention to an event as decaying rather than persisting. The half-life values themselves are declared priors, not fitted values — and v7 applies a decay only to the two exponential profiles, not to standing controls, which are modelled as in force or not.
  *Verified against:* Crossref.

### Herfindahl–Hirschman concentration index

Implemented in `app/src/engine/math.js — hhiBounds()`.

- Hirschman, Albert Otto. *National Power and the Structure of Foreign Trade*. University of California Press, 1945. https://openlibrary.org/works/OL2745858W.
  *Why cited:* Where the concentration index originates. Hirschman introduced it here; Herfindahl arrived at it independently in 1950, and the joint name is later usage. v7 publishes the index as a `[lower, upper]` interval, because the concentration of the undisclosed residual is not identified by the observed shares.
  *Verified against:* Open Library.
- U.S. Department of Justice and Federal Trade Commission. *Merger Guidelines*. 2023. https://www.ftc.gov/system/files/ftc_gov/pdf/2023_merger_guidelines_final_12.18.2023.pdf.
  *Why cited:* The concentration thresholds the screening rules are set against. Cited for the thresholds only: this model measures share of a modeled sample, not a legally defined market.
  *Verified against:* Publisher website. Document identity confirmed at the issuing agency; PDF body text not parsed.

### Input-output structure

Implemented in `app/src/engine/propagation.js — stage dependency matrices`.

- Miller, Ronald E., and Peter D. Blair. "Input-Output Analysis." Cambridge University Press, 2009. https://doi.org/10.1017/cbo9780511626982.
  *Why cited:* The input-output framework the stage graph approximates. Cited to be explicit that the dependence matrices are equal-allocation priors, not measured technical coefficients.
  *Verified against:* Crossref.

### Node-removal sensitivity

Implemented in `app/src/engine/networkAnalysis.js — removal_impact metric`.

- Albert, Réka, Hawoong Jeong, and Albert-László Barabási. "Error and attack tolerance of complex networks." *Nature* 406, no. 6794 (2000): 378–382. https://doi.org/10.1038/35019019.
  *Why cited:* The attack-tolerance framing: how much connectivity a network loses when a node is removed.
  *Verified against:* Crossref.

### Bounded saturating aggregation (noisy-OR functional form)

Implemented in `app/src/engine/aggregation.js`. Cited for the **functional form only**: v7 uses it as a bounded aggregation operator across distinct incidents, for monotonicity and saturation, and not as a probability calculation — the inputs are bounded exposure scores, not probabilities, and no independence assumption is made.

- Oniśko, Agnieszka, Marek J. Druzdzel, and Hanna Wasyluk. "Learning Bayesian network parameters from small data sets: application of Noisy-OR gates." *International Journal of Approximate Reasoning* 27, no. 2 (2001): 165–182. https://doi.org/10.1016/s0888-613x(01)00039-1.
  *Why cited:* The noisy-OR gate as a parameter-reduction device, and its behaviour on small samples.
  *Verified against:* Crossref.
- Pearl, Judea. *Probabilistic Reasoning in Intelligent Systems*. Morgan Kaufmann Publishers, 1988. https://openlibrary.org/works/OL4624598W.
  *Why cited:* Origin of the noisy-OR gate: combining independent causes of an effect without letting the combination exceed its bound.
  *Verified against:* Open Library.

### One-at-a-time sensitivity bands

Implemented in `app/src/engine/priors.js — low/high prior bands`.

- Saltelli, Andrea, and Paola Annoni. "How to avoid a perfunctory sensitivity analysis." *Environmental Modelling &amp; Software* 25, no. 12 (2010): 1508–1517. https://doi.org/10.1016/j.envsoft.2010.04.012.
  *Why cited:* Global sensitivity analysis reference, and the standard critique of the one-at-a-time approach this model uses. Cited as a stated limitation, not as endorsement.
  *Verified against:* Crossref.

### Shock propagation in production networks

Implemented in `app/src/engine/index.js — operational impact propagation`.

- Barrot, Jean-Noël, and Julien Sauvagnat. "Input Specificity and the Propagation of Idiosyncratic Shocks in Production Networks." *The Quarterly Journal of Economics* 131, no. 3 (2016): 1543–1592. https://doi.org/10.1093/qje/qjw018.
  *Why cited:* Evidence that input specificity — the absence of substitutes — governs propagation strength. The dependence matrices encode this idea as a prior.
  *Verified against:* Crossref.
- Carvalho, Vasco M, et al. "Supply Chain Disruptions: Evidence from the Great East Japan Earthquake." *The Quarterly Journal of Economics* 136, no. 2 (2020): 1255–1321. https://doi.org/10.1093/qje/qjaa044.
  *Why cited:* Firm-level evidence from a natural disaster that upstream and downstream propagation both occur — the empirical case for a site-level layer.
  *Verified against:* Crossref.
- Inoue, Hiroyasu, and Yasuyuki Todo. "Firm-level propagation of shocks through supply-chain networks." *Nature Sustainability* 2, no. 9 (2019): 841–847. https://doi.org/10.1038/s41893-019-0351-x.
  *Why cited:* Simulation evidence on how far firm-level supply-chain shocks travel, supporting a bounded propagation horizon.
  *Verified against:* Crossref.
- "The Network Origins of Aggregate Fluctuations." *Econometrica* 80, no. 5 (2012): 1977–2016. https://doi.org/10.3982/ecta9623.
  *Why cited:* Why disaggregated network structure, rather than aggregate shares, governs how a local shock spreads.
  *Verified against:* Crossref.

### Topological ordering of a DAG

Implemented in `app/src/engine/math.js — topologicalSort()`.

- Kahn, A. B. "Topological sorting of large networks." *Communications of the ACM* 5, no. 11 (1962): 558–562. https://doi.org/10.1145/368996.369025.
  *Why cited:* The ordering algorithm used to evaluate stages in dependency order.
  *Verified against:* Crossref.

### Widest-path / bottleneck routing

Implemented in `app/src/engine/networkPaths.js — bottleneck objective`.

- Hu, T. C. "Letter to the Editor—The Maximum Capacity Route Problem." *Operations Research* 9, no. 6 (1961): 898–900. https://doi.org/10.1287/opre.9.6.898.
  *Why cited:* The maximum-capacity route problem, which the bottleneck ranking solves.
  *Verified against:* Crossref.

---

## 4. Institutional publishers cited

The bodies the register rests on, as organisational authors. Individual
documents appear in sections 2 and 3; this is the set of institutions.

**Filings**

- U.S. Securities and Exchange Commission. *EDGAR Full-Text Search*. https://www.sec.gov/edgar.

**Press**

- BBC News. News reporting.
- Bloomberg. Wire reporting.
- CNBC. Business reporting.
- DigiTimes. Supply-chain trade reporting.
- Focus Taiwan (Central News Agency). News reporting.
- Nikkei. Business reporting.
- Reuters. Wire reporting.

**Regulator**

- Cyberspace Administration of China. Cybersecurity review decisions.
- Government of the Netherlands. Export licensing measures for advanced semiconductor manufacturing equipment.
- Japan, Ministry of Economy, Trade and Industry (METI). Export control revisions and semiconductor industrial policy. https://www.meti.go.jp/english/.
- Office of the Federal Register. Rules, proposed rules, notices and presidential documents. https://www.federalregister.gov.
- Office of the United States Trade Representative. Section 301 and Section 232 actions.
- People's Republic of China, Ministry of Commerce (MOFCOM). Export control announcements, unreliable-entity listings and trade measures. http://english.mofcom.gov.cn.
- People's Republic of China, National Development and Reform Commission. Industrial policy and investment guidance.
- State Administration for Market Regulation (China). Merger review and antitrust decisions.
- U.S. Department of Commerce, Bureau of Industry and Security. Export Administration Regulations rulemaking, Entity List actions and denial orders. https://www.bis.gov.

**Research**

- Astute Group. Component market notes.
- Center for Strategic and International Studies. Export-control and technology policy analysis. https://www.csis.org.
- DRAMeXchange (TrendForce). Memory spot and contract pricing.
- International Data Corporation (IDC). Market tracking and forecasts. https://www.idc.com.
- MarketScreener. Shareholder and ownership data.
- NAND Research. Storage and memory industry analysis.
- SemiAnalysis. Semiconductor industry analysis. https://semianalysis.com.
- Silicon Analysts. Semiconductor market data.
- TechInsights. Teardown and process analysis. https://www.techinsights.com.
- TrendForce. Memory and foundry contract-price series, market-share research. https://www.trendforce.com.

---

## 5. Facility sources

Site identity, location and output come from publicly available company
facility listings and programme announcements — corporate self-published
material, cited as the corporate author. The significance ordinal on every
one of these records is **not** from the publisher: it is an analyst
judgement, and each record says so in its own source string.

| Corporate author | Sites cited |
| --- | --- |
| Air Liquide. Facility and site listings. Accessed 2026-08-24. | 2 |
| Air Products. Facility and site listings. Accessed 2026-08-24. | 2 |
| Alibaba Cloud. Facility and site listings. Accessed 2026-08-24. | 1 |
| Amazon/Annapurna. Facility and site listings. Accessed 2026-08-24. | 1 |
| AMD. Facility and site listings. Accessed 2026-08-24. | 4 |
| AMEC. Facility and site listings. Accessed 2026-08-24. | 1 |
| Amkor. Facility and site listings. Accessed 2026-08-24. | 4 |
| Analog Devices. Facility and site listings. Accessed 2026-08-24. | 4 |
| Ansys. Facility and site listings. Accessed 2026-08-24. | 1 |
| Apple. Facility and site listings. Accessed 2026-08-24. | 2 |
| Applied Materials. Facility and site listings. Accessed 2026-08-24. | 5 |
| Arm. Facility and site listings. Accessed 2026-08-24. | 2 |
| ASE. Facility and site listings. Accessed 2026-08-24. | 4 |
| ASM International. Facility and site listings. Accessed 2026-08-24. | 2 |
| ASML. Facility and site listings. Accessed 2026-08-24. | 2 |
| ASML/Cymer. Facility and site listings. Accessed 2026-08-24. | 1 |
| AT&S. Facility and site listings. Accessed 2026-08-24. | 3 |
| AWS. Facility and site listings. Accessed 2026-08-24. | 1 |
| Biren. Facility and site listings. Accessed 2026-08-24. | 1 |
| Bosch. Facility and site listings. Accessed 2026-08-24. | 2 |
| Broadcom. Facility and site listings. Accessed 2026-08-24. | 2 |
| Cadence. Facility and site listings. Accessed 2026-08-24. | 1 |
| Cambricon. Facility and site listings. Accessed 2026-08-24. | 1 |
| Canon. Facility and site listings. Accessed 2026-08-24. | 1 |
| CEA-Leti. Facility and site listings. Accessed 2026-08-24. | 1 |
| CXMT. Facility and site listings. Accessed 2026-08-24. | 2 |
| Denso. Facility and site listings. Accessed 2026-08-24. | 1 |
| DuPont. Facility and site listings. Accessed 2026-08-24. | 1 |
| DuPont Electronics. Facility and site listings. Accessed 2026-08-24. | 1 |
| Ebara. Facility and site listings. Accessed 2026-08-24. | 1 |
| Empyrean. Facility and site listings. Accessed 2026-08-24. | 1 |
| Entegris. Facility and site listings. Accessed 2026-08-24. | 3 |
| ESMC. Facility and site listings. Accessed 2026-08-24. | 1 |
| Foxconn. Facility and site listings. Accessed 2026-08-24. | 5 |
| GlobalFoundries. Facility and site listings. Accessed 2026-08-24. | 4 |
| GlobalWafers. Facility and site listings. Accessed 2026-08-24. | 2 |
| Google. Facility and site listings. Accessed 2026-08-24. | 2 |
| Hitachi High-Tech. Facility and site listings. Accessed 2026-08-24. | 2 |
| HP. Facility and site listings. Accessed 2026-08-24. | 1 |
| Hua Hong. Facility and site listings. Accessed 2026-08-24. | 2 |
| Huawei/HiSilicon. Facility and site listings. Accessed 2026-08-24. | 1 |
| Ibiden. Facility and site listings. Accessed 2026-08-24. | 2 |
| IBM. Facility and site listings. Accessed 2026-08-24. | 1 |
| IBM Research. Facility and site listings. Accessed 2026-08-24. | 1 |
| IBM Research / NY CREATES. Facility and site listings. Accessed 2026-08-24. | 1 |
| imec. Facility and site listings. Accessed 2026-08-24. | 1 |
| Inari. Facility and site listings. Accessed 2026-08-24. | 1 |
| Infineon. Facility and site listings. Accessed 2026-08-24. | 5 |
| Intel. Facility and site listings. Accessed 2026-08-24. | 12 |
| JASM/TSMC. Facility and site listings. Accessed 2026-08-24. | 1 |
| JCET. Facility and site listings. Accessed 2026-08-24. | 4 |
| JSR. Facility and site listings. Accessed 2026-08-24. | 1 |
| JSR/imec joint. Facility and site listings. Accessed 2026-08-24. | 1 |
| Kioxia. Facility and site listings. Accessed 2026-08-24. | 2 |
| KLA. Facility and site listings. Accessed 2026-08-24. | 3 |
| Kokusai Electric. Facility and site listings. Accessed 2026-08-24. | 1 |
| KYEC. Facility and site listings. Accessed 2026-08-24. | 1 |
| Lam Research. Facility and site listings. Accessed 2026-08-24. | 3 |
| Lenovo. Facility and site listings. Accessed 2026-08-24. | 1 |
| Linde. Facility and site listings. Accessed 2026-08-24. | 2 |
| Luxshare. Facility and site listings. Accessed 2026-08-24. | 2 |
| Marvell. Facility and site listings. Accessed 2026-08-24. | 1 |
| MediaTek. Facility and site listings. Accessed 2026-08-24. | 1 |
| Meta. Facility and site listings. Accessed 2026-08-24. | 1 |
| Microchip. Facility and site listings. Accessed 2026-08-24. | 4 |
| Micron. Facility and site listings. Accessed 2026-08-24. | 8 |
| Microsoft. Facility and site listings. Accessed 2026-08-24. | 1 |
| Nanya. Facility and site listings. Accessed 2026-08-24. | 1 |
| NAURA. Facility and site listings. Accessed 2026-08-24. | 1 |
| Nexchip. Facility and site listings. Accessed 2026-08-24. | 1 |
| Nikon. Facility and site listings. Accessed 2026-08-24. | 1 |
| Nova. Facility and site listings. Accessed 2026-08-24. | 1 |
| NSIG. Facility and site listings. Accessed 2026-08-24. | 1 |
| NVIDIA. Facility and site listings. Accessed 2026-08-24. | 2 |
| NXP. Facility and site listings. Accessed 2026-08-24. | 4 |
| onsemi. Facility and site listings. Accessed 2026-08-24. | 6 |
| Onto Innovation. Facility and site listings. Accessed 2026-08-24. | 2 |
| PTI. Facility and site listings. Accessed 2026-08-24. | 1 |
| Qualcomm. Facility and site listings. Accessed 2026-08-24. | 3 |
| Quanta. Facility and site listings. Accessed 2026-08-24. | 1 |
| Rapidus. Facility and site listings. Accessed 2026-08-24. | 1 |
| Renesas. Facility and site listings. Accessed 2026-08-24. | 6 |
| Resonac. Facility and site listings. Accessed 2026-08-24. | 1 |
| Samsung. Facility and site listings. Accessed 2026-08-24. | 8 |
| Samsung Electro-Mechanics. Facility and site listings. Accessed 2026-08-24. | 2 |
| Samsung packaging. Facility and site listings. Accessed 2026-08-24. | 1 |
| Shin-Etsu. Facility and site listings. Accessed 2026-08-24. | 3 |
| Shinko Electric. Facility and site listings. Accessed 2026-08-24. | 1 |
| Siemens EDA. Facility and site listings. Accessed 2026-08-24. | 1 |
| Siltronic. Facility and site listings. Accessed 2026-08-24. | 3 |
| SK hynix. Facility and site listings. Accessed 2026-08-24. | 6 |
| SK Materials. Facility and site listings. Accessed 2026-08-24. | 2 |
| SK Siltron. Facility and site listings. Accessed 2026-08-24. | 1 |
| SK Siltron CSS. Facility and site listings. Accessed 2026-08-24. | 1 |
| SMIC. Facility and site listings. Accessed 2026-08-24. | 4 |
| Sony Semiconductor Solutions. Facility and site listings. Accessed 2026-08-24. | 4 |
| SPIL. Facility and site listings. Accessed 2026-08-24. | 2 |
| STMicroelectronics. Facility and site listings. Accessed 2026-08-24. | 8 |
| SUMCO. Facility and site listings. Accessed 2026-08-24. | 3 |
| Sumitomo Chemical. Facility and site listings. Accessed 2026-08-24. | 1 |
| Supermicro. Facility and site listings. Accessed 2026-08-24. | 2 |
| Synopsys. Facility and site listings. Accessed 2026-08-24. | 2 |
| Taiyo Nippon Sanso. Facility and site listings. Accessed 2026-08-24. | 2 |
| Tesla. Facility and site listings. Accessed 2026-08-24. | 2 |
| Texas Instruments. Facility and site listings. Accessed 2026-08-24. | 7 |
| TOK. Facility and site listings. Accessed 2026-08-24. | 2 |
| Tokyo Electron. Facility and site listings. Accessed 2026-08-24. | 3 |
| Tower Semiconductor. Facility and site listings. Accessed 2026-08-24. | 1 |
| Tower/TPSCo. Facility and site listings. Accessed 2026-08-24. | 1 |
| TSMC. Facility and site listings. Accessed 2026-08-24. | 9 |
| TSMC advanced-packaging. Facility and site listings. Accessed 2026-08-24. | 1 |
| UMC. Facility and site listings. Accessed 2026-08-24. | 2 |
| Unimicron. Facility and site listings. Accessed 2026-08-24. | 2 |
| UNISOC. Facility and site listings. Accessed 2026-08-24. | 1 |
| UTAC. Facility and site listings. Accessed 2026-08-24. | 2 |
| VIS. Facility and site listings. Accessed 2026-08-24. | 2 |
| VIS/NXP. Facility and site listings. Accessed 2026-08-24. | 1 |
| Volkswagen. Facility and site listings. Accessed 2026-08-24. | 1 |
| Winbond. Facility and site listings. Accessed 2026-08-24. | 2 |
| Wistron. Facility and site listings. Accessed 2026-08-24. | 1 |
| Xiaomi. Facility and site listings. Accessed 2026-08-24. | 1 |
| YMTC. Facility and site listings. Accessed 2026-08-24. | 1 |

---

## 6. Evidence-note sources

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

## Tracing any entry back

```sql
SELECT id, date_iso, title, source FROM events WHERE date_iso = '<date>';
SELECT id, name, source FROM facilities WHERE source LIKE '<author>%';
SELECT tier, scope, source FROM data_notes ORDER BY tier;
```

Regenerate this document after any data change:

```bash
cd server && npm run sources
```
