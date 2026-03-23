import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'gridstack/dist/angular': fileURLToPath(new URL('./src/test-shims/gridstack-angular-shim.ts', import.meta.url)),
      'gridstack': fileURLToPath(new URL('./src/test-shims/gridstack-shim.ts', import.meta.url)),
      '@godind/canvas-gauges': fileURLToPath(new URL('./src/test-shims/canvas-gauges-shim.ts', import.meta.url)),
      '@godind/ng-canvas-gauges': fileURLToPath(new URL('./src/test-shims/ng-canvas-gauges-shim.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test.ts']
  }
});
