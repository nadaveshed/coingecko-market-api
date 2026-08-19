export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private checks = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowSeconds: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  check(key: string): { allowed: boolean; retryAfter: number } {
    const now = this.now();
    const windowMs = this.windowSeconds * 1000;
    this.checks += 1;
    if (this.checks % 100 === 0) this.sweep(now, windowMs);
    const recent = (this.hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);

    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      const retryAfter = Math.max(1, Math.floor((windowMs - (now - oldest)) / 1000) + 1);
      return { allowed: false, retryAfter };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfter: 0 };
  }

  get trackedClients(): number {
    return this.hits.size;
  }

  private sweep(now: number, windowMs: number): void {
    for (const [key, stamps] of this.hits) {
      const recent = stamps.filter((stamp) => now - stamp < windowMs);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}
