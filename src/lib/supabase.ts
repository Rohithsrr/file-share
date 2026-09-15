import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "secure-files";

let serviceClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured with the Service Role Key.
 * MUST only be invoked on the server side (in Route Handlers or Server Actions).
 * The Service Role Key bypasses RLS and can access private storage buckets.
 */
export function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
    );
  }

  if (!serviceClientInstance) {
    serviceClientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serviceClientInstance;
}

/**
 * Checks if Supabase environment variables are properly configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
