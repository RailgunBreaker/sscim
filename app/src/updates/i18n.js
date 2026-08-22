/* Updates-page dictionary. Page chrome only.

   The release entries themselves (src/data/releases.js) stay in English and
   the page says so, because three machine-translated accounts of what a
   propagation model does would be three subtly different accounts — and
   this project spends most of its effort making sure there is exactly one. */
export const LANG_LABELS = { en: 'EN', zh: '简', tw: '繁', ja: '日' };

export const T = {
  tag: {
    en: 'PRODUCT UPDATES',
    zh: '产品更新',
    tw: '產品更新',
    ja: 'プロダクト アップデート',
  },
  navGuide: { en: 'Guide & methodology', zh: '指南与方法论', tw: '指南與方法論', ja: 'ガイドと方法論' },
  navDocs: { en: 'Documentation', zh: '文档', tw: '文件', ja: 'ドキュメント' },
  navDashboard: { en: 'Open the dashboard →', zh: '打开仪表盘 →', tw: '開啟儀表板 →', ja: 'ダッシュボードを開く →' },

  h1a: { en: 'What changed, and', zh: '更新内容，以及', tw: '更新內容，以及', ja: '変更点と、' },
  h1b: { en: 'when', zh: '更新时间', tw: '更新時間', ja: 'その時期' },

  lede: {
    en: 'Every date below is the date the work actually landed in the repository — not a marketing date. Each release says what was built, and what that capability still does not know.',
    zh: '下列每个日期都是相关工作真正进入代码库的日期，而非市场宣传日期。每次更新都说明具体构建了什么，以及该能力仍然不知道什么。',
    tw: '下列每個日期都是相關工作真正進入程式碼庫的日期，而非行銷日期。每次更新都說明具體建置了什麼，以及該能力仍然不知道什麼。',
    ja: '以下の日付はいずれも、その作業が実際にリポジトリへ反映された日付であり、宣伝用の日付ではありません。各リリースには、何を作ったかと、その機能が依然として把握していないことの両方を記載しています。',
  },

  noteEnglish: {
    en: 'Release notes are maintained in English only. Translating technical release notes into several languages would produce several subtly different accounts of what the model does — and this project depends on there being exactly one.',
    zh: '更新说明仅以英文维护。把技术性的更新说明翻译成多种语言，会产生多份对模型行为略有出入的描述——而本项目依赖于只存在唯一一份描述。',
    tw: '更新說明僅以英文維護。將技術性的更新說明翻譯成多種語言，會產生多份對模型行為略有出入的描述——而本專案仰賴於只存在唯一一份描述。',
    ja: 'リリースノートは英語でのみ管理しています。技術的なリリースノートを複数言語に翻訳すると、モデルの挙動について微妙に異なる複数の説明が生まれます。本プロジェクトは説明がただ一つであることに依拠しています。',
  },

  newest: { en: 'NEWEST', zh: '最新', tw: '最新', ja: '最新' },
  limitsLabel: {
    en: 'WHAT THIS STILL DOES NOT KNOW',
    zh: '此功能仍然不知道什么',
    tw: '此功能仍然不知道什麼',
    ja: 'この機能が依然として把握していないこと',
  },

  sourceNote: {
    en: 'Dates and entries are derived from the repository history. The full delivered-and-planned roadmap, including the gates a release has to pass, is in the',
    zh: '日期与条目均来自代码库历史。完整的已交付与计划路线图（含每次发布必须通过的检查关卡）见',
    tw: '日期與條目均來自程式碼庫歷史。完整的已交付與計畫路線圖（含每次發布必須通過的檢查關卡）見',
    ja: '日付と項目はリポジトリ履歴から作成しています。提供済みおよび計画中の全ロードマップ（リリースが通過すべきゲートを含む）は',
  },
  roadmapLink: {
    en: 'roadmap and release history',
    zh: '路线图与发布历史',
    tw: '路線圖與發布歷史',
    ja: 'ロードマップとリリース履歴',
  },
};
