// Panel konten UMKM OS v1.0.0, kartu datar berbatas halus dengan kepala
// opsional (judul, subjudul, slot aksi). Dasar seluruh tata letak
// halaman shell. Aman dari server component.

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-shell-line bg-shell-card ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-xs font-bold tracking-tight text-shell-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-[10px] leading-relaxed text-shell-muted">
                {subtitle}
              </p>
            )}
          </div>
          {action && (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          )}
        </header>
      )}
      <div className={`px-5 py-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
