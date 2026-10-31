import Link from "next/link";
import {
  Activity,
  ClipboardList,
  Home,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu, UserAvatar, type UserMenuUser } from "@/components/user-menu";
import { roleLabelOf } from "@/lib/avatar";

// =====================================================================
// WorkspaceShell v3.2.0 — App Shell sidebar "WORKSPACE / MANAGE"
// (arahan desain atasan, PDF Figma: UMKM OS Business Platform).
//
// Satu shell bersama untuk seluruh halaman owner & konsol developer:
//   - Sidebar kiri (desktop): blok merek UMKM OS + identitas outlet,
//     navigasi dua seksi ber-label (WORKSPACE / MANAGE), blok pengguna
//     di dasar — pola "Platform overview" halaman 3 & 6 PDF.
//   - Pita atas ringkas (mobile): merek + chip profil + deret chip
//     navigasi bisa digeser — semua tujuan tetap terjangkau di layar
//     kecil (aturan PDF 04: "prioritize task flows on mobile").
//   - Kepala halaman: overline konteks + SATU judul utama + deskripsi
//     satu baris (aturan PDF 01: "one primary page title"), aksi &
//     UserMenu di kanan.
//
// Komponen ini TIDAK memakai hook (aman dipakai dari server component
// maupun client component). AuroraBackground tetap satu untuk semua
// halaman (dijaga tests/theme-consistency.test.ts), UserMenu tetap di
// setiap shell (dijaga tests/navbar-profile.test.ts) — tema tetap hanya
// boleh diatur di /settings & /login.
// =====================================================================

type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

// Navigasi Owner — seluruh tujuan yang dulu tersebar sebagai tombol ikon
// di header tiap halaman kini menempati sidebar; tidak ada fungsi yang
// hilang (Beranda, Ringkasan, Transaksi, Verifikasi Struk, Produk, Stok,
// OSCAR, Pengaturan).
const SEKSI_OWNER: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { key: "beranda", href: "/", label: "Beranda", icon: Home },
      {
        key: "ringkasan",
        href: "/owner",
        label: "Ringkasan",
        icon: LayoutDashboard,
      },
      {
        key: "transaksi",
        href: "/owner/transactions",
        label: "Transaksi",
        icon: ReceiptText,
      },
      {
        key: "verifikasi",
        href: "/owner/verify",
        label: "Verifikasi Struk",
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: "Manage",
    items: [
      { key: "produk", href: "/owner/products", label: "Produk", icon: Package },
      {
        key: "stok",
        href: "/owner/stock",
        label: "Stok",
        icon: ClipboardList,
      },
      { key: "oscar", href: "/owner/assistant", label: "OSCAR", icon: Sparkles },
      {
        key: "pengaturan",
        href: "/owner/settings",
        label: "Pengaturan",
        icon: Settings,
      },
    ],
  },
];

// Navigasi konsol developer — akses lintas outlet (super-user).
const SEKSI_DEV: NavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        key: "konsol",
        href: "/dev",
        label: "Ringkasan Platform",
        icon: Activity,
      },
      {
        key: "pengguna",
        href: "/dev/users",
        label: "Kelola Akun",
        icon: UserCog,
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        key: "log",
        href: "/dev/logs",
        label: "Log Aktivitas",
        icon: ScrollText,
      },
    ],
  },
];

// Ubin merek "U" — pola halaman PDF (petak indigo, huruf putih tebal).
function BrandTile({ className = "h-9 w-9 text-base" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-primary font-extrabold tracking-tight text-primary-foreground ${className}`}
    >
      U
    </div>
  );
}

function StorefrontGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  );
}

export function WorkspaceShell({
  variant,
  active,
  user,
  outletName,
  logoUrl,
  overline,
  title,
  desc,
  actions,
  children,
  mainClassName = "mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8",
}: {
  variant: "owner" | "dev";
  active: string;
  user: UserMenuUser;
  outletName?: string | null;
  logoUrl?: string | null;
  overline?: string;
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  mainClassName?: string;
}) {
  const seksi = variant === "owner" ? SEKSI_OWNER : SEKSI_DEV;
  const semuaItem = seksi.flatMap((s) => s.items);
  const namaPengguna = user.name?.trim() || "Pengguna";
  const labelPeran = roleLabelOf(user.role);

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 lg:flex-row dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      {/* ===== SIDEBAR (desktop, pola halaman 3 PDF): merek → outlet →
          navigasi WORKSPACE/MANAGE → blok pengguna di dasar. ===== */}
      <aside className="relative z-20 hidden shrink-0 flex-col border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 dark:border-slate-800 dark:bg-slate-900">
        {/* Blok merek */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <BrandTile />
          <div className="min-w-0">
            <p className="text-base leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
              UMKM OS
            </p>
            <p className="text-overline mt-1 text-muted-foreground">
              Business Platform
            </p>
          </div>
        </div>

        {/* Identitas konteks: outlet aktif (owner) / akses lintas outlet (dev) */}
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
          {variant === "owner" ? (
            logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${outletName ?? "outlet"}`}
                className="h-8 w-8 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <StorefrontGlyph className="h-4 w-4" />
              </span>
            )
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {variant === "owner"
                ? (outletName ?? "Outlet Anda")
                : "Akses Lintas Outlet"}
            </p>
            <p className="text-overline mt-0.5 text-muted-foreground">
              {variant === "owner" ? "Outlet aktif" : "Konsol Developer"}
            </p>
          </div>
        </div>

        {/* Navigasi dua seksi ber-label */}
        <nav
          aria-label="Navigasi workspace"
          className="flex-1 overflow-y-auto px-3 py-3"
        >
          {seksi.map((seksiNav) => (
            <div key={seksiNav.label} className="mb-4 last:mb-0">
              <p className="text-overline px-3 pb-1.5 text-muted-foreground">
                {seksiNav.label}
              </p>
              <ul className="space-y-0.5">
                {seksiNav.items.map((item) => {
                  const aktif = item.key === active;
                  const Ikon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={aktif ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                          aktif
                            ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                        }`}
                      >
                        <Ikon
                          className={`h-4 w-4 shrink-0 ${
                            aktif
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Blok pengguna di dasar sidebar (pola PDF: avatar + nama + peran) */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            title="Profil Saya"
          >
            <UserAvatar
              user={user}
              className="h-9 w-9 text-xs"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {namaPengguna}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {labelPeran}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* ===== Pita atas ringkas (mobile): merek + chip profil. ===== */}
        <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandTile className="h-8 w-8 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  UMKM OS
                </p>
                <p className="text-overline mt-0.5 text-muted-foreground">
                  {variant === "owner"
                    ? (outletName ?? "Business Platform")
                    : "Konsol Developer"}
                </p>
              </div>
            </div>
            <UserMenu user={user} />
          </div>
          {/* Chip navigasi bisa digeser — semua tujuan tetap terjangkau
              di layar kecil tanpa sidebar. */}
          <nav
            aria-label="Navigasi workspace (ringkas)"
            className="flex gap-1.5 overflow-x-auto px-4 pb-2.5"
          >
            {semuaItem.map((item) => {
              const aktif = item.key === active;
              const Ikon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    aktif
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  <Ikon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* ===== Kepala halaman (pola PDF 01): overline konteks + SATU
            judul utama + deskripsi satu baris; aksi & profil di kanan. ===== */}
        <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-start justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
            <div className="min-w-0">
              {overline ? (
                <p className="text-overline text-muted-foreground">{overline}</p>
              ) : null}
              <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
                {title}
              </h1>
              {desc ? (
                <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  {desc}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <div className="hidden lg:block">
                <UserMenu user={user} />
              </div>
            </div>
          </div>
        </div>

        <main className={mainClassName}>{children}</main>
      </div>
    </div>
  );
}
