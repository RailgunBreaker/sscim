import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// SSCIM build config — multi-page: landing (index.html), guide (intro.html),
// updates (updates.html), the dashboard (sscim-app.html), the documentation
// reader (docs.html) and the operations dashboard (admin.html) are separate
// React entry points built from this one project, sharing theme, i18n pattern
// and components (Tex, SiteMap, NewsTicker, …).
// base: './' keeps all built asset paths relative, so the bundle works whether
// served from a domain root or a GitHub Pages project subpath.
/* The application version, read from package.json rather than typed
   into a component. The header used to display a hand-written build
   label that drifted two model versions out of date. */
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    manifest: true,
    // Land the build artifact outside app/ at the repo root, keeping app/ pure source.
    outDir: '../dist-app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        intro: resolve(__dirname, 'intro.html'),
        updates: resolve(__dirname, 'updates.html'),
        dashboard: resolve(__dirname, 'sscim-app.html'),
        admin: resolve(__dirname, 'admin.html'),
        docs: resolve(__dirname, 'docs.html'),
        document: resolve(__dirname, 'src/docs/page.jsx'),
      },
    },
  },
});
