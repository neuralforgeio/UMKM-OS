import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "KASIR";
      outletId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "OWNER" | "KASIR"
    outletId?: string | null
  }
}

declare module "@auth/core/jwt" {
    interface JWT {
        id?: string
        role?: "OWNER" | "KASIR"
        outletId?: string | null
    }
}
