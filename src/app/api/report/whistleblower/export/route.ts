import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  applyWhistleblowerFilters,
  fetchWhistleblowerReports,
  parseLampiran,
  SheetsConfigError,
  type WhistleblowerFilters,
  type WhistleblowerRow,
} from "@/lib/sheets";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildFilters(searchParams: URLSearchParams): WhistleblowerFilters {
  const get = (k: string) => searchParams.get(k) ?? undefined;
  const mode = get("mode");
  return {
    q: get("q"),
    kategori: get("kategori"),
    unit: get("unit"),
    mode:
      mode === "Ya" || mode === "Tidak" || mode === "all"
        ? (mode as WhistleblowerFilters["mode"])
        : undefined,
    status: get("status"),
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
  };
}

const COLUMNS: Array<[string, (r: WhistleblowerRow) => string]> = [
  ["Waktu", (r) => r.timestamp],
  ["Case ID", (r) => r.caseId],
  ["Kategori", (r) => r.kategori],
  ["Peran", (r) => r.saudaraAdalah],
  ["Unit/Prodi", (r) => r.unitKerja],
  ["Pihak Terlibat", (r) => r.pihakTerlibat],
  ["Anonim?", (r) => (/ya|anonim/i.test(r.isAnonim) ? "Ya" : "Tidak")],
  ["Nama", (r) => r.nama],
  ["NIM/NIP", (r) => r.nim],
  ["Kontak", (r) => r.kontak],
  ["Detail Pelaporan", (r) => r.detail],
  ["Kronologi & Bukti", (r) => r.kronologi],
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

function toCSV(rows: WhistleblowerRow[]): string {
  const header = COLUMNS.map((c) => csvEscape(c[0])).join(",");
  const body = rows
    .map((r) => COLUMNS.map(([, fn]) => csvEscape(fn(r))).join(","))
    .join("\r\n");
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
    const all = await fetchWhistleblowerReports();
    const filtered = applyWhistleblowerFilters(all, filters);
    const csv = toCSV(filtered);
    const fileName = `whistleblower-feb-uniga-${new Date().toISOString().slice(0, 10)}.csv`;
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
