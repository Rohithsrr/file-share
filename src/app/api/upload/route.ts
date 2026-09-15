import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServiceSupabase, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";
import { generateShareId, isValidShareId, sanitizeFilename } from "@/lib/utils";
import { UploadResponse, FileManifestItem } from "@/lib/types";
import { checkUploadRateLimit } from "@/lib/rate-limit";
import {
  isDangerousExtension,
  validateArchiveManifest,
  getClientIp,
  validateSameOrigin,
} from "@/lib/security";
import { validateFileContent } from "@/lib/magic-bytes";

const MAX_SINGLE_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_FREE_TIER_STORAGE_BYTES = 950 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // 1. CSRF Same-Origin Validation
    if (!validateSameOrigin(req)) {
      return NextResponse.json(
        { success: false, error: "Cross-origin requests are forbidden." },
        { status: 403 }
      );
    }

    // 2. Client IP Rate Limiting (Anti-DoS)
    const clientIp = getClientIp(req);
    const rateLimit = await checkUploadRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Upload rate limit exceeded. To protect free cloud resources, please wait ${rateLimit.retryAfterSeconds} seconds before uploading another file.`,
        },
        { status: 429 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase is not configured. Please check your environment variables.",
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const password = (formData.get("password") as string | null)?.trim();
    const customCode = (formData.get("customCode") as string | null)?.trim();
    const durationMinutesRaw = formData.get("durationMinutes") as string | null;
    const isArchive = formData.get("isArchive") === "true";
    const fileCount = parseInt((formData.get("fileCount") as string | null) || "1", 10);
    const manifestRaw = formData.get("manifest") as string | null;

    let filesManifest: FileManifestItem[] = [];
    if (manifestRaw) {
      try {
        filesManifest = JSON.parse(manifestRaw);
      } catch {
        filesManifest = [];
      }
    }

    // 3. File presence & size validation
    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Please select a valid file or folder to upload." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SINGLE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Upload size exceeds maximum allowed 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB provided).`,
        },
        { status: 400 }
      );
    }

    // 4. File extension blacklist
    if (isDangerousExtension(file.name)) {
      return NextResponse.json(
        {
          success: false,
          error: "Executable files, scripts, and installer binaries are blocked to prevent malware distribution.",
        },
        { status: 400 }
      );
    }

    // 5. Deep File Signature / Magic Bytes Validation
    // Catches malicious.exe renamed to photo.jpg or report.pdf
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const magicResult = validateFileContent(fileBuffer, file.name);
    if (!magicResult.valid) {
      return NextResponse.json(
        { success: false, error: magicResult.error },
        { status: 400 }
      );
    }

    // 6. Zip-Bomb & Decompression Protection
    if (isArchive && filesManifest.length > 0) {
      const archiveCheck = validateArchiveManifest(filesManifest, file.size);
      if (!archiveCheck.valid) {
        return NextResponse.json(
          { success: false, error: archiveCheck.reason },
          { status: 400 }
        );
      }
    }

    // 7. Password Validation
    if (!password || password.length < 4) {
      return NextResponse.json(
        { success: false, error: "A password with at least 4 characters is required to protect your file." },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const nowIso = new Date().toISOString();

    // 8. Opportunistic Cleanup
    try {
      const { data: expired } = await supabase
        .from("files")
        .select("id, file_path")
        .lt("expires_at", nowIso);

      if (expired && expired.length > 0) {
        const filePaths = expired.map((e) => e.file_path).filter(Boolean);
        const ids = expired.map((e) => e.id);
        await Promise.allSettled([
          supabase.storage.from(STORAGE_BUCKET).remove(filePaths),
          supabase.from("files").delete().in("id", ids),
        ]);
      }
    } catch {
      // Non-blocking
    }

    // 9. Storage Capacity Check
    const { data: activeFiles } = await supabase
      .from("files")
      .select("file_size")
      .gt("expires_at", nowIso);

    const currentUsedBytes = (activeFiles || []).reduce(
      (acc, curr) => acc + Number(curr.file_size || 0),
      0
    );

    if (currentUsedBytes + file.size > MAX_FREE_TIER_STORAGE_BYTES) {
      const usedMb = (currentUsedBytes / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `Supabase Free Tier cloud storage is nearly full (${usedMb}MB active). Since uploads auto-expire in 5 minutes, please wait a couple of minutes for space to free up.`,
        },
        { status: 507 }
      );
    }

    // Expiration duration
    let durationMinutes = 5;
    if (durationMinutesRaw) {
      const parsed = parseInt(durationMinutesRaw, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
        durationMinutes = parsed;
      }
    }
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    // 10. Cryptographically Strong 128-Bit Share ID Generation (or sanitized custom code)
    let shareId: string;
    if (customCode) {
      const normalized = customCode.trim();
      if (!isValidShareId(normalized)) {
        return NextResponse.json(
          { success: false, error: "Custom secret code must be between 6 and 64 alphanumeric characters." },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from("files")
        .select("id")
        .eq("share_code", normalized)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, error: "That custom secret code is already in use. Please choose another." },
          { status: 409 }
        );
      }
      shareId = normalized;
    } else {
      // 128-bit cryptographically secure random token (32 hex characters)
      let attempts = 0;
      let uniqueId = "";
      while (attempts < 5) {
        const candidate = generateShareId();
        const { data: existing } = await supabase
          .from("files")
          .select("id")
          .eq("share_code", candidate)
          .maybeSingle();

        if (!existing) {
          uniqueId = candidate;
          break;
        }
        attempts++;
      }

      if (!uniqueId) {
        return NextResponse.json(
          { success: false, error: "Could not generate a unique share ID. Please try again." },
          { status: 500 }
        );
      }
      shareId = uniqueId;
    }

    // 11. Bcrypt password hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 12. Sanitize filename and storage path
    const safeFilename = sanitizeFilename(file.name);
    const storagePath = `${shareId}/${Date.now()}_${safeFilename}`;

    // Force application/octet-stream for potentially scriptable formats
    let safeMimeType = file.type || "application/octet-stream";
    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith(".html") ||
      lowerName.endsWith(".htm") ||
      lowerName.endsWith(".svg") ||
      lowerName.endsWith(".xml") ||
      lowerName.endsWith(".xhtml")
    ) {
      safeMimeType = "application/octet-stream";
    }

    // Upload to Supabase private storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: safeMimeType,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json(
        { success: false, error: `Failed to upload file to storage: ${storageError.message}` },
        { status: 500 }
      );
    }

    // Insert metadata record
    const { error: dbError } = await supabase.from("files").insert({
      share_code: shareId,
      file_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: safeMimeType,
      password_hash: passwordHash,
      is_archive: isArchive,
      file_count: fileCount,
      files_manifest: filesManifest,
      expires_at: expiresAt,
    });

    if (dbError) {
      console.error("Database insert error:", dbError);
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { success: false, error: `Failed to save file metadata: ${dbError.message}` },
        { status: 500 }
      );
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const downloadUrl = `${protocol}://${host}/download?id=${shareId}`;

    return NextResponse.json({
      success: true,
      shareCode: shareId,
      downloadUrl,
      expiresAt,
      filename: file.name,
      size: file.size,
      fileCount,
      isArchive,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Upload route error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
