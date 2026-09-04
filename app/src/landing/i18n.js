/* Landing-page dictionary. Every visible string — including card bodies and
   the ticker — is translated. Content mirrors the actual engine
   (app/src/engine/*.js) and the published Methodology; this page makes no
   "live," "calibrated," or "human-reviewed" claim anywhere.

   DATASET FIGURES ARE INTERPOLATED, NEVER TYPED. Any sentence quoting a
   count uses `n(...)` over LANDING_STATS, which scripts/build-landing-stats.mjs
   derives from the shipped snapshot at build time. The page previously
   advertised "244 named sites" in four languages while the vault held 275,
   because the number was hand-written into each translation and nothing
   connected it to the data. A figure typed four times is a figure that
   goes wrong four times.

   TWO CLAIMS WERE REMOVED RATHER THAN RESTATED, because the features
   behind them are gone:
     · "One tap runs a hypothetical shock through the engine" — the preset
       scenarios, the draft composer and the builder modal were removed;
       what remains is a hazard radius you place on the map yourself.
     · "Write me the Taiwan Strait crisis briefing" — there is no Taiwan
       Strait scenario to run, so the example could not be executed as
       advertised. The briefing generator is real and is described as what
       it actually does.

   SCORED vs HOST-ONLY COUNTRIES. "16 countries" was ambiguous: the vault
   holds 24, of which 16 carry a stage share and contribute to scores while
   8 exist only to host facilities. The copy now says which is which. */
import { LANDING_STATS as S } from './generated-stats.js';

/* Interpolation helper. Kept trivial on purpose — the point is that the
   number comes from the snapshot, not that the templating is clever. */
export const n = (key) => String(S[key]);
export const LANG_LABELS = { en: 'EN', zh: '简', tw: '繁', ja: '日' };

export const T = {
  currentCard4H: { en: 'Transparent methodology and data scope' },
  currentCard4P: { en: 'Companies, stages, the customer graph, and shareholder table are curated from the SSCIM vault. The methodology explains every declared coefficient and its limitations.' },

  /* The scored/host-only distinction, stated once in full so no other
     sentence on the page has to carry it. */
  scopeNote: {
    en: `Dataset as of ${n('snapshotDate')}: ${n('stages')} chain stages, ${n('companies')} companies, ${n('customerEdges')} company-to-company supply relationships, ${n('facilities')} named facilities, ${n('events')} reviewed events. Of ${n('countriesTotal')} countries, ${n('countriesScored')} carry a production share and contribute to scores; the other ${n('countriesHostOnly')} appear only because facilities are located there and contribute nothing to any score.`,
    zh: `数据截至 ${n('snapshotDate')}：${n('stages')} 个环节、${n('companies')} 家公司、${n('customerEdges')} 条公司间供应关系、${n('facilities')} 座具名厂址、${n('events')} 条已审核事件。在 ${n('countriesTotal')} 个国家中，${n('countriesScored')} 个具有生产份额并参与计分；其余 ${n('countriesHostOnly')} 个仅因境内设有厂址而出现，不参与任何分数计算。`,
    tw: `資料截至 ${n('snapshotDate')}：${n('stages')} 個環節、${n('companies')} 家公司、${n('customerEdges')} 條公司間供應關係、${n('facilities')} 座具名廠址、${n('events')} 條已審核事件。在 ${n('countriesTotal')} 個國家中，${n('countriesScored')} 個具有生產份額並參與計分；其餘 ${n('countriesHostOnly')} 個僅因境內設有廠址而出現，不參與任何分數計算。`,
    ja: `データ基準日 ${n('snapshotDate')}：${n('stages')}工程、${n('companies')}社、${n('customerEdges')}件の企業間供給関係、${n('facilities')}か所の実名施設、${n('events')}件のレビュー済みイベント。${n('countriesTotal')}か国のうち${n('countriesScored')}か国が生産シェアを持ちスコアに寄与します。残る${n('countriesHostOnly')}か国は施設の所在地としてのみ登場し、どのスコアにも寄与しません。`,
  },
  currentFooter: { en: 'SSCIM provides descriptive supply-chain sensitivity analysis. It is not investment advice.' },
  badge: { en: 'RESEARCH PROTOTYPE', zh: '研究原型', tw: '研究原型', ja: 'リサーチ・プロトタイプ' },
  navIntro: { en: 'Guide & methodology', zh: '指南与方法论', tw: '指南與方法論', ja: 'ガイドと方法論' },
  navUpdates: { en: 'Updates', zh: '更新', tw: '更新', ja: 'アップデート' },
  launchDemo: { en: 'Open the dashboard →', zh: '打开仪表盘 →', tw: '開啟儀表板 →', ja: 'ダッシュボードを開く →' },

  /* Fallback ticker copy, shown only when the reviewed vault is unreachable.
     Deliberately carries NO dataset date: the previous version hard-coded one,
     which then sat three weeks stale on the front page while the pipeline
     published daily. The live readout gets its date from the vault. */
  ticker: {
    en: 'SSCIM INTELLIGENCE · supply-chain sensitivity and comparison analysis — not a calibrated forecast and not investment advice',
    zh: '研究原型 · 基于精选样本的敏感性与比较引擎——不是经过校准的预测，也不构成投资建议',
    tw: '研究原型 · 基於精選樣本的敏感度與比較引擎——不是經過校準的預測，也不構成投資建議',
    ja: 'リサーチ・プロトタイプ · 精選サンプルに基づく感度分析・比較エンジンです——較正済みの予測でも、投資助言でもありません',
  },

  heroH1: {
    en: 'Trace disruption through the semiconductor supply chain.',
    zh: '追踪冲击在半导体供应链中的传导。',
    tw: '追蹤衝擊在半導體供應鏈中的傳導。',
    ja: '半導体サプライチェーンを伝わる混乱を追跡する。',
  },
  heroP: {
    en: `SSCIM connects events, facilities and modeled dependencies across the semiconductor production network. Explore how disruption may propagate, inspect the assumptions behind each result, and compare structural and operational exposure across ${n('stages')} stages, ${n('companies')} companies and ${n('facilities')} facilities.`,
    zh: `SSCIM 将事件、厂址与建模的依赖关系连接到整个半导体生产网络之中。你可以探索冲击可能如何传导、查看每一项结果背后的假设，并在 ${n('stages')} 个环节、${n('companies')} 家公司与 ${n('facilities')} 处厂址之间比较结构性敞口与运营敞口。`,
    tw: `SSCIM 將事件、廠址與建模的依賴關係連接到整個半導體生產網路之中。你可以探索衝擊可能如何傳導、查看每一項結果背後的假設，並在 ${n('stages')} 個環節、${n('companies')} 家公司與 ${n('facilities')} 處廠址之間比較結構性曝險與營運曝險。`,
    ja: `SSCIMは、イベント・生産拠点・モデル化された依存関係を半導体生産ネットワーク全体で結び付けます。混乱がどう伝播しうるかを調べ、各結果の前提を確認し、${n('stages')}工程・${n('companies')}社・${n('facilities')}拠点にわたって構造的エクスポージャーと運用エクスポージャーを比較できます。`,
  },
  openDashboard: { en: 'Open SSCIM', zh: '打开 SSCIM', tw: '開啟 SSCIM', ja: 'SSCIM を開く' },
  shotCaption: {
    en: `The live dashboard, dataset as of ${n('snapshotDate')}. Every figure on this page is read from that snapshot, not written into the copy.`,
    zh: `实时仪表盘，数据截至 ${n('snapshotDate')}。本页所有数字均取自该快照，而非写死在文案中。`,
    tw: `即時儀表板，資料截至 ${n('snapshotDate')}。本頁所有數字均取自該快照，而非寫死在文案中。`,
    ja: `実際のダッシュボード（データは${n('snapshotDate')}時点）。本ページの数値はすべてこのスナップショットから読み出しており、文章に直接書き込んではいません。`,
  },
  viewMethodology: { en: 'View methodology', zh: '查看方法论', tw: '查看方法論', ja: '方法論を見る' },
  productName: {
    en: 'Semiconductor supply chain intelligence map',
    zh: '半导体供应链情报图',
    tw: '半導體供應鏈情報圖',
    ja: '半導体サプライチェーン・インテリジェンスマップ',
  },
  heroShotAlt: {
    en: 'The SSCIM dashboard: a world map of facilities beside the industry flow graph, with the chain index and the current event above them.',
    zh: 'SSCIM 仪表盘：左侧为厂址世界地图，右侧为产业流程图，上方显示链指数与当前事件。',
    tw: 'SSCIM 儀表板：左側為廠址世界地圖，右側為產業流程圖，上方顯示鏈指數與當前事件。',
    ja: 'SSCIMダッシュボード：拠点の世界地図と産業フローグラフを並べ、その上にチェーン指数と現在のイベントを表示。',
  },
  /* Sits beside the first methodological claim on the page, not at the
     bottom where a reader meets it only after forming an impression. */
  limitsShort: {
    en: 'What these numbers are: bounded comparative exposure scores from an uncalibrated research model. No parameter is fitted to observed outcomes. They are not probabilities, monetary losses or forecasts, and not investment advice.',
    zh: '这些数字是什么：来自未经校准的研究模型的有界比较敞口分数。没有任何参数是依据实际观测结果拟合的。它们不是概率、不是货币损失、不是预测，也不构成投资建议。',
    tw: '這些數字是什麼：來自未經校準的研究模型的有界比較曝險分數。沒有任何參數是依據實際觀測結果擬合的。它們不是機率、不是貨幣損失、不是預測，也不構成投資建議。',
    ja: 'これらの数値の性格：較正されていない研究モデルによる、上下限のある相対エクスポージャー・スコアです。観測された結果に当てはめて推定したパラメータは一つもありません。確率でも金額損失でも予測でもなく、投資助言でもありません。',
  },
  methodologyPeek: {
    en: 'Show the core formulas',
    zh: '展开核心算式',
    tw: '展開核心算式',
    ja: '中心となる数式を表示',
  },


  h2Ask: { en: 'What you can ask it', zh: '你可以问它什么', tw: '你可以問它什麼', ja: 'できる質問' },
  subAsk: {
    en: 'Three questions the product answers directly, with the derivation visible at every step.',
    zh: '产品可直接回答的三类问题，每一步推导都可查看。',
    tw: '產品可直接回答的三類問題，每一步推導都可查看。',
    ja: '本製品が直接答える三つの問い。各ステップの導出を確認できます。',
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
  /* Was "SCENARIO → BRIEFING", illustrated with "Write me the Taiwan
     Strait crisis briefing" and "one tap runs a hypothetical shock". None
     of that is available: preset scenarios, the draft composer and the
     builder modal were removed, so there is no Taiwan Strait scenario to
     run and no one-tap hypothetical. What actually exists is a hazard
     radius you place on the map yourself, and a briefing generator over
     the current reading. That is what this card now describes. */
  card3K: { en: 'HAZARD → BRIEFING', zh: '灾害 → 简报', tw: '災害 → 簡報', ja: 'ハザード → ブリーフィング' },
  card3H: {
    en: '"What does a quake here actually cut?"',
    zh: '「这里发生地震会切断什么？」',
    tw: '「這裡發生地震會切斷什麼？」',
    ja: '「ここで地震が起きたら、何が断たれる？」',
  },
  card3P: {
    en: 'Drop a hazard radius anywhere on the map. SSCIM names the plants inside it, the share of each chain step they carry, and the modeled links the footprint would sever — then recomputes the index through the same engine and reports the delta against the live reading. A briefing can be generated from that state. It is a bounded screening hypothesis, not a forecast, and it never rewrites the historical baseline.',
    zh: '在地图上任意位置画出灾害半径。SSCIM 会列出圈内的工厂、它们在各环节中所占的份额，以及该范围将切断的建模连接——然后通过同一引擎重新计算指数，并给出相对当前读数的增量。可以据此生成简报。这是一个有界的筛查性假设，而非预测，并且绝不改写历史基线。',
    tw: '在地圖上任意位置畫出災害半徑。SSCIM 會列出圈內的廠址、它們在各環節中所佔的份額，以及該範圍將切斷的建模連接——然後透過同一引擎重新計算指數，並給出相對當前讀數的增量。可據此產生簡報。這是一個有界的篩查性假設，而非預測，且絕不改寫歷史基線。',
    ja: '地図上の任意の地点にハザード半径を描くと、SSCIMはその円内の工場、各工程に占める比率、そしてその範囲が断ち切るモデル化されたリンクを提示します。続いて同一エンジンで指数を再計算し、現在の読み値に対する差分を報告します。その状態からブリーフィングを生成できます。これは限定されたスクリーニング仮説であり、予測ではなく、過去の基準系列を書き換えることもありません。',
  },

  /* The Facility Playground — the product's headline capability, and
     previously not mentioned on this page at all. */
  card4K: { en: 'FACILITY PLAYGROUND', zh: '厂址推演台', tw: '廠址推演台', ja: 'ファシリティ・プレイグラウンド' },
  card4Hd: {
    en: '"Who feeds TSMC Fab 18, and who feeds them?"',
    zh: '「谁在为台积电 18 厂供货？他们的上游又是谁？」',
    tw: '「誰在為台積電 18 廠供貨？他們的上游又是誰？」',
    ja: '「TSMC Fab 18に供給しているのは誰で、その供給元は？」',
  },
  card4Pd: {
    en: `Pick one plant from ${n('facilities')} named sites and trace the modeled network around it on a blank background — suppliers left, customers right, one hop or three or everything reachable. Expand a neighbour, collapse a branch, recentre on anything, walk back, filter by company, country, stage, relationship type or strength, and open any connection to see exactly which company edge and which stage reach produced it. Every count is exact: when the graph draws the strongest 14 of 53 suppliers it says so, and the table beside it reaches all 53. These are modeled stage-mediated relationships — never confirmed shipments, contracts or trade routes.`,
    zh: `从 ${n('facilities')} 座具名厂址中选择一座，在空白背景上追踪其周围的建模网络——上游在左、下游在右，可查看一跳、三跳或全部可达节点。展开某个邻居、折叠某个分支、以任意节点为中心重新展开、回退，并按公司、国家、环节、关系类型或强度筛选；点开任一连接即可看到究竟是哪条公司关系与哪段环节可达性生成了它。所有计数都是精确的：当图形只绘制 53 家供应商中最强的 14 家时会明确说明，旁边的表格则可访问全部 53 家。这些都是建模的、以环节为中介的关系——绝非经确认的运输、合同或贸易路线。`,
    tw: `從 ${n('facilities')} 座具名廠址中選擇一座，在空白背景上追蹤其周圍的建模網路——上游在左、下游在右，可檢視一跳、三跳或全部可達節點。展開某個鄰居、摺疊某個分支、以任意節點為中心重新展開、回退，並依公司、國家、環節、關係類型或強度篩選；點開任一連接即可看到究竟是哪條公司關係與哪段環節可達性產生了它。所有計數都精確：當圖形只繪製 53 家供應商中最強的 14 家時會明確說明，旁邊的表格則可存取全部 53 家。這些都是建模的、以環節為中介的關係——絕非經確認的運輸、合約或貿易路線。`,
    ja: `${n('facilities')}か所の実名拠点から1つを選び、白い背景の上でその周囲のモデル化ネットワークをたどります——供給元は左、顧客は右、1ホップでも3ホップでも到達可能なすべてでも。隣接ノードを展開し、枝を畳み、任意のノードを中心に置き直し、来た道を戻り、企業・国・工程・関係種別・強度で絞り込めます。任意の接続を開けば、どの企業間関係とどの工程到達性がそれを生んだのかが正確に示されます。件数は常に厳密です：グラフが53社の供給元のうち最も強い14社だけを描くときはそう明記し、隣の表からは53社すべてに到達できます。これらはモデル化された工程媒介の関係であり、確認された出荷・契約・交易路では決してありません。`,
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
    en: `The map organises around country × stage functional centres and the stage edges that connect them — ${n('centres')} centres, ${n('centreEdges')} modeled stage-mediated connections — so a single country shows the several semiconductor functions it performs, not one dot.`,
    zh: `地图围绕「国家×环节」的功能中心及连接它们的环节边组织——${n('centres')} 个功能中心、${n('centreEdges')} 条建模的环节中介连接——因此单个国家会显示它承担的多项半导体功能，而非一个圆点。`,
    tw: `地圖圍繞「國家×環節」的功能中心及連接它們的環節邊組織——${n('centres')} 個功能中心、${n('centreEdges')} 條建模的環節中介連接——因此單一國家會顯示它承擔的多項半導體功能，而非一個圓點。`,
    ja: `地図は「国 × 工程」の機能センターと、それらをつなぐ工程エッジを軸に構成されます——${n('centres')}センター、${n('centreEdges')}のモデル化された工程媒介の接続——ひとつの国が担う複数の半導体機能が示され、単なる点にはなりません。`,
  },
  cardN2K: { en: 'PLANTS & HAZARDS', zh: '工厂与灾害', tw: '工廠與災害', ja: '工場とハザード' },
  cardN2H: { en: 'Down to the individual plant', zh: '细化到单座工厂', tw: '細化到單座工廠', ja: '個々の工場まで' },
  cardN2P: {
    en: `${n('facilities')} named sites across all ${n('companies')} modeled companies — what each plant makes and which chain steps it feeds. Drop a hazard radius anywhere and the readout names the plants inside it and the share of each step they carry. Significance is an analyst ordinal, not capacity, and every share is a share of the modeled sample.`,
    zh: `涵盖全部 ${n('companies')} 家建模公司的 ${n('facilities')} 座具名厂址——每座工厂生产什么、供应链条上的哪些环节。在任意位置画出灾害半径，读数即列出圈内的工厂名称，以及它们在各环节中所占的份额。重要度是分析师给出的序数，并非产能；所有份额均为建模样本内的份额。`,
    tw: `涵蓋全部 ${n('companies')} 家建模公司的 ${n('facilities')} 座具名廠址——每座工廠生產什麼、供應鏈上的哪些環節。在任意位置畫出災害半徑，讀數即列出圈內的廠址名稱，以及它們在各環節中所佔的份額。重要度是分析師給出的序數，並非產能；所有份額均為建模樣本內的份額。`,
    ja: `モデル化した${n('companies')}社すべてを網羅する${n('facilities')}の実名拠点——各工場が何を作り、チェーンのどの工程を支えているか。任意の地点にハザード半径を描くと、その円内の工場名と各工程に占める比率が一覧表示されます。重要度は生産能力ではなくアナリストの順序尺度であり、比率はすべてモデル化サンプル内の比率です。`,
  },
  cardN3K: { en: 'Network analysis', zh: '网络分析', tw: '網路分析', ja: 'ネットワーク分析' },
  cardN3H: { en: 'Inspect, remove, compare', zh: '检视、移除、比较', tw: '檢視、移除、比較', ja: '検査・除去・比較' },
  cardN3P: {
    en: 'Weighted degree, reachability, betweenness, and hypothetical node/edge-removal sensitivity — every metric labeled a topology measure, kept separate from network influence and never a calibrated risk score.',
    zh: '加权度、可达性、介数中心性，以及假设性的节点/边移除敏感性——每个指标都标注为拓扑度量，与网络影响力分开，且绝非经过校准的风险分数。',
    tw: '加權度、可達性、介數中心性，以及假設性的節點/邊移除敏感性——每個指標都標註為拓撲度量，與網路影響力分開，且絕非經過校準的風險分數。',
    ja: '加重次数・到達可能性・媒介中心性、そして仮想的なノード／エッジ除去の感度——各指標はトポロジー指標として明示し、ネットワーク影響力とは分離、較正済みのリスクスコアでは決してありません。',
  },

  /* An explicit inventory of what the product does, added because the
     previous copy advertised two workflows that no longer exist and
     omitted the one that had become the headline feature. Every line here
     names something a reader can actually do today. */
  h2Does: { en: 'What it actually does', zh: '它实际能做什么', tw: '它實際能做什麼', ja: '実際にできること' },
  subDoes: {
    en: 'Every item below is a feature you can use right now. Nothing on this page describes a capability that is planned, removed, or advertised but unavailable.',
    zh: '以下每一项都是现在就能使用的功能。本页不描述任何计划中的、已移除的，或宣传了却不可用的能力。',
    tw: '以下每一項都是現在就能使用的功能。本頁不描述任何規劃中的、已移除的，或宣傳了卻不可用的能力。',
    ja: '以下はすべて、いま実際に使える機能です。このページには、計画中・削除済み・宣伝されているが利用できない機能は記載していません。',
  },
  doesList: {
    en: [
      `Facility-network exploration — pick one of ${n('facilities')} named plants and trace the modeled network around it, one hop or three or everything reachable.`,
      'Geographic view — every plant on a world map, with the modeled links between them and a hazard radius you can place anywhere.',
      `Functional-centre topology — ${n('centres')} country × stage centres and ${n('centreEdges')} modeled connections, with routes, reachability and betweenness.`,
      'History review — the chain as it stood on any past date, recomputed by engine replay rather than read from a stored series.',
      'Hazard screening — which named plants a footprint touches, what share of each chain step they carry, and which modeled links it would sever.',
      'Node and edge sensitivity — remove a centre or a connection temporarily and see how reachability changes. A topology measure, not a capacity estimate.',
      'Briefing generation — a written summary of the current reading, its most-affected nodes, and what to watch next.',
      'Shareable state — the view, the pinned entity, the reviewed date and the whole playground exploration travel in the URL.',
    ],
    zh: [
      `厂址网络探索——从 ${n('facilities')} 座具名工厂中选择一座，追踪其周围的建模网络：一跳、三跳，或全部可达节点。`,
      '地理视图——世界地图上的每座工厂、它们之间的建模连接，以及可任意放置的灾害半径。',
      `功能中心拓扑——${n('centres')} 个「国家×环节」中心与 ${n('centreEdges')} 条建模连接，支持路径、可达性与介数分析。`,
      '历史回溯——通过引擎重放重新计算任意过去日期的供应链状态，而非读取预存的时间序列。',
      '灾害筛查——某个范围触及哪些具名工厂、它们在各环节中所占份额，以及会切断哪些建模连接。',
      '节点与边敏感性——临时移除某个中心或连接，观察可达性如何变化。这是拓扑度量，不是产能估计。',
      '简报生成——对当前读数、受影响最大的节点及后续观察点的书面摘要。',
      '可分享状态——视图、锁定对象、回溯日期以及整个推演过程都编码在 URL 中。',
    ],
    tw: [
      `廠址網路探索——從 ${n('facilities')} 座具名工廠中選擇一座，追蹤其周圍的建模網路：一跳、三跳，或全部可達節點。`,
      '地理檢視——世界地圖上的每座廠址、它們之間的建模連接，以及可任意放置的災害半徑。',
      `功能中心拓撲——${n('centres')} 個「國家×環節」中心與 ${n('centreEdges')} 條建模連接，支援路徑、可達性與介數分析。`,
      '歷史回溯——透過引擎重播重新計算任意過去日期的供應鏈狀態，而非讀取預存的時間序列。',
      '災害篩查——某個範圍觸及哪些具名廠址、它們在各環節中所佔份額，以及會切斷哪些建模連接。',
      '節點與邊敏感性——暫時移除某個中心或連接，觀察可達性如何變化。這是拓撲度量，不是產能估計。',
      '簡報產生——對當前讀數、受影響最大的節點及後續觀察點的書面摘要。',
      '可分享狀態——檢視模式、鎖定對象、回溯日期以及整個推演過程都編碼在 URL 中。',
    ],
    ja: [
      `ファシリティ・ネットワーク探索——${n('facilities')}か所の実名工場から1つを選び、その周囲のモデル化ネットワークを1ホップ・3ホップ・到達可能なすべてでたどります。`,
      '地理ビュー——世界地図上のすべての工場、それらを結ぶモデル化リンク、そして任意の地点に置けるハザード半径。',
      `機能センター・トポロジー——${n('centres')}の「国×工程」センターと${n('centreEdges')}のモデル化接続。経路・到達可能性・媒介中心性を分析できます。`,
      '履歴レビュー——過去の任意の日付時点のチェーンを、保存済み系列の読み出しではなくエンジンの再計算で再現します。',
      'ハザード・スクリーニング——ある範囲がどの実名工場に触れ、各工程のどれだけの比率を担い、どのモデル化リンクを断ち切るか。',
      'ノード／エッジ感度——センターや接続を一時的に取り除き、到達可能性の変化を見ます。トポロジー指標であり、生産能力の推定ではありません。',
      'ブリーフィング生成——現在の読み値、最も影響を受けたノード、次に注視すべき点の文章による要約。',
      '共有可能な状態——ビュー、固定した対象、レビュー日付、そしてプレイグラウンドでの探索全体がURLに載ります。',
    ],
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
  card4H: { en: 'Transparent methodology and data scope', zh: '一份冻结的演示快照，而非实时数据', tw: '一份凍結的示範快照，而非即時資料', ja: 'ライブフィードではなく、凍結されたデモ用スナップショット' },
  card4P: {
    en: 'Companies, stages, the customer graph, and shareholder table are curated from the SSCIM vault. Every propagation coefficient is a declared prior, not a fitted parameter; the published Methodology documents the exact formulas, and MODEL_ROADMAP.md states what real calibration would still require.',
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
    en: 'SSCIM uses declared, unvalidated propagation priors and is not a calibrated forecasting system. All output is descriptive sensitivity analysis. Nothing on this site or in the product constitutes investment advice or a recommendation to buy or sell any security.',
    zh: '这是一个研究原型：一份冻结的演示快照，配备声明的、未经验证的传导先验值，而非经过校准或实时运行的预测系统。所有输出均为描述性的敏感性分析。本网站及产品中的任何内容均不构成投资建议或买卖任何证券的推荐。',
    tw: '這是一個研究原型：一份凍結的示範快照，配備聲明的、未經驗證的傳導先驗值，而非經過校準或即時運行的預測系統。所有輸出均為描述性的敏感度分析。本網站及產品中的任何內容均不構成投資建議或買賣任何證券的推薦。',
    ja: 'これはリサーチ・プロトタイプです：凍結されたデモンストレーション用スナップショットに、宣言された未検証の伝播事前値を組み合わせたものであり、較正済みまたはライブで動作する予測システムではありません。すべての出力は記述的な感度分析です。本サイトおよび本製品のいかなる内容も、投資助言や証券の売買推奨を構成するものではありません。',
  },
};
