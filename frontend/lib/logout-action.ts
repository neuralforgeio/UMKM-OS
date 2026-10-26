"use server";

// Aksi keluar sesi (v2.2.0) — dipakai tombol "Keluar" di menu profil
// navbar SEMUA halaman. Dulu tiap halaman menempel form action inline
// ({ "use server"; await signOut(...) }); kini satu berkas ini jadi
// satu-satunya definisi, dan komponen client UserMenu bisa
// mengimpornya sebagai server action biasa.

import { signOut } from "@/lib/auth";

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
