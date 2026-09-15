"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import JSZip from "jszip";
import {
  Download,
  KeyRound,
  FileCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  FolderArchive,
  FileText,
  Layers,
  File,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import ExpiryBadge from "./ExpiryBadge";
import { CheckCodeResponse, VerifyResponse, FileManifestItem } from "@/lib/types";

export default function DownloadCard() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("id") || searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode.trim());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // File metadata retrieved before password (filenames strictly omitted)
  const [fileMeta, setFileMeta] = useState<CheckCodeResponse | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Decrypted & Unlocked State (revealed ONLY after password verification)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [revealedFilename, setRevealedFilename] = useState<string | null>(null);
  const [revealedSize, setRevealedSize] = useState<number>(0);
  const [isArchive, setIsArchive] = useState(false);
  const [revealedManifest, setRevealedManifest] = useState<FileManifestItem[]>([]);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // State for single-file extraction
  const [extractingFile, setExtractingFile] = useState<string | null>(null);
  const [cachedZip, setCachedZip] = useState<JSZip | null>(null);

  const checkCode = useCallback(async (codeToCheck: string) => {
    if (!codeToCheck || codeToCheck.trim().length < 6) return;

    setIsCheckingCode(true);
    setErrorMessage(null);
    setFileMeta(null);
    setIsUnlocked(false);
    setSignedUrl(null);
    setRevealedFilename(null);
    setRevealedManifest([]);
    setCachedZip(null);

    try {
      const res = await fetch(`/api/check-code?id=${encodeURIComponent(codeToCheck.trim())}`);
      const data: CheckCodeResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "File not found or has expired.");
      }

      setFileMeta(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify share ID.";
      setErrorMessage(msg);
      setFileMeta(null);
    } finally {
      setIsCheckingCode(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode && initialCode.trim().length >= 6) {
      checkCode(initialCode.trim());
    }
  }, [initialCode, checkCode]);

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length >= 6) {
      checkCode(code.trim());
    }
  };

  // Password verification: Unlocks file list WITHOUT auto-downloading
  const handleVerifyPassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!code || code.trim().length < 6) {
      setErrorMessage("Please enter a valid Share ID.");
      return;
    }

    if (!password) {
      setErrorMessage("Password is required to decrypt and view file names.");
      return;
    }

    setIsVerifying(true);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: code.trim(),
          password,
        }),
      });

      const data: VerifyResponse = await res.json();

      if (data.remainingAttempts !== undefined) {
        setRemainingAttempts(data.remainingAttempts);
      }

      if (!res.ok || !data.success || !data.signedUrl) {
        throw new Error(data.error || "Password incorrect or verification failed.");
      }

      // Unlock and reveal files list (DO NOT auto-download)
      setSignedUrl(data.signedUrl);
      setRevealedFilename(data.filename || "downloaded-file");
      setRevealedSize(data.size || 0);
      setIsArchive(Boolean(data.isArchive));
      setRevealedManifest(data.filesManifest || []);
      setIsUnlocked(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to decrypt files.";
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Explicit download trigger for full package or single file
  const handleDownloadAll = () => {
    if (!signedUrl) return;
    const link = document.createElement("a");
    link.href = signedUrl;
    link.download = revealedFilename || "downloaded-file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download a specific individual file from the zip package
  const handleDownloadSingleFile = async (item: FileManifestItem) => {
    if (!signedUrl) return;
    const targetPath = item.path || item.name;
    setExtractingFile(targetPath);

    try {
      let zip = cachedZip;
      if (!zip) {
        const resp = await fetch(signedUrl);
        if (!resp.ok) throw new Error("Failed to fetch archive for extraction.");
        const blob = await resp.blob();
        zip = await JSZip.loadAsync(blob);
        setCachedZip(zip);
      }

      // Locate the file in the zip
      let fileInZip = zip.file(targetPath);
      if (!fileInZip) {
        // Fallback search by filename
        fileInZip =
          zip.file(item.name) ||
          Object.values(zip.files).find((f) => f.name.endsWith(item.name)) ||
          null;
      }

      if (!fileInZip) {
        throw new Error(`Could not find "${item.name}" inside the archive.`);
      }

      const fileBlob = await fileInZip.async("blob");
      const url = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Extraction failed.";
      alert(msg);
    } finally {
      setExtractingFile(null);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-500/10">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Retrieve Secure File
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Enter the Share ID and password to decrypt and view file names.
        </p>
      </div>

      {/* Step 1: Share ID Input */}
      <form onSubmit={handleCodeSubmit} className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5">
          Share ID or Secret Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={64}
            value={code}
            onChange={(e) => {
              const val = e.target.value.trim();
              setCode(val);
              if (val.length >= 32) {
                checkCode(val);
              }
            }}
            placeholder="Paste 128-bit Share ID or code"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-3.5 text-center font-mono text-sm sm:text-base tracking-wider text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-xs placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={isCheckingCode || code.trim().length < 6}
            className="px-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 border border-slate-700"
          >
            {isCheckingCode ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <>
                <span>Find</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* File Found Summary (Before Password: Filenames strictly hidden) */}
      {fileMeta && fileMeta.success && !isUnlocked && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Encrypted Protected Package</span>
                {fileMeta.fileCount && fileMeta.fileCount > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                    {fileMeta.fileCount} Files
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {fileMeta.size ? formatBytes(fileMeta.size) : "Encrypted Data"} • Filenames hidden until verified
              </p>
            </div>
          </div>

          {fileMeta.expiresAt && (
            <div className="pt-2.5 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-400">Cloud Status:</span>
              <ExpiryBadge
                expiresAt={fileMeta.expiresAt}
                onExpired={() => {
                  setFileMeta(null);
                  setIsUnlocked(false);
                  setErrorMessage(
                    "This file has expired and was automatically deleted from cloud storage."
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 2: Password Form (Unlocks files list without auto-downloading) */}
      {fileMeta && fileMeta.success && !isUnlocked && (
        <form onSubmit={handleVerifyPassword} className="space-y-4 animate-in fade-in-50">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="decrypt-password"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                Decryption Password
              </label>
              {remainingAttempts !== null && (
                <span className="text-[11px] text-amber-400">
                  {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} remaining
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="decrypt-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to reveal files list"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-4 pr-11 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying || !password}
            className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xl ${
              isVerifying || !password
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                : "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 active:scale-[0.99]"
            }`}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Decrypting & Unlocking Files...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Verify Password & View Files</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* UNLOCKED FILES LIST & DOWNLOAD CONTROLS */}
      {isUnlocked && revealedFilename && (
        <div className="space-y-5 animate-in fade-in-50">
          {/* Status banner */}
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-sm space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>Password Verified • Files Decrypted!</span>
            </div>
            <p className="text-xs text-emerald-300/80">
              Review your files below and click to download when ready.
            </p>
          </div>

          {/* Primary Download All Button */}
          <button
            type="button"
            onClick={handleDownloadAll}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 active:scale-[0.99]"
          >
            {isArchive ? (
              <>
                <FolderArchive className="w-5 h-5" />
                <span>Download Entire Bundle (.ZIP) • {formatBytes(revealedSize)}</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download File • {formatBytes(revealedSize)}</span>
              </>
            )}
          </button>

          {/* File Breakdown List */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4" />
                <span>{isArchive ? `Files in Package (${revealedManifest.length || 1})` : "Decrypted File"}</span>
              </p>
              <span className="text-xs font-mono text-slate-400">{formatBytes(revealedSize)}</span>
            </div>

            {/* If Single File */}
            {!isArchive && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <File className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200 truncate font-mono">
                    {revealedFilename}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                  {formatBytes(revealedSize)}
                </span>
              </div>
            )}

            {/* If Archive with Multiple Files: Allow Downloading Required Files Individually */}
            {isArchive && revealedManifest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 mb-2">
                  Click <strong className="text-slate-300">Download</strong> next to any individual file to save just that item:
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {revealedManifest.map((item, idx) => {
                    const isExtractingThis = extractingFile === (item.path || item.name);
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-xs font-mono text-slate-200 truncate" title={item.path || item.name}>
                            {item.path || item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {formatBytes(item.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleFile(item)}
                            disabled={Boolean(extractingFile)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-slate-700 active:scale-95"
                            title="Download this specific file"
                          >
                            {isExtractingThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                <span className="text-[10px]">Extracting...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>Get</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Expiration warning */}
          {fileMeta?.expiresAt && (
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-400">Download link valid until:</span>
              <ExpiryBadge expiresAt={fileMeta.expiresAt} />
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in-50">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Security note */}
      <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
        <span>Downloads are authenticated and served via 60-second signed URLs</span>
      </div>
    </div>
  );
}
