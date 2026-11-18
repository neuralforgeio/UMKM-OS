import { AlertTriangle, CheckCircle2, Gauge, MemoryStick, Timer } from "lucide-react";

// Potret kesehatan dari GET /admin/health (v2.2.0). Data boleh null
// (backend belum siap / token habis) — kartu tetap tampil jujur
// dengan pita peringatan, bukan halaman rusak.
export function PotretKesehatan({
  sehat,
  gagal,
}: {
  sehat: {
    app_version: string;
    go_version: string;
    uptime_s: number;
    uptime: string;
    goroutine: number;
    mem_heap_mb: number;
    mem_sys_mb: number;
    num_gc: number;
    node_aktif: string;
    failover_n: number;
    db_sehat: boolean;
    sesi_hidup: number;
  } | null;
  gagal: boolean;
}) {
  if (gagal || !sehat) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
        <AlertTriangle className="size-5 text-amber-500" />
        Kesehatan sistem tidak terbaca sekarang — endpoint /admin/health
        backend 2.2.0 harus berjalan dengan sesi developer yang sah.
      </div>
    );
  }
  const sel = {
    app_version: sehat.app_version,
    go_version: sehat.go_version,
    uptime: sehat.uptime,
    goroutine: sehat.goroutine,
    mem_heap_mb: sehat.mem_heap_mb.toFixed(1),
    mem_sys_mb: sehat.mem_sys_mb.toFixed(1),
    num_gc: sehat.num_gc,
    node_aktif: sehat.node_aktif,
    failover_n: sehat.failover_n,
    db_sehat: sehat.db_sehat,
    sesi_hidup: sehat.sesi_hidup,
  };
  const kartu = [
    { judul: "Versi Aplikasi", nilai: sel.app_version, ikon: Gauge },
    { judul: "Uptime Proses", nilai: sel.uptime, ikon: Timer },
    { judul: "Memori Heap", nilai: `${sel.mem_heap_mb} MB`, ikon: MemoryStick },
    { judul: "Node Database", nilai: sel.node_aktif, ikon: CheckCircle2 },
    { judul: "Goroutine", nilai: String(sel.goroutine), ikon: Gauge },
    { judul: "Sesi Hidup", nilai: String(sel.sesi_hidup), ikon: Timer },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kartu.map((k) => (
        <div key={k.judul} className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <k.ikon className="size-4" />
            {k.judul}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {k.nilai}
          </div>
        </div>
      ))}
      <div className="rounded-xl border bg-card p-4 sm:col-span-2 lg:col-span-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            Go: <b className="tabular-nums">{sel.go_version}</b>
          </span>
          <span>
            GC: <b className="tabular-nums">{sel.num_gc}×</b>
          </span>
          <span>
            Memori sistem:{" "}
            <b className="tabular-nums">{sel.mem_sys_mb} MB</b>
          </span>
          <span>
            Failover tercatat:{" "}
            <b className="tabular-nums">{sel.failover_n}</b>
          </span>
          <span className={sel.db_sehat ? "text-emerald-600" : "text-amber-600"}>
            Database: <b>{sel.db_sehat ? "sehat" : "tidak merespons"}</b>
          </span>
        </div>
      </div>
    </section>
  );
}
