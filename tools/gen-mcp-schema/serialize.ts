/**
 * Canonical serialization for the generated schema artifact.
 *
 * The artifact is committed to the repo and checked by a CI drift gate, so its
 * output must be byte-stable: the same source always produces the same file,
 * regardless of the order keys happen to appear in the source.
 *
 * Strategy:
 *  - Object keys are sorted recursively (key order is never meaningful in JSON).
 *  - Array order is left untouched. Callers decide array order explicitly: sets
 *    such as widget lists and plugin lists are sorted for stable diffs, while
 *    semantically ordered lists (the colour palette, unit groups) keep their
 *    authored order.
 */

/** Returns a deep copy of `value` with every object's keys sorted. */
export function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key]);
    }
    return sorted as unknown as T;
  }
  return value;
}

/** Serializes `value` to canonical, pretty-printed JSON with a trailing newline. */
export function toCanonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}
