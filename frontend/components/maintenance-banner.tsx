// Banner mode maintenance (Task 35) — server component yang hanya
// merender sesuatu ketika pengunjung halaman owner/kasir adalah DEVELOPER
// yang sedang bertindak sebagai outlet tertentu. Untuk owner & kasir
// asli komponen ini transparan (null), jadi aman ditaruh di mana pun.
import { Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exitMaintenance } from "@/app/dev/maintenance-actions";

export async function MaintenanceBanner() {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "DEVELOPER" ||
    !session.user.outletId
  ) {
    return null;
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: session.user.outletId },
    select: { name: true },
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900">
      <span className="flex items-center gap-1.5 font-bold">
        <Wrench className="h-3.5 w-3.5" />
        Mode Maintenance
      </span>
      <span className="text-amber-800">
        Anda bertindak sebagai staf outlet{" "}
        <b className="text-amber-950">{outlet?.name ?? "?"}</b> — semua
        perubahan tercatat atas nama developer di jejak audit.
      </span>
      <form action={exitMaintenance}>
        <button
          type="submit"
          className="rounded-lg bg-amber-600 px-2.5 py-1 font-bold text-white shadow-sm transition hover:bg-amber-700"
        >
          Keluar Mode
        </button>
      </form>
    </div>
  );
}
