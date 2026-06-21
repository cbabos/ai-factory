export interface IRateLimiter {
  acquire(key: string, tokens?: number): boolean;
  wait(key: string, tokens?: number): Promise<void>;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter implements IRateLimiter {
  private readonly maxPerSecond: number;
  private readonly burstSize: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: { maxPerSecond: number; burstSize?: number }) {
    this.maxPerSecond = options.maxPerSecond;
    this.burstSize = options.burstSize ?? options.maxPerSecond;
  }

  acquire(key: string, tokens = 1): boolean {
    const bucket = this.getBucket(key);
    this.refill(bucket);
    if (bucket.tokens < tokens) return false;
    bucket.tokens -= tokens;
    return true;
  }

  async wait(key: string, tokens = 1): Promise<void> {
    while (!this.acquire(key, tokens)) {
      const delay = Math.ceil(1000 / this.maxPerSecond);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private getBucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.burstSize, lastRefill: Date.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    const refillTokens = (elapsedMs / 1000) * this.maxPerSecond;
    bucket.tokens = Math.min(this.burstSize, bucket.tokens + refillTokens);
    bucket.lastRefill = now;
  }
}
