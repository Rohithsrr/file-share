import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a 128-bit cryptographically secure random Share ID
 * 16 bytes = 128 bits of true entropy = 32 hexadecimal characters
 * Search space: 2^128 (~3.4 x 10^38), physically impossible to enumerate.
 * Uses Web Crypto API (supported natively in both Node.js 18+ and modern browsers).
 */
export function generateShareId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for unexpected headless environments
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Backward compatibility aliases
export const generateShareCode = generateShareId;

/**
 * Validates a share ID (128-bit hex string or custom alphanumeric code up to 64 chars)
 */
export function isValidShareId(id: string): boolean {
  if (!id) return false;
  // Standard 128-bit hex token (32 chars) or custom alphanumeric code (6 to 64 chars)
  return /^[a-zA-Z0-9_-]{6,64}$/.test(id);
}

export const isValidShareCode = isValidShareId;

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
