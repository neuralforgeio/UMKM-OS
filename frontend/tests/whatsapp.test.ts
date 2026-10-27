// Test penjaga struk WhatsApp (frontend v2.4.0).
//
// Keluarga invariant: pesan struk ber-format benar (outlet, nomor,
// item, total, tautan verify), normalisasi nomor Indonesia ke bentuk
// wa.me, potong item > 30, encoding URL penuh.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DOM/jaringan.
// Regex ^...$ memakai \r? — file repo bisa ber-akhir CRLF (git
// autocrlf di Windows), tanpa itu "$" tak pernah cocok di baris CRLF.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_ITEMS_IN_MESSAGE,
  buildReceiptMessage,
  buildWhatsAppUrl,
  formatRupiahWa,
  normalizePhoneId,
  type OutletForWa,
  type ReceiptForWa,
} from "../lib/whatsapp";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

function strukContoh(itemTambahan = 0): ReceiptForWa {
  const items = [
    { name: "Kopi Susu", quantity: 2, priceAtSale: 12000, subtotal: 24000 },
    { name: "Teh Panas", quantity: 1, priceAtSale: 7000, subtotal: 7000 },
  ];
  for (let i = 0; i < itemTambahan; i += 1) {
    items.push({
      name: `Menu ${i + 1}`,
      quantity: 1,
      priceAtSale: 1000,
      subtotal: 1000,
    });
  }
  return {
    code: "TRX-20261027-0001",
    createdAt: "27/10/2026 10.15",
    paymentMethod: "CASH",
    subtotal: 31000,
    discount: 1000,
    total: 30000,
    paidAmount: 50000,
    changeAmount: 20000,
    items,
    claimCode: "ABCDEFGH",
  };
}

const outletContoh: OutletForWa = {
  name: "Warung Sari",
  address: "Jl. Melati No. 10",
  phone: "0812-3456-7890",
};

describe("lib/whatsapp.ts — format pesan struk", () => {
  it("pesan memuat nama outlet (tebal), alamat, telepon", () => {
    const pesan = buildReceiptMessage(strukContoh(), outletContoh);
    expect(pesan).toContain("*WARUNG SARI*");
    expect(pesan).toContain("Jl. Melati No. 10");
    expect(pesan).toContain("Telp 0812-3456-7890");
  });

  it("pesan memuat nomor struk + waktu WIB", () => {
    const pesan = buildReceiptMessage(strukContoh(), outletContoh);
    expect(pesan).toContain("No. Struk: TRX-20261027-0001");
    expect(pesan).toContain("27/10/2026 10.15 WIB");
  });

  it("baris item berformat 'nama — qty x harga = subtotal'", () => {
    const pesan = buildReceiptMessage(strukContoh(), outletContoh);
    expect(pesan).toContain("Kopi Susu — 2 x Rp 12.000 = Rp 24.000");
    expect(pesan).toContain("Teh Panas — 1 x Rp 7.000 = Rp 7.000");
  });

  it("total ditebalkan; subtotal, diskon, kembalian ikut", () => {
    const pesan = buildReceiptMessage(strukContoh(), outletContoh);
    expect(pesan).toContain("Subtotal: Rp 31.000");
    expect(pesan).toContain("Diskon: -Rp 1.000");
    expect(pesan).toContain("*Total: Rp 30.000*");
    expect(pesan).toContain("Kembalian: Rp 20.000");
  });

  it("diskon disembunyikan bila nol", () => {
    const struk = strukContoh();
    struk.discount = 0;
    const pesan = buildReceiptMessage(struk, outletContoh);
    expect(pesan).not.toContain("Diskon:");
  });

  it("metode pembayaran memakai label Indonesia", () => {
    const struk = strukContoh();
    struk.paymentMethod = "QRIS";
    expect(buildReceiptMessage(struk, outletContoh)).toContain(
      "Dibayar (QRIS): Rp 50.000",
    );
    struk.paymentMethod = "DEBIT";
    expect(buildReceiptMessage(struk, outletContoh)).toContain(
      "Dibayar (Debit): Rp 50.000",
    );
  });

  it("tautan verify + kode klaim tampil bila keduanya ada", () => {
    const pesan = buildReceiptMessage(
      strukContoh(),
      outletContoh,
      "https://warung.local/verify/ABCDEFGH",
    );
    expect(pesan).toContain("https://warung.local/verify/ABCDEFGH");
    expect(pesan).toContain("(kode klaim: ABCDEFGH)");
  });

  it("tanpa kode klaim => tanpa blok verify (struk era lama)", () => {
    const struk = strukContoh();
    struk.claimCode = null;
    const pesan = buildReceiptMessage(struk, outletContoh, "https://x/verify");
    expect(pesan).not.toContain("kode klaim");
    expect(pesan).not.toContain("https://x/verify");
  });

  it("penutup berterima kasih", () => {
    expect(buildReceiptMessage(strukContoh(), outletContoh)).toContain(
      "Terima kasih",
    );
  });

  it("lebih dari 30 item diringkas dengan hitungan sisa", () => {
    const struk = strukContoh(35); // 37 item total
    const pesan = buildReceiptMessage(struk, outletContoh);
    expect(pesan).toContain("… dan 7 item lainnya");
    expect(pesan).not.toContain("Menu 35");
  });

  it(`tepat ${MAX_ITEMS_IN_MESSAGE} item TIDAK diringkas`, () => {
    const struk = strukContoh(28); // 30 item total
    const pesan = buildReceiptMessage(struk, outletContoh);
    expect(pesan).toContain("Menu 28");
    expect(pesan).not.toContain("item lainnya");
  });

  it("formatRupiahWa memakai titik ribuan", () => {
    expect(formatRupiahWa(30000)).toBe("Rp 30.000");
    expect(formatRupiahWa(1250000)).toBe("Rp 1.250.000");
    expect(formatRupiahWa(0)).toBe("Rp 0");
  });
});

describe("lib/whatsapp.ts — normalisasi nomor & tautan wa.me", () => {
  it("08xx Indonesia menjadi 628xx", () => {
    expect(normalizePhoneId("081234567890")).toBe("6281234567890");
  });

  it("+62 / spasi / strip dibersihkan", () => {
    expect(normalizePhoneId("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneId("0812 3456 7890")).toBe("6281234567890");
  });

  it("sudah internasional dibiarkan apa adanya", () => {
    expect(normalizePhoneId("6281234567890")).toBe("6281234567890");
    expect(normalizePhoneId("+14155551234")).toBe("14155551234");
  });

  it("tanpa nomor => wa.me/?text= (pemilih kontak di WhatsApp)", () => {
    const url = buildWhatsAppUrl("pesan");
    expect(url).toBe("https://wa.me/?text=pesan");
  });

  it("dengan nomor => wa.me/{nomor}?text=", () => {
    const url = buildWhatsAppUrl("pesan", "081234567890");
    expect(url).toBe("https://wa.me/6281234567890?text=pesan");
  });

  it("pesan di-encode penuh (spasi, baris baru, bintang)", () => {
    const url = buildWhatsAppUrl("*Total*\nRp 30.000");
    expect(url).toContain(encodeURIComponent("*Total*\nRp 30.000"));
  });

  it("nomor kosong/whitespace diperlakukan tanpa nomor", () => {
    expect(buildWhatsAppUrl("x", "   ")).toBe("https://wa.me/?text=x");
  });
});

describe("receipt-view memakai jalur WhatsApp", () => {
  it("tombol 'Kirim via WhatsApp' ada di layar sukses kasir", () => {
    const isi = baca("app/cashier/receipt-view.tsx");
    expect(isi).toContain("Kirim via WhatsApp");
    expect(isi).toContain("buildWhatsAppUrl");
    expect(isi).toContain("buildReceiptMessage");
  });

  it("tautan verify memakai origin runtime + kode klaim", () => {
    const isi = baca("app/cashier/receipt-view.tsx");
    expect(isi).toContain("window.location.origin");
    expect(isi).toContain("/verify/");
    expect(isi).toContain("receipt.claimCode");
  });

  it("tombol tidak ikut tercetak (print:hidden)", () => {
    const isi = baca("app/cashier/receipt-view.tsx");
    // blok aksi berada dalam section print:hidden — cukup pastikan
    // section aksi tetap print:hidden (penjaga regresi cetak struk).
    expect(isi).toMatch(/<section className="space-y-6 print:hidden">/);
  });
});

describe("kontrak lintas-stack v2.4.0 tetap utuh", () => {
  it("backend-go migrasi #12 membuat tabel chat_history", () => {
    const isi = bacaRepo("backend-go/internal/db/db.go");
    expect(isi).toContain("CREATE TABLE IF NOT EXISTS chat_history");
    expect(isi).toContain("role TEXT NOT NULL CHECK (role IN ('USER','ASSISTANT'))");
    expect(isi).toContain("idx_chat_history_user_time");
  });

  it("backend-go naik ke 1.8.0", () => {
    expect(bacaRepo("backend-go/internal/config/config.go")).toContain(
      'const AppVersion = "1.8.0"',
    );
    expect(bacaRepo("backend-go/VERSIONS.csv")).toContain(
      "1.8.0,2026-10-27,MINOR",
    );
  });

  it("ml-service naik ke 3.1.0 + router assistant terpasang", () => {
    expect(bacaRepo("backend/VERSIONS.csv")).toContain(
      "3.1.0,2026-10-27,FITUR",
    );
    const v1 = bacaRepo("backend/app/api/v1.py");
    expect(v1).toContain("from app.api.routes import assistant, forecast, health");
    expect(v1).toContain("router.include_router(assistant.router)");
  });

  it("frontend VERSIONS.csv memuat 2.4.0", () => {
    expect(bacaRepo("frontend/VERSIONS.csv")).toContain(
      "2.4.0,2026-10-27,MINOR",
    );
  });
});
