import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "./users-client";
import type { OutletOption, UserRow } from "./types";

export const instant = false;

// Konsol kelola akun (Task 34, Fase B) — khusus DEVELOPER.
// Owner mengelola kasir outletnya sendiri lewat /owner/users (Fase C).
export default async function DevUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const [userRows, outletRows, lastTxRows] = await Promise.all([
    prisma.user.findMany({
      // Terbaru di atas: akun yang baru dibuat langsung terlihat.
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        outletId: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        outlet: { select: { name: true } },
      },
    }),
    prisma.outlet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Satu groupBy untuk kolom "transaksi terakhir": lebih murah dan
    // lebih bersih daripada sub-query N+1 per baris akun.
    prisma.transaction.groupBy({
      by: ["cashierId"],
      _max: { createdAt: true },
    }),
  ]);

  const lastTxMap = new Map(
    lastTxRows.map((row) => [row.cashierId, row._max.createdAt ?? null]),
  );

  const users: UserRow[] = userRows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    outletId: user.outletId,
    outletName: user.outlet?.name ?? null,
    isActive: user.isActive,
    isDeleted: user.deletedAt !== null,
    createdAtIso: user.createdAt.toISOString(),
    lastTransactionAtIso: lastTxMap.get(user.id)?.toISOString() ?? null,
  }));

  const outlets: OutletOption[] = outletRows.map((outlet) => ({
    id: outlet.id,
    name: outlet.name,
  }));

  return (
    <UsersClient
      users={users}
      outlets={outlets}
      currentUserId={session.user.id}
    />
  );
}
