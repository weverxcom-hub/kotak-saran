/**
 * Konfigurasi & tipe untuk fitur Whistleblower (laporan pelanggaran).
 *
 * Kontekstnya berbeda dengan kotak saran biasa:
 *  - Tone & flow lebih formal, default anonim aktif.
 *  - Ada kategori pelanggaran wajib + field "pihak terlibat".
 *  - Setiap laporan mendapat Case ID untuk follow-up.
 *  - Disimpan ke tab "Whistleblower" pada spreadsheet yang sama
 *    (lihat `lib/sheets.ts`).
 */

import type { AnonimChoice, Role, Unit } from "@/lib/form-config";
import type { AttachmentRef } from "@/lib/lampiran";

export const WHISTLEBLOWER_CATEGORIES = [
  "Korupsi/Gratifikasi",
  "Kekerasan/Pelecehan Seksual",
  "Kecurangan Akademik (plagiarisme/joki)",
  "Konflik Kepentingan",
  "Pelanggaran Tata Tertib Pegawai",
  "Lainnya",
] as const;

export type WhistleblowerCategory = (typeof WHISTLEBLOWER_CATEGORIES)[number];

export type WhistleblowerPayload = {
  saudaraAdalah: Role | string;
  unitKerja: Unit;
  kategori: WhistleblowerCategory;
  pihakTerlibat?: string;
  isAnonim: AnonimChoice;
  nama?: string;
  nim?: string;
  kontak?: string;
  detail: string;
  kronologi?: string;
  /** Lampiran bukti — sudah diupload lewat /api/upload sebelum submit ini. */
  lampiran?: AttachmentRef[];
};
