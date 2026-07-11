/* Landing-page dictionary. Every visible string — including card bodies and
   the ticker — is now translated (previously only headings/hero/footer
   were, with card prose deliberately left English-only). Content mirrors
   the actual engine (app/src/engine/*.js) and README.md §4/§9 — this page
   makes no "live," "calibrated," or "human-reviewed" claim anywhere. */
export const LANG_LABELS = { en: 'EN', zh: '简', tw: '繁', ja: '日' };

export const T = {
  badge: { en: 'RESEARCH PROTOTYPE', zh: '研究原型', tw: '研究原型', ja: 'リサーチ・プロトタイプ' },
  navIntro: { en: 'Guide & methodology', zh: '指南与方法论', tw: '指南與方法論', ja: 'ガイドと方法論' },
  launchDemo: { en: 'Open the dashboard →', zh: '打开仪表盘 →', tw: '開啟儀表板 →', ja: 'ダッシュボードを開く →' },

  ticker: {
    en: 'RESEARCH PROTOTYPE · frozen demonstration snapshot, dataset as of 2026-07-06 · a sensitivity & comparison engine over a curated sample — not a live feed, not a calibrated forecast, not investment advice',
    zh: '研究原型 · 冻结的演示快照，数据截至 2026-07-06 · 一个基于精选样本的敏感性与比较引擎——不是实时数据，不是经过校准的预测，也不构成投资建议',
    tw: '研究原型 · 凍結的示範快照，資料截至 2026-07-06 · 一個基於精選樣本的敏感度與比較引擎——不是即時數據，不是經過校準的預測，也不構成投資建議',
    ja: 'リサーチ・プロトタイプ · 凍結されたデモンストレーション用スナップショット（データ基準日 2026-07-06） · 精選サンプルに基づく感度分析・比較エンジンです——ライブフィードでも、較正済みの予測でも、投資助言でもありません',
  },

  heroH1: {
    en: `Static maps show where the chip supply chain <em>is</em>.<br>SSCIM shows how a shock would <em>move</em> through it.`,
    zh: '静态地图告诉你芯片供应链<em>在哪里</em>。<br>SSCIM 展示冲击会如何<em>在其中传导</em>。',
    tw: '靜態地圖告訴你晶片供應鏈<em>在哪裡</em>。<br>SSCIM 展示衝擊會如何<em>在其中傳導</em>。',
    ja: '静的な地図はチップ供給網が<em>どこにあるか</em>を示す。<br>SSCIMは衝撃がそこを<em>どう伝わるか</em>を示す。',
  },
  heroP: {
    en: 'A transparent sensitivity-ranking engine over a curated demonstration snapshot: 24 stages, 109 companies with production shares and customer links, 16 countries. Every score separates into structural vulnerability, operational impact, and scenario delta — with the full propagation math shown, never hidden behind one index.',
    zh: '一个基于精选演示快照的透明敏感性排序引擎：24 个环节、109 家公司（含生产份额与客户关系）、16 个国家。每个分数都拆分为结构性脆弱度、运营影响与情景增量——完整的传导算式全部公开，绝不藏在单一指数背后。',
    tw: '一個基於精選示範快照的透明敏感度排序引擎：24 個環節、109 家公司（含生產份額與客戶關係）、16 個國家。每個分數都拆分為結構性脆弱度、營運影響與情境增量——完整的傳導算式全部公開，絕不藏在單一指數背後。',
    ja: '精選されたデモンストレーション用スナップショットに基づく、透明性の高い感度ランキング・エンジンです：24工程、109社（生産シェアと顧客関係付き）、16か国。すべてのスコアは構造的脆弱性・運用インパクト・シナリオ差分に分解され、伝播の計算式はすべて公開——単一の指数の裏に隠すことはありません。',
  },
  openDashboard: { en: 'Open the dashboard', zh: '打开仪表盘', tw: '開啟儀表板', ja: 'ダッシュボードを開く' },

  h2Ask: { en: 'What you can ask it', zh: '你可以问它什么', tw: '你可以問它什麼', ja: 'できる質問' },
  subAsk: {
    en: 'Questions that today take an analyst a week of digging — answered visually, with every formula shown.',
    zh: '分析师需要挖一周才能回答的问题——可视化作答，算式全部公开。',
    tw: '分析師需要挖一週才能回答的問題——可視化作答，算式全部公開。',
    ja: 'アナリストが一週間かけて調べる問いに、計算式をすべて公開したまま視覚的に答えます。',
  },
  card1K: { en: 'EVENT → CHAIN', zh: '事件 → 供应链', tw: '事件 → 供應鏈', ja: 'イベント → チェーン' },
  card1H: {
    en: '"BIS just expanded AI-chip rules. Who is exposed?"',
    zh: '"BIS 刚扩大了 AI 芯片管制规则，谁会受到影响？"',
    tw: '"BIS 剛擴大了 AI 晶片管制規則，誰會受到影響？"',
    ja: '「BISがAIチップ規制を拡大した。誰が影響を受ける？」',
  },
  card1P: {
    en: 'The event decays from its declared severity and age, then propagates outward along directional input-dependence and supplier-revenue proxies — logic/AI → packaging → systems — with named companies and a modeled contribution number at every hop.',
    zh: '事件从其申报的严重度与发生时间开始衰减，再沿方向性的输入依赖与供应商收入代理指标向外传导——逻辑/AI → 封装 → 系统——每一跳都附有具名公司与建模出的贡献数值。',
    tw: '事件從其申報的嚴重度與發生時間開始衰減，再沿方向性的輸入依賴與供應商收入代理指標向外傳導——邏輯/AI → 封裝 → 系統——每一跳都附有具名公司與建模出的貢獻數值。',
    ja: 'イベントは申告された深刻度と経過日数から減衰し、方向性を持つ入力依存性・サプライヤー収益プロキシに沿って——ロジック/AI → パッケージング → システムへと——伝播します。各ホップで具体的な企業名とモデル化された寄与度が示されます。',
  },
  card2K: { en: 'COMPANY → CHAIN', zh: '公司 → 供应链', tw: '公司 → 供應鏈', ja: '企業 → チェーン' },
  card2H: {
    en: '"If ASML is disrupted, how far does it spread?"',
    zh: '"如果 ASML 中断，影响会传多远？"',
    tw: '"如果 ASML 中斷，影響會傳多遠？"',
    ja: '「ASMLが停止したら、どこまで波及する？」',
  },
  card2P: {
    en: "Systemic criticality simulates a full disruption at every stage a company occupies, propagated through the identical engine — reported separately from its share-independent vulnerability and share-weighted contribution, so market size is never hidden or double-counted.",
    zh: '系统性关键度模拟该公司所处每个环节的完全中断，并通过同一引擎传导——其结果与该公司的份额无关脆弱度、份额加权贡献度分开列示，市场规模因此绝不会被隐藏或重复计算。',
    tw: '系統性關鍵度模擬該公司所處每個環節的完全中斷，並透過同一引擎傳導——其結果與該公司的份額無關脆弱度、份額加權貢獻度分開列示，市場規模因此絕不會被隱藏或重複計算。',
    ja: 'システミック・クリティカリティは、ある企業が関与するすべての工程で完全な停止が起きた場合を同一エンジンで伝播シミュレーションします。シェアに依存しない脆弱性指標、シェア加重の寄与度とは別々に報告されるため、市場規模が隠れたり二重計上されたりすることはありません。',
  },
  card3K: { en: 'SCENARIO → BRIEFING', zh: '情景 → 简报', tw: '情境 → 簡報', ja: 'シナリオ → ブリーフィング' },
  card3H: {
    en: '"Write me the Taiwan Strait crisis briefing."',
    zh: '"帮我写一份台海危机简报。"',
    tw: '"幫我寫一份台海危機簡報。"',
    ja: '「台湾海峡危機のブリーフィングを書いて」',
  },
  card3P: {
    en: 'One tap runs a hypothetical shock through the engine and generates a briefing ranked by marginal scenario delta — what changed, most-affected nodes, company leaders, country board, watch-next — without ever rewriting the historical baseline.',
    zh: '轻点一下即可让假设性冲击通过引擎运行，并生成按情景边际增量排序的简报——发生了什么变化、受影响最大的节点、公司领跑者、国家风险榜、后续观察点——且从不改写历史基线。',
    tw: '輕點一下即可讓假設性衝擊通過引擎運行，並產生按情境邊際增量排序的簡報——發生了什麼變化、受影響最大的節點、公司領跑者、國家風險榜、後續觀察點——且從不改寫歷史基線。',
    ja: 'ワンタップで仮想的な衝撃をエンジンに流し込み、シナリオの限界差分でランク付けされたブリーフィングを生成します——何が変わったか、最も影響を受けたノード、企業リーダー、国別リスクボード、次に見るべき点——過去の基準系列を書き換えることは決してありません。',
  },

  h2Network: { en: 'Explore it as a network', zh: '作为网络来探索', tw: '作為網路來探索', ja: 'ネットワークとして探索' },
  subNetwork: {
    en: 'The chain is not bilateral. SSCIM organises it around functional centres — country × stage — connected through modeled stage edges, and lets you trace routes, apply shocks, and analyse the network directly. Modeled connectivity, not verified shipments.',
    zh: '供应链并非双边关系。SSCIM 围绕"国家×环节"的功能中心来组织，并通过建模的环节边相连，让你直接追踪路线、施加冲击并分析网络。这是建模的连通性，而非经核实的实物运输。',
    tw: '供應鏈並非雙邊關係。SSCIM 圍繞「國家×環節」的功能中心來組織，並透過建模的環節邊相連，讓你直接追蹤路線、施加衝擊並分析網路。這是建模的連通性，而非經核實的實物運輸。',
    ja: 'サプライチェーンは二国間関係ではありません。SSCIMは「国 × 工程」の機能センターを軸に構成し、モデル化された工程エッジで結び、経路の追跡・衝撃の付与・ネットワーク分析を直接行えます。モデル化された連結性であり、検証された出荷ではありません。',
  },
  cardN1K: { en: 'FUNCTIONAL CENTRES', zh: '功能中心', tw: '功能中心', ja: '機能センター' },
  cardN1H: { en: 'One country, many functions', zh: '一国多能', tw: '一國多能', ja: '一国に複数の機能' },
  cardN1P: {
    en: 'The map organises around country × stage functional centres and the stage edges that connect them — 126 centres, 1030 modeled stage-mediated connections — so a single country shows the several semiconductor functions it performs, not one dot.',
    zh: '地图围绕"国家×环节"的功能中心及连接它们的环节边组织——126 个功能中心、1030 条建模的环节中介连接——因此单个国家会显示它承担的多项半导体功能，而非一个圆点。',
    tw: '地圖圍繞「國家×環節」的功能中心及連接它們的環節邊組織——126 個功能中心、1030 條建模的環節中介連接——因此單一國家會顯示它承擔的多項半導體功能，而非一個圓點。',
    ja: '地図は「国 × 工程」の機能センターと、それらをつなぐ工程エッジを軸に構成されます——126センター、1030のモデル化された工程媒介の接続——ひとつの国が担う複数の半導体機能が示され、単なる点にはなりません。',
  },
  cardN2K: { en: 'TRACE & PLAY', zh: '追踪与演示', tw: '追蹤與演示', ja: '追跡と再生' },
  cardN2H: { en: 'Trace a route, play the shock', zh: '追踪路线，演示冲击', tw: '追蹤路線，演示衝擊', ja: '経路を追跡し、衝撃を再生' },
  cardN2P: {
    en: 'Pick an origin and destination and trace the strongest modeled route across several centres; apply a shock to any centres and watch it propagate hop-by-hop across the map and the topology view together.',
    zh: '选择起点与终点，追踪跨越多个功能中心的最强建模路径；对任意功能中心施加冲击，并在地图与拓扑视图中同步逐跳观看其传导。',
    tw: '選擇起點與終點，追蹤跨越多個功能中心的最強建模路徑；對任意功能中心施加衝擊，並在地圖與拓撲視圖中同步逐跳觀看其傳導。',
    ja: '起点と終点を選び、複数のセンターにまたがる最も強いモデル化された経路を追跡。任意のセンターに衝撃を与え、地図とトポロジー表示の両方でホップごとに伝播する様子を確認できます。',
  },
  cardN3K: { en: 'NETWORK ANALYSIS', zh: '网络分析', tw: '網路分析', ja: 'ネットワーク分析' },
  cardN3H: { en: 'Inspect, remove, compare', zh: '检视、移除、比较', tw: '檢視、移除、比較', ja: '検査・除去・比較' },
  cardN3P: {
    en: 'Weighted degree, reachability, betweenness, and hypothetical node/edge-removal sensitivity — every metric labeled a topology measure, kept separate from network influence and never a calibrated risk score.',
    zh: '加权度、可达性、介数中心性，以及假设性的节点/边移除敏感性——每个指标都标注为拓扑度量，与网络影响力分开，且绝非经过校准的风险分数。',
    tw: '加權度、可達性、介數中心性，以及假設性的節點/邊移除敏感性——每個指標都標註為拓撲度量，與網路影響力分開，且絕非經過校準的風險分數。',
    ja: '加重次数・到達可能性・媒介中心性、そして仮想的なノード／エッジ除去の感度——各指標はトポロジー指標として明示し、ネットワーク影響力とは分離、較正済みのリスクスコアでは決してありません。',
  },

  h2Explain: { en: 'Explainable by construction', zh: '结构性可解释', tw: '結構性可解釋', ja: '構造から説明可能' },
  subExplain: {
    en: 'Every score separates into a structural component (time-invariant) and an operational component (event-driven, signed) — never blended into one hidden number. Structural vulnerability breaks into five source-tagged components: three computed from the graph and data, two declared analyst judgments.',
    zh: '每个分数都拆分为结构性分量（不随时间变化）与运营分量（由事件驱动，带正负号）——绝不混合成一个隐藏的数字。结构性脆弱度分解为五个带来源标签的分量：三个由图结构与数据计算得出，两个为申明的分析师判断。',
    tw: '每個分數都拆分為結構性分量（不隨時間變化）與營運分量（由事件驅動，帶正負號）——絕不混合成一個隱藏的數字。結構性脆弱度分解為五個帶來源標籤的分量：三個由圖結構與數據計算得出，兩個為申明的分析師判斷。',
    ja: 'すべてのスコアは、時間に依存しない構造成分と、イベント駆動で符号付きの運用成分に分離され、決して一つの隠れた数値に混ぜ合わされることはありません。構造的脆弱性はさらに出所タグ付きの5成分に分解されます：3つはグラフとデータから計算され、2つは明示されたアナリスト判断です。',
  },
  formulaNote: {
    en: 'sources:', zh: '来源：', tw: '來源：', ja: '出所：',
  },
  sourcesTag: {
    en: '[GRAPH/DATA ×3]  [ANALYST ×2]', zh: '[图结构/数据 ×3]  [分析师判断 ×2]', tw: '[圖結構/數據 ×3]  [分析師判斷 ×2]', ja: '[グラフ/データ ×3]  [アナリスト判断 ×2]',
  },

  h2DataSource: { en: 'Model status, plainly stated', zh: '模型现状，如实说明', tw: '模型現狀，如實說明', ja: 'モデルの現状を率直に' },
  card4H: { en: 'A frozen demonstration snapshot, not a live feed', zh: '一份冻结的演示快照，而非实时数据', tw: '一份凍結的示範快照，而非即時資料', ja: 'ライブフィードではなく、凍結されたデモ用スナップショット' },
  card4P: {
    en: 'Companies, stages, the customer graph, and shareholder table are a static, curated sample bundled at build time — not fetched live, not continuously updated. Every propagation coefficient is a declared prior, not a fitted parameter; the in-app Methodology overlay shows the exact formulas, and MODEL_ROADMAP.md states what real calibration would still require.',
    zh: '公司、环节、客户关系图与股东表都是构建时打包的静态精选样本——不是实时抓取，也不会持续更新。每个传导系数都是声明的先验值，而非拟合参数；应用内的"方法论"面板展示了精确公式，MODEL_ROADMAP.md 说明了实现真正校准仍需具备哪些条件。',
    tw: '公司、環節、客戶關係圖與股東表都是建置時打包的靜態精選樣本——不是即時擷取，也不會持續更新。每個傳導係數都是聲明的先驗值，而非擬合參數；應用內的「方法論」面板展示了精確公式，MODEL_ROADMAP.md 說明了實現真正校準仍需具備哪些條件。',
    ja: '企業・工程・顧客関係グラフ・株主テーブルは、ビルド時に組み込まれた静的な精選サンプルであり、ライブで取得されるものでも継続的に更新されるものでもありません。すべての伝播係数はフィットさせたパラメータではなく、宣言された事前値です。アプリ内の「方法論」パネルに正確な数式を、MODEL_ROADMAP.md に本当の較正に必要な条件を記載しています。',
  },
  card5H: { en: 'Evidence-tiered, not uniformly sourced', zh: '按证据分级，而非统一溯源', tw: '按證據分級，而非統一溯源', ja: 'エビデンスに階層あり、一律に出典があるわけではない' },
  card5P: {
    en: "Headline figures (market shares, customer relationships, ownership stakes) carry a citation and evidence tier where a public source exists; figures without one are still analyst judgment pending full sourcing — checked automatically by a data-integrity audit before every deploy.",
    zh: '在存在公开来源的情况下，主要数字（市场份额、客户关系、持股比例）都带有引用与证据等级；没有引用的数字仍是分析师判断，尚待完整溯源——每次部署前都会由数据完整性审计自动检查。',
    tw: '在存在公開來源的情況下，主要數字（市場份額、客戶關係、持股比例）都帶有引用與證據等級；沒有引用的數字仍是分析師判斷，尚待完整溯源——每次部署前都會由資料完整性稽核自動檢查。',
    ja: '公開情報源が存在する場合、主要な数値（市場シェア、顧客関係、持株比率）には出典とエビデンス階層が付与されます。出典のない数値は引き続きアナリスト判断であり、完全な出典確認待ちです——デプロイのたびにデータ整合性監査で自動チェックされます。',
  },
  card6H: { en: 'A sensitivity tool, not a forecast', zh: '一个敏感性工具，而非预测', tw: '一個敏感度工具，而非預測', ja: '予測ではなく、感度分析ツール' },
  card6P: {
    en: "Nothing here is a causal or probabilistic prediction. Scores support comparison and ranking within this snapshot only — a company's or country's number is not a predicted financial loss, and this is never investment advice.",
    zh: '这里没有任何因果性或概率性的预测。分数只用于在本快照范围内进行比较和排序——公司或国家的数值并非预测的经济损失，本产品也绝不构成投资建议。',
    tw: '這裡沒有任何因果性或機率性的預測。分數只用於在本快照範圍內進行比較和排序——公司或國家的數值並非預測的經濟損失，本產品也絕不構成投資建議。',
    ja: 'ここには因果的あるいは確率的な予測は一切含まれません。スコアはこのスナップショット内での比較・ランキングを支えるためのものです——企業や国の数値は予測される財務的損失ではなく、投資助言でもありません。',
  },

  footerText: {
    en: 'This is a research prototype: a frozen demonstration snapshot with declared, unvalidated propagation priors, not a calibrated or live forecasting system. All output is descriptive sensitivity analysis. Nothing on this site or in the product constitutes investment advice or a recommendation to buy or sell any security.',
    zh: '这是一个研究原型：一份冻结的演示快照，配备声明的、未经验证的传导先验值，而非经过校准或实时运行的预测系统。所有输出均为描述性的敏感性分析。本网站及产品中的任何内容均不构成投资建议或买卖任何证券的推荐。',
    tw: '這是一個研究原型：一份凍結的示範快照，配備聲明的、未經驗證的傳導先驗值，而非經過校準或即時運行的預測系統。所有輸出均為描述性的敏感度分析。本網站及產品中的任何內容均不構成投資建議或買賣任何證券的推薦。',
    ja: 'これはリサーチ・プロトタイプです：凍結されたデモンストレーション用スナップショットに、宣言された未検証の伝播事前値を組み合わせたものであり、較正済みまたはライブで動作する予測システムではありません。すべての出力は記述的な感度分析です。本サイトおよび本製品のいかなる内容も、投資助言や証券の売買推奨を構成するものではありません。',
  },
};
