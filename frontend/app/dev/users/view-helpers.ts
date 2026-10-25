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

// Badge peran versi konsol gelap "Kelola Akun" (design v1.5.0): label
// HURUF BESAR, badge kotak rounded-lg dengan tint /15 + border /30.
// Warna mengikuti identitas hirarki akses: ungu developer, biru owner,
// hijau kasir — supaya tabel, kartu metrik, dan modal tidak pernah
// menampilkan dua warna berbeda untuk peran yang sama.
export function roleBadgeDark(role: UserRow["role"]): {
  label: string;
  badge: string;
} {
  switch (role) {
    case "DEVELOPER":
      return {
        label: "DEVELOPER",
        badge: "border-purple-500/30 bg-purple-500/15 text-purple-300",
      };
    case "OWNER":
      return {
        label: "OWNER",
        badge: "border-blue-500/30 bg-blue-500/15 text-blue-300",
      };
    default:
      return {
        label: "KASIR",
        badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
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
