// Penerjemah aksi audit -> bahasa manusia + tingkat keseriusan (Task 35).
//
// Permintaan pemilik: log developer tidak boleh hanya menampilkan nama
// method (LOGIN_FAILED) — harus terbaca "Login gagal", dan langsung
// kelihatan mana yang error/sensitif. Dua konsep:
//   1. LABEL — nama aksi dalam bahasa Indonesia yang enak dibaca,
//   2. LEVEL — SUKSES (hijau) / PERINGATAN (amber, aksi sensitif) /
//      GAGAL (merah, semua aksi berakhiran _FAILED).
// Satu file dipakai: halaman /dev/logs, konsol /dev, dan export XLSX.

export type LogLevel = "SUKSES" | "PERINGATAN" | "GAGAL";

// Aksi yang sah tapi sensitif — perlu menonjol saat di-scroll cepat.
const WARN_ACTIONS: string[] = [
  "ACCOUNT_DELETE",
  "ACCOUNT_PASSWORD_RESET",
  "TRANSACTION_REFUND",
  "STOCK_ADJUST",
  "DEV_MAINTENANCE_ENTER",
  "DEV_MAINTENANCE_EXIT",
];

export function actionLevel(action: string): LogLevel {
  if (action.endsWith("_FAILED")) return "GAGAL";
  if (WARN_ACTIONS.includes(action)) return "PERINGATAN";
  return "SUKSES";
}

// Dipakai filter "tingkat" di /dev/logs dan export: satu daftar supaya
// filter layar dan filter file tidak pernah berbeda pendapat.
export function warnActions(): string[] {
  return [...WARN_ACTIONS];
}

export function levelWhereHint(level: string): string | null {
  if (level === "SUKSES" || level === "PERINGATAN" || level === "GAGAL") {
    return level;
  }
  return null;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login berhasil",
  LOGIN_FAILED: "Login gagal",
  TRANSACTION_CREATE: "Transaksi dibuat",
  TRANSACTION_REFUND: "Transaksi di-refund",
  HANDOVER_SERVE: "Pesanan ditandai disajikan",
  HANDOVER_CONFIRM: "Penyerahan dikonfirmasi pembeli",
  HANDOVER_CLAIM: "Diklaim sudah diantar (staf)",
  STOCK_IN: "Stok masuk (restok)",
  STOCK_OUT: "Stok keluar",
  STOCK_ADJUST: "Stok disesuaikan manual",
  PRODUCT_CREATE: "Produk dibuat",
  PRODUCT_UPDATE: "Produk diubah",
  PRODUCT_DELETE: "Produk diarsipkan",
  SETTINGS_UPDATE: "Pengaturan outlet diperbarui",
  ACCOUNT_CREATE: "Akun dibuat",
  ACCOUNT_UPDATE: "Akun diubah",
  ACCOUNT_PASSWORD_RESET: "Password akun direset",
  ACCOUNT_SET_ACTIVE: "Status aktif akun diubah",
  ACCOUNT_DELETE: "Akun dihapus permanen",
  OUTLET_CREATE: "Outlet baru dibuat",
  DEV_MAINTENANCE_ENTER: "Developer masuk mode maintenance",
  DEV_MAINTENANCE_EXIT: "Developer keluar mode maintenance",
};

// Label aksi yang belum terdaftar: dicantumkan apa adanya supaya aksi baru
// tetap terbaca (bukan kosong) sebelum map diperbarui.
export function actionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  if (action.endsWith("_FAILED")) {
    const base = ACTION_LABELS[action.slice(0, -"_FAILED".length)];
    if (base) return `${base} — GAGAL`;
    return `Gagal: ${action}`;
  }
  return action;
}

// Kelas chip badge per tingkat — dipakai tabel log konsol & /dev/logs.
// Sadar tema (v1.6.0): tint terang (bg-*-50) di tema terang, tint gelap
// dengan teks pucat di tema gelap supaya tetap terbaca di dua-duanya.
export const LEVEL_BADGE: Record<LogLevel, string> = {
  SUKSES:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30",
  PERINGATAN:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30",
  GAGAL:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30",
};