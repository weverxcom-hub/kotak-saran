"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Send,
  EyeOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FileUploadField } from "@/components/file-upload-field";
import { uploadAttachments } from "@/lib/upload-client";
import {
  ROLE_OPTIONS,
  UNIT_OPTIONS,
  type AnonimChoice,
} from "@/lib/form-config";
import {
  WHISTLEBLOWER_CATEGORIES,
  type WhistleblowerCategory,
} from "@/lib/whistleblower-config";
import { cn } from "@/lib/utils";

type FormState = {
  saudaraAdalah: string;
  saudaraOther: string;
  unitKerja: string;
  kategori: WhistleblowerCategory | "";
  pihakTerlibat: string;
  isAnonim: AnonimChoice;
  nama: string;
  nim: string;
  kontak: string;
  detail: string;
  kronologi: string;
  setuju: boolean;
};

const INITIAL_STATE: FormState = {
  saudaraAdalah: "",
  saudaraOther: "",
  unitKerja: "",
  kategori: "",
  pihakTerlibat: "",
  isAnonim: "Ya", // default anonim ON
  nama: "",
  nim: "",
  kontak: "",
  detail: "",
  kronologi: "",
  setuju: false,
};

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

const DETAIL_MIN = 30;
const DETAIL_MAX = 5000;
const KRONOLOGI_MAX = 5000;

export function WhistleblowerForm() {
  const router = useRouter();
  const [state, setState] = React.useState<FormState>(INITIAL_STATE);
  const [lampiranFiles, setLampiranFiles] = React.useState<File[]>([]);
  const [status, setStatus] = React.useState<SubmitStatus>({ kind: "idle" });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const role =
    state.saudaraAdalah === "Other"
      ? state.saudaraOther.trim()
      : state.saudaraAdalah;

  const validateClient = (): { ok: true } | { ok: false; message: string } => {
    if (!role) return { ok: false, message: "Pilih peran Anda." };
    if (!state.unitKerja)
      return { ok: false, message: "Pilih unit kerja / prodi." };
    if (!state.kategori)
      return { ok: false, message: "Pilih kategori pelanggaran." };
    if (state.isAnonim === "Tidak" && !state.nama.trim())
      return { ok: false, message: "Nama wajib diisi jika memilih identitas." };
    if (state.detail.trim().length < DETAIL_MIN)
      return {
        ok: false,
        message: `Detail pelaporan minimal ${DETAIL_MIN} karakter.`,
      };
    if (!state.setuju)
      return {
        ok: false,
        message: "Anda harus menyetujui pernyataan kebenaran laporan.",
      };
    return { ok: true };
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const check = validateClient();
    if (!check.ok) {
      setStatus({ kind: "error", message: check.message });
      return;
    }

    let lampiran: Array<{ name: string; fileId: string }> | undefined;
    if (lampiranFiles.length > 0) {
      setStatus({ kind: "uploading" });
      try {
        lampiran = await uploadAttachments(lampiranFiles);
      } catch (err) {
        setStatus({
          kind: "error",
          message:
            err instanceof Error
              ? `Gagal upload lampiran: ${err.message}`
              : "Gagal upload lampiran.",
        });
        return;
      }
    }

    setStatus({ kind: "submitting" });
    try {
      const payload = {
        saudaraAdalah: role,
        unitKerja: state.unitKerja,
        kategori: state.kategori,
        pihakTerlibat: state.pihakTerlibat.trim() || undefined,
        isAnonim: state.isAnonim,
        nama: state.isAnonim === "Tidak" ? state.nama.trim() : undefined,
        nim:
          state.isAnonim === "Tidak"
            ? state.nim.trim() || undefined
            : undefined,
        kontak:
          state.isAnonim === "Tidak"
            ? state.kontak.trim() || undefined
            : undefined,
        detail: state.detail.trim(),
        kronologi: state.kronologi.trim() || undefined,
        lampiran,
      };
      const res = await fetch("/api/whistleblower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setStatus({
          kind: "error",
          message: data?.error ?? `Gagal mengirim (${res.status}).`,
        });
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        caseId: string;
        timestamp: string;
      };
      router.push(
        `/whistleblower/terimakasih?case=${encodeURIComponent(data.caseId)}`,
      );
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Tidak dapat terhubung ke server.",
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Disclaimer / warning banner */}
      <div className="flex gap-3 rounded-xl border border-rose-300/60 bg-rose-50/80 p-4 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
        <div className="space-y-1">
          <p className="font-semibold">Pernyataan kerahasiaan & tanggung jawab</p>
          <p>
            Identitas pelapor (jika mengisi nama) dilindungi dan hanya diakses
            oleh tim Komisi Etik / SPI Fakultas. Laporan palsu yang sengaja
            menyesatkan dapat dikenakan sanksi etik / hukum sesuai peraturan
            yang berlaku.
          </p>
        </div>
      </div>

      {/* Section 1: Pelapor */}
      <fieldset className="space-y-4 rounded-xl border border-border bg-card/60 p-5">
        <legend className="px-2 text-sm font-semibold text-foreground">
          1. Tentang Anda
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="wb-role" className="mb-2 block">
              Saudara adalah <span className="text-rose-600">*</span>
            </Label>
            <Select
              id="wb-role"
              value={state.saudaraAdalah}
              onChange={(e) => update("saudaraAdalah", e.target.value)}
            >
              <option value="">— Pilih peran —</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Other">Lainnya</option>
            </Select>
            {state.saudaraAdalah === "Other" ? (
              <Input
                className="mt-2"
                placeholder="Tuliskan peran Anda"
                value={state.saudaraOther}
                onChange={(e) => update("saudaraOther", e.target.value)}
              />
            ) : null}
          </div>

          <div>
            <Label htmlFor="wb-unit" className="mb-2 block">
              Unit kerja / Prodi <span className="text-rose-600">*</span>
            </Label>
            <Select
              id="wb-unit"
              value={state.unitKerja}
              onChange={(e) => update("unitKerja", e.target.value)}
            >
              <option value="">— Pilih unit —</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </fieldset>

      {/* Section 2: Privasi */}
      <fieldset className="space-y-4 rounded-xl border border-border bg-card/60 p-5">
        <legend className="px-2 text-sm font-semibold text-foreground">
          2. Privasi pelapor
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => update("isAnonim", "Ya")}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 text-left transition",
              state.isAnonim === "Ya"
                ? "border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30 dark:bg-rose-500/10 dark:text-rose-50"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Anonim (direkomendasikan)</p>
              <p className="mt-0.5 text-xs opacity-80">
                Identitas Anda tidak disertakan. Tim hanya menerima laporan.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => update("isAnonim", "Tidak")}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 text-left transition",
              state.isAnonim === "Tidak"
                ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <Eye className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Sertakan identitas</p>
              <p className="mt-0.5 text-xs opacity-80">
                Tim dapat menghubungi Anda untuk klarifikasi. Tetap rahasia.
              </p>
            </div>
          </button>
        </div>

        {state.isAnonim === "Tidak" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wb-nama" className="mb-2 block">
                Nama lengkap <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="wb-nama"
                value={state.nama}
                onChange={(e) => update("nama", e.target.value)}
                placeholder="Nama lengkap Anda"
              />
            </div>
            <div>
              <Label htmlFor="wb-nim" className="mb-2 block">
                NIM / NIP / NIDN
              </Label>
              <Input
                id="wb-nim"
                value={state.nim}
                onChange={(e) => update("nim", e.target.value)}
                placeholder="opsional"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="wb-kontak" className="mb-2 block">
                Kontak (email / WA)
              </Label>
              <Input
                id="wb-kontak"
                value={state.kontak}
                onChange={(e) => update("kontak", e.target.value)}
                placeholder="opsional, untuk klarifikasi lanjutan"
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      {/* Section 3: Laporan */}
      <fieldset className="space-y-4 rounded-xl border border-border bg-card/60 p-5">
        <legend className="px-2 text-sm font-semibold text-foreground">
          3. Detail pelaporan
        </legend>

        <div>
          <Label htmlFor="wb-kategori" className="mb-2 block">
            Kategori pelanggaran <span className="text-rose-600">*</span>
          </Label>
          <Select
            id="wb-kategori"
            value={state.kategori}
            onChange={(e) =>
              update("kategori", e.target.value as WhistleblowerCategory | "")
            }
          >
            <option value="">— Pilih kategori —</option>
            {WHISTLEBLOWER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="wb-pihak" className="mb-2 block">
            Pihak yang terlibat
          </Label>
          <Input
            id="wb-pihak"
            value={state.pihakTerlibat}
            onChange={(e) => update("pihakTerlibat", e.target.value)}
            placeholder="Nama / inisial / jabatan (opsional)"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Tuliskan jika Anda mengetahui — boleh inisial / jabatan saja.
          </p>
        </div>

        <div>
          <Label htmlFor="wb-detail" className="mb-2 block">
            Detail pelaporan <span className="text-rose-600">*</span>
          </Label>
          <Textarea
            id="wb-detail"
            value={state.detail}
            onChange={(e) => update("detail", e.target.value)}
            placeholder="Apa yang terjadi? Sejelas mungkin."
            rows={5}
            maxLength={DETAIL_MAX}
          />
          <p className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Minimal {DETAIL_MIN} karakter.</span>
            <span>
              {state.detail.length} / {DETAIL_MAX}
            </span>
          </p>
        </div>

        <div>
          <Label htmlFor="wb-kronologi" className="mb-2 block">
            Kronologi & bukti pendukung
          </Label>
          <Textarea
            id="wb-kronologi"
            value={state.kronologi}
            onChange={(e) => update("kronologi", e.target.value)}
            placeholder="Kapan, di mana, urutan kejadian. Sebutkan jika ada bukti foto / dokumen / saksi (opsional)."
            rows={4}
            maxLength={KRONOLOGI_MAX}
          />
        </div>

        <FileUploadField
          files={lampiranFiles}
          onChange={setLampiranFiles}
          label="Lampiran bukti (opsional)"
          hint="Foto atau dokumen pendukung — JPG, PNG, WEBP, atau PDF, maks 4MB/file."
        />
        <p className="text-xs text-muted-foreground">
          Untuk bukti berformat lain (video, dsb.) yang tidak bisa diupload di
          sini, bisa dikirim menyusul ke email pengelola dengan menyertakan{" "}
          <strong>Case ID</strong> yang akan Anda terima setelah kirim.
        </p>
      </fieldset>

      {/* Section 4: Pernyataan */}
      <fieldset className="space-y-3 rounded-xl border border-border bg-card/60 p-5">
        <legend className="px-2 text-sm font-semibold text-foreground">
          4. Pernyataan
        </legend>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.setuju}
            onChange={(e) => update("setuju", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span className="text-foreground">
            Saya menyatakan bahwa informasi yang saya laporkan ini{" "}
            <strong>benar dan dapat dipertanggungjawabkan</strong>. Saya
            memahami bahwa laporan palsu dapat berkonsekuensi etik / hukum.
          </span>
        </label>
      </fieldset>

      {/* Error */}
      {status.kind === "error" ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={status.kind === "submitting" || status.kind === "uploading"}
        className="w-full bg-rose-600 text-white hover:bg-rose-700 sm:w-auto"
      >
        {status.kind === "uploading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengupload lampiran…
          </>
        ) : status.kind === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim laporan…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Kirim Laporan
          </>
        )}
      </Button>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
        Setelah dikirim, Anda akan mendapatkan <strong>Case ID</strong> — simpan
        baik-baik untuk follow-up.
      </p>
    </form>
  );
}
