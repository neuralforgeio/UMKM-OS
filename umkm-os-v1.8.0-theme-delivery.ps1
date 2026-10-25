# ============================================================================
# UMKM OS - frontend v1.8.0 "Tema Universal" - DELIVERY PENUH (48 file)
# Tanggal: 2026-10-25 | Sandbox: build OK, tsc 0 error, vitest 78/78,
# runtime test browser dua tema (POS kasir, struk, owner, /verify publik).
#
# CARA PAKAI (PowerShell, dari root repo C:\Users\axioo\umkm-os):
#   1) git status                -> pastikan bersih dulu
#   2) powershell -ExecutionPolicy Bypass -File .\umkm-os-v1.8.0-theme-delivery.ps1
#      (atau: buka file ini, select-all, copy, paste ke PowerShell)
#   3) git status                -> 48 file berubah
#   4) jalankan blok git dari chat (add + commit + push)
#
# Sifat: menulis ULANG file penuh (bukan patch) -> tidak ada konflik merge.
# Aman dijalankan ulang (idempoten). Semua file UTF-8 tanpa BOM.
# ============================================================================
$ErrorActionPreference = "Stop"
$root = Get-Location
if (-not (Test-Path ".\frontend\package.json")) {
    Write-Host "JALANKAN dari root repo (harus ada folder frontend\). Sekarang: $root" -ForegroundColor Red
    exit 1
}
$utf8 = [System.Text.UTF8Encoding]::new($false)   # UTF-8 tanpa BOM
$script:written = 0
function Save-UmkmFile([string]$rel, [string]$content) {
    $path = Join-Path $root "frontend\$rel"
    $dir = Split-Path $path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($path, $content, $script:utf8)
    $script:written++
    Write-Host ("  [OK] frontend\{0}" -f $rel)
}
Write-Host ""
Write-Host "== UMKM OS v1.8.0 - menulis 48 file frontend ==" -ForegroundColor Cyan

# ---- [1/48] frontend/VERSIONS.csv ----------------------------------------
$p = @'
VERSIONS.csv
'@
$c = @'
version,tanggal,jenis,deskripsi,catatan
1.0.0,2026-10-23,RILIS AWAL,"Baseline integrasi backend-go dengan design asli dipertahankan: login via Go /auth/login (Tahap 1), kasir POS produk & checkout via Go (Tahap 2), kelola produk & stok & foto produk via Go (Tahap 3), dashboard owner + halaman peluncur via GET /reports/dashboard (Tahap 4a)","NextAuth tetap lapisan sesi (token Go disimpan di JWT, tidak diekspos ke browser); identitas outlet (nama/logo) masih Prisma menunggu fase multi-outlet; versi tampil di halaman Settings About (menyusul)"
1.0.1,2026-10-24,HOTFIX,"File app/owner/page.tsx terpotong saat push Tahap 4a (hilang export default — build gagal); ditulis ulang utuh: seluruh statistik dashboard owner (omzet hari ini & vs kemarin, grafik 7 hari, metode pembayaran, produk terlaris, stok menipis + saran restok, 6 transaksi terbaru) kini dari GET /reports/dashboard backend-go, Prisma hanya tersisa untuk identitas outlet (nama & logo); label hari grafik dihitung dari tanggal UTC agar tidak bergeser lintas zona waktu server","Patch melengkapi frontend v1.0.0 yang terpotong; tag frontend/v1.0.1"
1.0.2,2026-10-24,HOTFIX,"Guard bentuk respons GET /reports/dashboard: halaman peluncur menyembunyikan kartu statistik bila backend menjawab bentuk lama (halaman tetap terbuka), dashboard owner menolaknya dengan pesan 'Backend lama masih berjalan di port 8080' — menggantikan TypeError 'Cannot read properties of undefined (reading revenue)' saat proses go run pra-v1.1.0 masih memegang port 8080","Patch mengikuti pola guard halaman kasir v1.0.1; akar masalah sekaligus membebaskan port untuk docker compose; tag frontend/v1.0.2"
1.0.3,2026-10-24,HOTFIX,"Judul halaman konsol developer kini mengikuti filter aktif: halaman Log Aktivitas menyematkan aksi terpilih (mis. 'Log Aktivitas - LOGIN (AUTH_LOGIN)'), konsol Akun menyematkan outlet terpilih — sebelumnya judul statis tidak sesuai isi yang sedang difilter","Patch UX konsol developer; tag frontend/v1.0.3"
1.1.0,2026-10-24,MINOR,"Tahap 5 — alur serah terima & verifikasi struk pindah penuh ke backend-go v1.3.0: ganti password mandiri di /account (verifikasi password lama, tulis via Go), antrean penyajian kasir dari GET /queue (polling 30 detik) + tombol satu ketukan 'Sudah Diserahkan ke Pembeli', halaman publik /verify/[code] TANPA login (mode readonly untuk nomor struk, mode interactive untuk kode klaim 8 karakter — konfirmasi tanda tangan & bantahan pembeli langsung dari HP), kode klaim tercetak di struk (blok besar + baris di layar sukses) dan QR struk menunjuk /verify/{kode klaim} (fallback nomor struk untuk transaksi lama); perbaikan typo claimd_code -> claim_code yang diam-diam membuat kode klaim selalu null","Akhir split-brain frontend pada alur jual-penyajian-verifikasi; tag frontend/v1.1.0"
1.3.0,2026-10-25,MINOR,"Design language baru (glassmorphism + aurora, Plus Jakarta Sans): halaman login didandani penuh dengan framer-motion & react-icons (versi & data asli dari backend-go, tanpa angka demo), SISTEM TEMA dengan halaman /settings (Gunakan Pengaturan Sistem sebagai default + Gelap + Terang, next-themes berbasis class), konsol Kelola Akun /dev/users didandani (topbar profil, kartu metrik, tabel avatar & badge peran, aksi log aktivitas per akun), toggle tema ringan, dan ikon resmi UMKM OS sebagai favicon + logo README","Halaman lain menyusul didandani bertahap mengikuti design language ini; halaman yang belum dikonversi tetap tampil tema terang; tag frontend/v1.3.0"
1.7.0,2026-10-25,MINOR,"Tahap tema universal batch 1 (dev area): (1) BUG Kelola Akun /dev/users tidak ikut tema terang (wrapper dipaksa gelap) dibereskan — kini tema terang/gelap ikut penuh; (2) seluruh area developer sadar tema & didandani aurora (konsol utama, Log Aktivitas, drill-down outlet, buat outlet, Kelola Akun); (3) tombol tema + pintu gear ke /settings di header semua halaman developer; (4) /settings sadar peran (tombol Kembali memulangkan kasir/owner/dev ke areanya); (5) TEMA PER PENGGUNA: next-themes memakai kunci localStorage theme-<idUser> dibaca dari sesi di layout akar — dua akun berbagi satu browser tetap punya tema masing-masing, pilihan juga dicerminkan ke kunci generik agar halaman login/verify ikut tema terakhir mesin; (6) test vitest 58 -> 70 (theme-storage 12 baru; settings-nav 9 & audit-labels 11 dari iterasi tema ini)","Batch berikutnya menyusul: area owner, lalu kasir+launcher+account; angka internal 1.4-1.6 (kebijakan password Task 35 dsb.) tidak pernah tercatat di CSV ini — mulai 1.7.0 pencatatan dijaga kembali; tag frontend/v1.7.0"
1.8.0,2026-10-25,MINOR,"Tahap tema universal batch 2 (SEMUA halaman): (1) area OWNER sadar tema + design aurora — dashboard, Manajemen Produk (tabel + modal formulir kaca), Riwayat Transaksi & Laba, Kartu Stok (kini berpindah dari halaman telanjang ke shell ber-header + tombol kembali), Pengaturan outlet, Konsol Verifikasi & detail bukti serah terima; (2) area KASIR sadar tema + aurora — POS (grid produk, keranjang, sheet bayar mobile, bar antrean penyajian), halaman struk sukses; (3) peluncur Beranda, Akun Saya, dan halaman publik /verify ikut tema; (4) tombol tema + pintu gear /settings kini ada di SEMUA header (owner, kasir, dev, beranda, akun) — permintaan 'buat agar ada di cashier, owner, dev'; (5) INVARIANT CETAK: kertas struk, pratinjau kop struk, dan kanvas tanda tangan TETAP PUTIH di kedua tema (kertas fisik), hanya UI di sekelilingnya yang berubah; (6) grafik ramalan SVG (kisi/label/divider) sadar tema via kelas Tailwind stroke-/fill-; (7) pembersihan artefak codemod (token duplikat, border redundan) + audit otomatis dual-theme bersih; (8) test vitest 70 -> 78 (cashier-ui 8 baru: chip kategori dual-theme, inisial avatar)","Menutup seluruh pekerjaan tema: semua halaman kini menuruti tema per-pengguna dari v1.7.0; runtime test browser dua tema di sandbox untuk POS, struk, halaman owner (modal produk & stok), halaman publik verify; tag frontend/v1.8.0"
'@
Save-UmkmFile $p $c

# ---- [2/48] frontend/app/account/client.tsx ----------------------------------------
$p = @'
app/account/client.tsx
'@
$c = @'
"use client";

// Formulir ganti password Akun Saya. Satu komponen dipakai semua peran —
// perbedaan peran hanya soal dari halaman mana pintasannya ditempel
// (header kasir, pengaturan owner, konsol developer).
import { useActionState, useState } from "react";
import { Check, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { changePasswordAction, type AccountActionState } from "./actions";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

export function AccountForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {
    ok: false,
    message: "",
  } satisfies AccountActionState);

  // Nilai dikontrol manual supaya konfirmasi bisa divalidasi SEBELUM
  // submit (pesan instan, bukan bolak-balik ke server). Name pada input
  // membuat FormData terisi otomatis saat submit.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="current_password" className={labelClass}>
          Password saat ini
        </label>
        <div className="mt-1.5">
          <PasswordInput
            id="current_password"
            name="current_password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Password yang dipakai login sekarang"
            autoComplete="current-password"
          />
        </div>
      </div>

      <div>
        <label htmlFor="new_password" className={labelClass}>
          Password baru
        </label>
        <div className="mt-1.5">
          <PasswordInput
            id="new_password"
            name="new_password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Minimal 8 karakter, huruf besar, simbol"
            autoComplete="new-password"
            showChecklist
          />
        </div>
      </div>

      <div>
        <label htmlFor="confirm_password" className={labelClass}>
          Ulangi password baru
        </label>
        <div className="mt-1.5">
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Ketik ulang password baru"
            autoComplete="new-password"
          />
        </div>
        {confirmMismatch && (
          <p className="mt-1.5 text-xs font-medium text-rose-600">
            Belum sama dengan password baru.
          </p>
        )}
      </div>

      {state.message && (
        <p
          className={`flex items-center gap-1.5 text-sm font-medium ${
            state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
          }`}
        >
          {state.ok ? (
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0" />
          )}
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={
          pending ||
          confirmMismatch ||
          newPassword.length === 0 ||
          currentPassword.length === 0
        }
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        Ganti Password
      </button>
    </form>
  );
}
'@
Save-UmkmFile $p $c

# ---- [3/48] frontend/app/account/page.tsx ----------------------------------------
$p = @'
app/account/page.tsx
'@
$c = @'
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
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
                {session.user.name ?? session.user.email} · {roleLabel}
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
              Password baru berlaku untuk login berikutnya — semua peran
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
'@
Save-UmkmFile $p $c

# ---- [4/48] frontend/app/cashier/cart-panel.tsx ----------------------------------------
$p = @'
app/cashier/cart-panel.tsx
'@
$c = @'
/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { CartLineView, DiscountState, PaymentMethodValue } from "./types";
import {
  categoryAvatarClass,
  displayRp,
  initialsOf,
  MoneyInput,
  PercentInput,
  priceSen,
} from "./ui";

const PAYMENT_OPTIONS: {
  method: PaymentMethodValue;
  label: string;
  Icon: typeof Banknote;
}[] = [
  { method: "CASH", label: "Tunai", Icon: Banknote },
  { method: "QRIS", label: "QRIS", Icon: QrCode },
  { method: "DEBIT", label: "Debit", Icon: CreditCard },
];

type CartPanelProps = {
  lines: CartLineView[];
  subtotalSen: number;
  discountSen: number;
  discountState: DiscountState;
  onDiscountChange: (next: DiscountState) => void;
  paymentMethod: PaymentMethodValue;
  onPaymentMethodChange: (method: PaymentMethodValue) => void;
  paidSen: number;
  onPaidSenChange: (sen: number) => void;
  pending: boolean;
  error: string | null;
  onPay: () => void;
  onSetQty: (productId: string, nextQty: number) => void;
  onClear: () => void;
  onClose?: () => void;
};

export function CartPanel({
  lines,
  subtotalSen,
  discountSen,
  discountState,
  onDiscountChange,
  paymentMethod,
  onPaymentMethodChange,
  paidSen,
  onPaidSenChange,
  pending,
  error,
  onPay,
  onSetQty,
  onClear,
  onClose,
}: CartPanelProps) {
  const totalSen = Math.max(0, subtotalSen - discountSen);
  const effectivePaidSen = paymentMethod === "CASH" ? paidSen : totalSen;
  const changeSen = effectivePaidSen - totalSen;
  const itemCount = lines.reduce((n, line) => n + line.qty, 0);
  const discountInvalid = discountSen > subtotalSen;
  const canPay =
    lines.length > 0 &&
    !pending &&
    !discountInvalid &&
    (paymentMethod !== "CASH" || paidSen >= totalSen);

  const switchDiscountMode = (mode: DiscountState["mode"]) => {
    onDiscountChange({ ...discountState, mode });
  };

  return (
    // Vertical layout, top to bottom: header -> scrollable items ->
    // totals + discount -> payment -> cash input -> pay button.
    // Everything below the list is deliberately compact (tight paddings,
    // 13px rows, inline "uang pas") so the item list keeps as much of
    // the panel height as possible and several rows show without scroll.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <ShoppingCart className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          Keranjang <span className="text-slate-300">·</span> {itemCount} item
        </h2>
        <div className="flex items-center gap-1">
          {itemCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kosongkan
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup keranjang"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
            <ShoppingBasket className="h-7 w-7 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            Keranjang masih kosong
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Klik produk di kiri untuk menambahkan.
          </p>
        </div>
      ) : (
        <>
          {/* The ONLY scrollable part of the panel: the item list.
              Thin scrollbar + overscroll-contain keep the dense list
              tidy without leaking scroll to the page. */}
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overscroll-contain overflow-y-auto px-4 [scrollbar-width:thin] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar]:w-1.5">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center gap-2.5 py-1.5">
                {product.thumbImageId ? (
                  <img
                    src={`/api/images/${product.thumbImageId}`}
                    alt={product.name}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${categoryAvatarClass(product.categoryName)}`}
                  >
                    {initialsOf(product.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-medium leading-tight text-slate-900 dark:text-slate-100">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                    {displayRp(priceSen(product))} / {product.unit}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Kurangi jumlah"
                    onClick={() => onSetQty(product.id, qty - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 lg:h-7 lg:w-7"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah"
                    onClick={() => onSetQty(product.id, qty + 1)}
                    disabled={qty >= product.stock}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40 lg:h-7 lg:w-7"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {displayRp(priceSen(product) * qty)}
                </span>
              </li>
            ))}
          </ul>

          {/* Everything from here down is pinned - never scrolls. */}
          <div className="shrink-0 space-y-2 border-t border-slate-100 dark:border-slate-800/60 px-4 py-2.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {displayRp(subtotalSen)}
              </span>
            </div>

            {/* Discount: dual mode (Rp / %) with a segmented toggle.
                Both values survive mode switches; the amount shown is
                always recomputed from the subtotal. */}
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex shrink-0 items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Tag className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                Diskon
              </span>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5">
                  <button
                    type="button"
                    onClick={() => switchDiscountMode("RP")}
                    className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                      discountState.mode === "RP"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 "
                    }`}
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    onClick={() => switchDiscountMode("PERCENT")}
                    className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                      discountState.mode === "PERCENT"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 "
                    }`}
                  >
                    %
                  </button>
                </div>
                <div className="w-28">
                  {discountState.mode === "RP" ? (
                    <MoneyInput
                      valueSen={discountState.rpValueSen}
                      onChangeSen={(sen) =>
                        onDiscountChange({ ...discountState, rpValueSen: sen })
                      }
                      ariaLabel="Diskon Rupiah"
                    />
                  ) : (
                    <PercentInput
                      value={discountState.percent}
                      onChange={(pct) =>
                        onDiscountChange({ ...discountState, percent: pct })
                      }
                      ariaLabel="Diskon persen"
                    />
                  )}
                </div>
              </div>
            </div>
            {discountSen > 0 && !discountInvalid && (
              <p className="text-right text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                Potongan -{displayRp(discountSen)}
              </p>
            )}
            {discountInvalid && (
              <p className="text-right text-xs text-red-600 dark:text-red-400">
                Diskon melebihi subtotal.
              </p>
            )}
            <div className="flex items-center justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                Total
              </span>
              <span className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {displayRp(totalSen)}
              </span>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 dark:border-slate-800/60 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Metode Pembayaran
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {PAYMENT_OPTIONS.map(({ method, label, Icon }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentMethodChange(method)}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-[13px] font-semibold transition ${
                    method === paymentMethod
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900  text-slate-600 dark:text-slate-400  hover:border-slate-300 dark:hover:border-slate-700  hover:bg-slate-50 dark:hover:bg-slate-800/60 "
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div className="shrink-0 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Uang Dibayar
              </p>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <MoneyInput
                    valueSen={paidSen}
                    onChangeSen={onPaidSenChange}
                    ariaLabel="Uang dibayar"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onPaidSenChange(totalSen)}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition hover:bg-blue-100"
                >
                  Uang pas
                </button>
              </div>
              <p
                className={`text-right text-[13px] font-semibold tabular-nums ${
                  changeSen < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {changeSen < 0
                  ? `Kurang ${displayRp(Math.abs(changeSen))}`
                  : `Kembalian ${displayRp(changeSen)}`}
              </p>
            </div>
          )}

          {error && (
            <div className="shrink-0 px-4 pb-2">
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2 text-[13px] text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-100 dark:border-slate-800/60 px-4 py-3">
            <button
              type="button"
              onClick={onPay}
              disabled={!canPay}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wallet className="h-4 w-4" />
              {pending
                ? "Menyimpan transaksi..."
                : `Bayar ${displayRp(totalSen)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [5/48] frontend/app/cashier/pos-client.tsx ----------------------------------------
$p = @'
app/cashier/pos-client.tsx
'@
$c = @'
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronUp, ShoppingCart, Store, User } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { createTransaction } from "./actions";
import type {
  CartLineView,
  DiscountState,
  OutletInfo,
  PaymentMethodValue,
  PosProduct,
  Receipt as ReceiptType,
} from "./types";
import { displayRp, priceSen } from "./ui";
import { CartPanel } from "./cart-panel";
import { ProductGrid } from "./product-grid";
import { ReceiptView } from "./receipt-view";

const INITIAL_DISCOUNT: DiscountState = {
  mode: "RP",
  rpValueSen: 0,
  percent: 0,
};

export function PosClient({
  cashierName,
  outlet,
  products,
}: {
  cashierName: string;
  outlet: OutletInfo;
  products: PosProduct[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>("CASH");
  const [paidSen, setPaidSen] = useState(0);
  const [discount, setDiscount] = useState<DiscountState>(INITIAL_DISCOUNT);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptType | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const cartLines = useMemo(() => {
    const lines: CartLineView[] = [];
    for (const [id, qty] of Object.entries(cart)) {
      const product = byId.get(id);
      if (product && qty > 0) lines.push({ product, qty });
    }
    return lines;
  }, [cart, byId]);

  const subtotalSen = cartLines.reduce(
    (sum, line) => sum + priceSen(line.product) * line.qty,
    0,
  );

  // Mirrors the server formula in actions.ts exactly, so what the
  // kasir sees always matches what gets charged.
  const discountSen =
    discount.mode === "PERCENT"
      ? Math.round((subtotalSen * discount.percent) / 100)
      : discount.rpValueSen;
  const totalSen = Math.max(0, subtotalSen - discountSen);
  const itemCount = cartLines.reduce((n, line) => n + line.qty, 0);

  const setQty = (productId: string, nextQty: number) => {
    const product = byId.get(productId);
    if (!product) return;
    const qty = Math.max(0, Math.min(nextQty, product.stock));
    setCart((prev) => ({ ...prev, [productId]: qty }));
  };

  const handlePay = () => {
    setError(null);
    startTransition(async () => {
      const result = await createTransaction({
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.qty,
        })),
        paymentMethod,
        paidAmount: paidSen / 100,
        // Only mode + value cross the wire; the server recomputes the
        // amount from its own subtotal before writing anything.
        discount: {
          mode: discount.mode,
          value:
            discount.mode === "RP"
              ? discount.rpValueSen / 100
              : discount.percent,
        },
      });
      if (result.ok) {
        setSheetOpen(false);
        setReceipt(result.receipt);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const resetAll = () => {
    setCart({});
    setPaymentMethod("CASH");
    setPaidSen(0);
    setDiscount(INITIAL_DISCOUNT);
    setError(null);
    setReceipt(null);
    setSheetOpen(false);
  };

  if (receipt) {
    return (
      <ReceiptView
        receipt={receipt}
        outlet={outlet}
        onNewTransaction={resetAll}
      />
    );
  }

  const panelProps = {
    lines: cartLines,
    subtotalSen,
    discountSen,
    discountState: discount,
    onDiscountChange: setDiscount,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    paidSen,
    onPaidSenChange: setPaidSen,
    pending,
    error,
    onPay: handlePay,
    onSetQty: setQty,
    onClear: () => setCart({}),
  };

  return (
    // Application shell: the viewport is locked (h-dvh + overflow-hidden),
    // so panels never push the page into scrolling. Only inner lists scroll.
    // Aurora ambient (v1.8.0) + tema per kasir: terang & gelap sama rata.
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {outlet.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={outlet.logoUrl}
                alt={`Logo ${outlet.name}`}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                {outlet.name}
              </h1>
              <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                <User className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                Kasir: {cashierName}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <ProductGrid
          products={products}
          cartQty={cart}
          onAdd={(id) => setQty(id, (cart[id] ?? 0) + 1)}
        />
        <aside className="hidden min-h-0 lg:block">
          <div className="glass-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
            <CartPanel {...panelProps} />
          </div>
        </aside>
      </div>

      {itemCount === 0 ? (
        <div className="relative z-10 shrink-0 border-t border-slate-200/80 bg-white/70 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center backdrop-blur-xl lg:hidden dark:border-slate-800/80 dark:bg-slate-950/70">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Pilih produk untuk mulai transaksi
          </p>
        </div>
      ) : (
        <div className="relative z-10 shrink-0 border-t border-slate-200/80 bg-white/70 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden dark:border-slate-800/80 dark:bg-slate-950/70">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {itemCount} item
                </span>
                <span className="text-slate-400 dark:text-slate-500"> · </span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {displayRp(totalSen)}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
              Bayar
              <ChevronUp className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col rounded-t-3xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex shrink-0 justify-center pb-1 pt-2.5">
              <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>
            <CartPanel {...panelProps} onClose={() => setSheetOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [6/48] frontend/app/cashier/product-grid.tsx ----------------------------------------
$p = @'
app/cashier/product-grid.tsx
'@
$c = @'
/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, Search, X } from "lucide-react";
import type { PosProduct } from "./types";
import {
  categoryAvatarClass,
  categoryChipClass,
  displayRp,
  initialsOf,
  priceSen,
} from "./ui";

const PAGE_SIZE = 16;

type ProductGridProps = {
  products: PosProduct[];
  cartQty: Record<string, number>;
  onAdd: (productId: string) => void;
};

function ProductCard({
  product,
  qty,
  onAdd,
}: {
  product: PosProduct;
  qty: number;
  onAdd: (productId: string) => void;
}) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= product.minStock;

  return (
    // No fixed height, no overflow-hidden, no min-h-0 here: the card
    // grows with its content and the grid row grows with the card, so
    // a long product name can never be clipped again.
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onAdd(product.id)}
      className={`group relative flex h-full flex-col rounded-xl border p-2.5 text-left transition active:scale-[0.98] lg:p-3 ${
        soldOut
          ? "cursor-not-allowed border-slate-200 dark:border-slate-800  opacity-55"
          : qty > 0
            ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900  hover:border-blue-400 hover:shadow-md"
      }`}
    >
      {qty > 0 && (
        <span className="absolute right-1.5 top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow">
          {qty}
        </span>
      )}
      <span className="mb-2 block aspect-square w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
        {product.thumbImageId ? (
          <img
            src={`/api/images/${product.thumbImageId}`}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center text-xl font-bold text-white/90 ${categoryAvatarClass(product.categoryName)}`}
          >
            {initialsOf(product.name)}
          </span>
        )}
      </span>
      <span
        className={`line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-100 lg:text-sm ${
          qty > 0 ? "pr-6" : "pr-1"
        }`}
      >
        {product.name}
      </span>
      <span className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {product.sku}
      </span>
      <span className="mt-1.5 text-[13px] font-bold text-blue-600 dark:text-blue-400 lg:text-sm">
        {displayRp(priceSen(product))}
      </span>
      <div className="mt-auto flex items-center justify-between gap-1 pt-2">
        {product.categoryName ? (
          <span
            className={`truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${categoryChipClass(product.categoryName)}`}
          >
            {product.categoryName}
          </span>
        ) : (
          <span />
        )}
        <span
          className={`shrink-0 text-[10px] font-semibold ${
            soldOut
              ? "text-red-500"
              : lowStock
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {soldOut ? "Habis" : `stok ${product.stock}`}
        </span>
      </div>
    </button>
  );
}

export function ProductGrid({ products, cartQty, onAdd }: ProductGridProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const product of products) {
      if (product.categoryName && !seen.includes(product.categoryName)) {
        seen.push(product.categoryName);
      }
    }
    return seen;
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.categoryName !== category) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const placeholderCount = filtered.length > 0 ? PAGE_SIZE - paged.length : 0;

  const resetFilters = () => {
    setQuery("");
    setCategory(null);
    setPage(1);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
      {/* Toolbar: count + search + pagination, then category chips. */}
      <div className="shrink-0 border-b border-slate-100 dark:border-slate-800/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Package className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            Produk <span className="text-slate-300">·</span> {filtered.length}
          </h2>
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama produk atau SKU..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-9 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
            />
            {query && (
              <button
                type="button"
                aria-label="Bersihkan pencarian"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {totalPages <= 5 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-8 w-8 rounded-lg text-xs font-bold tabular-nums transition ${
                      n === currentPage
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-300 dark:border-slate-700  text-slate-600 dark:text-slate-400  hover:bg-slate-50 dark:hover:bg-slate-800/60 "
                    }`}
                  >
                    {n}
                  </button>
                ))
              ) : (
                <span className="px-2 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">
                  {currentPage} / {totalPages}
                </span>
              )}
              <button
                type="button"
                aria-label="Halaman berikutnya"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                setCategory(null);
                setPage(1);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                category === null
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400  hover:bg-slate-200 dark:hover:bg-slate-800 "
              }`}
            >
              Semua
            </button>
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setCategory(name === category ? null : name);
                  setPage(1);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                  category === name
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400  hover:bg-slate-200 dark:hover:bg-slate-800 "
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
              <Package className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              Tidak ada produk yang cocok
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Coba ubah kata kunci atau kategori.
            </p>
            {(query || category) && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                Hapus filter
              </button>
            )}
          </div>
        ) : (
          // Desktop: 4x4 grid stretched to the panel, every row keeping
          // its content as the minimum height (minmax(auto,1fr)); the
          // area scrolls when the viewport is genuinely too short.
          // Mobile: 2-3 columns, natural card heights.
          <div className="grid grid-cols-2 content-start gap-2.5 sm:grid-cols-3 lg:h-full lg:grid-cols-4 lg:[grid-template-rows:repeat(4,minmax(auto,1fr))] lg:gap-3">
            {paged.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                qty={cartQty[product.id] ?? 0}
                onAdd={onAdd}
              />
            ))}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <div
                key={`slot-${i}`}
                aria-hidden="true"
                className="hidden rounded-xl border border-dashed border-slate-200 dark:border-slate-800 lg:block"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
'@
Save-UmkmFile $p $c

# ---- [7/48] frontend/app/cashier/receipt-view.tsx ----------------------------------------
$p = @'
app/cashier/receipt-view.tsx
'@
$c = @'
// frontend/app/cashier/receipt-view.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, Loader2, Printer, RotateCcw } from "lucide-react";
import type { OutletInfo, Receipt as ReceiptType } from "./types";
import { formatRupiah } from "@/lib/format";
import { markServed } from "@/app/owner/verify/actions";

const PAYMENT_LABELS: Record<ReceiptType["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

// Module-level formatter, timezone locked to Jakarta, so the printed
// timestamp reads the same on every machine that opens the receipt.
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Screen + print rules for the receipt paper. Everything else on the
// page hides through Tailwind's print:hidden, so ONLY #struk-paper
// prints. The 48mm width fits the print head of common 58mm thermal
// printers and centers neatly on A4. This stylesheet is unlayered,
// which means it wins over Tailwind utilities without !important.
const RECEIPT_CSS = `
/* Solid cash-register rules — long clean black lines, no dashes. */
.receipt-rule {
  border-top: 1px solid #000;
  margin: 7px 0;
}
.receipt-rule-strong {
  border-top: 2px solid #000;
  margin: 7px 0 4px;
}
/* Screen only: perforated bottom edge of the paper. */
.receipt-tear {
  height: 10px;
  background-image: radial-gradient(circle at 5px 10px, transparent 4px, #fff 4.5px);
  background-size: 10px 10px;
  background-position: bottom;
  background-repeat: repeat-x;
}
/* The QR svg always fills its wrapper (84px on screen, 19mm on paper). */
#struk-paper svg {
  width: 100%;
  height: auto;
  display: block;
}
@media print {
  @page { margin: 2mm; }
  #struk-paper {
    width: 100%;
    max-width: 48mm;
    margin-inline: auto;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    font-size: 10px;
  }
  #struk-paper * {
    color: #000;
  }
  /* The UMKM logo keeps its original colors on paper; thermal mono
     printers dither it automatically. */
  #struk-paper img {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

function Rule({ strong = false }: { strong?: boolean }) {
  return (
    <div
      role="presentation"
      className={strong ? "receipt-rule-strong" : "receipt-rule"}
    />
  );
}

export function ReceiptView({
  receipt,
  outlet,
  onNewTransaction,
}: {
  receipt: ReceiptType;
  outlet: OutletInfo;
  onNewTransaction: () => void;
}) {
  const router = useRouter();
  const createdAt = dateFmt.format(new Date(receipt.createdAt));

  // Eceran serah-langsung (v1.3.0): one tap POSTs /transactions/{id}/serve
  // on backend-go so this receipt never lingers in the serve queue. The
  // handover_events + audit writes are Go's job — this UI is strictly
  // best-effort.
  const [served, setServed] = useState(false);
  const [serveError, setServeError] = useState<string | null>(null);
  const [servePending, startServeTransition] = useTransition();

  function submitServed() {
    setServeError(null);
    startServeTransition(async () => {
      const res = await markServed({ transactionId: receipt.transactionId });
      if (res.ok) {
        setServed(true);
        router.refresh();
      } else {
        setServeError(res.error);
      }
    });
  }

  return (
    <div className="min-h-dvh bg-slate-100 dark:bg-slate-900 print:bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:py-10">
        {/* Success header spans the full width ABOVE the grid, so the
            summary card and the receipt paper both start at exactly
            the same height — perfectly level side by side. */}
        <div className="flex items-center gap-4 print:hidden">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Transaksi Berhasil
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Struk siap dicetak — periksa sekali lagi sebelum menutup halaman
              ini.
            </p>
          </div>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_340px] print:mt-0 print:block">
          {/* Summary + actions — never printed. */}
          <section className="space-y-6 print:hidden">
            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Kode struk</dt>
                <dd className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {receipt.code}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Waktu</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {createdAt} WIB
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Metode pembayaran</dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {PAYMENT_LABELS[receipt.paymentMethod]}
                </dd>
              </div>
              {/* v1.3.0: kode klaim = kunci interaktif pembeli. Ditampilkan
                  di layar sukses supaya kasir bisa membacakannya saat pembeli
                  takeaway menelepon tanpa membawa struk. */}
              {receipt.claimCode && (
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-slate-500 dark:text-slate-400">Kode klaim</dt>
                  <dd className="font-mono text-sm font-bold tracking-widest text-slate-900 dark:text-slate-100">
                    {receipt.claimCode}
                  </dd>
                </div>
              )}
            </dl>

            <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(receipt.subtotal)}
                </span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Diskon</span>
                  <span className="font-medium tabular-nums text-rose-600">
                    -{formatRupiah(receipt.discount)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Total
                </span>
                <span className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(receipt.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})
                </span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(receipt.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Kembalian</span>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(receipt.changeAmount)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm">
              <p className="font-bold text-slate-800 dark:text-slate-200">Serah terima pesanan</p>
              <p className="mt-0.5 leading-relaxed">
                Makan di tempat / eceran: tandai sekarang supaya tidak
                menggantung di Antrean Penyajian kasir.
                {receipt.claimCode
                  ? " Takeaway / diantar: serahkan saja struknya — pembeli mengonfirmasi sendiri dari HP lewat QR dan kode klaim yang tercetak."
                  : ""}
              </p>
              {served ? (
                <p className="mt-2 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                  Tercatat disajikan — terima kasih!
                </p>
              ) : (
                <button
                  type="button"
                  onClick={submitServed}
                  disabled={servePending}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {servePending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {servePending ? "Menyimpan…" : "Sudah Diserahkan ke Pembeli"}
                </button>
              )}
              {serveError && (
                <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  {serveError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                <Printer className="h-4 w-4" />
                Cetak Struk
              </button>
              <button
                type="button"
                onClick={onNewTransaction}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <RotateCcw className="h-4 w-4" />
                Transaksi Baru
              </button>
            </div>

            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke beranda
            </Link>
          </section>

          {/* The receipt paper — the ONLY thing that prints. */}
          <div className="lg:sticky lg:top-8 print:static">
            <div
              id="struk-paper"
              // Kertas struk = thermal fisik: TETAP PUTIH meski aplikasi
              // sedang tema gelap (v1.8.0) — persis kertas di tangan pembeli.
              className="relative mx-auto w-full max-w-[340px] bg-white font-mono text-[11px] leading-relaxed text-slate-900 shadow-xl print:bg-white print:shadow-none dark:shadow-black/40"
            >
              <div className="px-5 py-6 print:px-0 print:py-0">
                {outlet.logoUrl ? (
                  <div className="flex items-start gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={outlet.logoUrl}
                      alt={`Logo ${outlet.name}`}
                      className="h-10 w-10 shrink-0 rounded-md object-contain print:h-[9mm] print:w-[9mm] print:rounded-none"
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold uppercase leading-tight tracking-wide break-words">
                        {outlet.name}
                      </p>
                      {outlet.address && (
                        <p className="mt-0.5 text-[9px] leading-snug">
                          {outlet.address}
                        </p>
                      )}
                      {outlet.phone && (
                        <p className="text-[9px] leading-snug">
                          Telp {outlet.phone}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-[12px] font-bold uppercase leading-tight tracking-wide break-words">
                      {outlet.name}
                    </p>
                    {outlet.address && (
                      <p className="mt-0.5 text-[9px] leading-snug">
                        {outlet.address}
                      </p>
                    )}
                    {outlet.phone && (
                      <p className="text-[9px] leading-snug">
                        Telp {outlet.phone}
                      </p>
                    )}
                  </div>
                )}

                <Rule />
                <div className="flex justify-between text-[10px]">
                  <span>No.</span>
                  <span className="break-all">{receipt.code}</span>
                </div>
                <div className="mt-0.5 flex justify-between text-[10px]">
                  <span>Tgl.</span>
                  <span>{createdAt} WIB</span>
                </div>

                <Rule />
                <div className="space-y-2">
                  {receipt.items.map((item) => (
                    <div key={item.name}>
                      <p className="font-bold leading-snug break-words">
                        {item.name}
                      </p>
                      <div className="flex justify-between gap-2 text-[10px]">
                        <span>
                          {item.quantity} x {formatRupiah(item.priceAtSale)}
                        </span>
                        <span className="tabular-nums">
                          {formatRupiah(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Rule />
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.subtotal)}
                    </span>
                  </div>
                  {receipt.discount > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon</span>
                      <span className="tabular-nums">
                        -{formatRupiah(receipt.discount)}
                      </span>
                    </div>
                  )}
                </div>

                <Rule strong />
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide">
                    Total
                  </span>
                  <span className="text-[13px] font-extrabold tabular-nums">
                    {formatRupiah(receipt.total)}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>
                      Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})
                    </span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kembalian</span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.changeAmount)}
                    </span>
                  </div>
                </div>

                <Rule />
                {receipt.qrSvg && (
                  <div className="flex flex-col items-center">
                    {/* Server-rendered QR (v1.3.0): when a claim code exists
                        it encodes the INTERACTIVE buyer page — one scan and
                        the takeaway buyer can confirm/dispute from their
                        phone. QR dan kode klaim tercetak di kertas yang
                        sama, jadi tingkat rahasianya identik. Legacy receipts
                        without a claim code fall back to the read-only
                        status page keyed by the receipt number (an address,
                        not a secret). */}
                    <div
                      className="w-[84px] print:w-[19mm]"
                      dangerouslySetInnerHTML={{ __html: receipt.qrSvg }}
                    />
                    <p className="mt-1 text-[9px]">
                      {receipt.claimCode
                        ? "Scan utk cek/konfirmasi pesanan"
                        : "Scan utk cek status pesanan"}
                    </p>
                  </div>
                )}
                {receipt.claimCode && (
                  <div className="mt-2 text-center">
                    {/* Fallback when the QR will not scan: the code is safe
                        to read aloud over the phone — its alphabet has no
                        ambiguous characters (no 0/O/1/I). Bigger than body
                        text so it survives small thermal prints. */}
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em]">
                      Kode klaim
                    </p>
                    <p className="mt-1 text-[14px] font-extrabold leading-none tracking-[0.3em]">
                      {receipt.claimCode}
                    </p>
                    <p className="mt-1 text-[9px] leading-snug">
                      Simpan sebagai bukti penerimaan pesanan
                    </p>
                  </div>
                )}
                <Rule />
                <p className="text-center text-[10px]">
                  Terima kasih atas kunjungan Anda
                </p>
                <p className="mt-0.5 text-center text-[9px]">
                  -- {outlet.name} --
                </p>
              </div>
              {/* Perforated edge — screen decoration only. */}
              <div className="receipt-tear print:hidden" aria-hidden="true" />
            </div>
            <p className="mx-auto mt-3 max-w-[340px] text-center text-xs text-slate-400 dark:text-slate-500 print:hidden">
              Pratinjau struk 58mm — yang tercetak hanya kertas struk ini.
            </p>
          </div>
        </div>
      </div>
      <style>{RECEIPT_CSS}</style>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [8/48] frontend/app/cashier/ui.tsx ----------------------------------------
$p = @'
app/cashier/ui.tsx
'@
$c = @'
"use client";

import type { PosProduct } from "./types";
import { formatRupiah, formatThousands } from "@/lib/format";

// All money math runs in integer "sen" (1 Rp = 100 sen) to avoid float drift.
export const priceSen = (product: PosProduct) =>
  Math.round(parseFloat(product.price) * 100);
export const displayRp = (sen: number) => formatRupiah(sen / 100);

// Stable hue per category: product chips and cart avatars share the same
// color language so the eye can group items at a glance.
const CATEGORY_STYLES: Record<string, { chip: string; avatar: string }> = {
  Minuman: { chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", avatar: "bg-sky-500" },
  Makanan: { chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", avatar: "bg-amber-500" },
  Sembako: { chip: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", avatar: "bg-lime-600" },
  Snack: { chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", avatar: "bg-rose-500" },
  Perawatan: { chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", avatar: "bg-violet-500" },
};
const FALLBACK = {
  chip: "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400",
  avatar: "bg-slate-400",
};

export function categoryChipClass(name: string | null): string {
  return (name && CATEGORY_STYLES[name]?.chip) || FALLBACK.chip;
}

export function categoryAvatarClass(name: string | null): string {
  return (name && CATEGORY_STYLES[name]?.avatar) || FALLBACK.avatar;
}

// Two-letter initials for the cart line avatar ("Aqua 600ml" -> "AQ").
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((word) => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Rp text input with live "Rp 300.000" grouping. Digits only: pasting
// "300.000" or "300,000" is cleaned to 300000 before parsing.
export function MoneyInput({
  valueSen,
  onChangeSen,
  ariaLabel,
}: {
  valueSen: number;
  onChangeSen: (nextSen: number) => void;
  ariaLabel: string;
}) {
  const display = valueSen > 0 ? formatThousands(valueSen / 100) : "";

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400 dark:text-slate-500">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        placeholder="0"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
          const rupiah = digits ? parseInt(digits, 10) : 0;
          onChangeSen(rupiah * 100);
        }}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
      />
    </div>
  );
}

// Percent input with a "%" suffix. Whole numbers only, clamped to 0..100.
export function PercentInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (nextPercent: number) => void;
  ariaLabel: string;
}) {
  const display = value > 0 ? String(value) : "";

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        placeholder="0"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
          const percent = digits ? Math.min(100, parseInt(digits, 10)) : 0;
          onChange(percent);
        }}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-3 pr-9 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-semibold text-slate-400 dark:text-slate-500">
        %
      </span>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [9/48] frontend/app/dev/logs/page.tsx ----------------------------------------
$p = @'
app/dev/logs/page.tsx
'@
$c = @'
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, ScrollText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLogWhere, logQueryString } from "@/lib/audit-query";
import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
} from "@/lib/audit-labels";
import { AuroraBackground } from "@/components/aurora-background";
import { SelectInput } from "@/components/select-input";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { LogsPagination } from "./logs-pagination";

export const instant = false;

// Query jejak audit penuh (Task 34 Fase B, diperbarui Task 35) —
// khusus DEVELOPER. Pagination dan filter HIDUP DI URL (server-side):
// tabel audit tumbuh tanpa batas (setiap transaksi/stok/login menambah
// baris), jadi tidak seperti halaman produk yang memuat semua baris —
// di sini setiap halaman hanya membaca 20 baris dari database.
// Task 35: kolom aksi kini label manusiawi + kode mentah, dengan
// tingkat SUKSES/PERINGATAN/GAGAL (filter-able), dan unduhan berupa
// EXCEL ber-grafik (bukan CSV polos).
// v1.6.0: design aurora + glass sadar tema (terang/gelap/sistem) —
// logika query & pagination tidak berubah sama sekali.
const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  KASIR: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DEVELOPER: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default async function DevLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const sp = await searchParams;
  const one = (key: string): string | undefined => {
    const value = sp[key];
    return typeof value === "string" ? value : undefined;
  };

  const q = one("q") ?? "";
  const action = one("action") ?? "";
  const outlet = one("outlet") ?? "";
  const actor = one("actor") ?? "";
  const from = one("from") ?? "";
  const to = one("to") ?? "";
  const level = one("level") ?? "";
  const page = Math.max(1, parseInt(one("page") ?? "1", 10) || 1);

  const actionTitle = action
    ? `${actionLabel(action)} (${action})`
    : "Semua Aksi";

  const where = buildLogWhere({ q, action, outlet, actor, from, to, level });

  const [total, rows, actionOptions, outlets, actors] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        summary: true,
        actor: { select: { name: true, role: true } },
        outlet: { select: { name: true } },
      },
    }),
    // Daftar aksi yang BENAR-BENAR pernah terjadi — dropdown filter tidak
    // pernah menawarkan aksi hantu yang tidak ada datanya.
    prisma.auditEvent.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.outlet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  // Query string filter aktif — dipakai pagination (pertahankan filter)
  // dan tombol export (unduh hasil filter INI, bukan semua log).
  const qs = logQueryString({ q, action, outlet, actor, from, to, level });

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: brand + breadcrumb + tema ===== */}
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-200/80 bg-slate-100/70 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-[1px] shadow-md shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <ScrollText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Log Aktivitas
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {total.toLocaleString("id-ID")} baris cocok filter
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 pl-4 text-xs font-medium text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
                <Link
                  href="/dev"
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Konsol
                </Link>
                <span className="text-slate-400 dark:text-slate-600">/</span>
                <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                  {actionTitle}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <ThemeHeaderActions />

              {/* Tautan <a> biasa ke route export: filter sama persis dengan
                  layar, jadi file yang terunduh = yang sedang dilihat. Kini
                  berupa .xlsx: tabel rapi + grafik tren/periodik + pivot. */}
              <a
                href={`/api/logs/export${qs}`}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Unduh Excel (+ Grafik)</span>
                <span className="sm:hidden">Excel</span>
              </a>
            </div>
          </div>
        </header>

        <Link
          href="/dev"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke konsol developer
        </Link>

        <div className="mt-4 mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Jejak Audit Sistem
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
              Setiap aksi tercatat: login, transaksi, stok, akun, hingga
              percobaan yang gagal. Filter hidup di URL — hasilnya bisa
              di-bookmark dan dibagikan; maksimum 10.000 baris per unduhan.
            </p>
          </div>
        </div>

        <form
          method="get"
          className="glass-card grid gap-2.5 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="relative lg:col-span-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Cari ringkasan / entitas / nama aktor…"
              aria-label="Cari teks"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition-all focus:outline-none"
            />
          </div>
          <SelectInput name="action" defaultValue={action} aria-label="Filter aksi">
            <option value="">Semua aksi</option>
            {actionOptions.map((a) => (
              <option key={a.action} value={a.action}>
                {actionLabel(a.action)} ({a.action})
              </option>
            ))}
          </SelectInput>
          <SelectInput name="level" defaultValue={level} aria-label="Filter tingkat">
            <option value="">Semua tingkat</option>
            <option value="SUKSES">SUKSES — selesai normal</option>
            <option value="PERINGATAN">PERINGATAN — aksi sensitif</option>
            <option value="GAGAL">GAGAL — ada error</option>
          </SelectInput>
          <SelectInput name="outlet" defaultValue={outlet} aria-label="Filter outlet">
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput name="actor" defaultValue={actor} aria-label="Filter aktor">
            <option value="">Semua aktor</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectInput>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <input
                type="date"
                name="from"
                defaultValue={from}
                aria-label="Dari tanggal (WIB)"
                className="glass-input w-full rounded-xl px-3 py-2.5 text-xs transition-all focus:outline-none"
              />
            </div>
            <div>
              <input
                type="date"
                name="to"
                defaultValue={to}
                aria-label="Sampai tanggal (WIB)"
                className="glass-input w-full rounded-xl px-3 py-2.5 text-xs transition-all focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
            >
              Terapkan Filter
            </button>
            <Link
              href="/dev/logs"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Reset
            </Link>
            <p className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
              Rentang tanggal ditafsirkan menurut WIB.
            </p>
          </div>
        </form>

        <section className="glass-card mt-3 overflow-hidden rounded-2xl border-slate-200/80 dark:border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                  <th className="px-4 py-3 font-semibold">Aktor</th>
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                  <th className="px-4 py-3 font-semibold">Entitas</th>
                  <th className="px-4 py-3 font-semibold">Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const lvl = actionLevel(row.action);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-200/60 align-top last:border-0 dark:border-slate-800/50 ${
                        lvl === "GAGAL"
                          ? "bg-red-50/40 dark:bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatWib(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {row.actor?.name ?? "Sistem"}
                        </span>
                        {row.actor && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[row.actor.role] ?? "bg-slate-400/10 text-slate-600 dark:text-slate-300"}`}
                          >
                            {row.actor.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {row.outlet?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {/* Label manusiawi berwarna tingkat + kode mentah:
                            "Owner menonaktifkan kasir" terbaca sekali
                            lihat, method aslinya tetap ada untuk pencarian. */}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_BADGE[lvl]}`}
                        >
                          {actionLabel(row.action)}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {row.action}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                        {row.entity ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {row.summary}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Tidak ada log yang cocok — longgarkan filter atau
                      perlebar rentang tanggal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <LogsPagination
            page={safePage}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/dev/logs"
            queryString={qs}
          />
        </section>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [10/48] frontend/app/dev/outlet-create-button.tsx ----------------------------------------
$p = @'
app/dev/outlet-create-button.tsx
'@
$c = @'
"use client";

// Tombol "Outlet Baru" di konsol developer (Task 35). Pemilik warung
// menambah outlet dari sini tanpa harus membuka form akun — form akun
// punya jalur buat-outletnya sendiri ("+ Outlet baru…").
// Modal + controlled state: kalau gagal (nama kembar dsb.) semua isian
// tetap di layar beserta pesan errornya.
// v1.6.0: modal glass sadar tema (terang/gelap) mengikuti konsol dev.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, X } from "lucide-react";
import { createOutlet } from "./users/actions";

export function OutletCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startAsync] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Nama outlet minimal 2 karakter.");
      return;
    }
    const result = await createOutlet({
      name: trimmed,
      address: address.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Tabel outlet + omzet di halaman ini diambil ulang dari server.
    router.refresh();
    setOpen(false);
    setName("");
    setAddress("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-purple-500 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Outlet Baru
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-md sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Buat outlet baru"
        >
          <div className="glass-card relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border-slate-200/80 shadow-2xl sm:rounded-2xl dark:border-slate-800/80">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20">
                  <Building2 className="h-4 w-4" />
                </div>
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  Outlet baru
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300">
                  Nama outlet
                </label>
                <input
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Warung Bu Sari 2"
                  maxLength={60}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300">
                  Alamat (opsional)
                </label>
                <input
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="mis. Jl. Merdeka No. 10"
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Outlet baru langsung bisa dipilih di form akun dan punya
                baris sendiri di tabel outlet. Pencatatan: OUTLET_CREATE.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => startAsync(handleSubmit)}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Buat Outlet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
'@
Save-UmkmFile $p $c

# ---- [11/48] frontend/app/dev/outlets/[id]/page.tsx ----------------------------------------
$p = @'
app/dev/outlets/[id]/page.tsx
'@
$c = @'
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Calculator,
  LayoutDashboard,
  Store,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { enterMaintenance } from "@/app/dev/maintenance-actions";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";

export const instant = false;

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// Drill-down outlet (Task 34 Fase B) — data bisnis READ-ONLY by design:
// developer MEMBACA untuk memantau, mengubah hanya lewat jalurnya
// masing-masing (produk/stok oleh owner outlet, akun oleh /dev/users).
// Task 35 menambah pintu MAINTENANCE: developer bisa membuka konsol
// owner & POS kasir outlet ini "menjadi stafnya" — memakai cookie
// dev_outlet yang disuntikkan ke sesi (lihat lib/auth.ts), keluar
// kapan saja lewat banner amber.
// v1.6.0: design aurora + glass sadar tema — logika data tidak berubah.
export default async function DevOutletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const { id } = await params;
  const outlet = await prisma.outlet.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!outlet) notFound();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [products, users, transactions, todayAgg, lowStockCount] =
    await Promise.all([
      prisma.product.findMany({
        where: { outletId: outlet.id },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        take: 200,
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stock: true,
          minStock: true,
          unit: true,
          isActive: true,
          category: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        // Task 35: akun terhapus tidak pernah tampil di sini — dari
        // sudut pandang daftar, hapus = selamanya.
        where: { outletId: outlet.id, deletedAt: null },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      }),
      prisma.transaction.findMany({
        where: { outletId: outlet.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          code: true,
          createdAt: true,
          total: true,
          status: true,
          paymentMethod: true,
          cashier: { select: { name: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          outletId: outlet.id,
          status: "COMPLETED",
          createdAt: { gte: startOfToday },
        },
        _count: true,
        _sum: { total: true },
      }),
      prisma.product.count({
        where: {
          outletId: outlet.id,
          isActive: true,
          stock: { lte: prisma.product.fields.minStock },
        },
      }),
    ]);

  const omzetToday = todayAgg._sum.total
    ? parseFloat(todayAgg._sum.total.toString())
    : 0;
  const activeUsers = users.filter((u) => u.isActive).length;

  const statCards = [
    {
      label: "Produk",
      value: String(products.length),
      icon: Boxes,
      tint: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
      tint: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Pengguna Aktif",
      value: String(activeUsers),
      icon: Users,
      tint: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(omzetToday),
      icon: Store,
      tint: "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
  ];

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: brand + breadcrumb + tema ===== */}
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-200/80 bg-slate-100/70 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-md shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="block max-w-[200px] truncate text-base leading-none font-extrabold tracking-tight text-slate-900 sm:max-w-none dark:text-white">
                    {outlet.name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Drill-down outlet · baca-saja
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 pl-4 text-xs font-medium text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
                <Link
                  href="/dev"
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Konsol
                </Link>
                <span className="text-slate-400 dark:text-slate-600">/</span>
                <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                  {outlet.name}
                </span>
              </div>
            </div>

            <ThemeHeaderActions />
          </div>
        </header>

        <Link
          href="/dev"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke konsol developer
        </Link>

        <header className="mt-4 mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              {outlet.name}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {outlet.address ?? "alamat belum diisi"}
              {outlet.phone ? ` · ${outlet.phone}` : ""}
              {!outlet.isActive && (
                <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  nonaktif
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Data bisnis tampil baca-saja; mode maintenance di bawah untuk
              membuka konsol owner / kasir outlet ini.
            </p>
          </div>
        </header>

        {/* Mode maintenance (Task 35): developer "menjadi" staf outlet ini
            — membuka /owner atau /cashier yang isinya mengikuti outlet.
            Masuk & keluar tercatat (DEV_MAINTENANCE_ENTER/EXIT). */}
        <section className="mt-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 dark:border-amber-500/20 dark:bg-amber-950/20">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-300">
            <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Akses Maintenance
          </h2>
          <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-200/80">
            Buka area owner atau kasir outlet {outlet.name} seolah Anda
            stafnya — untuk men-debug, melatih, atau memperbaiki. Banner
            amber di halaman tersebut jadi pengingat bahwa Anda sedang
            bertindak sebagai developer; tekan &quot;Keluar Mode&quot; untuk
            kembali.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <form action={enterMaintenance.bind(null, outlet.id, "owner")}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Buka Konsol Owner
              </button>
            </form>
            <form action={enterMaintenance.bind(null, outlet.id, "cashier")}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98]"
              >
                <Calculator className="h-4 w-4" />
                Buka Kasir (POS)
              </button>
            </form>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="glass-card rounded-2xl p-4">
              <p className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                <span className="font-medium">{card.label}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${card.tint}`}
                >
                  <card.icon className="h-4 w-4" />
                </span>
              </p>
              <p
                className={`mt-1.5 truncate text-lg font-black tabular-nums sm:text-xl ${
                  card.label === "Stok Menipis" && lowStockCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="glass-card mt-4 rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Produk &amp; Stok (200 teratas)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Harga
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Stok</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const low = p.isActive && p.stock <= p.minStock;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {p.name}
                        {!p.isActive && (
                          <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            arsip
                          </span>
                        )}
                        <p className="font-mono text-[11px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
                          {p.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {formatRupiah(Math.round(Number(p.price)))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {p.stock} {p.unit}
                      </td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            menipis
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {p.isActive ? "aman" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Outlet ini belum punya produk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="glass-card rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Pengguna Outlet
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Kelola akun (reset password, nonaktif, hapus) lewat{" "}
              <Link
                href="/dev/users"
                className="font-semibold text-violet-700 hover:underline dark:text-violet-400"
              >
                Kelola Akun
              </Link>
              . Akun terhapus tidak ditampilkan.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Peran</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {u.name}
                        </p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {u.role}
                      </td>
                      <td className="px-4 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            nonaktif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Belum ada pengguna terikat outlet ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-card rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Transaksi Terbaru
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Hari ini: {todayAgg._count} transaksi ·{" "}
              {formatRupiah(omzetToday)}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Struk</th>
                    <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                    <th className="px-4 py-3 font-semibold">Kasir</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.code}
                        {t.status === "REFUNDED" && (
                          <span className="ml-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-sans text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            refund
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatWib(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {t.cashier?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {formatRupiah(Math.round(Number(t.total)))}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Belum ada transaksi di outlet ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [12/48] frontend/app/dev/page.tsx ----------------------------------------
$p = @'
app/dev/page.tsx
'@
$c = @'
// Konsol Developer (Fase A + B + penyempurnaan Task 35).
// Super-user lintas outlet: ringkasan sistem, pintasan kelola akun &
// log aktivitas, daftar outlet (klik = drill-down, tombol + = buat baru),
// dan 20 jejak audit terbaru yang tampil dengan LABEL MANUSIAWI +
// tingkat SUKSES/PERINGATAN/GAGAL.
// v1.6.0: design aurora + glassmorphism ala konsol Kelola Akun, kini
// SADAR TEMA (terang/gelap/sistem) + toggle tema & pintu /settings di
// topbar. Logika data Prisma TIDAK berubah sedikit pun.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  LogOut,
  ScrollText,
  ShieldCheck,
  Store,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
} from "@/lib/audit-labels";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { OutletCreateButton } from "./outlet-create-button";

export const instant = false;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  KASIR: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DEVELOPER: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default async function DevConsolePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Hanya DEVELOPER boleh melihat konsol ini — owner & kasir punya
  // halamannya sendiri dan tidak boleh membaca data lintas outlet.
  if (session.user.role !== "DEVELOPER") redirect("/");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    outlets,
    activeUsers,
    todayAgg,
    lowStockCount,
    omzetByOutlet,
    auditEvents,
  ] = await Promise.all([
    prisma.outlet.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: startOfToday } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({
      where: {
        isActive: true,
        stock: { lte: prisma.product.fields.minStock },
      },
    }),
    prisma.transaction.groupBy({
      by: ["outletId"],
      where: { status: "COMPLETED", createdAt: { gte: startOfToday } },
      _sum: { total: true },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actor: { select: { name: true, role: true } },
        outlet: { select: { name: true } },
      },
    }),
  ]);

  const omzetToday = todayAgg._sum.total
    ? parseFloat(todayAgg._sum.total.toString())
    : 0;
  const omzetMap = new Map<string, number>();
  for (const row of omzetByOutlet) {
    omzetMap.set(
      row.outletId,
      row._sum.total ? parseFloat(row._sum.total.toString()) : 0,
    );
  }

  const statCards = [
    {
      label: "Outlet",
      value: String(outlets.length),
      icon: Building2,
      tint: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Akun Aktif",
      value: String(activeUsers),
      icon: Users,
      tint: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(omzetToday),
      icon: Store,
      tint: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
      tint: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: brand + breadcrumb + tema + keluar ===== */}
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-200/80 bg-slate-100/70 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-400 p-[1px] shadow-md shadow-violet-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    UMKM OS
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Konsol Developer
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 pl-4 text-xs font-medium text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
                <span className="truncate">
                  {session.user.name ?? "Developer"} · akses lintas outlet
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <ThemeHeaderActions />

              <div className="hidden h-6 w-[1px] bg-slate-200 sm:block dark:bg-slate-800" />

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-600 backdrop-blur transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Pintasan Fase B: dua pintu utama konsol. Kartu besar + panah —
            bukan menu tersembunyi, karena ini alasan konsol ini ada. */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dev/users"
            className="glass-card group flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:border-violet-500/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Kelola Akun
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Buat owner &amp; kasir, reset password, nonaktifkan, hapus -
                  semua outlet.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-600 dark:group-hover:text-violet-400" />
          </Link>
          <Link
            href="/dev/logs"
            className="glass-card group flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:border-violet-500/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
                <ScrollText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Log Aktivitas
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Query jejak audit lengkap + filter tingkat &amp; unduh Excel
                  dengan grafik analisa.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-600 dark:group-hover:text-violet-400" />
          </Link>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="glass-card rounded-2xl p-4 transition-all"
            >
              <p className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                <span className="font-medium">{card.label}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${card.tint}`}
                >
                  <card.icon className="h-4 w-4" />
                </span>
              </p>
              <p
                className={`mt-1.5 truncate text-lg font-black tabular-nums sm:text-xl ${
                  card.label === "Stok Menipis" && lowStockCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="glass-card mt-4 rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Outlet
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Setiap outlet punya produk, stok, dan akunnya sendiri, terpisah
                secara data, satu database, satu pantauan. Klik nama outlet
                untuk drill-down atau masuk mode maintenance.
              </p>
            </div>
            <OutletCreateButton />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Alamat</th>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Omzet Hari Ini</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <Link
                        href={`/dev/outlets/${o.id}`}
                        className="transition hover:text-violet-700 hover:underline dark:hover:text-violet-400"
                      >
                        {o.name}
                      </Link>
                      {!o.isActive && (
                        <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {o.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {o._count.products}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatRupiah(omzetMap.get(o.id) ?? 0)}
                    </td>
                  </tr>
                ))}
                {outlets.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Belum ada outlet terdaftar — tekan &quot;Outlet Baru&quot;
                      untuk membuat yang pertama.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass-card mt-4 rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Jejak Audit Terbaru
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Semua aksi tercatat dengan tingkat keseriusan:{" "}
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30">
              SUKSES
            </span>{" "}
            selesai normal,{" "}
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30">
              PERINGATAN
            </span>{" "}
            aksi sensitif,{" "}
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30">
              GAGAL
            </span>{" "}
            percobaan yang error.{" "}
            <Link
              href="/dev/logs"
              className="font-semibold text-violet-700 hover:underline dark:text-violet-400"
            >
              Buka query penuh + unduh Excel →
            </Link>
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                  <th className="px-4 py-3 font-semibold">Aktor</th>
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                  <th className="px-4 py-3 font-semibold">Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((e) => {
                  const level = actionLevel(e.action);
                  return (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-200/60 align-top last:border-0 dark:border-slate-800/50 ${
                        level === "GAGAL"
                          ? "bg-red-50/40 dark:bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatWib(e.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {e.actor?.name ?? "Sistem"}
                        </span>
                        {e.actor && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              ROLE_BADGE[e.actor.role] ??
                              "bg-slate-400/10 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {e.actor.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {e.outlet?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {/* Label manusiawi + kode mentah di bawahnya:
                            terbaca cepat DAN tetap bisa dicari. */}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_BADGE[level]}`}
                        >
                          {actionLabel(e.action)}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {e.action}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {e.summary}
                      </td>
                    </tr>
                  );
                })}
                {auditEvents.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Belum ada aksi tercatat — jalankan satu transaksi di
                      kasir lalu muat ulang halaman ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Fase A + B + penyempurnaan Task 35 aktif · Fase C (kelola kasir oleh
          owner + Akun Saya semua peran) menyusul setelah blok ini
          diverifikasi.
        </p>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [13/48] frontend/app/dev/users/account-form-modal.tsx ----------------------------------------
$p = @'
app/dev/users/account-form-modal.tsx
'@
$c = @'
"use client";

// Modal buat / edit akun dari konsol developer — design v1.5.0 ala
// mockup Gemini (glass gelap, max-w-lg rounded-3xl, label uppercase,
// tombol gradien). LOGIC IDENTIK dengan versi sebelumnya:
// Create: nama, email, password awal (checklist hidup saat mengetik —
// kini 4 syarat: panjang, huruf besar, ANGKA, simbol), peran, outlet —
// dan opsi "+ Outlet baru…" yang membuat outlet SEBELUM akun (pola yang
// sama dengan "+ Kategori baru…" di form produk).
// Edit: sama tanpa password (reset password punya modal sendiri) +
// checkbox aktif. Semua field controlled state: nilai TIDAK PERNAH
// hilang saat submit gagal — pesan error muncul, form tetap terisi.
// Modal ikut tema aplikasi (varian dark:) — terang di tema terang,
// gelap di tema gelap, sama dengan halaman induknya.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LuMapPin, LuShieldCheck, LuUserPlus, LuX } from "react-icons/lu";
import { PasswordInput } from "@/components/password-input";
import { SelectInput } from "@/components/select-input";
import { isPasswordValid } from "@/lib/password-policy";
import { createAccount, createOutlet, updateAccount } from "./actions";
import { roleBadgeDark } from "./view-helpers";
import type { OutletOption, UserRow } from "./types";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LABEL_CLASS =
  "mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300";

// Nilai sentinel pilihan "buat outlet baru dulu" — konvensi "__new__"
// disalin dari form produk (kategori) supaya perilakunya seragam.
const NEW_OUTLET = "__new__";

// Spinner resident — gaya tombol design (sama dengan login).
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AccountFormModal({
  user,
  outlets,
  onClose,
}: {
  // null = mode buat akun baru; row = mode edit akun itu.
  user: UserRow | null;
  outlets: OutletOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, startAsync] = useTransition();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  // Baris DEVELOPER tidak pernah bisa dibuka edit (tombolnya mati), tapi
  // state tetap disempitkan eksplisit ke OWNER | KASIR supaya tipe input
  // action tidak pernah berbohong.
  const [role, setRole] = useState<"OWNER" | "KASIR">(
    user?.role === "OWNER" ? "OWNER" : "KASIR",
  );
  // "" = tanpa outlet (hanya sah untuk OWNER: akses semua outlet).
  const [outletId, setOutletId] = useState(user?.outletId ?? "");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  // Field "outlet baru" — aktif hanya saat pilihan outlet = __new__.
  const [newOutletName, setNewOutletName] = useState("");
  const [newOutletAddress, setNewOutletAddress] = useState("");

  // Escape untuk menutup modal — sama seperti editor foto/gambar produk.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const outletRequired = role === "KASIR";
  const creatingOutlet = outletId === NEW_OUTLET;
  const rb = roleBadgeDark(role);

  async function handleSubmit() {
    setError(null);

    // Langkah 1 — bila dipilih "+ Outlet baru…": buat outlet DULU.
    // Akun butuh id outlet nyata; kalau pembuatan outlet gagal, akun
    // tidak dibuat dan semua isian tetap ada di layar.
    let finalOutletId = outletId;
    if (creatingOutlet) {
      const trimmed = newOutletName.trim();
      if (trimmed.length < 2) {
        setError("Nama outlet baru minimal 2 karakter.");
        return;
      }
      const result = await createOutlet({
        name: trimmed,
        address: newOutletAddress.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      finalOutletId = result.outletId;
    }

    // Langkah 2 — validasi cepat di klien (server tetap memvalidasi
    // ulang; ini hanya supaya pesan muncul seketika tanpa round-trip).
    const inputOutlet = finalOutletId || null;
    if (outletRequired && !inputOutlet) {
      setError("Kasir wajib dipilihkan outlet.");
      return;
    }
    if (!user && !isPasswordValid(password)) {
      setError("Password belum memenuhi semua syarat (lihat checklist).");
      return;
    }

    // Langkah 3 — buat/ubah akun.
    const result = user
      ? await updateAccount({
          userId: user.id,
          name,
          email,
          role,
          outletId: inputOutlet,
          isActive,
        })
      : await createAccount({
          name,
          email,
          password,
          role,
          outletId: inputOutlet,
        });

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // router.refresh() = server component mengambil data baru; modal
    // ditutup setelah baris baru benar-benar terlihat di tabel.
    startTransition(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={user ? `Ubah akun ${user.name}` : "Buat akun baru"}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass-card relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-slate-300/80 dark:border-slate-700/80 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-5 right-5 rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="flex shrink-0 items-center space-x-3 px-6 pt-6 pb-5 sm:px-8">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
              user
                ? "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-600/25"
                : "bg-gradient-to-tr from-blue-500 via-blue-600 to-indigo-600 shadow-blue-500/25"
            }`}
          >
            {user ? (
              <LuShieldCheck className="h-5 w-5" />
            ) : (
              <LuUserPlus className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">
              {user ? `Ubah Akun — ${user.name}` : "Tambah Akun Baru"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user ? (
                <span
                  className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${rb.badge}`}
                >
                  {rb.label}
                </span>
              ) : (
                "Isi data dan tentukan tingkat hak akses pengguna."
              )}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-2 sm:px-8">
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="acc-name" className={LABEL_CLASS}>
              Nama Lengkap
            </label>
            <input
              id="acc-name"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              maxLength={60}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="acc-email" className={LABEL_CLASS}>
              Email Pengguna
            </label>
            <input
              id="acc-email"
              type="email"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@warung.id"
              maxLength={100}
              autoComplete="off"
            />
          </div>

          {!user && (
            <div>
              <label htmlFor="acc-password" className={LABEL_CLASS}>
                Kata Sandi Awal
              </label>
              <div className="mt-1.5">
                <PasswordInput
                  id="acc-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  showChecklist
                />
              </div>
              <span className="mt-1 block text-[10px] text-slate-500">
                Minimal 8 karakter — wajib ada huruf besar, angka, dan simbol.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acc-role" className={LABEL_CLASS}>
                Peran / Hak Akses
              </label>
              <SelectInput
                id="acc-role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value === "OWNER" ? "OWNER" : "KASIR")
                }
              >
                <option value="KASIR">Kasir (Terbatas)</option>
                <option value="OWNER">Owner (Akses Penuh Warung)</option>
              </SelectInput>
              <p className="mt-1 text-[10px] text-slate-500">
                Akun DEVELOPER tidak bisa dibuat dari sini.
              </p>
            </div>
            <div>
              <label htmlFor="acc-outlet" className={LABEL_CLASS}>
                Penempatan Outlet {outletRequired ? "(wajib)" : ""}
              </label>
              <SelectInput
                id="acc-outlet"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
              >
                <option value="">
                  {outletRequired
                    ? "— pilih outlet —"
                    : "Akses Global (Semua Outlet)"}
                </option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
                {/* Pintu yang sama seperti "+ Kategori baru…" di form
                    produk: pilih, isi nama, selesai — tanpa keluar dari
                    form akun. */}
                <option value={NEW_OUTLET}>+ Outlet baru…</option>
              </SelectInput>
            </div>
          </div>

          {creatingOutlet && (
            <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                <LuMapPin className="h-3.5 w-3.5" />
                Outlet baru
              </p>
              <input
                className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                value={newOutletName}
                onChange={(e) => setNewOutletName(e.target.value)}
                placeholder="Nama outlet (mis. Warung Bu Sari 2)"
                maxLength={60}
                autoComplete="off"
              />
              <input
                className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                value={newOutletAddress}
                onChange={(e) => setNewOutletAddress(e.target.value)}
                placeholder="Alamat (opsional)"
                maxLength={120}
                autoComplete="off"
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Outlet dibuat lebih dulu saat menekan tombol simpan, lalu akun
                otomatis terikat ke outlet itu. Gagal bikin outlet = tidak ada
                yang dibuat, isian tetap aman di layar.
              </p>
            </div>
          )}

          {user && (
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-blue-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Akun aktif (bisa login)
              </span>
            </label>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 px-6 pt-4 pb-6 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            {user ? "Simpan Akun" : "Buat Akun"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [14/48] frontend/app/dev/users/page.tsx ----------------------------------------
$p = @'
app/dev/users/page.tsx
'@
$c = @'
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { AuroraBackground } from "@/components/aurora-background";
import { UsersClient } from "./users-client";
import {
  mapGoOutlets,
  mapGoUsers,
  type GoOutletDTO,
  type GoUserDTO,
} from "./view-helpers";

export const instant = false;

// Konsol kelola akun (khusus DEVELOPER) — kini membaca langsung dari
// backend-go: GET /users (akun live + last_transaction_at) dan
// GET /outlets (pilihan ikatan di form akun). Akun terhapus tidak
// pernah dikirim Go (deleted_at IS NULL), jadi filter di UI tidak
// perlu tahu konsep itu.
export default async function DevUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const goToken = session.user.goToken ?? "";
  const [usersRes, outletsRes] = await Promise.all([
    goFetch<GoUserDTO[]>(goToken, "/users"),
    goFetch<GoOutletDTO[]>(goToken, "/outlets"),
  ]);

  // Backend tidak terjangkau: kartu error yang jelas, bukan crash —
  // mengikuti tema aplikasi (aurora + glass, terang/gelap).
  if (!usersRes.ok || !outletsRes.ok) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-slate-100 p-4 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <AuroraBackground />
        <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-8 text-center">
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
            Kelola Akun tidak bisa dimuat
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Backend-go tidak merespons di{" "}
            {usersRes.ok ? "daftar outlet" : "daftar akun"}. Pastikan container
            backend-go jalan (docker compose ps), lalu muat ulang halaman ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <UsersClient
      users={mapGoUsers(usersRes.data)}
      outlets={mapGoOutlets(outletsRes.data)}
      currentUserId={session.user.id}
      userName={session.user.name ?? "Developer"}
      userEmail={session.user.email ?? ""}
    />
  );
}
'@
Save-UmkmFile $p $c

# ---- [15/48] frontend/app/dev/users/users-client.tsx ----------------------------------------
$p = @'
app/dev/users/users-client.tsx
'@
$c = @'
"use client";

// Konsol "Kelola Akun & Hak Akses" — design v1.5.0 (ala mockup Gemini:
// aurora + glassmorphism) kini SADAR TEMA: mengikuti tema aplikasi
// (terang/gelap/sistem) lewat varian dark: — tidak lagi memaksa gelap.
// LOGIC TETAP VERSI KITA: data dari backend-go lewat server component
// induk; filter (cari/peran/outlet/status) + pagination 20 baris di
// klien; aksi lewat server action (buat/ubah/reset password/toggle
// aktif/hapus ketik-email); baris DEVELOPER & baris sendiri terkunci
// (server juga menolak); akun terhapus tidak pernah dikirim Go — dari
// sudut daftar, hapus = selamanya; jejaknya hidup di /dev/logs.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowRight,
  LuBell,
  LuChevronRight,
  LuCircleCheck,
  LuCodeXml,
  LuCrown,
  LuFileCheck2,
  LuHistory,
  LuKeyRound,
  LuMapPin,
  LuPencil,
  LuScanLine,
  LuSearch,
  LuShield,
  LuShieldAlert,
  LuStore,
  LuTrash2,
  LuUserPlus,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { AuroraBackground } from "@/components/aurora-background";
import { SelectInput } from "@/components/select-input";
import { TablePagination } from "@/components/table-pagination";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { PasswordInput } from "@/components/password-input";
import { isPasswordValid } from "@/lib/password-policy";
import {
  deleteAccountSoft,
  resetAccountPassword,
  setAccountActive,
} from "./actions";
import { AccountFormModal } from "./account-form-modal";
import {
  avatarGradient,
  formatWibDateTime,
  initials,
  roleBadgeDark,
} from "./view-helpers";
import type { OutletOption, UserRow } from "./types";

const PAGE_SIZE = 20;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Ikon + bayangan avatar per peran (visual saja — label & warna kelas
// ada di view-helpers.roleBadgeDark/avatarGradient supaya bisa diuji).
const ROLE_ICON: Record<UserRow["role"], typeof LuCrown> = {
  DEVELOPER: LuCodeXml,
  OWNER: LuCrown,
  KASIR: LuScanLine,
};
const AVATAR_SHADOW: Record<UserRow["role"], string> = {
  DEVELOPER: "shadow-purple-500/20",
  OWNER: "shadow-blue-500/20",
  KASIR: "shadow-emerald-500/20",
};

// Kelas dasar tombol aksi baris tabel (design: ikon senyap, menyala
// berwarna saat hover). disabled dipakai baris terkunci.
const ACTION_BTN =
  "p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all disabled:cursor-not-allowed disabled:opacity-30";

// Spinner resident — gaya tombol design (sama dengan login).
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Modal reset password: aksi sensitif selalu butuh langkah (dan niat)
// tersendiri — terpisah dari form utama. Checklist syarat hidup di
// bawah input (4 syarat: panjang, huruf besar, angka, simbol).
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startAsync] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit() {
    setError(null);
    const result = await resetAccountPassword({
      userId: user.id,
      newPassword: password,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Reset password ${user.name}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass-card relative w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-5 right-5 rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <LuKeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">
              Reset Kata Sandi
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.name} · {user.email}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 dark:text-slate-300 uppercase">
              Kata Sandi Baru
            </label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              showChecklist
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              Minimal 8 karakter — wajib ada huruf besar, angka, dan simbol.
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Password lama tidak perlu diketahui. Berlaku untuk login berikutnya;
            sesi yang sedang berjalan tidak diputus.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !isPasswordValid(password)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-600/25 transition-all hover:from-amber-400 hover:to-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Reset Password
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Modal konfirmasi hapus: ketik email = konfirmasi yang tidak bisa
// dilakukan asal klik. Teks tetap tegas dan menjelaskan akibat persisnya.
function DeleteAccountModal({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startAsync] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const typedOk = confirmText.trim().toLowerCase() === user.email;

  async function handleSubmit() {
    setError(null);
    const result = await deleteAccountSoft({ userId: user.id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Hapus akun ${user.name}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass-card relative w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-5 right-5 rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <LuTrash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">Hapus Akun</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.name} · {user.email}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Akun dihapus <b className="text-slate-900 dark:text-white">selamanya dari daftar</b> —
            tidak bisa dibatalkan. Email{" "}
            <b className="text-slate-700 dark:text-slate-200">{user.email}</b> dibebaskan supaya
            bisa dipakai akun baru. Riwayat transaksi dan jejak log atas nama
            akun ini <b className="text-slate-900 dark:text-white">tetap tersimpan</b> — penghapusan
            ini sendiri juga masuk log.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 dark:text-slate-300 uppercase">
              Ketik email akun untuk konfirmasi
            </label>
            <input
              className="glass-input w-full rounded-xl px-4 py-2.5 font-mono text-xs focus:outline-none"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !typedOk}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition-all hover:bg-rose-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Hapus Akun
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function UsersClient({
  users,
  outlets,
  currentUserId,
  userName,
  userEmail,
}: {
  users: UserRow[];
  outlets: OutletOption[];
  currentUserId: string;
  userName?: string;
  userEmail?: string;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [outlet, setOutlet] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // undefined = tertutup; null = modal buat; row = modal edit.
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (role !== "ALL" && user.role !== role) return false;
      if (outlet !== "ALL") {
        if (
          outlet === "__none__"
            ? user.outletId !== null
            : user.outletId !== outlet
        )
          return false;
      }
      if (status === "ACTIVE" && !user.isActive) return false;
      if (status === "INACTIVE" && user.isActive) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
  }, [users, query, role, outlet, status]);

  useEffect(() => {
    setPage(1);
  }, [query, role, outlet, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function handleToggle(user: UserRow) {
    setTogglingId(user.id);
    try {
      const result = await setAccountActive({
        userId: user.id,
        isActive: !user.isActive,
      });
      if (result.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setTogglingId(null);
    }
  }

  // Angka kartu metrik: ASLI dari data yang sama dengan tabel — bukan
  // angka demo. Kartu 2 & 4 memang kualitatif (hirarki & status audit).
  const activeCount = users.filter((u) => u.isActive).length;
  const activePct =
    users.length === 0 ? 0 : Math.round((activeCount / users.length) * 100);
  const namaOutletPertama = outlets[0]?.name;

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* ===== Topbar: brand + breadcrumb + notifikasi + profil ===== */}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-md shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <LuStore className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    UMKM OS
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Kasir &amp; Intelijensi Bisnis
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 dark:border-slate-800 pl-4 text-xs font-medium text-slate-500 dark:text-slate-400 md:flex">
                <Link
                  href="/dev"
                  className="text-slate-600 dark:text-slate-300 transition hover:text-slate-900 dark:hover:text-white"
                >
                  Konsol
                </Link>
                <LuChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-600 dark:text-blue-400">
                  Kelola Akun
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Toggle tema + pintu /settings — tema tiap orang tersimpan
                  per pengguna (kunci localStorage "theme-<idUser>"). */}
              <ThemeHeaderActions />

              {/* Lonceng = pintu ke log aktivitas (notifikasi sistem). */}
              <Link
                href="/dev/logs"
                title="Notifikasi — log aktivitas sistem"
                aria-label="Log aktivitas sistem"
                className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-2 text-slate-500 dark:text-slate-400 transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
              >
                <LuBell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500" />
              </Link>

              <div className="hidden h-6 w-[1px] bg-slate-200 dark:bg-slate-800 sm:block" />

              <div className="flex items-center space-x-3 pl-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-xs font-bold text-white ring-2 ring-purple-500/30">
                  {initials(userName || "Developer")}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs leading-tight font-bold text-slate-900 dark:text-white">
                    {userName ?? "Developer"}
                  </div>
                  <div className="max-w-[200px] truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {userEmail ?? ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ===== Konten utama ===== */}
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          {/* Judul halaman + aksi utama */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Kelola Akun &amp; Hak Akses
                </h1>
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Semua Outlet
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
                Atur wewenang pengguna, alokasi tugas kasir per outlet, serta
                pantau aktivitas jualan terakhir setiap akun.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] sm:w-auto"
              >
                <LuUserPlus className="h-4 w-4" />
                <span>Tambah Akun Baru</span>
              </button>
            </div>
          </div>

          {/* Kartu metrik */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-blue-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Total Akun Terdaftar</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <LuUsers className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {users.length}{" "}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Pengguna
                </span>
              </div>
              <div
                className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${
                  activePct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                <LuCircleCheck className="h-3.5 w-3.5" />
                {users.length === 0
                  ? "Belum ada akun terdaftar"
                  : `${activePct}% Akun Aktif`}
              </div>
            </div>

            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-purple-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Hirarki Akses</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <LuShield className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="font-bold text-purple-600 dark:text-purple-400">Dev</span>
                <LuArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                <span className="font-bold text-blue-600 dark:text-blue-400">Owner</span>
                <LuArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Kasir</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Pemisahan wewenang berlapis per token
              </div>
            </div>

            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-cyan-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Outlet Terhubung</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <LuMapPin className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {outlets.length}{" "}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Lokasi
                </span>
              </div>
              <div className="mt-2 truncate text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                {namaOutletPertama ?? "Belum ada outlet"}
              </div>
            </div>

            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-amber-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Audit System</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <LuFileCheck2 className="h-4 w-4" />
                </div>
              </div>
              <div className="pt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                ACCOUNT_* Active
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Jejak aktivitas akun tercatat otomatis
              </div>
            </div>
          </div>

          {/* Toolbar cari + filter */}
          <div className="glass-card rounded-2xl p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative lg:col-span-5">
                {/* Ikon cari dipasang top-1/2 -translate-y-1/2 agar SELALU
                    di tengah vertikal — pola inset-y-0 + h-4 membuat ikon
                    terpaku di atas input (menceng 11px) karena CSS
                    mengabaikan bottom saat top+height sudah ditentukan. */}
                <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama atau email…"
                  className="glass-input w-full rounded-xl py-2.5 pr-4 pl-10 text-xs font-medium transition-all focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <SelectInput
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  aria-label="Filter peran"
                >
                  <option value="ALL">Semua Peran</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="OWNER">Owner</option>
                  <option value="KASIR">Kasir</option>
                </SelectInput>
              </div>

              <div className="lg:col-span-3">
                <SelectInput
                  value={outlet}
                  onChange={(e) => setOutlet(e.target.value)}
                  aria-label="Filter outlet"
                >
                  <option value="ALL">Semua Outlet</option>
                  <option value="__none__">Tanpa Outlet (Owner Global)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <div className="lg:col-span-2">
                <SelectInput
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter status"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                </SelectInput>
              </div>
            </div>
          </div>

          {/* Tabel akun */}
          <div className="glass-card overflow-hidden rounded-2xl border-slate-200/80 dark:border-slate-800/80 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/60 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    <th className="px-6 py-4">Pengguna</th>
                    <th className="px-4 py-4">Peran Hak Akses</th>
                    <th className="px-4 py-4">Outlet Ditugaskan</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Transaksi Terakhir</th>
                    <th className="px-6 py-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 text-xs">
                  {pageRows.map((user) => {
                    const isSelf = user.id === currentUserId;
                    // Baris developer & baris sendiri hanya bisa DILIHAT —
                    // semua tombol modifikasinya mati (server juga menolak).
                    const locked = user.role === "DEVELOPER" || isSelf;
                    const lockTitle = isSelf
                      ? "Akun Anda sendiri — ubah lewat Akun Saya"
                      : "Akun developer dikelola lewat DEV_SEED_* di .env";
                    const rb = roleBadgeDark(user.role);
                    const RoleIcon = ROLE_ICON[user.role];
                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3.5">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr text-xs font-bold text-white shadow-md ${avatarGradient(user.role)} ${AVATAR_SHADOW[user.role]}`}
                            >
                              {initials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
                                <span className="truncate">{user.name}</span>
                                {isSelf && (
                                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="max-w-[220px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase ${rb.badge}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {rb.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {user.outletName ? (
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {user.outletName}
                            </span>
                          ) : user.role === "OWNER" ? (
                            <span className="italic text-slate-500 dark:text-slate-400">
                              — (Akses Semua)
                            </span>
                          ) : (
                            <span className="italic text-slate-500 dark:text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                          {formatWibDateTime(user.lastTransactionAtIso)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditing(user)}
                              disabled={locked}
                              title={locked ? lockTitle : "Ubah akun"}
                              aria-label={`Ubah ${user.name}`}
                              className={`${ACTION_BTN} hover:text-blue-600 dark:hover:text-blue-400`}
                            >
                              <LuPencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetting(user)}
                              disabled={locked}
                              title={
                                locked
                                  ? lockTitle
                                  : "Reset sandi (tanpa pw lama)"
                              }
                              aria-label={`Reset password ${user.name}`}
                              className={`${ACTION_BTN} hover:text-amber-600 dark:hover:text-amber-400`}
                            >
                              <LuKeyRound className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggle(user)}
                              disabled={locked || togglingId === user.id}
                              title={
                                locked
                                  ? lockTitle
                                  : user.isActive
                                    ? "Nonaktifkan akun"
                                    : "Aktifkan kembali"
                              }
                              aria-label={
                                user.isActive
                                  ? `Nonaktifkan ${user.name}`
                                  : `Aktifkan ${user.name}`
                              }
                              className={`${ACTION_BTN} ${
                                user.isActive
                                  ? "hover:text-amber-600 dark:hover:text-amber-400"
                                  : "hover:text-emerald-600 dark:hover:text-emerald-400"
                              }`}
                            >
                              {togglingId === user.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : user.isActive ? (
                                <LuArchive className="h-4 w-4" />
                              ) : (
                                <LuArchiveRestore className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(user)}
                              disabled={locked}
                              title={locked ? lockTitle : "Hapus akun permanen"}
                              aria-label={`Hapus ${user.name}`}
                              className={`${ACTION_BTN} hover:text-rose-600 dark:hover:text-rose-400`}
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </button>
                            <Link
                              href={`/dev/logs?actor=${user.id}`}
                              title="Lihat jejak log aktor ini"
                              aria-label={`Jejak log ${user.name}`}
                              className={`${ACTION_BTN} hover:text-cyan-600 dark:hover:text-cyan-400`}
                            >
                              <LuHistory className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Tidak ada akun yang cocok dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={safePage}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPage={setPage}
              unit="akun"
            />

            {/* Footer audit */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/40 px-6 py-3 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-2">
                <LuShieldAlert className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>
                  Semua aksi di tabel ini tercatat di jejak audit (
                  <code className="text-blue-700 dark:text-blue-300">ACCOUNT_*</code>), termasuk
                  percobaan gagal.
                </span>
              </div>
              <div>
                Menampilkan {filtered.length} dari {users.length} akun terdaftar
              </div>
            </div>
          </div>
        </main>
      </div>

      {editing !== undefined && (
        <AccountFormModal
          user={editing}
          outlets={outlets}
          onClose={() => setEditing(undefined)}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
        />
      )}
      {deleting && (
        <DeleteAccountModal user={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [16/48] frontend/app/dev/users/view-helpers.ts ----------------------------------------
$p = @'
app/dev/users/view-helpers.ts
'@
$c = @'
// Pemetaan DTO backend-go -> baris tabel akun + util tampilan MURNI.
// Sengaja dipisah dari komponen/halaman supaya bisa diuji unit
// (tests/ frontend) tanpa menyalakan server Next — lihat
// tests/view-helpers.test.ts.

import type { OutletOption, UserRow } from "./types";

// Bentuk respons GET /api/v1/users (backend-go internal/handler/user.go,
// struct UserResponse). Kolom snake_case persis seperti dikirim Go.
export type GoUserDTO = {
  id: number;
  name: string;
  email: string;
  role: string; // OWNER | CASHIER | DEVELOPER (nama peran sisi Go)
  outlet_id: number | null;
  outlet_name: string | null;
  is_active: boolean;
  created_at: string;
  last_transaction_at: string | null;
};

// Bentuk respons GET /api/v1/outlets (backend-go internal/handler/outlet.go,
// struct OutletResponse) — form akun hanya butuh id + nama.
export type GoOutletDTO = {
  id: number;
  name: string;
  address: string;
  phone: string;
  logo_version: number;
  has_logo: boolean;
  is_active: boolean;
  user_count: number;
  created_at: string;
};

// Go menyebut peran kasir "CASHIER"; seluruh frontend memakai "KASIR"
// (sejarah Task 33-35). Satu tempat konversi supaya tabel, filter, dan
// server action tidak pernah berbeda hasil untuk peran yang sama.
export function normalizeRole(goRole: string): UserRow["role"] {
  if (goRole === "OWNER" || goRole === "DEVELOPER") return goRole;
  return "KASIR";
}

// Lawan arah dari normalizeRole: dipakai server action saat mengirim
// payload ke Go (POST/PUT /users memakai nama peran sisi Go).
export function toGoRole(role: UserRow["role"]): "OWNER" | "CASHIER" {
  return role === "OWNER" ? "OWNER" : "CASHIER";
}

export function mapGoUsers(rows: GoUserDTO[]): UserRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: normalizeRole(row.role),
    outletId: row.outlet_id === null ? null : String(row.outlet_id),
    outletName: row.outlet_name ?? null,
    isActive: row.is_active,
    createdAtIso: row.created_at,
    lastTransactionAtIso: row.last_transaction_at ?? null,
  }));
}

export function mapGoOutlets(rows: GoOutletDTO[]): OutletOption[] {
  return rows.map((row) => ({ id: String(row.id), name: row.name }));
}

// Inisial avatar dua huruf: kata pertama + kata terakhir. Nama tunggal
// memakai dua huruf pertama kata itu; kosong/whitespace jatuh ke "?".
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Tanggal singkat WIB (mis. "25 Okt 2026") untuk kolom "transaksi
// terakhir". Nilai null (belum pernah jualan) tampil sebagai "—".
// Zona waktu eksplisit Asia/Jakarta: tanggal tidak boleh ikut bergeser
// mengikuti zona mesin yang membuka halaman.
export function formatWibShort(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export type RoleView = {
  label: string;
  // Kelas badge peran (Tailwind) — dipakai tabel & filter chips.
  badge: string;
};

export function roleView(role: UserRow["role"]): RoleView {
  switch (role) {
    case "OWNER":
      return {
        label: "Owner",
        badge:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
    case "DEVELOPER":
      return {
        label: "Developer",
        badge:
          "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
      };
    default:
      return {
        label: "Kasir",
        badge:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
  }
}

// Badge peran konsol "Kelola Akun" (design v1.5.0): label HURUF BESAR,
// badge kotak rounded-lg dengan tint /15 + border /30. Sadar tema:
// teks pekat (blue-600 dst.) di tema terang, pucat (blue-300 dst.) di
// tema gelap — supaya terbaca di dua-duanya. Warna mengikuti identitas
// hirarki akses: ungu developer, biru owner, hijau kasir — supaya tabel,
// kartu metrik, dan modal tidak pernah menampilkan dua warna berbeda
// untuk peran yang sama.
export function roleBadgeDark(role: UserRow["role"]): {
  label: string;
  badge: string;
} {
  switch (role) {
    case "DEVELOPER":
      return {
        label: "DEVELOPER",
        badge:
          "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300",
      };
    case "OWNER":
      return {
        label: "OWNER",
        badge:
          "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
      };
    default:
      return {
        label: "KASIR",
        badge:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      };
  }
}

// Gradien avatar per peran — persis kartu "Hirarki Akses": ungu developer,
// biru-cyan owner, hijau kasir.
export function avatarGradient(role: UserRow["role"]): string {
  switch (role) {
    case "DEVELOPER":
      return "from-purple-600 to-indigo-600";
    case "OWNER":
      return "from-blue-600 to-cyan-500";
    default:
      return "from-emerald-500 to-teal-500";
  }
}

// Tanggal + jam WIB (mis. "23 Okt 2026 (14:20 WIB)") untuk kolom
// "transaksi terakhir" versi lengkap; null tetap "—". Jam diformat
// dengan locale en-GB supaya pemisahnya ":" (id-ID memakai titik "14.20")
// — tanggal tetap locale Indonesia. Zona waktu eksplisit Asia/Jakarta.
export function formatWibDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(d);
  const jam = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(d);
  return `${tanggal} (${jam} WIB)`;
}
'@
Save-UmkmFile $p $c

# ---- [17/48] frontend/app/layout.tsx ----------------------------------------
$p = @'
app/layout.tsx
'@
$c = @'
import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";
import { themeKeyForUser } from "@/lib/theme-storage";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografi utama design language v1.3.0 (halaman login, pengaturan,
// konsol akun) — Geist tetap dimuat untuk angka/mono di halaman lain.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "UMKM OS - Kasir & Intelijen Bisnis Warung",
  description: "Kasir, stok, dan laporan penjualan untuk warung Anda.",
  // Ikon resmi UMKM OS (v1.3.0) — logo warung yang diunggah pemilik tetap
  // dipakai di dalam aplikasi (header kasir, struk, pengaturan).
  icons: { icon: [{ url: "/icon/umkm-icon.png", type: "image/png" }] },
};

// Layout akar membaca sesi (auth() -> cookies), jadi TIDAK ADA rute yang
// bisa dirender statis penuh — termasuk halaman 404 bawaan Next.js
// (/_not-found) yang memakai layout ini. Tanpa flag ini `next build`
// gagal saat prapenyajian /_not-found. Pola yang sama sudah dipakai
// semua page.tsx aplikasi sejak v1.3.0.
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema PER PENGGUNA (v1.7.0): sesi dibaca di layout akar agar
  // next-themes memakai kunci localStorage "theme-<idUser>" — dua
  // akun yang berbagi satu browser tetap punya tema masing-masing.
  // Tanpa sesi (belum masuk / halaman publik) dipakai kunci generik.
  // Efek samping: seluruh rute menjadi dinamis (auth() membaca
  // cookie) — aman karena aplikasi ini memang di belakang middleware
  // dan setiap halaman konsol sudah membaca sesi juga.
  const session = await auth();
  const themeStorageKey = session?.user?.id
    ? themeKeyForUser(session.user.id)
    : undefined;
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider storageKey={themeStorageKey}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
'@
Save-UmkmFile $p $c

# ---- [18/48] frontend/app/owner/page.tsx ----------------------------------------
$p = @'
app/owner/page.tsx
'@
$c = @'
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlus, Settings, ShieldCheck, ReceiptText } from "lucide-react";
import ForecastSection from "@/components/forecast/forecast-section";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";

export const instant = false;

// =====================================================================
// Dashboard owner — Tahap 4a (frontend v1.0.0, file dilengkapi di v1.0.1).
//
// SELURUH angka statistik kini datang dari backend-go lewat satu
// panggilan GET /api/v1/reports/dashboard: ringkasan hari ini & kemarin,
// grafik 7 hari (gap-free), porsi metode pembayaran, 5 produk terlaris,
// stok menipis + saran restok, dan 6 transaksi terbaru. Frontend tidak
// lagi menghitung agregat sendiri — PostgreSQL tetap satu-satunya sumber
// data lewat tangan Go, dan kasir/owner/peluncur melihat angka yang sama.
//
// Satu-satunya yang masih Prisma: identitas outlet (nama & logo) untuk
// header — pindah ke backend-go menyusul pada fase multi-outlet.
// =====================================================================

// Compact chart labels: 1250000 -> "1,3 jt", 45000 -> "45 rb".
const compactRp = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
};

const METHOD_META = [
  {
    key: "CASH",
    label: "Tunai",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  },
  {
    key: "QRIS",
    label: "QRIS",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "DEBIT",
    label: "Debit",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  },
] as const;

function StorefrontIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 17-8.5-8.5-5 5L2 7" />
      <path d="M16 17h6v-6" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function BasketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 11-1 9" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
      <path d="m4.5 15.15 2.75-2.22 3 2.5 3.5-3 3.25 2.5" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M21 3v9h-9" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div>
    </div>
  );
}

// Label hari singkat ("Sen", "Sel", ...) dari tanggal "YYYY-MM-DD" milik
// backend. String diparse sebagai UTC lalu dibaca dengan timeZone UTC
// supaya hari tidak pernah bergeser akibat zona waktu server (container
// defaultnya UTC, mesin lokal bisa WIB — keduanya dapat hasil sama).
const weekdayShortId = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(
    "id-ID",
    { weekday: "short", timeZone: "UTC" },
  );
};

// Bentuk respons GET /reports/dashboard (backend-go v1.1.0+). Uang sudah
// berupa Rupiah bulat (BIGINT) — tidak ada lagi konversi Prisma Decimal.
type DashboardData = {
  today: { revenue: number; transactions: number; items_sold: number };
  yesterday: { revenue: number; transactions: number };
  week: { date: string; revenue: number; count: number }[];
  week_total: number;
  week_count: number;
  payments: { method: string; revenue: number; count: number }[];
  top_products: { name: string; unit: string; qty: number; revenue: number }[];
  low_stock: {
    id: number;
    name: string;
    sku: string;
    stock: number;
    min_stock: number;
    unit: string;
    restock: number;
  }[];
  recent: {
    id: number;
    receipt_no: string;
    cashier_name: string;
    payment_method: string;
    total: number;
    created_at: string;
  }[];
};

export default async function OwnerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER")
    redirect("/cashier");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }

  // Identitas outlet (nama & logo) masih dari Prisma — menyusul pindah
  // ke backend-go pada fase multi-outlet, sama seperti halaman peluncur.
  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({ where: { id: session.user.outletId } })
    : await prisma.outlet.findFirst();
  if (!outlet) redirect("/");

  // Cache-busted logo URL; null keeps the default storefront tile.
  const logoUrl = outlet.logoMimeType
    ? `/api/outlet/logo?v=${outlet.logoVersion}`
    : null;

  // Satu panggilan untuk seluruh dashboard. Backend mati = halaman gagal
  // dengan pesan yang jelas (pola yang sama dengan halaman kelola produk)
  // — tidak ada angka palsu yang ditampilkan.
  const dash = await goFetch<DashboardData>(
    session.user.goToken,
    "/reports/dashboard",
  );
  if (!dash.ok) {
    throw new Error(dash.message);
  }
  if (!dash.data.today || !Array.isArray(dash.data.low_stock)) {
    throw new Error(
      "Backend lama masih berjalan di port 8080 (tanpa dashboard v1.1.0). Matikan proses 'go run .' yang lama, jalankan backend-go v1.1.0+ (lokal atau docker compose up -d), lalu muat ulang halaman ini.",
    );
  }
  const data = dash.data;

  // Grafik 7 hari: backend sudah mengirim gap-free tertua dulu, lengkap
  // dengan hari nol penjualan; label hari dihitung dari tanggalnya.
  const days = data.week.map((d) => ({
    key: d.date,
    label: weekdayShortId(d.date),
    total: d.revenue,
    count: d.count,
  }));

  const today = data.today;
  const yesterday = data.yesterday;
  const weekTotal = data.week_total;
  const weekCount = data.week_count;
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  const omzetToday = today.revenue;
  const trxToday = today.transactions;
  const itemsToday = today.items_sold;
  const avgToday = trxToday > 0 ? omzetToday / trxToday : 0;
  const deltaPct =
    yesterday.revenue > 0
      ? Math.round(((omzetToday - yesterday.revenue) / yesterday.revenue) * 100)
      : null;

  // Porsi CASH/QRIS/DEBIT di jendela 7 hari yang sama dengan grafik.
  const methodRevenue: Record<string, number> = { CASH: 0, QRIS: 0, DEBIT: 0 };
  const methodCount: Record<string, number> = { CASH: 0, QRIS: 0, DEBIT: 0 };
  for (const p of data.payments) {
    methodRevenue[p.method] = (methodRevenue[p.method] ?? 0) + p.revenue;
    methodCount[p.method] = (methodCount[p.method] ?? 0) + p.count;
  }

  const topList = data.top_products;

  // Field snake_case dari Go dipetakan ke bentuk halaman (minStock) agar
  // markup di bawah tidak berubah dari desain aslinya.
  const lowStock = data.low_stock.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    minStock: p.min_stock,
    unit: p.unit,
    restock: p.restock,
  }));

  const recent = data.recent.map((r) => {
    const meta = METHOD_META.find((m) => m.key === r.payment_method);
    return {
      code: r.receipt_no,
      cashier: r.cashier_name || "-",
      time: new Date(r.created_at).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      methodLabel: meta?.label ?? r.payment_method,
      methodBadge: meta?.badge ?? "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400",
      total: r.total,
    };
  });

  return (
    // Shell aurora (v1.8.0): latar ambient + kartu kaca — ikut tema
    // terang/gelap milik pengguna yang sedang membuka dashboard ini.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${outlet.name}`}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <StorefrontIcon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Laporan - {outlet.name}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session.user.name ?? "Pemilik"} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <Link
              href="/owner/verify"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Verifikasi Struk</span>
            </Link>
            <Link
              href="/owner/settings"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>
            <Link
              href="/owner/transactions"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <ReceiptText className="h-4 w-4" />
              <span className="hidden sm:inline">Riwayat Transaksi</span>
              <span className="sm:hidden">Riwayat</span>
            </Link>
            <Link
              href="/owner/products"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Kelola Produk</span>
              <span className="sm:hidden">Produk</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<WalletIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBg="bg-blue-50 dark:bg-blue-950/40"
            label="Omzet Hari Ini"
            value={formatRupiah(omzetToday)}
            sub={
              deltaPct !== null ? (
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    deltaPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {deltaPct >= 0 ? (
                    <TrendUpIcon className="h-3.5 w-3.5" />
                  ) : (
                    <TrendDownIcon className="h-3.5 w-3.5" />
                  )}
                  {deltaPct >= 0 ? "+" : ""}
                  {deltaPct}% vs kemarin
                </span>
              ) : (
                <span>vs kemarin —</span>
              )
            }
          />
          <StatCard
            icon={<ReceiptIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
            iconBg="bg-violet-50"
            label="Transaksi Hari Ini"
            value={String(trxToday)}
            sub={<span>{yesterday.transactions} struk kemarin</span>}
          />
          <StatCard
            icon={<PackageIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            label="Item Terjual Hari Ini"
            value={String(itemsToday)}
            sub={<span>unit terjual</span>}
          />
          <StatCard
            icon={<BasketIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            iconBg="bg-amber-50 dark:bg-amber-950/40"
            label="Rata-rata per Struk"
            value={formatRupiah(avgToday)}
            sub={<span>dari {trxToday} struk</span>}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl glass-card p-5 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Penjualan 7 Hari Terakhir
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Total {formatRupiah(weekTotal)} · {weekCount} transaksi
                </p>
              </div>
              <ChartIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </div>
            {weekCount === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                Belum ada penjualan dalam 7 hari terakhir.
              </div>
            ) : (
              <div className="mt-5 flex h-44 items-end gap-2 sm:gap-3">
                {days.map((d, i) => {
                  const barColor =
                    d.total === 0
                      ? "bg-slate-200 dark:bg-slate-800"
                      : i === days.length - 1
                        ? "bg-blue-600"
                        : "bg-blue-400";
                  return (
                    <div
                      key={d.key}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                        {compactRp(d.total)}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          title={`${d.label}: ${formatRupiah(d.total)} (${d.count} transaksi)`}
                          style={{
                            height:
                              d.total > 0
                                ? `${Math.max((d.total / maxDay) * 100, 6)}%`
                                : "3px",
                          }}
                          className={`w-full rounded-t-lg transition-colors ${barColor}`}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          i === days.length - 1
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Metode Pembayaran
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">7 hari terakhir</p>
              </div>
              <WalletIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </div>
            <div className="mt-5 space-y-5">
              {METHOD_META.map((m) => {
                const revenue = methodRevenue[m.key] ?? 0;
                const count = methodCount[m.key] ?? 0;
                const share = weekTotal > 0 ? (revenue / weekTotal) * 100 : 0;
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                        <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatRupiah(revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                      <div
                        className={`h-full rounded-full ${m.bar}`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      {count} struk · {Math.round(share)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <ForecastSection />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Produk Terlaris
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">7 hari terakhir</p>
              </div>
              <TrophyIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </div>
            {topList.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                Belum ada penjualan minggu ini.
              </div>
            ) : (
              <ol className="mt-4 space-y-3.5">
                {topList.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex items-center gap-3"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700 dark:text-amber-300 "
                          : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 "
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {item.qty} {item.unit} terjual
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatRupiah(item.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Stok Perlu Restok
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  stok di bawah atau sama dengan batas minimum
                </p>
              </div>
              {lowStock.length > 0 ? (
                <span className="shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  {lowStock.length} produk
                </span>
              ) : (
                <AlertIcon className="h-5 w-5 shrink-0 text-slate-300" />
              )}
            </div>
            {lowStock.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3.5">
                <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Semua stok aman di atas batas minimum.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {p.sku ? `${p.sku} · ` : ""}min {p.minStock} {p.unit}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-xs font-bold ${
                          p.stock === 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {p.stock === 0 ? "Habis" : `sisa ${p.stock}`}
                      </p>
                      <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        restok +{p.restock}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-2xl glass-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Transaksi Terakhir
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                6 transaksi terbaru
              </p>
            </div>
            <ClockIcon className="h-5 w-5 shrink-0 text-slate-300" />
          </div>
          {recent.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              Belum ada transaksi tercatat.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {recent.map((r) => (
                <li key={r.code} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {r.code}
                    </p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {r.cashier} · {r.time}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.methodBadge}`}
                  >
                    {r.methodLabel}
                  </span>
                  <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatRupiah(r.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [19/48] frontend/app/owner/products/product-form-modal.tsx ----------------------------------------
$p = @'
app/owner/products/product-form-modal.tsx
'@
$c = @'
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { formatThousands } from "@/lib/format";
import { formatSku, skuPrefixOf } from "@/lib/sku";
import { ImageEditorModal } from "@/components/image-editor-modal";
import {
  addProductImage,
  deleteProductImage,
  moveProductImage,
  saveProduct,
  setProductThumbnail,
} from "./actions";
import type { CategoryOption, ProductRow, UnitOption } from "./types";

type ProductFormModalProps = {
  // null = create a new product, a row = edit that product.
  product: ProductRow | null;
  categories: CategoryOption[];
  // Unit dropdown options (master table + legacy strings).
  units: UnitOption[];
  // categoryId -> product count ("__none__" = without category), used
  // only for the live next-SKU preview.
  skuCounts: Record<string, number>;
  // Fired right after a NEW product is saved: the parent switches from
  // create-mode to edit-mode so this modal re-resolves the fresh row
  // and its photo grid (with thumbnail stars) goes live while any
  // queued photos are still uploading.
  onCreated?: (productId: string) => void;
  onClose: () => void;
};

const MAX_PHOTOS = 6;

// Photos picked while CREATING a product: they wait in the browser and
// are uploaded right after saveProduct returns the new product id.
type QueuedPhoto = {
  key: string;
  file: File;
  preview: string;
};

// Digit-only sanitizing: typing or pasting "Rp 5.000" becomes "5000".
const digits = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

const LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20";

const TILE_BTN =
  "flex h-6 w-6 items-center justify-center rounded-md bg-white/95 text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-white dark:hover:bg-slate-900 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30";

// Live grouping for numeric fields: the stored string stays raw digits
// ("4000"), only the presentation gains Indonesian thousand dots.
const grouped = (value: string) =>
  value ? formatThousands(parseInt(value, 10)) : "";

// Rp text field: right-aligned tabular digits with a fixed "Rp" prefix
// and live thousand separators — the same money language as the POS.
function RpInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400 dark:text-slate-500">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={grouped(value)}
        placeholder={placeholder ?? "0"}
        onChange={(event) => onChange(digits(event.target.value, 10))}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
      />
    </div>
  );
}

// Plain integer field (stock, minimum stock) without the Rp prefix.
function QtyInput({
  id,
  value,
  onChange,
  max,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  max: number;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={grouped(value)}
      placeholder="0"
      onChange={(event) => onChange(digits(event.target.value, max))}
      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
    />
  );
}

export function ProductFormModal({
  product,
  categories,
  units,
  skuCounts,
  onCreated,
  onClose,
}: ProductFormModalProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [unitName, setUnitName] = useState(product?.unit ?? "");
  const [useNewUnit, setUseNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [price, setPrice] = useState(
    product ? String(product.priceRupiah) : "",
  );
  const [cost, setCost] = useState(product ? String(product.costRupiah) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [minStock, setMinStock] = useState(
    product ? String(product.minStock) : "5",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Photos. In EDIT mode they upload immediately; in CREATE mode they
  // queue in the browser until the product row exists.
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  // Which QUEUED photo is the thumbnail-to-be (null = the first one).
  // The starred photo is simply uploaded FIRST, and a fresh product's
  // first stored photo automatically becomes the thumbnail.
  const [queuedThumbKey, setQueuedThumbKey] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Set once a NEW product has been saved: the fields lock and the
  // submit button turns into a photo-retry control.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const images = product?.images ?? [];
  const photoCount = images.length + queue.length;
  const starredQueueKey = queuedThumbKey ?? queue[0]?.key ?? null;

  // Live SKU preview. Edit mode shows the fixed SKU; create mode derives
  // it from the selected category (the server computes the real value
  // on save, this is only a preview).
  const previewSku = useMemo(() => {
    if (product) return product.sku;
    const categoryName = useNewCategory
      ? newCategoryName.trim() || null
      : (categories.find((c) => c.id === categoryId)?.name ?? null);
    const seq =
      (useNewCategory ? 0 : (skuCounts[categoryId || "__none__"] ?? 0)) + 1;
    return formatSku(skuPrefixOf(categoryName), seq);
  }, [
    product,
    categories,
    categoryId,
    useNewCategory,
    newCategoryName,
    skuCounts,
  ]);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // The stacked photo editor handles its own Escape first.
      if (event.key === "Escape" && !editingFile) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingFile, onClose]);

  const handleCategorySelect = (value: string) => {
    if (value === "__new__") {
      setUseNewCategory(true);
      return;
    }
    setCategoryId(value);
  };

  const handleUnitSelect = (value: string) => {
    if (value === "__new__") {
      setUseNewUnit(true);
      return;
    }
    setUnitName(value);
  };

  const pickPhoto = () => {
    setPhotoError(null);
    if (photoCount >= MAX_PHOTOS) {
      setPhotoError(`Maksimal ${MAX_PHOTOS} foto per produk.`);
      return;
    }
    fileRef.current?.click();
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Berkas harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }
    setEditingFile(file);
  };

  // The editor hands back the cropped JPEG. When a product id is known
  // (edit mode, or photos added after a create save) it uploads right
  // away; otherwise it waits in the queue.
  const onUseEdited = (edited: File) => {
    setEditingFile(null);
    const targetId = product?.id ?? createdId;
    if (targetId) {
      void uploadPhoto(targetId, edited);
    } else {
      setQueue((items) => [
        ...items,
        {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: edited,
          preview: URL.createObjectURL(edited),
        },
      ]);
    }
  };

  const uploadPhoto = async (productId: string, file: File) => {
    setPhotoBusy("upload");
    setPhotoError(null);
    const result = await addProductImage(productId, file);
    setPhotoBusy(null);
    if (!result.ok) {
      setPhotoError(result.error);
      return;
    }
    router.refresh();
  };

  const removeQueued = (key: string) => {
    setQueue((items) => {
      const found = items.find((item) => item.key === key);
      if (found) URL.revokeObjectURL(found.preview);
      return items.filter((item) => item.key !== key);
    });
    if (queuedThumbKey === key) {
      setQueuedThumbKey(null);
    }
  };

  const run = async (
    imageId: string,
    action: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setPhotoBusy(`${imageId}:${action}`);
    setPhotoError(null);
    const result = await fn();
    setPhotoBusy(null);
    if (!result.ok) {
      setPhotoError(result.error ?? "Operasi foto gagal.");
      return;
    }
    router.refresh();
  };

  // Uploads every queued photo (create flow). Stops at the first
  // failure so the owner can retry without losing the rest. The starred
  // photo is moved to the FRONT first: a fresh product's first stored
  // photo automatically becomes the thumbnail.
  const uploadRemaining = async (productId: string) => {
    setPhotoBusy("queue");
    setPhotoError(null);
    const ordered = [...queue];
    const thumbIndex = ordered.findIndex(
      (item) => item.key === starredQueueKey,
    );
    if (thumbIndex > 0) {
      const [starred] = ordered.splice(thumbIndex, 1);
      ordered.unshift(starred);
    }
    const failed: QueuedPhoto[] = [];
    let firstError: string | null = null;
    for (const item of ordered) {
      if (firstError) {
        failed.push(item);
        continue;
      }
      const result = await addProductImage(productId, item.file);
      if (result.ok) {
        URL.revokeObjectURL(item.preview);
      } else {
        firstError = result.error;
        failed.push(item);
      }
    }
    setQueue(failed);
    setPhotoBusy(null);
    if (firstError) {
      setPhotoError(
        `Produk sudah tersimpan, tetapi foto belum selesai diunggah: ${firstError}`,
      );
    } else {
      router.refresh();
      onClose();
    }
  };

  const submit = () => {
    setError(null);
    if (createdId) {
      startTransition(async () => {
        await uploadRemaining(createdId);
      });
      return;
    }

    const trimmedName = name.trim();
    const trimmedUnitName = newUnitName.trim();
    const trimmedCategory = newCategoryName.trim();
    const priceRp = price ? parseInt(price, 10) : 0;
    const costRp = cost ? parseInt(cost, 10) : 0;
    const stockQty = stock ? parseInt(stock, 10) : 0;
    const minStockQty = minStock ? parseInt(minStock, 10) : 0;

    if (!trimmedName) {
      setError("Nama produk wajib diisi.");
      return;
    }
    if (useNewUnit && !trimmedUnitName) {
      setError("Nama satuan baru wajib diisi.");
      return;
    }
    if (!useNewUnit && !unitName) {
      setError("Satuan wajib dipilih.");
      return;
    }
    if (useNewCategory && !trimmedCategory) {
      setError("Nama kategori baru wajib diisi.");
      return;
    }
    if (priceRp <= 0) {
      setError("Harga jual harus lebih dari 0.");
      return;
    }
    if (costRp < 0) {
      setError("Harga beli tidak boleh negatif.");
      return;
    }
    if (stockQty < 0 || minStockQty < 0) {
      setError("Stok tidak boleh negatif.");
      return;
    }

    startTransition(async () => {
      const result = await saveProduct({
        id: product?.id,
        name: trimmedName,
        categoryId: useNewCategory ? null : categoryId || null,
        newCategoryName: useNewCategory ? trimmedCategory : null,
        unitName: useNewUnit ? null : unitName,
        newUnitName: useNewUnit ? trimmedUnitName : null,
        priceRupiah: priceRp,
        costRupiah: costRp,
        stock: stockQty,
        minStock: minStockQty,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (queue.length === 0 || !result.productId) {
        onClose();
        return;
      }
      setCreatedId(result.productId);
      onCreated?.(result.productId);
      await uploadRemaining(result.productId);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={product ? `Ubah produk ${product.name}` : "Produk baru"}
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md dark:bg-slate-950/80"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel kaca aurora (v1.8.0) — konsisten dengan modal Kelola Akun. */}
      <div className="glass-card relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-2xl dark:shadow-black/50">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                {product ? "Ubah Produk" : "Produk Baru"}
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {product
                  ? product.sku
                  : "Tambahkan barang yang dijual di warung"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {createdId && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                Produk tersimpan — tinggal foto yang menyusul.
              </div>
            )}

            {/* ============ FOTO PRODUK — dipindah ke PALING ATAS ============ */}
            <div>
              <p className={LABEL_CLASS}>Foto Produk (maks. {MAX_PHOTOS})</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                Tampil di keranjang kasir, kartu produk, dan tabel. Tandai foto
                dengan bintang untuk menjadikannya thumbnail — default: foto
                pertama.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {images.map((image, index) => {
                  const tileBusy =
                    photoBusy !== null && photoBusy.startsWith(`${image.id}:`);
                  return (
                    <div
                      key={image.id}
                      className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900"
                    >
                      {image.isThumb && (
                        <span className="absolute left-1 top-1 z-10 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Thumbnail
                        </span>
                      )}
                      <img
                        src={`/api/images/${image.id}`}
                        alt=""
                        loading="lazy"
                        className="pointer-events-none h-full w-full object-cover"
                      />
                      {tileBusy ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
                        </div>
                      ) : (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-black/50 p-1">
                          <button
                            type="button"
                            title="Jadikan thumbnail"
                            disabled={image.isThumb}
                            onClick={() =>
                              run(image.id, "thumb", () =>
                                setProductThumbnail(image.id),
                              )
                            }
                            className={TILE_BTN}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${image.isThumb ? "text-amber-500" : ""}`}
                            />
                          </button>
                          <button
                            type="button"
                            title="Geser ke kiri"
                            disabled={index === 0}
                            onClick={() =>
                              run(image.id, "left", () =>
                                moveProductImage(image.id, "left"),
                              )
                            }
                            className={TILE_BTN}
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Geser ke kanan"
                            disabled={index === images.length - 1}
                            onClick={() =>
                              run(image.id, "right", () =>
                                moveProductImage(image.id, "right"),
                              )
                            }
                            className={TILE_BTN}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Hapus foto"
                            onClick={() => {
                              if (confirmDelete === image.id) {
                                setConfirmDelete(null);
                                run(image.id, "delete", () =>
                                  deleteProductImage(image.id),
                                );
                              } else {
                                setConfirmDelete(image.id);
                              }
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700"
                          >
                            {confirmDelete === image.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {queue.map((item) => {
                  const isStarred = item.key === starredQueueKey;
                  return (
                    <div
                      key={item.key}
                      className="relative aspect-square overflow-hidden rounded-lg border border-blue-200 bg-slate-100 dark:bg-slate-900"
                    >
                      <span
                        className={`absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${
                          isStarred ? "bg-amber-500" : "bg-blue-600"
                        }`}
                      >
                        {isStarred ? "Thumbnail" : "Baru"}
                      </span>
                      <img
                        src={item.preview}
                        alt=""
                        className="pointer-events-none h-full w-full object-cover"
                      />
                      {photoBusy === "queue" ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
                        </div>
                      ) : (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-black/50 p-1">
                          <button
                            type="button"
                            title="Jadikan thumbnail"
                            onClick={() => setQueuedThumbKey(item.key)}
                            className={TILE_BTN}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${isStarred ? "text-amber-500" : ""}`}
                            />
                          </button>
                          <button
                            type="button"
                            title="Hapus foto"
                            onClick={() => removeQueued(item.key)}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {photoCount < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={pickPhoto}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 transition hover:border-blue-400 hover:text-blue-500"
                  >
                    {photoBusy === "upload" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-semibold">
                      {photoBusy === "upload" ? "Mengunggah…" : "Tambah foto"}
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChosen}
              />
              {photoError && (
                <p className="mt-2 text-xs font-medium text-rose-600">
                  {photoError}
                </p>
              )}
            </div>

            {/* ============ Fields ============ */}
            <fieldset
              disabled={createdId !== null}
              className="space-y-3 border-0 p-0 disabled:opacity-60"
            >
              <div>
                <label htmlFor="product-name" className={LABEL_CLASS}>
                  Nama Produk
                </label>
                <input
                  ref={firstFieldRef}
                  id="product-name"
                  type="text"
                  autoComplete="off"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value.slice(0, 100))
                  }
                  placeholder="Contoh: Beras Pandan Wangi 5kg"
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              </div>

              <div>
                <label htmlFor="product-sku" className={LABEL_CLASS}>
                  SKU (otomatis)
                </label>
                <input
                  id="product-sku"
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={previewSku}
                  className={`mt-1 cursor-default bg-slate-50 dark:bg-slate-950 font-mono ${INPUT_CLASS}`}
                />
                <p className="mt-1 text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                  {product
                    ? "SKU tetap setelah produk dibuat."
                    : "Dibuat otomatis dari kategori — nomor final ditetapkan saat disimpan."}
                </p>
              </div>

              <div>
                <label htmlFor="product-unit" className={LABEL_CLASS}>
                  Satuan
                </label>
                {useNewUnit ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="product-unit"
                      type="text"
                      autoComplete="off"
                      value={newUnitName}
                      onChange={(event) =>
                        setNewUnitName(event.target.value.trim().slice(0, 16))
                      }
                      placeholder="cth: renceng"
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      onClick={() => setUseNewUnit(false)}
                      className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Pilih lama
                    </button>
                  </div>
                ) : (
                  <select
                    id="product-unit"
                    value={unitName}
                    onChange={(event) => handleUnitSelect(event.target.value)}
                    className={`mt-1 ${INPUT_CLASS}`}
                  >
                    <option value="">Pilih satuan…</option>
                    {units.map((unit) => (
                      <option key={unit.name} value={unit.name}>
                        {unit.name}
                      </option>
                    ))}
                    <option value="__new__">+ Satuan baru…</option>
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="product-category" className={LABEL_CLASS}>
                  Kategori
                </label>
                {useNewCategory ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="product-category"
                      type="text"
                      autoComplete="off"
                      value={newCategoryName}
                      onChange={(event) =>
                        setNewCategoryName(event.target.value.slice(0, 50))
                      }
                      placeholder="Nama kategori baru"
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      onClick={() => setUseNewCategory(false)}
                      className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Pilih lama
                    </button>
                  </div>
                ) : (
                  <select
                    id="product-category"
                    value={categoryId}
                    onChange={(event) =>
                      handleCategorySelect(event.target.value)
                    }
                    className={`mt-1 ${INPUT_CLASS}`}
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                    <option value="__new__">+ Kategori baru…</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-price" className={LABEL_CLASS}>
                    Harga Jual
                  </label>
                  <RpInput
                    id="product-price"
                    value={price}
                    onChange={setPrice}
                    placeholder="68.000"
                  />
                </div>
                <div>
                  <label htmlFor="product-cost" className={LABEL_CLASS}>
                    Harga Beli
                  </label>
                  <RpInput
                    id="product-cost"
                    value={cost}
                    onChange={setCost}
                    placeholder="55.000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-stock" className={LABEL_CLASS}>
                    Stok Saat Ini
                  </label>
                  <QtyInput
                    id="product-stock"
                    value={stock}
                    onChange={setStock}
                    max={6}
                  />
                </div>
                <div>
                  <label htmlFor="product-min-stock" className={LABEL_CLASS}>
                    Stok Minimum
                  </label>
                  <QtyInput
                    id="product-min-stock"
                    value={minStock}
                    onChange={setMinStock}
                    max={5}
                  />
                  <p className="mt-1 text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                    Stok sama atau di bawah angka ini ditandai perlu restok.
                  </p>
                </div>
              </div>
            </fieldset>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-100 dark:border-slate-800/60 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-none sm:px-5"
            >
              {createdId ? "Tutup" : "Batal"}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {isPending
                ? "Menyimpan…"
                : createdId
                  ? queue.length > 0
                    ? "Coba Unggah Foto Lagi"
                    : "Selesai"
                  : "Simpan Produk"}
            </button>
          </div>
        </form>
      </div>

      {editingFile && (
        <ImageEditorModal
          file={editingFile}
          productName={name.trim() || product?.name || "produk ini"}
          onUse={onUseEdited}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [20/48] frontend/app/owner/products/products-client.tsx ----------------------------------------
$p = @'
app/owner/products/products-client.tsx
'@
$c = @'
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Boxes,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { TablePagination } from "@/components/table-pagination";
import {
  categoryAvatarClass,
  categoryChipClass,
  initialsOf,
} from "../../cashier/ui";
import { toggleProductActive } from "./actions";
import { ProductFormModal } from "./product-form-modal";
import type { CategoryOption, ProductRow, UnitOption } from "./types";

const STATUS_TABS = [
  { key: "ALL", label: "Semua" },
  { key: "ACTIVE", label: "Aktif" },
  { key: "ARCHIVED", label: "Arsip" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["key"];

// Rows per page on the product table (shared paagination footer)
const PAGE_SIZE = 20;

// One shared grid template for the header row and every product row so
// the desktop columns stay perfectly aligned.
const ROW_GRID =
  "lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto]";

function StockBadge({ product }: { product: ProductRow }) {
  if (product.stock <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
        Habis
      </span>
    );
  }
  if (product.stock <= product.minStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
        {product.stock} {product.unit} · menipis
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">
      {product.stock} {product.unit}
    </span>
  );
}

// Product identity tile: the chosen photo when one exists, otherwise
// the colored category initials — the same fallback language as the POS.
function ProductAvatar({ product }: { product: ProductRow }) {
  if (product.thumbImageId) {
    return (
      <img
        src={`/api/images/${product.thumbImageId}`}
        alt=""
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${categoryAvatarClass(product.categoryName)}`}
    >
      {initialsOf(product.name)}
    </div>
  );
}

function ProductRowItem({
  product,
  toggling,
  onEdit,
  onToggle,
}: {
  product: ProductRow;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    // Mobile: a two-column mini-grid that stacks identity, meta pairs and
    // actions. Desktop: the shared seven-column table grid.
    <li
      className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 lg:gap-3 lg:py-2.5 ${ROW_GRID} ${
        product.isActive ? "" : "bg-slate-50/60 dark:bg-slate-900/40"
      }`}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
        <ProductAvatar product={product} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {product.name}
            {!product.isActive && (
              <span className="ml-1.5 rounded-full bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 align-middle text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Arsip
              </span>
            )}
          </p>
          <p className="truncate font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {product.sku}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        {product.categoryName ? (
          <span
            className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryChipClass(product.categoryName)}`}
          >
            {product.categoryName}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      <p className="text-right text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
        <span className="mr-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 lg:hidden">
          Jual{" "}
        </span>
        {formatRupiah(product.priceRupiah)}
      </p>

      <p className="text-left text-[13px] tabular-nums text-slate-500 dark:text-slate-400 lg:text-right">
        <span className="mr-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 lg:hidden">
          Beli{" "}
        </span>
        {formatRupiah(product.costRupiah)}
      </p>

      <div className="justify-self-end lg:justify-self-start">
        <StockBadge product={product} />
      </div>

      <p className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
        {product.soldLast30Days > 0 ? (
          <>
            {product.soldLast30Days}{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">{product.unit}</span>
          </>
        ) : (
          <span className="font-normal text-slate-300">—</span>
        )}
      </p>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Ubah ${product.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          aria-label={
            product.isActive
              ? `Arsipkan ${product.name}`
              : `Aktifkan kembali ${product.name}`
          }
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${
            product.isActive
              ? "border-slate-300 dark:border-slate-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 "
              : "border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400  hover:bg-emerald-50 dark:hover:bg-emerald-950/40 "
          }`}
        >
          {toggling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : product.isActive ? (
            <Archive className="h-3.5 w-3.5" />
          ) : (
            <ArchiveRestore className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </li>
  );
}

export function ProductsClient({
  outletName,
  products,
  categories,
  units,
  skuCounts,
}: {
  outletName: string;
  products: ProductRow[];
  categories: CategoryOption[];
  units: UnitOption[];
  skuCounts: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  // undefined = closed, null = create, an id = edit that product. Only
  // the id is stored (not the row object): the modal product is
  // re-resolved from the live list below, so photo uploads inside the
  // modal repaint it instantly after router.refresh().
  const [editingId, setEditingId] = useState<string | null | undefined>(
    undefined,
  );
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (status === "ACTIVE" && !product.isActive) return false;
      if (status === "ARCHIVED" && product.isActive) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q)
      );
    });
  }, [products, query, categoryId, status]);

  // Pagination: 20 rows per page. Any filter change jumps back to
  // page 1 so the top of the new result set is always visible.
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [query, categoryId, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const summary = useMemo(() => {
    const active = products.filter((product) => product.isActive);
    const low = active.filter((product) => product.stock <= product.minStock);
    // Stock value at purchase cost: what the shelves are worth.
    const stockValue = products.reduce(
      (sum, product) => sum + product.stock * product.costRupiah,
      0,
    );
    return {
      activeCount: active.length,
      archivedCount: products.length - active.length,
      lowCount: low.length,
      stockValue,
    };
  }, [products]);

  const hasFilters =
    query.trim() !== "" || categoryId !== null || status !== "ALL";

  // Resolve the edited row from the live products list on every render:
  // the form modal uploads photos then calls router.refresh(), so this
  // finds the UPDATED row and the still-open modal shows the new photos
  // without being closed and reopened.
  const editingProduct =
    editingId === undefined
      ? undefined
      : editingId === null
        ? null
        : (products.find((product) => product.id === editingId) ?? null);

  const resetFilters = () => {
    setQuery("");
    setCategoryId(null);
    setStatus("ALL");
  };

  const handleToggle = (product: ProductRow) => {
    setListError(null);
    setTogglingId(product.id);
    startTransition(async () => {
      const result = await toggleProductActive(product.id, !product.isActive);
      if (!result.ok) setListError(result.error);
      setTogglingId(null);
    });
  };

  return (
    // Shell aurora (v1.8.0): kartu produk & filter memakai kaca, ikut tema.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Manajemen Produk — {outletName}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {summary.activeCount} produk aktif · {summary.archivedCount}{" "}
                arsip
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Produk Baru</span>
              <span className="sm:hidden">Baru</span>
            </button>
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Kembali</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:py-6">
        <section className="rounded-2xl glass-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-44 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama produk atau SKU..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-9 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Bersihkan pencarian"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatus(tab.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    status === tab.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 "
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                  categoryId === null
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400  hover:bg-slate-200 dark:hover:bg-slate-800 "
                }`}
              >
                Semua
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setCategoryId(
                      category.id === categoryId ? null : category.id,
                    )
                  }
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                    categoryId === category.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400  hover:bg-slate-200 dark:hover:bg-slate-800 "
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {summary.activeCount} aktif
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              {summary.archivedCount} arsip
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              {summary.lowCount} perlu restok
            </span>
            <span className="ml-auto font-semibold text-slate-700 dark:text-slate-300">
              Nilai stok (harga beli) {formatRupiah(summary.stockValue)}
            </span>
          </div>
        </section>

        {listError && (
          <div
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {listError}
          </div>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl glass-card">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
                <Package className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                Tidak ada produk yang cocok
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Coba ubah kata kunci, kategori, atau status.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  Hapus filter
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                className={`hidden lg:grid ${ROW_GRID} gap-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500`}
              >
                <span>Produk</span>
                <span>Kategori</span>
                <span className="text-right">Harga Jual</span>
                <span className="text-right">Harga Beli</span>
                <span>Stok</span>
                <span>Terjual 30 Hari</span>
                <span className="text-right">Aksi</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {pageRows.map((product) => (
                  <ProductRowItem
                    key={product.id}
                    product={product}
                    toggling={togglingId === product.id}
                    onEdit={() => setEditingId(product.id)}
                    onToggle={() => handleToggle(product)}
                  />
                ))}
              </ul>
              <TablePagination
                page={safePage}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                unit="produk"
                onPage={setPage}
              />
            </>
          )}
        </section>
      </main>

      {editingProduct !== undefined && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          units={units}
          skuCounts={skuCounts}
          onCreated={(productId) => setEditingId(productId)}
          onClose={() => setEditingId(undefined)}
        />
      )}
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [21/48] frontend/app/owner/settings/page.tsx ----------------------------------------
$p = @'
app/owner/settings/page.tsx
'@
$c = @'
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, Settings } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OutletLogoForm, OutletProfileForm } from "./settings-forms";

export const instant = false;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  // Select only identity fields — the logo BYTES never leave the
  // server; the client gets a cache-busted URL instead.
  const outletSelect = {
    name: true,
    address: true,
    phone: true,
    logoMimeType: true,
    logoVersion: true,
  } as const;
  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({
        where: { id: session.user.outletId },
        select: outletSelect,
      })
    : await prisma.outlet.findFirst({ select: outletSelect });
  if (!outlet) redirect("/");

  const logoUrl = outlet.logoMimeType
    ? `/api/outlet/logo?v=${outlet.logoVersion}`
    : null;

  const INPUT_CLASS =
    "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20";

  return (
    // Shell aurora (v1.8.0): header kaca + latar ambient, ikut tema pengguna.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${outlet.name}`}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Settings className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Pengaturan — {outlet.name}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session.user.name ?? "Pemilik"} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Laporan
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <section className="rounded-2xl glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Profil Warung</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Identitas yang tercetak di setiap struk dan tampil di aplikasi.
          </p>
          <OutletProfileForm
            outlet={{
              name: outlet.name,
              address: outlet.address,
              phone: outlet.phone,
            }}
          />
        </section>

        <section className="rounded-2xl glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Logo UMKM</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Logo warungmu — muncul di struk, header kasir, dan ikon browser.
          </p>
          <OutletLogoForm logoUrl={logoUrl} />
        </section>

        {/* Unduh log outlet (Task 35): GET form biasa ke route export —
            owner otomatis di-scope ke outletnya sendiri di server, jadi
            tidak ada parameter outlet yang bisa (perlu) diutak-atik. */}
        <section className="rounded-2xl glass-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Log Aktivitas &amp; Analisa
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Unduh jejak audit outlet ini sebagai Excel: tabel log yang rapi
            (bisa difilter), grafik tren periodik, aktivitas per jam, top
            aksi, dan pivot harian — siap untuk analisa.
          </p>
          <form
            method="get"
            action="/api/logs/export"
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label
                htmlFor="log-from"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Dari tanggal (WIB)
              </label>
              <input
                id="log-from"
                type="date"
                name="from"
                className={`${INPUT_CLASS} mt-1.5`}
              />
            </div>
            <div>
              <label
                htmlFor="log-to"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Sampai tanggal (WIB)
              </label>
              <input
                id="log-to"
                type="date"
                name="to"
                className={`${INPUT_CLASS} mt-1.5`}
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Unduh Excel (.xlsx)
            </button>
          </form>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Rentang kosong = semua waktu. Maksimal 10.000 baris per unduhan —
            untuk penelusuran panjang, unduh per rentang bulan. Hanya event
            outlet {outlet.name} yang ikut.
          </p>
        </section>

        <section className="rounded-2xl glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pratinjau Kop Struk
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Beginilah bagian atas strukmu akan tercetak.
          </p>
          {/* Kertas struk fisik: TETAP PUTIH di kedua tema (v1.8.0). */}
          <div className="mx-auto w-full max-w-[280px] bg-white px-4 py-4 font-mono text-[11px] text-slate-900 ring-1 ring-slate-200 dark:shadow-black/40">
            {logoUrl ? (
              <div className="flex items-start gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`Logo ${outlet.name}`}
                  className="h-10 w-10 shrink-0 rounded-md object-contain"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase leading-tight tracking-wide">
                    {outlet.name}
                  </p>
                  {outlet.address && (
                    <p className="mt-0.5 text-[9px] leading-snug">
                      {outlet.address}
                    </p>
                  )}
                  {outlet.phone && (
                    <p className="text-[9px] leading-snug">
                      Telp {outlet.phone}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[12px] font-bold uppercase leading-tight tracking-wide">
                  {outlet.name}
                </p>
                {outlet.address && (
                  <p className="mt-0.5 text-[9px] leading-snug">
                    {outlet.address}
                  </p>
                )}
                {outlet.phone && (
                  <p className="text-[9px] leading-snug">Telp {outlet.phone}</p>
                )}
              </div>
            )}
            <div className="my-2 border-t border-dashed border-neutral-400" />
            <p className="text-center text-[9px] text-slate-400 dark:text-slate-500">
              … sisa struk menyusul di halaman kasir
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [22/48] frontend/app/owner/settings/settings-forms.tsx ----------------------------------------
$p = @'
app/owner/settings/settings-forms.tsx
'@
$c = @'
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  removeOutletLogo,
  updateOutletProfile,
  uploadOutletLogo,
  type SettingsActionState,
} from "./actions";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_BYTES = 900 * 1024;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20";

function Notice({ state }: { state: SettingsActionState }) {
  if (!state.message) return null;
  if (state.ok) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        {state.message}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      {state.message}
    </p>
  );
}

export function OutletProfileForm({
  outlet,
}: {
  outlet: { name: string; address: string | null; phone: string | null };
}) {
  const [state, formAction, pending] = useActionState(updateOutletProfile, {
    ok: false,
    message: "",
  } satisfies SettingsActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="outlet-name"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Nama warung
        </label>
        <input
          id="outlet-name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={outlet.name}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Tampil di kop struk dan header aplikasi.
        </p>
      </div>
      <div>
        <label
          htmlFor="outlet-address"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Alamat (opsional)
        </label>
        <input
          id="outlet-address"
          name="address"
          maxLength={120}
          defaultValue={outlet.address ?? ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Dicetak di bawah nama warung pada struk.
        </p>
      </div>
      <div>
        <label
          htmlFor="outlet-phone"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Telepon (opsional)
        </label>
        <input
          id="outlet-phone"
          name="phone"
          maxLength={30}
          defaultValue={outlet.phone ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Profil
        </button>
        <Notice state={state} />
      </div>
    </form>
  );
}

export function OutletLogoForm({ logoUrl }: { logoUrl: string | null }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadOutletLogo,
    { ok: false, message: "" } satisfies SettingsActionState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeOutletLogo,
    { ok: false, message: "" } satisfies SettingsActionState,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // After a successful save the page re-renders with the new logoUrl,
  // so the local preview and the file input are cleared for round two.
  useEffect(() => {
    if (!uploadState.ok) return;
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }, [uploadState]);

  const pickFile = (file: File | undefined) => {
    setPickError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setPickError("Format harus PNG, JPEG, atau WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setPickError("Ukuran maksimal 900 KB.");
      return;
    }
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };

  const shown = previewUrl ?? logoUrl;

  return (
    <div className="space-y-4">
      <form action={uploadAction} className="space-y-4">
        <div className="flex h-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt="Logo warung"
              className="max-h-28 max-w-[200px] object-contain"
            />
          ) : (
            <div className="text-center">
              <ImagePlus className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Belum ada logo
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Struk mencetak nama warung di tengah.
              </p>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <ImagePlus className="h-4 w-4" />
            {shown ? "Ganti Gambar" : "Pilih Gambar"}
          </button>
          <button
            type="submit"
            disabled={!previewUrl || uploadPending}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {uploadPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Logo
          </button>
        </div>
        <Notice state={uploadState} />
        {pickError && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {pickError}
          </p>
        )}
      </form>

      {logoUrl && (
        <form action={removeAction}>
          <button
            type="submit"
            disabled={removePending}
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            {removePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Hapus Logo
          </button>
          <div className="mt-2">
            <Notice state={removeState} />
          </div>
        </form>
      )}

      <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        Tips: gambar persegi (minimal 256 x 256 piksel); PNG dengan latar
        transparan paling rapi. Logo tampil di pojok kiri atas struk — tetap
        berwarna saat dicetak — serta di header kasir dan ikon tab browser.
      </p>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [23/48] frontend/app/owner/stock/page.tsx ----------------------------------------
$p = @'
app/owner/stock/page.tsx
'@
$c = @'
import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, ClipboardList } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import {
  StockClient,
  type StockMovementRow,
  type StockProductOption,
} from "./stock-client";

export const instant = false;

// Build the formatter once at module level; timezone locked to Jakarta.
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type GoProduct = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  min_stock: number;
  unit: string;
  cost: number;
};

type GoMovement = {
  id: number;
  product_name: string;
  sku: string | null;
  unit: string;
  type: string;
  qty: number;
  unit_cost: number | null;
  note: string;
  user_name: string | null;
  receipt_no: string | null;
  created_at: string;
};

export default async function OwnerStockPage() {
  // Same guard pattern as the products page: reading cookies also makes
  // the route request-dynamic, which is what cacheComponents expects
  // (route segment "dynamic" config is not allowed there).
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER")
    redirect("/cashier");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }
  const goToken = session.user.goToken;

  // Produk aktif + 200 gerakan terakhir + total gerakan, semuanya dari
  // backend-go — kartu stok dan kasir membaca angka yang sama.
  const [productsResult, movementsResult] = await Promise.all([
    goFetch<GoProduct[]>(goToken, "/products"),
    goFetch<{ total: number; rows: GoMovement[] }>(
      goToken,
      "/stock-movements?limit=200",
    ),
  ]);
  if (!productsResult.ok) throw new Error(productsResult.message);
  if (!movementsResult.ok) throw new Error(movementsResult.message);

  const productOptions: StockProductOption[] = productsResult.data.map(
    (product) => ({
      id: String(product.id),
      name: product.name,
      sku: product.sku ?? "",
      stock: product.stock,
      minStock: product.min_stock,
      unit: product.unit || "pcs",
      costRupiah: product.cost,
    }),
  );

  // Rows are plain serializable objects. Display strings are prepared on
  // the server so the client render stays hydration-safe. Gerakan OUT
  // yang terikat nomor struk = penjualan kasir — ditampilkan SALE agar
  // makna barisnya sama dengan era sebelumnya.
  const movementRows: StockMovementRow[] = movementsResult.data.rows.map(
    (movement) => ({
      id: String(movement.id),
      productName: movement.product_name,
      sku: movement.sku ?? "",
      unit: movement.unit || "pcs",
      type:
        movement.type === "OUT" && movement.receipt_no ? "SALE" : movement.type,
      quantity: movement.qty,
      unitCostRupiah: movement.unit_cost,
      note: movement.note || null,
      userName: movement.user_name,
      transactionCode: movement.receipt_no,
      timeLabel: timeFmt.format(new Date(movement.created_at)),
    }),
  );

  const lowStockCount = productOptions.filter(
    (product) => product.stock <= product.minStock,
  ).length;

  const stats = [
    {
      label: "Jenis produk",
      value: productOptions.length.toLocaleString("id-ID"),
    },
    {
      label: "Total unit stok",
      value: productOptions
        .reduce((sum, product) => sum + product.stock, 0)
        .toLocaleString("id-ID"),
    },
    { label: "Perlu restok", value: lowStockCount.toLocaleString("id-ID") },
    {
      label: "Gerakan tercatat",
      value: movementsResult.data.total.toLocaleString("id-ID"),
    },
  ];

  return (
    // Shell aurora (v1.8.0): kartu stok memakai kaca, ikut tema pengguna.
    // Header + tombol kembali kini ada di halaman ini (dulu telanjang).
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Kartu Stok
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Restok, opname, dan jejak gerakan barang
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Boxes className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Kartu Stok
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Catat restok dan hasil opname. Setiap perubahan stok terekam di
          riwayat, terbaru paling atas.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const warn = stat.label === "Perlu restok" && lowStockCount > 0;
          return (
            <div
              key={stat.label}
              className="glass-card rounded-2xl p-4 sm:p-5"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {stat.label}
              </dt>
              <dd
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  warn ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {stat.value}
              </dd>
            </div>
          );
        })}
      </dl>

      <StockClient products={productOptions} rows={movementRows} />
      </main>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [24/48] frontend/app/owner/stock/stock-client.tsx ----------------------------------------
$p = @'
app/owner/stock/stock-client.tsx
'@
$c = @'
"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import { formatRupiah, formatThousands } from "@/lib/format";
import { TablePagination } from "@/components/table-pagination";
import { createStockMovementAction, type StockActionState } from "./actions";

export type StockProductOption = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  costRupiah: number;
};

export type StockMovementRow = {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  type: string;
  quantity: number;
  unitCostRupiah: number | null;
  note: string | null;
  userName: string | null;
  transactionCode: string | null;
  timeLabel: string;
};

type MovementType = "IN" | "ADJUST";
type TypeFilter = "ALL" | "IN" | "SALE" | "ADJUST";

const TYPE_META: Record<string, { label: string; badge: string }> = {
  IN: {
    label: "Masuk",
    badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30",
  },
  SALE: {
    label: "Penjualan",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-500/30",
  },
  ADJUST: {
    label: "Opname",
    badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30",
  },
};

const FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "IN", label: "Masuk" },
  { key: "SALE", label: "Penjualan" },
  { key: "ADJUST", label: "Opname" },
];

// Rows per page on the movements table (shared pagination footer).
const PAGE_SIZE = 20;

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700";

function typeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: type,
      badge: "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 ring-1 ring-slate-200",
    }
  );
}

// Display follows the blueprint convention: quantity is stored positive
// and the type decides the direction. Opname keeps its signed delta in
// the note, so the magnitude gets a plus-minus marker here.
function signedQuantity(row: StockMovementRow) {
  if (row.type === "IN") return `+${row.quantity}`;
  if (row.type === "SALE") return `-${row.quantity}`;
  return `±${row.quantity}`;
}

function quantityColor(row: StockMovementRow) {
  if (row.type === "IN") return "text-emerald-600 dark:text-emerald-400";
  if (row.type === "SALE") return "text-rose-600";
  return "text-amber-600 dark:text-amber-400";
}

export function StockClient({
  products,
  rows,
}: {
  products: StockProductOption[];
  rows: StockMovementRow[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<{
    productId: string;
    type: MovementType;
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Same formula as the dashboard widget: enough units to reach twice
  // the minimum, at least one.
  const suggestionFor = (product: StockProductOption) =>
    Math.max(product.minStock * 2 - product.stock, 1);

  const lowStock = useMemo(
    () => products.filter((product) => product.stock <= product.minStock),
    [products],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "ALL" && row.type !== typeFilter) return false;
      if (!q) return true;
      return (
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q) ||
        (row.transactionCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, typeFilter]);

  // Pagination: 20 rows per page; any search/filter change resets to
  // page 1 so the top of the new result set stays visible.
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const countFor = (key: TypeFilter) =>
    key === "ALL" ? rows.length : rows.filter((row) => row.type === key).length;

  const openModal = (productId: string, type: MovementType) => {
    setPrefill({ productId, type });
    setModalOpen(true);
  };

  const handleSuccess = useCallback((message: string) => {
    setModalOpen(false);
    setPrefill(null);
    setBanner(message);
  }, []);

  const canRecord = products.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari produk, SKU, struk, atau catatan..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
          />
        </div>
        <button
          type="button"
          onClick={() => openModal("", "IN")}
          disabled={!canRecord}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PackagePlus className="h-4 w-4" />
          Catat Gerakan
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Perlu Restok — {lowStock.length} produk di bawah batas minimum
            </h2>
          </div>
          <ul className="mt-2 divide-y divide-amber-100">
            {lowStock.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-amber-950">
                    {product.name}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {product.sku} · sisa {product.stock} {product.unit} · min{" "}
                    {product.minStock}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openModal(product.id, "IN")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-500"
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Restok +{suggestionFor(product)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = typeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setTypeFilter(filter.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 dark:border-slate-800  bg-white dark:bg-slate-900  text-slate-600 dark:text-slate-400  hover:border-slate-300 dark:hover:border-slate-700 "
              }`}
            >
              {filter.label}
              <span
                className={`ml-1.5 tabular-nums ${
                  active ? "text-slate-300" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {countFor(filter.key)}
              </span>
            </button>
          );
        })}
      </div>

      {banner && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 dark:ring-emerald-500/30">
          <p>{banner}</p>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="shrink-0 rounded p-1 text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-100"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!canRecord && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-500/30">
          Belum ada produk aktif. Tambahkan produk dulu di menu Produk sebelum
          mencatat gerakan stok.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl glass-card">
        {filteredRows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {rows.length === 0
                ? "Belum ada gerakan stok"
                : "Tidak ada gerakan yang cocok"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {rows.length === 0
                ? "Klik Catat Gerakan untuk mencatat restok pertama kamu."
                : "Coba ubah kata kunci atau filter tipenya."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">Waktu</th>
                    <th className="px-4 py-3 font-medium">Produk</th>
                    <th className="px-4 py-3 font-medium">Tipe</th>
                    <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Biaya Satuan
                    </th>
                    <th className="px-4 py-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((row) => {
                    const meta = typeMeta(row.type);
                    return (
                      <tr key={row.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                          <p>{row.timeLabel}</p>
                          {row.userName && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              oleh {row.userName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {row.productName}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{row.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                          {row.transactionCode && (
                            <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {row.transactionCode}
                            </p>
                          )}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${quantityColor(row)}`}
                        >
                          {signedQuantity(row)}{" "}
                          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                            {row.unit}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {row.unitCostRupiah
                            ? formatRupiah(row.unitCostRupiah)
                            : "-"}
                        </td>
                        <td
                          className="max-w-[16rem] truncate px-4 py-3 text-slate-500 dark:text-slate-400"
                          title={row.note ?? undefined}
                        >
                          {row.note || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredRows.map((row) => {
                const meta = typeMeta(row.type);
                return (
                  <li key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {row.productName}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{row.sku}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                        {row.transactionCode && (
                          <span className="shrink-0 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            {row.transactionCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span
                        className={`font-semibold tabular-nums ${quantityColor(row)}`}
                      >
                        {signedQuantity(row)} {row.unit}
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-400">
                        {row.unitCostRupiah
                          ? formatRupiah(row.unitCostRupiah)
                          : "biaya -"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span className="whitespace-nowrap">
                        {row.timeLabel}
                        {row.userName ? ` · ${row.userName}` : ""}
                      </span>
                      {row.note && <span className="truncate">{row.note}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <TablePagination
              page={safePage}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={filteredRows.length}
              unit="gerakan"
              onPage={setPage}
            />
          </>
        )}
      </div>

      {modalOpen && (
        <RecordMovementModal
          products={products}
          initialProductId={prefill?.productId ?? ""}
          initialType={prefill?.type ?? "IN"}
          onClose={() => {
            setModalOpen(false);
            setPrefill(null);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function RecordMovementModal({
  products,
  initialProductId,
  initialType,
  onClose,
  onSuccess,
}: {
  products: StockProductOption[];
  initialProductId: string;
  initialType: MovementType;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState<
    StockActionState,
    FormData
  >(createStockMovementAction, {});
  const [productId, setProductId] = useState(initialProductId);
  const [type, setType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState("");
  const initialProduct = products.find(
    (product) => product.id === initialProductId,
  );
  const [unitCost, setUnitCost] = useState(
    initialProduct && initialProduct.costRupiah > 0
      ? String(initialProduct.costRupiah)
      : "",
  );

  const selected = products.find((product) => product.id === productId) ?? null;

  // Close automatically once the server action reports success.
  useEffect(() => {
    if (state.success) onSuccess(state.success);
  }, [state.success, onSuccess]);

  // Escape closes the modal, and background scroll is locked while open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const onProductChange = (id: string) => {
    setProductId(id);
    // Prefill the cost with the known purchase cost; the owner only
    // adjusts it when the supplier price actually changed.
    const product = products.find((item) => item.id === id);
    setUnitCost(
      product && product.costRupiah > 0 ? String(product.costRupiah) : "",
    );
  };

  const parsedQty = quantity ? Number(quantity) : null;
  const stockAfter =
    selected && parsedQty !== null && type === "IN"
      ? selected.stock + parsedQty
      : null;
  const adjustDelta =
    selected && parsedQty !== null && type === "ADJUST"
      ? parsedQty - selected.stock
      : null;

  const canSubmit = !pending && productId !== "" && quantity !== "";
  const costDisplay = unitCost ? formatThousands(Number(unitCost)) : "";

  const quantityLabel =
    type === "IN" ? "Jumlah masuk" : "Stok hasil hitung fisik";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-md sm:items-center sm:p-6 dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Catat gerakan stok"
        className="glass-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl shadow-xl sm:rounded-2xl dark:shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 bg-white/90 px-5 py-4 backdrop-blur-xl dark:bg-slate-950/90">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Catat Gerakan Stok
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Stok produk ikut diperbarui otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-400"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-5 py-5">
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="unitCost"
            value={type === "IN" ? unitCost : ""}
          />

          <div>
            <label
              htmlFor="productId"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Produk
            </label>
            <select
              id="productId"
              name="productId"
              value={productId}
              onChange={(event) => onProductChange(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Pilih produk...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · stok {product.stock} {product.unit}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Stok sekarang:{" "}
                <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                  {selected.stock} {selected.unit}
                </span>{" "}
                · batas minimum {selected.minStock}
              </p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipe gerakan
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("IN")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  type === "IN"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900  text-slate-600 dark:text-slate-400  hover:border-slate-300 dark:hover:border-slate-700 "
                }`}
              >
                <PackagePlus className="h-4 w-4" />
                Restok
              </button>
              <button
                type="button"
                onClick={() => setType("ADJUST")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  type === "ADJUST"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900  text-slate-600 dark:text-slate-400  hover:border-slate-300 dark:hover:border-slate-700 "
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                Opname
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {type === "IN"
                ? "Barang masuk dari supplier atau pembelian."
                : "Samakan stok sistem dengan hasil hitung fisik. Selisihnya dicatat otomatis."}
            </p>
          </div>

          <div>
            <label
              htmlFor="quantity"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {quantityLabel}
            </label>
            <input
              id="quantity"
              name="quantity"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={`${INPUT_CLASS} tabular-nums`}
            />
            {stockAfter !== null && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Stok setelah dicatat:{" "}
                <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                  {stockAfter} {selected?.unit}
                </span>
              </p>
            )}
            {adjustDelta !== null && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Selisih yang akan dicatat:{" "}
                <span
                  className={`font-medium tabular-nums ${
                    adjustDelta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : adjustDelta < 0
                        ? "text-rose-600"
                        : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta}{" "}
                  {selected?.unit}
                </span>
              </p>
            )}
          </div>

          {type === "IN" && (
            <div>
              <label
                htmlFor="unitCost"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Biaya satuan{" "}
                <span className="font-normal text-slate-400 dark:text-slate-500">(opsional)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                  Rp
                </span>
                <input
                  id="unitCost"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={costDisplay}
                  onChange={(event) =>
                    setUnitCost(
                      event.target.value.replace(/\D/g, "").slice(0, 12),
                    )
                  }
                  className={`${INPUT_CLASS} pl-10 text-right font-semibold tabular-nums`}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Tersimpan sebagai snapshot biaya untuk laporan laba.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="note"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Catatan{" "}
              <span className="font-normal text-slate-400 dark:text-slate-500">(opsional)</span>
            </label>
            <input
              id="note"
              name="note"
              type="text"
              maxLength={200}
              placeholder="Misal: belanja dari supplier A"
              className={INPUT_CLASS}
            />
          </div>

          {state.error && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">
              {state.error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Menyimpan..." : "Simpan Gerakan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StockClient;
'@
Save-UmkmFile $p $c

# ---- [25/48] frontend/app/owner/transactions/transactions-client.tsx ----------------------------------------
$p = @'
app/owner/transactions/transactions-client.tsx
'@
$c = @'
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  TrendingUp,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { getTransactionDetail, refundTransaction } from "./actions";
import type { ProfitSummary, TransactionDetail, TransactionRow } from "./types";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { TablePagination } from "@/components/table-pagination";

type Tab = "riwayat" | "laba";
type MethodFilter = "ALL" | "CASH" | "QRIS" | "DEBIT";
type StatusFilter = "ALL" | "COMPLETED" | "REFUNDED";

// Same color language as the owner dashboard method cards.
const METHOD_META: Record<string, { label: string; badge: string }> = {
  CASH: { label: "Tunai", badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" },
  QRIS: { label: "QRIS", badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" },
  DEBIT: { label: "Debit", badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
};

const HANDOVER_META: Record<string, { label: string; badge: string }> = {
  SERVED: { label: "Disajikan", badge: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  COURIER_CLAIMED: {
    label: "Diklaim kurir",
    badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  },
  CONFIRMED: {
    label: "Terkonfirmasi",
    badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  DISPUTED: { label: "Sengketa", badge: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300" },
};

const PERIOD_FILTERS: { key: 7 | 30; label: string }[] = [
  { key: 7, label: "7 hari" },
  { key: 30, label: "30 hari" },
];

const METHOD_FILTERS: { key: MethodFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "CASH", label: "Tunai" },
  { key: "QRIS", label: "QRIS" },
  { key: "DEBIT", label: "Debit" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "COMPLETED", label: "Selesai" },
  { key: "REFUNDED", label: "Refund" },
];

// Rows per page on the history & profit tables (shared footer).
const PAGE_SIZE = 20;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPct = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl glass-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function ProfitStat({
  label,
  value,
  sub,
  valueClass,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl glass-card p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p
          className={`mt-0.5 truncate text-xl font-bold tabular-nums ${
            valueClass ?? "text-slate-900 dark:text-slate-100"
          }`}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5">
      {options.map((option) => (
        <button
          key={String(option.key)}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === option.key
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 "
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          valueClass ?? "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailPanel({
  detail,
  detailLoading,
  detailError,
  onRetry,
  refundReason,
  onRefundReasonChange,
  onRefundSubmit,
  refundPending,
  refundError,
}: {
  detail: TransactionDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onRetry: () => void;
  refundReason: string;
  onRefundReasonChange: (next: string) => void;
  onRefundSubmit: () => void;
  refundPending: boolean;
  refundError: string | null;
}) {
  if (detailLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat detail…
      </div>
    );
  }

  if (detailError || !detail) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-6">
        <p className="text-sm text-red-600 dark:text-red-400">
          {detailError ?? "Detail tidak tersedia."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const method = METHOD_META[detail.paymentMethod];
  const handover = detail.handoverStatus
    ? HANDOVER_META[detail.handoverStatus]
    : null;

  return (
    <div className="space-y-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/60 px-4 py-4 dark:bg-slate-900/40">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2 font-semibold">Produk</th>
              <th className="px-3 py-2 text-center font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Harga</th>
              <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {detail.items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                  {item.productName}
                  <span className="text-xs text-slate-400 dark:text-slate-500"> / {item.unit}</span>
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-slate-700 dark:text-slate-300">
                  {item.quantity}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatRupiah(item.priceAtSaleRupiah)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(item.subtotalRupiah)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
          <DetailRow
            label="Subtotal"
            value={formatRupiah(detail.subtotalRupiah)}
          />
          {detail.discountRupiah > 0 && (
            <DetailRow
              label="Diskon"
              value={`− ${formatRupiah(detail.discountRupiah)}`}
              valueClass="text-red-600 dark:text-red-400"
            />
          )}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800/60" />
          <DetailRow
            label="Total"
            value={formatRupiah(detail.totalRupiah)}
            valueClass="text-base font-bold"
          />
          <DetailRow label="Dibayar" value={formatRupiah(detail.paidRupiah)} />
          <DetailRow
            label="Kembalian"
            value={formatRupiah(detail.changeRupiah)}
          />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
          <DetailRow label="Waktu" value={formatTime(detail.createdAtIso)} />
          <DetailRow label="Kasir" value={detail.cashierName} />
          <DetailRow
            label="Metode"
            value={method?.label ?? detail.paymentMethod}
          />
          <DetailRow
            label="Kode klaim"
            value={detail.claimCode ?? "—"}
            valueClass="font-mono"
          />
          <DetailRow
            label="Serah terima"
            value={handover?.label ?? "—"}
            valueClass={
              handover ? `text-xs ${handover.badge}` : "text-slate-400 dark:text-slate-500"
            }
          />
        </div>
      </div>

      {detail.status === "COMPLETED" ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p className="text-sm font-semibold text-red-800">
            Refund transaksi ini
          </p>
          {detail.handoverStatus === "SERVED" ? (
            <p className="mt-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              Struk ini tercatat SUDAH DISAJIKAN — refund tetap bisa dilakukan,
              tetapi WAJIB menyertakan alasan (tercatat permanen untuk
              evaluasi).
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-red-700/80">
              Stok setiap produk dikembalikan otomatis dan tercatat di kartu
              stok sebagai IN. Tindakan ini tidak bisa dibatalkan.
            </p>
          )}
          <textarea
            value={refundReason}
            onChange={(event) => onRefundReasonChange(event.target.value)}
            rows={2}
            maxLength={120}
            placeholder={
              detail.handoverStatus === "SERVED"
                ? "Alasan (WAJIB — struk tercatat sudah disajikan)"
                : "Alasan (opsional, mis. barang rusak / salah input)"
            }
            className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 dark:focus:ring-red-500/20"
          />
          {refundError && (
            <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
              {refundError}
            </p>
          )}
          <button
            type="button"
            onClick={onRefundSubmit}
            disabled={
              refundPending ||
              (detail.handoverStatus === "SERVED" && refundReason.trim() === "")
            }
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refundPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {refundPending ? "Memproses…" : "Refund & kembalikan stok"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
          Transaksi ini sudah direfund — stok telah dikembalikan dan uang
          dianggap kembali ke pembeli.
        </div>
      )}
    </div>
  );
}

export function TransactionsClient({
  outletName,
  userName,
  rows,
  weekSummary,
  monthSummary,
}: {
  outletName: string;
  userName: string;
  rows: TransactionRow[];
  weekSummary: ProfitSummary;
  monthSummary: ProfitSummary;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("riwayat");
  const [days, setDays] = useState<7 | 30>(30);
  const [method, setMethod] = useState<MethodFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundPending, setRefundPending] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [profitDays, setProfitDays] = useState<7 | 30>(30);
  const [profitPage, setProfitPage] = useState(1);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (method !== "ALL" && row.paymentMethod !== method) return false;
      if (new Date(row.createdAtIso).getTime() < cutoff) return false;
      if (needle && !row.code.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, days, method, status, query]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [days, method, status, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const completedOmzet = filtered
    .filter((row) => row.status === "COMPLETED")
    .reduce((sum, row) => sum + row.totalRupiah, 0);
  const refundCount = filtered.filter(
    (row) => row.status === "REFUNDED",
  ).length;

  async function loadDetail(transactionId: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await getTransactionDetail(transactionId);
      if (result.ok) {
        setDetail(result.detail);
      } else {
        setDetailError(result.error);
      }
    } catch {
      setDetailError("Gagal memuat detail transaksi.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleDetail(transactionId: string) {
    if (expandedId === transactionId) {
      setExpandedId(null);
      setDetail(null);
      setDetailError(null);
      return;
    }
    setExpandedId(transactionId);
    setDetail(null);
    setDetailError(null);
    setRefundReason("");
    setRefundError(null);
    await loadDetail(transactionId);
  }

  async function submitRefund() {
    if (!expandedId || refundPending) return;
    setRefundPending(true);
    setRefundError(null);
    try {
      const result = await refundTransaction({
        transactionId: expandedId,
        reason: refundReason.trim() || undefined,
      });
      if (result.ok) {
        // Refresh the detail panel (status flips to REFUNDED, the
        // refund box disappears) and the server-rendered list.
        await loadDetail(expandedId);
        router.refresh();
      } else {
        setRefundError(result.error);
      }
    } catch {
      setRefundError("Gagal memproses refund.");
    } finally {
      setRefundPending(false);
    }
  }

  const activeSummary = profitDays === 7 ? weekSummary : monthSummary;

  // Pagination for the per-product profit table (same 20 rows rule).
  useEffect(() => {
    setProfitPage(1);
  }, [profitDays]);
  const profitPageCount = Math.max(
    1,
    Math.ceil(activeSummary.rows.length / PAGE_SIZE),
  );
  const safeProfitPage = Math.min(profitPage, profitPageCount);
  const profitPageRows = activeSummary.rows.slice(
    (safeProfitPage - 1) * PAGE_SIZE,
    safeProfitPage * PAGE_SIZE,
  );

  return (
    // Shell aurora (v1.8.0): riwayat & laba memakai kartu kaca, ikut tema.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Riwayat Transaksi — {outletName}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {userName} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <div className="flex w-fit gap-1 rounded-2xl glass-card p-1">
          <button
            type="button"
            onClick={() => setTab("riwayat")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === "riwayat"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 "
            }`}
          >
            Riwayat
          </button>
          <button
            type="button"
            onClick={() => setTab("laba")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === "laba"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 "
            }`}
          >
            Laba
          </button>
        </div>

        {tab === "riwayat" ? (
          <>
            <div className="rounded-2xl glass-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari kode struk… (mis. TRX-20261022)"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
                  />
                </div>
                <ChipGroup
                  options={PERIOD_FILTERS}
                  value={days}
                  onChange={setDays}
                />
                <ChipGroup
                  options={METHOD_FILTERS}
                  value={method}
                  onChange={setMethod}
                />
                <ChipGroup
                  options={STATUS_FILTERS}
                  value={status}
                  onChange={setStatus}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Transaksi tampil"
                value={String(filtered.length)}
              />
              <MiniStat
                label="Omzet selesai"
                value={formatRupiah(completedOmzet)}
              />
              <MiniStat label="Refund" value={`${refundCount} transaksi`} />
            </div>

            <div className="overflow-hidden rounded-2xl glass-card">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daftar Transaksi
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {rows.length} transaksi terakhir dimuat
                </p>
              </div>
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Tidak ada transaksi yang cocok dengan filter.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pageRows.map((row) => {
                    const methodMeta = METHOD_META[row.paymentMethod];
                    const isRefunded = row.status === "REFUNDED";
                    const expanded = expandedId === row.id;
                    return (
                      <div key={row.id}>
                        <button
                          type="button"
                          onClick={() => toggleDetail(row.id)}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        >
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {row.code}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {formatTime(row.createdAtIso)} · {row.itemCount}{" "}
                              item · {row.cashierName}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              methodMeta?.badge ?? "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 "
                            }`}
                          >
                            {methodMeta?.label ?? row.paymentMethod}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isRefunded
                                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 "
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 "
                            }`}
                          >
                            {isRefunded ? "Refund" : "Selesai"}
                          </span>
                          <p
                            className={`shrink-0 text-sm font-bold tabular-nums ${
                              isRefunded
                                ? "text-slate-400 dark:text-slate-500 line-through"
                                : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {formatRupiah(row.totalRupiah)}
                          </p>
                          {expanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                          )}
                        </button>
                        {expanded && (
                          <DetailPanel
                            detail={detail}
                            detailLoading={detailLoading}
                            detailError={detailError}
                            onRetry={() => {
                              if (expandedId) loadDetail(expandedId);
                            }}
                            refundReason={refundReason}
                            onRefundReasonChange={setRefundReason}
                            onRefundSubmit={submitRefund}
                            refundPending={refundPending}
                            refundError={refundError}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <TablePagination
                page={safePage}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                unit="transaksi"
                onPage={setPage}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex w-fit rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setProfitDays(7)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profitDays === 7
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 "
                }`}
              >
                7 hari
              </button>
              <button
                type="button"
                onClick={() => setProfitDays(30)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profitDays === 30
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 "
                }`}
              >
                30 hari
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProfitStat
                label="Omzet"
                value={formatRupiah(activeSummary.omzetRupiah)}
                sub={`${activeSummary.transactionCount} transaksi selesai`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <ProfitStat
                label="Harga pokok (HPP)"
                value={formatRupiah(activeSummary.costRupiah)}
                sub="memakai harga beli terkini"
                icon={<Calculator className="h-4 w-4" />}
              />
              <ProfitStat
                label="Laba kotor"
                value={formatRupiah(activeSummary.profitRupiah)}
                sub="omzet dikurangi HPP"
                valueClass={
                  activeSummary.profitRupiah >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
                icon={<Calculator className="h-4 w-4" />}
              />
              <ProfitStat
                label="Margin"
                value={formatPct(activeSummary.marginPct)}
                sub="laba dibagi omzet"
                valueClass={
                  (activeSummary.marginPct ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>

            {activeSummary.rows.length === 0 ? (
              <div className="rounded-2xl glass-card p-5">
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  Belum ada penjualan selesai pada periode ini.
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl glass-card">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 px-4 py-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Laba per Produk
                  </h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {activeSummary.rows.length} produk terjual
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-2 font-semibold">Produk</th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Terjual
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Omzet
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          HPP
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Laba
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Margin
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profitPageRows.map((row) => (
                        <tr key={row.productId}>
                          <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">
                            {row.name}
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {" "}
                              / {row.unit}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {row.soldQuantity}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {formatRupiah(row.revenueRupiah)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                            {formatRupiah(row.costRupiah)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                              row.profitRupiah >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatRupiah(row.profitRupiah)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                            {formatPct(row.marginPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={safeProfitPage}
                  pageCount={profitPageCount}
                  pageSize={PAGE_SIZE}
                  total={activeSummary.rows.length}
                  unit="produk"
                  onPage={setProfitPage}
                />
              </div>
            )}

            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Catatan: HPP dihitung memakai harga beli terkini tiap produk
              (harga beli tidak di-snapshot saat penjualan) — angka laba adalah
              perkiraan yang wajar untuk warung. Transaksi refund tidak
              dihitung.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [26/48] frontend/app/owner/verify/[id]/client.tsx ----------------------------------------
$p = @'
app/owner/verify/[id]/client.tsx
'@
$c = @'
"use client";
// Interaksi halaman detail (layar kurir).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/handover/signature-pad";
import { claimDelivered, confirmHandoverInApp } from "../actions";

export function ConfirmInAppForm({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!signature) return setError("Tanda tangan pembeli belum digambar.");
    if (!agreed) return setError("Centang dulu pernyataan pembeli.");
    startTransition(async () => {
      const res = await confirmHandoverInApp({
        transactionId,
        buyerName,
        signatureData: signature,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <SignaturePad onChange={setSignature} />
      <input
        value={buyerName}
        onChange={(e) => setBuyerName(e.target.value)}
        placeholder="Nama pembeli (opsional)"
        maxLength={40}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
      />
      <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Pembeli menyatakan pesanan ini diterima dengan lengkap dan benar.
        </span>
      </label>
      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Simpan Bukti Serah Terima"}
      </button>
    </div>
  );
}

export function ClaimDeliveredButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const ok = window.confirm(
      "Tandai SUDAH DIANTAR tanpa tanda tangan pembeli?\n\n" +
        "Bukti hanya klaim kurir (lemah). Kalau pembeli bisa tanda tangan, pakai tombol atas.",
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await claimDelivered({ transactionId });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-1">
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg border border-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-300 disabled:opacity-50"
      >
        {pending
          ? "Menyimpan..."
          : "Sudah Diantar — Klaim Kurir (tanpa tanda tangan)"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Clipboard API tidak tersedia di HTTP (LAN IP), jadi sediakan
    // fallback execCommand untuk HP kurir yang membuka via IP.
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400"
    >
      {copied ? "Tersalin ✓" : (label ?? "Salin")}
    </button>
  );
}
'@
Save-UmkmFile $p $c

# ---- [27/48] frontend/app/owner/verify/[id]/page.tsx ----------------------------------------
$p = @'
app/owner/verify/[id]/page.tsx
'@
$c = @'
// Detail SATU transaksi — dibuka staf dari perangkat LOGIN.
// v3: jalur utama dine-in = tombol "Sudah Disajikan" (satu arah,
// berjejak); tanda tangan pembeli tetap tersedia sebagai bukti kuat
// untuk takeaway/online. Kode & QR selalu ada di sini untuk itu.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { buildVerifyUrl } from "@/lib/handover";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { ServeButton } from "@/components/serve-queue";
import { ClaimDeliveredButton, ConfirmInAppForm, CopyButton } from "./client";

export const instant = false;

const dtFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  SERVED: { label: "Disajikan", cls: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300" },
  CONFIRMED: { label: "Terverifikasi", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  COURIER_CLAIMED: { label: "Klaim Kurir", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
  DISPUTED: { label: "Dibantah Pembeli!", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
};

const KIND_LABEL: Record<string, string> = {
  STAFF_SERVE: "Disajikan staf",
  BUYER_CONFIRM: "Konfirmasi pembeli",
  COURIER_CLAIM: "Klaim kurir",
  BUYER_DISPUTE: "Pembantahan pembeli",
};

export default async function VerifyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "OWNER" && user.role !== "KASIR" && user.role !== "DEVELOPER")) redirect("/");

  const { id } = await params;
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: {
      outlet: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
      handoverEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!tx || !tx.claimCode) notFound();
  // Kasir outlet lain tidak boleh melihat transaksi ini.
  if (user.outletId && tx.outletId !== user.outletId) notFound();

  const code = tx.claimCode;
  const verifyUrl = buildVerifyUrl(code);
  const qrSvg = await QRCode.toString(verifyUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 180,
  });

  const status = tx.handoverStatus;
  const st = status ? STATUS_STYLE[status] : null;
  const confirmEvent = tx.handoverEvents.find(
    (e) => e.kind === "BUYER_CONFIRM",
  );
  // Who recorded the serve/confirmation on the staff side (v3 audit).
  const actorName = tx.handoverConfirmedBy
    ? ((
        await prisma.user.findUnique({
          where: { id: tx.handoverConfirmedBy },
          select: { name: true },
        })
      )?.name ?? null)
    : null;

  return (
    // Shell aurora (v1.8.0): detail bukti serah terima ikut tema pengguna.
    <main className="relative mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/owner/verify" className="text-sm text-slate-500 dark:text-slate-400">
          ← Daftar
        </Link>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Bukti Serah Terima
        </p>
        <ThemeHeaderActions className="scale-90" />
      </div>

      {/* Ringkasan transaksi */}
      <section className="rounded-2xl glass-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {dtFmt.format(tx.createdAt)} WIB
            </p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {formatRupiah(Number(tx.total))}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tx.items.length} item ·{" "}
              {PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
            </p>
          </div>
          {st && (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${st.cls}`}
            >
              {st.label}
            </span>
          )}
        </div>
        <ul className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-800/60 pt-3">
          {tx.items.map((it, i) => (
            <li key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {it.product.name} × {it.quantity}
              </span>
              <span>{formatRupiah(Number(it.priceAtSale) * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Kode + QR — selalu tersedia (staf never forgets the code) */}
      <section className="mt-3 rounded-2xl glass-card p-4 text-center">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kode verifikasi</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-slate-900 dark:text-slate-100">
          {code}
        </p>
        <div className="mt-3 flex justify-center">
          <div
            className="w-44 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Untuk bukti kuat: minta pembeli scan QR ini dengan HP-nya, atau
          bacakan kodenya.
        </p>
        <div className="mt-2 flex justify-center gap-2">
          <CopyButton text={code} label="Salin kode" />
          <CopyButton text={verifyUrl} label="Salin link" />
        </div>
      </section>

      {/* Aksi */}
      <section className="mt-3 rounded-2xl glass-card p-4">
        {status === "SERVED" ? (
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ✔ Tercatat disajikan{" "}
              {dtFmt.format(tx.handoverConfirmedAt ?? tx.createdAt)} WIB
              {actorName ? ` oleh ${actorName}` : ""}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Penandaan penyajian SATU ARAH — tidak bisa dibatalkan. Klaim
              penggantian pesanan untuk struk ini ditolak; jejaknya permanen.
            </p>
          </div>
        ) : status === "CONFIRMED" ? (
          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ✔ Terverifikasi{" "}
              {dtFmt.format(tx.handoverConfirmedAt ?? tx.createdAt)} WIB
            </p>
            {confirmEvent?.signatureData && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={confirmEvent.signatureData}
                alt="Tanda tangan pembeli"
                className="mx-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Metode:{" "}
              {confirmEvent?.method === "PUBLIC" ? "HP pembeli" : "layar kurir"}
              {confirmEvent?.buyerName
                ? ` · a.n. ${confirmEvent.buyerName}`
                : ""}
            </p>
          </div>
        ) : status === "DISPUTED" ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm font-medium text-red-700 dark:text-red-300">
              Pembeli membantah menerima pesanan ini. Kalau ternyata sudah
              diterima, minta pembeli tanda tangan di bawah (atau konfirmasi
              lewat QR/link di atas).
            </p>
            <ConfirmInAppForm transactionId={tx.id} />
          </div>
        ) : status === "COURIER_CLAIMED" ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
              Sudah diklaim kurir tanpa tanda tangan. Kalau pembeli sekarang ada
              di depan kamu, minta dia tanda tangan di bawah untuk bukti kuat.
            </p>
            <ConfirmInAppForm transactionId={tx.id} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
              <p className="mb-2 text-xs font-bold text-blue-900">
                Dine-in / bungkus — pesanan diserahkan sekarang?
              </p>
              <ServeButton transactionId={tx.id} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Konfirmasi di layar ini (bukti terkuat — tanda tangan pembeli)
              </p>
              <ConfirmInAppForm transactionId={tx.id} />
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Pesanan diantar (online) tanpa tanda tangan?
              </p>
              <ClaimDeliveredButton transactionId={tx.id} />
            </div>
          </div>
        )}
      </section>

      {/* Jejak audit — gak bisa dihapus, gak bisa dimanipulasi */}
      <section className="mt-3 rounded-2xl glass-card p-4">
        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          Jejak kejadian
        </p>
        <ol className="space-y-2">
          {tx.handoverEvents.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span className="shrink-0 font-mono text-slate-400 dark:text-slate-500">
                {dtFmt.format(e.createdAt)}
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                {KIND_LABEL[e.kind] ?? e.kind}
                {e.actorRole ? ` · ${e.actorRole}` : ""}
                {e.note ? ` — "${e.note}"` : ""}
              </span>
            </li>
          ))}
          {tx.handoverEvents.length === 0 && (
            <li className="text-xs text-slate-400 dark:text-slate-500">Belum ada aktivitas.</li>
          )}
        </ol>
      </section>
      </div>
    </main>
  );
}
'@
Save-UmkmFile $p $c

# ---- [28/48] frontend/app/owner/verify/page.tsx ----------------------------------------
$p = @'
app/owner/verify/page.tsx
'@
$c = @'
// KONSOL VERIFIKASI STRUK v3 (dine-in) — dibuka KASIR/OWNER yang login
// (dan DEVELOPER saat mode maintenance, Task 35).
// Nomor struk adalah ALAMAT, bukan kunci: pencarian hanya menampilkan
// status + ATURAN KEPUTUSAN deterministik. Status penyajian dicatat
// staf lewat Antrean Penyajian (satu arah, berjejak di HandoverEvent).
//
// Redesign Task 35: kartu statistik berikon + ring warna, pencarian
// dengan ikon, kartu hasil dengan aksen warna kiri — logika query dan
// aksi TIDAK berubah sama sekali.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  ScanSearch,
  UtensilsCrossed,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { startOfTodayWIB } from "@/lib/handover";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { ServeButton, ServeQueuePanel } from "@/components/serve-queue";

export const instant = false;

const dtFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

export default async function VerifyConsolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;
  if (
    !user ||
    (user.role !== "OWNER" &&
      user.role !== "KASIR" &&
      user.role !== "DEVELOPER")
  ) {
    redirect("/");
  }

  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (rawQ ?? "").trim();

  // Kasir/developer-maintenance only sees their outlet; an owner without
  // one sees all.
  const outletScope = user.outletId ? { outletId: user.outletId } : {};

  const todayRows = await prisma.transaction.findMany({
    where: { createdAt: { gte: startOfTodayWIB() }, ...outletScope },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      createdAt: true,
      total: true,
      paymentMethod: true,
      status: true,
      handoverStatus: true,
      items: { select: { quantity: true } },
    },
  });

  // The queue = today's completed receipts with zero handover activity.
  const queueRows = todayRows
    .filter((t) => t.status === "COMPLETED" && t.handoverStatus === null)
    .map((t) => ({
      id: t.id,
      code: t.code,
      createdAtIso: t.createdAt.toISOString(),
      itemCount: t.items.reduce((sum, i) => sum + i.quantity, 0),
      totalRupiah: Math.round(Number(t.total)),
      paymentMethod: t.paymentMethod,
    }));

  const chips: {
    label: string;
    value: number;
    icon: typeof Clock3;
    chip: string;
    valueCls: string;
  }[] = [
    {
      label: "Menunggu",
      value: queueRows.length,
      icon: Clock3,
      chip: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/30",
      valueCls: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Disajikan",
      value: todayRows.filter((t) => t.handoverStatus === "SERVED").length,
      icon: UtensilsCrossed,
      chip: "bg-teal-50 text-teal-600 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:ring-teal-500/30",
      valueCls: "text-teal-600",
    },
    {
      label: "Terverifikasi",
      value: todayRows.filter((t) => t.handoverStatus === "CONFIRMED").length,
      icon: BadgeCheck,
      chip: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/30",
      valueCls: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Sengketa",
      value: todayRows.filter((t) => t.handoverStatus === "DISPUTED").length,
      icon: AlertTriangle,
      chip: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/30",
      valueCls: "text-red-600 dark:text-red-400",
    },
  ];

  // Lookup by receipt code (TRX-...) or the legacy 8-char verification
  // code — both resolve to the same single receipt, scoped to outlet.
  const found = q
    ? await prisma.transaction.findFirst({
        where: {
          OR: [{ code: q.toUpperCase() }, { claimCode: q.toUpperCase() }],
          ...outletScope,
        },
        select: {
          id: true,
          code: true,
          createdAt: true,
          total: true,
          paymentMethod: true,
          status: true,
          handoverStatus: true,
          handoverConfirmedAt: true,
          handoverConfirmedBy: true,
          items: { select: { quantity: true } },
        },
      })
    : null;
  const foundItemCount = found
    ? found.items.reduce((sum, i) => sum + i.quantity, 0)
    : 0;
  const foundAgeMin = found
    ? Math.max(0, Math.floor((Date.now() - found.createdAt.getTime()) / 60000))
    : 0;
  const foundByName = found?.handoverConfirmedBy
    ? ((
        await prisma.user.findUnique({
          where: { id: found.handoverConfirmedBy },
          select: { name: true },
        })
      )?.name ?? null)
    : null;

  return (
    // Shell aurora (v1.8.0): konsol verifikasi ikut tema terang/gelap
    // pengguna; kartu statistik & hasil memakai kaca aurora.
    <main className="relative mx-auto min-h-screen w-full max-w-md bg-slate-100 p-4 pb-24 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10">
      {/* Header: identitas + konteks hari ini. */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={
            user.role === "KASIR"
              ? "/cashier"
              : user.role === "DEVELOPER"
                ? "/dev"
                : "/owner"
          }
          className="rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-900 dark:hover:text-slate-100"
        >
          ← Kembali
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <ThemeHeaderActions />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <ScanSearch className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
              Konsol Verifikasi
            </p>
            <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              Status struk &amp; antrean penyajian hari ini
            </p>
          </div>
        </div>
      </header>

      {/* Pencarian nomor struk. */}
      <form method="get" className="relative flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nomor struk (TRX-…)"
          autoComplete="off"
          className="w-full rounded-2xl glass-card py-3 pl-10 pr-3 font-mono text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
        />
        <ScanSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <button
          type="submit"
          className="shrink-0 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Cari
        </button>
      </form>

      {/* Statistik hari ini: ikon + angka besar, ring warna sesuai status. */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl glass-card p-2.5 text-center"
          >
            <div
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-xl ${c.chip}`}
            >
              <c.icon className="h-3.5 w-3.5" />
            </div>
            <p className={`mt-1.5 text-xl font-bold leading-none tabular-nums ${c.valueCls}`}>
              {c.value}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {q && found && (
        <section className="mt-4 space-y-3">
          {/* Kartu identitas struk. */}
          <div className="rounded-2xl glass-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                {found.code}
              </p>
              <span className="rounded-full bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                {PAYMENT_LABELS[found.paymentMethod] ?? found.paymentMethod}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {dtFmt.format(found.createdAt)} WIB · {foundItemCount} item
              </p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatRupiah(Math.round(Number(found.total)))}
              </p>
            </div>
          </div>

          {/* Kartu status — aturan keputusan, kartu aksen kiri sesuai
              bobot: merah = masalah, amber = perlu tindakan, hijau =
              selesai, biru = baru. */}
          {found.status === "REFUNDED" ? (
            <div className="rounded-2xl border-l-4 glass-card p-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              Struk ini sudah <b>DIREFUND</b>. Uang dianggap kembali ke
              pembeli dan stok telah dikembalikan.
            </div>
          ) : found.handoverStatus === "SERVED" ? (
            <div className="rounded-2xl border-l-4 border-emerald-500 glass-card p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="h-4 w-4" />
                Tercatat disajikan{" "}
                {dtFmt.format(found.handoverConfirmedAt ?? found.createdAt)} WIB
                {foundByName ? ` oleh ${foundByName}` : ""}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Aturan: klaim penggantian pesanan untuk struk ini DITOLAK —
                penyerahan tercatat permanen (siapa + kapan) dan tidak bisa
                dibatalkan.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700 dark:text-emerald-300 underline"
              >
                Lihat jejak lengkap
              </Link>
            </div>
          ) : found.handoverStatus === "CONFIRMED" ? (
            <div className="rounded-2xl border-l-4 border-emerald-600 glass-card p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="h-4 w-4" />
                Terverifikasi diterima pembeli{" "}
                {dtFmt.format(found.handoverConfirmedAt ?? found.createdAt)} WIB
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Bukti terkuat: tanda tangan pembeli tersimpan permanen.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700 dark:text-emerald-300 underline"
              >
                Lihat tanda tangan &amp; jejak
              </Link>
            </div>
          ) : found.handoverStatus === "DISPUTED" ? (
            <div className="rounded-2xl border-l-4 border-red-500 glass-card p-4 text-sm text-red-700 dark:text-red-300">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4" />
                Sengketa terbuka — pembeli membantah pernah menerima.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-600/80">
                Selesaikan langsung dengan pembeli; seluruh jejak kejadian
                tersedia di halaman detail.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-red-700 dark:text-red-300 underline"
              >
                Buka detail penyelesaian
              </Link>
            </div>
          ) : found.handoverStatus === "COURIER_CLAIMED" ? (
            <div className="rounded-2xl border-l-4 border-amber-500 glass-card p-4 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-bold">
                Ditandai sudah diantar (klaim staf, tanpa tanda tangan).
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700/80">
                Bukti lemah — bila pembeli ada di tempat, minta ia tanda tangan
                di halaman detail untuk bukti kuat.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-amber-700 dark:text-amber-300 underline"
              >
                Buka detail
              </Link>
            </div>
          ) : foundAgeMin >= 30 ? (
            <div className="space-y-3 rounded-2xl border-l-4 border-red-500 glass-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
                <Clock3 className="h-4 w-4" />
                Sudah {foundAgeMin} menit dan belum disajikan!
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Sajikan pesanan sekarang, atau tutup dengan alasan (mis. diambil
                sendiri oleh pembeli) — alasan tercatat permanen untuk evaluasi
                pola staf.
              </p>
              <ServeButton transactionId={found.id} withNote />
              <Link
                href={`/owner/verify/${found.id}`}
                className="block text-center text-xs font-bold text-red-600 dark:text-red-400 underline"
              >
                Buka detail
              </Link>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border-l-4 border-blue-500 glass-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-300">
                <Clock3 className="h-4 w-4" />
                Belum disajikan ({foundAgeMin} mnt lalu) — sajikan sekarang.
              </p>
              <ServeButton transactionId={found.id} />
              <Link
                href={`/owner/verify/${found.id}`}
                className="block text-center text-xs font-bold text-blue-700 dark:text-blue-300 underline"
              >
                Buka detail
              </Link>
            </div>
          )}
        </section>
      )}

      {q && !found && (
        <div className="mt-3 rounded-2xl glass-card p-5 text-center text-sm text-slate-400 dark:text-slate-500">
          Struk <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{q}</span>{" "}
          tidak ditemukan. Periksa lagi nomornya — formatnya TRX-tanggal-nomor,
          tercetak di bagian atas struk.
        </div>
      )}

      <ServeQueuePanel rows={queueRows} />
      </div>
    </main>
  );
}
'@
Save-UmkmFile $p $c

# ---- [29/48] frontend/app/page.tsx ----------------------------------------
$p = @'
app/page.tsx
'@
$c = @'
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  LogOut,
  Store,
  TriangleAlert,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { LiveClock } from "@/components/live-clock";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";

export const instant = false;

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Developer punya konsol sendiri lintas outlet - halaman peluncur ini berbasis satu outlet dan tidak relevan untuk super-user
  if (session.user.role === "DEVELOPER") redirect("/dev");

  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({ where: { id: session.user.outletId } })
    : await prisma.outlet.findFirst();

  const isOwner = session.user.role === "OWNER";
  const displayName = session.user.name ?? "Pengguna";

  // Owner briefing: a tiny live snapshot so the launcher page already
  // answers "how is the warung doing today" without opening reports.
  // Angka kini dari backend-go (satu sumber data) — kalau backend tidak
  // merespons, kartu statistik dilewati, halaman tetap terbuka.
  let stats: {
    omzetToday: number;
    trxToday: number;
    itemsToday: number;
    lowStock: number;
  } | null = null;

  if (isOwner && session.user.goToken) {
    const dash = await goFetch<{
      today: { revenue: number; transactions: number; items_sold: number };
      low_stock: unknown[];
    }>(session.user.goToken, "/reports/dashboard");
    // Bentuk respons diverifikasi SEBELUM dibaca: backend lama (pra
    // v1.1.0) menjawab /reports/dashboard dengan kolom rata
    // (today_revenue, low_stock_products) tanpa objek "today" — kartu
    // statistik cukup dilewati, halaman peluncur tetap terbuka. Setelah
    // proses lama dimatikan dan backend-go v1.1.0+ yang menjawab, kartu
    // statistik muncul lagi sendirinya.
    if (dash.ok && dash.data.today && Array.isArray(dash.data.low_stock)) {
      stats = {
        omzetToday: dash.data.today.revenue,
        trxToday: dash.data.today.transactions,
        itemsToday: dash.data.today.items_sold,
        lowStock: dash.data.low_stock.length,
      };
    }
  }

  const menu = [
    {
      href: "/cashier",
      title: "Kasir",
      desc: "Buka transaksi penjualan",
      icon: Calculator,
      iconClass: "bg-blue-600 text-white",
    },
    ...(isOwner
      ? [
          {
            href: "/owner",
            title: "Laporan Owner",
            desc: "Omzet, peramalan, dan restok",
            icon: BarChart3,
            iconClass: "bg-indigo-600 text-white",
          },
          {
            href: "/owner/products",
            title: "Kelola Produk",
            desc: "Produk, harga, stok, dan foto",
            icon: Boxes,
            iconClass: "bg-violet-600 text-white",
          },
        ]
      : []),
  ];

  const statCards = stats
    ? [
        { label: "Omzet Hari Ini", value: formatRupiah(stats.omzetToday) },
        { label: "Transaksi", value: String(stats.trxToday) },
        { label: "Item Terjual", value: String(stats.itemsToday) },
        {
          label: "Stok Menipis",
          value: String(stats.lowStock),
          warn: stats.lowStock > 0,
        },
      ]
    : [];

  return (
    // Shell aurora (v1.8.0): beranda/peluncur peran ikut tema pengguna —
    // kartu pintasan memakai kaca, toggle tema & /settings ada di header.
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-5 sm:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/25">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
                UMKM OS
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {outlet?.name ?? "Warung"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isOwner
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              }`}
            >
              {isOwner ? "PEMILIK" : "KASIR"}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </div>
        </header>

        <section className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white sm:p-9">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl"
          />
          <div className="relative">
            <LiveClock />
            <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">
              Selamat datang, {displayName}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-100 sm:text-base">
              Kasir, laporan, stok, dan foto produk warung semuanya siap
              dipakai dalam satu tempat.
            </p>
          </div>
        </section>

        {statCards.length > 0 && (
          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl glass-card p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p
                  className={`mt-1.5 truncate text-lg font-bold tabular-nums sm:text-xl ${
                    card.warn ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {card.value}
                </p>
                {card.warn && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="h-3 w-3" />
                    perlu restok
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        <nav className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-4 rounded-2xl glass-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.iconClass}`}
              >
                <item.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </Link>
          ))}
        </nav>

        {!isOwner && (
          <p className="mt-3 rounded-2xl glass-card px-4 py-3 text-center text-xs text-slate-400 dark:text-slate-500">
            Laporan dan pengaturan warung hanya bisa dibuka oleh pemilik.
          </p>
        )}

        <p className="mt-auto pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          UMKM OS · demo warung digital — kasir, laporan, dan peramalan
        </p>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [30/48] frontend/app/settings/appearance-client.tsx ----------------------------------------
$p = @'
app/settings/appearance-client.tsx
'@
$c = @'
"use client";

// Pemilih tema (v1.3.0): System (default) / Gelap / Terang.
// Kartu berisi PRATINJAU tampilan yang sebenarnya — pengguna melihat
// bedanya sebelum mengeklik. Terapkan seketika lewat next-themes.
// v1.6.0: tombol "Kembali" sadar peran (prop dari server component
// induk) — kasir pulang ke POS, owner ke konsol, developer ke /dev.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  LuArrowLeft,
  LuCheck,
  LuMonitor,
  LuMoon,
  LuSparkles,
  LuSun,
} from "react-icons/lu";
import { AuroraBackground } from "@/components/aurora-background";

type ThemeOption = "system" | "dark" | "light";

const OPTIONS: {
  value: ThemeOption;
  label: string;
  desc: string;
  icon: typeof LuMonitor;
}[] = [
  {
    value: "system",
    label: "Gunakan Pengaturan Sistem",
    desc: "Otomatis mengikuti tema perangkat — berganti sendiri saat perangkat berganti.",
    icon: LuMonitor,
  },
  {
    value: "dark",
    label: "Mode Gelap",
    desc: "Cocok untuk jadwal malam dan ruangan remang — hemat mata & baterai.",
    icon: LuMoon,
  },
  {
    value: "light",
    label: "Mode Terang",
    desc: "Klasik dan kontras tinggi untuk siang hari di terik warung.",
    icon: LuSun,
  },
];

// Mockup jendela mini — masing-masing kartu memperlihatkan tema pilihannya.
function ThemePreview({ mode }: { mode: ThemeOption }) {
  const dark = mode === "dark";
  const light = mode === "light";
  return (
    <div
      className={`relative h-24 w-full overflow-hidden rounded-xl border ${
        dark ? "border-slate-800" : "border-slate-300"
      }`}
    >
      {/* mode "system" = dua belahan terang/gelap */}
      <div className={`absolute inset-0 ${dark ? "bg-slate-950" : "bg-slate-50"}`} />
      {mode === "system" && (
        <div className="absolute inset-y-0 right-1/2 w-1/2 bg-slate-950" />
      )}
      {/* sidebar mini */}
      <div
        className={`absolute top-2 bottom-2 left-2 w-6 rounded-md ${
          dark ? "bg-slate-900" : "bg-white shadow-sm"
        }`}
      />
      {/* bar judul mini */}
      <div
        className={`absolute top-2 left-9 h-2 w-10 rounded-full ${
          dark ? "bg-slate-800" : "bg-slate-200"
        }`}
      />
      <div
        className={`absolute top-2 left-[5.25rem] h-2 w-6 rounded-full ${
          dark ? "bg-slate-800" : "bg-blue-200"
        }`}
      />
      {/* kartu konten mini */}
      <div className="absolute right-2 bottom-2 left-9 grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-8 rounded-md ${
              dark
                ? "bg-slate-900"
                : light
                  ? "bg-white shadow-sm"
                  : i < 2
                    ? "bg-white shadow-sm"
                    : "bg-slate-900"
            }`}
          />
        ))}
      </div>
      {/* titik aksen brand */}
      <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
    </div>
  );
}

export function AppearanceSettings({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted
    ? (OPTIONS.find((o) => o.value === theme)?.value ?? "system")
    : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-300">
            <LuSparkles className="h-3.5 w-3.5" />
            Pengaturan — akan terus berkembang
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Tampilan
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Pilih tema aplikasi. Defaultnya{" "}
            <b className="text-slate-700 dark:text-slate-200">
              Pengaturan Sistem
            </b>{" "}
            — aplikasi mengikuti tema perangkatmu secara otomatis.
          </p>
        </motion.div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {OPTIONS.map((opt, i) => {
            const active = current === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                aria-pressed={active}
                className={`glass-card relative rounded-2xl p-4 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active ? "ring-2 ring-blue-500" : "hover:shadow-lg"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="theme-check"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md"
                  >
                    <LuCheck className="h-3.5 w-3.5" />
                  </motion.span>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                      active
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {opt.label}
                  </p>
                </div>
                <ThemePreview mode={opt.value} />
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {opt.desc}
                </p>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-8 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-[11px] leading-relaxed text-slate-500 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
          Pilihan tersimpan di mesin ini (localStorage) dengan kunci khusus
          AKUNMU — tema mengikuti orang, bukan browser: dua orang yang
          berbagi satu komputer tetap punya tema masing-masing, dan tema
          terakhir tersimpan juga sebagai tema halaman masuk. Halaman login,
          pengaturan, konsol Kelola Akun, dan seluruh area developer sudah
          mendukung penuh dua tema — area owner & kasir menyusul didandani
          bertahap.
        </p>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [31/48] frontend/app/settings/page.tsx ----------------------------------------
$p = @'
app/settings/page.tsx
'@
$c = @'
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { settingsBackHref, settingsBackLabel } from "@/lib/settings-nav";
import { AppearanceSettings } from "./appearance-client";

// Pengaturan Tampilan (v1.3.0). v1.6.0: tombol "Kembali" kini sadar
// peran — pengguna yang sudah login pulang ke areanya (kasir/owner/dev),
// pengunjung anonim ke /login. Section lain (bahasa, notifikasi, dsb.)
// menyusul bertahap sesuai ide berikutnya.
export const metadata: Metadata = {
  title: "Pengaturan Tampilan - UMKM OS",
  description: "Pilih tema gelap, terang, atau ikuti pengaturan perangkat.",
};

// auth() membaca cookie sesi — halaman ini tidak bisa diprarender statis
// (konvensi yang sama dengan halaman dev: rute blocking dinamis).
export const instant = false;

export default async function SettingsPage() {
  // auth() ringan untuk pengunjung anonim (tanpa sesi tidak menyentuh
  // database); perannya hanya menentukan tujuan tombol "Kembali".
  const session = await auth();
  const role = session?.user?.role ?? null;

  return (
    <AppearanceSettings
      backHref={settingsBackHref(role)}
      backLabel={settingsBackLabel(role)}
    />
  );
}
'@
Save-UmkmFile $p $c

# ---- [32/48] frontend/app/verify/[code]/client.tsx ----------------------------------------
$p = @'
app/verify/[code]/client.tsx
'@
$c = @'
"use client";
// Form konfirmasi & pembantahan dari sisi pembeli (HP pembeli).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/handover/signature-pad";
import { confirmByCode, disputeByCode } from "./actions";

export function BuyerConfirmForm({ code }: { code: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!signature) return setError("Tanda tangan belum digambar.");
    if (!agreed) return setError("Centang pernyataannya dulu.");
    startTransition(async () => {
      const res = await confirmByCode({
        code,
        buyerName,
        signatureData: signature,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <SignaturePad onChange={setSignature} />
      <input
        value={buyerName}
        onChange={(e) => setBuyerName(e.target.value)}
        placeholder="Nama kamu (opsional)"
        maxLength={40}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
      />
      <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Saya menyatakan pesanan di atas sudah saya terima dengan lengkap dan
          benar.
        </span>
      </label>
      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Konfirmasi Penerimaan"}
      </button>
    </div>
  );
}

export function BuyerDisputeButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await disputeByCode({ code, reason });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400"
        >
          Saya TIDAK menerima pesanan ini
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ceritakan singkat (opsional): barang belum sampai, kurang, rusak..."
            rows={3}
            maxLength={200}
            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-400"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Mengirim..." : "Kirim Pembantahan"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [33/48] frontend/app/verify/[code]/page.tsx ----------------------------------------
$p = @'
app/verify/[code]/page.tsx
'@
$c = @'
// HALAMAN PUBLIK (tanpa login) — dibuka pembeli dari QR / link di struk.
// Sumber data: GET /api/v1/public/receipt/{code} (backend-go v1.3.0).
// Dua mode, diputuskan oleh backend:
// 1. MODE "readonly" (v3, dine-in): /verify/TRX-… — nomor struk hanyalah
//    ALAMAT. Halaman READ-ONLY: pembeli hanya melihat status
//    penyajian/verifikasi. Tidak ada tombol konfirmasi/bantahan —
//    pembeli tidak memegang kunci apa pun; sengketa diselesaikan
//    langsung di warung dengan jejak handover_events.
// 2. MODE "interactive" (v2 / struk takeaway): /verify/KODE8 — kode
//    klaim 8 karakter adalah kunci interaktif (tanda tangan / bantah),
//    dicetak di struk sebagai "Kode klaim".
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { goPublic } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { AuroraBackground } from "@/components/aurora-background";
import { BuyerConfirmForm, BuyerDisputeButton } from "./client";

export const instant = false;

const dtFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

// Bentuk respons GET /public/receipt/{code} (handover.go PublicReceipt).
type PublicReceipt = {
  mode: "readonly" | "interactive";
  receipt_no: string;
  claim_code: string | null;
  outlet_name: string;
  created_at: string;
  items: {
    product_name: string;
    qty: number;
    price: number;
    subtotal: number;
  }[];
  total: number;
  payment_method: string;
  status: string;
  handover_status: string | null;
  handover_confirmed_at: string | null;
  confirmed_by_name: string | null;
  confirm_method: string | null;
  buyer_name: string | null;
  signature_data: string | null;
};

export default async function PublicVerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).trim().toUpperCase();

  // cacheComponents: menyentuh headers() menandai halaman ini dinamis
  // (render per-request) — status harus selalu segar di HP pembeli,
  // bukan hasil cache basi.
  await headers();

  const res = await goPublic<PublicReceipt>(
    `/public/receipt/${encodeURIComponent(code)}`,
  );

  if (!res.ok) {
    // status 0 = backend-go tidak terjangkau — berbeda dari kode salah.
    return (
      <Shell>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {res.status === 0 ? (
            "Sistem verifikasi sedang tidak bisa dijangkau. Muat ulang halaman ini beberapa saat lagi."
          ) : (
            <>
              Kode <span className="font-mono font-bold">{code || "—"}</span>{" "}
              tidak dikenali. Pastikan sama persis dengan yang di struk / yang
              dibacakan kurir.
            </>
          )}
        </p>
      </Shell>
    );
  }

  const tx = res.data;

  // ============ MODE "readonly": read-only status viewer ============
  if (tx.mode !== "interactive") {
    const status = tx.handover_status;
    return (
      <Shell>
        <header className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {tx.outlet_name}
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            Status Pesanan
          </h1>
          <p className="font-mono text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {tx.receipt_no}
          </p>
        </header>

        <section className="mt-4 rounded-2xl glass-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dtFmt.format(new Date(tx.created_at))} WIB
          </p>
          <ul className="mt-2 space-y-1">
            {tx.items.map((it, i) => (
              <li
                key={i}
                className="flex justify-between text-sm text-slate-700 dark:text-slate-300"
              >
                <span>
                  {it.product_name} × {it.qty}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatRupiah(it.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatRupiah(tx.total)}
            </span>
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
            Dibayar via {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
          </p>
        </section>

        {tx.status === "REFUNDED" ? (
          <section className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-900 p-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm">
            Transaksi ini sudah direfund oleh warung.
          </section>
        ) : status === "SERVED" ? (
          <section className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center shadow-sm">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✔ Pesanan sudah disajikan
            </p>
            <p className="mt-1 text-xs text-emerald-700/80">
              {dtFmt.format(
                new Date(tx.handover_confirmed_at ?? tx.created_at),
              )}{" "}
              WIB · dicatat oleh staf saat penyerahan
            </p>
          </section>
        ) : status === "CONFIRMED" ? (
          <section className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center shadow-sm">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✔ Pesanan sudah diterima &amp; terverifikasi
            </p>
            <p className="mt-1 text-xs text-emerald-700/80">
              {dtFmt.format(
                new Date(tx.handover_confirmed_at ?? tx.created_at),
              )}{" "}
              WIB
            </p>
            {tx.signature_data && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tx.signature_data}
                alt="Tanda tangan penerima"
                className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white dark:bg-slate-900"
              />
            )}
          </section>
        ) : status === "DISPUTED" ? (
          <section className="mt-4 rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 text-center text-sm font-medium text-red-700 dark:text-red-300 shadow-sm">
            Sengketa sedang ditangani warung. Hubungi kasir dengan membawa struk
            ini.
          </section>
        ) : status === "COURIER_CLAIMED" ? (
          <section className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-center text-sm font-medium text-amber-800 dark:text-amber-200 shadow-sm">
            Ditandai sudah diantar oleh kurir.
          </section>
        ) : (
          <section className="mt-4 rounded-2xl glass-card p-4 text-center text-sm text-slate-600 dark:text-slate-400">
            Belum ditandai disajikan. Kalau pesananmu belum tiba, tunjukkan
            struk ini ke kasir.
          </section>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Halaman ini hanya menampilkan status pesanan — bukan alat konfirmasi.
          Ada pertanyaan? Hubungi warung langsung.
        </p>
      </Shell>
    );
  }

  // ============ MODE "interactive": kode klaim = kunci ============
  const status = tx.handover_status;
  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {tx.outlet_name}
        </p>
        <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
          Bukti Serah Terima
        </h1>
        <p className="font-mono text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {code}
        </p>
      </header>

      <section className="mt-4 rounded-2xl glass-card p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {dtFmt.format(new Date(tx.created_at))} WIB
        </p>
        <ul className="mt-2 space-y-1">
          {tx.items.map((it, i) => (
            <li key={i} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
              <span>
                {it.product_name} × {it.qty}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {formatRupiah(it.subtotal)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {formatRupiah(tx.total)}
          </span>
        </div>
        <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
          Dibayar via {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
        </p>
      </section>

      {tx.status === "REFUNDED" ? (
        <section className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-900 p-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm">
          Transaksi ini sudah direfund oleh warung.
        </section>
      ) : status === "CONFIRMED" ? (
        <section className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center shadow-sm">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            ✔ Pesanan sudah diterima
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">
            Terverifikasi{" "}
            {dtFmt.format(new Date(tx.handover_confirmed_at ?? tx.created_at))}{" "}
            WIB ·{" "}
            {tx.confirm_method === "PUBLIC"
              ? "dari HP pembeli"
              : "di layar kurir"}
          </p>
          {tx.signature_data && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tx.signature_data}
              alt="Tanda tangan"
              className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white dark:bg-slate-900"
            />
          )}
          <p className="mt-3 text-[11px] text-emerald-700/70">
            Simpan link ini — dia bukti milik kamu juga.
          </p>
        </section>
      ) : status === "DISPUTED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 text-sm font-medium text-red-700 dark:text-red-300">
            Pembantahan kamu sudah tercatat permanen dan terlihat di daftar
            serah terima toko.
          </div>
          <div className="rounded-2xl glass-card p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ternyata pesanan SUDAH kamu terima? Konfirmasi di sini:
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "SERVED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            ✔ Pesanan sudah disajikan{" "}
            {dtFmt.format(new Date(tx.handover_confirmed_at ?? tx.created_at))}{" "}
            WIB
          </div>
          <div className="rounded-2xl glass-card p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ingin menambah tanda tanganmu sebagai bukti penerimaan?
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "COURIER_CLAIMED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200">
            Kurir sudah menandai pesanan ini <b>selesai diantar</b>. Apakah
            sudah kamu terima dengan lengkap?
          </div>
          <div className="rounded-2xl glass-card p-4">
            <BuyerConfirmForm code={code} />
            <div className="mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <BuyerDisputeButton code={code} />
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl glass-card p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Sudah menerima pesanan ini? Tanda tangan di bawah sebagai bukti:
          </p>
          <BuyerConfirmForm code={code} />
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  // Shell aurora (v1.8.0): halaman publik pembeli ikut tema terakhir
  // mesin pembeli (cermin anonim) — kartu memakai kaca.
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
'@
Save-UmkmFile $p $c

# ---- [34/48] frontend/components/forecast/forecast-chart.tsx ----------------------------------------
$p = @'
components/forecast/forecast-chart.tsx
'@
$c = @'
// Pure SVG chart: revenue history (solid blue line + soft area) blending
// into the forecast (dashed emerald line inside a low-high band).
// Hand-rolled on purpose — zero chart dependencies, scales with the
// card width, and still looks fine in print/screenshots.
//
// Color language mirrors the owner dashboard: blue = actual data
// (same family as the "Penjualan 7 Hari" bars), emerald = prediction.
// v1.8.0: garis kisi, label sumbu, dan divider kini memakai kelas
// Tailwind stroke-/fill- sadar tema — heks hardcoded hanya untuk warna
// brand (biru/hijau) yang memang sama di kedua tema. Axis labels use compact units (rb / jt) because full formatRupiah
// values cannot fit; every money value shown in the surrounding card
// text still goes through formatRupiah (site-wide money contract).

import type { DailyRevenue, ForecastPoint } from "@/lib/forecast";

const W = 720;
const H = 230;
const PAD = { top: 16, right: 14, bottom: 30, left: 62 };

// Same compact formatter as app/owner/page.tsx — keep them identical
// so both charts label money the same way.
function compactRp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default function ForecastChart({
  history,
  forecast,
}: {
  history: DailyRevenue[];
  forecast: ForecastPoint[];
}) {
  const hLen = history.length;
  const n = hLen + forecast.length;
  if (hLen === 0 || forecast.length === 0 || n < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMax =
    Math.max(
      1,
      ...history.map((d) => d.revenue),
      ...forecast.map((f) => f.high),
    ) * 1.1;

  const x = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const baseline = y(0);

  const historyPath = history
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.revenue)}`)
    .join(" ");
  const areaPath = `${historyPath} L${x(hLen - 1)},${baseline} L${x(0)},${baseline} Z`;

  const lastRevenue = history[hLen - 1].revenue;
  const forecastPath = [
    `M${x(hLen - 1)},${y(lastRevenue)}`,
    ...forecast.map((f, j) => `L${x(hLen + j)},${y(f.point)}`),
  ].join(" ");

  // Uncertainty band: forward along the highs, back along the lows.
  const bandPolygon = [
    `${x(hLen - 1)},${y(lastRevenue)}`,
    ...forecast.map((f, j) => `${x(hLen + j)},${y(f.high)}`),
    ...forecast
      .map((f, j) => ({ f, j }))
      .reverse()
      .map(({ f, j }) => `${x(hLen + j)},${y(f.low)}`),
  ].join(" ");

  const gridValues = [yMax, (yMax * 2) / 3, yMax / 3];
  const labelIndices = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i % 7 === 0 || i === n - 1,
  );
  const dividerX = (x(hLen - 1) + x(hLen)) / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Grafik pendapatan harian dan ramalan 7 hari ke depan"
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="historyArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridValues.map((value, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(value)}
            y2={y(value)}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 8}
            y={y(value) + 3}
            textAnchor="end"
            fontSize="10"
            className="fill-slate-400 dark:fill-slate-500"
          >
            {compactRp(value)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#historyArea)" />
      <path
        d={historyPath}
        fill="none"
        stroke="#2563eb"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon points={bandPolygon} fill="#10b981" fillOpacity="0.12" />
      <path
        d={forecastPath}
        fill="none"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />

      <line
        x1={dividerX}
        x2={dividerX}
        y1={PAD.top}
        y2={baseline}
        className="stroke-slate-300 dark:stroke-slate-700"
        strokeDasharray="4 4"
        strokeWidth="1"
      />
      <text x={dividerX + 6} y={PAD.top + 8} fontSize="10" className="fill-slate-400 dark:fill-slate-500">
        ramalan
      </text>

      {forecast.map((f, j) => (
        <circle
          key={f.date}
          cx={x(hLen + j)}
          cy={y(f.point)}
          r={j === 0 ? 4.5 : 3}
          className={
            j === 0
              ? "fill-emerald-600 stroke-emerald-600"
              : "fill-white stroke-emerald-600 dark:fill-slate-950"
          }
          strokeWidth="2"
        />
      ))}

      {labelIndices.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          className="fill-slate-400 dark:fill-slate-500"
        >
          {shortDate(i < hLen ? history[i].date : forecast[i - hLen].date)}
        </text>
      ))}
    </svg>
  );
}
'@
Save-UmkmFile $p $c

# ---- [35/48] frontend/components/forecast/forecast-section.tsx ----------------------------------------
$p = @'
components/forecast/forecast-section.tsx
'@
$c = @'
// "Ramalan Pendapatan" dashboard section (S5).
//
// One async server component that fetches BOTH ML endpoints in
// parallel, then renders: the revenue card (period total, live-today
// chip, SVG chart, per-day breakdown) and the ML restock suggestions
// card. When the FastAPI service is unreachable it degrades into a
// hint card instead of breaking the whole dashboard.
//
// Styling mirrors app/owner/page.tsx exactly — rounded-2xl bg-white
// p-5 shadow-sm cards, small bold headings, decorative icon top-right
// — so the widget reads as a native part of the dashboard. Color
// language: blue = actual (history), emerald = prediction (forecast).
//
// Money contract: every Rupiah amount rendered as text goes through
// formatRupiah() — the single site-wide formatter. Only chart axis
// labels and the tiny per-cell ranges use compact units (rb/jt),
// because full values do not fit; hovering a cell (title attribute)
// still reveals the full formatRupiah range.

import type {
  ForecastPoint,
  ProductForecast,
  ProductsForecastResponse,
  RevenueForecastResponse,
} from "@/lib/forecast";
import { getProductsForecast, getRevenueForecast } from "@/lib/forecast";
import { formatRupiah } from "@/lib/format";
import ForecastChart from "./forecast-chart";

const WEEKDAY_ID: Record<string, string> = {
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
  Sunday: "Minggu",
};

// Same compact formatter as app/owner/page.tsx.
function compactRp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
}

function sumTotals(forecast: ForecastPoint[]) {
  const sum = (pick: (f: ForecastPoint) => number) =>
    Math.round(forecast.reduce((acc, f) => acc + pick(f), 0));
  return {
    point: sum((f) => f.point),
    low: sum((f) => f.low),
    high: sum((f) => f.high),
  };
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 7V4M15 7V4" />
      <path d="M7 7h10v4a5 5 0 0 1-10 0V7z" />
      <path d="M12 16v4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BackendDown() {
  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Ramalan Pendapatan
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Layanan ML (FastAPI) belum berjalan
          </p>
        </div>
        <PlugIcon className="h-5 w-5 shrink-0 text-slate-300" />
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Widget ramalan akan muncul otomatis setelah backend dinyalakan.
        </p>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          Jalankan dari folder{" "}
          <code className="rounded bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 text-[11px]">
            backend
          </code>
          :{" "}
          <code className="rounded bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 text-[11px]">
            python run.py
          </code>
        </p>
      </div>
    </div>
  );
}

function RevenueCard({ data }: { data: RevenueForecastResponse }) {
  // The API history includes today as a LIVE partial row while the
  // forecast also starts today — drop the duplicate from the chart
  // input so the x-axis stays continuous, but keep it as a chip.
  const duplicatedToday =
    data.forecast.length > 0 &&
    data.history.length > 0 &&
    data.history[data.history.length - 1].date === data.forecast[0].date;
  const chartHistory = duplicatedToday
    ? data.history.slice(0, -1)
    : data.history;
  const today = duplicatedToday ? data.history[data.history.length - 1] : null;
  const totals = sumTotals(data.forecast);

  if (data.forecast.length === 0) {
    return (
      <div className="rounded-2xl glass-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ramalan Pendapatan
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {data.outlet_name} · {data.horizon_days} hari ke depan
            </p>
          </div>
          <SparkIcon className="h-5 w-5 shrink-0 text-slate-300" />
        </div>
        <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          Belum ada data penjualan untuk diramal.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Ramalan Pendapatan
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {data.outlet_name} · {data.horizon_days} hari ke depan
          </p>
        </div>
        <SparkIcon className="h-5 w-5 shrink-0 text-slate-300" />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatRupiah(totals.point)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Rentang konservatif{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatRupiah(totals.low)}
            </span>
            {" – "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatRupiah(totals.high)}
            </span>
          </p>
        </div>
        {today && today.transactions > 0 && (
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            Hari ini {formatRupiah(Math.round(today.revenue))} ·{" "}
            {today.transactions} trx
          </span>
        )}
      </div>

      <div className="mt-3">
        <ForecastChart history={chartHistory} forecast={data.forecast} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {data.forecast.map((f, i) => (
          <div
            key={f.date}
            title={`${i === 0 ? "Hari ini" : (WEEKDAY_ID[f.weekday] ?? f.weekday)}: ${formatRupiah(Math.round(f.low))} – ${formatRupiah(Math.round(f.high))}`}
            className={`rounded-lg border px-2 py-2 text-center ${
              i === 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 " : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {i === 0 ? "Hari ini" : (WEEKDAY_ID[f.weekday] ?? f.weekday)}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatRupiah(Math.round(f.point))}
            </p>
            <p className="truncate text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {compactRp(f.low)}–{compactRp(f.high)}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">{data.method}</p>
    </div>
  );
}

function RestockRow({ p }: { p: ProductForecast }) {
  const needed = Math.max(1, Math.ceil(p.forecast_7d_point));
  const coverage = Math.min(100, (p.current_stock / needed) * 100);
  const safe = p.restock_suggestion <= 0;
  const critical = p.current_stock <= p.min_stock;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {p.name}
          <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">
            / {p.unit}
          </span>
        </p>
        {safe ? (
          <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            Stok aman
          </span>
        ) : (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              critical ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 " : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 "
            }`}
          >
            Belanja +{p.restock_suggestion} {p.unit}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
          <div
            className={`h-full rounded-full ${safe ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${coverage}%` }}
          />
        </div>
        <p className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
          stok{" "}
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            {p.current_stock}
          </span>{" "}
          · perkiraan{" "}
          <span className="font-semibold text-slate-600 dark:text-slate-400">{needed}</span>
        </p>
      </div>
    </div>
  );
}

function RestockCard({ data }: { data: ProductsForecastResponse }) {
  const sorted = [...data.products].sort(
    (a, b) => b.restock_suggestion - a.restock_suggestion,
  );
  const anyRestock = sorted.some((p) => p.restock_suggestion > 0);

  return (
    <div className="flex h-full flex-col rounded-2xl glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Saran Restock (ML)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Perkiraan permintaan 7 hari ke depan
          </p>
        </div>
        {anyRestock ? (
          <span className="shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            {sorted.filter((p) => p.restock_suggestion > 0).length} produk
          </span>
        ) : (
          <PackageIcon className="h-5 w-5 shrink-0 text-slate-300" />
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          Belum ada data penjualan produk untuk dianalisis.
        </div>
      ) : anyRestock ? (
        <div className="mt-2 divide-y divide-slate-100">
          {sorted.map((p) => (
            <RestockRow key={p.product_id} p={p} />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3.5">
          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Semua stok cukup untuk 7 hari ke depan.
          </p>
        </div>
      )}
    </div>
  );
}

export default async function ForecastSection() {
  const [revenue, products] = await Promise.all([
    getRevenueForecast(30, 7),
    getProductsForecast(5),
  ]);

  if (!revenue && !products) {
    return <BackendDown />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {revenue ? <RevenueCard data={revenue} /> : <BackendDown />}
      </div>
      <div className="lg:col-span-1">
        {products ? <RestockCard data={products} /> : <BackendDown />}
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [36/48] frontend/components/handover/signature-pad.tsx ----------------------------------------
$p = @'
components/handover/signature-pad.tsx
'@
$c = @'
"use client";
// Papan tanda tangan — Pointer Events (mouse + jari + stylus).
// touch-action:none supaya halaman gak ikut scroll saat pembeli
// menggambar di HP.
import { useEffect, useRef, useState } from "react";

export default function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    setEmpty(false);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function up() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    drawingRef.current = false;
    setEmpty(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    onChange(null);
  }

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        style={{ touchAction: "none" }}
        // Kanvas tanda tangan = KERTAS bukti (PNG berlatar putih, tinta
        // gelap) — sengaja TETAP PUTIH di kedua tema (v1.8.0), seperti
        // kertas struk; garis batasnya saja yang mengikuti tema.
        className="h-40 w-full cursor-crosshair rounded-lg border-2 border-dashed border-slate-300 bg-white dark:border-slate-700"
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {empty
            ? "Tanda tangan pembeli di kotak atas"
            : "Sudah ada tanda tangan"}
        </p>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-red-600 dark:text-red-400 underline"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [37/48] frontend/components/image-editor-modal.tsx ----------------------------------------
$p = @'
components/image-editor-modal.tsx
'@
$c = @'
"use client";

import { useEffect, useRef, useState } from "react";
import {
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";

// Zero-dependency photo editor built on <canvas>:
//   - crop   : draggable box with four corner handles
//   - rotate : 90-degree steps, left or right
//   - flip   : horizontal / vertical (screen-space, WYSIWYG)
//   - zoom   : slider + pan by dragging outside the crop box
// The transform is baked into an offscreen canvas at natural resolution;
// the preview renders that canvas, and the export copies the crop region
// straight from it — preview and result can never disagree.
//
// Shape notes (lint-clean React 19 patterns):
//   - the baked canvas lives in a ref (only touched in callbacks),
//     while its dimensions are state so render stays pure;
//   - baking happens inside event handlers and the image onload
//     callback, never inside effect bodies;
//   - pan/crop default to centered values derived at render until the
//     user actually drags something (null = "use defaults").

type CropRect = { x: number; y: number; w: number; h: number };
type Pan = { x: number; y: number };
type BakedSize = { w: number; h: number };

type Drag =
  | { mode: "pan"; startX: number; startY: number; pan: Pan }
  | { mode: "move"; startX: number; startY: number; crop: CropRect }
  | {
      mode: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      crop: CropRect;
    };

const MIN_CROP_PX = 32;
const MAX_EXPORT_SIDE = 1280;
const EXPORT_QUALITY = 0.85;
const MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function ImageEditorModal({
  file,
  productName,
  onUse,
  onClose,
}: {
  file: File;
  productName: string;
  onUse: (edited: File) => void;
  onClose: () => void;
}) {
  const [loadError, setLoadError] = useState(false);
  const [natural, setNatural] = useState<BakedSize | null>(null);
  const [bakedSize, setBakedSize] = useState<BakedSize | null>(null);
  const [bakedVersion, setBakedVersion] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);
  // null = derive centered defaults until the user interacts.
  const [pan, setPan] = useState<Pan | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [exporting, setExporting] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const bakedRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);

  // Bake the given transform into the offscreen canvas at natural
  // resolution. Order matters: translate -> scale -> rotate means the
  // flip is applied to the ROTATED frame, so each button does exactly
  // what it looks like on screen. Called from event handlers and the
  // image onload callback only.
  const bake = (rot: number, fh: boolean, fv: boolean) => {
    const img = imgRef.current;
    if (!img) return;
    const swap = rot === 90 || rot === 270;
    const W = swap ? img.naturalHeight : img.naturalWidth;
    const H = swap ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(W / 2, H / 2);
    ctx.scale(fh ? -1 : 1, fv ? -1 : 1);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    bakedRef.current = canvas;
    setBakedSize({ w: W, h: H });
    setBakedVersion((v) => v + 1);
  };

  // Decode the picked file once; baking happens right here in the
  // async callback (allowed: not a synchronous effect setState).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      bake(0, false, false);
    };
    img.onerror = () => setLoadError(true);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the viewport so the preview can be fitted (DOM measurement
  // in an effect is the sanctioned pattern).
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current;
      if (el) setBox({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Esc closes the editor (the manager ignores Esc while it is open).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Derived view geometry (pure): fitted scale, effective pan/crop with
  // centered defaults, and display sizes.
  const fit =
    bakedSize && box.w > 0
      ? Math.min(box.w / bakedSize.w, box.h / bakedSize.h)
      : 0;
  const dispScale = fit * zoom;
  const dispW = bakedSize ? bakedSize.w * dispScale : 0;
  const dispH = bakedSize ? bakedSize.h * dispScale : 0;
  const basePan: Pan = bakedSize
    ? {
        x: (box.w - bakedSize.w * fit) / 2,
        y: (box.h - bakedSize.h * fit) / 2,
      }
    : { x: 0, y: 0 };
  const effPan = pan ?? basePan;
  const effCrop: CropRect | null = bakedSize
    ? (crop ?? {
        x: bakedSize.w * 0.1,
        y: bakedSize.h * 0.1,
        w: bakedSize.w * 0.8,
        h: bakedSize.h * 0.8,
      })
    : null;

  const ready = natural !== null && bakedSize !== null;

  // Keep the image reachable: centered when smaller than the viewport,
  // otherwise at least a sliver stays visible on every side.
  const clampPan = (p: Pan, scale: number): Pan => {
    if (!bakedSize) return p;
    const dw = bakedSize.w * scale;
    const dh = bakedSize.h * scale;
    const x = dw <= box.w ? (box.w - dw) / 2 : clamp(p.x, box.w - dw, 0);
    const y = dh <= box.h ? (box.h - dh) / 2 : clamp(p.y, box.h - dh, 0);
    return { x, y };
  };

  // Zoom around the viewport center so the point under the crosshair
  // stays put while the slider moves.
  const applyZoom = (nextZoom: number) => {
    if (!bakedSize || fit <= 0) {
      setZoom(nextZoom);
      return;
    }
    const oldScale = fit * zoom;
    const newScale = fit * nextZoom;
    const cx = box.w / 2;
    const cy = box.h / 2;
    setPan((prev) => {
      const p = prev ?? basePan;
      return clampPan(
        {
          x: cx - (cx - p.x) * (newScale / oldScale),
          y: cy - (cy - p.y) * (newScale / oldScale),
        },
        newScale,
      );
    });
    setZoom(nextZoom);
  };

  const rotate = (step: 90 | -90) => {
    const next = (rotation + step + 360) % 360;
    bake(next, flipH, flipV);
    setRotation(next);
    // Dims swapped: fall back to centered pan and a fresh 80% crop.
    setPan(null);
    setCrop(null);
  };

  const toggleFlip = (axis: "h" | "v") => {
    const nextH = axis === "h" ? !flipH : flipH;
    const nextV = axis === "v" ? !flipV : flipV;
    bake(rotation, nextH, nextV);
    setFlipH(nextH);
    setFlipV(nextV);
  };

  const resetAll = () => {
    bake(0, false, false);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setPan(null);
    setCrop(null);
  };

  // Pointer plumbing: one pair of window listeners per render (fresh
  // closures see the latest geometry). touch-none on the viewport keeps
  // touch drags from scrolling the page.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !bakedSize || dispScale <= 0) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (drag.mode === "pan") {
        setPan(clampPan({ x: drag.pan.x + dx, y: drag.pan.y + dy }, dispScale));
        return;
      }
      if (drag.mode === "move") {
        setCrop({
          ...drag.crop,
          x: clamp(drag.crop.x + dx / dispScale, 0, bakedSize.w - drag.crop.w),
          y: clamp(drag.crop.y + dy / dispScale, 0, bakedSize.h - drag.crop.h),
        });
        return;
      }
      const minBaked = MIN_CROP_PX / dispScale;
      let { x, y, w, h } = drag.crop;
      if (drag.mode.includes("e")) {
        w = clamp(
          drag.crop.w + dx / dispScale,
          minBaked,
          bakedSize.w - drag.crop.x,
        );
      }
      if (drag.mode.includes("s")) {
        h = clamp(
          drag.crop.h + dy / dispScale,
          minBaked,
          bakedSize.h - drag.crop.y,
        );
      }
      if (drag.mode.includes("w")) {
        const x2 = drag.crop.x + drag.crop.w;
        x = clamp(drag.crop.x + dx / dispScale, 0, x2 - minBaked);
        w = x2 - x;
      }
      if (drag.mode.includes("n")) {
        const y2 = drag.crop.y + drag.crop.h;
        y = clamp(drag.crop.y + dy / dispScale, 0, y2 - minBaked);
        h = y2 - y;
      }
      setCrop({ x, y, w, h });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  // Redraw the fitted preview whenever the bake or the scale changes.
  useEffect(() => {
    const baked = bakedRef.current;
    const cv = previewRef.current;
    if (!baked || !cv || dispScale <= 0 || dispW <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(dispW * dpr);
    cv.height = Math.round(dispH * dpr);
    cv.style.width = `${dispW}px`;
    cv.style.height = `${dispH}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(baked, 0, 0, dispW, dispH);
  }, [bakedVersion, dispScale, dispW, dispH]);

  const usePhoto = async () => {
    const baked = bakedRef.current;
    if (!baked || !effCrop || effCrop.w < 1 || effCrop.h < 1 || exporting) {
      return;
    }
    setExporting(true);
    try {
      const scale = Math.min(
        1,
        MAX_EXPORT_SIDE / Math.max(effCrop.w, effCrop.h),
      );
      const ow = Math.max(1, Math.round(effCrop.w * scale));
      const oh = Math.max(1, Math.round(effCrop.h * scale));
      const out = document.createElement("canvas");
      out.width = ow;
      out.height = oh;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        baked,
        effCrop.x,
        effCrop.y,
        effCrop.w,
        effCrop.h,
        0,
        0,
        ow,
        oh,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/jpeg", EXPORT_QUALITY),
      );
      if (!blob) return;
      onUse(
        new File([blob], `produk-${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
    } finally {
      setExporting(false);
    }
  };

  const TOOL_BTN =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Sunting foto ${productName}`}
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md dark:bg-slate-950/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="glass-card relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-2xl dark:shadow-black/50">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <FlipHorizontal className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Sunting Foto
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{productName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup editor"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loadError ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-8 text-center text-sm font-medium text-red-700 dark:text-red-300">
              Berkas tidak bisa dibaca sebagai gambar. Pilih foto lain.
            </div>
          ) : (
            <>
              <div
                ref={viewportRef}
                className="relative h-72 w-full touch-none overflow-hidden rounded-xl bg-slate-900 sm:h-80"
              >
                {!ready || box.w === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                    <Loader2
                      className="h-6 w-6 animate-spin"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium">Memuat foto…</p>
                  </div>
                ) : (
                  <div
                    className="absolute left-0 top-0"
                    style={{
                      transform: `translate3d(${effPan.x}px, ${effPan.y}px, 0)`,
                    }}
                    onPointerDown={(event) => {
                      if (exporting) return;
                      dragRef.current = {
                        mode: "pan",
                        startX: event.clientX,
                        startY: event.clientY,
                        pan: effPan,
                      };
                    }}
                  >
                    <canvas ref={previewRef} className="block" />
                    {effCrop && (
                      <div
                        className="absolute cursor-move"
                        style={{
                          left: effCrop.x * dispScale,
                          top: effCrop.y * dispScale,
                          width: effCrop.w * dispScale,
                          height: effCrop.h * dispScale,
                          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (exporting) return;
                          dragRef.current = {
                            mode: "move",
                            startX: event.clientX,
                            startY: event.clientY,
                            crop: effCrop,
                          };
                        }}
                      >
                        <span className="absolute -top-6 left-0 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow">
                          {Math.round(effCrop.w)}×{Math.round(effCrop.h)}
                        </span>
                        {(
                          [
                            ["nw", "-top-1.5 -left-1.5 cursor-nwse-resize"],
                            ["ne", "-top-1.5 -right-1.5 cursor-nesw-resize"],
                            ["sw", "-bottom-1.5 -left-1.5 cursor-nesw-resize"],
                            ["se", "-bottom-1.5 -right-1.5 cursor-nwse-resize"],
                          ] as const
                        ).map(([corner, position]) => (
                          <button
                            key={corner}
                            type="button"
                            aria-label={`Ubah sudut ${corner}`}
                            className={`absolute h-3.5 w-3.5 touch-none rounded-full border-2 border-blue-600 bg-white dark:bg-slate-900 shadow ${position}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              if (exporting) return;
                              dragRef.current = {
                                mode: corner,
                                startX: event.clientX,
                                startY: event.clientY,
                                crop: effCrop,
                              };
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => rotate(-90)}
                  disabled={!ready}
                  aria-label="Putar ke kiri"
                  title="Putar ke kiri"
                  className={TOOL_BTN}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => rotate(90)}
                  disabled={!ready}
                  aria-label="Putar ke kanan"
                  title="Putar ke kanan"
                  className={TOOL_BTN}
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFlip("h")}
                  disabled={!ready}
                  aria-label="Cermin horizontal"
                  title="Cermin horizontal"
                  className={TOOL_BTN}
                >
                  <FlipHorizontal className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFlip("v")}
                  disabled={!ready}
                  aria-label="Cermin vertikal"
                  title="Cermin vertikal"
                  className={TOOL_BTN}
                >
                  <FlipVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={!ready}
                  aria-label="Atur ulang"
                  title="Atur ulang"
                  className={TOOL_BTN}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <div className="ml-auto flex min-w-40 flex-1 items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {zoom.toFixed(2).replace(".", ",")}×
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={MAX_ZOOM}
                    step={0.05}
                    value={zoom}
                    onChange={(event) => applyZoom(Number(event.target.value))}
                    disabled={!ready}
                    aria-label="Zoom"
                    className="h-1.5 w-full cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Geser kotak untuk memilih bagian foto, tarik sudutnya untuk
                mengubah ukuran, dan seret area gelap untuk menggeser foto.
                Hasilnya disimpan sebagai JPEG maksimal 1280px.
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 dark:border-slate-800/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-none sm:px-5"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={usePhoto}
            disabled={!ready || exporting || loadError || !effCrop}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
          >
            {exporting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {exporting ? "Menyiapkan…" : "Gunakan Foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [38/48] frontend/components/serve-queue.tsx ----------------------------------------
$p = @'
components/serve-queue.tsx
'@
$c = @'
"use client";

// Antrean Penyajian — jantung anti-lupa Verifikasi Struk v3 (dine-in).
// Semua transaksi hari ini yang belum ditandai SERVED tampil di sini
// lengkap dengan umur pesanan; kasir cukup satu tap "Sudah Disajikan"
// saat makanan/meja diserahkan. Dipakai di layar kasir (floating bar)
// dan di konsol verifikasi (panel inline).

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UtensilsCrossed, X } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import {
  getServeQueue,
  markServed,
  type ServeQueueRow,
} from "@/app/owner/verify/actions";

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

function ageMinutes(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

function ageBadge(age: number) {
  if (age >= 10) return "bg-red-600";
  if (age >= 5) return "bg-amber-500";
  return "bg-slate-400";
}

// Re-render every 30s so the queue ages stay honest without touching
// the server — the row DATA itself refreshes separately.
function useNowTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Keeps the queue live: initial rows come from the server render, then
// a lightweight server-action poll every 30s picks up orders taken by
// OTHER kasir devices (this device refreshes via router.refresh()).
function useServeQueueRows(initial: ServeQueueRow[]) {
  const [rows, setRows] = useState(initial);
  useEffect(() => {
    setRows(initial);
  }, [initial]);
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const next = await getServeQueue();
        setRows(next);
      } catch {
        // keep showing the last known rows
      }
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  return rows;
}

export function ServeButton({
  transactionId,
  withNote = false,
  compact = false,
}: {
  transactionId: string;
  withNote?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await markServed({
        transactionId,
        note: withNote ? note : undefined,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className={compact ? "shrink-0" : "space-y-2"}>
      {withNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Alasan penutupan (opsional, tercatat permanen)"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
        />
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className={
          compact
            ? "flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            : "flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Menyimpan…" : "Sudah Disajikan"}
      </button>
      {error && (
        <p
          className={`text-xs font-semibold text-red-600 dark:text-red-400 ${compact ? "max-w-[10rem] text-right" : ""}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ServeRow({ row, now }: { row: ServeQueueRow; now: number }) {
  const age = ageMinutes(row.createdAtIso, now);
  return (
    <li className="flex items-center gap-3 rounded-2xl glass-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
          {row.code}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
          {timeFmt.format(new Date(row.createdAtIso))} · {row.itemCount} item ·{" "}
          {formatRupiah(row.totalRupiah)}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums text-white ${ageBadge(age)}`}
        title="Umur pesanan sejak checkout"
      >
        {age} mnt
      </span>
      <ServeButton transactionId={row.id} compact />
    </li>
  );
}

export function ServeQueuePanel({
  rows: initialRows,
}: {
  rows: ServeQueueRow[];
}) {
  const rows = useServeQueueRows(initialRows);
  const now = useNowTick();
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Antrean Penyajian</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {rows.length} menunggu · segar tiap 30 dtk
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl glass-card p-5 text-center text-sm text-slate-400 dark:text-slate-500">
          Semua pesanan hari ini sudah ditandai disajikan.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <ServeRow key={row.id} row={row} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ServeQueueBar({
  rows: initialRows,
}: {
  rows: ServeQueueRow[];
}) {
  const rows = useServeQueueRows(initialRows);
  const [open, setOpen] = useState(false);
  const now = useNowTick();

  if (rows.length === 0) return null;
  const oldest = Math.max(
    ...rows.map((row) => ageMinutes(row.createdAtIso, now)),
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
      {open && (
        <div className="mx-auto w-full max-w-md px-3 pb-2">
          <div className="rounded-2xl glass-card p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Antrean Penyajian
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup antrean"
                className="rounded-lg p-1 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[50dvh] space-y-2 overflow-y-auto">
              {rows.map((row) => (
                <ServeRow key={row.id} row={row} now={now} />
              ))}
            </ul>
            <Link
              href="/owner/verify"
              className="mt-2 block text-center text-xs font-semibold text-blue-600 dark:text-blue-400"
            >
              Buka Konsol Verifikasi
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-md px-3 pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg transition ${
            oldest >= 10
              ? "bg-red-600"
              : oldest >= 5
                ? "bg-amber-500"
                : "bg-slate-800 dark:bg-slate-700"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          {rows.length} pesanan belum disajikan · tertua {oldest} mnt
        </button>
      </div>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [39/48] frontend/components/theme-header-actions.tsx ----------------------------------------
$p = @'
components/theme-header-actions.tsx
'@
$c = @'
"use client";

// Aksi tema untuk header tiap area (kasir / owner / dev) — v1.6.0.
// Berisi dua pintu pengganti tema:
//   1. ThemeToggle  — pil 3 pilihan (sistem/gelap/terang), ganti seketika;
//   2. tautan gear  — menuju halaman /settings berisi kartu pratinjau.
// Tema tersimpan PER PENGGUNA di localStorage (kunci "theme-<idUser>",
// v1.7.0) — tiap orang punya temanya sendiri bahkan bila berbagi satu
// browser, persis permintaan pemilik: "setiap orang punya tema
// masing-masing yang tersimpan di local machine mereka".
import Link from "next/link";
import { LuSettings2 } from "react-icons/lu";
import { ThemeToggle } from "./theme-toggle";

export function ThemeHeaderActions({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ThemeToggle />
      <Link
        href="/settings"
        title="Pengaturan tampilan (tema)"
        aria-label="Buka pengaturan tampilan"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-white"
      >
        <LuSettings2 className="h-4 w-4" />
      </Link>
    </div>
  );
}
'@
Save-UmkmFile $p $c

# ---- [40/48] frontend/components/theme-provider.tsx ----------------------------------------
$p = @'
components/theme-provider.tsx
'@
$c = @'
"use client";

// ThemeProvider tingkat akar (v1.7.0): tema kini PER PENGGUNA.
// app/layout.tsx (server component) membaca sesi lewat auth(), lalu
// meneruskan storageKey "theme-<idUser>" ke sini. next-themes lalu
// membaca/menulis localStorage dengan kunci itu — dua orang yang
// berbagi satu browser tetap membawa tema masing-masing.
//
// Halaman TANPA sesi (/login, /verify/[code]) tetap memakai kunci
// generik "theme". Supaya pengalaman tidak "melomcat" (gelap di
// konsol, tiba-tiba terang di halaman masuk), komponen cermin di
// bawah menyalin pilihan tema aktif ke kunci generik setiap kali
// tema diganti saat sedang login.
import { useEffect, useRef } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "next-themes";
import {
  ANONYMOUS_THEME_KEY,
  isPerUserThemeKey,
} from "@/lib/theme-storage";

/**
 * Menyalin pilihan tema (bukan hasil resolusinya — "system" tetap
 * "system") ke kunci anonim selama kunci aktif adalah kunci
 * per-pengguna. Halaman publik /login & /verify membaca kunci itu,
 * jadi mesin menampilkan tema yang terakhir DIPILIH orang yang
 * memakainya — bukan kembali ke tema sistem begitu keluar sesi.
 *
 * Hanya perubahan SESUDAH mount yang dicerminkan: efek ini sengaja
 * melewati nilai awal (useRef penanda), supaya sekadar membuka
 * halaman sebagai pengguna baru (temanya masih default "system")
 * TIDAK menimpa pilihan anonim yang sudah tersimpan di mesin itu.
 */
function AnonymousThemeMirror({ enabled }: { enabled: boolean }) {
  const { theme } = useTheme();
  const lewatiNilaiAwal = useRef(true);
  useEffect(() => {
    if (!enabled || typeof theme !== "string") return;
    if (lewatiNilaiAwal.current) {
      lewatiNilaiAwal.current = false;
      return;
    }
    try {
      window.localStorage.setItem(ANONYMOUS_THEME_KEY, theme);
    } catch {
      // Penyimpanan pribat browser penuh/diblokir — cermin gagal
      // bukan masalah fatal; tema per-pengguna tetap tersimpan.
    }
  }, [theme, enabled]);
  return null;
}

export function ThemeProvider({
  children,
  storageKey,
}: {
  children: React.ReactNode;
  /** Undefined = kunci generik "theme" (halaman tanpa sesi). */
  storageKey?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={storageKey}
    >
      <AnonymousThemeMirror enabled={isPerUserThemeKey(storageKey)} />
      {children}
    </NextThemesProvider>
  );
}
'@
Save-UmkmFile $p $c

# ---- [41/48] frontend/lib/audit-labels.ts ----------------------------------------
$p = @'
lib/audit-labels.ts
'@
$c = @'
// Penerjemah aksi audit -> bahasa manusia + tingkat keseriusan (Task 35).
//
// Permintaan pemilik: log developer tidak boleh hanya menampilkan nama
// method (LOGIN_FAILED) — harus terbaca "Login gagal", dan langsung
// kelihatan mana yang error/sensitif. Dua konsep:
//   1. LABEL — nama aksi dalam bahasa Indonesia yang enak dibaca,
//   2. LEVEL — SUKSES (hijau) / PERINGATAN (amber, aksi sensitif) /
//      GAGAL (merah, semua aksi berakhiran _FAILED).
// Satu file dipakai: halaman /dev/logs, konsol /dev, dan export XLSX.

export type LogLevel = "SUKSES" | "PERINGATAN" | "GAGAL";

// Aksi yang sah tapi sensitif — perlu menonjol saat di-scroll cepat.
const WARN_ACTIONS: string[] = [
  "ACCOUNT_DELETE",
  "ACCOUNT_PASSWORD_RESET",
  "TRANSACTION_REFUND",
  "STOCK_ADJUST",
  "DEV_MAINTENANCE_ENTER",
  "DEV_MAINTENANCE_EXIT",
];

export function actionLevel(action: string): LogLevel {
  if (action.endsWith("_FAILED")) return "GAGAL";
  if (WARN_ACTIONS.includes(action)) return "PERINGATAN";
  return "SUKSES";
}

// Dipakai filter "tingkat" di /dev/logs dan export: satu daftar supaya
// filter layar dan filter file tidak pernah berbeda pendapat.
export function warnActions(): string[] {
  return [...WARN_ACTIONS];
}

export function levelWhereHint(level: string): string | null {
  if (level === "SUKSES" || level === "PERINGATAN" || level === "GAGAL") {
    return level;
  }
  return null;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login berhasil",
  LOGIN_FAILED: "Login gagal",
  TRANSACTION_CREATE: "Transaksi dibuat",
  TRANSACTION_REFUND: "Transaksi di-refund",
  HANDOVER_SERVE: "Pesanan ditandai disajikan",
  HANDOVER_CONFIRM: "Penyerahan dikonfirmasi pembeli",
  HANDOVER_CLAIM: "Diklaim sudah diantar (staf)",
  STOCK_IN: "Stok masuk (restok)",
  STOCK_OUT: "Stok keluar",
  STOCK_ADJUST: "Stok disesuaikan manual",
  PRODUCT_CREATE: "Produk dibuat",
  PRODUCT_UPDATE: "Produk diubah",
  PRODUCT_DELETE: "Produk diarsipkan",
  SETTINGS_UPDATE: "Pengaturan outlet diperbarui",
  ACCOUNT_CREATE: "Akun dibuat",
  ACCOUNT_UPDATE: "Akun diubah",
  ACCOUNT_PASSWORD_RESET: "Password akun direset",
  ACCOUNT_SET_ACTIVE: "Status aktif akun diubah",
  ACCOUNT_DELETE: "Akun dihapus permanen",
  OUTLET_CREATE: "Outlet baru dibuat",
  DEV_MAINTENANCE_ENTER: "Developer masuk mode maintenance",
  DEV_MAINTENANCE_EXIT: "Developer keluar mode maintenance",
};

// Label aksi yang belum terdaftar: dicantumkan apa adanya supaya aksi baru
// tetap terbaca (bukan kosong) sebelum map diperbarui.
export function actionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  if (action.endsWith("_FAILED")) {
    const base = ACTION_LABELS[action.slice(0, -"_FAILED".length)];
    if (base) return `${base} — GAGAL`;
    return `Gagal: ${action}`;
  }
  return action;
}

// Kelas chip badge per tingkat — dipakai tabel log konsol & /dev/logs.
// Sadar tema (v1.6.0): tint terang (bg-*-50) di tema terang, tint gelap
// dengan teks pucat di tema gelap supaya tetap terbaca di dua-duanya.
export const LEVEL_BADGE: Record<LogLevel, string> = {
  SUKSES:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30",
  PERINGATAN:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30",
  GAGAL:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30",
};
'@
Save-UmkmFile $p $c

# ---- [42/48] frontend/lib/settings-nav.ts ----------------------------------------
$p = @'
lib/settings-nav.ts
'@
$c = @'
// Navigasi halaman /settings (v1.6.0) — murni, tanpa React, supaya bisa
// diuji unit (tests/settings-nav.test.ts) tanpa menyalakan server Next.

export type SettingsRole = "DEVELOPER" | "OWNER" | "KASIR" | null | undefined;

// Halaman "rumah" tiap peran. Dipakai tombol "Kembali" di /settings:
// pengguna yang sudah login pulang ke areanya masing-masing (kasir ke
// POS, owner ke konsol, developer ke konsol dev), sedangkan pengunjung
// yang belum login kembali ke halaman login — bukan lagi selalu /login.
export function settingsBackHref(role: SettingsRole): string {
  switch (role) {
    case "DEVELOPER":
      return "/dev";
    case "OWNER":
      return "/owner";
    case "KASIR":
      return "/cashier";
    default:
      return "/login";
  }
}

// Label tombol kembali mengikuti tujuannya — "Kembali ke Kasir" lebih
// jelas daripada "Kembali" polos saat pengguna lupa dari mana datang.
export function settingsBackLabel(role: SettingsRole): string {
  switch (role) {
    case "DEVELOPER":
      return "Kembali ke Konsol Developer";
    case "OWNER":
      return "Kembali ke Konsol Owner";
    case "KASIR":
      return "Kembali ke Kasir";
    default:
      return "Kembali masuk";
  }
}
'@
Save-UmkmFile $p $c

# ---- [43/48] frontend/lib/theme-storage.ts ----------------------------------------
$p = @'
lib/theme-storage.ts
'@
$c = @'
// Kunci penyimpanan tema (next-themes) — PER PENGGUNA, bukan per mesin.
// Permintaan pemilik: "setiap orang punya tema masing-masing yang
// tersimpan di local machine mereka". localStorage memang sudah
// terisolasi per browser/perangkat, tapi bila dua orang berbagi satu
// browser (mis. owner dan kasir di komputer kasir yang sama), kunci
// generik "theme" akan saling menimpa. Dengan kunci "theme-<idUser>",
// tiap akun membawa temanya sendiri di mesin itu.
//
// Modul ini sengaja MURNI (tanpa React, tanpa window) supaya bisa
// diuji unit test tanpa DOM — komponen client yang memakai nilainya
// lewat props dari server (app/layout.tsx membaca auth()).

/** Kunci yang dipakai next-themes bila storageKey tidak diberikan. */
export const ANONYMOUS_THEME_KEY = "theme";

/**
 * Kunci tema milik satu pengguna.
 * Id kosong / spasi saja dianggap anonim supaya tidak pernah
 * menghasilkan kunci rusak seperti "theme-".
 */
export function themeKeyForUser(userId: string): string {
  const bersih = userId.trim();
  return bersih.length > 0 ? `theme-${bersih}` : ANONYMOUS_THEME_KEY;
}

/**
 * Apakah kunci aktif adalah kunci per-pengguna?
 * Dipakai ThemeProvider untuk memutuskan perlu tidaknya "cermin"
 * ke kunci anonim — lihat components/theme-provider.tsx.
 */
export function isPerUserThemeKey(storageKey: string | undefined): boolean {
  return typeof storageKey === "string" && storageKey !== ANONYMOUS_THEME_KEY;
}
'@
Save-UmkmFile $p $c

# ---- [44/48] frontend/tests/audit-labels.test.ts ----------------------------------------
$p = @'
tests/audit-labels.test.ts
'@
$c = @'
import { describe, expect, it } from "vitest";

// Unit test untuk lib/audit-labels.ts — penerjemah aksi audit.
// Murni, tanpa database. Fokus v1.6.0: LEVEL_BADGE harus punya varian
// gelap (dark:) supaya chip log tetap terbaca saat konsol developer
// berjalan di tema gelap — regresi dari bug "halaman tidak ikut tema".

import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
  levelWhereHint,
  warnActions,
} from "@/lib/audit-labels";

describe("actionLevel", () => {
  it("aksi berakhiran _FAILED selalu GAGAL", () => {
    expect(actionLevel("LOGIN_FAILED")).toBe("GAGAL");
    expect(actionLevel("TRANSACTION_CREATE_FAILED")).toBe("GAGAL");
  });

  it("aksi sensitif ditandai PERINGATAN", () => {
    expect(actionLevel("ACCOUNT_DELETE")).toBe("PERINGATAN");
    expect(actionLevel("DEV_MAINTENANCE_ENTER")).toBe("PERINGATAN");
  });

  it("aksi biasa SUKSES", () => {
    expect(actionLevel("LOGIN_SUCCESS")).toBe("SUKSES");
    expect(actionLevel("TRANSACTION_CREATE")).toBe("SUKSES");
  });
});

describe("actionLabel", () => {
  it("aksi terdaftar diterjemahkan ke bahasa manusia", () => {
    expect(actionLabel("LOGIN_SUCCESS")).toBe("Login berhasil");
    expect(actionLabel("STOCK_ADJUST")).toBe("Stok disesuaikan manual");
  });

  it("varian _FAILED yang basisnya dikenal tetap terbaca", () => {
    expect(actionLabel("LOGIN_FAILED")).toBe("Login gagal");
  });

  it("aksi asing tampil apa adanya, bukan kosong", () => {
    expect(actionLabel("AKSI_BARU")).toBe("AKSI_BARU");
  });
});

describe("warnActions", () => {
  it("mengembalikan salinan — pemanggil tidak bisa mengubah daftar asli", () => {
    const a = warnActions();
    const b = warnActions();
    expect(a).toEqual(b);
    a.push("BOGUS");
    expect(warnActions()).not.toContain("BOGUS");
    expect(b).not.toContain("BOGUS");
  });
});

describe("levelWhereHint", () => {
  it("hanya menerima tiga tingkat sah, selain itu null", () => {
    expect(levelWhereHint("SUKSES")).toBe("SUKSES");
    expect(levelWhereHint("PERINGATAN")).toBe("PERINGATAN");
    expect(levelWhereHint("GAGAL")).toBe("GAGAL");
    expect(levelWhereHint("sukses")).toBeNull();
    expect(levelWhereHint("")).toBeNull();
  });
});

describe("LEVEL_BADGE (sadar tema v1.6.0)", () => {
  it("setiap tingkat punya kelas teks + latar + ring", () => {
    for (const lvl of ["SUKSES", "PERINGATAN", "GAGAL"] as const) {
      const badge = LEVEL_BADGE[lvl];
      expect(badge).toContain("text-");
      expect(badge).toContain("bg-");
      expect(badge).toContain("ring-");
    }
  });

  it("setiap tingkat punya varian dark: (bug: log pucat di tema gelap)", () => {
    for (const lvl of ["SUKSES", "PERINGATAN", "GAGAL"] as const) {
      const badge = LEVEL_BADGE[lvl];
      expect(badge).toContain("dark:bg-");
      expect(badge).toContain("dark:text-");
      expect(badge).toContain("dark:ring-");
    }
  });

  it("warna tingkat tidak tertukar: hijau sukses, amber peringatan, merah gagal", () => {
    expect(LEVEL_BADGE.SUKSES).toContain("emerald");
    expect(LEVEL_BADGE.PERINGATAN).toContain("amber");
    expect(LEVEL_BADGE.GAGAL).toContain("red");
  });
});
'@
Save-UmkmFile $p $c

# ---- [45/48] frontend/tests/cashier-ui.test.ts ----------------------------------------
$p = @'
tests/cashier-ui.test.ts
'@
$c = @'
// Test kartu kategori kasir (v1.8.0) — memastikan chip kategori
// bersifat DUAL-THEME: setiap chip terang wajib membawa padanan gelap
// (dark:bg-... dan dark:text-...), sehingga halaman kasir ikut tema
// pengguna seperti halaman owner dan dev.
// Standar: Bahasa Indonesia, tanpa DB, tanpa jaringan, murni fungsi murni.
import { describe, expect, it } from "vitest";
import {
  categoryAvatarClass,
  categoryChipClass,
  initialsOf,
} from "../app/cashier/ui";

const KATEGORI_KNOWN = [
  "Minuman",
  "Makanan",
  "Sembako",
  "Snack",
  "Perawatan",
];

describe("categoryChipClass — chip dual-theme", () => {
  it("setiap kategori bawaan punya warna terang DAN padanan gelap", () => {
    for (const nama of KATEGORI_KNOWN) {
      const chip = categoryChipClass(nama);
      // sisi terang: latar 100 + teks 700 (mis. bg-amber-100 text-amber-700)
      expect(chip).toMatch(/^bg-\w+-100\s/);
      expect(chip).toMatch(/\stext-\w+-700\s/);
      // sisi gelap (v1.8.0): wajib ada padawannya, bukan terang saja
      expect(chip).toMatch(/dark:bg-\w+-500\/15\b/);
      expect(chip).toMatch(/dark:text-\w+-300\b/);
    }
  });

  it("kategori tak dikenal jatuh ke fallback dual-theme", () => {
    const chip = categoryChipClass("Kategori Aneh");
    expect(chip).toContain("bg-slate-100");
    expect(chip).toContain("dark:bg-slate-900");
    expect(chip).toContain("text-slate-600");
    expect(chip).toContain("dark:text-slate-400");
  });

  it("null dan string kosong juga jatuh ke fallback, bukan melempar", () => {
    expect(categoryChipClass(null)).toBe(categoryChipClass("Apapun"));
    expect(categoryChipClass("")).toBe(categoryChipClass("Apapun"));
  });
});

describe("categoryAvatarClass — avatar kategori", () => {
  it("kategori dikenal memakai warna avatar solid (aman dua tema)", () => {
    for (const nama of KATEGORI_KNOWN) {
      const avatar = categoryAvatarClass(nama);
      expect(avatar).toMatch(/^bg-\w+-500$|^bg-\w+-600$/);
      // avatar solid TIDAK boleh membawa varian gelap — warnanya memang
      // dipakai di kedua tema (kontras dijamin oleh teks putih di atasnya).
      expect(avatar).not.toContain("dark:");
    }
  });

  it("kategori tak dikenal memakai fallback abu-abu", () => {
    expect(categoryAvatarClass("Tidak Ada")).toBe("bg-slate-400");
    expect(categoryAvatarClass(null)).toBe("bg-slate-400");
  });
});

describe("initialsOf — inisial dua huruf untuk avatar keranjang", () => {
  it("dua kata pertama diambil KARAKTER awalnya, kapital", () => {
    // Perilaku riil lama: karakter pertama tiap kata — "600ml" menyumbang
    // "6" (komentar lama di ui.tsx menulis "AQ", tapi kode selalu "A6";
    // test mengunci perilaku riil agar tidak berubah tanpa sengaja).
    expect(initialsOf("Aqua 600ml")).toBe("A6");
    expect(initialsOf("beras merah premium")).toBe("BM");
    expect(initialsOf("Indomie Goreng")).toBe("IG");
  });

  it("satu kata hanya menghasilkan satu huruf", () => {
    expect(initialsOf("Gula")).toBe("G");
  });

  it("string kosong / spasi saja menghasilkan tanda tanya, bukan crash", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});
'@
Save-UmkmFile $p $c

# ---- [46/48] frontend/tests/settings-nav.test.ts ----------------------------------------
$p = @'
tests/settings-nav.test.ts
'@
$c = @'
import { describe, expect, it } from "vitest";

// Unit test untuk navigasi halaman /settings (lib/settings-nav.ts) —
// murni, tanpa React/router, jadi hasilnya pasti sama di mesin mana pun.
// Yang dijaga: tombol "Kembali" di /settings harus memulangkan tiap
// peran ke areanya sendiri, bukan selalu ke /login (bug lama v1.3.0).

import {
  settingsBackHref,
  settingsBackLabel,
  type SettingsRole,
} from "@/lib/settings-nav";

const KASUS: { role: SettingsRole; href: string; label: string }[] = [
  { role: "DEVELOPER", href: "/dev", label: "Kembali ke Konsol Developer" },
  { role: "OWNER", href: "/owner", label: "Kembali ke Konsol Owner" },
  { role: "KASIR", href: "/cashier", label: "Kembali ke Kasir" },
];

describe("settingsBackHref", () => {
  it.each(KASUS)(
    "peran $role pulang ke areanya sendiri ($href)",
    ({ role, href }) => {
      expect(settingsBackHref(role)).toBe(href);
    },
  );

  it("pengunjung tanpa sesi (null) kembali ke halaman login", () => {
    expect(settingsBackHref(null)).toBe("/login");
  });

  it("undefined (sesi rusak / belum terbaca) tetap aman ke login", () => {
    expect(settingsBackHref(undefined)).toBe("/login");
  });
});

describe("settingsBackLabel", () => {
  it.each(KASUS)(
    "label tombol menyebut tujuan peran $role secara jelas",
    ({ role, label }) => {
      expect(settingsBackLabel(role)).toBe(label);
    },
  );

  it("pengunjung anonim mendapat label kembali-masuk, bukan kosong", () => {
    const label = settingsBackLabel(null);
    expect(label.length).toBeGreaterThan(0);
    expect(settingsBackLabel(undefined)).toBe(label);
  });
});
'@
Save-UmkmFile $p $c

# ---- [47/48] frontend/tests/theme-storage.test.ts ----------------------------------------
$p = @'
tests/theme-storage.test.ts
'@
$c = @'
import { describe, expect, it } from "vitest";

// Unit test untuk kunci penyimpanan tema per pengguna
// (lib/theme-storage.ts) — murni, tanpa React/window, hasilnya pasti
// sama di mesin mana pun. Yang dijaga: permintaan pemilik "setiap
// orang punya tema masing-masing yang tersimpan di local machine
// mereka" — dua akun berbeda TIDAK boleh berbagi satu kunci
// localStorage, dan halaman tanpa sesi tetap punya kunci generik.

import {
  ANONYMOUS_THEME_KEY,
  isPerUserThemeKey,
  themeKeyForUser,
} from "@/lib/theme-storage";

describe("themeKeyForUser", () => {
  it("membuat kunci unik per id pengguna", () => {
    expect(themeKeyForUser("7")).toBe("theme-7");
    expect(themeKeyForUser("92")).toBe("theme-92");
  });

  it("dua orang berbeda tidak berbagi kunci — inti permintaan per-user", () => {
    const owner = themeKeyForUser("1");
    const kasir = themeKeyForUser("2");
    expect(owner).not.toBe(kasir);
  });

  it("id yang sama menghasilkan kunci yang sama (idempoten)", () => {
    expect(themeKeyForUser("15")).toBe(themeKeyForUser("15"));
  });

  it("id kosong jatuh kembali ke kunci anonim, bukan kunci rusak", () => {
    expect(themeKeyForUser("")).toBe(ANONYMOUS_THEME_KEY);
  });

  it("id spasi saja dianggap kosong (tidak menghasilkan 'theme-')", () => {
    expect(themeKeyForUser("   ")).toBe(ANONYMOUS_THEME_KEY);
  });

  it("spasi di kiri-kanan id dipangkas agar kunci konsisten", () => {
    expect(themeKeyForUser(" 42 ")).toBe("theme-42");
  });
});

describe("isPerUserThemeKey", () => {
  it("kunci per-pengguna dianggap per-pengguna", () => {
    expect(isPerUserThemeKey("theme-7")).toBe(true);
  });

  it("kunci generik anonim BUKAN per-pengguna", () => {
    expect(isPerUserThemeKey(ANONYMOUS_THEME_KEY)).toBe(false);
  });

  it("undefined (halaman tanpa sesi, next-themes pakai default) aman", () => {
    expect(isPerUserThemeKey(undefined)).toBe(false);
  });

  it("cermin hanya menyala untuk kunci per-pengguna — anonim tak bercermin ke dirinya sendiri", () => {
    // Jika kunci aktif = "theme-<id>", cermin menyala; jika kunci
    // aktif = "theme" (anonim), cermin mati supaya tidak menimpa
    // nilai anonim dengan dirinya sendiri secara sia-sia.
    expect(isPerUserThemeKey(themeKeyForUser("5"))).toBe(true);
    expect(isPerUserThemeKey(themeKeyForUser(""))).toBe(false);
  });
});

describe("kontrak kunci dengan next-themes", () => {
  it("kunci anonim persis default next-themes ('theme')", () => {
    // next-themes memakai "theme" bila storageKey tidak diberikan —
    // nilai ini HARUS tetap sama agar halaman /login & /verify
    // (tanpa sesi) dan cermin ThemeProvider bicara bahasa yang sama.
    expect(ANONYMOUS_THEME_KEY).toBe("theme");
  });

  it("kunci per-pengguna selalu diawali nama kunci anonim", () => {
    // "theme-<id>" — mudah dibersihkan/di-inspeksi manual lewat
    // DevTools dengan filter awalan yang sama.
    expect(themeKeyForUser("3").startsWith(`${ANONYMOUS_THEME_KEY}-`)).toBe(
      true,
    );
  });
});
'@
Save-UmkmFile $p $c

# ---- [48/48] frontend/tests/view-helpers.test.ts ----------------------------------------
$p = @'
tests/view-helpers.test.ts
'@
$c = @'
import { describe, expect, it } from "vitest";

// Unit test untuk pemetaan DTO backend-go -> baris tabel akun dan util
// tampilan (app/dev/users/view-helpers.ts). Murni — tidak menyentuh
// jaringan/database, jadi hasilnya pasti sama di mesin mana pun.

import {
  avatarGradient,
  formatWibDateTime,
  formatWibShort,
  initials,
  mapGoOutlets,
  mapGoUsers,
  normalizeRole,
  roleBadgeDark,
  roleView,
  toGoRole,
  type GoOutletDTO,
  type GoUserDTO,
} from "@/app/dev/users/view-helpers";

function contohUserDTO(): GoUserDTO {
  return {
    id: 7,
    name: "Budi Santoso",
    email: "budi@warung.id",
    role: "CASHIER",
    outlet_id: 3,
    outlet_name: "Warung Bu Sari",
    is_active: true,
    created_at: "2026-10-25T02:30:00Z",
    last_transaction_at: "2026-10-24T09:00:00Z",
  };
}

describe("normalizeRole", () => {
  it("mengubah CASHIER (istilah Go) menjadi KASIR (istilah frontend)", () => {
    expect(normalizeRole("CASHIER")).toBe("KASIR");
  });

  it("membiarkan OWNER dan DEVELOPER apa adanya", () => {
    expect(normalizeRole("OWNER")).toBe("OWNER");
    expect(normalizeRole("DEVELOPER")).toBe("DEVELOPER");
  });

  it("nilai tak dikenal jatuh ke KASIR, bukan error", () => {
    expect(normalizeRole("")).toBe("KASIR");
    expect(normalizeRole("SESUATU")).toBe("KASIR");
  });
});

describe("toGoRole", () => {
  it("KASIR dikirim sebagai CASHIER ke backend-go", () => {
    expect(toGoRole("KASIR")).toBe("CASHIER");
  });

  it("OWNER tetap OWNER", () => {
    expect(toGoRole("OWNER")).toBe("OWNER");
  });
});

describe("mapGoUsers", () => {
  it("memetakan satu baris lengkap dengan benar", () => {
    const [row] = mapGoUsers([contohUserDTO()]);
    expect(row).toEqual({
      id: "7",
      name: "Budi Santoso",
      email: "budi@warung.id",
      role: "KASIR",
      outletId: "3",
      outletName: "Warung Bu Sari",
      isActive: true,
      createdAtIso: "2026-10-25T02:30:00Z",
      lastTransactionAtIso: "2026-10-24T09:00:00Z",
    });
  });

  it("owner tanpa outlet: outlet null dan bukan string kosong", () => {
    const dto = contohUserDTO();
    dto.role = "OWNER";
    dto.outlet_id = null;
    dto.outlet_name = null;
    dto.last_transaction_at = null;
    const [row] = mapGoUsers([dto]);
    expect(row.outletId).toBeNull();
    expect(row.outletName).toBeNull();
    expect(row.lastTransactionAtIso).toBeNull(); // belum pernah jualan
    expect(row.role).toBe("OWNER");
  });

  it("daftar kosong tetap kosong (bukan undefined)", () => {
    expect(mapGoUsers([])).toEqual([]);
  });

  it("id numerik Go menjadi string (kunci React & URL aman)", () => {
    const [row] = mapGoUsers([contohUserDTO()]);
    expect(row.id).toBeTypeOf("string");
  });
});

describe("mapGoOutlets", () => {
  it("hanya membawa id + nama yang dibutuhkan form akun", () => {
    const dto: GoOutletDTO = {
      id: 2,
      name: "Warung Bu Sari",
      address: "Jl. Merdeka 1",
      phone: "0812",
      logo_version: 0,
      has_logo: false,
      is_active: true,
      user_count: 4,
      created_at: "2026-10-01T00:00:00Z",
    };
    expect(mapGoOutlets([dto])).toEqual([{ id: "2", name: "Warung Bu Sari" }]);
  });
});

describe("initials", () => {
  it("dua kata: huruf pertama kata pertama + kata terakhir", () => {
    expect(initials("Budi Santoso")).toBe("BS");
    expect(initials("sari widya astuti")).toBe("SA");
  });

  it("satu kata: dua huruf pertama kata itu", () => {
    expect(initials("Rina")).toBe("RI");
    expect(initials("b")).toBe("B");
  });

  it("spasi berlebih diabaikan, kosong jatuh ke tanda tanya", () => {
    expect(initials("  Budi   Santoso  ")).toBe("BS");
    expect(initials("   ")).toBe("?");
    expect(initials("")).toBe("?");
  });
});

describe("formatWibShort", () => {
  it("null (belum pernah jualan) tampil sebagai —", () => {
    expect(formatWibShort(null)).toBe("—");
  });

  it("tanggal UTC dikonversi ke WIB, bukan zona mesin", () => {
    // 25 Okt 2026 00:30 UTC = 25 Okt 2026 07:30 WIB -> tetap tanggal 25.
    expect(formatWibShort("2026-10-25T00:30:00Z")).toContain("25");
    // 25 Okt 2026 20:00 UTC = 26 Okt 2026 03:00 WIB -> tanggal bergeser
    // ke 26. Inilah yang dijaga test ini: label tidak boleh ikut zona
    // waktu mesin siapa pun yang membuka halaman.
    expect(formatWibShort("2026-10-25T20:00:00Z")).toContain("26");
  });

  it("format mengikuti locale id-ID (bulan singkat Indonesia)", () => {
    const hasil = formatWibShort("2026-10-25T00:30:00Z");
    expect(hasil).toMatch(/Okt/i);
  });
});

describe("roleView", () => {
  it("setiap peran punya label ramah + kelas badge", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const rv = roleView(role);
      expect(rv.label.length).toBeGreaterThan(0);
      expect(rv.badge.length).toBeGreaterThan(0);
    }
  });

  it("label bahasa Indonesia yang dibaca pengguna", () => {
    expect(roleView("OWNER").label).toBe("Owner");
    expect(roleView("KASIR").label).toBe("Kasir");
    expect(roleView("DEVELOPER").label).toBe("Developer");
  });
});

describe("roleBadgeDark (konsol Kelola Akun, sadar tema v1.6.0)", () => {
  it("label peran huruf besar untuk badge tabel", () => {
    expect(roleBadgeDark("OWNER").label).toBe("OWNER");
    expect(roleBadgeDark("KASIR").label).toBe("KASIR");
    expect(roleBadgeDark("DEVELOPER").label).toBe("DEVELOPER");
  });

  it("warna tiap peran beda: ungu developer, biru owner, hijau kasir", () => {
    expect(roleBadgeDark("DEVELOPER").badge).toContain("purple");
    expect(roleBadgeDark("OWNER").badge).toContain("blue");
    expect(roleBadgeDark("KASIR").badge).toContain("emerald");
  });

  it("badge selalu memuat border + tint supaya konsisten di kartu glass", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const { badge } = roleBadgeDark(role);
      expect(badge).toContain("border-");
      expect(badge).toContain("bg-");
      expect(badge).toContain("text-");
    }
  });

  it("v1.6.0: badge sadar tema — teks pekat untuk terang + varian dark:", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const { badge } = roleBadgeDark(role);
      // sisi terang: teks pekat (600/700) agar terbaca di kartu glass terang
      expect(badge).toMatch(/text-(blue|emerald|purple)-(600|700)/);
      // sisi gelap: varian dark: dengan teks pucat (300)
      expect(badge).toMatch(/dark:text-(blue|emerald|purple)-300/);
    }
  });
});

describe("avatarGradient", () => {
  it("gradien tiap peran mengikuti warna hirarki akses", () => {
    expect(avatarGradient("DEVELOPER")).toContain("purple");
    expect(avatarGradient("OWNER")).toContain("cyan");
    expect(avatarGradient("KASIR")).toContain("emerald");
  });

  it("tiap peran menghasilkan kelas from- dan to- yang lengkap", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const g = avatarGradient(role);
      expect(g).toMatch(/^from-/);
      expect(g).toContain(" to-");
    }
  });
});

describe("formatWibDateTime", () => {
  it("null (belum pernah jualan) tampil sebagai —", () => {
    expect(formatWibDateTime(null)).toBe("—");
  });

  it("tanggal + jam UTC dikonversi ke WIB dengan pemisah jam ':'", () => {
    // 23 Okt 2026 07:20 UTC = 23 Okt 2026 14:20 WIB.
    expect(formatWibDateTime("2026-10-23T07:20:00Z")).toBe(
      "23 Okt 2026 (14:20 WIB)",
    );
  });

  it("lewat tengah malam UTC bergeser ke tanggal WIB berikutnya", () => {
    // 25 Okt 2026 20:00 UTC = 26 Okt 2026 03:00 WIB.
    expect(formatWibDateTime("2026-10-25T20:00:00Z")).toBe(
      "26 Okt 2026 (03:00 WIB)",
    );
  });
});
'@
Save-UmkmFile $p $c

Write-Host ""
Write-Host "== SELESAI: $written file ditulis. ==" -ForegroundColor Green
Write-Host "Verifikasi cepat (opsional tapi disarankan):"
Write-Host "  cd frontend"
Write-Host "  npx tsc --noEmit        # harus 0 error"
Write-Host "  npx vitest run          # harus 78/78 lulus"
Write-Host "  npx next build          # harus Compiled successfully"
Write-Host "Lalu kembali ke root repo dan jalankan blok git dari chat."
# ============================================================================
