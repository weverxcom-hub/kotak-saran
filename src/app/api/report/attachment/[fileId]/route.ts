import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Readable } from "node:stream";
import { getFileStream, DriveConfigError } from "@/lib/drive";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy stream lampiran ke admin yang sedang login — satu route dipakai
 * bareng oleh Kotak Saran & Whistleblower (Drive tidak peduli sheet mana
 * yang mereferensikan fileId). File Drive TIDAK publik (lihat lib/drive.ts);
 * ini satu-satunya jalan untuk membukanya, dan digerbangi cookie session
 * yang sama dengan /report.
 */
export async function GET(
  req: Request,
  { params }: { params: { fileId: string } },
) {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(session)) {
    return NextResponse.json({ error: "Tidak terotorisasi." }, { status: 401 });
  }
  const fileId = params.fileId?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "File ID tidak valid." }, { status: 400 });
  }
  try {
    const { stream, mimeType, name } = await getFileStream(fileId);
    const webStream = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof DriveConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Gagal mengambil lampiran.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
