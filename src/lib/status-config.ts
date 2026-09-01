/**
 * Status tindak lanjut untuk submission Kotak Saran & Whistleblower.
 * Dipakai bareng oleh kedua alur: lib/sheets.ts (default & normalisasi),
 * dashboard admin (editor status), dan halaman publik /lacak (badge).
 *
 * Status disimpan sebagai teks polos di kolom "Status" pada spreadsheet —
 * untuk mengubah daftar status, cukup edit STATUS_OPTIONS + STATUS_META di
 * sini (sama seperti cara mengganti UNIT_OPTIONS di lib/form-config.ts).
 */

export const STATUS_OPTIONS = ["Baru", "Diproses", "Selesai", "Ditolak"] as const;
export type SubmissionStatus = (typeof STATUS_OPTIONS)[number];
export const DEFAULT_STATUS: SubmissionStatus = "Baru";

export const STATUS_META: Record<
  SubmissionStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  Baru: {
    label: "Baru",
    badgeClassName:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
    dotClassName: "bg-slate-500",
  },
  Diproses: {
    label: "Diproses",
    badgeClassName:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    dotClassName: "bg-amber-500",
  },
  Selesai: {
    label: "Selesai",
    badgeClassName:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    dotClassName: "bg-emerald-500",
  },
  Ditolak: {
    label: "Ditolak",
    badgeClassName:
      "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    dotClassName: "bg-rose-500",
  },
};

export function isValidStatus(value: string): value is SubmissionStatus {
  return (STATUS_OPTIONS as readonly string[]).includes(value);
}

/** Normalisasi nilai status mentah dari sheet — baris lama/kosong jadi DEFAULT_STATUS. */
export function normalizeStatus(value: string | undefined | null): SubmissionStatus {
  if (value && isValidStatus(value)) return value;
  return DEFAULT_STATUS;
}
