// Logika murni tampilan terminal jejak audit (v2.2.1).
//
// Dipakai dua tempat: kartu "Jejak Audit Terbaru" di konsol /dev
// (compact) dan mode ?view=terminal di /dev/logs (penuh). Semua
// fungsi di file ini murni — tanpa React, tanpa DOM — supaya format
// waktu WIB, rekonstruksi perintah PowerShell dari filter aktif,
// sanitasi baris detail, dan pemetaan warna bisa diuji unit test
// (tests/audit-terminal.test.ts).
//
// Tampilan terminal SELALU GELAP — terminal tidak ikut mode terang
// aplikasi (pola yang sama dengan invariant kertas struk yang tetap
// putih di kedua tema). Pemetaan warna di sini adalah kelas Tailwind
// tekstual yang terbaca di atas latar gelap.

import { actionLevel, type LogLevel } from "@/lib/audit-labels";

export type { LogLevel };

// Baris audit bentuk backend-go (GET /audit-logs) — hanya kolom yang
// dipakai tampilan terminal. Kolom opsional diberi tanda "?" supaya
// konsol /dev (respons lama tanpa nama outlet) tetap aman.
export type TerminalAuditRow = {
  id: number;
  user_name: string;
  user_role: string;
  outlet_name?: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

// Filter yang tercermin ke baris perintah PowerShell di kepala
// terminal — peta manusiawi "filter apa yang sedang aktif", bukan
// perintah yang benar-benar dieksekusi (sumber data tetap Go).
export type TerminalFilter = {
  q?: string;
  action?: string;
  level?: string;
  outletId?: string;
  outletName?: string;
  actorId?: string;
  actorName?: string;
  from?: string;
  to?: string;
};

// Warna tingkat keseriusan (di atas latar gelap terminal).
export const LEVEL_COLOR: Record<LogLevel, string> = {
  SUKSES: "text-emerald-400",
  PERINGATAN: "text-amber-400",
  GAGAL: "text-rose-400",
};

// Warna peran aktor.
export const ROLE_COLOR: Record<string, string> = {
  OWNER: "text-sky-300",
  KASIR: "text-emerald-300",
  DEVELOPER: "text-violet-300",
};

export const ROLE_COLOR_FALLBACK = "text-slate-400";

// Prompt di kepala terminal.
export const PS_PROMPT = "PS C:\\umkm-os>";

const WIB = "Asia/Jakarta";
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: WIB,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Stempel waktu terminal "DD/MM HH:MM:SS" dalam WIB. */
export function formatTerminalTime(iso: string): string {
  const parts = timeFmt.formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Kutip nilai string aman untuk perintah PowerShell: petik tunggal
 * digandakan ("'..." jadi "''...") persis aturan PowerShell. */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Rekonstruksi filter aktif menjadi baris perintah PowerShell —
 * kepala terminal di /dev/logs dan konsol /dev. Urutan parameter
 * stabil (level, query, action, outlet, aktor, rentang) supaya test
 * dan mata pengguna bisa mengandalkannya.
 */
export function buildAuditCommand(
  filter: TerminalFilter,
  top: number,
  crossOutlet = false,
): string {
  const parts = [`Get-AuditLog -Top ${top}`];
  if (crossOutlet) parts.push("-AllOutlets");
  if (filter.level) parts.push(`-Level ${filter.level}`);
  if (filter.q) parts.push(`-Query ${psQuote(filter.q)}`);
  if (filter.action) parts.push(`-Action ${filter.action}`);
  if (filter.outletName) {
    parts.push(`-Outlet ${psQuote(filter.outletName)}`);
  } else if (filter.outletId) {
    parts.push(`-Outlet #${filter.outletId}`);
  }
  if (filter.actorName) {
    parts.push(`-Actor ${psQuote(filter.actorName)}`);
  } else if (filter.actorId) {
    parts.push(`-Actor #${filter.actorId}`);
  }
  if (filter.from) parts.push(`-From ${filter.from}`);
  if (filter.to) parts.push(`-To ${filter.to}`);
  return parts.join(" ");
}

/**
 * Sanitasi detail menjadi SATU baris terminal: patah baris menjadi
 * pemisah titik tengah, spasi beruntun dirapatkan, lalu dipotong
 * dengan elipsis agar baris tidak memanjang tanpa batas.
 */
export function terminalDetail(detail: string, max = 96): string {
  const flat = (detail ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return "—";
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

/** Label entitas "entity:id" (atau salah satunya bila pasangan kosong). */
export function terminalEntity(entity: string, entityId: string): string {
  const e = entity ?? "";
  const id = entityId ?? "";
  if (e && id) return `${e}:${id}`;
  return e || id;
}

/** Satu baris audit terformat — potongan terpisah agar tiap bagian
 * bisa diwarnai beda oleh komponen terminal. */
export function terminalLine(row: TerminalAuditRow) {
  return {
    key: row.id,
    time: formatTerminalTime(row.created_at),
    level: actionLevel(row.action),
    actor: row.user_name?.trim() || "Sistem",
    role: row.user_role ?? "",
    outlet: row.outlet_name?.trim() ?? "",
    action: row.action,
    entity: terminalEntity(row.entity, row.entity_id),
    detail: terminalDetail(row.detail),
  };
}
