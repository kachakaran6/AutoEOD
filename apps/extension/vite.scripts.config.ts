import { defineConfig } from 'vite';
import { resolve } from 'path';

// This config builds the background and content scripts
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear popup assets
    lib: {
      entry: {
        background: resolve(__dirname, 'src/background/index.ts'),
        'content-script': resolve(__dirname, 'src/content/index.ts')
      },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js', // Output directly to dist/background.js and dist/content-script.js
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
