"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  removeOutletLogo,
  updateOutletProfile,
  uploadOutletLogo,
  type SettingsActionState,
} from "./actions";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_BYTES = 900 * 1024;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function Notice({ state }: { state: SettingsActionState }) {
  if (!state.message) return null;
  if (state.ok) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        {state.message}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      {state.message}
    </p>
  );
}

export function OutletProfileForm({
  outlet,
}: {
  outlet: { name: string; address: string | null; phone: string | null };
}) {
  const [state, formAction, pending] = useActionState(updateOutletProfile, {
    ok: false,
    message: "",
  } satisfies SettingsActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="outlet-name"
          className="block text-sm font-medium text-slate-700"
        >
          Nama warung
        </label>
        <input
          id="outlet-name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={outlet.name}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">
          Tampil di kop struk dan header aplikasi.
        </p>
      </div>
      <div>
        <label
          htmlFor="outlet-address"
          className="block text-sm font-medium text-slate-700"
        >
          Alamat (opsional)
        </label>
        <input
          id="outlet-address"
          name="address"
          maxLength={120}
          defaultValue={outlet.address ?? ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">
          Dicetak di bawah nama warung pada struk.
        </p>
      </div>
      <div>
        <label
          htmlFor="outlet-phone"
          className="block text-sm font-medium text-slate-700"
        >
          Telepon (opsional)
        </label>
        <input
          id="outlet-phone"
          name="phone"
          maxLength={30}
          defaultValue={outlet.phone ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Profil
        </button>
        <Notice state={state} />
      </div>
    </form>
  );
}

export function OutletLogoForm({ logoUrl }: { logoUrl: string | null }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadOutletLogo,
    { ok: false, message: "" } satisfies SettingsActionState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeOutletLogo,
    { ok: false, message: "" } satisfies SettingsActionState,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // After a successful save the page re-renders with the new logoUrl,
  // so the local preview and the file input are cleared for round two.
  useEffect(() => {
    if (!uploadState.ok) return;
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }, [uploadState]);

  const pickFile = (file: File | undefined) => {
    setPickError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setPickError("Format harus PNG, JPEG, atau WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setPickError("Ukuran maksimal 900 KB.");
      return;
    }
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };

  const shown = previewUrl ?? logoUrl;

  return (
    <div className="space-y-4">
      <form action={uploadAction} className="space-y-4">
        <div className="flex h-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt="Logo warung"
              className="max-h-28 max-w-[200px] object-contain"
            />
          ) : (
            <div className="text-center">
              <ImagePlus className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-500">
                Belum ada logo
              </p>
              <p className="text-xs text-slate-400">
                Struk mencetak nama warung di tengah.
              </p>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ImagePlus className="h-4 w-4" />
            {shown ? "Ganti Gambar" : "Pilih Gambar"}
          </button>
          <button
            type="submit"
            disabled={!previewUrl || uploadPending}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {uploadPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Logo
          </button>
        </div>
        <Notice state={uploadState} />
        {pickError && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {pickError}
          </p>
        )}
      </form>

      {logoUrl && (
        <form action={removeAction}>
          <button
            type="submit"
            disabled={removePending}
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            {removePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Hapus Logo
          </button>
          <div className="mt-2">
            <Notice state={removeState} />
          </div>
        </form>
      )}

      <p className="text-xs leading-relaxed text-slate-400">
        Tips: gambar persegi (minimal 256 x 256 piksel); PNG dengan latar
        transparan paling rapi. Logo tampil di pojok kiri atas struk — tetap
        berwarna saat dicetak — serta di header kasir dan ikon tab browser.
      </p>
    </div>
  );
}
