import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { roleLabelOf } from "@/lib/avatar";
import { AccountForm, IdentityForm, ProfilePhotoCard } from "./client";

import { AppShell } from "@/components/shell/app-shell";
import { userMenuUser } from "@/lib/session-user";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";

export const instant = false;

// PROFIL SAYA (v1.0.3 "Akun Saya"; v2.2.0 menjadi profil penuh).
// Semua peran, pemilik, kasir, developer, mengelola dirinya sendiri
// di satu pintu ini: foto (wajah), nama lengkap, email, dan password.
// Semua aksi menulis ke backend-go lewat pintu /me (hanya bisa menyentuh
// baris akun sendiri), dan halaman ini membaca data SEGAR dari Go
// (GET /auth/me) supaya hasil perubahan langsung terlihat.
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Pemilik",
  CASHIER: "Kasir",
  DEVELOPER: "Developer",
};

// Identitas segar dari backend-go, respons MeResponse (v1.7.0).
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

  const outlet = await getOutletContext();

  // Data segar dari Go: halaman ini menampilkan apa yang ADA di
  // database, bukan salinan lama di sesi, selesai edit, nilai baru
  // langsung terlihat tanpa refresh.
  const me = await goFetch<FreshProfile>(
    session.user.goToken,
    "/auth/me");

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
    : "";

  const menuUser = {
    name,
    email,
    role: session.user.role,
    photoVersion,
  };

  return (
    <AppShell
      role={session.user.role === "DEVELOPER" ? "DEVELOPER" : session.user.role === "KASIR" ? "KASIR" : "OWNER"}
      user={userMenuUser(session)}
      outlet={{ name: outlet?.name ?? "Warung Anda", logoUrl: outlet ? outletLogoUrl(outlet) : null, address: outlet?.address ?? null }}
      crumb="Profil"
      title="Profil Saya"
      subtitle={session.user.name ?? "Pengguna"}
    >

        {/* 1) Foto profil (wajah), avatar navbar semua halaman */}
        <ProfilePhotoCard user={menuUser} />

        {/* 2) Identitas: nama lengkap & email */}
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Identitas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nama & email dipakai di navbar, struk, dan login, berlaku
              untuk semua peran.
            </p>
          </div>
          <IdentityForm initialName={name} initialEmail={email} />
        </div>

        {/* 3) Informasi akun, baca-saja, urusan konsol/admin */}
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Informasi Akun
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Peran & ikatan outlet dikelola pemilik/developer dari konsol
              kelola akun, bukan dari sini.
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
                {email || ""}
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

        {/* 4) Ganti password, pintu yang sama sejak v1.0.3 */}
        <div className="rounded-2xl glass-card p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ganti Password
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Password baru berlaku untuk login berikutnya, semua peran
              (pemilik, kasir, developer) memakai pintu yang sama ini.
            </p>
          </div>
          <AccountForm />
        </div>
    </AppShell>
  );
}
