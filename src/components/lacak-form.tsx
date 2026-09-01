"use client";

import * as React from "react";
import { Search, Loader2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/report/status-badge";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | {
      kind: "found";
      trackingId: string;
      status: string;
      catatanAdmin: string;
      submittedAt: string;
      updatedAt: string;
      kategori?: string;
    };

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

/** Form + hasil cek status publik — dipakai di /lacak. Tanpa login, tanpa PII. */
export function LacakForm() {
  const [code, setCode] = React.useState("");
  const [state, setState] = React.useState<LookupState>({ kind: "idle" });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/lacak?code=${encodeURIComponent(trimmed)}`);
      const data = (await res.json().catch(() => null)) as
        | { error?: string; found?: boolean; [key: string]: unknown }
        | null;
      if (!res.ok) {
        setState({
          kind: "error",
          message: data?.error ?? `Gagal memeriksa (${res.status}).`,
        });
        return;
      }
      if (!data?.found) {
        setState({ kind: "not-found" });
        return;
      }
      setState({
        kind: "found",
        trackingId: data.trackingId as string,
        status: data.status as string,
        catatanAdmin: data.catatanAdmin as string,
        submittedAt: data.submittedAt as string,
        updatedAt: data.updatedAt as string,
        kategori: data.kategori as string | undefined,
      });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Tidak dapat terhubung ke server.",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Search className="h-5 w-5" />
      </div>
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
        Cek Status Masukan / Laporan
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Masukkan kode tracking yang Anda terima setelah mengirim masukan (format{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">KS-…</code>) atau
        laporan whistleblower (
        <code className="rounded bg-muted px-1 py-0.5 text-xs">WB-…</code>).
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="contoh: KS-20260901-A1B2C3"
          className="flex-1 uppercase placeholder:normal-case"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button
          type="submit"
          variant="gradient"
          disabled={state.kind === "loading" || !code.trim()}
        >
          {state.kind === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Cek
        </Button>
      </form>

      <div className="mt-6">
        {state.kind === "error" ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.message}</span>
          </div>
        ) : null}

        {state.kind === "not-found" ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Kode tidak ditemukan. Pastikan kode disalin dengan benar dari
              halaman/email konfirmasi sebelumnya.
            </span>
          </div>
        ) : null}

        {state.kind === "found" ? (
          <div className="space-y-4 rounded-xl border border-border bg-background/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="text-base font-bold tracking-wider text-foreground">
                {state.trackingId}
              </code>
              <StatusBadge status={state.status} />
            </div>
            {state.kategori ? (
              <p className="text-sm text-muted-foreground">
                Kategori: <span className="text-foreground">{state.kategori}</span>
              </p>
            ) : null}
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Dikirim: {formatDateTime(state.submittedAt)}</span>
              {state.updatedAt ? (
                <span>Terakhir diupdate: {formatDateTime(state.updatedAt)}</span>
              ) : null}
            </div>
            {state.catatanAdmin ? (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  Catatan dari pengelola
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {state.catatanAdmin}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada catatan tambahan dari pengelola.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
