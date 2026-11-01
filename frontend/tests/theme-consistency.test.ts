// Penjaga konsistensi tema UMKM OS v1.0.0, design language shell baru.
//
// Yang dikunci: seluruh halaman konsol memakai SATU shell (AppShell)
// sehingga sidebar, logo warung, dan tema tidak pernah berbeda antar
// halaman; token shell hidup di globals.css untuk dua tema; kertas struk
// tetap putih di kedua tema; halaman masuk mempertahankan bahasa kaca;
// dan kit UI buatan sendiri (toast/alert/pencatat konsol) terpasang.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");

// Halaman konsol yang WAJIB memakai AppShell (satu shell untuk semua).
const HALAMAN_SHELL = [
  "app/owner/page.tsx",
  "app/owner/transactions/page.tsx",
  "app/owner/stock/page.tsx",
  "app/owner/products/page.tsx",
  "app/owner/settings/page.tsx",
  "app/owner/assistant/page.tsx",
  "app/dev/page.tsx",
  "app/dev/users/page.tsx",
  "app/dev/logs/page.tsx",
  "app/dev/outlets/[id]/page.tsx",
  "app/account/page.tsx",
  "app/settings/page.tsx",
];

// Halaman ber-shell khusus (mobile-first / POS viewport terkunci):
// tetap wajib memakai token shell, tetapi tanpa sidebar.
const HALAMAN_KHUSUS = [
  "app/owner/verify/page.tsx",
  "app/owner/verify/[id]/page.tsx",
  "app/cashier/pos-client.tsx",
];

describe("konsistensi tema shell, semua halaman satu bahasa desain", () => {
  it("setiap halaman konsol memakai AppShell (satu shell untuk semua)", () => {
    const lupa = HALAMAN_SHELL.filter((rel) => !baca(rel).includes("AppShell"));
    expect(lupa).toEqual([]);
  });

  it("halaman konsol tidak lagi memasang latar aurora sendiri", () => {
    const lupa = HALAMAN_SHELL.filter((rel) =>
      baca(rel).includes("<AuroraBackground"));
    expect(lupa).toEqual([]);
  });

  it("halaman khusus (verifikasi mobile + POS) memakai token shell", () => {
    const lupa = HALAMAN_KHUSUS.filter((rel) => !baca(rel).includes("bg-shell"));
    expect(lupa).toEqual([]);
  });

  it("token shell hidup untuk dua tema di globals.css", () => {
    const css = baca("app/globals.css");
    expect(css).toContain("--shell-bg:");
    expect(css).toContain("--shell-primary:");
    expect(css).toContain(".dark {");
    expect(css).toContain("--color-shell:");
    expect(css).toContain("--color-shell-card:");
  });

  it("animasi shell terdefinisi (toast, naik, garis grafik)", () => {
    const css = baca("app/globals.css");
    expect(css).toContain("@keyframes toastNaik");
    expect(css).toContain("@keyframes munculNaik");
    expect(css).toContain("@keyframes garisGrafik");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("sidebar bisa diringkatkan dan statusnya diingat", () => {
    const shell = baca("components/shell/app-shell.tsx");
    expect(shell).toContain("SIDEBAR_STORAGE_KEY");
    expect(shell).toContain("localStorage");
    const sidebar = baca("components/shell/app-sidebar.tsx");
    expect(sidebar).toContain("onToggleCollapse");
    expect(sidebar).toContain("Ringkatkan panel navigasi");
  });

  it("panel bisa diringkatkan lewat pintasan Ctrl+B (v1.1.0)", () => {
    const shell = baca("components/shell/app-shell.tsx");
    expect(shell).toContain("ctrlKey");
    expect(shell).toContain('"b"');
    expect(shell).toContain('e.key === "b" || e.key === "B"');
  });

  it("tombol ringkatkan berupa ikon di pojok kanan atas sidebar (v1.1.0)", () => {
    const sidebar = baca("components/shell/app-sidebar.tsx");
    expect(sidebar).toContain("PanelLeftClose");
    expect(sidebar).toContain("PanelLeftOpen");
    expect(sidebar).toContain("Ctrl+B");
    // teks "Ringkatkan panel" sebagai NODE teks sudah dihapus; kini hanya
    // aria-label/title yang memakai frasa itu.
    expect(sidebar).not.toContain('{collapsed ? "" : "Ringkatkan panel"}');
  });

  it("kartu Tanya OSCAR tidak lagi memakan ruang menu sidebar (v1.1.0)", () => {
    const sidebar = baca("components/shell/app-sidebar.tsx");
    expect(sidebar).not.toContain("OscarCard");
    // area menu tetap menjadi satu-satunya bagian yang menggulir.
    const nav = baca("components/shell/sidebar-nav.tsx");
    expect(nav).toContain("overflow-y-auto");
  });

  it("logo warung dirender SATU komponen dengan jatuh-gracious ke inisial", () => {
    const switcher = baca("components/shell/store-switcher.tsx");
    expect(switcher).toContain("logoUrl");
    expect(switcher).toContain("onError");
    expect(switcher).toContain("initialsOf");
    // reset rusak saat versi logo berubah (unggah baru wajib mencoba ulang)
    expect(switcher).toContain("useEffect");
    expect(switcher).toContain("setRusak(false)");
  });

  it("setiap pemanggil AppShell mengoper identitas pengguna", () => {
    const lupa = HALAMAN_SHELL.filter(
      (rel) => !baca(rel).includes("userMenuUser(session)"));
    expect(lupa).toEqual([]);
  });

  it("halaman masuk tetap memakai bahasa kaca (tidak ikut shell)", () => {
    const login = baca("app/login/login-client.tsx");
    expect(login).toContain("glass-card");
    expect(login).toContain("AuroraBackground");
  });

  it("kertas struk TETAP PUTIH di kedua tema (invariant cetak)", () => {
    const isi = baca("app/cashier/receipt-view.tsx");
    const blok = isi.split('id="struk-paper"')[1] ?? "";
    const kelas = blok.slice(0, blok.indexOf(">"));
    expect(kelas).toContain("bg-white");
    expect(kelas.includes("dark:bg-")).toBe(false);
  });

  it("latar aurora tidak ikut tercetak (print:hidden)", () => {
    expect(baca("components/aurora-background.tsx")).toContain("print:hidden");
  });
});

describe("kit UI buatan sendiri v1.0.0", () => {
  it("toast terpasang di layout akar dengan portal + aria-live", () => {
    const layout = baca("app/layout.tsx");
    expect(layout).toContain("ToastProvider");
    const toast = baca("components/ui/toast.tsx");
    expect(toast).toContain("createPortal");
    expect(toast).toContain('aria-live="polite"');
    expect(toast).toContain("animate-toast-in");
  });

  it("useToast aman dipakai tanpa provider (tidak pernah melempar)", () => {
    const toast = baca("components/ui/toast.tsx");
    expect(toast).toContain("export function useToast");
    expect(toast).toContain("?? {");
  });

  it("alert dalam halaman punya empat varian dan peran aria yang benar", () => {
    const alert = baca("components/ui/alert.tsx");
    expect(alert).toContain('"sukses"');
    expect(alert).toContain('"peringatan"');
    expect(alert).toContain('"galat"');
    expect(alert).toContain('role={variant === "galat" ? "alert" : "status"}');
  });

  it("pencatat konsol khusus: lencana + cakupan + penanda waktu", () => {
    const catat = baca("lib/ui/log.ts");
    expect(catat).toContain("%cUMKM OS%c");
    expect(catat).toContain("export const log");
    expect(catat).toContain("modeProduksi");
    expect(catat).toContain('"production"');
  });

  it("grafik penjualan SVG murni tanpa pustaka luar", () => {
    const grafik = baca("components/ui/sales-chart.tsx");
    expect(grafik).toContain("<svg");
    expect(grafik).toContain("animate-chart-line");
    expect(grafik).toContain("linearGradient");
    expect(grafik).toContain("<title>");
  });

  it("jam lokal berzona WIB menyala tiap detik", () => {
    const jam = baca("components/ui/local-clock.tsx");
    expect(jam).toContain("Asia/Jakarta");
    expect(jam).toContain("setInterval");
  });
});
