"use server";
// Aksi verifikasi struk v3 untuk staf yang LOGIN (owner / kasir /
// developer) — kini sepenuhnya ke backend-go v1.3.0:
//   GET  /api/v1/queue                      -> antrean penyajian
//   POST /api/v1/transactions/{id}/serve    -> mark served (dine-in)
//   POST /api/v1/transactions/{id}/confirm  -> tanda tangan pembeli in-app
//   POST /api/v1/transactions/{id}/claim    -> klaim kurir (tanpa ttd)
// Seluruh transisi status, jejak handover_events, dan audit_logs
// dikelola atomik oleh Go; file ini jembatan tipis + penerusan
// identitas perangkat staf.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { isValidSignatureData } from "@/lib/handover";

export type HandoverActionResult = { ok: true } | { ok: false; error: string };

// Satu baris Antrean Penyajian — transaksi hari ini yang belum
// ditandai SERVED. Serial murni supaya bisa melewati server/client
// boundary tanpa transformasi.
export type ServeQueueRow = {
  id: string;
  code: string;
  createdAtIso: string;
  itemCount: number;
  totalRupiah: number;
  paymentMethod: string;
};

async function requireStaff() {
  const session = await auth();
  const u = session?.user;
  if (
    !u ||
    !u.goToken ||
    (u.role !== "OWNER" && u.role !== "KASIR" && u.role !== "DEVELOPER")
  )
    return null;
  // goToken di-narrow di sini supaya pemanggil mendapat tipe string,
  // bukan string | undefined dari augmentasi sesi next-auth.
  return { goToken: u.goToken };
}

// Identitas staf diteruskan ke backend-go lewat header supaya jejak di
// handover_events mencatat perangkat + IP asli operator (Go membacanya
// dari r.UserAgent() dan middleware.ClientIP).
async function staffHeaders(): Promise<Record<string, string>> {
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

function revalidateAll(txId: string) {
  revalidatePath("/owner/verify");
  revalidatePath(`/owner/verify/${txId}`);
  revalidatePath("/cashier");
  revalidatePath("/owner");
  revalidatePath("/owner/transactions");
}

// Bentuk baris GET /queue (handover.go ServeQueue).
type GoQueueRow = {
  id: number;
  receipt_no: string;
  claim_code: string | null;
  created_at: string;
  item_count: number;
  total: number;
  payment_method: string;
};

/**
 * ANTREAN PENYAJIAN (anti-lupa): transaksi HARI INI (WIB) yang masih
 * COMPLETED dan belum punya aktivitas serah terima apa pun — dihitung
 * oleh backend-go sesuai zona waktu warung. Dipanggil dari server render
 * halaman kasir/konsol DAN di-poll ringan oleh komponen klien tiap 30
 * detik.
 */
export async function getServeQueue(): Promise<ServeQueueRow[]> {
  try {
    const staff = await requireStaff();
    if (!staff) return [];

    const res = await goFetch<GoQueueRow[]>(staff.goToken, "/queue", {
      headers: await staffHeaders(),
    });
    if (!res.ok) return [];

    return res.data.map((r) => ({
      id: String(r.id),
      code: r.receipt_no,
      createdAtIso: r.created_at,
      itemCount: r.item_count,
      totalRupiah: Math.round(r.total),
      paymentMethod: r.payment_method,
    }));
  } catch (e) {
    console.error("getServeQueue:", e);
    return [];
  }
}

function requireTxId(
  transactionId: string,
): { error: string } | { id: string } {
  if (typeof transactionId !== "string" || !/^\d+$/.test(transactionId)) {
    return { error: "ID transaksi tidak valid." };
  }
  return { id: transactionId };
}

/**
 * MARK SERVED (pintu utama v3 dine-in): pesanan diserahkan/disajikan.
 * SATU ARAH — tidak ada tombol batal; jejak STAFF_SERVE berisi siapa,
 * kapan, dan perangkat apa. Hanya berlaku dari status kosong (belum ada
 * aktivitas serah terima). Pesan error Go sudah ramah-staf dan spesifik
 * per status — diteruskan apa adanya.
 */
export async function markServed(input: {
  transactionId: string;
  note?: string;
}): Promise<HandoverActionResult> {
  const staff = await requireStaff();
  if (!staff)
    return { ok: false, error: "Harus login sebagai owner atau kasir." };
  const tx = requireTxId(input.transactionId);
  if ("error" in tx) return { ok: false, error: tx.error };

  const res = await goFetch<{ message: string }>(
    staff.goToken,
    `/transactions/${tx.id}/serve`,
    {
      method: "POST",
      body: JSON.stringify({ note: (input.note ?? "").trim().slice(0, 200) }),
      headers: await staffHeaders(),
    },
  );
  if (!res.ok) return { ok: false, error: res.message };

  revalidateAll(tx.id);
  return { ok: true };
}

/**
 * KONFIRMASI KUAT (opsi v2/v3): pembeli tanda tangan LANGSUNG di layar
 * staf yang sedang login — misal untuk takeaway/online, atau menambah
 * bukti kuat setelah pesanan disajikan.
 */
export async function confirmHandoverInApp(input: {
  transactionId: string;
  buyerName?: string;
  signatureData: string;
}): Promise<HandoverActionResult> {
  // Pemeriksaan cepat untuk UX; Go memvalidasi ulang secara otoritatif.
  if (!isValidSignatureData(input.signatureData)) {
    return { ok: false, error: "Tanda tangan pembeli belum digambar." };
  }
  const staff = await requireStaff();
  if (!staff)
    return { ok: false, error: "Harus login sebagai owner atau kasir." };
  const tx = requireTxId(input.transactionId);
  if ("error" in tx) return { ok: false, error: tx.error };

  const res = await goFetch<{ message: string }>(
    staff.goToken,
    `/transactions/${tx.id}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        buyer_name: (input.buyerName ?? "").trim().slice(0, 40),
        signature_data: input.signatureData,
      }),
      headers: await staffHeaders(),
    },
  );
  if (!res.ok) return { ok: false, error: res.message };

  revalidateAll(tx.id);
  return { ok: true };
}

/**
 * KONFIRMASI LEMAH (fallback): staf menandai "sudah diantar" TANPA
 * tanda tangan pembeli. Tercatat siapa + kapan + perangkat. Kalau
 * pembeli kemudian membantah dari HP-nya, status jadi DISPUTED.
 */
export async function claimDelivered(input: {
  transactionId: string;
  note?: string;
}): Promise<HandoverActionResult> {
  const staff = await requireStaff();
  if (!staff)
    return { ok: false, error: "Harus login sebagai owner atau kasir." };
  const tx = requireTxId(input.transactionId);
  if ("error" in tx) return { ok: false, error: tx.error };

  const res = await goFetch<{ message: string }>(
    staff.goToken,
    `/transactions/${tx.id}/claim`,
    {
      method: "POST",
      body: JSON.stringify({ note: (input.note ?? "").trim().slice(0, 200) }),
      headers: await staffHeaders(),
    },
  );
  if (!res.ok) return { ok: false, error: res.message };

  revalidateAll(tx.id);
  return { ok: true };
}
