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
  ShieldCheck,
  EyeOff,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  Calendar,
  MessageSquareText,
  ChevronDown,
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
import { ROLE_OPTIONS, UNIT_OPTIONS } from "@/lib/form-config";
import { STATUS_OPTIONS } from "@/lib/status-config";
import type { SubmissionRow, Stats } from "@/lib/sheets";
import { cn } from "@/lib/utils";

type Filters = {
  q: string;
  role: string;
  unit: string;
  mode: "all" | "Ya" | "Tidak";
  status: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  role: "all",
  unit: "all",
  mode: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

const PAGE_SIZE = 20;

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      rows: SubmissionRow[];
      total: number;
      totalAll: number;
      stats: Stats;
    };

function buildQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.role !== "all") sp.set("role", f.role);
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
  // input "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function ReportDashboard() {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [pendingQ, setPendingQ] = React.useState("");
  const [load, setLoad] = React.useState<LoadState>({ kind: "idle" });
  const [page, setPage] = React.useState(0);
  const [openRow, setOpenRow] = React.useState<string | null>(null);

  // Debounce pendingQ → filters.q
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
      const res = await fetch(`/api/report/list${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
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
        rows: SubmissionRow[];
        total: number;
        totalAll: number;
        stats: Stats;
      };
      setLoad({
        kind: "ready",
        rows: data.rows,
        total: data.total,
        totalAll: data.totalAll,
        stats: data.stats,
      });
      setPage(0);
    } catch (err) {
      setLoad({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Tidak dapat terhubung ke server.",
      });
    }
  }, [filters]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onLogout = async () => {
    await fetch("/api/report/login", { method: "DELETE" });
    window.location.href = "/report/login";
  };

  const onExportCSV = () => {
    const qs = buildQuery(filters);
    window.location.href = `/api/report/export${qs ? `?${qs}` : ""}`;
  };

  const onResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPendingQ("");
  };

  const hasActiveFilters =
    filters.q !== "" ||
    filters.role !== "all" ||
    filters.unit !== "all" ||
    filters.mode !== "all" ||
    filters.status !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const rows = load.kind === "ready" ? load.rows : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Masukan"
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
          icon={<Inbox className="h-5 w-5" />}
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

      {/* Filters */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
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
            <Label htmlFor="q" className="mb-1.5 block text-xs">
              Pencarian teks
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="q"
                value={pendingQ}
                onChange={(e) => setPendingQ(e.target.value)}
                placeholder="Cari di nama / NIM / isi masukan…"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="role" className="mb-1.5 block text-xs">
              Peran
            </Label>
            <Select
              id="role"
              value={filters.role}
              onChange={(e) =>
                setFilters((f) => ({ ...f, role: e.target.value }))
              }
            >
              <option value="all">Semua</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="unit" className="mb-1.5 block text-xs">
              Unit / Prodi
            </Label>
            <Select
              id="unit"
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
            <Label htmlFor="mode" className="mb-1.5 block text-xs">
              Mode
            </Label>
            <Select
              id="mode"
              value={filters.mode}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  mode: e.target.value as Filters["mode"],
                }))
              }
            >
              <option value="all">Semua</option>
              <option value="Tidak">Identitas</option>
              <option value="Ya">Anonim</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="status" className="mb-1.5 block text-xs">
              Status
            </Label>
            <Select
              id="status"
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
            <Label htmlFor="from" className="mb-1.5 block text-xs">
              Dari tanggal
            </Label>
            <Input
              id="from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="to" className="mb-1.5 block text-xs">
              Sampai tanggal
            </Label>
            <Input
              id="to"
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchData}
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
            variant="gradient"
            size="sm"
            onClick={onExportCSV}
            disabled={load.kind !== "ready" || load.total === 0}
            className="ml-auto"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </Button>
        </div>
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
            title="Per Peran"
            items={Object.entries(load.stats.perRole)}
            total={load.stats.total}
          />
          <BreakdownList
            title="Per Unit / Program Studi"
            items={Object.entries(load.stats.perUnit)}
            total={load.stats.total}
          />
        </section>
      ) : null}

      {/* Table */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Daftar Masukan
            {load.kind === "ready" ? (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {load.total}
              </span>
            ) : null}
          </h2>
          {load.kind === "ready" && rows.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Halaman {safePage + 1} dari {totalPages}
            </p>
          ) : null}
        </div>

        {load.kind === "loading" ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat data dari Spreadsheet…
          </div>
        ) : load.kind === "error" ? (
          <div className="m-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">Tidak dapat memuat data.</p>
              <p className="text-destructive/90">{load.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchData}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="h-4 w-4" />
                Coba lagi
              </Button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              Tidak ada masukan yang cocok.
            </p>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters
                ? "Coba longgarkan filter atau reset."
                : "Belum ada masukan masuk."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Waktu</th>
                    <th className="px-4 py-3 text-left font-medium">Peran</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Unit / Prodi
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Mode</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Nama</th>
                    <th className="px-4 py-3 text-left font-medium">Masukan</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const isAnonim = /ya|anonim/i.test(r.isAnonim);
                    const key = `${r.rowIndex}`;
                    const open = openRow === key;
                    return (
                      <React.Fragment key={key}>
                        <tr
                          className="cursor-pointer border-b border-border/60 transition hover:bg-muted/30"
                          onClick={() => setOpenRow(open ? null : key)}
                        >
                          <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                            {formatDateTime(r.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={r.saudaraAdalah} />
                          </td>
                          <td className="px-4 py-3 max-w-[16ch] truncate text-foreground">
                            {r.unitKerja || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {isAnonim ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                                <EyeOff className="h-3 w-3" /> Anonim
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                <ShieldCheck className="h-3 w-3" /> Identitas
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {isAnonim ? (
                              <span className="text-muted-foreground">
                                (anonim)
                              </span>
                            ) : (
                              r.nama || "—"
                            )}
                          </td>
                          <td className="max-w-[40ch] px-4 py-3">
                            <p className="line-clamp-2 text-foreground">
                              {r.masukan || "—"}
                            </p>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="bg-muted/20">
                            <td colSpan={7} className="px-4 py-4">
                              <DetailPanel
                                row={r}
                                onStatusSaved={fetchData}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {pageRows.map((r) => {
                const isAnonim = /ya|anonim/i.test(r.isAnonim);
                const key = `${r.rowIndex}`;
                const open = openRow === key;
                return (
                  <li key={key} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenRow(open ? null : key)}
                      className="flex w-full flex-col gap-2 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <RoleBadge role={r.saudaraAdalah} />
                          {isAnonim ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                              <EyeOff className="h-3 w-3" /> Anonim
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                              <ShieldCheck className="h-3 w-3" /> Identitas
                            </span>
                          )}
                          <StatusBadge status={r.status} />
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {isAnonim ? "(anonim)" : r.nama || "—"}
                        </span>
                        <span>·</span>
                        <span className="truncate">{r.unitKerja || "—"}</span>
                      </div>
                      <p
                        className={cn(
                          "text-sm text-foreground",
                          !open && "line-clamp-2",
                        )}
                      >
                        {r.masukan || "—"}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatDateTime(r.timestamp)}
                      </p>
                    </button>
                    {open ? (
                      <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
                        <DetailPanel row={r} onStatusSaved={fetchData} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
                <p className="text-xs text-muted-foreground">
                  Menampilkan{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {safePage * PAGE_SIZE + 1}
                  </span>
                  –
                  <span className="font-medium text-foreground tabular-nums">
                    {Math.min((safePage + 1) * PAGE_SIZE, rows.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {rows.length}
                  </span>
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={safePage >= totalPages - 1}
                  >
                    <span className="hidden sm:inline">Berikutnya</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (!role)
    return (
      <span className="text-xs text-muted-foreground">(belum diisi)</span>
    );
  const palette: Record<string, string> = {
    DOSEN: "bg-primary/10 text-primary",
    MAHASISWA: "bg-accent/10 text-accent",
    TENDIK: "bg-success/10 text-success",
  };
  const cls = palette[role] ?? "bg-muted text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      <Users className="h-3 w-3" />
      {role}
    </span>
  );
}

function DetailPanel({
  row,
  onStatusSaved,
}: {
  row: SubmissionRow;
  onStatusSaved: () => void;
}) {
  const isAnonim = /ya|anonim/i.test(row.isAnonim);
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Field label="Tracking ID" value={row.trackingId || "—"} />
        <Field label="Waktu masuk" value={formatDateTime(row.timestamp)} />
        <Field
          label="Mode"
          value={
            isAnonim ? (
              <span className="text-accent">Anonim</span>
            ) : (
              <span className="text-success">Identitas</span>
            )
          }
        />
        <Field label="Peran" value={row.saudaraAdalah || "—"} />
        <Field
          label="Unit / Prodi"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {row.unitKerja || "—"}
            </span>
          }
        />
        {!isAnonim ? (
          <>
            <Field label="Nama" value={row.nama || "—"} />
            <Field label="NIM / NIP" value={row.nim || "—"} />
          </>
        ) : null}
        <Field
          label="Masukan / saran"
          value={row.masukan || "—"}
          className="sm:col-span-2"
        />
        {row.kronologi ? (
          <Field
            label="Kronologi kejadian"
            value={row.kronologi}
            className="sm:col-span-2"
          />
        ) : null}
        {row.kontak ? (
          <Field
            label="Kontak (sukarela)"
            value={row.kontak}
            className="sm:col-span-2"
          />
        ) : null}
        <div className="sm:col-span-2">
          <AttachmentList raw={row.lampiran} />
        </div>
      </dl>

      <StatusEditor
        endpoint="/api/report/update-status"
        rowIndex={row.rowIndex}
        currentStatus={row.status}
        currentCatatan={row.catatanAdmin}
        onSaved={onStatusSaved}
      />
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap break-words text-foreground">
        {value}
      </dd>
    </div>
  );
}
