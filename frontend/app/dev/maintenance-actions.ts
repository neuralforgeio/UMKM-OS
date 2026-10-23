"use server";

// Mode maintenance developer (Task 35): pintu masuk/keluar sesi
// "bertindak sebagai owner/kasir outlet X".
//
// Mekanismenya: cookie dev_outlet dibaca callback jwt (lib/auth.ts) yang
// lalu menyuntikkan outletId ke sesi — semua halaman owner/kasir langsung
// berperilaku seolah penggunanya staf outlet itu. Masuk dan keluar mode
// ini sendiri juga tercatat di jejak audit.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, DEV_OUTLET_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

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

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { id: true, name: true },
  });
  // Outlet sudah terhapus/typo id -> kembali ke konsol, bukan error 500.
  if (!outlet) redirect("/dev");

  const store = await cookies();
  store.set(DEV_OUTLET_COOKIE, outlet.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  await audit({
    actorId: session.user.id,
    outletId: outlet.id,
    action: "DEV_MAINTENANCE_ENTER",
    entity: `outlet:${outlet.id}`,
    summary: `${session.user.name ?? "Developer"} masuk mode maintenance outlet ${outlet.name} — bertindak sebagai ${target === "owner" ? "OWNER" : "KASIR"}`,
    meta: { outlet: outlet.name, target },
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

  if (hadOutletId) {
    const outlet = await prisma.outlet.findUnique({
      where: { id: hadOutletId },
      select: { name: true },
    });
    await audit({
      actorId: session.user.id,
      outletId: hadOutletId,
      action: "DEV_MAINTENANCE_EXIT",
      summary: `${session.user.name ?? "Developer"} keluar dari mode maintenance${outlet ? ` outlet ${outlet.name}` : ""}`,
    });
  }

  redirect("/dev");
}
