"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Editor pengaturan terdaftar (PUT /admin/settings). Validasi tipe
// tetap di backend — UI hanya menuntun (int: angka; bool: pilihan).
type Baris = {
  key: string;
  type: string;
  value: string;
  default: string;
  updated_by: string;
  updated_at: string;
  keterangan: string;
};

export function PengaturanClient({
  baris,
  goToken,
}: {
  baris: Baris[];
  goToken: string;
}) {
  const router = useRouter();
  const [nilai, setNilai] = useState<Record<string, string>>(
    Object.fromEntries(baris.map((b) => [b.key, b.value])),
  );
  const [sedang, setSedang] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [oke, setOke] = useState<string | null>(null);

  async function simpan(kunci: string) {
    setSedang(kunci);
    setPesan(null);
    setOke(null);
    try {
      const res = await fetch(
        `${process.env.API_URL ?? "http://localhost:8080"}/api/v1/admin/settings`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${goToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key: kunci, value: nilai[kunci] }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!json.success) {
        setPesan(`${kunci}: ${json.error?.message ?? "gagal"}`);
        return;
      }
      setOke(`${kunci} tersimpan`);
      router.refresh();
    } finally {
      setSedang(null);
    }
  }

  if (baris.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Backend belum melaporkan pengaturan terdaftar.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-rose-400/50 bg-rose-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}
      {oke && (
        <p className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 p-3 text-sm">
          {oke}
        </p>
      )}
      <ul className="space-y-2">
        {baris.map((b) => (
          <li key={b.key} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-mono text-sm font-medium">{b.key}</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {b.type}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {b.keterangan} — env: {b.default} · terakhir: {b.updated_by}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {b.type === "bool" ? (
                <select
                  value={nilai[b.key]}
                  onChange={(e) =>
                    setNilai((n) => ({ ...n, [b.key]: e.target.value }))
                  }
                  className="rounded-lg border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type="text"
                  inputMode={b.type === "int" ? "numeric" : "text"}
                  value={nilai[b.key]}
                  onChange={(e) =>
                    setNilai((n) => ({ ...n, [b.key]: e.target.value }))
                  }
                  className="w-40 rounded-lg border bg-background px-3 py-1.5 text-sm tabular-nums"
                />
              )}
              <button
                onClick={() => simpan(b.key)}
                disabled={sedang === b.key || nilai[b.key] === b.value}
                className="rounded-lg border border-sky-400/60 px-3 py-1.5 text-xs font-medium text-sky-600 transition hover:bg-sky-400/10 disabled:opacity-40"
              >
                {sedang === b.key ? "menyimpan…" : "Simpan"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
