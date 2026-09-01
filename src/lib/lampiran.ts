/**
 * Parsing/serialisasi kolom "Lampiran" (Kotak Saran & Whistleblower) —
 * sengaja dipisah dari lib/sheets.ts (yang mengimpor `googleapis`, Node-only)
 * supaya bisa diimpor dengan aman dari komponen client (dashboard admin)
 * tanpa menyeret googleapis ke bundle browser. Tidak menyimpan URL publik —
 * cuma nama file asli + Google Drive file ID (lihat lib/drive.ts untuk
 * kenapa file tidak dibuat publik).
 */

export type AttachmentRef = { name: string; fileId: string };

/** Format: satu baris per file, "nama-file :: driveFileId". */
export function serializeLampiran(items: AttachmentRef[]): string {
  return items
    .filter((a) => a.fileId)
    .map((a) => `${a.name} :: ${a.fileId}`)
    .join("\n");
}

export function parseLampiran(raw: string): AttachmentRef[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf("::");
      if (idx === -1) return { name: line, fileId: "" };
      return { name: line.slice(0, idx).trim(), fileId: line.slice(idx + 2).trim() };
    })
    .filter((a) => a.fileId);
}
