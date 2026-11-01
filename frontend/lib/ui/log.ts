// Pencatat konsol khusus UMKM OS v1.0.0, buatan sendiri, rapi, dan berwarna.
//
// Menggantikan console.log polos di seluruh aplikasi: setiap baris
// membawa lencana UMKM OS, nama cakupan, dan penanda waktu sehingga
// pemilik atau developer dapat membaca jejak aplikasi dengan mudah di
// tab konsol peramban. Pesan rencana (debug) hanya muncul saat mode
// pengembangan agar konsol produksi tetap tenang.

type Tingkat = "info" | "sukses" | "peringatan" | "galat" | "debug";

const GAYA_DASAR =
  "background:#6554df;color:#ffffff;border-radius:4px 0 0 4px;padding:2px 6px;font-weight:700;font-size:10px";
const GAYA_CAKUPAN =
  "background:#eef0fa;color:#4d5669;border-radius:0 4px 4px 0;padding:2px 6px;font-size:10px;font-weight:600";

const TINGKAT: Record<
  Tingkat,
  { lencana: string; gaya: string; cetak: (...args: unknown[]) => void }
> = {
  info: {
    lencana: "INFO",
    gaya: `${GAYA_DASAR};background:#4d5669`,
    cetak: (...args: unknown[]) => console.log(...args),
  },
  sukses: {
    lencana: "SUKSES",
    gaya: `${GAYA_DASAR};background:#288b69`,
    cetak: (...args: unknown[]) => console.log(...args),
  },
  peringatan: {
    lencana: "PERINGATAN",
    gaya: `${GAYA_DASAR};background:#a87527`,
    cetak: (...args: unknown[]) => console.warn(...args),
  },
  galat: {
    lencana: "GALAT",
    gaya: `${GAYA_DASAR};background:#c25262`,
    cetak: (...args: unknown[]) => console.error(...args),
  },
  debug: {
    lencana: "DEBUG",
    gaya: `${GAYA_DASAR};background:#7b8497`,
    cetak: (...args: unknown[]) => console.log(...args),
  },
};

function modeProduksi(): boolean {
  try {
    return (
      typeof process !== "undefined" &&
      typeof process.env === "object" &&
      process.env !== null &&
      process.env.NODE_ENV === "production"
    );
  } catch {
    return false;
  }
}

function waktuLokal(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
}

function emit(
  tingkat: Tingkat,
  cakupan: string,
  pesan: string,
  data?: unknown): void {
  if (tingkat === "debug" && modeProduksi()) return;
  if (typeof console === "undefined") return;
  const cfg = TINGKAT[tingkat];
  const depan = `%cUMKM OS%c${cakupan}`;
  const waktu = waktuLokal();
  if (data === undefined) {
    cfg.cetak(`${depan} ${waktu} ${pesan}`, GAYA_DASAR, GAYA_CAKUPAN);
  } else {
    cfg.cetak(`${depan} ${waktu} ${pesan}`, GAYA_DASAR, GAYA_CAKUPAN, data);
  }
}

export const log = {
  info(cakupan: string, pesan: string, data?: unknown): void {
    emit("info", cakupan, pesan, data);
  },
  sukses(cakupan: string, pesan: string, data?: unknown): void {
    emit("sukses", cakupan, pesan, data);
  },
  peringatan(cakupan: string, pesan: string, data?: unknown): void {
    emit("peringatan", cakupan, pesan, data);
  },
  galat(cakupan: string, pesan: string, data?: unknown): void {
    emit("galat", cakupan, pesan, data);
  },
  debug(cakupan: string, pesan: string, data?: unknown): void {
    emit("debug", cakupan, pesan, data);
  },
};

export type CatatLog = typeof log;
