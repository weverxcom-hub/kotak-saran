import { NextResponse } from "next/server";
import { lookupTrackingCode, SheetsConfigError } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint publik (tanpa auth) untuk cek status pakai Tracking ID / Case ID.
 * Response SENGAJA minim — tidak ada field PII apa pun (nama/nim/kontak/isi
 * masukan/lampiran), cuma status + catatan yang memang ditulis admin untuk
 * ditampilkan publik. Lihat lib/sheets.ts `lookupTrackingCode`.
 */
const CODE_PATTERN = /^(KS|WB)-\d{8}-[A-Z0-9]{4,6}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("code") ?? "";
  const code = raw.trim().toUpperCase();

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      {
        error:
          "Format kode tidak valid. Contoh: KS-20260901-A1B2C3 atau WB-20260901-A1B2C3.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await lookupTrackingCode(code);
    if (!result) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json({ found: true, ...result });
  } catch (err) {
    if (err instanceof SheetsConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Gagal memeriksa status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
