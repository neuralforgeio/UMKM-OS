"use client";

// Panel waktu lokal UMKM OS v1.1.0, tanggal dan jam hidup zona WIB
// (Asia/Jakarta), diperbarui setiap detik.
//
// Dua wajah:
//  * panel penuh (default) dipakai di kepala beranda: tanggal + jam
//    besar dalam kartu berbingkai;
//  * ringkas (prop ringkas) dipakai topbar shell sejak v1.1.0: cukup
//    jam + "WIB" ber angka tabular, tanpa bingkai, hanya tampil di
//    layar lebar supaya topbar ponsel tetap lega (tanggal lengkap
//    tersimpan di tooltip).

import { useEffect, useState } from "react";

const formatTanggal = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatJam = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function LocalClock({ ringkas = false }: { ringkas?: boolean }) {
  const [sekarang, setSekarang] = useState<Date | null>(null);

  useEffect(() => {
    setSekarang(new Date());
    const pengaturWaktu = window.setInterval(() => {
      setSekarang(new Date());
    }, 1000);
    return () => {
      window.clearInterval(pengaturWaktu);
    };
  }, []);

  if (ringkas) {
    return (
      <p
        title={
          sekarang
            ? `${formatTanggal.format(sekarang)} WIB`
            : "Waktu lokal (WIB)"
        }
        className="hidden text-[11px] font-bold tabular-nums tracking-tight text-shell-muted lg:block"
      >
        {sekarang
          ? `${formatJam.format(sekarang).replaceAll(".", ":")} WIB`
          : "--:--:-- WIB"}
      </p>
    );
  }

  return (
    <div className="flex min-w-[200px] max-w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-shell-line bg-shell-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-shell-muted">
          Waktu lokal
        </p>
        <p className="mt-1 truncate text-xs text-shell-ink-soft">
          {sekarang
            ? `${formatTanggal.format(sekarang)} WIB`
            : "Memuat waktu lokal"}
        </p>
      </div>
      <p className="text-lg font-bold tabular-nums tracking-tight text-shell-ink">
        {sekarang ? formatJam.format(sekarang).replaceAll(".", ":") : "--:--:--"}
      </p>
    </div>
  );
}
