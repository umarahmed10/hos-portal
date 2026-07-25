// ─────────────────────────────────────────────────────────────────────────────
// In-memory fixed-window rate limiter.
//
// ⚠ SERVERLESS CAVEAT: this Map lives in one instance's memory. On Vercel each
// lambda has its own copy and instances are recycled frequently, so the real
// limit is (configured max × number of warm instances) and resets on cold start.
// It raises the cost of brute force but does NOT hard-cap it.
//
// The credential endpoints (/api/auth, /api/portal-session) are the ones that
// matter. For a real guarantee, back this with Upstash Redis or Vercel KV —
// swap the store below; the rateLimit() signature stays the same.
// ─────────────────────────────────────────────────────────────────────────────
const store = new Map<string, { count: number; resetAt: number }>();

let pruneScheduled = false;
function schedulePrune() {
  if (pruneScheduled) return;
  pruneScheduled = true;
  setTimeout(() => {
    pruneScheduled = false;
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number }
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    schedulePrune();
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

export function rateLimiter(options: { windowMs: number; max: number }) {
  return (key: string) => rateLimit(key, options);
}
