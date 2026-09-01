"use client";

import * as React from "react";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { STATUS_OPTIONS } from "@/lib/status-config";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Editor status + catatan tindak lanjut, dipasang di detail panel baris
 * dashboard (ReportDashboard & WhistleblowerDashboard). `endpoint` beda
 * per flow (/api/report/update-status vs .../whistleblower/update-status).
 *
 * PENTING: catatan di sini TAMPIL PUBLIK ke pengirim lewat halaman /lacak —
 * label & hint di bawah sengaja eksplisit soal ini supaya admin tidak
 * salah kira ini catatan internal.
 */
export function StatusEditor({
  endpoint,
  rowIndex,
  currentStatus,
  currentCatatan,
  onSaved,
}: {
  endpoint: string;
  rowIndex: number;
  currentStatus: string;
  currentCatatan: string;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState(currentStatus);
  const [catatan, setCatatan] = React.useState(currentCatatan);
  const [save, setSave] = React.useState<SaveState>({ kind: "idle" });

  // Sinkron ulang kalau data dari server berubah (mis. setelah refetch list
  // atau baris lain diklik lalu balik lagi).
  React.useEffect(() => {
    setStatus(currentStatus);
    setCatatan(currentCatatan);
    setSave({ kind: "idle" });
  }, [currentStatus, currentCatatan]);

  const dirty = status !== currentStatus || catatan !== currentCatatan;

  const onSave = async () => {
    setSave({ kind: "saving" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, status, catatan }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSave({
          kind: "error",
          message: data?.error ?? `Gagal simpan (${res.status}).`,
        });
        return;
      }
      setSave({ kind: "saved" });
      onSaved();
    } catch (err) {
      setSave({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Tidak dapat terhubung ke server.",
      });
    }
  };

  return (
    <div
      className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Tindak Lanjut (Admin)
      </p>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <Label htmlFor={`status-${rowIndex}`} className="mb-1.5 block text-xs">
            Status
          </Label>
          <Select
            id={`status-${rowIndex}`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`catatan-${rowIndex}`} className="mb-1.5 block text-xs">
            Catatan untuk pelapor{" "}
            <span className="font-normal normal-case text-muted-foreground">
              — tampil publik saat mereka cek status di /lacak
            </span>
          </Label>
          <Textarea
            id={`catatan-${rowIndex}`}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: Sudah kami teruskan ke unit terkait, mohon menunggu."
            rows={2}
            maxLength={2000}
            className="min-h-0"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="gradient"
          onClick={onSave}
          disabled={!dirty || save.kind === "saving"}
        >
          {save.kind === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan tindak lanjut
        </Button>
        {save.kind === "saved" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan
          </span>
        ) : null}
        {save.kind === "error" ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {save.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
