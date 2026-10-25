// Banner mode maintenance — server component yang hanya merender sesuatu
// ketika pengunjung halaman owner/kasir adalah DEVELOPER yang sedang
// bertindak sebagai outlet tertentu. Untuk owner & kasir asli komponen ini
// transparan (null), jadi aman ditaruh di mana pun.
// Nama outlet kini dibaca dari backend-go (GET /outlets/{id}) — bukan
// lagi tabel Prisma.
import { Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { exitMaintenance } from "@/app/dev/maintenance-actions";
import type { GoOutletDTO } from "@/app/dev/users/view-helpers";

export async function MaintenanceBanner() {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "DEVELOPER" ||
    !session.user.outletId
  ) {
    return null;
  }

  const res = await goFetch<GoOutletDTO>(
    session.user.goToken ?? "",
    `/outlets/${Number(session.user.outletId)}`,
  );
  const outletName = res.ok ? res.data.name : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <span className="flex items-center gap-1.5 font-bold">
        <Wrench className="h-3.5 w-3.5" />
        Mode Maintenance
      </span>
      <span className="text-amber-800 dark:text-amber-300/90">
        Anda bertindak sebagai staf outlet{" "}
        <b className="text-amber-950 dark:text-amber-100">
          {outletName ?? "?"}
        </b>{" "}
        — semua perubahan tercatat atas nama developer di jejak audit.
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
