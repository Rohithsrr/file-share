-- ==============================================================================
-- SUPABASE SCHEMA: Secure Ephemeral File Sharing & Defense-in-Depth Hardening
-- ==============================================================================

-- 1. Create the files table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_code VARCHAR(6) NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_archive BOOLEAN DEFAULT false,
    file_count INTEGER DEFAULT 1,
    files_manifest JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_files_share_code ON public.files (share_code);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON public.files (expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.files;
CREATE POLICY "Service role full access"
    ON public.files
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon backend access" ON public.files;
CREATE POLICY "Anon backend access"
    ON public.files
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 2. Storage Bucket Setup: 'secure-files' (Strictly Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('secure-files', 'secure-files', false, 52428800, null)
ON CONFLICT (id) DO UPDATE 
SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Private bucket service role access" ON storage.objects;
CREATE POLICY "Private bucket service role access"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'secure-files')
    WITH CHECK (bucket_id = 'secure-files');

DROP POLICY IF EXISTS "Private bucket anon access" ON storage.objects;
CREATE POLICY "Private bucket anon access"
    ON storage.objects
    FOR ALL
    TO anon
    USING (bucket_id = 'secure-files')
    WITH CHECK (bucket_id = 'secure-files');

-- 3. Centralized Serverless Rate Limiting Table
-- Guarantees atomic, synchronized rate limiting across all Vercel serverless edges
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_locked_until ON public.rate_limits (locked_until);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rate limits access" ON public.rate_limits;
CREATE POLICY "Rate limits access"
    ON public.rate_limits
    FOR ALL
    TO anon, service_role
    USING (true)
    WITH CHECK (true);

-- 4. Atomic Rate Limiting Function
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
    p_key TEXT,
    p_max_attempts INT,
    p_window_seconds INT,
    p_lockout_seconds INT
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining_attempts INT,
    retry_after_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_record public.rate_limits%ROWTYPE;
    v_window_interval INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
    v_lockout_interval INTERVAL := (p_lockout_seconds || ' seconds')::INTERVAL;
BEGIN
    SELECT * INTO v_record FROM public.rate_limits WHERE key = p_key FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.rate_limits (key, attempts, first_attempt_at, last_attempt_at, locked_until)
        VALUES (p_key, 1, v_now, v_now, NULL);
        RETURN QUERY SELECT true, GREATEST(0, p_max_attempts - 1), 0;
        RETURN;
    END IF;

    -- Check if actively locked out
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
        RETURN QUERY SELECT false, 0, CEIL(EXTRACT(EPOCH FROM (v_record.locked_until - v_now)))::INT;
        RETURN;
    END IF;

    -- Check if window has expired
    IF v_now - v_record.first_attempt_at > v_window_interval THEN
        UPDATE public.rate_limits
        SET attempts = 1, first_attempt_at = v_now, last_attempt_at = v_now, locked_until = NULL
        WHERE key = p_key;
        RETURN QUERY SELECT true, GREATEST(0, p_max_attempts - 1), 0;
        RETURN;
    END IF;

    -- Inside window: increment attempts
    IF v_record.attempts + 1 >= p_max_attempts THEN
        UPDATE public.rate_limits
        SET attempts = v_record.attempts + 1, last_attempt_at = v_now, locked_until = v_now + v_lockout_interval
        WHERE key = p_key;
        RETURN QUERY SELECT false, 0, p_lockout_seconds;
        RETURN;
    ELSE
        UPDATE public.rate_limits
        SET attempts = v_record.attempts + 1, last_attempt_at = v_now
        WHERE key = p_key;
        RETURN QUERY SELECT true, GREATEST(0, p_max_attempts - (v_record.attempts + 1)), 0;
        RETURN;
    END IF;
END;
$$;

-- 5. Rate Limit Key Reset Function
CREATE OR REPLACE FUNCTION public.reset_rate_limit_key(p_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.rate_limits WHERE key = p_key;
END;
$$;

-- 6. Cleanup Stale Rate Limits & Expired Files
CREATE OR REPLACE FUNCTION public.delete_expired_file_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.files
    WHERE expires_at < timezone('utc'::text, now());
    
    DELETE FROM public.rate_limits
    WHERE (locked_until IS NULL AND last_attempt_at < timezone('utc'::text, now()) - INTERVAL '1 hour')
       OR (locked_until IS NOT NULL AND locked_until < timezone('utc'::text, now()) - INTERVAL '1 hour');
END;
$$;
