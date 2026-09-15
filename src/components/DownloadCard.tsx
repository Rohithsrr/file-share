"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import ExpiryBadge from "./ExpiryBadge";
import { CheckCodeResponse, VerifyResponse } from "@/lib/types";

export default function DownloadCard() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode.toUpperCase());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // File metadata retrieved after code check
  const [fileMeta, setFileMeta] = useState<CheckCodeResponse | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const checkCode = useCallback(async (codeToCheck: string) => {
    if (!codeToCheck || codeToCheck.length !== 6) return;

    setIsCheckingCode(true);
    setErrorMessage(null);
    setFileMeta(null);
    setDownloadSuccess(false);

    try {
      const res = await fetch(`/api/check-code?code=${encodeURIComponent(codeToCheck)}`);
      const data: CheckCodeResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "File not found or has expired.");
      }

      setFileMeta(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify share code.";
      setErrorMessage(msg);
      setFileMeta(null);
    } finally {
      setIsCheckingCode(false);
    }
  }, []);

  // Check code on load if provided in query params
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      checkCode(initialCode.toUpperCase());
    }
  }, [initialCode, checkCode]);

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      checkCode(code.trim().toUpperCase());
    }
  };

  const handleDownload = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!code || code.trim().length !== 6) {
      setErrorMessage("Please enter a valid 6-character code.");
      return;
    }

    if (!password) {
      setErrorMessage("Password is required to decrypt this file.");
      return;
    }

    setIsVerifying(true);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
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

      // Download file seamlessly using signed URL
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = data.filename || "downloaded-file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download file.";
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
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
          Enter the 6-character code and password to download.
        </p>
      </div>

      {/* Step 1: Code Input */}
      <form onSubmit={handleCodeSubmit} className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5">
          6-Character Share Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setCode(val);
              if (val.length === 6) {
                checkCode(val);
              }
            }}
            placeholder="e.g. 8K2M9Z"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-center font-mono text-xl tracking-widest text-indigo-300 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-sm placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={isCheckingCode || code.length !== 6}
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

      {/* File Found Information */}
      {fileMeta && fileMeta.success && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {fileMeta.filename}
                </p>
                <p className="text-xs text-slate-500">
                  {fileMeta.size ? formatBytes(fileMeta.size) : "Encrypted File"}
                </p>
              </div>
            </div>
          </div>

          {fileMeta.expiresAt && (
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-400">Expiration Status:</span>
              <ExpiryBadge
                expiresAt={fileMeta.expiresAt}
                onExpired={() => {
                  setFileMeta(null);
                  setErrorMessage(
                    "This file has just expired and was automatically deleted from cloud storage."
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 2: Password Form */}
      {fileMeta && fileMeta.success && !downloadSuccess && (
        <form onSubmit={handleDownload} className="space-y-4 animate-in fade-in-50">
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
                placeholder="Enter password set by uploader"
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
                <span>Verifying & Generating Secure Link...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Verify Password & Download File</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Success Banner */}
      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-sm space-y-2 animate-in fade-in-50">
          <div className="flex items-center gap-2 font-bold text-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>Download Triggered Successfully!</span>
          </div>
          <p className="text-xs text-emerald-300/80">
            Your browser should automatically begin downloading the file via a 60-second temporary signed URL. If the download didn&apos;t start, please click verify again.
          </p>
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
        <span>Served exclusively via 60-second secure temporary signed URLs</span>
      </div>
    </div>
  );
}
