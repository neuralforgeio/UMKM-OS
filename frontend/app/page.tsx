import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({ where: { id: session.user.outletId } })
    : await prisma.outlet.findFirst();

  const menu = [
    { href: "/cashier", title: "Kasir", desc: "Buka transaksi penjualan" },
    ...(session.user.role === "OWNER"
      ? [
          {
            href: "/owner",
            title: "Owner",
            desc: "Laporan dan pengaturan warung",
          },
        ]
      : []),
  ];

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Selamat datang, {session.user.name}
            </h1>
            <p className="text-sm text-slate-500">
              {outlet?.name ?? "Warung"} · peran {session.user.role}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Keluar
            </button>
          </form>
        </header>

        <nav className="grid gap-4 sm:grid-cols-2">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <p className="text-lg font-semibold text-slate-900">
                {item.title}
              </p>
              <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
