import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServiceSupabase, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";
import { checkPasswordRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp, validateSameOrigin } from "@/lib/security";
import { isValidShareId } from "@/lib/utils";
import { VerifyResponse } from "@/lib/types";

export async function POST(req: NextRequest): Promise<NextResponse<VerifyResponse>> {
  try {
    // 1. CSRF Same-Origin Validation
    if (!validateSameOrigin(req)) {
      return NextResponse.json(
        { success: false, error: "Cross-origin requests are forbidden." },
        { status: 403 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase is not configured." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    const shareId = (body.id || body.code as string | undefined)?.trim();
    const password = body.password as string | undefined;

    if (!shareId || !isValidShareId(shareId)) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid Share ID." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required to decrypt this file." },
        { status: 400 }
      );
    }

    // 2. Distributed Database-Backed Rate Limiting
    const clientIp = getClientIp(req);
    const rateLimitKey = `pwd:${clientIp}:${shareId}`;
    const rateStatus = await checkPasswordRateLimit(clientIp, shareId);

    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed password attempts. Access temporarily locked for security. Please try again in ${rateStatus.retryAfterSeconds} seconds.`,
          remainingAttempts: 0,
        },
        { status: 429 }
      );
    }

    const supabase = getServiceSupabase();

    // Query file record
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .select("*")
      .eq("share_code", shareId)
      .maybeSingle();

    if (dbError || !fileRecord) {
      return NextResponse.json(
        { success: false, error: "Share ID not found or invalid." },
        { status: 404 }
      );
    }

    // Check expiration
    const expiresAt = new Date(fileRecord.expires_at).getTime();
    const now = Date.now();

    if (expiresAt < now) {
      await Promise.allSettled([
        supabase.storage.from(STORAGE_BUCKET).remove([fileRecord.file_path]),
        supabase.from("files").delete().eq("id", fileRecord.id),
      ]);

      return NextResponse.json(
        {
          success: false,
          error: "This file has expired and has been automatically removed from the server.",
        },
        { status: 410 }
      );
    }

    // Verify password against bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, fileRecord.password_hash);

    if (!isPasswordValid) {
      const remainingMsg =
        rateStatus.remainingAttempts > 0
          ? ` (${rateStatus.remainingAttempts} attempt${rateStatus.remainingAttempts === 1 ? "" : "s"} left)`
          : " (Account locked for 10 minutes)";

      return NextResponse.json(
        {
          success: false,
          error: `Incorrect password.${remainingMsg}`,
          remainingAttempts: rateStatus.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Password is valid: reset rate limit tracking for this IP + share ID
    await resetRateLimit(rateLimitKey);

    // Generate secure temporary signed URL (valid for 60 seconds)
    const { data: signedData, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(fileRecord.file_path, 60, {
        download: fileRecord.original_filename,
      });

    if (signError || !signedData?.signedUrl) {
      console.error("Signed URL creation error:", signError);
      return NextResponse.json(
        { success: false, error: "Failed to generate secure download link. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedData.signedUrl,
      filename: fileRecord.original_filename,
      size: fileRecord.file_size,
      fileCount: fileRecord.file_count || 1,
      isArchive: fileRecord.is_archive || false,
      filesManifest: fileRecord.files_manifest || [],
      expiresInSeconds: 60,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Verify route error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
