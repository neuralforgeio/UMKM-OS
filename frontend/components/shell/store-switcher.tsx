"use client";

// Pemilih outlet di sidebar UMKM OS v1.0.0, PERBAIKAN logo warung.
//
// Akar masalah lama: setiap halaman merender logo warung dengan cara
// sendiri sehingga sebagian halaman kehilangan ikonnya. Kini komponen ini
// satu satunya pemilik tampilan identitas outlet: logo diambil dari
// /api/outlet/logo berpenyangga versi (naik setiap unggah ulang), dan
// ketika gambar gagal dimuat ia jatuh ke ubin inisial dengan anggun.
// Karena dipakai sidebar yang sama di semua halaman, logo warung kini
// selalu tampil sama di mana pun pengguna berada.

import { useEffect, useState } from "react";
import { initialsOf } from "@/lib/avatar";
import { log } from "@/lib/ui/log";

export function StoreSwitcher({
  name,
  logoUrl,
  address,
  collapsed,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
  collapsed: boolean;
}) {
  const [rusak, setRusak] = useState(false);

  // Versi logo berubah (unggah baru) wajib mencoba memuat ulang: tanpa
  // reset ini satu kali gagal membuat sidebar terjebak di inisial selamanya.
  useEffect(() => {
    setRusak(false);
  }, [logoUrl]);

  const tampilkanGambar = logoUrl !== null && !rusak;
  const sembunyiText = collapsed ? "lg:hidden" : "";

  return (
    <div
      className={`mx-3 mb-5 flex items-center gap-3 rounded-xl border border-shell-line bg-shell-soft px-3 py-2.5 ${
        collapsed ? "lg:justify-center lg:px-0" : ""
      }`}
      title={collapsed ? name : undefined}
    >
      {tampilkanGambar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`Logo ${name}`}
          className="h-9 w-9 shrink-0 rounded-[10px] border border-shell-line object-cover"
          onError={() => {
            setRusak(true);
            log.peringatan("sidebar", "logo warung gagal dimuat, memakai inisial", {
              outlet: name,
            });
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#f0b77e] to-[#875c9c] text-xs font-bold text-[#191627]"
        >
          {initialsOf(name)}
        </div>
      )}
      <div className={`min-w-0 flex-1 ${sembunyiText}`}>
        <p className="truncate text-xs font-bold leading-tight text-shell-ink">
          {name}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-tight text-shell-muted">
          {address && address.trim() !== "" ? address : "Outlet aktif"}
        </p>
      </div>
    </div>
  );
}
