"use client";

import * as React from "react";
import {
  Loader2,
  AlertCircle,
  Printer,
  FileText,
  Inbox,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SubmissionRow, Stats, WhistleblowerRow, WhistleblowerStats } from "@/lib/sheets";

type SaranData = { rows: SubmissionRow[]; stats: Stats };
type WbData = { rows: WhistleblowerRow[]; stats: WhistleblowerStats };

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      dateFrom: string;
      dateTo: string;
      saran: SaranData | null;
      wb: WbData | null;
      generatedAt: string;
    };

function formatDate(value: string): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(d);
}

function formatDateTimeShort(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(d);
}

function truncate(text: string, max: number): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t || "—";
  return `${t.slice(0, max - 1)}…`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Gagal memuat data (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export function LaporanDekan() {
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [includeSaran, setIncludeSaran] = React.useState(true);
  const [includeWb, setIncludeWb] = React.useState(true);
  const [load, setLoad] = React.useState<LoadState>({ kind: "idle" });

  const onGenerate = async () => {
    if (!includeSaran && !includeWb) {
      setLoad({
        kind: "error",
        message: "Pilih minimal satu sumber data (Kotak Saran atau Whistleblower).",
      });
      return;
    }
    setLoad({ kind: "loading" });
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    const query = qs.toString();
    try {
      const [saran, wb] = await Promise.all([
        includeSaran
          ? fetchJson<{ rows: SubmissionRow[]; stats: Stats }>(
              `/api/report/list${query ? `?${query}` : ""}`,
            )
          : Promise.resolve(null),
        includeWb
          ? fetchJson<{ rows: WhistleblowerRow[]; stats: WhistleblowerStats }>(
              `/api/report/whistleblower/list${query ? `?${query}` : ""}`,
            )
          : Promise.resolve(null),
      ]);
      setLoad({
        kind: "ready",
        dateFrom,
        dateTo,
        saran: saran ? { rows: saran.rows, stats: saran.stats } : null,
        wb: wb ? { rows: wb.rows, stats: wb.stats } : null,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setLoad({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Tidak dapat terhubung ke server.",
      });
    }
  };

  const onPrint = () => window.print();

  const ready = load.kind === "ready";

  return (
    <div className="space-y-6">
      {/* Print-only: force everything else out of the paper */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              #laporan-print-area, #laporan-print-area * { visibility: visible; }
              #laporan-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 0;
                box-shadow: none !important;
                border: none !important;
              }
              @page { size: A4; margin: 15mm; }
            }
          `,
        }}
      />

      {/* Controls (hidden when printing) */}
      <section className="print:hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Buat Laporan untuk Dekan
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Pilih periode dan sumber data, lalu buat laporan. Laporan bisa dicetak
          langsung atau disimpan sebagai PDF lewat dialog cetak browser.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="laporan-from" className="mb-1.5 block text-xs">
              Dari tanggal
            </Label>
            <Input
              id="laporan-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="laporan-to" className="mb-1.5 block text-xs">
              Sampai tanggal
            </Label>
            <Input
              id="laporan-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-4 lg:col-span-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeSaran}
                onChange={(e) => setIncludeSaran(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Kotak Saran
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeWb}
                onChange={(e) => setIncludeWb(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Whistleblower
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="gradient"
            size="sm"
            onClick={onGenerate}
            disabled={load.kind === "loading"}
          >
            {load.kind === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Buat Laporan
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrint}
            disabled={!ready}
          >
            <Printer className="h-4 w-4" />
            Cetak / Simpan PDF
          </Button>
        </div>

        {load.kind === "error" ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{load.message}</p>
          </div>
        ) : null}
      </section>

      {/* Printable report */}
      {ready ? (
        <div
          id="laporan-print-area"
          className="mx-auto max-w-[210mm] rounded-2xl border border-border bg-white p-8 text-slate-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0"
        >
          <ReportHeader dateFrom={load.dateFrom} dateTo={load.dateTo} generatedAt={load.generatedAt} />

          {load.saran ? (
            <ReportSection
              icon={<Inbox className="h-4 w-4" />}
              title="A. Rekap Kotak Saran"
              total={load.saran.stats.total}
            >
              <StatsTable
                rows={[
                  ["Total Masukan", load.saran.stats.total],
                  ["Dengan Identitas", load.saran.stats.identitas],
                  ["Anonim", load.saran.stats.anonim],
                ]}
              />
              <BreakdownTable
                title="Per Status Tindak Lanjut"
                items={Object.entries(load.saran.stats.perStatus)}
              />
              <BreakdownTable
                title="Per Peran Pelapor"
                items={Object.entries(load.saran.stats.perRole)}
              />
              <BreakdownTable
                title="Per Unit Kerja / Prodi"
                items={Object.entries(load.saran.stats.perUnit)}
              />
              <DetailTable
                caption="Daftar Masukan"
                emptyText="Tidak ada masukan pada periode ini."
                headers={["No", "Tanggal", "Unit / Prodi", "Mode", "Status", "Ringkasan Masukan"]}
                rows={load.saran.rows.map((r, i) => {
                  const isAnonim = /ya|anonim/i.test(r.isAnonim);
                  return [
                    String(i + 1),
                    formatDateTimeShort(r.timestamp),
                    r.unitKerja || "—",
                    isAnonim ? "Anonim" : "Identitas",
                    r.status,
                    truncate(r.masukan, 90),
                  ];
                })}
              />
            </ReportSection>
          ) : null}

          {load.wb ? (
            <ReportSection
              icon={<ShieldAlert className="h-4 w-4" />}
              title="B. Rekap Whistleblower"
              total={load.wb.stats.total}
            >
              <StatsTable
                rows={[
                  ["Total Laporan", load.wb.stats.total],
                  ["Dengan Identitas", load.wb.stats.identitas],
                  ["Anonim", load.wb.stats.anonim],
                ]}
              />
              <BreakdownTable
                title="Per Status Tindak Lanjut"
                items={Object.entries(load.wb.stats.perStatus)}
              />
              <BreakdownTable
                title="Per Kategori Pelanggaran"
                items={Object.entries(load.wb.stats.perKategori)}
              />
              <BreakdownTable
                title="Per Unit Kerja / Prodi"
                items={Object.entries(load.wb.stats.perUnit)}
              />
              <DetailTable
                caption="Daftar Laporan"
                emptyText="Tidak ada laporan pada periode ini."
                headers={["No", "Tanggal", "Kategori", "Unit / Prodi", "Mode", "Status", "Ringkasan Laporan"]}
                rows={load.wb.rows.map((r, i) => {
                  const isAnonim = /ya|anonim/i.test(r.isAnonim);
                  return [
                    String(i + 1),
                    formatDateTimeShort(r.timestamp),
                    r.kategori || "—",
                    r.unitKerja || "—",
                    isAnonim ? "Anonim" : "Identitas",
                    r.status,
                    truncate(r.detail, 90),
                  ];
                })}
              />
            </ReportSection>
          ) : null}

          <ReportFooter />
        </div>
      ) : null}
    </div>
  );
}

function ReportHeader({
  dateFrom,
  dateTo,
  generatedAt,
}: {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
}) {
  const periodLabel =
    dateFrom || dateTo
      ? `${dateFrom ? formatDate(dateFrom) : "Awal data"} — ${
          dateTo ? formatDate(dateTo) : "Sekarang"
        }`
      : "Seluruh periode data";
  return (
    <header className="mb-6 border-b-2 border-slate-800 pb-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide">
          Fakultas Ekonomi dan Bisnis
        </p>
        <p className="text-base font-bold uppercase tracking-wide">
          Universitas Gajayana Malang
        </p>
      </div>
      <h1 className="mt-4 text-center text-lg font-bold uppercase">
        Laporan Rekap Kotak Saran &amp; Whistleblower
      </h1>
      <div className="mt-3 space-y-0.5 text-sm">
        <p>
          <span className="font-medium">Periode</span>: {periodLabel}
        </p>
        <p>
          <span className="font-medium">Tanggal cetak</span>:{" "}
          {new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(
            new Date(generatedAt),
          )}
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed">
        Kepada Yth. Dekan Fakultas Ekonomi dan Bisnis Universitas Gajayana
        Malang, berikut kami sampaikan laporan rekap masukan Kotak Saran dan
        laporan Whistleblower pada periode tersebut di atas.
      </p>
    </header>
  );
}

function ReportSection({
  icon,
  title,
  total,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 break-inside-avoid-page">
      <h2 className="mb-2 flex items-center gap-2 border-b border-slate-300 pb-1.5 text-sm font-bold uppercase tracking-wide">
        {icon}
        {title}
        <span className="ml-auto text-xs font-normal normal-case text-slate-500">
          {total.toLocaleString("id-ID")} entri
        </span>
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function StatsTable({ rows }: { rows: Array<[string, number]> }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-slate-200">
            <td className="py-1 pr-3 text-slate-600">{label}</td>
            <td className="py-1 text-right font-medium tabular-nums">
              {value.toLocaleString("id-ID")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BreakdownTable({
  title,
  items,
}: {
  title: string;
  items: Array<[string, number]>;
}) {
  const sorted = [...items].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, v]) => sum + v, 0);
  if (sorted.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {sorted.map(([label, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <tr key={label} className="border-b border-slate-200">
                <td className="py-1 pr-3">{label || "(tidak diisi)"}</td>
                <td className="py-1 text-right tabular-nums">
                  {count} ({pct}%)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailTable({
  caption,
  emptyText,
  headers,
  rows,
}: {
  caption: string;
  emptyText: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {caption}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-slate-400 text-left">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className="break-words px-1.5 py-1 font-semibold"
                  style={i === 0 ? { width: "2.5em" } : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                {cells.map((c, j) => (
                  <td key={j} className="break-words px-1.5 py-1">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReportFooter() {
  const now = new Date();
  const tanggal = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(now);
  return (
    <footer className="mt-10 break-inside-avoid-page">
      <p className="text-sm">
        Demikian laporan ini dibuat berdasarkan data yang tercatat pada sistem
        Kotak Saran Elektronik FEB Universitas Gajayana Malang untuk dapat
        digunakan sebagaimana mestinya.
      </p>
      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p>Mengetahui,</p>
          <p>Dekan FEB Universitas Gajayana Malang</p>
          <div className="mt-16 border-b border-slate-500" />
          <p className="mt-1 text-slate-500">Nama &amp; NIP</p>
        </div>
        <div>
          <p>Malang, {tanggal}</p>
          <p>Petugas Pengelola</p>
          <div className="mt-16 border-b border-slate-500" />
          <p className="mt-1 text-slate-500">Nama &amp; NIP</p>
        </div>
      </div>
    </footer>
  );
}
