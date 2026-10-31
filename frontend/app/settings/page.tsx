import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { settingsBackHref, settingsBackLabel } from "@/lib/settings-nav";
import { userMenuUser } from "@/lib/session-user";
import { AppearanceSettings } from "./appearance-client";

// Pengaturan Tampilan (v1.3.0). v1.6.0: tombol "Kembali" sadar peran —
// pengguna yang sudah login pulang ke areanya (kasir/owner/dev),
// pengunjung anonim ke /login. v3.3.0: halaman ini boleh dikunjungi
// pra-login, jadi chip profil hanya dikirim bila sesi ada.
export const metadata: Metadata = {
  title: "Pengaturan Tampilan - UMKM OS",
  description: "Pilih tema gelap, terang, atau ikuti pengaturan perangkat.",
};

// auth() membaca cookie sesi — halaman ini tidak bisa diprarender statis
// (konvensi yang sama dengan halaman dev: rute blocking dinamis).
export const instant = false;

export default async function SettingsPage() {
  // auth() ringan untuk pengunjung anonim (tanpa sesi tidak menyentuh
  // database); perannya hanya menentukan tujuan tombol "Kembali" dan
  // chip profil di pita atas (hanya bila sedang login).
  const session = await auth();
  const role = session?.user?.role ?? null;

  return (
    <AppearanceSettings
      backHref={settingsBackHref(role)}
      backLabel={settingsBackLabel(role)}
      user={session?.user ? userMenuUser(session) : null}
    />
  );
}
