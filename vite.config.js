import { defineConfig } from 'vite';

// Base rỗng để deploy root domain trên Hostinger.
// Nếu deploy vào sub-folder (vd: /game/) thì đổi base: '/game/'
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2019',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // three.js tách chunk riêng => sửa game không làm user tải lại three
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: {
    port: 5173,
    open: true
  }
});
