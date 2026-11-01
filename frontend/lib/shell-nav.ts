// Navigasi shell UMKM OS v1.0.0, murni, tanpa React/router, teruji vitest.
//
// Satu sumber kebenaran untuk menu sidebar per peran, penanda menu aktif,
// dan judul remah roti (breadcrumb). Komponen sidebar hanya menggambar
// apa yang didefinisikan di sini sehingga menu bisa dirawat di satu tempat.

export type ShellRole = "OWNER" | "KASIR" | "DEVELOPER";

// Kunci ikon dipetakan ke komponen ikon di app-sidebar (lucide).
export type ShellIcon =
  | "home"
  | "receipt"
  | "shield"
  | "package"
  | "boxes"
  | "sparkles"
  | "settings"
  | "calculator"
  | "users"
  | "terminal";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: ShellIcon;
};

export type ShellNavSection = {
  title: string;
  items: ShellNavItem[];
};

// Kunci penyimpanan lokal untuk status sidebar diringkatkan (minimize).
export const SIDEBAR_STORAGE_KEY = "umkm.sidebar.collapsed";

export function sidebarCollapsedFromStorage(
  nilai: string | null): boolean {
  return nilai === "1";
}

export function sidebarCollapsedToStorage(collapsed: boolean): string {
  return collapsed ? "1" : "0";
}

const NAV_OWNER: ShellNavSection[] = [
  {
    title: "Menu Utama",
    items: [
      { href: "/owner", label: "Ringkasan", icon: "home" },
      { href: "/owner/transactions", label: "Transaksi", icon: "receipt" },
      { href: "/owner/verify", label: "Verifikasi Struk", icon: "shield" },
    ],
  },
  {
    title: "Pengelolaan",
    items: [
      { href: "/owner/products", label: "Produk", icon: "package" },
      { href: "/owner/stock", label: "Stok", icon: "boxes" },
      { href: "/owner/assistant", label: "OSCAR", icon: "sparkles" },
      { href: "/owner/settings", label: "Pengaturan", icon: "settings" },
    ],
  },
];

const NAV_KASIR: ShellNavSection[] = [
  {
    title: "Menu Utama",
    items: [
      { href: "/", label: "Beranda", icon: "home" },
      { href: "/cashier", label: "Kasir", icon: "calculator" },
    ],
  },
];

const NAV_DEVELOPER: ShellNavSection[] = [
  {
    title: "Konsol Developer",
    items: [
      { href: "/dev", label: "Ringkasan", icon: "home" },
      { href: "/dev/users", label: "Pengguna", icon: "users" },
      { href: "/dev/logs", label: "Log Aktivitas", icon: "terminal" },
    ],
  },
];

export function navSectionsForRole(
  role: ShellRole | null): ShellNavSection[] {
  if (role === "OWNER") return NAV_OWNER;
  if (role === "KASIR") return NAV_KASIR;
  if (role === "DEVELOPER") return NAV_DEVELOPER;
  return [];
}

// Menu aktif untuk sebuah path: kecocokan awalan terpanjang menang agar
// halaman detail (misal /dev/outlets/3) tetap menandai menu induknya.
export function activeNavHref(
  pathname: string,
  role: ShellRole | null): string | null {
  const kandidat = navSectionsForRole(role)
    .flatMap((bagian) => bagian.items.map((item) => item.href))
    .filter((href) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  if (kandidat.length === 0) return null;
  return kandidat.reduce((a, b) => (b.length > a.length ? b : a));
}

// Judul remah roti untuk topbar: nama bagian tempat menu aktif berada.
export function sectionTitleFor(
  pathname: string,
  role: ShellRole | null): string {
  const aktif = activeNavHref(pathname, role);
  for (const bagian of navSectionsForRole(role)) {
    if (bagian.items.some((item) => item.href === aktif)) {
      return bagian.title;
    }
  }
  return "Ruang Kerja";
}
