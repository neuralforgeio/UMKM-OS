import {
  CheckCircle2,
  Info,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

// Peringatan dalam halaman (alert) UMKM OS v1.0.0, buatan sendiri.
//
// Dipakai untuk pesan yang harus tetap terlihat di dalam konten (bukan
// pesan singkat): kegagalan muat data, peringatan validasi angka OSCAR,
// atau informasi penting lain. Aman dari server component.

export type AlertVariant = "sukses" | "info" | "peringatan" | "galat";

const VARIAN: Record<
  AlertVariant,
  { ikon: LucideIcon; bingkai: string; ikonWarna: string }
> = {
  sukses: {
    ikon: CheckCircle2,
    bingkai: "border-shell-ok/30 bg-shell-ok/10",
    ikonWarna: "text-shell-ok",
  },
  info: {
    ikon: Info,
    bingkai: "border-shell-primary/25 bg-shell-primary/10",
    ikonWarna: "text-shell-primary-strong",
  },
  peringatan: {
    ikon: TriangleAlert,
    bingkai: "border-shell-warn/35 bg-shell-warn/10",
    ikonWarna: "text-shell-warn",
  },
  galat: {
    ikon: OctagonAlert,
    bingkai: "border-shell-bad/35 bg-shell-bad/10",
    ikonWarna: "text-shell-bad",
  },
};

export function UiAlert({
  variant = "info",
  title,
  children,
  className = "",
}: {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const cfg = VARIAN[variant];
  const Ikon = cfg.ikon;
  return (
    <div
      role={variant === "galat" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bingkai} ${className}`}
    >
      <Ikon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.ikonWarna}`} />
      <div className="min-w-0 flex-1">
        {title && (
          <p className="text-xs font-bold leading-tight text-shell-ink">
            {title}
          </p>
        )}
        <div className="text-xs leading-relaxed text-shell-ink-soft">
          {children}
        </div>
      </div>
    </div>
  );
}
