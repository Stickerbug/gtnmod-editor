import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks: {
          blockly: ['blockly', 'blockly/msg/zh-hans'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
