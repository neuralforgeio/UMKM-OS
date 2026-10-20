import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function OwnerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/cashier");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [activeProducts, transactionsToday] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.transaction.count({ where: { createdAt: { gte: startOfDay } } }),
  ]);

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
            Area Owner
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Ringkasan hari ini
          </h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Produk aktif</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {activeProducts}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Transaksi hari ini</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {transactionsToday}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Laporan lengkap, void transaksi, dan manajemen produk menyusul pada
          sesi laporan.
        </p>
      </div>
    </main>
  );
}
