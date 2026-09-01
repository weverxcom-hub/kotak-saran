import { google } from "googleapis";
import { getGoogleCredentials, GoogleAuthConfigError } from "@/lib/google-auth";
import { DEFAULT_STATUS, normalizeStatus } from "@/lib/status-config";
import {
  parseLampiran,
  serializeLampiran,
  type AttachmentRef,
} from "@/lib/lampiran";

// Re-export supaya konsumen server (routes) tetap bisa `import { parseLampiran }
// from "@/lib/sheets"` — tapi komponen CLIENT harus impor langsung dari
// "@/lib/lampiran" (bukan dari sini), karena file ini mengimpor `googleapis`
// (Node-only) dan tidak boleh masuk ke bundle browser.
export { parseLampiran, serializeLampiran };
export type { AttachmentRef };

/**
 * Klien Google Sheets API — baca dan tulis ke spreadsheet rekap masukan.
 *
 * Kredensial: lihat lib/google-auth.ts (dipakai bersama dengan lib/drive.ts).
 *
 * Service account harus diberi akses Editor pada spreadsheet target supaya
 * bisa append baris (untuk submission baru). Akses Viewer cukup untuk
 * /report yang hanya membaca.
 *
 * Spreadsheet target diatur via:
 *   - REPORT_SHEET_ID  → ID spreadsheet
 *   - REPORT_SHEET_RANGE → mis. "Sheet1!A:Q" (default ke A:Z dari sheet pertama)
 */

export type RawRow = string[];

export type SubmissionRow = {
  rowIndex: number;
  timestamp: string; // ISO string
  saudaraAdalah: string;
  unitKerja: string;
  isAnonim: "Ya" | "Tidak" | string;
  // identitas branch
  nama: string;
  nim: string;
  masukanIdentitas: string;
  kronologiIdentitas: string;
  kontakIdentitas: string;
  // anonim branch
  masukanAnonim: string;
  kronologiAnonim: string;
  kontakAnonim: string;
  // unified for display
  masukan: string;
  kronologi: string;
  kontak: string;
  // tindak lanjut (kolom M–Q)
  trackingId: string;
  lampiran: string; // raw serialized, parse via parseLampiran()
  status: string;
  catatanAdmin: string;
  terakhirDiupdate: string;
};

export type SheetSchema = {
  headers: string[];
  /** Map dari header (lowercase) → indeks kolom */
  headerIndex: Record<string, number>;
};

export class SheetsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsConfigError";
  }
}

function getSheetsClient(scope: "read" | "write" = "read") {
  let creds;
  try {
    creds = getGoogleCredentials();
  } catch (e) {
    if (e instanceof GoogleAuthConfigError) throw new SheetsConfigError(e.message);
    throw e;
  }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      scope === "write"
        ? "https://www.googleapis.com/auth/spreadsheets"
        : "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });
  return google.sheets({ version: "v4", auth });
}

function getConfig() {
  const sheetId = process.env.REPORT_SHEET_ID;
  if (!sheetId) {
    throw new SheetsConfigError(
      "REPORT_SHEET_ID belum diset (ID spreadsheet Google).",
    );
  }
  const range = process.env.REPORT_SHEET_RANGE || "A:Z";
  return { sheetId, range };
}

/** Konversi indeks kolom 1-based → huruf A1 notation (1→A, 17→Q, 27→AA). */
function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Migrasi header self-healing. Google Sheets API memotong setiap row
 * (termasuk header) sampai sel non-kosong terakhir — kalau kode nambah
 * kolom baru tapi header row di spreadsheet lama belum diperpanjang, kolom
 * baru akan selalu terbaca "" walau append sudah menulis data di sana.
 *
 * Dipanggil di awal setiap append: cek header saat ini, tambahkan header
 * yang belum ada (tanpa menyentuh yang sudah ada). Idempoten & murah (satu
 * `values.get` kecil per submission).
 *
 * `rangePrefix`: "" untuk Kotak Saran (sengaja tanpa nama sheet — kode ini
 * dari awal didesain supaya jalan di "sheet pertama apa pun namanya"),
 * atau "Whistleblower!" untuk tab Whistleblower.
 */
async function ensureHeaderColumns(
  rangePrefix: string,
  requiredHeaders: readonly string[],
): Promise<void> {
  const { sheetId } = getConfig();
  const sheets = getSheetsClient("write");
  const lastCol = colLetter(requiredHeaders.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${rangePrefix}A1:${lastCol}1`,
  });
  const current = (res.data.values?.[0] as string[] | undefined) ?? [];
  if (current.length >= requiredHeaders.length) return;
  const missing = requiredHeaders.slice(current.length);
  const startCol = colLetter(current.length + 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${rangePrefix}${startCol}1:${lastCol}1`,
    valueInputOption: "RAW",
    requestBody: { values: [missing] },
  });
}

/** Header lengkap Kotak Saran (17 kolom A–Q) — dipakai untuk self-healing migration. */
export const KOTAK_SARAN_HEADERS = [
  "Timestamp",
  "Saudara adalah",
  "Unit kerja / Prodi",
  "Apakah Anonim?",
  "Nama (jika identitas)",
  "NIM/NIP (jika identitas)",
  "Masukan (identitas)",
  "Kronologi (identitas)",
  "Kontak (identitas)",
  "Masukan (anonim)",
  "Kronologi (anonim)",
  "Kontak (anonim)",
  "Tracking ID",
  "Lampiran",
  "Status",
  "Catatan untuk Pelapor",
  "Terakhir Diupdate",
] as const;

/** Format kode tracking bersama Kotak Saran (KS-) & Whistleblower (WB-). */
function generateTrackingId(prefix: "KS" | "WB", now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  // 6-char base36 random suffix (~2.2 miliar kombinasi per hari) — cukup
  // sulit ditebak untuk endpoint publik /api/lacak yang tidak di-rate-limit.
  const rand = Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  return `${prefix}-${y}${m}${d}-${rand}`;
}

/**
 * Heuristik mapping header Google Forms → field SubmissionRow.
 * Google Forms memberi header sesuai pertanyaan, jadi kita match longgar.
 */
const HEADER_PATTERNS: Array<[keyof SubmissionRow, RegExp[]]> = [
  ["timestamp", [/timestamp|stempel\s*waktu/i]],
  ["saudaraAdalah", [/saudara\s*adalah|peran|jabatan/i]],
  ["unitKerja", [/unit\s*kerja|prodi|program\s*studi|fakultas/i]],
  ["isAnonim", [/anonim|identitas\s*disembunyikan|tidak\s*disebut/i]],
  ["nama", [/^nama\b|nama\s*lengkap/i]],
  ["nim", [/\bnim\b|nip|nidn/i]],
  [
    "masukanIdentitas",
    [/masukan.*identitas|masukan.*nama|saran.*identitas/i],
  ],
  [
    "kronologiIdentitas",
    [/kronologi.*identitas|kronologi.*nama|kejadian.*identitas/i],
  ],
  [
    "kontakIdentitas",
    [/kontak.*identitas|kontak.*nama|wa.*identitas|telepon.*identitas/i],
  ],
  ["masukanAnonim", [/masukan.*anonim|saran.*anonim/i]],
  ["kronologiAnonim", [/kronologi.*anonim|kejadian.*anonim/i]],
  ["kontakAnonim", [/kontak.*anonim|wa.*anonim|telepon.*anonim/i]],
  ["trackingId", [/tracking\s*id|kode\s*lacak/i]],
  ["lampiran", [/lampiran|bukti\s*file/i]],
  ["status", [/^status/i]],
  ["catatanAdmin", [/catatan/i]],
  ["terakhirDiupdate", [/terakhir\s*diupdate|update\s*terakhir/i]],
];

function buildColumnMap(headers: string[]): Record<keyof SubmissionRow, number> {
  const map: Partial<Record<keyof SubmissionRow, number>> = {};
  for (const [field, patterns] of HEADER_PATTERNS) {
    const idx = headers.findIndex((h) => patterns.some((p) => p.test(h)));
    if (idx >= 0) map[field] = idx;
  }
  // Fallback berdasarkan urutan kolom Google Form (jika header tidak match)
  // Format Google Form ini menghasilkan urutan kira-kira:
  //   0: Timestamp
  //   1: Saudara adalah
  //   2: Unit kerja
  //   3: Anonim?
  //   4: Nama (identitas)
  //   5: NIM (identitas)
  //   6: Masukan (identitas)
  //   7: Kronologi (identitas)
  //   8: Kontak (identitas)
  //   9: Masukan (anonim)
  //  10: Kronologi (anonim)
  //  11: Kontak (anonim)
  //  12: Tracking ID
  //  13: Lampiran
  //  14: Status
  //  15: Catatan untuk Pelapor
  //  16: Terakhir Diupdate
  const FALLBACK: Array<[keyof SubmissionRow, number]> = [
    ["timestamp", 0],
    ["saudaraAdalah", 1],
    ["unitKerja", 2],
    ["isAnonim", 3],
    ["nama", 4],
    ["nim", 5],
    ["masukanIdentitas", 6],
    ["kronologiIdentitas", 7],
    ["kontakIdentitas", 8],
    ["masukanAnonim", 9],
    ["kronologiAnonim", 10],
    ["kontakAnonim", 11],
    ["trackingId", 12],
    ["lampiran", 13],
    ["status", 14],
    ["catatanAdmin", 15],
    ["terakhirDiupdate", 16],
  ];
  for (const [field, idx] of FALLBACK) {
    if (map[field] === undefined && idx < headers.length) map[field] = idx;
  }
  return map as Record<keyof SubmissionRow, number>;
}

function parseTimestamp(raw: string): string {
  if (!raw) return "";
  // Google Forms (Indonesia) menulis timestamp dalam format DD/MM/YYYY HH:mm:ss.
  // Coba pola DD/MM lebih dulu, karena Date.parse() Node akan salah menafsirkan
  // sebagai US MM/DD/YYYY ketika dd <= 12 dan mm <= 12 (mis. "5/3/2026" jadi May 3,
  // padahal di form Indonesia maksudnya 5 Maret).
  const m = raw.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
  );
  if (m) {
    const [, dd, mm, yyyy, h, min, sec] = m;
    const fullYear = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy);
    const d = new Date(
      fullYear,
      Number(mm) - 1,
      Number(dd),
      Number(h),
      Number(min),
      Number(sec ?? 0),
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // Pola ISO atau format lain yang dipahami Date.parse (mis. spreadsheet yang
  // sudah dinormalisasi ke ISO).
  const t = Date.parse(raw);
  if (!isNaN(t)) return new Date(t).toISOString();
  return raw;
}

export async function fetchSubmissions(): Promise<SubmissionRow[]> {
  const { sheetId, range } = getConfig();
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (res.data.values as RawRow[] | undefined) ?? [];
  if (values.length === 0) return [];
  const [headers, ...rows] = values;
  const map = buildColumnMap(headers);
  const out: SubmissionRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c?.toString().trim())) continue;
    const get = (k: keyof SubmissionRow) => {
      const idx = map[k];
      if (idx === undefined) return "";
      return (row[idx] ?? "").toString().trim();
    };
    const isAnonim = get("isAnonim");
    const masukanIdentitas = get("masukanIdentitas");
    const masukanAnonim = get("masukanAnonim");
    out.push({
      rowIndex: i + 2, // sheet row (1-indexed; +1 for header)
      timestamp: parseTimestamp(get("timestamp")),
      saudaraAdalah: get("saudaraAdalah"),
      unitKerja: get("unitKerja"),
      isAnonim: isAnonim,
      nama: get("nama"),
      nim: get("nim"),
      masukanIdentitas,
      kronologiIdentitas: get("kronologiIdentitas"),
      kontakIdentitas: get("kontakIdentitas"),
      masukanAnonim,
      kronologiAnonim: get("kronologiAnonim"),
      kontakAnonim: get("kontakAnonim"),
      // unified
      masukan: masukanIdentitas || masukanAnonim,
      kronologi: get("kronologiIdentitas") || get("kronologiAnonim"),
      kontak: get("kontakIdentitas") || get("kontakAnonim"),
      // tindak lanjut
      trackingId: get("trackingId"),
      lampiran: get("lampiran"),
      status: normalizeStatus(get("status")),
      catatanAdmin: get("catatanAdmin"),
      terakhirDiupdate: get("terakhirDiupdate"),
    });
  }
  return out;
}

export type Filters = {
  q?: string;
  role?: string;
  unit?: string;
  mode?: "Ya" | "Tidak" | "all";
  status?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
};

export function applyFilters(
  rows: SubmissionRow[],
  filters: Filters,
): SubmissionRow[] {
  const q = filters.q?.toLowerCase().trim();
  const from = filters.dateFrom ? Date.parse(filters.dateFrom) : NaN;
  const to = filters.dateTo
    ? Date.parse(filters.dateTo) + 24 * 60 * 60 * 1000 - 1
    : NaN;
  return rows.filter((r) => {
    if (filters.role && filters.role !== "all" && r.saudaraAdalah !== filters.role)
      return false;
    if (filters.unit && filters.unit !== "all" && r.unitKerja !== filters.unit)
      return false;
    if (filters.status && filters.status !== "all" && r.status !== filters.status)
      return false;
    if (filters.mode && filters.mode !== "all") {
      // Normalisasi: Google Form bisa simpan "Ya" / "Tidak" atau "Anonim" / "Identitas"
      const isAnonim = /ya|anonim/i.test(r.isAnonim);
      const wantAnonim = filters.mode === "Ya";
      if (isAnonim !== wantAnonim) return false;
    }
    if (!isNaN(from) || !isNaN(to)) {
      const t = Date.parse(r.timestamp);
      if (isNaN(t)) return false;
      if (!isNaN(from) && t < from) return false;
      if (!isNaN(to) && t > to) return false;
    }
    if (q) {
      const haystack = [
        r.saudaraAdalah,
        r.unitKerja,
        r.nama,
        r.nim,
        r.masukan,
        r.kronologi,
        r.kontak,
        r.trackingId,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Format timestamp Indonesia (DD/MM/YYYY HH:mm:ss) — sama dengan format yang
 * Google Forms tulis di spreadsheet jawaban, supaya parser di sisi /report
 * kompatibel.
 */
function formatIndonesianTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${h}:${min}:${sec}`;
}

export type AppendPayload = {
  saudaraAdalah: string;
  unitKerja: string;
  isAnonim: "Ya" | "Tidak";
  nama?: string;
  nim?: string;
  masukan: string;
  kronologi?: string;
  kontak?: string;
  lampiran?: AttachmentRef[];
};

/**
 * Append satu baris ke spreadsheet rekap. Skema kolom (17 kolom A–Q):
 *   A Timestamp
 *   B Saudara adalah
 *   C Unit kerja / Prodi
 *   D Apakah Anonim?
 *   E Nama (jika identitas)
 *   F NIM/NIP (jika identitas)
 *   G Masukan (identitas)
 *   H Kronologi (identitas)
 *   I Kontak (identitas)
 *   J Masukan (anonim)
 *   K Kronologi (anonim)
 *   L Kontak (anonim)
 *   M Tracking ID       (KS-YYYYMMDD-XXXXXX, di-generate server)
 *   N Lampiran          ("nama :: driveFileId" per baris)
 *   O Status            (Baru / Diproses / Selesai / Ditolak)
 *   P Catatan untuk Pelapor (tampil publik via /lacak)
 *   Q Terakhir Diupdate
 *
 * Service account butuh akses Editor pada spreadsheet target.
 */
export async function appendSubmission(
  payload: AppendPayload,
): Promise<{ trackingId: string; timestamp: string }> {
  await ensureHeaderColumns("", KOTAK_SARAN_HEADERS);
  const { sheetId } = getConfig();
  const sheets = getSheetsClient("write");
  const isAnonim = payload.isAnonim === "Ya";
  const now = new Date();
  const timestamp = formatIndonesianTimestamp(now);
  const trackingId = generateTrackingId("KS", now);
  const row = [
    timestamp, // A
    payload.saudaraAdalah, // B
    payload.unitKerja, // C
    payload.isAnonim, // D "Ya" | "Tidak"
    isAnonim ? "" : (payload.nama ?? ""), // E
    isAnonim ? "" : (payload.nim ?? ""), // F
    isAnonim ? "" : payload.masukan, // G
    isAnonim ? "" : (payload.kronologi ?? ""), // H
    isAnonim ? "" : (payload.kontak ?? ""), // I
    isAnonim ? payload.masukan : "", // J
    isAnonim ? (payload.kronologi ?? "") : "", // K
    isAnonim ? (payload.kontak ?? "") : "", // L
    trackingId, // M
    serializeLampiran(payload.lampiran ?? []), // N
    DEFAULT_STATUS, // O
    "", // P catatan untuk pelapor
    "", // Q terakhir diupdate
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "A:Q",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  return { trackingId, timestamp };
}

/** Update status + catatan untuk satu baris Kotak Saran (kolom O:Q). */
export async function updateSubmissionStatus(
  rowIndex: number,
  status: string,
  catatan: string,
): Promise<{ terakhirDiupdate: string }> {
  const { sheetId } = getConfig();
  const sheets = getSheetsClient("write");
  const timestamp = formatIndonesianTimestamp(new Date());
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `O${rowIndex}:Q${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status, catatan, timestamp]] },
  });
  return { terakhirDiupdate: timestamp };
}

export type Stats = {
  total: number;
  anonim: number;
  identitas: number;
  perRole: Record<string, number>;
  perUnit: Record<string, number>;
  perStatus: Record<string, number>;
  perMonth: Array<{ month: string; count: number }>;
};

// ─────────────────────────────────────────────────────────────────────
// Whistleblower (laporan pelanggaran)
//
// Disimpan di TAB TERPISAH bernama "Whistleblower" pada spreadsheet yang
// sama. Skema kolom (16 kolom A–P):
//   A Timestamp
//   B Case ID            (WB-YYYYMMDD-XXXXXX, di-generate server)
//   C Kategori
//   D Saudara adalah
//   E Unit kerja / Prodi
//   F Pihak Terlibat
//   G Apakah Anonim?     (Ya / Tidak)
//   H Nama               (kalau identitas)
//   I NIM/NIP            (kalau identitas)
//   J Kontak             (kalau identitas)
//   K Detail Pelaporan
//   L Kronologi & Bukti
//   M Lampiran           ("nama :: driveFileId" per baris)
//   N Status             (Baru / Diproses / Selesai / Ditolak)
//   O Catatan untuk Pelapor (tampil publik via /lacak)
//   P Terakhir Diupdate
//
// Untuk WB, kolom Detail (K) dan Kronologi (L) selalu terisi tanpa
// peduli mode anonim — yang ditahan hanya kolom identitas H/I/J.
// ─────────────────────────────────────────────────────────────────────

export const WHISTLEBLOWER_SHEET_NAME = "Whistleblower";

export const WHISTLEBLOWER_HEADERS = [
  "Timestamp",
  "Case ID",
  "Kategori",
  "Saudara adalah",
  "Unit kerja / Prodi",
  "Pihak Terlibat",
  "Apakah Anonim?",
  "Nama (jika identitas)",
  "NIM/NIP (jika identitas)",
  "Kontak (jika identitas)",
  "Detail Pelaporan",
  "Kronologi & Bukti",
  "Lampiran",
  "Status",
  "Catatan untuk Pelapor",
  "Terakhir Diupdate",
] as const;

export type WhistleblowerRow = {
  rowIndex: number;
  timestamp: string; // ISO
  caseId: string;
  kategori: string;
  saudaraAdalah: string;
  unitKerja: string;
  pihakTerlibat: string;
  isAnonim: "Ya" | "Tidak" | string;
  nama: string;
  nim: string;
  kontak: string;
  detail: string;
  kronologi: string;
  lampiran: string; // raw serialized, parse via parseLampiran()
  status: string;
  catatanAdmin: string;
  terakhirDiupdate: string;
};

export type WhistleblowerStats = {
  total: number;
  anonim: number;
  identitas: number;
  perKategori: Record<string, number>;
  perUnit: Record<string, number>;
  perStatus: Record<string, number>;
  perMonth: Array<{ month: string; count: number }>;
};

export type WhistleblowerAppendPayload = {
  saudaraAdalah: string;
  unitKerja: string;
  kategori: string;
  pihakTerlibat?: string;
  isAnonim: "Ya" | "Tidak";
  nama?: string;
  nim?: string;
  kontak?: string;
  detail: string;
  kronologi?: string;
  lampiran?: AttachmentRef[];
};

/**
 * Cek apakah tab "Whistleblower" sudah ada di spreadsheet. Kalau belum,
 * tambahkan sheet baru lengkap dengan baris header. Idempoten — kalau
 * sheet sudah ada, fungsi ini no-op (self-healing header untuk tab yang
 * SUDAH ada ditangani terpisah oleh ensureHeaderColumns()).
 */
async function ensureWhistleblowerSheet(): Promise<void> {
  const { sheetId } = getConfig();
  const sheets = getSheetsClient("write");
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets.properties.title",
  });
  const exists = (meta.data.sheets ?? []).some(
    (s) => s.properties?.title === WHISTLEBLOWER_SHEET_NAME,
  );
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: WHISTLEBLOWER_SHEET_NAME,
              gridProperties: {
                rowCount: 1000,
                columnCount: WHISTLEBLOWER_HEADERS.length,
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${WHISTLEBLOWER_SHEET_NAME}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [WHISTLEBLOWER_HEADERS.slice()] },
  });
}

/**
 * Append satu baris laporan whistleblower ke tab "Whistleblower". Auto
 * create tab kalau belum ada. Mengembalikan Case ID yang ter-generate.
 */
export async function appendWhistleblowerReport(
  payload: WhistleblowerAppendPayload,
): Promise<{ caseId: string; timestamp: string }> {
  await ensureWhistleblowerSheet();
  // Self-heal header untuk tab yang sudah ada dari sebelum kolom M–P ditambahkan.
  await ensureHeaderColumns(`${WHISTLEBLOWER_SHEET_NAME}!`, WHISTLEBLOWER_HEADERS);
  const { sheetId } = getConfig();
  const sheets = getSheetsClient("write");
  const now = new Date();
  const isAnonim = payload.isAnonim === "Ya";
  const timestamp = formatIndonesianTimestamp(now);
  const caseId = generateTrackingId("WB", now);
  const row = [
    timestamp, // A
    caseId, // B
    payload.kategori, // C
    payload.saudaraAdalah, // D
    payload.unitKerja, // E
    payload.pihakTerlibat ?? "", // F
    payload.isAnonim, // G
    isAnonim ? "" : (payload.nama ?? ""), // H
    isAnonim ? "" : (payload.nim ?? ""), // I
    isAnonim ? "" : (payload.kontak ?? ""), // J
    payload.detail, // K
    payload.kronologi ?? "", // L
    serializeLampiran(payload.lampiran ?? []), // M
    DEFAULT_STATUS, // N
    "", // O catatan untuk pelapor
    "", // P terakhir diupdate
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${WHISTLEBLOWER_SHEET_NAME}!A:P`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  return { caseId, timestamp };
}

/** Update status + catatan untuk satu baris Whistleblower (kolom N:P). */
export async function updateWhistleblowerStatus(
  rowIndex: number,
  status: string,
  catatan: string,
): Promise<{ terakhirDiupdate: string }> {
  const { sheetId } = getConfig();
  const sheets = getSheetsClient("write");
  const timestamp = formatIndonesianTimestamp(new Date());
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${WHISTLEBLOWER_SHEET_NAME}!N${rowIndex}:P${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status, catatan, timestamp]] },
  });
  return { terakhirDiupdate: timestamp };
}

export async function fetchWhistleblowerReports(): Promise<WhistleblowerRow[]> {
  const { sheetId } = getConfig();
  const sheets = getSheetsClient();
  // Coba baca dengan asumsi sheet sudah ada.
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${WHISTLEBLOWER_SHEET_NAME}!A:P`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const values = (res.data.values as RawRow[] | undefined) ?? [];
    if (values.length === 0) return [];
    const [, ...rows] = values; // skip header
    const out: WhistleblowerRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c?.toString().trim())) continue;
      const cell = (idx: number) => (r[idx] ?? "").toString().trim();
      out.push({
        rowIndex: i + 2,
        timestamp: parseTimestamp(cell(0)),
        caseId: cell(1),
        kategori: cell(2),
        saudaraAdalah: cell(3),
        unitKerja: cell(4),
        pihakTerlibat: cell(5),
        isAnonim: cell(6),
        nama: cell(7),
        nim: cell(8),
        kontak: cell(9),
        detail: cell(10),
        kronologi: cell(11),
        lampiran: cell(12),
        status: normalizeStatus(cell(13)),
        catatanAdmin: cell(14),
        terakhirDiupdate: cell(15),
      });
    }
    return out;
  } catch (err) {
    // Sheet "Whistleblower" mungkin belum dibuat (belum pernah submit).
    // Kembalikan list kosong supaya dashboard tetap bisa render.
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("unable to parse range") || message.includes("not found")) {
      return [];
    }
    throw err;
  }
}

export type WhistleblowerFilters = {
  q?: string;
  kategori?: string;
  unit?: string;
  mode?: "Ya" | "Tidak" | "all";
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function applyWhistleblowerFilters(
  rows: WhistleblowerRow[],
  filters: WhistleblowerFilters,
): WhistleblowerRow[] {
  const q = filters.q?.toLowerCase().trim();
  const from = filters.dateFrom ? Date.parse(filters.dateFrom) : NaN;
  const to = filters.dateTo
    ? Date.parse(filters.dateTo) + 24 * 60 * 60 * 1000 - 1
    : NaN;
  return rows.filter((r) => {
    if (
      filters.kategori &&
      filters.kategori !== "all" &&
      r.kategori !== filters.kategori
    )
      return false;
    if (filters.unit && filters.unit !== "all" && r.unitKerja !== filters.unit)
      return false;
    if (filters.status && filters.status !== "all" && r.status !== filters.status)
      return false;
    if (filters.mode && filters.mode !== "all") {
      const isAnonim = /ya|anonim/i.test(r.isAnonim);
      const wantAnonim = filters.mode === "Ya";
      if (isAnonim !== wantAnonim) return false;
    }
    if (!isNaN(from) || !isNaN(to)) {
      const t = Date.parse(r.timestamp);
      if (isNaN(t)) return false;
      if (!isNaN(from) && t < from) return false;
      if (!isNaN(to) && t > to) return false;
    }
    if (q) {
      const haystack = [
        r.caseId,
        r.kategori,
        r.saudaraAdalah,
        r.unitKerja,
        r.pihakTerlibat,
        r.nama,
        r.nim,
        r.kontak,
        r.detail,
        r.kronologi,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function computeWhistleblowerStats(
  rows: WhistleblowerRow[],
): WhistleblowerStats {
  const perKategori: Record<string, number> = {};
  const perUnit: Record<string, number> = {};
  const perStatus: Record<string, number> = {};
  const perMonthMap = new Map<string, number>();
  let anonim = 0;
  for (const r of rows) {
    const kat = r.kategori || "(tidak diisi)";
    perKategori[kat] = (perKategori[kat] ?? 0) + 1;
    const unit = r.unitKerja || "(tidak diisi)";
    perUnit[unit] = (perUnit[unit] ?? 0) + 1;
    const status = normalizeStatus(r.status);
    perStatus[status] = (perStatus[status] ?? 0) + 1;
    if (/ya|anonim/i.test(r.isAnonim)) anonim++;
    if (r.timestamp) {
      const d = new Date(r.timestamp);
      if (!isNaN(d.getTime())) {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        perMonthMap.set(key, (perMonthMap.get(key) ?? 0) + 1);
      }
    }
  }
  const perMonth = Array.from(perMonthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return {
    total: rows.length,
    anonim,
    identitas: rows.length - anonim,
    perKategori,
    perUnit,
    perStatus,
    perMonth,
  };
}

export function computeStats(rows: SubmissionRow[]): Stats {
  const perRole: Record<string, number> = {};
  const perUnit: Record<string, number> = {};
  const perStatus: Record<string, number> = {};
  const perMonthMap = new Map<string, number>();
  let anonim = 0;
  for (const r of rows) {
    const role = r.saudaraAdalah || "(tidak diisi)";
    perRole[role] = (perRole[role] ?? 0) + 1;
    const unit = r.unitKerja || "(tidak diisi)";
    perUnit[unit] = (perUnit[unit] ?? 0) + 1;
    const status = normalizeStatus(r.status);
    perStatus[status] = (perStatus[status] ?? 0) + 1;
    if (/ya|anonim/i.test(r.isAnonim)) anonim++;
    if (r.timestamp) {
      const d = new Date(r.timestamp);
      if (!isNaN(d.getTime())) {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        perMonthMap.set(key, (perMonthMap.get(key) ?? 0) + 1);
      }
    }
  }
  const perMonth = Array.from(perMonthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return {
    total: rows.length,
    anonim,
    identitas: rows.length - anonim,
    perRole,
    perUnit,
    perStatus,
    perMonth,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Lacak status publik (/api/lacak) — lookup lintas kedua sheet berdasarkan
// prefix kode (KS- → Kotak Saran, WB- → Whistleblower). Response sengaja
// minim: tidak ada field PII apa pun (nama/nim/kontak/isi masukan/lampiran).
// ─────────────────────────────────────────────────────────────────────

export type TrackingLookupResult = {
  trackingId: string;
  status: string;
  catatanAdmin: string;
  submittedAt: string;
  updatedAt: string;
  kategori?: string;
};

export async function lookupTrackingCode(
  code: string,
): Promise<TrackingLookupResult | null> {
  const normalized = code.trim().toUpperCase();
  if (normalized.startsWith("KS-")) {
    const rows = await fetchSubmissions();
    const row = rows.find((r) => r.trackingId.toUpperCase() === normalized);
    if (!row) return null;
    return {
      trackingId: row.trackingId,
      status: row.status,
      catatanAdmin: row.catatanAdmin,
      submittedAt: row.timestamp,
      updatedAt: row.terakhirDiupdate,
    };
  }
  if (normalized.startsWith("WB-")) {
    const rows = await fetchWhistleblowerReports();
    const row = rows.find((r) => r.caseId.toUpperCase() === normalized);
    if (!row) return null;
    return {
      trackingId: row.caseId,
      status: row.status,
      catatanAdmin: row.catatanAdmin,
      submittedAt: row.timestamp,
      updatedAt: row.terakhirDiupdate,
      kategori: row.kategori,
    };
  }
  return null;
}
