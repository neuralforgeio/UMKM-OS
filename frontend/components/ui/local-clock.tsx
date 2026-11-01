"use client";

// Panel waktu lokal UMKM OS v1.0.0, tanggal dan jam hidup zona WIB
// (Asia/Jakarta), diperbarui setiap detik. Dipakai di kepala beranda.

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

export function LocalClock() {
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
