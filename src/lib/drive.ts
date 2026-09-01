import { google } from "googleapis";
import { Readable } from "node:stream";
import { getGoogleCredentials, GoogleAuthConfigError } from "@/lib/google-auth";

/**
 * Klien Google Drive API — upload lampiran bukti dari form publik, dan
 * stream balik ke admin lewat route ber-auth (src/app/api/report/attachment).
 *
 * Kredensial: lihat lib/google-auth.ts (service account yang sama dengan
 * lib/sheets.ts).
 *
 * PENTING — file TIDAK dibuat publik. Tidak ada `permissions.create`
 * ("anyone with the link") di sini secara sengaja: itu bertentangan dengan
 * janji privasi yang sudah ada di README/halaman whistleblower ("hanya
 * diakses tim berwenang"). File tetap privat milik service account; admin
 * mengaksesnya lewat route proxy ber-cookie-session yang sama dengan
 * /report, bukan link publik.
 *
 * PRASYARAT SETUP (lihat README bagian "Upload Bukti"):
 *   1. Google Drive API harus diaktifkan terpisah dari Sheets API di GCP.
 *   2. REPORT_DRIVE_FOLDER_ID harus berupa folder di dalam Shared Drive
 *      (Drive Bersama) — bukan folder biasa di "My Drive". Service account
 *      tidak punya kuota penyimpanan sendiri; folder My Drive yang di-share
 *      Editor ke service account TETAP akan gagal dengan storageQuotaExceeded
 *      karena file yang dibuat service account tetap butuh kuota, dan hanya
 *      Shared Drive yang menyediakannya (kuota organisasi, bukan per-akun).
 */

export class DriveConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveConfigError";
  }
}

function getDriveClient() {
  let creds;
  try {
    creds = getGoogleCredentials();
  } catch (e) {
    if (e instanceof GoogleAuthConfigError) throw new DriveConfigError(e.message);
    throw e;
  }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    // drive.file: scope minimal — app cuma bisa akses file yang dia buat sendiri.
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

function getFolderId(): string {
  const folderId = process.env.REPORT_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new DriveConfigError(
      "REPORT_DRIVE_FOLDER_ID belum diset (ID folder Google Drive tujuan upload lampiran).",
    );
  }
  return folderId;
}

const FILENAME_UNSAFE_CHARS = new RegExp(
  '[\\\\/:*?"<>' + String.fromCharCode(124) + "]",
  "g",
);

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().slice(-150); // batasi panjang, ambil akhir supaya ekstensi tetap ikut
  // Drive tidak punya batasan nama file selayaknya filesystem — cukup buang
  // karakter yang bermasalah kalau dipakai di path/CSV (backslash, slash,
  // titik dua, kutip, dst). Spasi & tanda hubung dibiarkan apa adanya.
  const safe = trimmed.replace(FILENAME_UNSAFE_CHARS, "_");
  return safe || "lampiran";
}

function translateDriveError(err: unknown): Error {
  if (err instanceof DriveConfigError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("storagequotaexceeded") || lower.includes("storage quota")) {
    return new DriveConfigError(
      "Google Drive menolak upload: service account tidak punya kuota penyimpanan sendiri. " +
        "REPORT_DRIVE_FOLDER_ID harus folder di Shared Drive (Drive Bersama) Google Workspace, " +
        "bukan folder biasa di 'My Drive'. Lihat README bagian Upload Bukti.",
    );
  }
  if (lower.includes("file not found") || lower.includes("notfound")) {
    return new DriveConfigError(
      "Folder/file Google Drive tidak ditemukan atau service account tidak punya akses. " +
        "Cek REPORT_DRIVE_FOLDER_ID dan pastikan folder sudah di-share (Editor/Content manager) ke email service account.",
    );
  }
  if (lower.includes("insufficient") || lower.includes("permission")) {
    return new DriveConfigError(
      "Service account tidak punya izin cukup ke folder Google Drive. " +
        "Share folder sebagai Editor/Content manager ke email service account.",
    );
  }
  return new DriveConfigError(`Gagal menghubungi Google Drive: ${message}`);
}

/**
 * Upload satu file ke folder REPORT_DRIVE_FOLDER_ID. Nama file di Drive
 * di-prefix timestamp supaya tidak ambigu antar submission; nama asli tetap
 * dikembalikan untuk ditampilkan di UI/sheet.
 */
export async function uploadFile(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ fileId: string; name: string }> {
  const folderId = getFolderId();
  const drive = getDriveClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const driveName = `${stamp}_${sanitizeFilename(params.filename)}`;
  try {
    const res = await drive.files.create({
      requestBody: { name: driveName, parents: [folderId] },
      media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
      fields: "id",
      supportsAllDrives: true,
    });
    const fileId = res.data.id;
    if (!fileId) {
      throw new DriveConfigError(
        "Upload ke Google Drive tidak mengembalikan file ID.",
      );
    }
    return { fileId, name: params.filename };
  } catch (err) {
    throw translateDriveError(err);
  }
}

/**
 * Ambil isi file sebagai stream (dipakai route proxy ber-auth untuk admin).
 * TIDAK dipakai dari halaman publik — lihat catatan privasi di atas file ini.
 */
export async function getFileStream(fileId: string): Promise<{
  stream: Readable;
  mimeType: string;
  name: string;
}> {
  const drive = getDriveClient();
  try {
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType",
      supportsAllDrives: true,
    });
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );
    return {
      stream: res.data as unknown as Readable,
      mimeType: meta.data.mimeType || "application/octet-stream",
      name: meta.data.name || "lampiran",
    };
  } catch (err) {
    throw translateDriveError(err);
  }
}
