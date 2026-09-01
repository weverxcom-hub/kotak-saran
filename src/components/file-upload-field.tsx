"use client";

import * as React from "react";
import { Paperclip, X, Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Harus sinkron dengan validasi server di src/app/api/upload/route.ts. */
export const ALLOWED_ATTACHMENT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_ATTACHMENT_FILES = 3;
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    return `${file.name}: format HEIC/HEIF (default kamera iPhone) belum didukung — ubah ke JPG/PNG dulu.`;
  }
  if (
    !ALLOWED_ATTACHMENT_MIME.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME)[number],
    )
  ) {
    return `${file.name}: tipe file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `${file.name}: ukuran maksimal 4MB (file ini ${formatSize(file.size)}).`;
  }
  return null;
}

/**
 * Picker lampiran bukti reusable — dipakai SaranForm & WhistleblowerForm.
 * File dipilih lokal dulu (tanpa network); upload sungguhan baru terjadi
 * saat submit form lewat lib/upload-client.ts.
 */
export function FileUploadField({
  files,
  onChange,
  disabled,
  label = "Lampiran bukti (opsional)",
  hint = "Foto atau dokumen pendukung — JPG, PNG, WEBP, atau PDF, maks 4MB/file.",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const list = Array.from(incoming);
    if (files.length + list.length > MAX_ATTACHMENT_FILES) {
      setError(`Maksimal ${MAX_ATTACHMENT_FILES} file lampiran.`);
      return;
    }
    const validated: File[] = [];
    for (const f of list) {
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      validated.push(f);
    }
    onChange([...files, ...validated]);
  };

  const removeAt = (idx: number) => {
    setError(null);
    onChange(files.filter((_, i) => i !== idx));
  };

  const full = files.length >= MAX_ATTACHMENT_FILES;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {files.length}/{MAX_ATTACHMENT_FILES}
        </span>
      </div>
      {hint ? <p className="mb-2 text-xs text-muted-foreground">{hint}</p> : null}

      {!full ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-input bg-background px-4 py-6 text-center transition",
            dragOver && "border-primary bg-primary/5",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-foreground">
            <span className="font-medium text-primary">Klik untuk pilih file</span>{" "}
            atau seret ke sini
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_ATTACHMENT_MIME.join(",")}
            disabled={disabled}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {files.map((f, idx) => (
            <li
              key={`${f.name}-${f.size}-${idx}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(f.size)}
              </span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                disabled={disabled}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                aria-label={`Hapus ${f.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
