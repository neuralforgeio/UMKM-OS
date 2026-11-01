// Riwayat perubahan UMKM OS (terbaru 1.2.0), murni data tanpa React
// supaya bisa diuji vitest dan dipakai tombol Changelog di topbar.
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
    versi: "1.2.0",
    tanggal: "2026-11-01",
    judul: "OSCAR AI Bebas: menjawab apa saja + data warung",
    butir: [
      "OSCAR kini menjawab pertanyaan APA PUN (hitungan seperti satu tambah satu, pengetahuan umum, ide, basa-basi) memakai kecerdasan penuh model AI cloud-nya; system prompt lama yang memaksa jawaban hanya dari data warung sudah diganti prompt dwi-mode: pertanyaan bebas dijawab pengetahuan umum, pertanyaan bisnis warung tetap wajib berbasis data.",
      "Peringatan angka tidak lagi muncul untuk pertanyaan mudah: validasi angka kini hanya berjalan untuk pertanyaan bisnis warung (omzet, stok, produk, ramalan, saran, jam ramai) sehingga jawaban seperti lima tambah lima sama sepuluh tidak lagi dicap gagal validasi data.",
      "OSCAR selalu membaca data terbaru: tanggal hari ini disuntikkan ke setiap prompt dan data warung diambil langsung dari database pada setiap pertanyaan (bukan salinan basi), jadi jawaban bisnis selalu memakai kondisi terkini toko Anda.",
      "Perbaikan klasifikasi tersembunyi: kata sapaan singkat (p, hi) dan pujian singkat (top) kini hanya cocok sebagai kata utuh; dulu mereka menelan kata biasa (beraPA, HItung, lapTOP) sehingga pertanyaan bebas salah dikategorikan.",
      "Anggaran jawaban dinaikkan (maks token 400 menjadi 700) supaya jawaban pengetahuan umum tidak terpotong, dan chip contoh baru Hitung diskon 20% dari Rp 50.000 memamerkan jalur hitungan bebas di panel obrolan.",
    ],
  },
  {
    versi: "1.1.1",
    tanggal: "2026-11-01",
    judul: "Perbaikan obrolan OSCAR + pemeriksaan server tenang",
    butir: [
      "Perbaikan bug obrolan OSCAR gagal sejak pesan kedua (HTTP 502 LLM menolak HTTP 400): riwayat percakapan tersimpan dengan peran huruf besar (USER/ASSISTANT) sementara penyedia Groq hanya menerima huruf kecil - kini dinormalkan dua lapis (pembangun pesan dan klien) dan dijaga 5 test baru.",
      "Laptop tidak lagi sibuk memeriksa server: probe /health dari tiap 10 detik menjadi tiap 60 detik, dan probe itu sendiri tidak lagi menulis baris log (dulu 3 baris per probe: konsol docker, file .log, dan .csv).",
      "Boot tetap cepat: selama 30 detik pertama probe berjalan tiap 2-3 detik (start_interval), setelah itu jarang - service saling menunggu tidak lebih lama dari sebelumnya.",
      "Skrip pemasangan kini membuktikan perbaikannya langsung: uji pesan peran huruf besar (ditolak penyedia) vs pesan ternormalisasi (diterima) dicetak di konsol saat pemasangan.",
    ],
  },
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
