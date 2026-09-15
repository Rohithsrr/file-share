"use client";

import { useState, useRef, ChangeEvent, DragEvent, FormEvent } from "react";
import JSZip from "jszip";
import {
  UploadCloud,
  File,
  Folder,
  Files,
  X,
  Lock,
  Eye,
  EyeOff,
  Dices,
  Clock,
  ShieldAlert,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";
import { formatBytes, generateShareCode, isValidShareCode } from "@/lib/utils";
import { UploadResponse, FileManifestItem } from "@/lib/types";

interface FileUploaderProps {
  onUploadSuccess: (
    data: Required<
      Pick<
        UploadResponse,
        "shareCode" | "downloadUrl" | "expiresAt" | "filename" | "size"
      >
    >
  ) => void;
}

interface SelectedItem {
  file: globalThis.File;
  relativePath: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB single package limit

export default function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isFolder, setIsFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(5); // Default 5 minutes
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Calculate total size of selected items
  const totalSizeBytes = selectedItems.reduce((acc, item) => acc + item.file.size, 0);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Traverse dropped directory tree recursively
  const traverseFileTree = async (
    item: any,
    path = ""
  ): Promise<SelectedItem[]> => {
    if (item.isFile) {
      return new Promise((resolve) => {
        item.file((file: globalThis.File) => {
          resolve([{ file, relativePath: path + file.name }]);
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      const entries: any[] = await new Promise((resolve) => {
        dirReader.readEntries((results: any[]) => resolve(results));
      });
      const nested: SelectedItem[] = [];
      for (const entry of entries) {
        const sub = await traverseFileTree(entry, path + item.name + "/");
        nested.push(...sub);
      }
      return nested;
    }
    return [];
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage(null);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const collected: SelectedItem[] = [];
      let detectedFolder = false;
      let detectedFolderName = "";

      for (let i = 0; i < items.length; i++) {
        const item = (items[i] as any).webkitGetAsEntry
          ? (items[i] as any).webkitGetAsEntry()
          : null;
        if (item) {
          if (item.isDirectory) {
            detectedFolder = true;
            if (!detectedFolderName) detectedFolderName = item.name;
          }
          const files = await traverseFileTree(item);
          collected.push(...files);
        }
      }

      if (collected.length > 0) {
        validateAndSetItems(collected, detectedFolder, detectedFolderName);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray: SelectedItem[] = Array.from(e.dataTransfer.files).map((f) => ({
        file: f,
        relativePath: f.name,
      }));
      validateAndSetItems(filesArray, false, "");
    }
  };

  const handleFilesInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray: SelectedItem[] = Array.from(e.target.files).map((f) => ({
        file: f,
        relativePath: f.name,
      }));
      validateAndSetItems(filesArray, false, "");
    }
  };

  const handleFolderInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const firstPath = (files[0] as any).webkitRelativePath || "";
      const rootFolder = firstPath.split("/")[0] || "folder";

      const filesArray: SelectedItem[] = files.map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      validateAndSetItems(filesArray, true, rootFolder);
    }
  };

  const validateAndSetItems = (
    items: SelectedItem[],
    folderMode: boolean,
    folderNameStr: string
  ) => {
    setErrorMessage(null);
    const total = items.reduce((acc, item) => acc + item.file.size, 0);

    if (total > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `Total upload size exceeds 50MB (${formatBytes(total)}). Please select fewer files or smaller files for free tier availability.`
      );
      return;
    }

    if (items.length === 0 || total === 0) {
      setErrorMessage("Selected folder or files are empty.");
      return;
    }

    setSelectedItems(items);
    setIsFolder(folderMode);
    setFolderName(folderNameStr);
  };

  const handleGenerateRandomCode = () => {
    setCustomCode(generateShareCode());
    setUseCustomCode(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedItems.length === 0) {
      setErrorMessage("Please select at least one file or folder to upload.");
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
      let uploadFile: globalThis.File;
      let isArchive = false;
      const fileCount = selectedItems.length;
      const manifest: FileManifestItem[] = selectedItems.map((item) => ({
        name: item.file.name,
        size: item.file.size,
        path: item.relativePath,
      }));

      // If single file (and not folder mode), upload directly
      if (selectedItems.length === 1 && !isFolder) {
        uploadFile = selectedItems[0].file;
      } else {
        // Multiple files or folder: package into a high-performance zip archive
        setStatusMessage("Bundling files into secure archive...");
        const zip = new JSZip();

        for (const item of selectedItems) {
          zip.file(item.relativePath, item.file);
        }

        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        const archiveName = isFolder && folderName
          ? `${folderName}.zip`
          : `bundle-${Date.now()}.zip`;

        uploadFile = new (window as any).File([zipBlob], archiveName, {
          type: "application/zip",
        });
        isArchive = true;
      }

      setStatusMessage("Encrypting & uploading to cloud...");

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("password", password);
      formData.append("durationMinutes", durationMinutes.toString());
      formData.append("isArchive", isArchive ? "true" : "false");
      formData.append("fileCount", fileCount.toString());
      formData.append("manifest", JSON.stringify(manifest));

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
      setStatusMessage("");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone & File/Folder selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-200">
              Select Files or Folder
            </label>
            <span className="text-[11px] text-slate-400">
              Up to 50MB per share (Free Tier)
            </span>
          </div>

          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilesInput}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is standard in browsers
            webkitdirectory=""
            directory=""
            onChange={handleFolderInput}
            className="hidden"
          />

          {selectedItems.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-950/30 scale-[1.01]"
                  : "border-slate-700/80 bg-slate-950/40 hover:border-indigo-500/60"
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                <UploadCloud className="w-7 h-7" />
              </div>

              <p className="text-base font-semibold text-slate-200">
                Drag & drop files or full folders here
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Support for single files, multiple files, or complete directory trees
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                >
                  <Files className="w-3.5 h-3.5" />
                  <span>Browse Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 active:scale-95"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>Browse Folder</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    {isFolder ? (
                      <Folder className="w-6 h-6 text-amber-400" />
                    ) : selectedItems.length > 1 ? (
                      <Layers className="w-6 h-6 text-indigo-400" />
                    ) : (
                      <File className="w-6 h-6 text-indigo-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">
                      {isFolder
                        ? `Folder: ${folderName}`
                        : selectedItems.length === 1
                        ? selectedItems[0].file.name
                        : `${selectedItems.length} Files Selected`}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {formatBytes(totalSizeBytes)} • {selectedItems.length} file{selectedItems.length === 1 ? "" : "s"}
                      {selectedItems.length > 1 && " (Auto-zipped)"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedItems([]);
                    setIsFolder(false);
                    setFolderName("");
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  title="Remove selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Password Protection */}
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
          <p className="text-[11px] text-slate-500 mt-1">
            🔒 File names remain completely hidden from visitors until they enter this password.
          </p>
        </div>

        {/* Secret Code Configuration */}
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
          <p className="text-[11px] text-indigo-400/90 mt-1.5">
            ⚡ Automatically deleted from cloud storage after 5 minutes to keep free tier space available.
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
          disabled={isLoading || selectedItems.length === 0}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xl ${
            isLoading || selectedItems.length === 0
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
              : "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 active:scale-[0.99]"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{statusMessage || "Encrypting & Uploading..."}</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>
                Upload & Protect {selectedItems.length > 1 ? `(${selectedItems.length} Files)` : isFolder ? "(Folder)" : "File"}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
