import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "secure-files";

let serverClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase client for server-side operations (Route Handlers & Server Actions).
 * Uses SUPABASE_SERVICE_ROLE_KEY if provided, otherwise falls back to
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== "PASTE_YOUR_SERVICE_ROLE_KEY_HERE"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing Supabase configuration. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  if (!serverClientInstance) {
    serverClientInstance = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: process.env.CRON_SECRET
          ? { "x-server-auth": process.env.CRON_SECRET }
          : {},
      },
    });
  }

  return serverClientInstance;
}

/**
 * Checks if Supabase environment variables are properly configured
 */
export function isSupabaseConfigured(): boolean {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const hasValidServiceKey =
    serviceKey &&
    serviceKey !== "PASTE_YOUR_SERVICE_ROLE_KEY_HERE" &&
    serviceKey.length > 20;

  const hasValidAnonKey = anonKey && anonKey.length > 20;

  return Boolean(hasUrl && (hasValidServiceKey || hasValidAnonKey));
}
