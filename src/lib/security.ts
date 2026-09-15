import { NextRequest } from "next/server";
import { FileManifestItem } from "./types";

// Blacklist of dangerous executable, installer, and script extensions
export const DANGEROUS_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "bash",
  "vbs",
  "vbe",
  "scr",
  "msi",
  "ps1",
  "dll",
  "com",
  "hta",
  "jar",
  "iso",
  "dmg",
  "apk",
  "app",
  "gadget",
  "cpl",
  "msc",
  "reg",
  "pif",
]);

/**
 * Checks if a filename has a dangerous or executable file extension
 */
export function isDangerousExtension(filename: string): boolean {
  const parts = filename.toLowerCase().split(".");
  if (parts.length <= 1) return false;
  const ext = parts[parts.length - 1].trim();
  return DANGEROUS_EXTENSIONS.has(ext);
}

/**
 * Validates zip archive manifest to guard against decompression bombs
 * 1. Max 150 files per archive
 * 2. Max 150MB total uncompressed content
 * 3. Max 10:1 uncompressed-to-compressed ratio
 */
export function validateArchiveManifest(
  manifest: FileManifestItem[],
  compressedSizeBytes: number
): { valid: boolean; reason?: string } {
  if (!manifest || manifest.length === 0) return { valid: true };

  if (manifest.length > 150) {
    return {
      valid: false,
      reason: `Archive exceeds maximum file count limit (150 files). Found ${manifest.length} files.`,
    };
  }

  let totalUncompressed = 0;
  for (const item of manifest) {
    // Check for dangerous files packed inside zip
    if (isDangerousExtension(item.name)) {
      return {
        valid: false,
        reason: `Archive contains blocked executable file: "${item.name}". Executables cannot be shared.`,
      };
    }
    totalUncompressed += Number(item.size || 0);
  }

  const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150MB
  if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
    return {
      valid: false,
      reason: `Uncompressed archive size (${(totalUncompressed / (1024 * 1024)).toFixed(1)}MB) exceeds maximum 150MB safety limit.`,
    };
  }

  // Decompression bomb ratio check (if ratio exceeds 15:1)
  if (compressedSizeBytes > 0 && totalUncompressed / compressedSizeBytes > 15) {
    return {
      valid: false,
      reason: "Potential zip-bomb detected: compression ratio exceeds maximum permitted safety threshold (15:1).",
    };
  }

  return { valid: true };
}

/**
 * Safely extracts client IP address from proxy headers
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  return req.headers.get("x-real-ip") || "anonymous-client";
}

/**
 * Validates Origin/Referer header to protect against Cross-Site Request Forgery (CSRF)
 */
export function validateSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    // Standard direct or same-origin navigation
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
