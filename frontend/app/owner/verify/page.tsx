// Daftar serah terima HARI INI (WIB) — dibuka kurir/kasir/owner dari
// perangkat yang SUDAH LOGIN. Inilah obat "penjual lupa kode klaim":
// semua kode verifikasi selalu hidup di daftar ini, setiap hari.
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { startOfTodayWIB } from "@/lib/handover";

export const instant = false;

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

export default async function VerifyListPage() {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "OWNER" && user.role !== "KASIR")) redirect("/");

  const rows = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: startOfTodayWIB() },
      claimCode: { not: null },
      // Kasir hanya melihat outlet-nya; owner tanpa outlet melihat semua.
      ...(user.outletId ? { outletId: user.outletId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      paymentMethod: true,
      total: true,
      claimCode: true,
      handoverStatus: true,
    },
  });

  const chips: { label: string; value: number; cls: string }[] = [
    {
      label: "Transaksi",
      value: rows.length,
      cls: "bg-slate-100 text-slate-700",
    },
    {
      label: "Terverifikasi",
      value: rows.filter((r) => r.handoverStatus === "CONFIRMED").length,
      cls: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Klaim kurir",
      value: rows.filter((r) => r.handoverStatus === "COURIER_CLAIMED").length,
      cls: "bg-amber-100 text-amber-700",
    },
    {
      label: "Dibantah",
      value: rows.filter((r) => r.handoverStatus === "DISPUTED").length,
      cls: "bg-red-100 text-red-700",
    },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={user.role === "KASIR" ? "/cashier" : "/owner"}
          className="text-sm text-slate-500"
        >
          ← Kembali
        </Link>
        <p className="text-sm font-semibold text-slate-700">
          Serah Terima Hari Ini
        </p>
        <span className="w-10" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <div key={c.label} className={`rounded-xl p-2 text-center ${c.cls}`}>
            <p className="text-lg font-bold leading-tight">{c.value}</p>
            <p className="text-[10px] leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((r) => {
          const st = r.handoverStatus;
          const badge =
            st === "CONFIRMED"
              ? { t: "OK", cls: "bg-emerald-600" }
              : st === "DISPUTED"
                ? { t: "BANTAH", cls: "bg-red-600" }
                : st === "COURIER_CLAIMED"
                  ? { t: "KLAIM", cls: "bg-amber-500" }
                  : { t: "BELUM", cls: "bg-slate-400" };
          return (
            <li key={r.id}>
              <Link
                href={`/owner/verify/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm active:bg-slate-100"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold tracking-widest text-slate-900">
                    {r.claimCode}
                  </p>
                  <p className="text-xs text-slate-500">
                    {timeFmt.format(r.createdAt)} ·{" "}
                    {formatRupiah(Number(r.total))} ·{" "}
                    {PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold text-white ${badge.cls}`}
                >
                  {badge.t}
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
            Belum ada transaksi hari ini.
          </li>
        )}
      </ul>
    </main>
  );
}
