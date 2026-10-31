// Konsol Developer (Fase A + B + penyempurnaan Task 35).
// Super-user lintas outlet: ringkasan sistem, pintasan kelola akun &
// log aktivitas, daftar outlet (klik = drill-down, tombol + = buat baru),
// dan 20 jejak audit terbaru.
// v1.6.0: design aurora + glassmorphism, sadar tema (terang/gelap/sistem).
// v2.0.0: seluruh data dari backend-go (GET /reports/by-outlet +
// GET /audit-logs) — tabel Prisma tidak disentuh lagi; outlet baru
// langsung tampil di sini.
// v2.2.1: (1) topbar FULL-WIDTH memanjang kanan-kiri seperti navbar
// kasir/owner (dulu terkurung kolom 72rem di tengah layar);
// (2) kartu "Jejak Audit Terbaru" kini jendela TERMINAL PowerShell —
// ringkas, berbatas (maks 320px, scroll internal), warna per tingkat
// keseriusan & peran, selalu gelap di kedua tema.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  ScrollText,
  Store,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { AuditTerminal } from "@/components/audit-terminal";
import { buildAuditCommand } from "@/lib/audit-terminal";
import { WorkspaceShell } from "@/components/workspace-shell";
import { userMenuUser } from "@/lib/session-user";
import { OutletCreateButton } from "./outlet-create-button";

export const instant = false;

// Bentuk baris statistik per-outlet (backend-go GET /reports/by-outlet).
type GoOutletStat = {
  outlet_id: number;
  name: string;
  address: string;
  is_active: boolean;
  user_count: number;
  products: number;
  low_stock: number;
  trx_today: number;
  omzet_today: number;
};

// Bentuk baris audit (backend-go GET /audit-logs) — v2.2.1 menambah
// user_role & outlet_name yang dikirim Go sejak v1.6.0 untuk warna
// peran & label outlet di terminal.
type GoAuditRow = {
  id: number;
  user_id: number | null;
  user_name: string;
  user_role: string;
  outlet_name: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

export default async function DevConsolePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Hanya DEVELOPER boleh melihat konsol ini — owner & kasir punya
  // halamannya sendiri dan tidak boleh membaca data lintas outlet.
  if (session.user.role !== "DEVELOPER") redirect("/");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }

  // v2.0.0: statistik per-outlet + 20 jejak audit terbaru, semuanya dari
  // backend-go. Konsol super-user gagal keras bila backend mati — tidak
  // ada angka lama yang bisa tertukar dengan kondisi sekarang.
  const [statsRes, auditRes] = await Promise.all([
    goFetch<GoOutletStat[]>(session.user.goToken, "/reports/by-outlet"),
    goFetch<{ rows: GoAuditRow[] }>(session.user.goToken, "/audit-logs?limit=20"),
  ]);
  if (!statsRes.ok) {
    throw new Error(statsRes.message);
  }
  const outlets = statsRes.data;
  const auditRows = auditRes.ok ? auditRes.data.rows : [];

  const activeUsers = outlets.reduce((sum, o) => sum + o.user_count, 0);
  const omzetToday = outlets.reduce((sum, o) => sum + o.omzet_today, 0);
  const lowStockCount = outlets.reduce((sum, o) => sum + o.low_stock, 0);

  const statCards = [
    {
      label: "Outlet",
      value: String(outlets.length),
      icon: Building2,
      tint: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Akun Aktif",
      value: String(activeUsers),
      icon: Users,
      tint: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(omzetToday),
      icon: Store,
      tint: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
      tint: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    // Shell v3.2.0: sidebar WORKSPACE/MANAGE varian konsol developer
    // (pola PDF "Platform overview") — akses lintas outlet.
    <WorkspaceShell
      variant="dev"
      active="konsol"
      user={userMenuUser(session)}
      overline="Konsol Developer"
      title="Ringkasan platform"
      desc={`${session.user.name ?? "Developer"} · operasional global lintas outlet: akun, omzet, dan jejak audit.`}
    >
        {/* Pintasan Fase B: dua pintu utama konsol. Kartu besar + panah —
            bukan menu tersembunyi, karena ini alasan konsol ini ada. */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dev/users"
            className="glass-card group flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:border-violet-500/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Kelola Akun
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Buat owner &amp; kasir, reset password, nonaktifkan, hapus -
                  semua outlet.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-600 dark:group-hover:text-violet-400" />
          </Link>
          <Link
            href="/dev/logs"
            className="glass-card group flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:border-violet-500/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
                <ScrollText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Log Aktivitas
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Query jejak audit lengkap + filter tingkat &amp; unduh Excel
                  dengan grafik analisa.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-600 dark:group-hover:text-violet-400" />
          </Link>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="glass-card rounded-2xl p-4 transition-all"
            >
              <p className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                <span className="font-medium">{card.label}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${card.tint}`}
                >
                  <card.icon className="h-4 w-4" />
                </span>
              </p>
              <p
                className={`mt-1.5 truncate text-lg font-black tabular-nums sm:text-xl ${
                  card.label === "Stok Menipis" && lowStockCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="glass-card mt-4 rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Outlet
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Setiap outlet punya produk, stok, dan akunnya sendiri, terpisah
                secara data, satu database, satu pantauan. Klik nama outlet
                untuk drill-down atau masuk mode maintenance.
              </p>
            </div>
            <OutletCreateButton />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Alamat</th>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Omzet Hari Ini</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => (
                  <tr
                    key={o.outlet_id}
                    className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <Link
                        href={`/dev/outlets/${o.outlet_id}`}
                        className="transition hover:text-violet-700 hover:underline dark:hover:text-violet-400"
                      >
                        {o.name}
                      </Link>
                      {!o.is_active && (
                        <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {o.address || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {o.products}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatRupiah(o.omzet_today)}
                    </td>
                  </tr>
                ))}
                {outlets.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Belum ada outlet terdaftar — tekan &quot;Outlet Baru&quot;
                      untuk membuat yang pertama.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== Jejak Audit Terbaru — kini TERMINAL PowerShell (v2.2.1):
            ringkas satu baris info + satu baris detail, berbatas 320px
            dengan scroll internal, warna per tingkat & peran, selalu
            gelap di kedua tema. ===== */}
        <section className="mt-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Jejak Audit Terbaru
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Terminal hidup: 20 aksi terakhir lintas outlet —{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              SUKSES
            </span>{" "}
            selesai normal,{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              PERINGATAN
            </span>{" "}
            aksi sensitif,{" "}
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              GAGAL
            </span>{" "}
            percobaan yang error. Query penuh + unduh Excel di Log Aktivitas.
          </p>
          <div className="mt-3">
            <AuditTerminal
              title="umkm-os — jejak audit — 20 terbaru"
              command={buildAuditCommand({}, 20, true)}
              note="tingkat: SUKSES hijau · PERINGATAN kuning · GAGAL merah"
              rows={auditRows}
              variant="compact"
              footerRight={
                <Link
                  href="/dev/logs"
                  className="text-[11px] font-semibold text-violet-400 transition hover:text-violet-300 hover:underline"
                >
                  query penuh → /dev/logs
                </Link>
              }
            />
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Multi-outlet v2.0.0 aktif: produk, transaksi, dan antrean tiap
          outlet terpisah — dashboard &amp; POS mengikuti outlet akun.
        </p>
    </WorkspaceShell>
  );
}
