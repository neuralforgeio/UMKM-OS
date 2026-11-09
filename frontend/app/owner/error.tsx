"use client";

// Jaring pengaman error boundary untuk SELURUH segmen /owner (dipasang
// saat persiapan rilis publik): sebelumnya kegagalan Server Component di
// build produksi Next.js 16 tampil sebagai "React error #441" + digest
// pada halaman hitam yang tidak menjelaskan apa pun. Kini pemilik warung
// melihat pesan berbahasa Indonesia, kode ringkas untuk laporan, dan
// tombol coba lagi — tanpa perlu membuka DevTools.
//
// Halaman berat seperti /owner/transactions sudah punya panel diagnosis
// sendiri untuk kegagalan backend (lihat backend-adapter.ts); file ini
// hanya menangkap kegagalan yang TIDAK terduga (bug kode baru dsb).

import { unstable_rethrow } from "next/navigation";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function OwnerSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Sinyal framework (redirect()/notFound()) tidak boleh ditelan
  // error boundary — biarkan Next.js yang menanganinya.
  unstable_rethrow(error);

  useEffect(() => {
    console.error("[/owner] galat render:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl glass-card p-8" role="alert">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Halaman ini gagal dimuat
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Terjadi galat saat menyiapkan halaman. Data Anda aman di
              database. Coba muat ulang — bila berlanjut, laporkan kode
              galat di bawah ini kepada developer.
            </p>
            {error.digest ? (
              <p className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                Kode galat: {error.digest}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-900 transition-colors hover:bg-slate-700 dark:hover:bg-slate-300"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Coba Lagi
              </button>
              <a
                href="/owner"
                className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Kembali ke Menu Utama
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
