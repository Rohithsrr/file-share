-- ==============================================================================
-- SUPABASE SCHEMA: Secure Ephemeral File Sharing
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_files_share_code ON public.files (share_code);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON public.files (expires_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Service role & backend API access policies
DROP POLICY IF EXISTS "Service role full access" ON public.files;
CREATE POLICY "Service role full access"
    ON public.files
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access" ON public.files;
CREATE POLICY "Anon full access"
    ON public.files
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 4. Storage Bucket Setup: 'secure-files'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('secure-files', 'secure-files', false, 52428800, null)
ON CONFLICT (id) DO UPDATE 
SET public = false, file_size_limit = 52428800;

-- 5. Storage Access Policies
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

-- 6. Database-level automated cleanup function
CREATE OR REPLACE FUNCTION public.delete_expired_file_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.files
    WHERE expires_at < timezone('utc'::text, now());
END;
$$;
