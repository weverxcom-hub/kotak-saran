"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  EyeOff,
  Eye,
  GraduationCap,
  Briefcase,
  Users,
  Building2,
  Calculator,
  TrendingUp,
  ScrollText,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  PartyPopper,
  Home,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { OptionCard } from "@/components/option-card";
import { ProgressSteps, type Step } from "@/components/progress-steps";
import { FileUploadField } from "@/components/file-upload-field";
import { CaseIdCopy } from "@/components/case-id-copy";
import { uploadAttachments } from "@/lib/upload-client";
import {
  ROLE_OPTIONS,
  UNIT_OPTIONS,
  type AnonimChoice,
  type SuggestionPayload,
} from "@/lib/form-config";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { icon: React.ElementType; description: string }> = {
  DOSEN: { icon: GraduationCap, description: "Pengajar / dosen tetap maupun tidak tetap" },
  MAHASISWA: { icon: Users, description: "Mahasiswa aktif FEB UNIGA" },
  TENDIK: { icon: Briefcase, description: "Tenaga kependidikan / staf" },
};

const UNIT_META: Record<string, { icon: React.ElementType; description: string }> = {
  "FAKULTAS EKONOMI DAN BISNIS": {
    icon: Building2,
    description: "Layanan tingkat fakultas",
  },
  MANAJEMEN: { icon: TrendingUp, description: "Program Studi Manajemen" },
  AKUNTANSI: { icon: Calculator, description: "Program Studi Akuntansi" },
  "EKONOMI PEMBANGUNAN": {
    icon: ScrollText,
    description: "Program Studi Ekonomi Pembangunan",
  },
};

const STEPS: Step[] = [
  { id: 1, title: "Tentang Anda" },
  { id: 2, title: "Privasi" },
  { id: 3, title: "Masukan" },
  { id: 4, title: "Tinjau & Kirim" },
];

type FormState = {
  saudaraAdalah: string;
  saudaraOther: string;
  unitKerja: string;
  isAnonim: AnonimChoice | "";
  nama: string;
  nim: string;
  masukan: string;
  kronologi: string;
  kontak: string;
};

const INITIAL_STATE: FormState = {
  saudaraAdalah: "",
  saudaraOther: "",
  unitKerja: "",
  isAnonim: "",
  nama: "",
  nim: "",
  masukan: "",
  kronologi: "",
  kontak: "",
};

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function SaranForm() {
  const [step, setStep] = React.useState(1);
  const [state, setState] = React.useState<FormState>(INITIAL_STATE);
  const [lampiranFiles, setLampiranFiles] = React.useState<File[]>([]);
  const [status, setStatus] = React.useState<SubmitStatus>({ kind: "idle" });
  const [trackingId, setTrackingId] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const canProceed = (s: number): { ok: boolean; message?: string } => {
    if (s === 1) {
      const role = state.saudaraAdalah === "Other"
        ? state.saudaraOther.trim()
        : state.saudaraAdalah;
      if (!role) return { ok: false, message: "Pilih peran Anda terlebih dulu." };
      if (!state.unitKerja)
        return { ok: false, message: "Pilih unit kerja / prodi Anda." };
    }
    if (s === 2) {
      if (!state.isAnonim)
        return { ok: false, message: "Pilih ingin anonim atau tidak." };
      if (state.isAnonim === "Tidak" && !state.nama.trim())
        return { ok: false, message: "Nama wajib diisi jika tidak anonim." };
    }
    if (s === 3) {
      if (state.masukan.trim().length < 10)
        return {
          ok: false,
          message: "Masukan minimal 10 karakter agar dapat ditindaklanjuti.",
        };
    }
    return { ok: true };
  };

  const goNext = () => {
    const check = canProceed(step);
    if (!check.ok) {
      setStatus({ kind: "error", message: check.message ?? "" });
      return;
    }
    setStatus({ kind: "idle" });
    setStep((s) => Math.min(STEPS.length, s + 1));
    requestAnimationFrame(() =>
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const goBack = () => {
    setStatus({ kind: "idle" });
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async () => {
    const finalRole =
      state.saudaraAdalah === "Other"
        ? state.saudaraOther.trim()
        : state.saudaraAdalah;

    let lampiran: SuggestionPayload["lampiran"];
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
    const payload: SuggestionPayload = {
      saudaraAdalah: finalRole,
      unitKerja: state.unitKerja as SuggestionPayload["unitKerja"],
      isAnonim: state.isAnonim || "Tidak",
      nama: state.isAnonim === "Tidak" ? state.nama.trim() : undefined,
      nim: state.isAnonim === "Tidak" ? state.nim.trim() || undefined : undefined,
      masukan: state.masukan.trim(),
      kronologi: state.kronologi.trim() || undefined,
      kontak: state.kontak.trim() || undefined,
      lampiran,
    };
    try {
      const res = await fetch("/api/saran", {
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
          message:
            data?.error ?? "Gagal mengirim. Silakan coba lagi sebentar.",
        });
        return;
      }
      const data = (await res.json()) as { ok: boolean; trackingId?: string };
      setTrackingId(data.trackingId ?? null);
      setStatus({ kind: "success" });
      setStep(5);
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error
            ? `Tidak dapat terhubung: ${err.message}`
            : "Tidak dapat terhubung ke server.",
      });
    }
  };

  const reset = () => {
    setState(INITIAL_STATE);
    setLampiranFiles([]);
    setTrackingId(null);
    setStatus({ kind: "idle" });
    setStep(1);
  };

  if (step === 5)
    return <SuccessScreen onReset={reset} state={state} trackingId={trackingId} />;

  return (
    <div ref={containerRef} className="w-full">
      <div className="mb-6 sm:mb-8">
        <ProgressSteps steps={STEPS} current={step} />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5">
        <div
          key={step}
          className="animate-fade-in-up px-5 py-6 sm:px-8 sm:py-8"
        >
          {step === 1 ? <StepTentangAnda state={state} update={update} /> : null}
          {step === 2 ? <StepPrivasi state={state} update={update} /> : null}
          {step === 3 ? (
            <StepMasukan
              state={state}
              update={update}
              lampiranFiles={lampiranFiles}
              onLampiranChange={setLampiranFiles}
            />
          ) : null}
          {step === 4 ? (
            <StepTinjau state={state} lampiranCount={lampiranFiles.length} />
          ) : null}
        </div>

        {status.kind === "error" ? (
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:mx-8">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{status.message}</span>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={
              step === 1 || status.kind === "submitting" || status.kind === "uploading"
            }
            className="sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          {step < STEPS.length ? (
            <Button
              type="button"
              variant="gradient"
              onClick={goNext}
              size="lg"
              className="sm:w-auto"
            >
              Lanjutkan
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="gradient"
              size="lg"
              onClick={submit}
              disabled={status.kind === "submitting" || status.kind === "uploading"}
              className="sm:w-auto"
            >
              {status.kind === "uploading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengupload lampiran…
                </>
              ) : status.kind === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Kirim Masukan
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        {icon}
        <span>Langkah</span>
      </div>
      <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function StepTentangAnda({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionTitle
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Beri tahu kami sedikit tentang Anda"
        description="Informasi ini membantu kami memilah masukan dari berbagai kelompok sivitas akademika."
      />

      <div>
        <Label className="mb-3 block">
          Saudara adalah <span className="text-destructive">*</span>
        </Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLE_OPTIONS.map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta?.icon ?? Users;
            return (
              <OptionCard
                key={role}
                label={role}
                description={meta?.description}
                icon={<Icon className="h-5 w-5" />}
                selected={state.saudaraAdalah === role}
                onClick={() => update("saudaraAdalah", role)}
              />
            );
          })}
        </div>
        <div className="mt-2">
          <OptionCard
            size="sm"
            label="Lainnya"
            description="Sebutkan peran Anda di kolom yang muncul"
            selected={state.saudaraAdalah === "Other"}
            onClick={() => update("saudaraAdalah", "Other")}
          />
          {state.saudaraAdalah === "Other" ? (
            <Input
              className="mt-2"
              placeholder="Sebutkan peran Anda…"
              value={state.saudaraOther}
              onChange={(e) => update("saudaraOther", e.target.value)}
              maxLength={100}
            />
          ) : null}
        </div>
      </div>

      <div>
        <Label className="mb-3 block">
          Unit kerja atau program studi Anda{" "}
          <span className="text-destructive">*</span>
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {UNIT_OPTIONS.map((unit) => {
            const meta = UNIT_META[unit];
            const Icon = meta?.icon ?? Building2;
            return (
              <OptionCard
                key={unit}
                label={unit}
                description={meta?.description}
                icon={<Icon className="h-5 w-5" />}
                selected={state.unitKerja === unit}
                onClick={() => update("unitKerja", unit)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepPrivasi({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-7">
      <SectionTitle
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        title="Privasi & identitas Anda"
        description="Identitas responden bersifat opsional dan dijamin kerahasiaannya. Pilih cara penyampaian masukan Anda."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          label="Tetap dengan identitas saya"
          description="Tim FEB dapat menghubungi balik untuk klarifikasi atau update tindak lanjut."
          icon={<Eye className="h-5 w-5" />}
          selected={state.isAnonim === "Tidak"}
          onClick={() => update("isAnonim", "Tidak")}
        />
        <OptionCard
          label="Sampaikan secara anonim"
          description="Identitas tidak dicatat. Cocok untuk masukan sensitif."
          icon={<EyeOff className="h-5 w-5" />}
          selected={state.isAnonim === "Ya"}
          onClick={() => update("isAnonim", "Ya")}
        />
      </div>

      {state.isAnonim === "Tidak" ? (
        <div className="animate-fade-in space-y-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            Identitas
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nama" className="mb-1.5 block">
                Nama lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nama"
                placeholder="contoh: Aditya Pratama"
                value={state.nama}
                onChange={(e) => update("nama", e.target.value)}
                maxLength={150}
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="nim" className="mb-1.5 block">
                NIM / NIDN / NIS{" "}
                <span className="text-muted-foreground font-normal">(opsional)</span>
              </Label>
              <Input
                id="nim"
                placeholder="contoh: 220210020"
                value={state.nim}
                onChange={(e) => update("nim", e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
        </div>
      ) : null}

      {state.isAnonim === "Ya" ? (
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-4 text-sm text-foreground sm:p-5">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="space-y-1">
            <p className="font-medium">Mode anonim aktif</p>
            <p className="text-muted-foreground">
              Nama dan NIM tidak akan diminta. Namun kami tetap menghargai jika Anda
              menyertakan kontak (opsional) di langkah berikutnya untuk konfirmasi
              tindak lanjut tanpa membongkar identitas.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepMasukan({
  state,
  update,
  lampiranFiles,
  onLampiranChange,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  lampiranFiles: File[];
  onLampiranChange: (files: File[]) => void;
}) {
  const masukanLen = state.masukan.length;
  const minOk = masukanLen >= 10;
  return (
    <div className="space-y-7">
      <SectionTitle
        icon={<Send className="h-3.5 w-3.5" />}
        title="Sampaikan masukan Anda"
        description="Tuliskan masukan, saran, kritik, atau keluhan terkait layanan akademik, non-akademik, dan sarana prasarana FEB UNIGA."
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="masukan">
            Masukan / saran / kritik / keluhan{" "}
            <span className="text-destructive">*</span>
          </Label>
          <span
            className={cn(
              "text-xs",
              minOk ? "text-success" : "text-muted-foreground",
            )}
          >
            {masukanLen} / 5000
          </span>
        </div>
        <Textarea
          id="masukan"
          placeholder="Sampaikan apa yang ingin Anda evaluasi atau usulkan…"
          value={state.masukan}
          onChange={(e) => update("masukan", e.target.value)}
          maxLength={5000}
          rows={5}
        />
        {!minOk ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Tulis minimal 10 karakter agar masukan dapat ditindaklanjuti.
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="kronologi" className="mb-1.5 block">
          Kronologi kejadian{" "}
          <span className="text-muted-foreground font-normal">(opsional)</span>
        </Label>
        <Textarea
          id="kronologi"
          placeholder="Ceritakan urutan kejadian atau konteks pendukung — kapan, di mana, siapa yang terlibat."
          value={state.kronologi}
          onChange={(e) => update("kronologi", e.target.value)}
          maxLength={5000}
          rows={4}
        />
      </div>

      <div>
        <Label htmlFor="kontak" className="mb-1.5 block">
          Nomor HP / WA untuk konfirmasi prodi{" "}
          <span className="text-muted-foreground font-normal">(opsional)</span>
        </Label>
        <Input
          id="kontak"
          inputMode="tel"
          placeholder="contoh: 0812-3456-7890"
          value={state.kontak}
          onChange={(e) => update("kontak", e.target.value)}
          maxLength={50}
          autoComplete="tel"
        />
      </div>

      <FileUploadField files={lampiranFiles} onChange={onLampiranChange} />
    </div>
  );
}

function StepTinjau({
  state,
  lampiranCount,
}: {
  state: FormState;
  lampiranCount: number;
}) {
  const role =
    state.saudaraAdalah === "Other" ? state.saudaraOther : state.saudaraAdalah;
  const items: Array<{ label: string; value?: string }> = [
    { label: "Saudara adalah", value: role },
    { label: "Unit kerja / prodi", value: state.unitKerja },
    { label: "Mode", value: state.isAnonim === "Ya" ? "Anonim" : "Identitas" },
  ];
  if (state.isAnonim === "Tidak") {
    items.push({ label: "Nama", value: state.nama });
    if (state.nim) items.push({ label: "NIM / NIDN / NIS", value: state.nim });
  }
  items.push({ label: "Masukan", value: state.masukan });
  if (state.kronologi) items.push({ label: "Kronologi", value: state.kronologi });
  if (state.kontak) items.push({ label: "Kontak", value: state.kontak });
  if (lampiranCount > 0)
    items.push({ label: "Lampiran", value: `${lampiranCount} file` });

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        title="Tinjau dan kirim"
        description="Periksa kembali ringkasan masukan Anda. Setelah dikirim, data akan tercatat di sistem FEB UNIGA Malang."
      />

      <ul className="divide-y divide-border rounded-xl border border-border bg-background">
        {items.map((it) => (
          <li
            key={it.label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4 sm:px-5"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {it.label}
            </span>
            <span className="whitespace-pre-wrap text-sm text-foreground">
              {it.value || "—"}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/[0.07] p-4 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="text-muted-foreground">
          Dengan menekan tombol <span className="font-medium text-foreground">Kirim Masukan</span>,
          Anda menyatakan bahwa informasi yang disampaikan benar adanya dan dapat
          digunakan oleh FEB UNIGA Malang sebagai dasar peningkatan kualitas layanan.
        </p>
      </div>
    </div>
  );
}

function SuccessScreen({
  onReset,
  state,
  trackingId,
}: {
  onReset: () => void;
  state: FormState;
  trackingId: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-xl shadow-success/10 sm:p-12">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
        <PartyPopper className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
        Terima kasih atas masukan Anda!
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-pretty text-muted-foreground">
        Masukan dari{" "}
        <span className="font-medium text-foreground">
          {state.isAnonim === "Ya" ? "responden anonim" : state.nama || "Anda"}
        </span>{" "}
        sudah kami terima dan akan menjadi pertimbangan dalam peningkatan kualitas
        layanan Fakultas Ekonomi dan Bisnis Universitas Gajayana Malang.
      </p>

      {trackingId ? (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border bg-background/60 p-4 text-left sm:p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Kode Tracking Anda
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <code className="text-lg font-bold tracking-wider text-foreground">
              {trackingId}
            </code>
            <CaseIdCopy caseId={trackingId} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Simpan kode ini untuk cek status tindak lanjut masukan Anda kapan saja
            di halaman{" "}
            <a href="/lacak" className="font-medium text-primary hover:underline">
              /lacak
            </a>
            .
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
        <Button onClick={onReset} variant="gradient" size="lg">
          <Send className="h-4 w-4" />
          Kirim masukan lain
        </Button>
        {trackingId ? (
          <Button asChild variant="outline" size="lg">
            <a href="/lacak">
              <Search className="h-4 w-4" />
              Cek status
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="lg">
          <a href="/">
            <Home className="h-4 w-4" />
            Kembali ke beranda
          </a>
        </Button>
      </div>
    </div>
  );
}
