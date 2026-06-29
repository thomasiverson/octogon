import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// npm scripts run from the repo root, so cwd is the package root.
const repoRoot = process.cwd();

export default defineConfig({
  root: path.resolve(repoRoot, 'webview'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(repoRoot, 'media'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(repoRoot, 'webview/src/main.tsx'),
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.[ext]',
        // Single self-contained bundle so panel.ts can reference one script.
        inlineDynamicImports: true
      }
    }
  }
});
