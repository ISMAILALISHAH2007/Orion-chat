// Basic rate limiting using an in-memory map.
// Note: In a production multi-instance environment, you should use Redis (e.g. @vercel/kv)

const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || record.expiresAt < now) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}
