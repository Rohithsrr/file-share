"use client";

import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Check,
  Copy,
  Download,
  FileCheck,
  Lock,
  RefreshCw,
  Share2,
  ExternalLink,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import ExpiryBadge from "./ExpiryBadge";

interface UploadSuccessProps {
  shareCode: string;
  downloadUrl: string;
  expiresAt: string;
  filename: string;
  size: number;
  onReset: () => void;
}

export default function UploadSuccess({
  shareCode,
  downloadUrl,
  expiresAt,
  filename,
  size,
  onReset,
}: UploadSuccessProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#a855f7", "#ec4899", "#10b981"],
      });
    } catch {
      // Ignore if confetti fails in some headless environments
    }
  }, []);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/10">
          <FileCheck className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          File Uploaded & Encrypted!
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Share the 6-character code or direct link with your recipient.
        </p>

        <div className="mt-3 flex justify-center">
          <ExpiryBadge expiresAt={expiresAt} />
        </div>
      </div>

      {/* File summary pill */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 mb-6 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 font-medium truncate">{filename}</p>
            <p className="text-xs text-slate-500">{formatBytes(size)} • Password-Protected</p>
          </div>
        </div>
      </div>

      {/* Shareable Code Card */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5 block">
            128-Bit Cryptographic Share ID
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-950 border-2 border-indigo-500/40 rounded-xl py-3 px-3.5 text-center overflow-hidden">
              <span className="font-mono text-sm sm:text-base font-bold tracking-wider text-indigo-400 selection:bg-indigo-500/30 break-all select-all">
                {shareCode}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              type="button"
              className="h-[52px] px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 flex-shrink-0"
            >
              {copiedCode ? (
                <>
                  <Check className="w-5 h-5 text-emerald-300" />
                  <span className="text-sm font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span className="text-sm font-semibold">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Direct Link */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
            Direct Shareable Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={downloadUrl}
              className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl py-3 px-3.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleCopyUrl}
              type="button"
              className="h-[46px] px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 active:scale-95 border border-slate-700"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-slate-300" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-[46px] w-[46px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center transition-colors border border-slate-700"
              title="Open download page"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="mt-6 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
        <p className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Lock className="w-3.5 h-3.5 text-indigo-400" /> End-to-End Protection
        </p>
        <p>
          The recipient must provide the password you configured to download the file. The file will be automatically destroyed after expiration.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-98 border border-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Upload Another File</span>
        </button>
        <a
          href="/download"
          className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98"
        >
          <Download className="w-4 h-4" />
          <span>Go to Download Page</span>
        </a>
      </div>
    </div>
  );
}
