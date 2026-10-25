import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { auth } from "@/lib/auth";
import { AccountForm } from "./client";

export const instant = false;

// AKUN SAYA (v1.0.3) â€” ganti password mandiri untuk SEMUA peran.
// Sebelumnya titik ganti password tercecer (pengaturan owner via Prisma,
// reset oleh developer) â€” kini satu pintu yang menulis langsung ke
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
    // Shell aurora (v1.8.0): halaman akun ikut tema terang/gelap pengguna.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Akun Saya
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session.user.name ?? session.user.email} Â· {roleLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Ganti password</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Password baru berlaku untuk login berikutnya â€” semua peran
              (pemilik, kasir, developer) memakai pintu yang sama ini.
            </p>
          </div>
          <AccountForm />
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Lupa password? Pemilik/developer bisa me-resetnya dari konsol kelola
          akun.
        </p>
      </main>
    </div>
  );
}