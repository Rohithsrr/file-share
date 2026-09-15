import { getServiceSupabase, isSupabaseConfigured } from "./supabase";

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

// In-memory fallback in case of database unavailability
const fallbackMemoryMap = new Map<
  string,
  { attempts: number; firstTime: number; lockedUntil?: number }
>();

function fallbackRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  lockoutSeconds: number
): RateLimitResult {
  const now = Date.now();
  const rec = fallbackMemoryMap.get(key);

  if (!rec) {
    fallbackMemoryMap.set(key, { attempts: 1, firstTime: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  if (rec.lockedUntil && rec.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000),
    };
  }

  if (now - rec.firstTime > windowSeconds * 1000) {
    fallbackMemoryMap.set(key, { attempts: 1, firstTime: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  rec.attempts += 1;
  if (rec.attempts >= maxAttempts) {
    rec.lockedUntil = now + lockoutSeconds * 1000;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: lockoutSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, maxAttempts - rec.attempts),
  };
}

/**
 * Universal Atomic Rate Limiter powered by Supabase Postgres.
 * Shared and synchronized across all Vercel Serverless Function instances.
 */
export async function enforceRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  lockoutSeconds: number
): Promise<RateLimitResult> {
  if (!isSupabaseConfigured()) {
    return fallbackRateLimit(key, maxAttempts, windowSeconds, lockoutSeconds);
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("check_and_record_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
      p_lockout_seconds: lockoutSeconds,
    });

    if (error || !data || data.length === 0) {
      console.warn("Database rate limit RPC failed, using fallback:", error?.message);
      return fallbackRateLimit(key, maxAttempts, windowSeconds, lockoutSeconds);
    }

    const row = data[0];
    return {
      allowed: Boolean(row.allowed),
      remainingAttempts: Number(row.remaining_attempts || 0),
      retryAfterSeconds: Number(row.retry_after_seconds || 0),
    };
  } catch (err) {
    console.warn("Rate limit exception, falling back to memory:", err);
    return fallbackRateLimit(key, maxAttempts, windowSeconds, lockoutSeconds);
  }
}

/**
 * Reset rate limit key (e.g. after successful password verification)
 */
export async function resetRateLimit(key: string): Promise<void> {
  fallbackMemoryMap.delete(key);
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getServiceSupabase();
    await supabase.rpc("reset_rate_limit_key", { p_key: key });
  } catch (err) {
    console.warn("Failed to reset rate limit in database:", err);
  }
}

/**
 * 1. Password Attempt Rate Limit:
 * 5 failed attempts per 5 minutes -> 10-minute lockout.
 */
export async function checkPasswordRateLimit(
  ip: string,
  code: string
): Promise<RateLimitResult> {
  const key = `pwd:${ip}:${code.toUpperCase()}`;
  return enforceRateLimit(key, 5, 300, 600);
}

/**
 * 2. Share Code Lookup Rate Limit (Anti-Enumeration):
 * Max 25 lookups per 5 minutes per IP -> 5-minute cooldown.
 */
export async function checkCodeLookupRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `lookup:${ip}`;
  return enforceRateLimit(key, 25, 300, 300);
}

/**
 * 3. File Upload Rate Limit (Anti-DoS / Anti-Abuse):
 * Max 5 uploads per 10 minutes per IP -> 10-minute cooldown.
 */
export async function checkUploadRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `upload:${ip}`;
  return enforceRateLimit(key, 5, 600, 600);
}
