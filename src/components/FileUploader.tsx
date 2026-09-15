"use client";

import { useState, useRef, ChangeEvent, DragEvent, FormEvent } from "react";
import {
  UploadCloud,
  File,
  X,
  Lock,
  Eye,
  EyeOff,
  Dices,
  Clock,
  ShieldAlert,
  Loader2,
  Sparkles,
} from "lucide-react";
import { formatBytes, generateShareCode, isValidShareCode } from "@/lib/utils";
import { UploadResponse } from "@/lib/types";

interface FileUploaderProps {
  onUploadSuccess: (data: Required<Pick<UploadResponse, "shareCode" | "downloadUrl" | "expiresAt" | "filename" | "size">>) => void;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export default function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(5); // Default 5 minutes as requested!
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage(null);
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `File is too large (${formatBytes(selectedFile.size)}). Maximum allowed size is 50MB.`
      );
      return;
    }
    if (selectedFile.size === 0) {
      setErrorMessage("Selected file is empty.");
      return;
    }
    setFile(selectedFile);
  };

  const handleGenerateRandomCode = () => {
    setCustomCode(generateShareCode());
    setUseCustomCode(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage("Please choose a file to upload.");
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage("Password must be at least 4 characters long.");
      return;
    }

    if (useCustomCode && customCode) {
      if (!isValidShareCode(customCode)) {
        setErrorMessage("Custom secret code must be exactly 6 alphanumeric characters (A-Z, 0-9).");
        return;
      }
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("password", password);
      formData.append("durationMinutes", durationMinutes.toString());
      if (useCustomCode && customCode.trim()) {
        formData.append("customCode", customCode.trim().toUpperCase());
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data: UploadResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed. Please try again.");
      }

      if (
        data.shareCode &&
        data.downloadUrl &&
        data.expiresAt &&
        data.filename &&
        data.size !== undefined
      ) {
        onUploadSuccess({
          shareCode: data.shareCode,
          downloadUrl: data.downloadUrl,
          expiresAt: data.expiresAt,
          filename: data.filename,
          size: data.size,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone */}
        <div>
          <label className="text-sm font-semibold text-slate-200 block mb-2">
            Select File <span className="text-slate-500 font-normal">(Up to 50MB free tier)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInput}
            className="hidden"
          />

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group ${
                isDragging
                  ? "border-indigo-500 bg-indigo-950/30 scale-[1.01]"
                  : "border-slate-700/80 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-950/60"
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:text-indigo-300 transition-all">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-slate-200">
                Click to browse or drag & drop
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Any file type up to 50MB (PDF, Zip, Images, Documents, Videos)
              </p>
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <File className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Password Protection (Required) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-slate-200 flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              File Password <span className="text-rose-400">*</span>
            </label>
            <span className="text-[11px] text-slate-400">Hashed server-side with bcrypt</span>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a password (min 4 characters)"
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

        {/* Secret Code Configuration (Optional custom or auto-generate) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Secret Code <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <button
              type="button"
              onClick={handleGenerateRandomCode}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Generate Random</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={6}
              value={customCode}
              onChange={(e) => {
                setCustomCode(e.target.value.toUpperCase());
                setUseCustomCode(true);
              }}
              placeholder="e.g. 8K2M9Z (Leave blank to auto-generate)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all uppercase"
            />
            {customCode && (
              <button
                type="button"
                onClick={() => {
                  setCustomCode("");
                  setUseCustomCode(false);
                }}
                className="p-3 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                title="Clear code"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            6 alphanumeric characters. If left empty, a secure unique code will be assigned automatically.
          </p>
        </div>

        {/* Expiration Time Selector */}
        <div>
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Auto-Delete Expiration
          </label>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "5 Minutes", value: 5, desc: "Default ephemeral" },
              { label: "1 Hour", value: 60, desc: "Short term" },
              { label: "24 Hours", value: 1440, desc: "Max 1 day" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDurationMinutes(option.value)}
                className={`py-2.5 px-3 rounded-xl border text-center transition-all ${
                  durationMinutes === option.value
                    ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-200 shadow-md shadow-indigo-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <div className="font-semibold text-sm">{option.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{option.desc}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-indigo-400/90 mt-1.5 flex items-center gap-1">
            ⚡ Files are automatically deleted from cloud storage after 5 minutes of upload.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in-50">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !file}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xl ${
            isLoading || !file
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
              : "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 active:scale-[0.99]"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Encrypting & Uploading...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Upload & Protect File</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
