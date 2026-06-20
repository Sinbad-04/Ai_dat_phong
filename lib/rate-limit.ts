type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };
const buckets = globalStore.__rateLimitBuckets ?? new Map<string, Bucket>();
globalStore.__rateLimitBuckets = buckets;

export type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowMs: number;
  identifier?: string;
  now?: number;
};

export function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = options.now ?? Date.now();
  const identifier = options.identifier || requestIdentifier(request);
  const key = `${options.namespace}:${identifier}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + options.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  if (buckets.size > 5_000) {
    for (const [storedKey, stored] of buckets) {
      if (stored.resetAt <= now) buckets.delete(storedKey);
    }
  }

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

export function rateLimitResponse(retryAfter: number) {
  return new Response(JSON.stringify({ error: "Bạn thao tác quá nhanh. Vui lòng thử lại sau." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}

