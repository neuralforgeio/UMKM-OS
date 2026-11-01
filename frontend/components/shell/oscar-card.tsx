import Link from "next/link";
import { Sparkles } from "lucide-react";
import { OSCAR_NAME } from "@/lib/oscar";

// Kartu ajakan OSCAR di sidebar (khusus pemilik): pintasan cepat ke
// halaman asisten. Nama panjang OSCAR ditampilkan di halaman asistennya
// sendiri dan di topbar halaman tersebut.

export function OscarCard() {
  return (
    <Link
      href="/owner/assistant"
      className="relative mx-3 mb-4 block overflow-hidden rounded-2xl border border-shell-primary/20 bg-gradient-to-br from-shell-primary/15 to-shell-cyan/10 p-3.5 transition hover:border-shell-primary/40"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-shell-primary text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-bold text-shell-ink">
            Tanya {OSCAR_NAME}
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-shell-muted">
          Butuh ringkasan penjualan atau saran stok? {OSCAR_NAME} siap
          membantu dari data warung Anda.
        </p>
        <span className="mt-2 block text-[10px] font-bold text-shell-primary-strong">
          Mulai percakapan
        </span>
      </div>
      <span
        aria-hidden="true"
        className="absolute -right-7 -top-9 h-[90px] w-[90px] rounded-full bg-shell-primary/15 blur-[6px]"
      />
    </Link>
  );
}
