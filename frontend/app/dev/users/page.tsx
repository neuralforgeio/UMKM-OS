import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { UsersClient } from "./users-client";
import {
  mapGoOutlets,
  mapGoUsers,
  type GoOutletDTO,
  type GoUserDTO,
} from "./view-helpers";

export const instant = false;

// Konsol kelola akun (khusus DEVELOPER) — kini membaca langsung dari
// backend-go: GET /users (akun live + last_transaction_at) dan
// GET /outlets (pilihan ikatan di form akun). Akun terhapus tidak
// pernah dikirim Go (deleted_at IS NULL), jadi filter di UI tidak
// perlu tahu konsep itu.
export default async function DevUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const goToken = session.user.goToken ?? "";
  const [usersRes, outletsRes] = await Promise.all([
    goFetch<GoUserDTO[]>(goToken, "/users"),
    goFetch<GoOutletDTO[]>(goToken, "/outlets"),
  ]);

  // Backend tidak terjangkau: kartu error yang jelas, bukan crash —
  // pola yang sama dengan halaman owner/kasir era v1.0.x.
  if (!usersRes.ok || !outletsRes.ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="glass-card w-full max-w-md p-8 text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Kelola Akun tidak bisa dimuat
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Backend-go tidak merespons di{" "}
            {usersRes.ok ? "daftar outlet" : "daftar akun"}. Pastikan container
            backend-go jalan (docker compose ps), lalu muat ulang halaman ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <UsersClient
      users={mapGoUsers(usersRes.data)}
      outlets={mapGoOutlets(outletsRes.data)}
      currentUserId={session.user.id}
      userName={session.user.name ?? "Developer"}
      userEmail={session.user.email ?? ""}
    />
  );
}
