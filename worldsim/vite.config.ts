import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built game works from any folder (e.g. GitHub Pages).
  base: './',
  server: {
    port: 5173,
    open: false,
    // Forward /api calls to the brain server during development.
    proxy: { '/api': 'http://localhost:8787' },
  },
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
