// Riwayat perubahan UMKM OS v1.1.0, murni data tanpa React supaya bisa
// diuji vitest dan dipakai tombol Changelog di topbar.
//
// Satu sumber kebenaran untuk daftar versi yang tampil ke pengguna.
// Versi produk bernomor publik sejak 1.0.0 (rilis internal sebelumnya
// ditutup); entri disusun dari TERBARU ke TERLAMA. Tanggal memakai
// format ISO supaya mudah diurut dan diterjemahkan formatTanggalId().

export type EntriChangelog = {
  versi: string;
  tanggal: string; // ISO "YYYY-MM-DD"
  judul: string;
  butir: string[];
};

export const CHANGELOG: EntriChangelog[] = [
  {
    versi: "1.1.0",
    tanggal: "2026-11-01",
    judul: "OSCAR murni AI + sidebar ringkas",
    butir: [
      "OSCAR kini murni obrolan AI (Groq): jawaban template buatan sendiri dimatikan; bila sambungan AI gagal, pesan galat jujur tampil beserta tombol kirim ulang.",
      "API key Groq yang baru ditanam di env dan konfigurasi layanan AI (tidak pernah masuk git).",
      "Halaman OSCAR didesain ulang seperti obrolan AI pada umumnya: kolom terpusat, gelembung pesan berpenanda waktu, tanpa panel model.",
      "Sidebar: kartu Tanya OSCAR dihapus sehingga seluruh menu terlihat tanpa harus menggulir.",
      "Tombol ringkatkan panel kini ikon di pojok kanan atas sidebar dan bisa juga dipakai lewat pintasan Ctrl+B.",
      "Topbar: tombol Changelog dan jam WIB menggantikan menu profil; profil, ganti tema, dan keluar kini ada di menu akun pada dasar sidebar.",
      "Perbaikan run-2: font Geist, Geist Mono, dan Plus Jakarta Sans kini self-host (dibundel di aplikasi) sehingga docker build tidak lagi mengunduh berkas font dari Google Fonts - inilah akar kegagalan pemasangan pertama.",
    ],
  },
  {
    versi: "1.0.0",
    tanggal: "2026-10-31",
    judul: "Shell operasional + OSCAR Groq LIVE",
    butir: [
      "Shell baru untuk seluruh halaman konsol: sidebar yang bisa diringkatkan, logo warung dirender satu komponen, topbar remah roti plus judul halaman.",
      "OSCAR berjudul panjang Online Shop Center for Assistance & Response dan tersambung ke Groq dengan tombol Tes Koneksi di Pengaturan.",
      "Kit antarmuka buatan sendiri: toast, alert, grafik SVG murni, dan jam lokal WIB.",
    ],
  },
];

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function versiTerbaru(): string {
  return CHANGELOG[0]?.versi ?? "0.0.0";
}

export function cariEntri(versi: string): EntriChangelog | null {
  return CHANGELOG.find((e) => e.versi === versi) ?? null;
}

export function formatTanggalId(iso: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!cocok) return iso;
  const bulan = NAMA_BULAN[Number(cocok[2]) - 1] ?? cocok[2];
  return `${Number(cocok[3])} ${bulan} ${cocok[1]}`;
}
