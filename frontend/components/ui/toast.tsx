"use client";

// Sistem pesan singkat (toast) UMKM OS v1.0.0, buatan sendiri, beranimasi.
//
// ToastProvider dipasang sekali di layout akar; komponen client mana pun
// memanggil useToast().show({...}) untuk menampilkan pesan di kanan bawah.
// Setiap toast muncul dengan animasi naik, menutup sendiri setelah 3,4
// detik (dapat ditutup manual), dan tampilannya mengikuti tema shell.
// Pemakaian dicatat ke pencatat konsol khusus (lib/ui/log).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Info,
  OctagonAlert,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { log } from "@/lib/ui/log";

export type ToastVariant = "sukses" | "info" | "peringatan" | "galat";

export type ToastInput = {
  message: string;
  title?: string;
  variant?: ToastVariant;
};

type ToastItem = ToastInput & {
  id: number;
  variant: ToastVariant;
};

type ToastApi = {
  show: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const VARIAN: Record<
  ToastVariant,
  { ikon: LucideIcon; aksen: string; ikonWarna: string }
> = {
  sukses: {
    ikon: CheckCircle2,
    aksen: "border-l-shell-ok",
    ikonWarna: "text-shell-ok",
  },
  info: {
    ikon: Info,
    aksen: "border-l-shell-primary",
    ikonWarna: "text-shell-primary-strong",
  },
  peringatan: {
    ikon: TriangleAlert,
    aksen: "border-l-shell-warn",
    ikonWarna: "text-shell-warn",
  },
  galat: {
    ikon: OctagonAlert,
    aksen: "border-l-shell-bad",
    ikonWarna: "text-shell-bad",
  },
};

const MASA_TAMPIL = 3400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [siapPortal, setSiapPortal] = useState(false);
  const urut = useRef(0);

  useEffect(() => {
    setSiapPortal(true);
  }, []);

  const show = useCallback((input: ToastInput) => {
    const variant: ToastVariant = input.variant ?? "info";
    urut.current += 1;
    const id = urut.current;
    setItems((lama) => [...lama, { ...input, variant, id }]);
    log.debug("toast", `pesan ${variant}: ${input.message}`);
    window.setTimeout(() => {
      setItems((lama) => lama.filter((t) => t.id !== id));
    }, MASA_TAMPIL);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {siapPortal &&
        createPortal(
          <div
            aria-live="polite"
            role="status"
            className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(340px,calc(100vw-40px))] flex-col gap-2"
          >
            {items.map((t) => {
              const cfg = VARIAN[t.variant];
              const Ikon = cfg.ikon;
              return (
                <div
                  key={t.id}
                  className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-shell-line border-l-4 ${cfg.aksen} bg-shell-raised px-4 py-3 shadow-[var(--shell-shadow)]`}
                >
                  <Ikon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.ikonWarna}`}
                  />
                  <div className="min-w-0 flex-1">
                    {t.title && (
                      <p className="text-xs font-bold leading-tight text-shell-ink">
                        {t.title}
                      </p>
                    )}
                    <p className="text-xs leading-relaxed text-shell-ink-soft">
                      {t.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup pesan"
                    onClick={() =>
                      setItems((lama) => lama.filter(x => x.id !== t.id))
                    }
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-shell-muted transition hover:text-shell-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body)}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  // Tanpa provider (mis. di dalam uji) pemanggil tetap aman: pesan hanya
  // dicatat ke konsol, tidak pernah melempar galat ke komponen pemakai.
  return useMemo(
    () =>
      api ?? {
        show: (input: ToastInput) => {
          log.debug("toast", `pesan ${input.variant ?? "info"}: ${input.message}`);
        },
      },
    [api]);
}
