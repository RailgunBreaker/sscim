/* ==================== i18n (phase 1: UI chrome + guide) ====================
   Same simple module-level LANGV + t(key) pattern as the original monolith.
   Note: LANGV can't be reassigned from other modules directly (ES import
   bindings are read-only live views), so setLangV() is the one addition
   needed to keep this working across module boundaries — the pattern itself
   is unchanged. */
export let LANGV = "en";
export function setLangV(l) {
  LANGV = l;
}

export const I18N = {
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
export const t = (k) => (I18N[LANGV] && I18N[LANGV][k]) || k;
