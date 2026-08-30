import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/* Build a React “island” for the show page. Vanilla app stays as-is;
   the bundle exposes window.OperateReact.mountShow / unmountShow. */
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/show/main.jsx', import.meta.url)),
      name: 'OperateReact',
      formats: ['iife'],
      fileName: () => 'react-show.js'
    },
    outDir: 'js',
    rollupOptions: {
      output: {
        exports: 'named',
        inlineDynamicImports: true,
        assetFileNames: 'react-show.[ext]'
      }
    },
    cssCodeSplit: false,
    sourcemap: true
  }
});
