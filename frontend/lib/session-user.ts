// Ekstraktor prop profil navbar dari sesi (v2.2.0).
//
// UserMenu (komponen client) hanya boleh menerima data AMAN untuk
// browser: nama, email, peran, versi foto. session.user membawa juga
// goToken (JWT backend-go) yang TIDAK boleh melintas ke client —
// fungsi ini memastikan hanya subset aman yang lolos, satu definisi
// untuk semua halaman supaya tidak ada yang lupa menyaring.
import type { Session } from "next-auth";
import type { UserMenuUser } from "@/components/user-menu";

export function userMenuUser(session: Session | null): UserMenuUser {
  return {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? null,
    role: session?.user?.role ?? null,
    photoVersion: session?.user?.photoVersion ?? 0,
  };
}
