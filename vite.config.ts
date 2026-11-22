import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // The Firebase SDK is a separate chunk that is only loaded when Firebase is configured.
  build: { chunkSizeWarningLimit: 1000 },
  test: { globals: true, include: ['src/**/*.test.ts'] },
});
