"use client";

import { useCallback, useEffect, useState } from "react";
import { History, PlayCircle, Square } from "lucide-react";

// TAB 3 UMKM2Shell: TERMINAL perintah whitelist.
// POST /shell/cmd · GET /shell/cmd (sejarah) · interupsi POST
// /shell/cmd/interupsi · daftar GET /shell/cmd/daftar.
const API = process.env.API_URL ?? "http://localhost:8080";

type Hasil = {
  id: number;
  perintah: string;
  mulai: string;
  selesai: string;
  exit_code: number;
  output: string;
  sebab_gagal?: string;
};

export function TabTerminal({ goToken }: { goToken: string }) {
  const [perintah, setPerintah] = useState("");
  const [jalan, setJalan] = useState(false);
  const [sejarah, setSejarah] = useState<Hasil[]>([]);
  const [putih, setPutih] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [validasi, setValidasi] = useState<{
    valid: boolean;
    galat?: string;
  } | null>(null);

  const muatSejarah = useCallback(async () => {
    const res = await fetch(`${API}/api/v1/shell/cmd`, {
      headers: { Authorization: `Bearer ${goToken}` },
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: { sejarah: Hasil[]; sedang_jalan: boolean };
    };
    if (json.success && json.data) {
      setSejarah(json.data.sejarah);
      setJalan(json.data.sedang_jalan);
    }
  }, [goToken]);

  useEffect(() => {
    void muatSejarah();
    // v1.7.0: whitelist + ketersediaan dinamis (netstat dsb.
    // disembunyikan bila binari tidak ada di PATH kontainer).
    void (async () => {
      const res = await fetch(`${API}/api/v1/shell/cmd/tersedia`, {
        headers: { Authorization: `Bearer ${goToken}` },
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { perintah: Record<string, string> };
      };
      if (json.success && json.data) setPutih(json.data.perintah);
    })();
  }, [muatSejarah, goToken]);

  // dry-run: umpan balik validasi SEBELUM tombol jalankan ditekan
  useEffect(() => {
    if (perintah.trim() === "") {
      setValidasi(null);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(`${API}/api/v1/shell/cmd/validasi`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${goToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ perintah }),
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: { valid: boolean; galat?: string };
        };
        if (json.success && json.data) setValidasi(json.data);
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [perintah, goToken]);

  const jalankan = async () => {
    setPesan(null);
    setJalan(true);
    try {
      const res = await fetch(`${API}/api/v1/shell/cmd`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${goToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ perintah }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!json.success) setPesan(json.error?.message ?? "gagal");
      setPerintah("");
      await muatSejarah();
    } finally {
      setJalan(false);
    }
  };

  const interupsi = async () => {
    await fetch(`${API}/api/v1/shell/cmd/interupsi`, {
      method: "POST",
      headers: { Authorization: `Bearer ${goToken}` },
    });
    await muatSejarah();
  };

  const sarankan = Object.keys(putih)
    .filter((k) => perintah !== "" && k.startsWith(perintah.split(" ")[0]))
    .slice(0, 6);

  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 font-mono text-xs">
          {pesan}
        </p>
      )}
      <div className="rounded-xl border bg-zinc-950 p-4 text-zinc-100">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-emerald-400">$</span>
          <input
            value={perintah}
            onChange={(e) => setPerintah(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void jalankan();
            }}
            placeholder="df -h  ·  ps  ·  git status  ·  curl -I http://…"
            spellCheck={false}
            className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-zinc-600"
          />
          {jalan ? (
            <button
              onClick={() => void interupsi()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-medium text-amber-500"
              title="batalkan perintah yang sedang jalan"
            >
              <Square className="size-3.5" /> Interupsi
            </button>
          ) : (
            <button
              onClick={() => void jalankan()}
              disabled={perintah.trim() === ""}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <PlayCircle className="size-3.5" /> Jalankan
            </button>
          )}
        </div>
        {validasi && (
          <div
            className={`mt-2 font-mono text-[11px] ${
              validasi.valid ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {validasi.valid ? "✓ baris ini lolos validator" : `✗ ${validasi.galat}`}
          </div>
        )}
        {sarankan.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sarankan.map((k) => (
              <button
                key={k}
                onClick={() => setPerintah(k)}
                title={putih[k]}
                className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <History className="size-3.5" />
        {sejarah.length} perintah terakhir (maks 50) — whitelist{" "}
        {Object.keys(putih).length} perintah
      </div>

      <div className="space-y-2">
        {sejarah.map((h) => (
          <div key={h.id} className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs">
              <span>
                <span className="text-emerald-500">$ </span>
                {h.perintah}
              </span>
              <span
                className={
                  h.exit_code === 0 ? "text-emerald-600" : "text-rose-600"
                }
              >
                exit {h.exit_code}
                {h.sebab_gagal ? ` (${h.sebab_gagal})` : ""}
              </span>
            </div>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
              {h.output || "(tanpa output)"}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
