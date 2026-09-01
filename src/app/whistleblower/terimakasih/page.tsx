import Link from "next/link";
import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { CaseIdCopy } from "@/components/case-id-copy";

export const metadata = {
  title: "Laporan Diterima — Whistleblower FEB UNIGA",
  description: "Laporan whistleblower berhasil dikirim. Simpan Case ID Anda.",
};

export const dynamic = "force-dynamic";

export default function WhistleblowerThankYouPage({
  searchParams,
}: {
  searchParams: { case?: string };
}) {
  const caseId = searchParams.case ?? "(tidak tersedia)";
  const isValidId = /^WB-\d{8}-[A-Z0-9]{4}$/.test(caseId);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 top-[-10%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="container flex items-center justify-between py-5 sm:py-6">
        <div className="flex items-center gap-3">
          <BrandMark size={42} />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              FEB Universitas Gajayana Malang
            </span>
            <span className="text-sm font-semibold text-foreground sm:text-base">
              Whistleblower
            </span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="container max-w-2xl pb-16 pt-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/60 p-6 dark:bg-emerald-500/10 sm:p-8">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Laporan berhasil dikirim
            </h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Terima kasih atas keberanian Anda melaporkan dugaan pelanggaran.
            Tim Komisi Etik / SPI Fakultas akan menindaklanjuti laporan ini
            sesuai prosedur. Identitas pelapor (jika diisi) dijaga
            kerahasiaannya.
          </p>

          <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Case ID Anda
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <code className="text-lg font-bold tracking-wider text-foreground sm:text-xl">
                {caseId}
              </code>
              {isValidId ? <CaseIdCopy caseId={caseId} /> : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <strong>Simpan Case ID ini.</strong> Anda dapat menyebutkannya
              saat menanyakan status laporan atau saat mengirim bukti
              pendukung melalui email pengelola.
            </p>
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              Laporan Anda tersimpan di sistem internal FEB UNIGA Malang dan
              hanya dapat diakses oleh tim yang berwenang menangani
              whistleblower. Tidak ada notifikasi otomatis dikirim ke pihak
              lain.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Kembali ke beranda
            </Link>
            {isValidId ? (
              <Link
                href="/lacak"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <Search className="h-4 w-4" />
                Cek status laporan
              </Link>
            ) : null}
            <Link
              href="/whistleblower"
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Kirim laporan lagi
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
