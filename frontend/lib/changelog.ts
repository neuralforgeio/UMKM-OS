// Riwayat perubahan UMKM OS (terbaru 1.3.1), murni data tanpa React
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
    versi: "1.3.1",
    tanggal: "2026-11-07",
    judul: "Perbaikan pra-rilis: halaman Transaksi tangguh dan jujur",
    butir: [
      "Halaman Transaksi pemilik tidak lagi menampilkan halaman hitam misterius saat backend sedang bermasalah (React error #441): kegagalan kini diterjemahkan menjadi panel diagnosis berbahasa Indonesia yang menyebut penyebab nyata dan langkah pemulihannya — backend belum berjalan (dengan perintah docker compose yang perlu dijalankan), sesi login sudah berakhir (cukup keluar lalu masuk lagi), atau image backend lama masih berjalan (cara memperbaruinya).",
      "Kartu laba 7 hari dan 30 hari tidak lagi menampilkan angka NaN: bentuk data laporan laba dari backend kini diseragamkan dan dikunci lewat test, setelah sempat tidak cocok antara bentuk yang dikirim backend dan yang dibaca halaman sejak era layanan AI yang lama.",
      "Jaring pengaman error boundary baru untuk seluruh halaman pemilik: galat tak terduga lainnya menampilkan pesan ramah beserta kode galat singkat untuk laporan dan tombol Coba Lagi — bukan lagi kode error mentah yang harus diterjemahkan lewat DevTools.",
      "15 test baru mengunci perilaku halaman ini (penerjemahan tiap jenis kegagalan backend dan pemetaan data laba) supaya perbaikannya tidak mundur diam-diam.",
    ],
  },
  {
    versi: "1.3.0",
    tanggal: "2026-11-07",
    judul: "Era Go murni: satu backend untuk semuanya",
    butir: [
      "Layanan Python (FastAPI + Prophet) dihapus total: folder backend-go di-rename menjadi backend dan kini menjadi SATU-SATUNYA backend. Satu bahasa, satu image, satu perintah docker compose up — tidak ada lagi pip install atau dua API yang harus saling menunggu.",
      "OSCAR pindah rumah ke backend Go tanpa berubah perilaku: prompt dwi-mode AI Bebas, validasi angka khusus bisnis warung, riwayat obrolan, batas laju 12 pertanyaan per jam, cache jawaban 10 menit, dan tombol Tes Koneksi semuanya dijalankan kode Go (98 unittest murni baru menjaga perilakunya).",
      "OSCAR Developer AI ikut pindah: laporan lintas toko ber-PIN dan pelaporan proaktif 15 menit (stok kritis gabungan, omzet turun, toko diam) kini disusun langsung oleh Go — data toko lain tetap tidak pernah dikirim ke penyedia AI.",
      "Model AI bisa dikunci developer: saat terkunci, pengaturan model di Pengaturan - Asisten AI beku untuk pemilik dan hanya developer yang bisa membukanya, sehingga model warung tidak berubah tanpa sengaja.",
      "Jejak audit kini mencatat IP asli setiap aksi (dan kota asalnya untuk IP publik, bisa dimatikan lewat GEO_LOOKUP_ENABLED) plus SKU produk menjadi unik per outlet — dua cabang boleh sama-sama punya nomor PRD-0001.",
      "Ramalan pendapatan memakai mesin statistik Go (rata-rata bergerak + faktor hari) dengan angka MAPE jujur dari backtest; uji pemasangan kini menyertakan uji database sungguhan di dalam container (migrasi, SKU per outlet, riwayat chat, audit ber-IP) sebelum apa pun di-commit.",
    ],
  },
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
