/**
 * Per-page-load, in-memory TTL cache. Cleared on navigation (the SPFI/registry
 * is rebuilt). Never used for sensitive data (Quick Pulse responses, spend) —
 * those services pass `ttlSeconds: 0` or bypass the cache entirely (PERFORMANCE.md).
 */

export interface ICache {
  /**
   * Return the cached value for `key` if still fresh, otherwise run `factory`,
   * cache its result for `ttlSeconds`, and return it. In-flight calls for the
   * same key are de-duplicated.
   */
  getOrAdd<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
  /** Remove a single entry (e.g. after a write that invalidates it). */
  invalidate(key: string): void;
  /** Drop everything. */
  clear(): void;
}

interface ICacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache implements ICache {
  private readonly store = new Map<string, ICacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  public async getOrAdd<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<T> {
    if (ttlSeconds > 0) {
      const entry = this.store.get(key) as ICacheEntry<T> | undefined;
      if (entry !== undefined && entry.expiresAt > Date.now()) {
        return entry.value;
      }
    }

    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing !== undefined) {
      return existing;
    }

    const promise = this.run(key, ttlSeconds, factory);
    this.inflight.set(key, promise);
    return promise;
  }

  private async run<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<T> {
    try {
      const value = await factory();
      if (ttlSeconds > 0) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      }
      return value;
    } finally {
      this.inflight.delete(key);
    }
  }

  public invalidate(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}
