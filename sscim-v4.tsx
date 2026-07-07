import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============ SSCIM v4 — OpenStreetMap layer + company→company impact spread ============
   Map: Leaflet + OSM tiles (dark-filtered), 16 country nodes fully derived
   Stage subsections: per-stage company shares · Event spread: hop-by-hop company exposure
   exposure(company @ stage) = within-stage share × propagated stage shock
   All shares/values/events are curated SAMPLE data — not live, not investment advice. */

const C = {
  bg: "#0C111C", panel: "#141B2B", panel2: "#0F1626", line: "#243149",
  copper: "#C98A3F", copperDim: "#8A6230",
  red: "#E25C4A", amber: "#DFA83D", green: "#4FA97F",
  text: "#E9E4D8", dim: "#8C96A8", faint: "#5A6478",
};

const WEIGHTS = { choke: 0.25, geo: 0.2, policy: 0.2, subst: 0.15, shock: 0.1, market: 0.1 };

/* ==================== i18n (phase 1: UI chrome + guide) ==================== */
let LANGV = "en";
const I18N = {
  en: {},
  zh: {
    fullname: "半导体供应链情报图", MODERATE: "中等", ELEVATED: "偏高", HIGH: "高风险",
    "LAYER 1 · WORLD MAP · OPENSTREETMAP": "图层 1 · 世界地图 · OPENSTREETMAP",
    "LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION": "图层 2 · 产业流程 · 点击环节查看子板块",
    "LAYER 3 · INTELLIGENCE PANEL": "图层 3 · 情报面板",
    Map: "地图", Flow: "流程", Intel: "情报",
    EVENTS: "事件", COMPANIES: "公司", "MOVERS 7D": "7日变动", CAPITAL: "资本",
    "? Guide": "? 指南", "⚡ GP Briefing": "⚡ GP 简报", "ⓘ Methodology": "ⓘ 方法论", "✦ Build scenario": "✦ 自建情景",
    scn_none: "基准", scn_strait: "台海危机", scn_materials: "中国材料禁令", scn_exportmax: "出口管制加码", scn_custom: "自定义冲击",
    "WHAT CHANGED": "变化速览", "CHAIN INDEX": "链指数", "Search…": "搜索…",
    guideTitle: "SSCIM 使用指南",
    g0: "三个联动图层：点击任一图层，其余两层同步响应。颜色含义：绿 <5.5 中等 · 黄 5.5–7.5 偏高 · 红 ≥7.5 高风险。",
    g1t: "从事件流开始", g1b: "点击任一事件卡片：地图与流程图高亮受影响国家与环节，详情区展示引擎算式、一二阶效应与逐跳公司传导树。",
    g2t: "浏览产业流程图", g2b: "点击某一环节（如沉积设备）展开子板块：主要公司、市场份额、当前冲击敞口及其客户占比。线宽=价值流量，圆点=重要度。",
    g3t: "深入单个公司", g3b: "点击公司查看：公司冲击指数（模拟全面中断）、生产足迹、客户与供应商占比、上游两层溯源及双视角传导树。",
    g4t: "查看公司冲击排名与资本榜", g4b: "COMPANIES 页签按链冲击排名；CAPITAL 页签展示按持股×链冲击计算的资本权力榜（政府关联资本以黄色标注）。",
    g5t: "运行情景或自建情景", g5b: "顶部按钮注入预设模拟事件；✦ 自建情景可自选环节、设置强度并运行同一引擎。铜色 +Δ 显示相对基准的变化。",
    g6t: "跟踪时间变化", g6b: "顶部迷你曲线为过去21天以同一衰减算法重算的链指数；7日变动页签列出本周变动最大的环节。搜索框可快速跳转。",
    g7t: "生成简报", g7b: "⚡ GP 简报按当前状态自动撰写每日情报简报，可复制或下载。ⓘ 方法论公开全部公式——没有黑箱。",
    gNote: "演示使用样本数据；事件与方法论文档暂为英文。仅为描述性分析，不构成投资建议。",
  },
  tw: {
    fullname: "半導體供應鏈情報圖", MODERATE: "中等", ELEVATED: "偏高", HIGH: "高風險",
    "LAYER 1 · WORLD MAP · OPENSTREETMAP": "圖層 1 · 世界地圖 · OPENSTREETMAP",
    "LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION": "圖層 2 · 產業流程 · 點擊環節查看子板塊",
    "LAYER 3 · INTELLIGENCE PANEL": "圖層 3 · 情報面板",
    Map: "地圖", Flow: "流程", Intel: "情報",
    EVENTS: "事件", COMPANIES: "公司", "MOVERS 7D": "7日變動", CAPITAL: "資本",
    "? Guide": "? 指南", "⚡ GP Briefing": "⚡ GP 簡報", "ⓘ Methodology": "ⓘ 方法論", "✦ Build scenario": "✦ 自建情境",
    scn_none: "基準", scn_strait: "台海危機", scn_materials: "中國材料禁令", scn_exportmax: "出口管制加碼", scn_custom: "自訂衝擊",
    "WHAT CHANGED": "變化速覽", "CHAIN INDEX": "鏈指數", "Search…": "搜尋…",
    guideTitle: "SSCIM 使用指南",
    g0: "三個聯動圖層：點擊任一圖層，其餘兩層同步響應。顏色含義：綠 <5.5 中等 · 黃 5.5–7.5 偏高 · 紅 ≥7.5 高風險。",
    g1t: "從事件流開始", g1b: "點擊任一事件卡片：地圖與流程圖高亮受影響國家與環節，詳情區展示引擎算式、一二階效應與逐跳公司傳導樹。",
    g2t: "瀏覽產業流程圖", g2b: "點擊某一環節（如沉積設備）展開子板塊：主要公司、市場份額、當前衝擊敞口及其客戶佔比。線寬=價值流量，圓點=重要度。",
    g3t: "深入單一公司", g3b: "點擊公司查看：公司衝擊指數（模擬全面中斷）、生產足跡、客戶與供應商佔比、上游兩層溯源及雙視角傳導樹。",
    g4t: "查看公司衝擊排名與資本榜", g4b: "COMPANIES 頁籤按鏈衝擊排名；CAPITAL 頁籤展示按持股×鏈衝擊計算的資本權力榜（政府關聯資本以黃色標註）。",
    g5t: "執行情境或自建情境", g5b: "頂部按鈕注入預設模擬事件；✦ 自建情境可自選環節、設定強度並執行同一引擎。銅色 +Δ 顯示相對基準的變化。",
    g6t: "追蹤時間變化", g6b: "頂部迷你曲線為過去21天以同一衰減演算法重算的鏈指數；7日變動頁籤列出本週變動最大的環節。搜尋框可快速跳轉。",
    g7t: "產生簡報", g7b: "⚡ GP 簡報按當前狀態自動撰寫每日情報簡報，可複製或下載。ⓘ 方法論公開全部公式——沒有黑箱。",
    gNote: "示範使用樣本數據；事件與方法論文件暫為英文。僅為描述性分析，不構成投資建議。",
  },
  ja: {
    fullname: "半導体サプライチェーン・インテリジェンスマップ", MODERATE: "中程度", ELEVATED: "警戒", HIGH: "高リスク",
    "LAYER 1 · WORLD MAP · OPENSTREETMAP": "レイヤー 1 · 世界地図 · OPENSTREETMAP",
    "LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION": "レイヤー 2 · 産業フロー · 工程をタップで詳細",
    "LAYER 3 · INTELLIGENCE PANEL": "レイヤー 3 · インテリジェンスパネル",
    Map: "地図", Flow: "フロー", Intel: "情報",
    EVENTS: "イベント", COMPANIES: "企業", "MOVERS 7D": "7日変動", CAPITAL: "資本",
    "? Guide": "? ガイド", "⚡ GP Briefing": "⚡ GPブリーフィング", "ⓘ Methodology": "ⓘ 方法論", "✦ Build scenario": "✦ シナリオ作成",
    scn_none: "ベースライン", scn_strait: "台湾海峡危機", scn_materials: "中国材料禁輸", scn_exportmax: "輸出規制強化", scn_custom: "カスタムショック",
    "WHAT CHANGED": "変更点", "CHAIN INDEX": "チェーン指数", "Search…": "検索…",
    guideTitle: "SSCIMの使い方",
    g0: "3つのレイヤーは連動しています。どこかをタップすると他の2つも反応します。色：緑 <5.5 中程度 · 黄 5.5–7.5 警戒 · 赤 ≥7.5 高リスク。",
    g1t: "イベントフィードから始める", g1b: "イベントカードをタップ：影響国と工程がハイライトされ、詳細にはエンジンの計算式、一次・二次効果、ホップごとの企業波及ツリーが表示されます。",
    g2t: "産業フローを探索", g2b: "工程（例：成膜装置）をタップするとサブセクションが開き、主要企業・市場シェア・現在のショック・顧客構成比が表示されます。線の太さ=価値フロー、ドット=重要度。",
    g3t: "企業を深掘り", g3b: "企業をタップ：企業インパクト指数（全面停止シミュレーション）、事業フットプリント、顧客・サプライヤー比率、2層の上流トレース、2種類の波及ツリー。",
    g4t: "企業ランキングと資本ランキング", g4b: "COMPANIESタブはチェーン影響度順。CAPITALタブは持株比率×影響度で算出した資本パワーランキング（政府系資本は黄色）。",
    g5t: "シナリオを実行・作成", g5b: "上部ボタンでプリセットのシミュレーションを注入。✦ シナリオ作成で任意の工程と強度を選び、同じエンジンで実行できます。銅色の +Δ が基準比の変化。",
    g6t: "時間変化を追跡", g6b: "上部のスパークラインは過去21日間を同じ減衰式で再計算したチェーン指数。7日変動タブは今週の変動上位を表示。検索ボックスで即ジャンプ。",
    g7t: "ブリーフィングを生成", g7b: "⚡ GPブリーフィングは現在の状態から日次インテリジェンスを自動作成（コピー/ダウンロード可）。ⓘ 方法論で全数式を公開——ブラックボックスなし。",
    gNote: "デモはサンプルデータ。イベント・方法論の本文は現在英語です。記述的分析であり投資助言ではありません。",
  },
};
const t = (k) => (I18N[LANGV] && I18N[LANGV][k]) || k;
const COMP_META = {
  choke: ["Chokepoint centrality", "GRAPH"], geo: ["Geographic concentration", "HHI"],
  policy: ["Policy exposure", "POLICY DB"], subst: ["Substitutability risk", "ANALYST"],
  shock: ["Event shock severity", "EVENT ENGINE"], market: ["Market sensitivity", "ANALYST"],
};

const COUNTRY_NAMES = {
  us: "United States", cn: "China", tw: "Taiwan", kr: "South Korea", jp: "Japan",
  nl: "Netherlands", de: "Germany", fr: "France", uk: "United Kingdom", be: "Belgium",
  ie: "Ireland", il: "Israel", sg: "Singapore", my: "Malaysia", vn: "Vietnam", ph: "Philippines",
};
const COUNTRY_POS = {
  us: [39, -98], cn: [35, 104], tw: [23.7, 121], kr: [36.5, 127.8], jp: [36.2, 138.2],
  nl: [52.5, 5.3], de: [50.5, 10.4], fr: [46.5, 2.5], uk: [54.5, -2], be: [50.6, 4.5],
  ie: [53.2, -8], il: [31.5, 35], sg: [1.35, 103.8], my: [4.2, 102], vn: [16, 106], ph: [13, 122],
};

/* ---------------- Stages ---------------- */
const STAGES = [
  { id: "research", name: "Research / IP", x: 70, y: 45, value: 20, subst: 6.5, market: 3.0,
    shares: { us: 0.3, uk: 0.2, be: 0.15, de: 0.1, jp: 0.1, cn: 0.1, fr: 0.05 } },
  { id: "eda", name: "EDA software", x: 70, y: 115, value: 15, subst: 9.0, market: 5.0,
    shares: { us: 0.7, de: 0.15, cn: 0.1, jp: 0.05 } },
  { id: "design", name: "Chip design", x: 70, y: 185, value: 250, subst: 6.0, market: 9.0,
    shares: { us: 0.5, tw: 0.15, cn: 0.15, kr: 0.07, jp: 0.05, il: 0.05, uk: 0.03 } },
  { id: "wafers", name: "Silicon wafers", x: 70, y: 255, value: 15, subst: 7.5, market: 4.0,
    shares: { jp: 0.55, tw: 0.15, kr: 0.1, de: 0.1, cn: 0.1 } },
  { id: "resist", name: "Photoresists", x: 70, y: 325, value: 3, subst: 8.5, market: 3.5,
    shares: { jp: 0.8, us: 0.1, kr: 0.05, cn: 0.05 } },
  { id: "gases", name: "Specialty gases / chem", x: 70, y: 395, value: 8, subst: 7.0, market: 3.5,
    shares: { jp: 0.25, de: 0.2, fr: 0.2, us: 0.15, cn: 0.1, kr: 0.1 } },
  { id: "substrates", name: "IC substrates (ABF)", x: 70, y: 465, value: 12, subst: 7.5, market: 4.5,
    shares: { jp: 0.5, tw: 0.25, kr: 0.15, cn: 0.1 } },
  { id: "litho", name: "Lithography (EUV/DUV)", x: 300, y: 85, value: 30, subst: 9.8, market: 7.0,
    shares: { nl: 0.8, jp: 0.2 } },
  { id: "depo", name: "Deposition", x: 300, y: 175, value: 20, subst: 7.5, market: 6.0,
    shares: { us: 0.45, jp: 0.3, kr: 0.1, cn: 0.1, nl: 0.05 } },
  { id: "etch", name: "Etch & clean", x: 300, y: 265, value: 22, subst: 7.5, market: 6.0,
    shares: { us: 0.5, jp: 0.3, cn: 0.15, kr: 0.05 } },
  { id: "cmp", name: "CMP & slurries", x: 300, y: 355, value: 6, subst: 6.5, market: 4.0,
    shares: { us: 0.45, jp: 0.4, kr: 0.1, fr: 0.05 } },
  { id: "metro", name: "Metrology / inspection", x: 300, y: 445, value: 13, subst: 8.0, market: 5.5,
    shares: { us: 0.6, jp: 0.2, nl: 0.1, il: 0.05, de: 0.05 } },
  { id: "adv_fab", name: "Advanced fab (≤7nm)", x: 520, y: 130, value: 120, subst: 9.5, market: 8.5,
    shares: { tw: 0.62, kr: 0.2, us: 0.12, jp: 0.04, ie: 0.02 } },
  { id: "mature_fab", name: "Mature-node fab", x: 520, y: 265, value: 90, subst: 5.0, market: 6.0,
    shares: { cn: 0.28, tw: 0.28, us: 0.1, jp: 0.1, de: 0.08, kr: 0.06, sg: 0.04, il: 0.03, fr: 0.03 } },
  { id: "memory_fab", name: "Memory fab (DRAM/NAND)", x: 520, y: 400, value: 130, subst: 6.5, market: 8.5,
    shares: { kr: 0.6, us: 0.2, cn: 0.1, jp: 0.08, sg: 0.02 } },
  { id: "logic_ai", name: "Logic & AI accelerators", x: 690, y: 90, value: 300, subst: 6.5, market: 9.5,
    shares: { us: 0.6, tw: 0.15, cn: 0.15, kr: 0.1 } },
  { id: "analog", name: "Analog / power / RF", x: 690, y: 265, value: 90, subst: 5.0, market: 6.0,
    shares: { us: 0.3, de: 0.2, jp: 0.2, cn: 0.15, fr: 0.1, il: 0.05 } },
  { id: "hbm", name: "HBM", x: 690, y: 415, value: 25, subst: 8.5, market: 9.0,
    shares: { kr: 0.8, us: 0.2 } },
  { id: "adv_pkg", name: "Advanced packaging", x: 860, y: 170, value: 45, subst: 8.0, market: 7.5,
    shares: { tw: 0.5, us: 0.15, kr: 0.15, cn: 0.1, my: 0.05, sg: 0.05 } },
  { id: "osat", name: "OSAT / test", x: 860, y: 350, value: 40, subst: 4.5, market: 5.0,
    shares: { tw: 0.4, cn: 0.2, my: 0.15, us: 0.08, sg: 0.07, ph: 0.05, vn: 0.05 } },
  { id: "systems", name: "Final systems (ODM/EMS)", x: 1000, y: 260, value: 500, subst: 3.5, market: 6.5,
    shares: { cn: 0.4, tw: 0.18, us: 0.12, my: 0.1, vn: 0.1, de: 0.05, sg: 0.05 } },
  { id: "m_ai", name: "AI data centers", x: 1140, y: 110, value: 350, subst: 3.0, market: 9.0,
    shares: { us: 0.5, cn: 0.25, de: 0.1, jp: 0.1, sg: 0.05 } },
  { id: "m_auto", name: "Automotive / industrial", x: 1140, y: 260, value: 90, subst: 3.5, market: 6.0,
    shares: { de: 0.3, cn: 0.3, us: 0.2, jp: 0.15, fr: 0.05 } },
  { id: "m_consumer", name: "Consumer / mobile", x: 1140, y: 410, value: 250, subst: 3.0, market: 6.5,
    shares: { cn: 0.4, us: 0.25, kr: 0.2, jp: 0.1, vn: 0.05 } },
];

const FLOW_EDGES = [
  ["research", "eda"], ["research", "design"], ["eda", "design"],
  ["design", "adv_fab"], ["design", "mature_fab"],
  ["wafers", "adv_fab"], ["wafers", "mature_fab"], ["wafers", "memory_fab"],
  ["resist", "litho"], ["gases", "depo"], ["gases", "etch"], ["substrates", "adv_pkg"],
  ["litho", "adv_fab"], ["litho", "mature_fab"], ["litho", "memory_fab"],
  ["depo", "adv_fab"], ["depo", "memory_fab"],
  ["etch", "adv_fab"], ["etch", "mature_fab"],
  ["cmp", "adv_fab"], ["metro", "adv_fab"], ["metro", "memory_fab"],
  ["adv_fab", "logic_ai"], ["mature_fab", "analog"], ["memory_fab", "hbm"], ["memory_fab", "osat"],
  ["logic_ai", "adv_pkg"], ["hbm", "adv_pkg"], ["analog", "osat"],
  ["adv_pkg", "systems"], ["osat", "systems"],
  ["systems", "m_ai"], ["systems", "m_auto"], ["systems", "m_consumer"],
];

/* ---------------- Companies (within-stage shares, sample) ---------------- */
const COMPANIES = [
  { id: "arm", name: "Arm", country: "uk", stakes: { research: 0.35 } },
  { id: "imec", name: "imec", country: "be", stakes: { research: 0.2 } },
  { id: "synopsys", name: "Synopsys", country: "us", stakes: { eda: 0.32 } },
  { id: "cadence", name: "Cadence", country: "us", stakes: { eda: 0.3 } },
  { id: "siemens_eda", name: "Siemens EDA", country: "de", stakes: { eda: 0.14 } },
  { id: "nvidia", name: "NVIDIA", country: "us", stakes: { design: 0.22, logic_ai: 0.5 } },
  { id: "amd", name: "AMD", country: "us", stakes: { design: 0.1, logic_ai: 0.13 } },
  { id: "qualcomm", name: "Qualcomm", country: "us", stakes: { design: 0.12 } },
  { id: "apple", name: "Apple (silicon)", country: "us", stakes: { design: 0.1, m_consumer: 0.22 } },
  { id: "mediatek", name: "MediaTek", country: "tw", stakes: { design: 0.1 } },
  { id: "hisilicon", name: "HiSilicon (Huawei)", country: "cn", stakes: { design: 0.06, logic_ai: 0.08 } },
  { id: "shinetsu", name: "Shin-Etsu", country: "jp", stakes: { wafers: 0.3, resist: 0.2 } },
  { id: "sumco", name: "SUMCO", country: "jp", stakes: { wafers: 0.25 } },
  { id: "globalwafers", name: "GlobalWafers", country: "tw", stakes: { wafers: 0.15 } },
  { id: "jsr", name: "JSR", country: "jp", stakes: { resist: 0.3 } },
  { id: "tok", name: "TOK", country: "jp", stakes: { resist: 0.25 } },
  { id: "linde", name: "Linde", country: "de", stakes: { gases: 0.2 } },
  { id: "airliquide", name: "Air Liquide", country: "fr", stakes: { gases: 0.2 } },
  { id: "ibiden", name: "Ibiden", country: "jp", stakes: { substrates: 0.3 } },
  { id: "unimicron", name: "Unimicron", country: "tw", stakes: { substrates: 0.25 } },
  { id: "asml", name: "ASML", country: "nl", stakes: { litho: 0.8, metro: 0.1 } },
  { id: "nikon", name: "Nikon", country: "jp", stakes: { litho: 0.12 } },
  { id: "canon", name: "Canon", country: "jp", stakes: { litho: 0.08 } },
  { id: "amat", name: "Applied Materials", country: "us", stakes: { depo: 0.3, etch: 0.15, cmp: 0.4 } },
  { id: "tel", name: "Tokyo Electron", country: "jp", stakes: { depo: 0.25, etch: 0.25 } },
  { id: "lam", name: "Lam Research", country: "us", stakes: { depo: 0.15, etch: 0.35 } },
  { id: "kla", name: "KLA", country: "us", stakes: { metro: 0.55 } },
  { id: "tsmc", name: "TSMC", country: "tw", stakes: { adv_fab: 0.62, mature_fab: 0.2, adv_pkg: 0.35 } },
  { id: "samsung", name: "Samsung", country: "kr", stakes: { adv_fab: 0.2, memory_fab: 0.35, hbm: 0.35, m_consumer: 0.2 } },
  { id: "intel", name: "Intel", country: "us", stakes: { adv_fab: 0.1, adv_pkg: 0.08 } },
  { id: "rapidus", name: "Rapidus", country: "jp", stakes: { adv_fab: 0.02 } },
  { id: "smic", name: "SMIC", country: "cn", stakes: { mature_fab: 0.12 } },
  { id: "umc", name: "UMC", country: "tw", stakes: { mature_fab: 0.12 } },
  { id: "gf", name: "GlobalFoundries", country: "us", stakes: { mature_fab: 0.08 } },
  { id: "ti", name: "Texas Instruments", country: "us", stakes: { mature_fab: 0.05, analog: 0.18 } },
  { id: "infineon", name: "Infineon", country: "de", stakes: { analog: 0.15 } },
  { id: "st", name: "STMicro", country: "fr", stakes: { analog: 0.12, mature_fab: 0.03 } },
  { id: "tower", name: "Tower Semi", country: "il", stakes: { mature_fab: 0.03 } },
  { id: "skhynix", name: "SK hynix", country: "kr", stakes: { memory_fab: 0.3, hbm: 0.5 } },
  { id: "micron", name: "Micron", country: "us", stakes: { memory_fab: 0.22, hbm: 0.15 } },
  { id: "ymtc", name: "YMTC / CXMT", country: "cn", stakes: { memory_fab: 0.08 } },
  { id: "ase", name: "ASE", country: "tw", stakes: { adv_pkg: 0.12, osat: 0.3 } },
  { id: "amkor", name: "Amkor", country: "us", stakes: { osat: 0.15, adv_pkg: 0.08 } },
  { id: "jcet", name: "JCET", country: "cn", stakes: { osat: 0.12 } },
  { id: "foxconn", name: "Foxconn", country: "tw", stakes: { systems: 0.35 } },
  /* ---- expansion to ~100 companies ---- */
  { id: "ibm_res", name: "IBM Research", country: "us", stakes: { research: 0.1 } },
  { id: "leti", name: "CEA-Leti", country: "fr", stakes: { research: 0.08 } },
  { id: "ansys", name: "Ansys", country: "us", stakes: { eda: 0.08 } },
  { id: "empyrean", name: "Empyrean", country: "cn", stakes: { eda: 0.05 } },
  { id: "broadcom", name: "Broadcom", country: "us", stakes: { design: 0.12 } },
  { id: "marvell", name: "Marvell", country: "us", stakes: { design: 0.05 } },
  { id: "unisoc", name: "UNISOC", country: "cn", stakes: { design: 0.04 } },
  { id: "sksiltron", name: "SK Siltron", country: "kr", stakes: { wafers: 0.1 } },
  { id: "siltronic", name: "Siltronic", country: "de", stakes: { wafers: 0.1 } },
  { id: "nsig", name: "NSIG", country: "cn", stakes: { wafers: 0.06 } },
  { id: "sumitomo_chem", name: "Sumitomo Chemical", country: "jp", stakes: { resist: 0.1 } },
  { id: "dupont", name: "DuPont", country: "us", stakes: { resist: 0.08 } },
  { id: "resonac", name: "Resonac", country: "jp", stakes: { gases: 0.12 } },
  { id: "tnsc", name: "Taiyo Nippon Sanso", country: "jp", stakes: { gases: 0.1 } },
  { id: "airproducts", name: "Air Products", country: "us", stakes: { gases: 0.1 } },
  { id: "skmaterials", name: "SK Materials", country: "kr", stakes: { gases: 0.08 } },
  { id: "shinko", name: "Shinko Electric", country: "jp", stakes: { substrates: 0.2 } },
  { id: "samsungem", name: "Samsung Electro-Mech", country: "kr", stakes: { substrates: 0.12 } },
  { id: "ats", name: "AT&S", country: "de", stakes: { substrates: 0.08 } },
  { id: "asmi", name: "ASM International", country: "nl", stakes: { depo: 0.12 } },
  { id: "kokusai", name: "Kokusai Electric", country: "jp", stakes: { depo: 0.08 } },
  { id: "naura", name: "NAURA", country: "cn", stakes: { depo: 0.06, etch: 0.08 } },
  { id: "amec", name: "AMEC", country: "cn", stakes: { etch: 0.07 } },
  { id: "hitachiht", name: "Hitachi High-Tech", country: "jp", stakes: { metro: 0.1, etch: 0.05 } },
  { id: "ebara", name: "Ebara", country: "jp", stakes: { cmp: 0.3 } },
  { id: "entegris", name: "Entegris", country: "us", stakes: { cmp: 0.12 } },
  { id: "onto", name: "Onto Innovation", country: "us", stakes: { metro: 0.08 } },
  { id: "nova", name: "Nova", country: "il", stakes: { metro: 0.06 } },
  { id: "huahong", name: "Hua Hong", country: "cn", stakes: { mature_fab: 0.06 } },
  { id: "vis", name: "Vanguard (VIS)", country: "tw", stakes: { mature_fab: 0.04 } },
  { id: "nexchip", name: "Nexchip", country: "cn", stakes: { mature_fab: 0.04 } },
  { id: "sonysemi", name: "Sony Semiconductor", country: "jp", stakes: { mature_fab: 0.05 } },
  { id: "renesas", name: "Renesas", country: "jp", stakes: { analog: 0.1, mature_fab: 0.04 } },
  { id: "bosch", name: "Bosch", country: "de", stakes: { mature_fab: 0.03, m_auto: 0.1 } },
  { id: "nanya", name: "Nanya", country: "tw", stakes: { memory_fab: 0.03 } },
  { id: "winbond", name: "Winbond", country: "tw", stakes: { memory_fab: 0.02 } },
  { id: "google", name: "Google (TPU/Cloud)", country: "us", stakes: { logic_ai: 0.06, m_ai: 0.1 } },
  { id: "amazon", name: "Amazon (AWS)", country: "us", stakes: { logic_ai: 0.04, m_ai: 0.15 } },
  { id: "cambricon", name: "Cambricon", country: "cn", stakes: { logic_ai: 0.03 } },
  { id: "biren", name: "Biren", country: "cn", stakes: { logic_ai: 0.02 } },
  { id: "onsemi", name: "onsemi", country: "us", stakes: { analog: 0.1 } },
  { id: "adi", name: "Analog Devices", country: "us", stakes: { analog: 0.12 } },
  { id: "nxp", name: "NXP", country: "nl", stakes: { analog: 0.1 } },
  { id: "microchip", name: "Microchip", country: "us", stakes: { analog: 0.05 } },
  { id: "spil", name: "SPIL", country: "tw", stakes: { adv_pkg: 0.08 } },
  { id: "pti", name: "Powertech (PTI)", country: "tw", stakes: { adv_pkg: 0.06 } },
  { id: "utac", name: "UTAC", country: "sg", stakes: { osat: 0.06 } },
  { id: "kyec", name: "KYEC", country: "tw", stakes: { osat: 0.05 } },
  { id: "inari", name: "Inari Amertron", country: "my", stakes: { osat: 0.04 } },
  { id: "quanta", name: "Quanta", country: "tw", stakes: { systems: 0.12 } },
  { id: "wistron", name: "Wistron", country: "tw", stakes: { systems: 0.08 } },
  { id: "supermicro", name: "Supermicro", country: "us", stakes: { systems: 0.05 } },
  { id: "luxshare", name: "Luxshare", country: "cn", stakes: { systems: 0.06 } },
  { id: "microsoft", name: "Microsoft (Azure)", country: "us", stakes: { m_ai: 0.18 } },
  { id: "meta", name: "Meta", country: "us", stakes: { m_ai: 0.12 } },
  { id: "alibaba", name: "Alibaba Cloud", country: "cn", stakes: { m_ai: 0.08 } },
  { id: "tesla", name: "Tesla", country: "us", stakes: { m_auto: 0.08 } },
  { id: "denso", name: "Toyota / Denso", country: "jp", stakes: { m_auto: 0.12 } },
  { id: "vw", name: "VW Group", country: "de", stakes: { m_auto: 0.1 } },
  { id: "xiaomi", name: "Xiaomi", country: "cn", stakes: { m_consumer: 0.1 } },
  { id: "lenovo", name: "Lenovo", country: "cn", stakes: { m_consumer: 0.08 } },
  { id: "hp", name: "HP", country: "us", stakes: { m_consumer: 0.05 } },
];
const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));

/* ---------------- Customer graph: supplier → [[customer, share of supplier's sales]] (sample) ---------------- */
const CUSTOMERS = {
  asml: [["tsmc", 0.35], ["samsung", 0.25], ["intel", 0.2], ["skhynix", 0.08], ["micron", 0.05]],
  nikon: [["intel", 0.2], ["smic", 0.15], ["umc", 0.1]],
  canon: [["smic", 0.2], ["ymtc", 0.12], ["umc", 0.1]],
  amat: [["tsmc", 0.3], ["samsung", 0.25], ["intel", 0.12], ["skhynix", 0.1], ["micron", 0.08], ["smic", 0.05]],
  lam: [["samsung", 0.3], ["tsmc", 0.22], ["skhynix", 0.18], ["micron", 0.12], ["smic", 0.06]],
  tel: [["tsmc", 0.3], ["samsung", 0.25], ["skhynix", 0.12], ["micron", 0.08], ["rapidus", 0.05]],
  kla: [["tsmc", 0.35], ["samsung", 0.2], ["intel", 0.15], ["skhynix", 0.1]],
  shinetsu: [["tsmc", 0.3], ["samsung", 0.22], ["skhynix", 0.12], ["micron", 0.1], ["umc", 0.06], ["smic", 0.05]],
  sumco: [["tsmc", 0.28], ["samsung", 0.25], ["micron", 0.12], ["skhynix", 0.1]],
  globalwafers: [["tsmc", 0.25], ["umc", 0.15], ["gf", 0.12], ["st", 0.08]],
  jsr: [["tsmc", 0.3], ["samsung", 0.25], ["intel", 0.12], ["skhynix", 0.1]],
  tok: [["tsmc", 0.28], ["samsung", 0.22], ["skhynix", 0.12], ["smic", 0.08]],
  linde: [["tsmc", 0.2], ["samsung", 0.18], ["intel", 0.12], ["skhynix", 0.08], ["micron", 0.06]],
  airliquide: [["tsmc", 0.22], ["samsung", 0.15], ["st", 0.1], ["infineon", 0.08]],
  ibiden: [["intel", 0.3], ["nvidia", 0.2], ["tsmc", 0.15], ["amd", 0.12]],
  unimicron: [["nvidia", 0.25], ["amd", 0.15], ["mediatek", 0.12], ["intel", 0.1]],
  synopsys: [["nvidia", 0.12], ["apple", 0.1], ["qualcomm", 0.1], ["intel", 0.08], ["samsung", 0.08]],
  cadence: [["nvidia", 0.12], ["apple", 0.1], ["mediatek", 0.08], ["amd", 0.08]],
  siemens_eda: [["infineon", 0.15], ["st", 0.1], ["intel", 0.08]],
  arm: [["apple", 0.2], ["qualcomm", 0.18], ["mediatek", 0.15], ["samsung", 0.1], ["nvidia", 0.08]],
  imec: [["asml", 0.15], ["tsmc", 0.12], ["intel", 0.1], ["samsung", 0.1]],
  tsmc: [["apple", 0.25], ["nvidia", 0.22], ["amd", 0.1], ["qualcomm", 0.08], ["mediatek", 0.07], ["intel", 0.04]],
  samsung: [["nvidia", 0.12], ["qualcomm", 0.08], ["apple", 0.06]],
  skhynix: [["nvidia", 0.45], ["amd", 0.08]],
  micron: [["nvidia", 0.15], ["apple", 0.08], ["amd", 0.05]],
  smic: [["hisilicon", 0.25], ["qualcomm", 0.08]],
  umc: [["mediatek", 0.15], ["infineon", 0.06], ["ti", 0.05]],
  gf: [["amd", 0.12], ["qualcomm", 0.1], ["infineon", 0.05]],
  ymtc: [["hisilicon", 0.2]],
  ase: [["apple", 0.15], ["nvidia", 0.12], ["amd", 0.1], ["qualcomm", 0.1], ["mediatek", 0.08]],
  amkor: [["apple", 0.18], ["nvidia", 0.1], ["qualcomm", 0.1], ["infineon", 0.06]],
  jcet: [["hisilicon", 0.15], ["qualcomm", 0.1], ["mediatek", 0.08]],
  intel: [["foxconn", 0.15]],
  nvidia: [["microsoft", 0.2], ["meta", 0.12], ["amazon", 0.1], ["google", 0.08], ["foxconn", 0.15]],
  amd: [["foxconn", 0.2]],
  apple: [["foxconn", 0.55]],
  qualcomm: [["foxconn", 0.2]],
  mediatek: [["foxconn", 0.25]],
  hisilicon: [["foxconn", 0.1]],
  st: [["apple", 0.12], ["foxconn", 0.08]],
  ti: [["foxconn", 0.08]],
  infineon: [["foxconn", 0.06]],
  /* ---- expanded customer graph ---- */
  broadcom: [["apple", 0.2], ["google", 0.15], ["meta", 0.1]],
  marvell: [["amazon", 0.15], ["microsoft", 0.1]],
  asmi: [["tsmc", 0.3], ["samsung", 0.2], ["intel", 0.12], ["skhynix", 0.08]],
  kokusai: [["samsung", 0.25], ["tsmc", 0.15], ["micron", 0.1], ["skhynix", 0.1]],
  naura: [["smic", 0.3], ["huahong", 0.15], ["ymtc", 0.12], ["nexchip", 0.08]],
  amec: [["smic", 0.25], ["ymtc", 0.12], ["huahong", 0.1], ["tsmc", 0.1]],
  ebara: [["tsmc", 0.25], ["samsung", 0.2], ["intel", 0.1]],
  entegris: [["tsmc", 0.22], ["samsung", 0.18], ["intel", 0.1], ["micron", 0.08]],
  hitachiht: [["tsmc", 0.2], ["samsung", 0.15], ["skhynix", 0.1]],
  onto: [["tsmc", 0.2], ["samsung", 0.15], ["micron", 0.1]],
  nova: [["tsmc", 0.3], ["samsung", 0.15]],
  shinko: [["intel", 0.3], ["tsmc", 0.12], ["amd", 0.1]],
  samsungem: [["samsung", 0.35], ["qualcomm", 0.08]],
  ats: [["amd", 0.15], ["nvidia", 0.1], ["intel", 0.1]],
  sksiltron: [["samsung", 0.3], ["skhynix", 0.25], ["tsmc", 0.1]],
  siltronic: [["infineon", 0.12], ["st", 0.1], ["tsmc", 0.1], ["samsung", 0.1]],
  sumitomo_chem: [["tsmc", 0.25], ["samsung", 0.2], ["skhynix", 0.1]],
  dupont: [["intel", 0.15], ["tsmc", 0.15], ["micron", 0.1]],
  resonac: [["tsmc", 0.2], ["samsung", 0.15], ["skhynix", 0.1]],
  tnsc: [["tsmc", 0.2], ["samsung", 0.15]],
  airproducts: [["tsmc", 0.18], ["samsung", 0.15], ["intel", 0.12], ["micron", 0.08]],
  skmaterials: [["skhynix", 0.35], ["samsung", 0.2]],
  spil: [["apple", 0.12], ["mediatek", 0.12], ["nvidia", 0.08]],
  pti: [["micron", 0.2], ["skhynix", 0.12]],
  utac: [["ti", 0.12], ["infineon", 0.1], ["st", 0.08]],
  kyec: [["mediatek", 0.15], ["nvidia", 0.08]],
  inari: [["broadcom", 0.3]],
  quanta: [["microsoft", 0.2], ["meta", 0.12], ["amazon", 0.1], ["google", 0.08]],
  wistron: [["microsoft", 0.1], ["amazon", 0.08]],
  supermicro: [["meta", 0.1], ["microsoft", 0.08]],
  luxshare: [["apple", 0.6]],
  sonysemi: [["apple", 0.4], ["xiaomi", 0.08]],
  renesas: [["denso", 0.2], ["bosch", 0.08]],
  onsemi: [["tesla", 0.12], ["bosch", 0.08], ["vw", 0.06]],
  adi: [["apple", 0.1], ["tesla", 0.06]],
  nxp: [["bosch", 0.1], ["vw", 0.08], ["tesla", 0.05]],
  huahong: [["hisilicon", 0.1]],
};

/* ---------------- Company domains for logo favicons (nominative identification) ---------------- */
const DOMAINS = {
  arm: "arm.com", imec: "imec-int.com", synopsys: "synopsys.com", cadence: "cadence.com", siemens_eda: "eda.sw.siemens.com",
  nvidia: "nvidia.com", amd: "amd.com", qualcomm: "qualcomm.com", apple: "apple.com", mediatek: "mediatek.com", hisilicon: "hisilicon.com",
  shinetsu: "shinetsu.co.jp", sumco: "sumcosi.com", globalwafers: "sas-globalwafers.com", jsr: "jsr.co.jp", tok: "tok.co.jp",
  linde: "linde.com", airliquide: "airliquide.com", ibiden: "ibiden.com", unimicron: "unimicron.com",
  asml: "asml.com", nikon: "nikon.com", canon: "global.canon", amat: "appliedmaterials.com", tel: "tel.com", lam: "lamresearch.com", kla: "kla.com",
  tsmc: "tsmc.com", samsung: "samsung.com", intel: "intel.com", rapidus: "rapidus.inc", smic: "smics.com", umc: "umc.com",
  gf: "gf.com", ti: "ti.com", infineon: "infineon.com", st: "st.com", tower: "towersemi.com",
  skhynix: "skhynix.com", micron: "micron.com", ymtc: "ymtc.com", ase: "aseglobal.com", amkor: "amkor.com", jcet: "jcetglobal.com", foxconn: "foxconn.com",
  ibm_res: "ibm.com", leti: "leti-cea.fr", ansys: "ansys.com", empyrean: "empyrean.com.cn", broadcom: "broadcom.com", marvell: "marvell.com", unisoc: "unisoc.com",
  sksiltron: "sksiltron.com", siltronic: "siltronic.com", nsig: "nsig.com.cn", sumitomo_chem: "sumitomo-chem.co.jp", dupont: "dupont.com",
  resonac: "resonac.com", tnsc: "tn-sanso.co.jp", airproducts: "airproducts.com", skmaterials: "sk-inc.com",
  shinko: "shinko.co.jp", samsungem: "samsungsem.com", ats: "ats.net", asmi: "asm.com", kokusai: "kokusai-electric.com",
  naura: "naura.com", amec: "amec-inc.com", hitachiht: "hitachi-hightech.com", ebara: "ebara.com", entegris: "entegris.com",
  onto: "ontoinnovation.com", nova: "novami.com", huahong: "huahonggrace.com", vis: "vis.com.tw", nexchip: "nexchip.com.cn",
  sonysemi: "sony-semicon.com", renesas: "renesas.com", bosch: "bosch.com", nanya: "nanya.com", winbond: "winbond.com",
  google: "google.com", amazon: "amazon.com", cambricon: "cambricon.com", biren: "birentech.com",
  onsemi: "onsemi.com", adi: "analog.com", nxp: "nxp.com", microchip: "microchip.com",
  spil: "spil.com.tw", pti: "pti.com.tw", utac: "utacgroup.com", kyec: "kyec.com.tw", inari: "inari-amertron.com",
  quanta: "quantatw.com", wistron: "wistron.com", supermicro: "supermicro.com", luxshare: "luxshare-ict.com",
  microsoft: "microsoft.com", meta: "meta.com", alibaba: "alibabacloud.com", tesla: "tesla.com", denso: "denso.com", vw: "volkswagen-group.com",
  xiaomi: "xiaomi.com", lenovo: "lenovo.com", hp: "hp.com",
};
function Logo({ cid, size = 18 }) {
  const co = COMPANY_BY_ID[cid];
  const [err, setErr] = useState(false);
  if (!co) return null;
  const d = DOMAINS[cid];
  const initials = co.name.replace(/\(.*\)/, "").trim().split(/[\s/]+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span style={{ width: size, height: size, borderRadius: 4, background: "#1A2132", border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, verticalAlign: "middle" }}>
      {d && !err
        ? <img src={`https://www.google.com/s2/favicons?domain=${d}&sz=64`} width={size - 4} height={size - 4} style={{ objectFit: "contain", display: "block" }} onError={() => setErr(true)} loading="lazy" alt="" />
        : <span className="mono" style={{ fontSize: Math.max(7, size * 0.4), color: C.copper, fontWeight: 700, lineHeight: 1 }}>{initials}</span>}
    </span>
  );
}

/* Reverse lookup: company → [[supplier, that supplier's sales share to it]] */
const SUPPLIERS = {};
Object.entries(CUSTOMERS).forEach(([sup, list]) =>
  list.forEach(([cust, sh]) => { (SUPPLIERS[cust] = SUPPLIERS[cust] || []).push([sup, sh]); }));
Object.values(SUPPLIERS).forEach((arr) => arr.sort((a, b) => b[1] - a[1]));

const STAGE_COMPANIES = {};
STAGES.forEach((s) => (STAGE_COMPANIES[s.id] = []));
COMPANIES.forEach((c) => Object.entries(c.stakes).forEach(([sid, sh]) => STAGE_COMPANIES[sid].push([c.id, sh])));
Object.values(STAGE_COMPANIES).forEach((arr) => arr.sort((a, b) => b[1] - a[1]));

/* ---------------- Policy DB & events ---------------- */
const POLICIES = [
  { id: "bis", name: "U.S. BIS AI-chip & SME export controls", sev: 9, stages: ["logic_ai", "hbm", "adv_fab", "litho", "depo", "etch", "metro"] },
  { id: "nl", name: "Dutch lithography export licensing", sev: 8, stages: ["litho"] },
  { id: "meti", name: "Japan METI equipment & material controls", sev: 6, stages: ["depo", "etch", "resist", "metro"] },
  { id: "cnmat", name: "China Ga/Ge/graphite export licensing", sev: 7, stages: ["gases", "analog", "wafers"] },
  { id: "chips", name: "CHIPS Act / EU Chips Act incentives", sev: 4, stages: ["adv_fab", "mature_fab", "memory_fab"] },
  { id: "twp", name: "Taiwan core-technology protection rules", sev: 5, stages: ["adv_fab", "adv_pkg"] },
  { id: "tariff", name: "Section-301 / retaliatory tariffs", sev: 4, stages: ["mature_fab", "systems", "m_consumer", "m_auto"] },
];

const EVENTS = [
  { id: "e1", date: "Jul 03", daysAgo: 3, sev: 8, type: "Export Control", conf: "High",
    title: "U.S. expands AI-chip export-control rules",
    summary: "New BIS rules widen licensing requirements for top-end AI accelerators and certain HBM stacks shipped to China.",
    stages: ["logic_ai", "hbm", "adv_fab", "adv_pkg"], countries: ["us", "cn", "tw", "kr"],
    first: "Chinese firms face tighter access to leading-edge AI chips and HBM.",
    second: "Demand shifts to domestic substitutes; pressure on Huawei/SMIC roadmap; retaliation risk via materials.",
    watch: "Final BIS rule text · NVIDIA/AMD guidance · Chinese policy response",
    detail: "The interim final rule extends license requirements from training-class accelerators to a performance-density band capturing several previously exportable inference parts, and for the first time places certain HBM3E-class memory stacks under the same regime. A 30-day comment window applies; enforcement guidance suggests presumption of denial for named Chinese entities.",
    source: "Federal Register · BIS interim final rule (official) + two trade-press confirmations",
    timeline: [["Jul 01", "Draft rule reported by trade press (conf: Low)"], ["Jul 03", "Interim final rule published (conf: High)"], ["Aug 02", "Expected effective date after comment window"]] },
  { id: "e2", date: "Jul 02", daysAgo: 4, sev: 4, type: "Technology Update", conf: "Medium",
    title: "TSMC accelerates CoWoS capacity expansion",
    summary: "Reported pull-in of advanced-packaging capacity targets on sustained AI accelerator demand.",
    stages: ["adv_pkg", "logic_ai"], countries: ["tw"],
    first: "Advanced-packaging bottleneck eases into 2027.",
    second: "Relieves HBM-attach constraints; pricing pressure on ASE/Amkor; substrate order growth.",
    watch: "Monthly CoWoS run-rate estimates · ABF substrate guidance",
    detail: "Supply-chain checks point to a pull-forward of 2027 CoWoS-L capacity targets into late 2026, driven by sustained multi-year accelerator commitments. Not confirmed by company IR; magnitude estimates vary ±2 months across sources.",
    source: "Taiwan supply-chain press + component-order checks (unconfirmed by TSMC IR)",
    timeline: [["Jun 20", "Substrate suppliers report expanded 2026 forecasts"], ["Jul 02", "Capacity pull-in reported by two independent outlets"]] },
  { id: "e3", date: "Jun 30", daysAgo: 6, sev: 6, type: "Geopolitical Risk", conf: "Medium",
    title: "Elevated military activity around Taiwan Strait",
    summary: "Increased exercise tempo raises baseline geopolitical risk for the Taiwan cluster.",
    stages: ["adv_fab", "adv_pkg", "osat"], countries: ["tw", "cn", "us"],
    first: "No supply disruption; insurance and logistics premiums rise.",
    second: "Customer pressure for diversification; tailwind for U.S./Japan fab projects.",
    watch: "PLA exercise announcements · TSMC Arizona/Kumamoto ramp commentary",
    detail: "Exercise tempo around the median line has risen above its 12-month average for a second consecutive week. No interference with commercial shipping or airfreight observed; the effect is on risk pricing (war-risk insurance, diversification pressure), not physical flows.",
    source: "Taiwan MND daily activity reports (official) + shipping-insurance market data",
    timeline: [["Jun 24", "Exercise tempo rises above 12-month average"], ["Jun 30", "Second consecutive week elevated; insurers reprice"]] },
  { id: "e4", date: "Jun 27", daysAgo: 9, sev: 7, type: "Critical Material Risk", conf: "High",
    title: "China tightens gallium / germanium licensing",
    summary: "Slower export-license approvals for Ga/Ge compounds used in power and RF semiconductors.",
    stages: ["gases", "analog"], countries: ["cn", "jp", "de", "fr"],
    first: "Price rises and longer lead times for compound-semiconductor inputs.",
    second: "Accelerated non-China sourcing; signals material leverage in tech disputes.",
    watch: "License approval rates · Ga/Ge spot prices · MOFCOM statements",
    detail: "Approval times for gallium and germanium compound export licenses have lengthened from ~45 to ~75 days per importer reports, without a formal rule change — an administrative-throttling pattern consistent with earlier episodes. Spot prices are up double digits since the slowdown began.",
    source: "MOFCOM notices (official) + importer surveys + customs statistics",
    timeline: [["Jun 10", "Importers report first approval delays"], ["Jun 27", "Delays confirmed across multiple buyers; prices move (conf: High)"]] },
  { id: "e5", date: "Jun 25", daysAgo: 11, sev: 5, type: "Company Guidance", conf: "Medium",
    title: "Major memory maker trims 2026 capex",
    summary: "Guidance revision shifts spend from legacy DRAM toward HBM lines.",
    stages: ["memory_fab", "depo", "etch"], countries: ["kr", "us", "jp"],
    first: "Equipment makers exposed to legacy DRAM see order softness.",
    second: "HBM concentration deepens; legacy DRAM pricing firms.",
    watch: "Equipment book-to-bill · DRAM contract pricing",
    detail: "The revision cuts legacy-DRAM wafer-fab equipment spend while re-allocating to HBM TSV and advanced-packaging lines — net capex roughly flat, mix radically different. Equipment exposure splits: legacy-DRAM deposition/etch softens, bonder and TSV toolmakers benefit.",
    source: "Company guidance call transcript + sell-side capex trackers",
    timeline: [["Jun 25", "Guidance revision on quarterly call"], ["Jul 01", "Equipment suppliers acknowledge order pushouts"]] },
  { id: "e6", date: "Jun 24", daysAgo: 12, sev: 3, type: "Policy Signal", conf: "Medium",
    title: "Japan approves next Rapidus funding tranche",
    summary: "Additional subsidies for 2nm pilot line and packaging R&D.",
    stages: ["adv_fab", "depo", "resist"], countries: ["jp"],
    first: "Japan's advanced-node ambitions gain credibility.",
    second: "Long-run diversification of leading-edge capacity away from Taiwan cluster.",
    watch: "Rapidus pilot yields · METI budget details · customer commitments",
    detail: "The tranche funds the 2nm pilot line's second phase and a new advanced-packaging R&D consortium, conditional on pilot-yield milestones. Cumulative public support now exceeds ¥1.7T; first customer commitments remain the key open question.",
    source: "METI budget announcement (official) + Rapidus press release",
    timeline: [["Jun 24", "Tranche approved by METI"], ["H2 2026", "Pilot-yield milestone review"]] },
];

const SCENARIOS = [
  { id: "none", name: "Baseline", desc: "Current sample state. No simulated shock applied." },
  { id: "strait", name: "Taiwan Strait crisis", desc: "Blockade-level disruption injected as a severity-10 simulated event.",
    event: { sev: 10, daysAgo: 0, conf: "Simulated", stages: ["adv_fab", "adv_pkg", "osat", "substrates"], countries: ["tw", "cn"] } },
  { id: "materials", name: "China materials ban", desc: "Hard export ban on Ga/Ge and rare-earth inputs (severity 9).",
    event: { sev: 9, daysAgo: 0, conf: "Simulated", stages: ["gases", "wafers", "analog"], countries: ["cn", "jp", "de", "fr"] } },
  { id: "exportmax", name: "Export controls max", desc: "Controls extended to sub-leading-edge tools and cloud access (severity 8).",
    event: { sev: 8, daysAgo: 0, conf: "Simulated", stages: ["litho", "depo", "etch", "metro", "logic_ai", "memory_fab"], countries: ["cn", "nl", "jp", "us"] } },
];

/* ==================== ALGORITHM ==================== */
const clamp10 = (v) => Math.min(10, Math.max(0, v));
const CONF_W = { High: 1.0, Medium: 0.75, Low: 0.5, Simulated: 1.0 };

const OUT = {}, IN = {};
STAGES.forEach((s) => { OUT[s.id] = []; IN[s.id] = []; });
FLOW_EDGES.forEach(([a, b]) => { OUT[a].push(b); IN[b].push(a); });
const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

/* COUNTRY LINKS — derived from the 238 supplier→customer relationships:
   which sectors connect which countries, with example company pairs. */
const COUNTRY_LINKS = (() => {
  const m = {};
  Object.entries(CUSTOMERS).forEach(([supId, list]) => {
    const sup = COMPANY_BY_ID[supId]; if (!sup) return;
    const mainStage = Object.entries(sup.stakes).sort((a, b) => b[1] - a[1])[0][0];
    list.forEach(([custId, sh]) => {
      const cust = COMPANY_BY_ID[custId];
      if (!cust || cust.country === sup.country) return;
      const key = sup.country + ">" + cust.country;
      const e = (m[key] = m[key] || { a: sup.country, b: cust.country, w: 0, sectors: {}, ex: [] });
      e.w += sh;
      e.sectors[mainStage] = (e.sectors[mainStage] || 0) + sh;
      e.ex.push([`${sup.name} → ${cust.name} (${(sh * 100).toFixed(0)}%)`, sh]);
    });
  });
  Object.values(m).forEach((e) => {
    e.top = Object.entries(e.sectors).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([sid]) => STAGE_BY_ID[sid].name);
    e.ex.sort((x, y) => y[1] - x[1]); e.ex = e.ex.slice(0, 3).map((x) => x[0]);
  });
  return Object.values(m).sort((a, b) => b.w - a.w);
})();

const TOPO = (() => {
  const indeg = {}; STAGES.forEach((s) => (indeg[s.id] = IN[s.id].length));
  const q = STAGES.filter((s) => indeg[s.id] === 0).map((s) => s.id), order = [];
  while (q.length) { const n = q.shift(); order.push(n); OUT[n].forEach((m) => { if (--indeg[m] === 0) q.push(m); }); }
  return order;
})();

const CHOKE = (() => {
  const pTo = {}, pFrom = {};
  TOPO.forEach((n) => (pTo[n] = IN[n].length ? IN[n].reduce((a, p) => a + pTo[p], 0) : 1));
  [...TOPO].reverse().forEach((n) => (pFrom[n] = OUT[n].length ? OUT[n].reduce((a, c) => a + pFrom[c], 0) : 1));
  const th = {}; let max = 0;
  STAGES.forEach((s) => { th[s.id] = pTo[s.id] * pFrom[s.id]; max = Math.max(max, th[s.id]); });
  const o = {}; STAGES.forEach((s) => (o[s.id] = 10 * Math.sqrt(th[s.id] / max)));
  return o;
})();

const MAX_LOG_V = Math.max(...STAGES.map((s) => Math.log(s.value)));
const IMPORTANCE = (() => {
  const o = {};
  STAGES.forEach((s) => (o[s.id] = 10 * (0.6 * (CHOKE[s.id] / 10) + 0.4 * (Math.log(s.value) / MAX_LOG_V))));
  return o;
})();
const IMP_RANK = Object.entries(IMPORTANCE).sort((a, b) => b[1] - a[1]).map(([id]) => id);
const EDGE_W = (() => {
  const o = {};
  STAGES.forEach((s) => {
    const tot = OUT[s.id].reduce((a, c) => a + STAGE_BY_ID[c].value, 0);
    OUT[s.id].forEach((c) => (o[s.id + ">" + c] = STAGE_BY_ID[c].value / tot));
  });
  return o;
})();

const GEO = Object.fromEntries(STAGES.map((s) => [s.id, 10 * Object.values(s.shares).reduce((a, v) => a + v * v, 0)]));
const POLICY = Object.fromEntries(STAGES.map((s) => {
  const sevs = POLICIES.filter((p) => p.stages.includes(s.id)).map((p) => p.sev).sort((a, b) => b - a);
  return [s.id, sevs.length ? clamp10(sevs[0] + 0.4 * sevs.slice(1).reduce((a, v) => a + v, 0)) : 0];
}));

function propagate(sources, confW, decay) {
  const shock = {}; STAGES.forEach((s) => (shock[s.id] = 0));
  const bump = (id, v) => (shock[id] = Math.max(shock[id], clamp10(v)));
  for (const [s0, sev] of sources) {
    const base = sev * confW * decay;
    bump(s0, base);
    OUT[s0].forEach((d1) => {
      const f1 = 0.55 * (0.5 + 0.5 * EDGE_W[s0 + ">" + d1]);
      bump(d1, base * f1);
      OUT[d1].forEach((d2) => bump(d2, base * f1 * 0.55 * (0.5 + 0.5 * EDGE_W[d1 + ">" + d2])));
    });
    IN[s0].forEach((u1) => bump(u1, base * 0.3));
  }
  return shock;
}
const eventShock = (e) => propagate(e.stages.map((s) => [s, e.sev]), CONF_W[e.conf] ?? 0.75, Math.exp(-e.daysAgo / 12));
function mergeShocks(list) {
  const m = {}; STAGES.forEach((s) => (m[s.id] = 0));
  list.forEach((sh) => STAGES.forEach((s) => (m[s.id] = Math.max(m[s.id], sh[s.id]))));
  return m;
}

const TOT_IMP = STAGES.reduce((a, s) => a + IMPORTANCE[s.id], 0);
const chainImpact = (shock) => STAGES.reduce((a, s) => a + shock[s.id] * IMPORTANCE[s.id], 0) / TOT_IMP;

function companyImpact(c) {
  const shock = propagate(Object.entries(c.stakes).map(([s, sh]) => [s, 10 * sh]), 1.0, 1.0);
  return { shock, index: chainImpact(shock) };
}
const COMPANY_IMPACTS = Object.fromEntries(COMPANIES.map((c) => [c.id, companyImpact(c)]));
const COMPANY_RANK = [...COMPANIES].sort((a, b) => COMPANY_IMPACTS[b.id].index - COMPANY_IMPACTS[a.id].index);

/* ---------------- CAPITAL LAYER: major shareholders (sample, from public filings) ---------------- */
const OWNERS = {
  tsmc: [["Taiwan NDF (gov)", 0.063], ["Vanguard", 0.05], ["BlackRock", 0.045], ["Capital Group", 0.04]],
  asml: [["BlackRock", 0.07], ["Capital Group", 0.05], ["Vanguard", 0.045], ["Baillie Gifford", 0.03]],
  nvidia: [["Vanguard", 0.087], ["BlackRock", 0.075], ["Fidelity (FMR)", 0.05], ["State Street", 0.04]],
  samsung: [["Lee family & affiliates", 0.2], ["Korea NPS (gov)", 0.07], ["BlackRock", 0.05]],
  skhynix: [["SK Square (chaebol)", 0.2], ["Korea NPS (gov)", 0.08], ["BlackRock", 0.05]],
  intel: [["Vanguard", 0.09], ["BlackRock", 0.08], ["State Street", 0.045], ["US CHIPS equity (gov)", 0.02]],
  micron: [["Vanguard", 0.085], ["BlackRock", 0.075], ["State Street", 0.04]],
  amd: [["Vanguard", 0.09], ["BlackRock", 0.075], ["Fidelity (FMR)", 0.05]],
  apple: [["Vanguard", 0.085], ["BlackRock", 0.07], ["Berkshire Hathaway", 0.055], ["State Street", 0.037]],
  qualcomm: [["Vanguard", 0.09], ["BlackRock", 0.08]],
  broadcom: [["Vanguard", 0.095], ["BlackRock", 0.08], ["State Street", 0.04]],
  amat: [["Vanguard", 0.09], ["BlackRock", 0.075], ["State Street", 0.045]],
  lam: [["Vanguard", 0.09], ["BlackRock", 0.08]],
  kla: [["Vanguard", 0.095], ["BlackRock", 0.08]],
  arm: [["SoftBank Group", 0.88], ["Vanguard", 0.01]],
  smic: [["China Big Fund (gov)", 0.17], ["Datang (SOE)", 0.14]],
  ymtc: [["China Big Fund (gov)", 0.3], ["Hubei provincial (gov)", 0.2]],
  tel: [["Nomura AM", 0.06], ["BlackRock", 0.05], ["Vanguard", 0.03]],
  shinetsu: [["Nomura AM", 0.05], ["BlackRock", 0.05]],
  rapidus: [["Japan METI (gov)", 0.5], ["Toyota/Sony/NTT consortium", 0.5]],
  hisilicon: [["Huawei (private)", 1.0]],
  microsoft: [["Vanguard", 0.09], ["BlackRock", 0.072]],
  google: [["Founders (dual-class)", 0.51], ["Vanguard", 0.07]],
  meta: [["Zuckerberg (dual-class)", 0.58], ["Vanguard", 0.075]],
  foxconn: [["Terry Gou & family", 0.12], ["Vanguard", 0.03]],
};
/* Capital Power Index: Σ over holdings of ownership% × company chain-impact (CII) */
const CAP_RANK = (() => {
  const m = {};
  Object.entries(OWNERS).forEach(([cid, list]) => {
    const w = COMPANY_IMPACTS[cid]?.index ?? 0;
    list.forEach(([o, sh]) => {
      const e = (m[o] = m[o] || { power: 0, holdings: [] });
      e.power += sh * w;
      e.holdings.push([cid, sh]);
    });
  });
  return Object.entries(m).map(([o, e]) => ({
    o, power: e.power, gov: /gov|SOE|METI/.test(o),
    holdings: e.holdings.sort((a, b) => b[1] - a[1]),
  })).sort((a, b) => b.power - a.power);
})();

/* UPSTREAM ORIGINS — two layers of suppliers behind any company (via reversed customer graph) */
function supplierSpread(cid) {
  const seen = new Set([cid]);
  const mk = (list) => list.filter(([c]) => !seen.has(c)).map(([c, rel]) => ({ cid: c, rel })).sort((a, b) => b.rel - a.rel).slice(0, 5);
  const h1 = mk(SUPPLIERS[cid] || []); h1.forEach((r) => seen.add(r.cid));
  const pool = [];
  h1.forEach((r) => (SUPPLIERS[r.cid] || []).forEach(([c2, rel2]) => pool.push([c2, rel2 * r.rel])));
  const best = {};
  pool.forEach(([c, w]) => { if (!seen.has(c) && (!best[c] || w > best[c])) best[c] = w; });
  const h2 = Object.entries(best).map(([c, w]) => ({ cid: c, rel: w })).sort((a, b) => b.rel - a.rel).slice(0, 5);
  return [h1, h2];
}

/* COMPANY EXPOSURE to a shock field: share-weighted mean shock across the company's footprint */
function companyExposure(c, shock) {
  let num = 0, den = 0;
  Object.entries(c.stakes).forEach(([sid, sh]) => { num += sh * shock[sid]; den += sh; });
  return den ? num / den : 0;
}

/* HOP-BY-HOP COMPANY SPREAD for an event or company disruption.
   Companies at each hop, exposure = within-stage share × propagated stage shock, deduped at earliest hop. */
function companySpread(sourceStages, shock, excludeCompany) {
  const hops = [new Set(sourceStages)];
  const seenStage = new Set(sourceStages);
  for (let h = 1; h <= 2; h++) {
    const next = new Set();
    hops[h - 1].forEach((s) => OUT[s].forEach((d) => { if (!seenStage.has(d)) { next.add(d); seenStage.add(d); } }));
    hops.push(next);
  }
  const seenCo = new Set(excludeCompany ? [excludeCompany] : []);
  return hops.map((stageSet) => {
    const rows = [];
    stageSet.forEach((sid) => STAGE_COMPANIES[sid].forEach(([cid, sh]) => {
      if (seenCo.has(cid)) return;
      rows.push({ cid, sid, exp: sh * shock[sid] });
    }));
    const best = {};
    rows.forEach((r) => { if (!best[r.cid] || r.exp > best[r.cid].exp) best[r.cid] = r; });
    const top = Object.values(best).sort((a, b) => b.exp - a.exp).slice(0, 5);
    top.forEach((r) => seenCo.add(r.cid));
    return top;
  });
}

/* CUSTOMER-GRAPH SPREAD: hop 1 = the company's direct customers (rel = share of its sales),
   hop 2 = their customers in turn. Engine exposure = footprint-weighted propagated shock. */
function customerSpread(cid, shock) {
  const seen = new Set([cid]);
  const mk = (list) => list
    .filter(([c]) => !seen.has(c))
    .map(([c, rel]) => ({ cid: c, rel, exp: companyExposure(COMPANY_BY_ID[c], shock) }))
    .sort((a, b) => b.rel * b.exp - a.rel * a.exp).slice(0, 5);
  const h1 = mk(CUSTOMERS[cid] || []);
  h1.forEach((r) => seen.add(r.cid));
  const pool = [];
  h1.forEach((r) => (CUSTOMERS[r.cid] || []).forEach(([c2, rel2]) => pool.push([c2, rel2 * r.rel])));
  const best = {};
  pool.forEach(([c, w]) => { if (!seen.has(c) && (!best[c] || w > best[c])) best[c] = w; });
  const h2 = Object.entries(best)
    .map(([c, w]) => ({ cid: c, rel: w, exp: companyExposure(COMPANY_BY_ID[c], shock) }))
    .sort((a, b) => b.rel * b.exp - a.rel * a.exp).slice(0, 5);
  return [h1, h2];
}

const stageComponents = (s, shock) => ({ choke: CHOKE[s.id], geo: GEO[s.id], policy: POLICY[s.id], subst: s.subst, shock: shock[s.id], market: s.market });
const total = (comp) => Object.keys(WEIGHTS).reduce((a, k) => a + WEIGHTS[k] * clamp10(comp[k]), 0);

function countryData(events, shock) {
  const acc = {};
  Object.keys(COUNTRY_NAMES).forEach((c) => (acc[c] = { w: 0, comp: { choke: 0, geo: 0, policy: 0, subst: 0, shock: 0, market: 0 }, stages: [] }));
  STAGES.forEach((s) => {
    const comp = stageComponents(s, shock);
    Object.entries(s.shares).forEach(([c, sh]) => {
      acc[c].w += sh; acc[c].stages.push([s.id, sh]);
      Object.keys(comp).forEach((k) => (acc[c].comp[k] += sh * clamp10(comp[k])));
    });
  });
  const out = {};
  Object.entries(acc).forEach(([c, a]) => {
    if (!a.w) return;
    const comp = {}; Object.keys(a.comp).forEach((k) => (comp[k] = a.comp[k] / a.w));
    let direct = 0;
    for (const e of events) if (e.countries?.includes(c))
      direct = Math.max(direct, e.sev * (CONF_W[e.conf] ?? 0.75) * Math.exp(-e.daysAgo / 12));
    comp.shock = Math.max(comp.shock, direct);
    out[c] = { comp, score: total(comp), weight: a.w, stages: a.stages.sort((x, y) => y[1] - x[1]) };
  });
  return out;
}

/* COMPUTED HISTORY — re-evaluate the same engine at past days (event age shifted) */
const shockAtT = (t) => mergeShocks(EVENTS.filter((e) => e.daysAgo - t >= 0).map((e) => eventShock({ ...e, daysAgo: e.daysAgo - t })));
const chainIndexAt = (t) => { const sh = shockAtT(t); return STAGES.reduce((a, s) => a + total(stageComponents(s, sh)) * IMPORTANCE[s.id], 0) / TOT_IMP; };
const HISTORY = Array.from({ length: 22 }, (_, i) => chainIndexAt(21 - i)); // 21 days ago → today
const stageScoreAt = (sid, t) => total(stageComponents(STAGE_BY_ID[sid], shockAtT(t)));
const MOVERS7D = STAGES.map((s) => { const now = stageScoreAt(s.id, 0), prev = stageScoreAt(s.id, 7); return { id: s.id, now, d: now - prev }; })
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));

const riskColor = (s) => (s >= 7.5 ? C.red : s >= 5.5 ? C.amber : C.green);
const riskLabel = (s) => t(s >= 7.5 ? "HIGH" : s >= 5.5 ? "ELEVATED" : "MODERATE");
const confColor = (c) => (c === "High" ? C.green : c === "Medium" ? C.amber : c === "Simulated" ? C.copper : C.red);
const TYPE_COLORS = {
  "Export Control": C.red, "Geopolitical Risk": C.red, "Critical Material Risk": C.amber,
  "Policy Signal": C.copper, "Technology Update": C.green, "Company Guidance": C.amber,
};
const MAP_ARCS = [["nl", "tw"], ["jp", "tw"], ["jp", "kr"], ["us", "tw"], ["kr", "us"], ["tw", "my"], ["us", "cn"], ["jp", "us"], ["tw", "vn"], ["kr", "cn"], ["de", "cn"]];

/* ==================== Leaflet loader ==================== */
function useLeaflet() {
  const [L, setL] = useState(typeof window !== "undefined" && window.L ? window.L : null);
  useEffect(() => {
    if (window.L) { setL(window.L); return; }
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css"; css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
    }
    if (!document.getElementById("leaflet-js")) {
      const s = document.createElement("script");
      s.id = "leaflet-js";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload = () => setL(window.L);
      document.body.appendChild(s);
    } else {
      const t = setInterval(() => { if (window.L) { setL(window.L); clearInterval(t); } }, 100);
      return () => clearInterval(t);
    }
  }, []);
  return L;
}

/* ==================== KaTeX loader for TeX formulas ==================== */
function useKatex() {
  const [k, setK] = useState(typeof window !== "undefined" && window.katex ? window.katex : null);
  useEffect(() => {
    if (window.katex) { setK(window.katex); return; }
    if (!document.getElementById("katex-css")) {
      const c = document.createElement("link");
      c.id = "katex-css"; c.rel = "stylesheet";
      c.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
      document.head.appendChild(c);
    }
    if (!document.getElementById("katex-js")) {
      const s = document.createElement("script");
      s.id = "katex-js";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
      s.onload = () => setK(window.katex);
      document.body.appendChild(s);
    } else {
      const tmr = setInterval(() => { if (window.katex) { setK(window.katex); clearInterval(tmr); } }, 100);
      return () => clearInterval(tmr);
    }
  }, []);
  return k;
}
function Tex({ tex, block }) {
  const k = useKatex();
  if (!k) return <span className="mono" style={{ fontSize: 10.5, color: C.dim }}>{tex}</span>;
  return <span style={{ fontSize: block ? 13 : 12 }} dangerouslySetInnerHTML={{ __html: k.renderToString(tex, { displayMode: !!block, throwOnError: false }) }} />;
}

/* ================================ APP ================================ */
export default function App() {
  const [sel, setSel] = useState({ type: "event", id: "e1" });
  const [scenarioId, setScenarioId] = useState("none");
  const [tab, setTab] = useState("flow");
  const [feedTab, setFeedTab] = useState("events");
  const [wide, setWide] = useState(true);
  const [showMethod, setShowMethod] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [custom, setCustom] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [lang, setLang] = useState("en");
  LANGV = lang;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1080px)");
    const fn = () => setWide(mq.matches);
    fn(); mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const scenario = scenarioId === "custom" ? custom : SCENARIOS.find((s) => s.id === scenarioId);

  const model = useMemo(() => {
    const baseShock = mergeShocks(EVENTS.map(eventShock));
    const evts = scenario?.event ? [...EVENTS, { ...scenario.event, id: "sim" }] : EVENTS;
    const shock = mergeShocks(evts.map(eventShock));
    const stages = {}, stagesBase = {};
    STAGES.forEach((s) => {
      stages[s.id] = { comp: stageComponents(s, shock), score: total(stageComponents(s, shock)) };
      stagesBase[s.id] = total(stageComponents(s, baseShock));
    });
    return { stages, stagesBase, countries: countryData(evts, shock), countriesBase: countryData(EVENTS, baseShock), shock };
  }, [scenarioId, custom]);

  const hl = useMemo(() => {
    const s = new Set(), c = new Set();
    if (sel.type === "event") {
      const e = EVENTS.find((x) => x.id === sel.id);
      e?.stages.forEach((x) => { s.add(x); OUT[x].forEach((d) => s.add(d)); });
      e?.countries.forEach((x) => c.add(x));
    } else if (sel.type === "stage") {
      s.add(sel.id);
      Object.keys(STAGE_BY_ID[sel.id]?.shares || {}).forEach((x) => c.add(x));
    } else if (sel.type === "country") {
      c.add(sel.id);
      STAGES.forEach((st) => st.shares[sel.id] >= 0.1 && s.add(st.id));
    } else if (sel.type === "company") {
      const co = COMPANY_BY_ID[sel.id];
      c.add(co.country);
      Object.entries(COMPANY_IMPACTS[sel.id].shock).forEach(([sid, v]) => v > 0.4 && s.add(sid));
    }
    return { s, c };
  }, [sel]);

  const whatChanged = scenarioId === "none"
    ? "Jul 03 — AI-chip export-control shock spread from NVIDIA / SK hynix / TSMC outward: highest company exposures now in packaging and systems tiers."
    : `SCENARIO ACTIVE — ${scenario.name}: ${scenario.desc} Company exposures recomputed through the same engine.`;

  const panes = { map: t("Map"), flow: t("Flow"), intel: t("Intel") };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
        .node { cursor: pointer; transition: opacity .25s; }
        .evcard { cursor: pointer; transition: border-color .2s; }
        .evcard:hover { border-color: ${C.copper} !important; }
        button:focus-visible, .node:focus-visible { outline: 2px solid ${C.copper}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .pulse { animation: none !important; } }
        @keyframes pulse { 0%,100% { opacity:.35 } 50% { opacity:.9 } }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        /* OSM map: CARTO dark tiles are natively dark; OSM-standard fallback gets a gentle dark filter */
        .sscim-map { background: ${C.panel2}; }
        .sscim-map .osm-soft { filter: brightness(.75) invert(1) contrast(1.1) hue-rotate(200deg) saturate(.3); }
        .sscim-map .leaflet-control-attribution { background: rgba(12,17,28,.8); color: ${C.faint}; font-size: 9px; }
        .sscim-map .leaflet-control-attribution a { color: ${C.copperDim}; }
        .sscim-tip { background: ${C.panel} !important; color: ${C.text} !important; border: 1px solid ${C.line} !important; border-radius: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; padding: 2px 6px; box-shadow: none !important; }
        .sscim-tip::before { display: none; }
        .sscim-label { background: transparent !important; border: none !important; box-shadow: none !important; color: ${C.text}; font-family: 'Space Grotesk', sans-serif; font-size: 10.5px; font-weight: 600; text-shadow: 0 0 4px #000; white-space: nowrap; }
      `}</style>

      <header style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>SSCIM</span>
            <span className="mono" style={{ color: C.copper, fontSize: 10, letterSpacing: 2 }}>v4 · OSM MAP · COMPANY SPREAD</span>
          </div>
          <div style={{ color: C.dim, fontSize: 11.5, marginTop: 2 }}>
            {lang === "en" ? "Semiconductor Supply Chain Intelligence Map" : t("fullname")} · 24 · {COMPANIES.length} · 16
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mono" style={{ display: "flex", gap: 2 }}>
            {[["en", "EN"], ["zh", "简"], ["tw", "繁"], ["ja", "日"]].map(([l, label]) => (
              <button key={l} onClick={() => setLang(l)}
                style={{ background: lang === l ? C.copper : "transparent", color: lang === l ? "#0C111C" : C.faint, border: `1px solid ${lang === l ? C.copper : C.line}`, borderRadius: 3, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                {label}
              </button>
            ))}
          </span>
          <SearchBox setSel={setSel} />
          {SCENARIOS.map((sc) => (
            <button key={sc.id} onClick={() => setScenarioId(sc.id)}
              style={{ background: scenarioId === sc.id ? C.copper : "transparent", color: scenarioId === sc.id ? "#0C111C" : C.dim,
                border: `1px solid ${scenarioId === sc.id ? C.copper : C.line}`, borderRadius: 4, padding: "5px 9px",
                fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: scenarioId === sc.id ? 700 : 400 }}>
              {lang === "en" ? sc.name : t("scn_" + sc.id)}
            </button>
          ))}
          <button onClick={() => (scenarioId === "custom" && custom ? setScenarioId("custom") : setShowBuilder(true))}
            onDoubleClick={() => setShowBuilder(true)}
            style={{ background: scenarioId === "custom" ? C.copper : "transparent", color: scenarioId === "custom" ? "#0C111C" : C.dim,
              border: `1px dashed ${scenarioId === "custom" ? C.copper : C.copperDim}`, borderRadius: 4, padding: "5px 9px",
              fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: scenarioId === "custom" ? 700 : 400 }}>
            {custom ? "✦ " + custom.name : t("✦ Build scenario")}
          </button>
          <button onClick={() => setShowGuide(true)}
            style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
            {t("? Guide")}
          </button>
          <button onClick={() => setShowBriefing(true)}
            style={{ background: C.copper, color: "#0C111C", border: `1px solid ${C.copper}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            {t("⚡ GP Briefing")}
          </button>
          <button onClick={() => setShowMethod(true)}
            style={{ background: "transparent", color: C.copper, border: `1px dashed ${C.copperDim}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
            {t("ⓘ Methodology")}
          </button>
        </div>
      </header>

      <div className="mono" style={{ background: scenarioId === "none" ? C.panel2 : "#2A1E14", borderBottom: `1px solid ${C.line}`, padding: "7px 16px", fontSize: 11.5, color: scenarioId === "none" ? C.dim : C.copper, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 240 }}><span style={{ color: C.copper, fontWeight: 600 }}>{t("WHAT CHANGED")} · </span>{whatChanged}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Spark data={HISTORY} />
          <span style={{ fontSize: 10 }}>{t("CHAIN INDEX")} <b style={{ color: riskColor(HISTORY[HISTORY.length - 1]) }}>{HISTORY[HISTORY.length - 1].toFixed(2)}</b>
            <span style={{ color: HISTORY[HISTORY.length - 1] - HISTORY[HISTORY.length - 8] >= 0 ? C.red : C.green }}> {HISTORY[HISTORY.length - 1] - HISTORY[HISTORY.length - 8] >= 0 ? "▲" : "▼"}{Math.abs(HISTORY[HISTORY.length - 1] - HISTORY[HISTORY.length - 8]).toFixed(2)} 7d</span>
          </span>
        </span>
      </div>
      {showBuilder && <ScenarioBuilder onClose={() => setShowBuilder(false)} onRun={(sc) => { setCustom(sc); setScenarioId("custom"); setShowBuilder(false); }} />}

      {!wide && (
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          {Object.entries(panes).map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", borderBottom: tab === k ? `2px solid ${C.copper}` : "2px solid transparent", color: tab === k ? C.text : C.dim, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: tab === k ? 600 : 400 }}>
              {v}
            </button>
          ))}
        </div>
      )}

      {wide ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.9fr", gap: 1, background: C.line }}>
            <Pane title="LAYER 1 · WORLD MAP · OPENSTREETMAP"><OsmMap sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={scenarioId !== "none"} /></Pane>
            <Pane title="LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={scenarioId !== "none"} /></Pane>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            <Pane title="LAYER 3 · INTELLIGENCE PANEL">
              <Intel sel={sel} setSel={setSel} model={model} scenarioActive={scenarioId !== "none"} feedTab={feedTab} setFeedTab={setFeedTab} horizontal />
            </Pane>
          </div>
        </>
      ) : (
        <>
          {tab === "map" && <Pane title="LAYER 1 · WORLD MAP · OPENSTREETMAP"><OsmMap sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={scenarioId !== "none"} /></Pane>}
          {tab === "flow" && <Pane title="LAYER 2 · INDUSTRY FLOW"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={scenarioId !== "none"} /></Pane>}
          {tab === "intel" && <Pane title="LAYER 3 · INTELLIGENCE PANEL"><Intel sel={sel} setSel={setSel} model={model} scenarioActive={scenarioId !== "none"} feedTab={feedTab} setFeedTab={setFeedTab} /></Pane>}
        </>
      )}

      {showMethod && <Methodology onClose={() => setShowMethod(false)} />}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
      {showBriefing && <Briefing onClose={() => setShowBriefing(false)} model={model} scenario={scenario} />}

      <footer className="mono" style={{ padding: "10px 16px", fontSize: 10, color: C.faint, borderTop: `1px solid ${C.line}`, lineHeight: 1.6 }}>
        DEMO · Shares, stakes, values, policies and events are curated sample data — not live feeds, not investment advice.
        Map data © OpenStreetMap contributors · exposure(company) = within-stage share × propagated stage shock.
      </footer>
    </div>
  );
}

function Pane({ title, children }) {
  return (
    <section style={{ background: C.bg, display: "flex", flexDirection: "column" }}>
      <div className="mono" style={{ padding: "7px 14px", fontSize: 10, letterSpacing: 2, color: C.copper, borderBottom: `1px solid ${C.line}` }}>{t(title)}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

/* ================= OpenStreetMap layer ================= */
function OsmMap({ sel, setSel, hl, model, scenarioActive }) {
  const L = useLeaflet();
  const divRef = useRef(null), mapRef = useRef(null), layerRef = useRef(null);
  const selRef = useRef(setSel); selRef.current = setSel;
  const [tileStatus, setTileStatus] = useState("loading");

  useEffect(() => {
    if (!L || !divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center: [32, 70], zoom: 2, minZoom: 1, maxZoom: 7,
      worldCopyJump: true, zoomControl: false, attributionControl: true,
    });
    /* CARTO dark basemap (OpenStreetMap data, natively dark — no filter needed) */
    let fellBack = false, loaded = false;
    const carto = L.tileLayer("https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO", subdomains: "abcd",
    }).addTo(map);
    carto.on("tileload", () => { loaded = true; setTileStatus("ok"); });
    carto.on("tileerror", () => {
      if (fellBack) return; fellBack = true;
      map.removeLayer(carto);
      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", className: "osm-soft",
      }).addTo(map);
      osm.on("tileload", () => { loaded = true; setTileStatus("ok"); });
    });
    setTimeout(() => { if (!loaded) setTileStatus("failed"); }, 6000);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [L]);

  useEffect(() => {
    if (!L || !mapRef.current || !layerRef.current) return;
    const g = layerRef.current;
    g.clearLayers();
    const dimAll = hl.c.size > 0;
    COUNTRY_LINKS.slice(0, 30).forEach((l) => {
      const involved = hl.c.has(l.a) || hl.c.has(l.b);
      const lit = (hl.c.has(l.a) && hl.c.has(l.b)) || (sel.type === "country" && (sel.id === l.a || sel.id === l.b));
      const line = L.polyline([COUNTRY_POS[l.a], COUNTRY_POS[l.b]], {
        color: lit ? C.copper : C.copperDim,
        weight: 0.6 + 2.4 * Math.min(1, l.w / 1.2),
        opacity: lit ? 0.95 : dimAll ? (involved ? 0.5 : 0.08) : 0.3,
        dashArray: "4 7",
      });
      line.bindTooltip(
        `<b>${COUNTRY_NAMES[l.a]} → ${COUNTRY_NAMES[l.b]}</b><br>${l.top.join(" · ")}<br><span style="color:${C.faint}">${l.ex.join("<br>")}</span>`,
        { className: "sscim-tip", sticky: true }
      );
      line.addTo(g);
    });
    const maxW = Math.max(...Object.values(model.countries).map((c) => c.weight));
    Object.entries(model.countries).forEach(([id, c]) => {
      const col = riskColor(c.score);
      const active = hl.c.has(id);
      const isSel = sel.type === "country" && sel.id === id;
      const r = 6 + 12 * (c.weight / maxW);
      const delta = c.score - (model.countriesBase[id]?.score ?? c.score);
      const halo = L.circleMarker(COUNTRY_POS[id], {
        radius: r, color: col, weight: active ? 1.5 : 0, fillColor: col,
        fillOpacity: dimAll && !active ? 0.06 : 0.16, opacity: 0.8,
      }).addTo(g);
      const core = L.circleMarker(COUNTRY_POS[id], {
        radius: r * 0.5, color: isSel ? C.text : col, weight: isSel ? 2 : 1,
        fillColor: col, fillOpacity: dimAll && !active ? 0.3 : 0.9,
      }).addTo(g);
      core.bindTooltip(
        `<span style="font-weight:700">${COUNTRY_NAMES[id]}</span> · <span style="color:${col}">${c.score.toFixed(1)} ${riskLabel(c.score)}</span>` +
        (scenarioActive && delta > 0.05 ? ` <span style="color:${C.copper}">+${delta.toFixed(1)}</span>` : ""),
        { className: "sscim-tip", direction: "top", offset: [0, -r * 0.5 - 2] }
      );
      if (c.weight / maxW > 0.35) {
        core.bindTooltip(
          `${COUNTRY_NAMES[id]} <span style="color:${col}">${c.score.toFixed(1)}</span>`,
          { permanent: true, className: "sscim-label", direction: "bottom", offset: [0, r * 0.5 + 2] }
        );
      }
      const go = () => selRef.current({ type: "country", id });
      halo.on("click", go); core.on("click", go);
    });
  }, [L, model, sel, hl, scenarioActive]);

  return (
    <div style={{ padding: 10 }}>
      <div style={{ position: "relative" }}>
        <div ref={divRef} className="sscim-map" style={{ height: 350, borderRadius: 6, border: `1px solid ${C.line}` }}>
          {!L && <div className="mono" style={{ color: C.dim, fontSize: 11, padding: 16 }}>Loading OpenStreetMap…</div>}
        </div>
        {tileStatus === "failed" && (
          <div className="mono" style={{ position: "absolute", top: 8, left: 8, zIndex: 500, background: "rgba(20,27,43,.92)", border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 5, padding: "5px 9px", fontSize: 10, maxWidth: 260, lineHeight: 1.5 }}>
            Map tiles blocked in this preview. Nodes & links remain interactive — deploy the HTML to any host to see the full basemap.
          </div>
        )}
      </div>
      <Legend items={[["Moderate < 5.5", C.green], ["Elevated 5.5–7.5", C.amber], ["High ≥ 7.5", C.red], ["Link width = trade intensity", C.copperDim]]}
        note="Country links derived from the customer graph — hover a link for sectors & company pairs" />
    </div>
  );
}

/* ================= Flow Graph + stage subsection ================= */
const TIER_LABELS = [["INPUTS & IP", 70], ["EQUIPMENT", 300], ["FABRICATION", 520], ["CHIP PRODUCTS", 690], ["BACKEND", 860], ["SYSTEMS", 1000], ["END MARKETS", 1140]];
function FlowGraph({ sel, setSel, hl, model, scenarioActive }) {
  const dimAll = hl.s.size > 0;
  const subStage = sel.type === "stage" ? STAGE_BY_ID[sel.id] : null;
  return (
    <div style={{ padding: 10 }}>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox="0 0 1220 505" style={{ width: "100%", minWidth: 860, display: "block", background: C.panel2, borderRadius: 6, border: `1px solid ${C.line}` }}>
          {TIER_LABELS.map(([t, x]) => <text key={t} x={x} y={16} textAnchor="middle" className="mono" fill={C.faint} fontSize="8.5" letterSpacing="2">{t}</text>)}
          {FLOW_EDGES.map(([a, b], i) => {
            const sa = STAGE_BY_ID[a], sb = STAGE_BY_ID[b];
            const w = EDGE_W[a + ">" + b];
            const lit = hl.s.has(a) && hl.s.has(b);
            const x1 = sa.x + 47, x2 = sb.x - 47, midX = (x1 + x2) / 2;
            const d = sa.y === sb.y ? `M${x1},${sa.y} L${x2},${sb.y}` : `M${x1},${sa.y} L${midX},${sa.y} L${midX},${sb.y} L${x2},${sb.y}`;
            return <path key={i} d={d} fill="none" stroke={lit ? C.copper : C.copperDim}
              strokeWidth={0.6 + 2 * w} opacity={lit ? 1 : dimAll ? 0.15 : 0.5} />;
          })}
          {STAGES.map((st) => {
            const m = model.stages[st.id];
            const col = riskColor(m.score);
            const imp = IMPORTANCE[st.id];
            const active = hl.s.has(st.id);
            const isSel = sel.type === "stage" && sel.id === st.id;
            const delta = m.score - model.stagesBase[st.id];
            return (
              <g key={st.id} className="node" opacity={dimAll && !active ? 0.3 : 1} onClick={() => setSel({ type: "stage", id: st.id })} tabIndex={0} role="button">
                <rect x={st.x - 47} y={st.y - 20} width={94} height={40} rx={5}
                  fill={active ? "#1B2436" : C.panel} stroke={isSel ? C.text : active ? col : C.line} strokeWidth={isSel ? 1.5 : 0.6 + imp / 8} />
                <circle cx={st.x - 37} cy={st.y - 10} r={2 + imp / 3.2} fill={col}>
                  {active && <animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite" />}
                </circle>
                <text x={st.x + 3} y={st.y - 3} textAnchor="middle" fill={C.text} fontSize="9.5" fontWeight="600">
                  {st.name.length > 19 ? st.name.slice(0, 18) + "…" : st.name}
                </text>
                <text x={st.x - 14} y={st.y + 12} textAnchor="middle" fill={col} fontSize="9.5" className="mono" fontWeight="600">
                  {m.score.toFixed(1)}{scenarioActive && delta > 0.05 ? ` +${delta.toFixed(1)}` : ""}
                </text>
                <text x={st.x + 28} y={st.y + 12} textAnchor="middle" fill={C.faint} fontSize="8" className="mono">
                  imp {imp.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ---- STAGE SUBSECTION: companies & shares of the selected stage ---- */}
      {subStage && (
        <div style={{ marginTop: 8, border: `1px solid ${C.copperDim}`, borderRadius: 6, background: C.panel2, padding: "8px 10px" }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper, marginBottom: 6 }}>
            SUBSECTION · {subStage.name.toUpperCase()} · MAJOR COMPANIES & MARKET SHARES
            {model.shock[subStage.id] > 0.3 && <span style={{ color: riskColor(model.shock[subStage.id]), marginLeft: 8 }}>· stage shock {model.shock[subStage.id].toFixed(1)}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {STAGE_COMPANIES[subStage.id].map(([cid, sh]) => {
              const co = COMPANY_BY_ID[cid];
              const exp = sh * model.shock[subStage.id];
              return (
                <div key={cid} className="evcard" onClick={() => setSel({ type: "company", id: cid })}
                  style={{ minWidth: 128, border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel, padding: "7px 9px", flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 5 }}><Logo cid={cid} size={15} />{co.name}</div>
                  <div className="mono" style={{ fontSize: 9, color: C.faint, margin: "2px 0 4px" }}>{COUNTRY_NAMES[co.country]}</div>
                  <div style={{ height: 5, background: C.panel2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${sh * 100}%`, height: "100%", background: C.copper, opacity: 0.85 }} />
                  </div>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, marginTop: 3 }}>
                    <span style={{ color: C.copper }}>share {(sh * 100).toFixed(0)}%</span>
                    {exp > 0.2 && <span style={{ color: riskColor(exp) }}>exp {exp.toFixed(1)}</span>}
                  </div>
                  {(CUSTOMERS[cid] || []).length > 0 && (
                    <div className="mono" style={{ fontSize: 8.5, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>
                      → {(CUSTOMERS[cid] || []).slice(0, 3).map(([c2, r]) => `${COMPANY_BY_ID[c2].name.split(" ")[0]} ${(r * 100).toFixed(0)}%`).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            {(() => {
              const tot = STAGE_COMPANIES[subStage.id].reduce((a, [, sh]) => a + sh, 0);
              return tot < 0.98 ? (
                <div className="mono" style={{ minWidth: 90, border: `1px dashed ${C.line}`, borderRadius: 6, padding: "7px 9px", fontSize: 10, color: C.faint, flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "center" }}>
                  Others<br />{((1 - tot) * 100).toFixed(0)}% (sample)
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      <Legend items={[["Edge width = downstream value share", C.copperDim], ["Dot & border size = importance", C.copper]]}
        note="Tap a stage → subsection of its companies · tap a company → chain impact & spread" />
    </div>
  );
}

function Legend({ items, note }) {
  return (
    <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "7px 4px 0", fontSize: 10, color: C.dim }}>
      {items.map(([label, col]) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: col, display: "inline-block" }} />{label}
        </span>
      ))}
      <span style={{ color: C.faint }}>{note}</span>
    </div>
  );
}

/* ================= Upstream origins: two supplier layers behind a company ================= */
function UpstreamTree({ cid, setSel }) {
  const [h1, h2] = supplierSpread(cid);
  if (!h1.length) return null;
  const cols = [
    { t: "TIER-2 ORIGINS", rows: h2 },
    { t: "DIRECT SUPPLIERS", rows: h1 },
    { t: "COMPANY", rows: [{ cid, rel: 1 }] },
  ];
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, margin: "10px 0 5px" }}>
        UPSTREAM ORIGINS · TWO LAYERS BEFORE · % = SUPPLIER'S SALES SHARE ALONG PATH
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "stretch" }}>
        {cols.map((col, h) => (
          <React.Fragment key={h}>
            {h > 0 && <div style={{ alignSelf: "center", color: C.copper, fontSize: 16, flexShrink: 0 }}>→</div>}
            <div style={{ minWidth: 148, flex: 1 }}>
              <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: C.faint, marginBottom: 4 }}>{col.t}</div>
              {col.rows.length === 0 && <div className="mono" style={{ fontSize: 10, color: C.faint }}>—</div>}
              {col.rows.map((r) => (
                <div key={r.cid} className="evcard" onClick={() => setSel({ type: "company", id: r.cid })}
                  style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${h === 2 ? C.copper : C.copperDim}`, borderRadius: 4, background: C.panel, padding: "5px 7px", marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={r.cid} size={13} />{COMPANY_BY_ID[r.cid].name}</span>
                    {h < 2 && <span className="mono" style={{ fontSize: 10, color: C.dim }}>{(r.rel * 100).toFixed(0)}%</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>{COUNTRY_NAMES[COMPANY_BY_ID[r.cid].country]}</div>
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ================= Customer-graph spread: one company → its customers → theirs ================= */
function CustomerSpreadTree({ cid, shock, setSel }) {
  const [h1, h2] = customerSpread(cid, shock);
  if (!h1.length) return null;
  const cols = [
    { t: "SOURCE", rows: [{ cid, rel: 1, exp: companyExposure(COMPANY_BY_ID[cid], shock) }] },
    { t: "DIRECT CUSTOMERS", rows: h1 },
    { t: "THEIR CUSTOMERS", rows: h2 },
  ];
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, margin: "10px 0 5px" }}>
        CUSTOMER-GRAPH SPREAD · % = SHARE OF SUPPLIER'S SALES · EXP = ENGINE EXPOSURE
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "stretch" }}>
        {cols.map((col, h) => (
          <React.Fragment key={h}>
            {h > 0 && <div style={{ alignSelf: "center", color: C.copper, fontSize: 16, flexShrink: 0 }}>→</div>}
            <div style={{ minWidth: 148, flex: 1 }}>
              <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: C.faint, marginBottom: 4 }}>{col.t}</div>
              {col.rows.length === 0 && <div className="mono" style={{ fontSize: 10, color: C.faint }}>—</div>}
              {col.rows.map((r) => (
                <div key={r.cid} className="evcard" onClick={() => setSel({ type: "company", id: r.cid })}
                  style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${riskColor(r.exp)}`, borderRadius: 4, background: C.panel, padding: "5px 7px", marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={r.cid} size={13} />{COMPANY_BY_ID[r.cid].name}</span>
                    <span className="mono" style={{ fontSize: 10, color: riskColor(r.exp), fontWeight: 600 }}>{r.exp.toFixed(1)}</span>
                  </div>
                  {h > 0 && <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>{h === 1 ? "buys" : "path weight"} {(r.rel * 100).toFixed(0)}%</div>}
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ================= Stage-level spread tree (hop columns) ================= */
function SpreadTree({ sourceStages, shock, exclude, setSel, title }) {
  const hops = companySpread(sourceStages, shock, exclude);
  const titles = ["HOP 0 · SOURCE", "HOP 1 · DIRECT DOWNSTREAM", "HOP 2 · SECOND ORDER"];
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, margin: "10px 0 5px" }}>
        {title || "IMPACT SPREAD · COMPANY → COMPANY (exposure = share × propagated shock)"}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "stretch" }}>
        {hops.map((rows, h) => (
          <React.Fragment key={h}>
            {h > 0 && <div style={{ alignSelf: "center", color: C.copper, fontSize: 16, flexShrink: 0 }}>→</div>}
            <div style={{ minWidth: 148, flex: 1 }}>
              <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: C.faint, marginBottom: 4 }}>{titles[h]}</div>
              {rows.length === 0 && <div className="mono" style={{ fontSize: 10, color: C.faint }}>—</div>}
              {rows.map((r) => {
                const co = COMPANY_BY_ID[r.cid];
                return (
                  <div key={r.cid} className="evcard" onClick={() => setSel({ type: "company", id: r.cid })}
                    style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${riskColor(r.exp)}`, borderRadius: 4, background: C.panel, padding: "5px 7px", marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={r.cid} size={13} />{co.name}</span>
                      <span className="mono" style={{ fontSize: 10, color: riskColor(r.exp), fontWeight: 600 }}>{r.exp.toFixed(1)}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>via {STAGE_BY_ID[r.sid].name}</div>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ================= Intelligence Panel ================= */
function Intel({ sel, setSel, model, scenarioActive, horizontal, feedTab, setFeedTab }) {
  return (
    <div style={{ display: horizontal ? "grid" : "block", gridTemplateColumns: horizontal ? "1.5fr 1fr" : undefined }}>
      <div style={{ padding: 12, borderRight: horizontal ? `1px solid ${C.line}` : "none", borderBottom: horizontal ? "none" : `1px solid ${C.line}` }}>
        <Detail sel={sel} setSel={setSel} model={model} scenarioActive={scenarioActive} />
      </div>
      <div>
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.line}` }}>
          {[["events", "EVENTS"], ["companies", "COMPANIES"], ["movers", "MOVERS 7D"], ["capital", "CAPITAL"]].map(([k, v]) => [k, t(v)]).map(([k, v]) => (
            <button key={k} onClick={() => setFeedTab(k)} className="mono"
              style={{ flex: 1, padding: "8px 0", background: "transparent", border: "none", borderBottom: feedTab === k ? `2px solid ${C.copper}` : "2px solid transparent", color: feedTab === k ? C.copper : C.dim, fontSize: 9.5, letterSpacing: 1.5, cursor: "pointer", fontFamily: "inherit" }}>
              {v}
            </button>
          ))}
        </div>
        <div style={{ overflowY: "auto", padding: "8px 12px 12px", maxHeight: horizontal ? 420 : 440 }}>
          {feedTab === "events" && EVENTS.map((e) => {
            const active = sel.type === "event" && sel.id === e.id;
            const eii = chainImpact(eventShock(e));
            return (
              <div key={e.id} className="evcard" onClick={() => setSel({ type: "event", id: e.id })}
                style={{ border: `1px solid ${active ? C.copper : C.line}`, background: active ? "#1A2132" : C.panel, borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: "1px 6px" }}>{e.type.toUpperCase()}</span>
                  <span className="mono" style={{ fontSize: 10, color: C.faint }}>{e.date}</span>
                  <span className="mono" style={{ fontSize: 10, color: C.copper, marginLeft: "auto" }}>chain impact {eii.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5, lineHeight: 1.35 }}>{e.title}</div>
              </div>
            );
          })}
          {feedTab === "capital" && (
            <>
              <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
                CAPITAL POWER = Σ ownership% × company chain-impact (CII). <span style={{ color: C.amber }}>Amber = state-linked capital.</span> Sample data from public filings.
              </div>
              {CAP_RANK.slice(0, 14).map((r, i) => (
                <div key={r.o} style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: "7px 10px", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 10, color: C.faint, width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: r.gov ? C.amber : C.text }}>{r.o}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: C.copper }}>{r.power.toFixed(2)}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>
                    {r.holdings.slice(0, 4).map(([cid, sh]) => `${COMPANY_BY_ID[cid].name} ${(sh * 100).toFixed(1)}%`).join(" · ")}
                  </div>
                </div>
              ))}
            </>
          )}
          {feedTab === "movers" && MOVERS7D.slice(0, 12).map((m) => {
            const st = STAGE_BY_ID[m.id];
            const up = m.d >= 0;
            return (
              <div key={m.id} className="evcard" onClick={() => setSel({ type: "stage", id: m.id })}
                style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: "7px 10px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{st.name}</span>
                <span className="mono" style={{ fontSize: 10, color: C.dim }}>{m.now.toFixed(1)}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: Math.abs(m.d) < 0.03 ? C.faint : up ? C.red : C.green, width: 52, textAlign: "right" }}>
                  {Math.abs(m.d) < 0.03 ? "—" : `${up ? "▲" : "▼"} ${Math.abs(m.d).toFixed(2)}`}
                </span>
              </div>
            );
          })}
          {feedTab === "companies" && COMPANY_RANK.slice(0, 18).map((co, i) => {
            const active = sel.type === "company" && sel.id === co.id;
            const cii = COMPANY_IMPACTS[co.id].index;
            return (
              <div key={co.id} className="evcard" onClick={() => setSel({ type: "company", id: co.id })}
                style={{ border: `1px solid ${active ? C.copper : C.line}`, background: active ? "#1A2132" : C.panel, borderRadius: 6, padding: "7px 10px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10, color: C.faint, width: 20 }}>#{i + 1}</span>
                <Logo cid={co.id} />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{co.name}</span>
                <span className="mono" style={{ fontSize: 9.5, color: C.dim }}>{COUNTRY_NAMES[co.country]}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: riskColor(cii * 2.5) }}>{cii.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Detail({ sel, setSel, model, scenarioActive }) {
  /* ---- EVENT: summary + engine math + company→company spread ---- */
  if (sel.type === "event") {
    const e = EVENTS.find((x) => x.id === sel.id);
    const base = e.sev * (CONF_W[e.conf] ?? 0.75) * Math.exp(-e.daysAgo / 12);
    const shock = eventShock(e);
    const eii = chainImpact(shock);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: "1px 6px" }}>{e.type.toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 10, color: confColor(e.conf) }}>conf: {e.conf}</span>
        </div>
        <h3 style={{ margin: "6px 0", fontSize: 15, lineHeight: 1.35 }}>{e.title}</h3>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{e.summary}</p>
        {e.detail && (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 3px" }}>BACKGROUND</div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{e.detail}</p></>)}
        {e.source && <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 6 }}>SOURCE · {e.source}</div>}
        {e.timeline && (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 3px" }}>TIMELINE</div>
        {e.timeline.map(([d, txt]) => (
          <div key={d + txt} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2 }}>
            <span style={{ color: C.copper, display: "inline-block", width: 58 }}>{d}</span>{txt}
          </div>
        ))}</>)}
        <div className="mono" style={{ fontSize: 10.5, color: C.copper, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 5, padding: "6px 9px", margin: "8px 0 4px", lineHeight: 1.7 }}>
          ENGINE · <Tex tex={`s_0=${e.sev}\\times ${CONF_W[e.conf]}\\times e^{-${e.daysAgo}/12}=${base.toFixed(2)}`} /> · value-weighted hops · <Tex tex={`\\mathrm{EII}=${eii.toFixed(2)}`} />
        </div>
        {(() => { const topExp = COMPANIES.map((c) => ({ c, exp: companyExposure(c, shock) })).sort((a, b) => b.exp - a.exp).slice(0, 6);
          return (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>MOST-EXPOSED COMPANIES (COMPUTED)</div>
          {topExp.map(({ c, exp }) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c.id })}>
              <span className="mono" style={{ fontSize: 10, color: C.text, width: 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={c.id} size={13} />{c.name}</span>
              <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${exp * 10}%`, height: "100%", background: riskColor(exp), opacity: 0.75 }} />
              </div>
              <span className="mono" style={{ fontSize: 10, width: 28, textAlign: "right", color: C.dim }}>{exp.toFixed(1)}</span>
            </div>
          ))}</>); })()}
        <SpreadTree sourceStages={e.stages} shock={shock} setSel={setSel} />
        <div style={{ marginTop: 10 }}>
          <Field k="FIRST-ORDER" v={e.first} />
          <Field k="SECOND-ORDER" v={e.second} />
          <Field k="WATCH NEXT" v={e.watch} copper />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {e.stages.map((id) => <Chip key={id} label={STAGE_BY_ID[id]?.name} onClick={() => setSel({ type: "stage", id })} />)}
          {e.countries.map((id) => <Chip key={id} label={COUNTRY_NAMES[id]} onClick={() => setSel({ type: "country", id })} outline />)}
        </div>
      </div>
    );
  }

  /* ---- COMPANY: footprint + CII + its own company→company spread ---- */
  if (sel.type === "company") {
    const co = COMPANY_BY_ID[sel.id];
    const { shock, index } = COMPANY_IMPACTS[sel.id];
    const rank = COMPANY_RANK.findIndex((x) => x.id === sel.id) + 1;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <Logo cid={co.id} size={26} />
          <h3 style={{ margin: 0, fontSize: 16 }}>{co.name}</h3>
          <span className="mono" style={{ fontSize: 10, color: C.dim }}>{COUNTRY_NAMES[co.country]}</span>
          <span className="mono" style={{ fontSize: 10, color: C.copper, marginLeft: "auto" }}>impact rank #{rank} of {COMPANIES.length}</span>
        </div>
        <div className="mono" style={{ margin: "8px 0", fontSize: 13 }}>
          COMPANY IMPACT INDEX: <span style={{ fontSize: 18, fontWeight: 700, color: riskColor(index * 2.5) }}>{index.toFixed(2)}</span>
          <span style={{ color: C.faint, fontSize: 10 }}> / 10 · </span><Tex tex={"s_0(s)=10\\cdot\\text{share}_{c,s}\\Rightarrow\\mathrm{CII}=\\tfrac{\\sum s_n I_n}{\\sum I_n}"} />
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>PRODUCTION FOOTPRINT (WITHIN-STAGE SHARE)</div>
        {Object.entries(co.stakes).sort((a, b) => b[1] - a[1]).map(([sid, sh]) => (
          <div key={sid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer" }} onClick={() => setSel({ type: "stage", id: sid })}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, width: 160, flexShrink: 0 }}>{STAGE_BY_ID[sid].name}</span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${sh * 100}%`, height: "100%", background: C.copper, opacity: 0.8 }} />
            </div>
            <span className="mono" style={{ fontSize: 10, width: 34, textAlign: "right", color: C.copper }}>{(sh * 100).toFixed(0)}%</span>
          </div>
        ))}

        {(CUSTOMERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>CUSTOMERS IN THE CHAIN (SHARE OF {co.name.toUpperCase()} SALES)</div>
            {(CUSTOMERS[co.id] || []).map(([c2, r]) => (
              <div key={c2} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c2 })}>
                <span className="mono" style={{ fontSize: 10, color: C.text, width: 160, flexShrink: 0 }}>{COMPANY_BY_ID[c2].name}</span>
                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r * 100}%`, height: "100%", background: C.green, opacity: 0.6 }} />
                </div>
                <span className="mono" style={{ fontSize: 10, width: 34, textAlign: "right", color: C.dim }}>{(r * 100).toFixed(0)}%</span>
              </div>
            ))}
          </>
        )}
        {(SUPPLIERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>KEY SUPPLIERS (THEIR SALES SHARE TO {co.name.toUpperCase()})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(SUPPLIERS[co.id] || []).slice(0, 8).map(([sup, r]) => (
                <Chip key={sup} label={`${COMPANY_BY_ID[sup].name} ${(r * 100).toFixed(0)}%`} onClick={() => setSel({ type: "company", id: sup })} />
              ))}
            </div>
          </>
        )}

        {(OWNERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>MAJOR SHAREHOLDERS (SAMPLE, PUBLIC FILINGS)</div>
            {(OWNERS[co.id] || []).map(([o, sh]) => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 10, color: /gov|SOE|METI/.test(o) ? C.amber : C.text, width: 180, flexShrink: 0 }}>{o}</span>
                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, sh * 100)}%`, height: "100%", background: /gov|SOE|METI/.test(o) ? C.amber : C.copper, opacity: 0.7 }} />
                </div>
                <span className="mono" style={{ fontSize: 10, width: 40, textAlign: "right", color: C.dim }}>{(sh * 100).toFixed(1)}%</span>
              </div>
            ))}
          </>
        )}
        <UpstreamTree cid={co.id} setSel={setSel} />
        <CustomerSpreadTree cid={co.id} shock={shock} setSel={setSel} />
        <SpreadTree sourceStages={Object.keys(co.stakes)} shock={shock} exclude={co.id} setSel={setSel} title="STAGE-LEVEL SPREAD (ENGINE VIEW)" />
      </div>
    );
  }

  /* ---- STAGE / COUNTRY ---- */
  const isStage = sel.type === "stage";
  const node = isStage ? STAGE_BY_ID[sel.id] : null;
  const data = isStage ? model.stages[sel.id] : model.countries[sel.id];
  const baseScore = isStage ? model.stagesBase[sel.id] : model.countriesBase[sel.id]?.score;
  const name = isStage ? node.name : COUNTRY_NAMES[sel.id];
  const related = EVENTS.filter((e) => (isStage ? e.stages : e.countries).includes(sel.id));
  const policies = isStage ? POLICIES.filter((p) => p.stages.includes(sel.id)) : [];
  const impRank = isStage ? IMP_RANK.indexOf(sel.id) + 1 : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{name}</h3>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: riskColor(data.score) }}>{data.score.toFixed(2)}</span>
        <span className="mono" style={{ fontSize: 10, color: riskColor(data.score), border: `1px solid ${riskColor(data.score)}`, borderRadius: 3, padding: "1px 6px" }}>{riskLabel(data.score)}</span>
        {scenarioActive && data.score - baseScore > 0.05 && (
          <span className="mono" style={{ fontSize: 11, color: C.copper }}>▲ +{(data.score - baseScore).toFixed(2)} vs baseline</span>
        )}
      </div>
      {isStage && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0" }}>
          Importance <span style={{ color: C.copper, fontWeight: 600 }}>{IMPORTANCE[sel.id].toFixed(2)}</span> (rank #{impRank}/24) · value ~${node.value}B (sample) · centrality {CHOKE[sel.id].toFixed(1)} · subsection shown under the flow graph
        </div>
      )}
      {!isStage && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0 8px", lineHeight: 1.6 }}>
          Derived from: {data.stages.slice(0, 5).map(([sid, sh]) => `${STAGE_BY_ID[sid]?.name} (${(sh * 100).toFixed(0)}%)`).join(" · ")}
        </div>
      )}
      {!isStage && (() => {
        const outL = COUNTRY_LINKS.filter((l) => l.a === sel.id).slice(0, 4);
        const inL = COUNTRY_LINKS.filter((l) => l.b === sel.id).slice(0, 4);
        return (outL.length + inL.length) > 0 ? (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 4px" }}>CHAIN CONNECTIONS (FROM CUSTOMER GRAPH)</div>
            {outL.map((l) => (
              <div key={"o" + l.b} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.b })}>
                <span style={{ color: C.copper }}>supplies →</span> {COUNTRY_NAMES[l.b]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
            {inL.map((l) => (
              <div key={"i" + l.a} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.a })}>
                <span style={{ color: C.green }}>← sources from</span> {COUNTRY_NAMES[l.a]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
          </>
        ) : null;
      })()}
      {!isStage && COMPANIES.some((c) => c.country === sel.id) && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 4px" }}>HEADQUARTERED HERE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
            {COMPANIES.filter((c) => c.country === sel.id).map((c) => (
              <Chip key={c.id} label={c.name} onClick={() => setSel({ type: "company", id: c.id })} />
            ))}
          </div>
        </>
      )}

      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>COMPUTED SCORE BREAKDOWN</div>
      {Object.keys(WEIGHTS).map((k) => {
        const val = clamp10(data.comp[k]);
        const [label, source] = COMP_META[k];
        const analyst = source === "ANALYST";
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, width: 176, flexShrink: 0 }}>
              {label} <span style={{ color: analyst ? C.amber : C.copper, fontSize: 8.5 }}>[{source}]</span> <span style={{ color: C.faint }}>×{WEIGHTS[k]}</span>
            </span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${val * 10}%`, height: "100%", background: riskColor(val), opacity: 0.7 }} />
            </div>
            <span className="mono" style={{ fontSize: 10, width: 30, textAlign: "right", color: C.dim }}>{val.toFixed(1)}</span>
          </div>
        );
      })}

      {policies.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>ACTIVE POLICY INSTRUMENTS</div>
          {policies.map((p) => (
            <div key={p.id} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2 }}>
              <span style={{ color: riskColor(p.sev) }}>sev {p.sev}</span> · {p.name}
            </div>
          ))}
        </>
      )}
      {related.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>ATTACHED EVENTS</div>
          {related.map((e) => (
            <div key={e.id} onClick={() => setSel({ type: "event", id: e.id })} style={{ fontSize: 12, color: C.copper, cursor: "pointer", marginBottom: 3 }}>→ {e.title}</div>
          ))}
        </>
      )}
    </div>
  );
}

/* ================= Search, sparkline, scenario builder ================= */
function SearchBox({ setSel }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.trim().toLowerCase();
    const out = [];
    STAGES.forEach((s) => s.name.toLowerCase().includes(t) && out.push({ type: "stage", id: s.id, label: s.name, k: "STAGE" }));
    COMPANIES.forEach((c) => c.name.toLowerCase().includes(t) && out.push({ type: "company", id: c.id, label: c.name, k: "CO" }));
    Object.entries(COUNTRY_NAMES).forEach(([id, n]) => n.toLowerCase().includes(t) && out.push({ type: "country", id, label: n, k: "CTRY" }));
    return out.slice(0, 8);
  }, [q]);
  return (
    <div style={{ position: "relative" }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search…")}
        style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "5px 9px", fontSize: 11.5, fontFamily: "inherit", width: 110, outline: "none" }} />
      {results.length > 0 && (
        <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 100, background: C.panel, border: `1px solid ${C.copper}`, borderRadius: 6, minWidth: 220, overflow: "hidden" }}>
          {results.map((r) => (
            <div key={r.type + r.id} onClick={() => { setSel({ type: r.type, id: r.id }); setQ(""); }}
              style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, borderBottom: `1px solid ${C.line}` }}>
              <span>{r.label}</span><span className="mono" style={{ fontSize: 8.5, color: C.copper }}>{r.k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spark({ data }) {
  const w = 90, h = 22;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / rng) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-label="21-day chain risk index">
      <polyline points={pts} fill="none" stroke={C.copper} strokeWidth="1.4" />
      <circle cx={w} cy={h - 2 - ((data[data.length - 1] - min) / rng) * (h - 4)} r="2" fill={C.copper} />
    </svg>
  );
}

function ScenarioBuilder({ onClose, onRun }) {
  const [picked, setPicked] = useState(new Set(["adv_fab"]));
  const [sev, setSev] = useState(7);
  const [name, setName] = useState("Custom shock");
  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 620, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Build a custom scenario</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.dim }}>Pick the stages hit by your hypothetical shock and set severity. It runs through the identical propagation engine as live events.</p>
        <input value={name} onChange={(e) => setName(e.target.value)}
          style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "6px 10px", fontSize: 12.5, fontFamily: "inherit", width: "100%", outline: "none", marginBottom: 10 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {STAGES.map((s) => (
            <span key={s.id} onClick={() => toggle(s.id)}
              style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, cursor: "pointer",
                background: picked.has(s.id) ? C.copper : C.panel, color: picked.has(s.id) ? "#0C111C" : C.text,
                border: `1px solid ${picked.has(s.id) ? C.copper : C.line}`, fontWeight: picked.has(s.id) ? 700 : 400 }}>
              {s.name}
            </span>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
          SEVERITY <b style={{ color: riskColor(sev), fontSize: 14 }}>{sev}</b> / 10
        </div>
        <input type="range" min="1" max="10" value={sev} onChange={(e) => setSev(+e.target.value)} style={{ width: "100%", accentColor: C.copper, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button disabled={picked.size === 0}
            onClick={() => onRun({ id: "custom", name, desc: `User-defined severity-${sev} shock at ${picked.size} stage(s).`,
              event: { sev, daysAgo: 0, conf: "Simulated", stages: [...picked], countries: [] } })}
            style={{ background: C.copper, color: "#0C111C", border: "none", borderRadius: 4, padding: "6px 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, opacity: picked.size ? 1 : 0.4 }}>
            Run scenario →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= In-app quick guide ================= */
function Guide({ onClose }) {
  const G = ({ n, t, children }) => (
    <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
      <span className="mono" style={{ color: "#0C111C", background: C.copper, borderRadius: 4, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{LANGV === "en" ? "How to use SSCIM" : t("guideTitle")}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 12, lineHeight: 1.6 }}>
          {LANGV === "en" ? (<>Three synchronized layers: tap anything in one layer and the other two respond. Colors: <span style={{ color: C.green }}>green &lt;5.5 moderate</span> · <span style={{ color: C.amber }}>amber 5.5–7.5 elevated</span> · <span style={{ color: C.red }}>red ≥7.5 high</span>.</>) : t("g0")}
        </div>
        {LANGV === "en" ? (<>
        <G n="1" t="Start with the event feed (Intelligence panel)">Tap any event card. Affected countries light up on the map, affected stages in the flow, and the detail view shows the engine math, first/second-order effects, and the hop-by-hop company spread tree.</G>
        <G n="2" t="Explore the flow graph">Tap a stage (e.g. Deposition) to open its subsection: major companies, market shares, shock exposure, and their top customers with percentages. Edge thickness = value flow; dot size = importance.</G>
        <G n="3" t="Drill into a company">Company Impact Index (simulated full disruption), production footprint, customers & suppliers with sales shares, two-layer upstream origins, and two spread trees.</G>
        <G n="4" t="Company rank & capital board">COMPANIES ranks by chain impact. CAPITAL ranks shareholders by ownership × chain impact — state-linked capital in amber.</G>
        <G n="5" t="Run a scenario — or build your own">Header buttons inject preset simulated events. ✦ Build scenario: pick stages, set severity, run the identical engine. Copper +deltas show change vs baseline.</G>
        <G n="6" t="Track change over time">The sparkline recomputes the chain index for each of the past 21 days with the same decay math. MOVERS 7D lists this week's biggest stage moves. Use search to jump anywhere.</G>
        <G n="7" t="Generate the briefing">⚡ GP Briefing composes the daily briefing from the current state — copy or download. ⓘ Methodology documents every formula; no black boxes.</G>
        </>) : (<>
        {[1,2,3,4,5,6,7].map((n) => <G key={n} n={String(n)} t={t("g"+n+"t")}>{t("g"+n+"b")}</G>)}
        </>)}
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 4 }}>
          {LANGV === "en" ? "Demo runs on curated sample data. Descriptive analysis only — not investment advice." : t("gNote")}
        </div>
      </div>
    </div>
  );
}

/* ================= GP News briefing generator — the commercial output ================= */
function briefingText(model, scenario) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const evRanked = EVENTS.map((e) => ({ e, eii: chainImpact(eventShock(e)) })).sort((a, b) => b.eii - a.eii);
  const topStages = STAGES.map((s) => ({ s, sc: model.stages[s.id].score, sh: model.shock[s.id] }))
    .sort((a, b) => b.sh - a.sh).slice(0, 4);
  const topCo = COMPANIES.map((c) => ({ c, exp: companyExposure(c, model.shock) }))
    .sort((a, b) => b.exp - a.exp).slice(0, 5);
  const topCountries = Object.entries(model.countries).sort((a, b) => b[1].score - a[1].score).slice(0, 4);
  const L = [];
  L.push("GP NEWS — SEMICONDUCTOR SUPPLY-CHAIN WATCH");
  L.push(`${today} · generated by the SSCIM engine · sample data`);
  L.push("");
  if (scenario?.event) {
    L.push(`*** SCENARIO BRIEFING: ${scenario.name.toUpperCase()} ***`);
    L.push(scenario.desc);
    L.push("");
  }
  L.push("WHAT CHANGED");
  evRanked.slice(0, 3).forEach(({ e, eii }) => {
    L.push(`• [${e.type}] ${e.title} — chain impact ${eii.toFixed(2)}, confidence ${e.conf}.`);
    L.push(`  First-order: ${e.first}`);
    L.push(`  Second-order: ${e.second}`);
  });
  L.push("");
  L.push("MOST-SHOCKED SUPPLY-CHAIN NODES");
  topStages.forEach(({ s, sc, sh }) =>
    L.push(`• ${s.name}: risk ${sc.toFixed(1)} (${riskLabel(sc)}), live shock ${sh.toFixed(1)}, importance rank #${IMP_RANK.indexOf(s.id) + 1}/24`));
  L.push("");
  L.push("COMPANY EXPOSURE LEADERS (footprint-weighted)");
  topCo.forEach(({ c, exp }) => {
    const via = Object.keys(c.stakes).map((sid) => STAGE_BY_ID[sid].name).slice(0, 2).join(", ");
    L.push(`• ${c.name} (${COUNTRY_NAMES[c.country]}): exposure ${exp.toFixed(1)} via ${via}`);
  });
  L.push("");
  L.push("COUNTRY RISK BOARD");
  topCountries.forEach(([id, c]) => L.push(`• ${COUNTRY_NAMES[id]}: ${c.score.toFixed(2)} ${riskLabel(c.score)}`));
  L.push("");
  L.push("WATCH NEXT");
  evRanked.slice(0, 3).forEach(({ e }) => L.push(`• ${e.watch}`));
  L.push("");
  L.push("METHOD: risk = 0.25·chokepoint(graph) + 0.20·concentration(HHI) + 0.20·policy(DB) + 0.15·substitutability + 0.10·shock(engine) + 0.10·market. Shock decays exp(−days/12), propagates on value-weighted edges.");
  L.push("All figures derive from curated sample data. Descriptive analysis only — not investment advice.");
  return L.join("\n");
}

function Briefing({ onClose, model, scenario }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => briefingText(model, scenario), [model, scenario]);
  const copy = () => {
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 680, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: "16px 18px", color: C.text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>GP News — Daily Briefing (auto-generated)</h3>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={copy} style={{ background: C.copper, color: "#0C111C", border: "none", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button onClick={() => { const b = new Blob([text], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "gp-briefing.txt"; a.click(); URL.revokeObjectURL(a.href); }}
              style={{ background: "transparent", border: `1px solid ${C.copper}`, color: C.copper, borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
              Download .txt
            </button>
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Close</button>
          </div>
        </div>
        <pre className="mono" style={{ margin: 0, overflowY: "auto", fontSize: 11, lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 14px" }}>{text}</pre>
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 8 }}>
          This is the product: the engine writes the briefing. Switch scenarios and regenerate to see scenario briefings.
        </div>
      </div>
    </div>
  );
}

/* ================= Methodology overlay ================= */
function Methodology({ onClose }) {
  const S = ({ n, t, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: C.copper, letterSpacing: 1, marginBottom: 4 }}>{n} · {t}</div>
      <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
  const F = ({ tex, children }) => (
    <div className="mono" style={{ fontSize: 11, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "6px 10px", margin: "5px 0", lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap" }}>{tex ? <Tex tex={tex} block /> : children}</div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 660, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Risk & Impact Algorithm — v4 Methodology</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <S n="0" t="RISK SCORE (per node)">
          <F tex={"\\text{risk}=0.25\\,C_{\\text{choke}}+0.20\\,C_{\\text{geo}}+0.20\\,C_{\\text{policy}}+0.15\\,C_{\\text{subst}}+0.10\\,C_{\\text{shock}}+0.10\\,C_{\\text{mkt}}"} />
          Four components computed, two declared analyst inputs — every breakdown bar is source-tagged.
        </S>
        <S n="1" t="STAGE IMPORTANCE & VALUE-WEIGHTED EDGES">
          <F tex={"\\begin{aligned} I_n &= 10\\left(0.6\\,\\tfrac{C_{\\text{choke}}}{10}+0.4\\,\\tfrac{\\ln v_n}{\\ln v_{\\max}}\\right)\\\\[2pt] w_{a\\to b} &= \\tfrac{v_b}{\\sum_{c\\in\\mathrm{out}(a)} v_c},\\quad f_{\\downarrow}=0.55(0.5+0.5w),\\;\\; f_{\\uparrow}=0.30 \\end{aligned}"} />
        </S>
        <S n="2" t="EVENT SHOCK & CHAIN IMPACT INDEX">
          <F tex={"s_0=\\sigma\\cdot\\kappa_{\\text{conf}}\\cdot e^{-d/12},\\qquad \\mathrm{EII}=\\frac{\\sum_n s_n I_n}{\\sum_n I_n}"} />
        </S>
        <S n="3" t="COMPANY→COMPANY SPREAD (new in v4)">
          The spread tree translates stage-level propagation to the company level. Stages are grouped by hop distance from the event source (hop 0, 1, 2 downstream); within each hop, every company's exposure is its within-stage production share multiplied by the propagated shock at that stage. Companies appear at their earliest hop; the top five per hop are shown.
          <F tex={"e_{c,s}=\\text{share}_{c,s}\\times s_s,\\qquad \\bar e_c=\\frac{\\sum_s \\text{share}_{c,s}\\, s_s}{\\sum_s \\text{share}_{c,s}}"} />
          This is how one event at ASML becomes measurable pressure on TSMC (hop 1), then NVIDIA and SK hynix (hop 2).
        </S>
        <S n="3b" t="CUSTOMER GRAPH (sample revenue shares)">
          A supplier→customer relationship dataset holds each company's customers and the share of the supplier's sales they represent (e.g., ASML → TSMC 35%; SK hynix → NVIDIA 45% of HBM). The customer-graph spread resolves hop-1/hop-2 at named-relationship level: hop-2 path weight = product of the two sales shares along the path. Sales-share percentages describe the supplier's revenue mix, not the customer's input dependence — the engine exposure number captures the latter via stage shares.
        </S>
        <S n="4" t="COMPANY IMPACT INDEX">
          <F tex={"s_0(s)=10\\cdot\\text{share}_{c,s}\\;\\Rightarrow\\;\\mathrm{CII}_c=\\frac{\\sum_n s_n I_n}{\\sum_n I_n}"} />
        </S>
        <S n="5" t="COUNTRY SCORES & MAP LAYER">
          Country components are share-weighted aggregates of stage components (plus direct country-tagged event shock, max-combined); no hand-set values. The map is OpenStreetMap via Leaflet — real geography, dark-filtered tiles, node radius = Σ stage participation. Map data © OpenStreetMap contributors.
        </S>
        <S n="6" t="ONE ENGINE, THREE USES">
          Live events, hypothetical scenarios, and company disruptions run through the same propagation code path.
        </S>
        <S n="7" t="KNOWN LIMITATIONS">
          Shares, stakes and values are illustrative samples; spread shows the top five companies per hop only; edges are value-weighted but not capacity-constrained; propagation factors are priors pending calibration against historical episodes.
        </S>
        <S n="8" t="EVIDENCE FRAMEWORK — how the production system is grounded">
          Every parameter and datum carries an evidence tier, and the model design draws on four source classes:
          <F>A · ACADEMIC — peer-reviewed foundations: production-network shock propagation (network economics, e.g. sectoral-shock literature), Herfindahl concentration from industrial-organization economics, path centrality from network science.{"\n"}B · INSTITUTIONAL REPORTS — SIA/BCG resilience studies, SEMI capacity data, CSET Supply Chain Explorer, TrendForce/TechInsights/Gartner share estimates.{"\n"}C · OFFICIAL SOURCES — BIS/METI/MOFCOM rule texts, NIST & CHIPS Program documents, EU Chips Act, company filings (10-K/20-F, 13F).{"\n"}D · ANALYST JUDGMENT — declared expert inputs (substitutability, market sensitivity) scored against a written rubric.</F>
          Production data points display [tier · citation · date]; a claim supported by A+B+C ranks above any single class. Where classes conflict, the model shows the range rather than picking silently. Weights and propagation factors are treated as D-tier priors until calibrated (Section 7) — the combination of all four classes, checked against observed episodes, is the evaluation standard.
        </S>
        <S n="9" t="CAPITAL LAYER (sample)">
          Major-shareholder stakes come from public filings (13F, annual reports, exchange disclosures). Capital Power Index below; a first-order measure of who holds rights over the chain's most critical capacity, with state-linked capital flagged.<F tex={"\\mathrm{CPI}_o=\\sum_c \\mathrm{own}_{o,c}\\cdot \\mathrm{CII}_c"} /> Roadmap: capex and subsidy flow tracking (CHIPS/EU/METI disbursements, announced fab investments) as directed money-flow edges on the same graph.
        </S>
      </div>
    </div>
  );
}

const Field = ({ k, v, copper }) => (
  <div style={{ marginBottom: 6 }}>
    <span className="mono" style={{ fontSize: 9, letterSpacing: 2, color: copper ? C.copper : C.dim }}>{k}</span>
    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: copper ? C.copper : C.text }}>{v}</div>
  </div>
);

const Chip = ({ label, onClick, outline }) => (
  <span onClick={onClick} style={{
    fontSize: 11, padding: "3px 9px", borderRadius: 12, cursor: onClick ? "pointer" : "default",
    background: outline ? "transparent" : C.panel, border: `1px solid ${outline ? C.copper : C.line}`,
    color: outline ? C.copper : C.text,
  }}>{label}</span>
);
