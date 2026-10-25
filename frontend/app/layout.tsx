import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";
import { themeKeyForUser } from "@/lib/theme-storage";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografi utama design language v1.3.0 (halaman login, pengaturan,
// konsol akun) — Geist tetap dimuat untuk angka/mono di halaman lain.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
        <ThemeProvider storageKey={themeStorageKey}>{children}</ThemeProvider>
      </body>
    </html>
  );
}