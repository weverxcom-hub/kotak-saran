import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateWhistleblowerStatus, SheetsConfigError } from "@/lib/sheets";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { isValidStatus } from "@/lib/status-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATATAN_MAX = 2000;

export async function POST(req: Request) {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(session)) {
    return NextResponse.json({ error: "Tidak terotorisasi." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
  }
  const body = (json ?? {}) as Record<string, unknown>;

  const rowIndex = Number(body.rowIndex);
  if (!Number.isInteger(rowIndex) || rowIndex < 2) {
    return NextResponse.json({ error: "rowIndex tidak valid." }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
  }
  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  if (catatan.length > CATATAN_MAX) {
    return NextResponse.json(
      { error: `Catatan maksimal ${CATATAN_MAX} karakter.` },
      { status: 400 },
    );
  }

  try {
    const { terakhirDiupdate } = await updateWhistleblowerStatus(
      rowIndex,
      status,
      catatan,
    );
    return NextResponse.json({ ok: true, terakhirDiupdate });
  } catch (err) {
    if (err instanceof SheetsConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Gagal update status.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
