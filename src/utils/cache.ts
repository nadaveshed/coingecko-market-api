interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly maxSize = 256) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= performance.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= Math.max(1, this.maxSize) && !this.store.has(key)) {
      this.evict();
    }
    this.store.set(key, {
      value,
      expiresAt: performance.now() + Math.max(ttlSeconds, 0) * 1000,
    });
  }

  clear(): void {
    this.store.clear();
  }

  private evict(): void {
    const now = performance.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    if (this.store.size < Math.max(1, this.maxSize)) {
      return;
    }
    let oldestKey: string | undefined;
    let oldestAt = Infinity;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt < oldestAt) {
        oldestAt = entry.expiresAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}
