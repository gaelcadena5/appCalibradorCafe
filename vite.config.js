import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Disable hashing so filenames remain static and service worker caching works perfectly
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
});
