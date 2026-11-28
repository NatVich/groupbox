import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Stamps dist/sw.js with this build's id and the list of built files, so the service worker
 * saves exactly this build for offline play and replaces the previous build's files.
 */
function serviceWorkerBuild(): Plugin {
  return {
    name: 'groupbox-service-worker',
    apply: 'build',
    writeBundle(options, bundle) {
      const file = join(options.dir ?? 'dist', 'sw.js');
      if (!existsSync(file)) return;
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .sort();
      const id = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const sw = readFileSync(file, 'utf8')
        .replace('__BUILD_ID__', id)
        .replace('__PRECACHE__', JSON.stringify(files.map((f) => `./${f}`)));
      writeFileSync(file, sw);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorkerBuild()],
  // The Firebase SDK is a separate chunk that is only loaded when Firebase is configured.
  build: { chunkSizeWarningLimit: 1000 },
  test: { globals: true, include: ['src/**/*.test.ts'] },
});
