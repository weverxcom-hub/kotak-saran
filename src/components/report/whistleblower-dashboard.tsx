"use client";

import * as React from "react";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Inbox,
  EyeOff,
  ShieldCheck,
  X,
  ShieldAlert,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/report/stat-card";
import { BreakdownList } from "@/components/report/breakdown-list";
import { TrendChart } from "@/components/report/trend-chart";
import { BreakdownChart } from "@/components/report/breakdown-chart";
import { StatusBadge } from "@/components/report/status-badge";
import { StatusEditor } from "@/components/report/status-editor";
import { AttachmentList } from "@/components/report/attachment-list";
import { UNIT_OPTIONS } from "@/lib/form-config";
import { WHISTLEBLOWER_CATEGORIES } from "@/lib/whistleblower-config";
import { STATUS_OPTIONS } from "@/lib/status-config";
import type { WhistleblowerRow, WhistleblowerStats } from "@/lib/sheets";
import { cn } from "@/lib/utils";

type Filters = {
  q: string;
  kategori: string;
  unit: string;
  mode: "all" | "Ya" | "Tidak";
  status: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  kategori: "all",
  unit: "all",
  mode: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      rows: WhistleblowerRow[];
      total: number;
      totalAll: number;
      stats: WhistleblowerStats;
    };

function buildQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.kategori !== "all") sp.set("kategori", f.kategori);
  if (f.unit !== "all") sp.set("unit", f.unit);
  if (f.mode !== "all") sp.set("mode", f.mode);
  if (f.status !== "all") sp.set("status", f.status);
  if (f.dateFrom) sp.set("dateFrom", f.dateFrom);
  if (f.dateTo) sp.set("dateTo", f.dateTo);
  return sp.toString();
}

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

function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function WhistleblowerDashboard() {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [pendingQ, setPendingQ] = React.useState("");
  const [load, setLoad] = React.useState<LoadState>({ kind: "idle" });
  const [openRow, setOpenRow] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === pendingQ ? f : { ...f, q: pendingQ }));
    }, 350);
    return () => clearTimeout(t);
  }, [pendingQ]);

  const fetchData = React.useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const qs = buildQuery(filters);
      const res = await fetch(
        `/api/report/whistleblower/list${qs ? `?${qs}` : ""}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setLoad({
          kind: "error",
          message: data?.error ?? `Gagal memuat data (${res.status}).`,
        });
        return;
      }
      const data = (await res.json()) as {
        rows: WhistleblowerRow[];
        total: number;
        totalAll: number;
        stats: WhistleblowerStats;
      };
      setLoad({
        kind: "ready",
        rows: data.rows,
        total: data.total,
        totalAll: data.totalAll,
        stats: data.stats,
      });
    } catch (err) {
      setLoad({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Tidak dapat terhubung ke server.",
      });
    }
  }, [filters]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onExportCSV = () => {
    const qs = buildQuery(filters);
    window.location.href = `/api/report/whistleblower/export${qs ? `?${qs}` : ""}`;
  };

  const onResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPendingQ("");
  };

  const hasActiveFilters =
    filters.q !== "" ||
    filters.kategori !== "all" ||
    filters.unit !== "all" ||
    filters.mode !== "all" ||
    filters.status !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Laporan"
          value={
            load.kind === "ready"
              ? load.stats.total.toLocaleString("id-ID")
              : "—"
          }
          hint={
            load.kind === "ready" && load.total !== load.totalAll
              ? `dari ${load.totalAll.toLocaleString("id-ID")} total`
              : undefined
          }
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Dengan Identitas"
          value={
            load.kind === "ready"
              ? load.stats.identitas.toLocaleString("id-ID")
              : "—"
          }
          icon={<ShieldCheck className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="Anonim"
          value={
            load.kind === "ready"
              ? load.stats.anonim.toLocaleString("id-ID")
              : "—"
          }
          icon={<EyeOff className="h-5 w-5" />}
          accent="accent"
        />
        <StatCard
          label="Bulan Aktif"
          value={
            load.kind === "ready"
              ? load.stats.perMonth.length.toLocaleString("id-ID")
              : "—"
          }
          hint={
            load.kind === "ready" && load.stats.perMonth.length > 0
              ? `${formatMonth(load.stats.perMonth[0].month)} – ${formatMonth(
                  load.stats.perMonth[load.stats.perMonth.length - 1].month,
                )}`
              : undefined
          }
          icon={<Calendar className="h-5 w-5" />}
          accent="warning"
        />
      </section>

      {/* Grafik & Analitik */}
      {load.kind === "ready" && load.stats.total > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <TrendChart data={load.stats.perMonth} />
          <BreakdownChart
            title="Per Status Tindak Lanjut"
            items={Object.entries(load.stats.perStatus)}
            total={load.stats.total}
          />
        </section>
      ) : null}

      {/* Breakdown */}
      {load.kind === "ready" && load.stats.total > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <BreakdownList
            title="Per Kategori"
            items={Object.entries(load.stats.perKategori)}
            total={load.stats.total}
          />
          <BreakdownList
            title="Per Unit / Program Studi"
            items={Object.entries(load.stats.perUnit)}
            total={load.stats.total}
          />
        </section>
      ) : null}

      {/* Filters */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-rose-600" />
          Filter & Pencarian
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Reset filter
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label htmlFor="wb-q" className="mb-1.5 block text-xs">
              Pencarian teks
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="wb-q"
                value={pendingQ}
                onChange={(e) => setPendingQ(e.target.value)}
                placeholder="Cari di Case ID / nama / detail…"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="wb-kat" className="mb-1.5 block text-xs">
              Kategori
            </Label>
            <Select
              id="wb-kat"
              value={filters.kategori}
              onChange={(e) =>
                setFilters((f) => ({ ...f, kategori: e.target.value }))
              }
            >
              <option value="all">Semua</option>
              {WHISTLEBLOWER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="wb-unit" className="mb-1.5 block text-xs">
              Unit / Prodi
            </Label>
            <Select
              id="wb-unit"
              value={filters.unit}
              onChange={(e) =>
                setFilters((f) => ({ ...f, unit: e.target.value }))
              }
            >
              <option value="all">Semua</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="wb-mode" className="mb-1.5 block text-xs">
              Mode
            </Label>
            <Select
              id="wb-mode"
              value={filters.mode}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  mode: e.target.value as Filters["mode"],
                }))
              }
            >
              <option value="all">Semua</option>
              <option value="Ya">Anonim</option>
              <option value="Tidak">Identitas</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="wb-status" className="mb-1.5 block text-xs">
              Status
            </Label>
            <Select
              id="wb-status"
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="all">Semua</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="wb-dfrom" className="mb-1.5 block text-xs">
              Dari tanggal
            </Label>
            <Input
              id="wb-dfrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="wb-dto" className="mb-1.5 block text-xs">
              Sampai tanggal
            </Label>
            <Input
              id="wb-dto"
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchData()}
            disabled={load.kind === "loading"}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                load.kind === "loading" && "animate-spin",
              )}
            />
            Muat ulang
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCSV}
            disabled={load.kind !== "ready" || load.rows.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </section>

      {/* Results */}
      <section>
        {load.kind === "loading" ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat laporan…
          </div>
        ) : load.kind === "error" ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{load.message}</span>
          </div>
        ) : load.kind === "ready" && load.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {load.totalAll === 0
                ? "Belum ada laporan whistleblower."
                : "Tidak ada laporan yang cocok dengan filter."}
            </p>
            {load.totalAll === 0 ? (
              <p className="max-w-md text-xs text-muted-foreground">
                Saluran whistleblower aktif. Tab “Whistleblower” pada
                spreadsheet akan otomatis dibuat saat laporan pertama masuk.
              </p>
            ) : null}
          </div>
        ) : load.kind === "ready" ? (
          <div className="space-y-3">
            {load.rows.map((r) => {
              const id = `${r.rowIndex}-${r.caseId}`;
              const isOpen = openRow === id;
              const isAnon = /ya|anonim/i.test(r.isAnonim);
              return (
                <div
                  key={id}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenRow(isOpen ? null : id)}
                    className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/40"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
                          {r.caseId}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {r.kategori || "Tanpa kategori"}
                        </span>
                        {isAnon ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-500/20 dark:text-slate-200">
                            <EyeOff className="h-3 w-3" />
                            Anonim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            {r.nama || "Identitas"}
                          </span>
                        )}
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {r.detail || "(detail kosong)"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDateTime(r.timestamp)}</span>
                        <span>·</span>
                        <span>{r.saudaraAdalah || "—"}</span>
                        <span>·</span>
                        <span>{r.unitKerja || "—"}</span>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isOpen ? (
                    <div className="border-t border-border bg-background/40 p-4 text-sm">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        <Field label="Case ID" value={r.caseId} />
                        <Field
                          label="Waktu"
                          value={formatDateTime(r.timestamp)}
                        />
                        <Field label="Kategori" value={r.kategori} />
                        <Field
                          label="Pihak Terlibat"
                          value={r.pihakTerlibat || "—"}
                        />
                        <Field label="Peran" value={r.saudaraAdalah || "—"} />
                        <Field label="Unit / Prodi" value={r.unitKerja || "—"} />
                        {!isAnon ? (
                          <>
                            <Field label="Nama" value={r.nama || "—"} />
                            <Field label="NIM/NIP" value={r.nim || "—"} />
                            <Field
                              label="Kontak"
                              value={r.kontak || "—"}
                              span
                            />
                          </>
                        ) : null}
                        <Field
                          label="Detail Pelaporan"
                          value={r.detail || "—"}
                          span
                          multiline
                        />
                        <Field
                          label="Kronologi & Bukti"
                          value={r.kronologi || "—"}
                          span
                          multiline
                        />
                        <div className="sm:col-span-2">
                          <AttachmentList raw={r.lampiran} />
                        </div>
                      </dl>

                      <div className="mt-4">
                        <StatusEditor
                          endpoint="/api/report/whistleblower/update-status"
                          rowIndex={r.rowIndex}
                          currentStatus={r.status}
                          currentCatatan={r.catatanAdmin}
                          onSaved={() => void fetchData()}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="text-xs text-muted-foreground">
              Menampilkan {load.rows.length.toLocaleString("id-ID")} dari{" "}
              {load.totalAll.toLocaleString("id-ID")} laporan.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  span,
  multiline,
}: {
  label: string;
  value: string;
  span?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={cn(span && "sm:col-span-2")}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-foreground",
          multiline && "whitespace-pre-wrap",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
