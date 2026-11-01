import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { settingsBackHref, settingsBackLabel } from "@/lib/settings-nav";
import { AppShell } from "@/components/shell/app-shell";
import { userMenuUser } from "@/lib/session-user";
import { AppearanceSettings } from "./appearance-client";

// Pengaturan Tampilan (v1.3.0). v1.6.0: tombol "Kembali" kini sadar
// peran, pengguna yang sudah login pulang ke areanya (kasir/owner/dev),
// pengunjung anonim ke /login. Section lain (bahasa, notifikasi, dsb.)
// menyusul bertahap sesuai ide berikutnya.
export const metadata: Metadata = {
  title: "Pengaturan Tampilan - UMKM OS",
  description: "Pilih tema gelap, terang, atau ikuti pengaturan perangkat.",
};

// auth() membaca cookie sesi, halaman ini tidak bisa diprarender statis
// (konvensi yang sama dengan halaman dev: rute blocking dinamis).
export const instant = false;

export default async function SettingsPage() {
  // auth() ringan untuk pengunjung anonim (tanpa sesi tidak menyentuh
  // database); perannya hanya menentukan tujuan tombol "Kembali".
  const session = await auth();
  const role = session?.user?.role ?? null;

  return (
    <AppShell
      role={
        session?.user?.role === "DEVELOPER"
          ? "DEVELOPER"
          : session?.user?.role === "KASIR"
            ? "KASIR"
            : "OWNER"
      }
      user={userMenuUser(session)}
      outlet={{ name: "Pengaturan Tampilan", logoUrl: null, address: null }}
      crumb="Pengaturan"
      title="Pengaturan Tampilan"
      subtitle="Pilih tema terang, gelap, atau ikuti perangkat"
    >
      <AppearanceSettings
        backHref={settingsBackHref(role)}
        backLabel={settingsBackLabel(role)}
      />
    </AppShell>
  );
}