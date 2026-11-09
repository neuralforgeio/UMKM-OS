// Penjaga perilaku halaman Transaksi pemilik pasca-perbaikan rilis publik:
//
// 1) Kegagalan backend TIDAK lagi menjadi exception (React error #441 di
//    produksi) — describeLoadFailure menerjemahkannya jadi judul + langkah
//    pemulihan yang tampil di halaman.
// 2) Mapper membaca bentuk snake_case persis tag JSON handler Go
//    (ProfitSummary/ProfitProductRow) — mengunci kontrak supaya kartu laba
//    tidak kembali menampilkan NaN seperti saat tag Go masih camelCase.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeLoadFailure,
  mapGoProfit,
  mapGoTransactionRow,
  type GoCallResult,
  type GoProfitEnvelope,
  type GoTransactionRow,
} from "@/app/owner/transactions/backend-adapter";

const ok = <T,>(data: T): GoCallResult<T> => ({ ok: true, data });
const fail = (status: number, message: string) => ({ ok: false, status, message } as const);

const sehatProfit = (): GoProfitEnvelope => ({
  week: {
    period_days: 7,
    transaction_count: 12,
    omzet_rupiah: 340000,
    cost_rupiah: 200000,
    profit_rupiah: 140000,
    margin_pct: 41.2,
    rows: [
      {
        product_id: 4,
        name: "Kopi Susu Gula Aren",
        unit: "cup",
        sold_quantity: 20,
        revenue_rupiah: 140000,
        cost_rupiah: 80000,
        profit_rupiah: 60000,
        margin_pct: 42.9,
      },
    ],
  },
  month: {
    period_days: 30,
    transaction_count: 60,
    omzet_rupiah: 1500000,
    cost_rupiah: 900000,
    profit_rupiah: 600000,
    margin_pct: null,
    rows: [],
  },
});

const sehatList: GoTransactionRow[] = [
  {
    id: 7,
    receipt_no: "RCP-0007",
    created_at: "2026-11-08T09:30:00+07:00",
    payment_method: "QRIS",
    status: "COMPLETED",
    subtotal: 25000,
    discount: 2000,
    total: 23000,
    item_count: 2,
    cashier_name: "Rina",
    claim_code: null,
    handover_status: null,
  },
];

describe("describeLoadFailure (pengganti throw / React error #441)", () => {
  it("null saat list dan profit sehat", () => {
    expect(describeLoadFailure(ok(sehatList), ok(sehatProfit()))).toBeNull();
  });

  it("status 0 -> backend belum berjalan + perintah docker compose up", () => {
    const f = describeLoadFailure(fail(0, "Backend tidak merespons."), ok(sehatProfit()));
    expect(f).not.toBeNull();
    expect(f!.title).toContain("Backend belum berjalan");
    expect(f!.detail).toContain("docker compose up -d --build");
    expect(f!.detail).toContain("healthy");
  });

  it("401 -> sesi berakhir, arahkan keluar-masuk lagi (bukan #441)", () => {
    const f = describeLoadFailure(fail(401, "token kedaluwarsa"), ok(sehatProfit()));
    expect(f!.title).toContain("Sesi Anda sudah berakhir");
    expect(f!.detail).toContain("masuk lagi");
  });

  it("403 di panggilan kedua pun dikenali sebagai masalah sesi", () => {
    const f = describeLoadFailure(ok(sehatList), fail(403, "ditolak"));
    expect(f!.title).toContain("Sesi");
  });

  it("galat HTTP lain -> judul memuat kode status + pesan backend tampil", () => {
    const f = describeLoadFailure(fail(500, "Gagal menghitung laba 7 hari"), ok(sehatProfit()));
    expect(f!.title).toContain("HTTP 500");
    expect(f!.detail).toContain("Gagal menghitung laba 7 hari");
    expect(f!.detail).toContain("docker compose restart backend");
  });

  it("profit tanpa week/month -> didiagnosis backend lama, bukan exception", () => {
    const f = describeLoadFailure(
      ok(sehatList),
      ok({} as Partial<GoProfitEnvelope>),
    );
    expect(f!.title).toContain("Backend lama masih berjalan");
    expect(f!.detail).toContain("docker compose up -d --build");
  });

  it("list bukan array -> backend lama juga (bentuk tak dikenal)", () => {
    const f = describeLoadFailure(
      ok({ error: "unexpected" } as unknown as GoTransactionRow[]),
      ok(sehatProfit()),
    );
    expect(f!.title).toContain("Backend lama");
  });

  it("profit sukses tapi data null -> didiagnosis backend lama", () => {
    const f = describeLoadFailure(
      ok(sehatList),
      ok(null as unknown as GoProfitEnvelope),
    );
    expect(f!.title).toContain("Backend lama");
  });

  it("prioritas: sesi (401) didahulukan daripada backend mati (0)", () => {
    const f = describeLoadFailure(fail(401, "x"), fail(0, "y"));
    expect(f!.title).toContain("Sesi");
  });
});

describe("mapGoProfit (kontrak snake_case dengan tag JSON Go)", () => {
  it("memetakan semua field tanpa NaN", () => {
    const m = mapGoProfit(sehatProfit().week);
    expect(m.periodDays).toBe(7);
    expect(m.transactionCount).toBe(12);
    expect(m.omzetRupiah).toBe(340000);
    expect(m.costRupiah).toBe(200000);
    expect(m.profitRupiah).toBe(140000);
    expect(m.marginPct).toBe(41.2);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].productId).toBe("4");
    expect(m.rows[0].name).toBe("Kopi Susu Gula Aren");
    expect(m.rows[0].soldQuantity).toBe(20);
    expect(m.rows[0].revenueRupiah).toBe(140000);
    expect(m.rows[0].costRupiah).toBe(80000);
    expect(m.rows[0].profitRupiah).toBe(60000);
    expect(m.rows[0].marginPct).toBe(42.9);
  });

  it("margin_pct null tetap null (produk tanpa omzet)", () => {
    const m = mapGoProfit(sehatProfit().month);
    expect(m.marginPct).toBeNull();
    expect(m.rows).toEqual([]);
  });
});

describe("mapGoTransactionRow", () => {
  it("memetakan baris riwayat dengan id string dan pembulatan rupiah", () => {
    const r = mapGoTransactionRow({
      ...sehatList[0],
      subtotal: 25000.4,
      total: 23000.6,
    });
    expect(r.id).toBe("7");
    expect(r.code).toBe("RCP-0007");
    expect(r.subtotalRupiah).toBe(25000);
    expect(r.totalRupiah).toBe(23001);
    expect(r.cashierName).toBe("Rina");
    expect(r.paymentMethod).toBe("QRIS");
  });

  it("cashier_name kosong jatuh ke tanda strip", () => {
    const r = mapGoTransactionRow({ ...sehatList[0], cashier_name: "" });
    expect(r.cashierName).toBe("-");
  });
});

describe("penjaga sumber halaman (pra-rilis publik)", () => {
  const baca = (rel: string) =>
    readFileSync(join(__dirname, "..", rel), "utf8");

  it("page.tsx memakai panel diagnosis, bukan throw (akar React error #441)", () => {
    const isi = baca("app/owner/transactions/page.tsx");
    expect(isi).toContain("describeLoadFailure");
    expect(isi).toContain("BackendLoadPanel");
    expect(isi).not.toContain("throw new Error(listRes.message)");
    expect(isi).not.toContain("throw new Error(profitRes.message)");
  });

  it("error boundary segmen owner terpasang dengan unstable_rethrow + Coba Lagi", () => {
    const isi = baca("app/owner/error.tsx");
    expect(isi).toContain("unstable_rethrow");
    expect(isi).toContain("Coba Lagi");
    expect(isi).toContain("Kode galat");
  });
});
