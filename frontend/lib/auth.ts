import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";

// Backend-go jadi satu-satunya pemeriksa kredensial: hash password,
// pengecekan akun aktif, dan audit login semua dicatat di sana. Frontend
// tetap memegang sesi NextAuth seperti semula — design & alur halaman
// tidak berubah sama sekali.
const API_URL = process.env.API_URL ?? "http://localhost:8080";

// Jwt-recheck (Task 34, versi Go): sesi diverifikasi ulang ke Go paling
// lama setiap 5 menit lewat GET /api/v1/auth/me. Akun yang dinonaktifkan
// akan berlaku efektif tanpa menunggu JWT kedaluwarsa.
const RECHECK_MS = 5 * 60_000;

// Mode maintenance developer (Task 35): developer memilih outlet lewat
// /dev/outlets/[id] -> server action menaruh cookie dev_outlet. Callback
// jwt lalu MENYUNTIKKAN outletId ke token, sehingga session.user.outletId
// terisi dan SELURUH halaman owner/kasir (yang memakai nilai itu) bisa
// dibuka developer tanpa perlu mengubah halaman satu per satu.
export const DEV_OUTLET_COOKIE = "dev_outlet";

async function syncDevOutletFromCookie(token: {
  role?: "OWNER" | "KASIR" | "DEVELOPER";
  outletId?: string | null;
}): Promise<void> {
  if (token.role !== "DEVELOPER") return;
  try {
    const store = await cookies();
    const outletId = store.get(DEV_OUTLET_COOKIE)?.value;
    token.outletId = outletId && outletId.length > 0 ? outletId : null;
  } catch {
    // Konteks tanpa cookie store — biarkan token apa adanya. Halaman dev
    // sendiri tidak membaca outletId, jadi ini tidak pernah mengganggu.
  }
}

// Format respons Go konsisten (lihat backend-go/internal/handler/respond.go):
// sukses -> {"success":true,"data":...}
type GoEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // Semua pemeriksaan (email terdaftar, password, akun aktif) dan
        // pencatatannya dilakukan Go — konsol backend-go adalah tempat
        // lihat gagal-berhasilnya login.
        let res: Response;
        try {
          res = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password }),
            cache: "no-store",
          });
        } catch {
          // Backend tidak terjangkau — perlakukan seperti login gagal.
          return null;
        }
        if (!res.ok) return null;

        const json = (await res.json()) as GoEnvelope<{
          token?: string;
          user?: {
            id?: number;
            name?: string;
            email?: string;
            role?: string;
            outlet_id?: number | null;
          };
        }>;
        const goToken = json.data?.token;
        const user = json.data?.user;
        if (typeof goToken !== "string" || !user) return null;

        // Go mengenal OWNER/CASHIER/DEVELOPER; seluruh halaman memakai
        // KASIR (developer = konsol lintas outlet milik Task 35).
        const role: "OWNER" | "KASIR" | "DEVELOPER" =
          user.role === "CASHIER"
            ? "KASIR"
            : user.role === "DEVELOPER"
              ? "DEVELOPER"
              : "OWNER";

        return {
          id: String(user.id ?? ""),
          name: user.name ?? "",
          email: user.email ?? "",
          role,
          // v2.0.0 multi-outlet: ikatan outlet akun dari backend-go —
          // id NUMERIK tabel outlets (bukan lagi cuid Prisma yang selalu
          // null di era single-outlet).
          outletId:
            typeof user.outlet_id === "number" && user.outlet_id > 0
              ? String(user.outlet_id)
              : null,
          goToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Jalur sign-in: identitas segar dari authorize().
        token.id = user.id;
        token.role = user.role;
        token.outletId = user.outletId ?? null;
        token.goToken = user.goToken;
        token.checkedAt = Date.now();
        return token;
      }
      // Jalur permintaan biasa: cukup satu panggilan /auth/me per 5 menit per sesi.
      const last = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (Date.now() - last < RECHECK_MS) {
        // Mode maintenance harus berefek SEGERA (masuk/keluar), jadi
        // cookie dibaca di SETIAP permintaan — bukan hanya tiap 5 menit.
        await syncDevOutletFromCookie(token);
        return token;
      }
      token.checkedAt = Date.now();
      if (typeof token.goToken === "string" && token.goToken.length > 0) {
        try {
          const res = await fetch(`${API_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token.goToken}` },
            cache: "no-store",
          });
          if (res.status === 401 || res.status === 403) {
            // Akun sudah tidak sah (dinonaktifkan / token mati):
            // putus sesi — Auth.js menghapus cookie, guard fail-closed.
            return null;
          }
          if (res.ok) {
            const json = (await res.json()) as GoEnvelope<{
              id?: number;
              name?: string;
              email?: string;
              role?: string;
              outlet_id?: number | null;
            }>;
            const freshRole = json.data?.role;
            if (
              freshRole === "OWNER" ||
              freshRole === "CASHIER" ||
              freshRole === "DEVELOPER"
            ) {
              token.role =
                freshRole === "CASHIER"
                  ? "KASIR"
                  : freshRole === "DEVELOPER"
                    ? "DEVELOPER"
                    : "OWNER";
            }
            // v2.0.0: ikatan outlet disinkronkan segar — re-bind akun di
            // konsol dev berlaku maksimal 5 menit tanpa login ulang.
            // (Developer tetap di-suntik ulang lewat cookie dev_outlet
            // setelah blok ini — mode maintenance selalu menang.)
            if (token.role !== "DEVELOPER") {
              token.outletId =
                typeof json.data?.outlet_id === "number" &&
                json.data.outlet_id > 0
                  ? String(json.data.outlet_id)
                  : null;
            }
          }
        } catch {
          // Backend tidak terjangkau: biarkan sesi tetap hidup — warung
          // harus tetap bisa jualan; recheck berikutnya menyinkronkan lagi.
        }
      }
      // Mode maintenance developer tetap disuntikkan ulang tiap
      // permintaan lewat cookie dev_outlet (kalau sedang aktif).
      await syncDevOutletFromCookie(token);
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "OWNER" | "KASIR" | "DEVELOPER";
        session.user.outletId = token.outletId ?? null;
        // Token backend-go untuk server action / server component yang
        // memanggil API Go (produk POS, checkout, dll).
        session.user.goToken = token.goToken;
      }
      return session;
    },
  },
});
