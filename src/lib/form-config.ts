/**
 * Konfigurasi opsi form (peran, unit kerja) + tipe payload bersama.
 *
 * Catatan: dulu file ini juga menyimpan ID Google Form + entry ID untuk
 * setiap field karena submission diteruskan ke Google Form. Sekarang
 * submission ditulis langsung ke Google Sheets (lihat `lib/sheets.ts`),
 * jadi entry ID tidak diperlukan lagi.
 */

import type { AttachmentRef } from "@/lib/lampiran";

export const ROLE_OPTIONS = ["DOSEN", "MAHASISWA", "TENDIK"] as const;
export type Role = (typeof ROLE_OPTIONS)[number];

export const UNIT_OPTIONS = [
  "FAKULTAS EKONOMI DAN BISNIS",
  "MANAJEMEN",
  "AKUNTANSI",
  "EKONOMI PEMBANGUNAN",
] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

export type AnonimChoice = "Ya" | "Tidak";

export type SuggestionPayload = {
  saudaraAdalah: Role | string;
  unitKerja: Unit;
  isAnonim: AnonimChoice;
  nama?: string;
  nim?: string;
  masukan: string;
  kronologi?: string;
  kontak?: string;
  /** Lampiran bukti — sudah diupload lewat /api/upload sebelum submit ini. */
  lampiran?: AttachmentRef[];
};
