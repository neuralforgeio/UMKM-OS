"use client";

// Panel obrolan OSCAR UMKM OS v1.0.0, desain shell baru, perilaku lama.
//
// Komponen client murni presentasi + state lokal; seluruh gerbang
// sesi/peran terjadi di route handler /api/assistant/*. Lencana "Mode
// Data" vs "Mode AI" memberi tahu pemilik kapan jawaban dibuat model
// bahasa dan kapan murni dari data warung. aria-live membuat pembaca
// layar ikut tahu jawaban baru datang.
//
// Identitas: kepala panel memuat nama OSCAR beserta nama panjangnya
// (Online Shop Center for Assistance & Response).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Database,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { OSCAR_LONG_NAME, OSCAR_NAME } from "@/lib/oscar";

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
  "Siapa kamu?",
  "Saran minggu depan",
  "Jam paling ramai kapan?",
  "Siapa penciptamu?",
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
            isi.messages.map((m) => ({ role: m.role, content: m.content })));
        }
      } catch {
        // riwayat opsional, biarkan panel kosong
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
      <span className="inline-flex items-center gap-1 rounded-full bg-shell-ok/12 px-2.5 py-1 text-[11px] font-bold text-shell-ok">
        <Sparkles className="h-3.5 w-3.5" /> Mode AI
      </span>
    ) : mode === "data" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-shell-soft px-2.5 py-1 text-[11px] font-bold text-shell-muted">
        <Database className="h-3.5 w-3.5" /> Mode Data
      </span>
    ) : null;

  return (
    <div className="flex h-[min(74dvh,680px)] flex-col rounded-2xl border border-shell-line bg-shell-card">
      {/* Kepala panel */}
      <div className="flex items-center justify-between gap-3 border-b border-shell-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-shell-primary text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold leading-tight text-shell-ink">
              {OSCAR_NAME}
            </h2>
            <p className="truncate text-[11px] leading-tight text-shell-muted">
              {OSCAR_LONG_NAME}
            </p>
          </div>
        </div>
        {modeBadge}
      </div>

      {/* Alur pesan */}
      <div
        aria-live="polite"
        aria-label="Percakapan asisten"
        className="scroll-shell flex-1 space-y-3 overflow-y-auto px-5 py-4"
      >
        {muatRiwayat && (
          <div className="flex items-center gap-2 text-xs text-shell-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat
          </div>
        )}
        {!muatRiwayat && pesan.length === 0 && (
          <div className="mx-auto max-w-sm space-y-3 py-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-shell-primary/12">
              <Sparkles className="h-6 w-6 text-shell-primary-strong" />
            </div>
            <p className="text-xs leading-relaxed text-shell-muted">
              Tanyakan apa saja tentang penjualan, stok, atau produk
              {` ${outletName}`}. OSCAR menjawab hanya dari data outlet ini.
            </p>
          </div>
        )}
        {pesan.map((m, i) => (
          <div
            key={i}
            className={m.role === "USER" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "USER"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-shell-primary px-4 py-2.5 text-sm leading-relaxed text-white"
                  : "max-w-[85%] space-y-1.5 rounded-2xl rounded-bl-md bg-shell-soft px-4 py-2.5 text-sm leading-relaxed text-shell-ink"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "ASSISTANT" && m.numbersValidated === false && (
                <p className="flex items-center gap-1.5 rounded-lg bg-shell-warn/12 px-2.5 py-1.5 text-[11px] font-semibold text-shell-warn">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Angka jawaban belum lolos validasi data. Periksa dashboard
                  sebelum bertindak.
                </p>
              )}
            </div>
          </div>
        ))}
        {mengirim && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-shell-soft px-4 py-2.5 text-sm text-shell-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === "data" ? "Menyusun dari data" : "OSCAR sedang berpikir"}
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
              className="rounded-full border border-shell-line bg-shell-card px-3 py-1.5 text-[11px] font-semibold text-shell-ink-soft transition hover:border-shell-primary/50 hover:text-shell-primary-strong disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Galat ramah (termasuk batas laju) */}
      {galat && (
        <p
          role="alert"
          className="mx-5 mb-2 rounded-xl border border-shell-bad/35 bg-shell-bad/10 px-3.5 py-2.5 text-[11px] font-semibold text-shell-bad"
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
        className="flex items-end gap-2 border-t border-shell-line px-5 py-4"
      >
        <label htmlFor="tanya-asisten" className="sr-only">
          Pertanyaan untuk OSCAR
        </label>
        <textarea
          id="tanya-asisten"
          value={tanya}
          onChange={(e) => setTanya(e.target.value)}
          onKeyDown={(e) => {
            // Enter mengirim (Shift+Enter baris baru), kebiasaan obrolan.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              kirim(tanya);
            }
          }}
          rows={1}
          maxLength={500}
          placeholder="Tanyakan omzet, stok, atau produk"
          className="max-h-32 flex-1 resize-none rounded-xl border border-shell-line bg-shell-card px-3.5 py-2.5 text-sm text-shell-ink placeholder:text-shell-muted focus:border-shell-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={mengirim || !tanya.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-shell-primary text-white transition hover:bg-shell-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Kirim pertanyaan"
        >
          {mengirim ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
      <p className="px-5 pb-3 text-[10px] leading-relaxed text-shell-muted">
        Jawaban dibatasi data outlet ini, maksimal 500 karakter per
        pertanyaan, dengan batas laju per jam.
      </p>
      {mode === "data" && (
        <p className="mx-5 mb-4 rounded-xl border border-shell-primary/25 bg-shell-primary/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-shell-ink-soft">
          Ingin jawaban yang lebih luas memahami bahasa bebas?{" "}
          <Link
            href="/owner/settings#asisten-ai"
            className="font-bold text-shell-primary-strong underline underline-offset-2"
          >
            Aktifkan Mode AI di Pengaturan
          </Link>{" "}
          (cukup diisi sekali, tanpa hidupkan ulang container).
        </p>
      )}
    </div>
  );
}
