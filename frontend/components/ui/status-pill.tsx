// Pil status UMKM OS v1.0.0, lencana kecil untuk status transaksi,
// stok, dan verifikasi. Aman dari server component.

export type PillTone = "ok" | "warn" | "bad" | "netral" | "primary" | "cyan";

const TONE: Record<PillTone, string> = {
  ok: "bg-shell-ok/12 text-shell-ok",
  warn: "bg-shell-warn/14 text-shell-warn",
  bad: "bg-shell-bad/12 text-shell-bad",
  netral: "bg-shell-soft text-shell-muted",
  primary: "bg-shell-primary/12 text-shell-primary-strong",
  cyan: "bg-shell-cyan/12 text-shell-cyan",
};

export function StatusPill({
  tone = "netral",
  children,
  title,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
