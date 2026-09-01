import { NextResponse } from "next/server";
import { uploadFile, DriveConfigError } from "@/lib/drive";

export const runtime = "nodejs";

/**
 * Upload SATU file lampiran (dipanggil dari form publik Kotak Saran &
 * Whistleblower, sebelum submit final). Sengaja satu-file-per-request,
 * bukan batch: Vercel Serverless Functions punya batas body request
 * ~4.5MB yang tidak bisa dinaikkan lewat konfigurasi Next.js — upload
 * satu-satu menghindari batas itu sama sekali & lebih sederhana untuk
 * penanganan error per-file.
 */

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "File tidak ditemukan di request." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File kosong." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `Ukuran file maksimal 4MB (file ini ${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      },
      { status: 400 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mimeType)) {
    const isHeic = /heic|heif/i.test(mimeType) || /\.(heic|heif)$/i.test(file.name);
    const hint = isHeic
      ? " Format HEIC/HEIF (default kamera iPhone) belum didukung — ubah dulu ke JPG/PNG sebelum upload."
      : "";
    return NextResponse.json(
      {
        error: `Tipe file tidak didukung (${mimeType || "tidak dikenali"}). Gunakan JPG, PNG, WEBP, atau PDF.${hint}`,
      },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileId, name } = await uploadFile({
      buffer,
      filename: file.name || "lampiran",
      mimeType,
    });
    return NextResponse.json({ ok: true, fileId, name });
  } catch (err) {
    if (err instanceof DriveConfigError) {
      return NextResponse.json(
        { error: err.message + " Hubungi pengelola sistem untuk konfigurasi Google Drive." },
        { status: 500 },
      );
    }
    const message = err instanceof Error ? err.message : "Gagal upload file.";
    return NextResponse.json(
      { error: `Gagal upload ke Google Drive: ${message}` },
      { status: 502 },
    );
  }
}
