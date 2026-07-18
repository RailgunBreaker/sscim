/* Intro/guide page dictionary. Every visible string — including the body
   prose under each heading — is now translated (previously only headings,
   the lede, step titles/tips, and the footer were, with body prose left
   English-only). Content mirrors the actual engine (app/src/engine/*.js)
   and README.md §4/§9 — this page makes no "live," "calibrated," or
   "human-reviewed" claim anywhere; every occurrence of the old six-
   component/CII/value-weighted-edge model has been replaced. */
export const LANG_LABELS = { en: 'EN', zh: '简', tw: '繁', ja: '日' };

export const T = {
  navHome: { en: 'Home', zh: '首页', tw: '首頁', ja: 'ホーム' },
  launchDashboard: { en: 'Launch dashboard →', zh: '启动仪表盘 →', tw: '啟動儀表板 →', ja: 'ダッシュボード起動 →' },
  h1: {
    en: 'The chip supply chain, as a <em>modeled system</em>',
    zh: '把芯片供应链看作一个<em>可建模的系统</em>',
    tw: '把晶片供應鏈看作一個<em>可建模的系統</em>',
    ja: 'チップ供給網を<em>モデル化されたシステム</em>として見る',
  },
  lede: {
    en: 'SSCIM — the Semiconductor Supply Chain Intelligence Map — is a research prototype: a sensitivity and comparison engine over a frozen demonstration snapshot of the global chip ecosystem. This page explains what it is, how it thinks, and how to use every part of it in about five minutes.',
    zh: 'SSCIM——半导体供应链情报图——是一个研究原型：一个基于全球芯片生态冻结演示快照的敏感性与比较引擎。本页用约五分钟解释它是什么、如何思考、以及每个部分怎么用。',
    tw: 'SSCIM——半導體供應鏈情報圖——是一個研究原型：一個基於全球晶片生態凍結示範快照的敏感度與比較引擎。本頁用約五分鐘解釋它是什麼、如何思考、以及每個部分怎麼用。',
    ja: 'SSCIM（半導体サプライチェーン・インテリジェンスマップ）はリサーチ・プロトタイプです：世界のチップ・エコシステムの凍結されたデモ用スナップショットに基づく感度分析・比較エンジン。このページでは約5分で、その概要・仕組み・使い方を説明します。',
  },
  h2_1: { en: '1 · What SSCIM is', zh: '1 · SSCIM 是什么', tw: '1 · SSCIM 是什麼', ja: '1 · SSCIMとは' },
  h2_2: { en: '2 · Reading the screen', zh: '2 · 如何读屏', tw: '2 · 如何讀屏', ja: '2 · 画面の読み方' },
  h2_3: { en: '3 · How to use it, step by step', zh: '3 · 使用步骤', tw: '3 · 使用步驟', ja: '3 · 使い方（ステップ）' },
  h2_4: { en: '4 · The algorithm in one glance', zh: '4 · 算法一览', tw: '4 · 演算法一覽', ja: '4 · アルゴリズム概観' },
  h2_5: { en: '5 · Honest boundaries', zh: '5 · 诚实的边界', tw: '5 · 誠實的邊界', ja: '5 · 正直な境界線' },

  s1p1: {
    en: "Semiconductors are the most geopolitically concentrated industry on earth: one company in the Netherlands makes every EUV lithography machine, one island fabricates most leading-edge logic, one country dominates HBM memory. Excellent static maps of this structure exist — but they can't tell you what changed today, which nodes are newly exposed, and how a shock would travel.",
    zh: '半导体是地球上地缘政治集中度最高的产业：荷兰一家公司生产了全部 EUV 光刻机，一座岛屿制造了大多数最先进的逻辑芯片，一个国家主导着 HBM 存储器。这种结构已经有很好的静态地图——但它们无法告诉你今天发生了什么变化、哪些节点新近暴露、以及冲击会如何传导。',
    tw: '半導體是地球上地緣政治集中度最高的產業：荷蘭一家公司生產了全部 EUV 光刻機，一座島嶼製造了大多數最先進的邏輯晶片，一個國家主導著 HBM 記憶體。這種結構已經有很好的靜態地圖——但它們無法告訴你今天發生了什麼變化、哪些節點新近暴露、以及衝擊會如何傳導。',
    ja: '半導体は地球上で最も地政学的に集中した産業です：オランダの一社があらゆるEUV露光装置を製造し、一つの島が最先端ロジックの大半を製造し、一国がHBMメモリを支配しています。この構造を示す優れた静的地図はすでに存在します——しかし、今日何が変わったか、どのノードが新たに露出したか、衝撃がどう伝わるかは教えてくれません。',
  },
  s1p2: {
    en: 'SSCIM fills that gap with three synchronized layers over one computational engine, run against a frozen demonstration snapshot rather than a live feed:',
    zh: 'SSCIM 用三个同步的层来填补这一空白，它们共用一个计算引擎，运行在冻结的演示快照之上，而非实时数据源：',
    tw: 'SSCIM 用三個同步的層來填補這一空白，它們共用一個計算引擎，運行在凍結的示範快照之上，而非即時資料源：',
    ja: 'SSCIMは、ライブフィードではなく凍結されたデモ用スナップショットに対して動作する一つの計算エンジンの上に、3つの同期したレイヤーを重ねてこの隙間を埋めます：',
  },
  layer1: {
    en: "<strong>Layer 1 — World Map.</strong> Real OpenStreetMap geography with all 16 countries participating in the chain. Node color and size show each country's structural vulnerability — a time-invariant score derived purely from its stage participation, never hand-set; hovering shows its separate operational impact and any active scenario delta.",
    zh: '<strong>第一层 — 世界地图。</strong>基于真实的 OpenStreetMap 地理数据，涵盖参与供应链的全部 16 个国家。节点颜色与大小反映每个国家的结构性脆弱度——一个纯粹由其环节参与度推导出、不随时间变化、从不手动设定的分数；悬停时会分别显示其运营影响与当前情景增量（如有）。',
    tw: '<strong>第一層 — 世界地圖。</strong>基於真實的 OpenStreetMap 地理資料，涵蓋參與供應鏈的全部 16 個國家。節點顏色與大小反映每個國家的結構性脆弱度——一個純粹由其環節參與度推導出、不隨時間變化、從不手動設定的分數；懸停時會分別顯示其營運影響與當前情境增量（如有）。',
    ja: '<strong>レイヤー1 — ワールドマップ。</strong>実際のOpenStreetMap地理データに基づき、チェーンに参加する16か国すべてを表示します。ノードの色とサイズは各国の構造的脆弱性——工程への参加度だけから導かれ、決して手動設定されない、時間に依存しないスコア——を示します。ホバーすると、別枠の運用インパクトと現在有効なシナリオ差分（あれば）が表示されます。',
  },
  layer2: {
    en: '<strong>Layer 2 — Industry Flow.</strong> The complete production pipeline: 24 stages from research/IP and EDA through wafers, chemicals, five equipment categories, three fab types, chip products, packaging, and end markets — connected by directional dependence priors, not measured trade flow.',
    zh: '<strong>第二层 — 产业流。</strong>完整的生产链条：从研发/IP 与 EDA，到晶圆、化学品、五类设备、三种晶圆厂类型、芯片产品、封装与终端市场，共 24 个环节——由方向性的依赖先验值相连，而非实测的贸易流量。',
    tw: '<strong>第二層 — 產業流。</strong>完整的生產鏈條：從研發/IP 與 EDA，到晶圓、化學品、五類設備、三種晶圓廠類型、晶片產品、封裝與終端市場，共 24 個環節——由方向性的依賴先驗值相連，而非實測的貿易流量。',
    ja: '<strong>レイヤー2 — インダストリー・フロー。</strong>研究/IPとEDAから、ウエハー、化学薬品、5つの装置カテゴリ、3種類のファブ、チップ製品、パッケージング、エンドマーケットに至る24工程からなる生産パイプライン全体——実測された貿易流ではなく、方向性を持つ依存性の事前値で結ばれています。',
  },
  layer3: {
    en: '<strong>Layer 3 — Intelligence Panel.</strong> The event feed, the company ranking, and a detail view that always shows its work: score breakdowns, the exact engine formula, and a hop-by-hop modeled-contribution spread.',
    zh: '<strong>第三层 — 情报面板。</strong>事件流、公司排名，以及始终展示其推导过程的详情视图：分数分解、精确的引擎公式，以及逐跳的建模贡献度传导图。',
    tw: '<strong>第三層 — 情報面板。</strong>事件流、公司排名，以及始終展示其推導過程的詳情視圖：分數分解、精確的引擎公式，以及逐跳的建模貢獻度傳導圖。',
    ja: '<strong>レイヤー3 — インテリジェンス・パネル。</strong>イベントフィード、企業ランキング、そして常に計算過程を示す詳細ビュー：スコアの内訳、正確なエンジン式、ホップごとのモデル化された寄与度の広がり。',
  },
  netCard: {
    en: "<strong>Explore it as a network.</strong> A view switch offers <strong>Geographic</strong>, <strong>Topology</strong>, and <strong>Split</strong>. Instead of only bilateral country links, the chain is organised around <strong>functional supply centres</strong> — country × stage, 126 of them across 7 tiers — connected by modeled stage-mediated links (share × stage-edge prior × share). Trace multi-centre routes, apply a shock to any centres and play the propagation hop-by-hop across all views, temporarily remove nodes/edges (everything is reversible, with undo/redo/reset), and read topology metrics — weighted degree, reachability, betweenness, node-removal impact — each labeled a topology measure, kept separate from network influence, never a calibrated risk. Modeled connectivity, not verified shipments.",
    zh: "<strong>作为网络来探索。</strong>视图切换提供<strong>地理</strong>、<strong>拓扑</strong>与<strong>分屏</strong>三种模式。供应链不再只是国家间的双边连线，而是围绕<strong>功能供应中心</strong>组织——“国家×环节”，共 126 个、跨 7 个层级——由建模的环节中介连接相连（份额 × 环节边先验 × 份额）。你可以追踪跨中心的路线、对任意中心施加冲击并在所有视图中逐跳演示传导、临时移除节点/边（一切均可逆，支持撤销/重做/重置），并查看拓扑指标——加权度、可达性、介数中心性、节点移除影响——每个都标注为拓扑度量，与网络影响力分开，绝非经过校准的风险。这是建模的连通性，而非经核实的实物运输。",
    tw: "<strong>作為網路來探索。</strong>視圖切換提供<strong>地理</strong>、<strong>拓撲</strong>與<strong>分割</strong>三種模式。供應鏈不再只是國家間的雙邊連線，而是圍繞<strong>功能供應中心</strong>組織——「國家×環節」，共 126 個、跨 7 個層級——由建模的環節中介連接相連（份額 × 環節邊先驗 × 份額）。你可以追蹤跨中心的路線、對任意中心施加衝擊並在所有視圖中逐跳演示傳導、臨時移除節點/邊（一切均可逆，支援復原/重做/重置），並查看拓撲指標——加權度、可達性、介數中心性、節點移除影響——每個都標註為拓撲度量，與網路影響力分開，絕非經過校準的風險。這是建模的連通性，而非經核實的實物運輸。",
    ja: "<strong>ネットワークとして探索。</strong>ビュー切替で<strong>地理</strong>・<strong>トポロジー</strong>・<strong>分割</strong>を選べます。二国間リンクだけでなく、チェーンは<strong>機能供給センター</strong>——国 × 工程、7ティアにわたる126センター——を軸に構成され、モデル化された工程媒介リンク（シェア × 工程エッジ事前値 × シェア）で結ばれます。複数センターにまたがる経路の追跡、任意のセンターへの衝撃付与と全ビューでのホップごとの伝播再生、ノード／エッジの一時除去（すべて取り消し・やり直し・リセット可能）ができ、トポロジー指標——加重次数・到達可能性・媒介中心性・ノード除去影響——を確認できます。各指標はトポロジー指標として明示し、ネットワーク影響力とは分離、較正済みリスクではありません。モデル化された連結性であり、検証された出荷ではありません。",
  },
  s1Under: {
    en: 'Underneath sits one propagation engine with three uses: snapshot events, hypothetical scenarios, and company-disruption simulations all run through the identical code path. When an event lands, it decays from its declared severity and age with a true 12-day half-life, propagates downstream along a directional input-dependence prior, and echoes upstream along a separate supplier-revenue-dependence prior — every affected stage, company, and country updates at once, and multiple simultaneous shocks combine boundedly rather than simply overwriting each other.',
    zh: '底层是同一个传导引擎的三种用法：快照事件、假设性情景与公司中断模拟，全部走同一条代码路径。事件发生时，会以真实的 12 天半衰期从其申报的严重度与发生时间开始衰减，沿方向性的输入依赖先验值向下游传导，并沿另一个独立的供应商收入依赖先验值向上游回响——所有受影响的环节、公司与国家会同时更新，多个同时发生的冲击会以有界的方式叠加，而不是简单地相互覆盖。',
    tw: '底層是同一個傳導引擎的三種用法：快照事件、假設性情境與公司中斷模擬，全部走同一條程式碼路徑。事件發生時，會以真實的 12 天半衰期從其申報的嚴重度與發生時間開始衰減，沿方向性的輸入依賴先驗值向下游傳導，並沿另一個獨立的供應商收入依賴先驗值向上游迴響——所有受影響的環節、公司與國家會同時更新，多個同時發生的衝擊會以有界的方式疊加，而不是簡單地相互覆蓋。',
    ja: 'その基盤にあるのは、一つの伝播エンジンの3通りの使い方です：スナップショット上のイベント、仮想シナリオ、企業破綻シミュレーションはすべて同一のコードパスを通ります。イベントが発生すると、申告された深刻度と経過日数から真の12日半減期で減衰し、方向性を持つ入力依存性の事前値に沿って下流へ伝播し、別の上流供給者収益依存性の事前値に沿って上流へも反響します——影響を受けるすべての工程・企業・国が同時に更新され、複数の同時発生ショックは単純に上書きされるのではなく、有界な形で合成されます。',
  },

  legendG: { en: 'Moderate structural vulnerability < 5.5', zh: '中等结构性脆弱度 < 5.5', tw: '中等結構性脆弱度 < 5.5', ja: '中程度の構造的脆弱性 < 5.5' },
  legendA: { en: 'Elevated 5.5 – 7.5', zh: '偏高 5.5 – 7.5', tw: '偏高 5.5 – 7.5', ja: '上昇 5.5～7.5' },
  legendR: { en: 'High ≥ 7.5', zh: '高 ≥ 7.5', tw: '高 ≥ 7.5', ja: '高 ≥ 7.5' },
  legendC: { en: 'Copper = network influence, modeled input-dependence, and scenario deltas', zh: '铜色 = 网络影响力、建模的输入依赖度与情景增量', tw: '銅色 = 網路影響力、建模的輸入依賴度與情境增量', ja: '銅色 = ネットワーク影響度、モデル化された入力依存性、シナリオ差分' },
  s2Body: {
    en: "In the flow graph, <strong>edge thickness</strong> is a modeled input-dependence prior (not a measured value flow), and each stage's <strong>dot and border size</strong> is its network influence — a Leontief-style sensitivity proxy, not a raw path count. The <strong>WHAT CHANGED</strong> strip at the top always summarizes the current state in one line, tagged structural, operational, or scenario-delta — it turns copper when a hypothetical scenario is active, and never rewrites the historical baseline.",
    zh: '在产业流图中，<strong>连线粗细</strong>是建模出的输入依赖先验值（并非实测的价值流量），每个环节的<strong>圆点与边框大小</strong>是其网络影响力——一种 Leontief 风格的敏感性代理指标，而非原始路径计数。顶部的<strong>"发生了什么变化"</strong>栏始终用一行概括当前状态，并标注为结构性、运营性或情景增量——当假设性情景激活时会变为铜色，且从不改写历史基线。',
    tw: '在產業流圖中，<strong>連線粗細</strong>是建模出的輸入依賴先驗值（並非實測的價值流量），每個環節的<strong>圓點與邊框大小</strong>是其網路影響力——一種 Leontief 風格的敏感度代理指標，而非原始路徑計數。頂部的<strong>「發生了什麼變化」</strong>欄始終用一行概括當前狀態，並標註為結構性、營運性或情境增量——當假設性情境啟用時會變為銅色，且從不改寫歷史基線。',
    ja: 'フローグラフでは、<strong>エッジの太さ</strong>はモデル化された入力依存性の事前値であり（実測された価値の流れではありません）、各工程の<strong>ドットと枠のサイズ</strong>はそのネットワーク影響度——Leontief型の感度プロキシであり、単純な経路数ではありません。上部の<strong>「WHAT CHANGED」</strong>帯は常に現在の状態を一行で要約し、構造的・運用的・シナリオ差分のいずれかのタグが付きます——仮想シナリオが有効なときは銅色に変わりますが、過去の基準系列を書き換えることは決してありません。',
  },

  step1: { en: 'Tap an event in the feed', zh: '点击事件流中的事件', tw: '點擊事件流中的事件', ja: 'イベントをタップ' },
  step1Body: {
    en: "Start with the top card — the U.S. export-control expansion. The map highlights affected countries, the flow highlights affected stages, and the detail view shows the exact engine formula (severity × time decay, with confidence shown only as separate metadata), the operational impact index, and a modeled-contribution spread tree: source companies first, then their downstream, ranked by contribution, not raw exposure.",
    zh: '从顶部卡片开始——美国出口管制扩大。地图会高亮受影响的国家，产业流会高亮受影响的环节，详情视图会展示精确的引擎公式（严重度 × 时间衰减，置信度仅作为独立的元数据显示）、运营影响指数，以及建模贡献度传导图：先是源头公司，再是其下游，按贡献度而非原始敞口排序。',
    tw: '從頂部卡片開始——美國出口管制擴大。地圖會高亮受影響的國家，產業流會高亮受影響的環節，詳情視圖會展示精確的引擎公式（嚴重度 × 時間衰減，信賴度僅作為獨立的中繼資料顯示）、營運影響指數，以及建模貢獻度傳導圖：先是源頭公司，再是其下游，按貢獻度而非原始曝險排序。',
    ja: 'まず一番上のカード——米国の輸出規制拡大——から始めましょう。地図は影響を受ける国を、フローは影響を受ける工程をハイライトし、詳細ビューには正確なエンジン式（深刻度×時間減衰、信頼度は別枠のメタデータとしてのみ表示）、運用インパクト指数、そしてモデル化された寄与度の展開ツリー——まず発生源企業、次にその下流を、生のエクスポージャーではなく寄与度でランク付けして——が表示されます。',
  },
  tip1: {
    en: 'Every event card shows an operational-impact number on the same 0–10 scale, so a policy rule and a capacity announcement are directly comparable — and hazard-signal, mixed, or long-term-strategic events carry an explicit banner explaining why they are excluded from that score.',
    zh: '每张事件卡都带有相同 0–10 尺度的运营影响数值，因此政策规则与产能公告可以直接比较——而风险信号类、混合类或长期战略类事件都会显示明确的横幅，说明它们为何被排除在该分数之外。',
    tw: '每張事件卡都帶有相同 0–10 尺度的營運影響數值，因此政策規則與產能公告可以直接比較——而風險訊號類、混合類或長期策略類事件都會顯示明確的橫幅，說明它們為何被排除在該分數之外。',
    ja: '各イベントカードには同一の0～10スケールの運用インパクト数値が表示され、政策と設備投資の発表を直接比較できます——ハザードシグナルのみ、混合型、長期戦略型のイベントには、そのスコアから除外されている理由を説明する明示的なバナーが表示されます。',
  },
  step2: { en: 'Open a stage subsection', zh: '展开环节子板块', tw: '展開環節子板塊', ja: '工程のサブセクションを開く' },
  step2Body: {
    en: 'Tap any stage in the flow — say Deposition. A subsection opens beneath the graph listing the major companies with their market shares, each one\'s modeled contribution to the current operational impact, and their top customers with percentages.',
    zh: '点击产业流中的任意环节——比如"沉积"。图下方会展开一个子板块，列出主要公司及其市场份额、各自对当前运营影响的建模贡献度，以及各自最大的几个客户及其占比。',
    tw: '點擊產業流中的任意環節——比如「沉積」。圖下方會展開一個子板塊，列出主要公司及其市場份額、各自對當前營運影響的建模貢獻度，以及各自最大的幾個客戶及其佔比。',
    ja: 'フロー内の任意の工程——例えば「デポジション（成膜）」——をタップしてください。グラフの下にサブセクションが開き、主要企業とその市場シェア、現在の運用インパクトへの各社のモデル化された寄与度、そして各社の主要顧客とその割合が一覧表示されます。',
  },
  step3: { en: 'Drill into a company', zh: '深入单个公司', tw: '深入單一公司', ja: '企業を深掘り' },
  step3Body: {
    en: "Tap a company card. You get three separate numbers, never blended: <strong>systemic criticality</strong> (a simulated full disruption propagated through the engine), <strong>vulnerability</strong> (its average adverse impact, independent of market share), and <strong>contribution</strong> (share-weighted, so market size is never hidden) — plus its production footprint, customers and suppliers with sales shares, and two spread trees.",
    zh: '点击一张公司卡片，你会得到三个从不混合的独立数值：<strong>系统性关键度</strong>（模拟其完全中断并通过引擎传导）、<strong>脆弱度</strong>（与市场份额无关的平均不利影响）、以及<strong>贡献度</strong>（份额加权，市场规模绝不会被隐藏）——此外还有其生产足迹、带销售占比的客户与供应商，以及两棵传导树。',
    tw: '點擊一張公司卡片，你會得到三個從不混合的獨立數值：<strong>系統性關鍵度</strong>（模擬其完全中斷並透過引擎傳導）、<strong>脆弱度</strong>（與市場份額無關的平均不利影響）、以及<strong>貢獻度</strong>（份額加權，市場規模絕不會被隱藏）——此外還有其生產足跡、帶銷售佔比的客戶與供應商，以及兩棵傳導樹。',
    ja: '企業カードをタップすると、決して混ぜ合わされない3つの独立した数値が表示されます：<strong>システミック・クリティカリティ</strong>（エンジンで伝播シミュレーションされた完全停止）、<strong>脆弱性</strong>（市場シェアに依存しない平均的な悪影響）、そして<strong>寄与度</strong>（シェア加重で、市場規模が隠れることはありません）——さらに生産フットプリント、売上シェア付きの顧客・サプライヤー、2種類の展開ツリーも表示されます。',
  },
  tip3: {
    en: "A supplier sending some share of its sales to a customer is not the same as that customer being that dependent on the supplier for input. SSCIM shows both directions as two separately labeled priors — a downstream input-dependence proxy and an upstream supplier-revenue-dependence proxy — precisely so you don't conflate them.",
    zh: '供应商将其部分销售额输送给某客户，不等于该客户对该供应商的输入依赖程度相同。SSCIM 将两个方向分别标注为两个独立的先验值——下游输入依赖代理指标与上游供应商收入依赖代理指标——正是为了避免混淆两者。',
    tw: '供應商將其部分銷售額輸送給某客戶，不等於該客戶對該供應商的輸入依賴程度相同。SSCIM 將兩個方向分別標註為兩個獨立的先驗值——下游輸入依賴代理指標與上游供應商收入依賴代理指標——正是為了避免混淆兩者。',
    ja: 'サプライヤーが売上の一部をある顧客向けに出荷しているからといって、その顧客が同じ割合だけそのサプライヤーからの入力に依存しているとは限りません。SSCIMはこの2つの方向を、下流の入力依存性プロキシと上流の供給者収益依存性プロキシという、別々にラベル付けされた2つの事前値として表示し、両者を混同しないようにしています。',
  },
  step4: { en: 'Check the company rank', zh: '查看公司排名', tw: '查看公司排名', ja: '企業ランキングを確認' },
  step4Body: {
    en: 'The second tab of the intelligence panel ranks every company by systemic criticality. TSMC, ASML and NVIDIA emerge at the top from the mathematics, not by assertion — tap any name to see why, and to see how its vulnerability and contribution differ from its criticality.',
    zh: '情报面板的第二个标签页会按系统性关键度对所有公司排名。台积电、ASML 与英伟达之所以名列前茅，是数学推导的结果，而非断言——点击任意名字即可看到原因，以及其脆弱度与贡献度与关键度有何不同。',
    tw: '情報面板的第二個標籤頁會按系統性關鍵度對所有公司排名。台積電、ASML 與 NVIDIA 之所以名列前茅，是數學推導的結果，而非斷言——點擊任意名字即可看到原因，以及其脆弱度與貢獻度與關鍵度有何不同。',
    ja: 'インテリジェンス・パネルの2番目のタブでは、すべての企業をシステミック・クリティカリティでランク付けします。TSMC、ASML、NVIDIAが上位に来るのは、断定ではなく数学的な結果です——任意の名前をタップして、その理由と、脆弱性・寄与度がクリティカリティとどう異なるかを確認できます。',
  },
  step5: { en: 'Run a scenario — or build your own', zh: '运行情景——或自建情景', tw: '執行情境——或自建情境', ja: 'シナリオを実行・作成' },
  step5Body: {
    en: 'The header buttons inject hypothetical events — Taiwan Strait crisis, China materials ban, Export controls max — into the same engine, or build a custom one. The scenario is shown as a current value against an untouched baseline, with a signed delta on every affected stage, company, and country; nothing about the historical series is ever rewritten. Baseline clears it.',
    zh: '页眉按钮会将假设性事件——台海危机、中国材料禁令、出口管制升级——注入同一个引擎，你也可以自建情景。情景会作为相对于未受影响基线的当前值展示，每个受影响的环节、公司与国家都会附带带正负号的增量；历史序列的任何部分都不会被改写。点击"基线"即可清除情景。',
    tw: '頁首按鈕會將假設性事件——台海危機、中國材料禁令、出口管制升級——注入同一個引擎，你也可以自建情境。情境會作為相對於未受影響基線的當前值展示，每個受影響的環節、公司與國家都會附帶帶正負號的增量；歷史序列的任何部分都不會被改寫。點擊「基線」即可清除情境。',
    ja: 'ヘッダーのボタンは、台湾海峡危機・中国材料禁輸・輸出規制最大化といった仮想イベントを同一エンジンに注入します。カスタムシナリオを作成することもできます。シナリオは、手つかずの基準値に対する現在値として表示され、影響を受けるすべての工程・企業・国に符号付きの差分が付きます。過去の系列が書き換えられることは一切ありません。「Baseline」でクリアできます。',
  },
  step6: { en: 'Generate the briefing', zh: '生成简报', tw: '產生簡報', ja: 'ブリーフィングを生成' },
  step6Body: {
    en: 'The <strong>⚡ GP Briefing</strong> button composes a full intelligence briefing from the current model state — ranked by marginal scenario delta when a scenario is active, by baseline operational impact otherwise — what changed, most-affected nodes, company leaders, country board, watch-next, ready to copy or download.',
    zh: '<strong>⚡ GP 简报</strong>按钮会根据当前模型状态生成一份完整的情报简报——情景激活时按边际情景增量排序，否则按基线运营影响排序——包括发生了什么变化、受影响最大的节点、公司领跑者、国家风险榜、后续观察点，可直接复制或下载。',
    tw: '<strong>⚡ GP 簡報</strong>按鈕會根據目前模型狀態產生一份完整的情報簡報——情境啟用時按邊際情境增量排序，否則按基線營運影響排序——包括發生了什麼變化、受影響最大的節點、公司領跑者、國家風險榜、後續觀察點，可直接複製或下載。',
    ja: '<strong>⚡ GP ブリーフィング</strong>ボタンは、現在のモデル状態から完全なインテリジェンス・ブリーフィングを作成します——シナリオが有効な場合は限界シナリオ差分で、そうでない場合は基準運用インパクトでランク付けされ——何が変わったか、最も影響を受けたノード、企業リーダー、国別リスクボード、次に見るべき点が含まれ、コピーやダウンロードがすぐにできます。',
  },
  step7: { en: 'Verify anything', zh: '验证一切', tw: '驗證一切', ja: 'すべてを検証' },
  step7Body: {
    en: 'The <strong>ⓘ Methodology</strong> button documents every formula exactly as implemented, every propagation prior, which components are computed versus declared analyst judgment, and the full model-status statement. The <strong>? Guide</strong> button inside the app repeats this walkthrough in short form.',
    zh: '<strong>ⓘ 方法论</strong>按钮记录了每一个与代码完全一致的公式、每一个传导先验值、哪些分量是计算得出、哪些是申明的分析师判断，以及完整的模型现状声明。应用内的<strong>? 指南</strong>按钮会以简短形式重复此导览。',
    tw: '<strong>ⓘ 方法論</strong>按鈕記錄了每一個與程式碼完全一致的公式、每一個傳導先驗值、哪些分量是計算得出、哪些是申明的分析師判斷，以及完整的模型現狀聲明。應用內的<strong>? 指南</strong>按鈕會以簡短形式重複此導覽。',
    ja: '<strong>ⓘ 方法論</strong>ボタンは、実装どおりの各数式、各伝播事前値、どの成分が計算値でどれが宣言されたアナリスト判断か、そして完全なモデル現状声明を記載しています。アプリ内の<strong>? ガイド</strong>ボタンは、このウォークスルーを簡略形式で繰り返します。',
  },

  s4Body: {
    en: 'Three of five structural components are computed from the graph and data; two are declared analyst inputs, tagged as such on every breakdown bar. Confidence is always shown as metadata, never multiplied into a magnitude — and multiple simultaneous shocks combine through a bounded rule that can only add to, never subtract from, the total. Explainability isn\'t a feature here — it\'s the entire trust model.',
    zh: '五个结构性分量中有三个由图结构与数据计算得出；另外两个为申明的分析师输入，并在每个分解条上如实标注。置信度始终作为元数据展示，绝不会被乘入数值本身——多个同时发生的冲击会通过一个有界规则叠加，该规则只能增加、绝不会减少总量。可解释性在这里不是一项功能——而是全部的信任基础。',
    tw: '五個結構性分量中有三個由圖結構與數據計算得出；另外兩個為申明的分析師輸入，並在每個分解條上如實標註。信賴度始終作為中繼資料展示，絕不會被乘入數值本身——多個同時發生的衝擊會透過一個有界規則疊加，該規則只能增加、絕不會減少總量。可解釋性在這裡不是一項功能——而是全部的信任基礎。',
    ja: '5つの構造成分のうち3つはグラフとデータから計算され、残り2つは宣言されたアナリスト入力であり、各内訳バーにその旨が明示されます。信頼度は常にメタデータとして表示され、決して数値に掛け合わされることはありません——複数の同時ショックは、合計に対して加算のみを行い減算はしない有界なルールで合成されます。ここでの説明可能性は単なる機能ではなく、信頼モデルそのものです。',
  },
  s5Body: {
    en: 'This is a research prototype: a frozen demonstration snapshot, not a live feed, with declared propagation priors that have not been fit to any observed disruption episode. Company market shares, customer relationships and shareholder stakes draw on public filings and market-share trackers wherever a reliable source exists, and headline corrections are logged with their citation; figures without one are still analyst judgment, not yet individually sourced. See <strong>MODEL_ROADMAP.md</strong> for what real calibration would require. Everything SSCIM produces is descriptive sensitivity analysis — <strong>never investment advice</strong>.',
    zh: '这是一个研究原型：一份冻结的演示快照，而非实时数据源，配备了尚未拟合到任何已观测中断事件的、声明的传导先验值。公司市场份额、客户关系与股东持股在存在可靠来源的情况下参考公开申报与市场份额追踪数据，重大修正会附带引用记录；没有引用的数字仍是分析师判断，尚未逐项溯源。真正的校准需要什么，请参见 <strong>MODEL_ROADMAP.md</strong>。SSCIM 产出的一切都是描述性的敏感性分析——<strong>绝不构成投资建议</strong>。',
    tw: '這是一個研究原型：一份凍結的示範快照，而非即時資料源，配備了尚未擬合到任何已觀測中斷事件的、聲明的傳導先驗值。公司市場份額、客戶關係與股東持股在存在可靠來源的情況下參考公開申報與市場份額追蹤資料，重大修正會附帶引用記錄；沒有引用的數字仍是分析師判斷，尚未逐項溯源。真正的校準需要什麼，請參見 <strong>MODEL_ROADMAP.md</strong>。SSCIM 產出的一切都是描述性的敏感度分析——<strong>絕不構成投資建議</strong>。',
    ja: 'これはリサーチ・プロトタイプです：ライブフィードではなく凍結されたデモ用スナップショットであり、観測された破綻事例に一切フィットさせていない、宣言された伝播事前値を用いています。企業の市場シェア、顧客関係、株主持分は、信頼できる情報源が存在する限り公開申告書や市場シェア調査を参照しており、主要な修正には出典が記録されています。出典のない数値は引き続きアナリスト判断であり、個別の出典確認はまだ済んでいません。本当の較正に何が必要かは <strong>MODEL_ROADMAP.md</strong> をご覧ください。SSCIMが生成するものはすべて記述的な感度分析です——<strong>投資助言では決してありません</strong>。',
  },

  launchDashboardBottom: { en: 'Launch the dashboard →', zh: '启动仪表盘 →', tw: '啟動儀表板 →', ja: 'ダッシュボードを起動 →' },
  footerText: {
    en: 'Figures reflect a best-effort research pass over public sources; not every figure is individually cited yet. This is a research prototype, not a live or calibrated forecasting system — nothing on this page or in the product constitutes investment advice.',
    zh: '数字反映了一轮基于公开来源的尽力而为的研究核校，尚未每项都逐一标注出处。这是一个研究原型，而非实时或经过校准的预测系统——本页或产品中的任何内容均不构成投资建议。',
    tw: '數字反映了一輪基於公開來源的盡力而為的研究核校，尚未每項都逐一標注出處。這是一個研究原型，而非即時或經過校準的預測系統——本頁或產品中的任何內容均不構成投資建議。',
    ja: '数値は公開情報源に基づくベストエフォートの調査を反映していますが、すべての数値に個別の出典があるわけではありません。これはリサーチ・プロトタイプであり、ライブまたは較正済みの予測システムではありません——本ページおよび製品のいかなる内容も投資助言を構成するものではありません。',
  },
};
