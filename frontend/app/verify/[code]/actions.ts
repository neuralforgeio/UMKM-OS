"use server";
// Aksi dari HP PEMBELI (tanpa login) — kode klaim adalah kuncinya.
// Seluruh logika (validasi tanda tangan, transisi status, jejak
// HandoverEvent, audit) sudah di backend-go v1.3.0
// (POST /api/v1/public/receipt/{code}/confirm|dispute); file ini hanya
// jembatan tipis + penerusan identitas perangkat pembeli.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { goPublic } from "@/lib/api";
import { isValidSignatureData } from "@/lib/handover";

export type PublicActionResult = { ok: true } | { ok: false; error: string };

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

// Identitas PEMBELI diteruskan ke backend-go lewat header supaya jejak
// anti-fraud di handover_events mencatat perangkat + IP asli pembeli
// (Go membacanya dari r.UserAgent() dan middleware.ClientIP, yang
// memprioritaskan X-Forwarded-For).
async function buyerHeaders(): Promise<Record<string, string>> {
  const h = await headers();
  const fwd: Record<string, string> = {};
  const ua = h.get("user-agent");
  if (ua) fwd["User-Agent"] = ua;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined;
  if (ip) fwd["X-Forwarded-For"] = ip;
  return fwd;
}

function revalidateStaffViews() {
  revalidatePath("/owner/verify");
  revalidatePath("/owner/transactions");
  revalidatePath("/cashier");
}

/** Konfirmasi KUAT dari HP pembeli: tanda tangan + nama + waktu + perangkat. */
export async function confirmByCode(input: {
  code: string;
  buyerName?: string;
  signatureData: string;
}): Promise<PublicActionResult> {
  // Pemeriksaan cepat untuk UX (tanpa round-trip); Go tetap memvalidasi
  // ulang secara otoritatif di sisi server.
  if (!isValidSignatureData(input.signatureData)) {
    return { ok: false, error: "Tanda tangan belum digambar." };
  }
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kode tidak dikenali." };

  const res = await goPublic<{ message: string }>(
    `/public/receipt/${encodeURIComponent(code)}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        buyer_name: (input.buyerName ?? "").trim().slice(0, 40),
        signature_data: input.signatureData,
      }),
      headers: await buyerHeaders(),
    },
  );
  if (!res.ok) return { ok: false, error: res.message };

  // Halaman /verify/[code] itu dinamis (no-store), jadi router.refresh()
  // di klien sudah cukup untuk pembeli — revalidasi ini untuk konsol
  // staf yang menampilkan status serah terima.
  revalidateStaffViews();
  return { ok: true };
}

/** Pembeli membantah: "saya tidak pernah terima". Tercatat permanen. */
export async function disputeByCode(input: {
  code: string;
  reason?: string;
}): Promise<PublicActionResult> {
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kode tidak dikenali." };

  const res = await goPublic<{ message: string }>(
    `/public/receipt/${encodeURIComponent(code)}/dispute`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: (input.reason ?? "").trim().slice(0, 200),
      }),
      headers: await buyerHeaders(),
    },
  );
  if (!res.ok) return { ok: false, error: res.message };

  revalidateStaffViews();
  return { ok: true };
}
