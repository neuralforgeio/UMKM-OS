"use client";

// Panel Asisten AI (frontend v2.4.0) — bubble chat tema aurora/glass.
//
// Komponen client murni presentasi + state lokal; seluruh gerbang
// sesi/role terjadi di route handler /api/assistant/*. Badge "Mode
// Data" vs "AI" memberi tahu pemilik kapan jawaban dibuat LLM dan
// kapan murni template data (jujur saat LLM belum dikonfigurasi).
// aria-live memakai pembaca layar ikut tahu jawaban baru datang.

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Database,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";

interface PesanPanel {
  role: "USER" | "ASSISTANT";
  content: string;
  mode?: "ai" | "data";
  numbersValidated?: boolean;
}

const CONTOH_TANYA = [
  "Berapa omzet hari ini?",
  "Stok apa yang menipis?",
  "Produk terlaris minggu ini?",
  "Kasih saran untuk minggu ini",
];

export function AssistantPanel({ outletName }: { outletName: string }) {
  const [pesan, setPesan] = useState<PesanPanel[]>([]);
  const [tanya, setTanya] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [mode, setMode] = useState<"ai" | "data" | null>(null);
  const [muatRiwayat, setMuatRiwayat] = useState(true);
  const ujungRef = useRef<HTMLDivElement | null>(null);

  // Muat riwayat sekali saat panel terbuka.
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const res = await fetch("/api/assistant/history", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const isi = (await res.json()) as {
          messages?: { role: "USER" | "ASSISTANT"; content: string }[];
        };
        if (hidup && isi.messages?.length) {
          setPesan(
            isi.messages.map((m) => ({ role: m.role, content: m.content })),
          );
        }
      } catch {
        // riwayat opsional — biarkan panel kosong
      } finally {
        if (hidup) setMuatRiwayat(false);
      }
    })();
    return () => {
      hidup = false;
    };
  }, []);

  // Gulir otomatis ke jawaban terbaru.
  useEffect(() => {
    ujungRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pesan.length, mengirim]);

  async function kirim(pertanyaan: string) {
    const bersih = pertanyaan.trim();
    if (!bersih || mengirim) return;
    setGalat(null);
    setTanya("");
    setPesan((p) => [...p, { role: "USER", content: bersih }]);
    setMengirim(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: bersih }),
      });
      const isi = (await res.json()) as {
        answer?: string;
        mode?: "ai" | "data";
        numbers_validated?: boolean;
        detail?: string;
      };
      if (!res.ok || typeof isi.answer !== "string") {
        setGalat(isi.detail ?? "Asisten gagal menjawab. Coba lagi.");
      } else {
        setMode(isi.mode ?? null);
        setPesan((p) => [
          ...p,
          {
            role: "ASSISTANT",
            content: isi.answer as string,
            mode: isi.mode,
            numbersValidated: isi.numbers_validated,
          },
        ]);
      }
    } catch {
      setGalat("Koneksi ke asisten terputus. Coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  const modeBadge =
    mode === "ai" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <Sparkles className="h-3.5 w-3.5" /> Mode AI
      </span>
    ) : mode === "data" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
        <Database className="h-3.5 w-3.5" /> Mode Data
      </span>
    ) : null;

  return (
    <div className="flex h-[min(72dvh,640px)] flex-col rounded-2xl glass-card">
      {/* Kepala panel */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/60">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
              Asisten Warung
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Jawab dari data {outletName} — bukan karangan.
            </p>
          </div>
        </div>
        {modeBadge}
      </div>

      {/* Alur pesan */}
      <div
        aria-live="polite"
        aria-label="Percakapan asisten"
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
      >
        {muatRiwayat && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…
          </div>
        )}
        {!muatRiwayat && pesan.length === 0 && (
          <div className="mx-auto max-w-sm space-y-3 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <Sparkles className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tanya apa saja tentang penjualan, stok, atau produk warungmu.
              Asisten menjawab HANYA dari data outlet ini.
            </p>
          </div>
        )}
        {pesan.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "USER"
                ? "flex justify-end"
                : "flex justify-start"
            }
          >
            <div
              className={
                m.role === "USER"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white"
                  : "max-w-[85%] space-y-1.5 rounded-2xl rounded-bl-md bg-white/80 px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm dark:bg-slate-900/70 dark:text-slate-200"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "ASSISTANT" && m.numbersValidated === false && (
                <p className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Angka jawaban belum lolos validasi data — periksa
                  dashboard sebelum bertindak.
                </p>
              )}
            </div>
          </div>
        ))}
        {mengirim && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2.5 text-sm text-slate-400 shadow-sm dark:bg-slate-900/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === "data" ? "Menyusun dari data…" : "Asisten berpikir…"}
            </div>
          </div>
        )}
        <div ref={ujungRef} />
      </div>

      {/* Contoh pertanyaan */}
      {pesan.length === 0 && !muatRiwayat && (
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {CONTOH_TANYA.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => kirim(c)}
              disabled={mengirim}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Galat ramah (termasuk 429 batas laju) */}
      {galat && (
        <p
          role="alert"
          className="mx-5 mb-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {galat}
        </p>
      )}

      {/* Kotak kirim */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          kirim(tanya);
        }}
        className="flex items-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-slate-700/60"
      >
        <label htmlFor="tanya-asisten" className="sr-only">
          Pertanyaan untuk asisten
        </label>
        <textarea
          id="tanya-asisten"
          value={tanya}
          onChange={(e) => setTanya(e.target.value)}
          onKeyDown={(e) => {
            // Enter kirim (Shift+Enter baris baru) — kebiasaan chat.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              kirim(tanya);
            }
          }}
          rows={1}
          maxLength={500}
          placeholder="Tanya omzet, stok, produk…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={mengirim || !tanya.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Kirim pertanyaan"
        >
          {mengirim ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
      <p className="px-5 pb-3 text-[11px] text-slate-400 dark:text-slate-500">
        Jawaban dibatasi data outlet ini · maks 500 karakter per
        pertanyaan · ada batas laju per jam.
      </p>
    </div>
  );
}
