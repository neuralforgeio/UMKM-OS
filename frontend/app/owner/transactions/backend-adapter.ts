// Adapter murni untuk halaman Transaksi pemilik (server component).
// Berisi: tipe bentuk respons Go (snake_case persis tag JSON handler),
// mapper ke bentuk komponen klien, dan penerjemah kegagalan backend
// menjadi pesan yang BISA DITAMPILKAN — bukan exception.
//
// Kenapa file terpisah: page.tsx mengimpor next/navigation (server-only)
// sehingga tidak bisa diuji vitest langsung; fungsi murni di file ini
// dikunci lewat tests/transactions-page.test.ts.
//
// Latar bug yang diperbaiki di sini (rilis publik sebentar lagi):
//   * React error #441 (Server Components render melempar) — dulu semua
//     kegagalan backend di tengah halaman melempar Error(); di build
//     produksi Next.js 16 pesan asli disembunyikan jadi "#441 + digest"
//     sehingga pemilik tidak tahu harus melakukan apa. Kini halaman
//     SELALU berhasil dirender: bila backend bermasalah, panel diagnosis
//     dengan penyebab nyata + langkah pemulihannya yang tampil.
//   * Kartu laba NaN — ProfitSummary Go pernah berkirim camelCase
//     sementara mapper membaca snake_case; tag JSON Go kini snake_case
//     dan bentuk itu dikunci lewat tipe GoProfitSummary di bawah.

import type { ProfitSummary, TransactionRow } from "./types";

// Bentuk baris GET /transactions (backend Go handler.TransactionSummary).
export type GoTransactionRow = {
  id: number;
  receipt_no: string;
  created_at: string;
  payment_method: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  item_count: number;
  cashier_name: string;
  claim_code: string | null;
  handover_status: string | null;
};

// Bentuk baris produk GET /reports/profit (backend Go handler.ProfitProductRow,
// tag JSON snake_case sejak era go murni — sebelumnya camelCase dan tidak
// pernah ada konsumen yang membacanya, akar kartu laba NaN).
export type GoProfitProductRow = {
  product_id: number;
  name: string;
  unit: string;
  sold_quantity: number;
  revenue_rupiah: number;
  cost_rupiah: number;
  profit_rupiah: number;
  margin_pct: number | null;
};

export type GoProfitSummary = {
  period_days: number;
  transaction_count: number;
  omzet_rupiah: number;
  cost_rupiah: number;
  profit_rupiah: number;
  margin_pct: number | null;
  rows: GoProfitProductRow[];
};

export type GoProfitEnvelope = {
  week: GoProfitSummary;
  month: GoProfitSummary;
};

// Hasil goFetch tanpa mengimpor lib/api (server-only) — bentuk yang sama.
export type GoCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

// Pemetaan murni snake_case Go -> bentuk camelCase komponen klien;
// transactions-client.tsx dan types.ts tidak berubah sama sekali.
export function mapGoProfit(s: GoProfitSummary): ProfitSummary {
  return {
    periodDays: s.period_days,
    transactionCount: s.transaction_count,
    omzetRupiah: s.omzet_rupiah,
    costRupiah: s.cost_rupiah,
    profitRupiah: s.profit_rupiah,
    marginPct: s.margin_pct,
    rows: s.rows.map((row) => ({
      productId: String(row.product_id),
      name: row.name,
      unit: row.unit,
      soldQuantity: row.sold_quantity,
      revenueRupiah: row.revenue_rupiah,
      costRupiah: row.cost_rupiah,
      profitRupiah: row.profit_rupiah,
      marginPct: row.margin_pct,
    })),
  };
}

export function mapGoTransactionRow(row: GoTransactionRow): TransactionRow {
  return {
    id: String(row.id),
    code: row.receipt_no,
    createdAtIso: row.created_at,
    paymentMethod: row.payment_method,
    status: row.status,
    subtotalRupiah: Math.round(row.subtotal),
    discountRupiah: Math.round(row.discount),
    totalRupiah: Math.round(row.total),
    itemCount: row.item_count,
    // || (bukan ??): nama kosong dari database juga jatuh ke tanda strip
    cashierName: row.cashier_name || "-",
    claimCode: row.claim_code,
    handoverStatus: row.handover_status,
  };
}

// Diagnosis kegagalan memuat data — null berarti semua sehat dan halaman
// dirender normal. Pesan berbahasa Indonesia dengan langkah pemulihan
// yang bisa diikuti pemilik warung tanpa membuka terminal.
export type LoadFailure = {
  title: string;
  detail: string;
};

export function describeLoadFailure(
  list: GoCallResult<unknown>,
  profit: GoCallResult<Partial<GoProfitEnvelope> | null>,
): LoadFailure | null {
  // Sesi kedaluwarsa/ditolak: token Go di cookie NextAuth sudah basi
  // (backend restart, TTL habis). Paling sering terjadi setelah rebuild
  // container — pemilik cukup keluar lalu masuk lagi.
  for (const r of [list, profit]) {
    if (!r.ok && (r.status === 401 || r.status === 403)) {
      return {
        title: "Sesi Anda sudah berakhir",
        detail:
          "Sesi login Anda sudah tidak berlaku (kemungkinan setelah backend " +
          "dinyalakan ulang). Silakan keluar lalu masuk lagi — data transaksi " +
          "Anda tidak ada yang hilang.",
      };
    }
  }

  // Backend tidak terjangkau sama sekali (fetch gagal, status 0).
  for (const r of [list, profit]) {
    if (!r.ok && r.status === 0) {
      return {
        title: "Backend belum berjalan",
        detail:
          "Aplikasi kasir tidak bisa menghubungi backend Go di port 8080. " +
          "Jalankan docker compose up -d --build, tunggu sampai container " +
          "backend berstatus healthy (± 1 menit), lalu muat ulang halaman ini.",
      };
    }
  }

  // Backend menjawab dengan galat HTTP lain (mis. 500 dari database).
  for (const r of [list, profit]) {
    if (!r.ok) {
      return {
        title: "Backend menolak permintaan (HTTP " + r.status + ")",
        detail:
          "Pesan dari backend: " + r.message +
          ". Bila berlanjut, restart container: docker compose restart backend, " +
          "lalu muat ulang halaman ini.",
      };
    }
  }

  // Kedua panggilan sukses tapi bentuk data tidak seperti era go murni —
  // hampir pasti image lama masih berjalan di port 8080.
  const listOk = list.ok && Array.isArray(list.data);
  const profitOk =
    profit.ok &&
    profit.data !== null &&
    typeof profit.data === "object" &&
    profit.data.week !== undefined &&
    profit.data.month !== undefined;
  if (!listOk || !profitOk) {
    return {
      title: "Backend lama masih berjalan",
      detail:
        "Backend di port 8080 menjawab dengan bentuk data lama. Jalankan " +
        "docker compose up -d --build supaya image Go terbaru terpasang, " +
        "lalu muat ulang halaman ini.",
    };
  }

  return null;
}
