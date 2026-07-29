/* Document tags, so a reader can narrow 60-odd documents to the handful that
   match why they came.

   A document declares its own tags with an HTML comment on any line:

     <!-- tags: methodology, math -->

   An HTML comment is deliberate: it is invisible wherever Markdown is
   rendered, including on GitHub, so tagging costs the document nothing.
   YAML front matter would have shown up as a stray table there.

   Anything untagged falls back to a rule based on its location, so the filter
   is complete from the first build rather than only covering documents
   someone remembered to annotate. */

export const TAG_ORDER = [
  'start-here',
  'guide',
  'methodology',
  'math',
  'data',
  'engineering',
  'research',
  'reference',
  'worked-example',
];

export const TAG_LABELS = {
  'start-here': 'Start here',
  guide: 'Guide',
  methodology: 'Methodology',
  math: 'Mathematics',
  data: 'Data',
  engineering: 'Engineering',
  research: 'Research',
  reference: 'Reference',
  'worked-example': 'Worked example',
};

const DECLARED = /<!--\s*tags:\s*([^>]+?)\s*-->/i;

/* Path-based fallback, most specific first. */
const RULES = [
  [/^docs\/README(\.\w+)?\.md$/, ['start-here', 'guide']],
  [/^docs\/PUBLIC_GUIDE\.md$/, ['start-here', 'guide']],
  [/^docs\/METHODOLOGY\.md$/, ['methodology', 'math']],
  [/^docs\/calculation\.md$/, ['methodology', 'math', 'reference']],
  [/^docs\/ACADEMIC_GUIDE\.md$/, ['research', 'methodology']],
  [/^docs\/DEVELOPER_GUIDE\.md$/, ['engineering']],
  [/^docs\/SYSTEM_ARCHITECTURE\.md$/, ['engineering', 'reference']],
  [/^docs\/NETWORK_ARCHITECTURE\.md$/, ['engineering', 'methodology']],
  [/^docs\/DATA_SOURCES_AND_OUTPUTS\.md$/, ['data', 'reference']],
  [/^docs\/MODEL_ROADMAP\.md$/, ['research', 'data']],
  [/^docs\/DOCUMENTATION_REFERENCE\.md$/, ['reference', 'start-here']],
  [/^docs\/computation-demo\/.*VALIDATION.*\.md$/i, ['research', 'math']],
  [/^docs\/computation-demo\/DATA_PIPELINE\.md$/, ['data', 'engineering']],
  [/^docs\/computation-demo\//, ['worked-example', 'guide']],
  [/^docs\//, ['reference']],
];

export function tagsFor(path, content = '') {
  const declared = DECLARED.exec(content);
  if (declared) {
    const tags = declared[1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length) return dedupe(tags);
  }
  for (const [pattern, tags] of RULES) {
    if (pattern.test(path)) return dedupe(tags);
  }
  return ['reference'];
}

const dedupe = (tags) => [...new Set(tags)].sort((a, b) => {
  const ai = TAG_ORDER.indexOf(a);
  const bi = TAG_ORDER.indexOf(b);
  return (ai < 0 ? TAG_ORDER.length : ai) - (bi < 0 ? TAG_ORDER.length : bi) || a.localeCompare(b);
});

export const labelFor = (tag) => TAG_LABELS[tag] || tag.replace(/-/g, ' ');
