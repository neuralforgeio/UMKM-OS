// lib/backup.ts — RUN-7: Cadangan Data + Status Salinan Database.
//
// Jembatan server-side ke endpoint admin backend (2.1.0):
//   GET  /admin/db-status            -> potret node aktif + riwayat pindah
//   POST /admin/backup/run           -> cadangkan SEKARANG (tombol)
//   GET  /admin/backup               -> daftar berkas cadangan
//   POST /admin/backup/{nama}/restore -> pulihkan cadangan
// Semua dipanggil dari server component / server action Pengaturan;
// token Bearer berasal dari sesi (OWNER/DEVELOPER), tidak dari browser.
//
// Bentuk JSON mengikuti kontrak handler backup.go — dipetakan ke tipe
// di sini supaya UI dan tes mengunci kontrak dari kedua sisi (pelajaran
// run-3: mapper frontend dan tag JSON backend harus bertemu di test).

export type DbNodeStatus = {
  nama: string;
  url: string;
  aktif: boolean;
};

export type PindahanNode = {
  waktu: string;
  ke: string;
  sebab: string;
  gagal: number;
  baris: number;
};

export type DbStatus = {
  app_version: string;
  node_aktif: string;
  node_name: string;
  salinan_aktif: boolean;
  riwayat_pindahan: PindahanNode[];
  backup_terakhir: string[];
  backup_interval_s: number;
  backup_keep: number;
  node: DbNodeStatus[];
};

export type BerkasBackup = {
  nama: string;
  ukuran: number;
  dibuat: string;
};

export type HasilBackup = {
  nama: string;
  ukuran: number;
  terhapus_retensi: number;
  node: string;
  dibuat: string;
};

// formatUkuran: byte -> "1,2 MB" (manusia, bukan mesin).
export function formatUkuran(byte: number): string {
  if (byte >= 1024 * 1024) {
    return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  if (byte >= 1024) {
    return `${Math.round(byte / 1024)} KB`;
  }
  return `${byte} B`;
}

// labelNode: "pusat" -> "Pusat" dengan penanda jelas untuk UI.
export function labelNode(node: string): string {
  if (node === "salinan") return "Salinan";
  return "Pusat";
}

// pesanSebab: terjemahkan sebab perpindahan ke satu kalimat pendek.
export function pesanSebab(p: PindahanNode): string {
  if (p.ke === "pusat" && p.baris > 0) {
    return `Sinkron balik selesai — ${p.baris} baris zaman-salinan dipulangkan ke pusat`;
  }
  if (p.ke === "pusat") {
    return "Pusat pulih — peran diambil kembali setelah sinkron balik";
  }
  return p.sebab;
}
