"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, UploadCloud, Download, Lock } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white group transition-transform duration-200 hover:scale-[1.02]"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-[2px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              GhostDrop
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400 -mt-1 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Ephemeral & Encrypted
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              pathname === "/"
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload</span>
          </Link>

          <Link
            href="/download"
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              pathname.startsWith("/download")
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
