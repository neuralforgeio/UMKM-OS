import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { auth } from "@/lib/auth";
import { themeKeyForUser } from "@/lib/theme-storage";
import "./globals.css";

// Tipografi SELF-HOST sejak v1.1.0 fix2: ketiga keluarga font kini
// dibundel di app/fonts dan dimuat lewat next/font/local, bukan
// diunduh dari Google Fonts saat build. Akar kegagalan Gerbang D
// run-1: docker build berhasil mengambil CSS dari fonts.googleapis.com
// tetapi gagal mengunduh berkas woff2 dari fonts.gstatic.com
// (jaringan container tidak menjangkau domain tersebut), sehingga
// Turbopack gagal dengan error modul font internal. Dengan font
// lokal, build produksi tidak lagi memerlukan jaringan eksternal.
// Berkas diambil dari server Google Fonts resmi (subset latin,
// bobot penuh variable) sehingga tampilan tidak berubah.
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

// Tipografi utama design language v1.3.0 (halaman login, pengaturan,
// konsol akun) — Geist tetap dimuat untuk angka/mono di halaman lain.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "UMKM OS - Kasir & Intelijen Bisnis Warung",
  description: "Kasir, stok, dan laporan penjualan untuk warung Anda.",
  // Ikon resmi UMKM OS (v1.3.0) — logo warung yang diunggah pemilik tetap
  // dipakai di dalam aplikasi (header kasir, struk, pengaturan).
  icons: { icon: [{ url: "/icon/umkm-icon.png", type: "image/png" }] },
};

// Layout akar membaca sesi (auth() -> cookies), jadi TIDAK ADA rute yang
// bisa dirender statis penuh — termasuk halaman 404 bawaan Next.js
// (/_not-found) yang memakai layout ini. Tanpa flag ini `next build`
// gagal saat prapenyajian /_not-found. Pola yang sama sudah dipakai
// semua page.tsx aplikasi sejak v1.3.0.
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema PER PENGGUNA (v1.7.0): sesi dibaca di layout akar agar
  // next-themes memakai kunci localStorage "theme-<idUser>" — dua
  // akun yang berbagi satu browser tetap punya tema masing-masing.
  // Tanpa sesi (belum masuk / halaman publik) dipakai kunci generik.
  // Efek samping: seluruh rute menjadi dinamis (auth() membaca
  // cookie) — aman karena aplikasi ini memang di belakang middleware
  // dan setiap halaman konsol sudah membaca sesi juga.
  const session = await auth();
  const themeStorageKey = session?.user?.id
    ? themeKeyForUser(session.user.id)
    : undefined;
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider storageKey={themeStorageKey}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
      </body>
    </html>
  );
}
