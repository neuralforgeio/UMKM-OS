import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// Jwt-recheck (Task 34): sesi JWT diverifikasi ulang ke database paling
// lama setiap 5 menit. Akun yang dinonaktifkan / dihapus (soft-delete) /
// berganti peran akan berlaku efektif tanpa menunggu sesi 30 hari habis.
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

        const user = await prisma.user.findUnique({ where: { email } });
        // deletedAt = soft-delete (manajemen akun Fase B/C): riwayat
        // transaksi & audit tetap menunjuk akun ini, tapi pintu masuknya
        // ditutup total — login maupun sesi lama.
        if (!user || !user.isActive || user.deletedAt) {
          await audit({
            actorId: null,
            action: "LOGIN_FAILED",
            summary: `Login gagal: ${email}`,
            meta: {
              email,
              reason: user ? "akun-nonaktif" : "akun-tidak-ditemukan",
            },
          });
          return null;
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          await audit({
            actorId: user.id,
            outletId: user.outletId,
            action: "LOGIN_FAILED",
            summary: `Login gagal: ${email} (password salah)`,
            meta: { email, reason: "password-salah" },
          });
          return null;
        }

        await audit({
          actorId: user.id,
          outletId: user.outletId,
          action: "LOGIN_SUCCESS",
          summary: `Login berhasil: ${user.name} (${user.role})`,
          meta: { email },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          outletId: user.outletId,
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
        token.outletId = user.outletId;
        token.checkedAt = Date.now();
        return token;
      }
      // Jalur permintaan biasa: cukup satu koneksi DB per 5 menit per sesi.
      const last = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (Date.now() - last < RECHECK_MS) {
        // Mode maintenance harus berefek SEGERA (masuk/keluar), jadi
        // cookie dibaca di SETIAP permintaan — bukan hanya tiap 5 menit.
        await syncDevOutletFromCookie(token);
        return token;
      }
      token.checkedAt = Date.now();
      try {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            outletId: true,
            isActive: true,
            deletedAt: true,
          },
        });
        // null = putus sesi: Auth.js menghapus cookie, semua guard fail-closed
        // (terverifikasi dari source next-auth 5.0.0-beta.32).
        if (!fresh || !fresh.isActive || fresh.deletedAt) return null;
        // Peran/outlet terbaru ikut tersinkron ke sesi (mis. kasir
        // dipromosikan jadi owner oleh developer di Fase B).
        token.role = fresh.role;
        token.outletId = fresh.outletId;
      } catch {
        // Database tidak terjangkau: biarkan sesi tetap hidup — warung
        // harus tetap bisa jualan; recheck berikutnya menyinkronkan lagi.
      }
      // Recheck barusan menimpa outletId dari DB (developer = null) —
      // suntikkan ulang outlet maintenance bila cookie masih ada.
      await syncDevOutletFromCookie(token);
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "OWNER" | "KASIR" | "DEVELOPER";
        session.user.outletId = token.outletId ?? null;
      }
      return session;
    },
  },
});
