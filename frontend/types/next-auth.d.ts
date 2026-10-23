import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "KASIR" | "DEVELOPER";
      outletId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "OWNER" | "KASIR" | "DEVELOPER"
    outletId?: string | null
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
    }
}
