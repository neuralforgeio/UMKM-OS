import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

// Kartu akses cepat UMKM OS v1.0.0, tautan besar berikon untuk beranda
// (Kasir, Laporan Pemilik, Kelola Produk). Aman dari server component.

export function ActionCard({
  href,
  icon: Ikon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-shell-line bg-shell-card p-4 text-left transition hover:border-shell-primary/50 hover:bg-shell-raised sm:p-5"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-shell-line bg-shell-soft text-shell-primary-strong">
        <Ikon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold tracking-tight text-shell-ink">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-shell-muted">
          {description}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-shell-muted transition group-hover:translate-x-0.5 group-hover:text-shell-primary-strong" />
    </Link>
  );
}
