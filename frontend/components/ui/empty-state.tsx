import Link from "next/link";
import { ArrowRight, Inbox, type LucideIcon } from "lucide-react";

// Keadaan kosong UMKM OS v1.0.0, placeholder ramah saat belum ada data,
// lengkap dengan aksi lanjutan opsional. Aman dari server component.

export function EmptyState({
  icon: Ikon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const PilihanIkon = Ikon ?? Inbox;
  return (
    <div className="flex flex-wrap items-center gap-4 py-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-shell-soft text-shell-muted">
        <PilihanIkon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-shell-ink-soft">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-shell-muted">
          {description}
        </p>
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="flex shrink-0 items-center gap-1.5 py-2 pl-2 pr-1 text-[11px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
