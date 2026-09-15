/**
 * File Signature / Magic Bytes Validator
 * Inspects raw file buffers to detect disguised executables and verify file formats.
 */

// Signatures for dangerous binaries and scripts
const EXECUTABLE_SIGNATURES = [
  { name: "Windows PE Executable (EXE/DLL/SCR)", bytes: [0x4d, 0x5a] }, // 'MZ'
  { name: "Linux ELF Binary", bytes: [0x7f, 0x45, 0x4c, 0x46] }, // '\x7fELF'
  { name: "macOS Mach-O 32-bit", bytes: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "macOS Mach-O 64-bit", bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: "macOS Mach-O 32-bit (rev)", bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { name: "macOS Mach-O 64-bit (rev)", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: "Java Class / Mach-O Universal", bytes: [0xca, 0xfe, 0xba, 0xbe] },
];

function matchesBytes(buffer: Uint8Array, pattern: number[], offset = 0): boolean {
  if (buffer.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (buffer[offset + i] !== pattern[i]) return false;
  }
  return true;
}

export interface MagicByteValidationResult {
  valid: boolean;
  detectedType?: string;
  error?: string;
}

/**
 * Validates raw file buffer against its claimed filename extension.
 * 1. Blocks any file containing executable binary headers (MZ, ELF, Mach-O).
 * 2. For known extensions (JPG, PNG, PDF, ZIP, etc.), verifies that magic bytes match.
 */
export function validateFileContent(
  buffer: Uint8Array,
  filename: string
): MagicByteValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "File buffer is empty." };
  }

  // 1. Universal Executable Detection: Block disguised executables (e.g. malicious.exe renamed to photo.jpg)
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (matchesBytes(buffer, sig.bytes)) {
      return {
        valid: false,
        detectedType: sig.name,
        error: `Security Violation: Executable binary signature detected (${sig.name}). Disguised executable files cannot be uploaded.`,
      };
    }
  }

  // Check for shell scripts with shebang (#!)
  if (matchesBytes(buffer, [0x23, 0x21])) {
    return {
      valid: false,
      detectedType: "Shell Script (Shebang)",
      error: "Security Violation: Executable shell scripts are blocked for security.",
    };
  }

  const parts = filename.toLowerCase().split(".");
  if (parts.length <= 1) {
    // No extension: allow safe binary/text, as long as it's not an executable
    return { valid: true };
  }
  const ext = parts[parts.length - 1].trim();

  // 2. Strict Magic Byte Verification by Extension
  switch (ext) {
    case "jpg":
    case "jpeg": {
      // JPEG signature: FF D8 FF
      if (!matchesBytes(buffer, [0xff, 0xd8, 0xff])) {
        return {
          valid: false,
          error: "File content validation failed: File has .jpg extension but does not match JPEG magic byte signature (FF D8 FF).",
        };
      }
      return { valid: true, detectedType: "image/jpeg" };
    }

    case "png": {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (!matchesBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return {
          valid: false,
          error: "File content validation failed: File has .png extension but does not match PNG magic byte signature.",
        };
      }
      return { valid: true, detectedType: "image/png" };
    }

    case "gif": {
      // GIF signature: 'GIF8' (47 49 46 38)
      if (!matchesBytes(buffer, [0x47, 0x49, 0x46, 0x38])) {
        return {
          valid: false,
          error: "File content validation failed: File has .gif extension but does not match GIF magic byte signature.",
        };
      }
      return { valid: true, detectedType: "image/gif" };
    }

    case "webp": {
      // WEBP: RIFF at 0, WEBP at 8
      if (
        !matchesBytes(buffer, [0x52, 0x49, 0x46, 0x46]) ||
        !matchesBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8)
      ) {
        return {
          valid: false,
          error: "File content validation failed: File has .webp extension but does not match WEBP magic byte signature.",
        };
      }
      return { valid: true, detectedType: "image/webp" };
    }

    case "pdf": {
      // PDF signature: '%PDF' (25 50 44 46)
      if (!matchesBytes(buffer, [0x25, 0x50, 0x44, 0x46])) {
        return {
          valid: false,
          error: "File content validation failed: File has .pdf extension but does not match PDF signature (%PDF).",
        };
      }
      return { valid: true, detectedType: "application/pdf" };
    }

    case "zip":
    case "docx":
    case "xlsx":
    case "pptx": {
      // ZIP / OpenXML signature: 'PK..' (50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08)
      const isZip =
        matchesBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
        matchesBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
        matchesBytes(buffer, [0x50, 0x4b, 0x07, 0x08]);

      if (!isZip) {
        return {
          valid: false,
          error: `File content validation failed: File has .${ext} extension but does not match ZIP archive signature.`,
        };
      }
      return { valid: true, detectedType: "application/zip" };
    }

    case "7z": {
      // 7Z signature: 37 7A BC AF 27 1C
      if (!matchesBytes(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
        return {
          valid: false,
          error: "File content validation failed: File has .7z extension but does not match 7-Zip signature.",
        };
      }
      return { valid: true, detectedType: "application/x-7z-compressed" };
    }

    case "gz":
    case "gzip": {
      // GZIP signature: 1F 8B
      if (!matchesBytes(buffer, [0x1f, 0x8b])) {
        return {
          valid: false,
          error: "File content validation failed: File has .gz extension but does not match Gzip signature.",
        };
      }
      return { valid: true, detectedType: "application/gzip" };
    }

    default:
      // Other safe extensions (txt, csv, json, md, etc.): verified not to contain executable headers
      return { valid: true };
  }
}
