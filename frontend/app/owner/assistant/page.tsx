import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { userMenuUser } from "@/lib/session-user";
import { auth } from "@/lib/auth";
import { getOutletContext } from "@/lib/outlet-context";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

// Halaman OSCAR (frontend v3.2.0) — server component ringan: gerbang
// sesi/role + identitas outlet, lalu panel client yang bicara ke
// /api/assistant/*. Pemilik multi-outlet otomatis bertanya tentang
// outlet konteksnya (satu sumber kebenaran dengan dashboard).
//
// Tata letak mengikuti halaman "OSCAR business copilot" PDF: kolom
// percakapan sebagai panggung utama + panel "Konteks bisnis" di kanan
// yang menjelaskan sumber data & batasan secara jujur.

export default async function HalamanAsisten() {
  const session = await auth();
  if (!session?.user?.goToken) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  const outlet = await getOutletContext();
  const namaOutlet = outlet?.name ?? "Warung";

  return (
    <WorkspaceShell
      variant="owner"
      active="oscar"
      user={userMenuUser(session)}
      outletName={namaOutlet}
      overline="Asisten Bisnis"
      title="OSCAR — kopilot bisnis"
      desc="Bantuan AI yang berpijak pada data bisnis Anda, bukan karangan."
      mainClassName="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kolom percakapan — panggung utama. */}
        <div className="lg:col-span-2">
          <AssistantPanel outletName={namaOutlet} />
        </div>

        {/* Panel konteks bisnis — jujur soal sumber data & batasan. */}
        <aside className="space-y-4">
          <section className="glass-card p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Konteks bisnis
              </h2>
            </div>
            <dl className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Outlet aktif
                </dt>
                <dd className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {namaOutlet}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Sumber data
                </dt>
                <dd className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Penjualan · stok · produk
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Mode jawaban
                </dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Data / AI
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Batas laju
                </dt>
                <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Per jam, per pengguna
                </dd>
              </div>
            </dl>
          </section>

          <section className="glass-card p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Aturan main OSCAR
            </h2>
            <ul className="mt-3 space-y-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <li className="flex gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Menjawab HANYA dari data outlet ini — penjualan, stok,
                produk, dan ramalan.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Angka yang tidak lolos validasi data ditandai peringatan
                agar tetap bisa diperiksa di dashboard.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Saran tindakan bersifat pendukung keputusan — tindakan
                finansial tetap disetujui manusia.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Riwayat percakapan tersimpan per pengguna; baca kebijakan
                privasi di Pengaturan.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
