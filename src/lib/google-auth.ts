/**
 * Kredensial service account Google — dipakai bersama oleh Sheets API
 * (`lib/sheets.ts`) dan Drive API (`lib/drive.ts`). Diekstrak supaya logic
 * parsing PEM tidak diduplikasi antar kedua client.
 *
 * Kredensial diambil dari environment:
 *   - GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (newline-encoded)
 *   - atau GOOGLE_SERVICE_ACCOUNT_JSON (JSON string utuh)
 */

export class GoogleAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthConfigError";
  }
}

export type GoogleCredentials = {
  client_email: string;
  private_key: string;
};

/**
 * Normalisasi PEM private key dari env var. Berbagai host (Vercel di antaranya)
 * bisa mengirim value dalam bentuk yang tidak langsung dibaca OpenSSL:
 *  - Newline tersimpan sebagai literal "\n" (2 karakter) → ubah ke newline asli.
 *  - Line ending CRLF (\r\n) dari paste Windows → ubah ke LF (\n).
 *  - Newline dihilangkan total / diganti spasi (Vercel terkadang flatten
 *    multiline value saat disimpan dari UI) → rekonstruksi PEM dengan
 *    membungkus blok base64 jadi 64-char per baris sesuai RFC 7468.
 *  - Whitespace berlebih di awal/akhir → trim.
 *  - Akhiri dengan satu newline (beberapa parser PEM strict soal ini).
 *
 * Tanpa normalisasi ini, OpenSSL akan balas
 * "1E08010C:DECODER routines::unsupported" walau key terlihat valid.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // Kasus terburuk: nilai sudah kehilangan newline (Vercel UI dapat flatten
  // multi-line value menjadi satu baris yang dipisah spasi). Selama header dan
  // footer PEM masih ada, kita bisa membentuk ulang PEM dengan membungkus
  // base64 jadi 64 karakter per baris.
  const beginMatch = key.match(/-----BEGIN [A-Z0-9 ]+-----/);
  const endMatch = key.match(/-----END [A-Z0-9 ]+-----/);
  if (beginMatch && endMatch) {
    const header = beginMatch[0];
    const footer = endMatch[0];
    const headerEnd = (beginMatch.index ?? 0) + header.length;
    const footerStart = endMatch.index ?? key.length;
    if (headerEnd < footerStart) {
      const middle = key.slice(headerEnd, footerStart);
      // Hapus SEMUA whitespace dalam blok base64, lalu wrap ulang per 64 char.
      const base64 = middle.replace(/\s+/g, "");
      if (base64.length > 0) {
        const wrapped = base64.match(/.{1,64}/g)?.join("\n") ?? base64;
        key = `${header}\n${wrapped}\n${footer}`;
      }
    }
  }

  return key + "\n";
}

/**
 * Ambil & validasi kredensial service account dari environment. Melempar
 * `GoogleAuthConfigError` dengan pesan actionable kalau ada yang salah.
 */
export function getGoogleCredentials(): GoogleCredentials {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    let parsed: { client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new GoogleAuthConfigError(
        "GOOGLE_SERVICE_ACCOUNT_JSON tidak valid JSON. Pastikan value adalah single-line JSON (gunakan `jq -c .` atau pakai env var split GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).",
      );
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new GoogleAuthConfigError(
        "GOOGLE_SERVICE_ACCOUNT_JSON tidak punya client_email/private_key. Cek isi JSON-nya.",
      );
    }
    const private_key = normalizePrivateKey(parsed.private_key);
    if (!private_key.startsWith("-----BEGIN")) {
      throw new GoogleAuthConfigError(
        "private_key di GOOGLE_SERVICE_ACCOUNT_JSON tidak dimulai dengan '-----BEGIN'. Mungkin newline di-escape rusak.",
      );
    }
    return { client_email: parsed.client_email, private_key };
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new GoogleAuthConfigError(
      "Service account belum dikonfigurasi. Set GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }
  privateKey = normalizePrivateKey(privateKey);
  if (!privateKey.startsWith("-----BEGIN")) {
    throw new GoogleAuthConfigError(
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY tidak dimulai dengan '-----BEGIN PRIVATE KEY-----'. " +
        "Cek lagi: paste UTUH dari header `-----BEGIN PRIVATE KEY-----` sampai footer `-----END PRIVATE KEY-----` (boleh multiline; \\n literal juga didukung).",
    );
  }
  return { client_email: email, private_key: privateKey };
}
