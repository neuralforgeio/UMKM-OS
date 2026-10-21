/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { ImageEditorModal } from "@/components/image-editor-modal";
import {
  addProductImage,
  deleteProductImage,
  moveProductImage,
  setProductThumbnail,
  type ImageActionResult,
} from "./actions";
import type { ProductRow } from "./types";

const MAX_IMAGES = 6;

const TILE_BTN =
  "flex h-6 w-6 items-center justify-center rounded-md bg-white/95 text-slate-700 shadow-sm transition hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30";

export function ImageManagerModal({
  product,
  onClose,
}: {
  product: ProductRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  // "upload" while the editor result is being stored, "<imageId>:<action>"
  // for the per-tile mutations.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const images = product.images;

  // Esc closes the manager — unless the editor is stacked on top, in
  // which case the editor handles its own Esc first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !editingFile) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingFile, onClose]);

  const pickFile = () => {
    if (images.length >= MAX_IMAGES) return;
    setError(null);
    fileRef.current?.click();
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Berkas harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }
    setEditingFile(file);
  };

  const upload = async (edited: File) => {
    setEditingFile(null);
    setBusy("upload");
    setError(null);
    const result = await addProductImage(product.id, edited);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const run = async (
    imageId: string,
    action: string,
    fn: () => Promise<ImageActionResult>,
  ) => {
    setBusy(`${imageId}:${action}`);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto produk ${product.name}`}
    >
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                Foto Produk
              </h2>
              <p className="truncate text-xs text-slate-500">
                {product.name} · {images.length}/{MAX_IMAGES} foto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kelola foto"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <ImagePlus className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-500">
                Belum ada foto untuk produk ini
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Foto tampil di kartu kasir dan tabel produk.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {images.map((image, index) => {
                const tileBusy =
                  busy !== null && busy.startsWith(`${image.id}:`);
                return (
                  <div
                    key={image.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <img
                      src={`/api/images/${image.id}`}
                      alt={`Foto ${index + 1} — ${product.name}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {image.isThumb && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 shadow">
                        Thumbnail
                      </span>
                    )}
                    {tileBusy && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40">
                        <Loader2
                          className="h-5 w-5 animate-spin text-white"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1 bg-slate-900/60 px-1.5 py-1.5">
                      <button
                        type="button"
                        aria-label="Jadikan thumbnail"
                        title="Jadikan thumbnail"
                        disabled={image.isThumb || tileBusy}
                        onClick={() =>
                          run(image.id, "thumb", () =>
                            setProductThumbnail(image.id),
                          )
                        }
                        className={`${TILE_BTN} ${
                          image.isThumb ? "text-amber-500" : ""
                        }`}
                      >
                        <Star
                          className="h-3.5 w-3.5"
                          fill={image.isThumb ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label="Geser ke kiri"
                        title="Geser ke kiri"
                        disabled={index === 0 || tileBusy}
                        onClick={() =>
                          run(image.id, "left", () =>
                            moveProductImage(image.id, "left"),
                          )
                        }
                        className={TILE_BTN}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Geser ke kanan"
                        title="Geser ke kanan"
                        disabled={index === images.length - 1 || tileBusy}
                        onClick={() =>
                          run(image.id, "right", () =>
                            moveProductImage(image.id, "right"),
                          )
                        }
                        className={TILE_BTN}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      {confirmDelete === image.id ? (
                        <button
                          type="button"
                          aria-label="Konfirmasi hapus"
                          title="Konfirmasi hapus"
                          disabled={tileBusy}
                          onClick={() => {
                            setConfirmDelete(null);
                            run(image.id, "delete", () =>
                              deleteProductImage(image.id),
                            );
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Hapus foto"
                          title="Hapus foto"
                          disabled={tileBusy}
                          onClick={() => setConfirmDelete(image.id)}
                          className={`${TILE_BTN} hover:!text-red-600`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={busy === "upload"}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "upload" ? (
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  )}
                  <span className="text-[11px] font-semibold">
                    {busy === "upload" ? "Mengunggah…" : "Tambah foto"}
                  </span>
                </button>
              )}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-slate-400">
            Foto pertama otomatis menjadi thumbnail. Thumbnail dipakai di kartu
            kasir dan tabel produk — tekan bintang untuk menggantinya. Setiap
            foto melewati editor (potong, putar, cermin, zoom) sebelum disimpan
            sebagai JPEG.
          </p>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Selesai
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChosen}
        className="hidden"
      />

      {editingFile && (
        <ImageEditorModal
          file={editingFile}
          productName={product.name}
          onUse={upload}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}
