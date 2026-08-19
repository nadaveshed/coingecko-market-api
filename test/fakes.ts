import { BTC, DOGE, ETH, TINY } from "./fixtures.js";

export class FakeUpstream {
  pages: Record<number, unknown[]>;
  errors: Record<number, Error> = {};
  calls: number[] = [];
  inflight = 0;
  maxInflight = 0;
  delayMs = 0;

  constructor(pages?: Record<number, unknown[]>) {
    this.pages = pages ?? { 1: [BTC, ETH], 2: [DOGE, TINY] };
  }

  async markets(args: { vsCurrency: string; page: number; perPage: number }): Promise<unknown> {
    this.inflight += 1;
    this.maxInflight = Math.max(this.maxInflight, this.inflight);
    this.calls.push(args.page);
    try {
      if (this.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }
      const error = this.errors[args.page];
      if (error) {
        throw error;
      }
      return this.pages[args.page] ?? [];
    } finally {
      this.inflight -= 1;
    }
  }
}
