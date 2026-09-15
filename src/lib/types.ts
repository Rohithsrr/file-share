export interface FileManifestItem {
  name: string;
  size: number;
  path?: string;
}

export interface FileRecord {
  id: string;
  share_code: string;
  file_path: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  password_hash: string;
  is_archive: boolean;
  file_count: number;
  files_manifest: FileManifestItem[];
  created_at: string;
  expires_at: string;
}

export interface UploadResponse {
  success: boolean;
  shareCode?: string;
  downloadUrl?: string;
  expiresAt?: string;
  filename?: string;
  size?: number;
  fileCount?: number;
  isArchive?: boolean;
  error?: string;
}

/**
 * Notice: filename and file manifest are intentionally OMITTED here!
 * The recipient can only see the filename after verifying with the password.
 */
export interface CheckCodeResponse {
  success: boolean;
  size?: number;
  fileCount?: number;
  isArchive?: boolean;
  expiresAt?: string;
  error?: string;
  expired?: boolean;
}

export interface VerifyResponse {
  success: boolean;
  signedUrl?: string;
  filename?: string;
  size?: number;
  fileCount?: number;
  isArchive?: boolean;
  filesManifest?: FileManifestItem[];
  expiresInSeconds?: number;
  error?: string;
  remainingAttempts?: number;
}

export interface CleanupResponse {
  success: boolean;
  deletedCount: number;
  purgedFiles: string[];
  timestamp: string;
  error?: string;
}
