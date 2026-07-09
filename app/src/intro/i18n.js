/* Intro/guide page dictionary. Body prose under each heading is deliberately
   left English-only (see README §7 i18n boundary) — only headings, the lede,
   step titles, tips and the footer disclaimer are translated. */
export const LANG_LABELS = { en: 'EN', zh: '简', tw: '繁', ja: '日' };

export const T = {
  navHome: { en: 'Home', zh: '首页', tw: '首頁', ja: 'ホーム' },
  launchDashboard: { en: 'Launch dashboard →', zh: '启动仪表盘 →', tw: '啟動儀表板 →', ja: 'ダッシュボード起動 →' },
  h1: {
    en: 'The chip supply chain, as a <em>living system</em>',
    zh: '把芯片供应链看作一个<em>活的系统</em>',
    tw: '把晶片供應鏈看作一個<em>活的系統</em>',
    ja: 'チップ供給網を<em>生きたシステム</em>として見る',
  },
  lede: {
    en: 'SSCIM — the Semiconductor Supply Chain Intelligence Map — is a live intelligence layer over the global chip ecosystem. This page explains what it is, how it thinks, and how to use every part of it in about five minutes.',
    zh: 'SSCIM——半导体供应链情报图——是覆盖全球芯片生态的实时情报层。本页用约五分钟解释它是什么、如何思考、以及每个部分怎么用。',
    tw: 'SSCIM——半導體供應鏈情報圖——是覆蓋全球晶片生態的即時情報層。本頁用約五分鐘解釋它是什麼、如何思考、以及每個部分怎麼用。',
    ja: 'SSCIM（半導体サプライチェーン・インテリジェンスマップ）は世界のチップ・エコシステムを覆うライブ情報層です。このページでは約5分で、その概要・仕組み・使い方を説明します。',
  },
  h2_1: { en: '1 · What SSCIM is', zh: '1 · SSCIM 是什么', tw: '1 · SSCIM 是什麼', ja: '1 · SSCIMとは' },
  h2_2: { en: '2 · Reading the screen', zh: '2 · 如何读屏', tw: '2 · 如何讀屏', ja: '2 · 画面の読み方' },
  h2_3: { en: '3 · How to use it, step by step', zh: '3 · 使用步骤', tw: '3 · 使用步驟', ja: '3 · 使い方（ステップ）' },
  h2_4: { en: '4 · The algorithm in one glance', zh: '4 · 算法一览', tw: '4 · 演算法一覽', ja: '4 · アルゴリズム概観' },
  h2_5: { en: '5 · Honest boundaries', zh: '5 · 诚实的边界', tw: '5 · 誠實的邊界', ja: '5 · 正直な境界線' },
  step1: { en: 'Tap an event in the feed', zh: '点击事件流中的事件', tw: '點擊事件流中的事件', ja: 'イベントをタップ' },
  step2: { en: 'Open a stage subsection', zh: '展开环节子板块', tw: '展開環節子板塊', ja: '工程のサブセクションを開く' },
  step3: { en: 'Drill into a company', zh: '深入单个公司', tw: '深入單一公司', ja: '企業を深掘り' },
  step4: { en: 'Check the Company Impact Rank', zh: '查看公司冲击排名', tw: '查看公司衝擊排名', ja: '企業ランキングを確認' },
  step5: { en: 'Run a scenario', zh: '运行情景——或自建情景', tw: '執行情境——或自建情境', ja: 'シナリオを実行・作成' },
  step6: { en: 'Generate the briefing', zh: '生成简报', tw: '產生簡報', ja: 'ブリーフィングを生成' },
  step7: { en: 'Verify anything', zh: '验证一切', tw: '驗證一切', ja: 'すべてを検証' },
  tip1: {
    en: 'Every event card shows a chain-impact number on the same scale, so a policy rule and a capex cut are directly comparable.',
    zh: '每张事件卡都带同一尺度的链冲击指数，政策规则与资本开支削减可直接比较。',
    tw: '每張事件卡都帶同一尺度的鏈衝擊指數，政策規則與資本支出削減可直接比較。',
    ja: '各イベントカードには同一尺度のチェーン影響指数が付き、政策と設備投資削減を直接比較できます。',
  },
  tip3: {
    en: "A supplier sending 35% of sales to a customer is not the same as that customer being 35% dependent on the supplier. SSCIM shows both numbers — relationship share and engine exposure — precisely so you don't conflate them.",
    zh: '供应商 35% 的销售流向某客户，不等于该客户对它 35% 依赖。SSCIM 同时展示两个数字——关系占比与引擎敞口——正是为了避免混淆。',
    tw: '供應商 35% 的銷售流向某客戶，不等於該客戶對它 35% 依賴。SSCIM 同時展示兩個數字——關係佔比與引擎敞口——正是為了避免混淆。',
    ja: '売上の35%がある顧客向けでも、その顧客の依存度が35%とは限りません。SSCIMは関係比率とエンジン算出のエクスポージャーの両方を表示し、混同を防ぎます。',
  },
  launchDashboardBottom: { en: 'Launch the dashboard →', zh: '启动仪表盘 →', tw: '啟動儀表板 →', ja: 'ダッシュボードを起動 →' },
  footerText: {
    en: 'Figures reflect a best-effort real-data pass; not every figure is individually cited yet. Nothing on this page or in the product constitutes investment advice.',
    zh: '当前数字已完成一轮真实数据核校，尚未逐项标注出处的数字仍为分析师判断，不构成投资建议。',
    tw: '當前數字已完成一輪真實數據核校，尚未逐項標注出處的數字仍為分析師判斷，不構成投資建議。',
    ja: '現在の数値はベストエフォートの実データ核校を経ていますが、個別に出典が確認されていない数値は引き続きアナリスト判断であり、投資助言ではありません。',
  },
};
