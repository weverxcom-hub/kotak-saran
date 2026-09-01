import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  applyWhistleblowerFilters,
  computeWhistleblowerStats,
  fetchWhistleblowerReports,
  SheetsConfigError,
  type WhistleblowerFilters,
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
    const stats = computeWhistleblowerStats(filtered);
    return NextResponse.json({
      rows: filtered,
      total: filtered.length,
      totalAll: all.length,
      stats,
    });
  } catch (e) {
    if (e instanceof SheetsConfigError) {
      return NextResponse.json(
        {
          error:
            e.message +
            " Silakan set environment variable atau hubungi pengelola sistem.",
        },
        { status: 500 },
      );
    }
    const message = e instanceof Error ? e.message : "Gagal memuat data.";
    return NextResponse.json(
      { error: `Gagal memuat data dari Spreadsheet: ${message}` },
      { status: 500 },
    );
  }
}
