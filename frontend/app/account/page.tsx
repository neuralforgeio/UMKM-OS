import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { roleLabelOf } from "@/lib/avatar";
import { AccountForm, IdentityForm, ProfilePhotoCard } from "./client";

export const instant = false;

// PROFIL SAYA (v1.0.3 "Akun Saya"; v2.2.0 menjadi profil penuh).
// Semua peran — pemilik, kasir, developer — mengelola dirinya sendiri
// di satu pintu ini: foto (wajah), nama lengkap, email, dan password.
// Semua aksi menulis ke backend-go lewat pintu /me (hanya bisa menyentuh
// baris akun sendiri), dan halaman ini membaca data SEGAR dari Go
// (GET /auth/me) supaya hasil perubahan langsung terlihat.
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Pemilik",
  CASHIER: "Kasir",
  DEVELOPER: "Developer",
};

// Identitas segar dari backend-go — respons MeResponse (v1.7.0).
type FreshProfile = {
  name: string;
  email: string;
  role: string;
  outlet_name: string | null;
  photo_version: number;
  created_at: string;
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.goToken) redirect("/login");

  // Data segar dari Go: halaman ini menampilkan apa yang ADA di
  // database, bukan salinan lama di sesi — selesai edit, nilai baru
  // langsung terlihat tanpa refresh.
  const me = await goFetch<FreshProfile>(
    session.user.goToken,
    "/auth/me",
  );

  const name = me.ok ? me.data.name : (session.user.name ?? "");
  const email = me.ok ? me.data.email : (session.user.email ?? "");
  const photoVersion = me.ok ? (me.data.photo_version ?? 0) : 0;
  const outletName = me.ok ? me.data.outlet_name : null;
  const role = session.user.role ?? "";
  const roleLabel = ROLE_LABEL[role] ?? roleLabelOf(role);

  const registeredAt = me.ok
    ? new Date(me.data.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const menuUser = {
    name,
    email,
    role: session.user.role,
    photoVersion,
  };

  return (
    // Shell aurora (v1.8.0): halaman profil ikut tema terang/gelap
    // pengguna — penggantian tema kini HANYA dari halaman /settings
    // (pintu "Pengaturan Tampilan" ada di menu profil navbar).
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Profil Saya
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {name || email} · {roleLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UserMenu user={menuUser} />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6">
        {/* 1) Foto profil (wajah) — avatar navbar semua halaman */}
        <ProfilePhotoCard user={menuUser} />

        {/* 2) Identitas: nama lengkap & email */}
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Identitas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nama & email dipakai di navbar, struk, dan login — berlaku
              untuk semua peran.
            </p>
          </div>
          <IdentityForm initialName={name} initialEmail={email} />
        </div>

        {/* 3) Informasi akun — baca-saja, urusan konsol/admin */}
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Informasi Akun
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Peran & ikatan outlet dikelola pemilik/developer dari konsol
              kelola akun — bukan dari sini.
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Peran
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {roleLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Outlet
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {outletName ?? "Semua outlet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Email login
              </dt>
              <dd className="mt-0.5 font-semibold break-all text-slate-900 dark:text-slate-100">
                {email || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Terdaftar sejak
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {registeredAt}
              </dd>
            </div>
          </dl>
        </div>

        {/* 4) Ganti password — pintu yang sama sejak v1.0.3 */}
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ganti Password
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Password baru berlaku untuk login berikutnya — semua peran
              (pemilik, kasir, developer) memakai pintu yang sama ini.
            </p>
          </div>
          <AccountForm />
        </div>
      </main>
    </div>
  );
}
