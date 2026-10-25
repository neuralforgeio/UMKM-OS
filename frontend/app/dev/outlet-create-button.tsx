"use client";

// Tombol "Outlet Baru" di konsol developer (Task 35). Pemilik warung
// menambah outlet dari sini tanpa harus membuka form akun — form akun
// punya jalur buat-outletnya sendiri ("+ Outlet baru…").
// Modal + controlled state: kalau gagal (nama kembar dsb.) semua isian
// tetap di layar beserta pesan errornya.
// v1.6.0: modal glass sadar tema (terang/gelap) mengikuti konsol dev.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, X } from "lucide-react";
import { createOutlet } from "./users/actions";

export function OutletCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startAsync] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Nama outlet minimal 2 karakter.");
      return;
    }
    const result = await createOutlet({
      name: trimmed,
      address: address.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Tabel outlet + omzet di halaman ini diambil ulang dari server.
    router.refresh();
    setOpen(false);
    setName("");
    setAddress("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-purple-500 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Outlet Baru
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-md sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Buat outlet baru"
        >
          <div className="glass-card relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border-slate-200/80 shadow-2xl sm:rounded-2xl dark:border-slate-800/80">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20">
                  <Building2 className="h-4 w-4" />
                </div>
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  Outlet baru
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300">
                  Nama outlet
                </label>
                <input
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Warung Bu Sari 2"
                  maxLength={60}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300">
                  Alamat (opsional)
                </label>
                <input
                  className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="mis. Jl. Merdeka No. 10"
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Outlet baru langsung bisa dipilih di form akun dan punya
                baris sendiri di tabel outlet. Pencatatan: OUTLET_CREATE.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => startAsync(handleSubmit)}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Buat Outlet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}