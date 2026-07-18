/* ====================================================================
   COMPANY_TICKERS — company id → Yahoo Finance symbol, hand-curated.

   `null` = no public listing to quote (private, state-owned, research
   institute, or delisted/absorbed), with the reason noted inline. Where
   the vault entity is a division of a listed parent (Google TPU, Sony
   Semiconductor, Siemens EDA, …), the PARENT's listing is quoted — the
   UI labels it with the ticker so this is never ambiguous. Suffixes:
   .T Tokyo · .TW Taiwan (TWSE) · .TWO Taipei Exchange · .KS Korea ·
   .HK Hong Kong · .SS Shanghai · .SZ Shenzhen · .DE Xetra · .PA Paris ·
   .AS Amsterdam · .VI Vienna · .KL Bursa Malaysia · none = US listing.
   ==================================================================== */

export const COMPANY_TICKERS = {
  adi: 'ADI',
  airliquide: 'AI.PA',
  airproducts: 'APD',
  alibaba: 'BABA',
  amat: 'AMAT',
  amazon: 'AMZN',
  amd: 'AMD',
  amec: '688012.SS',
  amkor: 'AMKR',
  ansys: null,             // acquired by Synopsys (deal closed Jul 2025); see synopsys
  apple: 'AAPL',
  arm: 'ARM',
  ase: 'ASX',              // ASE Technology Holding NYSE ADR
  asmi: 'ASM.AS',
  asml: 'ASML',
  ats: 'ATS.VI',
  biren: null,             // private
  bosch: null,             // private (Robert Bosch Stiftung)
  broadcom: 'AVGO',
  cadence: 'CDNS',
  cambricon: '688256.SS',
  canon: '7751.T',
  cxmt: null,              // private
  denso: '6902.T',
  dupont: 'DD',
  ebara: '6361.T',
  empyrean: '301269.SZ',
  entegris: 'ENTG',
  foxconn: '2317.TW',      // Hon Hai Precision
  gf: 'GFS',
  globalwafers: '6488.TWO',
  google: 'GOOGL',         // parent listing (Alphabet)
  hisilicon: null,         // Huawei subsidiary, private
  hitachiht: null,         // taken private by Hitachi (2020)
  hp: 'HPQ',
  huahong: '1347.HK',
  ibiden: '4062.T',
  ibm_res: 'IBM',          // parent listing
  imec: null,              // research institute
  inari: '0166.KL',
  infineon: 'IFX.DE',
  intel: 'INTC',
  jcet: '600584.SS',
  jsr: null,               // taken private by JIC (2024)
  kioxia: '285A.T',
  kla: 'KLAC',
  kokusai: '6525.T',
  kyec: '2449.TW',
  lam: 'LRCX',
  lenovo: '0992.HK',
  leti: null,              // research institute (CEA)
  linde: 'LIN',
  luxshare: '002475.SZ',
  marvell: 'MRVL',
  mediatek: '2454.TW',
  meta: 'META',
  microchip: 'MCHP',
  micron: 'MU',
  microsoft: 'MSFT',
  nanya: '2408.TW',
  naura: '002371.SZ',
  nexchip: '688249.SS',
  nikon: '7731.T',
  nova: 'NVMI',
  nsig: '688126.SS',       // National Silicon Industry Group
  nvidia: 'NVDA',
  nxp: 'NXPI',
  onsemi: 'ON',
  onto: 'ONTO',
  pti: '6239.TW',
  qualcomm: 'QCOM',
  quanta: '2382.TW',
  rapidus: null,           // private (state/consortium backed)
  renesas: '6723.T',
  resonac: '4004.T',
  samsung: '005930.KS',
  samsungem: '009150.KS',
  shinetsu: '4063.T',
  shinko: null,            // taken private by JIC consortium (2025)
  siemens_eda: 'SIE.DE',   // parent listing (Siemens AG)
  siltronic: 'WAF.DE',
  skhynix: '000660.KS',
  skmaterials: null,       // merged into SK Inc. (2021), no separate listing
  sksiltron: null,         // private (SK-owned)
  smic: '0981.HK',
  sonysemi: '6758.T',      // parent listing (Sony Group)
  spil: null,              // absorbed into ASE Technology Holding (2018)
  st: 'STM',
  sumco: '3436.T',
  sumitomo_chem: '4005.T',
  supermicro: 'SMCI',
  synopsys: 'SNPS',
  tel: '8035.T',
  tesla: 'TSLA',
  ti: 'TXN',
  tnsc: '4091.T',          // Nippon Sanso Holdings
  tok: '4186.T',
  tower: 'TSEM',
  tsmc: 'TSM',
  umc: 'UMC',
  unimicron: '3037.TW',
  unisoc: null,            // private
  utac: null,              // private
  vis: '5347.TWO',
  vw: 'VOW3.DE',
  winbond: '2344.TW',
  wistron: '3231.TW',
  xiaomi: '1810.HK',
  ymtc: null,              // private
};
