import Link from "next/link";

// Tombol tautan utama UMKM OS v1.0.0, dipakai untuk aksi utama pada
// kepala halaman (misal "Transaksi baru" menuju kasir).

export function PrimaryLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className="inline-flex items-center gap-2 rounded-xl bg-shell-primary px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-shell-primary/25 transition hover:bg-shell-primary-strong"
    >
      {children}
    </Link>
  );
}

export function GhostLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className="inline-flex items-center gap-2 rounded-xl border border-shell-line bg-shell-card px-4 py-2.5 text-xs font-bold text-shell-ink-soft transition hover:border-shell-line-strong hover:text-shell-ink"
    >
      {children}
    </Link>
  );
}
