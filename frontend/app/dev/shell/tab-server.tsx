"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Brain,
  Gauge,
  Power,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

// TAB 6 UMKM2Shell: KENDALI & PREDIKSI SERVER (run-13, backend 2.4.0).
// GET /shell/server/kesehatan · GET /shell/server/prediksi ·
// POST /shell/server/matikan · GET /shell/server/status.
const API = process.env.API_URL ?? "http://localhost:8080";

type Kesehatan = {
  db_hidup: boolean;
  rasio_error_http: number;
  total_http: number;
  http_500: number;
  mem_tersedia_kb: number;
  mem_total_kb: number;
  load1: number;
  goroutine: number;
  uptime_s: number;
  p95_ms: number;
  verdict: string;
  alasan: string[];
};

type Prediksi = {
  tren_mem: number;
  tren_error: number;
  tren_p95_ms: number;
  menit_kritis: number;
  verdict: string;
  alasan: string[];
  jumlah_sampel: number;
};

export function TabServer({ goToken }: { goToken: string }) {
  const [kes, setKes] = useState<Kesehatan | null>(null);
  const [pred, setPred] = useState<Prediksi | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyalakanMatikan, setMenyalakanMatikan] = useState(false);

  const muat = useCallback(async () => {
    const [rk, rp] = await Promise.all([
      fetch(`${API}/api/v1/shell/server/kesehatan`, {
        headers: { Authorization: `Bearer ${goToken}` },
      }).then((r) => r.json()),
      fetch(`${API}/api/v1/shell/server/prediksi`, {
        headers: { Authorization: `Bearer ${goToken}` },
      }).then((r) => r.json()),
    ]);
    if (rk.success) setKes(rk.data);
    if (rp.success) setPred(rp.data);
  }, [goToken]);

  useEffect(() => {
    void muat();
    const tik = setInterval(() => void muat(), 15000);
    return () => clearInterval(tik);
  }, [muat]);

  const matikan = async () => {
    const konfirmasi = prompt(
      "Ketik MATIKAN (huruf besar) untuk mematikan server dengan rapi. Server tidak bisa dihidupkan lagi dari panel — hidupkan lewat docker compose / runner.",
    );
    if (konfirmasi !== "MATIKAN") {
      setPesan("konfirmasi tidak cocok — server tetap jalan");
      return;
    }
    setMenyalakanMatikan(true);
    try {
      const res = await fetch(`${API}/api/v1/shell/server/matikan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${goToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ konfirmasi }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { diminta: boolean };
        error?: { message: string };
      };
      setPesan(
        json.success && json.data?.diminta
          ? "permintaan diterima — server sedang mati dengan rapi (HTTP di-drain, DB ditutup, log di-flush)"
          : (json.error?.message ?? "gagal"),
      );
    } finally {
      setMenyalakanMatikan(false);
    }
  };

  const warnaVerdict = (v: string) =>
    v === "HIJAU" || v === "SEHAT"
      ? "text-emerald-600"
      : v === "KUNING" || v === "WASPADA"
        ? "text-amber-600"
        : v === "NA"
          ? "text-muted-foreground"
          : "text-rose-600";

  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}

      {kes && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <header className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <Activity className="size-5 text-sky-500" /> Kesehatan sekarang
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${warnaVerdict(kes.verdict)}`}
              >
                {kes.verdict}
              </span>
              <button
                onClick={() => void muat()}
                className="rounded-lg border px-2 py-1"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          </header>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Kartu
              judul="Database"
              nilai={kes.db_hidup ? "HIDUP" : "MATI"}
              kelas={kes.db_hidup ? "text-emerald-600" : "text-rose-600"}
            />
            <Kartu judul="Error 5xx" nilai={`${kes.http_500}/${kes.total_http} (${(kes.rasio_error_http * 100).toFixed(1)}%)`} />
            <Kartu judul="Latensi p95" nilai={`${kes.p95_ms.toFixed(0)} ms`} />
            <Kartu
              judul="Memori"
              nilai={`${(kes.mem_tersedia_kb / 1e6).toFixed(1)} / ${(kes.mem_total_kb / 1e6).toFixed(1)} GB`}
            />
            <Kartu judul="Load 1m" nilai={kes.load1.toFixed(2)} />
            <Kartu judul="Goroutine" nilai={String(kes.goroutine)} />
            <Kartu judul="Uptime" nilai={`${Math.floor(kes.uptime_s / 3600)} jam`} />
            <Kartu judul="5xx/HTTP" nilai={`${kes.http_500}/${kes.total_http}`} />
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {kes.alasan.map((a, i) => (
              <li key={i} className="flex items-start gap-1">
                <ShieldCheck className="mt-0.5 size-3 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pred && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <header className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <Brain className="size-5 text-violet-500" /> Prediksi down
            </h3>
            <span className={`text-sm font-bold ${warnaVerdict(pred.verdict)}`}>
              {pred.verdict}
            </span>
          </header>
          <p className="text-xs text-muted-foreground">
            Regresi linear atas {pred.jumlah_sampel} sampel (ring 5 detik,
            maks 30 menit) — memori tersedia, rasio error, latensi p95.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Kartu
              judul="Tren mem"
              nilai={`${(pred.tren_mem * 60 * 100).toFixed(2)}%/mnt`}
            />
            <Kartu
              judul="Tren error"
              nilai={`${(pred.tren_error * 60 * 100).toFixed(2)}%/mnt`}
            />
            <Kartu judul="Tren p95" nilai={`${(pred.tren_p95_ms * 60).toFixed(0)} ms/mnt`} />
            <Kartu
              judul="Kritis dalam"
              nilai={pred.menit_kritis > 0 ? `${pred.menit_kritis.toFixed(0)} mnt` : "—"}
            />
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {pred.alasan.map((a, i) => (
              <li key={i} className="flex items-start gap-1">
                <Gauge className="mt-0.5 size-3 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-rose-400/40 bg-rose-400/5 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-rose-600">
          <Power className="size-5" /> Matikan server (graceful)
        </h3>
        <p className="text-xs text-muted-foreground">
          Sama seperti Ctrl+C: HTTP di-drain 5 detik, koneksi database
          ditutup, log di-flush — bukan kill -9, tidak ada data setengah
          tulis. Menghidupkan lagi = docker compose / runner (panel tidak
          bisa menghidupkan sendiri).
        </p>
        <button
          onClick={() => void matikan()}
          disabled={menyalakanMatikan}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
        >
          {menyalakanMatikan ? "mematikan…" : "Matikan server"}
        </button>
      </section>
    </div>
  );
}

function Kartu({
  judul,
  nilai,
  kelas = "",
}: {
  judul: string;
  nilai: string;
  kelas?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {judul}
      </div>
      <div className={`text-base font-semibold tabular-nums ${kelas}`}>
        {nilai}
      </div>
    </div>
  );
}
