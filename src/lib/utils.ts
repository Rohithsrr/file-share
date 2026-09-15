import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random 6-character alphanumeric code
 * Uses unambiguous uppercase characters & digits (omitting easily confused 0/O, 1/I)
 */
export function generateShareCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

/**
 * Validates a custom 6-character code
 */
export function isValidShareCode(code: string): boolean {
  return /^[a-zA-Z0-9]{6}$/.test(code);
}

/**
 * Format raw bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Sanitize filename to prevent directory traversal and special character issues
 */
export function sanitizeFilename(filename: string): string {
  // Remove directory separators and null bytes
  const cleanName = filename.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return cleanName || "unnamed_file";
}

/**
 * Formats time remaining until expiration
 */
export function formatTimeRemaining(expiresAt: string): {
  isExpired: boolean;
  formatted: string;
  totalSeconds: number;
} {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return { isExpired: true, formatted: "Expired", totalSeconds: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remMinutes = minutes % 60;
    return {
      isExpired: false,
      formatted: `${hours}h ${remMinutes}m`,
      totalSeconds,
    };
  }

  return {
    isExpired: false,
    formatted: `${minutes}m ${seconds.toString().padStart(2, "0")}s`,
    totalSeconds,
  };
}
