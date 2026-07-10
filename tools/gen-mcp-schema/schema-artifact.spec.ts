import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildSchema } from './generate';
import { toCanonicalJson } from './serialize';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const assetPath = join(projectRoot, 'src/assets/kip-dashboard-schema.json');
const expected = toCanonicalJson(buildSchema({ projectRoot }));

// `npm run gen:mcp-schema` sets UPDATE_SCHEMA to (re)write the committed artifact.
if (process.env.UPDATE_SCHEMA) {
  mkdirSync(dirname(assetPath), { recursive: true });
  writeFileSync(assetPath, expected);
}

describe('generated schema artifact', () => {
  it('is up to date — run `npm run gen:mcp-schema` after changing widgets or the design system', () => {
    const actual = readFileSync(assetPath, 'utf8');
    expect(actual).toBe(expected);
  });
});
