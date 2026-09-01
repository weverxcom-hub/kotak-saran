import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { LacakForm } from "@/components/lacak-form";

export const metadata = {
  title: "Cek Status — Kotak Saran FEB UNIGA Malang",
  description:
    "Cek status tindak lanjut masukan Kotak Saran atau laporan Whistleblower pakai kode tracking, tanpa login.",
};

export default function LacakPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 top-[-10%] h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-32 top-[10%] h-[420px] w-[420px] rounded-full bg-accent/15 blur-3xl" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-30"
      />

      <header className="container flex items-center justify-between py-5 sm:py-6">
        <div className="flex items-center gap-3">
          <BrandMark size={42} />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              FEB Universitas Gajayana Malang
            </span>
            <span className="text-sm font-semibold text-foreground sm:text-base">
              Cek Status
            </span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="container max-w-xl pb-16 pt-4">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Halaman utama
        </Link>

        <LacakForm />
      </main>

      <SiteFooter variant="compact" />
    </div>
  );
}
