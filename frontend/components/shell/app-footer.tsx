// Kaki halaman shell UMKM OS v1.1.0, identitas aplikasi dan nama outlet.

export function AppFooter({ outletName }: { outletName: string }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-shell-line py-5 text-[10px] text-shell-muted">
      <span>© 2026 UMKM OS v1.1</span>
      <span className="truncate">{outletName}</span>
    </footer>
  );
}
