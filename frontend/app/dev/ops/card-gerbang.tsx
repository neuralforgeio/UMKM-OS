import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Kartu pintalan alat Gerbang Developer (halaman /dev/ops) — murni
// presentasi supaya bisa dipakai ulang tanpa logika.
export function CardGerbang({
  href,
  judul,
  ket,
  ikon: Ikon,
}: {
  href: string;
  judul: string;
  ket: string;
  ikon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border bg-card p-4 transition hover:border-sky-400/60 hover:shadow-md"
    >
      <Ikon className="mt-1 size-7 shrink-0 text-sky-500 transition group-hover:scale-110" />
      <div>
        <div className="font-semibold">{judul}</div>
        <div className="text-sm text-muted-foreground">{ket}</div>
      </div>
    </Link>
  );
}
