"use server";

// Mode maintenance developer: pintu masuk/keluar sesi "bertindak sebagai
// owner/kasir outlet X". Cookie dev_outlet tetap dikelola Next.js (callback
// jwt di lib/auth.ts menyuntikkan outletId ke sesi); backend-go
// (POST/DELETE /outlets/{id}/maintenance-session) bertugas memastikan
// outlet sah dan mencatat kejadiannya ke audit_logs.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, DEV_OUTLET_COOKIE } from "@/lib/auth";
import { goFetch } from "@/lib/api";

// Keluar otomatis setelah 8 jam — maintenance yang terlupakan tidak boleh
// meninggalkan developer terseset sebagai owner selamanya.
const MAX_AGE_SECONDS = 8 * 60 * 60;

export async function enterMaintenance(
  outletId: string,
  target: "owner" | "cashier",
): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  // Outlet tidak sah / backend mati -> kembali ke konsol, bukan error 500.
  const res = await goFetch(
    session.user.goToken ?? "",
    `/outlets/${Number(outletId)}/maintenance-session`,
    { method: "POST", body: JSON.stringify({ target }) },
  );
  if (!res.ok) redirect("/dev");

  const store = await cookies();
  store.set(DEV_OUTLET_COOKIE, outletId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  redirect(target === "cashier" ? "/cashier" : "/owner");
}

export async function exitMaintenance(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const store = await cookies();
  const hadOutletId = store.get(DEV_OUTLET_COOKIE)?.value;
  store.delete(DEV_OUTLET_COOKIE);

  // Jejak keluar tetap dicatat bila masih ada id outlet di cookie.
  // Gagal memanggil (mis. backend sedang mati) TIDAK menggagalkan keluar
  // mode — keluar adalah gerbang keselamatan, endpoint Go pun idempoten.
  if (hadOutletId) {
    await goFetch(
      session.user.goToken ?? "",
      `/outlets/${Number(hadOutletId)}/maintenance-session`,
      { method: "DELETE" },
    );
  }

  redirect("/dev");
}
