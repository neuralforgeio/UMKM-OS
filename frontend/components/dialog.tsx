"use client";

// PenyajiNotif + DialogKonfirmasi + DialogTeks (v1.7.1): komponen
// UI pengganti alert/confirm/prompt bawaan browser. Satu provider
// dipasang di layout akar; komponen mana pun bisa memakai
// useNotif() untuk toast dan <DialogKonfirmasi> untuk konfirmasi.

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

// NOTE: toast sudah dilayani components/ui/toast.tsx (ToastProvider
// terpasang di layout akar; useToast().show untuk pesan singkat).
// Berkas ini menyediakan DIALOG: pengganti confirm() dan prompt().

// validasiKonfirmasiTeks: teks konfirmasi literal harus cocok persis
// (mis. "MATIKAN") sebelum tombol berbahaya aktif.
function validasiKonfirmasiTeks(teks: string, harus: string): boolean {
  return teks.trim() === harus;
}

// DialogKonfirmasi: pengganti window.confirm, janji { yakin }.
export function DialogKonfirmasi({
  judul,
  pesan,
  teksTombol = "Ya, lanjutkan",
  merah = false,
  buka,
  onClose,
}: {
  judul: string;
  pesan: string;
  teksTombol?: string;
  merah?: boolean;
  buka: boolean;
  onClose: (hasil: { yakin: boolean }) => void;
}) {
  useEscapeTutup(buka, () => onClose({ yakin: false }));
  if (!buka) return null;
  return (
    <LatarDialog onClose={() => onClose({ yakin: false })}>
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          {merah ? (
            <ShieldAlert className="mt-0.5 size-6 shrink-0 text-rose-500" />
          ) : (
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-500" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold">{judul}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{pesan}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onClose({ yakin: false })}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={() => onClose({ yakin: true })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              merah
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {teksTombol}
          </button>
        </div>
      </div>
    </LatarDialog>
  );
}

// DialogTeks: pengganti window.prompt, janji { yakin, teks }.
// konfirmasiLiteral (mis. "MATIKAN") membuat tombol utama hanya aktif
// saat teks cocok persis (guard aksi berbahaya).
export function DialogTeks({
  judul,
  pesan,
  placeholder,
  konfirmasiLiteral,
  teksTombol = "Lanjutkan",
  merah = false,
  buka,
  onClose,
}: {
  judul: string;
  pesan: string;
  placeholder?: string;
  konfirmasiLiteral?: string;
  teksTombol?: string;
  merah?: boolean;
  buka: boolean;
  onClose: (hasil: { yakin: boolean; teks?: string }) => void;
}) {
  const [teks, setTeks] = useState("");
  const masuk = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (buka) {
      setTeks("");
      setTimeout(() => masuk.current?.focus(), 30);
    }
  }, [buka]);
  useEscapeTutup(buka, () => onClose({ yakin: false }));
  if (!buka) return null;
  const siap = !konfirmasiLiteral || validasiKonfirmasiTeks(teks, konfirmasiLiteral);
  return (
    <LatarDialog onClose={() => onClose({ yakin: false })}>
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className={`mt-0.5 size-6 shrink-0 ${merah ? "text-rose-500" : "text-amber-500"}`}
          />
          <div className="min-w-0">
            <h3 className="font-semibold">{judul}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{pesan}</p>
          </div>
        </div>
        <input
          ref={masuk}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder={placeholder ?? konfirmasiLiteral}
          className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm"
        />
        {konfirmasiLiteral && (
          <p className="text-xs text-muted-foreground">
            Ketik <span className="font-mono">{konfirmasiLiteral}</span> untuk
            mengaktifkan tombol.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onClose({ yakin: false })}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={() => onClose({ yakin: true, teks })}
            disabled={!siap}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              merah
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {teksTombol}
          </button>
        </div>
      </div>
    </LatarDialog>
  );
}

// DialogTunggu: pengganti status "memproses" (mis. mematikan server).
export function DialogTunggu({ judul, pesan }: { judul: string; pesan: string }) {
  return (
    <LatarDialog onClose={() => undefined}>
      <div className="w-full max-w-xs space-y-3 rounded-2xl border bg-card p-5 text-center shadow-xl">
        <Loader2 className="mx-auto size-8 animate-spin text-sky-500" />
        <h3 className="font-semibold">{judul}</h3>
        <p className="text-sm text-muted-foreground">{pesan}</p>
      </div>
    </LatarDialog>
  );
}

// LatarDialog: latar gelap + klik luar menutup + scroll terkunci.
function LatarDialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

function useEscapeTutup(buka: boolean, tutup: () => void) {
  useEffect(() => {
    if (!buka) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [buka, tutup]);
}
