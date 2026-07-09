import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SSCIM dashboard build config.
// base: './' keeps all built asset paths relative, so the bundle works whether
// served from a domain root or a GitHub Pages project subpath — matching how
// the sibling static pages (index.html / intro.html) already use relative links.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Land the build artifact outside app/ at the repo root, keeping app/ pure source.
    outDir: '../dist-app',
    emptyOutDir: true,
  },
});
