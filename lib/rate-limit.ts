// In-memory fixed-window limiter — adequate for this app's single-instance
// deployment scale; no need for a distributed store (Redis/Upstash) here.
// Protects the platform-owned Serper key, the one endpoint (/api/search)
// that isn't already implicitly capped by the 5-credit ceiling the way
// /api/chat is.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = MAX_REQUESTS_PER_WINDOW,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}
