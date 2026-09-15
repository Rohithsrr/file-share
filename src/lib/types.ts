export interface FileRecord {
  id: string;
  share_code: string;
  file_path: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  password_hash: string;
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
  error?: string;
}

export interface CheckCodeResponse {
  success: boolean;
  filename?: string;
  size?: number;
  mimeType?: string;
  expiresAt?: string;
  error?: string;
  expired?: boolean;
}

export interface VerifyResponse {
  success: boolean;
  signedUrl?: string;
  filename?: string;
  size?: number;
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
