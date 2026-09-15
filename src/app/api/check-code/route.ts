import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";
import { CheckCodeResponse } from "@/lib/types";
import { checkCodeLookupRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";

export async function GET(req: NextRequest): Promise<NextResponse<CheckCodeResponse>> {
  try {
    // 1. Anti-Enumeration Rate Limiting (Protects 6-character code space against brute-force scanners)
    const clientIp = getClientIp(req);
    const rateStatus = await checkCodeLookupRateLimit(clientIp);

    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many code lookup requests. Potential automated scan detected. Please wait ${rateStatus.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase is not configured." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid 6-character share code." },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Query file record - original_filename is strictly suppressed
    const { data, error } = await supabase
      .from("files")
      .select("id, file_path, file_size, is_archive, file_count, expires_at")
      .eq("share_code", code)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Share code not found or invalid." },
        { status: 404 }
      );
    }

    // Check expiration
    const expiresAt = new Date(data.expires_at).getTime();
    const now = Date.now();

    if (expiresAt < now) {
      // Automatic on-access purge
      await Promise.allSettled([
        supabase.storage.from(STORAGE_BUCKET).remove([data.file_path]),
        supabase.from("files").delete().eq("id", data.id),
      ]);

      return NextResponse.json(
        {
          success: false,
          expired: true,
          error: "This file has expired and has been automatically deleted from the cloud.",
        },
        { status: 410 }
      );
    }

    // Return size, count, and expiry — preserving confidentiality
    return NextResponse.json({
      success: true,
      size: data.file_size,
      fileCount: data.file_count || 1,
      isArchive: data.is_archive || false,
      expiresAt: data.expires_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
