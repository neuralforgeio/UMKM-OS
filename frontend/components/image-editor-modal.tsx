"use client";

import { useEffect, useRef, useState } from "react";
import {
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";

// Zero-dependency photo editor built on <canvas>:
//   - crop   : draggable box with four corner handles
//   - rotate : 90-degree steps, left or right
//   - flip   : horizontal / vertical (screen-space, WYSIWYG)
//   - zoom   : slider + pan by dragging outside the crop box
// The transform is baked into an offscreen canvas at natural resolution;
// the preview renders that canvas, and the export copies the crop region
// straight from it — preview and result can never disagree.
//
// Shape notes (lint-clean React 19 patterns):
//   - the baked canvas lives in a ref (only touched in callbacks),
//     while its dimensions are state so render stays pure;
//   - baking happens inside event handlers and the image onload
//     callback, never inside effect bodies;
//   - pan/crop default to centered values derived at render until the
//     user actually drags something (null = "use defaults").

type CropRect = { x: number; y: number; w: number; h: number };
type Pan = { x: number; y: number };
type BakedSize = { w: number; h: number };

type Drag =
  | { mode: "pan"; startX: number; startY: number; pan: Pan }
  | { mode: "move"; startX: number; startY: number; crop: CropRect }
  | {
      mode: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      crop: CropRect;
    };

const MIN_CROP_PX = 32;
const MAX_EXPORT_SIDE = 1280;
const EXPORT_QUALITY = 0.85;
const MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function ImageEditorModal({
  file,
  productName,
  onUse,
  onClose,
}: {
  file: File;
  productName: string;
  onUse: (edited: File) => void;
  onClose: () => void;
}) {
  const [loadError, setLoadError] = useState(false);
  const [natural, setNatural] = useState<BakedSize | null>(null);
  const [bakedSize, setBakedSize] = useState<BakedSize | null>(null);
  const [bakedVersion, setBakedVersion] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);
  // null = derive centered defaults until the user interacts.
  const [pan, setPan] = useState<Pan | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [exporting, setExporting] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const bakedRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);

  // Bake the given transform into the offscreen canvas at natural
  // resolution. Order matters: translate -> scale -> rotate means the
  // flip is applied to the ROTATED frame, so each button does exactly
  // what it looks like on screen. Called from event handlers and the
  // image onload callback only.
  const bake = (rot: number, fh: boolean, fv: boolean) => {
    const img = imgRef.current;
    if (!img) return;
    const swap = rot === 90 || rot === 270;
    const W = swap ? img.naturalHeight : img.naturalWidth;
    const H = swap ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(W / 2, H / 2);
    ctx.scale(fh ? -1 : 1, fv ? -1 : 1);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    bakedRef.current = canvas;
    setBakedSize({ w: W, h: H });
    setBakedVersion((v) => v + 1);
  };

  // Decode the picked file once; baking happens right here in the
  // async callback (allowed: not a synchronous effect setState).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      bake(0, false, false);
    };
    img.onerror = () => setLoadError(true);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the viewport so the preview can be fitted (DOM measurement
  // in an effect is the sanctioned pattern).
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current;
      if (el) setBox({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Esc closes the editor (the manager ignores Esc while it is open).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Derived view geometry (pure): fitted scale, effective pan/crop with
  // centered defaults, and display sizes.
  const fit =
    bakedSize && box.w > 0
      ? Math.min(box.w / bakedSize.w, box.h / bakedSize.h)
      : 0;
  const dispScale = fit * zoom;
  const dispW = bakedSize ? bakedSize.w * dispScale : 0;
  const dispH = bakedSize ? bakedSize.h * dispScale : 0;
  const basePan: Pan = bakedSize
    ? {
        x: (box.w - bakedSize.w * fit) / 2,
        y: (box.h - bakedSize.h * fit) / 2,
      }
    : { x: 0, y: 0 };
  const effPan = pan ?? basePan;
  const effCrop: CropRect | null = bakedSize
    ? (crop ?? {
        x: bakedSize.w * 0.1,
        y: bakedSize.h * 0.1,
        w: bakedSize.w * 0.8,
        h: bakedSize.h * 0.8,
      })
    : null;

  const ready = natural !== null && bakedSize !== null;

  // Keep the image reachable: centered when smaller than the viewport,
  // otherwise at least a sliver stays visible on every side.
  const clampPan = (p: Pan, scale: number): Pan => {
    if (!bakedSize) return p;
    const dw = bakedSize.w * scale;
    const dh = bakedSize.h * scale;
    const x = dw <= box.w ? (box.w - dw) / 2 : clamp(p.x, box.w - dw, 0);
    const y = dh <= box.h ? (box.h - dh) / 2 : clamp(p.y, box.h - dh, 0);
    return { x, y };
  };

  // Zoom around the viewport center so the point under the crosshair
  // stays put while the slider moves.
  const applyZoom = (nextZoom: number) => {
    if (!bakedSize || fit <= 0) {
      setZoom(nextZoom);
      return;
    }
    const oldScale = fit * zoom;
    const newScale = fit * nextZoom;
    const cx = box.w / 2;
    const cy = box.h / 2;
    setPan((prev) => {
      const p = prev ?? basePan;
      return clampPan(
        {
          x: cx - (cx - p.x) * (newScale / oldScale),
          y: cy - (cy - p.y) * (newScale / oldScale),
        },
        newScale,
      );
    });
    setZoom(nextZoom);
  };

  const rotate = (step: 90 | -90) => {
    const next = (rotation + step + 360) % 360;
    bake(next, flipH, flipV);
    setRotation(next);
    // Dims swapped: fall back to centered pan and a fresh 80% crop.
    setPan(null);
    setCrop(null);
  };

  const toggleFlip = (axis: "h" | "v") => {
    const nextH = axis === "h" ? !flipH : flipH;
    const nextV = axis === "v" ? !flipV : flipV;
    bake(rotation, nextH, nextV);
    setFlipH(nextH);
    setFlipV(nextV);
  };

  const resetAll = () => {
    bake(0, false, false);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setPan(null);
    setCrop(null);
  };

  // Pointer plumbing: one pair of window listeners per render (fresh
  // closures see the latest geometry). touch-none on the viewport keeps
  // touch drags from scrolling the page.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !bakedSize || dispScale <= 0) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (drag.mode === "pan") {
        setPan(clampPan({ x: drag.pan.x + dx, y: drag.pan.y + dy }, dispScale));
        return;
      }
      if (drag.mode === "move") {
        setCrop({
          ...drag.crop,
          x: clamp(drag.crop.x + dx / dispScale, 0, bakedSize.w - drag.crop.w),
          y: clamp(drag.crop.y + dy / dispScale, 0, bakedSize.h - drag.crop.h),
        });
        return;
      }
      const minBaked = MIN_CROP_PX / dispScale;
      let { x, y, w, h } = drag.crop;
      if (drag.mode.includes("e")) {
        w = clamp(
          drag.crop.w + dx / dispScale,
          minBaked,
          bakedSize.w - drag.crop.x,
        );
      }
      if (drag.mode.includes("s")) {
        h = clamp(
          drag.crop.h + dy / dispScale,
          minBaked,
          bakedSize.h - drag.crop.y,
        );
      }
      if (drag.mode.includes("w")) {
        const x2 = drag.crop.x + drag.crop.w;
        x = clamp(drag.crop.x + dx / dispScale, 0, x2 - minBaked);
        w = x2 - x;
      }
      if (drag.mode.includes("n")) {
        const y2 = drag.crop.y + drag.crop.h;
        y = clamp(drag.crop.y + dy / dispScale, 0, y2 - minBaked);
        h = y2 - y;
      }
      setCrop({ x, y, w, h });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  // Redraw the fitted preview whenever the bake or the scale changes.
  useEffect(() => {
    const baked = bakedRef.current;
    const cv = previewRef.current;
    if (!baked || !cv || dispScale <= 0 || dispW <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(dispW * dpr);
    cv.height = Math.round(dispH * dpr);
    cv.style.width = `${dispW}px`;
    cv.style.height = `${dispH}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(baked, 0, 0, dispW, dispH);
  }, [bakedVersion, dispScale, dispW, dispH]);

  const usePhoto = async () => {
    const baked = bakedRef.current;
    if (!baked || !effCrop || effCrop.w < 1 || effCrop.h < 1 || exporting) {
      return;
    }
    setExporting(true);
    try {
      const scale = Math.min(
        1,
        MAX_EXPORT_SIDE / Math.max(effCrop.w, effCrop.h),
      );
      const ow = Math.max(1, Math.round(effCrop.w * scale));
      const oh = Math.max(1, Math.round(effCrop.h * scale));
      const out = document.createElement("canvas");
      out.width = ow;
      out.height = oh;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        baked,
        effCrop.x,
        effCrop.y,
        effCrop.w,
        effCrop.h,
        0,
        0,
        ow,
        oh,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/jpeg", EXPORT_QUALITY),
      );
      if (!blob) return;
      onUse(
        new File([blob], `produk-${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
    } finally {
      setExporting(false);
    }
  };

  const TOOL_BTN =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Sunting foto ${productName}`}
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md dark:bg-slate-950/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="glass-card relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-2xl dark:shadow-black/50">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <FlipHorizontal className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Sunting Foto
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{productName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup editor"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loadError ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-8 text-center text-sm font-medium text-red-700 dark:text-red-300">
              Berkas tidak bisa dibaca sebagai gambar. Pilih foto lain.
            </div>
          ) : (
            <>
              <div
                ref={viewportRef}
                className="relative h-72 w-full touch-none overflow-hidden rounded-xl bg-slate-900 sm:h-80"
              >
                {!ready || box.w === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                    <Loader2
                      className="h-6 w-6 animate-spin"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium">Memuat foto…</p>
                  </div>
                ) : (
                  <div
                    className="absolute left-0 top-0"
                    style={{
                      transform: `translate3d(${effPan.x}px, ${effPan.y}px, 0)`,
                    }}
                    onPointerDown={(event) => {
                      if (exporting) return;
                      dragRef.current = {
                        mode: "pan",
                        startX: event.clientX,
                        startY: event.clientY,
                        pan: effPan,
                      };
                    }}
                  >
                    <canvas ref={previewRef} className="block" />
                    {effCrop && (
                      <div
                        className="absolute cursor-move"
                        style={{
                          left: effCrop.x * dispScale,
                          top: effCrop.y * dispScale,
                          width: effCrop.w * dispScale,
                          height: effCrop.h * dispScale,
                          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (exporting) return;
                          dragRef.current = {
                            mode: "move",
                            startX: event.clientX,
                            startY: event.clientY,
                            crop: effCrop,
                          };
                        }}
                      >
                        <span className="absolute -top-6 left-0 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow">
                          {Math.round(effCrop.w)}×{Math.round(effCrop.h)}
                        </span>
                        {(
                          [
                            ["nw", "-top-1.5 -left-1.5 cursor-nwse-resize"],
                            ["ne", "-top-1.5 -right-1.5 cursor-nesw-resize"],
                            ["sw", "-bottom-1.5 -left-1.5 cursor-nesw-resize"],
                            ["se", "-bottom-1.5 -right-1.5 cursor-nwse-resize"],
                          ] as const
                        ).map(([corner, position]) => (
                          <button
                            key={corner}
                            type="button"
                            aria-label={`Ubah sudut ${corner}`}
                            className={`absolute h-3.5 w-3.5 touch-none rounded-full border-2 border-blue-600 bg-white dark:bg-slate-900 shadow ${position}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              if (exporting) return;
                              dragRef.current = {
                                mode: corner,
                                startX: event.clientX,
                                startY: event.clientY,
                                crop: effCrop,
                              };
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => rotate(-90)}
                  disabled={!ready}
                  aria-label="Putar ke kiri"
                  title="Putar ke kiri"
                  className={TOOL_BTN}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => rotate(90)}
                  disabled={!ready}
                  aria-label="Putar ke kanan"
                  title="Putar ke kanan"
                  className={TOOL_BTN}
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFlip("h")}
                  disabled={!ready}
                  aria-label="Cermin horizontal"
                  title="Cermin horizontal"
                  className={TOOL_BTN}
                >
                  <FlipHorizontal className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFlip("v")}
                  disabled={!ready}
                  aria-label="Cermin vertikal"
                  title="Cermin vertikal"
                  className={TOOL_BTN}
                >
                  <FlipVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={!ready}
                  aria-label="Atur ulang"
                  title="Atur ulang"
                  className={TOOL_BTN}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <div className="ml-auto flex min-w-40 flex-1 items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {zoom.toFixed(2).replace(".", ",")}×
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={MAX_ZOOM}
                    step={0.05}
                    value={zoom}
                    onChange={(event) => applyZoom(Number(event.target.value))}
                    disabled={!ready}
                    aria-label="Zoom"
                    className="h-1.5 w-full cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Geser kotak untuk memilih bagian foto, tarik sudutnya untuk
                mengubah ukuran, dan seret area gelap untuk menggeser foto.
                Hasilnya disimpan sebagai JPEG maksimal 1280px.
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 dark:border-slate-800/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-none sm:px-5"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={usePhoto}
            disabled={!ready || exporting || loadError || !effCrop}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
          >
            {exporting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {exporting ? "Menyiapkan…" : "Gunakan Foto"}
          </button>
        </div>
      </div>
    </div>
  );
}