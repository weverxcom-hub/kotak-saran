import { NextResponse } from "next/server";
import { ROLE_OPTIONS, UNIT_OPTIONS, type SuggestionPayload } from "@/lib/form-config";
import { appendSubmission, SheetsConfigError, type AttachmentRef } from "@/lib/sheets";

export const runtime = "nodejs";

const MAX_LAMPIRAN = 3;

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validateLampiran(input: unknown): AttachmentRef[] | { error: string } {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return { error: "Format lampiran tidak valid." };
  if (input.length > MAX_LAMPIRAN) {
    return { error: `Maksimal ${MAX_LAMPIRAN} lampiran per pengiriman.` };
  }
  const out: AttachmentRef[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return { error: "Format lampiran tidak valid." };
    const obj = item as Record<string, unknown>;
    const name = isString(obj.name) ? obj.name.trim() : "";
    const fileId = isString(obj.fileId) ? obj.fileId.trim() : "";
    if (!fileId || !name || name.length > 200 || fileId.length > 200) {
      return { error: "Format lampiran tidak valid." };
    }
    out.push({ name, fileId });
  }
  return out;
}

function validate(input: unknown): SuggestionPayload | { error: string } {
  if (!input || typeof input !== "object") return { error: "Body tidak valid." };
  const body = input as Record<string, unknown>;

  const saudaraAdalah = isString(body.saudaraAdalah)
    ? body.saudaraAdalah.trim()
    : "";
  if (!saudaraAdalah) return { error: "Field 'Saudara adalah' wajib diisi." };

  const unitKerja = isString(body.unitKerja) ? body.unitKerja.trim() : "";
  if (!UNIT_OPTIONS.includes(unitKerja as (typeof UNIT_OPTIONS)[number])) {
    return { error: "Unit kerja tidak valid." };
  }

  const isAnonim = body.isAnonim === "Ya" ? "Ya" : body.isAnonim === "Tidak" ? "Tidak" : null;
  if (!isAnonim) return { error: "Pilihan anonim wajib diisi." };

  const masukan = isString(body.masukan) ? body.masukan.trim() : "";
  if (masukan.length < 10) {
    return { error: "Masukan/saran minimal 10 karakter." };
  }
  if (masukan.length > 5000) {
    return { error: "Masukan/saran maksimal 5000 karakter." };
  }

  const nama = isString(body.nama) ? body.nama.trim() : "";
  const nim = isString(body.nim) ? body.nim.trim() : "";
  const kronologi = isString(body.kronologi) ? body.kronologi.trim() : "";
  const kontak = isString(body.kontak) ? body.kontak.trim() : "";

  if (isAnonim === "Tidak" && !nama) {
    return { error: "Nama wajib diisi jika tidak anonim." };
  }

  // Sanity checks
  if (nama.length > 200) return { error: "Nama terlalu panjang." };
  if (nim.length > 60) return { error: "NIM/NIDN/NIS terlalu panjang." };
  if (kronologi.length > 5000)
    return { error: "Kronologi terlalu panjang (maks 5000 karakter)." };
  if (kontak.length > 60) return { error: "Nomor kontak terlalu panjang." };

  // Allow free-text saudaraAdalah selain ROLE_OPTIONS (sesuai semula).
  void ROLE_OPTIONS;

  const lampiran = validateLampiran(body.lampiran);
  if ("error" in lampiran) return lampiran;

  return {
    saudaraAdalah,
    unitKerja: unitKerja as (typeof UNIT_OPTIONS)[number],
    isAnonim,
    nama,
    nim,
    masukan,
    kronologi,
    kontak,
    lampiran,
  };
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
  }

  const validated = validate(json);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const { trackingId, timestamp } = await appendSubmission({
      saudaraAdalah: validated.saudaraAdalah,
      unitKerja: validated.unitKerja,
      isAnonim: validated.isAnonim,
      nama: validated.nama,
      nim: validated.nim,
      masukan: validated.masukan,
      kronologi: validated.kronologi,
      kontak: validated.kontak,
      lampiran: validated.lampiran,
    });
    return NextResponse.json({ ok: true, trackingId, timestamp });
  } catch (err) {
    if (err instanceof SheetsConfigError) {
      return NextResponse.json(
        {
          error:
            err.message +
            " Hubungi pengelola sistem untuk konfigurasi spreadsheet.",
        },
        { status: 500 },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan ke spreadsheet.";
    return NextResponse.json(
      { error: `Gagal menyimpan ke Spreadsheet: ${message}` },
      { status: 502 },
    );
  }
}
