// Kepala halaman konten shell UMKM OS v1.0.0, alis kecil, judul besar,
// deskripsi, dan slot aksi di kanan. Komponen ini aman dipakai dari
// server component (tanpa state).

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-shell-primary-strong">
            <span aria-hidden="true" className="h-px w-4 bg-shell-primary" />
            {eyebrow}
          </div>
        )}
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-shell-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-shell-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
