import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game.html'),
        results: resolve(__dirname, 'results.html'),
        blog: resolve(__dirname, 'blog.html'),
        blog2: resolve(__dirname, 'blog2.html'),
        benchmark: resolve(__dirname, 'benchmark.html'),
      },
    },
  },
});
