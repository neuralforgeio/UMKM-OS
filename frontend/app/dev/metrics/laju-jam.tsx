// Grafik batang laju transaksi per jam (murni CSS div — tanpa pustaka
// chart supaya halaman dev tetap ringan dan responsif).
export function LajuJam({ perJam }: { perJam: { jam: number; trx: number }[] }) {
  if (perJam.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Belum ada transaksi hari ini.
      </p>
    );
  }
  const maks = Math.max(...perJam.map((p) => p.trx), 1);
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
        Laju Transaksi per Jam (hari ini)
      </div>
      <div className="flex items-end gap-1 overflow-x-auto">
        {perJam.map((p) => (
          <div
            key={p.jam}
            className="flex min-w-8 flex-1 flex-col items-center gap-1"
          >
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {p.trx}
            </span>
            <div
              className="w-full rounded-t bg-sky-500/80"
              style={{ height: `${Math.max((p.trx / maks) * 120, 4)}px` }}
              title={`${p.jam}:00 — ${p.trx} transaksi`}
            />
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {String(p.jam).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
