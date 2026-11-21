"use client";

import { DialogKonfirmasi } from "@/components/dialog";
import { useCallback, useEffect, useState } from "react";
import { EyeOff, KeyRound } from "lucide-react";

// TAB 4 UMKM2Shell: LINGKUNGAN (env) — rahasia otomatis termask;
// membuka satu kunci = konfirmasi eksplisit (jejak audit di backend).
const API = process.env.API_URL ?? "http://localhost:8080";

type Entri = { key: string; value: string; rahasia: boolean };

export function TabEnv({ goToken }: { goToken: string }) {
  const [env, setEnv] = useState<Entri[]>([]);
  const [saring, setSaring] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [konfirmasiBuka, setKonfirmasiBuka] = useState<string | null>(null);

  const muat = useCallback(
    async (buka: string) => {
      const res = await fetch(
        `${API}/api/v1/shell/env${buka ? `?buka=${encodeURIComponent(buka)}` : ""}`,
        { headers: { Authorization: `Bearer ${goToken}` } },
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: { env: Entri[] };
        error?: { message: string };
      };
      if (!json.success || !json.data) {
        setPesan(json.error?.message ?? "gagal memuat");
        return;
      }
      setEnv(json.data.env);
      setPesan(null);
    },
    [goToken],
  );

  useEffect(() => {
    void muat("");
  }, [muat]);

  const bukaKunci = async (k: string) => {
    setKonfirmasiBuka(k);
  };

  const bukaBetul = async (k: string) => {
    await muat(k);
    setTerbuka(k);
  };

  const terlihat = env.filter((e) =>
    e.key.toLowerCase().includes(saring.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <DialogKonfirmasi
        judul="Tampilkan nilai asli"
        pesan={`Tampilkan nilai asli ${konfirmasiBuka ?? ""}? Tindakan ini ter-audit.`}
        teksTombol="Tampilkan"
        buka={konfirmasiBuka !== null}
        onClose={(h) => {
          const k = konfirmasiBuka;
          setKonfirmasiBuka(null);
          if (h.yakin && k) void bukaBetul(k);
        }}
      />
      {pesan && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}
      {terbuka && (
        <p className="rounded-lg border border-rose-400/50 bg-rose-400/10 p-3 text-sm">
          <KeyRound className="mr-1 inline size-4" />
          {terbuka} tampil sebagai nilai asli — tindakan ini tercatat di
          jejak audit. Tutup halaman bila selesai.
        </p>
      )}
      <input
        value={saring}
        onChange={(e) => setSaring(e.target.value)}
        placeholder="saring kunci…"
        className="w-56 rounded-lg border bg-background px-3 py-1.5 text-sm"
      />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Kunci</th>
              <th className="p-3">Nilai</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {terlihat.map((e) => (
              <tr
                key={e.key}
                className="border-t odd:bg-muted/20 [&:hover]:bg-muted/40"
              >
                <td className="p-3 font-mono text-xs font-medium">{e.key}</td>
                <td className="max-w-96 truncate p-3 font-mono text-xs">
                  {e.rahasia ? (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <EyeOff className="size-3" /> {e.value}
                    </span>
                  ) : (
                    e.value
                  )}
                </td>
                <td className="p-3 text-right">
                  {e.rahasia && (
                    <button
                      onClick={() => void bukaKunci(e.key)}
                      className="rounded border border-rose-400/50 px-2 py-0.5 text-xs text-rose-600"
                      title="tampilkan nilai asli (ter-audit)"
                    >
                      buka
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
