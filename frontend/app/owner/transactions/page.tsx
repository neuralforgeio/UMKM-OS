import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";
import { userMenuUser } from "@/lib/session-user";
import { AppShell } from "@/components/shell/app-shell";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { TransactionsClient } from "./transactions-client";
import type { TransactionRow } from "./types";
import {
  describeLoadFailure,
  mapGoProfit,
  mapGoTransactionRow,
  type GoProfitEnvelope,
  type GoTransactionRow,
} from "./backend-adapter";

export const instant = false;

// Latest N receipts loaded for the history list, 200 covers roughly a
// busy fortnight at warung scale; older history stays queryable the
// day the page grows real pagination.
const LIST_LIMIT = 200;

// Panel diagnosis menggantikan throw(): kegagalan backend di build
// produksi Next.js 16 dulu berubah jadi "React error #441" dengan digest
// yang tidak mengatakan apa-apa (lihat laporan pemilik, halaman hitam
// "This page couldn't load"). Kini penyebab nyata + langkah pemulihan
// selalu tampil di dalam AppShell — halaman tetap dirender penuh.
function BackendLoadPanel({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl glass-card p-8"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {detail}
          </p>
          <a
            href="/owner/transactions"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-900 transition-colors hover:bg-slate-700 dark:hover:bg-slate-300"
          >
            Muat Ulang Halaman
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function OwnerTransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") redirect("/cashier");
  const token = session.user.goToken;
  if (!token) redirect("/login");

  // Outlet konteks ditentukan Go (ikatan akun / cookie maintenance dev),
  // satu pintu yang sama dengan kasir & dashboard, tanpa fallback tabel
  // beku era Prisma. Backend mati = panel diagnosis, bukan halaman error.
  const outlet = await getOutletContext();
  if (!outlet) redirect("/owner");

  // Riwayat + ringkasan laba 7/30 hari dalam dua panggilan paralel.
  // Omzet hanya menghitung struk COMPLETED, refund mengembalikan uang,
  // jadi tidak pernah masuk angka laba (dihitung Go, sama dengan era
  // Prisma). Kegagalan backend diterjemahkan describeLoadFailure menjadi
  // judul + langkah pemulihan yang tampil di halaman — tidak ada angka
  // palsu untuk keputusan bisnis, dan tidak ada React error #441.
  const [listRes, profitRes] = await Promise.all([
    goFetch<GoTransactionRow[]>(token, `/transactions?limit=${LIST_LIMIT}`),
    goFetch<GoProfitEnvelope>(token, "/reports/profit"),
  ]);

  // Penjadwalan cabang: kondisi di bawah menangkap SEMUA moda gagal
  // (tidak ok, bentuk data lama) sekaligus menyempitkan tipe untuk cabang
  // sehat - describeLoadFailure menerjemahkannya jadi pesan yang tampil.
  if (
    !listRes.ok ||
    !profitRes.ok ||
    !Array.isArray(listRes.data) ||
    !profitRes.data?.week ||
    !profitRes.data?.month
  ) {
    const failure = describeLoadFailure(listRes, profitRes) ?? {
      title: "Backend bermasalah",
      detail:
        "Bentuk data tidak dikenal. Muat ulang halaman; bila berlanjut " +
        "jalankan docker compose up -d --build lalu muat ulang lagi.",
    };
    return (
      <AppShell
        role={session.user.role === "DEVELOPER" ? "DEVELOPER" : "OWNER"}
        user={userMenuUser(session)}
        outlet={{
          name: outlet.name,
          logoUrl: outletLogoUrl(outlet),
          address: outlet.address,
        }}
        crumb="Menu Utama"
        title="Transaksi"
        subtitle={outlet.name}
      >
        <BackendLoadPanel title={failure.title} detail={failure.detail} />
      </AppShell>
    );
  }

  const listRows: TransactionRow[] = listRes.data.map(mapGoTransactionRow);
  const profitData = profitRes.data;

  return (
    <AppShell
      role={session.user.role === "DEVELOPER" ? "DEVELOPER" : "OWNER"}
      user={userMenuUser(session)}
      outlet={{
        name: outlet.name,
        logoUrl: outletLogoUrl(outlet),
        address: outlet.address,
      }}
      crumb="Menu Utama"
      title="Transaksi"
      subtitle={outlet.name}
    >
      <TransactionsClient
        outletName={outlet.name}
        userName={session.user.name ?? "Pemilik"}
        rows={listRows}
        weekSummary={mapGoProfit(profitData.week)}
        monthSummary={mapGoProfit(profitData.month)}
        me={userMenuUser(session)}
      />
    </AppShell>
  );
}
