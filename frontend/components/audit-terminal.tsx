// Jendela terminal PowerShell untuk jejak audit (v2.2.1).
//
// Dipakai dua tempat: kartu "Jejak Audit Terbaru" di konsol /dev
// (variant="compact" — maks 320px, scroll internal) dan mode
// ?view=terminal di /dev/logs (variant="full" — tinggi viewport).
// Komponen ini murni presentasi: logika format/waktu/perintah ada di
// lib/audit-terminal.ts (murni, teruji unit test).
//
// INVARIANT: terminal SELALU GELAP — mode terang aplikasi tidak
// mengubah layar terminal (sama seperti kertas struk yang selalu
// putih). Semua kelas warna tekstual di atas latar #0a0f1e.

import type { ReactNode } from "react";
import {
  LEVEL_COLOR,
  PS_PROMPT,
  ROLE_COLOR,
  ROLE_COLOR_FALLBACK,
  terminalLine,
  type TerminalAuditRow,
} from "@/lib/audit-terminal";

type AuditTerminalProps = {
  /** Judul sesi di baris jendela (mis. "umkm-os — jejak audit — 20 terbaru"). */
  title: string;
  /** Isi perintah TANPA prompt — prompt dipasang komponen (lihat PS_PROMPT). */
  command: string;
  rows: TerminalAuditRow[];
  /** Sisi kanan kaki terminal: tautan / pagination (opsional). */
  footerRight?: ReactNode;
  /** compact: kartu konsol dev; full: mode terminal /dev/logs. */
  variant?: "compact" | "full";
  /** Baris komentar PowerShell di bawah perintah (legend / petunjuk). */
  note?: string;
};

export function AuditTerminal({
  title,
  command,
  rows,
  footerRight,
  variant = "compact",
  note,
}: AuditTerminalProps) {
  const bodyMax = variant === "full" ? "max-h-[62vh]" : "max-h-[320px]";
  const lines = rows.map(terminalLine);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0a0f1e] font-mono text-[11px] leading-relaxed text-slate-300 shadow-2xl shadow-slate-950/30 sm:text-xs">
      {/* Baris judul ala jendela terminal: tiga lampu + nama sesi. */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="h-3 w-3 shrink-0 rounded-full bg-rose-500/90" />
        <span className="h-3 w-3 shrink-0 rounded-full bg-amber-400/90" />
        <span className="h-3 w-3 shrink-0 rounded-full bg-emerald-500/90" />
        <p className="ml-2 min-w-0 truncate text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          {title}
        </p>
        <span className="ml-auto hidden shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 sm:inline">
          pwsh
        </span>
      </div>

      <div className={`overflow-y-auto ${bodyMax} px-4 py-3`}>
        {/* Perintah = peta filter aktif saat ini (bukan yang dieksekusi —
            sumber data tetap GET /audit-logs backend-go). */}
        <p className="whitespace-pre-wrap break-words">
          <span className="text-slate-500">{PS_PROMPT} </span>
          <span className="text-cyan-300">{command}</span>
        </p>
        {note && (
          <p className="mt-0.5 text-[10px] text-slate-600"># {note}</p>
        )}

        {lines.length === 0 ? (
          <p className="mt-3 text-amber-400">
            tidak ada hasil — longgarkan filter atau perlebar rentang
            tanggal.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-white/[0.06]">
            {lines.map((l) => (
              <div key={l.key} className="py-1.5">
                {/* Baris 1: waktu · tingkat · aktor · peran · outlet. */}
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {l.time}
                  </span>
                  <span
                    className={`shrink-0 font-bold ${LEVEL_COLOR[l.level]}`}
                  >
                    [{l.level}]
                  </span>
                  <span className="shrink-0 font-semibold text-slate-200">
                    {l.actor}
                  </span>
                  {l.role && (
                    <span
                      className={`shrink-0 text-[10px] font-bold ${ROLE_COLOR[l.role] ?? ROLE_COLOR_FALLBACK}`}
                    >
                      ·{l.role}
                    </span>
                  )}
                  {l.outlet && (
                    <span className="min-w-0 truncate text-[10px] text-sky-400/70">
                      @{l.outlet}
                    </span>
                  )}
                </p>
                {/* Baris 2: kode aksi · entitas · ringkasan. */}
                <p className="mt-0.5 pl-2 break-words">
                  <span className="font-semibold text-cyan-300">
                    {l.action}
                  </span>
                  {l.entity && (
                    <span className="text-slate-500"> {l.entity}</span>
                  )}
                  <span className="text-slate-600"> — </span>
                  <span className="text-slate-300">{l.detail}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kaki terminal: kursor berkedip + jumlah baris + tautan. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block h-3 w-1.5 animate-pulse rounded-[1px] bg-emerald-400/90" />
          {lines.length} baris
        </p>
        {footerRight ? <div className="min-w-0">{footerRight}</div> : null}
      </div>
    </div>
  );
}
