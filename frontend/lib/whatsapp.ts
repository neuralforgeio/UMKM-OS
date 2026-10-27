// Utilitas struk WhatsApp (frontend v2.4.0) — 100% murni & teruji.
//
// Blueprint minggu-11: struk digital ringkas lewat tautan wa.me —
// kasir menekan satu tombol, memilih kontak pembeli di WhatsApp
// (nomor pembeli TIDAK pernah disimpan aplikasi), lalu mengirim pesan
// struk ber-format + tautan verifikasi /verify/{kode} tempat pembeli
// bisa cek/konfirmasi pesanan dari HP-nya sendiri.
//
// Semua fungsi murni tanpa DOM/jaringan supaya vitest menguji perilaku
// (format, normalisasi nomor, potong item) tanpa browser.

// Bentuk data yang dibutuhkan — subset tipe Receipt di kasir, dibuat
// terpisah supaya modul ini tidak mengimpor halaman (test-friendly).
export type ReceiptForWa = {
  code: string;
  createdAt: string;
  paymentMethod: "CASH" | "QRIS" | "DEBIT";
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  items: { name: string; quantity: number; priceAtSale: number; subtotal: number }[];
  claimCode: string | null;
};

export type OutletForWa = {
  name: string;
  address: string | null;
  phone: string | null;
};

// Batas item ditampilkan penuh; lebih dari itu pesan diringkas supaya
// WhatsApp Web tidak menelan struk 200 baris.
export const MAX_ITEMS_IN_MESSAGE = 30;

const PAYMENT_LABELS: Record<ReceiptForWa["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

// "12345" -> "12.345" (gaya Indonesia, tanpa awalan Rp).
export function formatAngkaId(nilai: number): string {
  return nilai.toLocaleString("id-ID");
}

// "Rp 12.345" — pemisah titik konsisten struk cetak.
export function formatRupiahWa(nilai: number): string {
  return `Rp ${formatAngkaId(nilai)}`;
}

// Normalisasi nomor HP Indonesia ke bentuk internasional TANPA "+" —
// format yang diminta wa.me: 0812 -> 62812, +62 812 -> 62812.
// Nomor sudah internasional (awalan 62) atau negara lain dibiarkan.
export function normalizePhoneId(phone: string): string {
  const bersih = phone.replace(/[\s\-().]/g, "");
  if (bersih.startsWith("+")) {
    return bersih.slice(1); // "+62812..." -> "62812..."
  }
  if (bersih.startsWith("62")) {
    return bersih;
  }
  if (bersih.startsWith("0")) {
    return `62${bersih.slice(1)}`; // "0812..." -> "62812..."
  }
  return bersih;
}

// Susun pesan struk bergaya bon thermal (asterisk = tebal di WhatsApp).
export function buildReceiptMessage(
  receipt: ReceiptForWa,
  outlet: OutletForWa,
  verifyUrl?: string,
): string {
  const baris: string[] = [];
  baris.push(`*${outlet.name.toUpperCase()}*`);
  if (outlet.address) baris.push(outlet.address);
  if (outlet.phone) baris.push(`Telp ${outlet.phone}`);
  baris.push("");
  baris.push(`No. Struk: ${receipt.code}`);
  baris.push(`Waktu: ${receipt.createdAt} WIB`);
  baris.push("");
  baris.push("*Item*");
  receipt.items.slice(0, MAX_ITEMS_IN_MESSAGE).forEach((item) => {
    baris.push(
      `${item.name} — ${item.quantity} x ${formatRupiahWa(item.priceAtSale)} = ${formatRupiahWa(item.subtotal)}`,
    );
  });
  if (receipt.items.length > MAX_ITEMS_IN_MESSAGE) {
    const sisa = receipt.items.length - MAX_ITEMS_IN_MESSAGE;
    baris.push(`… dan ${sisa} item lainnya`);
  }
  baris.push("");
  baris.push(`Subtotal: ${formatRupiahWa(receipt.subtotal)}`);
  if (receipt.discount > 0) {
    baris.push(`Diskon: -${formatRupiahWa(receipt.discount)}`);
  }
  baris.push(`*Total: ${formatRupiahWa(receipt.total)}*`);
  baris.push(`Dibayar (${PAYMENT_LABELS[receipt.paymentMethod]}): ${formatRupiahWa(receipt.paidAmount)}`);
  baris.push(`Kembalian: ${formatRupiahWa(receipt.changeAmount)}`);
  if (receipt.claimCode && verifyUrl) {
    baris.push("");
    baris.push("Cek / konfirmasi pesanan Anda di:");
    baris.push(verifyUrl);
    baris.push(`(kode klaim: ${receipt.claimCode})`);
  }
  baris.push("");
  baris.push("Terima kasih atas kunjungan Anda!");
  return baris.join("\n");
}

// Tautan wa.me. Tanpa nomor => pemilih kontak di WhatsApp (privasi:
// aplikasi tidak menyimpan nomor pembeli). Pesan di-encode penuh.
export function buildWhatsAppUrl(message: string, phone?: string): string {
  const teks = encodeURIComponent(message);
  if (phone && phone.trim()) {
    return `https://wa.me/${normalizePhoneId(phone)}?text=${teks}`;
  }
  return `https://wa.me/?text=${teks}`;
}
