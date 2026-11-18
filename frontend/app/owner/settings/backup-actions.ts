"use server";

// RUN-7 — server actions Cadangan Data + Salinan Database (frontend
// 1.4.0). Pemanggilan lewat goFetch: token Bearer sesi OWNER/DEVELOPER;
// audit tercatat di sisi backend (BACKUP_RUN / BACKUP_RESTORE /
// DB_FAILOVER), frontend tidak pernah menyentuh pg_dump sendiri.

import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import type { DbStatus, HasilBackup } from "@/lib/backup";

export type BackupActionState = { ok: boolean; message: string };

async function ownerToken(): Promise<string | null> {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") ||
    !session.user.goToken
  ) {
    return null;
  }
  return session.user.goToken;
}

// bacaDbStatus: dibaca server component (bukan action) — dipakai halaman
// Pengaturan untuk menggambar status salinan saat render.
export async function bacaDbStatus(): Promise<DbStatus | null> {
  const token = await ownerToken();
  if (!token) return null;
  const res = await goFetch<DbStatus>(token, "/admin/db-status");
  return res.ok ? res.data : null;
}

export async function jalankanBackup(
  _prev: BackupActionState,
): Promise<BackupActionState> {
  const token = await ownerToken();
  if (!token) {
    return { ok: false, message: "Hanya pemilik yang boleh mencadangkan data." };
  }
  const res = await goFetch<HasilBackup>(token, "/admin/backup/run", {
    method: "POST",
  });
  if (!res.ok) {
    return { ok: false, message: `Cadangan gagal dibuat: ${res.message}` };
  }
  const d = res.data;
  return {
    ok: true,
    message: `Cadangan ${d.nama} dibuat di node ${d.node === "salinan" ? "salinan" : "pusat"} (${d.dibuat}).`,
  };
}

export async function pulihkanBackup(
  _prev: BackupActionState,
  formData: FormData,
): Promise<BackupActionState> {
  const token = await ownerToken();
  if (!token) {
    return { ok: false, message: "Hanya pemilik yang boleh memulihkan cadangan." };
  }
  const nama = String(formData.get("nama") ?? "").trim();
  if (!nama.endsWith(".sql.gz") || nama.includes("/")) {
    return { ok: false, message: "Nama berkas cadangan tidak sah." };
  }
  const res = await goFetch<{ nama: string; node: string }>(
    token,
    `/admin/backup/${encodeURIComponent(nama)}/restore`,
    { method: "POST" },
  );
  if (!res.ok) {
    return { ok: false, message: `Pemulihan gagal: ${res.message}` };
  }
  return {
    ok: true,
    message: `Berkas ${res.data.nama} dipulihkan ke node ${res.data.node === "salinan" ? "salinan" : "pusat"}.`,
  };
}

export async function pindahNodeDb(
  _prev: BackupActionState,
  formData: FormData,
): Promise<BackupActionState> {
  const token = await ownerToken();
  if (!token) {
    return { ok: false, message: "Hanya pemilik yang boleh memindah node." };
  }
  const ke = String(formData.get("ke") ?? "");
  if (ke !== "pusat" && ke !== "salinan") {
    return { ok: false, message: "Tujuan node tidak dikenal." };
  }
  const res = await goFetch<{ node_aktif: string }>(token, "/admin/db/failover", {
    method: "POST",
    body: JSON.stringify({ ke }),
  });
  if (!res.ok) {
    return { ok: false, message: `Pemindahan gagal: ${res.message}` };
  }
  return {
    ok: true,
    message: `Node aktif kini ${res.data.node_aktif === "salinan" ? "SALINAN" : "PUSAT"}.`,
  };
}
