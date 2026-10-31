import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { roleLabelOf } from "@/lib/avatar";
import { AccountForm, IdentityForm, ProfilePhotoCard } from "./client";

export const instant = false;

// PROFIL SAYA (v1.0.3 "Akun Saya"; v2.2.0 profil penuh; v3.3.0 ikut bahasa
// shell design system). Semua peran — pemilik, kasir, developer — mengelola
// dirinya sendiri di satu pintu ini: foto (wajah), nama lengkap, email, dan
// password. Semua aksi menulis ke backend-go lewat pintu /me (hanya bisa
// menyentuh baris akun sendiri), dan halaman ini membaca data SEGAR dari Go
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

// Ubin merek "U" — sama dengan sidebar WorkspaceShell & halaman login.
function BrandTile({ className = "h-9 w-9 text-base" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-primary font-extrabold tracking-tight text-primary-foreground ${className}`}
    >
      U
    </div>
  );
}

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
    // Shell sempit lintas peran (v3.3.0): pita atas berbatas (ubin merek +
    // chip profil) dan kepala halaman overline/judul/deskripsi — bahasa
    // yang sama dengan WorkspaceShell, tanpa sidebar karena halaman ini
    // milik SEMUA peran. Penggantian tema tetap HANYA dari /settings
    // (pintunya ada di menu profil chip di kanan).
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <header className="relative z-20 shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandTile className="h-8 w-8 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
                UMKM OS
              </p>
              <p className="text-overline mt-0.5 text-muted-foreground">
                Profil
              </p>
            </div>
          </div>
          <UserMenu user={menuUser} />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Kepala halaman (pola PDF 01): overline + SATU judul + deskripsi. */}
        <div>
          <p className="text-overline text-muted-foreground">Pengaturan</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            Profil Saya
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Satu pintu untuk dirimu sendiri — foto wajah, nama, email, dan
            password. Berlaku untuk semua peran.
          </p>
        </div>

        {/* 1) Foto profil (wajah) — avatar navbar semua halaman */}
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Foto Profil
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Foto wajah Anda tampil sebagai avatar di navbar semua halaman —
            hanya Anda yang bisa melihat & menggantinya. JPEG/PNG/WebP,
            maks. 3 MB.
          </p>
          <ProfilePhotoCard user={menuUser} />
        </section>

        {/* 2) Identitas: nama lengkap & email */}
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Identitas
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Nama & email dipakai di navbar, struk, dan login — berlaku
            untuk semua peran.
          </p>
          <IdentityForm initialName={name} initialEmail={email} />
        </section>

        {/* 3) Informasi akun — baca-saja, urusan konsol/admin */}
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Informasi Akun
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Peran & ikatan outlet dikelola pemilik/developer dari konsol
            kelola akun — bukan dari sini.
          </p>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-overline text-muted-foreground">Peran</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {roleLabel}
              </dd>
            </div>
            <div>
              <dt className="text-overline text-muted-foreground">Outlet</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {outletName ?? "Semua outlet"}
              </dd>
            </div>
            <div>
              <dt className="text-overline text-muted-foreground">
                Email login
              </dt>
              <dd className="mt-1 font-semibold break-all text-slate-900 dark:text-slate-100">
                {email || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-overline text-muted-foreground">
                Terdaftar sejak
              </dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {registeredAt}
              </dd>
            </div>
          </dl>
        </section>

        {/* 4) Ganti password — pintu yang sama sejak v1.0.3 */}
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Ganti Password
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Password baru berlaku untuk login berikutnya — semua peran
            (pemilik, kasir, developer) memakai pintu yang sama ini.
          </p>
          <AccountForm />
        </section>
      </main>
    </div>
  );
}
