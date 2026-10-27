import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu } from "@/components/user-menu";
import { userMenuUser } from "@/lib/session-user";
import { auth } from "@/lib/auth";
import { getOutletContext } from "@/lib/outlet-context";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

// Halaman Asisten AI (frontend v2.4.0) — server component ringan:
// gerbang sesi/role + identitas outlet, lalu panel client yang bicara
// ke /api/assistant/*. Pemilik multi-outlet otomatis bertanya tentang
// outlet konteksnya (satu sumber kebenaran dengan dashboard).

export default async function HalamanAsisten() {
  const session = await auth();
  if (!session?.user?.goToken) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  const outlet = await getOutletContext();
  const namaOutlet = outlet?.name ?? "Warung";

  return (
    <div className="relative min-h-dvh bg-slate-100 dark:bg-slate-950">
      <AuroraBackground />
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                  Asisten — {namaOutlet}
                </h1>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {session.user.name ?? "Pemilik"} · Asisten Bisnis
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <UserMenu user={userMenuUser(session)} />
              <Link
                href="/owner"
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Kembali</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <AssistantPanel outletName={namaOutlet} />
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
            Asisten menjawab HANYA dari data outlet ini (penjualan, stok,
            produk, ramalan). Angka yang tidak lolos validasi data
            ditandai peringatan. Baca kebijakan privasi di Pengaturan.
          </p>
        </main>
      </div>
    </div>
  );
}
