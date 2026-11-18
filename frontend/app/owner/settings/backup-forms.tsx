"use client";

// RUN-7 (frontend 1.4.0) — bagian Pengaturan: CADANGAN DATA + STATUS
// SALINAN DATABASE. Permintaan pemilik dipenuhi dua arah:
//   - tombol "Cadangkan Data Sekarang" = backup KAPAN PUN (dump gzip
//     SQL di volume backups, retensi otomatis);
//   - status node: PUSAT/SALINAN yang sedang melayani + riwayat
//     perpindahan (failover saat pusat down, sinkron balik + failback
//     saat pulih) + tombol pindah manual + pulihkan cadangan.
//
// Status dibaca server-side saat render (bacaDbStatus) lalu dikirim ke
// komponen ini sebagai props — aksi (cadangkan/pulihkan/pindah) lewat
// server actions di backup-actions.ts (token Bearer tidak pernah
// sampai ke browser).

import { useActionState } from "react";
import {
  CheckCircle2,
  Database,
  DatabaseBackup,
  History,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { DbStatus } from "@/lib/backup";
import { formatUkuran, labelNode, pesanSebab } from "@/lib/backup";
import {
  jalankanBackup,
  pindahNodeDb,
  pulihkanBackup,
  type BackupActionState,
} from "./backup-actions";

const AWAL: BackupActionState = { ok: false, message: "" };

function Pesan({ s }: { s: BackupActionState }) {
  if (!s.message) return null;
  const baik = s.ok;
  return (
    <p
      className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${
        baik
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
      }`}
    >
      {s.message}
    </p>
  );
}

export function BackupForm({ status, daftar }: {
  status: DbStatus | null;
  daftar: { nama: string; ukuran: number; dibuat: string }[];
}) {
  const [runState, runAction, runPending] = useActionState(jalankanBackup, AWAL);
  const [restoreState, restoreAction] = useActionState(pulihkanBackup, AWAL);
  const [pindahState, pindahAction] = useActionState(pindahNodeDb, AWAL);

  const nodeAktif = status?.node_aktif ?? "pusat";
  const diSalinan = nodeAktif === "salinan";
  const riwayat = status?.riwayat_pindahan ?? [];

  return (
    <div className="space-y-6">
      {/* ---- Cadangkan Data (tombol + daftar berkas) ---- */}
      <div className="rounded-2xl glass-card p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <DatabaseBackup className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Cadangkan Data
        </h3>
        <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">
          Salinan penuh database warung (SQL terkompresi, bisa dibaca
          manusia) tersimpan di volume <code>backups</code> container.
          Otomatis tiap{" "}
          {status ? Math.round((status.backup_interval_s || 3600) / 60) : 60}{" "}
          menit; menyimpan {status?.backup_keep ?? 48} berkas terbaru.
        </p>
        <form action={runAction}>
          <button
            type="submit"
            disabled={runPending}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {runPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DatabaseBackup className="h-4 w-4" />
            )}
            Cadangkan Data Sekarang
          </button>
        </form>
        <Pesan s={runState} />

        {daftar.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Berkas cadangan</th>
                  <th className="px-3 py-2 font-semibold">Waktu</th>
                  <th className="px-3 py-2 font-semibold">Ukuran</th>
                  <th className="px-3 py-2 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daftar.slice(0, 10).map((b) => (
                  <tr key={b.nama} className="text-slate-700 dark:text-slate-300">
                    <td className="px-3 py-2 font-mono text-[11px]">{b.nama}</td>
                    <td className="px-3 py-2">{b.dibuat}</td>
                    <td className="px-3 py-2">{formatUkuran(b.ukuran)}</td>
                    <td className="px-3 py-2">
                      <form action={restoreAction} className="inline">
                        <input type="hidden" name="nama" value={b.nama} />
                        <button
                          type="submit"
                          className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition hover:border-indigo-400 hover:text-indigo-600"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Pulihkan
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          Pulihkan menimpa node yang sedang aktif dengan isi berkas
          cadangan (tabel dibuat ulang lalu diisi) — pastikan memilih
          berkas yang benar. Berkas juga bisa diunduh manual dari
          folder <code>backups</code> di Docker.
        </p>
        <Pesan s={restoreState} />
      </div>

      {/* ---- Status Salinan Database ---- */}
      <div className="rounded-2xl glass-card p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          Status Salinan Database
        </h3>
        <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">
          Ketika database pusat down, node <b>salinan</b> otomatis
          mengambil alih; ketika pusat pulih, seluruh perubahan zaman
          salinan disinkronkan balik lalu pusat kembali melayani.
        </p>

        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold ${
            diSalinan
              ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          }`}
        >
          {diSalinan ? (
            <TriangleAlert className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          Node aktif sekarang: {labelNode(nodeAktif)}
          {diSalinan && (
            <span className="text-xs font-normal">
              (pusat sedang down — transaksi tetap tercatat di salinan)
            </span>
          )}
        </div>

        {!status?.salinan_aktif && (
          <p className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-slate-400" />
            Mode satu database: <code>DATABASE_REPLICA_URL</code> belum
            diatur. Cadangan data tetap berfungsi penuh; aktifkan service{" "}
            <code>db-salinan</code> di docker-compose untuk salinan
            otomatis.
          </p>
        )}

        {status?.salinan_aktif && (
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={pindahAction}>
              <input type="hidden" name="ke" value={diSalinan ? "pusat" : "salinan"} />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:border-cyan-400 hover:text-cyan-600"
              >
                <Database className="h-3.5 w-3.5" />
                Pindah manual ke {diSalinan ? "Pusat" : "Salinan"}
              </button>
            </form>
            <span className="self-center text-[11px] text-slate-400">
              Pemindahan manual menjalankan sinkron balik dulu saat
              kembali ke pusat.
            </span>
          </div>
        )}
        <Pesan s={pindahState} />

        {riwayat.length > 0 && (
          <div className="mt-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <History className="h-3.5 w-3.5" />
              Riwayat perpindahan node
            </h4>
            <ul className="mt-2 space-y-1.5">
              {riwayat.slice(0, 5).map((p, i) => (
                <li
                  key={`${p.waktu}-${i}`}
                  className="flex flex-wrap items-baseline gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className="font-mono text-[11px] text-slate-400">
                    {p.waktu}
                  </span>
                  <span className="font-semibold">{labelNode(p.ke)}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {pesanSebab(p)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
