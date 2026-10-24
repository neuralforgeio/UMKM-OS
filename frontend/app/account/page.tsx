import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { AccountForm } from "./client";

export const instant = false;

// AKUN SAYA (v1.0.3) — ganti password mandiri untuk SEMUA peran.
// Sebelumnya titik ganti password tercecer (pengaturan owner via Prisma,
// reset oleh developer) — kini satu pintu yang menulis langsung ke
// backend-go, satu-satunya pihak yang memeriksa password saat LOGIN.
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Pemilik",
  CASHIER: "Kasir",
  DEVELOPER: "Developer",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role ?? "";
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-slate-900">
              Akun Saya
            </h1>
            <p className="text-xs text-slate-500">
              {session.user.name ?? session.user.email} · {roleLabel}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900">Ganti password</h2>
            <p className="text-xs text-slate-500">
              Password baru berlaku untuk login berikutnya — semua peran
              (pemilik, kasir, developer) memakai pintu yang sama ini.
            </p>
          </div>
          <AccountForm />
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Lupa password? Pemilik/developer bisa me-resetnya dari konsol kelola
          akun.
        </p>
      </main>
    </div>
  );
}
