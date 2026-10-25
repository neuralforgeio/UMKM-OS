import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
