import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "KASIR" | "DEVELOPER";
      outletId: string | null;
      // Token JWT backend-go — dipakai server action / server component
      // untuk memanggil API dengan Authorization: Bearer. Tidak ada
      // komponen client yang memanggil useSession, jadi nilai ini
      // praktis tidak pernah sampai ke browser.
      goToken?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "OWNER" | "KASIR" | "DEVELOPER"
    outletId?: string | null
    goToken?: string
  }
}

declare module "@auth/core/jwt" {
    interface JWT {
        id?: string
        role?: "OWNER" | "KASIR" | "DEVELOPER"
        outletId?: string | null
        // Penanda jwt-recheck (lib/auth.ts): kapan terakhir kali sesi
        // diverifikasi ulang ke database (epoch milliseconds).
        checkedAt?: number
        // Token JWT backend-go (hasil login /api/v1/auth/login) — dipakai
        // callback jwt untuk recheck /api/v1/auth/me.
        goToken?: string
    }
}
