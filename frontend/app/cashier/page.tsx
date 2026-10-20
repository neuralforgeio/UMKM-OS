import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const instant = false

export default async function CashierPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
          Area Kasir
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Halo, {session.user.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Gerbang kasir aktif. Antarmuka POS lengkap dibangun pada sesi
          berikutnya.
        </p>
      </div>
    </main>
  );
}
