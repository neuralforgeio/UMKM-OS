// Helper inti sistem serah terima (handover v2). Dipakai oleh aksi
// checkout kasir, halaman kurir /owner/verify, dan halaman publik
// /verify/[code]. Server-side only.
import { randomBytes } from "crypto";

// Charset tanpa karakter ambigu (tanpa 0/O/1/I) supaya aman
// dibacakan lewat telepon dan aman diketik dari struk.
// 32^8 = ~1,1 triliun kombinasi — praktis mustahil ditebak.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateHandoverCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

/**
 * Base URL yang harus bisa dijangkau HP pembeli di jaringan yang sama
 * (LAN IP, bukan localhost). Samakan dengan NEXT_PUBLIC_APP_URL yang
 * sudah terbukti bisa di-scan HP sejak fitur QR struk.
 */
export function getVerifyBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function buildVerifyUrl(code: string): string {
  return `${getVerifyBaseUrl()}/verify/${code}`;
}

/** Validasi data URL PNG dari SignaturePad (maks ±300KB). */
export function isValidSignatureData(s: unknown): s is string {
  return (
    typeof s === "string" &&
    s.startsWith("data:image/png;base64,") &&
    s.length > 100 &&
    s.length <= 300_000
  );
}

/** Awal "hari ini" menurut WIB, sebagai instan UTC. */
export function startOfTodayWIB(): Date {
  const SHIFT = 7 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + SHIFT);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - SHIFT);
}
