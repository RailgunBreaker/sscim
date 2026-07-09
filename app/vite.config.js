import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// SSCIM build config — multi-page: landing (index.html), guide (intro.html),
// and the dashboard (sscim-app.html) are three separate React entry points
// built from this one project, sharing theme/i18n-pattern/components (Tex, etc).
// base: './' keeps all built asset paths relative, so the bundle works whether
// served from a domain root or a GitHub Pages project subpath.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Land the build artifact outside app/ at the repo root, keeping app/ pure source.
    outDir: '../dist-app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        intro: resolve(__dirname, 'intro.html'),
        dashboard: resolve(__dirname, 'sscim-app.html'),
      },
    },
  },
});
