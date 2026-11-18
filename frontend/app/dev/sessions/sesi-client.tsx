"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";

// Tabel + tombol tendang sesi (aksi DELETE /admin/sessions/{sid}).
// Baris pemanggil sendiri TIDAK punya tombol (backend juga menolaknya —
// dua lapis: UI menyembunyikan, Go menegas).
type Baris = {
  id: string;
  user_id: number;
  user_name: string;
  user_role: string;
  ip: string;
  created_at: string;
  last_seen: string;
  expires_at: string;
  revoked_at?: string | null;
  pendapatan: string;
};

export function SesiClient({
  baris,
  goToken,
}: {
  baris: Baris[];
  goToken: string;
}) {
  const router = useRouter();
  const [sedang, setSedang] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  async function tendang(sid: string) {
    setSedang(sid);
    setPesan(null);
    try {
      const res = await fetch(
        `${process.env.API_URL ?? "http://localhost:8080"}/api/v1/admin/sessions/${sid}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${goToken}` },
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!json.success) {
        setPesan(json.error?.message ?? "gagal");
        return;
      }
      router.refresh();
    } finally {
      setSedang(null);
    }
  }

  if (baris.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Tidak ada sesi dalam 24 jam terakhir.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Pengguna</th>
              <th className="p-3">Peran</th>
              <th className="p-3">IP</th>
              <th className="p-3">Masuk</th>
              <th className="p-3">Terakhir Aktif</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr
                key={b.id}
                className="border-t odd:bg-muted/20 [&:hover]:bg-muted/40"
              >
                <td className="p-3 font-medium">{b.user_name}</td>
                <td className="p-3">{b.user_role}</td>
                <td className="p-3 tabular-nums">{b.ip || "—"}</td>
                <td className="p-3">
                  {new Date(b.created_at).toLocaleString("id-ID")}
                </td>
                <td className="p-3">
                  {new Date(b.last_seen).toLocaleString("id-ID")}
                </td>
                <td className="p-3">
                  {b.revoked_at ? (
                    <span className="text-amber-600">dicabut</span>
                  ) : (
                    <span className="text-emerald-600">hidup</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {!b.revoked_at && (
                    <button
                      onClick={() => tendang(b.id)}
                      disabled={sedang === b.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-400/50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-400/10 disabled:opacity-50"
                    >
                      <ShieldOff className="size-3.5" />
                      {sedang === b.id ? "menendang…" : "Tendang"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
