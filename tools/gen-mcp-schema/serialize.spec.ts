import { describe, it, expect } from 'vitest';
import { canonicalize, toCanonicalJson } from './serialize';

describe('canonicalize', () => {
  it('sorts object keys recursively', () => {
    const input = { b: 1, a: { d: 2, c: 3 } };
    expect(JSON.stringify(canonicalize(input))).toBe(JSON.stringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('leaves primitives and null untouched', () => {
    expect(canonicalize('x')).toBe('x');
    expect(canonicalize(42)).toBe(42);
    expect(canonicalize(null)).toBeNull();
  });
});

describe('toCanonicalJson', () => {
  it('produces identical output regardless of input key order', () => {
    expect(toCanonicalJson({ x: 1, y: 2 })).toBe(toCanonicalJson({ y: 2, x: 1 }));
  });

  it('ends with a trailing newline', () => {
    expect(toCanonicalJson({})).toBe('{}\n');
  });
});
