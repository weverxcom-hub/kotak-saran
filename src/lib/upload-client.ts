import type { AttachmentRef } from "@/lib/sheets";

/**
 * Upload semua file terpilih ke /api/upload (satu request per file, paralel).
 * Dipanggil dari SaranForm/WhistleblowerForm tepat sebelum submit final.
 * Melempar Error dengan pesan Indonesia siap-tampil kalau salah satu file
 * gagal — Promise.all akan berhenti di kegagalan pertama.
 */
export async function uploadAttachments(files: File[]): Promise<AttachmentRef[]> {
  return Promise.all(
    files.map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Gagal upload ${file.name} (${res.status}).`);
      }
      const data = (await res.json()) as { ok: boolean; fileId: string; name: string };
      return { fileId: data.fileId, name: data.name };
    }),
  );
}
