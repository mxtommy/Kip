import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Isolated Vitest config for the MCP schema generator.
 *
 * The generator is a plain Node tool (it reads files with ts-morph), so it runs
 * in the `node` environment with no Angular/jsdom setup. Kept separate from the
 * app's vitest.config.ts so `ng test` and `test:mcp-schema` never interfere.
 */
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  test: {
    globals: true,
    environment: 'node',
    include: ['tools/gen-mcp-schema/**/*.spec.ts'],
  },
});
