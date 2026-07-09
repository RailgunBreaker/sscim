import katex from 'katex';
import 'katex/dist/katex.min.css';

/* ==================== TeX formula rendering ====================
   katex is a real npm dependency now (bundled by Vite) — no CDN script
   injection, no window.katex checks, no loading state. */
export default function Tex({ tex, block }) {
  return (
    <span
      style={{ fontSize: block ? 13 : 12 }}
      dangerouslySetInnerHTML={{ __html: katex.renderToString(tex, { displayMode: !!block, throwOnError: false }) }}
    />
  );
}
