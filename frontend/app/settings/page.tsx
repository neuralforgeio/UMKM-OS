import type { Metadata } from "next";
import { AppearanceSettings } from "./appearance-client";

// Pengaturan Tampilan (v1.3.0) — sengaja PUBLIK (tanpa login): tema hanya
// preferensi perangkat yang tersimpan di browser pengguna, jadi bisa
// diubah kapan pun termasuk sebelum login. Section lain (bahasa,
// notifikasi, dsb.) menyusul bertahap sesuai ide berikutnya.
export const metadata: Metadata = {
  title: "Pengaturan Tampilan - UMKM OS",
  description: "Pilih tema gelap, terang, atau ikuti pengaturan perangkat.",
};

export default function SettingsPage() {
  return <AppearanceSettings />;
}
