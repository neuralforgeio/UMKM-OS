"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, RefreshCw } from "lucide-react";

// TAB 2 UMKM2Shell: MANAJER PROSES.
// GET /shell/proc · POST /shell/proc/sinyal (TERM/INT/KILL).
const API = process.env.API_URL ?? "http://localhost:8080";

type Proc = {
  pid: number;
  ppid: number;
  user: string;
  cmdline: string;
  cpu_pct: number;
  mem_kb: number;
  state: string;
};

type Stat = {
  mem_total_kb: number;
  mem_free_kb: number;
  mem_available_kb: number;
  load1: number;
  load5: number;
  proses_total: number;
  uptime_s: number;
};

export function TabProses({ goToken }: { goToken: string }) {
  const [proses, setProses] = useState<Proc[]>([]);
  const [stat, setStat] = useState<Stat | null>(null);
  const [pidSendiri, setPidSendiri] = useState<number>(0);
  const [pesan, setPesan] = useState<string | null>(null);
  const [saring, setSaring] = useState("");

  const muat = useCallback(async () => {
    const res = await fetch(`${API}/api/v1/shell/proc`, {
      headers: { Authorization: `Bearer ${goToken}` },
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: { proses: Proc[]; stat_sistem: Stat; pid_sendiri: number };
      error?: { message: string };
    };
    if (!json.success || !json.data) {
      setPesan(json.error?.message ?? "gagal memuat");
      return;
    }
    setProses(json.data.proses);
    setStat(json.data.stat_sistem);
    setPidSendiri(json.data.pid_sendiri);
    setPesan(null);
  }, [goToken]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const sinyal = async (pid: number, sig: number) => {
    const res = await fetch(`${API}/api/v1/shell/proc/sinyal`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${goToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pid, sinyal: sig }),
    });
    const json = (await res.json()) as {
      success: boolean;
      error?: { message: string };
    };
    setPesan(
      json.success
        ? `sinyal ${sig} terkirim ke pid ${pid}`
        : (json.error?.message ?? "gagal"),
    );
    void muat();
  };

  const terlihat = proses.filter((p) =>
    p.cmdline.toLowerCase().includes(saring.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}
      {stat && (
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Kartu judul="Memori" nilai={`${(stat.mem_available_kb / 1024 / 1024).toFixed(1)} / ${(stat.mem_total_kb / 1024 / 1024).toFixed(1)} GB`} />
          <Kartu judul="Load (1m)" nilai={stat.load1.toFixed(2)} />
          <Kartu judul="Proses" nilai={String(stat.proses_total)} />
          <Kartu judul="Uptime" nilai={`${Math.floor(stat.uptime_s / 3600)} jam`} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={saring}
          onChange={(e) => setSaring(e.target.value)}
          placeholder="saring cmdline…"
          className="w-56 rounded-lg border bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => void muat()}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"
        >
          <RefreshCw className="size-4" /> muat ulang
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">PID</th>
              <th className="p-3">Perintah</th>
              <th className="p-3">CPU%</th>
              <th className="p-3">Mem</th>
              <th className="p-3">Status</th>
              <th className="p-3">Sinyal</th>
            </tr>
          </thead>
          <tbody>
            {terlihat.map((p) => (
              <tr
                key={p.pid}
                className={`border-t odd:bg-muted/20 [&:hover]:bg-muted/40 ${
                  p.pid === pidSendiri ? "bg-sky-400/10" : ""
                }`}
              >
                <td className="p-3 tabular-nums">
                  {p.pid}
                  {p.pid === pidSendiri && (
                    <span className="ml-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-600">
                      server ini
                    </span>
                  )}
                </td>
                <td className="max-w-80 truncate p-3 font-mono text-xs">
                  {p.cmdline}
                </td>
                <td className="p-3 tabular-nums">{p.cpu_pct.toFixed(1)}</td>
                <td className="p-3 tabular-nums">
                  {(p.mem_kb / 1024).toFixed(1)} MB
                </td>
                <td className="p-3">{p.state}</td>
                <td className="p-3">
                  {p.pid === pidSendiri ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Ban className="size-3" /> terlindungi
                    </span>
                  ) : (
                    <span className="inline-flex gap-1">
                      {[["TERM", 15], ["KILL", 9]].map(([label, sig]) => (
                        <button
                          key={label as string}
                          onClick={() => void sinyal(p.pid, sig as number)}
                          className="rounded border border-rose-400/50 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-400/10"
                        >
                          {label as string}
                        </button>
                      ))}
                    </span>
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

function Kartu({ judul, nilai }: { judul: string; nilai: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {judul}
      </div>
      <div className="text-base font-semibold tabular-nums">{nilai}</div>
    </div>
  );
}
