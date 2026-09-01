# Kotak Saran Elektronik — FEB Universitas Gajayana Malang

Versi modern dari **Kotak Saran Elektronik Fakultas Ekonomi dan Bisnis Universitas Gajayana Malang**. UI di-rebuild dari nol dengan Next.js 14, Tailwind CSS, dan animasi modern. Semua masukan disimpan langsung ke **Google Spreadsheet** lewat Google Sheets API — satu sumber data untuk wizard publik (`/`), dashboard admin (`/report`), dan saluran whistleblower (`/whistleblower`).

![hero](public/og.svg)

## ✨ Fitur Antarmuka

- **Wizard 4 langkah** dengan progress bar (Tentang Anda → Privasi → Masukan → Tinjau & Kirim)
- **Conditional anonim**: opsi anonim sepenuhnya, opsi identitas, atau pilih sendiri
- **Upload bukti**: lampiran foto/dokumen (JPG/PNG/WEBP/PDF, maks 4MB × 3 file) di form Kotak Saran & Whistleblower — lihat [§ Upload Bukti](#-upload-bukti-lampiran)
- **Tindak lanjut & cek status**: admin bisa update status (Baru/Diproses/Selesai/Ditolak) + catatan, pengirim bisa cek lewat kode tracking di [`/lacak`](#-cek-status-lacak) tanpa login
- **Grafik & analitik** di dashboard admin: tren bulanan + breakdown per status (di samping breakdown teks yang sudah ada)
- **Laporan Dekan** (`/report/laporan`): petugas bisa membuat laporan rekap gabungan Kotak Saran + Whistleblower untuk periode tertentu, siap cetak/simpan sebagai PDF — lihat [§ Laporan Dekan](#-laporan-dekan)
- **Validasi inline** + character counter untuk masukan utama
- **Dark / Light / System mode** dengan persist via `localStorage`
- **Animated background blobs** + grid pattern
- **Mobile-first**, responsif penuh hingga >1280px
- **Zero-state ramah** dan halaman terima kasih yang dipersonalisasi
- **i18n Indonesia (id)** sepenuhnya

## 🧠 Arsitektur

```
Browser  →  Next.js POST /api/saran  →  Google Sheets API (append row)
                                              │
                                              ▼
                                       Google Spreadsheet
                                              │
                                              ▼
Admin   →  /report (cookie-protected)  ←  Google Sheets API (read)
```

- Form dikirim ke endpoint internal `/api/saran` dalam format JSON.
- Server memvalidasi payload, lalu append baris baru ke spreadsheet via
  Google Sheets API (`spreadsheets.values.append`) menggunakan service account.
- Skema kolom 12-kolom (A–L) memisahkan jawaban identitas vs anonim, sehingga
  pengelola bisa filter / mengekspor masing-masing tanpa kebocoran identitas.
- Tidak ada database. Tidak ada secret di klien.

## 🛠️ Stack

- **Next.js 14** (App Router, Node.js runtime untuk API yang akses Sheets)
- **`googleapis`** untuk read & write ke Google Sheets via service account
- **TypeScript**, strict mode
- **Tailwind CSS** + design tokens HSL custom (terang/gelap)
- **lucide-react** untuk ikon
- **class-variance-authority** + **tailwind-merge** untuk varian komponen

## 🚀 Menjalankan secara lokal

```bash
npm install
cp .env.example .env.local
# → isi REPORT_PASSWORD, REPORT_SHEET_ID, dan kredensial service account
npm run dev
# → http://localhost:3000
```

Lihat tabel env var di section [Admin Dashboard `/report`](#-admin-dashboard-report)
untuk daftar lengkap.

## 📝 Skema Spreadsheet

Sheet pertama harus punya **header row** + 12 kolom berikut (urutan persis):

| Kolom | Header                          | Isi |
| ----- | ------------------------------- | --- |
| A     | `Timestamp`                     | DD/MM/YYYY HH:MM:SS (otomatis di-set saat append) |
| B     | `Saudara adalah`                | DOSEN / MAHASISWA / TENDIK / atau bebas |
| C     | `Unit kerja / Prodi`            | salah satu dari `UNIT_OPTIONS` |
| D     | `Apakah Anonim?`                | `Ya` atau `Tidak` |
| E     | `Nama (jika identitas)`         | hanya diisi bila D=`Tidak` |
| F     | `NIM/NIP (jika identitas)`      | hanya diisi bila D=`Tidak` |
| G     | `Masukan (identitas)`           | hanya diisi bila D=`Tidak` |
| H     | `Kronologi (identitas)`         | hanya diisi bila D=`Tidak` |
| I     | `Kontak (identitas)`            | hanya diisi bila D=`Tidak` |
| J     | `Masukan (anonim)`              | hanya diisi bila D=`Ya` |
| K     | `Kronologi (anonim)`            | hanya diisi bila D=`Ya` |
| L     | `Kontak (anonim)`               | hanya diisi bila D=`Ya` |

Kalau spreadsheet Anda pakai header lain, parser di `lib/sheets.ts` mencoba
mencocokkan via regex (mis. cari kata "Anonim", "Nama", "Masukan"). Tetap
disarankan ikut format di atas supaya konsisten.

Untuk mengganti opsi pertanyaan (Peran / Unit), edit
[`src/lib/form-config.ts`](src/lib/form-config.ts) — itu satu-satunya konfigurasi
yang perlu disesuaikan jika bisnis logic berubah.

## 🛡️ Admin Dashboard `/report`

Halaman `/report` adalah panel rekap masukan untuk pengelola FEB. Halaman ini
dilindungi password sederhana (HMAC-signed cookie session 8 jam) dan membaca
data langsung dari spreadsheet yang sama dengan tempat `/api/saran` menulis.

Fitur:

- 4 stat card: Total Masukan / Dengan Identitas / Anonim / Bulan Aktif
- Filter: pencarian teks, peran, unit/prodi, mode (anonim/identitas), rentang tanggal
- Daftar masukan dengan card list di mobile + tabel di desktop
- Export CSV (UTF-8 BOM agar Excel tidak salah encoding)

### Env var yang dibutuhkan

| Variable | Wajib? | Keterangan |
| --- | --- | --- |
| `REPORT_PASSWORD` | ✅ | Password halaman `/report/login`. Disarankan minimal 12 karakter. |
| `REPORT_SHEET_ID` | ✅ | ID spreadsheet target (bagian URL antara `/d/` dan `/edit`). Sheet ini menyimpan **semua submission** sekaligus jadi sumber `/report`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ (opsi A) | Full JSON service account, single-line stringified. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | ✅ (opsi B) | Alternatif kalau JSON susah di-paste ke Vercel UI (karena multiline `private_key`). Kode support kedua format. |
| `REPORT_SHEET_RANGE` | ❌ | Default `A:Z` di sheet pertama. |
| `REPORT_SESSION_SECRET` | ❌ | HMAC secret untuk cookie. Default fallback ke `REPORT_PASSWORD` (artinya: tiap ganti password, semua session lama otomatis invalid). |

Service account email **wajib** diberi akses **Editor** ke spreadsheet target
supaya bisa `append` baris baru saat user submit. Akses Viewer saja tidak
cukup karena `/api/saran` perlu menulis. Cara grant akses:

1. Buka spreadsheet → klik **Share** (kanan atas)
2. Tempel email service account (contoh `kotak-saran-app@<project>.iam.gserviceaccount.com`)
3. Pilih role **Editor**
4. Hilangkan centang **Notify people** (opsional, service account tidak punya inbox)
5. Klik **Share**

### Mengganti password `/report`

Password 100% berbasis env var — **tidak ada hardcoded value di kode**. Untuk
mengganti:

1. Buka [Vercel → Project Settings → Environment Variables](https://vercel.com/dashboard).
2. Edit `REPORT_PASSWORD` → ganti dengan nilai baru.
3. Centang scope **Production + Preview + Development** sesuai kebutuhan.
4. Save → masuk ke tab **Deployments** → deployment terakhir → **Redeploy**
   (centang "Use existing Build Cache" untuk redeploy cepat tanpa rebuild).
5. Setelah deployment hijau, password lama langsung ditolak dan **semua
   session yang masih login otomatis di-logout** (karena cookie HMAC dihitung
   ulang dengan secret baru).

Password tidak pernah masuk ke repo / git history. Jangan commit `.env.local`.

## 📢 Saluran Whistleblower (`/whistleblower`)

Saluran terpisah untuk **laporan pelanggaran serius** (korupsi, kekerasan,
kecurangan akademik, dll). Disimpan di tab **`Whistleblower`** pada
**spreadsheet yang sama** dengan kotak saran (env var `REPORT_SHEET_ID`).
Tab dibuat otomatis oleh API saat laporan pertama masuk — tidak perlu setup
manual di Google Sheets.

### Perbedaan dengan kotak saran

| Aspek | Kotak Saran (`/`) | Whistleblower (`/whistleblower`) |
| --- | --- | --- |
| Tujuan | Saran perbaikan layanan | Lapor pelanggaran (etik / hukum) |
| Default privasi | Identitas | **Anonim** (direkomendasikan) |
| Field tambahan | — | Kategori (wajib) + Pihak Terlibat (opsional) |
| Tracking | — | **Case ID** `WB-YYYYMMDD-XXXX` |
| Dashboard admin | `/report` | `/report/whistleblower` |
| Tab spreadsheet | `Sheet1` (default) | `Whistleblower` (auto-create) |

Login dashboard pakai **password yang sama** dengan `/report`
(env var `REPORT_PASSWORD`). Tab navigasi di kepala halaman menjembatani
keduanya.

### Kategori pelanggaran (default)

1. Korupsi/Gratifikasi
2. Kekerasan/Pelecehan Seksual
3. Kecurangan Akademik (plagiarisme/joki)
4. Konflik Kepentingan
5. Pelanggaran Tata Tertib Pegawai
6. Lainnya

Kategori dapat diubah di `src/lib/whistleblower-config.ts`
(`WHISTLEBLOWER_CATEGORIES`).

### Skema kolom tab `Whistleblower` (12 kolom A–L)

| Kolom | Field |
| --- | --- |
| A | Timestamp |
| B | Case ID (`WB-YYYYMMDD-XXXX`) |
| C | Kategori |
| D | Saudara adalah |
| E | Unit kerja / Prodi |
| F | Pihak Terlibat |
| G | Apakah Anonim? (`Ya` / `Tidak`) |
| H | Nama (jika identitas) |
| I | NIM/NIP (jika identitas) |
| J | Kontak (jika identitas) |
| K | Detail Pelaporan |
| L | Kronologi & Bukti |

> Bila pelapor memilih **Anonim**, kolom H–J kosong. Detail (K) dan Kronologi
> (L) tetap terisi tanpa peduli mode.

### Case ID

Setiap submission menghasilkan ID unik format `WB-YYYYMMDD-XXXX` (4 char
base36 random). ID ditampilkan di halaman terima kasih. Pelapor diminta
mencatat / menyalin ID untuk:

- Follow-up status laporan via email pengelola.
- Mengirim bukti pendukung (foto/dokumen) ke email pengelola dengan subject
  yang menyebutkan Case ID.

## 🖨️ Laporan Dekan

Halaman `/report/laporan` (tab **"Laporan Dekan"** di dashboard admin) dipakai
petugas untuk menyusun **laporan resmi rekap Kotak Saran & Whistleblower**
yang diberikan ke Dekan FEB. Login pakai session yang sama dengan `/report`.

Alur pemakaian:

1. Pilih rentang tanggal (**Dari tanggal** / **Sampai tanggal**) — kosongkan
   salah satu atau keduanya untuk mencakup seluruh data yang ada.
2. Centang sumber data yang mau disertakan: **Kotak Saran**, **Whistleblower**,
   atau keduanya (default: keduanya).
3. Klik **Buat Laporan** — halaman menyusun dokumen dengan kop surat FEB,
   ringkasan statistik (total, breakdown per status/peran/unit/kategori), dan
   tabel daftar masukan/laporan pada periode tersebut, ditutup blok tanda
   tangan untuk Dekan dan Petugas Pengelola.
4. Klik **Cetak / Simpan PDF** untuk membuka dialog cetak browser — pilih
   printer fisik atau "Save as PDF" untuk menyimpan filenya.

Laporan dibuat sepenuhnya di sisi klien (fetch ke `/api/report/list` dan
`/api/report/whistleblower/list` yang sudah ada, dengan filter tanggal yang
sama seperti dashboard) — tidak ada endpoint atau penyimpanan tambahan.
Karena memakai data yang sama dengan dashboard admin, isi laporan (termasuk
detail laporan Whistleblower) mengikuti tingkat akses yang sama — jaga
kerahasiaan file PDF yang dihasilkan sesuai kebijakan internal FEB.

## ☁️ Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Di Vercel: **New Project** → import repo → biarkan semua default.
3. Set env var (lihat [tabel di atas](#env-var-yang-dibutuhkan)):
   `REPORT_PASSWORD`, `REPORT_SHEET_ID`, dan kredensial service account.
4. Pastikan service account email punya akses **Editor** ke spreadsheet target.
5. Deploy. Domain langsung dapat dipakai untuk menerima masukan publik dan login `/report`.

Catatan: API route berjalan di Node.js Runtime karena memakai library
`googleapis` (tidak edge-compatible).

## 🔐 Privasi

- Submisi anonim **tidak** mengirim field nama/NIM, hanya field anonymous yang
  dikirim ke Google Form.
- Tidak ada cookie / pelacak / analytics di proyek ini secara default.
- Validasi dasar (panjang minimum, opsi terdaftar) dijalankan di server agar
  spam dan salah-input dasar bisa ditolak sebelum mencapai Google.

## 📁 Struktur Proyek

```
src/
├─ app/
│  ├─ api/
│  │  ├─ saran/route.ts                 # POST kotak saran → append Sheet1
│  │  ├─ whistleblower/route.ts         # POST whistleblower → tab Whistleblower
│  │  └─ report/
│  │     ├─ login/route.ts              # POST login + DELETE logout
│  │     ├─ list/route.ts               # GET semua masukan saran
│  │     ├─ export/route.ts             # GET CSV saran
│  │     └─ whistleblower/
│  │        ├─ list/route.ts            # GET semua laporan WB
│  │        └─ export/route.ts          # GET CSV WB
│  ├─ report/
│  │  ├─ login/page.tsx                 # Form login /report/login
│  │  ├─ page.tsx                       # Dashboard rekap saran
│  │  ├─ whistleblower/page.tsx         # Dashboard rekap WB
│  │  └─ laporan/page.tsx               # Laporan cetak untuk Dekan
│  ├─ whistleblower/
│  │  ├─ page.tsx                       # Form publik laporan WB
│  │  └─ terimakasih/page.tsx           # Halaman Case ID
│  ├─ globals.css                       # Theme tokens & utilities
│  ├─ layout.tsx                        # Root layout + ThemeProvider
│  └─ page.tsx                          # Landing + form saran
├─ components/
│  ├─ saran-form.tsx                    # 4-step wizard saran
│  ├─ whistleblower-form.tsx            # Form WB (default anonim, disclaimer)
│  ├─ case-id-copy.tsx                  # Tombol salin Case ID
│  ├─ report/
│  │  ├─ report-dashboard.tsx           # Dashboard saran
│  │  ├─ whistleblower-dashboard.tsx    # Dashboard WB
│  │  ├─ laporan-dekan.tsx              # Laporan cetak gabungan untuk Dekan
│  │  ├─ stat-card.tsx
│  │  └─ breakdown-list.tsx
│  ├─ progress-steps.tsx
│  ├─ option-card.tsx
│  ├─ theme-provider.tsx                # Light/Dark/System
│  ├─ theme-toggle.tsx
│  ├─ brand-mark.tsx                    # UNIGA emblem
│  ├─ site-footer.tsx                   # "Develop with ❤️ by weverx.com" footer
│  └─ ui/{button,input,textarea,label,select}.tsx
└─ lib/
   ├─ form-config.ts                    # Opsi peran/unit + tipe payload
   ├─ whistleblower-config.ts           # Kategori WB + tipe payload
   ├─ sheets.ts                         # Sheets API (read+append) saran & WB
   ├─ auth.ts                           # HMAC cookie session helper
   └─ utils.ts
```

## 📜 Lisensi

Internal — Fakultas Ekonomi dan Bisnis Universitas Gajayana Malang.
