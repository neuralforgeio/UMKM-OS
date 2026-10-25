import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { settingsBackHref, settingsBackLabel } from "@/lib/settings-nav";
import { AppearanceSettings } from "./appearance-client";

// Pengaturan Tampilan (v1.3.0). v1.6.0: tombol "Kembali" kini sadar
// peran â€” pengguna yang sudah login pulang ke areanya (kasir/owner/dev),
// pengunjung anonim ke /login. Section lain (bahasa, notifikasi, dsb.)
// menyusul bertahap sesuai ide berikutnya.
export const metadata: Metadata = {
  title: "Pengaturan Tampilan - UMKM OS",
  description: "Pilih tema gelap, terang, atau ikuti pengaturan perangkat.",
};

// auth() membaca cookie sesi â€” halaman ini tidak bisa diprarender statis
// (konvensi yang sama dengan halaman dev: rute blocking dinamis).
export const instant = false;

export default async function SettingsPage() {
  // auth() ringan untuk pengunjung anonim (tanpa sesi tidak menyentuh
  // database); perannya hanya menentukan tujuan tombol "Kembali".
  const session = await auth();
  const role = session?.user?.role ?? null;

  return (
    <AppearanceSettings
      backHref={settingsBackHref(role)}
      backLabel={settingsBackLabel(role)}
    />
  );
}