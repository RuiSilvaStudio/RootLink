"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, AlertCircle, Check, RotateCcw } from "lucide-react";

interface ImageUploadProps {
  onUpload: (urls: { thumb: string; medium: string; large: string; original: string }) => void;
  onError?: (error: string) => void;
  className?: string;
  maxSizeMb?: number;
  label?: string;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
]);

const MIN_DIMENSION = 100;

export function ImageUpload({
  onUpload,
  onError,
  className = "",
  maxSizeMb = 10,
  label,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_TYPES.has(file.type) && !file.name.match(/\.(jpe?g|png|webp|gif|bmp|tiff?)$/i)) {
        return `Unsupported format. Accepted: JPEG, PNG, WebP, GIF, BMP, TIFF`;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max ${maxSizeMb}MB)`;
      }
      return null;
    },
    [maxSizeMb]
  );

  const checkDimensions = useCallback(
    (file: File): Promise<string | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
            resolve(`Image too small: ${img.width}x${img.height}px (minimum ${MIN_DIMENSION}x${MIN_DIMENSION}px)`);
          } else {
            resolve(null);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          resolve("Cannot read image file");
        };
        img.src = URL.createObjectURL(file);
      });
    },
    []
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setPendingFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return;
      }

      const dimensionError = await checkDimensions(file);
      if (dimensionError) {
        setError(dimensionError);
        onError?.(dimensionError);
        return;
      }

      setPendingFile(file);
      setPreview(URL.createObjectURL(file));
    },
    [validateFile, checkDimensions, onError, preview]
  );

  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFile) return;
    setError(null);
    setUploading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("source_type", "upload");

      const res = await fetch(`${API_URL}/api/images/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }

      const data = await res.json();
      onUpload(data.asset.urls);
      setPendingFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    } catch (e: any) {
      setError(e.message);
      onError?.(e.message);
    } finally {
      setUploading(false);
    }
  }, [pendingFile, onUpload, onError, preview]);

  const handleCancel = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPendingFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [preview]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div className={className}>
      {label && (
        <p className="text-xs font-display font-medium text-stone-400 uppercase tracking-wider mb-2">
          {label}
        </p>
      )}

      {preview && pendingFile ? (
        <div className="border-2 border-primary-200 rounded-xl p-4">
          <div className="relative inline-block w-full">
            <img
              src={preview}
              alt="Preview"
              className="max-h-32 rounded-lg object-contain mx-auto"
            />
          </div>
          <p className="text-xs text-stone-500 text-center mt-2 font-serif truncate">
            {pendingFile.name} ({(pendingFile.size / 1024).toFixed(0)}KB)
          </p>
          <div className="flex items-center gap-2 mt-3 justify-center">
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {uploading ? (
                <RotateCcw className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50 transition"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="relative border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/20 transition"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="py-2">
            <Upload className="w-6 h-6 text-stone-400 mx-auto mb-1" />
            <p className="text-xs text-stone-500 font-serif">
              Drop image or click to select
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 font-serif">
              JPEG, PNG, WebP, GIF, BMP, TIFF (max {maxSizeMb}MB)
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="font-serif">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-stone-400 hover:text-stone-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
