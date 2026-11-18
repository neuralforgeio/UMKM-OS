import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { userMenuUser } from "@/lib/session-user";
import { LajuJam } from "./laju-jam";

export const instant = false;

type OutletM = {
  outlet_id: number;
  name: string;
  user_count: number;
  products: number;
  omzet_today: number;
  trx_today: number;
};

type JamM = { jam: number; trx: number };

// METRIK RINGKAS (v1.5.0): potret bisnis per outlet + laju transaksi
// per jam hari ini — angka dibaca mentah dari backend 2.2.0.
export default async function MetrikPage() {
  const session = await auth();
  const user = userMenuUser(session);
  if (!user || user.role !== "DEVELOPER") redirect("/login");

  const outlet = await getOutletContext();
  const goToken = session?.user?.goToken ?? "";
  const hasil = await goFetch<{
    per_outlet: OutletM[];
    per_jam: JamM[];
    total_produk: number;
    total_user: number;
  }>(goToken, "/admin/metrics");
  const m = hasil.ok ? hasil.data : null;

  return (
    <AppShell
      role="DEVELOPER"
      user={user}
      outlet={{
        name: outlet?.name ?? "Konsol Developer",
        logoUrl: outlet ? outletLogoUrl(outlet) : null,
        address: outlet?.address ?? null,
      }}
      crumb="Gerbang Developer"
      title="Metrik"
      subtitle="Omzet per outlet + laju transaksi per jam"
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
        <header className="flex items-center gap-3">
          <Activity className="size-7 text-sky-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Metrik Ringkas
            </h1>
            <p className="text-sm text-muted-foreground">
              Omzet / produk / pengguna per outlet hari ini + laju
              transaksi per jam.
            </p>
          </div>
        </header>

        {!m ? (
          <p className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
            Metrik tidak terbaca — pastikan backend 2.2.0 berjalan.
          </p>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total Pengguna
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {m.total_user}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total Produk
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {m.total_produk}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Outlet
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {m.per_outlet.length}
                </div>
              </div>
            </section>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Outlet</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Produk</th>
                    <th className="p-3">Trx Hari Ini</th>
                    <th className="p-3">Omzet Hari Ini</th>
                  </tr>
                </thead>
                <tbody>
                  {m.per_outlet.map((o) => (
                    <tr
                      key={o.outlet_id}
                      className="border-t odd:bg-muted/20 [&:hover]:bg-muted/40"
                    >
                      <td className="p-3 font-medium">{o.name}</td>
                      <td className="p-3 tabular-nums">{o.user_count}</td>
                      <td className="p-3 tabular-nums">{o.products}</td>
                      <td className="p-3 tabular-nums">{o.trx_today}</td>
                      <td className="p-3 tabular-nums">
                        {formatRupiah(o.omzet_today)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <LajuJam perJam={m.per_jam} />
          </>
        )}
      </div>
    </AppShell>
  );
}
