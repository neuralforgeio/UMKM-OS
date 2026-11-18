"use client";

import { useState } from "react";
import { PlayCircle, TerminalSquare } from "lucide-react";

// Terminal SQL hanya-baca: POST /admin/sql. Aturan server (parser
// kata-utuh Go) yang menegakkan; UI hanya menuntun dan menampilkan
// hasil tabel generik (kolom dinamis per kueri, maks 500 baris).
type Hasil = {
  kolom: string[];
  baris: Record<string, unknown>[];
  total: number;
};

const CONTOH = [
  "SELECT COUNT(*) AS total_trx FROM transactions",
  "SELECT name, email, role FROM users ORDER BY id LIMIT 50",
  "SELECT action, COUNT(*) AS n FROM audit_logs GROUP BY action ORDER BY n DESC",
];

export function SqlClient({ goToken }: { goToken: string }) {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);
  const [durasi, setDurasi] = useState<number | null>(null);

  async function jalankan() {
    setSedang(true);
    setGalat(null);
    setHasil(null);
    setDurasi(null);
    const mulai = performance.now();
    try {
      const res = await fetch(
        `${process.env.API_URL ?? "http://localhost:8080"}/api/v1/admin/sql`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${goToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: q }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: Hasil;
        error?: { message: string };
      };
      if (!json.success || !json.data) {
        setGalat(json.error?.message ?? "kueri ditolak");
        return;
      }
      setHasil(json.data);
      setDurasi(Math.round(performance.now() - mulai));
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <TerminalSquare className="size-7 text-sky-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SQL Console</h1>
          <p className="text-sm text-muted-foreground">
            Hanya SELECT — satu pernyataan, tanpa titik-koma, LIMIT
            dipaksa ≤ 500. Tiap kueri tercatat di jejak audit.
          </p>
        </div>
      </header>

      <div className="rounded-xl border bg-zinc-950 p-4 text-zinc-100">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") jalankan();
          }}
          rows={4}
          spellCheck={false}
          placeholder="SELECT ..."
          className="w-full resize-y rounded-lg bg-zinc-900 p-3 font-mono text-sm outline-none ring-0 focus:ring-1 focus:ring-sky-500"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={jalankan}
            disabled={sedang || q.trim() === ""}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            <PlayCircle className="size-4" />
            {sedang ? "menjalankan…" : "Jalankan"}
          </button>
          <span className="text-xs text-zinc-400">
            Ctrl+Enter · contoh:{" "}
            {CONTOH.map((c, i) => (
              <button
                key={c}
                onClick={() => setQ(c)}
                className="mx-1 underline decoration-dotted hover:text-sky-400"
              >
                #{i + 1}
              </button>
            ))}
          </span>
        </div>
      </div>

      {galat && (
        <p className="rounded-xl border border-rose-400/50 bg-rose-400/10 p-4 font-mono text-sm text-rose-600">
          {galat}
        </p>
      )}

      {hasil && (
        <section className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {hasil.total} baris · {hasil.kolom.length} kolom
              {durasi !== null && ` · ${durasi} ms`}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {hasil.kolom.map((k) => (
                    <th key={k} className="p-3 font-mono">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasil.baris.map((b, i) => (
                  <tr
                    key={i}
                    className="border-t odd:bg-muted/20 [&:hover]:bg-muted/40"
                  >
                    {hasil.kolom.map((k) => (
                      <td key={k} className="max-w-64 truncate p-3 font-mono tabular-nums">
                        {b[k] === null || b[k] === undefined
                          ? "—"
                          : String(b[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
