"use client";

// Panel obrolan OSCAR UMKM OS v1.1.0: MURNI obrolan AI (Groq).
//
// Perubahan besar v1.1.0 (permintaan pemilik: "AI nya menggunakan groq
// console saja, matikan AI buatan sendiri, jangan lampirkan model yang
// dipakai, ubah desainnya seperti Chat AI pada umumnya"):
//  * Tidak ada lagi jawaban template tanpa AI. Bila AI tidak bisa
//    dihubungi, jawaban GAGAL tampil jujur sebagai gelembung galat
//    berperan alert lengkap dengan tombol "Kirim ulang" supaya pemilik
//    tahu persis kapan AI hidup dan kapan tidak.
//  * Lencana mode jawaban dihapus (sejak kini selalu AI), dan tidak
//    ada satu pun nama model yang dilampirkan di tampilan obrolan.
//  * Tata letak seperti obrolan AI pada umumnya: kolom terpusat,
//    gelembung pesan dengan avatar OSCAR + penanda waktu, sapaan
//    pembuka saat percakapan kosong, kotak kirim pil berisi tombol
//    kirim, dan pencatat kecil di bawahnya.
//
// Perilaku lama yang tetap: riwayat dimuat sekali lewat
// /api/assistant/history, pertanyaan dikirim ke /api/assistant/chat,
// Enter mengirim (Shift+Enter baris baru), batas 500 karakter, gulir
// otomatis mengikuti jawaban terbaru, aria-live untuk pembaca layar,
// peringatan bila angka jawaban belum lolos validasi data.
//
// Identitas: kepala panel memuat nama OSCAR beserta nama panjangnya
// (Online Shop Center for Assistance & Response).

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { OSCAR_LONG_NAME, OSCAR_NAME } from "@/lib/oscar";

interface PesanPanel {
  role: "USER" | "ASSISTANT";
  content: string;
  waktu?: string;
  galat?: boolean;
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

const formatWaktu = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function teksWaktu(): string {
  return formatWaktu.format(new Date()).replaceAll(".", ":");
}

function teksWaktuDari(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return formatWaktu.format(t).replaceAll(".", ":");
}

export function AssistantPanel({ outletName }: { outletName: string }) {
  const [pesan, setPesan] = useState<PesanPanel[]>([]);
  const [tanya, setTanya] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [tanyaTerakhir, setTanyaTerakhir] = useState<string | null>(null);
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
          messages?: {
            role: "USER" | "ASSISTANT";
            content: string;
            created_at?: string;
          }[];
        };
        if (hidup && isi.messages?.length) {
          setPesan(
            isi.messages.map((m) => ({
              role: m.role,
              content: m.content,
              waktu: m.created_at ? teksWaktuDari(m.created_at) : undefined,
            })));
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
    setTanya("");
    setTanyaTerakhir(bersih);
    setPesan((p) => [
      ...p,
      { role: "USER", content: bersih, waktu: teksWaktu() },
    ]);
    setMengirim(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: bersih }),
      });
      const isi = (await res.json()) as {
        answer?: string;
        numbers_validated?: boolean;
        detail?: string;
      };
      if (!res.ok || typeof isi.answer !== "string") {
        // MURNI AI: kegagalan tampil jujur sebagai gelembung galat
        // (bukan jawaban template), lengkap dengan tombol kirim ulang.
        setPesan((p) => [
          ...p,
          {
            role: "ASSISTANT",
            content:
              isi.detail ??
              "OSCAR tidak bisa menjawab sekarang. Coba lagi sebentar lagi.",
            waktu: teksWaktu(),
            galat: true,
          },
        ]);
      } else {
        setPesan((p) => [
          ...p,
          {
            role: "ASSISTANT",
            content: isi.answer as string,
            waktu: teksWaktu(),
            numbersValidated: isi.numbers_validated,
          },
        ]);
      }
    } catch {
      setPesan((p) => [
        ...p,
        {
          role: "ASSISTANT",
          content:
            "Koneksi ke OSCAR terputus. Periksa jaringan lalu kirim ulang.",
          waktu: teksWaktu(),
          galat: true,
        },
      ]);
    } finally {
      setMengirim(false);
    }
  }

  const percakapanKosong = !muatRiwayat && pesan.length === 0;

  return (
    <div className="flex h-[min(80dvh,780px)] flex-col rounded-2xl border border-shell-line bg-shell-card">
      {/* Kepala panel */}
      <div className="flex items-center gap-3 border-b border-shell-line px-5 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-shell-primary text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold leading-tight text-shell-ink">
            {OSCAR_NAME}
          </h2>
          <p className="truncate text-[11px] leading-tight text-shell-muted">
            {OSCAR_LONG_NAME}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-shell-ok/12 px-2.5 py-1 text-[11px] font-bold text-shell-ok">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-shell-ok" />
          Siaga
        </span>
      </div>

      {/* Alur pesan */}
      <div
        aria-live="polite"
        aria-label="Percakapan asisten"
        className="scroll-shell flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {muatRiwayat && (
          <div className="flex items-center gap-2 text-xs text-shell-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat
          </div>
        )}
        {percakapanKosong && (
          <div className="mx-auto max-w-md space-y-4 py-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-shell-primary/12">
              <Sparkles className="h-7 w-7 text-shell-primary-strong" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-shell-ink">
                {`Halo! Saya ${OSCAR_NAME}, asisten ${outletName}.`}
              </p>
              <p className="text-xs leading-relaxed text-shell-muted">
                Tanyakan apa saja soal penjualan, stok, atau produk;
                saya menjawab hanya dari data outlet ini.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
              {CONTOH_TANYA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => kirim(c)}
                  disabled={mengirim}
                  className="rounded-xl border border-shell-line bg-shell-raised px-3 py-2 text-[11px] font-semibold text-shell-ink-soft transition hover:border-shell-primary/50 hover:text-shell-primary-strong disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {pesan.map((m, i) => (
          <div
            key={i}
            className={m.role === "USER" ? "flex justify-end" : "flex justify-start"}
          >
            {m.role === "ASSISTANT" && (
              <div className="mr-2.5 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-shell-primary/12 text-shell-primary-strong">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              role={m.galat ? "alert" : undefined}
              className={
                m.role === "USER"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-shell-primary px-4 py-2.5 text-sm leading-relaxed text-white"
                  : `max-w-[85%] space-y-1.5 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed ${
                      m.galat
                        ? "border border-shell-bad/35 bg-shell-bad/10 text-shell-bad"
                        : "bg-shell-soft text-shell-ink"
                    }`
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "ASSISTANT" && !m.galat && m.numbersValidated === false && (
                <p className="flex items-center gap-1.5 rounded-lg bg-shell-warn/12 px-2.5 py-1.5 text-[11px] font-semibold text-shell-warn">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Angka jawaban belum lolos validasi data. Periksa dashboard
                  sebelum bertindak.
                </p>
              )}
              {m.role === "ASSISTANT" && m.galat && (
                <button
                  type="button"
                  onClick={() => tanyaTerakhir && kirim(tanyaTerakhir)}
                  disabled={mengirim || !tanyaTerakhir}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-shell-bad/35 px-2.5 py-1.5 text-[11px] font-bold text-shell-bad transition hover:bg-shell-bad/10 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Kirim ulang
                </button>
              )}
              {m.waktu && (
                <p
                  className={`text-right text-[10px] tabular-nums ${
                    m.role === "USER" ? "text-white/70" : "text-shell-muted"
                  }`}
                >
                  {m.waktu}
                </p>
              )}
            </div>
          </div>
        ))}
        {mengirim && (
          <div className="flex justify-start">
            <div className="mr-2.5 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-shell-primary/12 text-shell-primary-strong">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-shell-soft px-4 py-2.5 text-sm text-shell-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              OSCAR sedang mengetik
            </div>
          </div>
        )}
        <div ref={ujungRef} />
      </div>

      {/* Kotak kirim pil: textarea + tombol kirim dalam satu wadah,
          kebiasaan obrolan AI pada umumnya. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          kirim(tanya);
        }}
        className="border-t border-shell-line px-4 py-4 sm:px-6"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-shell-line bg-shell-raised px-3 py-2 transition focus-within:border-shell-primary">
          <label htmlFor="tanya-oscar" className="sr-only">
            Pertanyaan untuk OSCAR
          </label>
          <textarea
            id="tanya-oscar"
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
            placeholder="Tulis pertanyaan untuk OSCAR"
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-shell-ink placeholder:text-shell-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={mengirim || !tanya.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-shell-primary text-white transition hover:bg-shell-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kirim pertanyaan"
          >
            {mengirim ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-shell-muted">
          Maksimal 500 karakter per pertanyaan, dengan batas laju per jam.
          OSCAR bisa keliru; cocokkan angka penting dengan dashboard.
        </p>
      </form>
    </div>
  );
}
