"use client";

import { useState } from "react";
import FileUploader from "@/components/FileUploader";
import UploadSuccess from "@/components/UploadSuccess";
import { UploadResponse } from "@/lib/types";
import { ShieldCheck, Zap, Lock, RefreshCw } from "lucide-react";

export default function HomePage() {
  const [uploadResult, setUploadResult] = useState<
    Required<Pick<UploadResponse, "shareCode" | "downloadUrl" | "expiresAt" | "filename" | "size">> | null
  >(null);

  return (
    <div className="py-10 sm:py-16">
      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto mb-10 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-inner">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span>Zero Knowledge • Self-Destructing Storage</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Secure, Ephemeral <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            File Sharing
          </span>
        </h1>
        <p className="text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
          Upload any file protected with bcrypt password hashing and an auto-generated 6-character code. Files are automatically deleted from cloud storage in 5 minutes.
        </p>
      </div>

      {/* Main Upload / Success Card */}
      <div className="px-4">
        {uploadResult ? (
          <UploadSuccess
            shareCode={uploadResult.shareCode}
            downloadUrl={uploadResult.downloadUrl}
            expiresAt={uploadResult.expiresAt}
            filename={uploadResult.filename}
            size={uploadResult.size}
            onReset={() => setUploadResult(null)}
          />
        ) : (
          <FileUploader
            onUploadSuccess={(data) => {
              setUploadResult(data);
            }}
          />
        )}
      </div>

      {/* Security Feature Highlights */}
      <div className="max-w-4xl mx-auto mt-20 px-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/60 backdrop-blur-sm">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">Server-Side Bcrypt</h3>
          <p className="text-xs text-slate-400 mt-1 leading-normal">
            Passwords are salted and hashed on the server before database storage. No plain passwords ever touch the database.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/60 backdrop-blur-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">5-Min Auto-Destruction</h3>
          <p className="text-xs text-slate-400 mt-1 leading-normal">
            Files are automatically purged from Supabase Storage and database after 5 minutes of upload, keeping free tier limits clean.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/60 backdrop-blur-sm">
          <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">Strictly Private Bucket</h3>
          <p className="text-xs text-slate-400 mt-1 leading-normal">
            Direct public storage bucket access is blocked. Files can only be downloaded via short-lived (60s) signed URLs after password verification.
          </p>
        </div>
      </div>
    </div>
  );
}
