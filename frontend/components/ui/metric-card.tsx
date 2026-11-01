import type { LucideIcon } from "lucide-react";

// Kartu metrik UMKM OS v1.0.0, angka besar dengan label kecil, ikon
// bertonal, dan baris kaki penjelas. Aman dari server component.

export type MetricTone = "primary" | "ok" | "warn" | "bad" | "cyan";

const TONE: Record<MetricTone, { ubin: string }> = {
  primary: { ubin: "bg-shell-primary/12 text-shell-primary-strong" },
  ok: { ubin: "bg-shell-ok/12 text-shell-ok" },
  warn: { ubin: "bg-shell-warn/12 text-shell-warn" },
  bad: { ubin: "bg-shell-bad/12 text-shell-bad" },
  cyan: { ubin: "bg-shell-cyan/12 text-shell-cyan" },
};

export function MetricCard({
  label,
  value,
  foot,
  icon: Ikon,
  tone = "primary",
}: {
  label: string;
  value: string;
  foot?: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
}) {
  const cfg = TONE[tone];
  return (
    <article className="rounded-2xl border border-shell-line bg-shell-card p-4 transition hover:border-shell-line-strong sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-shell-muted">
          {label}
        </p>
        {Ikon && (
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${cfg.ubin}`}
          >
            <Ikon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums tracking-tight text-shell-ink sm:text-2xl">
        {value}
      </p>
      {foot && (
        <div className="mt-1.5 text-[11px] leading-relaxed text-shell-muted">
          {foot}
        </div>
      )}
    </article>
  );
}
