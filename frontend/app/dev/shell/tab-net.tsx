"use client";

import { useState } from "react";
import { Globe, Wifi } from "lucide-react";

// TAB 5 UMKM2Shell: JARINGAN — ping TCP + HTTP HEAD.
const API = process.env.API_URL ?? "http://localhost:8080";

export function TabNet({ goToken }: { goToken: string }) {
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("5432");
  const [hasilPing, setHasilPing] = useState<string | null>(null);
  const [url, setUrl] = useState("http://localhost:8080/health");
  const [hasilHttp, setHasilHttp] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const ping = async () => {
    setSibuk(true);
    setHasilPing(null);
    try {
      const res = await fetch(`${API}/api/v1/shell/net/ping`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${goToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ host, port }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { hidup: boolean; latensi_ms: number };
        error?: { message: string };
      };
      setHasilPing(
        json.success && json.data
          ? `${host}:${port} HIDUP — ${json.data.latensi_ms.toFixed(2)} ms`
          : (json.error?.message ?? "gagal"),
      );
    } finally {
      setSibuk(false);
    }
  };

  const http = async () => {
    setSibuk(true);
    setHasilHttp(null);
    try {
      const res = await fetch(`${API}/api/v1/shell/net/http`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${goToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { status: number; latensi_ms: number };
        error?: { message: string };
      };
      setHasilHttp(
        json.success && json.data
          ? `HTTP ${json.data.status} — ${json.data.latensi_ms.toFixed(2)} ms`
          : (json.error?.message ?? "gagal"),
      );
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <header className="flex items-center gap-2 font-semibold">
          <Wifi className="size-5 text-sky-500" /> Ping TCP
        </header>
        <p className="text-xs text-muted-foreground">
          Sambung ke host:port dalam 5 detik — cocok memeriksa Postgres
          pusat/salinan masih hidup.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-40 rounded-lg border bg-background px-3 py-1.5 font-mono text-sm"
          />
          <span className="text-muted-foreground">:</span>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-20 rounded-lg border bg-background px-3 py-1.5 font-mono text-sm"
          />
          <button
            onClick={() => void ping()}
            disabled={sibuk}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Ping
          </button>
        </div>
        {hasilPing && (
          <p className="rounded-lg border bg-muted/40 p-3 font-mono text-xs">
            {hasilPing}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <header className="flex items-center gap-2 font-semibold">
          <Globe className="size-5 text-sky-500" /> HTTP HEAD
        </header>
        <p className="text-xs text-muted-foreground">
          HEAD ringan 5 detik; redirect tidak diikuti (panel bukan
          proxy).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full max-w-md rounded-lg border bg-background px-3 py-1.5 font-mono text-sm"
          />
          <button
            onClick={() => void http()}
            disabled={sibuk}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Periksa
          </button>
        </div>
        {hasilHttp && (
          <p className="rounded-lg border bg-muted/40 p-3 font-mono text-xs">
            {hasilHttp}
          </p>
        )}
      </section>
    </div>
  );
}
