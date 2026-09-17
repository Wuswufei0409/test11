import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
