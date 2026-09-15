import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";
import { CheckCodeResponse } from "@/lib/types";

export async function GET(req: NextRequest): Promise<NextResponse<CheckCodeResponse>> {
  try {
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

    // Query file record - notice original_filename is NOT returned to the client!
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
      // Automatic on-access purge: delete from storage and database
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

    // Return size, file count, and expiry — keeping file names strictly confidential until password is verified
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
