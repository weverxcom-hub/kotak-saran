import { NextResponse } from "next/server";
import { UNIT_OPTIONS } from "@/lib/form-config";
import {
  WHISTLEBLOWER_CATEGORIES,
  type WhistleblowerPayload,
} from "@/lib/whistleblower-config";
import {
  appendWhistleblowerReport,
  SheetsConfigError,
  type AttachmentRef,
} from "@/lib/sheets";

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

function validate(input: unknown): WhistleblowerPayload | { error: string } {
  if (!input || typeof input !== "object") return { error: "Body tidak valid." };
  const body = input as Record<string, unknown>;

  const saudaraAdalah = isString(body.saudaraAdalah)
    ? body.saudaraAdalah.trim()
    : "";
  if (!saudaraAdalah) return { error: "Field 'Saudara adalah' wajib diisi." };
  if (saudaraAdalah.length > 100)
    return { error: "Field 'Saudara adalah' terlalu panjang." };

  const unitKerja = isString(body.unitKerja) ? body.unitKerja.trim() : "";
  if (!UNIT_OPTIONS.includes(unitKerja as (typeof UNIT_OPTIONS)[number])) {
    return { error: "Unit kerja tidak valid." };
  }

  const kategori = isString(body.kategori) ? body.kategori.trim() : "";
  if (
    !WHISTLEBLOWER_CATEGORIES.includes(
      kategori as (typeof WHISTLEBLOWER_CATEGORIES)[number],
    )
  ) {
    return { error: "Kategori pelanggaran tidak valid." };
  }

  const isAnonim =
    body.isAnonim === "Ya" ? "Ya" : body.isAnonim === "Tidak" ? "Tidak" : null;
  if (!isAnonim) return { error: "Pilihan anonim wajib diisi." };

  const detail = isString(body.detail) ? body.detail.trim() : "";
  if (detail.length < 30) {
    return {
      error:
        "Detail pelaporan minimal 30 karakter — tuliskan apa yang terjadi sejelas mungkin.",
    };
  }
  if (detail.length > 5000)
    return { error: "Detail pelaporan maksimal 5000 karakter." };

  const nama = isString(body.nama) ? body.nama.trim() : "";
  const nim = isString(body.nim) ? body.nim.trim() : "";
  const kontak = isString(body.kontak) ? body.kontak.trim() : "";
  const kronologi = isString(body.kronologi) ? body.kronologi.trim() : "";
  const pihakTerlibat = isString(body.pihakTerlibat)
    ? body.pihakTerlibat.trim()
    : "";

  if (isAnonim === "Tidak" && !nama) {
    return { error: "Nama wajib diisi jika tidak anonim." };
  }

  if (nama.length > 200) return { error: "Nama terlalu panjang." };
  if (nim.length > 60) return { error: "NIM/NIP terlalu panjang." };
  if (kontak.length > 100) return { error: "Kontak terlalu panjang." };
  if (kronologi.length > 5000)
    return { error: "Kronologi terlalu panjang (maks 5000 karakter)." };
  if (pihakTerlibat.length > 500)
    return { error: "Pihak terlibat terlalu panjang." };

  const lampiran = validateLampiran(body.lampiran);
  if ("error" in lampiran) return lampiran;

  return {
    saudaraAdalah,
    unitKerja: unitKerja as (typeof UNIT_OPTIONS)[number],
    kategori: kategori as (typeof WHISTLEBLOWER_CATEGORIES)[number],
    pihakTerlibat: pihakTerlibat || undefined,
    isAnonim,
    nama: nama || undefined,
    nim: nim || undefined,
    kontak: kontak || undefined,
    detail,
    kronologi: kronologi || undefined,
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
    const { caseId, timestamp } = await appendWhistleblowerReport({
      saudaraAdalah: validated.saudaraAdalah,
      unitKerja: validated.unitKerja,
      kategori: validated.kategori,
      pihakTerlibat: validated.pihakTerlibat,
      isAnonim: validated.isAnonim,
      nama: validated.nama,
      nim: validated.nim,
      kontak: validated.kontak,
      detail: validated.detail,
      kronologi: validated.kronologi,
      lampiran: validated.lampiran,
    });
    return NextResponse.json({ ok: true, caseId, timestamp });
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
      { error: `Gagal menyimpan laporan: ${message}` },
      { status: 502 },
    );
  }
}
