import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  applyFilters,
  fetchSubmissions,
  parseLampiran,
  SheetsConfigError,
  type Filters,
  type SubmissionRow,
} from "@/lib/sheets";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildFilters(searchParams: URLSearchParams): Filters {
  const get = (k: string) => searchParams.get(k) ?? undefined;
  const mode = get("mode");
  return {
    q: get("q"),
    role: get("role"),
    unit: get("unit"),
    mode:
      mode === "Ya" || mode === "Tidak" || mode === "all"
        ? (mode as Filters["mode"])
        : undefined,
    status: get("status"),
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
  };
}

const COLUMNS: Array<[string, (r: SubmissionRow) => string]> = [
  ["Waktu", (r) => r.timestamp],
  ["Tracking ID", (r) => r.trackingId],
  ["Peran", (r) => r.saudaraAdalah],
  ["Unit/Prodi", (r) => r.unitKerja],
  ["Anonim?", (r) => (/ya|anonim/i.test(r.isAnonim) ? "Ya" : "Tidak")],
  ["Nama", (r) => r.nama],
  ["NIM", (r) => r.nim],
  ["Masukan", (r) => r.masukan],
  ["Kronologi", (r) => r.kronologi],
  ["Kontak", (r) => r.kontak],
  ["Lampiran", (r) => parseLampiran(r.lampiran).map((a) => a.name).join("; ")],
  ["Status", (r) => r.status],
  ["Catatan untuk Pelapor", (r) => r.catatanAdmin],
  ["Terakhir Diupdate", (r) => r.terakhirDiupdate],
];

function csvEscape(value: string): string {
  if (value == null) return "";
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function toCSV(rows: SubmissionRow[]): string {
  const header = COLUMNS.map((c) => csvEscape(c[0])).join(",");
  const body = rows
    .map((r) => COLUMNS.map(([, fn]) => csvEscape(fn(r))).join(","))
    .join("\r\n");
  // Prepend BOM for Excel-friendly UTF-8
  return "\ufeff" + header + "\r\n" + body + "\r\n";
}

export async function GET(req: Request) {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(session)) {
    return NextResponse.json({ error: "Tidak terotorisasi." }, { status: 401 });
  }
  const url = new URL(req.url);
  const filters = buildFilters(url.searchParams);
  try {
    const all = await fetchSubmissions();
    const filtered = applyFilters(all, filters);
    const csv = toCSV(filtered);
    const fileName = `kotak-saran-feb-uniga-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof SheetsConfigError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : "Gagal mengekspor data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
