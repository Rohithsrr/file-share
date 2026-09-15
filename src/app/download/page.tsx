"use client";

import { Suspense } from "react";
import DownloadCard from "@/components/DownloadCard";
import { Loader2 } from "lucide-react";

function DownloadCardFallback() {
  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/80 border border-slate-800/80 rounded-2xl p-12 text-center shadow-2xl backdrop-blur-xl">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
      <p className="text-sm text-slate-400">Loading download portal...</p>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <div className="py-12 sm:py-20 px-4">
      <div className="max-w-xl mx-auto mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Download Protected File
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Secure, zero-knowledge download portal with rate-limited brute force protection.
        </p>
      </div>

      <Suspense fallback={<DownloadCardFallback />}>
        <DownloadCard />
      </Suspense>
    </div>
  );
}
