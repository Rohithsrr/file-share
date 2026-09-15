import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServiceSupabase, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";
import { generateShareCode, isValidShareCode, sanitizeFilename } from "@/lib/utils";
import { UploadResponse } from "@/lib/types";

// Maximum upload file size: 50MB (Supabase Free Tier standard limit)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.",
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const password = (formData.get("password") as string | null)?.trim();
    const customCode = (formData.get("customCode") as string | null)?.trim();
    const durationMinutesRaw = formData.get("durationMinutes") as string | null;

    // Validate file
    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Please select a valid file to upload." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File exceeds maximum allowed size of 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB provided).`,
        },
        { status: 400 }
      );
    }

    // Validate password
    if (!password || password.length < 4) {
      return NextResponse.json(
        { success: false, error: "A password with at least 4 characters is required to protect your file." },
        { status: 400 }
      );
    }

    // Determine expiration (default 5 minutes as requested, options up to 1440 mins / 24h)
    let durationMinutes = 5;
    if (durationMinutesRaw) {
      const parsed = parseInt(durationMinutesRaw, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
        durationMinutes = parsed;
      }
    }
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const supabase = getServiceSupabase();

    // Determine share code (custom or auto-generated)
    let shareCode: string;
    if (customCode) {
      const normalizedCode = customCode.toUpperCase();
      if (!isValidShareCode(normalizedCode)) {
        return NextResponse.json(
          { success: false, error: "Custom secret code must be exactly 6 alphanumeric characters." },
          { status: 400 }
        );
      }

      // Check for code uniqueness
      const { data: existing } = await supabase
        .from("files")
        .select("id")
        .eq("share_code", normalizedCode)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, error: "That custom secret code is already in use. Please choose another." },
          { status: 409 }
        );
      }
      shareCode = normalizedCode;
    } else {
      // Auto-generate code with retry for unique constraint
      let attempts = 0;
      let uniqueCode = "";
      while (attempts < 5) {
        const candidate = generateShareCode();
        const { data: existing } = await supabase
          .from("files")
          .select("id")
          .eq("share_code", candidate)
          .maybeSingle();

        if (!existing) {
          uniqueCode = candidate;
          break;
        }
        attempts++;
      }

      if (!uniqueCode) {
        return NextResponse.json(
          { success: false, error: "Could not generate a unique share code. Please try again." },
          { status: 500 }
        );
      }
      shareCode = uniqueCode;
    }

    // Hash password server-side with bcrypt (salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Sanitize filename and construct storage path
    const safeFilename = sanitizeFilename(file.name);
    const storagePath = `${shareCode}/${Date.now()}_${safeFilename}`;

    // Upload file to Supabase Storage private bucket
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json(
        { success: false, error: `Failed to upload file to storage: ${storageError.message}` },
        { status: 500 }
      );
    }

    // Store metadata in Postgres `files` table
    const { error: dbError } = await supabase.from("files").insert({
      share_code: shareCode,
      file_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      password_hash: passwordHash,
      expires_at: expiresAt,
    });

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Clean up orphaned storage file if DB insert fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { success: false, error: `Failed to save file metadata: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Construct download URL
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const downloadUrl = `${protocol}://${host}/download?code=${shareCode}`;

    return NextResponse.json({
      success: true,
      shareCode,
      downloadUrl,
      expiresAt,
      filename: file.name,
      size: file.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Upload route error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
