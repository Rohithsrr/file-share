interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  lockedUntil?: number;
}

// In-memory cache for IP + code brute-force protection
const rateLimitMap = new Map<string, RateLimitRecord>();

// Configuration: max 5 failed attempts within a 5-minute window (300,000 ms)
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;
const LOCKOUT_MS = 10 * 60 * 1000; // 10-minute lockout on exceeding

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.lockedUntil && record.lockedUntil > now) {
      continue;
    }
    if (now - record.lastAttemptTime > WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  // Check if actively locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Check if the rolling window has expired
  if (now - record.firstAttemptTime > WINDOW_MS) {
    rateLimitMap.delete(identifier);
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  // Check attempts count
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.attempts),
  };
}

export function recordFailedAttempt(identifier: string): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now - record.firstAttemptTime > WINDOW_MS) {
    rateLimitMap.set(identifier, {
      attempts: 1,
      firstAttemptTime: now,
      lastAttemptTime: now,
    });
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - 1,
    };
  }

  record.attempts += 1;
  record.lastAttemptTime = now;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.attempts),
  };
}

export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}
