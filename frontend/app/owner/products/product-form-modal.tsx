/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { formatThousands } from "@/lib/format";
import { ImageEditorModal } from "@/components/image-editor-modal";
import {
  addProductImage,
  deleteProductImage,
  moveProductImage,
  saveProduct,
  setProductThumbnail,
} from "./actions";
import type { CategoryOption, ProductRow } from "./types";

type ProductFormModalProps = {
  // null = create a new product, a row = edit that product.
  product: ProductRow | null;
  categories: CategoryOption[];
  onClose: () => void;
};

const MAX_PHOTOS = 6;

// Photos picked while CREATING a product: they wait in the browser and
// are uploaded right after saveProduct returns the new product id.
type QueuedPhoto = {
  key: string;
  file: File;
  preview: string;
};

// Digit-only sanitizing: typing or pasting "Rp 5.000" becomes "5000".
const digits = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

const LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const TILE_BTN =
  "flex h-6 w-6 items-center justify-center rounded-md bg-white/95 text-slate-700 shadow-sm transition hover:bg-white hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30";

// Live grouping for numeric fields: the stored string stays raw digits
// ("4000"), only the presentation gains Indonesian thousand dots.
const grouped = (value: string) =>
  value ? formatThousands(parseInt(value, 10)) : "";

// Rp text field: right-aligned tabular digits with a fixed "Rp" prefix
// and live thousand separators — the same money language as the POS.
function RpInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={grouped(value)}
        placeholder={placeholder ?? "0"}
        onChange={(event) => onChange(digits(event.target.value, 10))}
        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// Plain integer field (stock, minimum stock) without the Rp prefix.
function QtyInput({
  id,
  value,
  onChange,
  max,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  max: number;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={grouped(value)}
      placeholder="0"
      onChange={(event) => onChange(digits(event.target.value, max))}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  );
}

export function ProductFormModal({
  product,
  categories,
  onClose,
}: ProductFormModalProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [price, setPrice] = useState(
    product ? String(product.priceRupiah) : "",
  );
  const [cost, setCost] = useState(product ? String(product.costRupiah) : "");
  const [unit, setUnit] = useState(product?.unit ?? "pcs");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [minStock, setMinStock] = useState(
    product ? String(product.minStock) : "5",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Photos. In EDIT mode they upload immediately; in CREATE mode they
  // queue in the browser until the product row exists.
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Set once a NEW product has been saved: the fields lock and the
  // submit button turns into a photo-retry control.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const images = product?.images ?? [];
  const photoCount = images.length + queue.length;

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // The stacked photo editor handles its own Escape first.
      if (event.key === "Escape" && !editingFile) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingFile, onClose]);

  const handleCategorySelect = (value: string) => {
    if (value === "__new__") {
      setUseNewCategory(true);
      return;
    }
    setCategoryId(value);
  };

  const pickPhoto = () => {
    setPhotoError(null);
    if (photoCount >= MAX_PHOTOS) {
      setPhotoError(`Maksimal ${MAX_PHOTOS} foto per produk.`);
      return;
    }
    fileRef.current?.click();
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Berkas harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }
    setEditingFile(file);
  };

  // The editor hands back the cropped JPEG. When a product id is known
  // (edit mode, or photos added after a create save) it uploads right
  // away; otherwise it waits in the queue.
  const onUseEdited = (edited: File) => {
    setEditingFile(null);
    const targetId = product?.id ?? createdId;
    if (targetId) {
      void uploadPhoto(targetId, edited);
    } else {
      setQueue((items) => [
        ...items,
        {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: edited,
          preview: URL.createObjectURL(edited),
        },
      ]);
    }
  };

  const uploadPhoto = async (productId: string, file: File) => {
    setPhotoBusy("upload");
    setPhotoError(null);
    const result = await addProductImage(productId, file);
    setPhotoBusy(null);
    if (!result.ok) {
      setPhotoError(result.error);
      return;
    }
    router.refresh();
  };

  const removeQueued = (key: string) => {
    setQueue((items) => {
      const found = items.find((item) => item.key === key);
      if (found) URL.revokeObjectURL(found.preview);
      return items.filter((item) => item.key !== key);
    });
  };

  const run = async (
    imageId: string,
    action: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setPhotoBusy(`${imageId}:${action}`);
    setPhotoError(null);
    const result = await fn();
    setPhotoBusy(null);
    if (!result.ok) {
      setPhotoError(result.error ?? "Operasi foto gagal.");
      return;
    }
    router.refresh();
  };

  // Uploads every queued photo (create flow). Stops at the first
  // failure so the owner can retry without losing the rest.
  const uploadRemaining = async (productId: string) => {
    setPhotoBusy("queue");
    setPhotoError(null);
    const failed: QueuedPhoto[] = [];
    let firstError: string | null = null;
    for (const item of queue) {
      if (firstError) {
        failed.push(item);
        continue;
      }
      const result = await addProductImage(productId, item.file);
      if (result.ok) {
        URL.revokeObjectURL(item.preview);
      } else {
        firstError = result.error;
        failed.push(item);
      }
    }
    setQueue(failed);
    setPhotoBusy(null);
    if (firstError) {
      setPhotoError(
        `Produk sudah tersimpan, tetapi foto belum selesai diunggah: ${firstError}`,
      );
    } else {
      router.refresh();
      onClose();
    }
  };

  const submit = () => {
    setError(null);
    if (createdId) {
      startTransition(async () => {
        await uploadRemaining(createdId);
      });
      return;
    }

    const trimmedName = name.trim();
    const trimmedSku = sku.trim().toUpperCase();
    const trimmedUnit = unit.trim() || "pcs";
    const trimmedCategory = newCategoryName.trim();
    const priceRp = price ? parseInt(price, 10) : 0;
    const costRp = cost ? parseInt(cost, 10) : 0;
    const stockQty = stock ? parseInt(stock, 10) : 0;
    const minStockQty = minStock ? parseInt(minStock, 10) : 0;

    if (!trimmedName) {
      setError("Nama produk wajib diisi.");
      return;
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(trimmedSku)) {
      setError(
        "SKU wajib 2-32 karakter: huruf besar, angka, atau tanda hubung.",
      );
      return;
    }
    if (useNewCategory && !trimmedCategory) {
      setError("Nama kategori baru wajib diisi.");
      return;
    }
    if (priceRp <= 0) {
      setError("Harga jual harus lebih dari 0.");
      return;
    }
    if (costRp < 0) {
      setError("Harga beli tidak boleh negatif.");
      return;
    }
    if (stockQty < 0 || minStockQty < 0) {
      setError("Stok tidak boleh negatif.");
      return;
    }

    startTransition(async () => {
      const result = await saveProduct({
        id: product?.id,
        name: trimmedName,
        sku: trimmedSku,
        categoryId: useNewCategory ? null : categoryId || null,
        newCategoryName: useNewCategory ? trimmedCategory : null,
        priceRupiah: priceRp,
        costRupiah: costRp,
        unit: trimmedUnit,
        stock: stockQty,
        minStock: minStockQty,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (queue.length === 0 || !result.productId) {
        onClose();
        return;
      }
      setCreatedId(result.productId);
      await uploadRemaining(result.productId);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={product ? `Ubah produk ${product.name}` : "Produk baru"}
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
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                {product ? "Ubah Produk" : "Produk Baru"}
              </h2>
              <p className="truncate text-xs text-slate-500">
                {product
                  ? product.sku
                  : "Tambahkan barang yang dijual di warung"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {createdId && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                Produk tersimpan — tinggal foto yang menyusul.
              </div>
            )}

            <fieldset
              disabled={createdId !== null}
              className="space-y-3 border-0 p-0 disabled:opacity-60"
            >
              <div>
                <label htmlFor="product-name" className={LABEL_CLASS}>
                  Nama Produk
                </label>
                <input
                  ref={firstFieldRef}
                  id="product-name"
                  type="text"
                  autoComplete="off"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value.slice(0, 100))
                  }
                  placeholder="Contoh: Beras Pandan Wangi 5kg"
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-sku" className={LABEL_CLASS}>
                    SKU
                  </label>
                  <input
                    id="product-sku"
                    type="text"
                    autoComplete="off"
                    value={sku}
                    onChange={(event) =>
                      setSku(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, "")
                          .slice(0, 32),
                      )
                    }
                    placeholder="BRG-001"
                    className={`mt-1 font-mono ${INPUT_CLASS}`}
                  />
                </div>
                <div>
                  <label htmlFor="product-unit" className={LABEL_CLASS}>
                    Satuan
                  </label>
                  <input
                    id="product-unit"
                    type="text"
                    autoComplete="off"
                    value={unit}
                    onChange={(event) =>
                      setUnit(event.target.value.trim().slice(0, 16))
                    }
                    placeholder="pcs"
                    className={`mt-1 ${INPUT_CLASS}`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="product-category" className={LABEL_CLASS}>
                  Kategori
                </label>
                {useNewCategory ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="product-category"
                      type="text"
                      autoComplete="off"
                      value={newCategoryName}
                      onChange={(event) =>
                        setNewCategoryName(event.target.value.slice(0, 50))
                      }
                      placeholder="Nama kategori baru"
                      className={`flex-1 ${INPUT_CLASS}`}
                    />
                    <button
                      type="button"
                      onClick={() => setUseNewCategory(false)}
                      className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Pilih lama
                    </button>
                  </div>
                ) : (
                  <select
                    id="product-category"
                    value={categoryId}
                    onChange={(event) =>
                      handleCategorySelect(event.target.value)
                    }
                    className={`mt-1 ${INPUT_CLASS}`}
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                    <option value="__new__">+ Kategori baru…</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-price" className={LABEL_CLASS}>
                    Harga Jual
                  </label>
                  <RpInput
                    id="product-price"
                    value={price}
                    onChange={setPrice}
                    placeholder="68.000"
                  />
                </div>
                <div>
                  <label htmlFor="product-cost" className={LABEL_CLASS}>
                    Harga Beli
                  </label>
                  <RpInput
                    id="product-cost"
                    value={cost}
                    onChange={setCost}
                    placeholder="55.000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-stock" className={LABEL_CLASS}>
                    Stok Saat Ini
                  </label>
                  <QtyInput
                    id="product-stock"
                    value={stock}
                    onChange={setStock}
                    max={6}
                  />
                </div>
                <div>
                  <label htmlFor="product-min-stock" className={LABEL_CLASS}>
                    Stok Minimum
                  </label>
                  <QtyInput
                    id="product-min-stock"
                    value={minStock}
                    onChange={setMinStock}
                    max={5}
                  />
                  <p className="mt-1 text-[11px] leading-tight text-slate-400">
                    Stok sama atau di bawah angka ini ditandai perlu restok.
                  </p>
                </div>
              </div>
            </fieldset>

            <div>
              <p className={LABEL_CLASS}>Foto Produk (maks. {MAX_PHOTOS})</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-400">
                Tampil di kartu kasir dan tabel produk. Foto pertama otomatis
                menjadi thumbnail.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {images.map((image, index) => {
                  const tileBusy =
                    photoBusy !== null && photoBusy.startsWith(`${image.id}:`);
                  return (
                    <div
                      key={image.id}
                      className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    >
                      {image.isThumb && (
                        <span className="absolute left-1 top-1 z-10 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Thumbnail
                        </span>
                      )}
                      <img
                        src={`/api/images/${image.id}`}
                        alt=""
                        loading="lazy"
                        className="pointer-events-none h-full w-full object-cover"
                      />
                      {tileBusy ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                      ) : (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-black/50 p-1">
                          <button
                            type="button"
                            title="Jadikan thumbnail"
                            disabled={image.isThumb}
                            onClick={() =>
                              run(image.id, "thumb", () =>
                                setProductThumbnail(image.id),
                              )
                            }
                            className={TILE_BTN}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${image.isThumb ? "text-amber-500" : ""}`}
                            />
                          </button>
                          <button
                            type="button"
                            title="Geser ke kiri"
                            disabled={index === 0}
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
                            title="Geser ke kanan"
                            disabled={index === images.length - 1}
                            onClick={() =>
                              run(image.id, "right", () =>
                                moveProductImage(image.id, "right"),
                              )
                            }
                            className={TILE_BTN}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Hapus foto"
                            onClick={() => {
                              if (confirmDelete === image.id) {
                                setConfirmDelete(null);
                                run(image.id, "delete", () =>
                                  deleteProductImage(image.id),
                                );
                              } else {
                                setConfirmDelete(image.id);
                              }
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700"
                          >
                            {confirmDelete === image.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {queue.map((item) => (
                  <div
                    key={item.key}
                    className="relative aspect-square overflow-hidden rounded-lg border border-blue-200 bg-slate-100"
                  >
                    <span className="absolute left-1 top-1 z-10 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Baru
                    </span>
                    <img
                      src={item.preview}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover"
                    />
                    {photoBusy === "queue" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeQueued(item.key)}
                        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-red-600/90 py-1 text-[10px] font-semibold text-white transition hover:bg-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        Hapus
                      </button>
                    )}
                  </div>
                ))}

                {photoCount < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={pickPhoto}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-blue-400 hover:text-blue-500"
                  >
                    {photoBusy === "upload" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-semibold">
                      {photoBusy === "upload" ? "Mengunggah…" : "Tambah foto"}
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChosen}
              />
              {photoError && (
                <p className="mt-2 text-xs font-medium text-rose-600">
                  {photoError}
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {error}
              </div>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none sm:px-5"
            >
              {createdId ? "Tutup" : "Batal"}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {isPending
                ? "Menyimpan…"
                : createdId
                  ? queue.length > 0
                    ? "Coba Unggah Foto Lagi"
                    : "Selesai"
                  : "Simpan Produk"}
            </button>
          </div>
        </form>
      </div>

      {editingFile && (
        <ImageEditorModal
          file={editingFile}
          productName={name.trim() || product?.name || "produk ini"}
          onUse={onUseEdited}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}
