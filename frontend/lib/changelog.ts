// Riwayat perubahan UMKM OS (terbaru 1.7.0), murni data tanpa React
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
    versi: "1.8.0",
    tanggal: "2026-11-20",
    judul: "Perbaikan bug produksi + toast & dialog custom + 60 fitur logika baru",
    butir: [
      "BUG PRODUKSI: periksa jaringan selalu gagal 400 karena port default 5432 padahal Postgres dipetakan 5433 (pusat) dan 5434 (salinan) di docker compose. Default kini 5433 plus 4 tombol cepat (DB pusat, DB salinan, backend, db dalam Docker), port hanya angka, dan koneksi yang ditolak kini balasan 502 dengan pesan penunjuk arah (bukan 400 yang menyesatkan).",
      "BUG PRODUKSI (laporan issues): alasan refund, catatan serah terima, dan nama pembeli terpotong per byte sehingga karakter beraksen atau em dash bisa terbelah dan ditolak Postgres (invalid byte sequence). Pemotongan kini per karakter (rune) di paket textutil, hasil selalu UTF-8 valid, sama dengan batas jumlah huruf di form; terbukti refund dengan alasan em dash dan emoji tersimpan mulus.",
      "TOAST & DIALOG SENDIRI: alert, confirm, dan prompt bawaan browser (tampak jelek untuk produk nyata) seluruhnya diganti: konfirmasi hapus berkas, buka nilai asli env, matikan server (harus ketik MATIKAN), dan tandai sudah diantar kini memakai dialog aplikasi ber-tombol jelas; status memproses memakai dialog tunggu; pesan singkat tetap lewat toast kanan bawah.",
      "60 FITUR LOGIKA BARU (backend 2.5.0, hasil riset Moka, Square, Majoo, Laravel): 20 perkakas developer murni (rate limiter, penangkap webhook, heartbeat cron, profiler query lambat, export CSV, ukuran tabel, rotasi kunci, maintenance, level log, statistik runtime, sweep sesi, pencarian audit, validator env, pembading skema, feature flags, estimasi backup, idempoten, healthcheck verdict, dan lainnya), 30 fitur owner (basket size, margin, sell-through, dead stock, reorder, rekonsiliasi kas laci, opname, FEFO batch, poin loyalty, target, jam ramai, terlaris, transfer outlet, dan lainnya), 10 fitur kasir (parkir transaksi, split bill, diskon manual tervalidasi, pembayaran campuran, struk digital, quick keys, barcode, void/refund ber-alasan); template GitHub issues baru menyertai (bisa unggah foto dan video).",
    ],
  },
  {
    versi: "1.7.0",
    tanggal: "2026-11-20",
    judul: "UMKM2Shell: audit command + kendali server (matikan, kesehatan, prediksi down)",
    butir: [
      "AUDIT SEMUA PERINTAH (permintaan check semua command): 12 masalah nyata ditemukan dan diperbaiki - pelari perintah dulu tidak terikat penjara sama sekali (ls /etc, grep /proc/self/environ, find / semuanya lolos; kini semua argumen jalur dijail/rebase ke SHELL_JAIL_ROOT dan cwd eksekusi = penjara), node -e dan go run dihapus dari whitelist (eksekusi kode arbitrer), env dihapus (mencetak semua rahasia ke output sejarah - pakai tab Lingkungan yang sudah termask), find -delete/-exec diblok keras, ip link hanya show/list (tidak bisa mematikan ethernet), curl/wget hanya flag baca (-s -I --head), rahasia di output otomatis termask (gsk_…/Bearer/password=), DATABASE_URL dan REPLICA_URL kini dianggap rahasia dan termask, whitelist 29 biner read-only murni dengan ketersediaan dinamis (binari dicek PATH - netstat yang tak ada di kontainer disembunyikan).",
      "TAB SERVER BARU (permintaan pemilik): matikan server secara graceful dari panel (sama seperti Ctrl+C - HTTP di-drain 5 detik, koneksi database ditutup, log di-flush; konfirmasi ketik MATIKAN; klik kedua ditolak supaya tidak dobel shutdown), kesehatan server sekarang dengan indikator nyata (database ping, rasio error 5xx dari log hari ini, latensi p95, memori, load, goroutine, verdict HIJAU/KUNING/MERAH beserta alasan - refresh otomatis tiap 15 detik), dan PREDIKSI DOWN (regresi linear atas ring sampel 5 detik dari memori, rasio error, latensi p95 - verdict SEHAT/WASPADA/KRITIS plus estimasi menit sampai ambang kritis).",
      "Terminal kini memakai daftar perintah tersedia dinamis dan DRY-RUN validasi: saat mengetik, baris diperiksa parser backend tanpa eksekusi - tanda centang kalau lolos atau pesan galat persis sebelum tombol Jalankan ditekan. Backend 2.4.0: 48 tes unit per fitur di package shell (26 lama + 10 tes regresi audit yang mengunci setiap temuan + 12 tes server), 6 pintu baru (kesehatan, prediksi, matikan, status, validasi, tersedia), dokumentasi docs/api/shell-server.md.",
    ],
  },
  {
    versi: "1.6.0",
    tanggal: "2026-11-18",
    judul: "UMKM2Shell: kontrol penuh server dari panel developer",
    butir: [
      "Menu Gerbang Developer kini memuat UMKM2Shell - adaptasi konsep panel PHP2Shell/NodeJS2Shell (developer mengendalikan server lewat web) yang dibuat jauh lebih kompleks DAN berpagar pengaman: tab Berkas (penjelajah filesystem dalam penjara - ls, lihat/edit teks, unduh, tulis, hapus, ganti nama; jalur titik-titik ditolak sebelum menyentuh disk sehingga tidak ada jalan keluar ke direktori sistem), tab Proses (daftar proses dengan CPU/memori plus statistik sistem; kirim sinyal MATI SOPAN atau MATI PAKSA - proses server sendiri terlindungi dari tombolnya agar panel tidak membunuh warungnya sendiri), tab Terminal (jalankan perintah dari daftar putih 29 biner - df, ps, git status, curl dan kawan-kawan; tanpa shell perantara sehingga pipa/titik-koma/substitusi tidak bisa ditafsirkan; satu perintah jalan satu kali dengan batas 20 detik, bisa diinterupsi, sejarah 50 terakhir), tab Lingkungan (variabel env dengan nilai rahasia otomatis disamarkan; membuka satu kunci butuh konfirmasi dan tercatat di jejak audit), dan tab Jaringan (ping TCP plus HTTP HEAD - cocok memeriksa node Postgres pusat/salinan dari dalam server).",
      "Backend 2.3.0: package shell dengan 26 tes unit per fitur (berkas 6, proses 5, perintah 7, lingkungan 3, jaringan 5) - setiap fitur diuji terpisah sesuai permintaan; 15 pintu HTTP /shell/* khusus DEVELOPER dan semuanya ter-audit.",
      "Dokumentasi API lengkap docs/api/ (12 berkas markdown + README indeks): setiap endpoint kini punya berkas docs dengan metode, tabel parameter, contoh permintaan, contoh respons, daftar galat, dan catatan keamanan - permintaan wajib pemilik dipenuhi penuh.",
    ],
  },
  {
    versi: "1.5.0",
    tanggal: "2026-11-18",
    judul: "Gerbang Developer: enam alat operasional baru",
    butir: [
      "Menu developer sebelumnya hanya tiga halaman; kini ada seksi baru \"Gerbang Developer\" berisi enam alat: Pusat Kendali (potret kesehatan sistem: versi, lama proses hidup, memori, jumlah sesi aktif, node database yang sedang melayani, riwayat failover), Sesi Aktif (daftar semua sesi login lintas peran dalam 24 jam terakhir lengkap dengan alamat IP dan perangkat, plus tombol tendang yang mencabut token orang tersebut seketika tanpa menunggu token kedaluwarsa), Bendera Fitur (saklar nyalakan/matikan fitur tanpa restart container, tersimpan di database sehingga bertahan di cadangan), Registri Pengaturan (setel parameter terdaftar seperti jarak cadangan otomatis atau ambang stok menipis dengan validasi tipe; nilai database menang atas berkas lingkungan tanpa membangun ulang image), SQL Console (kueri hanya-baca langsung ke database warung: hanya SELECT satu pernyataan, LIMIT dipaksa maksimal 500 baris, setiap kueri tercatat di jejak audit), dan Metrik (omzet/produk/pengguna per outlet hari ini plus laju transaksi per jam digambarkan batang sederhana).",
      "Sisi backend kini mencatat setiap login sebagai baris sesi sungguhan di database dengan pengenal acak yang ikut digendong token; ketika token diperiksa, baris sesinya harus masih hidup - itulah yang membuat tombol tendang bekerja seketika. Token lama tanpa pengenal sesi tetap sah sehingga pembaruhan berjalan mulus tanpa memaksa semua orang login ulang.",
      "Kunci rahasia (kunci token login dsb.) sengaja tidak masuk registri pengaturan - hanya parameter operasional non-rahasia yang bisa disetel dari konsol; kunci tetap urusan berkas lingkungan.",
    ],
  },
  {
    versi: "1.4.3",
    tanggal: "2026-11-18",
    judul: "Berkas cadangan kini menjaminkan kolomnya sendiri",
    butir: [
      "Di sebagian mesin, cadangan tetap gagal diterapkan walau tabelnya sudah bersih: berkas cadangan ikut membawa kolom warisan alat demo lama yang melekat pada tabel aplikasi (contoh nyata: kolom alamat IP dengan nama lama di tabel catatan aktivitas, padahal aplikasi kini memakai nama baru) - data dipindahkan dengan kolom apa adanya dari database sumber, sedangkan node tujuan tidak pernah membuat kolom warisan itu, sehingga proses pemulihan berhenti di tengah jalan.",
      "Berkas cadangan kini menjaminkan sendiri setiap kolom yang dibawanya: setelah membuat struktur standar, berkas menambahkan perintah pembuatan kolom bila belum ada, dengan tipe yang dibaca langsung dari database sumber - bukan dari daftar yang ditulis tangan yang cepat usang.",
      "Kolom warihan tetap utuh di database sumber (tidak dihapus, tidak diubah), dan uji ulang menyeluruh kini menanam dulu kolom warisan berisi data nyata - persis kondisi mesin pemilik - sebelum menyatakan lulus.",
    ],
  },
  {
    versi: "1.4.2",
    tanggal: "2026-11-17",
    judul: "Cadangan data kini mengabaikan tabel warisan alat lama",
    butir: [
      "Di beberapa mesin, cadangan gagal diterapkan ke salinan karena berkas cadangan ikut membawa tabel warisan alat demo lama (tabel catatan migrasi era sebelum aplikasi sekarang) yang tidak dibuat ulang oleh aplikasi - pesan galatnya: tabel itu tidak ada di tujuan. Berkas cadangan kini hanya membawa tabel dan penomoran milik aplikasi; tabel warisan dibiarkan tetap utuh di tempatnya, tidak ikut berpindah.",
      "Daftar tabel yang sah kini diturunkan langsung dari sumber kebenaran struktur yang sama dengan migrasi saat aplikasi boot, sehingga tidak akan pernah basi bila struktur bertambah di masa depan.",
      "Uji ulang menyeluruh kini mereproduksi kondisi nyata mesin pemilik (tabel warisan dan data warung ada di pusat) sebelum menyatakan lulus - pelajaran bahwa uji di lingkungan bersih saja tidak cukup.",
    ],
  },
  {
    versi: "1.4.1",
    tanggal: "2026-11-17",
    judul: "Perbaikan cadangan data yang gagal di beberapa mesin",
    butir: [
      "Cadangan data gagal dibuat di beberapa mesin dengan galat versi tidak cocok dari alat cadangan bawaan sistem operasi (alat klien versi 15 menolak server database versi 18). Seluruh proses cadangan kini dikerjakan kode aplikasi sendiri tanpa alat luar sama sekali, sehingga kecocokan versi tidak lagi menjadi syarat - cadangan berfungsi di mesin apa pun.",
      "Struktur tabel kini ditulis ulang dari sumber yang sama dengan migrasi saat aplikasi boot, sehingga berkas cadangan selalu membawa struktur lengkap dan bisa diterapkan ulang ke database yang sudah terisi maupun yang masih kosong, berkali-kali tanpa konflik.",
      "Urutan penyalinan data mengikuti hubungan antar tabel (tabel induk lebih dulu) sehingga pemulihan tidak pernah tersandung batasan foreign key; pemulihan juga kini bersifat satu-kesatuan - bila gagal di tengah, database tujuan kembali ke keadaan semula, tidak setengah terisi.",
      "Penjaga salinan di sisi infrastruktur tidak lagi memanggil alat cadangan eksternal; ia mengisi salinan baru dari berkas cadangan terbaru yang dibuat aplikasi, dan seluruh keputusan failover serta sinkron balik tetap satu sumber di aplikasi.",
    ],
  },
  {
    versi: "1.4.0",
    tanggal: "2026-11-17",
    judul: "Cadangkan data kapan pun + salinan database siaga",
    butir: [
      "Tombol Cadangkan Data Sekarang di Pengaturan: salinan penuh database warung (SQL terkompresi .sql.gz yang bisa dibaca manusia) dibuat KAPAN PUN tanpa menunggu jadwal — plus cadangan otomatis tiap jam dan retensi 48 berkas terbaru supaya volume tidak pernah membengkak.",
      "Berkas cadangan bisa dipulihkan kembali dari halaman yang sama (tabel dibuat ulang lalu diisi) dan tersimpan di volume Docker yang bertahan lintas rebuild container.",
      "Database SALINAN (db-salinan): saat database pusat down, sistem otomatis pindah menulis ke salinan (failover) — kasir tetap jualan; saat pusat hidup kembali, seluruh transaksi zaman-salinan disinkronkan balik ke pusat (sinkron balik) lalu pusat mengambil alih lagi. Riwayat perpindahan node tampil di Pengaturan supaya pemilik tahu persis kapan itu terjadi.",
      "Status salinan di Pengaturan menampilkan node yang sedang melayani (pusat/salinan), mode satu-database bila salinan belum diaktifkan, dan tombol pindah manual untuk keadaan darurat.",
      "Bantuan diagnosis AI yang masih bermasalah: uji koneksi asisten kini mencetak isi balasan mentah penyedia (PROBERAW) sehingga dua wajah HTTP 403 bisa dibedakan — jaringan/IP diblokir di tepi penyedia vs kunci API mati — dari konsol, tanpa menebak.",
    ],
  },

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
