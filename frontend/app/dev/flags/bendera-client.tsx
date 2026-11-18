"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Daftar bendera + toggle PUT /admin/flags. Gagal (bendera yatim dsb.)
// menampilkan pita kesalahan dari backend, bukan senyap.
type Baris = {
  key: string;
  value: boolean;
  updated_by: string;
  updated_at: string;
  keterangan: string;
};

export function BenderaClient({
  baris,
  goToken,
}: {
  baris: Baris[];
  goToken: string;
}) {
  const router = useRouter();
  const [nilai, setNilai] = useState<Record<string, boolean>>(
    Object.fromEntries(baris.map((b) => [b.key, b.value])),
  );
  const [sedang, setSedang] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  async function toggle(kunci: string) {
    setSedang(kunci);
    setPesan(null);
    try {
      const res = await fetch(
        `${process.env.API_URL ?? "http://localhost:8080"}/api/v1/admin/flags`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${goToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key: kunci, value: !nilai[kunci] }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!json.success) {
        setPesan(json.error?.message ?? "gagal mengubah bendera");
        return;
      }
      setNilai((n) => ({ ...n, [kunci]: !n[kunci] }));
      router.refresh();
    } finally {
      setSedang(null);
    }
  }

  if (baris.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Backend belum melaporkan bendera terdaftar.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}
      <ul className="space-y-2">
        {baris.map((b) => (
          <li
            key={b.key}
            className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
          >
            <div>
              <div className="font-mono text-sm font-medium">{b.key}</div>
              <div className="text-xs text-muted-foreground">
                {b.keterangan} — terakhir: {b.updated_by}
              </div>
            </div>
            <button
              onClick={() => toggle(b.key)}
              disabled={sedang === b.key}
              role="switch"
              aria-checked={nilai[b.key]}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
                nilai[b.key] ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 size-6 rounded-full bg-white transition ${
                  nilai[b.key] ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
