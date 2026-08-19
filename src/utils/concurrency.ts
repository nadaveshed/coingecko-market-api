export class BoundedLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < Math.max(1, this.limit)) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    next?.();
  }
}

export class Singleflight {
  private readonly inflight = new Map<string, Promise<unknown>>();

  async do<T>(key: string, factory: () => Promise<T>): Promise<{ value: T; coalesced: boolean }> {
    const existing = this.inflight.get(key);
    if (existing) {
      return { value: (await existing) as T, coalesced: true };
    }

    const pending = factory();
    this.inflight.set(key, pending);
    try {
      return { value: await pending, coalesced: false };
    } finally {
      if (this.inflight.get(key) === pending) {
        this.inflight.delete(key);
      }
    }
  }
}
