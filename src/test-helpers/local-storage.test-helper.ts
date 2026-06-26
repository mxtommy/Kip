/**
 * jsdom with an opaque origin (no document URL) does not expose Web Storage, so
 * `window.localStorage` / the global `localStorage` are undefined under the unit-test
 * runner. Services that read storage in their constructor then crash. This helper
 * installs a minimal in-memory Storage when one is missing and returns a cleared
 * instance for deterministic per-test seeding. It is a no-op (just clears) in
 * environments that already provide localStorage.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function ensureStorage(prop: 'localStorage' | 'sessionStorage'): Storage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;

  let existing: Storage | undefined;
  try {
    existing = g[prop];
  } catch {
    existing = undefined;
  }

  if (!existing) {
    const mem = new MemoryStorage();
    Object.defineProperty(g, prop, { configurable: true, value: mem });
    if (typeof window !== 'undefined') {
      try {
        Object.defineProperty(window, prop, { configurable: true, value: mem });
      } catch {
        /* ignore environments that forbid redefining the storage */
      }
    }
    existing = mem;
  }

  existing.clear();
  return existing;
}

export function ensureLocalStorage(): Storage {
  return ensureStorage('localStorage');
}

/**
 * Same in-memory shim as {@link ensureLocalStorage}, for the SSO redirect budget which lives in
 * sessionStorage (also undefined under the jsdom opaque origin).
 */
export function ensureSessionStorage(): Storage {
  return ensureStorage('sessionStorage');
}
