"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";

type PhotoUploaderProps = {
  label?: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  helperText?: string;
  error?: string | null;
};

type UploadResponse = {
  message?: string;
  data?: {
    url?: string;
    size?: number;
    type?: string;
    name?: string;
  };
};

const extractErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as UploadResponse;
    return payload?.message ?? "Upload failed.";
  } catch (error) {
    return "Upload failed.";
  }
};

const PhotoUploader = ({
  label,
  value,
  onChange,
  disabled,
  helperText,
  error: fieldError,
}: PhotoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const previewUrl = useMemo(() => value ?? "", [value]);

  const handleClickUpload = useCallback(() => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }, [disabled, uploading]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setUploadError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const message = await extractErrorMessage(response);
          throw new Error(message);
        }

        const payload = (await response.json()) as UploadResponse;
        const url = payload?.data?.url;
        if (!url) {
          throw new Error("Upload succeeded but no file URL was returned.");
        }

        onChange(url);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Unable to upload the photo.");
      } finally {
        event.target.value = "";
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleRemove = useCallback(() => {
    if (disabled || uploading) return;
    onChange(null);
  }, [disabled, uploading, onChange]);

  return (
    <div className="flex flex-col gap-2 w-full md:w-1/3">
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Uploaded preview"
              width={64}
              height={64}
              className="h-full w-full object-cover"
              unoptimized
             />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              No photo
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={handleClickUpload}
            disabled={disabled || uploading}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading..." : previewUrl ? "Replace photo" : "Upload photo"}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || uploading}
              className="text-xs font-medium text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          )}
          {helperText && <p className="text-xs text-gray-400">{helperText}</p>}
          {fieldError && <p className="text-xs text-red-400">{fieldError}</p>}
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
    </div>
  );
};

export default PhotoUploader;
