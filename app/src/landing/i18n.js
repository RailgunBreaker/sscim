/* Landing-page dictionary. Card bodies and the ticker are deliberately left
   English-only (see README §7 i18n boundary) — only headings, hero copy and
   the footer disclaimer are translated, matching the page's original scope. */
export const LANG_LABELS = { en: 'EN', zh: '简', tw: '繁', ja: '日' };

export const T = {
  navIntro: { en: 'Introduction & guide', zh: '简介与指南', tw: '簡介與指南', ja: '紹介とガイド' },
  launchDemo: { en: 'Launch live demo →', zh: '启动演示 →', tw: '啟動示範 →', ja: 'デモを起動 →' },
  heroH1: {
    en: `Static maps show where the chip supply chain <em>is</em>.<br>SSCIM shows where it's <em>moving</em>.`,
    zh: '静态地图告诉你芯片供应链<em>在哪里</em>。<br>SSCIM 告诉你它<em>正往哪里移动</em>。',
    tw: '靜態地圖告訴你晶片供應鏈<em>在哪裡</em>。<br>SSCIM 告訴你它<em>正往哪裡移動</em>。',
    ja: '静的な地図はチップ供給網が<em>どこにあるか</em>を示す。<br>SSCIMは<em>どこへ動いているか</em>を示す。',
  },
  heroP: {
    en: 'A live intelligence layer over the global semiconductor chain: 24 stages, 109 companies with production shares and customer links, 16 countries — with explainable risk scores and an engine that propagates any event, scenario, or company disruption through the whole graph. Company and shareholder data now runs through a real-data research pass, not a static sample.',
    zh: '覆盖全球半导体链的实时情报层：24 个环节、109 家公司（含生产份额与客户关系）、16 个国家——配备可解释的风险评分，以及可将任何事件、情景或公司中断在全图传导的引擎。公司与股东数据现已经过一轮真实数据核校，而非静态样本。',
    tw: '覆蓋全球半導體鏈的即時情報層：24 個環節、109 家公司（含生產份額與客戶關係）、16 個國家——配備可解釋的風險評分，以及可將任何事件、情境或公司中斷在全圖傳導的引擎。公司與股東數據現已經過一輪真實數據核校，而非靜態樣本。',
    ja: '世界の半導体チェーンを覆うライブ・インテリジェンス層：24工程、109社（生産シェアと顧客関係付き）、16か国。説明可能なリスクスコアと、あらゆるイベント・シナリオ・企業停止をグラフ全体に伝播させるエンジンを備えます。企業・株主データは静的なサンプルではなく、実データ調査を経たものです。',
  },
  openDashboard: { en: 'Open the dashboard', zh: '打开仪表盘', tw: '開啟儀表板', ja: 'ダッシュボードを開く' },
  h2Ask: { en: 'What you can ask it', zh: '你可以问它什么', tw: '你可以問它什麼', ja: 'できる質問' },
  subAsk: {
    en: 'Questions that today take an analyst a week of digging — answered visually, with the math shown.',
    zh: '分析师需要挖一周的问题——可视化作答，算式全公开。',
    tw: '分析師需要挖一週的問題——可視化作答，算式全公開。',
    ja: 'アナリストが一週間かける問いに、計算式を公開したまま視覚的に答えます。',
  },
  h2Explain: { en: 'Explainable by construction', zh: '结构性可解释', tw: '結構性可解釋', ja: '構造から説明可能' },
  subExplain: {
    en: 'Every score decomposes into six source-tagged components — four computed, two declared analyst judgments. No black boxes, because credibility is the product.',
    zh: '每个评分分解为六个带来源标签的分量——四个计算得出，两个为申明的分析师判断。没有黑箱，因为可信度就是产品。',
    tw: '每個評分分解為六個帶來源標籤的分量——四個計算得出，兩個為申明的分析師判斷。沒有黑箱，因為可信度就是產品。',
    ja: '各スコアは出所タグ付きの6成分に分解：4つは計算値、2つは明示されたアナリスト判断。ブラックボックスなし——信頼性こそが製品です。',
  },
  h2DataSource: { en: 'Where the data comes from', zh: '数据来源', tw: '數據來源', ja: 'データの出所' },
  footerText: {
    en: 'The current build runs on a best-effort real-data pass — headline figures (market shares, customer relationships, ownership stakes) carry a source in the vault\'s data notes; figures without one are still analyst judgment pending full sourcing. All output is descriptive supply-chain analysis. Nothing on this site or in the product constitutes investment advice or a recommendation to buy or sell any security.',
    zh: '当前版本已完成一轮尽力而为的真实数据核校——主要数字在数据金库的引用记录中标注出处；未标注出处的数字仍是分析师判断，尚待完整溯源。所有输出均为描述性供应链分析，不构成投资建议。',
    tw: '當前版本已完成一輪盡力而為的真實數據核校——主要數字在數據金庫的引用記錄中標注出處；未標注出處的數字仍是分析師判斷，尚待完整溯源。所有輸出均為描述性供應鏈分析，不構成投資建議。',
    ja: '現行版はベストエフォートの実データ調査を反映済みです——主要な数値はvault（データ金庫）の引用記録に出典が記載されています。出典のない数値は、完全な出典確認が済むまでは引き続きアナリスト判断です。すべての出力は記述的なサプライチェーン分析であり、投資助言ではありません。',
  },
};
