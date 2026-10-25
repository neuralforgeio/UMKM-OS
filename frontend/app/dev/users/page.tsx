import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { AuroraBackground } from "@/components/aurora-background";
import { UsersClient } from "./users-client";
import {
  mapGoOutlets,
  mapGoUsers,
  type GoOutletDTO,
  type GoUserDTO,
} from "./view-helpers";

export const instant = false;

// Konsol kelola akun (khusus DEVELOPER) â€” kini membaca langsung dari
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

  // Backend tidak terjangkau: kartu error yang jelas, bukan crash â€”
  // mengikuti tema aplikasi (aurora + glass, terang/gelap).
  if (!usersRes.ok || !outletsRes.ok) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-slate-100 p-4 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <AuroraBackground />
        <div className="glass-card relative z-10 w-full max-w-md rounded-2xl p-8 text-center">
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
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