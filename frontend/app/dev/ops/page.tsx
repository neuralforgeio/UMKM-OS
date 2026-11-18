import { redirect } from "next/navigation";
import {
  Activity,
  Database,
  Flag,
  MonitorCog,
  Settings2,
  TerminalSquare,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { CardGerbang } from "./card-gerbang";
import { PotretKesehatan } from "./potret-kesehatan";
import { userMenuUser } from "@/lib/session-user";

export const instant = false;

// PUSAT KENDALI DEVELOPER (v1.5.0 Gerbang Developer) — halaman pembuka
// menu baru: potret kesehatan sistem LANGSUNG dari /admin/health plus
// pintasan ke lima alat baru (sesi, bendera, pengaturan, SQL console,
// metrik). Semuanya khusus DEVELOPER di sisi Go; halaman ini hanya
// penggambar.
export default async function PusatKendaliPage() {
  const session = await auth();
  const user = userMenuUser(session);
  if (!user || user.role !== "DEVELOPER") redirect("/login");

  const outlet = await getOutletContext();
  const goToken = session?.user?.goToken ?? "";
  const hasil = await goFetch<{
    app_version: string;
    go_version: string;
    uptime_s: number;
    uptime: string;
    goroutine: number;
    mem_heap_mb: number;
    mem_sys_mb: number;
    num_gc: number;
    node_aktif: string;
    failover_n: number;
    db_sehat: boolean;
    sesi_hidup: number;
  }>(goToken, "/admin/health");
  const sehat = hasil.ok ? hasil.data : null;

  const pintasan = [
    {
      href: "/dev/sessions",
      judul: "Sesi Aktif",
      ket: "Daftar sesi login lintas peran + tendang seketika",
      ikon: Users,
    },
    {
      href: "/dev/flags",
      judul: "Bendera Fitur",
      ket: "Nyalakan / matikan fitur tanpa restart container",
      ikon: Flag,
    },
    {
      href: "/dev/settings",
      judul: "Registri Pengaturan",
      ket: "Setel parameter terdaftar dengan validasi tipe",
      ikon: Settings2,
    },
    {
      href: "/dev/sql",
      judul: "SQL Console",
      ket: "Kueri hanya-baca langsung ke database warung",
      ikon: TerminalSquare,
    },
    {
      href: "/dev/metrics",
      judul: "Metrik Ringkas",
      ket: "Omzet/produk/user per outlet + laju transaksi per jam",
      ikon: Activity,
    },
  ];

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
      title="Pusat Kendali"
      subtitle="Enam alat operasional warung, khusus developer"
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
        <header className="flex items-center gap-3">
          <MonitorCog className="size-8 text-sky-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Pusat Kendali Developer
            </h1>
            <p className="text-sm text-muted-foreground">
              Enam alat operasional warung: kesehatan, sesi, bendera,
              pengaturan, SQL, metrik — semuanya ter-audit.
            </p>
          </div>
        </header>

        <PotretKesehatan sehat={sehat} gagal={!hasil.ok} />

        <section className="grid gap-4 sm:grid-cols-2">
          {pintasan.map((p) => (
            <CardGerbang
              key={p.href}
              href={p.href}
              judul={p.judul}
              ket={p.ket}
              ikon={p.ikon}
            />
          ))}
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
            <Database className="mb-2 size-5" />
            Cadangan & salinan database tetap di Pengaturan → Cadangkan
            Data (jalur v2.1.0). Alat di sini melengkapi, bukan
            menggantikan.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
