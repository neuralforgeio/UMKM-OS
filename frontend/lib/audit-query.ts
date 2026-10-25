// Pembangun filter query jejak audit (Task 34 Fase B, diperbarui Task 35;
// v2.1.0: murni — filter diteruskan ke backend-go GET /audit-logs, tidak
// ada lagi Prisma where di sini).
//
// Satu sumber kebenaran untuk DUA konsumen: halaman /dev/logs (query
// penuh developer) dan route /api/logs/export (Excel owner + developer).
// Menyamakan perilaku di dua tempat = satu fungsi, bukan salin-tempel —
// filter yang berbeda antara layar dan file unduhan adalah bug klasik
// laporan keuangan/audit.
//
// Interpretasi filter (q, action, outlet, actor, level, from/to WIB)
// dikerjakan backend-go di audit.go — definisi tingkat dijamin sama
// dengan lib/audit-labels karena keduanya sengaja disinkronkan.

// Batas aman satu export: menjaga respons tetap kecil dan memaksa
// rentang tanggal dipakai untuk penelusuran besar (bukan "unduh semua
// sejak awal zaman" dari tombol). Limit maksimum Go sengaja 10.000.
export const LOG_EXPORT_ROW_CAP = 10_000;

// Rentang tanggal filter ditafsirkan menurut WIB (UTC+7) oleh backend-go.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type LogFilterInput = {
  q?: string;
  action?: string;
  outlet?: string;
  actor?: string;
  from?: string;
  to?: string;
  // "SUKSES" | "PERINGATAN" | "GAGAL" — selain itu diabaikan.
  level?: string;
};

// Nilai kosong ("") atau "ALL" = filter tidak dipakai — datang dari
// <option value="">Semua</option> pada form GET. Type predicate
// ("value is string") supaya TypeScript ikut menyempitkan tipe.
const isSet = (value: string | undefined): value is string =>
  typeof value === "string" && value !== "" && value !== "ALL";

const isLevel = (value: string | undefined): value is string =>
  value === "SUKSES" || value === "PERINGATAN" || value === "GAGAL";

// Rangkai filter menjadi URLSearchParams untuk dipanggil ke backend-go —
// dipakai halaman /dev/logs (plus limit/offset paginasi) dan route
// export (plus limit=LOG_EXPORT_ROW_CAP). Urutan param stabil
// (q, action, outlet, actor, from, to, level) supaya URL mudah dibaca
// dan hasil cache bisa dimanfaatkan.
export function buildLogQuery(input: LogFilterInput): URLSearchParams {
  const qs = new URLSearchParams();
  const q = input.q?.trim();
  if (q) qs.set("q", q);
  if (isSet(input.action)) qs.set("action", input.action);
  if (isSet(input.outlet)) qs.set("outlet", input.outlet);
  if (isSet(input.actor)) qs.set("actor", input.actor);
  if (input.from && DATE_RE.test(input.from)) qs.set("from", input.from);
  if (input.to && DATE_RE.test(input.to)) qs.set("to", input.to);
  if (isLevel(input.level)) qs.set("level", input.level);
  return qs;
}

// Rangkai ulang filter menjadi query string untuk tautan (tombol export,
// pagination) — nilai kosong dibuang supaya URL tetap pendek dan enak
// dibaca. Kepada pembaca link: param "outlet" hanya berlaku untuk
// developer; owner di-scope paksa oleh Go ke outletnya sendiri.
export function logQueryString(input: LogFilterInput): string {
  const s = buildLogQuery(input).toString();
  return s ? `?${s}` : "";
}
